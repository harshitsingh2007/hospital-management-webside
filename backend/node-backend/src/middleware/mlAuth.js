/**
 * mlAuth.js
 * ---------
 * Authentication and Authorization guard for Machine Learning / Continuous Learning endpoints.
 *
 * Enforces:
 * - Platform Super Admin only for 'global' tenant operations.
 * - Platform Super Admin OR Hospital Owner for their own hospital's tenant operations.
 * - Multi-tenant isolation: hospital owners cannot access or train other hospitals' models.
 */

const prisma = require("../config/prisma");

function resolveTenantId(req) {
  return (
    req.params.tenant_id ||
    req.params.hospitalCode ||
    req.params.hospital_code ||
    req.body.tenant_id ||
    req.body.hospital_code ||
    req.query.tenant_id ||
    req.query.hospital_code ||
    "global"
  ).trim();
}

async function requireMLAdminAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      success: false,
      message: "Unauthorized: Authentication required.",
    });
  }

  const user = req.user;
  const role = (user.role || "").toLowerCase();
  const isPlatformSuperAdmin = !!user.is_superadmin || role === "super_admin";
  const tenantId = resolveTenantId(req);

  // 1. Global model operations: STRICTLY platform superadmin only
  if (tenantId === "global") {
    if (!isPlatformSuperAdmin) {
      return res.status(403).json({
        status: "error",
        success: false,
        message: "Forbidden: Only platform Super Administrators can train or manage the global model.",
      });
    }
    return next();
  }

  // 2. Hospital tenant operations: Platform Super Admin is always permitted
  if (isPlatformSuperAdmin) {
    return next();
  }

  // 3. Hospital Owner / Facility Superadmin: must have ownership of the specified hospital
  if (role === "hospital_owner" || role === "superadmin") {
    // Check primary_hospital_code
    if (user.primary_hospital_code && user.primary_hospital_code === tenantId) {
      return next();
    }

    // Check ownership in hospitals table
    const hospital = await prisma.hospitals.findFirst({
      where: {
        hospital_code: tenantId,
        owner_user_id: user.id,
      },
      select: { id: true, hospital_code: true },
    });

    if (hospital) {
      return next();
    }
  }

  return res.status(403).json({
    status: "error",
    success: false,
    message: `Forbidden: You do not have permission to manage AI models for hospital '${tenantId}'.`,
  });
}

module.exports = {
  requireMLAdminAccess,
  resolveTenantId,
};
