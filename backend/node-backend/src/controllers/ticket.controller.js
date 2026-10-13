/**
 * ticket.controller.js
 * --------------------
 * Ticket Cancellation, Adjustment, Details, Transfer, Re-Announce.
 */

const {
  cancelTicket,
  adjustQueuePosition,
  getTicketDetails,
  transferTicket,
  saveTicketPrescription,
  updateTicketPriority,
} = require("../services/ticketService");
const { getIo, broadcastQueueUpdate } = require("../socket");

async function cancelTicketEndpoint(req, res, next) {
  try {
    const tid = req.params.ticket_id || req.body?.ticket_id;
    const tenantId = req.body?.tenant_id || "city-hospital-01";
    const reason = req.body?.reason || "No longer available";

    if (!tid) {
      return res.status(400).json({ status: "error", message: "Ticket ID is required." });
    }

    const requesterEmail = req.user?.email || req.headers["x-user-email"] || null;

    const cancelled = await cancelTicket(tenantId, tid, reason, requesterEmail);

    const io = getIo();
    if (io) {
      if (cancelled) {
        io.to(tenantId).emit("ticket_cancelled", { ticket: cancelled, ticket_id: tid, tenant_id: tenantId });
        io.emit("ticket_cancelled", { ticket: cancelled, ticket_id: tid, tenant_id: tenantId });
      }
      await broadcastQueueUpdate(io, tenantId);
    }

    return res.status(200).json({
      status: "success",
      success: true,
      ticket_id: tid,
      status_code: 200,
      ticket: cancelled || null,
    });
  } catch (error) {
    next(error);
  }
}

async function adjustQueueEndpoint(req, res, next) {
  try {
    const tid = req.params.ticket_id || req.body?.ticket_id;
    const tenantId = req.body?.tenant_id || "city-hospital-01";
    const skipPos = req.body?.positions || req.body?.skip_positions || 1;
    const reason = req.body?.reason || "Late arrival";

    if (!tid) {
      return res.status(400).json({ status: "error", message: "Ticket ID is required." });
    }

    const requesterEmail = req.user?.email || req.headers["x-user-email"] || null;

    const result = await adjustQueuePosition(tenantId, tid, skipPos, requesterEmail, reason);

    const io = getIo();
    if (io) {
      io.to(tenantId).emit("ticket_updated", { ticket: result.ticket, ticket_id: tid, tenant_id: tenantId });
      io.emit("ticket_updated", { ticket: result.ticket, ticket_id: tid, tenant_id: tenantId });
      await broadcastQueueUpdate(io, tenantId);
    }

    return res.status(200).json({
      status: "success",
      success: true,
      ticket_id: tid,
      old_position: result.old_position,
      new_position: result.new_position,
      adjustment_count: result.adjustment_count,
      remaining_adjustment: result.remaining_adjustment,
      ticket: result.ticket,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

async function getTicketDetailsEndpoint(req, res, next) {
  try {
    const ticketId = req.params.ticket_id;
    const tenantId = req.query.tenant_id || "city-hospital-01";

    const ticket = await getTicketDetails(ticketId, tenantId);
    return res.status(200).json({
      status: "success",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

async function transferTicketEndpoint(req, res, next) {
  try {
    const {
      tenant_id = "city-hospital-01",
      ticket_id,
      target_department,
      prescription_notes = "",
    } = req.body;

    const { originalTicket, newTicket } = await transferTicket(
      tenant_id,
      ticket_id,
      target_department,
      prescription_notes
    );

    const io = getIo();
    if (io) {
      io.to(tenant_id).emit("ticket_transferred", {
        original_ticket: originalTicket,
        new_ticket: newTicket,
        tenant_id,
      });
      io.emit("ticket_transferred", {
        original_ticket: originalTicket,
        new_ticket: newTicket,
        tenant_id,
      });
      await broadcastQueueUpdate(io, tenant_id);
    }

    return res.status(200).json({
      success: true,
      original_ticket: originalTicket,
      new_ticket: newTicket,
    });
  } catch (error) {
    next(error);
  }
}

async function reAnnounceEndpoint(req, res, next) {
  try {
    const { tenant_id = "city-hospital-01", ticket_id } = req.body;
    const ticket = await getTicketDetails(ticket_id, tenant_id);

    const io = getIo();
    if (io) {
      io.to(tenant_id).emit("now_serving", { ticket, re_announced: true, tenant_id });
      io.emit("now_serving", { ticket, re_announced: true, tenant_id });
    }

    return res.status(200).json({
      success: true,
      re_announced: ticket,
    });
  } catch (error) {
    next(error);
  }
}

async function savePrescriptionEndpoint(req, res, next) {
  try {
    const tid = req.params.ticket_id || req.body?.ticket_id;
    const tenantId = req.body?.tenant_id || "city-hospital-01";
    const prescription = req.body?.prescription || req.body?.prescription_notes || req.body?.notes || "";

    if (!tid) {
      return res.status(400).json({ status: "error", message: "Ticket ID is required." });
    }

    const updatedTicket = await saveTicketPrescription(tenantId, tid, prescription);

    const io = getIo();
    if (io) {
      io.to(tenantId).emit("ticket_updated", { ticket: updatedTicket, ticket_id: tid, tenant_id: tenantId });
      io.emit("ticket_updated", { ticket: updatedTicket, ticket_id: tid, tenant_id: tenantId });
      io.to(tenantId).emit("prescription_saved", { ticket: updatedTicket, ticket_id: tid, tenant_id: tenantId });
      io.emit("prescription_saved", { ticket: updatedTicket, ticket_id: tid, tenant_id: tenantId });
      await broadcastQueueUpdate(io, tenantId);
    }

    return res.status(200).json({
      status: "success",
      success: true,
      ticket: updatedTicket,
      message: "Prescription saved successfully.",
    });
  } catch (error) {
    next(error);
  }
}

async function updateTicketPriorityEndpoint(req, res, next) {
  try {
    const tid = req.params.ticket_id || req.body?.ticket_id;
    const tenantId = req.body?.tenant_id || "city-hospital-01";
    const priorityLevel = req.body?.priority_level ?? req.body?.priority ?? 1;
    const reason = req.body?.reason || (Number(priorityLevel) === 1 ? "Elevated to Emergency Triage" : "Moved to Routine OPD");
    const requesterEmail = req.user?.email || req.headers["x-user-email"] || null;

    if (!tid) {
      return res.status(400).json({ status: "error", message: "Ticket ID is required." });
    }

    const updatedTicket = await updateTicketPriority(tenantId, tid, priorityLevel, reason, requesterEmail);

    const io = getIo();
    if (io) {
      io.to(tenantId).emit("ticket_updated", { ticket: updatedTicket, ticket_id: tid, tenant_id: tenantId });
      io.emit("ticket_updated", { ticket: updatedTicket, ticket_id: tid, tenant_id: tenantId });
      io.to(tenantId).emit("priority_changed", { ticket: updatedTicket, ticket_id: tid, priority: priorityLevel, tenant_id: tenantId });
      io.emit("priority_changed", { ticket: updatedTicket, ticket_id: tid, priority: priorityLevel, tenant_id: tenantId });
      await broadcastQueueUpdate(io, tenantId);
    }

    return res.status(200).json({
      status: "success",
      success: true,
      ticket: updatedTicket,
      message: `Priority updated to ${Number(priorityLevel) === 1 ? "Emergency (P1)" : "Routine (P2)"} successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  cancelTicketEndpoint,
  adjustQueueEndpoint,
  getTicketDetailsEndpoint,
  transferTicketEndpoint,
  reAnnounceEndpoint,
  savePrescriptionEndpoint,
  updateTicketPriorityEndpoint,
};
