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
const { authenticate, optionalAuth } = require("../middleware/auth");
const { hospitalIsolation } = require("../middleware/hospitalIsolation");

const router = express.Router();

router.post("/plugin/appointments/book", authenticate, bookAppointmentEndpoint);
router.post("/plugin/appointments/check-in", authenticate, checkInAppointmentEndpoint);
router.post("/plugin/appointments/:appointment_id/cancel", authenticate, cancelAppointmentEndpoint);
router.post("/plugin/appointments/cancel", authenticate, cancelAppointmentEndpoint);
router.post("/plugin/appointments/:appointment_id/complete", authenticate, completeAppointmentEndpoint);
router.post("/plugin/appointments/complete", authenticate, completeAppointmentEndpoint);
router.get("/plugin/appointments/user/:email", optionalAuth, getUserAppointmentsEndpoint);
router.get("/plugin/appointments/tenant/:tenant_id", authenticate, hospitalIsolation("tenant_id"), getTenantAppointmentsEndpoint);

module.exports = router;
