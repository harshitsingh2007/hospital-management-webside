/**
 * appointment.controller.js
 * --------------------------
 * Appointment Scheduling & Daily Check-in Controllers.
 */

const prisma = require("../config/prisma");
const engine = require("../services/queueEngine");
const { getCurrentQueueDate, queueDateToPrismaDate, parseQueueDate, getAppointmentTimingDetails } = require("../utils/timezone");
const {
  bookAppointment,
  checkInAppointment,
  getUserAppointments,
  getTenantAppointments,
  cancelAppointment,
} = require("../services/appointmentService");
const { verifyFamilyMemberOwnership, resolveOrCreateFamilyMember } = require("../services/familyService");
const { getIo, broadcastQueueUpdate } = require("../socket");

async function bookAppointmentEndpoint(req, res, next) {
  try {
    const {
      tenant_id = "city-hospital-01",
      consumer_type = "hospital",
      service_category,
      patient_name,
      user_email = "",
      appointment_date,
      time_slot,
      family_member_id = null,
    } = req.body;

    const cleanName = String(patient_name || "").trim();
    const emailToCheck = String(user_email || req.user?.email || "").trim().toLowerCase();

    let patientId = null;
    if (family_member_id && (emailToCheck || req.user?.email)) {
      const fm = await resolveOrCreateFamilyMember({
        userEmailOrId: emailToCheck,
        memberId: family_member_id,
        name: cleanName,
      });
      if (fm) {
        patientId = fm.patient_id;
      }
    }

    if (!patientId) {
      patientId = await engine.resolvePatientId(emailToCheck, cleanName);
    }

    // 1. Enforce 1 active ticket per profile policy
    const tenant = engine._getTenant(tenant_id);
    let existingActiveTicket = null;

    if (tenant && tenant.tickets) {
      for (const t of tenant.tickets.values()) {
        const isLive = ["waiting", "serving", "on_hold", "hold"].includes(String(t.status || "").toLowerCase());
        if (!isLive) continue;

        const tEmail = String(t.user_email || "").trim().toLowerCase();
        const tName = String(t.name || "").trim().toLowerCase();

        if (family_member_id && family_member_id !== "self") {
          if (t.family_member_id === family_member_id) {
            existingActiveTicket = t;
            break;
          }
          if (emailToCheck && tEmail === emailToCheck && tName === cleanName.toLowerCase()) {
            existingActiveTicket = t;
            break;
          }
        } else {
          if (tName === cleanName.toLowerCase()) {
            if (!t.family_member_id || t.family_member_id === "self") {
              existingActiveTicket = t;
              break;
            }
          }
        }
      }
    }

    if (!existingActiveTicket) {
      const todayPrisma = queueDateToPrismaDate(getCurrentQueueDate());
      const hid = await engine.resolveHospitalId(tenant_id);

      const dbTicket = await prisma.tickets.findFirst({
        where: {
          hospital_id: hid,
          queue_date: todayPrisma,
          status: { in: ["waiting", "serving", "on_hold", "hold"] },
          name: { equals: cleanName, mode: "insensitive" },
          ...(patientId ? { patient_id: patientId } : {}),
        },
        orderBy: { id: "desc" },
      });

      if (dbTicket) {
        existingActiveTicket = dbTicket;
      }
    }

    if (existingActiveTicket) {
      const deptName = existingActiveTicket.service_category || "Consultation";
      const ticketNum = existingActiveTicket.ticket_id;
      return res.status(409).json({
        status: "error",
        code: "ACTIVE_TICKET_EXISTS",
        detail: `An active ticket (#${ticketNum}) is already in progress for ${cleanName} in ${deptName}. In accordance with hospital policy, each profile can hold only 1 active ticket at a time. Please wait for your turn or cancel this ticket before booking a new appointment.`,
        message: `An active ticket (#${ticketNum}) is already in progress for ${cleanName} in ${deptName}. Hospital policy allows 1 active ticket per patient profile.`,
        ticket: existingActiveTicket,
      });
    }

    // 2. Enforce 1 active scheduled appointment per profile policy
    const hid = await engine.resolveHospitalId(tenant_id);
    const existingApt = await prisma.appointments.findFirst({
      where: {
        hospital_id: hid,
        status: { in: ["scheduled", "booked", "check_in_available", "BOOKED", "CHECK_IN_AVAILABLE"] },
        ...(patientId
          ? { patient_id: patientId }
          : {
              patient_id: { in: (await prisma.patients.findMany({ where: { name: { equals: cleanName, mode: "insensitive" } }, select: { id: true } })).map((p) => p.id) },
            }),
      },
      include: { departments: true },
      orderBy: { id: "desc" },
    });

    if (existingApt) {
      const existingTiming = getAppointmentTimingDetails(
        parseQueueDate(existingApt.appointment_date),
        existingApt.time_slot
      );

      if (existingTiming.isExpired) {
        // Overdue ticket automatically expired, update DB and allow booking new slot
        await prisma.appointments.update({
          where: { appointment_id: existingApt.appointment_id },
          data: { status: "EXPIRED", updated_at: new Date() },
        });
        await prisma.appointment_status_history.create({
          data: {
            appointment_id: existingApt.appointment_id,
            old_status: existingApt.status,
            new_status: "EXPIRED",
            reason: `Automatically expired 1 hour after scheduled appointment (${existingTiming.formattedExpiresAt})`,
          },
        }).catch(() => {});
      } else {
        const deptName = existingApt.departments?.name || existingApt.service_category || "Consultation";
        return res.status(409).json({
          status: "error",
          code: "ACTIVE_APPOINTMENT_EXISTS",
          detail: `An active appointment (${existingApt.appointment_id}) is already scheduled for ${cleanName} in ${deptName} at ${existingApt.time_slot}. In accordance with hospital policy, each profile can hold only 1 active booking at a time. Please complete or cancel your current appointment before reserving another slot.`,
          message: `An active appointment (${existingApt.appointment_id}) is already scheduled for ${cleanName}. Hospital policy allows 1 active booking per patient profile.`,
          appointment: existingApt,
        });
      }
    }

    const appointment = await bookAppointment({
      tenantId: tenant_id,
      consumerType: consumer_type,
      serviceCategory: service_category,
      patientName: cleanName,
      userEmail: emailToCheck,
      appointmentDate: appointment_date,
      timeSlot: time_slot,
      patientId,
      familyMemberId: family_member_id || null,
    });

    return res.status(200).json({
      status: "success",
      appointment,
    });
  } catch (error) {
    next(error);
  }
}

async function checkInAppointmentEndpoint(req, res, next) {
  try {
    const { appointment_id } = req.body;
    if (!appointment_id) {
      return res.status(400).json({ status: "error", message: "Appointment ID is required." });
    }

    const result = await checkInAppointment(appointment_id);
    const io = getIo();
    if (io) {
      await broadcastQueueUpdate(io, result.appointment.tenant_id);
    }

    return res.status(200).json({
      status: "success",
      appointment: result.appointment,
      ticket: result.ticket,
    });
  } catch (error) {
    next(error);
  }
}

async function getUserAppointmentsEndpoint(req, res, next) {
  try {
    const email = req.params.email;
    const name = req.query.name;

    let results = await getUserAppointments(email);
    if (results.length === 0 && name && name.trim().toLowerCase() !== email.trim().toLowerCase()) {
      results = await getUserAppointments(name);
    }

    return res.status(200).json({
      appointments: results,
    });
  } catch (error) {
    next(error);
  }
}

async function getTenantAppointmentsEndpoint(req, res, next) {
  try {
    const tenantId = req.params.tenant_id;
    const department = req.query.department || null;
    const activeOnly = req.query.active_only === "true";

    const appointments = await getTenantAppointments(tenantId, department, activeOnly);
    return res.status(200).json({
      status: "success",
      appointments,
    });
  } catch (error) {
    next(error);
  }
}

async function cancelAppointmentEndpoint(req, res, next) {
  try {
    const aptId = req.params.appointment_id || req.body?.appointment_id;
    const reason = req.body?.reason || "Patient requested cancellation";
    const requesterEmail = req.user?.email || req.headers["x-user-email"] || null;

    if (!aptId) {
      return res.status(400).json({ status: "error", message: "Appointment ID is required." });
    }

    const result = await cancelAppointment(aptId, reason, requesterEmail);

    const io = getIo();
    if (io) {
      io.emit("appointment_updated", { appointment_id: aptId, status: "cancelled", reason });
      if (result.ticket_id) {
        io.emit("ticket_cancelled", { ticket_id: result.ticket_id });
      }
      io.emit("queue_updated", { timestamp: new Date().toISOString() });
    }

    return res.status(200).json({
      status: "success",
      message: `Appointment ${aptId} cancelled successfully.`,
      appointment: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  bookAppointmentEndpoint,
  checkInAppointmentEndpoint,
  getUserAppointmentsEndpoint,
  getTenantAppointmentsEndpoint,
  cancelAppointmentEndpoint,
};
