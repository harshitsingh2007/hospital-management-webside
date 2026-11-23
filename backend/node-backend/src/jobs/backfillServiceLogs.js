/**
 * backfillServiceLogs.js
 * ----------------------
 * One-time backfill job that builds `service_logs` rows from existing completed tickets.
 * Estimates queue length from tickets waiting at that timestamp and tags rows with
 * `data_quality: 'estimated_backfill'`.
 * Strictly zero PII (no names, phone numbers, or free-text notes).
 */

const prisma = require("../config/prisma");
const { getZonedTimeFeatures, parseQueueDate, queueDateToPrismaDate } = require("../utils/timezone");

async function backfillServiceLogs(hospitalId = null) {
  const where = {
    status: { in: ["completed", "transferred"] },
    serve_start_time: { not: null },
    serve_end_time: { not: null },
  };

  if (hospitalId) {
    where.hospital_id = hospitalId;
  }

  const completedTickets = await prisma.tickets.findMany({
    where,
    orderBy: { serve_end_time: "asc" },
  });

  console.log(`[Backfill] Found ${completedTickets.length} eligible completed/transferred tickets to evaluate.`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const t of completedTickets) {
    const startMs = new Date(t.serve_start_time).getTime();
    const endMs = new Date(t.serve_end_time).getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      skippedCount++;
      continue;
    }

    const durationMinutes = Math.round(((endMs - startMs) / 60000.0) * 10) / 10;
    // Skip invalid durations (< 0.5m or > 240m)
    if (durationMinutes < 0.5 || durationMinutes > 240.0) {
      skippedCount++;
      continue;
    }

    // Time features in hospital local timezone
    const timeFeatures = getZonedTimeFeatures(new Date(startMs));

    // Estimate waiting queue length around that timestamp
    let estimatedWaiting = 0;
    try {
      estimatedWaiting = await prisma.tickets.count({
        where: {
          hospital_id: t.hospital_id,
          department_id: t.department_id,
          join_timestamp: { lte: t.serve_start_time },
          OR: [
            { serve_start_time: { gt: t.serve_start_time } },
            { serve_start_time: null, status: "waiting" },
          ],
        },
      });
    } catch (_) {
      estimatedWaiting = 1;
    }

    // Estimate active counters in that department
    let activeCounters = 2;
    try {
      const deskCount = await prisma.desks.count({
        where: {
          hospital_id: t.hospital_id,
          department_id: t.department_id,
          status: { notIn: ["INACTIVE", "PAUSED", "OFFLINE"] },
        },
      });
      if (deskCount > 0) activeCounters = deskCount;
    } catch (_) {}

    const qDateStr = parseQueueDate(t.queue_date);

    try {
      await prisma.service_logs.upsert({
        where: { ticket_id: t.ticket_id },
        update: {}, // don't overwrite if live logging already recorded it
        create: {
          hospital_id: t.hospital_id,
          ticket_id: t.ticket_id,
          department_id: t.department_id,
          consumer_type: t.consumer_type || "hospital",
          service_category: t.service_category || "consultation",
          queue_date: queueDateToPrismaDate(qDateStr),
          hour_of_day: timeFeatures.hourOfDay,
          day_of_week: timeFeatures.dayOfWeek,
          queue_length: Math.max(0, estimatedWaiting),
          active_staff_counters: Math.max(1, activeCounters),
          is_peak_hour: timeFeatures.isPeakHour,
          complexity_score: parseFloat(t.complexity_score) || 1.0,
          historical_avg_speed: 15.0,
          service_duration_minutes: durationMinutes,
          data_quality: "estimated_backfill",
          completed_at: new Date(endMs),
        },
      });
      insertedCount++;
    } catch (e) {
      // Ignored for duplicates or errors
      skippedCount++;
    }
  }

  console.log(`[Backfill Complete] Inserted: ${insertedCount}, Skipped: ${skippedCount}`);
  return {
    totalEvaluated: completedTickets.length,
    insertedCount,
    skippedCount,
  };
}

module.exports = {
  backfillServiceLogs,
};

if (require.main === module) {
  require("../../loadEnv");
  backfillServiceLogs()
    .then((res) => {
      console.log("Backfill result:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
