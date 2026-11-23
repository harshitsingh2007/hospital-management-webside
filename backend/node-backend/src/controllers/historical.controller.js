/**
 * historical.controller.js
 * ------------------------
 * Historical Data Ingestion, Multi-Tenant Model Training, Monitoring & Safe Rollback.
 */

const prisma = require("../config/prisma");
const engine = require("../services/queueEngine");
const {
  triggerModelRetrain,
  getModelStatus,
  rollbackModel,
  getModelVersions,
} = require("../services/aiService");
const { getIo, broadcastQueueUpdate } = require("../socket");
const env = require("../config/env");
const { queueDateToPrismaDate, getCurrentQueueDate } = require("../utils/timezone");

const MIN_TRAINING_ROWS = 500;
const STALE_RUN_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

async function previewHistoricalDataEndpoint(req, res, next) {
  try {
    const aiUrl = env.AI_SERVICE_URL || "http://localhost:8001";
    const fetchResponse = await fetch(`${aiUrl}/preview-historical`, {
      method: "POST",
      body: req.body,
      headers: {
        ...req.headers,
        host: undefined,
        "X-AI-Internal-Secret": env.AI_INTERNAL_SECRET || "internal-queue-ai-secret-key-2026",
      },
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.json();
      return res.status(fetchResponse.status).json(err);
    }

    const data = await fetchResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: `AI service preview failed: ${error.message}`,
    });
  }
}

async function uploadHistoricalDataEndpoint(req, res, next) {
  try {
    const aiUrl = env.AI_SERVICE_URL || "http://localhost:8001";
    const fetchResponse = await fetch(`${aiUrl}/validate-historical`, {
      method: "POST",
      body: req.body,
      headers: {
        ...req.headers,
        host: undefined,
        "X-AI-Internal-Secret": env.AI_INTERNAL_SECRET || "internal-queue-ai-secret-key-2026",
      },
    });

    const valResult = await fetchResponse.json();
    if (!fetchResponse.ok || !valResult.success) {
      return res.status(400).json(valResult);
    }

    const tenantId = valResult.tenant_id || "city-hospital-01";
    const hid = await engine.resolveHospitalId(tenantId);
    const records = valResult.records || [];

    if (records.length > 0) {
      const batch = records.map((r) => ({
        hospital_id: hid,
        legacy_tenant_id: tenantId,
        consumer_type: r.consumer_type || "hospital",
        queue_date: queueDateToPrismaDate(r.queue_date || getCurrentQueueDate()),
        queue_length: parseInt(r.queue_length, 10) || 1,
        active_staff_counters: parseInt(r.active_staff_counters, 10) || 2,
        service_category: String(r.service_category || "consultation"),
        service_duration_minutes: parseFloat(r.service_duration_minutes) || 12.0,
        complexity_score: parseFloat(r.complexity_score) || 1.0,
        hour_of_day: parseInt(r.hour_of_day, 10) || 12,
        day_of_week: parseInt(r.day_of_week, 10) || 1,
        is_peak_hour: parseInt(r.is_peak_hour, 10) || 0,
      }));

      await prisma.tenant_historical_data.createMany({
        data: batch,
      });
    }

    const totalStored = await prisma.tenant_historical_data.count({
      where: { hospital_id: hid },
    });

    const minMet = totalStored >= MIN_TRAINING_ROWS;

    return res.status(200).json({
      success: true,
      tenant_id: tenantId,
      imported_records: records.length,
      total_stored_records: totalStored,
      rejected_records: valResult.rejected_rows || 0,
      warnings: valResult.warnings || [],
      min_threshold_met: minMet,
      min_required_rows: MIN_TRAINING_ROWS,
      message: `Successfully imported ${records.length} valid records into historical database. Total stored: ${totalStored} records.`,
    });
  } catch (error) {
    next(error);
  }
}

async function trainModelEndpoint(req, res, next) {
  const tenantId = req.body?.tenant_id || "global";
  let hid = null;
  if (tenantId !== "global") {
    hid = await engine.resolveHospitalId(tenantId);
  }

  // 1. Concurrency Lock check: only one running job per tenant
  const runningRun = await prisma.model_training_runs.findFirst({
    where: {
      tenant_code: tenantId,
      status: "running",
    },
    orderBy: { created_at: "desc" },
  });

  if (runningRun) {
    const isStale = Date.now() - new Date(runningRun.created_at).getTime() > STALE_RUN_TIMEOUT_MS;
    if (!isStale) {
      return res.status(409).json({
        status: "error",
        message: `A training job is already currently running for tenant '${tenantId}' (started at ${runningRun.created_at.toISOString()}).`,
      });
    } else {
      // Clean up stale run
      await prisma.model_training_runs.update({
        where: { id: runningRun.id },
        data: {
          status: "failed",
          promotion_reason: "Timed out after 15 minutes",
        },
      });
    }
  }

  // 2. Insert new running run
  const currentRun = await prisma.model_training_runs.create({
    data: {
      hospital_id: hid,
      tenant_code: tenantId,
      version: `training_${Date.now()}`,
      status: "running",
      data_source: "service_logs",
    },
  });

  try {
    let combined = [];
    let dataSource = "service_logs";

    if (tenantId === "global") {
      // Gather data only from hospitals that opted in with allow_global_learning = true
      const optedInHospitals = await prisma.hospitals.findMany({
        where: { allow_global_learning: true },
        select: { id: true, hospital_code: true },
      });
      const allowedIds = optedInHospitals.map((h) => h.id);

      if (allowedIds.length > 0) {
        const histRows = await prisma.tenant_historical_data.findMany({
          where: { hospital_id: { in: allowedIds } },
          select: {
            consumer_type: true,
            service_category: true,
            queue_length: true,
            active_staff_counters: true,
            service_duration_minutes: true,
            complexity_score: true,
            hour_of_day: true,
            day_of_week: true,
            is_peak_hour: true,
            created_at: true,
          },
          orderBy: { created_at: "asc" },
        });

        const logRows = await prisma.service_logs.findMany({
          where: { hospital_id: { in: allowedIds } },
          select: {
            consumer_type: true,
            service_category: true,
            queue_length: true,
            active_staff_counters: true,
            service_duration_minutes: true,
            complexity_score: true,
            hour_of_day: true,
            day_of_week: true,
            is_peak_hour: true,
            serve_end_time: true,
            created_at: true,
          },
          orderBy: { created_at: "asc" },
        });

        const mappedHist = histRows.map((r) => ({
          ...r,
          completed_at: r.created_at ? r.created_at.toISOString() : undefined,
        }));
        const mappedLogs = logRows.map((r) => ({
          ...r,
          completed_at: r.serve_end_time
            ? r.serve_end_time.toISOString()
            : r.created_at
            ? r.created_at.toISOString()
            : undefined,
        }));

        combined = [...mappedHist, ...mappedLogs];
        combined.sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));
      }

      // If pooled real data passes threshold (2,000 rows), train on it; else use synthetic
      if (combined.length >= 2000) {
        dataSource = "pooled_service_logs";
      } else {
        dataSource = "synthetic";
        combined = [];
      }
    } else {
      // Specific hospital tenant
      const histRows = await prisma.tenant_historical_data.findMany({
        where: { hospital_id: hid },
        select: {
          consumer_type: true,
          service_category: true,
          queue_length: true,
          active_staff_counters: true,
          service_duration_minutes: true,
          complexity_score: true,
          hour_of_day: true,
          day_of_week: true,
          is_peak_hour: true,
          created_at: true,
        },
        orderBy: { created_at: "asc" },
      });

      const logRows = await prisma.service_logs.findMany({
        where: { hospital_id: hid },
        select: {
          consumer_type: true,
          service_category: true,
          queue_length: true,
          active_staff_counters: true,
          service_duration_minutes: true,
          complexity_score: true,
          hour_of_day: true,
          day_of_week: true,
          is_peak_hour: true,
          serve_end_time: true,
          created_at: true,
        },
        orderBy: { created_at: "asc" },
      });

      const mappedHist = histRows.map((r) => ({
        ...r,
        completed_at: r.created_at ? r.created_at.toISOString() : undefined,
      }));
      const mappedLogs = logRows.map((r) => ({
        ...r,
        completed_at: r.serve_end_time
          ? r.serve_end_time.toISOString()
          : r.created_at
          ? r.created_at.toISOString()
          : undefined,
      }));

      combined = [...mappedHist, ...mappedLogs];
      combined.sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));

      dataSource = combined.length > 0 ? "service_logs" : "synthetic";
    }

    const recordsToSend = combined.length > 0 ? combined : null;
    const meta = await triggerModelRetrain(tenantId, recordsToSend, dataSource);

    // Update run record upon completion
    await prisma.model_training_runs.update({
      where: { id: currentRun.id },
      data: {
        status: "completed",
        version: meta.version || `v${Date.now()}`,
        promoted: !!meta.promoted,
        promotion_reason: meta.promotion_reason || "",
        data_source: dataSource,
        training_rows: meta.training_rows || combined.length,
        mae: meta.candidate_mae || meta.mae || 0.0,
        baseline_mae: meta.baseline_mae || 0.0,
        mape: meta.mape || 0.0,
        r2_score: meta.r2 || 0.0,
        model_path: meta.model_path || "",
      },
    });

    const io = getIo();
    if (io) {
      await broadcastQueueUpdate(io, tenantId);
    }

    return res.status(200).json({
      status: "success",
      message: `Successfully trained model for tenant '${tenantId}'`,
      metrics: meta,
      ...meta,
    });
  } catch (error) {
    await prisma.model_training_runs.update({
      where: { id: currentRun.id },
      data: {
        status: "failed",
        promotion_reason: `Training error: ${error.message}`,
      },
    });
    next(error);
  }
}

async function rollbackModelEndpoint(req, res, next) {
  try {
    const tenantId = req.body?.tenant_id || "global";
    const targetVersion = req.body?.target_version;
    if (!targetVersion) {
      return res.status(400).json({ status: "error", message: "target_version is required" });
    }

    let hid = null;
    if (tenantId !== "global") {
      hid = await engine.resolveHospitalId(tenantId);
    }

    const result = await rollbackModel(tenantId, targetVersion);

    // Record rollback run
    await prisma.model_training_runs.create({
      data: {
        hospital_id: hid,
        tenant_code: tenantId,
        version: targetVersion,
        status: "completed",
        promoted: true,
        promotion_reason: `Manual rollback to version ${targetVersion} by ${req.user?.email || "admin"}`,
        data_source: "rollback",
      },
    });

    const io = getIo();
    if (io) {
      await broadcastQueueUpdate(io, tenantId);
    }

    return res.status(200).json({
      status: "success",
      message: `Successfully rolled back tenant '${tenantId}' to version '${targetVersion}'`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function getModelVersionsEndpoint(req, res, next) {
  try {
    const tenantId = req.params.tenant_id || "global";
    const data = await getModelVersions(tenantId);
    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

async function toggleAutoLearningEndpoint(req, res, next) {
  try {
    const tenantId = req.body?.tenant_id;
    if (!tenantId || tenantId === "global") {
      return res.status(400).json({
        status: "error",
        message: "A specific hospital tenant_id is required to configure learning toggles.",
      });
    }

    const hid = await engine.resolveHospitalId(tenantId);
    if (!hid) {
      return res.status(404).json({ status: "error", message: `Hospital '${tenantId}' not found.` });
    }

    const updateData = {};
    if (typeof req.body.auto_learning_enabled === "boolean") {
      updateData.auto_learning_enabled = req.body.auto_learning_enabled;
    }
    if (typeof req.body.allow_global_learning === "boolean") {
      updateData.allow_global_learning = req.body.allow_global_learning;
    }

    const updated = await prisma.hospitals.update({
      where: { id: hid },
      data: updateData,
      select: {
        id: true,
        hospital_code: true,
        auto_learning_enabled: true,
        allow_global_learning: true,
      },
    });

    return res.status(200).json({
      status: "success",
      settings: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function getModelMonitoringEndpoint(req, res, next) {
  try {
    const tenantId = req.params.tenant_id || "global";
    let hid = null;
    if (tenantId !== "global") {
      hid = await engine.resolveHospitalId(tenantId);
    }

    const modelStatus = await getModelStatus(tenantId);

    // Past 7 days tickets
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const ticketsWhere = {
      status: { in: ["completed", "transferred"] },
      serve_end_time: { gte: sevenDaysAgo },
    };
    if (hid) {
      ticketsWhere.hospital_id = hid;
    }

    const completedTickets = await prisma.tickets.findMany({
      where: ticketsWhere,
      select: {
        id: true,
        ticket_id: true,
        service_category: true,
        department_id: true,
        predicted_service_minutes: true,
        actual_service_minutes: true,
        serve_start_time: true,
        serve_end_time: true,
        created_at: true,
      },
      orderBy: { serve_end_time: "desc" },
    });

    let totalAbsError = 0;
    let validCount = 0;
    const deptStats = {};

    for (const t of completedTickets) {
      if (!t.serve_start_time || !t.serve_end_time || typeof t.predicted_service_minutes !== "number") continue;
      const actualMinutes = t.actual_service_minutes || ((new Date(t.serve_end_time) - new Date(t.serve_start_time)) / 60000);
      if (actualMinutes < 0.5 || actualMinutes > 240) continue;

      const absError = Math.abs(actualMinutes - t.predicted_service_minutes);
      totalAbsError += absError;
      validCount += 1;

      const deptName = t.service_category || "General";
      if (!deptStats[deptName]) {
        deptStats[deptName] = { totalAbsError: 0, count: 0 };
      }
      deptStats[deptName].totalAbsError += absError;
      deptStats[deptName].count += 1;
    }

    const liveMae = validCount > 0 ? Math.round((totalAbsError / validCount) * 100) / 100 : null;
    const trainingMae = typeof modelStatus.mae === "number" ? modelStatus.mae : null;

    // Drift rule: minimum 30 samples and live MAE > 20% higher than training MAE
    const driftDetected =
      validCount >= 30 && trainingMae !== null && liveMae !== null && liveMae > trainingMae * 1.2;

    const departmentBreakdown = Object.entries(deptStats).map(([dept, s]) => ({
      department: dept,
      sample_count: s.count,
      live_mae: Math.round((s.totalAbsError / s.count) * 100) / 100,
    }));

    // New service logs rows since last completed training run
    const latestRun = await prisma.model_training_runs.findFirst({
      where: { tenant_code: tenantId, status: "completed" },
      orderBy: { created_at: "desc" },
    });

    const newRowsWhere = hid ? { hospital_id: hid } : {};
    if (latestRun && latestRun.created_at) {
      newRowsWhere.created_at = { gt: latestRun.created_at };
    }
    const newRowsSinceTraining = await prisma.service_logs.count({ where: newRowsWhere });

    // Hospital settings
    let hospitalSettings = {
      auto_learning_enabled: false,
      allow_global_learning: false,
    };
    if (hid) {
      const hosp = await prisma.hospitals.findUnique({
        where: { id: hid },
        select: { auto_learning_enabled: true, allow_global_learning: true },
      });
      if (hosp) {
        hospitalSettings = hosp;
      }
    }

    return res.status(200).json({
      tenant_id: tenantId,
      active_version: modelStatus.version || "v_active",
      model_type: modelStatus.model_type || "ExtraTrees",
      training_mae: trainingMae,
      training_rows: modelStatus.training_rows || 0,
      trained_at: modelStatus.trained_at || modelStatus.last_updated || "Baseline",
      live_7d_mae: liveMae,
      live_samples_7d: validCount,
      drift_detected: driftDetected,
      drift_message: driftDetected
        ? `Live 7-day MAE (${liveMae}m) is >20% higher than training MAE (${trainingMae}m) across ${validCount} samples. Model drift detected.`
        : null,
      new_rows_since_training: newRowsSinceTraining,
      department_breakdown: departmentBreakdown,
      hospital_settings: hospitalSettings,
      latest_run: latestRun,
    });
  } catch (error) {
    next(error);
  }
}

async function getModelStatusEndpoint(req, res, next) {
  try {
    const tenantId = req.params.tenant_id || "global";
    const status = await getModelStatus(tenantId);
    return res.status(200).json(status);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  previewHistoricalDataEndpoint,
  uploadHistoricalDataEndpoint,
  trainModelEndpoint,
  rollbackModelEndpoint,
  getModelVersionsEndpoint,
  toggleAutoLearningEndpoint,
  getModelMonitoringEndpoint,
  getModelStatusEndpoint,
};
