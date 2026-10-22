/**
 * broadcastService.js
 * -------------------
 * In-memory & Persistent Real-Time Emergency Broadcast & Hospital Announcement Service.
 * Supports Network-Wide and Hospital-Specific Live Push via Socket.IO.
 */

const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");

const DATA_DIR = path.join(__dirname, "../../data");
const STORAGE_FILE = path.join(DATA_DIR, "broadcasts.json");

let activeBroadcasts = [];
let broadcastHistory = [];

// Initialize storage and load previous records if any
function loadPersistedBroadcasts() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.active)) {
        const now = new Date();
        // Filter out expired items
        activeBroadcasts = parsed.active.filter((b) => {
          if (!b.is_active) return false;
          if (b.expires_at && new Date(b.expires_at) < now) return false;
          return true;
        });
      }
      if (Array.isArray(parsed.history)) {
        broadcastHistory = parsed.history.slice(0, 100);
      }
    }
  } catch (err) {
    console.warn("[broadcastService] Could not load persisted broadcasts:", err.message);
  }
}

function persistBroadcasts() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      STORAGE_FILE,
      JSON.stringify(
        {
          active: activeBroadcasts,
          history: broadcastHistory.slice(0, 100),
          last_saved: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.warn("[broadcastService] Could not persist broadcasts:", err.message);
  }
}

// Initial load on startup
loadPersistedBroadcasts();

/**
 * Clean up expired broadcasts
 */
function purgeExpired(io) {
  const now = new Date();
  const stillActive = [];
  let changed = false;

  for (const b of activeBroadcasts) {
    if (b.expires_at && new Date(b.expires_at) < now) {
      b.is_active = false;
      b.expired_naturally = true;
      changed = true;
      if (io) {
        try {
          io.emit("dismiss_broadcast", { id: b.id });
        } catch (e) {}
      }
    } else {
      stillActive.push(b);
    }
  }

  if (changed) {
    activeBroadcasts = stillActive;
    persistBroadcasts();
  }
}

// Periodic check every 30 seconds
setInterval(() => {
  purgeExpired(null);
}, 30000);

/**
 * Get active broadcasts, optionally filtered by hospital
 */
function getActiveBroadcasts(hospitalCode = null) {
  purgeExpired(null);
  const code = (hospitalCode || "").trim().toLowerCase();

  return activeBroadcasts.filter((b) => {
    if (!b.is_active) return false;
    if (!code || code === "all") return true;
    const target = (b.hospital_code || "all").trim().toLowerCase();
    return target === "all" || target === code;
  });
}

/**
 * Get all broadcasts (active + history) for SuperAdmin audit
 */
function getAllBroadcasts() {
  purgeExpired(null);
  const map = new Map();
  // History first
  broadcastHistory.forEach((b) => map.set(b.id, b));
  // Active overrides
  activeBroadcasts.forEach((b) => map.set(b.id, b));

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

/**
 * Create and publish a live broadcast
 */
async function createBroadcast(data, io, user = null) {
  purgeExpired(io);

  const type = data.type || "general"; // "code_blue" | "maintenance" | "general"
  let severity = data.severity;
  if (!severity) {
    if (type === "code_blue") severity = "critical";
    else if (type === "maintenance") severity = "warning";
    else severity = "info";
  }

  const durationMinutes = Number(data.duration_minutes) || 0; // 0 = manual dismissal only
  const now = new Date();
  const expiresAt = durationMinutes > 0 ? new Date(now.getTime() + durationMinutes * 60000).toISOString() : null;

  const broadcastId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = (data.title || "").trim() || (type === "code_blue" ? "CODE BLUE EMERGENCY" : "HOSPITAL ANNOUNCEMENT");
  const message = (data.message || "").trim();

  const hospitalCode = (data.hospital_code || "all").trim();
  const hospitalName = data.hospital_name || (hospitalCode === "all" ? "Network-Wide (All Hospitals)" : hospitalCode);

  const broadcast = {
    id: broadcastId,
    hospital_code: hospitalCode,
    hospital_name: hospitalName,
    type,
    severity,
    title,
    message,
    ticker_text: `${title}: ${message}`,
    sound: Boolean(data.sound !== false && (type === "code_blue" || data.sound)),
    duration_minutes: durationMinutes,
    created_at: now.toISOString(),
    expires_at: expiresAt,
    created_by: user ? `${user.username || user.name || "Super Admin"} (${user.email || "superadmin"})` : "Super Admin",
    created_by_user_id: user?.id || null,
    target_surfaces: {
      patient_portal: data.target_surfaces?.patient_portal !== false,
      doctor_desk: data.target_surfaces?.doctor_desk !== false,
      staff_desk: data.target_surfaces?.staff_desk !== false,
      kiosk_display: data.target_surfaces?.kiosk_display !== false,
    },
    is_active: true,
  };

  activeBroadcasts.unshift(broadcast);
  broadcastHistory.unshift(broadcast);
  persistBroadcasts();

  // Socket.IO real-time alert push
  if (io) {
    try {
      // 1. Emit to entire server network
      io.emit("emergency_broadcast", broadcast);

      // 2. If specific hospital, also emit into hospital room
      if (hospitalCode && hospitalCode !== "all") {
        io.to(hospitalCode).emit("emergency_broadcast", broadcast);
      }

      // 3. Generic event notification
      io.emit("hospital_data_changed", {
        type: "broadcast_created",
        hospital_code: hospitalCode,
        broadcast_id: broadcastId,
      });
    } catch (sockErr) {
      console.warn("[broadcastService] Socket emit warning:", sockErr.message);
    }
  }

  // Attempt database audit log insertion non-blockingly
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
        action: "BROADCAST_CREATED",
        entity_type: "broadcast",
        entity_id: broadcastId,
        new_values: {
          title,
          type,
          severity,
          hospital_code: hospitalCode,
          duration_minutes: durationMinutes,
        },
      },
    });
  } catch (auditErr) {
    // Non-critical
  }

  return broadcast;
}

/**
 * Dismiss an active broadcast
 */
async function dismissBroadcast(id, io, user = null) {
  purgeExpired(io);
  const idx = activeBroadcasts.findIndex((b) => b.id === id);
  let dismissedItem = null;

  if (idx !== -1) {
    dismissedItem = activeBroadcasts[idx];
    dismissedItem.is_active = false;
    dismissedItem.dismissed_at = new Date().toISOString();
    dismissedItem.dismissed_by = user?.email || "Super Admin";
    activeBroadcasts.splice(idx, 1);
  }

  // Update history record as well
  const histItem = broadcastHistory.find((b) => b.id === id);
  if (histItem) {
    histItem.is_active = false;
    histItem.dismissed_at = new Date().toISOString();
    histItem.dismissed_by = user?.email || "Super Admin";
  }

  persistBroadcasts();

  // Socket.IO real-time dismissal push
  if (io) {
    try {
      io.emit("dismiss_broadcast", { id });
      io.emit("hospital_data_changed", {
        type: "broadcast_dismissed",
        broadcast_id: id,
      });
    } catch (sockErr) {
      console.warn("[broadcastService] Socket emit warning on dismiss:", sockErr.message);
    }
  }

  // Audit log
  try {
    await prisma.audit_logs.create({
      data: {
        hospital_id: null,
        user_id: user?.id || null,
        action: "BROADCAST_DISMISSED",
        entity_type: "broadcast",
        entity_id: id,
        new_values: {
          dismissed_at: new Date().toISOString(),
        },
      },
    });
  } catch (e) {}

  return { success: true, id, dismissedItem };
}

module.exports = {
  getActiveBroadcasts,
  getAllBroadcasts,
  createBroadcast,
  dismissBroadcast,
};
