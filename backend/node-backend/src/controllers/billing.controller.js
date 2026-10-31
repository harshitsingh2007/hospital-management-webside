/**
 * billing.controller.js
 * ---------------------
 * HTTP Controller for Cashier & Central Billing Portal.
 */

const prisma = require("../config/prisma");
const billingService = require("../services/billingService");

/**
 * Resolves hospital entity from request context
 */
async function resolveHospital(req) {
  const code =
    req.headers["x-hospital-code"] ||
    req.headers["x-tenant-id"] ||
    req.query.tenant_id ||
    req.query.hospital_code ||
    req.body?.tenant_id ||
    req.body?.hospital_code ||
    req.user?.hospital_code ||
    "city-hospital-01";

  const clean = String(code).trim();
  const hosp = await prisma.hospitals.findFirst({
    where: {
      OR: [
        { hospital_code: { equals: clean, mode: "insensitive" } },
        ...(Number.isInteger(Number(clean)) && Number(clean) > 0 ? [{ id: Number(clean) }] : []),
      ],
    },
  });

  if (!hosp) {
    const fallback = await prisma.hospitals.findFirst({ where: { status: "active" } });
    if (!fallback) throw new Error("No active hospital found.");
    return fallback;
  }
  return hosp;
}

// ==========================================
// Tariffs (Price Master)
// ==========================================

async function getTariffs(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const tariffs = await billingService.getTariffs(hospital.id, req.query);
    return res.json({ status: "success", success: true, data: tariffs });
  } catch (err) {
    next(err);
  }
}

async function createTariff(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const tariff = await billingService.createTariff(hospital.id, req.body, req.user);
    return res.status(201).json({ status: "success", success: true, data: tariff });
  } catch (err) {
    next(err);
  }
}

async function updateTariff(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const tariff = await billingService.updateTariff(hospital.id, req.params.id, req.body, req.user);
    return res.json({ status: "success", success: true, data: tariff });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Ticket Auto-Pull & Billable Items
// ==========================================

async function getTicketBillableItems(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const { ticketId } = req.params;
    const billable = await billingService.fetchBillableItemsForTicket(hospital.id, ticketId);
    return res.json({ status: "success", success: true, data: billable });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Bills
// ==========================================

async function getBills(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const result = await billingService.getBills(hospital.id, req.query);
    return res.json({ status: "success", success: true, data: result.bills, pagination: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) {
    next(err);
  }
}

async function getBillById(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const bill = await billingService.getBillById(hospital.id, req.params.id);
    return res.json({ status: "success", success: true, data: bill });
  } catch (err) {
    next(err);
  }
}

async function createBill(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const bill = await billingService.createBill(hospital.id, req.body, req.user);
    return res.status(201).json({ status: "success", success: true, data: bill });
  } catch (err) {
    next(err);
  }
}

async function updateBill(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const bill = await billingService.updateBill(hospital.id, req.params.id, req.body, req.user);
    return res.json({ status: "success", success: true, data: bill });
  } catch (err) {
    next(err);
  }
}

async function applyDiscount(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const bill = await billingService.applyDiscount(hospital.id, req.params.id, req.body, req.user);
    return res.json({ status: "success", success: true, data: bill });
  } catch (err) {
    next(err);
  }
}

async function cancelBill(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const bill = await billingService.cancelBill(hospital.id, req.params.id, req.body, req.user);
    return res.json({ status: "success", success: true, data: bill });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Payments & Refunds
// ==========================================

async function recordPayment(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const result = await billingService.recordPayment(hospital.id, req.params.id, req.body, req.user);
    return res.status(201).json({ status: "success", success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function processRefund(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const result = await billingService.processRefund(hospital.id, req.params.id, req.body, req.user);
    return res.status(201).json({ status: "success", success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Cash Shifts
// ==========================================

async function getShiftStatus(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const shift = await billingService.getShiftStatus(hospital.id, req.user);
    return res.json({ status: "success", success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

async function openShift(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const shift = await billingService.openShift(hospital.id, req.body, req.user);
    return res.status(201).json({ status: "success", success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

async function closeShift(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const shift = await billingService.closeShift(hospital.id, req.params.id, req.body, req.user);
    return res.json({ status: "success", success: true, data: shift });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// Daily Collection & Analytics Reports
// ==========================================

async function getReports(req, res, next) {
  try {
    const hospital = await resolveHospital(req);
    const report = await billingService.getDailyCollectionReport(hospital.id, req.query);
    return res.json({ status: "success", success: true, data: report });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTariffs,
  createTariff,
  updateTariff,
  getTicketBillableItems,
  getBills,
  getBillById,
  createBill,
  updateBill,
  applyDiscount,
  cancelBill,
  recordPayment,
  processRefund,
  getShiftStatus,
  openShift,
  closeShift,
  getReports,
};

