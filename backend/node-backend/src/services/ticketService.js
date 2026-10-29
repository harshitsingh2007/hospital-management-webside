/**
 * ticketService.js
 * ----------------
 * Full Ticket Lifecycle Management: Join, Serve, Complete, Transfer, Cancel, Adjust.
 */

const prisma = require("../config/prisma");
const engine = require("./queueEngine");
const { getCurrentQueueDate, parseQueueDate, queueDateToPrismaDate, dtToEpoch } = require("../utils/timezone");
const {
  computeClinicalComplexity,
  PRIORITY_ROUTINE,
  PRIORITY_EMERGENCY,
  PRIORITY_STANDARD,
  MAX_PATIENT_QUEUE_ADJUSTMENT,
} = require("../utils/clinicalComplexity");
const { predictServiceDuration } = require("./aiService");

/**
 * Doctor Duty Status Store (In-Memory & Sync Cache).
 * Statuses: "ACTIVE" | "ON_BREAK" | "EMERGENCY_ROUND" | "OFF_DUTY"
 */
const doctorDutyStatusStore = new Map();

function getDoctorDutyStatus(docId, docEmail, docCode, docName) {
  if (docId && doctorDutyStatusStore.has(String(docId))) {
    return doctorDutyStatusStore.get(String(docId));
  }
  if (docEmail && doctorDutyStatusStore.has(String(docEmail).trim().toLowerCase())) {
    return doctorDutyStatusStore.get(String(docEmail).trim().toLowerCase());
  }
  if (docCode && doctorDutyStatusStore.has(String(docCode).trim().toLowerCase())) {
    return doctorDutyStatusStore.get(String(docCode).trim().toLowerCase());
  }
  if (docName && doctorDutyStatusStore.has(String(docName).trim().toLowerCase())) {
    return doctorDutyStatusStore.get(String(docName).trim().toLowerCase());
  }
  // Return null when no status has been set — do NOT default to ACTIVE
  return null;
}


async function setDoctorDutyStatus(docIdentifier, statusData = {}) {
  const status = String(statusData.status || "ACTIVE").toUpperCase();
  const validStatuses = ["ACTIVE", "PROCESSING", "ON_BREAK", "EMERGENCY_ROUND", "OFF_DUTY", "SHIFT_ENDED"];
  const finalStatus = validStatuses.includes(status) ? status : "ACTIVE";

  const existing = getDoctorDutyStatus(docIdentifier, docIdentifier);
  const isStatusChanging = existing ? existing.status !== finalStatus : true;

  const record = {
    status: finalStatus,
    status_changed_at: (existing && !isStatusChanging) ? (existing.status_changed_at || Date.now()) : Date.now(),
    break_type: statusData.break_type || null,
    note: statusData.note || "",
    doctor_name: statusData.doctor_name || statusData.staff_name || statusData.name || (existing && existing.doctor_name) || "",
    updated_at: Date.now(),
  };

  const key = String(docIdentifier).trim().toLowerCase();
  doctorDutyStatusStore.set(key, record);
  if (statusData.userId) doctorDutyStatusStore.set(String(statusData.userId), record);
  if (statusData.user_id) doctorDutyStatusStore.set(String(statusData.user_id), record);
  if (statusData.employeeId) doctorDutyStatusStore.set(String(statusData.employeeId), record);
  if (statusData.employee_id) doctorDutyStatusStore.set(String(statusData.employee_id), record);
  if (statusData.employeeCode) doctorDutyStatusStore.set(String(statusData.employeeCode).trim().toLowerCase(), record);
  if (statusData.employee_code) doctorDutyStatusStore.set(String(statusData.employee_code).trim().toLowerCase(), record);
  if (statusData.email) doctorDutyStatusStore.set(String(statusData.email).trim().toLowerCase(), record);
  if (statusData.doctor_email) doctorDutyStatusStore.set(String(statusData.doctor_email).trim().toLowerCase(), record);
  if (statusData.staff_email) doctorDutyStatusStore.set(String(statusData.staff_email).trim().toLowerCase(), record);
  if (statusData.doctor_name) doctorDutyStatusStore.set(String(statusData.doctor_name).trim().toLowerCase(), record);
  if (statusData.staff_name) doctorDutyStatusStore.set(String(statusData.staff_name).trim().toLowerCase(), record);
  if (statusData.name) doctorDutyStatusStore.set(String(statusData.name).trim().toLowerCase(), record);

  // Persist status to employees table in DB so all services and restarts stay in sync
  try {
    const targetEmail = statusData.email || statusData.doctor_email || statusData.staff_email || (String(docIdentifier).includes("@") ? String(docIdentifier).trim().toLowerCase() : null);
    const targetUserId = statusData.userId || statusData.user_id || (!isNaN(Number(docIdentifier)) ? Number(docIdentifier) : null);
    const targetEmpId = statusData.employeeId || statusData.employee_id || (!isNaN(Number(docIdentifier)) ? Number(docIdentifier) : null);
    const targetEmpCode = statusData.employeeCode || statusData.employee_code || (isNaN(Number(docIdentifier)) && !String(docIdentifier).includes("@") ? String(docIdentifier).trim() : null);
    const targetName = statusData.doctor_name || statusData.staff_name || statusData.name || null;

    const empStatus = (finalStatus === "OFF_DUTY" || finalStatus === "SHIFT_ENDED") ? "off_duty" : (finalStatus === "ACTIVE" ? "active" : finalStatus.toLowerCase());

    const orClauses = [];
    if (targetEmail) orClauses.push({ email: targetEmail });
    if (targetUserId) orClauses.push({ user_id: targetUserId });
    if (targetEmpId) orClauses.push({ id: targetEmpId });
    if (targetEmpCode) orClauses.push({ employee_code: targetEmpCode });
    if (targetName) orClauses.push({ name: targetName });

    if (orClauses.length > 0) {
      await prisma.employees.updateMany({
        where: { OR: orClauses },
        data: {
          status: empStatus,
          updated_at: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("[setDoctorDutyStatus] DB persistence warning:", err.message);
  }

  return record;
}

/**
 * Persists ticket state to PostgreSQL and synchronizes linked appointments.
 */
async function saveTicketToDb(ticket) {
  const qDateStr = parseQueueDate(ticket.queue_date);
  const qDateObj = queueDateToPrismaDate(qDateStr);
  const joinDt = new Date(ticket.join_timestamp * 1000);
  const effDt = new Date((ticket.effective_timestamp || ticket.join_timestamp) * 1000);
  const startDt = ticket.serve_start_time ? new Date(ticket.serve_start_time * 1000) : null;
  const endDt = ticket.serve_end_time ? new Date(ticket.serve_end_time * 1000) : null;
  const lastAdjDt = ticket.last_adjusted_at ? new Date(ticket.last_adjusted_at * 1000) : null;
  const cancDt = ticket.cancelled_at ? new Date(ticket.cancelled_at * 1000) : null;

  const hid = await engine.resolveHospitalId(ticket.tenant_id);
  const deptId = await engine.resolveDepartmentId(hid, ticket.service_category);

  let pid = ticket.explicit_patient_id;
  if (!pid) {
    pid = await engine.resolvePatientId(
      ticket.user_email,
      ticket.name,
      ticket.phone || "",
      ticket.gender || "other",
      ticket.age || 30
    );
  }

  await prisma.tickets.upsert({
    where: { ticket_id: ticket.ticket_id },
    create: {
      ticket_id: ticket.ticket_id,
      hospital_id: hid,
      department_id: deptId,
      patient_id: pid,
      appointment_id: ticket.appointment_id || null,
      consumer_type: ticket.consumer_type || "hospital",
      service_category: ticket.service_category,
      name: ticket.name,
      priority_level: ticket.priority_level || 2,
      queue_date: qDateObj,
      join_timestamp: joinDt,
      status: ticket.status || "waiting",
      predicted_service_minutes: ticket.predicted_service_minutes || 10.0,
      estimated_wait_minutes: ticket.estimated_wait_minutes || 0.0,
      position: ticket.position || 0,
      serve_start_time: startDt,
      serve_end_time: endDt,
      actual_service_minutes: ticket.actual_service_minutes || null,
      medical_condition: ticket.medical_condition || "general_checkup",
      pre_existing_condition: ticket.pre_existing_condition || "none",
      complexity_score: ticket.complexity_score || 1.0,
      prescription_notes: ticket.prescription_notes || "",
      parent_ticket_id: ticket.parent_ticket_id || "",
      transferred_from_dept: ticket.transferred_from_dept || "",
      source: "patient_portal",
      effective_timestamp: effDt,
      adjustment_count: ticket.adjustment_count || 0,
      last_adjusted_at: lastAdjDt,
      cancellation_reason: ticket.cancellation_reason || "",
      cancelled_at: cancDt,
    },
    update: {
      hospital_id: hid,
      department_id: deptId,
      patient_id: pid,
      appointment_id: ticket.appointment_id || null,
      consumer_type: ticket.consumer_type || "hospital",
      service_category: ticket.service_category,
      name: ticket.name,
      priority_level: ticket.priority_level || 2,
      queue_date: qDateObj,
      status: ticket.status,
      predicted_service_minutes: ticket.predicted_service_minutes || 10.0,
      estimated_wait_minutes: ticket.estimated_wait_minutes || 0.0,
      position: ticket.position || 0,
      serve_start_time: startDt,
      serve_end_time: endDt,
      actual_service_minutes: ticket.actual_service_minutes || null,
      prescription_notes: ticket.prescription_notes || "",
      transferred_from_dept: ticket.transferred_from_dept || "",
      effective_timestamp: effDt,
      adjustment_count: ticket.adjustment_count || 0,
      last_adjusted_at: lastAdjDt,
      cancellation_reason: ticket.cancellation_reason || "",
      cancelled_at: cancDt,
      updated_at: new Date(),
    },
  });

  // Sync linked appointments status if any (transferred tickets stay active in target dept)
  if (["serving", "completed", "no_show", "cancelled", "expired"].includes(ticket.status)) {
    await prisma.appointments.updateMany({
      where: {
        OR: [
          { ticket_id: ticket.ticket_id },
          ...(ticket.parent_ticket_id ? [{ ticket_id: ticket.parent_ticket_id }] : []),
        ],
      },
      data: {
        status: ticket.status,
        updated_at: new Date(),
      },
    });
  }
}

/**
 * Records completed clinical encounter in `service_logs` for ML training.
 */
async function logCompletedService(ticket, queueLength, activeCounters) {
  const joinDt = new Date(ticket.join_timestamp * 1000);
  const hour = joinDt.getUTCHours();
  const day = joinDt.getUTCDay();
  const isPeak = [9, 10, 11, 14, 15, 16].includes(hour) && day > 0 && day < 6 ? 1 : 0;
  const qDateStr = parseQueueDate(ticket.queue_date);

  const hid = await engine.resolveHospitalId(ticket.tenant_id);
  const deptId = await engine.resolveDepartmentId(hid, ticket.service_category);

  await prisma.service_logs.create({
    data: {
      hospital_id: hid,
      ticket_id: ticket.ticket_id,
      department_id: deptId,
      consumer_type: ticket.consumer_type || "hospital",
      service_category: ticket.service_category,
      queue_date: queueDateToPrismaDate(qDateStr),
      hour_of_day: hour,
      day_of_week: day,
      queue_length: queueLength,
      active_staff_counters: activeCounters,
      is_peak_hour: isPeak,
      complexity_score: ticket.complexity_score || 1.0,
      historical_avg_speed: 15.0,
      service_duration_minutes: ticket.actual_service_minutes || ticket.predicted_service_minutes || 10.0,
    },
  });
}

/**
 * Join Queue: Generates ticket, requests AI prediction, enqueues in Min-Heap, logs event.
 */
async function joinQueue({
  tenantId = "city-hospital-01",
  consumerType = "hospital",
  serviceCategory = "consultation",
  name = "Patient",
  phone = "",
  priorityLevel = PRIORITY_ROUTINE,
  userEmail = "",
  age = 30,
  gender = "other",
  medicalCondition = "general_checkup",
  preExistingCondition = "none",
  patientId = null,
  familyMemberId = null,
  queueDate = null,
  appointmentId = null,
  status = "waiting",
}) {
  const cleanCat = String(serviceCategory || "consultation").trim().toLowerCase();
  if (cleanCat === "pharmacy") {
    const err = new Error(
      "Direct walk-in registration for Pharmacy & Medicine is not permitted. Please register for General Consultation (OPD) or a clinical clinic. The doctor will route your token to the Pharmacy once medicines are prescribed."
    );
    err.status = 400;
    throw err;
  }

  const tenant = engine._getTenant(tenantId);
  const now = Date.now() / 1000.0;
  const ticketId = engine.generateTicketId();
  const qDateStr = parseQueueDate(queueDate);
  const today = getCurrentQueueDate();
  const isTodayActive = qDateStr === today && status === "waiting";

  const complexity = computeClinicalComplexity(
    age,
    gender,
    medicalCondition,
    preExistingCondition,
    priorityLevel
  );

  const dtNow = new Date();
  const predictedService = await predictServiceDuration({
    tenantId,
    consumerType,
    serviceCategory,
    queueLength: isTodayActive ? tenant.queue.size() + 1 : 1,
    activeStaffCounters: tenant.active_counters || 2,
    complexityScore: complexity,
    hourOfDay: dtNow.getHours(),
    dayOfWeek: dtNow.getDay(),
  });

  const initialPos = isTodayActive ? tenant.queue.size() + 1 : 0;

  const ticket = {
    ticket_id: ticketId,
    tenant_id: tenantId,
    consumer_type: consumerType,
    service_category: serviceCategory,
    name: name,
    phone: phone || "",
    priority_level: priorityLevel,
    join_timestamp: now,
    queue_date: qDateStr,
    appointment_id: appointmentId,
    effective_timestamp: now,
    user_email: userEmail,
      family_member_id: familyMemberId || null,
      age: parseInt(age, 10) || 30,
      gender: gender || "other",
      medical_condition: medicalCondition || "general_checkup",
      pre_existing_condition: preExistingCondition || "none",
      complexity_score: complexity,
      predicted_service_minutes: predictedService,
      estimated_wait_minutes: 0.0,
      status: status,
      position: isTodayActive ? initialPos : 0,
      explicit_patient_id: patientId,
      adjustment_count: 0,
      cancellation_reason: "",
      serve_start_time: null,
      serve_end_time: null,
      actual_service_minutes: null,
    };

  if (isTodayActive) {
    tenant.tickets.set(ticketId, ticket);
    tenant.queue.push([priorityLevel, now, ticketId]);
  }

  // Persist to PostgreSQL
  await saveTicketToDb(ticket);

  const hid = await engine.resolveHospitalId(tenantId);
  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: ticketId,
    eventType: isTodayActive ? "QUEUE_JOINED" : "SCHEDULED",
    oldStatus: null,
    newStatus: status,
    oldPosition: null,
    newPosition: ticket.position,
    metadata: { complexity, predicted_service: predictedService, queue_date: qDateStr },
  });

  if (isTodayActive) {
    await engine.recalculateWaitTimes(tenantId);
  }

  return ticket;
}

/**
 * Serve Next: Department-scoped priority queue serving.
 * STRICT CLINICAL RULE: A doctor can ONLY serve one patient at a time.
 */
async function serveNext(tenantId, department = null, deskId = null, doctorInfo = null) {
  let actualDept = department;
  let actualDeskId = deskId;
  let actualDocInfo = doctorInfo;

  // Support both (tenantId, dept, deskId, doctorInfo) and (tenantId, { dept, deskId, docId, ... })
  if (department && typeof department === "object") {
    actualDept = department.department || department.service_category || department.filterDept || null;
    actualDeskId = department.deskId !== undefined ? department.deskId : (department.desk_id !== undefined ? department.desk_id : deskId);
    actualDocInfo = department.doctorInfo || department.doctor || {
      id: department.docId || department.doctor_id || department.id || null,
      name: department.docName || department.doctor_name || department.name || null,
      email: department.docEmail || department.doctor_email || department.email || null,
    };
  }

  const tenant = engine._getTenant(tenantId);
  const now = Date.now() / 1000.0;
  const filterDept = String(actualDept || "").trim().toLowerCase();
  const today = getCurrentQueueDate();

  // Helper to match department/service categories with support for aliases (e.g. pathology <-> laboratory)
  const isDeptMatch = (ticketCat, requestedDept) => {
    if (!requestedDept || requestedDept === "all") return true;
    const req = String(requestedDept).trim().toLowerCase();
    const cat = String(ticketCat || "").trim().toLowerCase();
    if (req === cat) return true;
    const isLab = (d) => ["pathology", "laboratory", "lab", "pathology_lab", "diagnostic", "diagnostics"].includes(d);
    if (isLab(req) && isLab(cat)) return true;
    const isPharma = (d) => ["pharmacy", "pharma", "dispensary"].includes(d);
    if (isPharma(req) && isPharma(cat)) return true;
    return false;
  };

  // Normalize doctor info
  let docId = null;
  let docName = null;
  let docEmail = null;
  if (actualDocInfo) {
    if (typeof actualDocInfo === "object") {
      docId = actualDocInfo.id || actualDocInfo.doctor_id || null;
      docName = actualDocInfo.name || actualDocInfo.doctor_name || null;
      docEmail = actualDocInfo.email || actualDocInfo.doctor_email || null;
    } else {
      docId = String(actualDocInfo);
    }
  }
  deskId = actualDeskId;

  // 1. HOSPITAL ISOLATION & DOCTOR/DESK AVAILABILITY ENFORCEMENT
  const hid = await engine.resolveHospitalId(tenantId);
  const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12-hour session window
  let assignedEmp = null;
  let assignedUsr = null;

  // 1a. If Desk is specified, enforce desk active status, assigned doctor active presence & hospital isolation
  if (deskId) {
    const dId = parseInt(deskId, 10);
    const deskRec = await prisma.desks.findUnique({
      where: { id: dId },
      include: {
        employees: { include: { users: true } },
        departments: true,
      },
    });

    if (!deskRec) {
      const err = new Error(`Desk #${deskId} not found.`);
      err.status = 404;
      err.code = "DESK_NOT_FOUND";
      throw err;
    }

    // Hospital Isolation Check:
    if (deskRec.hospital_id !== hid) {
      const err = new Error(
        `Hospital Isolation Violation: Desk #${deskId} does not belong to hospital '${tenantId}'. Cross-hospital patient assignment is strictly prohibited.`
      );
      err.status = 403;
      err.code = "HOSPITAL_ISOLATION_VIOLATION";
      throw err;
    }

    // Desk Active Status Check:
    const deskSt = (deskRec.status || "").toUpperCase();
    if (deskSt === "INACTIVE" || deskRec.status === "inactive" || deskRec.is_active === false) {
      const err = new Error(
        `Cannot assign patient: Desk #${deskId} ('${deskRec.desk_name}') is currently INACTIVE / CLOSED.`
      );
      err.status = 409;
      err.code = "DESK_INACTIVE";
      throw err;
    }

    // Assigned Doctor Check:
    if (!deskRec.assigned_employee_id || !deskRec.employees) {
      const err = new Error(
        `Cannot call patient to Desk #${deskId} ('${deskRec.desk_name}'): No doctor is currently assigned to this desk. Please assign an active doctor in the portal first.`
      );
      err.status = 409;
      err.code = "DESK_UNASSIGNED";
      throw err;
    }

    // Doctor Availability Enforcement:
    assignedEmp = deskRec.employees;
    assignedUsr = assignedEmp.users;
    const lastLogin = assignedUsr?.last_login_at ? new Date(assignedUsr.last_login_at).getTime() : null;
    const isStale = !lastLogin || (Date.now() - lastLogin > SESSION_MAX_AGE_MS);
    const isDocActive = (assignedEmp.status === "active" && assignedUsr?.status === "active" && !isStale);

    if (!isDocActive) {
      const err = new Error(
        `Cannot assign patient: Doctor '${assignedEmp.name}' assigned to Desk #${deskId} ('${deskRec.desk_name}') is currently INACTIVE / OFFLINE. Doctor must be actively logged in before receiving new patient assignments.`
      );
      err.status = 409;
      err.code = "DOCTOR_INACTIVE";
      throw err;
    }

    // Auto-propagate doctor details from verified active desk
    if (!docId) docId = assignedEmp.user_id || assignedEmp.id;
    if (!docName) docName = assignedEmp.name;
    if (!docEmail) docEmail = assignedEmp.email || assignedUsr?.email;
  }

  // 1b. If Doctor is directly specified, enforce doctor active status & hospital isolation
  if (docId || docEmail) {
    const empRec = await prisma.employees.findFirst({
      where: {
        hospital_id: hid,
        OR: [
          ...(docId ? [{ id: parseInt(docId, 10) || -1 }, { user_id: parseInt(docId, 10) || -1 }] : []),
          ...(docEmail ? [{ email: String(docEmail).trim().toLowerCase() }] : []),
        ],
      },
      include: { users: true },
    });

    if (!empRec) {
      // Check cross-hospital breach
      const crossEmp = await prisma.employees.findFirst({
        where: {
          OR: [
            ...(docId ? [{ id: parseInt(docId, 10) || -1 }, { user_id: parseInt(docId, 10) || -1 }] : []),
            ...(docEmail ? [{ email: String(docEmail).trim().toLowerCase() }] : []),
          ],
        },
        include: { hospitals: true },
      });
      if (crossEmp) {
        const err = new Error(
          `Hospital Isolation Violation: Doctor '${crossEmp.name}' belongs to hospital '${crossEmp.hospitals?.name || crossEmp.hospital_id}', not '${tenantId}'. Cross-hospital patient assignment is strictly prohibited.`
        );
        err.status = 403;
        err.code = "HOSPITAL_ISOLATION_VIOLATION";
        throw err;
      }
    } else {
      // Check DOCTOR DUTY STATUS ENFORCEMENT first (Active vs On Break / Emergency Round / Off Duty)
      const dutyDocId = docId || empRec.user_id || empRec.id;
      const dutyDocEmail = docEmail || empRec.email || empRec.users?.email;
      const dutyStatusInfo = getDoctorDutyStatus(dutyDocId, dutyDocEmail);

      if (dutyStatusInfo && dutyStatusInfo.status && dutyStatusInfo.status !== "ACTIVE" && dutyStatusInfo.status !== "PROCESSING") {
        const statusLabels = {
          ON_BREAK: "on Tea / Lunch Break",
          EMERGENCY_ROUND: "on Emergency / ICU Round",
          OFF_DUTY: "Off Duty (Shift Ended)",
          SHIFT_ENDED: "Off Duty (Shift Ended)",
        };
        const label = statusLabels[dutyStatusInfo.status] || dutyStatusInfo.status;
        const err = new Error(
          `Cannot assign patient: Staff member '${docName || empRec.name || "Desk Staff"}' is currently ${label}. Please switch duty status to 'Active' before calling patients.`
        );
        err.status = 409;
        err.code = (dutyStatusInfo.status === "OFF_DUTY" || dutyStatusInfo.status === "SHIFT_ENDED") ? "DOCTOR_OFF_DUTY" : "DOCTOR_ON_BREAK";
        err.duty_status = dutyStatusInfo.status;
        err.status_changed_at = dutyStatusInfo.status_changed_at;
        throw err;
      }

      const usr = empRec.users;
      const lastLogin = usr?.last_login_at ? new Date(usr.last_login_at).getTime() : null;
      const isStale = !lastLogin || (Date.now() - lastLogin > SESSION_MAX_AGE_MS);
      const isOnline = ["active", "processing", "on_break", "emergency_round"].includes(empRec.status) && usr?.status === "active" && !isStale;

      if (!isOnline) {
        const err = new Error(
          `Cannot assign patient: Doctor '${empRec.name}' is currently INACTIVE / OFFLINE. Doctor must be actively logged in before receiving new patient assignments.`
        );
        err.status = 409;
        err.code = "DOCTOR_INACTIVE";
        throw err;
      }

      if (!docName) docName = empRec.name;
      if (!docEmail) docEmail = empRec.email || usr?.email;
    }
  }

  // 2. STRICT ENFORCEMENT: A doctor can only serve ONE patient at a time!
  if (docId || docEmail || docName) {
    const existingDoctorTicket = Array.from(tenant.tickets.values()).find(
      (t) =>
        t.status === "serving" &&
        parseQueueDate(t.queue_date) === today &&
        ((docId && t.served_by_doctor_id && String(t.served_by_doctor_id) === String(docId)) ||
         (docEmail && t.served_by_doctor_email && String(t.served_by_doctor_email).toLowerCase() === String(docEmail).toLowerCase()) ||
         (docName && t.served_by_doctor_name && String(t.served_by_doctor_name).trim().toLowerCase() === String(docName).trim().toLowerCase()))
    );

    if (existingDoctorTicket) {
      const err = new Error(
        `Doctor ${docName || docEmail || "Desk"} is currently serving patient #${existingDoctorTicket.ticket_id} (${existingDoctorTicket.name}). A doctor can only serve one patient at a time. Please complete the current consultation before calling the next patient.`
      );
      err.status = 409;
      err.code = "DOCTOR_ALREADY_SERVING";
      err.current_ticket = existingDoctorTicket;
      throw err;
    }
  }

  // 3. Desk enforcement: A desk can only serve one patient at a time
  if (deskId) {
    const existingDeskTicket = Array.from(tenant.tickets.values()).find(
      (t) =>
        t.status === "serving" &&
        parseQueueDate(t.queue_date) === today &&
        t.desk_id && String(t.desk_id) === String(deskId)
    );
    if (existingDeskTicket) {
      const err = new Error(
        `Desk #${deskId} is currently serving patient #${existingDeskTicket.ticket_id}. A desk can only serve one patient at a time. Complete the current consultation first.`
      );
      err.status = 409;
      err.code = "DESK_ALREADY_SERVING";
      err.current_ticket = existingDeskTicket;
      throw err;
    }
  }

  // 4. Department fallback: If no doctor/desk specified but active_counters reached
  if (!docId && !docEmail && !docName && !deskId && filterDept && filterDept !== "all") {
    const activeServing = Array.from(tenant.tickets.values()).filter(
      (t) =>
        t.status === "serving" &&
        parseQueueDate(t.queue_date) === today &&
        (isDeptMatch(t.service_category, filterDept) || isDeptMatch(t.department, filterDept))
    );
    const maxCounters = tenant.active_counters || 2;
    if (activeServing.length >= maxCounters) {
      const err = new Error(
        `All active doctor desks (${maxCounters}) for ${department} are currently serving patients. Please complete an active consultation first.`
      );
      err.status = 409;
      err.code = "MAX_SERVING_REACHED";
      err.current_ticket = activeServing[0];
      throw err;
    }
  }

  const tempPopped = [];
  let foundTicket = null;

  while (tenant.queue.size() > 0) {
    const item = tenant.queue.pop();
    const tid = item[2];
    const t = tenant.tickets.get(tid);

    if (!t || t.status !== "waiting") {
      continue;
    }

    if (parseQueueDate(t.queue_date) !== today) {
      continue;
    }

    if (filterDept && filterDept !== "all" && !isDeptMatch(t.service_category, filterDept) && !isDeptMatch(t.department, filterDept)) {
      tempPopped.push(item);
      continue;
    }

    foundTicket = t;
    break;
  }

  // Restore skipped tickets back into heap
  for (const item of tempPopped) {
    tenant.queue.push(item);
  }

  if (!foundTicket) {
    return null;
  }

  foundTicket.status = "serving";
  foundTicket.serve_start_time = now;
  foundTicket.position = 0;
  if (docId) foundTicket.served_by_doctor_id = docId;
  if (docName) foundTicket.served_by_doctor_name = docName;
  if (docEmail) foundTicket.served_by_doctor_email = docEmail;
  if (deskId) foundTicket.desk_id = deskId;

  await saveTicketToDb(foundTicket);

  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: foundTicket.ticket_id,
    eventType: "CALLED",
    oldStatus: "waiting",
    newStatus: "serving",
    oldPosition: 1,
    newPosition: 0,
    metadata: {
      desk_id: deskId,
      doctor_id: docId,
      doctor_name: docName,
      doctor_email: docEmail,
      queue_date: today,
    },
  });

  // If desk assigned, update desk status
  if (deskId) {
    await prisma.desks.update({
      where: { id: parseInt(deskId, 10) },
      data: {
        status: "BUSY",
        current_ticket_id: foundTicket.ticket_id,
        last_active_at: new Date(),
        updated_at: new Date(),
      },
    }).catch(() => {});
  }

  await engine.recalculateWaitTimes(tenantId);
  return foundTicket;
}

/**
 * Complete Ticket: Records encounter duration and writes to service_logs.
 */
async function completeTicket(tenantId, ticketId, department = null, prescriptionNotes = null) {
  const tenant = engine._getTenant(tenantId);
  let ticket = tenant.tickets.get(ticketId);

  if (!ticket) {
    const row = await prisma.tickets.findUnique({
      where: { ticket_id: ticketId },
    });
    if (row) {
      ticket = {
        ...row,
        join_timestamp: dtToEpoch(row.join_timestamp),
        effective_timestamp: dtToEpoch(row.effective_timestamp),
        serve_start_time: row.serve_start_time ? dtToEpoch(row.serve_start_time) : null,
        queue_date: parseQueueDate(row.queue_date),
      };
    }
  }

  if (!ticket) {
    return null;
  }

  if (prescriptionNotes) {
    try {
      let parsed = typeof prescriptionNotes === "object" ? prescriptionNotes : JSON.parse(prescriptionNotes);
      if (parsed && Array.isArray(parsed.medicines)) {
        parsed.medicines = parsed.medicines.map((m) => {
          const isExplicitlyGiven = m.dispensed === true || m.given === true ||
            String(m.dispense_status || "").toLowerCase() === "given" ||
            String(m.status || "").toLowerCase() === "dispensed";
          return {
            ...m,
            dispensed: isExplicitlyGiven,
            given: isExplicitlyGiven,
            dispense_status: isExplicitlyGiven ? "given" : "not_given",
            status: isExplicitlyGiven ? "dispensed" : "not_dispensed",
          };
        });
        prescriptionNotes = parsed;
      }
    } catch (_) {}
    ticket.prescription_notes = typeof prescriptionNotes === "object" ? JSON.stringify(prescriptionNotes) : String(prescriptionNotes);
  } else if (ticket.prescription_notes) {
    try {
      let parsed = JSON.parse(ticket.prescription_notes);
      if (parsed && Array.isArray(parsed.medicines)) {
        parsed.medicines = parsed.medicines.map((m) => {
          const isExplicitlyGiven = m.dispensed === true || m.given === true ||
            String(m.dispense_status || "").toLowerCase() === "given" ||
            String(m.status || "").toLowerCase() === "dispensed";
          return {
            ...m,
            dispensed: isExplicitlyGiven,
            given: isExplicitlyGiven,
            dispense_status: isExplicitlyGiven ? "given" : "not_given",
            status: isExplicitlyGiven ? "dispensed" : "not_dispensed",
          };
        });
        ticket.prescription_notes = JSON.stringify(parsed);
      }
    } catch (_) {}
  }

  ticket.status = "completed";
  ticket.serve_end_time = Date.now() / 1000.0;
  const start = ticket.serve_start_time || ticket.join_timestamp;
  ticket.actual_service_minutes = Math.round(((ticket.serve_end_time - start) / 60.0) * 10) / 10;

  await saveTicketToDb(ticket);
  await logCompletedService(ticket, tenant.queue.size(), tenant.active_counters || 2);

  const hid = await engine.resolveHospitalId(tenantId);
  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: ticket.ticket_id,
    eventType: "COMPLETED",
    oldStatus: "serving",
    newStatus: "completed",
    metadata: {
      service_minutes: ticket.actual_service_minutes,
      queue_date: ticket.queue_date || getCurrentQueueDate(),
      doctor_id: ticket.served_by_doctor_id || null,
      doctor_name: ticket.served_by_doctor_name || null,
      doctor_email: ticket.served_by_doctor_email || null,
      desk_id: ticket.desk_id || null,
    },
  });

  // Record permanent visit history (Idempotent)
  try {
    const { recordCompletedVisit } = require("./patientHistoryService");
    let rxData = {};
    if (prescriptionNotes) {
      if (typeof prescriptionNotes === "object") {
        rxData = prescriptionNotes;
      } else if (typeof prescriptionNotes === "string") {
        try {
          const parsed = JSON.parse(prescriptionNotes);
          if (parsed && typeof parsed === "object") rxData = parsed;
        } catch (e) {}
      }
    }
    if (!Object.keys(rxData).length && ticket.prescription_notes) {
      try {
        const parsed = JSON.parse(ticket.prescription_notes);
        if (parsed && typeof parsed === "object") rxData = parsed;
      } catch (e) {}
    }

    let cleanAdv = "";
    if (typeof rxData.advice === "string") {
      cleanAdv = rxData.advice.trim();
    } else if (typeof rxData.clinical_notes === "string") {
      cleanAdv = rxData.clinical_notes.trim();
    } else if (typeof prescriptionNotes === "string") {
      const trimmed = prescriptionNotes.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        cleanAdv = trimmed;
      }
    }

    while ((cleanAdv.startsWith('"') && cleanAdv.endsWith('"')) || (cleanAdv.startsWith("'") && cleanAdv.endsWith("'"))) {
      cleanAdv = cleanAdv.slice(1, -1).trim();
    }
    if (cleanAdv.startsWith("{") || cleanAdv.startsWith("[")) {
      try {
        const inner = JSON.parse(cleanAdv);
        cleanAdv = (inner && typeof inner.advice === "string") ? inner.advice.trim() : "";
      } catch (e) {
        cleanAdv = "";
      }
    }
    cleanAdv = cleanAdv.replace(/_/g, " ");

    await recordCompletedVisit({
      hospital_id: hid,
      ticket_id: ticket.ticket_id,
      patient_id: ticket.patient_id,
      diagnosis: rxData.diagnosis || ticket.medical_condition,
      doctor_name: (rxData.doctor_name && rxData.doctor_name !== "Dr. Staff Desk") ? rxData.doctor_name : (ticket.served_by_doctor_name || rxData.doctor_name || "Dr. Staff Desk"),
      department_name: ticket.service_category,
      medicines: Array.isArray(rxData.medicines) ? rxData.medicines : [],
      lab_tests: rxData.lab_tests || "",
      advice: cleanAdv,
      follow_up: rxData.follow_up || "",
    });
  } catch (err) {
    console.error("Visit history recording error (non-fatal):", err.message);
  }

  if (ticket.ticket_id) {
    await prisma.desks.updateMany({
      where: { current_ticket_id: ticket.ticket_id },
      data: {
        status: "AVAILABLE",
        current_ticket_id: "",
        updated_at: new Date(),
      },
    }).catch(() => {});
  }

  await engine.recalculateWaitTimes(tenantId);
  return ticket;
}

/**
 * Transfer Ticket: Completes current encounter and moves patient to target clinical department.
 */
async function transferTicket(tenantId, ticketId, targetDepartment, prescriptionNotes = "") {
  const tenant = engine._getTenant(tenantId);
  let origTicket = tenant.tickets.get(ticketId);

  if (!origTicket) {
    const row = await prisma.tickets.findUnique({
      where: { ticket_id: ticketId },
    });
    if (row) {
      origTicket = {
        ...row,
        join_timestamp: dtToEpoch(row.join_timestamp),
        effective_timestamp: dtToEpoch(row.effective_timestamp),
        serve_start_time: row.serve_start_time ? dtToEpoch(row.serve_start_time) : null,
        queue_date: parseQueueDate(row.queue_date),
      };
    }
  }

  if (!origTicket) {
    const err = new Error(`Ticket #${ticketId} not found.`);
    err.status = 404;
    throw err;
  }

  // 1. Complete original ticket
  origTicket.transferred_to_dept = targetDepartment;
  origTicket.status = "transferred";
  origTicket.serve_end_time = Date.now() / 1000.0;
  origTicket.actual_service_minutes =
    Math.round(
      ((origTicket.serve_end_time - (origTicket.serve_start_time || origTicket.join_timestamp)) / 60.0) * 10
    ) / 10;
  origTicket.prescription_notes = prescriptionNotes;
  await saveTicketToDb(origTicket);

  // 2. Create new transferred ticket
  const now = Date.now() / 1000.0;
  const newTid = engine.generateTicketId();
  const today = getCurrentQueueDate();
  const targetQDate = origTicket.queue_date || today;

  const newTicket = {
    ticket_id: newTid,
    tenant_id: tenantId,
    consumer_type: origTicket.consumer_type || "hospital",
    service_category: targetDepartment,
    name: origTicket.name,
    priority_level: origTicket.priority_level || 2,
    join_timestamp: now,
    queue_date: targetQDate,
    appointment_id: origTicket.appointment_id || "",
    effective_timestamp: now,
    user_email: origTicket.user_email || "",
    age: origTicket.age || 30,
    gender: origTicket.gender || "other",
    medical_condition: origTicket.medical_condition || "general_checkup",
    pre_existing_condition: origTicket.pre_existing_condition || "none",
    complexity_score: origTicket.complexity_score || 1.0,
    prescription_notes: prescriptionNotes,
    parent_ticket_id: origTicket.ticket_id,
    transferred_from_dept: origTicket.service_category,
    predicted_service_minutes: 10.0,
    estimated_wait_minutes: 0.0,
    status: "waiting",
    position: tenant.queue.size() + 1,
    adjustment_count: 0,
    cancellation_reason: "",
    serve_start_time: null,
    serve_end_time: null,
    actual_service_minutes: null,
  };

  tenant.tickets.set(newTid, newTicket);
  tenant.queue.push([newTicket.priority_level, now, newTid]);
  await saveTicketToDb(newTicket);

  // Update linked appointment to the new target ticket & department so patient's active appointment stays live
  if (origTicket.appointment_id) {
    try {
      await prisma.appointments.updateMany({
        where: { appointment_id: origTicket.appointment_id },
        data: {
          ticket_id: newTid,
          status: "checked_in",
          service_category: targetDepartment,
          updated_at: new Date(),
        },
      });
    } catch (e) {
      console.warn("Could not sync transferred appointment:", e.message);
    }
  }

  const hid = await engine.resolveHospitalId(tenantId);
  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: origTicket.ticket_id,
    eventType: "TRANSFERRED",
    oldStatus: "serving",
    newStatus: "transferred",
    metadata: {
      transferred_to_ticket: newTid,
      target_dept: targetDepartment,
      from_dept: origTicket.service_category,
      queue_date: targetQDate,
      doctor_id: origTicket.served_by_doctor_id || null,
      doctor_name: origTicket.served_by_doctor_name || null,
      doctor_email: origTicket.served_by_doctor_email || null,
    },
  });

  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: newTid,
    eventType: "QUEUE_JOINED",
    oldStatus: null,
    newStatus: "waiting",
    metadata: { transferred_from: origTicket.ticket_id, from_dept: origTicket.service_category, queue_date: targetQDate },
  });

  if (origTicket.ticket_id) {
    await prisma.desks.updateMany({
      where: { current_ticket_id: origTicket.ticket_id },
      data: {
        status: "AVAILABLE",
        current_ticket_id: "",
        updated_at: new Date(),
      },
    }).catch(() => {});
  }

  engine._rebuildHeap(tenantId);
  await engine.recalculateWaitTimes(tenantId);

  return { originalTicket: origTicket, newTicket };
}

/**
 * Cancel Ticket: Validates eligibility (WAITING or SCHEDULED), patient ownership, shifts positions.
 */
async function cancelTicket(tenantId = "city-hospital-01", ticketId, reason = "No longer available", userEmail = null) {
  const cleanTenant = String(tenantId || "city-hospital-01").trim();
  const cancTime = Date.now() / 1000.0;
  const cancDt = new Date(cancTime * 1000);

  // 1. Fetch ticket to determine actual hospital and tenant
  const ticketRow = await prisma.tickets.findUnique({
    where: { ticket_id: ticketId },
    include: { hospitals: true },
  });

  if (!ticketRow) {
    const err = new Error(`Ticket #${ticketId} not found.`);
    err.status = 404;
    throw err;
  }

  const effectiveTenant = ticketRow.hospitals?.hospital_code || cleanTenant;
  const hid = ticketRow.hospital_id;
  const tenant = engine._getTenant(effectiveTenant);

  // Ownership check if email supplied
  let performedByUid = null;
  if (userEmail) {
    performedByUid = await engine.verifyTicketOwnership(ticketId, userEmail, hid);
  }

  // Status validation
  const currStatus = (ticketRow.status || "").toLowerCase();
  if (currStatus === "cancelled") {
    return {
      ...ticketRow,
      tenant_id: effectiveTenant,
      status: "cancelled",
      join_timestamp: dtToEpoch(ticketRow.join_timestamp),
      queue_date: parseQueueDate(ticketRow.queue_date),
    };
  }

  if (!["waiting", "scheduled", "on_hold", "pending"].includes(currStatus)) {
    const err = new Error(
      `Cannot cancel ticket: Ticket status is '${currStatus.toUpperCase()}'. Only WAITING, SCHEDULED, or ON_HOLD tickets can be cancelled.`
    );
    err.status = 409;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    const oldPos = ticketRow.position || 0;
    const deptId = ticketRow.department_id;
    const serviceCat = ticketRow.service_category;
    const qDate = ticketRow.queue_date;

    // Update ticket status
    const updatedTicket = await tx.tickets.update({
      where: { ticket_id: ticketId },
      data: {
        status: "cancelled",
        position: 0,
        cancelled_at: cancDt,
        cancellation_reason: reason,
        updated_at: new Date(),
      },
    });

    // Shift remaining waiting tickets in database to avoid gaps
    if (oldPos > 0 && currStatus === "waiting") {
      if (deptId) {
        await tx.tickets.updateMany({
          where: {
            hospital_id: hid,
            department_id: deptId,
            queue_date: qDate,
            status: "waiting",
            position: { gt: oldPos },
          },
          data: {
            position: { decrement: 1 },
            updated_at: new Date(),
          },
        });
      } else {
        await tx.tickets.updateMany({
          where: {
            hospital_id: hid,
            service_category: serviceCat,
            queue_date: qDate,
            status: "waiting",
            position: { gt: oldPos },
          },
          data: {
            position: { decrement: 1 },
            updated_at: new Date(),
          },
        });
      }
    }

    // Log queue event
    await tx.queue_events.create({
      data: {
        hospital_id: hid,
        ticket_id: ticketId,
        event_type: "CANCEL",
        old_status: currStatus,
        new_status: "cancelled",
        old_position: oldPos,
        new_position: null,
        performed_by_user_id: performedByUid,
        metadata: { reason, queue_date: parseQueueDate(qDate) },
      },
    });

    // Synchronize any linked appointment so it immediately reflects cancelled status
    try {
      await tx.appointments.updateMany({
        where: {
          OR: [
            { ticket_id: ticketId },
            ...(ticketRow.appointment_id ? [{ appointment_id: ticketRow.appointment_id }] : []),
          ],
        },
        data: {
          status: "cancelled",
          updated_at: new Date(),
        },
      });
    } catch (aptErr) {
      console.log(`[cancelTicket] Note: appointment sync:`, aptErr.message);
    }

    return updatedTicket;
  });

  // Synchronize In-Memory Queue State
  if (tenant.tickets.has(ticketId)) {
    const memTicket = tenant.tickets.get(ticketId);
    memTicket.status = "cancelled";
    memTicket.cancelled_at = cancTime;
    memTicket.cancellation_reason = reason;
    memTicket.position = 0;
    engine._rebuildHeap(effectiveTenant);
    await engine.recalculateWaitTimes(effectiveTenant);
  }

  // Also clear from cleanTenant if different
  if (cleanTenant !== effectiveTenant) {
    const otherTenant = engine._getTenant(cleanTenant);
    if (otherTenant.tickets.has(ticketId)) {
      otherTenant.tickets.delete(ticketId);
      engine._rebuildHeap(cleanTenant);
      await engine.recalculateWaitTimes(cleanTenant);
    }
  }

  return {
    ...result,
    tenant_id: effectiveTenant,
    join_timestamp: dtToEpoch(result.join_timestamp),
    queue_date: parseQueueDate(result.queue_date),
  };
}

/**
 * Adjust Queue Position: Backward postponement with MAX_PATIENT_QUEUE_ADJUSTMENT = 3 limit.
 */
async function adjustQueuePosition(
  tenantId = "city-hospital-01",
  ticketId,
  skipPositions = 1,
  userEmail = null,
  reason = "Late arrival"
) {
  const cleanTenant = String(tenantId || "city-hospital-01").trim();
  const skipPos = parseInt(skipPositions, 10);

  if (isNaN(skipPos) || skipPos <= 0) {
    const err = new Error("Adjustment must be a positive integer (cannot move forward or 0).");
    err.status = 400;
    throw err;
  }

  const ticketRow = await prisma.tickets.findUnique({
    where: { ticket_id: ticketId },
    include: { hospitals: true },
  });

  if (!ticketRow) {
    const err = new Error(`Ticket #${ticketId} not found.`);
    err.status = 404;
    throw err;
  }

  const effectiveTenant = ticketRow.hospitals?.hospital_code || cleanTenant;
  const hid = ticketRow.hospital_id;
  const tenant = engine._getTenant(effectiveTenant);
  const now = Date.now() / 1000.0;
  const adjDt = new Date(now * 1000);
  const today = getCurrentQueueDate();

  let performedByUid = null;
  if (userEmail) {
    performedByUid = await engine.verifyTicketOwnership(ticketId, userEmail, hid);
  }

  if ((ticketRow.status || "").toLowerCase() !== "waiting") {
    const err = new Error(
      `Cannot adjust queue position: Ticket status is '${ticketRow.status}'. Only WAITING tickets can be adjusted.`
    );
    err.status = 409;
    throw err;
  }

  const currentAdjCount = ticketRow.adjustment_count || 0;
  if (currentAdjCount + skipPos > MAX_PATIENT_QUEUE_ADJUSTMENT) {
    const remaining = Math.max(0, MAX_PATIENT_QUEUE_ADJUSTMENT - currentAdjCount);
    const err = new Error(
      `Queue adjustment limit exceeded. You requested to skip ${skipPos} position(s), but only ${remaining} position adjustment(s) remain (maximum allowed: ${MAX_PATIENT_QUEUE_ADJUSTMENT}).`
    );
    err.status = 400;
    throw err;
  }

  const previousPosition = ticketRow.position || 1;
  const serviceCat = ticketRow.service_category;
  const qDate = parseQueueDate(ticketRow.queue_date) || today;

  // Calculate new effective timestamp to shift exactly skipPositions behind in department
  const deptWaiting = Array.from(tenant.tickets.values()).filter(
    (t) => t.service_category === serviceCat && t.status === "waiting" && parseQueueDate(t.queue_date) === today
  );

  deptWaiting.sort((a, b) => {
    if (a.priority_level !== b.priority_level) return a.priority_level - b.priority_level;
    const effA = a.effective_timestamp || a.join_timestamp || 0;
    const effB = b.effective_timestamp || b.join_timestamp || 0;
    return effA - effB;
  });

  let currIdx = -1;
  for (let i = 0; i < deptWaiting.length; i++) {
    if (deptWaiting[i].ticket_id === ticketId) {
      currIdx = i;
      break;
    }
  }

  let newEff;
  if (currIdx !== -1 && currIdx + skipPos < deptWaiting.length) {
    const targetT = deptWaiting[currIdx + skipPos];
    const targetEff = targetT.effective_timestamp || targetT.join_timestamp || now;
    newEff = targetEff + 0.001;
  } else if (deptWaiting.length > 0) {
    const lastEff = Math.max(...deptWaiting.map((t) => t.effective_timestamp || t.join_timestamp || now));
    newEff = lastEff + skipPos * 1.0;
  } else {
    const currEff = dtToEpoch(ticketRow.effective_timestamp) || dtToEpoch(ticketRow.join_timestamp);
    newEff = Math.max(now, currEff) + skipPos * 1800;
  }

  const effDt = new Date(newEff * 1000);
  const newAdjCount = currentAdjCount + skipPos;
  const newPosition = previousPosition + skipPos;

  // Update in PostgreSQL
  await prisma.tickets.update({
    where: { ticket_id: ticketId },
    data: {
      effective_timestamp: effDt,
      adjustment_count: newAdjCount,
      last_adjusted_at: adjDt,
      updated_at: new Date(),
    },
  });

  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: ticketId,
    eventType: "ADJUST",
    oldStatus: "waiting",
    newStatus: "waiting",
    oldPosition: previousPosition,
    newPosition: newPosition,
    performedByUserId: performedByUid,
    metadata: {
      adjusted_by: "patient",
      positions_moved: skipPos,
      reason,
      queue_date: qDate,
    },
  });

  // Synchronize In-Memory Queue State
  let memTicket = tenant.tickets.get(ticketId);
  if (!memTicket) {
    memTicket = {
      ...ticketRow,
      join_timestamp: dtToEpoch(ticketRow.join_timestamp),
      effective_timestamp: newEff,
      status: "waiting",
      adjustment_count: newAdjCount,
      queue_date: qDate,
    };
    tenant.tickets.set(ticketId, memTicket);
  } else {
    memTicket.effective_timestamp = newEff;
    memTicket.adjustment_count = newAdjCount;
    memTicket.last_adjusted_at = now;
  }

  engine._rebuildHeap(cleanTenant);
  await engine.recalculateWaitTimes(cleanTenant);

  const finalPos = memTicket.position || newPosition;
  const remainingAdj = MAX_PATIENT_QUEUE_ADJUSTMENT - newAdjCount;

  return {
    success: true,
    status: "success",
    ticket_id: ticketId,
    old_position: previousPosition,
    new_position: finalPos,
    requested_skip: skipPos,
    actual_skip: skipPos,
    positions: skipPos,
    adjustment_count: newAdjCount,
    remaining_adjustment: remainingAdj,
    ticket: memTicket,
    message: `Successfully postponed queue position by ${skipPos} position(s). New position is #${finalPos}.`,
  };
}

/**
 * Fetch Ticket Details by ID.
 */
async function getTicketDetails(ticketId, tenantId = "city-hospital-01") {
  const tenant = engine._getTenant(tenantId);
  const memTicket = tenant.tickets.get(ticketId);
  if (memTicket) {
    return memTicket;
  }

  const row = await prisma.tickets.findUnique({
    where: { ticket_id: ticketId },
    include: {
      departments: true,
      hospitals: true,
    },
  });

  if (!row) {
    const err = new Error(`Ticket #${ticketId} not found.`);
    err.status = 404;
    throw err;
  }

  return {
    ...row,
    join_timestamp: dtToEpoch(row.join_timestamp),
    queue_date: parseQueueDate(row.queue_date),
  };
}

/**
 * Record Patient Announcement / Call count.
 */
async function recordAnnouncement(tenantId, ticketId) {
  const tenant = engine._getTenant(tenantId);
  let ticket = tenant.tickets.get(ticketId);

  if (!ticket) {
    const row = await prisma.tickets.findUnique({ where: { ticket_id: ticketId } });
    if (row) {
      ticket = {
        ...row,
        join_timestamp: dtToEpoch(row.join_timestamp),
        effective_timestamp: dtToEpoch(row.effective_timestamp),
        serve_start_time: row.serve_start_time ? dtToEpoch(row.serve_start_time) : null,
        queue_date: parseQueueDate(row.queue_date),
      };
      tenant.tickets.set(ticketId, ticket);
    }
  }

  if (!ticket) return null;

  ticket.announcement_count = (ticket.announcement_count || 1) + 1;
  ticket.last_announced_at = Date.now() / 1000.0;
  await saveTicketToDb(ticket);

  const hid = await engine.resolveHospitalId(tenantId);
  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: ticket.ticket_id,
    eventType: "ANNOUNCED",
    oldStatus: ticket.status,
    newStatus: ticket.status,
    metadata: {
      announcement_count: ticket.announcement_count,
      last_announced_at: ticket.last_announced_at,
    },
  });

  return ticket;
}

/**
 * Hold Ticket / 10-Minute Grace Period.
 * Moves patient from 'serving' or 'waiting' into 'on_hold' status, freeing the doctor desk.
 */
async function holdTicket(tenantId, ticketId, graceMinutes = 10) {
  const tenant = engine._getTenant(tenantId);
  let ticket = tenant.tickets.get(ticketId);

  if (!ticket) {
    const row = await prisma.tickets.findUnique({ where: { ticket_id: ticketId } });
    if (row) {
      ticket = {
        ...row,
        join_timestamp: dtToEpoch(row.join_timestamp),
        effective_timestamp: dtToEpoch(row.effective_timestamp),
        serve_start_time: row.serve_start_time ? dtToEpoch(row.serve_start_time) : null,
        queue_date: parseQueueDate(row.queue_date),
      };
      tenant.tickets.set(ticketId, ticket);
    }
  }

  if (!ticket) {
    throw new Error(`Ticket #${ticketId} not found.`);
  }

  const prevStatus = ticket.status || "serving";
  const now = Date.now() / 1000.0;
  const graceSecs = Math.max(60, (parseInt(graceMinutes, 10) || 10) * 60);

  ticket.status = "on_hold";
  ticket.hold_start_time = now;
  ticket.hold_until = now + graceSecs;
  ticket.grace_minutes = Math.round(graceSecs / 60);

  // Clear doctor/desk assignment on held ticket so desk is available for next patient
  const heldDocId = ticket.served_by_doctor_id;
  const heldDeskId = ticket.desk_id;
  ticket.previous_doctor_id = heldDocId;
  ticket.previous_desk_id = heldDeskId;

  await saveTicketToDb(ticket);

  // Free desk
  if (ticket.ticket_id) {
    await prisma.desks.updateMany({
      where: { current_ticket_id: ticket.ticket_id },
      data: {
        status: "AVAILABLE",
        current_ticket_id: "",
        updated_at: new Date(),
      },
    }).catch(() => {});
  }

  const hid = await engine.resolveHospitalId(tenantId);
  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: ticket.ticket_id,
    eventType: "PUT_ON_HOLD",
    oldStatus: prevStatus,
    newStatus: "on_hold",
    metadata: {
      hold_start_time: ticket.hold_start_time,
      hold_until: ticket.hold_until,
      grace_minutes: ticket.grace_minutes,
      previous_doctor_id: heldDocId,
      queue_date: ticket.queue_date || getCurrentQueueDate(),
    },
  });

  engine._rebuildHeap(tenantId);
  await engine.recalculateWaitTimes(tenantId);
  return ticket;
}

/**
 * Recall Ticket from On-Hold back to Active Service or Priority Waiting.
 */
async function recallTicket(tenantId, ticketId, doctorInfo = null, targetMode = "auto") {
  const tenant = engine._getTenant(tenantId);
  let ticket = tenant.tickets.get(ticketId);

  if (!ticket) {
    const row = await prisma.tickets.findUnique({ where: { ticket_id: ticketId } });
    if (row) {
      ticket = {
        ...row,
        join_timestamp: dtToEpoch(row.join_timestamp),
        effective_timestamp: dtToEpoch(row.effective_timestamp),
        serve_start_time: row.serve_start_time ? dtToEpoch(row.serve_start_time) : null,
        queue_date: parseQueueDate(row.queue_date),
      };
      tenant.tickets.set(ticketId, ticket);
    }
  }

  if (!ticket) {
    throw new Error(`Ticket #${ticketId} not found.`);
  }

  const now = Date.now() / 1000.0;
  const today = getCurrentQueueDate();

  // Normalize doctor info
  let docId = doctorInfo?.id || doctorInfo?.doctor_id || null;
  let docName = doctorInfo?.name || doctorInfo?.doctor_name || null;
  let docEmail = doctorInfo?.email || doctorInfo?.doctor_email || null;

  // Check if doctor is explicitly provided and currently free to immediately resume serving
  let isDocFree = false;
  if (targetMode === "serving" && (docId || docEmail || docName)) {
    const busyTicket = Array.from(tenant.tickets.values()).find(
      (t) =>
        t.status === "serving" &&
        t.ticket_id !== ticketId &&
        parseQueueDate(t.queue_date) === today &&
        ((docId && t.served_by_doctor_id && String(t.served_by_doctor_id) === String(docId)) ||
         (docEmail && t.served_by_doctor_email && String(t.served_by_doctor_email).toLowerCase() === String(docEmail).toLowerCase()) ||
         (docName && t.served_by_doctor_name && String(t.served_by_doctor_name).trim().toLowerCase() === String(docName).trim().toLowerCase()))
    );
    if (!busyTicket) isDocFree = true;
  }

  // Resuming a held ticket defaults to putting it back into the active waiting queue for doctor to call
  const shouldServeImmediately = targetMode === "serving" && isDocFree;

  if (shouldServeImmediately) {
    ticket.status = "serving";
    ticket.serve_start_time = now;
    ticket.position = 0;
    if (docId) ticket.served_by_doctor_id = docId;
    if (docName) ticket.served_by_doctor_name = docName;
    if (docEmail) ticket.served_by_doctor_email = docEmail;
  } else {
    // Restore to waiting queue with Priority 1 & earliest effective timestamp (Position 1)
    ticket.status = "waiting";
    ticket.serve_start_time = null;
    ticket.served_by_doctor_id = null;
    ticket.served_by_doctor_name = null;
    ticket.served_by_doctor_email = null;
    ticket.priority_level = Number(ticket.priority_level || ticket.priority || 1);
    ticket.effective_timestamp = now - 3600; // Float to top of waiting line
    ticket.position = 1;
    tenant.queue.push([ticket.priority_level, ticket.effective_timestamp, ticket.ticket_id]);
  }

  await saveTicketToDb(ticket);

  const hid = await engine.resolveHospitalId(tenantId);
  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: ticket.ticket_id,
    eventType: shouldServeImmediately ? "RECALLED_TO_SERVING" : "RECALLED_TO_QUEUE",
    oldStatus: "on_hold",
    newStatus: ticket.status,
    metadata: {
      doctor_id: docId,
      doctor_name: docName,
      recalled_at: now,
      queue_date: ticket.queue_date || today,
    },
  });

  engine._rebuildHeap(tenantId);
  await engine.recalculateWaitTimes(tenantId);
  return ticket;
}

/**
 * Mark No-Show.
 */
async function markNoShow(tenantId, ticketId, reason = "Patient did not appear after grace period") {
  const tenant = engine._getTenant(tenantId);
  let ticket = tenant.tickets.get(ticketId);

  if (!ticket) {
    const row = await prisma.tickets.findUnique({ where: { ticket_id: ticketId } });
    if (row) {
      ticket = {
        ...row,
        join_timestamp: dtToEpoch(row.join_timestamp),
        effective_timestamp: dtToEpoch(row.effective_timestamp),
        serve_start_time: row.serve_start_time ? dtToEpoch(row.serve_start_time) : null,
        queue_date: parseQueueDate(row.queue_date),
      };
      tenant.tickets.set(ticketId, ticket);
    }
  }

  if (ticket) {
    const prevStatus = ticket.status || "on_hold";
    ticket.status = "no_show";
    ticket.serve_end_time = Date.now() / 1000.0;
    ticket.cancellation_reason = reason;
    await saveTicketToDb(ticket);

    const hid = await engine.resolveHospitalId(tenantId);
    await engine.logQueueEvent({
      hospitalId: hid,
      ticketId: ticket.ticket_id,
      eventType: "NO_SHOW",
      oldStatus: prevStatus,
      newStatus: "no_show",
      metadata: {
        reason,
        queue_date: ticket.queue_date || getCurrentQueueDate(),
      },
    });
  }

  if (ticket && ticket.ticket_id) {
    await prisma.desks.updateMany({
      where: { current_ticket_id: ticket.ticket_id },
      data: {
        status: "AVAILABLE",
        current_ticket_id: "",
        updated_at: new Date(),
      },
    }).catch(() => {});
  }

  engine._rebuildHeap(tenantId);
  await engine.recalculateWaitTimes(tenantId);
  return { success: true, ticket_id: ticketId };
}

/**
 * Saves or updates prescription notes / structured Rx on a ticket.
 */
async function saveTicketPrescription(tenantId, ticketId, prescriptionData) {
  const tenant = engine._getTenant(tenantId);
  let ticket = tenant.tickets.get(ticketId);

  if (!ticket) {
    const row = await prisma.tickets.findUnique({
      where: { ticket_id: ticketId },
    });
    if (row) {
      ticket = {
        ...row,
        join_timestamp: dtToEpoch(row.join_timestamp),
        effective_timestamp: dtToEpoch(row.effective_timestamp),
        serve_start_time: row.serve_start_time ? dtToEpoch(row.serve_start_time) : null,
        queue_date: parseQueueDate(row.queue_date),
      };
      tenant.tickets.set(ticketId, ticket);
    }
  }

  if (!ticket) {
    throw new Error(`Ticket #${ticketId} not found.`);
  }

  // Rule 4: Reject any update request when consultation status is COMPLETED
  if (ticket.status && String(ticket.status).trim().toLowerCase() === "completed") {
    const err = new Error("Consultation is completed. Status cannot be modified.");
    err.status = 400;
    err.statusCode = 400;
    throw err;
  }

  const notesStr = typeof prescriptionData === "object" ? JSON.stringify(prescriptionData) : String(prescriptionData);
  ticket.prescription_notes = notesStr;
  await saveTicketToDb(ticket);

  const hid = await engine.resolveHospitalId(tenantId);
  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: ticket.ticket_id,
    eventType: "PRESCRIPTION_ATTACHED",
    oldStatus: ticket.status,
    newStatus: ticket.status,
    metadata: {
      has_prescription: true,
      updated_at: new Date().toISOString(),
    },
  });

  return ticket;
}

/**
 * Updates a ticket's clinical triage priority (e.g. 1 = Emergency, 2 = Routine OPD).
 * Repositions ticket in real-time queue heap and logs audit queue event.
 */
async function updateTicketPriority(
  tenantId = "city-hospital-01",
  ticketId,
  priorityLevel = 1,
  reason = "Triage updated by clinical staff",
  requesterEmail = null
) {
  const cleanTenant = String(tenantId || "city-hospital-01").trim();
  const priority = parseInt(priorityLevel, 10) === 1 ? 1 : 2;
  const now = Date.now() / 1000.0;

  const ticketRow = await prisma.tickets.findUnique({
    where: { ticket_id: ticketId },
    include: { hospitals: true },
  });

  if (!ticketRow) {
    const err = new Error(`Ticket #${ticketId} not found.`);
    err.status = 404;
    throw err;
  }

  const effectiveTenant = ticketRow.hospitals?.hospital_code || cleanTenant;
  const hid = ticketRow.hospital_id;
  const tenant = engine._getTenant(effectiveTenant);
  const qDate = parseQueueDate(ticketRow.queue_date) || getCurrentQueueDate();

  // If priority 1 (Emergency), set effective_timestamp into past so it jumps to top
  const effTime = priority === 1 ? (now - 3600) : now;
  const effDt = new Date(effTime * 1000);

  const updatedTicket = await prisma.tickets.update({
    where: { ticket_id: ticketId },
    data: {
      priority_level: priority,
      effective_timestamp: effDt,
      updated_at: new Date(),
    },
  });

  await engine.logQueueEvent({
    hospitalId: hid,
    ticketId: ticketId,
    eventType: "PRIORITY_CHANGED",
    oldStatus: ticketRow.status,
    newStatus: ticketRow.status,
    oldPosition: ticketRow.position,
    newPosition: priority === 1 ? 1 : null,
    metadata: {
      old_priority: ticketRow.priority_level,
      new_priority: priority,
      reason,
      requester: requesterEmail,
      queue_date: qDate,
    },
  });

  if (tenant && tenant.tickets.has(ticketId)) {
    const memTicket = tenant.tickets.get(ticketId);
    memTicket.priority_level = priority;
    memTicket.priority = priority;
    memTicket.is_emergency = priority === 1;
    memTicket.effective_timestamp = effTime;
    engine._rebuildHeap(effectiveTenant);
    await engine.recalculateWaitTimes(effectiveTenant);
  }

  return {
    ...updatedTicket,
    priority_level: priority,
    priority: priority,
    is_emergency: priority === 1,
    tenant_id: effectiveTenant,
    join_timestamp: dtToEpoch(updatedTicket.join_timestamp),
    effective_timestamp: dtToEpoch(updatedTicket.effective_timestamp),
    queue_date: parseQueueDate(updatedTicket.queue_date),
  };
}

module.exports = {
  saveTicketToDb,
  logCompletedService,
  joinQueue,
  serveNext,
  completeTicket,
  transferTicket,
  cancelTicket,
  adjustQueuePosition,
  getTicketDetails,
  markNoShow,
  holdTicket,
  recallTicket,
  recordAnnouncement,
  saveTicketPrescription,
  getDoctorDutyStatus,
  setDoctorDutyStatus,
  updateTicketPriority,
};
