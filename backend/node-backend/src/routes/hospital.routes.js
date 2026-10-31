/**
 * hospital.routes.js
 * ------------------
 * Hospital & SuperAdmin endpoints router.
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
const { optionalAuth, authenticate } = require("../middleware/auth");

const router = express.Router();

// Public / Hospital info & Branding
router.get("/hospitals/public", getPublicHospitalsEndpoint);
router.get("/hospital/list", getPublicHospitalsEndpoint);
router.get("/hospital/info/:hospital_code", optionalAuth, getHospitalInfoEndpoint);
router.get("/hospital/branding/:hospital_code", optionalAuth, getHospitalBrandingEndpoint);
router.get("/hospital/departments/:hospital_code", optionalAuth, getHospitalDepartmentsEndpoint);
router.get("/hospitals/:hospital_code/departments", optionalAuth, getHospitalDepartmentsEndpoint);

// SuperAdmin operations
router.get("/superadmin/overview", optionalAuth, getSuperadminOverviewEndpoint);
router.get("/superadmin/hospitals", optionalAuth, getSuperadminHospitalsEndpoint);
router.get("/superadmin/hospitals/check-code", optionalAuth, checkHospitalCodeEndpoint);
router.post("/superadmin/hospitals", optionalAuth, createHospitalEndpoint);
router.get("/superadmin/hospitals/:hospital_code", optionalAuth, getHospitalDetailEndpoint);
router.get("/superadmin/hospitals/:hospital_code/visits", optionalAuth, getHospitalVisitsEndpoint);
router.get("/superadmin/hospitals/:hospital_code/live-summary", optionalAuth, getHospitalLiveSummaryEndpoint);
router.put("/superadmin/hospitals/:hospital_code", optionalAuth, updateHospitalEndpoint);
router.get("/superadmin/hospitals/:hospital_code/branding", optionalAuth, getHospitalBrandingEndpoint);
router.put("/superadmin/hospitals/:hospital_code/branding", optionalAuth, updateHospitalBrandingEndpoint);
router.delete("/superadmin/hospitals/:hospital_code", optionalAuth, deleteHospitalEndpoint);

// Employees
router.get("/superadmin/hospitals/:hospital_code/employees", optionalAuth, getHospitalEmployeesEndpoint);
router.post("/superadmin/hospitals/:hospital_code/employees", optionalAuth, addHospitalEmployeeEndpoint);
router.post("/superadmin/hospitals/:hospital_code/employees/bulk", optionalAuth, bulkAddHospitalEmployeesEndpoint);
router.post("/superadmin/hospitals/:hospital_code/visits/bulk", optionalAuth, bulkAddHospitalVisitsEndpoint);
router.put("/superadmin/hospitals/:hospital_code/employees/:user_id", optionalAuth, updateHospitalEmployeeEndpoint);
router.put("/superadmin/hospitals/:hospital_code/employees/:user_id/password", optionalAuth, updateEmployeePasswordEndpoint);
router.post("/superadmin/hospitals/:hospital_code/employees/:user_id/password", optionalAuth, updateEmployeePasswordEndpoint);
router.delete("/superadmin/hospitals/:hospital_code/employees/:user_id", optionalAuth, deleteHospitalEmployeeEndpoint);

// Departments
router.get("/superadmin/hospitals/:hospital_code/departments", optionalAuth, getHospitalDepartmentsEndpoint);
router.post("/superadmin/hospitals/:hospital_code/departments", optionalAuth, addHospitalDepartmentEndpoint);
router.put("/superadmin/hospitals/:hospital_code/departments/:dept_code", optionalAuth, updateHospitalDepartmentEndpoint);
router.delete("/superadmin/hospitals/:hospital_code/departments/:dept_code", optionalAuth, deleteHospitalDepartmentEndpoint);

// Desks
router.get("/superadmin/hospitals/:hospital_code/desks", optionalAuth, getHospitalDesksEndpoint);
router.post("/superadmin/hospitals/:hospital_code/desks", optionalAuth, addHospitalDeskEndpoint);
router.put("/superadmin/hospitals/:hospital_code/desks/:desk_id", optionalAuth, updateHospitalDeskEndpoint);
router.delete("/superadmin/hospitals/:hospital_code/desks/:desk_id", optionalAuth, deleteHospitalDeskEndpoint);
router.put("/superadmin/hospitals/:hospital_code/desks/:desk_id/status", optionalAuth, updateDeskStatusEndpoint);
router.put("/superadmin/hospitals/:hospital_code/desks/:desk_id/assign", optionalAuth, assignHospitalDeskEndpoint);
router.post("/superadmin/hospitals/:hospital_code/desks/bulk-status", optionalAuth, bulkUpdateDeskStatusEndpoint);

// Database Overview
router.get("/admin/db-overview", optionalAuth, getDbOverviewEndpoint);

module.exports = router;
