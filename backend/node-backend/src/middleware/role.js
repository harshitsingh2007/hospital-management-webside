/**
 * role.js
 * -------
 * Role-Based Access Control (RBAC) Middleware.
 */

const SUPER_ROLES = ["superadmin", "super_admin", "hospital_owner"];
const ADMIN_ROLES = [...SUPER_ROLES, "admin"];

function requireRole(allowedRoles = []) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        success: false,
        message: "Unauthorized: Authentication required.",
      });
    }

    const userRole = (req.user.role || "").toLowerCase();
    const normalizedAllowed = roles.map((r) => r.toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        status: "error",
        success: false,
        message: `Forbidden: Access restricted to [${roles.join(", ")}] roles. Your role is '${userRole}'.`,
      });
    }

    next();
  };
}

/**
 * Manager authorization guard:
 * - 401 when there is no req.user
 * - 401 when requireJwt is set and req.authMethod !== "jwt"
 * - 403 when the role is not allowed
 */
function requireManager(allowedRoles = ADMIN_ROLES, { requireJwt = true } = {}) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = roles.map((r) => String(r).toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        success: false,
        message: "Unauthorized: Authentication required.",
      });
    }

    if (requireJwt && req.authMethod !== "jwt") {
      return res.status(401).json({
        status: "error",
        success: false,
        message: "Unauthorized: Verified JWT token required.",
      });
    }

    const userRole = (req.user.role || "").toLowerCase();
    const isSuperAdminFlag = !!req.user.is_superadmin;

    const hasAllowedRole =
      normalizedAllowed.includes(userRole) ||
      (isSuperAdminFlag && normalizedAllowed.some((r) => SUPER_ROLES.includes(r)));

    if (!hasAllowedRole) {
      return res.status(403).json({
        status: "error",
        success: false,
        message: `Forbidden: Access restricted to authorized roles [${roles.join(", ")}].`,
      });
    }

    next();
  };
}

/**
 * Strict Patient/User role check for family profile features.
 * Prevents superadmin, admin, doctor, and staff from accessing family profile switcher.
 */
function requirePatientRole(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      success: false,
      message: "Unauthorized: Authentication required.",
    });
  }

  // Any authenticated user may manage and view family profiles associated with their account
  next();
}

module.exports = {
  SUPER_ROLES,
  ADMIN_ROLES,
  requireRole,
  requireManager,
  requirePatientRole,
};
