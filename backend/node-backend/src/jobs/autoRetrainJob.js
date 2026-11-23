/**
 * autoRetrainJob.js
 * -----------------
 * Scheduled Continuous Learning Worker.
 *
 * Scans hospitals that have opted into continuous auto-learning (auto_learning_enabled = true).
 * When newly accumulated service_logs exceed the threshold (default 200 rows), triggers
 * candidate model training with safe champion vs challenger holdout evaluation.
 */

const prisma = require("../config/prisma");
const { triggerModelRetrain } = require("../services/aiService");

const MIN_NEW_ROWS_DEFAULT = 200;
const STALE_RUN_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

let intervalHandle = null;

async function checkAndRetrainHospital(hospital, minNewRows = MIN_NEW_ROWS_DEFAULT) {
  const tenantCode = hospital.hospital_code;
  const hid = hospital.id;

  // 1. Concurrency Check
  const runningRun = await prisma.model_training_runs.findFirst({
    where: {
      tenant_code: tenantCode,
      status: "running",
    },
    orderBy: { created_at: "desc" },
  });

  if (runningRun) {
    const isStale = Date.now() - new Date(runningRun.created_at).getTime() > STALE_RUN_TIMEOUT_MS;
    if (!isStale) {
      console.log(`[AutoRetrain] Tenant '${tenantCode}' already has a training run in progress. Skipping.`);
      return false;
    }
    // Clean up stale run
    await prisma.model_training_runs.update({
      where: { id: runningRun.id },
      data: {
        status: "failed",
        promotion_reason: "Timed out after 15 minutes",
      },
    });
  }

  // 2. Count new rows since latest completed run
  const latestRun = await prisma.model_training_runs.findFirst({
    where: {
      tenant_code: tenantCode,
      status: "completed",
    },
    orderBy: { created_at: "desc" },
  });

  const newRowsWhere = { hospital_id: hid };
  if (latestRun && latestRun.created_at) {
    newRowsWhere.created_at = { gt: latestRun.created_at };
  }

  const newRowsCount = await prisma.service_logs.count({ where: newRowsWhere });
  if (newRowsCount < minNewRows) {
    return false;
  }

  console.log(
    `[AutoRetrain] Tenant '${tenantCode}' accumulated ${newRowsCount} new service logs (threshold: ${minNewRows}). Starting retrain job.`
  );

  // 3. Acquire run lock
  const currentRun = await prisma.model_training_runs.create({
    data: {
      hospital_id: hid,
      tenant_code: tenantCode,
      version: `auto_${Date.now()}`,
      status: "running",
      data_source: "service_logs",
    },
  });

  try {
    // 4. Fetch full chronological training dataset
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

    const combined = [...mappedHist, ...mappedLogs];
    combined.sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));

    const meta = await triggerModelRetrain(tenantCode, combined, "service_logs");

    await prisma.model_training_runs.update({
      where: { id: currentRun.id },
      data: {
        status: "completed",
        version: meta.version || `v${Date.now()}`,
        promoted: !!meta.promoted,
        promotion_reason: meta.promotion_reason || "",
        data_source: "service_logs",
        training_rows: meta.training_rows || combined.length,
        mae: meta.candidate_mae || meta.mae || 0.0,
        baseline_mae: meta.baseline_mae || 0.0,
        mape: meta.mape || 0.0,
        r2_score: meta.r2 || 0.0,
        model_path: meta.model_path || "",
      },
    });

    console.log(
      `[AutoRetrain] Finished run for '${tenantCode}': Promoted=${meta.promoted} (${meta.promotion_reason})`
    );
    return true;
  } catch (err) {
    console.error(`[AutoRetrain] Error during retrain for '${tenantCode}': ${err.message}`);
    await prisma.model_training_runs.update({
      where: { id: currentRun.id },
      data: {
        status: "failed",
        promotion_reason: `Auto retrain failure: ${err.message}`,
      },
    });
    return false;
  }
}

async function runAutoRetrainCheck(minNewRows = parseInt(process.env.MIN_NEW_ROWS_RETRAIN || `${MIN_NEW_ROWS_DEFAULT}`, 10)) {
  try {
    const optedInHospitals = await prisma.hospitals.findMany({
      where: { auto_learning_enabled: true },
      select: { id: true, hospital_code: true },
    });

    for (const hosp of optedInHospitals) {
      await checkAndRetrainHospital(hosp, minNewRows);
    }
  } catch (err) {
    console.warn(`[AutoRetrain] Check error: ${err.message}`);
  }
}

function startAutoRetrainJob(intervalMs = 3600000) { // default 1 hour
  if (intervalHandle) return;

  // Immediate initial check
  runAutoRetrainCheck().catch((err) => {
    console.warn(`[AutoRetrain] Initial check error: ${err.message}`);
  });

  intervalHandle = setInterval(() => {
    runAutoRetrainCheck().catch((err) => {
      console.warn(`[AutoRetrain] Scheduled check error: ${err.message}`);
    });
  }, intervalMs);

  console.log(`[AutoRetrain] Continuous learning background worker started (interval: ${intervalMs / 1000}s).`);
}

function stopAutoRetrainJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  checkAndRetrainHospital,
  runAutoRetrainCheck,
  startAutoRetrainJob,
  stopAutoRetrainJob,
};
