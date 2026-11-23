/**
 * patientHistoryService.js
 * ------------------------
 * Frontend client service for Patient Medical History, Visits, Prescriptions,
 * and Diagnostic Reports.
 */

import { API_BASE } from "../config/hospitalConfig";

function getAuthHeaders() {
  const token = typeof window !== "undefined"
    ? (localStorage.getItem("ai_queue_token") || localStorage.getItem("token"))
    : null;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Fetch composite medical history by ticket ID (optimized for active doctor consultation).
 */
export async function fetchPatientHistoryByTicket(ticketId, hospitalId = null, page = 1, limit = 5) {
  if (!ticketId) return null;
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (hospitalId) params.set("hospital_id", hospitalId);

  try {
    const res = await fetch(`${API_BASE}/api/v1/tickets/${encodeURIComponent(ticketId)}/patient-history?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching ticket patient history:", err);
    return null;
  }
}

/**
 * Fetch composite medical history by patient ID or phone.
 */
export async function fetchPatientHistory({ patientId, phone, hospitalId = null, page = 1, limit = 10 }) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (phone) params.set("phone", phone);
  if (hospitalId) params.set("hospital_id", hospitalId);

  const endpoint = patientId
    ? `${API_BASE}/api/v1/patients/${encodeURIComponent(patientId)}/history?${params.toString()}`
    : `${API_BASE}/api/v1/plugin/patient-history?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching patient history:", err);
    return null;
  }
}

/**
 * Fetch patient visit history list.
 */
export async function fetchPatientVisits(patientId, hospitalId = null, options = {}) {
  if (!patientId) return { visits: [], total: 0 };
  const params = new URLSearchParams({
    page: String(options.page || 1),
    limit: String(options.limit || 10),
    department: options.department || "all",
  });
  if (hospitalId) params.set("hospital_id", hospitalId);

  try {
    const res = await fetch(`${API_BASE}/api/v1/patients/${encodeURIComponent(patientId)}/visits?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching visits:", err);
    return { visits: [], total: 0 };
  }
}

/**
 * Fetch patient prescription history list.
 */
export async function fetchPatientPrescriptions(patientId, hospitalId = null, page = 1, limit = 10) {
  if (!patientId) return { prescriptions: [], total: 0 };
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (hospitalId) params.set("hospital_id", hospitalId);

  try {
    const res = await fetch(`${API_BASE}/api/v1/patients/${encodeURIComponent(patientId)}/prescriptions?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching prescriptions:", err);
    return { prescriptions: [], total: 0 };
  }
}

/**
 * Fetch patient diagnostic & medical reports.
 */
export async function fetchPatientReports(patientId, hospitalId = null) {
  if (!patientId) return { reports: [], total: 0 };
  const params = new URLSearchParams();
  if (hospitalId) params.set("hospital_id", hospitalId);

  try {
    const res = await fetch(`${API_BASE}/api/v1/patients/${encodeURIComponent(patientId)}/reports?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching reports:", err);
    return { reports: [], total: 0 };
  }
}
