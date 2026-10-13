/**
 * appointmentService.js
 * ----------------------
 * Hybrid Appointment Scheduling & Daily Check-in Engine.
 */

const crypto = require("crypto");
const prisma = require("../config/prisma");
const engine = require("./queueEngine");
const { joinQueue } = require("./ticketService");
const {
  getCurrentQueueDate,
  parseQueueDate,
  queueDateToPrismaDate,
  dtToEpoch,
  getAppointmentTimingDetails,
  formatInTimezone,
} = require("../utils/timezone");
const { PRIORITY_ROUTINE } = require("../utils/clinicalComplexity");
const { getHospitalBranding } = require("./hospitalService");

/**
 * Books a clinical appointment for a patient or dependent family member.
 */
async function bookAppointment({
  tenantId = "city-hospital-01",
  consumerType = "hospital",
  serviceCategory = "consultation",
  patientName = "Patient",
  userEmail = "",
  appointmentDate,
  timeSlot,
  patientId = null,
  familyMemberId = null,
  allowPastDate = false,
}) {
  const aptId = `APT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const deptCode = String(serviceCategory || "consultation").trim().toLowerCase();
  const qDateStr = parseQueueDate(appointmentDate);
  const qDateObj = queueDateToPrismaDate(qDateStr);
  const todayStr = getCurrentQueueDate();

  if (!allowPastDate && qDateStr < todayStr) {
    const err = new Error(`Cannot book appointment: Appointment date (${qDateStr}) is in the past.`);
    err.status = 400;
    throw err;
  }

  const timing = getAppointmentTimingDetails(qDateStr, timeSlot);
  if (qDateStr === todayStr && timing.isExpired) {
    const err = new Error(`Cannot book slot: The selected time slot (${timeSlot}) has already passed and expired.`);
    err.status = 400;
    throw err;
  }

  const hid = await engine.resolveHospitalId(tenantId);
  const deptId = await engine.resolveDepartmentId(hid, deptCode);

  let pid = patientId;
  if (!pid) {
    pid = await engine.resolvePatientId(userEmail, patientName);
  }

  const initialStatus = allowPastDate ? "scheduled" : timing.status; // "BOOKED" or "CHECK_IN_AVAILABLE"

  const appointment = await prisma.appointments.create({
    data: {
      appointment_id: aptId,
      hospital_id: hid,
      patient_id: pid,
      department_id: deptId,
      consumer_type: consumerType || "hospital",
      service_category: deptCode,
      appointment_date: qDateObj,
      time_slot: timeSlot,
      status: initialStatus,
      ticket_id: "",
    },
    include: {
      hospitals: true,
      patients: true,
      departments: true,
    },
  });

  // Log appointment status history
  await prisma.appointment_status_history.create({
    data: {
      appointment_id: aptId,
      old_status: null,
      new_status: initialStatus,
      reason: "Initial Booking",
    },
  });

  return {
    appointment_id: aptId,
    tenant_id: tenantId,
    hospital_code: appointment.hospitals?.hospital_code || tenantId,
    hospital_name: appointment.hospitals?.name || "City General Hospital",
    patient_id: pid,
    family_member_id: familyMemberId || null,
    patient_name: patientName,
    user_email: userEmail,
    service_category: deptCode,
    department_name: appointment.departments?.name || deptCode,
    department: appointment.departments?.name || deptCode,
    appointment_date: qDateStr,
    time_slot: timeSlot,
    appointment_time: timing.appointmentTime.toISOString(),
    check_in_opens_at: timing.checkInOpensAt.toISOString(),
    expires_at: timing.expiresAt.toISOString(),
    formatted_appointment_time: timing.formattedAppointmentTime,
    formatted_check_in_opens_at: timing.formattedCheckInOpensAt,
    formatted_expires_at: timing.formattedExpiresAt,
    status: initialStatus,
    can_check_in: timing.canCheckIn,
    is_expired: timing.isExpired,
  };
}

/**
 * Check-in Appointment: Validates exact 30-minute pre-appointment check-in window and 1-hour expiration rule,
 * transitions status to CHECKED_IN, and creates today's active priority queue ticket.
 */
async function checkInAppointment(appointmentId) {
  const cleanAptId = String(appointmentId || "").trim();
  if (!cleanAptId) {
    const err = new Error("Appointment ID or code is required for check-in.");
    err.status = 400;
    throw err;
  }

  let apt = await prisma.appointments.findUnique({
    where: { appointment_id: cleanAptId },
    include: {
      hospitals: true,
      patients: {
        include: { users: true },
      },
      departments: true,
    },
  });

  // Support prefix-less codes (e.g. '032562D4' -> 'APT-032562D4')
  if (!apt && !cleanAptId.toUpperCase().startsWith("APT-")) {
    apt = await prisma.appointments.findUnique({
      where: { appointment_id: `APT-${cleanAptId.toUpperCase()}` },
      include: {
        hospitals: true,
        patients: {
          include: { users: true },
        },
        departments: true,
      },
    });
  }

  // Case-insensitive lookup fallback
  if (!apt) {
    apt = await prisma.appointments.findFirst({
      where: { appointment_id: { equals: cleanAptId, mode: "insensitive" } },
      include: {
        hospitals: true,
        patients: {
          include: { users: true },
        },
        departments: true,
      },
    });
  }

  if (!apt) {
    const err = new Error(`Appointment '${cleanAptId}' not found. Please verify your appointment code.`);
    err.status = 404;
    throw err;
  }

  if (["completed", "cancelled"].includes(apt.status.toLowerCase())) {
    const err = new Error(`Cannot check in: Appointment status is ${apt.status.toUpperCase()}.`);
    err.status = 400;
    throw err;
  }

  const aptDate = parseQueueDate(apt.appointment_date);
  const today = getCurrentQueueDate();
  const timing = getAppointmentTimingDetails(aptDate, apt.time_slot);
  const now = new Date();

  // If already checked in and has an active ticket, return the existing ticket pass directly
  if (["checked_in", "serving", "waiting"].includes(apt.status.toLowerCase()) && apt.ticket_id) {
    const existingTicket = await prisma.tickets.findUnique({
      where: { ticket_id: apt.ticket_id },
    });
    if (existingTicket && !["cancelled", "expired"].includes(existingTicket.status.toLowerCase())) {
      return {
        appointment: {
          ...apt,
          appointment_date: today,
          time_slot: apt.time_slot,
          status: "CHECKED_IN",
          ticket_id: apt.ticket_id,
          tenant_id: apt.hospitals?.hospital_code || "city-hospital-01",
          appointment_time: timing.appointmentTime.toISOString(),
          check_in_opens_at: timing.checkInOpensAt.toISOString(),
          expires_at: timing.expiresAt.toISOString(),
          formatted_appointment_time: timing.formattedAppointmentTime,
          formatted_check_in_opens_at: timing.formattedCheckInOpensAt,
          formatted_expires_at: timing.formattedExpiresAt,
          can_check_in: false,
        },
        ticket: existingTicket,
      };
    }
  }

  // Check 1: Expiration check (past date or 1 hour after scheduled appointment time)
  if (apt.status.toLowerCase() === "expired" || aptDate < today || timing.isExpired) {
    if (apt.status.toLowerCase() !== "expired") {
      await prisma.appointments.update({
        where: { appointment_id: apt.appointment_id },
        data: { status: "EXPIRED", updated_at: new Date() },
      });
      await prisma.appointment_status_history.create({
        data: {
          appointment_id: apt.appointment_id,
          old_status: apt.status,
          new_status: "EXPIRED",
          reason: `Ticket expired at ${timing.formattedExpiresAt} (1 hour after scheduled appointment time ${apt.time_slot || ""}).`,
        },
      }).catch(() => {});
    }
    const err = new Error(
      `Cannot check in: Ticket expired at ${timing.formattedExpiresAt} (1 hour after scheduled appointment time ${apt.time_slot || ""}). Check-in is permanently disabled.`
    );
    err.status = 400;
    err.code = "TICKET_EXPIRED";
    err.appointment_time = timing.appointmentTime.toISOString();
    err.check_in_opens_at = timing.checkInOpensAt.toISOString();
    err.expires_at = timing.expiresAt.toISOString();
    throw err;
  }

  // Check 2: Early check-in check (future date or before 30-minute check-in window)
  if (aptDate > today || !timing.canCheckIn) {
    const err = new Error(
      aptDate > today
        ? `Check-in not available yet: Your appointment is scheduled for ${aptDate} at ${apt.time_slot || ""}. Check-in opens 30 minutes before your appointment (${timing.formattedCheckInOpensAt}).`
        : `Check-in not available yet: Check-in opens at ${timing.formattedCheckInOpensAt} (30 minutes before appointment at ${apt.time_slot || ""}).`
    );
    err.status = 400;
    err.code = "CHECK_IN_NOT_AVAILABLE";
    err.appointment_time = timing.appointmentTime.toISOString();
    err.check_in_opens_at = timing.checkInOpensAt.toISOString();
    err.expires_at = timing.expiresAt.toISOString();
    throw err;
  }

  // OPD operating hours check: Check-in & joining live line only works when OPD is open
  const tenantId = apt.hospitals?.hospital_code || "city-hospital-01";
  try {
    if (process.env.NODE_ENV !== "test") {
      const brand = await getHospitalBranding(tenantId);
      if (brand) {
        const start = brand.opd_start_time || brand.registration_open_time || "08:00";
        const end = brand.opd_end_time || brand.registration_close_time || "20:00";
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayName = days[now.getDay()];

        // Check operating days if configured
        if (Array.isArray(brand.operating_days) && brand.operating_days.length > 0 && !brand.operating_days.includes(todayName)) {
          const notice = brand.closed_notice || `Cannot check in: OPD is closed today (${todayName}). Check-in and joining the live line is only available when the OPD is open.`;
          const err = new Error(notice);
          err.status = 403;
          err.is_registration_closed = true;
          throw err;
        }

        const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        if (curTime < start || curTime > end) {
          const notice = brand.closed_notice || `Cannot check in: OPD registration is currently closed (${start} - ${end}). Check-in and joining the live line is only available when the OPD is open.`;
          const err = new Error(notice);
          err.status = 403;
          err.is_registration_closed = true;
          throw err;
        }
      }
    }
  } catch (brandErr) {
    if (brandErr.is_registration_closed) throw brandErr;
    console.warn("Could not check OPD operating hours for check-in:", brandErr.message);
  }

  // Generate priority queue ticket for today's active queue
  const ticket = await joinQueue({
    tenantId: apt.hospitals?.hospital_code || "city-hospital-01",
    consumerType: apt.consumer_type || "hospital",
    serviceCategory: apt.service_category || "consultation",
    name: apt.patients?.name || "Patient",
    priorityLevel: PRIORITY_ROUTINE,
    userEmail: apt.patients?.users?.email || "",
    patientId: apt.patient_id,
    queueDate: today,
    appointmentId: apt.appointment_id,
    status: "waiting",
  });

  await prisma.appointments.update({
    where: { appointment_id: apt.appointment_id },
    data: {
      status: "CHECKED_IN",
      ticket_id: ticket.ticket_id,
      appointment_date: queueDateToPrismaDate(today),
      updated_at: new Date(),
    },
  });

  const checkInNote = aptDate !== today
    ? `Checked in on ${today} (Original scheduled date: ${aptDate} at ${apt.time_slot || "Slot"}) as Token #${ticket.ticket_id}`
    : `Checked in as Token #${ticket.ticket_id}`;

  await prisma.appointment_status_history.create({
    data: {
      appointment_id: apt.appointment_id,
      old_status: apt.status,
      new_status: "CHECKED_IN",
      reason: checkInNote,
    },
  });

  return {
    appointment: {
      ...apt,
      appointment_date: today,
      time_slot: apt.time_slot,
      status: "CHECKED_IN",
      ticket_id: ticket.ticket_id,
      tenant_id: apt.hospitals?.hospital_code || "city-hospital-01",
      appointment_time: timing.appointmentTime.toISOString(),
      check_in_opens_at: timing.checkInOpensAt.toISOString(),
      expires_at: timing.expiresAt.toISOString(),
      formatted_appointment_time: timing.formattedAppointmentTime,
      formatted_check_in_opens_at: timing.formattedCheckInOpensAt,
      formatted_expires_at: timing.formattedExpiresAt,
      can_check_in: false,
    },
    ticket,
  };
}

/**
 * Retrieves appointments for a given user email, username, or patient name.
 */
async function getUserAppointments(identifier) {
  const cleanId = String(identifier || "").trim().toLowerCase();
  if (!cleanId) return [];

  // 1. Resolve user ID and phone sibling IDs if exists
  const initialUser = await prisma.users.findFirst({
    where: {
      OR: [{ email: { equals: cleanId, mode: "insensitive" } }, { username: { equals: cleanId, mode: "insensitive" } }],
    },
  });

  const uids = [];
  if (initialUser) {
    uids.push(initialUser.id);
    if (initialUser.phone) {
      const cleanDigits = initialUser.phone.replace(/\D/g, "");
      if (cleanDigits.length >= 7) {
        const phoneSiblings = await prisma.users.findMany({
          where: { phone: { contains: cleanDigits.slice(-10) } },
          select: { id: true },
        });
        phoneSiblings.forEach((s) => {
          if (!uids.includes(s.id)) uids.push(s.id);
        });
      }
    }
  }

  // Build family member maps
  const famByPatId = new Map();
  const famByName = new Map();
  const familyPatientIds = [];
  const familyNames = [];

  if (uids.length > 0) {
    const fams = await prisma.family_members.findMany({
      where: { user_id: { in: uids } },
    });
    fams.forEach((fm) => {
      if (fm.patient_id) {
        famByPatId.set(fm.patient_id, fm.id);
        familyPatientIds.push(fm.patient_id);
      }
      if (fm.name) {
        famByName.set(fm.name.toLowerCase().trim(), fm.id);
        familyNames.push(fm.name.toLowerCase().trim());
      }
    });
  }

  const appointments = await prisma.appointments.findMany({
    where: {
      OR: [
        ...(uids.length > 0
          ? [
              { patients: { user_id: { in: uids } } },
              { patients: { family_members: { some: { user_id: { in: uids } } } } },
            ]
          : []),
        ...(familyPatientIds.length > 0 ? [{ patient_id: { in: familyPatientIds } }] : []),
        ...(familyNames.length > 0
          ? familyNames.map((fn) => ({ patients: { name: { equals: fn, mode: "insensitive" } } }))
          : []),
        { patients: { users: { email: { contains: cleanId, mode: "insensitive" } } } },
        { patients: { users: { username: { contains: cleanId, mode: "insensitive" } } } },
        { patients: { name: { contains: cleanId, mode: "insensitive" } } },
        { appointment_id: { contains: cleanId, mode: "insensitive" } },
        { ticket_id: { contains: cleanId, mode: "insensitive" } },
        { patients: { phone: { contains: cleanId, mode: "insensitive" } } },
      ],
    },
    include: {
      hospitals: true,
      patients: {
        include: {
          users: true,
          family_members: true,
        },
      },
      departments: {
        include: { employees: true },
      },
      tickets: {
        include: { queue_events: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const ticketIds = appointments.map((a) => a.ticket_id).filter(Boolean);
  const ticketsByTicketId = new Map();
  const prescriptionsByTicketId = new Map();
  const visitsByTicketId = new Map();

  if (ticketIds.length > 0) {
    try {
      const [extraTickets, prescriptions, visits] = await Promise.all([
        prisma.tickets.findMany({
          where: { ticket_id: { in: ticketIds } },
          include: { queue_events: true },
        }),
        prisma.prescriptions.findMany({
          where: { ticket_id: { in: ticketIds } },
          select: { ticket_id: true, doctor_name: true },
        }),
        prisma.visit_history.findMany({
          where: { ticket_id: { in: ticketIds } },
          select: { ticket_id: true, doctor_name: true },
        }),
      ]);
      extraTickets.forEach((t) => ticketsByTicketId.set(t.ticket_id, t));
      prescriptions.forEach((p) => { if (p.ticket_id) prescriptionsByTicketId.set(p.ticket_id, p); });
      visits.forEach((v) => { if (v.ticket_id) visitsByTicketId.set(v.ticket_id, v); });
    } catch (e) {}
  }

  return appointments.map((a) => {
    const linkedTkt = a.tickets[0] || (a.ticket_id ? ticketsByTicketId.get(a.ticket_id) : null);
    const cleanDate = parseQueueDate(a.appointment_date);
    const timing = getAppointmentTimingDetails(cleanDate, a.time_slot);

    let effectiveStatus = a.status;
    const rawLower = String(a.status || "").toLowerCase();

    if (["completed", "cancelled", "no_show"].includes(rawLower)) {
      effectiveStatus = rawLower.toUpperCase();
    } else if (rawLower === "checked_in" || Boolean(a.ticket_id)) {
      if (linkedTkt) {
        const tktStatus = String(linkedTkt.status || "").toLowerCase();
        if (["cancelled", "completed", "expired", "no_show"].includes(tktStatus)) {
          effectiveStatus = tktStatus.toUpperCase();
          if (a.status !== effectiveStatus) {
            prisma.appointments.update({
              where: { appointment_id: a.appointment_id },
              data: { status: effectiveStatus, updated_at: new Date() },
            }).catch(() => {});
          }
        } else {
          effectiveStatus = "CHECKED_IN";
        }
      } else {
        effectiveStatus = "CHECKED_IN";
      }
    } else if (rawLower === "expired" || timing.isExpired) {
      effectiveStatus = "EXPIRED";
      if (rawLower !== "expired") {
        prisma.appointments.update({
          where: { appointment_id: a.appointment_id },
          data: { status: "EXPIRED", updated_at: new Date() },
        }).catch(() => {});
        prisma.appointment_status_history.create({
          data: {
            appointment_id: a.appointment_id,
            old_status: a.status,
            new_status: "EXPIRED",
            reason: `Automatically expired 1 hour after scheduled appointment time (${timing.formattedExpiresAt})`,
          },
        }).catch(() => {});
      }
    } else if (timing.canCheckIn) {
      effectiveStatus = "CHECK_IN_AVAILABLE";
      if (a.status !== "CHECK_IN_AVAILABLE") {
        prisma.appointments.update({
          where: { appointment_id: a.appointment_id },
          data: { status: "CHECK_IN_AVAILABLE", updated_at: new Date() },
        }).catch(() => {});
      }
    } else {
      effectiveStatus = "BOOKED";
      if (a.status !== "BOOKED" && a.status === "scheduled") {
        prisma.appointments.update({
          where: { appointment_id: a.appointment_id },
          data: { status: "BOOKED", updated_at: new Date() },
        }).catch(() => {});
      }
    }

    // Resolve attending doctor name
    let docName = "";
    if (linkedTkt) {
      // 1. in-memory queue
      const inMem = engine._getTenant(a.hospitals?.hospital_code || "city-hospital-01")?.tickets?.get(linkedTkt.ticket_id);
      if (inMem?.served_by_doctor_name) {
        docName = inMem.served_by_doctor_name;
      }
      // 2. prescriptions table
      if (!docName && prescriptionsByTicketId.get(linkedTkt.ticket_id)?.doctor_name) {
        docName = prescriptionsByTicketId.get(linkedTkt.ticket_id).doctor_name;
      }
      // 3. visit_history table
      if (!docName && visitsByTicketId.get(linkedTkt.ticket_id)?.doctor_name) {
        docName = visitsByTicketId.get(linkedTkt.ticket_id).doctor_name;
      }
      // 4. prescription_notes JSON
      if (!docName && linkedTkt.prescription_notes) {
        try {
          const rx = typeof linkedTkt.prescription_notes === "object"
            ? linkedTkt.prescription_notes
            : JSON.parse(linkedTkt.prescription_notes);
          if (rx?.doctor_name && rx.doctor_name !== "Dr. Staff Desk") {
            docName = rx.doctor_name;
          }
        } catch (e) {}
      }
      // 5. queue events metadata
      if (!docName && Array.isArray(linkedTkt.queue_events)) {
        for (const ev of linkedTkt.queue_events) {
          if (ev.metadata?.doctor_name && ev.metadata.doctor_name !== "Dr. Staff Desk") {
            docName = ev.metadata.doctor_name;
            break;
          }
        }
      }
    }

    // 6. Department assigned doctor fallback
    if (!docName && a.departments?.employees && a.departments.employees.length > 0) {
      const activeDoc = a.departments.employees.find((e) => (e.status || "").toLowerCase() === "active") || a.departments.employees[0];
      if (activeDoc?.name) {
        docName = activeDoc.name;
      }
    }

    if (docName && !docName.startsWith("Dr.") && !docName.startsWith("Dr ")) {
      docName = `Dr. ${docName}`;
    }

    const transfers = [];
    if (linkedTkt) {
      if (linkedTkt.transferred_from_dept) {
        transfers.push({
          from_department: linkedTkt.transferred_from_dept,
          to_department: a.service_category,
          ticket_id: linkedTkt.ticket_id,
        });
      }
      if (Array.isArray(linkedTkt.queue_events)) {
        for (const ev of linkedTkt.queue_events) {
          if (ev.event_type === "TRANSFERRED" && ev.metadata) {
            transfers.push({
              from_department: a.service_category,
              to_department: ev.metadata.target_dept || "",
              ticket_id: ev.metadata.transferred_to_ticket || "",
            });
          }
        }
      }
    }

    const patName = a.patients?.name || "Patient";
    const memFmId =
      (a.patient_id ? famByPatId.get(a.patient_id) : null) ||
      (a.patients?.family_members && a.patients.family_members[0]?.id) ||
      (patName ? famByName.get(patName.toLowerCase().trim()) : null) ||
      null;

    return {
      appointment_id: a.appointment_id,
      tenant_id: a.hospitals?.hospital_code || "city-hospital-01",
      hospital_code: a.hospitals?.hospital_code || "city-hospital-01",
      hospital_name: a.hospitals?.name || "City General Hospital",
      consumer_type: a.consumer_type,
      service_category: a.service_category,
      department_name: a.departments?.name || a.service_category,
      department: a.departments?.name || a.service_category,
      patient_id: a.patient_id,
      family_member_id: memFmId,
      patient_name: patName,
      user_email: a.patients?.users?.email || "",
      email: a.patients?.users?.email || "",
      phone: a.patients?.phone || a.patients?.users?.phone || "",
      appointment_date: cleanDate,
      time_slot: a.time_slot,
      status: effectiveStatus,
      ticket_id: a.ticket_id || (linkedTkt ? linkedTkt.ticket_id : ""),
      ticket_status: linkedTkt ? linkedTkt.status : null,
      created_at: a.created_at ? a.created_at.toISOString() : null,
      prescription_notes: linkedTkt?.prescription_notes || "",
      doctor_name: docName || null,
      served_by_doctor_name: docName || null,
      transfer_count: transfers.length,
      transfers: transfers,
      appointment_time: timing.appointmentTime.toISOString(),
      check_in_opens_at: timing.checkInOpensAt.toISOString(),
      expires_at: timing.expiresAt.toISOString(),
      formatted_appointment_time: timing.formattedAppointmentTime,
      formatted_check_in_opens_at: timing.formattedCheckInOpensAt,
      formatted_expires_at: timing.formattedExpiresAt,
      can_check_in: timing.canCheckIn && effectiveStatus === "CHECK_IN_AVAILABLE",
      is_expired: effectiveStatus === "EXPIRED",
    };
  });
}

/**
 * Cancel an appointment and any linked active ticket.
 */
async function cancelAppointment(appointmentId, reason = "Patient requested cancellation", requesterEmail = null) {
  const cleanId = String(appointmentId || "").trim();
  const apt = await prisma.appointments.findUnique({
    where: { appointment_id: cleanId },
    include: { hospitals: true, tickets: true, patients: { include: { users: true } } },
  });

  if (!apt) {
    const err = new Error(`Appointment '${cleanId}' not found.`);
    err.status = 404;
    throw err;
  }

  const updatedApt = await prisma.appointments.update({
    where: { appointment_id: cleanId },
    data: {
      status: "cancelled",
      updated_at: new Date(),
    },
    include: {
      hospitals: true,
      patients: true,
      departments: true,
    },
  });

  await prisma.appointment_status_history.create({
    data: {
      appointment_id: cleanId,
      old_status: apt.status,
      new_status: "cancelled",
      reason: reason || "Cancelled by patient",
    },
  }).catch(() => {});

  // If there is an active linked ticket, cancel it as well
  let cancelledTicket = null;
  const tktId = apt.ticket_id || apt.tickets?.[0]?.ticket_id;
  if (tktId) {
    try {
      const { cancelTicket } = require("./ticketService");
      cancelledTicket = await cancelTicket(
        apt.hospitals?.hospital_code || "city-hospital-01",
        tktId,
        reason,
        requesterEmail
      );
    } catch (e) {
      console.log(`[cancelAppointment] Note: linked ticket cancel:`, e.message);
    }
  }

  return {
    ...updatedApt,
    department_name: updatedApt.departments?.name || updatedApt.service_category,
    department: updatedApt.departments?.name || updatedApt.service_category,
    cancelled_ticket: cancelledTicket,
  };
}

/**
 * Retrieves appointments for a given hospital tenant.
 */
async function getTenantAppointments(tenantId, department = null, activeOnly = false) {
  const hid = await engine.resolveHospitalId(tenantId);
  const where = { hospital_id: hid };

  if (department && department !== "all") {
    const deptId = await engine.resolveDepartmentId(hid, department);
    if (deptId) where.department_id = deptId;
  }

  if (activeOnly) {
    where.status = { in: ["scheduled", "booked", "check_in_available", "checked_in", "waiting", "serving", "BOOKED", "CHECK_IN_AVAILABLE", "CHECKED_IN"] };
  }

  const rows = await prisma.appointments.findMany({
    where,
    include: {
      hospitals: true,
      patients: {
        include: { users: true },
      },
      departments: true,
    },
    orderBy: [{ appointment_date: "asc" }, { time_slot: "asc" }],
  });

  return rows.map((a) => {
    const cleanDate = parseQueueDate(a.appointment_date);
    const timing = getAppointmentTimingDetails(cleanDate, a.time_slot);
    let effectiveStatus = a.status;
    const rawLower = String(a.status || "").toLowerCase();
    if (["completed", "cancelled", "no_show"].includes(rawLower)) {
      effectiveStatus = rawLower.toUpperCase();
    } else if (rawLower === "checked_in" || Boolean(a.ticket_id)) {
      effectiveStatus = "CHECKED_IN";
    } else if (rawLower === "expired" || timing.isExpired) {
      effectiveStatus = "EXPIRED";
    } else if (timing.canCheckIn) {
      effectiveStatus = "CHECK_IN_AVAILABLE";
    } else {
      effectiveStatus = "BOOKED";
    }

    return {
      appointment_id: a.appointment_id,
      tenant_id: a.hospitals?.hospital_code || tenantId,
      consumer_type: a.consumer_type,
      service_category: a.service_category,
      department_name: a.departments?.name || a.service_category,
      department: a.departments?.name || a.service_category,
      patient_name: a.patients?.name || "Patient",
      user_email: a.patients?.users?.email || "",
      phone: a.patients?.phone || a.patients?.users?.phone || "",
      email: a.patients?.users?.email || "",
      appointment_date: cleanDate,
      time_slot: a.time_slot,
      status: effectiveStatus,
      ticket_id: a.ticket_id || "",
      created_at: a.created_at ? a.created_at.toISOString() : null,
      appointment_time: timing.appointmentTime.toISOString(),
      check_in_opens_at: timing.checkInOpensAt.toISOString(),
      expires_at: timing.expiresAt.toISOString(),
      formatted_appointment_time: timing.formattedAppointmentTime,
      formatted_check_in_opens_at: timing.formattedCheckInOpensAt,
      formatted_expires_at: timing.formattedExpiresAt,
      can_check_in: timing.canCheckIn && effectiveStatus === "CHECK_IN_AVAILABLE",
      is_expired: effectiveStatus === "EXPIRED",
    };
  });
}

module.exports = {
  bookAppointment,
  checkInAppointment,
  getUserAppointments,
  getTenantAppointments,
  cancelAppointment,
};
