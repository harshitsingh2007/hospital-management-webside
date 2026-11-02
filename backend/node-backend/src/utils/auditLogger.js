/**
 * auditLogger.js
 * --------------
 * Reusable helper: writeAudit(req, { action, hospital_id, target, meta })
 * Writes an audit_logs entry asynchronously and NEVER throws.
 */

const prisma = require("../config/prisma");

/**
 * Write an entry to the audit_logs table.
 * @param {Object} req - Express request object (contains req.user and IP info)
 * @param {Object} data
 * @param {string} data.action - Action name (e.g. 'hospital_created', 'employee_added', 'password_reset')
 * @param {number|null} [data.hospital_id] - Integer primary key id of hospital
 * @param {string} [data.target] - Target identifier (e.g. employee id, desk id, hospital code)
 * @param {Object} [data.meta] - Metadata or changed fields (saved in new_values)
 */
async function writeAudit(req, { action, hospital_id = null, target = "", meta = {} } = {}) {
  try {
    const actorId = req?.user?.id ? Number(req.user.id) : null;
    const actorRole = req?.user?.role || "anonymous";
    const ip = req?.ip || req?.connection?.remoteAddress || req?.headers?.["x-forwarded-for"] || "unknown_ip";

    // Resolve hospital_id if not explicitly provided but present on req.user or request
    let resolvedHospitalId = hospital_id ? Number(hospital_id) : null;
    if (!resolvedHospitalId && req?.user?.ownedHospital?.id) {
      resolvedHospitalId = Number(req.user.ownedHospital.id);
    }

    const payload = {
      action: String(action || "unknown_action").slice(0, 100),
      entity_type: String(action ? action.split("_")[0] : "general").slice(0, 100),
      entity_id: String(target || req?.params?.hospital_code || req?.params?.user_id || "").slice(0, 100),
      user_id: actorId,
      hospital_id: resolvedHospitalId,
      old_values: {},
      new_values: {
        actor_id: actorId,
        actor_role: actorRole,
        ip: String(ip).slice(0, 45),
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };

    await prisma.audit_logs.create({
      data: payload,
    });
  } catch (err) {
    // Safe failure: never throw or disrupt the main HTTP request
    console.warn("[writeAudit] Non-fatal audit log failure:", err.message);
  }
}

module.exports = {
  writeAudit,
};

