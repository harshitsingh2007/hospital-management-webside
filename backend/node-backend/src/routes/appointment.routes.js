/**
 * appointment.routes.js
 * ----------------------
 * Appointment scheduling routes.
 */

const express = require("express");
const {
  bookAppointmentEndpoint,
  checkInAppointmentEndpoint,
  getUserAppointmentsEndpoint,
  getTenantAppointmentsEndpoint,
  cancelAppointmentEndpoint,
  completeAppointmentEndpoint,
} = require("../controllers/appointment.controller");
const { optionalAuth, authenticate } = require("../middleware/auth");
const { hospitalIsolation } = require("../middleware/hospitalIsolation");

const router = express.Router();

router.post("/plugin/appointments/book", optionalAuth, bookAppointmentEndpoint);
router.post("/plugin/appointments/check-in", optionalAuth, checkInAppointmentEndpoint);
router.post("/plugin/appointments/:appointment_id/cancel", optionalAuth, cancelAppointmentEndpoint);
router.post("/plugin/appointments/cancel", optionalAuth, cancelAppointmentEndpoint);
router.post("/plugin/appointments/:appointment_id/complete", optionalAuth, completeAppointmentEndpoint);
router.post("/plugin/appointments/complete", optionalAuth, completeAppointmentEndpoint);
router.get("/plugin/appointments/user/:email", optionalAuth, getUserAppointmentsEndpoint);
router.get("/plugin/appointments/tenant/:tenant_id", authenticate, hospitalIsolation("tenant_id"), getTenantAppointmentsEndpoint);

module.exports = router;
