/**
 * ticket.routes.js
 * ----------------
 * Ticket operations router.
 */

const express = require("express");
const {
  cancelTicketEndpoint,
  adjustQueueEndpoint,
  getTicketDetailsEndpoint,
  transferTicketEndpoint,
  reAnnounceEndpoint,
  savePrescriptionEndpoint,
  updateTicketPriorityEndpoint,
} = require("../controllers/ticket.controller");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { requireManager, ADMIN_ROLES } = require("../middleware/role");

const router = express.Router();

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

// Cancel endpoints (Authenticated patient or staff)
router.post("/tickets/:ticket_id/cancel", authenticate, cancelTicketEndpoint);
router.post("/plugin/tickets/:ticket_id/cancel", authenticate, cancelTicketEndpoint);
router.post("/plugin/cancel", authenticate, cancelTicketEndpoint);

// Priority / Emergency Triage endpoints (Staff/Doctor required)
router.post("/tickets/:ticket_id/priority", authenticate, requireDeskOperator, updateTicketPriorityEndpoint);
router.post("/plugin/tickets/:ticket_id/priority", authenticate, requireDeskOperator, updateTicketPriorityEndpoint);
router.post("/plugin/priority", authenticate, requireDeskOperator, updateTicketPriorityEndpoint);

// Adjust endpoints (Staff/Doctor required)
router.post("/tickets/:ticket_id/adjust", authenticate, requireDeskOperator, adjustQueueEndpoint);
router.post("/tickets/:ticket_id/adjust-queue", authenticate, requireDeskOperator, adjustQueueEndpoint);
router.post("/plugin/tickets/:ticket_id/adjust-queue", authenticate, requireDeskOperator, adjustQueueEndpoint);
router.post("/plugin/adjust-queue", authenticate, requireDeskOperator, adjustQueueEndpoint);

// Ticket details: public QR code / patient ticket tracking
router.get("/tickets/:ticket_id", optionalAuth, getTicketDetailsEndpoint);
router.get("/plugin/ticket/:ticket_id", optionalAuth, getTicketDetailsEndpoint);

// Transfer and Re-announce (Staff/Doctor required)
router.post("/plugin/transfer-ticket", authenticate, requireDeskOperator, transferTicketEndpoint);
router.post("/plugin/re-announce", authenticate, requireDeskOperator, reAnnounceEndpoint);

// Prescription endpoints (Doctor/Staff required)
router.post("/plugin/save-prescription", authenticate, requireDeskOperator, savePrescriptionEndpoint);
router.post("/tickets/:ticket_id/prescription", authenticate, requireDeskOperator, savePrescriptionEndpoint);

module.exports = router;
