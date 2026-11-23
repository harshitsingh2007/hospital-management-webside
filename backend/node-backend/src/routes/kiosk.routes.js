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
const { authenticate, optionalAuth } = require("../middleware/auth");
const { requireManager, ADMIN_ROLES } = require("../middleware/role");
const { hospitalIsolation } = require("../middleware/hospitalIsolation");

const requireAdmin = requireManager(ADMIN_ROLES, { requireJwt: true });

const router = express.Router();

// Dedicated Kiosk Public/Operational Endpoints (For hardware kiosks & public waiting-room displays)
router.get("/kiosk/:hospital_code/:kiosk_code", optionalAuth, getKioskEndpoint);
router.post("/kiosk/:hospital_code/:kiosk_code/heartbeat", optionalAuth, kioskHeartbeatEndpoint);
router.get("/kiosk/:hospital_code/:kiosk_code/queue", optionalAuth, getKioskQueueEndpoint);

// Hospital Kiosk Administration (Restricted to Hospital Admins & Isolated by hospital_code)
router.get("/hospitals/:hospital_code/kiosks", authenticate, requireAdmin, hospitalIsolation("hospital_code"), getHospitalKiosksEndpoint);
router.post("/hospitals/:hospital_code/kiosks", authenticate, requireAdmin, hospitalIsolation("hospital_code"), upsertKioskEndpoint);
router.delete("/hospitals/:hospital_code/kiosks/:kiosk_code", authenticate, requireAdmin, hospitalIsolation("hospital_code"), deleteKioskEndpoint);

module.exports = router;
