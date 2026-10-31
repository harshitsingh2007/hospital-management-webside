/**
 * billingService.js
 * -----------------
 * Enterprise Multi-Tenant Hospital Cashier & Central Billing Service.
 * 
 * Capabilities:
 * - Service Tariff Master (CRUD + auto-seed defaults)
 * - Bill Generation (Walk-in or Ticket auto-pull)
 * - Sequential Bill (INV-YYYY-XXXXXX) & Receipt (REC-YYYY-XXXXXX) Numbering
 * - Split Payments (Cash, UPI, Card, Net Banking, Cheque, Insurance)
 * - Discounts & Approvals
 * - Refunds & Cancellations
 * - Day-End Cash Shifts (opening, closing, reconciliation)
 * - Real-time Collections & Audit Reports
 */

const prisma = require("../config/prisma");
const { getIo, broadcastQueueUpdate } = require("../socket");

// Standard Default Tariffs for Auto-Seeding
const DEFAULT_TARIFFS = [
  { code: "CONS-OPD", name: "General OPD Consultation", category: "Consultation", dept: "opd", price: 300.0, tax: 0 },
  { code: "CONS-EMG", name: "Emergency Triage & Consultation", category: "Consultation", dept: "emergency", price: 500.0, tax: 0 },
  { code: "CONS-SPEC", name: "Specialist Consultation", category: "Consultation", dept: "opd", price: 600.0, tax: 0 },
  { code: "LAB-CBC", name: "Complete Blood Count (CBC)", category: "Lab", dept: "laboratory", price: 250.0, tax: 0 },
  { code: "LAB-LFT", name: "Liver Function Test (LFT)", category: "Lab", dept: "laboratory", price: 450.0, tax: 0 },
  { code: "LAB-KFT", name: "Kidney Function Test (KFT)", category: "Lab", dept: "laboratory", price: 450.0, tax: 0 },
  { code: "LAB-LIPID", name: "Lipid Profile Panel", category: "Lab", dept: "laboratory", price: 400.0, tax: 0 },
  { code: "LAB-URINE", name: "Urine Routine & Microscopic", category: "Lab", dept: "laboratory", price: 150.0, tax: 0 },
  { code: "LAB-GLUC", name: "Blood Glucose Test (Fasting/PP)", category: "Lab", dept: "laboratory", price: 80.0, tax: 0 },
  { code: "RAD-XRAY-CHEST", name: "Chest X-Ray (PA View)", category: "Radiology", dept: "radiology", price: 450.0, tax: 0 },
  { code: "RAD-USG-ABD", name: "Ultrasound Whole Abdomen", category: "Radiology", dept: "radiology", price: 900.0, tax: 0 },
  { code: "RAD-CT-HEAD", name: "CT Scan Head / Brain Plain", category: "Radiology", dept: "radiology", price: 2200.0, tax: 0 },
  { code: "RAD-MRI-BRAIN", name: "MRI Brain Plain", category: "Radiology", dept: "radiology", price: 4500.0, tax: 0 },
  { code: "PROC-ECG", name: "12-Lead Electrocardiogram (ECG)", category: "Procedure", dept: "opd", price: 300.0, tax: 0 },
  { code: "PROC-DRESS", name: "Wound Dressing & Aseptic Care", category: "Procedure", dept: "opd", price: 200.0, tax: 0 },
  { code: "PROC-INJ", name: "Injection Administration Fee", category: "Procedure", dept: "opd", price: 50.0, tax: 0 }
];

/** Helper: Round to 2 decimal places */
function round2(num) {
  const n = Number(num);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

/** Helper: Get employee ID for a given user in a hospital */
async function getEmployeeIdForUser(hospitalId, userId) {
  if (!userId) return null;
  const emp = await prisma.employees.findFirst({
    where: { hospital_id: hospitalId, user_id: userId },
    select: { id: true },
  });
  return emp ? emp.id : null;
}

/** Helper: Write to audit_logs */
async function recordAudit(hospitalId, userId, action, entityType, entityId, oldVals = {}, newVals = {}) {
  try {
    let validUserId = null;
    if (userId) {
      const u = await prisma.users.findUnique({
        where: { id: Number(userId) },
        select: { id: true },
      });
      if (u) validUserId = u.id;
    }

    await prisma.audit_logs.create({
      data: {
        hospital_id: hospitalId,
        user_id: validUserId,
        action,
        entity_type: entityType,
        entity_id: String(entityId),
        old_values: oldVals || {},
        new_values: newVals || {},
      },
    });
  } catch (err) {
    console.warn("[Billing Audit Error]:", err.message);
  }
}

/**
 * Generate Sequential Bill Number inside a transaction
 * Format: INV-YYYY-XXXXXX
 */
async function getNextBillNumber(tx, hospitalId) {
  const year = new Date().getFullYear();
  const counter = await tx.$queryRaw`
    INSERT INTO hospital_billing_counters (hospital_id, year, last_bill_seq, last_receipt_seq, updated_at)
    VALUES (${hospitalId}, ${year}, 1, 0, NOW())
    ON CONFLICT (hospital_id, year)
    DO UPDATE SET last_bill_seq = hospital_billing_counters.last_bill_seq + 1, updated_at = NOW()
    RETURNING last_bill_seq;
  `;
  const seq = counter[0]?.last_bill_seq || 1;
  return `INV-${year}-${String(seq).padStart(6, "0")}`;
}

/**
 * Generate Sequential Receipt Number inside a transaction
 * Format: REC-YYYY-XXXXXX
 */
async function getNextReceiptNumber(tx, hospitalId) {
  const year = new Date().getFullYear();
  const counter = await tx.$queryRaw`
    INSERT INTO hospital_billing_counters (hospital_id, year, last_bill_seq, last_receipt_seq, updated_at)
    VALUES (${hospitalId}, ${year}, 0, 1, NOW())
    ON CONFLICT (hospital_id, year)
    DO UPDATE SET last_receipt_seq = hospital_billing_counters.last_receipt_seq + 1, updated_at = NOW()
    RETURNING last_receipt_seq;
  `;
  const seq = counter[0]?.last_receipt_seq || 1;
  return `REC-${year}-${String(seq).padStart(6, "0")}`;
}

/* ========================================================================= */
/* 1. SERVICE TARIFFS                                                        */
/* ========================================================================= */

async function seedTariffsIfEmpty(hospitalId) {
  const count = await prisma.service_tariffs.count({ where: { hospital_id: hospitalId } });
  if (count === 0) {
    for (const item of DEFAULT_TARIFFS) {
      await prisma.service_tariffs.create({
        data: {
          hospital_id: hospitalId,
          service_code: item.code,
          service_name: item.name,
          category: item.category,
          department_code: item.dept,
          base_price: item.price,
          tax_percent: item.tax,
          is_active: true,
        },
      });
    }
  }
}

async function getTariffs(hospitalId, { category, department_code, search, is_active } = {}) {
  await seedTariffsIfEmpty(hospitalId);

  const where = { hospital_id: hospitalId };
  if (category && category !== "all") {
    where.category = { equals: category, mode: "insensitive" };
  }
  if (department_code && department_code !== "all") {
    where.department_code = { equals: department_code, mode: "insensitive" };
  }
  if (is_active !== undefined && is_active !== null && is_active !== "all") {
    where.is_active = is_active === "true" || is_active === true;
  }
  if (search) {
    where.OR = [
      { service_name: { contains: search, mode: "insensitive" } },
      { service_code: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.service_tariffs.findMany({
    where,
    orderBy: [{ category: "asc" }, { service_name: "asc" }],
  });
}

async function createTariff(hospitalId, data, userId) {
  const code = (data.service_code || `SRV-${Date.now()}`).toUpperCase().trim();
  const tariff = await prisma.service_tariffs.create({
    data: {
      hospital_id: hospitalId,
      service_code: code,
      service_name: data.service_name.trim(),
      category: data.category || "Consultation",
      department_code: (data.department_code || "general").toLowerCase().trim(),
      base_price: round2(data.base_price || 0),
      tax_percent: round2(data.tax_percent || 0),
      is_active: data.is_active !== false,
    },
  });
  await recordAudit(hospitalId, userId, "CREATE_TARIFF", "service_tariffs", tariff.id, null, tariff);
  return tariff;
}

async function updateTariff(hospitalId, id, data, userId) {
  const existing = await prisma.service_tariffs.findFirst({
    where: { id: Number(id), hospital_id: hospitalId },
  });
  if (!existing) throw new Error("Tariff item not found.");

  const updated = await prisma.service_tariffs.update({
    where: { id: Number(id) },
    data: {
      service_name: data.service_name !== undefined ? data.service_name.trim() : existing.service_name,
      category: data.category || existing.category,
      department_code: data.department_code || existing.department_code,
      base_price: data.base_price !== undefined ? round2(data.base_price) : existing.base_price,
      tax_percent: data.tax_percent !== undefined ? round2(data.tax_percent) : existing.tax_percent,
      is_active: data.is_active !== undefined ? !!data.is_active : existing.is_active,
    },
  });
  await recordAudit(hospitalId, userId, "UPDATE_TARIFF", "service_tariffs", id, existing, updated);
  return updated;
}

/* ========================================================================= */
/* 2. AUTO-PULL BILLABLE ITEMS FROM TICKET / PRESCRIPTION                    */
/* ========================================================================= */

async function fetchBillableItemsForTicket(hospitalId, ticketId) {
  await seedTariffsIfEmpty(hospitalId);

  // 1. Fetch ticket and patient info
  const ticket = await prisma.tickets.findUnique({
    where: { ticket_id: ticketId },
    include: {
      patients: true,
      employees: true,
      departments: true,
    },
  });

  if (!ticket) {
    throw new Error(`Ticket #${ticketId} not found.`);
  }

  // 2. Lookup tariffs to cross-match
  const tariffs = await prisma.service_tariffs.findMany({
    where: { hospital_id: hospitalId, is_active: true },
  });
  const tariffMap = new Map();
  tariffs.forEach((t) => {
    tariffMap.set(t.service_code.toLowerCase(), t);
    tariffMap.set(t.service_name.toLowerCase(), t);
  });

  const items = [];

  // 3. Consultation Fee
  const isEmergency = String(ticket.priority_level || "").toLowerCase() === "emergency";
  const consTariff = isEmergency
    ? (tariffMap.get("cons-emg") || { base_price: 500, tax_percent: 0, service_name: "Emergency Consultation", id: null })
    : (tariffMap.get("cons-opd") || { base_price: 300, tax_percent: 0, service_name: "General OPD Consultation", id: null });

  items.push({
    tariff_id: consTariff.id,
    description: consTariff.service_name,
    department_code: isEmergency ? "emergency" : (ticket.departments?.dept_code || "opd"),
    quantity: 1,
    unit_price: round2(consTariff.base_price),
    tax_percent: round2(consTariff.tax_percent),
    line_total: round2(Number(consTariff.base_price) * (1 + Number(consTariff.tax_percent) / 100)),
    source: "consultation",
  });

  // 4. Check for linked Prescriptions / Lab / Radiology tests
  const prescription = await prisma.prescriptions.findFirst({
    where: { ticket_id: ticketId },
    orderBy: { created_at: "desc" },
  });

  if (prescription) {
    // A. Lab Tests from prescription
    let labTests = [];
    if (prescription.lab_tests_json) {
      labTests = Array.isArray(prescription.lab_tests_json)
        ? prescription.lab_tests_json
        : (typeof prescription.lab_tests_json === "string" ? JSON.parse(prescription.lab_tests_json || "[]") : []);
    }
    for (const test of labTests) {
      const testName = typeof test === "string" ? test : (test.name || test.test_name || "Diagnostic Test");
      const matched = Array.from(tariffMap.values()).find(
        (t) => t.category.toLowerCase() === "lab" && (
          t.service_name.toLowerCase().includes(testName.toLowerCase()) ||
          testName.toLowerCase().includes(t.service_name.toLowerCase())
        )
      );
      const price = matched ? Number(matched.base_price) : 250;
      const tax = matched ? Number(matched.tax_percent) : 0;
      items.push({
        tariff_id: matched ? matched.id : null,
        description: testName,
        department_code: "laboratory",
        quantity: 1,
        unit_price: round2(price),
        tax_percent: round2(tax),
        line_total: round2(price * (1 + tax / 100)),
        source: "lab",
      });
    }

    // B. Medicines from prescription
    let meds = [];
    if (prescription.medicines_json) {
      meds = Array.isArray(prescription.medicines_json)
        ? prescription.medicines_json
        : (typeof prescription.medicines_json === "string" ? JSON.parse(prescription.medicines_json || "[]") : []);
    }
    for (const m of meds) {
      const medName = m.name || m.medicine_name || "Pharmacy Item";
      const qty = Number(m.quantity || m.qty || 1);
      const unitP = Number(m.unit_price || m.price || 50);
      items.push({
        tariff_id: null,
        description: `${medName} (${m.dosage || "1 strip"})`,
        department_code: "pharmacy",
        quantity: qty > 0 ? qty : 1,
        unit_price: round2(unitP),
        tax_percent: 0,
        line_total: round2(qty * unitP),
        source: "pharmacy",
      });
    }
  }

  // 5. Check if Radiology report/order exists in prescription_notes
  if (ticket.prescription_notes) {
    try {
      const parsedNotes = JSON.parse(ticket.prescription_notes);
      if (parsedNotes.radiology_report) {
        const rad = parsedNotes.radiology_report;
        const radName = `${rad.modality || "Imaging"} - ${rad.body_part || "General Study"}`;
        const matched = Array.from(tariffMap.values()).find(
          (t) => t.category.toLowerCase() === "radiology" && (
            t.service_name.toLowerCase().includes((rad.modality || "").toLowerCase())
          )
        );
        const price = matched ? Number(matched.base_price) : 600;
        const tax = matched ? Number(matched.tax_percent) : 0;
        items.push({
          tariff_id: matched ? matched.id : null,
          description: radName,
          department_code: "radiology",
          quantity: 1,
          unit_price: round2(price),
          tax_percent: round2(tax),
          line_total: round2(price * (1 + tax / 100)),
          source: "radiology",
        });
      }
    } catch (e) {
      // Notes is plain text, nothing to parse
    }
  }

  return {
    ticket,
    patient: ticket.patients,
    doctor: ticket.employees,
    items,
  };
}

/* ========================================================================= */
/* 3. BILLS CREATION, COMPUTATION & EDITING                                  */
/* ========================================================================= */

/**
 * Pure calculation function: computes line items, subtotal, taxes, discounts, grand total
 */
function computeBillTotals(rawItems, rawDiscount = 0) {
  let subtotal = 0;
  let taxAmount = 0;

  const items = (rawItems || []).map((item) => {
    const qty = Math.max(0.01, round2(item.quantity || 1));
    const price = Math.max(0, round2(item.unit_price || 0));
    const taxPct = Math.max(0, round2(item.tax_percent || 0));
    const lineSub = round2(qty * price);
    const lineTax = round2(lineSub * (taxPct / 100));
    const lineTotal = round2(lineSub + lineTax);

    subtotal += lineSub;
    taxAmount += lineTax;

    return {
      tariff_id: item.tariff_id ? Number(item.tariff_id) : null,
      description: String(item.description || "Medical Service").trim(),
      department_code: String(item.department_code || "general").trim(),
      quantity: qty,
      unit_price: price,
      tax_percent: taxPct,
      line_total: lineTotal,
      source: item.source || "manual",
    };
  });

  subtotal = round2(subtotal);
  taxAmount = round2(taxAmount);

  const discountAmount = Math.min(round2(rawDiscount || 0), round2(subtotal + taxAmount));
  const grandTotal = Math.max(0, round2(subtotal + taxAmount - discountAmount));

  return {
    items,
    subtotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    grand_total: grandTotal,
  };
}

async function createBill(hospitalId, data, user) {
  const employeeId = await getEmployeeIdForUser(hospitalId, user?.id);

  // Calculate totals safely on backend
  const { items, subtotal, tax_amount, discount_amount, grand_total } = computeBillTotals(
    data.items || [],
    data.discount_amount
  );

  // Run inside database transaction for atomic sequential number and insert
  const bill = await prisma.$transaction(async (tx) => {
    const billNumber = await getNextBillNumber(tx, hospitalId);

    // Auto-link or create patient record for direct walk-in patients
    let targetPatientId = data.patient_id ? Number(data.patient_id) : null;
    if (!targetPatientId && (data.patient_name || data.patient?.name)) {
      const pName = data.patient_name || data.patient?.name || data.patient?.full_name;
      const pPhone = data.phone || data.patient?.phone || "";
      const pAge = Number(data.age || data.patient?.age || 0);
      const pGender = data.gender || data.patient?.gender || "other";
      const pUhid = data.medical_id || data.uhid || data.patient?.medical_id || data.patient?.uhid || "";

      let existing = null;
      if (pPhone && pPhone.length >= 10) {
        existing = await tx.patients.findFirst({ where: { phone: pPhone } });
      }
      if (!existing && pUhid) {
        existing = await tx.patients.findFirst({ where: { medical_id: pUhid } });
      }

      if (existing) {
        targetPatientId = existing.id;
      } else if (pName && pName.trim()) {
        const genUhid = pUhid || `UHID-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const newPatient = await tx.patients.create({
          data: {
            name: pName.trim(),
            phone: pPhone,
            age: pAge,
            gender: pGender.toLowerCase(),
            medical_id: genUhid,
          },
        });
        targetPatientId = newPatient.id;
      }
    }

    const created = await tx.bills.create({
      data: {
        bill_number: billNumber,
        hospital_id: hospitalId,
        patient_id: targetPatientId,
        ticket_id: data.ticket_id || null,
        visit_id: data.visit_id ? Number(data.visit_id) : null,
        status: data.status || "Pending",
        subtotal,
        discount_amount,
        discount_reason: data.discount_reason || "",
        tax_amount,
        grand_total,
        amount_paid: 0,
        balance_due: grand_total,
        created_by: employeeId,
        notes: data.notes || "",
        bill_items: {
          create: items,
        },
      },
      include: {
        bill_items: true,
        patients: true,
      },
    });

    return created;
  });

  await recordAudit(hospitalId, user?.id, "CREATE_BILL", "bills", bill.id, null, {
    bill_number: bill.bill_number,
    grand_total: bill.grand_total,
    items_count: items.length,
  });

  const io = getIo();
  if (io) {
    io.emit("bill_created", {
      bill_id: bill.id,
      bill_number: bill.bill_number,
      hospital_id: hospitalId,
      grand_total: bill.grand_total,
      ticket_id: bill.ticket_id,
    });
  }

  return bill;
}

async function updateBill(hospitalId, billId, data, user) {
  const existing = await prisma.bills.findFirst({
    where: { id: Number(billId), hospital_id: hospitalId },
    include: { bill_items: true },
  });

  if (!existing) throw new Error("Bill not found.");
  if (["Paid", "Cancelled", "Refunded"].includes(existing.status)) {
    throw new Error(`Cannot edit bill with status '${existing.status}'.`);
  }

  const { items, subtotal, tax_amount, discount_amount, grand_total } = computeBillTotals(
    data.items || existing.bill_items,
    data.discount_amount !== undefined ? data.discount_amount : existing.discount_amount
  );

  const amountPaid = Number(existing.amount_paid);
  const balanceDue = Math.max(0, round2(grandTotal - amountPaid));
  const newStatus = balanceDue <= 0 ? "Paid" : (amountPaid > 0 ? "Partially Paid" : "Pending");

  const updated = await prisma.$transaction(async (tx) => {
    // Delete old items and insert updated items
    if (data.items) {
      await tx.bill_items.deleteMany({ where: { bill_id: Number(billId) } });
    }

    return tx.bills.update({
      where: { id: Number(billId) },
      data: {
        subtotal,
        tax_amount,
        discount_amount,
        discount_reason: data.discount_reason !== undefined ? data.discount_reason : existing.discount_reason,
        grand_total,
        balance_due: balanceDue,
        status: newStatus,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        ...(data.items ? { bill_items: { create: items } } : {}),
      },
      include: {
        bill_items: true,
        patients: true,
        payments: true,
      },
    });
  });

  await recordAudit(hospitalId, user?.id, "UPDATE_BILL", "bills", billId, existing, updated);
  return updated;
}

async function applyDiscount(hospitalId, billId, { discount_amount, discount_reason }, user) {
  const existing = await prisma.bills.findFirst({
    where: { id: Number(billId), hospital_id: hospitalId },
  });

  if (!existing) throw new Error("Bill not found.");
  if (["Paid", "Cancelled", "Refunded"].includes(existing.status)) {
    throw new Error(`Cannot modify discount for a '${existing.status}' bill.`);
  }

  const discAmt = round2(discount_amount || 0);
  if (discAmt > 0 && !discount_reason) {
    throw new Error("A reason is required when applying a discount.");
  }

  // Threshold verification: > Rs. 500 or > 15% requires admin/superadmin approval
  const sub = Number(existing.subtotal);
  const tax = Number(existing.tax_amount);
  const userRole = (user?.role || "").toLowerCase();
  const isAdmin = ["admin", "superadmin", "super_admin"].includes(userRole);

  if ((discAmt > 500 || (sub > 0 && (discAmt / sub) > 0.15)) && !isAdmin) {
    throw new Error("Discounts greater than ₹500 or 15% require an Administrator or SuperAdmin.");
  }

  const employeeId = await getEmployeeIdForUser(hospitalId, user?.id);
  const safeDiscount = Math.min(discAmt, round2(sub + tax));
  const grandTotal = Math.max(0, round2(sub + tax - safeDiscount));
  const amountPaid = Number(existing.amount_paid);
  const balanceDue = Math.max(0, round2(grandTotal - amountPaid));

  const updated = await prisma.bills.update({
    where: { id: Number(billId) },
    data: {
      discount_amount: safeDiscount,
      discount_reason: discount_reason.trim(),
      approved_by: isAdmin ? employeeId : existing.approved_by,
      grand_total: grandTotal,
      balance_due: balanceDue,
      status: balanceDue <= 0 ? "Paid" : (amountPaid > 0 ? "Partially Paid" : "Pending"),
    },
    include: {
      bill_items: true,
      patients: true,
    },
  });

  await recordAudit(hospitalId, user?.id, "APPLY_DISCOUNT", "bills", billId, existing, updated);
  return updated;
}

async function cancelBill(hospitalId, billId, { reason }, user) {
  const existing = await prisma.bills.findFirst({
    where: { id: Number(billId), hospital_id: hospitalId },
  });

  if (!existing) throw new Error("Bill not found.");
  if (Number(existing.amount_paid) > 0) {
    throw new Error("Cannot cancel a bill that has received payments. Please process refunds first.");
  }

  const updated = await prisma.bills.update({
    where: { id: Number(billId) },
    data: {
      status: "Cancelled",
      notes: `${existing.notes || ""} [Cancelled: ${reason || "No reason specified"}]`.trim(),
    },
  });

  await recordAudit(hospitalId, user?.id, "CANCEL_BILL", "bills", billId, existing, updated);
  return updated;
}

async function getBills(hospitalId, filters = {}) {
  const where = { hospital_id: hospitalId };

  if (filters.status && filters.status !== "all") {
    where.status = { equals: filters.status, mode: "insensitive" };
  }

  if (filters.patient_id) {
    where.patient_id = Number(filters.patient_id);
  }

  if (filters.ticket_id) {
    where.ticket_id = { contains: filters.ticket_id, mode: "insensitive" };
  }

  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { bill_number: { contains: s, mode: "insensitive" } },
      { ticket_id: { contains: s, mode: "insensitive" } },
      { patients: { name: { contains: s, mode: "insensitive" } } },
      { patients: { phone: { contains: s, mode: "insensitive" } } },
    ];
  }

  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00.000Z`);
    const end = new Date(`${filters.date}T23:59:59.999Z`);
    where.created_at = { gte: start, lte: end };
  } else if (filters.startDate && filters.endDate) {
    where.created_at = {
      gte: new Date(`${filters.startDate}T00:00:00.000Z`),
      lte: new Date(`${filters.endDate}T23:59:59.999Z`),
    };
  }

  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
  const page = Math.max(1, Number(filters.page) || 1);
  const skip = (page - 1) * limit;

  const [total, bills] = await Promise.all([
    prisma.bills.count({ where }),
    prisma.bills.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        patients: {
          select: { id: true, name: true, phone: true, medical_id: true, gender: true, age: true },
        },
        employees_bills_created_byToemployees: {
          select: { id: true, name: true, employee_code: true },
        },
        bill_items: true,
        payments: true,
      },
    }),
  ]);

  return { total, page, limit, bills };
}

async function getBillById(hospitalId, billId) {
  const bill = await prisma.bills.findFirst({
    where: { id: Number(billId), hospital_id: hospitalId },
    include: {
      patients: true,
      employees_bills_created_byToemployees: {
        select: { id: true, name: true, employee_code: true },
      },
      employees_bills_approved_byToemployees: {
        select: { id: true, name: true, employee_code: true },
      },
      bill_items: {
        include: { service_tariffs: true },
      },
      payments: {
        include: {
          employees: { select: { id: true, name: true } },
          refunds: true,
        },
        orderBy: { received_at: "asc" },
      },
      refunds: true,
    },
  });

  if (!bill) throw new Error("Bill not found.");
  return bill;
}

/* ========================================================================= */
/* 4. PAYMENTS & SPLIT PAYMENTS                                              */
/* ========================================================================= */

/**
 * Record a payment (single or split payment array)
 * paymentData: { payments: [{ mode, amount, reference_no }] } OR { mode, amount, reference_no }
 */
async function recordPayment(hospitalId, billId, paymentData, user) {
  const employeeId = await getEmployeeIdForUser(hospitalId, user?.id);

  // Normalize payments array
  const rawList = Array.isArray(paymentData.payments)
    ? paymentData.payments
    : [{ mode: paymentData.mode, amount: paymentData.amount, reference_no: paymentData.reference_no }];

  const sanitizedPayments = rawList
    .map((p) => ({
      mode: p.mode || "Cash",
      amount: round2(p.amount),
      reference_no: p.reference_no || "",
    }))
    .filter((p) => p.amount > 0);

  if (sanitizedPayments.length === 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const totalPayment = round2(sanitizedPayments.reduce((acc, p) => acc + p.amount, 0));

  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch and verify bill
    const bill = await tx.bills.findFirst({
      where: { id: Number(billId), hospital_id: hospitalId },
    });

    if (!bill) throw new Error("Bill not found.");
    if (bill.status === "Cancelled" || bill.status === "Refunded") {
      throw new Error(`Cannot pay for a '${bill.status}' bill.`);
    }

    const currentDue = round2(Number(bill.balance_due));
    if (totalPayment > currentDue + 0.05) {
      throw new Error(`Payment amount (₹${totalPayment}) exceeds the outstanding balance due (₹${currentDue}).`);
    }

    // 2. Generate receipts and create payment rows
    const paymentRecords = [];
    for (const item of sanitizedPayments) {
      const receiptNo = await getNextReceiptNumber(tx, hospitalId);
      const payment = await tx.payments.create({
        data: {
          bill_id: Number(billId),
          receipt_number: receiptNo,
          mode: item.mode,
          amount: item.amount,
          reference_no: item.reference_no,
          received_by: employeeId,
          status: "Success",
        },
      });
      paymentRecords.push(payment);
    }

    // 3. Update bill amounts and status
    const newPaid = round2(Number(bill.amount_paid) + totalPayment);
    const newDue = Math.max(0, round2(Number(bill.grand_total) - newPaid));
    const newStatus = newDue <= 0 ? "Paid" : "Partially Paid";

    const updatedBill = await tx.bills.update({
      where: { id: Number(billId) },
      data: {
        amount_paid: newPaid,
        balance_due: newDue,
        status: newStatus,
      },
      include: {
        bill_items: true,
        patients: true,
        payments: true,
      },
    });

    return { bill: updatedBill, payments: paymentRecords };
  });

  await recordAudit(hospitalId, user?.id, "RECORD_PAYMENT", "payments", billId, null, {
    total_received: totalPayment,
    payments: result.payments.map((p) => ({ receipt: p.receipt_number, mode: p.mode, amount: p.amount })),
  });

  const io = getIo();
  if (io) {
    io.emit("payment_received", {
      bill_id: result.bill.id,
      bill_number: result.bill.bill_number,
      total_paid: result.bill.amount_paid,
      balance_due: result.bill.balance_due,
      status: result.bill.status,
      receipts: result.payments.map((p) => p.receipt_number),
    });
  }

  return result;
}

/* ========================================================================= */
/* 5. REFUNDS                                                                */
/* ========================================================================= */

async function processRefund(hospitalId, billId, { payment_id, amount, reason }, user) {
  if (!reason || !reason.trim()) {
    throw new Error("A reason is mandatory to process a refund.");
  }

  const refundAmt = round2(amount);
  if (refundAmt <= 0) {
    throw new Error("Refund amount must be greater than zero.");
  }

  const employeeId = await getEmployeeIdForUser(hospitalId, user?.id);
  const userRole = (user?.role || "").toLowerCase();
  const isAdmin = ["admin", "superadmin", "super_admin"].includes(userRole);

  const result = await prisma.$transaction(async (tx) => {
    const bill = await tx.bills.findFirst({
      where: { id: Number(billId), hospital_id: hospitalId },
    });

    if (!bill) throw new Error("Bill not found.");
    const currentPaid = round2(Number(bill.amount_paid));

    if (refundAmt > currentPaid) {
      throw new Error(`Refund amount (₹${refundAmt}) cannot exceed total amount paid (₹${currentPaid}).`);
    }

    const refund = await tx.refunds.create({
      data: {
        bill_id: Number(billId),
        payment_id: payment_id ? Number(payment_id) : null,
        amount: refundAmt,
        reason: reason.trim(),
        created_by: employeeId,
        approved_by: isAdmin ? employeeId : null,
        status: isAdmin ? "Approved" : "Pending",
      },
    });

    // If approved, update bill amounts
    let updatedBill = bill;
    if (refund.status === "Approved") {
      const newPaid = round2(currentPaid - refundAmt);
      const newDue = Math.max(0, round2(Number(bill.grand_total) - newPaid));
      const newStatus = newPaid <= 0 ? "Refunded" : "Partially Paid";

      updatedBill = await tx.bills.update({
        where: { id: Number(billId) },
        data: {
          amount_paid: newPaid,
          balance_due: newDue,
          status: newStatus,
        },
      });
    }

    return { refund, bill: updatedBill };
  });

  await recordAudit(hospitalId, user?.id, "PROCESS_REFUND", "refunds", result.refund.id, null, result.refund);
  return result;
}

/* ========================================================================= */
/* 6. CASH SHIFTS (Day-End Cash Reconciliation)                              */
/* ========================================================================= */

async function getShiftStatus(hospitalId, user) {
  const employeeId = await getEmployeeIdForUser(hospitalId, user?.id);
  if (!employeeId) return null;

  const activeShift = await prisma.cash_shifts.findFirst({
    where: {
      hospital_id: hospitalId,
      cashier_id: employeeId,
      closed_at: null,
    },
    orderBy: { opened_at: "desc" },
  });

  if (!activeShift) return null;

  // Calculate cash payments collected during this shift
  const cashPayments = await prisma.payments.aggregate({
    where: {
      received_by: employeeId,
      mode: "Cash",
      status: "Success",
      received_at: { gte: activeShift.opened_at },
    },
    _sum: { amount: true },
  });

  const cashCollected = Number(cashPayments._sum.amount || 0);
  const opening = Number(activeShift.opening_cash || 0);
  const expectedCash = round2(opening + cashCollected);

  return {
    ...activeShift,
    cash_collected: cashCollected,
    expected_cash: expectedCash,
  };
}

async function openShift(hospitalId, { opening_cash, notes }, user) {
  const employeeId = await getEmployeeIdForUser(hospitalId, user?.id);
  if (!employeeId) throw new Error("Cashier employee profile not found.");

  const existing = await prisma.cash_shifts.findFirst({
    where: {
      hospital_id: hospitalId,
      cashier_id: employeeId,
      closed_at: null,
    },
  });

  if (existing) {
    throw new Error("You already have an active cash shift open. Please close it before opening a new one.");
  }

  const shift = await prisma.cash_shifts.create({
    data: {
      hospital_id: hospitalId,
      cashier_id: employeeId,
      opening_cash: round2(opening_cash || 0),
      notes: notes || "",
    },
  });

  await recordAudit(hospitalId, user?.id, "OPEN_CASH_SHIFT", "cash_shifts", shift.id, null, shift);
  return shift;
}

async function closeShift(hospitalId, shiftId, { counted_cash, notes }, user) {
  const employeeId = await getEmployeeIdForUser(hospitalId, user?.id);
  const shift = await prisma.cash_shifts.findFirst({
    where: { id: Number(shiftId), hospital_id: hospitalId },
  });

  if (!shift) throw new Error("Cash shift not found.");
  if (shift.closed_at) throw new Error("This cash shift has already been closed.");

  // Calculate expected cash = opening_cash + cash collections
  const cashPayments = await prisma.payments.aggregate({
    where: {
      received_by: shift.cashier_id,
      mode: "Cash",
      status: "Success",
      received_at: { gte: shift.opened_at },
    },
    _sum: { amount: true },
  });

  const cashCollected = Number(cashPayments._sum.amount || 0);
  const expectedCash = round2(Number(shift.opening_cash) + cashCollected);
  const counted = round2(counted_cash || 0);
  const difference = round2(counted - expectedCash);

  const closed = await prisma.cash_shifts.update({
    where: { id: Number(shiftId) },
    data: {
      closed_at: new Date(),
      expected_cash: expectedCash,
      counted_cash: counted,
      difference,
      notes: notes ? `${shift.notes || ""} | Closing: ${notes}`.trim() : shift.notes,
    },
  });

  await recordAudit(hospitalId, user?.id, "CLOSE_CASH_SHIFT", "cash_shifts", shiftId, shift, closed);
  return closed;
}

/* ========================================================================= */
/* 7. REPORTS & ANALYTICS                                                    */
/* ========================================================================= */

async function getDailyCollectionReport(hospitalId, { date, cashierId } = {}) {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const start = new Date(`${targetDate}T00:00:00.000Z`);
  const end = new Date(`${targetDate}T23:59:59.999Z`);

  const paymentWhere = {
    received_at: { gte: start, lte: end },
    status: "Success",
    bills: { hospital_id: hospitalId },
  };

  if (cashierId) {
    paymentWhere.received_by = Number(cashierId);
  }

  // 1. Total Collections & Mode Breakdown
  const payments = await prisma.payments.findMany({
    where: paymentWhere,
    include: {
      bills: {
        select: { id: true, bill_number: true, grand_total: true, patient_id: true },
      },
      employees: {
        select: { id: true, name: true },
      },
    },
  });

  let totalCollected = 0;
  const byMode = {};
  const byCashier = {};

  for (const p of payments) {
    const amt = Number(p.amount);
    totalCollected += amt;

    const mode = p.mode || "Other";
    byMode[mode] = round2((byMode[mode] || 0) + amt);

    const cashierName = p.employees?.name || "Unassigned";
    byCashier[cashierName] = round2((byCashier[cashierName] || 0) + amt);
  }

  totalCollected = round2(totalCollected);

  // 2. Department Breakdown (from bill_items generated today)
  const itemsToday = await prisma.bill_items.findMany({
    where: {
      created_at: { gte: start, lte: end },
      bills: { hospital_id: hospitalId },
    },
    select: { department_code: true, line_total: true },
  });

  const byDepartment = {};
  for (const it of itemsToday) {
    const dept = it.department_code || "General";
    byDepartment[dept] = round2((byDepartment[dept] || 0) + Number(it.line_total));
  }

  // 3. Outstanding Dues & Bills Created Today
  const billsToday = await prisma.bills.findMany({
    where: {
      hospital_id: hospitalId,
      created_at: { gte: start, lte: end },
    },
    select: { grand_total: true, amount_paid: true, balance_due: true, status: true },
  });

  let totalBilled = 0;
  let totalPendingDues = 0;
  let paidCount = 0;
  let pendingCount = 0;

  for (const b of billsToday) {
    totalBilled += Number(b.grand_total);
    totalPendingDues += Number(b.balance_due);
    if (b.status === "Paid") paidCount++;
    else if (["Pending", "Partially Paid"].includes(b.status)) pendingCount++;
  }

  // 4. Refunds Today
  const refundsToday = await prisma.refunds.findMany({
    where: {
      created_at: { gte: start, lte: end },
      bills: { hospital_id: hospitalId },
      status: "Approved",
    },
    select: { amount: true },
  });
  const totalRefunded = round2(refundsToday.reduce((acc, r) => acc + Number(r.amount), 0));

  return {
    date: targetDate,
    total_billed: round2(totalBilled),
    total_collected: totalCollected,
    total_refunded: totalRefunded,
    net_collection: round2(totalCollected - totalRefunded),
    total_pending_dues: round2(totalPendingDues),
    bills_count: billsToday.length,
    paid_count: paidCount,
    pending_count: pendingCount,
    by_mode: byMode,
    by_cashier: byCashier,
    by_department: byDepartment,
  };
}

module.exports = {
  getTariffs,
  createTariff,
  updateTariff,
  fetchBillableItemsForTicket,
  createBill,
  updateBill,
  applyDiscount,
  cancelBill,
  getBills,
  getBillById,
  recordPayment,
  processRefund,
  getShiftStatus,
  openShift,
  closeShift,
  getDailyCollectionReport,
  seedTariffsIfEmpty,
};

