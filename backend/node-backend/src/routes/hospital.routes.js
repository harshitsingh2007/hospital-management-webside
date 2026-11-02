/**
 * hospital.routes.js
 * ------------------
 * Hospital & SuperAdmin endpoints router.
 * Fully locked down with JWT authentication, RBAC, and multi-tenant hospital isolation.
 */

const express = require("express");
const {
  checkHospitalCodeEndpoint,
  getHospitalInfoEndpoint,
  getPublicHospitalsEndpoint,
  getSuperadminOverviewEndpoint,
  getSuperadminHospitalsEndpoint,
  createHospitalEndpoint,
  getHospitalDetailEndpoint,
  updateHospitalEndpoint,
  getHospitalBrandingEndpoint,
  updateHospitalBrandingEndpoint,
  deleteHospitalEndpoint,
  restoreHospitalEndpoint,
  getHospitalPurgeSummaryEndpoint,
  purgeHospitalEndpoint,
  exportHospitalDataEndpoint,
  getHospitalEmployeesEndpoint,
  addHospitalEmployeeEndpoint,
  updateHospitalEmployeeEndpoint,
  updateEmployeePasswordEndpoint,
  deleteHospitalEmployeeEndpoint,
  getHospitalDepartmentsEndpoint,
  addHospitalDepartmentEndpoint,
  updateHospitalDepartmentEndpoint,
  deleteHospitalDepartmentEndpoint,
  getHospitalDesksEndpoint,
  addHospitalDeskEndpoint,
  updateHospitalDeskEndpoint,
  assignHospitalDeskEndpoint,
  deleteHospitalDeskEndpoint,
  updateDeskStatusEndpoint,
  bulkUpdateDeskStatusEndpoint,
  getDbOverviewEndpoint,
  getHospitalVisitsEndpoint,
  getHospitalLiveSummaryEndpoint,
  bulkAddHospitalEmployeesEndpoint,
  bulkAddHospitalVisitsEndpoint,
} = require("../controllers/hospital.controller");

const { authenticate } = require("../middleware/auth");
const { requireManager, SUPER_ROLES, ADMIN_ROLES } = require("../middleware/role");
const { hospitalIsolation } = require("../middleware/hospitalIsolation");

const router = express.Router();

// Role guards
const requireSuper = requireManager(SUPER_ROLES, { requireJwt: true });
const requireAdmin = requireManager(ADMIN_ROLES, { requireJwt: true });
const requireDeskOperator = requireManager(
  [
    ...ADMIN_ROLES,
    "staff",
    "receptionist",
    "doctor",
    "pharmacist",
    "nurse",
    "technician",
    "cashier",
    "billing",
    "accountant",
    "pathologist",
    "radiologist",
  ],
  { requireJwt: true }
);

// -----------------------------------------------------------------------------
// 1. PUBLIC PATIENT-FACING ENDPOINTS (Non-sensitive hospital info)
// -----------------------------------------------------------------------------
router.get("/hospitals/public", getPublicHospitalsEndpoint);
router.get("/hospital/list", getPublicHospitalsEndpoint);
router.get("/hospital/info/:hospital_code", getHospitalInfoEndpoint);
router.get("/hospital/branding/:hospital_code", getHospitalBrandingEndpoint);
router.get("/hospital/departments/:hospital_code", getHospitalDepartmentsEndpoint);
router.get("/hospitals/:hospital_code/departments", getHospitalDepartmentsEndpoint);

// -----------------------------------------------------------------------------
// 2. SUPER-ADMIN ONLY ENDPOINTS (JWT Required + SUPER_ROLES only)
// -----------------------------------------------------------------------------
router.get("/superadmin/overview", authenticate, requireAdmin, getSuperadminOverviewEndpoint);
router.get("/superadmin/hospitals", authenticate, requireAdmin, getSuperadminHospitalsEndpoint);
router.get("/superadmin/hospitals/check-code", authenticate, requireSuper, checkHospitalCodeEndpoint);
router.post("/superadmin/hospitals", authenticate, requireSuper, createHospitalEndpoint);
router.delete("/superadmin/hospitals/:hospital_code", authenticate, requireSuper, hospitalIsolation("hospital_code"), deleteHospitalEndpoint);
router.post("/superadmin/hospitals/:hospital_code/restore", authenticate, requireSuper, hospitalIsolation("hospital_code"), restoreHospitalEndpoint);
router.get("/superadmin/hospitals/:hospital_code/purge-summary", authenticate, requireSuper, hospitalIsolation("hospital_code"), getHospitalPurgeSummaryEndpoint);
router.post("/superadmin/hospitals/:hospital_code/purge", authenticate, requireSuper, hospitalIsolation("hospital_code"), purgeHospitalEndpoint);
router.get("/superadmin/hospitals/:hospital_code/export-data", authenticate, requireSuper, hospitalIsolation("hospital_code"), exportHospitalDataEndpoint);
router.post("/superadmin/hospitals/:hospital_code/visits/bulk", authenticate, requireSuper, hospitalIsolation("hospital_code"), bulkAddHospitalVisitsEndpoint);

// -----------------------------------------------------------------------------
// 3. HOSPITAL DETAILS & BRANDING (JWT Required + Hospital Access)
// -----------------------------------------------------------------------------
router.get(
  "/superadmin/hospitals/:hospital_code",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  getHospitalDetailEndpoint
);
router.put(
  "/superadmin/hospitals/:hospital_code",
  authenticate,
  requireSuper,
  hospitalIsolation("hospital_code"),
  updateHospitalEndpoint
);
router.get(
  "/superadmin/hospitals/:hospital_code/branding",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  getHospitalBrandingEndpoint
);
router.put(
  "/superadmin/hospitals/:hospital_code/branding",
  authenticate,
  requireSuper,
  hospitalIsolation("hospital_code"),
  updateHospitalBrandingEndpoint
);
router.get(
  "/superadmin/hospitals/:hospital_code/visits",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  getHospitalVisitsEndpoint
);
router.get(
  "/superadmin/hospitals/:hospital_code/live-summary",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  getHospitalLiveSummaryEndpoint
);

// -----------------------------------------------------------------------------
// 4. EMPLOYEE MANAGEMENT (ADMIN_ROLES, scoped to hospital)
// -----------------------------------------------------------------------------
router.get(
  "/superadmin/hospitals/:hospital_code/employees",
  authenticate,
  requireDeskOperator,
  hospitalIsolation("hospital_code"),
  getHospitalEmployeesEndpoint
);
router.post(
  "/superadmin/hospitals/:hospital_code/employees",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  addHospitalEmployeeEndpoint
);
router.post(
  "/superadmin/hospitals/:hospital_code/employees/bulk",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  bulkAddHospitalEmployeesEndpoint
);
router.put(
  "/superadmin/hospitals/:hospital_code/employees/:user_id",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  updateHospitalEmployeeEndpoint
);
router.put(
  "/superadmin/hospitals/:hospital_code/employees/:user_id/password",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  updateEmployeePasswordEndpoint
);
router.post(
  "/superadmin/hospitals/:hospital_code/employees/:user_id/password",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  updateEmployeePasswordEndpoint
);
router.delete(
  "/superadmin/hospitals/:hospital_code/employees/:user_id",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  deleteHospitalEmployeeEndpoint
);

// -----------------------------------------------------------------------------
// 5. DEPARTMENT MANAGEMENT (ADMIN_ROLES, scoped to hospital)
// -----------------------------------------------------------------------------
router.get(
  "/superadmin/hospitals/:hospital_code/departments",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  getHospitalDepartmentsEndpoint
);
router.post(
  "/superadmin/hospitals/:hospital_code/departments",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  addHospitalDepartmentEndpoint
);
router.put(
  "/superadmin/hospitals/:hospital_code/departments/:dept_code",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  updateHospitalDepartmentEndpoint
);
router.delete(
  "/superadmin/hospitals/:hospital_code/departments/:dept_code",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  deleteHospitalDepartmentEndpoint
);

// -----------------------------------------------------------------------------
// 6. DESK & COUNTER MANAGEMENT (ADMIN_ROLES + Desk Operators for status)
// -----------------------------------------------------------------------------
router.get(
  "/superadmin/hospitals/:hospital_code/desks",
  authenticate,
  requireDeskOperator,
  hospitalIsolation("hospital_code"),
  getHospitalDesksEndpoint
);
router.post(
  "/superadmin/hospitals/:hospital_code/desks",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  addHospitalDeskEndpoint
);
router.put(
  "/superadmin/hospitals/:hospital_code/desks/:desk_id",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  updateHospitalDeskEndpoint
);
router.delete(
  "/superadmin/hospitals/:hospital_code/desks/:desk_id",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  deleteHospitalDeskEndpoint
);
router.put(
  "/superadmin/hospitals/:hospital_code/desks/:desk_id/assign",
  authenticate,
  requireAdmin,
  hospitalIsolation("hospital_code"),
  assignHospitalDeskEndpoint
);
// Desk Status and Bulk-Status (Used by staff, receptionist, doctors, cashiers, pharmacists)
router.put(
  "/superadmin/hospitals/:hospital_code/desks/:desk_id/status",
  authenticate,
  requireDeskOperator,
  hospitalIsolation("hospital_code"),
  updateDeskStatusEndpoint
);
router.post(
  "/superadmin/hospitals/:hospital_code/desks/bulk-status",
  authenticate,
  requireDeskOperator,
  hospitalIsolation("hospital_code"),
  bulkUpdateDeskStatusEndpoint
);

// -----------------------------------------------------------------------------
// 7. DATABASE OVERVIEW (SuperAdmin Only)
// -----------------------------------------------------------------------------
router.get("/admin/db-overview", authenticate, requireSuper, getDbOverviewEndpoint);

module.exports = router;
