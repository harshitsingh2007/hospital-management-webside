

const { Server } = require("socket.io");
const engine = require("../services/queueEngine");
const {
  joinQueue,
  serveNext,
  completeTicket,
  transferTicket,
  cancelTicket,
  adjustQueuePosition,
  setDoctorDutyStatus,
  getDoctorDutyStatus,
  holdTicket,
  recallTicket,
  recordAnnouncement,
  markNoShow,
} = require("../services/ticketService");
const { triggerModelRetrain } = require("../services/aiService");
const { PRIORITY_EMERGENCY, PRIORITY_ROUTINE, PRIORITY_STANDARD } = require("../utils/clinicalComplexity");
const { verifyToken } = require("../utils/jwt");
const { verifyHospitalAccess } = require("../middleware/hospitalIsolation");
const { stripTicketForPublic } = require("../utils/stripTicket");

let ioInstance = null;

function urgencyToPriority(consumerType, urgency) {
  if (consumerType !== "hospital") return PRIORITY_STANDARD;
  if (urgency === "emergency") return PRIORITY_EMERGENCY;
  return PRIORITY_ROUTINE;
}

async function broadcastQueueUpdate(io, tenantId) {
  if (!tenantId) return;
  const tid = String(tenantId).trim();
  const snapshot = await engine.getQueueSnapshot(tid);
  const serving = await engine.getServingTickets(tid);
  const held = await engine.getHeldTickets(tid);
  const analytics = await engine.getTenantAnalytics(tid);

  const queuePayload = { snapshot, serving, held, analytics, tenant_id: tid };
  io.to(tid).emit("queue_updated", queuePayload);
  io.to(tid).emit("queue_update", queuePayload);
  io.to(tid).emit("analytics_update", analytics);

  // Emit sanitized non-sensitive payload to public room (kiosks, TVs, logged-out trackers)
  const publicSnapshot = Array.isArray(snapshot) ? snapshot.map(stripTicketForPublic) : [];
  const publicServing = Array.isArray(serving) ? serving.map(stripTicketForPublic) : [];
  const publicHeld = Array.isArray(held) ? held.map(stripTicketForPublic) : [];
  const publicAnalytics = {
    total_waiting: analytics?.total_waiting || 0,
    total_serving: analytics?.total_serving || 0,
    total_completed: analytics?.total_completed || 0,
    estimated_wait_minutes_waiting: analytics?.estimated_wait_minutes_waiting || 0,
    peak_wait_window: analytics?.peak_wait_window || null,
  };

  const publicPayload = {
    snapshot: publicSnapshot,
    serving: publicServing,
    held: publicHeld,
    analytics: publicAnalytics,
    tenant_id: tid,
  };
  io.to(`${tid}:public`).emit("queue_updated", publicPayload);
  io.to(`${tid}:public`).emit("queue_update", publicPayload);
  io.to(`${tid}:public`).emit("analytics_update", publicAnalytics);

  const alerts = await engine.getTicketsNeedingTurnAlert(tid);
  if (alerts && alerts.length > 0) {
    io.to(tid).emit("turn_alert", { tickets: alerts, tenant_id: tid });
    io.to(`${tid}:public`).emit("turn_alert", {
      tickets: alerts.map(stripTicketForPublic),
      tenant_id: tid,
    });
  }
}

function initSocket(server, corsOrigin = "*") {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  ioInstance = io;

  // Socket Security Middleware: Supports Verified JWT OR Limited Public Mode
  io.use(async (socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
        socket.handshake.query?.token;

      const isExplicitPublic =
        socket.handshake.auth?.is_public === true ||
        socket.handshake.auth?.public === true ||
        socket.handshake.query?.is_public === "true" ||
        socket.handshake.query?.public === "true";

      if (!rawToken || isExplicitPublic) {
        // Limited Public Mode
        socket.user = null;
        socket.isPublic = true;
        return next();
      }

      const decoded = verifyToken(rawToken);
      if (!decoded) {
        // Fall back to limited public mode for graceful kiosk/TV connection
        socket.user = null;
        socket.isPublic = true;
        return next();
      }

      socket.user = decoded;
      socket.isPublic = false;
      next();
    } catch (err) {
      socket.user = null;
      socket.isPublic = true;
      next();
    }
  });

  io.on("connection", async (socket) => {
    const authTenant = socket.handshake.auth?.tenant_id
      ? String(socket.handshake.auth.tenant_id).trim()
      : (socket.handshake.query?.tenant_id ? String(socket.handshake.query.tenant_id).trim() : null);

    if (authTenant) {
      if (socket.isPublic || !socket.user) {
        socket.join(`${authTenant}:public`);
      } else {
        const allowed = await verifyHospitalAccess(authTenant, socket.user);
        if (allowed) {
          socket.join(authTenant);
        }
      }
    }

    // join_room with multi-tenant access control & public room fallback
    socket.on("join_room", async (data = {}) => {
      const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
      if (!tenantId) {
        socket.emit("error", { message: "tenant_id required to join room" });
        return;
      }

      // Public connection mode: restricted to ${tenantId}:public
      if (socket.isPublic || !socket.user || data.is_public) {
        socket.join(`${tenantId}:public`);
        const snapshot = await engine.getQueueSnapshot(tenantId);
        const serving = await engine.getServingTickets(tenantId);
        const held = await engine.getHeldTickets(tenantId);
        const analytics = await engine.getTenantAnalytics(tenantId);

        socket.emit("queue_update", {
          snapshot: Array.isArray(snapshot) ? snapshot.map(stripTicketForPublic) : [],
          serving: Array.isArray(serving) ? serving.map(stripTicketForPublic) : [],
          held: Array.isArray(held) ? held.map(stripTicketForPublic) : [],
          tenant_id: tenantId,
        });
        socket.emit("analytics_update", {
          total_waiting: analytics?.total_waiting || 0,
          total_serving: analytics?.total_serving || 0,
          total_completed: analytics?.total_completed || 0,
          estimated_wait_minutes_waiting: analytics?.estimated_wait_minutes_waiting || 0,
        });
        return;
      }

      // Authenticated connection mode: access controlled
      const allowed = await verifyHospitalAccess(tenantId, socket.user);
      if (!allowed) {
        socket.emit("error", { message: `Unauthorized: No access to hospital ${tenantId}` });
        return;
      }

      socket.join(tenantId);

      const snapshot = await engine.getQueueSnapshot(tenantId);
      const serving = await engine.getServingTickets(tenantId);
      const held = await engine.getHeldTickets(tenantId);
      const analytics = await engine.getTenantAnalytics(tenantId);

      socket.emit("queue_update", { snapshot, serving, held, tenant_id: tenantId });
      socket.emit("analytics_update", analytics);
    });

    // Explicit public room subscription
    socket.on("join_public_room", async (data = {}) => {
      const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
      if (!tenantId) return;
      socket.join(`${tenantId}:public`);
      const snapshot = await engine.getQueueSnapshot(tenantId);
      const serving = await engine.getServingTickets(tenantId);
      const held = await engine.getHeldTickets(tenantId);
      const analytics = await engine.getTenantAnalytics(tenantId);

      socket.emit("queue_update", {
        snapshot: Array.isArray(snapshot) ? snapshot.map(stripTicketForPublic) : [],
        serving: Array.isArray(serving) ? serving.map(stripTicketForPublic) : [],
        held: Array.isArray(held) ? held.map(stripTicketForPublic) : [],
        tenant_id: tenantId,
      });
      socket.emit("analytics_update", {
        total_waiting: analytics?.total_waiting || 0,
        total_serving: analytics?.total_serving || 0,
        total_completed: analytics?.total_completed || 0,
        estimated_wait_minutes_waiting: analytics?.estimated_wait_minutes_waiting || 0,
      });
    });

    // join_queue
    socket.on("join_queue", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) {
          socket.emit("error", { message: "tenant_id required to join queue" });
          return;
        }
        const allowed = await verifyHospitalAccess(tenantId, socket.user);
        if (!allowed) {
          socket.emit("error", { message: `Unauthorized: No access to hospital ${tenantId}` });
          return;
        }

        const priority = urgencyToPriority(data.consumer_type, data.urgency);

        const ticket = await joinQueue({
          tenantId,
          consumerType: data.consumer_type || "hospital",
          serviceCategory: data.service_category || "consultation",
          name: data.name || "Patient",
          priorityLevel: priority,
          userEmail: data.user_email || "",
          age: data.age || 30,
          gender: data.gender || "other",
          medicalCondition: data.medical_condition || "general_checkup",
          preExistingCondition: data.pre_existing_condition || "none",
        });

        socket.emit("ticket_created", { ticket });
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // serve_next: emits ticket_served, now_serving, ticket_called strictly to io.to(tenantId)
    socket.on("serve_next", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) {
          socket.emit("error", { message: "tenant_id required" });
          return;
        }
        const allowed = await verifyHospitalAccess(tenantId, socket.user);
        if (!allowed) {
          socket.emit("error", { message: `Unauthorized: No access to hospital ${tenantId}` });
          return;
        }

        const department = data.department || data.service_category || null;
        const deskId = data.desk_id || null;
        const doctorInfo = {
          id: data.doctor_id || socket.user?.id || null,
          name: data.doctor_name || socket.user?.name || null,
          email: data.doctor_email || socket.user?.email || null,
        };

        const ticket = await serveNext(tenantId, department, deskId, doctorInfo);
        if (!ticket) {
          const msg = "No waiting tickets in queue for this department.";
          socket.emit("error", { message: msg });
          socket.emit("serve_error", { message: msg });
          return;
        }

        io.to(tenantId).emit("ticket_served", { ticket, tenant_id: tenantId });
        io.to(tenantId).emit("now_serving", { ticket, tenant_id: tenantId });
        io.to(tenantId).emit("ticket_called", { ticket, tenant_id: tenantId });

        io.to(`${tenantId}:public`).emit("ticket_served", { ticket: stripTicketForPublic(ticket), tenant_id: tenantId });
        io.to(`${tenantId}:public`).emit("now_serving", { ticket: stripTicketForPublic(ticket), tenant_id: tenantId });
        io.to(`${tenantId}:public`).emit("ticket_called", { ticket: stripTicketForPublic(ticket), tenant_id: tenantId });
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", {
          code: err.code || "SERVE_ERROR",
          message: err.message,
          current_ticket: err.current_ticket || null,
        });
        socket.emit("serve_error", {
          code: err.code || "SERVE_ERROR",
          message: err.message,
          current_ticket: err.current_ticket || null,
        });
      }
    });

    // complete_ticket
    socket.on("complete_ticket", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const ticketId = data.ticket_id;
        const department = data.department;
        const prescriptionNotes = data.prescription_notes || null;

        const completed = await completeTicket(tenantId, ticketId, department, prescriptionNotes);
        if (completed) {
          io.to(tenantId).emit("ticket_completed", { ticket: completed, tenant_id: tenantId });
          io.to(`${tenantId}:public`).emit("ticket_completed", { ticket: stripTicketForPublic(completed), tenant_id: tenantId });
        }
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // transfer_ticket
    socket.on("transfer_ticket", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const ticketId = data.ticket_id;
        const targetDept = data.target_department || "pharmacy";
        const notes = data.prescription_notes || "";

        const { originalTicket, newTicket } = await transferTicket(tenantId, ticketId, targetDept, notes);

        io.to(tenantId).emit("ticket_transferred", {
          original_ticket: originalTicket,
          new_ticket: newTicket,
          tenant_id: tenantId,
        });
        io.to(`${tenantId}:public`).emit("ticket_transferred", {
          original_ticket: stripTicketForPublic(originalTicket),
          new_ticket: stripTicketForPublic(newTicket),
          tenant_id: tenantId,
        });
        socket.emit("transfer_success", {
          original_ticket: originalTicket,
          new_ticket: newTicket,
        });
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: `Transfer failed: ${err.message}` });
      }
    });

    // hold_ticket (10-minute Grace Period)
    socket.on("hold_ticket", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const ticketId = data.ticket_id;
        const graceMinutes = data.grace_minutes || 10;

        const held = await holdTicket(tenantId, ticketId, graceMinutes);
        io.to(tenantId).emit("ticket_held", { ticket: held, tenant_id: tenantId });
        io.to(`${tenantId}:public`).emit("ticket_held", { ticket: stripTicketForPublic(held), tenant_id: tenantId });
        await broadcastQueueUpdate(io, tenantId);
        socket.emit("hold_success", { ticket: held });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // recall_ticket (Recall from On-Hold back to Serving or Priority Queue)
    socket.on("recall_ticket", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const ticketId = data.ticket_id;
        const doctorInfo = {
          id: data.doctor_id || socket.user?.id || null,
          name: data.doctor_name || socket.user?.name || null,
          email: data.doctor_email || socket.user?.email || null,
        };
        const targetMode = data.target_mode || "auto";

        const recalled = await recallTicket(tenantId, ticketId, doctorInfo, targetMode);
        io.to(tenantId).emit("ticket_served", { ticket: recalled, tenant_id: tenantId });
        io.to(tenantId).emit("ticket_recalled", { ticket: recalled, tenant_id: tenantId });
        io.to(tenantId).emit("now_serving", { ticket: recalled, re_announced: true, tenant_id: tenantId });
        io.to(`${tenantId}:public`).emit("ticket_served", { ticket: stripTicketForPublic(recalled), tenant_id: tenantId });
        io.to(`${tenantId}:public`).emit("ticket_recalled", { ticket: stripTicketForPublic(recalled), tenant_id: tenantId });
        io.to(`${tenantId}:public`).emit("now_serving", { ticket: stripTicketForPublic(recalled), re_announced: true, tenant_id: tenantId });
        await broadcastQueueUpdate(io, tenantId);
        socket.emit("recall_success", { ticket: recalled });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // mark_noshow / noshow_ticket
    socket.on("mark_noshow", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const ticketId = data.ticket_id;
        const reason = data.reason || "Patient did not appear after grace period";

        await markNoShow(tenantId, ticketId, reason);
        io.to(tenantId).emit("ticket_noshow", { ticket_id: ticketId, tenant_id: tenantId });
        io.to(`${tenantId}:public`).emit("ticket_noshow", { ticket_id: ticketId, tenant_id: tenantId });
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // re_announce
    socket.on("re_announce", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const ticket = data.ticket;
        const ticketId = ticket?.ticket_id || data.ticket_id;
        if (ticketId) {
          const updatedTicket = await recordAnnouncement(tenantId, ticketId);
          const finalTicket = updatedTicket || ticket;
          io.to(tenantId).emit("now_serving", { ticket: finalTicket, re_announced: true, tenant_id: tenantId });
          io.to(tenantId).emit("ticket_announced", { ticket: finalTicket, re_announced: true, tenant_id: tenantId });
          io.to(`${tenantId}:public`).emit("now_serving", { ticket: stripTicketForPublic(finalTicket), re_announced: true, tenant_id: tenantId });
          io.to(`${tenantId}:public`).emit("ticket_announced", { ticket: stripTicketForPublic(finalTicket), re_announced: true, tenant_id: tenantId });
          await broadcastQueueUpdate(io, tenantId);
        } else if (ticket) {
          io.to(tenantId).emit("now_serving", { ticket, re_announced: true, tenant_id: tenantId });
          io.to(tenantId).emit("ticket_announced", { ticket, re_announced: true, tenant_id: tenantId });
          io.to(`${tenantId}:public`).emit("now_serving", { ticket: stripTicketForPublic(ticket), re_announced: true, tenant_id: tenantId });
          io.to(`${tenantId}:public`).emit("ticket_announced", { ticket: stripTicketForPublic(ticket), re_announced: true, tenant_id: tenantId });
        }
      } catch (e) {
        if (data.ticket && data.tenant_id) {
          io.to(data.tenant_id).emit("now_serving", { ticket: data.ticket, re_announced: true, tenant_id: data.tenant_id });
          io.to(`${data.tenant_id}:public`).emit("now_serving", { ticket: stripTicketForPublic(data.ticket), re_announced: true, tenant_id: data.tenant_id });
        }
      }
    });

    // cancel_ticket
    socket.on("cancel_ticket", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const ticketId = data.ticket_id;
        const reason = data.reason || "User requested cancellation";
        const userEmail = data.user_email || null;

        const cancelled = await cancelTicket(tenantId, ticketId, reason, userEmail);
        if (cancelled) {
          io.to(tenantId).emit("ticket_cancelled", { ticket: cancelled, ticket_id: ticketId, tenant_id: tenantId });
          io.to(`${tenantId}:public`).emit("ticket_cancelled", { ticket: stripTicketForPublic(cancelled), ticket_id: ticketId, tenant_id: tenantId });
        }
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // adjust_queue
    socket.on("adjust_queue", async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const ticketId = data.ticket_id;
        const skipPos = data.positions || data.skip_positions || 1;
        const userEmail = data.user_email || null;
        const reason = data.reason || "Late arrival";

        const res = await adjustQueuePosition(tenantId, ticketId, skipPos, userEmail, reason);
        io.to(tenantId).emit("ticket_updated", { ticket: res.ticket, ticket_id: ticketId, tenant_id: tenantId });
        await broadcastQueueUpdate(io, tenantId);
        socket.emit("adjust_queue_success", res);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // set_counters
    socket.on("set_counters", async (data = {}) => {
      try {
        const userRole = (data.role || data.user_role || socket.user?.role || "").toLowerCase();
        if (["doctor", "staff", "nurse", "receptionist"].includes(userRole)) {
          socket.emit("error", { message: "Doctors and staff cannot modify active desks." });
          return;
        }
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const count = data.active_counters || 2;
        await engine.setActiveCounters(tenantId, count);
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // update_doctor_duty_status & update_staff_duty_status
    const handleDutyStatusUpdate = async (data = {}) => {
      try {
        const tenantId = data.tenant_id ? String(data.tenant_id).trim() : null;
        if (!tenantId) return;
        const targetUserId = data.doctor_id || data.staff_id || data.user_id || socket.user?.id;
        const targetEmail = data.doctor_email || data.staff_email || data.email || socket.user?.email;
        const targetName = data.doctor_name || data.staff_name || data.name || socket.user?.name;

        const docIdentifier =
          data.doctor_id ||
          data.staff_id ||
          data.user_id ||
          data.doctor_email ||
          data.staff_email ||
          data.email ||
          socket.user?.id ||
          socket.user?.email;

        if (!docIdentifier) {
          socket.emit("error", { message: "Staff/Doctor identifier required to update duty status." });
          return;
        }

        const updated = await setDoctorDutyStatus(docIdentifier, {
          status: data.status,
          break_type: data.break_type,
          note: data.note,
          doctor_name: targetName,
          userId: targetUserId,
          email: targetEmail,
        });

        const broadcastPayload = {
          doctor_id: targetUserId,
          staff_id: targetUserId,
          user_id: targetUserId,
          doctor_email: targetEmail,
          staff_email: targetEmail,
          email: targetEmail,
          doctor_name: targetName || updated.doctor_name,
          staff_name: targetName || updated.doctor_name,
          name: targetName || updated.doctor_name,
          duty: updated,
          tenant_id: tenantId,
        };

        io.to(tenantId).emit("doctor_duty_status_changed", broadcastPayload);
        io.to(tenantId).emit("staff_duty_status_changed", broadcastPayload);
        io.to(tenantId).emit("hospital_data_changed", { tenant_id: tenantId, type: "duty_status_update" });
        socket.emit("doctor_duty_status_confirmed", broadcastPayload);
        socket.emit("staff_duty_status_confirmed", broadcastPayload);
      } catch (err) {
        socket.emit("error", { message: `Duty status update failed: ${err.message}` });
      }
    };

    socket.on("update_doctor_duty_status", handleDutyStatusUpdate);
    socket.on("update_staff_duty_status", handleDutyStatusUpdate);

    // get_doctor_duty_status & get_staff_duty_status
    const handleGetDutyStatus = async (data = {}) => {
      try {
        const docIdentifier =
          data.doctor_id ||
          data.staff_id ||
          data.user_id ||
          data.doctor_email ||
          data.staff_email ||
          data.email ||
          socket.user?.id ||
          socket.user?.email;

        if (docIdentifier) {
          const duty = getDoctorDutyStatus(docIdentifier, docIdentifier);
          socket.emit("doctor_duty_status_current", { duty, doctor_id: docIdentifier, staff_id: docIdentifier });
          socket.emit("staff_duty_status_current", { duty, doctor_id: docIdentifier, staff_id: docIdentifier });
        }
      } catch (e) { }
    };

    socket.on("get_doctor_duty_status", handleGetDutyStatus);
    socket.on("get_staff_duty_status", handleGetDutyStatus);

    // Send initial snapshot non-blockingly if authorized tenant joined
    if (authTenant) {
      (async () => {
        try {
          const snapshot = await engine.getQueueSnapshot(authTenant);
          const serving = await engine.getServingTickets(authTenant);
          const analytics = await engine.getTenantAnalytics(authTenant);

          socket.emit("queue_update", { snapshot, serving });
          socket.emit("analytics_update", analytics);
        } catch (e) { }
      })();
    }
  });

  return io;
}

function getIo() {
  return ioInstance;
}

module.exports = {
  initSocket,
  getIo,
  broadcastQueueUpdate,
};
