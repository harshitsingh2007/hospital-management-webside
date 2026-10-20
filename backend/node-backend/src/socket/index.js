/**
 * socket/index.js
 * ---------------
 * Socket.IO Real-Time Event Management with Tenant/Hospital Isolation.
 */

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

let ioInstance = null;

function urgencyToPriority(consumerType, urgency) {
  if (consumerType !== "hospital") return PRIORITY_STANDARD;
  if (urgency === "emergency") return PRIORITY_EMERGENCY;
  return PRIORITY_ROUTINE;
}

async function broadcastQueueUpdate(io, tenantId) {
  const tid = String(tenantId || "city-hospital-01").trim();
  const snapshot = await engine.getQueueSnapshot(tid);
  const serving = await engine.getServingTickets(tid);
  const held = await engine.getHeldTickets(tid);
  const analytics = await engine.getTenantAnalytics(tid);

  const queuePayload = { snapshot, serving, held, analytics, tenant_id: tid };
  io.emit("queue_updated", queuePayload);
  io.emit("queue_update", queuePayload);
  io.emit("analytics_update", analytics);

  const alerts = await engine.getTicketsNeedingTurnAlert(tid);
  if (alerts && alerts.length > 0) {
    io.emit("turn_alert", { tickets: alerts, tenant_id: tid });
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

  io.on("connection", (socket) => {
    const authTenant = socket.handshake.auth?.tenant_id || "city-hospital-01";
    socket.join(authTenant);

    // join_room
    socket.on("join_room", async (data = {}) => {
      const tenantId = data.tenant_id || "city-hospital-01";
      socket.join(tenantId);

      const snapshot = await engine.getQueueSnapshot(tenantId);
      const serving = await engine.getServingTickets(tenantId);
      const held = await engine.getHeldTickets(tenantId);
      const analytics = await engine.getTenantAnalytics(tenantId);

      socket.emit("queue_update", { snapshot, serving, held });
      socket.emit("analytics_update", analytics);
    });

    // join_queue
    socket.on("join_queue", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
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

    // serve_next
    socket.on("serve_next", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
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

        io.to(tenantId).emit("now_serving", { ticket });
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
        const tenantId = data.tenant_id || "city-hospital-01";
        const ticketId = data.ticket_id;
        const department = data.department;
        const prescriptionNotes = data.prescription_notes || null;

        const completed = await completeTicket(tenantId, ticketId, department, prescriptionNotes);
        if (completed) {
          io.to(tenantId).emit("ticket_completed", { ticket: completed });
        }
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // transfer_ticket
    socket.on("transfer_ticket", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
        const ticketId = data.ticket_id;
        const targetDept = data.target_department || "pharmacy";
        const notes = data.prescription_notes || "";

        const { originalTicket, newTicket } = await transferTicket(tenantId, ticketId, targetDept, notes);

        io.to(tenantId).emit("ticket_transferred", {
          original_ticket: originalTicket,
          new_ticket: newTicket,
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
        const tenantId = data.tenant_id || "city-hospital-01";
        const ticketId = data.ticket_id;
        const graceMinutes = data.grace_minutes || 10;

        const held = await holdTicket(tenantId, ticketId, graceMinutes);
        io.to(tenantId).emit("ticket_held", { ticket: held });
        await broadcastQueueUpdate(io, tenantId);
        socket.emit("hold_success", { ticket: held });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // recall_ticket (Recall from On-Hold back to Serving or Priority Queue)
    socket.on("recall_ticket", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
        const ticketId = data.ticket_id;
        const doctorInfo = {
          id: data.doctor_id || socket.user?.id || null,
          name: data.doctor_name || socket.user?.name || null,
          email: data.doctor_email || socket.user?.email || null,
        };
        const targetMode = data.target_mode || "auto";

        const recalled = await recallTicket(tenantId, ticketId, doctorInfo, targetMode);
        io.to(tenantId).emit("ticket_recalled", { ticket: recalled });
        await broadcastQueueUpdate(io, tenantId);
        socket.emit("recall_success", { ticket: recalled });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // mark_noshow / noshow_ticket
    socket.on("mark_noshow", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
        const ticketId = data.ticket_id;
        const reason = data.reason || "Patient did not appear after grace period";

        await markNoShow(tenantId, ticketId, reason);
        io.to(tenantId).emit("ticket_noshow", { ticket_id: ticketId });
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // re_announce
    socket.on("re_announce", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
        const ticket = data.ticket;
        const ticketId = ticket?.ticket_id || data.ticket_id;
        if (ticketId) {
          const updatedTicket = await recordAnnouncement(tenantId, ticketId);
          io.to(tenantId).emit("now_serving", { ticket: updatedTicket || ticket, re_announced: true });
          await broadcastQueueUpdate(io, tenantId);
        } else if (ticket) {
          io.to(tenantId).emit("now_serving", { ticket, re_announced: true });
        }
      } catch (e) {
        if (data.ticket) io.to(data.tenant_id || "city-hospital-01").emit("now_serving", { ticket: data.ticket, re_announced: true });
      }
    });

    // cancel_ticket
    socket.on("cancel_ticket", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
        const ticketId = data.ticket_id;
        const reason = data.reason || "User requested cancellation";
        const userEmail = data.user_email || null;

        const cancelled = await cancelTicket(tenantId, ticketId, reason, userEmail);
        if (cancelled) {
          io.to(tenantId).emit("ticket_cancelled", { ticket: cancelled, ticket_id: ticketId });
        }
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // adjust_queue
    socket.on("adjust_queue", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
        const ticketId = data.ticket_id;
        const skipPos = data.positions || data.skip_positions || 1;
        const userEmail = data.user_email || null;
        const reason = data.reason || "Late arrival";

        const res = await adjustQueuePosition(tenantId, ticketId, skipPos, userEmail, reason);
        io.to(tenantId).emit("ticket_updated", { ticket: res.ticket, ticket_id: ticketId });
        await broadcastQueueUpdate(io, tenantId);
        socket.emit("adjust_queue_success", res);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // set_counters
    socket.on("set_counters", async (data = {}) => {
      try {
        const userRole = (data.role || data.user_role || socket.handshake.auth?.role || "").toLowerCase();
        if (["doctor", "staff", "nurse", "receptionist"].includes(userRole)) {
          socket.emit("error", { message: "Doctors and staff cannot modify active desks." });
          return;
        }
        const tenantId = data.tenant_id || "city-hospital-01";
        const count = data.active_counters || 2;
        await engine.setActiveCounters(tenantId, count);
        await broadcastQueueUpdate(io, tenantId);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    // update_doctor_duty_status
    socket.on("update_doctor_duty_status", async (data = {}) => {
      try {
        const tenantId = data.tenant_id || "city-hospital-01";
        const docIdentifier = data.doctor_id || data.doctor_email || socket.user?.id || socket.user?.email;
        if (!docIdentifier) {
          socket.emit("error", { message: "Doctor identifier required to update duty status." });
          return;
        }

        const updated = await setDoctorDutyStatus(docIdentifier, {
          status: data.status,
          break_type: data.break_type,
          note: data.note,
          doctor_name: data.doctor_name || socket.user?.name,
          userId: data.doctor_id || socket.user?.id,
          email: data.doctor_email || socket.user?.email,
        });

        const broadcastPayload = {
          doctor_id: data.doctor_id || socket.user?.id,
          doctor_email: data.doctor_email || socket.user?.email,
          doctor_name: data.doctor_name || updated.doctor_name,
          duty: updated,
          tenant_id: tenantId,
        };

        io.to(tenantId).emit("doctor_duty_status_changed", broadcastPayload);
        io.emit("doctor_duty_status_changed", broadcastPayload);
        io.emit("hospital_data_changed", { tenant_id: tenantId || "all", type: "duty_status_update" });
        socket.emit("doctor_duty_status_confirmed", broadcastPayload);
      } catch (err) {
        socket.emit("error", { message: `Duty status update failed: ${err.message}` });
      }
    });

    // get_doctor_duty_status
    socket.on("get_doctor_duty_status", async (data = {}) => {
      try {
        const docIdentifier = data.doctor_id || data.doctor_email || socket.user?.id || socket.user?.email;
        if (docIdentifier) {
          const duty = getDoctorDutyStatus(docIdentifier, docIdentifier);
          socket.emit("doctor_duty_status_current", { duty, doctor_id: docIdentifier });
        }
      } catch (e) {}
    });

    // Send initial snapshot non-blockingly
    (async () => {
      try {
        const snapshot = await engine.getQueueSnapshot(authTenant);
        const serving = await engine.getServingTickets(authTenant);
        const analytics = await engine.getTenantAnalytics(authTenant);

        socket.emit("queue_update", { snapshot, serving });
        socket.emit("analytics_update", analytics);
      } catch (e) {}
    })();
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
