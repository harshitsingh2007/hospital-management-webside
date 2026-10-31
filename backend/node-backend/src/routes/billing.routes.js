/**
 * billing.routes.js
 * -----------------
 * Cashier & Central Billing API routes:
 * /api/v1/billing/*
 */

const express = require("express");
const { authenticate } = require("../middleware/auth");
const { hospitalIsolation } = require("../middleware/hospitalIsolation");
const { requireRole } = require("../middleware/role");
const billingController = require("../controllers/billing.controller");

const router = express.Router();

const BILLING_ACCESS_ROLES = [
  "cashier",
  "billing",
  "accountant",
  "billing_clerk",
  "cash_counter",
  "admin",
  "superadmin",
  "super_admin",
  "staff",
  "receptionist",
  "doctor",
];

// All routes require authentication and hospital isolation
router.use(authenticate);
router.use(hospitalIsolation("tenant_id"));
router.use(requireRole(BILLING_ACCESS_ROLES));

// 1. Tariffs (Price Master)
router.get("/tariffs", billingController.getTariffs);
router.post("/tariffs", billingController.createTariff);
router.put("/tariffs/:id", billingController.updateTariff);

// 2. Ticket Billable Items
router.get("/ticket/:ticketId/items", billingController.getTicketBillableItems);

// 3. Cash Shifts
router.get("/shifts/status", billingController.getShiftStatus);
router.post("/shifts/open", billingController.openShift);
router.put("/shifts/:id/close", billingController.closeShift);

// 4. Reports & Collections
router.get("/reports/daily-collection", billingController.getReports);

// 5. Bills CRUD & Operations
router.get("/bills", billingController.getBills);
router.get("/bills/:id", billingController.getBillById);
router.post("/bills", billingController.createBill);
router.put("/bills/:id", billingController.updateBill);
router.post("/bills/:id/discount", billingController.applyDiscount);
router.post("/bills/:id/cancel", billingController.cancelBill);

// 6. Payments & Refunds
router.post("/bills/:id/payments", billingController.recordPayment);
router.post("/bills/:id/refund", billingController.processRefund);

module.exports = router;

