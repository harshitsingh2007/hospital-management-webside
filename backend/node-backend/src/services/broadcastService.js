/**
 * broadcastService.js
 * -------------------
 * Real-Time Emergency Broadcast & Hospital Network Announcement Engine.
 * Backed by PostgreSQL table `broadcasts` with in-memory caching for sub-millisecond Socket.IO push.
 */

const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");

const DATA_DIR = path.join(__dirname, "../../data");
const STORAGE_FILE = path.join(DATA_DIR, "broadcasts.json");

// In-memory active cache for fast broadcast checks and socket sync
let activeBroadcasts = [];
let scheduledBroadcasts = [];

// Rate limiter for critical broadcasts: max 1 per 30 seconds per user
const CRITICAL_RATE_LIMIT_MS = 30000;
const lastCriticalDispatchByUser = new Map();

/**
 * Normalizes a database row to the broadcast object expected by frontend & sockets.
 */
function normalizeBroadcastRow(row, hospitalMap = new Map()) {
  if (!row) return null;

  let targetSurfaces = {
    patient_portal: true,
    doctor_desk: true,
    staff_desk: true,
    kiosk_display: true,
  };

  if (row.target_surfaces) {
    if (typeof row.target_surfaces === "object") {
      targetSurfaces = { ...targetSurfaces, ...row.target_surfaces };
    } else if (typeof row.target_surfaces === "string") {
      try {
        targetSurfaces = { ...targetSurfaces, ...JSON.parse(row.target_surfaces) };
      } catch (_) {}
    }
  }

  const hCode = row.hospital_code || "all";
  const hospName =
    hCode === "all"
      ? "All Hospitals (Network-Wide)"
      : hospitalMap.get(hCode) || row.hospital_name || hCode;

  const now = new Date();
  const expiresAtDate = row.expires_at ? new Date(row.expires_at) : null;
  const isExpired = row.status === "expired" || (row.status === "active" && expiresAtDate && expiresAtDate <= now);
  const status = isExpired ? "expired" : row.status;

  return {
    id: row.id,
    hospital_code: hCode,
    hospital_name: hospName,
    type: row.type || "notice",
    severity: row.severity || (row.type === "code_blue" || row.type === "code_red" ? "critical" : "info"),
    title: row.title || "",
    message: row.message || "",
    ticker_text: `${row.title || ""}: ${row.message || ""}`,
    sound: Boolean(row.sound),
    duration_minutes: Number(row.duration_minutes) || 0,
    scheduled_at: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
    starts_at: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    status,
    is_active: status === "active",
    created_by: row.created_by_name || "Super Admin",
    created_by_user_id: row.created_by_user_id || null,
    dismissed_by: row.dismissed_by || null,
    dismissed_at: row.dismissed_at ? new Date(row.dismissed_at).toISOString() : null,
    delivered_count: Number(row.delivered_count) || 0,
    target_surfaces: targetSurfaces,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Builds a fast lookup map for hospital codes -> names.
 */
async function getHospitalMap() {
  const map = new Map();
  try {
    const list = await prisma.hospitals.findMany({
      select: { hospital_code: true, name: true },
    });
    list.forEach((h) => map.set(h.hospital_code, h.name));
  } catch (_) {}
  return map;
}

/**
 * One-time startup migration: imports legacy JSON history into PostgreSQL table.
 */
async function migrateLegacyJsonToDb() {
  try {
    const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM broadcasts`);
    const count = countRes?.[0]?.cnt || 0;

    if (count === 0 && fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const items = [...(parsed.active || []), ...(parsed.history || [])];

      const seen = new Set();
      const uniqueItems = items.filter((item) => {
        if (!item || !item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      for (const item of uniqueItems) {
        const hCode = item.hospital_code || "all";
        const type = item.type || "notice";
        const severity = item.severity || (type === "code_blue" || type === "code_red" ? "critical" : "info");
        const status = item.is_active ? "active" : (item.dismissed_at ? "dismissed" : "expired");
        const targetSurfacesJson = JSON.stringify(item.target_surfaces || {});

        await prisma.$executeRawUnsafe(
          `INSERT INTO broadcasts (
            id, hospital_code, type, severity, title, message, sound,
            target_surfaces, duration_minutes, starts_at, expires_at, status,
            created_by_name, dismissed_by, dismissed_at, delivered_count, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8::jsonb, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18
          ) ON CONFLICT (id) DO NOTHING`,
          item.id,
          hCode,
          type,
          severity,
          item.title || "ANNOUNCEMENT",
          item.message || "",
          Boolean(item.sound),
          targetSurfacesJson,
          Number(item.duration_minutes) || 30,
          item.created_at ? new Date(item.created_at) : new Date(),
          item.expires_at ? new Date(item.expires_at) : null,
          status,
          item.created_by || "Super Admin",
          item.dismissed_by || null,
          item.dismissed_at ? new Date(item.dismissed_at) : null,
          Number(item.delivered_count) || 0,
          item.created_at ? new Date(item.created_at) : new Date(),
          new Date()
        );
      }
      console.log(`[broadcastService] Successfully migrated ${uniqueItems.length} broadcasts from JSON to database.`);
    }
  } catch (err) {
    console.warn("[broadcastService] Startup migration check warning:", err.message);
  }
}

/**
 * Hydrates in-memory active cache from PostgreSQL.
 */
async function hydrateActiveBroadcasts() {
  try {
    const hospMap = await getHospitalMap();

    // 1. Fetch active broadcasts
    const activeRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM broadcasts
       WHERE status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`
    );
    activeBroadcasts = activeRows.map((r) => normalizeBroadcastRow(r, hospMap));

    // 2. Fetch scheduled broadcasts
    const scheduledRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM broadcasts
       WHERE status = 'scheduled'
       ORDER BY scheduled_at ASC`
    );
    scheduledBroadcasts = scheduledRows.map((r) => normalizeBroadcastRow(r, hospMap));
  } catch (err) {
    console.warn("[broadcastService] Hydrate active broadcasts warning:", err.message);
  }
}

// Perform initial migration and hydration
(async () => {
  await migrateLegacyJsonToDb();
  await hydrateActiveBroadcasts();
})();

/**
 * Counts currently connected sockets in target room(s).
 */
function getDeliveredCount(hospitalCode, io) {
  if (!io) return 0;
  try {
    if (!hospitalCode || hospitalCode === "all") {
      return io.sockets?.sockets?.size || (io.engine ? io.engine.clientsCount : 0) || 0;
    }
    const room = io.sockets?.adapter?.rooms?.get(hospitalCode);
    return room ? room.size : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Periodic timer: cleans up expired broadcasts and activates scheduled broadcasts.
 */
async function purgeExpiredAndTriggerScheduled(io) {
  const now = new Date();
  const stillActive = [];
  const expiredIds = [];

  for (const b of activeBroadcasts) {
    if (b.expires_at && new Date(b.expires_at) <= now) {
      expiredIds.push(b.id);
    } else {
      stillActive.push(b);
    }
  }

  if (expiredIds.length > 0) {
    activeBroadcasts = stillActive;
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE broadcasts SET status = 'expired', updated_at = NOW() WHERE id = ANY($1::varchar[])`,
        expiredIds
      );
    } catch (e) {
      console.warn("[broadcastService] Error updating expired status in DB:", e.message);
    }

    if (io) {
      for (const id of expiredIds) {
        try {
          io.emit("dismiss_broadcast", { id });
        } catch (_) {}
      }
    }
  }

  // Check scheduled broadcasts ready to trigger
  const remainingScheduled = [];
  for (const s of scheduledBroadcasts) {
    if (s.scheduled_at && new Date(s.scheduled_at) <= now) {
      // Trigger scheduled alert
      try {
        const durationMinutes = Number(s.duration_minutes) || 0;
        const startsAt = now;
        const expiresAt = durationMinutes > 0 ? new Date(now.getTime() + durationMinutes * 60000) : null;
        const deliveredCount = getDeliveredCount(s.hospital_code, io);

        await prisma.$executeRawUnsafe(
          `UPDATE broadcasts
           SET status = 'active',
               starts_at = $1,
               expires_at = $2,
               delivered_count = $3,
               updated_at = NOW()
           WHERE id = $4`,
          startsAt,
          expiresAt,
          deliveredCount,
          s.id
        );

        const activated = {
          ...s,
          status: "active",
          is_active: true,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          delivered_count: deliveredCount,
        };

        activeBroadcasts.unshift(activated);

        if (io) {
          if (s.hospital_code === "all") {
            io.emit("emergency_broadcast", activated);
          } else {
            io.to(s.hospital_code).emit("emergency_broadcast", activated);
          }
          io.emit("hospital_data_changed", {
            type: "broadcast_created",
            hospital_code: s.hospital_code,
            broadcast_id: s.id,
          });
        }

        // Audit log
        await prisma.audit_logs.create({
          data: {
            hospital_id: null,
            user_id: s.created_by_user_id || null,
            action: "SCHEDULED_BROADCAST_TRIGGERED",
            entity_type: "broadcast",
            entity_id: s.id,
            new_values: {
              title: s.title,
              type: s.type,
              hospital_code: s.hospital_code,
            },
          },
        }).catch(() => null);
      } catch (err) {
        console.warn("[broadcastService] Error triggering scheduled broadcast:", err.message);
      }
    } else {
      remainingScheduled.push(s);
    }
  }
  scheduledBroadcasts = remainingScheduled;
}

// Run periodic expiration & scheduler check every 10 seconds
setInterval(() => {
  purgeExpiredAndTriggerScheduled(null);
}, 10000);

/**
 * Get active broadcasts for public screens & terminals, filtered by hospital.
 */
function getActiveBroadcasts(hospitalCode = null) {
  const now = new Date();
  const code = (hospitalCode || "").trim().toLowerCase();

  return activeBroadcasts.filter((b) => {
    if (!b.is_active) return false;
    if (b.expires_at && new Date(b.expires_at) <= now) return false;
    if (!code || code === "all") return true;
    const target = (b.hospital_code || "all").trim().toLowerCase();
    return target === "all" || target === code;
  });
}

/**
 * SuperAdmin paginated history API with multi-column filtering.
 */
async function getBroadcastHistory({
  page = 1,
  page_size = 10,
  q = "",
  type = "all",
  status = "all",
  hospital_code = "all",
  from = null,
  to = null,
}) {
  const hospMap = await getHospitalMap();
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(page_size, 10) || 10));
  const offset = (currentPage - 1) * pageSize;

  const whereConditions = [];
  const params = [];
  let paramIdx = 1;

  // Search filter
  if (q && q.trim().length > 0) {
    params.push(`%${q.trim()}%`);
    whereConditions.push(`(title ILIKE $${paramIdx} OR message ILIKE $${paramIdx} OR created_by_name ILIKE $${paramIdx})`);
    paramIdx++;
  }

  // Type filter
  if (type && type !== "all") {
    params.push(type.trim().toLowerCase());
    whereConditions.push(`LOWER(type) = $${paramIdx}`);
    paramIdx++;
  }

  // Status filter
  if (status && status !== "all") {
    params.push(status.trim().toLowerCase());
    whereConditions.push(`LOWER(status) = $${paramIdx}`);
    paramIdx++;
  }

  // Hospital code filter
  if (hospital_code && hospital_code !== "all") {
    params.push(hospital_code.trim().toLowerCase());
    whereConditions.push(`LOWER(hospital_code) = $${paramIdx}`);
    paramIdx++;
  }

  // Date range filters
  if (from) {
    params.push(new Date(from));
    whereConditions.push(`created_at >= $${paramIdx}`);
    paramIdx++;
  }
  if (to) {
    params.push(new Date(to));
    whereConditions.push(`created_at <= $${paramIdx}`);
    paramIdx++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // 1. Total count
  const countSql = `SELECT COUNT(*)::int AS total FROM broadcasts ${whereClause}`;
  const countRes = await prisma.$queryRawUnsafe(countSql, ...params);
  const total = countRes?.[0]?.total || 0;

  // 2. Paginated rows
  const queryParams = [...params, pageSize, offset];
  const rowsSql = `
    SELECT * FROM broadcasts
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;
  const rows = await prisma.$queryRawUnsafe(rowsSql, ...queryParams);
  const broadcasts = rows.map((r) => normalizeBroadcastRow(r, hospMap));

  return {
    broadcasts,
    total,
    page: currentPage,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Get real-time stats for the SuperAdmin Broadcast Header.
 */
async function getBroadcastStats(io) {
  const connectedScreens = io ? (io.sockets?.sockets?.size || (io.engine ? io.engine.clientsCount : 0) || 0) : 0;
  const activeAlerts = activeBroadcasts.length;
  const scheduledAlerts = scheduledBroadcasts.length;

  let totalHospitals = 0;
  try {
    const hRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM hospitals WHERE status = 'active'`);
    totalHospitals = hRes?.[0]?.cnt || 0;
  } catch (_) {}

  return {
    connected_screens: connectedScreens,
    active_alerts: activeAlerts,
    scheduled_alerts: scheduledAlerts,
    total_hospitals: totalHospitals,
  };
}

/**
 * Creates and publishes a live broadcast, or saves a scheduled broadcast.
 */
async function createBroadcast(data, io, user = null) {
  await purgeExpiredAndTriggerScheduled(io);

  const rawType = String(data.type || "notice").toLowerCase();
  const validTypes = ["code_blue", "code_red", "notice", "maintenance", "announcement", "general"];
  const type = validTypes.includes(rawType) ? rawType : "notice";

  let severity = data.severity;
  if (!severity) {
    if (type === "code_blue" || type === "code_red") severity = "critical";
    else if (type === "maintenance" || type === "notice") severity = "warning";
    else severity = "info";
  }

  // Rate Limiting: 1 critical alert per 30 seconds per user
  if (severity === "critical") {
    const userKey = user?.id || user?.email || "superadmin";
    const lastDispatch = lastCriticalDispatchByUser.get(userKey);
    if (lastDispatch && Date.now() - lastDispatch < CRITICAL_RATE_LIMIT_MS) {
      const waitSec = Math.ceil((CRITICAL_RATE_LIMIT_MS - (Date.now() - lastDispatch)) / 1000);
      const err = new Error(
        `Rate limit exceeded: A critical emergency broadcast was dispatched recently. Please wait ${waitSec}s before sending another critical alert to avoid duplicate dispatches.`
      );
      err.status = 429;
      err.code = "CRITICAL_RATE_LIMIT";
      err.wait_seconds = waitSec;
      throw err;
    }
    lastCriticalDispatchByUser.set(userKey, Date.now());
  }

  const durationMinutes = Math.max(0, Math.min(1440, Number(data.duration_minutes) || 0)); // 0 = manual dismissal
  const now = new Date();

  // Scheduled check
  const isScheduled = data.scheduled_at && new Date(data.scheduled_at) > now;
  const scheduledAt = isScheduled ? new Date(data.scheduled_at) : null;
  const startsAt = isScheduled ? scheduledAt : now;
  const expiresAt = durationMinutes > 0 && !isScheduled ? new Date(now.getTime() + durationMinutes * 60000) : null;

  const broadcastId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = (data.title || "").trim();
  const message = (data.message || "").trim();

  if (!title) {
    const err = new Error("Headline is required.");
    err.status = 400;
    throw err;
  }

  const hospitalCode = (data.hospital_code || "all").trim();
  const hospMap = await getHospitalMap();
  const hospitalName =
    hospitalCode === "all"
      ? "All Hospitals (Network-Wide)"
      : hospMap.get(hospitalCode) || data.hospital_name || hospitalCode;

  const targetSurfaces = {
    patient_portal: data.target_surfaces?.patient_portal !== false,
    doctor_desk: data.target_surfaces?.doctor_desk !== false,
    staff_desk: data.target_surfaces?.staff_desk !== false,
    kiosk_display: data.target_surfaces?.kiosk_display !== false,
  };

  const status = isScheduled ? "scheduled" : "active";
  const deliveredCount = isScheduled ? 0 : getDeliveredCount(hospitalCode, io);
  const createdByName = user ? `${user.username || user.name || "Super Admin"} (${user.email || ""})`.trim() : "Super Admin";

  // Persist to PostgreSQL table
  await prisma.$executeRawUnsafe(
    `INSERT INTO broadcasts (
      id, hospital_code, type, severity, title, message, sound,
      target_surfaces, duration_minutes, scheduled_at, starts_at, expires_at, status,
      created_by_user_id, created_by_name, delivered_count, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8::jsonb, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18
    )`,
    broadcastId,
    hospitalCode,
    type,
    severity,
    title,
    message,
    Boolean(data.sound !== false),
    JSON.stringify(targetSurfaces),
    durationMinutes,
    scheduledAt,
    startsAt,
    expiresAt,
    status,
    user?.id || null,
    createdByName,
    deliveredCount,
    now,
    now
  );

  const broadcast = {
    id: broadcastId,
    hospital_code: hospitalCode,
    hospital_name: hospitalName,
    type,
    severity,
    title,
    message,
    ticker_text: `${title}: ${message}`,
    sound: Boolean(data.sound !== false),
    duration_minutes: durationMinutes,
    scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
    starts_at: startsAt.toISOString(),
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    status,
    is_active: status === "active",
    created_by: createdByName,
    created_by_user_id: user?.id || null,
    target_surfaces: targetSurfaces,
    delivered_count: deliveredCount,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  if (isScheduled) {
    scheduledBroadcasts.push(broadcast);
  } else {
    activeBroadcasts.unshift(broadcast);

    // Real-time socket alert push
    if (io) {
      try {
        if (hospitalCode === "all") {
          io.emit("emergency_broadcast", broadcast);
        } else {
          io.to(hospitalCode).emit("emergency_broadcast", broadcast);
        }
        io.emit("hospital_data_changed", {
          type: "broadcast_created",
          hospital_code: hospitalCode,
          broadcast_id: broadcastId,
        });
      } catch (sockErr) {
        console.warn("[broadcastService] Socket emit warning:", sockErr.message);
      }
    }
  }

  // Audit log entry
  try {
    let hid = null;
    if (hospitalCode && hospitalCode !== "all") {
      const hosp = await prisma.hospitals.findUnique({
        where: { hospital_code: hospitalCode },
        select: { id: true },
      });
      if (hosp) hid = hosp.id;
    }
    await prisma.audit_logs.create({
      data: {
        hospital_id: hid,
        user_id: user?.id || null,
        action: isScheduled ? "BROADCAST_SCHEDULED" : "BROADCAST_CREATED",
        entity_type: "broadcast",
        entity_id: broadcastId,
        new_values: {
          title,
          type,
          severity,
          hospital_code: hospitalCode,
          duration_minutes: durationMinutes,
          scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
          delivered_count: deliveredCount,
        },
      },
    });
  } catch (_) {}

  return broadcast;
}

/**
 * Extends the duration of an active broadcast by N minutes (max 240).
 */
async function extendBroadcast(id, minutesToAdd = 15, io, user = null) {
  await purgeExpiredAndTriggerScheduled(io);

  const minutes = Math.max(1, Math.min(240, parseInt(minutesToAdd, 10) || 15));
  const now = new Date();

  // Find in-memory or DB
  const idx = activeBroadcasts.findIndex((b) => b.id === id);
  let broadcast = idx !== -1 ? activeBroadcasts[idx] : null;

  if (!broadcast) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM broadcasts WHERE id = $1 LIMIT 1`, id);
    if (!rows || rows.length === 0) {
      const err = new Error("Broadcast not found.");
      err.status = 404;
      throw err;
    }
    const hospMap = await getHospitalMap();
    broadcast = normalizeBroadcastRow(rows[0], hospMap);
  }

  if (broadcast.status !== "active") {
    const err = new Error("Only active broadcasts can be extended.");
    err.status = 400;
    throw err;
  }

  const currentExpires = broadcast.expires_at ? new Date(broadcast.expires_at) : now;
  const baseTime = currentExpires > now ? currentExpires.getTime() : now.getTime();
  const newExpiresAt = new Date(baseTime + minutes * 60000);
  const newDuration = (Number(broadcast.duration_minutes) || 0) + minutes;

  await prisma.$executeRawUnsafe(
    `UPDATE broadcasts
     SET expires_at = $1,
         duration_minutes = $2,
         updated_at = NOW()
     WHERE id = $3`,
    newExpiresAt,
    newDuration,
    id
  );

  broadcast.expires_at = newExpiresAt.toISOString();
  broadcast.duration_minutes = newDuration;
  broadcast.updated_at = now.toISOString();

  if (idx !== -1) {
    activeBroadcasts[idx] = broadcast;
  } else {
    activeBroadcasts.unshift(broadcast);
  }

  // Socket notification
  if (io) {
    try {
      io.emit("broadcast_updated", broadcast);
      io.emit("hospital_data_changed", {
        type: "broadcast_extended",
        broadcast_id: id,
        minutes_added: minutes,
      });
    } catch (_) {}
  }

  // Audit log
  try {
    await prisma.audit_logs.create({
      data: {
        hospital_id: null,
        user_id: user?.id || null,
        action: "BROADCAST_EXTENDED",
        entity_type: "broadcast",
        entity_id: id,
        new_values: {
          minutes_added: minutes,
          new_expires_at: newExpiresAt.toISOString(),
          extended_by: user?.email || user?.username || "Super Admin",
        },
      },
    });
  } catch (_) {}

  return broadcast;
}

/**
 * Dismisses an active or scheduled broadcast immediately.
 */
async function dismissBroadcast(id, io, user = null) {
  await purgeExpiredAndTriggerScheduled(io);

  const now = new Date();
  const dismissedBy = user ? (user.email || user.username || "Super Admin") : "Super Admin";

  // Remove from in-memory active list
  const idx = activeBroadcasts.findIndex((b) => b.id === id);
  let dismissedItem = null;
  if (idx !== -1) {
    dismissedItem = activeBroadcasts[idx];
    dismissedItem.status = "dismissed";
    dismissedItem.is_active = false;
    dismissedItem.dismissed_at = now.toISOString();
    dismissedItem.dismissed_by = dismissedBy;
    activeBroadcasts.splice(idx, 1);
  }

  // Remove from scheduled list if present
  scheduledBroadcasts = scheduledBroadcasts.filter((s) => s.id !== id);

  // Update DB row
  await prisma.$executeRawUnsafe(
    `UPDATE broadcasts
     SET status = 'dismissed',
         dismissed_at = $1,
         dismissed_by = $2,
         updated_at = NOW()
     WHERE id = $3`,
    now,
    dismissedBy,
    id
  );

  // Socket broadcast dismissal event
  if (io) {
    try {
      io.emit("dismiss_broadcast", { id });
      io.emit("hospital_data_changed", {
        type: "broadcast_dismissed",
        broadcast_id: id,
      });
    } catch (_) {}
  }

  // Audit log entry
  try {
    await prisma.audit_logs.create({
      data: {
        hospital_id: null,
        user_id: user?.id || null,
        action: "BROADCAST_DISMISSED",
        entity_type: "broadcast",
        entity_id: id,
        new_values: {
          dismissed_at: now.toISOString(),
          dismissed_by: dismissedBy,
        },
      },
    });
  } catch (_) {}

  return { success: true, id, dismissedItem };
}

module.exports = {
  getActiveBroadcasts,
  getBroadcastHistory,
  getBroadcastStats,
  createBroadcast,
  extendBroadcast,
  dismissBroadcast,
};
