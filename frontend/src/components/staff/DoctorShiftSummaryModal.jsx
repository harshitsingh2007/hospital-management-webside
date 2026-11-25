/**
 * DoctorShiftSummaryModal.jsx
 * ----------------------------
 * End-of-Day Shift Summary & 7-Day Performance Analytics Modal for Clinicians.
 * Triggered automatically when doctor toggles "Shift Ended (Off Duty)", or on-demand.
 *
 * Features:
 * - Total Patients Consulted Today (e.g., 28 patients)
 * - Average Consultation Duration (e.g., 5.4 mins/patient)
 * - Patients Referred / Transferred breakdown (e.g., 4 to Lab, 2 to Radiology, 1 to Pharmacy)
 * - Interactive 7-Day Performance Graph (Bar Chart + Avg Duration Spline)
 * - Day-by-Day Inspection & Comparative Benchmarks
 * - Today's Consulted Patients Encounter Roster
 * - Print / Export PDF & Download CSV capabilities
 * - Full Dark Mode & Bilingual (English / Hindi) support
 */

import React, { useState, useEffect, useCallback, useRef, useId } from "react";
import {
  Users,
  Clock,
  ArrowRightLeft,
  TrendingUp,
  CheckCircle2,
  Download,
  Award,
} from "lucide-react";
import {
  IconDoctor,
  IconHospital,
  IconPill,
  IconLab,
  IconClipboard,
  IconPrescription,
  IconShield,
  IconActivity,
} from "../common/MedicalIcons";

import { API_BASE } from "../../config/hospitalConfig";

export default function DoctorShiftSummaryModal({
  isOpen = false,
  onClose = () => {},
  currentUser = null,
  tenantId = "city-hospital-01",
  effectiveHospitalCode = null,
  language = "en",
  isDark = false,
  doctorDutyStatus = "OFF_DUTY",
  onDutyStatusChange = null,
}) {
  const isHi = language === "hi";
  const [activeTab, setActiveTab] = useState("today"); // "today" | "trend"
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState(6); // default to today (last index)
  const [hoveredDayIdx, setHoveredDayIdx] = useState(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [copiedToast, setCopiedToast] = useState("");
  const modalRef = useRef(null);
  const titleId = useId();

  const hospCode = effectiveHospitalCode || tenantId || "city-hospital-01";
  const docId = currentUser?.id || null;
  const docEmail = currentUser?.email || null;
  const docName = currentUser?.name || currentUser?.username || "Doctor";

  // Reusable live fetch
  const fetchShiftSummary = useCallback((silent = false) => {
    if (!isOpen) return;
    if (!silent) setLoading(true);

    const queryParams = new URLSearchParams({
      tenant_id: hospCode,
      ...(docId ? { doctor_id: docId } : {}),
      ...(docEmail ? { doctor_email: docEmail } : {}),
      ...(docName ? { doctor_name: docName } : {}),
      days: "7",
    });

    fetch(`${API_BASE}/api/v1/doctor/shift-summary?${queryParams.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" && data.summary) {
          setSummaryData(data.summary);
          if (data.summary.last_7_days && data.summary.last_7_days.length > 0) {
            setSelectedDayIdx((prev) => (prev !== null && prev !== undefined ? prev : data.summary.last_7_days.length - 1));
          }
        }
        if (!silent) setLoading(false);
      })
      .catch((err) => {
        console.warn("[DoctorShiftSummary] Error fetching data:", err);
        if (!silent) setLoading(false);
      });
  }, [isOpen, hospCode, docId, docEmail, docName]);

  // Initial fetch on modal open + 6s auto-refresh polling for live real-time sync
  useEffect(() => {
    if (!isOpen) return;
    fetchShiftSummary(false);

    // Live continuous polling so consultations and transfers update in real-time
    const interval = setInterval(() => {
      fetchShiftSummary(true);
    }, 3000);

    const handleSync = () => fetchShiftSummary(true);
    window.addEventListener("queue_updated", handleSync);
    window.addEventListener("ticket_completed", handleSync);
    window.addEventListener("ticket_transferred", handleSync);
    window.addEventListener("doctor_duty_status_changed", handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("queue_updated", handleSync);
      window.removeEventListener("ticket_completed", handleSync);
      window.removeEventListener("ticket_transferred", handleSync);
      window.removeEventListener("doctor_duty_status_changed", handleSync);
    };
  }, [isOpen, fetchShiftSummary]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const today = summaryData?.today || {
    date: new Date().toISOString().split("T")[0],
    total_consulted: 0,
    avg_duration_minutes: 0,
    total_service_minutes: 0,
    fastest_duration_minutes: 0,
    longest_duration_minutes: 0,
    total_transferred: 0,
    transferred_breakdown: {},
    consulted_patients: [],
  };

  const last7Days = summaryData?.last_7_days || [];
  const weekly = summaryData?.weekly_overview || {
    total_patients: 0,
    avg_daily_patients: 0,
    overall_avg_duration: 0.0,
    total_transfers: 0,
    total_hours: "0.0",
    busiest_day: "N/A",
    completion_rate: "100%",
  };

  const selectedDay = last7Days[selectedDayIdx] || (last7Days.length > 0 ? last7Days[last7Days.length - 1] : null);

  // Filter today's patients by search
  const filteredPatients = (today.consulted_patients || []).filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    return (
      (p.patient_name && p.patient_name.toLowerCase().includes(q)) ||
      (p.ticket_id && String(p.ticket_id).toLowerCase().includes(q)) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(q)) ||
      (p.medical_condition && p.medical_condition.toLowerCase().includes(q))
    );
  });

  // Export CSV
  const handleExportCsv = () => {
    const rows = [
      ["Date", "Day", "Patients Consulted", "Avg Duration (Mins)", "Transfers", "Total Minutes"],
      ...last7Days.map((d) => [d.date, d.day_name, d.total_consulted, d.avg_duration_minutes, d.total_transferred, d.total_minutes]),
      [],
      ["Today Consulted Patients Roster"],
      ["Token ID", "Patient Name", "Condition", "Diagnosis / Advice", "Duration (Mins)", "Status"],
      ...(today.consulted_patients || []).map((p) => [
        p.ticket_id,
        p.patient_name,
        p.medical_condition,
        p.diagnosis,
        p.duration_minutes,
        p.status,
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `doctor_shift_summary_${today.date || "today"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopiedToast(isHi ? "CSV सफलतापूर्वक डाउनलोड की गई!" : "CSV exported successfully!");
    setTimeout(() => setCopiedToast(""), 3000);
  };


  // SVG Chart Dimensions & Computations
  const chartWidth = 620;
  const chartHeight = 180;
  const paddingX = 40;
  const paddingY = 30;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  const maxPatients = Math.max(...last7Days.map((d) => d.total_consulted), 10);
  const maxDuration = Math.max(...last7Days.map((d) => d.avg_duration_minutes), 8);

  const getBarX = (index) => {
    const step = usableWidth / Math.max(last7Days.length - 1, 1);
    return paddingX + index * step;
  };

  const getBarHeight = (consulted) => {
    return Math.max(8, (consulted / maxPatients) * usableHeight);
  };

  const getDurationY = (duration) => {
    const ratio = Math.min(1, Math.max(0, duration / maxDuration));
    return chartHeight - paddingY - ratio * usableHeight;
  };

  // Build Spline path for average duration
  const durationPoints = last7Days.map((d, i) => ({
    x: getBarX(i),
    y: getDurationY(d.avg_duration_minutes || 5.0),
  }));

  const durationPath = durationPoints.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cpX1 = prev.x + (pt.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (pt.x - prev.x) / 2;
    const cpY2 = pt.y;
    return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${pt.x} ${pt.y}`;
  }, "");

  // Format Duration display
  const formatMins = (mins) => {
    if (!mins || mins === 0) return "0 min";
    const m = Math.floor(mins);
    const s = Math.round((mins - m) * 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(12px)",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="shift-summary-modal-content"
        style={{
          width: "100%",
          maxWidth: "860px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "20px",
          background: isDark ? "#0F172A" : "#FFFFFF",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid #E2E8F0",
          boxShadow: isDark
            ? "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(2, 132, 199, 0.18)"
            : "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 35px rgba(2, 132, 199, 0.08)",
          overflow: "hidden",
          color: isDark ? "#F8FAFC" : "#0F172A",
          fontFamily: "inherit",
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "20px 24px 16px 24px",
            borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: isDark
              ? "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.7) 100%)"
              : "linear-gradient(135deg, #F8FAFC 0%, #F0F9FF 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
                fontSize: "22px",
              }}
            >
              📊
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h3 id={titleId} style={{ margin: 0, fontSize: "19px", fontWeight: 800, letterSpacing: "-0.3px" }}>
                  {isHi ? "चिकित्सक शिफ्ट समाप्ति सारांश व एनालिटिक्स" : "Doctor End-of-Day Shift Summary & Analytics"}
                </h3>
                <span
                  style={{
                    padding: "3px 9px",
                    borderRadius: "20px",
                    background: (doctorDutyStatus === "ACTIVE")
                      ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#DCFCE7")
                      : (doctorDutyStatus === "ON_BREAK" || doctorDutyStatus === "EMERGENCY_ROUND")
                      ? (isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7")
                      : (isDark ? "rgba(148, 163, 184, 0.2)" : "#E2E8F0"),
                    color: (doctorDutyStatus === "ACTIVE")
                      ? (isDark ? "#34D399" : "#15803D")
                      : (doctorDutyStatus === "ON_BREAK" || doctorDutyStatus === "EMERGENCY_ROUND")
                      ? (isDark ? "#FBBF24" : "#B45309")
                      : (isDark ? "#CBD5E1" : "#475569"),
                    fontSize: "11px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: (doctorDutyStatus === "ACTIVE") ? "#10B981" : "#94A3B8",
                    }}
                  />
                  {doctorDutyStatus === "ACTIVE"
                    ? (isHi ? "ऑन ड्यूटी" : "On Duty")
                    : doctorDutyStatus === "ON_BREAK"
                    ? (isHi ? "विश्राम (ब्रेक)" : "On Break")
                    : doctorDutyStatus === "EMERGENCY_ROUND"
                    ? (isHi ? "आपातकालीन राउंड" : "Emergency Round")
                    : (isHi ? "ऑफ ड्यूटी" : "Off Duty")}
                </span>
              </div>
              <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: isDark ? "#94A3B8" : "#64748B" }}>
                <span>{docName}</span>
                <span style={{ margin: "0 6px" }}>•</span>
                <span>{summaryData?.doctor?.tenant_id || hospCode}</span>
                <span style={{ margin: "0 6px" }}>•</span>
                <span>{today.date}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: isDark ? "#1E293B" : "#F1F5F9",
              border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
              color: isDark ? "#94A3B8" : "#64748B",
              borderRadius: "10px",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: 700,
              transition: "all 0.15s ease",
            }}
            title={isHi ? "बंद करें (Esc)" : "Close (Esc)"}
          >
            ✕
          </button>
        </div>

        {/* VIEW NAVIGATION TABS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 24px",
            background: isDark ? "#0B1120" : "#F8FAFC",
            borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("today")}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "today" ? (isDark ? "#1E293B" : "#FFFFFF") : "transparent",
                color: activeTab === "today" ? (isDark ? "#38BDF8" : "#0284C7") : (isDark ? "#94A3B8" : "#64748B"),
                fontWeight: activeTab === "today" ? 800 : 600,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: activeTab === "today" ? (isDark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.06)") : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span>📅</span>
              <span>{isHi ? "आज का शिफ्ट सारांश" : "Today's Shift Wrap-Up"}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "12px",
                  background: isDark ? "rgba(2,132,199,0.25)" : "#E0F2FE",
                  color: "#0284C7",
                  fontWeight: 800,
                }}
              >
                {today.total_consulted}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("trend")}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === "trend" ? (isDark ? "#1E293B" : "#FFFFFF") : "transparent",
                color: activeTab === "trend" ? (isDark ? "#38BDF8" : "#0284C7") : (isDark ? "#94A3B8" : "#64748B"),
                fontWeight: activeTab === "trend" ? 800 : 600,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: activeTab === "trend" ? (isDark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.06)") : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span>📈</span>
              <span>{isHi ? "7-दिवसीय रुझान व ग्राफ़" : "7-Day Performance & Graph"}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "12px",
                  background: isDark ? "rgba(16,185,129,0.25)" : "#D1FAE5",
                  color: "#059669",
                  fontWeight: 800,
                }}
              >
                {weekly.total_patients}
              </span>
            </button>
          </div>

          {/* Quick Actions (CSV) */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={handleExportCsv}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                background: isDark ? "#1E293B" : "#FFFFFF",
                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                color: isDark ? "#E2E8F0" : "#334155",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              title={isHi ? "CSV डाउनलोड करें" : "Download CSV"}
            >
              <Download size={14} style={{ color: isDark ? "#38BDF8" : "#0284C7" }} />
              <span>{isHi ? "CSV निर्यात" : "Export CSV"}</span>
            </button>
          </div>
        </div>

        {/* TOAST MESSAGE NOTIFICATION */}
        {copiedToast && (
          <div
            style={{
              padding: "8px 16px",
              background: "#10B981",
              color: "#FFFFFF",
              fontSize: "12.5px",
              fontWeight: 700,
              textAlign: "center",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            ✓ {copiedToast}
          </div>
        )}

        {/* MODAL BODY (SCROLLABLE) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: isDark ? "#94A3B8" : "#64748B" }}>
              <div style={{ fontSize: "28px", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</div>
              <p style={{ marginTop: "12px", fontWeight: 700 }}>
                {isHi ? "शिफ्ट डेटा लोड किया जा रहा है..." : "Crunching clinical shift analytics..."}
              </p>
            </div>
          ) : activeTab === "today" ? (
            /* TAB 1: TODAY'S SHIFT WRAP-UP */
            <>
              {/* CELEBRATORY WRAP-UP BANNER */}
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: "14px",
                  background: isDark
                    ? "linear-gradient(135deg, rgba(2, 132, 199, 0.18) 0%, rgba(14, 165, 233, 0.06) 100%)"
                    : "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)",
                  border: isDark ? "1px solid rgba(56, 189, 248, 0.25)" : "1px solid #BAE6FD",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      background: isDark ? "rgba(56, 189, 248, 0.2)" : "#E0F2FE",
                      color: isDark ? "#38BDF8" : "#0284C7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Award size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "14.5px", fontWeight: 800, color: isDark ? "#38BDF8" : "#0369A1" }}>
                      {isHi ? "शानदार कार्य! आपकी आज की ओपीडी शिफ्ट समाप्त हुई।" : "Clinical Shift Summary Wrapped"}
                    </h4>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: isDark ? "#94A3B8" : "#075985" }}>
                      {isHi
                        ? `आपने आज ${today.total_consulted} मरीज़ों का परामर्श पूर्ण किया। सभी रिकॉर्ड्स सुरक्षित हैं।`
                        : `You completed ${today.total_consulted} patient consultation${today.total_consulted === 1 ? "" : "s"} today. Encounter telemetry is synchronized.`}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    background: isDark ? "rgba(15, 23, 42, 0.65)" : "#FFFFFF",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #E2E8F0",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: isDark ? "#E2E8F0" : "#334155",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Clock size={14} style={{ color: "#0284C7" }} />
                  <span>
                    {isHi ? "कुल परामर्श समय:" : "Total Consult Time:"}{" "}
                    <strong style={{ color: isDark ? "#38BDF8" : "#0284C7", fontWeight: 700 }}>
                      {today.total_service_minutes} mins
                    </strong>
                  </span>
                </div>
              </div>

              {/* 3 CORE SUMMARY METRIC CARDS */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "14px",
                }}
              >
                {/* 1. Total Patients Consulted Today */}
                <div
                  style={{
                    padding: "18px 20px",
                    borderRadius: "14px",
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                    boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "135px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          color: isDark ? "#94A3B8" : "#64748B",
                          textTransform: "uppercase",
                        }}
                      >
                        {isHi ? "कुल परामर्शित मरीज़" : "Total Consulted Today"}
                      </span>
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "9px",
                          background: isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF",
                          border: isDark ? "1px solid rgba(56, 189, 248, 0.25)" : "1px solid #BAE6FD",
                          color: isDark ? "#38BDF8" : "#0284C7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Users size={17} strokeWidth={2.2} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "12px" }}>
                      <span
                        style={{
                          fontSize: "30px",
                          fontWeight: 800,
                          color: isDark ? "#F8FAFC" : "#0F172A",
                          lineHeight: 1,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {today.total_consulted}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#94A3B8" : "#64748B" }}>
                        {isHi ? "मरीज़" : "patients"}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      paddingTop: "10px",
                      borderTop: isDark ? "1px solid #334155" : "1px solid #F1F5F9",
                      fontSize: "11.5px",
                      color: isDark ? "#94A3B8" : "#64748B",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <TrendingUp size={13} style={{ color: "#0284C7" }} />
                    <span>{isHi ? "साप्ताहिक दैनिक औसत:" : "Weekly Daily Avg:"}</span>
                    <strong style={{ color: isDark ? "#E2E8F0" : "#1E293B", fontWeight: 700 }}>
                      {weekly.avg_daily_patients} / day
                    </strong>
                  </div>
                </div>

                {/* 2. Average Consultation Duration */}
                <div
                  style={{
                    padding: "18px 20px",
                    borderRadius: "14px",
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                    boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "135px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          color: isDark ? "#94A3B8" : "#64748B",
                          textTransform: "uppercase",
                        }}
                      >
                        {isHi ? "औसत परामर्श अवधि" : "Avg Consultation Duration"}
                      </span>
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "9px",
                          background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB",
                          border: isDark ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid #FDE68A",
                          color: isDark ? "#FBBF24" : "#D97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Clock size={17} strokeWidth={2.2} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "12px" }}>
                      <span
                        style={{
                          fontSize: "30px",
                          fontWeight: 800,
                          color: isDark ? "#F8FAFC" : "#0F172A",
                          lineHeight: 1,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {today.avg_duration_minutes > 0
                          ? today.avg_duration_minutes
                          : (today.total_consulted > 0 ? "1.0" : "0.0")}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#94A3B8" : "#64748B" }}>
                        {isHi ? "मिनट / मरीज़" : "mins/patient"}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      paddingTop: "10px",
                      borderTop: isDark ? "1px solid #334155" : "1px solid #F1F5F9",
                      fontSize: "11.5px",
                      color: isDark ? "#94A3B8" : "#64748B",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: isDark ? "#64748B" : "#94A3B8", fontWeight: 500 }}>
                        {isHi ? "न्यूनतम" : "Fastest"}
                      </span>
                      <strong style={{ color: isDark ? "#E2E8F0" : "#1E293B", fontWeight: 700 }}>
                        {today.fastest_duration_minutes > 0 ? `${today.fastest_duration_minutes}m` : (today.total_consulted > 0 ? "1.0m" : "0m")}
                      </strong>
                    </span>
                    <span style={{ color: isDark ? "#475569" : "#CBD5E1" }}>•</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: isDark ? "#64748B" : "#94A3B8", fontWeight: 500 }}>
                        {isHi ? "अधिकतम" : "Longest"}
                      </span>
                      <strong style={{ color: isDark ? "#E2E8F0" : "#1E293B", fontWeight: 700 }}>
                        {today.longest_duration_minutes > 0 ? `${today.longest_duration_minutes}m` : (today.total_consulted > 0 ? "1.0m" : "0m")}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* 3. Patients Referred / Transferred */}
                <div
                  style={{
                    padding: "18px 20px",
                    borderRadius: "14px",
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                    boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "135px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          color: isDark ? "#94A3B8" : "#64748B",
                          textTransform: "uppercase",
                        }}
                      >
                        {isHi ? "रेफरल / स्थानांतरित मरीज़" : "Referred / Transferred"}
                      </span>
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "9px",
                          background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                          border: isDark ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid #A7F3D0",
                          color: isDark ? "#34D399" : "#059669",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ArrowRightLeft size={17} strokeWidth={2.2} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "12px" }}>
                      <span
                        style={{
                          fontSize: "30px",
                          fontWeight: 800,
                          color: isDark ? "#F8FAFC" : "#0F172A",
                          lineHeight: 1,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {today.total_transferred}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#94A3B8" : "#64748B" }}>
                        {isHi ? "मरीज़" : "referred"}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      paddingTop: "10px",
                      borderTop: isDark ? "1px solid #334155" : "1px solid #F1F5F9",
                      fontSize: "11.5px",
                      color: isDark ? "#94A3B8" : "#64748B",
                    }}
                  >
                    {(() => {
                      const activeTransfers = Object.entries(today.transferred_breakdown || {}).filter(([_, count]) => count > 0);
                      if (activeTransfers.length > 0) {
                        return (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {activeTransfers.map(([dept, count]) => (
                              <span
                                key={dept}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 7px",
                                  borderRadius: "6px",
                                  background: isDark ? "rgba(16, 185, 129, 0.15)" : "#F0FDF4",
                                  border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #BBF7D0",
                                  color: isDark ? "#6EE7B7" : "#15803D",
                                }}
                              >
                                {count} to {dept}
                              </span>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <CheckCircle2 size={13} style={{ color: "#10B981", flexShrink: 0 }} />
                          <span>{isHi ? "सभी परामर्श इन-क्लीनिक पूर्ण" : "Direct consultations (no referrals)"}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>


              {/* TODAY'S CONSULTED PATIENT ROSTER */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                      {isHi ? "आज परामर्श किए गए मरीज़ों की सूची" : "Today's Consulted Patients Roster"} ({filteredPatients.length})
                    </h4>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: isDark ? "#94A3B8" : "#64748B" }}>
                      {isHi ? "परामर्श समय, मुख्य लक्षण एवं निदान" : "Completed consultation time, duration, and diagnosis"}
                    </p>
                  </div>

                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder={isHi ? "मरीज़ खोजें..." : "Search patient or token..."}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#1E293B" : "#FFFFFF",
                      color: isDark ? "#FFFFFF" : "#0F172A",
                      outline: "none",
                      width: "180px",
                    }}
                  />
                </div>

                {filteredPatients.length === 0 ? (
                  <div
                    style={{
                      padding: "30px 20px",
                      textAlign: "center",
                      borderRadius: "14px",
                      background: isDark ? "#131D31" : "#F8FAFC",
                      border: isDark ? "1px solid #27354E" : "1px solid #E2E8F0",
                      color: isDark ? "#94A3B8" : "#64748B",
                      fontSize: "13px",
                    }}
                  >
                    {isHi ? "कोई रिकॉर्ड नहीं मिला।" : "No patient consultations recorded for this shift search."}
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: "220px",
                      overflowY: "auto",
                      border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                      borderRadius: "12px",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                      <thead>
                        <tr style={{ background: isDark ? "#1E293B" : "#F1F5F9", borderBottom: isDark ? "1px solid #334155" : "1px solid #CBD5E1" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}># Token</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>Patient</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>Condition / Diagnosis</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>Duration</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>Completed</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatients.map((p, idx) => (
                          <tr
                            key={p.ticket_id || idx}
                            style={{
                              borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9",
                              background: idx % 2 === 0 ? "transparent" : (isDark ? "rgba(30, 41, 59, 0.4)" : "#F8FAFC"),
                            }}
                          >
                            <td style={{ padding: "8px 12px", fontWeight: 800, color: "#0284C7" }}>
                              #{p.ticket_id}
                            </td>
                            <td style={{ padding: "8px 12px", fontWeight: 700 }}>
                              {p.patient_name}
                            </td>
                            <td style={{ padding: "8px 12px", color: isDark ? "#CBD5E1" : "#475569" }}>
                              <span style={{ fontWeight: 600 }}>{p.diagnosis || p.medical_condition}</span>
                            </td>
                            <td style={{ padding: "8px 12px", fontWeight: 700, color: "#D97706" }}>
                              {formatMins(p.duration_minutes)}
                            </td>
                            <td style={{ padding: "8px 12px", color: isDark ? "#94A3B8" : "#64748B" }}>
                              {p.completed_at || "Done"}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right" }}>
                              <span
                                style={{
                                  padding: "2px 7px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: p.status === "transferred" ? (isDark ? "rgba(16,185,129,0.2)" : "#D1FAE5") : (isDark ? "rgba(2,132,199,0.2)" : "#E0F2FE"),
                                  color: p.status === "transferred" ? "#059669" : "#0284C7",
                                }}
                              >
                                {p.status === "transferred" ? (isHi ? "स्थानांतरित" : "Transferred") : (isHi ? "पूर्ण" : "Completed")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* TAB 2: 7-DAY PERFORMANCE & INTERACTIVE GRAPH */
            <>
              {/* 7-DAY SUMMARY KPI STRIP */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px",
                }}
              >
                <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#FFFFFF", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>7-DAY TOTAL</div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: isDark ? "#38BDF8" : "#0284C7", marginTop: "2px" }}>
                    {weekly.total_patients} <span style={{ fontSize: "11px", fontWeight: 600 }}>pts</span>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#FFFFFF", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>DAILY AVERAGE</div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#10B981", marginTop: "2px" }}>
                    {weekly.avg_daily_patients} <span style={{ fontSize: "11px", fontWeight: 600 }}>/day</span>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#FFFFFF", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>AVG CONSULT TIME</div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#F59E0B", marginTop: "2px" }}>
                    {weekly.overall_avg_duration} <span style={{ fontSize: "11px", fontWeight: 600 }}>min</span>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#FFFFFF", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>TOTAL REFERRALS</div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#8B5CF6", marginTop: "2px" }}>
                    {weekly.total_transfers} <span style={{ fontSize: "11px", fontWeight: 600 }}>pts</span>
                  </div>
                </div>

                <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#FFFFFF", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>PEAK DAY</div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A", marginTop: "5px" }}>
                    🏆 {weekly.busiest_day}
                  </div>
                </div>
              </div>

              {/* INTERACTIVE 7-DAY VISUAL GRAPH */}
              <div
                style={{
                  padding: "20px 22px",
                  borderRadius: "18px",
                  background: isDark ? "#131D31" : "#F8FAFC",
                  border: isDark ? "1px solid #27354E" : "1px solid #E2E8F0",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                      {isHi ? "7-दिवसीय परामर्श मात्रा एवं औसत परामर्श समय" : "7-Day Patient Volume & Consultation Pace"}
                    </h4>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B" }}>
                      {isHi ? "विस्तृत विवरण देखने के लिए किसी भी दिन पर क्लिक या होवर करें" : "Hover or click any day bar to inspect day details"}
                    </p>
                  </div>

                  {/* Chart Legend */}
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px", fontWeight: 700 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#0284C7", display: "inline-block" }} />
                      <span style={{ color: isDark ? "#E2E8F0" : "#334155" }}>{isHi ? "परामर्शित मरीज़" : "Patients Consulted (Bars)"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "16px", height: "3px", borderRadius: "2px", background: "#F59E0B", display: "inline-block" }} />
                      <span style={{ color: isDark ? "#E2E8F0" : "#334155" }}>{isHi ? "औसत अवधि (मिनट)" : "Avg Duration (Spline)"}</span>
                    </div>
                  </div>
                </div>

                {/* SVG CHART CONTAINER */}
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    style={{ width: "100%", height: "auto", minWidth: "500px", display: "block" }}
                  >
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#0284C7" stopOpacity="0.8" />
                      </linearGradient>
                      <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#67E8F9" />
                        <stop offset="100%" stopColor="#0891B2" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = paddingY + ratio * usableHeight;
                      return (
                        <line
                          key={ratio}
                          x1={paddingX}
                          y1={y}
                          x2={chartWidth - paddingX}
                          y2={y}
                          stroke={isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0"}
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    {/* Volume Bars */}
                    {last7Days.map((d, i) => {
                      const x = getBarX(i);
                      const barW = 28;
                      const barH = getBarHeight(d.total_consulted);
                      const y = chartHeight - paddingY - barH;
                      const isSelected = selectedDayIdx === i;
                      const isHovered = hoveredDayIdx === i;

                      return (
                        <g
                          key={d.date || i}
                          onClick={() => setSelectedDayIdx(i)}
                          onMouseEnter={() => setHoveredDayIdx(i)}
                          onMouseLeave={() => setHoveredDayIdx(null)}
                          style={{ cursor: "pointer" }}
                        >
                          <rect
                            x={x - barW / 2}
                            y={y}
                            width={barW}
                            height={barH}
                            rx={6}
                            fill={isSelected || isHovered ? "url(#barGradActive)" : "url(#barGrad)"}
                            filter={isSelected ? "drop-shadow(0 0 8px rgba(56, 189, 248, 0.5))" : "none"}
                            style={{ transition: "all 0.2s ease" }}
                          />
                          {/* Top Bar Count Label */}
                          <text
                            x={x}
                            y={y - 6}
                            textAnchor="middle"
                            fill={isSelected ? "#38BDF8" : isDark ? "#CBD5E1" : "#475569"}
                            fontSize="11"
                            fontWeight="800"
                          >
                            {d.total_consulted}
                          </text>

                          {/* X-axis Day Label */}
                          <text
                            x={x}
                            y={chartHeight - 10}
                            textAnchor="middle"
                            fill={isSelected ? "#38BDF8" : isDark ? "#94A3B8" : "#64748B"}
                            fontSize="11"
                            fontWeight={isSelected ? "800" : "600"}
                          >
                            {d.day_name}
                          </text>
                        </g>
                      );
                    })}

                    {/* Spline Line for Duration Trend */}
                    <path
                      d={durationPath}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Duration Data Dots */}
                    {durationPoints.map((pt, i) => {
                      const isSelected = selectedDayIdx === i;
                      return (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6 : 4}
                          fill="#FFFFFF"
                          stroke="#F59E0B"
                          strokeWidth={isSelected ? 3 : 2}
                          style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                          onClick={() => setSelectedDayIdx(i)}
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* SELECTED DAY DETAIL CARD */}
              {selectedDay && (
                <div
                  style={{
                    padding: "16px 20px",
                    borderRadius: "16px",
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    border: `1.5px solid ${isDark ? "#38BDF8" : "#BAE6FD"}`,
                    boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.3)" : "0 2px 8px rgba(2, 132, 199, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#0284C7" }}>
                        {selectedDay.is_today ? (isHi ? "आज का चयन" : "TODAY'S METRICS") : (isHi ? "दैनिक विवरण" : "SELECTED DAY METRICS")}
                      </span>
                      <h4 style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: 800 }}>
                        {selectedDay.day_name}, {selectedDay.full_date} ({selectedDay.date})
                      </h4>
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ padding: "6px 12px", borderRadius: "10px", background: isDark ? "#0F172A" : "#F0F9FF", border: isDark ? "1px solid #334155" : "1px solid #BAE6FD", fontSize: "12px" }}>
                        <span>Consulted:</span> <strong style={{ color: "#0284C7" }}>{selectedDay.total_consulted} patients</strong>
                      </div>
                      <div style={{ padding: "6px 12px", borderRadius: "10px", background: isDark ? "#0F172A" : "#FEF3C7", border: isDark ? "1px solid #334155" : "1px solid #FDE68A", fontSize: "12px" }}>
                        <span>Avg Pace:</span> <strong style={{ color: "#D97706" }}>{selectedDay.avg_duration_minutes} min/pt</strong>
                      </div>
                      <div style={{ padding: "6px 12px", borderRadius: "10px", background: isDark ? "#0F172A" : "#ECFDF5", border: isDark ? "1px solid #334155" : "1px solid #A7F3D0", fontSize: "12px" }}>
                        <span>Transfers:</span> <strong style={{ color: "#059669" }}>{selectedDay.total_transferred} patients</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
            background: isDark ? "#0F172A" : "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 24px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span>{isHi ? "संपन्न (Done)" : "Done"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
