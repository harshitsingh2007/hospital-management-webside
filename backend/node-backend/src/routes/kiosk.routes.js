/**
 * kiosk.routes.js
 * ---------------
 * Dedicated router for Hospital Kiosks, Public Waiting Room TVs, and Hardware Heartbeats.
 */

const express = require("express");
const {
  getKioskEndpoint,
  kioskHeartbeatEndpoint,
  getKioskQueueEndpoint,
  getHospitalKiosksEndpoint,
  upsertKioskEndpoint,
  deleteKioskEndpoint,
} = require("../controllers/kiosk.controller");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

// Dedicated Kiosk Public/Operational Endpoints
router.get("/kiosk/:hospital_code/:kiosk_code", optionalAuth, getKioskEndpoint);
router.post("/kiosk/:hospital_code/:kiosk_code/heartbeat", optionalAuth, kioskHeartbeatEndpoint);
router.get("/kiosk/:hospital_code/:kiosk_code/queue", optionalAuth, getKioskQueueEndpoint);

// Hospital Kiosk Administration
router.get("/hospitals/:hospital_code/kiosks", optionalAuth, getHospitalKiosksEndpoint);
router.post("/hospitals/:hospital_code/kiosks", optionalAuth, upsertKioskEndpoint);
router.delete("/hospitals/:hospital_code/kiosks/:kiosk_code", optionalAuth, deleteKioskEndpoint);

module.exports = router;
