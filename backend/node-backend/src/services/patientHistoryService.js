/**
 * patientHistoryService.js
 * ------------------------
 * Dedicated Medical History & Follow-Up Engine.
 * Manages Patient Identity Resolution, Visit History, Structured Prescriptions,
 * Diagnostic Reports, and Hospital Multi-Tenant Isolation.
 */

const prisma = require("../config/prisma");

/**
 * Normalizes phone number to uniform format for robust matching.
 */
function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

/**
 * Resolves hospital internal integer ID from hospital_code or integer ID.
 */
async function resolveHospitalId(hospitalIdentifier) {
  if (!hospitalIdentifier) return 1;
  if (typeof hospitalIdentifier === "number") return hospitalIdentifier;
  const num = parseInt(hospitalIdentifier, 10);
  if (!isNaN(num) && String(num) === String(hospitalIdentifier)) return num;

  const hosp = await prisma.hospitals.findFirst({
    where: { hospital_code: String(hospitalIdentifier).trim() },
    select: { id: true },
  });
  return hosp ? hosp.id : 1;
}

/**
 * 1. Patient Identification
 * Priority:
 *   1. patient_id (explicit ID)
 *   2. user_id (authenticated account)
 *   3. verified phone number
 *   4. ticket_id / appointment_id association
 */
async function findPatientIdentity({
  patient_id = null,
  user_id = null,
  phone = null,
  ticket_id = null,
  appointment_id = null,
  hospital_id = null,
}) {
  let patient = null;
  const cleanPhone = normalizePhone(phone);
  const targetHospitalId = hospital_id ? await resolveHospitalId(hospital_id) : null;

  // Priority 1: patient_id
  if (patient_id) {
    const pIdNum = parseInt(String(patient_id).replace(/^PAT-?/i, ""), 10);
    if (!isNaN(pIdNum)) {
      patient = await prisma.patients.findUnique({
        where: { id: pIdNum },
        include: { users: { select: { id: true, email: true, username: true } } },
      });
    }
  }

  // Priority 2: user_id
  if (!patient && user_id) {
    const uIdNum = parseInt(user_id, 10);
    if (!isNaN(uIdNum)) {
      patient = await prisma.patients.findFirst({
        where: { user_id: uIdNum },
        include: { users: { select: { id: true, email: true, username: true } } },
        orderBy: { id: "desc" },
      });
    }
  }

  // Priority 3: phone
  if (!patient && cleanPhone && cleanPhone.length >= 10) {
    patient = await prisma.patients.findFirst({
      where: {
        phone: { contains: cleanPhone },
      },
      include: { users: { select: { id: true, email: true, username: true } } },
      orderBy: { id: "desc" },
    });
  }

  // Priority 4: ticket_id
  if (!patient && ticket_id) {
    const tkt = await prisma.tickets.findUnique({
      where: { ticket_id: String(ticket_id).trim() },
      include: {
        patients: {
          include: { users: { select: { id: true, email: true, username: true } } },
        },
      },
    });
    if (tkt && tkt.patients) {
      patient = tkt.patients;
    }
  }

  // Priority 5: appointment_id
  if (!patient && appointment_id) {
    const apt = await prisma.appointments.findUnique({
      where: { appointment_id: String(appointment_id).trim() },
      include: {
        patients: {
          include: { users: { select: { id: true, email: true, username: true } } },
        },
      },
    });
    if (apt && apt.patients) {
      patient = apt.patients;
    }
  }

  if (!patient) {
    return {
      patient_id: null,
      patient: null,
      is_returning_patient: false,
      total_visits: 0,
      summary: null,
    };
  }

  const summary = await getPatientHistorySummary(patient.id, targetHospitalId);

  return {
    patient_id: patient.id,
    medical_id: patient.medical_id || `PAT-${patient.id}`,
    name: patient.name,
    phone: patient.phone,
    gender: patient.gender,
    age: patient.age,
    is_returning_patient: summary.total_visits > 1,
    total_visits: summary.total_visits,
    summary,
  };
}

/**
 * Safely extracts human-readable clinical advice / notes.
 * Recursively unwraps JSON objects, parses strings, and discards empty/container JSON.
 */
function extractCleanAdvice(val) {
  if (!val) return "";
  if (typeof val === "object") {
    return extractCleanAdvice(val.advice || val.clinical_notes || "");
  }
  let str = String(val).trim();
  while (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.slice(1, -1).trim();
  }
  if (str.startsWith("{") || str.startsWith("[")) {
    try {
      const obj = JSON.parse(str);
      return extractCleanAdvice(obj.advice || obj.clinical_notes || "");
    } catch (e) {
      return "";
    }
  }
  return str.replace(/_/g, " ");
}

/**
 * Parses raw prescription string/JSON into clean structured object.
 */
function parseStructuredPrescription(rawRx, defaultDiagnosis = "") {
  if (!rawRx) {
    return {
      diagnosis: defaultDiagnosis || "General Consultation",
      medicines: [],
      lab_tests: "",
      advice: "",
      follow_up: "",
      doctor_name: "",
    };
  }

  if (typeof rawRx === "object" && rawRx !== null) {
    return {
      diagnosis: rawRx.diagnosis || defaultDiagnosis || "General Consultation",
      medicines: Array.isArray(rawRx.medicines) ? rawRx.medicines : [],
      lab_tests: rawRx.lab_tests || rawRx.lab_tests_json || "",
      advice: extractCleanAdvice(rawRx.advice || rawRx.clinical_notes || ""),
      follow_up: rawRx.follow_up || "",
      doctor_name: rawRx.doctor_name || "",
      prescribed_at: rawRx.prescribed_at || null,
    };
  }

  try {
    const parsed = JSON.parse(rawRx);
    return parseStructuredPrescription(parsed, defaultDiagnosis);
  } catch (e) {
    return {
      diagnosis: defaultDiagnosis || "General Consultation",
      medicines: [],
      lab_tests: "",
      advice: extractCleanAdvice(rawRx),
      follow_up: "",
      doctor_name: "",
    };
  }
}

/**
 * 2. Patient History Summary
 * Aggregates visit counts, first visit, last visit, and chronic conditions.
 */
async function getPatientHistorySummary(patientId, hospitalId = null) {
  const pId = parseInt(patientId, 10);
  if (isNaN(pId)) {
    return { total_visits: 0, first_visit: null, last_visit: null, last_department: null, last_doctor: null, past_diagnoses: [] };
  }

  const targetHid = hospitalId ? await resolveHospitalId(hospitalId) : null;
  const whereScope = {
    patient_id: pId,
    status: { in: ["completed", "serving", "transferred", "checked_in"] },
    ...(targetHid ? { hospital_id: targetHid } : {}),
  };

  const completedTickets = await prisma.tickets.findMany({
    where: whereScope,
    orderBy: { created_at: "desc" },
    take: 50,
    select: {
      ticket_id: true,
      service_category: true,
      medical_condition: true,
      created_at: true,
      serve_end_time: true,
      prescription_notes: true,
    },
  });

  const totalVisits = completedTickets.length;
  if (totalVisits === 0) {
    return {
      total_visits: 0,
      first_visit: null,
      last_visit: null,
      last_department: null,
      last_doctor: null,
      past_diagnoses: [],
    };
  }

  const lastVisitTkt = completedTickets[0];
  const firstVisitTkt = completedTickets[completedTickets.length - 1];

  let lastDocName = "Dr. OPD Desk";
  const lastRx = parseStructuredPrescription(lastVisitTkt.prescription_notes);
  if (lastRx.doctor_name) lastDocName = lastRx.doctor_name;

  const diagnosesSet = new Set();
  completedTickets.forEach((t) => {
    if (t.medical_condition && t.medical_condition !== "general_checkup") {
      diagnosesSet.add(t.medical_condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    }
    const rx = parseStructuredPrescription(t.prescription_notes);
    if (rx.diagnosis && rx.diagnosis !== "General Consultation") {
      diagnosesSet.add(rx.diagnosis);
    }
  });

  return {
    total_visits: totalVisits,
    first_visit: firstVisitTkt.created_at ? firstVisitTkt.created_at.toISOString().split("T")[0] : null,
    last_visit: lastVisitTkt.created_at ? lastVisitTkt.created_at.toISOString().split("T")[0] : null,
    last_department: lastVisitTkt.service_category || "General OPD",
    last_doctor: lastDocName,
    past_diagnoses: Array.from(diagnosesSet).slice(0, 5),
  };
}

/**
 * 3. Chronological Visit History (Paginated & Filtered)
 */
async function getPatientVisitHistory(patientId, hospitalId = null, options = {}) {
  const pId = parseInt(patientId, 10);
  if (isNaN(pId)) return { visits: [], total: 0, page: 1, limit: 10 };

  const targetHid = hospitalId ? await resolveHospitalId(hospitalId) : null;
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.min(50, Math.max(1, parseInt(options.limit || 5, 10)));
  const skip = (page - 1) * limit;

  const whereScope = {
    patient_id: pId,
    status: { notIn: ["cancelled", "no_show", "expired"] },
    ...(targetHid ? { hospital_id: targetHid } : {}),
  };

  if (options.department && options.department !== "all") {
    whereScope.service_category = { contains: options.department, mode: "insensitive" };
  }

  // Query tickets as primary source of historical visits
  const [tickets, totalCount] = await Promise.all([
    prisma.tickets.findMany({
      where: whereScope,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      include: {
        departments: { select: { id: true, name: true } },
        hospitals: { select: { id: true, name: true, hospital_code: true } },
      },
    }),
    prisma.tickets.count({ where: whereScope }),
  ]);

  const visits = tickets.map((t) => {
    const rx = parseStructuredPrescription(t.prescription_notes, t.medical_condition);
    const visitDate = t.created_at ? t.created_at.toISOString().split("T")[0] : null;

    return {
      visit_id: t.ticket_id,
      ticket_id: t.ticket_id,
      visit_date: visitDate,
      created_at: t.created_at,
      department: t.departments?.name || t.service_category || "General Consultation",
      hospital_name: t.hospitals?.name || "Hospital Facility",
      doctor_name: rx.doctor_name || "Dr. Staff Desk",
      diagnosis: rx.diagnosis || (t.medical_condition ? t.medical_condition.replace(/_/g, " ") : "Clinical Assessment"),
      clinical_notes: rx.advice || "",
      advice: rx.advice || "",
      status: t.status,
      prescription: {
        diagnosis: rx.diagnosis,
        medicines: rx.medicines,
        lab_tests: rx.lab_tests,
        advice: rx.advice,
        follow_up: rx.follow_up,
        prescribed_at: rx.prescribed_at || t.created_at,
      },
    };
  });

  return {
    visits,
    total: totalCount,
    page,
    limit,
    total_pages: Math.ceil(totalCount / limit),
  };
}

/**
 * 4. Prescriptions History
 */
async function getPatientPrescriptions(patientId, hospitalId = null, options = {}) {
  const pId = parseInt(patientId, 10);
  if (isNaN(pId)) return { prescriptions: [], total: 0 };

  const targetHid = hospitalId ? await resolveHospitalId(hospitalId) : null;
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.min(30, Math.max(1, parseInt(options.limit || 5, 10)));
  const skip = (page - 1) * limit;

  const whereScope = {
    patient_id: pId,
    prescription_notes: { not: "" },
    status: { notIn: ["cancelled", "no_show", "expired"] },
    ...(targetHid ? { hospital_id: targetHid } : {}),
  };

  const [tickets, totalCount] = await Promise.all([
    prisma.tickets.findMany({
      where: whereScope,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      include: {
        departments: { select: { id: true, name: true } },
      },
    }),
    prisma.tickets.count({ where: whereScope }),
  ]);

  const prescriptions = tickets.map((t) => {
    const rx = parseStructuredPrescription(t.prescription_notes, t.medical_condition);
    return {
      id: t.ticket_id,
      ticket_id: t.ticket_id,
      prescribed_at: rx.prescribed_at || t.created_at,
      department: t.departments?.name || t.service_category || "General Consultation",
      doctor_name: rx.doctor_name || "Dr. Staff Desk",
      diagnosis: rx.diagnosis,
      medicines: rx.medicines,
      lab_tests: rx.lab_tests,
      advice: rx.advice,
      follow_up: rx.follow_up,
    };
  });

  return {
    prescriptions,
    total: totalCount,
    page,
    limit,
    total_pages: Math.ceil(totalCount / limit),
  };
}

/**
 * 5. Diagnostic / Medical Reports (Lab, Radiology, Vitals)
 */
async function getPatientReports(patientId, hospitalId = null, options = {}) {
  const pId = parseInt(patientId, 10);
  if (isNaN(pId)) return { reports: [], total: 0 };

  const targetHid = hospitalId ? await resolveHospitalId(hospitalId) : null;

  // Retrieve lab tests prescribed or completed
  const ticketsWithTests = await prisma.tickets.findMany({
    where: {
      patient_id: pId,
      status: { notIn: ["cancelled", "no_show", "expired"] },
      ...(targetHid ? { hospital_id: targetHid } : {}),
    },
    orderBy: { created_at: "desc" },
    take: 20,
    select: {
      ticket_id: true,
      service_category: true,
      medical_condition: true,
      created_at: true,
      prescription_notes: true,
    },
  });

  const reports = [];
  ticketsWithTests.forEach((t) => {
    const rx = parseStructuredPrescription(t.prescription_notes);
    const dateStr = t.created_at ? t.created_at.toISOString().split("T")[0] : "Recent";

    if (rx.lab_tests && rx.lab_tests.trim() !== "") {
      const tests = String(rx.lab_tests).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      tests.forEach((testName) => {
        reports.push({
          id: `rep-${t.ticket_id}-${testName.slice(0, 10)}`,
          ticket_id: t.ticket_id,
          report_name: testName,
          report_type: testName.toLowerCase().includes("x-ray") || testName.toLowerCase().includes("scan") ? "Radiology / Imaging" : "Pathology / Lab Test",
          report_date: dateStr,
          status: "Verified & Uploaded",
          doctor_name: rx.doctor_name || "Hospital Clinical Lab",
          url: "#",
        });
      });
    }

    if (t.service_category === "laboratory" || t.service_category === "radiology") {
      reports.push({
        id: `diag-${t.ticket_id}`,
        ticket_id: t.ticket_id,
        report_name: t.medical_condition ? t.medical_condition.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Diagnostic Assay",
        report_type: t.service_category === "radiology" ? "Radiology / Imaging" : "Pathology / Lab Test",
        report_date: dateStr,
        status: "Completed",
        doctor_name: "Diagnostic Services",
        url: "#",
      });
    }
  });

  return {
    reports,
    total: reports.length,
  };
}

/**
 * 6. Composite Complete Patient Medical History API (For Doctor & Patient Views)
 */
async function getFullPatientMedicalHistory({ patient_id, ticket_id, user_id, phone, hospital_id, page = 1, limit = 5 }) {
  const identity = await findPatientIdentity({
    patient_id,
    ticket_id,
    user_id,
    phone,
    hospital_id,
  });

  if (!identity.patient_id) {
    return {
      status: "success",
      patient: null,
      is_returning_patient: false,
      summary: { total_visits: 0, first_visit: null, last_visit: null, past_diagnoses: [] },
      visits: [],
      prescriptions: [],
      reports: [],
    };
  }

  const hid = hospital_id ? await resolveHospitalId(hospital_id) : null;

  const [summary, visitsData, prescriptionsData, reportsData] = await Promise.all([
    getPatientHistorySummary(identity.patient_id, hid),
    getPatientVisitHistory(identity.patient_id, hid, { page, limit }),
    getPatientPrescriptions(identity.patient_id, hid, { limit: 5 }),
    getPatientReports(identity.patient_id, hid),
  ]);

  return {
    status: "success",
    patient: {
      patient_id: identity.patient_id,
      medical_id: identity.medical_id,
      name: identity.name,
      phone: identity.phone,
      gender: identity.gender,
      age: identity.age,
      is_returning_patient: summary.total_visits > 1,
      total_visits: summary.total_visits,
    },
    summary,
    visits: visitsData.visits,
    pagination: {
      page: visitsData.page,
      limit: visitsData.limit,
      total: visitsData.total,
      total_pages: visitsData.total_pages,
    },
    prescriptions: prescriptionsData.prescriptions,
    reports: reportsData.reports,
  };
}

/**
 * 7. Idempotent Visit History Record Writer
 * Called when a ticket is completed or prescription saved.
 */
async function recordCompletedVisit({
  hospital_id,
  ticket_id,
  appointment_id = null,
  patient_id = null,
  doctor_id = null,
  doctor_name = "Dr. Staff Desk",
  department_id = null,
  department_name = "General OPD",
  diagnosis = "",
  clinical_notes = "",
  advice = "",
  medicines = [],
  lab_tests = "",
  follow_up = "",
}) {
  if (!ticket_id) return null;
  const hid = await resolveHospitalId(hospital_id);

  // If patient_id or existing prescription not provided, look up from ticket
  let pId = patient_id;
  let existingRx = {};
  const tkt = await prisma.tickets.findUnique({
    where: { ticket_id: String(ticket_id).trim() },
    select: { patient_id: true, prescription_notes: true, medical_condition: true, served_by_doctor_name: true },
  });
  if (tkt) {
    if (!pId) pId = tkt.patient_id;
    if (tkt.prescription_notes) {
      try {
        const parsed = JSON.parse(tkt.prescription_notes);
        if (parsed && typeof parsed === "object") existingRx = parsed;
      } catch (e) {}
    }
  }

  if (!pId) return null;

  const resolvedMedicines = (Array.isArray(medicines) && medicines.length > 0)
    ? medicines
    : (Array.isArray(existingRx.medicines) ? existingRx.medicines : []);
  const resolvedDiag = diagnosis || existingRx.diagnosis || tkt?.medical_condition || "Consultation Completed";
  const resolvedDoc = (doctor_name && doctor_name !== "Dr. Staff Desk")
    ? doctor_name
    : (existingRx.doctor_name || tkt?.served_by_doctor_name || doctor_name || "Attending Doctor");
  const resolvedAdvice = extractCleanAdvice(advice || clinical_notes || existingRx.advice || existingRx.clinical_notes || "");
  const resolvedLab = lab_tests || existingRx.lab_tests || "";
  const resolvedFollowUp = follow_up || existingRx.follow_up || "";

  // Build prescription payload
  const prescriptionPayload = {
    ...existingRx,
    doctor_name: resolvedDoc,
    diagnosis: resolvedDiag,
    medicines: resolvedMedicines,
    lab_tests: resolvedLab,
    advice: resolvedAdvice,
    follow_up: resolvedFollowUp,
    prescribed_at: existingRx.prescribed_at || new Date().toISOString(),
  };

  // Update ticket with structured notes
  await prisma.tickets.update({
    where: { ticket_id: String(ticket_id).trim() },
    data: {
      prescription_notes: JSON.stringify(prescriptionPayload),
      updated_at: new Date(),
    },
  }).catch(() => {});

  return {
    success: true,
    ticket_id,
    patient_id: pId,
    hospital_id: hid,
    prescription: prescriptionPayload,
  };
}

module.exports = {
  normalizePhone,
  resolveHospitalId,
  findPatientIdentity,
  getPatientHistorySummary,
  getPatientVisitHistory,
  getPatientPrescriptions,
  getPatientReports,
  getFullPatientMedicalHistory,
  recordCompletedVisit,
  parseStructuredPrescription,
};
