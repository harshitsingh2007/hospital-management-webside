/**
 * broadcast.routes.js
 * -------------------
 * Router for Emergency Broadcasts and Hospital Network Announcements.
 * Protected with verified JWT authentication and role-based checks for SuperAdmin actions.
 */

const express = require("express");
const {
  getActiveBroadcastsEndpoint,
  getAllBroadcastsEndpoint,
  getBroadcastStatsEndpoint,
  createBroadcastEndpoint,
  extendBroadcastEndpoint,
  dismissBroadcastEndpoint,
} = require("../controllers/broadcast.controller");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { requireManager, SUPER_ROLES } = require("../middleware/role");

const router = express.Router();

// Shared middleware: SuperAdmin operations require verified JWT and SUPER_ROLES only
const requireSuperAdmin = requireManager(SUPER_ROLES, { requireJwt: true });

// Public / Surface endpoints to fetch active announcements (Patient Portal, Kiosks, TVs, Terminals)
router.get("/broadcasts/active", optionalAuth, getActiveBroadcastsEndpoint);

// SuperAdmin operations - Verified JWT & SuperAdmin role required
router.get("/superadmin/broadcasts", authenticate, requireSuperAdmin, getAllBroadcastsEndpoint);
router.get("/superadmin/broadcasts/stats", authenticate, requireSuperAdmin, getBroadcastStatsEndpoint);
router.post("/superadmin/broadcasts", authenticate, requireSuperAdmin, createBroadcastEndpoint);
router.post("/superadmin/broadcasts/:id/extend", authenticate, requireSuperAdmin, extendBroadcastEndpoint);
router.post("/superadmin/broadcasts/:id/dismiss", authenticate, requireSuperAdmin, dismissBroadcastEndpoint);
router.delete("/superadmin/broadcasts/:id", authenticate, requireSuperAdmin, dismissBroadcastEndpoint);

module.exports = router;
