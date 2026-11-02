/**
 * hospitalIsolation.js
 * --------------------
 * Multi-Hospital Tenant Isolation Middleware.
 * Prevents cross-hospital data leakage and enforces strict administrative ownership.
 */

const prisma = require("../config/prisma");

/**
 * Checks if the given authenticated user has access to manage/view the given hospital_code.
 * @param {string} hospitalCode - Target hospital code
 * @param {Object} user - The authenticated user (from req.user)
 * @param {Object} [options]
 * @param {boolean} [options.allowPublic=false] - When true, permits anonymous/patient read access
 */
async function verifyHospitalAccess(hospitalCode, user, options = { allowPublic: false }) {
  if (options && options.allowPublic) {
    return true;
  }

  if (!user) return false;
  if (!hospitalCode) return false;

  const hCode = String(hospitalCode).trim();
  const role = (user.role || "").toLowerCase();

  // Platform root superadmin has universal administrative access
  if (user.is_superadmin || role === "super_admin") {
    return true;
  }

  // 1. Hospital Owner / Facility Superadmin: must own this specific hospital or have it assigned as primary
  if (role === "hospital_owner" || role === "superadmin") {
    if (user.primary_hospital_code && user.primary_hospital_code === hCode) {
      return true;
    }
    const hospital = await prisma.hospitals.findFirst({
      where: {
        hospital_code: hCode,
        owner_user_id: user.id,
      },
    });
    if (hospital) return true;
  }

  // 2. Hospital Admin / Doctor / Staff / Clinical roles: must have an active employee record attached to this specific hospital
  const staffRoles = [
    "admin",
    "doctor",
    "staff",
    "receptionist",
    "pharmacist",
    "nurse",
    "technician",
    "pathologist",
    "radiologist",
    "radiology",
    "radiographer",
    "xray",
    "imaging",
    "radiology_technician",
    "cashier",
    "billing",
    "accountant",
    "billing_clerk",
    "cash_counter",
  ];
  if (staffRoles.includes(role)) {
    const emp = await prisma.employees.findFirst({
      where: {
        user_id: user.id,
        hospitals: {
          hospital_code: hCode,
        },
      },
    });
    return !!emp;
  }

  // 3. Management paths NEVER permit "user" (patient) role
  return false;
}

/**
 * Express middleware enforcing hospital isolation on route parameters.
 * Automatically checks req.user and verifies tenant boundary.
 */
function hospitalIsolation(paramName = "hospital_code", options = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          success: false,
          message: "Unauthorized: Authentication required.",
        });
      }

      const hCode =
        req.params[paramName] ||
        req.body?.hospital_code ||
        req.body?.tenant_id ||
        req.query?.hospital_code ||
        req.query?.tenant_id ||
        req.headers["x-hospital-code"] ||
        req.headers["x-tenant-id"];

      if (!hCode) {
        return res.status(400).json({
          status: "error",
          message: "Hospital code parameter required.",
        });
      }

      const allowed = await verifyHospitalAccess(hCode, req.user, options);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          success: false,
          message: "Forbidden: You do not have permission to access resources for this hospital.",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  verifyHospitalAccess,
  hospitalIsolation,
};
