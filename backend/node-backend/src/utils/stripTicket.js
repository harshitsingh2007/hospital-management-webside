/**
 * stripTicket.js
 * --------------
 * Sanitizes ticket payloads for public screens (kiosks, waiting hall TVs, public trackers).
 * Oromits all PII: patient names, phone numbers, email addresses, medical condition,
 * clinical symptoms, diagnosis, and prescription notes.
 */

function stripTicketForPublic(ticket) {
  if (!ticket || typeof ticket !== "object") return ticket;

  return {
    id: ticket.id,
    ticket_id: ticket.ticket_id || ticket.id,
    token_number: ticket.token_number || null,
    ticket_number: ticket.ticket_number || null,
    status: ticket.status || "waiting",
    priority: ticket.priority,
    service_category: ticket.service_category || "consultation",
    department_id: ticket.department_id || null,
    department_name: ticket.department_name || null,
    desk_id: ticket.desk_id || null,
    desk_number: ticket.desk_number || null,
    counter_name: ticket.counter_name || null,
    position: ticket.position ?? null,
    estimated_wait_time: ticket.estimated_wait_time ?? null,
    created_at: ticket.created_at || null,
    timestamp: ticket.timestamp || new Date().toISOString(),
  };
}

module.exports = {
  stripTicketForPublic,
};

