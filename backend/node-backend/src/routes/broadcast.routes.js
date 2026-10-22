/**
 * broadcast.routes.js
 * -------------------
 * Router for Emergency Broadcasts and Hospital Network Announcements.
 */

const express = require("express");
const {
  getActiveBroadcastsEndpoint,
  getAllBroadcastsEndpoint,
  createBroadcastEndpoint,
  dismissBroadcastEndpoint,
} = require("../controllers/broadcast.controller");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

// Public / Surface endpoints to fetch active announcements
router.get("/broadcasts/active", optionalAuth, getActiveBroadcastsEndpoint);

// SuperAdmin operations
router.get("/superadmin/broadcasts", optionalAuth, getAllBroadcastsEndpoint);
router.post("/superadmin/broadcasts", optionalAuth, createBroadcastEndpoint);
router.delete("/superadmin/broadcasts/:id", optionalAuth, dismissBroadcastEndpoint);
router.post("/superadmin/broadcasts/:id/dismiss", optionalAuth, dismissBroadcastEndpoint);

module.exports = router;
