/**
 * queue.controller.js
 * -------------------
 * Real-Time Queue & Counter Lifecycle Controllers.
 */

const engine = require("../services/queueEngine");
const {
  joinQueue,
  serveNext,
  completeTicket,
  markNoShow,
  holdTicket,
  recallTicket,
  recordAnnouncement,
} = require("../services/ticketService");
const { verifyFamilyMemberOwnership, resolveOrCreateFamilyMember } = require("../services/familyService");
const { closeAndExpirePreviousDayQueues } = require("../services/dailyClosureService");
const { getIo, broadcastQueueUpdate } = require("../socket");
const { PRIORITY_EMERGENCY, PRIORITY_ROUTINE, PRIORITY_STANDARD } = require("../utils/clinicalComplexity");
const { getCurrentQueueDate, parseQueueDate, queueDateToPrismaDate } = require("../utils/timezone");
const { getHospitalBranding } = require("../services/hospitalService");
const prisma = require("../config/prisma");

function urgencyToPriority(consumerType, urgency, priorityVal) {
  if (priorityVal === 1 || priorityVal === "1" || priorityVal === PRIORITY_EMERGENCY) return PRIORITY_EMERGENCY;
  if (consumerType !== "hospital") return PRIORITY_STANDARD;
  if (urgency === "emergency" || urgency === 1 || urgency === "1") return PRIORITY_EMERGENCY;
  return PRIORITY_ROUTINE;
}

async function joinQueueEndpoint(req, res, next) {
  try {
    const {
      tenant_id = "city-hospital-01",
      consumer_type = "hospital",
      service_category = "consultation",
      name,
      phone,
      urgency,
      priority: explicitPriority,
      user_email,
      age = 30,
      gender = "other",
      medical_condition: rawMedicalCondition,
      symptoms,
      pre_existing_condition = "none",
      family_member_id = null,
    } = req.body;

    const medical_condition = (
      rawMedicalCondition ||
      (Array.isArray(symptoms) && symptoms.length > 0 ? symptoms.filter(Boolean).join(", ") : symptoms) ||
      "general_checkup"
    );

    const priority = urgencyToPriority(consumer_type, urgency, explicitPriority);

    // Registration window check
    if (consumer_type === "hospital" && tenant_id) {
      try {
        const brand = await getHospitalBranding(tenant_id);
        if (brand) {
          const start = brand.opd_start_time || brand.registration_open_time || "08:00";
          const end = brand.opd_end_time || brand.registration_close_time || "20:00";
          const now = new Date();
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const todayName = days[now.getDay()];

          // Check operating days if configured
          if (Array.isArray(brand.operating_days) && brand.operating_days.length > 0 && !brand.operating_days.includes(todayName)) {
            if (priority !== PRIORITY_EMERGENCY) {
              const notice = brand.closed_notice ||
                `Online registration for ${brand.hospital_name || "this hospital"} is closed today (${todayName}). Emergency cases can still walk in.`;
              return res.status(403).json({
                status: "error",
                detail: notice,
                message: notice,
                is_registration_closed: true,
              });
            }
          }

          const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

          if (curTime < start || curTime > end) {
            if (priority !== PRIORITY_EMERGENCY) {
              const notice = brand.closed_notice || brand.registration_closed_notice ||
                `Online registration for ${brand.hospital_name || "this hospital"} is closed for today (${start} - ${end}). Emergency cases can still walk in.`;
              return res.status(403).json({
                status: "error",
                detail: notice,
                message: notice,
                is_registration_closed: true,
              });
            }
          }
        }
      } catch (e) {
        // Fallback gracefully if hospital branding lookup fails
      }
    }

    let patientId = null;
    const isStaffOrDoctor = ["staff", "doctor", "admin", "superadmin"].includes(req.user?.role);
    const emailToCheck = String(user_email || (!isStaffOrDoctor ? req.user?.email : "") || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").trim();
    const cleanName = String(name || "Patient").trim();

    if (family_member_id && family_member_id !== "self" && (emailToCheck || cleanPhone)) {
      const fm = await resolveOrCreateFamilyMember({
        userEmailOrId: emailToCheck || cleanPhone,
        memberId: family_member_id,
        name: cleanName,
        age,
        gender,
      });
      if (fm) {
        patientId = fm.patient_id;
      }
    }

    if (!patientId) {
      // Resolve patientId for the primary profile ("self" or guest walk-in)
      patientId = await engine.resolvePatientId(
        emailToCheck,
        cleanName,
        cleanPhone,
        gender,
        age
      );
    }

    // Enforce 1 active ticket per profile policy
    const tenant = engine._getTenant(tenant_id);
    let existingActiveTicket = null;

    if (tenant && tenant.tickets) {
      for (const t of tenant.tickets.values()) {
        const isLive = ["waiting", "serving", "on_hold", "hold"].includes(String(t.status || "").toLowerCase());
        if (!isLive) continue;

        const tEmail = String(t.user_email || "").trim().toLowerCase();
        const tName = String(t.name || "").trim().toLowerCase();

        // 1. If explicit dependent family_member_id is provided, match by member ID or exact name
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
          // 2. Primary account holder ("self" or guest walk-in)
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
        detail: `An active ticket (#${ticketNum}) is already in progress for ${cleanName} in ${deptName}. In accordance with hospital policy, each profile can hold only 1 active ticket at a time. Please wait for your turn or cancel this ticket before taking a new one.`,
        message: `An active ticket (#${ticketNum}) is already in progress for ${cleanName} in ${deptName}. Hospital policy allows 1 active ticket per patient profile.`,
        ticket: existingActiveTicket,
        existing_ticket: existingActiveTicket,
      });
    }

    const ticket = await joinQueue({
      tenantId: tenant_id,
      consumerType: consumer_type,
      serviceCategory: service_category,
      name: cleanName,
      phone: cleanPhone,
      priorityLevel: priority,
      userEmail: emailToCheck,
      familyMemberId: family_member_id,
      age,
      gender,
      medicalCondition: medical_condition,
      preExistingCondition: pre_existing_condition,
      patientId,
    });

    const io = getIo();
    if (io) {
      await broadcastQueueUpdate(io, tenant_id);
      io.emit("ticket_created", { ticket, tenant_id });
    }

    // Automatic Phone OTP Dispatch & Account Claiming for Walk-in Patients
    let otpInfo = null;
    const cleanPhoneDigits = String(cleanPhone || "").replace(/\D/g, "");
    if (cleanPhoneDigits && cleanPhoneDigits.length >= 10) {
      const last10 = cleanPhoneDigits.slice(-10);
      const existingUser = await prisma.users.findFirst({
        where: {
          phone: { contains: last10 },
          NOT: { email: { contains: "@hospital.local" } },
        },
        select: { id: true, email: true, username: true, phone: true },
      });

      if (!existingUser) {
        try {
          const { createVerificationOtp } = require("../services/tokenService");
          const { otp, expiresAt } = await createVerificationOtp(cleanPhoneDigits, "mobile_verification", 60);

          let smsRes = { simulated: true };
          const shouldSkipSms = Boolean(req.body.skip_otp_sms || req.body.otp_already_sent);
          if (!shouldSkipSms) {
            try {
              const { sendOtpSms } = require("../services/smsService");
              smsRes = await sendOtpSms(cleanPhone, otp);
            } catch (e) {
              console.error("SMS dispatch error:", e);
            }
          }

          otpInfo = {
            sent: !shouldSkipSms,
            is_new_patient: true,
            phone: cleanPhone,
            otp: otp,
            expires_at: expiresAt,
            simulated: Boolean(smsRes.simulated),
            message: shouldSkipSms
              ? `Verification OTP active for +91 ${cleanPhone}.`
              : smsRes.simulated
              ? `OTP code generated for +91 ${cleanPhone}.`
              : `OTP sent via SMS to +91 ${cleanPhone}.`,
          };
        } catch (otpErr) {
          console.error("Error creating walk-in OTP:", otpErr);
        }
      } else {
        otpInfo = {
          sent: false,
          is_registered: true,
          user_id: existingUser.id,
          user_name: existingUser.username,
          phone: cleanPhone,
          message: `Linked to registered patient profile (${existingUser.username}).`,
        };
      }
    }

    return res.status(200).json({
      status: "success",
      ticket,
      otp_info: otpInfo,
    });
  } catch (error) {
    next(error);
  }
}

async function serveNextEndpoint(req, res, next) {
  try {
    const { tenant_id = "city-hospital-01", department, service_category, desk_id } = req.body;
    const effectiveDept = department || service_category || null;

    const doctorInfo = {
      id: req.body.doctor_id || req.user?.id || null,
      name: req.body.doctor_name || req.user?.name || null,
      email: req.body.doctor_email || req.user?.email || null,
    };

    const ticket = await serveNext(tenant_id, effectiveDept, desk_id, doctorInfo);
    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "No waiting tickets in queue for this department.",
      });
    }

    const io = getIo();
    if (io) {
      io.to(tenant_id).emit("now_serving", { ticket, tenant_id });
      io.emit("now_serving", { ticket, tenant_id });
      io.to(tenant_id).emit("ticket_called", { ticket, tenant_id });
      io.emit("ticket_called", { ticket, tenant_id });
      await broadcastQueueUpdate(io, tenant_id);
    }

    return res.status(200).json({
      success: true,
      now_serving: ticket,
    });
  } catch (error) {
    if (error.code === "DOCTOR_ALREADY_SERVING" || error.code === "DESK_ALREADY_SERVING" || error.code === "MAX_SERVING_REACHED") {
      return res.status(error.status || 409).json({
        status: "error",
        code: error.code,
        message: error.message,
        current_ticket: error.current_ticket || null,
      });
    }
    next(error);
  }
}

async function completeEndpoint(req, res, next) {
  try {
    const { tenant_id = "city-hospital-01", ticket_id, department, prescription_notes } = req.body;

    const ticket = await completeTicket(tenant_id, ticket_id, department, prescription_notes);
    const io = getIo();
    if (io) {
      if (ticket) {
        io.to(tenant_id).emit("ticket_completed", { ticket, ticket_id, tenant_id });
        io.emit("ticket_completed", { ticket, ticket_id, tenant_id });
      }
      await broadcastQueueUpdate(io, tenant_id);
    }

    return res.status(200).json({
      success: true,
      ticket: ticket || null,
      completed_ticket: ticket || null,
    });
  } catch (error) {
    next(error);
  }
}

async function holdTicketEndpoint(req, res, next) {
  try {
    const { tenant_id = "city-hospital-01", ticket_id, grace_minutes = 10 } = req.body;

    const ticket = await holdTicket(tenant_id, ticket_id, grace_minutes);
    const io = getIo();
    if (io) {
      io.to(tenant_id).emit("ticket_held", { ticket, ticket_id, tenant_id });
      io.emit("ticket_held", { ticket, ticket_id, tenant_id });
      io.to(tenant_id).emit("ticket_updated", { ticket, ticket_id, tenant_id });
      io.emit("ticket_updated", { ticket, ticket_id, tenant_id });
      await broadcastQueueUpdate(io, tenant_id);
    }

    return res.status(200).json({
      success: true,
      ticket,
      message: `Ticket #${ticket_id} placed on hold for ${grace_minutes} minutes grace period.`,
    });
  } catch (error) {
    next(error);
  }
}

async function recallTicketEndpoint(req, res, next) {
  try {
    const { tenant_id = "city-hospital-01", ticket_id, target_mode = "auto" } = req.body;

    const doctorInfo = {
      id: req.body.doctor_id || req.user?.id || null,
      name: req.body.doctor_name || req.user?.name || null,
      email: req.body.doctor_email || req.user?.email || null,
    };

    const ticket = await recallTicket(tenant_id, ticket_id, doctorInfo, target_mode);
    const io = getIo();
    if (io) {
      io.to(tenant_id).emit("ticket_recalled", { ticket, ticket_id, tenant_id });
      io.emit("ticket_recalled", { ticket, ticket_id, tenant_id });
      io.to(tenant_id).emit("ticket_updated", { ticket, ticket_id, tenant_id });
      io.emit("ticket_updated", { ticket, ticket_id, tenant_id });
      await broadcastQueueUpdate(io, tenant_id);
    }

    return res.status(200).json({
      success: true,
      ticket,
      message: `Ticket #${ticket_id} recalled successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

async function reAnnounceEndpoint(req, res, next) {
  try {
    const { tenant_id = "city-hospital-01", ticket_id, ticket } = req.body;
    const tid = ticket_id || ticket?.ticket_id;

    let updatedTicket = null;
    if (tid) {
      updatedTicket = await recordAnnouncement(tenant_id, tid);
    }

    const finalTicket = updatedTicket || ticket || { ticket_id: tid };
    const io = getIo();
    if (io) {
      io.to(tenant_id).emit("ticket_announced", { ticket: finalTicket, re_announced: true, tenant_id });
      io.emit("ticket_announced", { ticket: finalTicket, re_announced: true, tenant_id });
      if (finalTicket.status === "serving" || finalTicket.status === "called") {
        io.to(tenant_id).emit("now_serving", { ticket: finalTicket, re_announced: true, tenant_id });
        io.emit("now_serving", { ticket: finalTicket, re_announced: true, tenant_id });
      }
      await broadcastQueueUpdate(io, tenant_id);
    }

    return res.status(200).json({
      success: true,
      ticket: finalTicket,
      announcement_count: finalTicket.announcement_count || 1,
    });
  } catch (error) {
    next(error);
  }
}

async function noShowEndpoint(req, res, next) {
  try {
    const { tenant_id = "city-hospital-01", ticket_id, reason } = req.body;

    await markNoShow(tenant_id, ticket_id, reason);
    const io = getIo();
    if (io) {
      io.to(tenant_id).emit("ticket_noshow", { ticket_id, tenant_id });
      io.emit("ticket_noshow", { ticket_id, tenant_id });
      io.to(tenant_id).emit("ticket_cancelled", { ticket_id, tenant_id });
      io.emit("ticket_cancelled", { ticket_id, tenant_id });
      await broadcastQueueUpdate(io, tenant_id);
    }

    return res.status(200).json({ success: true, ticket_id });
  } catch (error) {
    next(error);
  }
}

async function countersEndpoint(req, res, next) {
  try {
    const userRole = (req.user?.role || req.body?.role || "").toLowerCase();
    if (["doctor", "staff", "nurse", "receptionist"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Doctors and staff cannot modify active desks.",
      });
    }
    const { tenant_id = "city-hospital-01", active_counters } = req.body;

    const newCount = await engine.setActiveCounters(tenant_id, active_counters);
    const io = getIo();
    if (io) {
      await broadcastQueueUpdate(io, tenant_id);
    }

    return res.status(200).json({
      success: true,
      active_counters: newCount,
    });
  } catch (error) {
    next(error);
  }
}

async function getQueueEndpoint(req, res, next) {
  try {
    const tenantId = req.params.tenant_id;
    const department = req.query.department || null;
    const dateQuery = req.query.date;

    const today = getCurrentQueueDate();
    const isHistorical = dateQuery && String(dateQuery).trim() !== today;

    const snapshot = await engine.getQueueSnapshot(tenantId, department, dateQuery);
    const serving = isHistorical ? [] : await engine.getServingTickets(tenantId, department, dateQuery);
    const held = isHistorical ? [] : await engine.getHeldTickets(tenantId, department, dateQuery);

    return res.status(200).json({
      snapshot,
      serving,
      held,
      is_historical: !!isHistorical,
      queue_date: String(dateQuery || today),
    });
  } catch (error) {
    next(error);
  }
}

async function getQueueHistoryEndpoint(req, res, next) {
  try {
    const tenantId = req.params.tenant_id;
    const dateQuery = req.query.date || getCurrentQueueDate();
    const department = req.query.department || null;

    const tickets = await engine.getHistoricalQueueTickets(tenantId, dateQuery, department);

    return res.status(200).json({
      status: "success",
      tenant_id: tenantId,
      date: dateQuery,
      department,
      tickets,
      count: tickets.length,
    });
  } catch (error) {
    next(error);
  }
}

async function getAnalyticsEndpoint(req, res, next) {
  try {
    const tenantId = req.params.tenant_id;
    const department = req.query.department || null;
    const dateQuery = req.query.date || null;

    const analytics = await engine.getTenantAnalytics(tenantId, department, dateQuery);
    return res.status(200).json(analytics);
  } catch (error) {
    next(error);
  }
}

async function triggerDailyClosureEndpoint(req, res, next) {
  try {
    const targetDate = req.body?.target_date || null;
    const hospitalCode = req.body?.hospital_code || req.body?.tenant_id || null;

    if (req.user && !["superadmin", "admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized: Only administrative accounts can trigger daily closure.",
      });
    }

    const result = await closeAndExpirePreviousDayQueues(targetDate, hospitalCode);
    return res.status(200).json({
      status: "success",
      result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
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
};
