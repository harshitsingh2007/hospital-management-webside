/**
 * queue.routes.js
 * ---------------
 * Queue lifecycle routes.
 */

const express = require("express");
const {
  joinQueueEndpoint,
  serveNextEndpoint,
  completeEndpoint,
  noShowEndpoint,
  holdTicketEndpoint,
  recallTicketEndpoint,
  reAnnounceEndpoint,
  countersEndpoint,
  getQueueEndpoint,
  getQueueHistoryEndpoint,
  getAnalyticsEndpoint,
  triggerDailyClosureEndpoint,
} = require("../controllers/queue.controller");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { requireManager, ADMIN_ROLES } = require("../middleware/role");
const { hospitalIsolation } = require("../middleware/hospitalIsolation");
const { publicTicketLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const requireAdmin = requireManager(ADMIN_ROLES, { requireJwt: true });
const requireDeskOperator = requireManager(
  [
    ...ADMIN_ROLES,
    "doctor",
    "staff",
    "receptionist",
    "pharmacist",
    "nurse",
    "technician",
    "pathologist",
    "radiologist",
    "billing",
    "cashier",
  ],
  { requireJwt: true }
);

// Public / Self-service Queue Entry (Rate-limited, guest-friendly)
router.post("/join", publicTicketLimiter, optionalAuth, joinQueueEndpoint);
router.post("/queue/join", publicTicketLimiter, optionalAuth, joinQueueEndpoint);

// Operational Desk Queue Management (Staff / Doctor JWT required)
router.post("/serve-next", authenticate, requireDeskOperator, serveNextEndpoint);
router.post("/complete", authenticate, requireDeskOperator, completeEndpoint);
router.post("/hold-ticket", authenticate, requireDeskOperator, holdTicketEndpoint);
router.post("/recall-ticket", authenticate, requireDeskOperator, recallTicketEndpoint);
router.post("/re-announce", authenticate, requireDeskOperator, reAnnounceEndpoint);
router.post("/no-show", authenticate, requireDeskOperator, noShowEndpoint);
router.post("/counters", authenticate, requireDeskOperator, countersEndpoint);

// Queue Snapshot: OptionalAuth (public/kiosk gets stripped names; authenticated staff gets full queue)
router.get("/queue/:tenant_id", optionalAuth, getQueueEndpoint);
router.get("/queue/snapshot/:tenant_id", optionalAuth, getQueueEndpoint);
router.get("/snapshot/:tenant_id", optionalAuth, getQueueEndpoint);

// Historical Queue & Analytics (Authenticated staff & isolated by tenant)
router.get("/queue/:tenant_id/history", authenticate, requireDeskOperator, hospitalIsolation("tenant_id"), getQueueHistoryEndpoint);
router.get("/analytics/:tenant_id", authenticate, requireAdmin, hospitalIsolation("tenant_id"), getAnalyticsEndpoint);
router.post("/daily-closure", authenticate, requireAdmin, triggerDailyClosureEndpoint);

module.exports = router;
