/**
 * hospitalIsolation.js
 * --------------------
 * Multi-Hospital Tenant Isolation Middleware.
 * Prevents cross-hospital data leakage and enforces strict administrative ownership.
 */

const prisma = require("../config/prisma");

/**
 * Checks if the given authenticated user has access to manage/view the given hospital_code.
 */
async function verifyHospitalAccess(hospitalCode, user) {
  if (!user) return false;
  if (!hospitalCode) return true;

  const hCode = String(hospitalCode).trim();
  const role = (user.role || "").toLowerCase();

  // Root platform superadmin has universal administrative access
  if (user.email === "superadmin@hospital.com" || user.is_superadmin) {
    return true;
  }

  // 1. Super Admin / Hospital Owner: owns the hospital or hospital has no owner assigned
  if (role === "superadmin" || role === "super_admin" || role === "hospital_owner") {
    const hospital = await prisma.hospitals.findFirst({
      where: {
        hospital_code: hCode,
        OR: [
          { owner_user_id: user.id },
          { owner_user_id: null },
        ],
      },
    });
    return !!hospital;
  }

  // 2. Hospital Admin / Doctor / Staff / Pharmacist / Pathologist / Radiologist: employee record attached to this hospital
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

  // 3. Patient/User: can access public info or their own bookings
  return true;
}

function hospitalIsolation(paramName = "hospital_code") {
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
        return next();
      }

      const allowed = await verifyHospitalAccess(hCode, req.user);
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
