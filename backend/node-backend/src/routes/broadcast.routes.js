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

const router = express.Router();

/**
 * SuperAdmin authorization guard: ensures the caller has admin/superadmin privileges.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required to access Broadcast Center management.",
    });
  }

  const role = String(req.user.role || "").toLowerCase();
  const email = String(req.user.email || "").toLowerCase();
  const isSuperAdmin =
    ["superadmin", "super_admin", "admin", "hospital_owner"].includes(role) ||
    email === "superadmin@hospital.com";

  if (!isSuperAdmin) {
    return res.status(403).json({
      status: "error",
      message: "Forbidden: Super Administrator privileges required.",
    });
  }

  next();
}

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
