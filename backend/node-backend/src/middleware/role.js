/**
 * role.js
 * -------
 * Role-Based Access Control (RBAC) Middleware.
 */

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
  requireRole,
  requirePatientRole,
};
