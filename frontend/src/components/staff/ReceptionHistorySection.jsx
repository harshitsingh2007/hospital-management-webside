/**
 * ReceptionHistorySection.jsx
 * ----------------------------
 * Dedicated History & Audit view for the Reception Portal.
 * Enables reception staff to search, filter, paginate, and inspect past patient visits,
 * walk-in tokens, and appointments with live backend data and hospital isolation.
 *
 * Adheres strictly to the visual & layout design patterns of PharmacyPage.jsx.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  History,
  Calendar,
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Clock,
  Building2,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  FileText,
  BadgeCheck,
  Tag,
  ArrowRight,
  CalendarCheck,
  Ticket,
  Pill
} from "lucide-react";
import { API_BASE } from "../../config/hospitalConfig";
import { apiFetch } from "../../utils/apiFetch";
import { printTokenPass, printAppointmentRecord } from "../../utils/printPassHelper";

function parseBalancedJson(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return { jsonStr: text.slice(startIndex, i + 1), endIndex: i };
      }
    }
  }
  return null;
}

// Parse raw clinical / prescription notes (which may contain [Department]: { json } or plain JSON)
function parseClinicalNotes(notesStr) {
  if (!notesStr) return [];
  if (typeof notesStr === "object") {
    return [{ dept: "Clinical Assessment", isJson: true, data: notesStr }];
  }

  const str = String(notesStr).trim();
  if (!str) return [];

  const sections = [];

  // Match [Department Name]: { ...json... } blocks using balanced brace parsing
  const labelPattern = /\[([^\]]+)\]:\s*\{/g;
  let m;
  while ((m = labelPattern.exec(str)) !== null) {
    const dept = m[1].trim();
    const start = m.index + m[0].length - 1;
    const balanced = parseBalancedJson(str, start);
    if (balanced) {
      try {
        const data = JSON.parse(balanced.jsonStr);
        sections.push({ dept, isJson: true, data });
      } catch (_) {}
      labelPattern.lastIndex = balanced.endIndex + 1;
    }
  }

  if (sections.length > 0) return sections;

  // Single JSON object block
  const firstBrace = str.indexOf("{");
  if (firstBrace !== -1) {
    const balanced = parseBalancedJson(str, firstBrace);
    if (balanced) {
      try {
        const data = JSON.parse(balanced.jsonStr);
        return [{ dept: "Clinical Assessment", isJson: true, data }];
      } catch (_) {}
    }
  }

  // Plain text notes fallback — strictly filter out raw stringified JSON payloads
  if (str.includes('"doctor_name"') || str.includes('"medicines"') || str.includes('":') || str.includes('{"')) {
    return [];
  }

  return [{ dept: "Clinical Notes", isJson: false, text: str }];
}

export default function ReceptionHistorySection({
  hospitalCode,
  currentUser,
  theme = "light",
  language = "en",
  departments = [],
  hospitalBranding = null,
}) {
  const isDark = theme === "dark";
  const isHi = language === "hi";

  // Effective hospital identifier
  const effectiveHospitalCode =
    hospitalCode ||
    currentUser?.hospital_code ||
    currentUser?.primary_hospital_code ||
    "city-hospital-01";

  // Data states
  const [visits, setVisits] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Filter states
  const [dateRangeFilter, setDateRangeFilter] = useState("all"); // "today" | "yesterday" | "7days" | "30days" | "custom" | "all"
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedType, setSelectedType] = useState("all"); // "all" | "walkin" | "appointment"
  const [selectedStatus, setSelectedStatus] = useState("all"); // "all" | "completed" | "serving" | "waiting" | "cancelled"

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Selected visit for modal inspection
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg, type = "info") => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // 1. Fetch live historical visits and appointments
  const loadHistoryData = useCallback(async (isSilent = false) => {
    if (!effectiveHospitalCode) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setFetchError(null);

    try {
      // Parallel fetch for visits and appointments
      const [visitsRes, apptsRes] = await Promise.allSettled([
        apiFetch(`${API_BASE}/api/v1/hospitals/${encodeURIComponent(effectiveHospitalCode)}/visits?limit=1000`),
        apiFetch(`${API_BASE}/api/v1/plugin/appointments/tenant/${encodeURIComponent(effectiveHospitalCode)}`),
      ]);

      let visitsData = [];
      if (visitsRes.status === "fulfilled" && visitsRes.value?.ok) {
        const body = await visitsRes.value.json().catch(() => ({}));
        if (body.status === "success" && Array.isArray(body.visits)) {
          visitsData = body.visits;
        }
      } else if (visitsRes.status === "rejected") {
        console.warn("Visits fetch rejected:", visitsRes.reason);
      }

      let apptsData = [];
      if (apptsRes.status === "fulfilled" && apptsRes.value?.ok) {
        const body = await apptsRes.value.json().catch(() => ({}));
        if (body.status === "success" && Array.isArray(body.appointments)) {
          apptsData = body.appointments;
        }
      } else if (apptsRes.status === "rejected") {
        console.warn("Appointments fetch rejected:", apptsRes.reason);
      }

      setVisits(visitsData);
      setAppointments(apptsData);
      setFetchError(null);
    } catch (err) {
      console.error("Failed to load reception history:", err);
      setFetchError(err.message || "Failed to load patient history records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveHospitalCode]);

  useEffect(() => {
    loadHistoryData();
  }, [loadHistoryData]);

  // 2. Unify visits and unlinked appointments into consistent records
  const unifiedRecords = useMemo(() => {
    const list = [];
    const seenTicketIds = new Set();
    const seenApptIds = new Set();

    // Map visits first
    visits.forEach((v) => {
      const ticketId = v.ticket_id || v.token_number;
      if (ticketId) seenTicketIds.add(ticketId);
      if (v.appointment_id) seenApptIds.add(v.appointment_id);

      const isAppt = Boolean(v.appointment_id) || (v.source || "").toLowerCase().includes("appointment");
      list.push({
        id: `ticket_${v.id || ticketId}`,
        rawId: v.id,
        ticketId: ticketId,
        appointmentId: v.appointment_id || null,
        tokenNumber: v.token_number || ticketId,
        patientName: v.patient_name || "Unknown Patient",
        phone: v.phone || "",
        gender: v.gender || "",
        age: v.age || null,
        department: v.department || "General OPD",
        deptCode: v.dept_code || "consultation",
        doctorName: v.served_by_doctor_name || v.doctor_name || (v.transfer_stages?.[0]?.served_by) || "Attending Physician",
        type: isAppt ? "appointment" : "walkin",
        status: (v.status || "completed").toLowerCase(),
        joinTime: v.join_time || v.created_at,
        startTime: v.serve_start_time || null,
        endTime: v.serve_end_time || null,
        durationMinutes: v.service_duration_minutes || null,
        createdAt: v.created_at || v.join_time,
        queueDate: v.queue_date || (v.created_at ? v.created_at.split("T")[0] : null),
        transferStages: Array.isArray(v.transfer_stages) ? v.transfer_stages : [],
        isTransferred: Boolean(v.is_transferred),
        transferTrail: v.transfer_trail || null,
        notes: v.prescription_notes || "",
        cancellationReason: v.cancellation_reason || null,
        rawVisit: v,
      });
    });

    // Append appointments that weren't represented as tickets
    appointments.forEach((apt) => {
      const aptId = apt.appointment_id || apt.id;
      if (seenApptIds.has(aptId)) return;
      if (apt.ticket_id && seenTicketIds.has(apt.ticket_id)) return;

      const aptStatus = (apt.status || "booked").toLowerCase();
      list.push({
        id: `appt_${aptId}`,
        rawId: apt.id,
        ticketId: apt.ticket_id || null,
        appointmentId: aptId,
        tokenNumber: apt.ticket_id || aptId,
        patientName: apt.patient_name || apt.name || "Patient",
        phone: apt.phone || apt.patient_phone || "",
        gender: apt.gender || "",
        age: apt.age || null,
        department: apt.department_name || apt.department || "General OPD",
        deptCode: apt.department_code || "consultation",
        doctorName: apt.doctor_name || "Scheduled Doctor",
        type: "appointment",
        status: aptStatus,
        joinTime: apt.appointment_date || apt.created_at,
        startTime: apt.time_slot || null,
        endTime: null,
        durationMinutes: null,
        createdAt: apt.created_at,
        queueDate: apt.appointment_date ? apt.appointment_date.split("T")[0] : null,
        transferStages: [],
        isTransferred: false,
        transferTrail: null,
        notes: apt.notes || apt.reason || "",
        cancellationReason: apt.cancellation_reason || null,
        rawAppt: apt,
      });
    });

    // Sort descending by date/time
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.joinTime || 0).getTime();
      const timeB = new Date(b.createdAt || b.joinTime || 0).getTime();
      return timeB - timeA;
    });
  }, [visits, appointments]);

  // Extract unique doctor names for filter dropdown
  const availableDoctors = useMemo(() => {
    const set = new Set();
    unifiedRecords.forEach((r) => {
      if (r.doctorName && r.doctorName !== "Attending Physician" && r.doctorName !== "Scheduled Doctor") {
        set.add(r.doctorName.trim());
      }
    });
    return Array.from(set).sort();
  }, [unifiedRecords]);

  // Extract unique departments for filter dropdown
  const availableDepartments = useMemo(() => {
    const set = new Set();
    departments.forEach((d) => set.add(d.name || d.label));
    unifiedRecords.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [departments, unifiedRecords]);

  // Helper date checker
  const checkDateMatch = useCallback((record, filter, startCustom, endCustom) => {
    if (filter === "all") return true;

    const recordDateStr = record.queueDate || (record.createdAt ? record.createdAt.split("T")[0] : "");
    if (!recordDateStr) return true;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (filter === "today") {
      return recordDateStr === todayStr;
    }

    if (filter === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      return recordDateStr === yesterdayStr;
    }

    if (filter === "7days") {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 7);
      const past7Str = past7.toISOString().split("T")[0];
      return recordDateStr >= past7Str && recordDateStr <= todayStr;
    }

    if (filter === "30days") {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 30);
      const past30Str = past30.toISOString().split("T")[0];
      return recordDateStr >= past30Str && recordDateStr <= todayStr;
    }

    if (filter === "custom") {
      if (startCustom && recordDateStr < startCustom) return false;
      if (endCustom && recordDateStr > endCustom) return false;
      return true;
    }

    return true;
  }, []);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter((record) => {
      // 1. Date Range
      if (!checkDateMatch(record, dateRangeFilter, customStartDate, customEndDate)) {
        return false;
      }

      // 2. Department
      if (selectedDept !== "all") {
        const d = (record.department || "").toLowerCase();
        if (d !== selectedDept.toLowerCase()) return false;
      }

      // 3. Doctor
      if (selectedDoctor !== "all") {
        const doc = (record.doctorName || "").toLowerCase();
        if (doc !== selectedDoctor.toLowerCase()) return false;
      }

      // 4. Visit Type
      if (selectedType !== "all") {
        if (record.type !== selectedType) return false;
      }

      // 5. Status
      if (selectedStatus !== "all") {
        const s = record.status;
        if (selectedStatus === "completed" && s !== "completed") return false;
        if (selectedStatus === "serving" && !["serving", "in_progress"].includes(s)) return false;
        if (selectedStatus === "waiting" && s !== "waiting") return false;
        if (selectedStatus === "cancelled" && !["cancelled", "no_show"].includes(s)) return false;
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = (record.patientName || "").toLowerCase();
        const phone = (record.phone || "").toLowerCase();
        const token = String(record.tokenNumber || "").toLowerCase();
        const doc = (record.doctorName || "").toLowerCase();
        const dept = (record.department || "").toLowerCase();
        if (
          !name.includes(q) &&
          !phone.includes(q) &&
          !token.includes(q) &&
          !doc.includes(q) &&
          !dept.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    unifiedRecords,
    checkDateMatch,
    dateRangeFilter,
    customStartDate,
    customEndDate,
    selectedDept,
    selectedDoctor,
    selectedType,
    selectedStatus,
    searchQuery,
  ]);

  // Summary Metrics computed from the active filtered slice
  const kpiMetrics = useMemo(() => {
    const total = filteredRecords.length;
    let completed = 0;
    let cancelled = 0;
    let walkinCount = 0;
    let apptCount = 0;

    filteredRecords.forEach((r) => {
      if (r.status === "completed") completed++;
      if (r.status === "cancelled" || r.status === "no_show") cancelled++;
      if (r.type === "walkin") walkinCount++;
      if (r.type === "appointment") apptCount++;
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      cancelled,
      walkinCount,
      apptCount,
      completionRate,
    };
  }, [filteredRecords]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;

  // Handle Export to CSV
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      showToast(isHi ? "निर्यात करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।" : "No records available to export.", "info");
      return;
    }

    const headers = [
      "Token/ID",
      "Date",
      "Time",
      "Patient Name",
      "Age",
      "Gender",
      "Phone",
      "Department",
      "Doctor",
      "Type",
      "Status",
      "Duration (mins)",
      "Notes",
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.tokenNumber || ""}"`,
      `"${r.queueDate || ""}"`,
      `"${r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : ""}"`,
      `"${r.patientName || ""}"`,
      `"${r.age || ""}"`,
      `"${r.gender || ""}"`,
      `"${r.phone || ""}"`,
      `"${r.department || ""}"`,
      `"${r.doctorName || ""}"`,
      `"${r.type === "walkin" ? "Walk-In" : "Appointment"}"`,
      `"${(r.status || "").toUpperCase()}"`,
      `"${r.durationMinutes ?? ""}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reception_History_${effectiveHospitalCode}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(isHi ? "CSV फ़ाइल सफलतापूर्वक डाउनलोड की गई!" : "CSV report exported successfully!", "success");
  }, [filteredRecords, effectiveHospitalCode, isHi, showToast]);

  // Handle Reprint
  const handleReprintRecord = useCallback((record) => {
    try {
      if (record.rawAppt && !record.rawVisit) {
        printAppointmentRecord(record.rawAppt, hospitalBranding);
      } else {
        const ticketPayload = record.rawVisit || {
          ticket_id: record.tokenNumber,
          name: record.patientName,
          phone: record.phone,
          gender: record.gender,
          age: record.age,
          departments: { name: record.department, dept_code: record.deptCode },
          priority_level: 2,
          created_at: record.createdAt,
        };
        printTokenPass(ticketPayload, hospitalBranding);
      }
      showToast(isHi ? "मुद्रण प्रारंभ किया गया..." : "Printing pass triggered...", "info");
    } catch (e) {
      console.error("Print error:", e);
      showToast(`Print failed: ${e.message}`, "error");
    }
  }, [hospitalBranding, isHi, showToast]);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setDateRangeFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setSearchQuery("");
    setSelectedDept("all");
    setSelectedDoctor("all");
    setSelectedType("all");
    setSelectedStatus("all");
    setCurrentPage(1);
  }, []);

  // UI Theme tokens matching PharmacyPage.jsx
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const cardBorder = isDark ? "1px solid #334155" : "1.5px solid #E2E8F0";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";

  return (
    <div
      className="reception-history-container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 999999,
            background:
              toastMessage.type === "success"
                ? "#10B981"
                : toastMessage.type === "error"
                ? "#EF4444"
                : "#0284C7",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
            fontSize: "13px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {toastMessage.type === "success" && <CheckCircle2 size={16} />}
          {toastMessage.type === "error" && <AlertCircle size={16} />}
          {toastMessage.type === "info" && <History size={16} />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* 1. SUMMARY KPI STRIP */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "14px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* KPI 1: Total Records */}
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {isHi ? "कुल विज़िट रिकॉर्ड" : "Total Visit Records"}
            </span>
            <History size={16} color="#0284C7" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: textColor, marginTop: "6px" }}>
            {kpiMetrics.total}
          </div>
          <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
            {isHi ? "चयनित फ़िल्टर के अनुसार कुल मरीज़" : "Total visits matching active filters"}
          </div>
        </div>

        {/* KPI 2: Completed */}
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {isHi ? "पूर्ण परामर्श" : "Completed Consultations"}
            </span>
            <CheckCircle2 size={16} color="#10B981" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#10B981", marginTop: "6px" }}>
            {kpiMetrics.completed}
          </div>
          <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
            {kpiMetrics.completionRate}% {isHi ? "सफलता दर" : "fulfillment rate"}
          </div>
        </div>

        {/* KPI 3: Cancelled / No-Show */}
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {isHi ? "रद्द / अनुपस्थित" : "Cancelled / No-Show"}
            </span>
            <XCircle size={16} color="#EF4444" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#EF4444", marginTop: "6px" }}>
            {kpiMetrics.cancelled}
          </div>
          <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
            {isHi ? "निरस्त या अनुपस्थित टोकन" : "Missed or cancelled slots"}
          </div>
        </div>

        {/* KPI 4: Walk-in vs. Appointment */}
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {isHi ? "प्रकार वितरण" : "Intake Breakdown"}
            </span>
            <CalendarCheck size={16} color="#8B5CF6" />
          </div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: textColor, marginTop: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "#0284C7" }}>{kpiMetrics.walkinCount} <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText }}>Walk-in</span></span>
            <span style={{ color: mutedText, fontSize: "14px" }}>•</span>
            <span style={{ color: "#8B5CF6" }}>{kpiMetrics.apptCount} <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText }}>Appt</span></span>
          </div>
          <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
            {isHi ? "वॉक-इन बनाम पूर्व-आरक्षित" : "Walk-in vs booked schedule"}
          </div>
        </div>
      </div>

      {/* 2. MAIN TABLE CARD WITH FILTER CONTROLS */}
      <div
        style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: "18px",
          padding: "24px",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        {/* Header Title & Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 800,
                color: textColor,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <History size={18} color="#0284C7" />
              <span>
                {isHi
                  ? "रिसेप्शन मरीज़ विज़िट एवं टोकन इतिहास"
                  : "Reception Patient Visit, Token & Appointment History"}
              </span>
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: mutedText }}>
              {isHi
                ? "इस अस्पताल के सभी वॉक-इन टोकन, अपॉइंटमेंट्स और परामर्श चरणों का पूर्ण ऑडिट रिकॉर्ड।"
                : "Comprehensive audit trail for all walk-in tokens, scheduled appointments, and clinic visits."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadHistoryData(true)}
              disabled={refreshing}
              style={{
                background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                border: isDark ? "1px solid rgba(2, 132, 199, 0.3)" : "1px solid #BAE6FD",
                color: "#0284C7",
                padding: "8px 14px",
                borderRadius: "9px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: refreshing ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              title={isHi ? "डेटा रीफ्रेश करें" : "Refresh history data"}
            >
              <RefreshCw size={13} className={refreshing ? "spin-animation" : ""} />
              <span>{isHi ? "रीफ्रेश" : "Refresh"}</span>
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #A7F3D0",
                color: "#10B981",
                padding: "8px 14px",
                borderRadius: "9px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              title={isHi ? "CSV फ़ाइल में निर्यात करें" : "Export filtered records to CSV"}
            >
              <Download size={13} />
              <span>{isHi ? "एक्सपोर्ट CSV" : "Export CSV"}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Toolbar */}
        <div
          style={{
            marginBottom: "20px",
            padding: "16px",
            borderRadius: "14px",
            background: isDark ? "#0B1120" : "#F8FAFC",
            border: cardBorder,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            boxSizing: "border-box",
            width: "100%",
          }}
        >
          {/* Row 1: Date Range Presets */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: mutedText,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginRight: "4px",
                }}
              >
                {isHi ? "तिथि:" : "Date:"}
              </span>

              {/* All Dates */}
              <button
                type="button"
                onClick={() => {
                  setDateRangeFilter("all");
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: dateRangeFilter === "all" ? (isDark ? "#38BDF8" : "#0284C7") : "transparent",
                  color: dateRangeFilter === "all" ? "#FFFFFF" : textColor,
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isHi ? "सभी तिथियां" : "All Dates"}
              </button>

              {/* Today */}
              <button
                type="button"
                onClick={() => {
                  setDateRangeFilter("today");
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: dateRangeFilter === "today" ? "#10B981" : "transparent",
                  color: dateRangeFilter === "today" ? "#FFFFFF" : textColor,
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isHi ? "आज (Today)" : "Today"}
              </button>

              {/* Yesterday */}
              <button
                type="button"
                onClick={() => {
                  setDateRangeFilter("yesterday");
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: dateRangeFilter === "yesterday" ? "#F59E0B" : "transparent",
                  color: dateRangeFilter === "yesterday" ? "#FFFFFF" : textColor,
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isHi ? "कल (Yesterday)" : "Yesterday"}
              </button>

              {/* Last 7 Days */}
              <button
                type="button"
                onClick={() => {
                  setDateRangeFilter("7days");
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: dateRangeFilter === "7days" ? "#6366F1" : "transparent",
                  color: dateRangeFilter === "7days" ? "#FFFFFF" : textColor,
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isHi ? "पिछले 7 दिन" : "Last 7 Days"}
              </button>

              {/* Last 30 Days */}
              <button
                type="button"
                onClick={() => {
                  setDateRangeFilter("30days");
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: dateRangeFilter === "30days" ? "#8B5CF6" : "transparent",
                  color: dateRangeFilter === "30days" ? "#FFFFFF" : textColor,
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isHi ? "पिछले 30 दिन" : "Last 30 Days"}
              </button>

              {/* Custom Date Range Toggle */}
              <button
                type="button"
                onClick={() => {
                  setDateRangeFilter("custom");
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: dateRangeFilter === "custom" ? (isDark ? "#38BDF8" : "#0284C7") : "transparent",
                  color: dateRangeFilter === "custom" ? "#FFFFFF" : textColor,
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Calendar size={12} />
                <span>{isHi ? "कस्टम तारीख" : "Custom Range"}</span>
              </button>

              {/* Custom Date Pickers */}
              {dateRangeFilter === "custom" && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "4px" }}>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "7px",
                      border: cardBorder,
                      background: isDark ? "#1E293B" : "#FFFFFF",
                      color: textColor,
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: "11px", color: mutedText }}>to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "7px",
                      border: cardBorder,
                      background: isDark ? "#1E293B" : "#FFFFFF",
                      color: textColor,
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Reset Filters */}
            {(dateRangeFilter !== "all" ||
              selectedDept !== "all" ||
              selectedDoctor !== "all" ||
              selectedType !== "all" ||
              selectedStatus !== "all" ||
              searchQuery.trim()) && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  background: "none",
                  border: "none",
                  color: "#EF4444",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 8px",
                }}
                title={isHi ? "सभी फ़िल्टर रीसेट करें" : "Reset all filters"}
              >
                <RotateCcw size={12} />
                <span>{isHi ? "फ़िल्टर रीसेट" : "Reset Filters"}</span>
              </button>
            )}
          </div>

          {/* Row 2: Secondary Dropdowns & Search Input */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: 1 }}>
              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "7px 11px",
                  borderRadius: "9px",
                  border: cardBorder,
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: textColor,
                  fontSize: "11.5px",
                  fontWeight: 700,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">{isHi ? "सभी प्रकार (Walk-in + Appt)" : "All Visit Types"}</option>
                <option value="walkin">{isHi ? "केवल वॉक-इन (Walk-In)" : "Walk-In Tokens"}</option>
                <option value="appointment">{isHi ? "केवल अपॉइंटमेंट (Appointments)" : "Appointments"}</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "7px 11px",
                  borderRadius: "9px",
                  border: cardBorder,
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: textColor,
                  fontSize: "11.5px",
                  fontWeight: 700,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">{isHi ? "सभी स्थितियां (All Status)" : "All Status"}</option>
                <option value="completed">{isHi ? "पूर्ण (Completed)" : "Completed"}</option>
                <option value="serving">{isHi ? "सक्रिय / सेवा जारी (Serving)" : "Serving / In Progress"}</option>
                <option value="waiting">{isHi ? "प्रतीक्षारत (Waiting)" : "Waiting in Queue"}</option>
                <option value="cancelled">{isHi ? "रद्द / अनुपस्थित (Cancelled)" : "Cancelled / No-Show"}</option>
              </select>

              {/* Department Filter */}
              {availableDepartments.length > 0 && (
                <select
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "7px 11px",
                    borderRadius: "9px",
                    border: cardBorder,
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    color: textColor,
                    fontSize: "11.5px",
                    fontWeight: 700,
                    outline: "none",
                    cursor: "pointer",
                    maxWidth: "180px",
                  }}
                >
                  <option value="all">{isHi ? "सभी विभाग (All Depts)" : "All Departments"}</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              )}

              {/* Doctor Filter */}
              {availableDoctors.length > 0 && (
                <select
                  value={selectedDoctor}
                  onChange={(e) => {
                    setSelectedDoctor(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "7px 11px",
                    borderRadius: "9px",
                    border: cardBorder,
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    color: textColor,
                    fontSize: "11.5px",
                    fontWeight: 700,
                    outline: "none",
                    cursor: "pointer",
                    maxWidth: "180px",
                  }}
                >
                  <option value="all">{isHi ? "सभी चिकित्सक (All Doctors)" : "All Clinicians"}</option>
                  {availableDoctors.map((doc) => (
                    <option key={doc} value={doc}>
                      {doc}
                    </option>
                  ))}
                </select>
              )}

              {/* Search Box */}
              <div style={{ position: "relative", minWidth: "min(220px, 100%)", flex: "1 1 220px", maxWidth: "min(340px, 100%)" }}>
                <Search
                  size={13}
                  color={mutedText}
                  style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  type="text"
                  placeholder={isHi ? "मरीज़ नाम, फ़ोन, टोकन नंबर..." : "Search patient, phone, token #..."}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "7px 28px 7px 32px",
                    borderRadius: "9px",
                    border: cardBorder,
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    color: textColor,
                    fontSize: "11.5px",
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: mutedText,
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Items Per Page Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: mutedText }}>{isHi ? "दिखाएं:" : "Show:"}</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: "5px 8px",
                  borderRadius: "7px",
                  border: cardBorder,
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: textColor,
                  fontSize: "11px",
                  fontWeight: 700,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. TABLE / LIST VIEW */}
        {loading ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <RefreshCw size={28} className="spin-animation" color="#0284C7" />
            <span style={{ fontSize: "14px", fontWeight: 700, color: mutedText }}>
              {isHi ? "इतिहास रिकॉर्ड लोड हो रहे हैं..." : "Loading patient visit history..."}
            </span>
          </div>
        ) : fetchError ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              background: isDark ? "rgba(239, 68, 68, 0.1)" : "#FEF2F2",
              border: "1px solid #FCA5A5",
              borderRadius: "14px",
            }}
          >
            <AlertCircle size={32} color="#EF4444" style={{ marginBottom: "8px" }} />
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#EF4444" }}>
              {fetchError}
            </div>
            <button
              type="button"
              onClick={() => loadHistoryData(false)}
              style={{
                marginTop: "12px",
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                background: "#EF4444",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isHi ? "पुनः प्रयास करें" : "Retry"}
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <History size={40} color={isDark ? "#475569" : "#CBD5E1"} />
            <div style={{ fontSize: "15px", fontWeight: 800, color: textColor }}>
              {isHi ? "कोई इतिहास रिकॉर्ड नहीं मिला" : "No visit records found"}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: mutedText, maxWidth: "420px" }}>
              {isHi
                ? "चयनित तिथि या फ़िल्टर के साथ कोई रिकॉर्ड मेल नहीं खाता। कृपया फ़िल्टर बदलें या रीसेट करें।"
                : "No visits match the current filter criteria or date range. Try selecting 'All Dates' or resetting filters."}
            </p>
            {(dateRangeFilter !== "all" || searchQuery || selectedStatus !== "all" || selectedType !== "all") && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  marginTop: "8px",
                  padding: "6px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isHi ? "सभी फ़िल्टर साफ़ करें" : "Clear All Filters"}
              </button>
            )}
          </div>
        ) : (
          <div
            className="staff-table-scroll-wrapper table-scroll-region"
            tabIndex={0}
            role="region"
            aria-label={isHi ? "रिसेप्शन विज़िट इतिहास तालिका" : "Reception visit history table"}
            style={{
              border: cardBorder,
              background: cardBg,
              borderRadius: "14px",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: "1050px",
                borderCollapse: "collapse",
                fontSize: "12.5px",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: isDark ? "#1E293B" : "#F8FAFC",
                    borderBottom: `2px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                    color: mutedText,
                    fontWeight: 800,
                  }}
                >
                  <th style={{ padding: "12px 14px" }}>{isHi ? "टोकन / तिथि" : "TOKEN & DATE/TIME"}</th>
                  <th style={{ padding: "12px 14px" }}>{isHi ? "मरीज़ विवरण" : "PATIENT DETAILS"}</th>
                  <th style={{ padding: "12px 14px" }}>{isHi ? "विभाग एवं चिकित्सक" : "DEPARTMENT & CLINICIAN"}</th>
                  <th style={{ padding: "12px 14px" }}>{isHi ? "प्रकार" : "VISIT TYPE"}</th>
                  <th style={{ padding: "12px 14px" }}>{isHi ? "समय एवं अवधि" : "CHECK-IN / TIMING"}</th>
                  <th style={{ padding: "12px 14px" }}>{isHi ? "स्थिति" : "STATUS"}</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>{isHi ? "कार्यवाही" : "ACTIONS"}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((r, idx) => {
                  const isCompleted = r.status === "completed";
                  const isCancelled = r.status === "cancelled" || r.status === "no_show";
                  const isServing = r.status === "serving" || r.status === "in_progress";

                  const statusColor = isCompleted
                    ? "#10B981"
                    : isCancelled
                    ? "#EF4444"
                    : isServing
                    ? "#0284C7"
                    : "#F59E0B";

                  const statusBg = isCompleted
                    ? isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5"
                    : isCancelled
                    ? isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2"
                    : isServing
                    ? isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE"
                    : isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB";

                  return (
                    <tr
                      key={r.id || idx}
                      className="staff-table-row"
                      style={{
                        borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
                      }}
                    >
                      {/* 1. Token & Date/Time */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 900,
                              fontSize: "12.5px",
                              background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                              color: "#0284C7",
                              padding: "2px 7px",
                              borderRadius: "6px",
                            }}
                          >
                            #{r.tokenNumber}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: mutedText, marginTop: "4px" }}>
                          {r.queueDate || (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—")}
                          {r.createdAt && (
                            <span style={{ marginLeft: "4px" }}>
                              • {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Patient Details */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 800, color: textColor, fontSize: "13px" }}>
                          {r.patientName}
                        </div>
                        <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                          {r.age ? `${r.age}y` : ""}
                          {r.gender ? `• ${r.gender}` : ""}
                          {r.phone && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              • <Phone size={10} /> {r.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Department & Doctor */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700, color: textColor, display: "flex", alignItems: "center", gap: "5px" }}>
                          <Building2 size={12} color="#0284C7" />
                          <span>{r.department}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Stethoscope size={11} />
                          <span>{r.doctorName}</span>
                        </div>
                        {r.isTransferred && r.transferTrail && (
                          <div style={{ fontSize: "10px", color: "#F59E0B", marginTop: "3px", fontWeight: 700 }}>
                            ↳ {r.transferTrail}
                          </div>
                        )}
                      </td>

                      {/* 4. Visit Type */}
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background:
                              r.type === "walkin"
                                ? isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE"
                                : isDark ? "rgba(139, 92, 246, 0.15)" : "#EDE9FE",
                            color: r.type === "walkin" ? "#0284C7" : "#8B5CF6",
                          }}
                        >
                          {r.type === "walkin" ? <Ticket size={11} /> : <CalendarCheck size={11} />}
                          <span>{r.type === "walkin" ? "Walk-In" : "Appointment"}</span>
                        </span>
                      </td>

                      {/* 5. Check-in / Service Duration */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: textColor, fontSize: "12px" }}>
                          <Clock size={12} color={mutedText} />
                          <span>
                            {r.startTime
                              ? `${new Date(r.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                              : r.joinTime
                              ? `${new Date(r.joinTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                              : "—"}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                          {r.durationMinutes != null
                            ? `${r.durationMinutes} min consult`
                            : isCompleted
                            ? "Completed"
                            : isCancelled
                            ? "Cancelled"
                            : "Waiting/Active"}
                        </div>
                      </td>

                      {/* 6. Status Badge */}
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: statusBg,
                            color: statusColor,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: statusColor,
                            }}
                          />
                          <span>{r.status}</span>
                        </span>
                      </td>

                      {/* 7. Actions */}
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {/* View Details Modal */}
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(r)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "7px",
                              border: cardBorder,
                              background: isDark ? "#1E293B" : "#FFFFFF",
                              color: "#0284C7",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title={isHi ? "विस्तृत विवरण देखें" : "View visit details"}
                          >
                            <Eye size={12} />
                            <span>{isHi ? "विवरण" : "Details"}</span>
                          </button>

                          {/* Reprint Slip */}
                          <button
                            type="button"
                            onClick={() => handleReprintRecord(r)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "7px",
                              border: cardBorder,
                              background: isDark ? "#1E293B" : "#FFFFFF",
                              color: textColor,
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title={isHi ? "टोकन पर्ची पुनः प्रिंट करें" : "Reprint token pass"}
                          >
                            <Printer size={12} />
                            <span>{isHi ? "प्रिंट" : "Slip"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. PAGINATION FOOTER */}
        {!loading && filteredRecords.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: cardBorder,
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "12px", color: mutedText }}>
              {isHi ? "दिखाए जा रहे हैं" : "Showing"}{" "}
              <strong style={{ color: textColor }}>
                {Math.min(filteredRecords.length, (currentPage - 1) * itemsPerPage + 1)}
              </strong>{" "}
              -{" "}
              <strong style={{ color: textColor }}>
                {Math.min(filteredRecords.length, currentPage * itemsPerPage)}
              </strong>{" "}
              of <strong style={{ color: textColor }}>{filteredRecords.length}</strong> {isHi ? "रिकॉर्ड" : "records"}
            </div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "5px 10px",
                  borderRadius: "7px",
                  border: cardBorder,
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: currentPage === 1 ? mutedText : textColor,
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ChevronLeft size={14} />
                <span>{isHi ? "पिछला" : "Prev"}</span>
              </button>

              <span style={{ fontSize: "12px", fontWeight: 700, color: textColor, padding: "0 8px" }}>
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                style={{
                  padding: "5px 10px",
                  borderRadius: "7px",
                  border: cardBorder,
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: currentPage >= totalPages ? mutedText : textColor,
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>{isHi ? "अगला" : "Next"}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. VISIT DETAIL MODAL */}
      {selectedRecord && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "20px",
            boxSizing: "border-box",
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: "20px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              color: textColor,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: cardBorder,
                paddingBottom: "16px",
                marginBottom: "18px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                      color: "#0284C7",
                      padding: "3px 10px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 900,
                      fontFamily: "monospace",
                    }}
                  >
                    Token #{selectedRecord.tokenNumber}
                  </span>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900 }}>
                    {selectedRecord.patientName}
                  </h2>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background:
                        selectedRecord.status === "completed"
                          ? isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5"
                          : isDark ? "rgba(239, 68, 68, 0.2)" : "#FEF2F2",
                      color: selectedRecord.status === "completed" ? "#10B981" : "#EF4444",
                      textTransform: "uppercase",
                    }}
                  >
                    {selectedRecord.status}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: mutedText, marginTop: "6px" }}>
                  {selectedRecord.age ? `${selectedRecord.age} yrs` : ""}
                  {selectedRecord.gender ? ` • ${selectedRecord.gender}` : ""}
                  {selectedRecord.phone ? ` • Phone: ${selectedRecord.phone}` : ""}
                  {selectedRecord.queueDate ? ` • Date: ${selectedRecord.queueDate}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: isDark ? "#1E293B" : "#F1F5F9",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  color: mutedText,
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Information Grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Grid 1: Basic Visit Metadata */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                  padding: "14px",
                  borderRadius: "12px",
                  background: isDark ? "#0B1120" : "#F8FAFC",
                  border: cardBorder,
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: mutedText, fontWeight: 700 }}>Department</div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: textColor, marginTop: "2px" }}>
                    {selectedRecord.department}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", color: mutedText, fontWeight: 700 }}>Attending Clinician</div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: textColor, marginTop: "2px" }}>
                    {selectedRecord.doctorName}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", color: mutedText, fontWeight: 700 }}>Visit Type</div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: textColor, marginTop: "2px" }}>
                    {selectedRecord.type === "walkin" ? "Walk-In Token" : "Booked Appointment"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", color: mutedText, fontWeight: 700 }}>Service Duration</div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: textColor, marginTop: "2px" }}>
                    {selectedRecord.durationMinutes != null ? `${selectedRecord.durationMinutes} minutes` : "—"}
                  </div>
                </div>
              </div>

              {/* Grid 2: Care Pathway / Transfer Stages if present */}
              {selectedRecord.transferStages.length > 0 && (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    background: isDark ? "#0B1120" : "#F8FAFC",
                    border: cardBorder,
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 800, color: textColor, marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <ArrowRight size={14} color="#0284C7" />
                    <span>Care Pathway & Department Consultation Stages</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedRecord.transferStages.map((stage, sIdx) => (
                      <div
                        key={sIdx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: isDark ? "#1E293B" : "#FFFFFF",
                          border: cardBorder,
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background: "#0284C7",
                              color: "#FFFFFF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10.5px",
                              fontWeight: 900,
                            }}
                          >
                            {stage.stage_number || sIdx + 1}
                          </span>
                          <span style={{ fontWeight: 800, color: textColor }}>{stage.department}</span>
                          {stage.served_by && (
                            <span style={{ color: mutedText, fontSize: "11px" }}>({stage.served_by})</span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: stage.status === "completed" ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5") : (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"),
                            color: stage.status === "completed" ? "#10B981" : "#0284C7",
                          }}
                        >
                          {stage.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancellation Reason if applicable */}
              {selectedRecord.cancellationReason && (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    background: isDark ? "rgba(239, 68, 68, 0.1)" : "#FEF2F2",
                    border: "1px solid #FCA5A5",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#EF4444", textTransform: "uppercase" }}>
                    Cancellation Reason
                  </div>
                  <div style={{ fontSize: "13px", color: textColor, marginTop: "4px", fontWeight: 600 }}>
                    {selectedRecord.cancellationReason}
                  </div>
                </div>
              )}

              {/* Consultation / Clinical Notes & Prescriptions (Clean Formatted Display) */}
              {selectedRecord.notes && (
                (() => {
                  const parsedSections = parseClinicalNotes(selectedRecord.notes);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ fontSize: "11.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileText size={14} color="#0284C7" />
                        <span>{isHi ? "नैदानिक परामर्श एवं दवा वितरण पर्ची" : "Clinical Consultation & Doctor Prescriptions"}</span>
                      </div>

                      {parsedSections.map((sec, sIdx) => {
                        const { dept, isJson, data, text } = sec;

                        if (!isJson) {
                          return (
                            <div
                              key={sIdx}
                              style={{
                                padding: "14px",
                                borderRadius: "12px",
                                background: isDark ? "#0B1120" : "#F8FAFC",
                                border: cardBorder,
                              }}
                            >
                              <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", marginBottom: "4px" }}>
                                {dept}
                              </div>
                              <div style={{ fontSize: "12.5px", color: textColor, lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                                {text}
                              </div>
                            </div>
                          );
                        }

                        const medicines = Array.isArray(data.medicines) ? data.medicines : [];
                        const isPharmaDept = (dept || "").toLowerCase().includes("pharm");

                        return (
                          <div
                            key={sIdx}
                            style={{
                              padding: "16px",
                              borderRadius: "14px",
                              background: isDark ? "#0B1120" : "#F8FAFC",
                              border: cardBorder,
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                            }}
                          >
                            {/* Section Header: Department Badge & Doctor Name */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", borderBottom: cardBorder, paddingBottom: "10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span
                                  style={{
                                    background: isPharmaDept
                                      ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5")
                                      : (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"),
                                    color: isPharmaDept ? "#10B981" : "#0284C7",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  {isPharmaDept ? <Pill size={11} /> : <Stethoscope size={11} />}
                                  <span>{dept}</span>
                                </span>
                                {data.diagnosis && (
                                  <span style={{ fontSize: "12.5px", fontWeight: 800, color: textColor }}>
                                    {data.diagnosis}
                                  </span>
                                )}
                              </div>

                              {data.doctor_name && (
                                <div style={{ fontSize: "11.5px", color: mutedText, display: "flex", alignItems: "center", gap: "4px" }}>
                                  <User size={12} color="#0284C7" />
                                  <strong style={{ color: textColor }}>{data.doctor_name}</strong>
                                  {data.doctor_employee_id && (
                                    <span style={{ fontSize: "10.5px", color: mutedText }}>({data.doctor_employee_id})</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Medicines List / Table */}
                            {medicines.length > 0 && (
                              <div>
                                <div style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <Pill size={12} color="#10B981" />
                                  <span>{isHi ? `निर्धारित दवाइयां (${medicines.length})` : `Prescribed Medicines (${medicines.length})`}</span>
                                </div>
                                <div
                                  style={{
                                    border: cardBorder,
                                    borderRadius: "10px",
                                    overflow: "hidden",
                                    background: isDark ? "#1E293B" : "#FFFFFF",
                                  }}
                                >
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                                    <thead>
                                      <tr style={{ background: isDark ? "#0F172A" : "#F1F5F9", borderBottom: cardBorder, color: mutedText, fontSize: "10.5px", fontWeight: 800 }}>
                                        <th style={{ padding: "8px 10px" }}>{isHi ? "दवा का नाम" : "MEDICINE"}</th>
                                        <th style={{ padding: "8px 10px" }}>{isHi ? "खुराक" : "DOSAGE"}</th>
                                        <th style={{ padding: "8px 10px" }}>{isHi ? "आवृत्ति" : "FREQUENCY"}</th>
                                        <th style={{ padding: "8px 10px" }}>{isHi ? "अवधि" : "DURATION"}</th>
                                        <th style={{ padding: "8px 10px" }}>{isHi ? "निर्देश" : "INSTRUCTIONS"}</th>
                                        {isPharmaDept && <th style={{ padding: "8px 10px", textAlign: "right" }}>{isHi ? "स्थिति" : "STATUS"}</th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {medicines.map((med, mIdx) => {
                                        const isDispensed = med.dispensed || med.given || med.status === "dispensed" || med.dispense_status === "given";
                                        return (
                                          <tr key={mIdx} style={{ borderBottom: mIdx < medicines.length - 1 ? cardBorder : "none" }}>
                                            <td style={{ padding: "8px 10px", fontWeight: 800, color: textColor }}>
                                              {med.name}
                                            </td>
                                            <td style={{ padding: "8px 10px", color: textColor }}>
                                              {med.dosage || "—"}
                                            </td>
                                            <td style={{ padding: "8px 10px", color: textColor, fontWeight: 700 }}>
                                              {med.frequency || "—"}
                                            </td>
                                            <td style={{ padding: "8px 10px", color: mutedText }}>
                                              {med.duration || "—"}
                                            </td>
                                            <td style={{ padding: "8px 10px", color: mutedText, fontSize: "11px" }}>
                                              {med.instructions || "—"}
                                            </td>
                                            {isPharmaDept && (
                                              <td style={{ padding: "8px 10px", textAlign: "right" }}>
                                                <span
                                                  style={{
                                                    fontSize: "10px",
                                                    fontWeight: 800,
                                                    padding: "2px 6px",
                                                    borderRadius: "4px",
                                                    background: isDispensed ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5") : (isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7"),
                                                    color: isDispensed ? "#10B981" : "#D97706",
                                                  }}
                                                >
                                                  {isDispensed ? (isHi ? "वितरित (Given)" : "Dispensed") : (isHi ? "लंबित" : "Pending")}
                                                </span>
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Advice & Follow-Up Callouts */}
                            {(data.advice || data.follow_up || data.lab_tests || data.transfer_notes) && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginTop: "2px" }}>
                                {data.advice && (
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", background: isDark ? "#1E293B" : "#FFFFFF", border: cardBorder }}>
                                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", marginBottom: "3px" }}>
                                      {isHi ? "चिकित्सक सलाह (Advice)" : "Doctor's Advice"}
                                    </div>
                                    <div style={{ fontSize: "12px", color: textColor, fontWeight: 600 }}>
                                      {data.advice}
                                    </div>
                                  </div>
                                )}

                                {data.follow_up && (
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", background: isDark ? "#1E293B" : "#FFFFFF", border: cardBorder }}>
                                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#8B5CF6", textTransform: "uppercase", marginBottom: "3px" }}>
                                      {isHi ? "पुनः परामर्श (Follow-Up)" : "Follow-Up Instructions"}
                                    </div>
                                    <div style={{ fontSize: "12px", color: textColor, fontWeight: 600 }}>
                                      {data.follow_up}
                                    </div>
                                  </div>
                                )}

                                {data.lab_tests && (
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", background: isDark ? "#1E293B" : "#FFFFFF", border: cardBorder }}>
                                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#F59E0B", textTransform: "uppercase", marginBottom: "3px" }}>
                                      {isHi ? "जांच आदेश (Lab / Diagnostics)" : "Lab / Diagnostics Ordered"}
                                    </div>
                                    <div style={{ fontSize: "12px", color: textColor, fontWeight: 600 }}>
                                      {data.lab_tests}
                                    </div>
                                  </div>
                                )}

                                {data.transfer_notes && (
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", background: isDark ? "#1E293B" : "#FFFFFF", border: cardBorder }}>
                                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#10B981", textTransform: "uppercase", marginBottom: "3px" }}>
                                      {isHi ? "स्थानांतरण नोट (Transfer Note)" : "Transfer Instructions"}
                                    </div>
                                    <div style={{ fontSize: "12px", color: textColor, fontWeight: 600 }}>
                                      {data.transfer_notes}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "10px",
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: cardBorder,
              }}
            >
              <button
                type="button"
                onClick={() => handleReprintRecord(selectedRecord)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Printer size={13} />
                <span>{isHi ? "टोकन पर्ची प्रिंट करें" : "Print Official Pass"}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "9px",
                  border: cardBorder,
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: textColor,
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isHi ? "बंद करें" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
