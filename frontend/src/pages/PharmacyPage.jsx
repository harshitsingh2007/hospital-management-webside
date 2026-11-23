
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { printPrescriptionSlip } from "../utils/printPassHelper";
import { apiFetch } from "../utils/apiFetch";
import Footer from "../components/common/Footer";
import {
  isEmergencyTicket,
  formatTimeSinceArrival,
  scopeTicketsForDesk,
  useAssignedDesk,
  DeskDepartmentBadge,
  EmergencyDeskBanner,
  NoDeskNotice,
  EmergencyBadge,
} from "../utils/deskScope";
import {
  Pill,
  CheckCircle2,
  CheckCircle,
  Clock,
  Printer,
  Volume2,
  Search,
  RefreshCw,
  User,
  Stethoscope,
  Building2,
  ArrowRight,
  Sparkles,
  Coffee,
  FileText,
  Info,
  History,
  Calendar,
  CalendarCheck,
  Download,
  Eye,
  Phone,
  Save,
  XCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  Pause,
  Play,
  Plus,
  Sliders,
  Activity,
  UserX,
  X,
  ArrowUpRight,
  MessageSquare,
  Send,
  FlaskConical
} from "lucide-react";
import * as XLSX from "xlsx";

/**
 * Reusable Sub-Components for Pharmacy Dispensing & Visit Queue
 */
function StatusBadge({ status, isHi, isDark }) {
  const rawStatus = String(status || "").toLowerCase().trim();
  let label = isHi ? "पूर्ण" : "Completed";
  let color = "#059669";
  let bg = isDark ? "rgba(16, 185, 129, 0.16)" : "#ECFDF5";
  let border = isDark ? "rgba(16, 185, 129, 0.35)" : "#A7F3D0";
  let dotColor = "#10B981";

  if (rawStatus === "serving" || rawStatus === "in_progress" || rawStatus === "transferred") {
    label = isHi ? "प्रगति में" : "In Progress";
    color = isDark ? "#38BDF8" : "#0284C7";
    bg = isDark ? "rgba(2, 132, 199, 0.16)" : "#F0F9FF";
    border = isDark ? "rgba(2, 132, 199, 0.35)" : "#BAE6FD";
    dotColor = "#0284C7";
  } else if (rawStatus === "waiting" || rawStatus === "pending") {
    label = isHi ? "प्रतीक्षारत" : "Pending";
    color = isDark ? "#FBBF24" : "#D97706";
    bg = isDark ? "rgba(245, 158, 11, 0.16)" : "#FFFBEB";
    border = isDark ? "rgba(245, 158, 11, 0.35)" : "#FDE68A";
    dotColor = "#F59E0B";
  } else if (rawStatus === "cancelled" || rawStatus === "no_show") {
    label = isHi ? "रद्द" : "Cancelled";
    color = isDark ? "#F87171" : "#DC2626";
    bg = isDark ? "rgba(239, 68, 68, 0.16)" : "#FEF2F2";
    border = isDark ? "rgba(239, 68, 68, 0.35)" : "#FECACA";
    dotColor = "#EF4444";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 9px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.2px",
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: dotColor,
          display: "inline-block",
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function TokenDateTimeCell({ visit, isDark, mutedText }) {
  const formatDateTime = (dateStr, createdAt) => {
    if (createdAt) {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        const dateFormatted = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        const timeFormatted = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();
        return `${dateFormatted}, ${timeFormatted}`;
      }
    }
    if (dateStr) {
      const parts = String(dateStr).split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      }
      return dateStr;
    }
    return "Today";
  };

  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          background: isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF",
          border: isDark ? "1px solid rgba(2, 132, 199, 0.3)" : "1px solid #BAE6FD",
          color: isDark ? "#38BDF8" : "#0284C7",
          padding: "3px 9px",
          borderRadius: "6px",
          fontWeight: 800,
          fontFamily: "monospace",
          fontSize: "12px",
          whiteSpace: "nowrap",
        }}
      >
        #{visit.token_number || visit.ticket_id}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: mutedText,
          marginTop: "6px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          whiteSpace: "nowrap",
        }}
      >
        <Calendar size={11} color={mutedText} style={{ flexShrink: 0 }} />
        <span>{formatDateTime(visit.queue_date, visit.created_at)}</span>
      </div>
    </div>
  );
}

function PatientCell({ visit, textColor, mutedText }) {
  const ageText = visit.age ? `${visit.age}y` : "Age N/A";
  const genderText = visit.gender || "Patient";

  return (
    <div>
      <div
        style={{
          fontWeight: 800,
          color: textColor,
          fontSize: "13px",
          letterSpacing: "-0.2px",
          lineHeight: "1.3",
        }}
      >
        {visit.patient_name || "Unknown Patient"}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: mutedText,
          marginTop: "3px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          whiteSpace: "nowrap",
        }}
      >
        <span>{ageText}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ textTransform: "capitalize" }}>{genderText}</span>
      </div>
      {visit.phone && (
        <div
          style={{
            fontSize: "11px",
            color: mutedText,
            marginTop: "2px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            whiteSpace: "nowrap",
          }}
        >
          <Phone size={10} color={mutedText} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: "monospace" }}>{visit.phone}</span>
        </div>
      )}
    </div>
  );
}

function CarePathwayCell({ visit, isDark, textColor, mutedText }) {
  const originDept = (visit.origin_department || "OPD")
    .replace(/General Consultation\s*\(OPD\)/i, "OPD")
    .replace(/Pharmacy\s*&\s*Medicine/i, "Pharmacy");
  const destDept = (visit.department || "Pharmacy")
    .replace(/Pharmacy\s*&\s*Medicine/i, "Pharmacy");

  const isSameDept =
    originDept.trim().toLowerCase() === destDept.trim().toLowerCase() ||
    (originDept.toLowerCase().includes("pharm") && destDept.toLowerCase().includes("pharm"));

  const formatDuration = (mins) => {
    if (mins === undefined || mins === null || mins === "") return null;
    const num = parseFloat(mins);
    if (isNaN(num) || num <= 0) return null;
    if (num < 1) return "< 1 min";
    if (num < 60) return `${Math.round(num)} min`;
    const hrs = Math.floor(num / 60);
    const rem = Math.round(num % 60);
    return rem > 0 ? `${hrs} h ${rem} min` : `${hrs} h`;
  };

  const readableDuration = formatDuration(visit.service_duration_minutes);

  return (
    <div>
      {isSameDept ? (
        <span
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: "6px",
            background: isDark ? "rgba(2, 132, 199, 0.12)" : "#F0F9FF",
            border: isDark ? "1px solid rgba(2, 132, 199, 0.25)" : "1px solid #BAE6FD",
            color: isDark ? "#38BDF8" : "#0284C7",
            fontSize: "11.5px",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {destDept}
        </span>
      ) : (
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 700, whiteSpace: "nowrap" }}>
          <span style={{ color: textColor }}>{originDept}</span>
          <ArrowRight size={11} color={mutedText} style={{ flexShrink: 0 }} />
          <span style={{ color: isDark ? "#38BDF8" : "#0284C7" }}>{destDept}</span>
        </div>
      )}
      {readableDuration && (
        <div style={{ fontSize: "11px", color: mutedText, marginTop: "5px", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
          <Clock size={10} color={mutedText} style={{ flexShrink: 0 }} />
          <span>{readableDuration}</span>
        </div>
      )}
    </div>
  );
}

function DoctorDiagnosisCell({ details, isDark, textColor, mutedText }) {
  const diagnosis = details.diagnosis || "";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: textColor, whiteSpace: "nowrap" }}>
        <Stethoscope size={13} color="#0284C7" style={{ flexShrink: 0 }} />
        <span>{details.doctorName || "OPD Doctor"}</span>
      </div>
      {diagnosis ? (
        <div
          title={diagnosis}
          style={{
            marginTop: "5px",
            maxWidth: "240px",
            fontSize: "11px",
            fontWeight: 600,
            color: isDark ? "#93C5FD" : "#1D4ED8",
            background: isDark ? "rgba(59, 130, 246, 0.12)" : "#EFF6FF",
            border: isDark ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid #DBEAFE",
            padding: "3px 8px",
            borderRadius: "6px",
            lineHeight: "1.35",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: "help",
          }}
        >
          {diagnosis}
        </div>
      ) : (
        <div style={{ fontSize: "11px", color: mutedText, marginTop: "4px" }}>General OPD</div>
      )}
    </div>
  );
}

function DispensedByCell({ details, textColor, mutedText }) {
  const staffName = details.dispensedBy || "Pharmacy Staff";
  const counterText = details.dispensedCounter || "Counter 1";
  const timeText = details.dispensedAt
    ? new Date(details.dispensedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase()
    : "";
  const counterTimeLine = timeText ? `${counterText} · ${timeText}` : counterText;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 800, color: textColor, whiteSpace: "nowrap" }}>
        <CheckCircle2 size={12} color="#10B981" style={{ flexShrink: 0 }} />
        <span>{staffName}</span>
      </div>
      <div style={{ fontSize: "11px", color: mutedText, marginTop: "4px", whiteSpace: "nowrap" }}>
        {counterTimeLine}
      </div>
    </div>
  );
}

function StatusActionCell({ visit, isDark, textColor, isHi, cardBorder, onOpenDetails, onPrintRx }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", flexWrap: "nowrap" }}>
      <StatusBadge status={visit.status} isHi={isHi} isDark={isDark} />
      <button
        type="button"
        onClick={() => onOpenDetails(visit)}
        style={{
          padding: "6px 11px",
          borderRadius: "7px",
          border: cardBorder,
          background: isDark ? "#1E293B" : "#FFFFFF",
          color: textColor,
          fontSize: "11.5px",
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
        }}
        title={isHi ? "पूर्ण विज़िट विवरण देखें" : "View Visit Details"}
      >
        <Eye size={12} color="#0284C7" />
        <span>{isHi ? "विवरण" : "Details"}</span>
      </button>
      <button
        type="button"
        onClick={() => onPrintRx(visit)}
        style={{
          padding: "6px 12px",
          borderRadius: "7px",
          border: "none",
          background: "#0284C7",
          color: "#FFFFFF",
          fontSize: "11.5px",
          fontWeight: 800,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          boxShadow: "0 1px 3px rgba(2, 132, 199, 0.25)",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
        }}
        title={isHi ? "दवा पर्ची प्रिंट करें" : "Print Doctor Prescription"}
      >
        <Printer size={12} color="#FFFFFF" />
        <span>Rx</span>
      </button>
    </div>
  );
}

export default function PharmacyPage({
  tenantId,
  currentUser,
  analytics,
  queueSnapshot = [],
  servingTickets = [],
  heldTickets = [],
  refreshData,
  language = "en",
  setLanguage = null,
  socketRef,
  navigateTo,
  hospitalBranding = null,
  theme = "light",
  setTheme = null,
}) {
  const isHi = language === "hi";
  const effectiveHospitalCode =
    hospitalBranding?.hospital_code ||
    currentUser?.hospital_code ||
    tenantId ||
    HOSPITAL_CONFIG.tenantId ||
    "city-hospital-01";

  const brandPrimary = hospitalBranding?.primary_color || "#0284C7";
  const brandName = hospitalBranding?.hospital_name || hospitalBranding?.name || currentUser?.hospital_name || "City General Hospital";

  // Theme Sync
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) { }
    return theme || "light";
  });

  useEffect(() => {
    if (theme && (theme === "dark" || theme === "light") && theme !== currentTheme) {
      setCurrentTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    const handleThemeEvent = (e) => {
      const t = typeof e?.detail === "string" ? e.detail : e?.detail?.theme;
      if (t && (t === "dark" || t === "light")) {
        setCurrentTheme(t);
      }
    };
    window.addEventListener("theme_changed", handleThemeEvent);
    return () => window.removeEventListener("theme_changed", handleThemeEvent);
  }, []);

  const isDark = currentTheme === "dark";

  const handleToggleTheme = () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setCurrentTheme(nextTheme);
    try {
      localStorage.setItem("ai_queue_theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
      if (nextTheme === "dark") {
        document.body.classList.add("theme-dark");
        document.body.style.backgroundColor = "#090D16";
        document.body.style.color = "#F1F5F9";
      } else {
        document.body.classList.remove("theme-dark");
        document.body.style.backgroundColor = "#F8FAFC";
        document.body.style.color = "#0F172A";
      }
      window.dispatchEvent(new CustomEvent("theme_changed", { detail: nextTheme }));
    } catch (_) { }
    if (setTheme) setTheme(nextTheme);
  };

  // Station Counter & Assigned Desk State via unified hook
  const {
    desks: hospitalDesks,
    assignedDesk,
    deskScope,
    desksLoaded,
    refetchDesks: fetchHospitalDesks,
  } = useAssignedDesk({
    hospitalCode: effectiveHospitalCode,
    currentUser,
    socketRef,
    storageKey: "ai_queue_pharmacy_desks",
  });

  const [selectedDesk, setSelectedDesk] = useState(null);
  useEffect(() => {
    if (assignedDesk) {
      setSelectedDesk(assignedDesk);
      try {
        localStorage.setItem("pharmacy_active_counter", assignedDesk.desk_name);
      } catch (_) { }
    }
  }, [assignedDesk]);

  const activeCounter = assignedDesk?.desk_name || (deskScope?.isEmergencyDesk ? "Emergency Bay" : "Pharma Desk-1");
  const isEmergencyDesk = Boolean(deskScope?.isEmergencyDesk);

  const counterOptions = useMemo(() => {
    const pharmaDesks = (hospitalDesks || []).filter((d) => {
      const dCode = (d.dept_code || "").toLowerCase();
      const dName = (d.department_name || "").toLowerCase();
      const deskName = (d.desk_name || "").toLowerCase();
      return dCode === "pharmacy" || dName.includes("pharm") || deskName.includes("pharm");
    });

    const list = pharmaDesks.length > 0 ? pharmaDesks : (hospitalDesks.length > 0 ? hospitalDesks : []);

    if (list.length > 0) {
      return list.map((d) => {
        const isMyDesk = assignedDesk && d.id === assignedDesk.id;
        const assignedLabel = isMyDesk
          ? (isHi ? " [आपका आवंटित डेस्क]" : " [Your Assigned Desk]")
          : d.assigned_employee_name
            ? ` (${d.assigned_employee_name})`
            : "";
        return {
          id: `desk_${d.id}`,
          deskId: d.id,
          desk_name: d.desk_name,
          label: `${d.desk_name}${assignedLabel}`,
          rawDesk: d,
          isAssigned: isMyDesk,
        };
      });
    }

    // Default Fallback if no desks are created in database yet
    return [
      { id: "counter_1", desk_name: "Pharma Desk-1", label: isHi ? "फार्मा डेस्क-1 (सामान्य वितरण)" : "Pharma Desk-1 (General Dispensing)" },
      { id: "counter_2", desk_name: "Pharma Desk-2", label: isHi ? "फार्मा डेस्क-2 (फास्ट ट्रैक / वृद्धजन)" : "Pharma Desk-2 (Fast Track / Senior Citizens)" },
      { id: "counter_3", desk_name: "Pharma Desk-3", label: isHi ? "फार्मा डेस्क-3 (इनपेशेंट व रीफिल)" : "Pharma Desk-3 (Inpatient & Refills)" },
    ];
  }, [hospitalDesks, assignedDesk, isHi]);

  // Pharmacist Duty Status: "ACTIVE" | "ON_BREAK" | "SHIFT_ENDED"
  const userStorageKey = currentUser?.email || currentUser?.id || "default";

  const [pharmaDutyStatus, setPharmaDutyStatus] = useState(() => {
    try {
      const savedUser = localStorage.getItem(`pharma_duty_status_${userStorageKey}`);
      if (savedUser && ["ACTIVE", "ON_BREAK", "SHIFT_ENDED"].includes(savedUser)) {
        return savedUser;
      }
      const saved = localStorage.getItem("pharma_duty_status");
      if (saved && ["ACTIVE", "ON_BREAK", "SHIFT_ENDED"].includes(saved)) {
        return saved;
      }
    } catch (_) { }
    return "ACTIVE";
  });
  const [showDutyDropdown, setShowDutyDropdown] = useState(false);
  const dutyDropdownRef = useRef(null);

  const handleUpdateDutyStatus = useCallback((status) => {
    setPharmaDutyStatus(status);
    try {
      localStorage.setItem(`pharma_duty_status_${userStorageKey}`, status);
      localStorage.setItem("pharma_duty_status", status);
    } catch (_) { }

    const targetUserId = currentUser?.id || currentUser?.user_id;
    const targetEmail = currentUser?.email;
    const targetName = currentUser?.name || currentUser?.username || "Head Pharmacist";

    const payload = {
      tenant_id: effectiveHospitalCode || tenantId,
      doctor_id: targetUserId,
      staff_id: targetUserId,
      user_id: targetUserId,
      doctor_email: targetEmail,
      staff_email: targetEmail,
      email: targetEmail,
      doctor_name: targetName,
      staff_name: targetName,
      name: targetName,
      role: "pharmacist",
      status: status, // "ACTIVE" | "ON_BREAK" | "SHIFT_ENDED"
      break_type: status === "ON_BREAK" ? "tea" : null,
    };

    // Emit live over socket to instantly update Super Admin and all terminals
    if (socketRef && socketRef.current) {
      socketRef.current.emit("update_doctor_duty_status", payload);
      socketRef.current.emit("update_staff_duty_status", payload);
    }

    // Persist to backend PostgreSQL database
    const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
    fetch(`${API_BASE}/api/v1/doctor/duty-status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    }).catch(() => { });
  }, [currentUser, effectiveHospitalCode, tenantId, socketRef, userStorageKey]);

  // Sync duty status from backend server on mount
  useEffect(() => {
    const pharmaId = currentUser?.id || currentUser?.user_id || currentUser?.email;
    if (!pharmaId) return;

    fetch(`${API_BASE}/api/v1/doctor/duty-status/${encodeURIComponent(pharmaId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success" && d.duty && d.duty.status) {
          const s = d.duty.status;
          const mapped = s === "OFF_DUTY" ? "SHIFT_ENDED" : s;
          if (["ACTIVE", "ON_BREAK", "SHIFT_ENDED"].includes(mapped)) {
            setPharmaDutyStatus(mapped);
            try {
              localStorage.setItem(`pharma_duty_status_${userStorageKey}`, mapped);
              localStorage.setItem("pharma_duty_status", mapped);
            } catch (_) { }
          }
        }
      })
      .catch(() => { });
  }, [currentUser, userStorageKey]);

  // Socket listener for duty status updates
  useEffect(() => {
    if (!socketRef || !socketRef.current) return;
    const s = socketRef.current;
    const handleDutyChange = (data) => {
      if (!data) return;
      const targetId = data.doctor_id || data.staff_id || data.user_id;
      const targetEmail = data.doctor_email || data.staff_email || data.email;
      const matchesMe =
        (targetId && currentUser?.id && String(targetId) === String(currentUser.id)) ||
        (targetEmail && currentUser?.email && String(targetEmail).toLowerCase() === String(currentUser.email).toLowerCase());

      if (matchesMe && data.duty && data.duty.status) {
        const rawStatus = data.duty.status;
        const mapped = rawStatus === "OFF_DUTY" ? "SHIFT_ENDED" : rawStatus;
        if (["ACTIVE", "ON_BREAK", "SHIFT_ENDED"].includes(mapped)) {
          setPharmaDutyStatus(mapped);
          try {
            localStorage.setItem(`pharma_duty_status_${userStorageKey}`, mapped);
            localStorage.setItem("pharma_duty_status", mapped);
          } catch (_) { }
        }
      }
    };

    s.on("doctor_duty_status_changed", handleDutyChange);
    s.on("staff_duty_status_changed", handleDutyChange);
    return () => {
      s.off("doctor_duty_status_changed", handleDutyChange);
      s.off("staff_duty_status_changed", handleDutyChange);
    };
  }, [socketRef, currentUser, userStorageKey]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dutyDropdownRef.current && !dutyDropdownRef.current.contains(e.target)) {
        setShowDutyDropdown(false);
      }
    };
    if (showDutyDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDutyDropdown]);

  const dutyStatusOptions = [
    {
      id: "ACTIVE",
      label: isHi ? "ड्यूटी पर सक्रिय" : "Active on Duty",
      badgeLabel: isHi ? "सक्रिय" : "Active on Duty",
      icon: <span style={{ display: "inline-block", width: "9px", height: "9px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px rgba(16, 185, 129, 0.8)" }} />,
      color: "#10B981",
      bg: isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5",
      border: isDark ? "rgba(16, 185, 129, 0.45)" : "#A7F3D0",
      desc: isHi ? "दवा वितरण व कतार कॉलिंग हेतु उपलब्ध" : "Ready to dispense & call queue",
    },
    {
      id: "ON_BREAK",
      label: isHi ? "चाय / अल्पाहार अवकाश" : "On Tea Break",
      badgeLabel: isHi ? "अवकाश पर" : "On Tea Break",
      icon: <Coffee size={13} color="#D97706" />,
      color: "#D97706",
      bg: isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7",
      border: isDark ? "rgba(245, 158, 11, 0.5)" : "#FDE68A",
      desc: isHi ? "वितरण कॉलिंग अस्थायी रूप से रुकी है" : "Dispensing temporarily paused",
    },
    {
      id: "SHIFT_ENDED",
      label: isHi ? "शिफ्ट समाप्त (ऑफ ड्यूटी)" : "Shift Ended",
      badgeLabel: isHi ? "शिफ्ट समाप्त" : "Shift Ended",
      icon: <span style={{ display: "inline-block", width: "9px", height: "9px", borderRadius: "50%", background: "#EF4444", boxShadow: "0 0 6px rgba(239, 68, 68, 0.8)" }} />,
      color: "#EF4444",
      bg: isDark ? "rgba(239, 68, 68, 0.2)" : "#FEF2F2",
      border: isDark ? "rgba(239, 68, 68, 0.45)" : "#FECACA",
      desc: isHi ? "फार्मेसी काउंटर आज के लिए बंद" : "Counter offline / shift closed",
    },
  ];

  // Active Workspace Tab: "dispensing" | "queue" | "history"
  const [activeTab, setActiveTab] = useState("dispensing");

  // Patient Visit History Section State
  const [patientVisits, setPatientVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitsError, setVisitsError] = useState(null);
  const [visitScopeFilter, setVisitScopeFilter] = useState("all"); // "all" | "my"
  const [visitSearchQuery, setVisitSearchQuery] = useState("");

  // Local calendar date string helper (YYYY-MM-DD)
  const getLocalDateStr = useCallback((d = new Date()) => {
    try {
      const dateObj = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
      if (isNaN(dateObj.getTime())) return "";
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch (_) {
      return "";
    }
  }, []);

  const getTodayDateStr = useCallback(() => getLocalDateStr(new Date()), [getLocalDateStr]);

  const getYesterdayDateStr = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateStr(d);
  }, [getLocalDateStr]);

  // Date filtering mode: "today" | "yesterday" | "date_wise" | "all"
  const [visitDateFilter, setVisitDateFilter] = useState("today");

  // Custom date selection for "date_wise" filter (defaults to today)
  const [customVisitDate, setCustomVisitDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  // Status filter: "all" | "completed" | "in_progress" | "pending" | "cancelled"
  const [visitStatusFilter, setVisitStatusFilter] = useState("all");
  const [visitDoctorFilter, setVisitDoctorFilter] = useState("all");
  const [visitPage, setVisitPage] = useState(1);
  const [visitRowsPerPage, setVisitRowsPerPage] = useState(10);

  const [selectedVisitModal, setSelectedVisitModal] = useState(null);
  const [modalMedStatusMap, setModalMedStatusMap] = useState({});
  const [savingModalDispense, setSavingModalDispense] = useState(false);

  // Fetch Patient Visit History from Backend
  const fetchPatientVisits = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    setLoadingVisits(true);
    setVisitsError(null);
    try {
      const headers = { "Content-Type": "application/json" };
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      const res = await fetch(`${API_BASE}/api/v1/hospitals/${effectiveHospitalCode}/visits?limit=500`, {
        headers,
      });

      if (res.status === 401 || res.status === 403) {
        setVisitsError({
          type: "permission",
          status: res.status,
          message: isHi
            ? "अनुमति अस्वीकृत (403): आपके पास इस अस्पताल के विज़िट रिकॉर्ड देखने की अनुमति नहीं है।"
            : "Permission Denied (403): You do not have permission to view visit records for this hospital.",
        });
        setPatientVisits([]);
        return;
      }

      if (!res.ok) {
        let errMsg = isHi ? `त्रुटि ${res.status}: विज़िट लोड करने में विफल` : `Error ${res.status}: Failed to load patient visits`;
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
        } catch (_) { }
        setVisitsError({
          type: "http",
          status: res.status,
          message: errMsg,
        });
        setPatientVisits([]);
        return;
      }

      const data = await res.json();
      if (data && data.status === "success") {
        setPatientVisits(Array.isArray(data.visits) ? data.visits : []);
        setVisitsError(null);
      } else {
        setVisitsError({
          type: "response",
          message: data?.message || (isHi ? "विज़िट डेटा प्राप्त करने में विफल" : "Failed to retrieve visit data"),
        });
        setPatientVisits([]);
      }
    } catch (err) {
      console.error("Failed to load patient visits:", err);
      setVisitsError({
        type: "network",
        message: isHi ? "नेटवर्क त्रुटि: सर्वर से कनेक्ट नहीं हो सका।" : (err.message || "Network error: Unable to connect to server."),
      });
      setPatientVisits([]);
    } finally {
      setLoadingVisits(false);
    }
  }, [effectiveHospitalCode, currentUser?.email, currentUser?.token, isHi]);

  // Initial load of visit history
  useEffect(() => {
    fetchPatientVisits();
  }, [fetchPatientVisits]);

  // Parse structured clinical details from visit & transfer stages
  const parseVisitDetails = useCallback((visit) => {
    if (!visit) {
      return {
        doctorName: "",
        diagnosis: "",
        medicines: [],
        advice: "",
        followUp: "",
        dispensedBy: "",
        dispensedById: "",
        dispensedByEmail: "",
        dispensedCounter: "",
        dispensedCounterId: "",
        dispensedAt: null,
        isPharmaVisit: false,
      };
    }

    let doctorName = "";
    let diagnosis = visit.medical_condition || "";
    let medicines = [];
    let advice = "";
    let followUp = "";
    let dispensedBy = "";
    let dispensedById = "";
    let dispensedByEmail = "";
    let dispensedCounter = "";
    let dispensedCounterId = "";
    let dispensedAt = null;

    const stages = Array.isArray(visit.transfer_stages) ? visit.transfer_stages : [];
    const consultStage = stages.find((s) => {
      const c = (s.dept_code || s.department || "").toLowerCase();
      return c.includes("consult") || c.includes("opd") || c.includes("doctor");
    }) || stages[0];

    const pharmaStage = stages.find((s) => {
      const c = (s.dept_code || s.department || "").toLowerCase();
      return c.includes("pharm");
    });

    const isPharmaVisit = Boolean(
      (visit.dept_code || visit.department || "").toLowerCase().includes("pharm") ||
      pharmaStage
    );

    const notesToParse = consultStage?.notes || visit.prescription_notes || "";
    if (notesToParse) {
      try {
        let raw = typeof notesToParse === "string" ? notesToParse.trim() : notesToParse;
        let parsed = null;
        if (typeof raw === "string") {
          try {
            parsed = JSON.parse(raw);
          } catch (_) {
            const labelPattern = /\[([^\]]+)\]:\s*\{/g;
            let m;
            while ((m = labelPattern.exec(raw)) !== null) {
              const start = m.index + m[0].length - 1;
              let depth = 0;
              for (let i = start; i < raw.length; i++) {
                if (raw[i] === "{") depth++;
                else if (raw[i] === "}") {
                  depth--;
                  if (depth === 0) {
                    try {
                      const cand = JSON.parse(raw.slice(start, i + 1));
                      if (!parsed || m[1].toLowerCase().includes("consult") || m[1].toLowerCase().includes("opd")) {
                        parsed = cand;
                      }
                    } catch (_) {}
                    break;
                  }
                }
              }
            }
            if (!parsed) {
              const firstBrace = raw.indexOf("{");
              if (firstBrace !== -1) {
                let depth = 0;
                for (let i = firstBrace; i < raw.length; i++) {
                  if (raw[i] === "{") depth++;
                  else if (raw[i] === "}") {
                    depth--;
                    if (depth === 0) {
                      try { parsed = JSON.parse(raw.slice(firstBrace, i + 1)); } catch (_) {}
                      break;
                    }
                  }
                }
              }
            }
          }
        } else if (typeof raw === "object") {
          parsed = raw;
        }

        if (parsed) {
          doctorName = parsed.doctor_name || doctorName;
          diagnosis = parsed.diagnosis || diagnosis;
          if (Array.isArray(parsed.medicines)) medicines = parsed.medicines;
          advice = parsed.advice || advice;
          followUp = parsed.follow_up || followUp;
          dispensedBy = parsed.dispensed_by || dispensedBy;
          dispensedById = parsed.dispensed_by_id || dispensedById;
          dispensedByEmail = parsed.dispensed_by_email || dispensedByEmail;
          dispensedCounter = parsed.dispensing_counter || dispensedCounter;
          dispensedCounterId = parsed.dispensed_counter_id || dispensedCounterId;
          dispensedAt = parsed.dispensed_at || dispensedAt;
        }
      } catch (_) { }
    }

    if (pharmaStage?.notes) {
      try {
        let rawP = typeof pharmaStage.notes === "string" ? pharmaStage.notes.trim() : pharmaStage.notes;
        if (typeof rawP === "string") {
          const jsonMatch = rawP.match(/\{[\s\S]*\}/);
          if (jsonMatch) rawP = jsonMatch[0];
          const parsedP = JSON.parse(rawP);
          if (parsedP.dispensed_by) dispensedBy = parsedP.dispensed_by;
          if (parsedP.dispensed_by_id) dispensedById = parsedP.dispensed_by_id;
          if (parsedP.dispensed_by_email) dispensedByEmail = parsedP.dispensed_by_email;
          if (parsedP.dispensing_counter) dispensedCounter = parsedP.dispensing_counter;
          if (parsedP.dispensed_counter_id) dispensedCounterId = parsedP.dispensed_counter_id;
          if (parsedP.dispensed_at) dispensedAt = parsedP.dispensed_at;
          if (Array.isArray(parsedP.medicines) && parsedP.medicines.length > 0) {
            if (medicines.length > 0) {
              medicines = medicines.map((m, idx) => {
                const match = parsedP.medicines.find(pm => (pm.name || "").trim().toLowerCase() === (m.name || "").trim().toLowerCase()) || parsedP.medicines[idx];
                return { ...m, ...(match || {}) };
              });
            } else {
              medicines = parsedP.medicines;
            }
          }
        }
      } catch (_) { }
    }

    if (visit.prescription_notes && visit.prescription_notes !== consultStage?.notes) {
      try {
        let rawV = typeof visit.prescription_notes === "string" ? visit.prescription_notes.trim() : visit.prescription_notes;
        if (typeof rawV === "string") {
          const jsonMatch = rawV.match(/\{[\s\S]*\}/);
          if (jsonMatch) rawV = jsonMatch[0];
          const parsedV = JSON.parse(rawV);
          if (parsedV.dispensed_by) dispensedBy = parsedV.dispensed_by;
          if (parsedV.dispensed_at) dispensedAt = parsedV.dispensed_at;
          if (parsedV.dispensing_counter) dispensedCounter = parsedV.dispensing_counter;
          if (Array.isArray(parsedV.medicines) && parsedV.medicines.length > 0) {
            if (medicines.length > 0) {
              medicines = medicines.map((m, idx) => {
                const match = parsedV.medicines.find(pm => (pm.name || "").trim().toLowerCase() === (m.name || "").trim().toLowerCase()) || parsedV.medicines[idx];
                return { ...m, ...(match || {}) };
              });
            } else {
              medicines = parsedV.medicines;
            }
          }
        }
      } catch (_) { }
    }

    if (!doctorName && consultStage?.served_by) {
      doctorName = consultStage.served_by;
    }
    if (!dispensedBy && pharmaStage?.served_by) {
      dispensedBy = pharmaStage.served_by;
    }
    if (!dispensedBy && visit.served_by && isPharmaVisit) {
      dispensedBy = visit.served_by;
    }
    if (!dispensedCounter && pharmaStage?.counter) {
      dispensedCounter = pharmaStage.counter;
    }
    if (!dispensedCounter && pharmaStage?.desk_name) {
      dispensedCounter = pharmaStage.desk_name;
    }

    return {
      doctorName: doctorName || "Attending Physician",
      diagnosis: diagnosis || "General Consultation",
      medicines,
      advice,
      followUp,
      dispensedBy: dispensedBy || (pharmaStage?.status === "completed" ? (currentUser?.name || "Pharmacy Staff") : "Pharmacy Staff"),
      dispensedById,
      dispensedByEmail,
      dispensedCounter: dispensedCounter || (pharmaStage ? (activeCounter || "Pharma Desk") : "Pharma Desk"),
      dispensedCounterId,
      dispensedAt: dispensedAt || pharmaStage?.serve_end_time || null,
      isPharmaVisit,
    };
  }, [activeCounter, currentUser?.name]);

  // Helper to determine whether a medicine was given or not given
  const getMedicineDispenseStatus = useCallback((med, visit) => {
    if (!med) return { isGiven: false, statusText: "Not Given", statusLabel: isHi ? "नहीं दी गई" : "Not Given", color: "#EF4444" };

    if (
      med.dispensed === true ||
      med.given === true ||
      med.dispense_status === "given" ||
      med.dispense_status === "dispensed" ||
      med.status === "dispensed" ||
      med.status === "given"
    ) {
      return { isGiven: true, statusText: "Given", statusLabel: isHi ? "दी गई" : "Given", color: "#10B981" };
    }
    if (
      med.dispensed === false ||
      med.given === false ||
      med.dispense_status === "not_given" ||
      med.dispense_status === "not_dispensed" ||
      med.status === "not_dispensed" ||
      med.status === "not_given" ||
      med.status === "out_of_stock" ||
      med.status === "cancelled"
    ) {
      return { isGiven: false, statusText: "Not Given", statusLabel: isHi ? "नहीं दी गई" : "Not Given", color: "#EF4444" };
    }

    // Rule 3: If an item was never marked before completion, display it as "Not Given" by default.
    const visitStatus = String(visit?.status || "").trim().toLowerCase();
    const isCompleted = visitStatus === "completed";
    if (isCompleted || !visit) {
      return { isGiven: false, statusText: "Not Given", statusLabel: isHi ? "नहीं दी गई" : "Not Given", color: "#EF4444" };
    }

    return { isGiven: false, statusText: "Pending", statusLabel: isHi ? "लंबित" : "Pending", color: "#F59E0B" };
  }, [isHi]);

  // Synchronize modal medicine status map when a visit modal is opened
  useEffect(() => {
    if (selectedVisitModal) {
      const details = parseVisitDetails(selectedVisitModal);
      const initialMap = {};
      (details.medicines || []).forEach((m, idx) => {
        initialMap[idx] = getMedicineDispenseStatus(m, selectedVisitModal).isGiven;
      });
      setModalMedStatusMap(initialMap);
    } else {
      setModalMedStatusMap({});
    }
  }, [selectedVisitModal, parseVisitDetails, getMedicineDispenseStatus]);

  const handleToggleModalMedStatus = useCallback((idx) => {
    if (!selectedVisitModal) return;
    const vStatus = String(selectedVisitModal.status || "").trim().toLowerCase();
    const isCompleted = vStatus === "completed";
    const isInProgress = vStatus === "in_progress" || vStatus === "serving";
    if (isCompleted || !isInProgress) {
      showToast(isHi ? "परामर्श पूर्ण हो चुका है। स्थिति में बदलाव नहीं किया जा सकता।" : "Consultation is completed. Status cannot be modified.", "warning");
      return;
    }
    setModalMedStatusMap((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }, [selectedVisitModal, isHi]);

  const handleSetAllModalMeds = useCallback((status) => {
    if (!selectedVisitModal) return;
    const vStatus = String(selectedVisitModal.status || "").trim().toLowerCase();
    const isCompleted = vStatus === "completed";
    const isInProgress = vStatus === "in_progress" || vStatus === "serving";
    if (isCompleted || !isInProgress) {
      showToast(isHi ? "परामर्श पूर्ण हो चुका है। स्थिति में बदलाव नहीं किया जा सकता।" : "Consultation is completed. Status cannot be modified.", "warning");
      return;
    }
    const details = parseVisitDetails(selectedVisitModal);
    const next = {};
    (details.medicines || []).forEach((_, idx) => {
      next[idx] = status;
    });
    setModalMedStatusMap(next);
  }, [selectedVisitModal, parseVisitDetails, isHi]);

  const modalHasChanges = useMemo(() => {
    if (!selectedVisitModal) return false;
    const vStatus = String(selectedVisitModal.status || "").trim().toLowerCase();
    const isCompleted = vStatus === "completed";
    const isInProgress = vStatus === "in_progress" || vStatus === "serving";
    if (isCompleted || !isInProgress) return false;

    const details = parseVisitDetails(selectedVisitModal);
    if (!details.medicines || details.medicines.length === 0) return false;
    return details.medicines.some((m, idx) => {
      const origStatus = getMedicineDispenseStatus(m, selectedVisitModal).isGiven;
      const currStatus = modalMedStatusMap[idx];
      return currStatus !== undefined && currStatus !== origStatus;
    });
  }, [selectedVisitModal, parseVisitDetails, getMedicineDispenseStatus, modalMedStatusMap]);

  const modalStats = useMemo(() => {
    if (!selectedVisitModal) return { total: 0, given: 0, notGiven: 0 };
    const details = parseVisitDetails(selectedVisitModal);
    const total = (details.medicines || []).length;
    let given = 0;
    (details.medicines || []).forEach((m, idx) => {
      const isG = modalMedStatusMap[idx] !== undefined
        ? modalMedStatusMap[idx]
        : getMedicineDispenseStatus(m, selectedVisitModal).isGiven;
      if (isG) given++;
    });
    return { total, given, notGiven: total - given };
  }, [selectedVisitModal, parseVisitDetails, getMedicineDispenseStatus, modalMedStatusMap]);

  const handleSaveModalDispenseChanges = async () => {
    if (!selectedVisitModal) return;
    const visit = selectedVisitModal;
    const vStatus = String(visit.status || "").trim().toLowerCase();
    const isCompleted = vStatus === "completed";
    const isInProgress = vStatus === "in_progress" || vStatus === "serving";
    if (isCompleted || !isInProgress) {
      showToast(isHi ? "परामर्श पूर्ण हो चुका है। स्थिति में बदलाव नहीं किया जा सकता।" : "Consultation is completed. Status cannot be modified.", "error");
      return;
    }
    const details = parseVisitDetails(visit);
    if (!details.medicines || details.medicines.length === 0) return;

    setSavingModalDispense(true);
    try {
      const updatedMeds = details.medicines.map((m, idx) => {
        const isGiven = modalMedStatusMap[idx] !== undefined
          ? Boolean(modalMedStatusMap[idx])
          : getMedicineDispenseStatus(m, visit).isGiven;

        return {
          ...m,
          dispensed: isGiven,
          given: isGiven,
          dispense_status: isGiven ? "given" : "not_given",
          status: isGiven ? "dispensed" : "not_dispensed",
          dispensed_by: currentUser?.name || currentUser?.username || details.dispensedBy || "Pharmacy Staff",
          dispensed_at: isGiven ? (m.dispensed_at || new Date().toISOString()) : null,
        };
      });

      const givenCount = updatedMeds.filter((m) => m.dispensed).length;
      const unverifiedCount = updatedMeds.filter((m) => !m.dispensed).length;

      const updatedPayload = {
        doctor_name: details.doctorName,
        diagnosis: details.diagnosis,
        advice: details.advice,
        follow_up: details.followUp,
        medicines: updatedMeds,
        dispensed_by: currentUser?.name || currentUser?.username || details.dispensedBy || "Pharmacy Staff",
        dispensed_by_id: currentUser?.id || currentUser?.user_id || currentUser?.employee_id || details.dispensedById || "",
        dispensed_by_email: currentUser?.email || details.dispensedByEmail || "",
        dispensed_at: details.dispensedAt || new Date().toISOString(),
        dispensing_counter: details.dispensedCounter || activeCounter,
        dispensed_counter_id: details.dispensedCounterId || assignedDesk?.id || "",
        all_verified: unverifiedCount === 0,
        dispensing_summary: {
          total: updatedMeds.length,
          given: givenCount,
          not_given: unverifiedCount,
        },
      };

      const tid = visit.ticket_id || visit.token_number;
      const res = await fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: tid,
          prescription: updatedPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.success) {
        throw new Error(data.message || "Failed to update prescription");
      }

      // Update selectedVisitModal in place so user immediately sees changes
      setSelectedVisitModal((prev) => {
        if (!prev) return prev;
        const newStages = Array.isArray(prev.transfer_stages)
          ? prev.transfer_stages.map((stg) => {
              const c = (stg.dept_code || stg.department || "").toLowerCase();
              if (c.includes("pharm")) {
                return { ...stg, notes: JSON.stringify(updatedPayload) };
              }
              return stg;
            })
          : [];
        return {
          ...prev,
          prescription_notes: JSON.stringify(updatedPayload),
          transfer_stages: newStages.length > 0 ? newStages : prev.transfer_stages,
        };
      });

      showToast(
        isHi
          ? `दवा वितरण स्थिति सफलतापूर्वक सहेजी गई (${givenCount} दी गईं, ${unverifiedCount} नहीं दी गईं)!`
          : `Dispensing status saved successfully (${givenCount} Given, ${unverifiedCount} Not Given)!`,
        "success"
      );

      // Refresh visit history list
      fetchPatientVisits();
    } catch (err) {
      showToast(`Error updating status: ${err.message}`, "error");
    } finally {
      setSavingModalDispense(false);
    }
  };

  // Check if a visit belongs to Pharmacy department (by dept_code, department name, or any transfer stage)
  const isPharmacyVisit = useCallback((visit) => {
    if (!visit) return false;
    const hasPharmaDept = (visit.dept_code || visit.department || "").toLowerCase().includes("pharm");
    const pharmaStage = Array.isArray(visit.transfer_stages) && visit.transfer_stages.find((s) => {
      const c = (s.dept_code || s.department || "").toLowerCase();
      return c.includes("pharm");
    });
    return Boolean(hasPharmaDept || pharmaStage);
  }, []);

  // Check if a visit was dispensed / served by the logged-in pharmacist ("My Dispensing")
  const checkConsultMatch = useCallback((visit, details) => {
    if (!isPharmacyVisit(visit)) return false;

    // Pharmacist personal identifiers
    const myId = String(currentUser?.id || currentUser?.user_id || currentUser?.employee_id || "").trim().toLowerCase();
    const myEmail = (currentUser?.email || "").trim().toLowerCase();
    const myName = (currentUser?.name || "").trim().toLowerCase();
    const myUsername = (currentUser?.username || "").trim().toLowerCase();

    const dispById = String(details.dispensedById || "").trim().toLowerCase();
    const dispByEmail = (details.dispensedByEmail || "").trim().toLowerCase();
    const dispBy = (details.dispensedBy || "").trim().toLowerCase();

    const pharmaStage = Array.isArray(visit.transfer_stages) && visit.transfer_stages.find((s) => {
      const c = (s.dept_code || s.department || "").toLowerCase();
      return c.includes("pharm");
    });
    const servedBy = (pharmaStage?.served_by || visit.served_by || "").trim().toLowerCase();

    // 1. Prefer exact matches on ID
    if (myId && dispById && myId === dispById) return true;

    // 2. Prefer exact matches on Email
    if (myEmail && dispByEmail && myEmail === dispByEmail) return true;
    if (myEmail && dispBy && dispBy === myEmail) return true;
    if (myEmail && servedBy && servedBy === myEmail) return true;

    // Safe string matcher guarding against empty strings (myName.includes("") is always true in JS)
    const safeStringMatch = (source, target) => {
      if (!source || !target) return false;
      return source === target || source.includes(target) || target.includes(source);
    };

    // 3. Name & Username matching (guarded against empty strings)
    if (myName && (safeStringMatch(dispBy, myName) || safeStringMatch(servedBy, myName))) {
      return true;
    }
    if (myUsername && (safeStringMatch(dispBy, myUsername) || safeStringMatch(servedBy, myUsername))) {
      return true;
    }

    return false;
  }, [
    isPharmacyVisit,
    currentUser?.employee_id,
    currentUser?.id,
    currentUser?.user_id,
    currentUser?.name,
    currentUser?.username,
    currentUser?.email,
  ]);

  // Check if a visit matches the target date filter
  const checkVisitDateMatch = useCallback((visit, details, dateFilter, customDate) => {
    if (dateFilter === "all") return true;

    // Collect all candidate date representations in local YYYY-MM-DD
    const dates = new Set();

    if (visit.queue_date) {
      const qd = String(visit.queue_date).split("T")[0].trim();
      if (qd) dates.add(qd);
    }

    if (details.dispensedAt) {
      const dStr = getLocalDateStr(details.dispensedAt);
      if (dStr) dates.add(dStr);
    }

    if (visit.created_at) {
      const dStr = getLocalDateStr(visit.created_at);
      if (dStr) dates.add(dStr);
    }

    if (Array.isArray(visit.transfer_stages)) {
      const pStage = visit.transfer_stages.find((s) => (s.dept_code || s.department || "").toLowerCase().includes("pharm"));
      if (pStage?.serve_end_time) {
        const dStr = getLocalDateStr(pStage.serve_end_time);
        if (dStr) dates.add(dStr);
      }
      if (pStage?.created_at) {
        const dStr = getLocalDateStr(pStage.created_at);
        if (dStr) dates.add(dStr);
      }
    }

    const todayStr = getTodayDateStr();
    const yesterdayStr = getYesterdayDateStr();

    if (dateFilter === "today") {
      return dates.has(todayStr);
    }
    if (dateFilter === "yesterday") {
      return dates.has(yesterdayStr);
    }
    if (dateFilter === "date_wise") {
      if (!customDate) return true;
      return dates.has(customDate);
    }
    return true;
  }, [getLocalDateStr, getTodayDateStr, getYesterdayDateStr]);

  // All pharmacy visits matching current scope ("All pharmacy visits" vs "My dispensing")
  const pharmaScopedVisits = useMemo(() => {
    return patientVisits.filter((v) => {
      if (!isPharmacyVisit(v)) return false;
      if (visitScopeFilter === "my") {
        const details = parseVisitDetails(v);
        return checkConsultMatch(v, details);
      }
      return true;
    });
  }, [patientVisits, isPharmacyVisit, visitScopeFilter, parseVisitDetails, checkConsultMatch]);

  // Telemetry counts for dates and statuses based on current scope
  const dateCounts = useMemo(() => {
    let today = 0;
    let yesterday = 0;
    let custom = 0;
    let completed = 0;

    const todayStr = getTodayDateStr();
    const yesterdayStr = getYesterdayDateStr();

    pharmaScopedVisits.forEach((v) => {
      const details = parseVisitDetails(v);
      const isComplete = (v.status || "").toLowerCase() === "completed";
      if (isComplete) completed++;

      if (checkVisitDateMatch(v, details, "today", todayStr)) today++;
      if (checkVisitDateMatch(v, details, "yesterday", yesterdayStr)) yesterday++;
      if (customVisitDate && checkVisitDateMatch(v, details, "date_wise", customVisitDate)) custom++;
    });

    return {
      all: pharmaScopedVisits.length,
      today,
      yesterday,
      custom,
      completed,
    };
  }, [pharmaScopedVisits, parseVisitDetails, checkVisitDateMatch, getTodayDateStr, getYesterdayDateStr, customVisitDate]);

  // Extract unique list of doctors for the filter dropdown
  const availableDoctors = useMemo(() => {
    const docSet = new Set();
    pharmaScopedVisits.forEach((v) => {
      const details = parseVisitDetails(v);
      if (details.doctorName && details.doctorName.trim()) {
        docSet.add(details.doctorName.trim());
      }
    });
    return Array.from(docSet).sort();
  }, [pharmaScopedVisits, parseVisitDetails]);

  // Filtered visits computation
  const filteredVisits = useMemo(() => {
    let list = pharmaScopedVisits;

    // 1. Date filter: today | yesterday | date_wise | all
    list = list.filter((v) => {
      const details = parseVisitDetails(v);
      return checkVisitDateMatch(v, details, visitDateFilter, customVisitDate);
    });

    // 2. Status filter: all | completed | in_progress | pending | cancelled
    if (visitStatusFilter === "completed") {
      list = list.filter((v) => (v.status || "").toLowerCase() === "completed");
    } else if (visitStatusFilter === "in_progress") {
      list = list.filter((v) => ["serving", "in_progress", "transferred"].includes((v.status || "").toLowerCase()));
    } else if (visitStatusFilter === "pending" || visitStatusFilter === "waiting") {
      list = list.filter((v) => ["waiting", "pending"].includes((v.status || "").toLowerCase()));
    } else if (visitStatusFilter === "cancelled") {
      list = list.filter((v) => ["cancelled", "no_show"].includes((v.status || "").toLowerCase()));
    }

    // 3. Doctor filter
    if (visitDoctorFilter && visitDoctorFilter !== "all") {
      list = list.filter((v) => {
        const details = parseVisitDetails(v);
        return (details.doctorName || "").trim().toLowerCase() === visitDoctorFilter.trim().toLowerCase();
      });
    }

    // 4. Search query
    if (!visitSearchQuery.trim()) return list;
    const q = visitSearchQuery.toLowerCase().trim();
    return list.filter((v) => {
      const name = (v.patient_name || "").toLowerCase();
      const token = String(v.token_number || v.ticket_id || "").toLowerCase();
      const phone = (v.phone || "").toLowerCase();
      const details = parseVisitDetails(v);
      const doc = (details.doctorName || "").toLowerCase();
      const diag = (details.diagnosis || "").toLowerCase();
      const dispensedBy = (details.dispensedBy || "").toLowerCase();
      const counter = (details.dispensedCounter || "").toLowerCase();
      const medMatch = details.medicines.some((m) => (m.name || "").toLowerCase().includes(q));
      return (
        name.includes(q) ||
        token.includes(q) ||
        phone.includes(q) ||
        doc.includes(q) ||
        diag.includes(q) ||
        dispensedBy.includes(q) ||
        counter.includes(q) ||
        medMatch
      );
    });
  }, [
    pharmaScopedVisits,
    parseVisitDetails,
    checkVisitDateMatch,
    visitDateFilter,
    customVisitDate,
    visitStatusFilter,
    visitDoctorFilter,
    visitSearchQuery,
  ]);

  // Reset page when filter criteria change
  useEffect(() => {
    setVisitPage(1);
  }, [visitDateFilter, customVisitDate, visitStatusFilter, visitDoctorFilter, visitSearchQuery, visitRowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / visitRowsPerPage));
  const currentPage = Math.min(visitPage, totalPages);
  const paginatedVisits = useMemo(() => {
    const start = (currentPage - 1) * visitRowsPerPage;
    return filteredVisits.slice(start, start + visitRowsPerPage);
  }, [filteredVisits, currentPage, visitRowsPerPage]);

  // Export visit logs to Excel
  const handleExportVisitsExcel = () => {
    try {
      const exportRows = filteredVisits.map((v) => {
        const details = parseVisitDetails(v);
        return {
          "Token #": v.token_number || v.ticket_id,
          "Patient Name": v.patient_name,
          "Age": v.age || "N/A",
          "Gender": v.gender || "N/A",
          "Phone": v.phone || "N/A",
          "Visit Date": v.queue_date || (v.created_at ? v.created_at.split("T")[0] : ""),
          "Initial Department": v.origin_department || "OPD",
          "Final Department": v.department || "Pharmacy",
          "Status": (v.status || "").toUpperCase(),
          "Doctor Name": details.doctorName,
          "Clinical Diagnosis": details.diagnosis,
          "Dispensed By": details.dispensedBy,
          "Dispensing Counter": details.dispensedCounter,
          "Dispensed At": details.dispensedAt ? new Date(details.dispensedAt).toLocaleTimeString() : "N/A",
          "Total Medicines Prescribed": details.medicines.length,
          "Medicines List": details.medicines.map((m) => `${m.name} (${m.dosage || ""} ${m.frequency || ""})`).join("; "),
          "Doctor Advice": details.advice || "N/A",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Patient Visits");
      XLSX.writeFile(workbook, `Hospital_Patient_Visits_${new Date().toISOString().split("T")[0]}.xlsx`);
      showToast(isHi ? "विज़िट इतिहास एक्सेल में निर्यात किया गया!" : "Exported visit records to Excel!", "success");
    } catch (err) {
      console.error("Export error:", err);
      showToast("Failed to export Excel: " + err.message, "error");
    }
  };

  // Re-print prescription slip from visit history record
  const handlePrintVisitPrescription = (visit) => {
    if (!visit) return;
    const details = parseVisitDetails(visit);
    const fullData = {
      patient_name: visit.patient_name || "Patient",
      age: visit.age || 30,
      gender: visit.gender || "Patient",
      phone: visit.phone || "",
      ticket_id: visit.token_number || visit.ticket_id,
      doctor_name: details.doctorName || "Attending Physician",
      doctor_department: visit.origin_department || "OPD",
      diagnosis: details.diagnosis || "",
      medicines: details.medicines || [],
      advice: details.advice || "",
      follow_up: details.followUp || "",
      hospital_name: brandName,
      prescribed_at: visit.created_at || new Date().toISOString(),
    };
    printPrescriptionSlip(fullData, language, hospitalBranding);
  };

  // Filter & Search Term
  const [searchQuery, setSearchQuery] = useState("");

  // In-App Toast & Confirmation State
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg({ text: msg, type });
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 4500);
  }, []);

  // Filter queue specifically for Pharmacy Department (scoped to desk)
  const isPharmaTicket = useCallback((t) => {
    if (!t) return false;
    const cat = (t.service_category || "").toLowerCase();
    const dept = (t.department_name || t.department || "").toLowerCase();
    return cat === "pharmacy" || dept === "pharmacy" || cat.includes("pharm");
  }, []);

  const pharmacyQueue = useMemo(() => {
    return scopeTicketsForDesk(queueSnapshot, deskScope, isPharmaTicket);
  }, [queueSnapshot, deskScope, isPharmaTicket]);

  // Serving ticket specifically for pharmacy (scoped to desk)
  const pharmacyServing = useMemo(() => {
    const scoped = scopeTicketsForDesk(servingTickets, deskScope, isPharmaTicket);
    return scoped[0] || null;
  }, [servingTickets, deskScope, isPharmaTicket]);

  // Held tickets specifically for pharmacy (scoped to desk)
  const pharmacyHeldTickets = useMemo(() => {
    return scopeTicketsForDesk(heldTickets, deskScope, isPharmaTicket);
  }, [heldTickets, deskScope, isPharmaTicket]);

  // Selected ticket being actively dispensed at the counter
  const [activeServingTicket, setActiveServingTicket] = useState(null);

  useEffect(() => {
    if (pharmacyServing) {
      setActiveServingTicket(pharmacyServing);
    }
  }, [pharmacyServing]);

  // Checked/Dispensed status tracking for individual medication items
  // Format: { [ticketId_index]: boolean }
  const [dispensedItemsMap, setDispensedItemsMap] = useState({});

  // Medication substitution / batch notes tracking
  // Format: { [ticketId_index]: string }
  const [medNotesMap, setMedNotesMap] = useState({});

  // Parse structured prescription notes from ticket
  const parseRxNotes = useCallback((ticket) => {
    if (!ticket || !ticket.prescription_notes) return null;
    try {
      if (typeof ticket.prescription_notes === "object") return ticket.prescription_notes;
      let raw = String(ticket.prescription_notes).trim();
      while ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1).trim();
      }
      return JSON.parse(raw);
    } catch (_) {
      try {
        return JSON.parse(JSON.parse(ticket.prescription_notes));
      } catch (_) {
        return { advice: String(ticket.prescription_notes) };
      }
    }
  }, []);

  // Call Next Patient from Queue
  const [callingNext, setCallingNext] = useState(false);
  const handleCallNextPatient = async () => {
    if (pharmaDutyStatus !== "ACTIVE") {
      const statusNames = {
        ON_BREAK: isHi ? "चाय / अल्पाहार अवकाश" : "Tea Break",
        SHIFT_ENDED: isHi ? "शिफ्ट समाप्त" : "Shift Ended",
      };
      showToast(
        isHi
          ? `आपकी स्थिति वर्तमान में '${statusNames[pharmaDutyStatus] || pharmaDutyStatus}' पर है। मरीज़ को बुलाने के लिए कृपया पहले 'ड्यूटी पर सक्रिय' करें।`
          : `Your status is currently set to '${statusNames[pharmaDutyStatus] || pharmaDutyStatus}'. Switch to 'Active on Duty' to call the next patient.`,
        "warn"
      );
      return;
    }

    if (pharmacyQueue.length === 0) {
      showToast(
        isEmergencyDesk
          ? (isHi ? "आपातकालीन कतार में कोई मरीज़ प्रतीक्षारत नहीं है।" : "No emergency patients waiting in queue.")
          : (isHi ? "फार्मेसी कतार में कोई मरीज़ प्रतीक्षारत नहीं है।" : "No waiting patients in pharmacy queue."),
        "info"
      );
      return;
    }

    setCallingNext(true);
    try {
      if (socketRef && socketRef.current) {
        socketRef.current.emit("serve_next", {
          tenant_id: effectiveHospitalCode,
          department: isEmergencyDesk ? "emergency" : "pharmacy",
          service_category: isEmergencyDesk ? "emergency" : "pharmacy",
          doctor_id: currentUser?.id,
          doctor_name: currentUser?.name || currentUser?.username || "Head Pharmacist",
          doctor_email: currentUser?.email,
          desk_id: selectedDesk?.id || assignedDesk?.id || null,
          desk_name: activeCounter,
        });
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/serve-next`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            department: isEmergencyDesk ? "emergency" : "pharmacy",
            service_category: isEmergencyDesk ? "emergency" : "pharmacy",
            doctor_id: currentUser?.id,
            doctor_name: currentUser?.name || currentUser?.username || "Head Pharmacist",
            desk_id: selectedDesk?.id || assignedDesk?.id || null,
            desk_name: activeCounter,
          }),
        });
        if (refreshData) refreshData();
      }

      showToast(
        isEmergencyDesk
          ? (isHi ? "आपातकालीन कतार से अगले मरीज को बुलाया गया!" : "Called next emergency patient to station!")
          : (isHi ? "फार्मेसी कतार से अगले मरीज को बुलाया गया!" : "Called next patient to Pharmacy Counter!"),
        "success"
      );
    } catch (e) {
      showToast(`Error calling patient: ${e.message}`, "error");
    } finally {
      setTimeout(() => setCallingNext(false), 800);
    }
  };

  // Send patient call to waiting-room display kiosk
  const handleReAnnounce = async (ticket) => {
    if (!ticket) return;
    try {
      if (socketRef && socketRef.current) {
        socketRef.current.emit("re_announce", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          ticket: { ...ticket, service_category: "PHARMACY" },
        });
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/re-announce`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            ticket_id: ticket.ticket_id,
          }),
        });
      }
      showToast(
        isHi
          ? `टोकन #${ticket.ticket_id} (${ticket.name}) प्रतीक्षालय डिस्प्ले पर भेजा गया`
          : `Sent Token #${ticket.ticket_id} (${ticket.name}) to waiting-room display`,
        "info"
      );
    } catch (e) {
      console.warn("Display broadcast error:", e);
    }
  };

  // Complete Dispensing & Finalize Visit
  const [completingTicket, setCompletingTicket] = useState(false);
  const handleCompleteDispensing = async (ticket) => {
    if (!ticket) return;
    setCompletingTicket(true);

    try {
      const rxNotes = parseRxNotes(ticket) || {};
      const medicines = Array.isArray(rxNotes.medicines) ? rxNotes.medicines : [];
      const anyExplicit = medicines.some((_, idx) => dispensedItemsMap[`${ticket.ticket_id}_${idx}`] !== undefined);

      const updatedMedicines = medicines.map((med, idx) => {
        const itemKey = `${ticket.ticket_id}_${idx}`;
        const isGiven = anyExplicit ? Boolean(dispensedItemsMap[itemKey]) : true;
        return {
          ...med,
          dispensed: isGiven,
          given: isGiven,
          dispense_status: isGiven ? "given" : "not_given",
          status: isGiven ? "dispensed" : "not_dispensed",
          dispensed_by: currentUser?.name || currentUser?.username || "Head Pharmacist",
          dispensed_at: isGiven ? new Date().toISOString() : null,
        };
      });

      const givenCount = updatedMedicines.filter((m) => m.dispensed).length;
      const unverifiedCount = updatedMedicines.filter((m) => !m.dispensed).length;

      const completionPayload = {
        ...rxNotes,
        medicines: updatedMedicines,
        dispensed_by: currentUser?.name || currentUser?.username || "Head Pharmacist",
        dispensed_by_id: currentUser?.id || currentUser?.user_id || currentUser?.employee_id || "",
        dispensed_by_email: currentUser?.email || "",
        dispensed_at: new Date().toISOString(),
        dispensing_counter: activeCounter,
        dispensed_counter_id: assignedDesk?.id || "",
        all_verified: unverifiedCount === 0,
        dispensing_summary: {
          total: medicines.length,
          given: givenCount,
          not_given: unverifiedCount,
        },
      };

      if (socketRef && socketRef.current) {
        socketRef.current.emit("complete_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          department: "pharmacy",
          prescription_notes: JSON.stringify(completionPayload),
        });
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/complete-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            ticket_id: ticket.ticket_id,
            department: "pharmacy",
            prescription_notes: JSON.stringify(completionPayload),
          }),
        });
        if (refreshData) refreshData();
      }

      showToast(
        isHi
          ? `टोकन #${ticket.ticket_id} (${ticket.name}): ${givenCount}/${medicines.length} दवाएं वितरित व विज़िट पूर्ण!`
          : `Token #${ticket.ticket_id} (${ticket.name}): ${givenCount}/${medicines.length} medications dispensed & completed!`,
        "success"
      );

      setActiveServingTicket(null);
      // Immediately refresh visit history so newly completed record is listed
      fetchPatientVisits();
    } catch (e) {
      showToast(`Error completing dispensing: ${e.message}`, "error");
    } finally {
      setCompletingTicket(false);
    }
  };

  // Print Full Doctor Rx Slip
  const handlePrintFullPrescription = (ticket) => {
    if (!ticket) return;
    const parsed = parseRxNotes(ticket) || {};
    const fullData = {
      ...parsed,
      patient_name: ticket.name,
      age: ticket.age || 30,
      gender: ticket.gender || "Patient",
      phone: ticket.phone || "",
      ticket_id: ticket.ticket_id,
      hospital_name: brandName,
      prescribed_at: parsed.prescribed_at || new Date().toISOString(),
    };
    printPrescriptionSlip(fullData, language, hospitalBranding);
  };

  // Filtered Queue Search
  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) return pharmacyQueue;
    const q = searchQuery.toLowerCase().trim();
    return pharmacyQueue.filter(
      (t) =>
        String(t.ticket_id).toLowerCase().includes(q) ||
        String(t.name).toLowerCase().includes(q) ||
        String(t.phone || "").toLowerCase().includes(q)
    );
  }, [pharmacyQueue, searchQuery]);

  // =========================================================================
  // QUEUE & APPOINTMENTS MANAGER STATE & LOGIC
  // =========================================================================
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const [queueSubView, setQueueSubView] = useState("queue"); // "queue" | "appointments"
  const [queueCategoryFilter, setQueueCategoryFilter] = useState("all");
  const [queueStatusFilter, setQueueStatusFilter] = useState("all");
  const [queuePriorityFilter, setQueuePriorityFilter] = useState("all");
  const [queueSearchQuery, setQueueSearchQuery] = useState("");
  const [appointmentDateFilter, setAppointmentDateFilter] = useState("today"); // "today" | "all"

  // Booked Appointments State & Data Fetching
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  const fetchPharmacyAppointments = useCallback(async (isInitial = false) => {
    if (!effectiveHospitalCode) return;
    if (isInitial) setAppointmentsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/plugin/appointments/tenant/${encodeURIComponent(effectiveHospitalCode)}`);
      const data = await res.json();
      if (res.ok && (data.status === "success" || Array.isArray(data.appointments))) {
        setAppointmentsList(Array.isArray(data.appointments) ? data.appointments : []);
      }
    } catch (e) {
      console.error("Error fetching pharmacy appointments:", e);
    } finally {
      if (isInitial) setAppointmentsLoading(false);
    }
  }, [effectiveHospitalCode]);

  useEffect(() => {
    fetchPharmacyAppointments(true);
  }, [fetchPharmacyAppointments]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    if (!socketRef || !socketRef.current) return;
    const s = socketRef.current;
    const onSync = () => {
      fetchPharmacyAppointments();
      if (refreshData) refreshData();
    };

    s.on("ticket_created", onSync);
    s.on("ticket_updated", onSync);
    s.on("ticket_transferred", onSync);
    s.on("ticket_completed", onSync);
    s.on("ticket_cancelled", onSync);
    s.on("ticket_hold", onSync);
    s.on("ticket_recalled", onSync);
    s.on("appointment_booked", onSync);
    s.on("appointment_cancelled", onSync);
    s.on("appointment_completed", onSync);
    s.on("appointment_checked_in", onSync);
    s.on("queue_updated", onSync);

    return () => {
      s.off("ticket_created", onSync);
      s.off("ticket_updated", onSync);
      s.off("ticket_transferred", onSync);
      s.off("ticket_completed", onSync);
      s.off("ticket_cancelled", onSync);
      s.off("ticket_hold", onSync);
      s.off("ticket_recalled", onSync);
      s.off("appointment_booked", onSync);
      s.off("appointment_cancelled", onSync);
      s.off("appointment_completed", onSync);
      s.off("appointment_checked_in", onSync);
      s.off("queue_updated", onSync);
    };
  }, [socketRef, fetchPharmacyAppointments, refreshData]);

  // Handle Manual Check-In from Appointments (Converts to Live Queue Ticket)
  const handleCheckInAppointment = async (aptId) => {
    if (!aptId) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/plugin/appointments/check-in`, {
        method: "POST",
        body: { appointment_id: aptId },
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast(
          isHi
            ? `टोकन #${data.ticket?.ticket_id || ""} चेक-इन सफल।`
            : `Checked in successfully. Token #${data.ticket?.ticket_id || ""} issued.`,
          "success"
        );
        fetchPharmacyAppointments();
        if (refreshData) refreshData();
      } else {
        showToast(data.message || data.detail || (isHi ? "चेक-इन विफल रहा" : "Check-in failed"), "error");
      }
    } catch (e) {
      showToast(isHi ? `चेक-इन त्रुटि: ${e.message}` : `Error during check-in: ${e.message}`, "error");
    }
  };

  // Handle Mark Completed for Appointment
  const handleCompleteAppointment = async (aptId) => {
    if (!aptId) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/plugin/appointments/${aptId}/complete`, {
        method: "POST",
        body: { notes: "Completed at pharmacy dispensing counter" },
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast(isHi ? "अपॉइंटमेंट पूर्ण चिह्नित किया गया।" : "Appointment marked as completed.", "success");
        fetchPharmacyAppointments();
        if (refreshData) refreshData();
      } else {
        showToast(data.message || (isHi ? "अपॉइंटमेंट पूर्ण करने में विफलता" : "Failed to complete appointment"), "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  };

  // Handle Cancel Appointment
  const handleCancelAppointment = async (aptId) => {
    if (!aptId) return;
    if (!window.confirm(isHi ? `क्या आप वाकई अपॉइंटमेंट #${aptId} को रद्द करना चाहते हैं?` : `Are you sure you want to cancel appointment #${aptId}?`)) {
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE}/api/v1/plugin/appointments/${aptId}/cancel`, {
        method: "POST",
        body: { reason: "Cancelled by pharmacy counter" },
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast(isHi ? "अपॉइंटमेंट रद्द किया गया।" : "Appointment cancelled.", "info");
        fetchPharmacyAppointments();
        if (refreshData) refreshData();
      } else {
        showToast(data.message || (isHi ? "रद्द करने में विफलता" : "Failed to cancel appointment"), "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  };

  // SMS Reminder for Scheduled Appointment
  const handleSendSmsReminder = async (apt) => {
    if (!apt) return;
    const phone = apt.phone || apt.patient_phone || "";
    const pName = apt.patient_name || apt.name || "Patient";

    showToast(
      isHi
        ? `${pName} (${phone || "रजिस्टर्ड मोबाइल"}) को एसएमएस अनुस्मारक भेजा गया।`
        : `SMS reminder dispatched to ${pName} (${phone || "Registered Mobile"}).`,
      "success"
    );
  };

  // Quick Ticket Actions: Hold, Recall, No-Show, Cancel, Serve
  const handleHold = async (ticket) => {
    if (!ticket) return;
    try {
      await apiFetch(`${API_BASE}/api/v1/plugin/hold-ticket`, {
        method: "POST",
        body: {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          grace_minutes: 10,
        },
      });
      if (socketRef && socketRef.current) {
        socketRef.current.emit("hold_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          grace_minutes: 10,
        });
      }
      if (activeServingTicket && activeServingTicket.ticket_id === ticket.ticket_id) {
        setActiveServingTicket(null);
      }
      showToast(
        isHi
          ? `टोकन #${ticket.ticket_id} को 10 मिनट होल्ड पर रखा गया।`
          : `Token #${ticket.ticket_id} placed on 10-minute hold.`,
        "info"
      );
      if (refreshData) refreshData();
    } catch (e) {
      showToast(`Error holding ticket: ${e.message}`, "error");
    }
  };

  const handleRecallHeld = async (ticket) => {
    if (!ticket) return;
    try {
      const mode = activeServingTicket ? "queue" : "serving";
      await apiFetch(`${API_BASE}/api/v1/plugin/recall-ticket`, {
        method: "POST",
        body: {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          doctor_id: currentUser?.id,
          doctor_name: currentUser?.name || currentUser?.username || "Head Pharmacist",
          doctor_email: currentUser?.email,
          target_mode: mode,
        },
      });
      if (socketRef && socketRef.current) {
        socketRef.current.emit("recall_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          doctor_id: currentUser?.id,
          user_name: currentUser?.name || currentUser?.username || "Head Pharmacist",
          target_mode: mode,
        });
      }
      showToast(
        isHi
          ? `टोकन #${ticket.ticket_id} वापस कतार में शामिल किया गया।`
          : `Recalled #${ticket.ticket_id} back into active queue.`,
        "success"
      );
      if (refreshData) refreshData();
    } catch (e) {
      showToast(`Error recalling ticket: ${e.message}`, "error");
    }
  };

  const handleFinalizeNoShow = async (ticket) => {
    if (!ticket) return;
    try {
      await apiFetch(`${API_BASE}/api/v1/plugin/no-show`, {
        method: "POST",
        body: {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          reason: "Patient absent after 10-min grace period",
        },
      });
      if (socketRef && socketRef.current) {
        socketRef.current.emit("no_show", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
        });
      }
      if (activeServingTicket && activeServingTicket.ticket_id === ticket.ticket_id) {
        setActiveServingTicket(null);
      }
      showToast(
        isHi
          ? `टोकन #${ticket.ticket_id} अनुपस्थित (No-Show) चिह्नित किया गया।`
          : `Token #${ticket.ticket_id} marked as absent / No-Show.`,
        "info"
      );
      if (refreshData) refreshData();
    } catch (e) {
      showToast(`Error marking no-show: ${e.message}`, "error");
    }
  };

  const handleCancelTicket = async (ticket) => {
    if (!ticket) return;
    if (!window.confirm(isHi ? `क्या आप वाकई टोकन #${ticket.ticket_id} को रद्द करना चाहते हैं?` : `Are you sure you want to cancel ticket #${ticket.ticket_id}?`)) {
      return;
    }
    try {
      await apiFetch(`${API_BASE}/api/v1/plugin/tickets/${ticket.ticket_id}/cancel`, {
        method: "POST",
        body: { reason: "Cancelled by pharmacy staff" },
      });
      if (socketRef && socketRef.current) {
        socketRef.current.emit("cancel_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
        });
      }
      if (activeServingTicket && activeServingTicket.ticket_id === ticket.ticket_id) {
        setActiveServingTicket(null);
      }
      showToast(isHi ? `टोकन #${ticket.ticket_id} रद्द कर दिया गया।` : `Token #${ticket.ticket_id} cancelled.`, "info");
      if (refreshData) refreshData();
    } catch (e) {
      showToast(`Error cancelling ticket: ${e.message}`, "error");
    }
  };

  const handleServeFromQueue = (ticket) => {
    if (!ticket) return;
    setActiveServingTicket(ticket);
    setActiveTab("dispensing");
    showToast(
      isHi
        ? `टोकन #${ticket.ticket_id} (${ticket.name}) काउंटर पर लोड किया गया`
        : `Token #${ticket.ticket_id} (${ticket.name}) loaded at dispensing counter`,
      "info"
    );
  };

  // Helper to categorize items for pharmacy
  const detectPharmacyItemCategory = useCallback((item) => {
    if (!item) return "General OPD";
    const pNotes = typeof item.prescription_notes === "object" ? JSON.stringify(item.prescription_notes || {}) : (item.prescription_notes || "");
    const text = `${item.service_category || ""} ${item.medical_condition || ""} ${item.department_name || ""} ${item.department || ""} ${pNotes} ${item.notes || ""} ${item.reason || ""}`.toLowerCase();
    const p = Number(item.priority_level || item.priority || 3);
    if (p === 1 || text.includes("emergency") || text.includes("trauma") || text.includes("icu") || text.includes("stat")) return "Emergency";
    if (text.includes("refill") || text.includes("chronic") || text.includes("diabet") || text.includes("hypertens") || text.includes("bp") || text.includes("cardiac")) return "Chronic / Refill";
    if (text.includes("urgent") || text.includes("acute") || text.includes("fever") || text.includes("infection") || text.includes("pain") || text.includes("antibiotic")) return "Acute / Urgent";
    return "General OPD";
  }, []);

  // Check if an appointment's slot has passed
  const isAppointmentLate = useCallback((apt) => {
    const rawStatus = (apt.status || "booked").toLowerCase();
    if (rawStatus === "checked_in" || rawStatus === "cancelled" || rawStatus === "completed") return false;
    const slot = apt.time_slot || apt.appointment_time || "";
    const timeMatch = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeMatch) return false;
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3];
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
      if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
    }
    const now = new Date();
    const slotDate = new Date();
    slotDate.setHours(hours, minutes, 0, 0);
    return now > slotDate;
  }, []);

  // Filtered & Sorted Live Queue (Emergency P1 first, then serving, then wait time)
  const combinedLiveQueue = useMemo(() => {
    const map = new Map();
    // 1. Currently Serving
    if (activeServingTicket) {
      map.set(activeServingTicket.ticket_id, { ...activeServingTicket, _queueCategory: "serving" });
    } else if (pharmacyServing) {
      map.set(pharmacyServing.ticket_id, { ...pharmacyServing, _queueCategory: "serving" });
    }
    // 2. On Hold
    (pharmacyHeldTickets || []).forEach((t) => {
      map.set(t.ticket_id, { ...t, _queueCategory: "on_hold" });
    });
    // 3. Waiting Queue
    (pharmacyQueue || []).forEach((t) => {
      if (!map.has(t.ticket_id)) {
        map.set(t.ticket_id, { ...t, _queueCategory: "waiting" });
      }
    });

    const list = Array.from(map.values());

    return list.filter((ticket) => {
      // Category filter
      if (queueCategoryFilter !== "all") {
        const cat = detectPharmacyItemCategory(ticket);
        if (cat !== queueCategoryFilter) return false;
      }

      // Status filter
      if (queueStatusFilter !== "all") {
        if (queueStatusFilter === "waiting" && ticket._queueCategory !== "waiting") return false;
        if (queueStatusFilter === "serving" && ticket._queueCategory !== "serving") return false;
        if (queueStatusFilter === "on_hold" && ticket._queueCategory !== "on_hold") return false;
      }

      // Priority filter
      if (queuePriorityFilter !== "all") {
        const p = Number(ticket.priority_level || ticket.priority || 3);
        if (queuePriorityFilter === "emergency" && p !== 1) return false;
        if (queuePriorityFilter === "urgent" && p !== 2) return false;
        if (queuePriorityFilter === "routine" && p !== 3 && p !== 2 && p !== 1) return false;
      }

      // Search query
      if (queueSearchQuery.trim()) {
        const q = queueSearchQuery.toLowerCase();
        const name = String(ticket.name || ticket.patient_name || "").toLowerCase();
        const phone = String(ticket.phone || "").toLowerCase();
        const tid = String(ticket.ticket_id || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !tid.includes(q)) return false;
      }

      return true;
    }).sort((a, b) => {
      // Serving ticket always top
      if (a._queueCategory === "serving" && b._queueCategory !== "serving") return -1;
      if (b._queueCategory === "serving" && a._queueCategory !== "serving") return 1;

      // Emergency (P1) first
      const pa = Number(a.priority_level || a.priority || 3);
      const pb = Number(b.priority_level || b.priority || 3);
      if (pa !== pb) return pa - pb;

      // Longest wait time (earliest join timestamp)
      const parseJoin = (t) => {
        if (!t) return 0;
        if (t.join_timestamp) {
          const num = Number(t.join_timestamp);
          if (!isNaN(num) && num > 0) return num > 1e11 ? num / 1000 : num;
        }
        if (t.created_at) {
          const time = new Date(t.created_at).getTime();
          if (!isNaN(time)) return time / 1000;
        }
        return 0;
      };
      return parseJoin(a) - parseJoin(b);
    });
  }, [activeServingTicket, pharmacyServing, pharmacyHeldTickets, pharmacyQueue, queueCategoryFilter, queueStatusFilter, queuePriorityFilter, queueSearchQuery, detectPharmacyItemCategory]);

  // Appointments Filtering & Grouping
  const todayDateStr = useMemo(() => getLocalDateStr(new Date()), [getLocalDateStr]);

  const isPharmacyAppointment = useCallback((apt) => {
    if (!apt) return false;
    const cat = String(apt.service_category || apt.department || apt.department_name || "").toLowerCase();
    const pNotes = typeof apt.prescription_notes === "object" ? JSON.stringify(apt.prescription_notes || {}) : (apt.prescription_notes || "");
    const text = `${cat} ${pNotes} ${apt.notes || ""} ${apt.reason || ""}`.toLowerCase();
    return cat.includes("pharm") || text.includes("pharm") || text.includes("dispens") || text.includes("medicine");
  }, []);

  const todayPharmacyAppointments = useMemo(() => {
    return appointmentsList.filter((apt) => {
      // 1. Department match: only pharmacy / medicine
      if (!isPharmacyAppointment(apt)) return false;

      // 2. Date match: only today
      const aptDate = apt.appointment_date
        ? String(apt.appointment_date).split("T")[0]
        : (apt.appointment_time ? String(apt.appointment_time).split("T")[0] : "");
      return !aptDate || aptDate === todayDateStr;
    });
  }, [appointmentsList, isPharmacyAppointment, todayDateStr]);

  const filteredAppointments = useMemo(() => {
    return appointmentsList.filter((apt) => {
      // 1. Department match: only pharmacy
      if (!isPharmacyAppointment(apt)) return false;

      // 2. Date filter
      if (appointmentDateFilter === "today") {
        const aptDate = apt.appointment_date
          ? String(apt.appointment_date).split("T")[0]
          : (apt.appointment_time ? String(apt.appointment_time).split("T")[0] : "");
        if (aptDate && aptDate !== todayDateStr) return false;
      }

      // 3. Category filter
      if (queueCategoryFilter !== "all") {
        const cat = detectPharmacyItemCategory(apt);
        if (cat !== queueCategoryFilter) return false;
      }

      // 4. Status filter
      if (queueStatusFilter !== "all") {
        const s = (apt.status || "booked").toLowerCase();
        if (queueStatusFilter === "waiting" && s !== "booked" && s !== "check_in_available") return false;
        if (queueStatusFilter === "checked_in" && s !== "checked_in") return false;
        if (queueStatusFilter === "booked" && s !== "booked") return false;
        if (queueStatusFilter === "completed" && s !== "completed") return false;
        if (queueStatusFilter === "expired" && s !== "expired") return false;
        if (queueStatusFilter === "cancelled" && s !== "cancelled") return false;
      }

      // 5. Priority filter
      if (queuePriorityFilter !== "all") {
        const p = Number(apt.priority_level || apt.priority || 3);
        if (queuePriorityFilter === "emergency" && p !== 1) return false;
        if (queuePriorityFilter === "urgent" && p !== 2) return false;
        if (queuePriorityFilter === "routine" && p !== 3 && p !== 2 && p !== 1) return false;
      }

      // 6. Search query
      if (queueSearchQuery.trim()) {
        const q = queueSearchQuery.toLowerCase();
        const name = String(apt.patient_name || apt.name || "").toLowerCase();
        const phone = String(apt.phone || "").toLowerCase();
        const id = String(apt.appointment_id || apt.ticket_id || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }, [appointmentsList, isPharmacyAppointment, appointmentDateFilter, todayDateStr, queueCategoryFilter, queueStatusFilter, queuePriorityFilter, queueSearchQuery, detectPharmacyItemCategory]);

  const appointmentsBySlot = useMemo(() => {
    const groups = {};
    filteredAppointments.forEach((apt) => {
      const slot = apt.time_slot || apt.formatted_appointment_time || apt.appointment_time || "General Pharmacy Slot";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(apt);
    });
    return groups;
  }, [filteredAppointments]);

  // Dynamic 8 Summary Strip Metrics (Computed from live queue, appointments & visits)
  const waitingMetric = Array.isArray(pharmacyQueue) ? pharmacyQueue.length : 0;
  const servingMetric = activeServingTicket || pharmacyServing ? 1 : 0;
  const heldMetric = Array.isArray(pharmacyHeldTickets) ? pharmacyHeldTickets.length : 0;

  const bookedTodayMetric = useMemo(() => {
    return todayPharmacyAppointments.filter((a) => {
      const s = (a.status || "booked").toLowerCase();
      return s === "booked" || s === "confirmed" || s === "scheduled" || s === "check_in_available";
    }).length;
  }, [todayPharmacyAppointments]);

  const checkedInMetric = useMemo(() => {
    return todayPharmacyAppointments.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s === "checked_in" || Boolean(a.ticket_id);
    }).length;
  }, [todayPharmacyAppointments]);

  const noShowExpiredMetric = useMemo(() => {
    return todayPharmacyAppointments.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s === "no_show" || s === "expired" || s === "cancelled";
    }).length;
  }, [todayPharmacyAppointments]);

  // Real-time Average Wait Time (Minutes)
  const avgWaitMinutes = useMemo(() => {
    if (Array.isArray(pharmacyQueue) && pharmacyQueue.length > 0) {
      const totalSec = pharmacyQueue.reduce((acc, t) => {
        const rawJoin = t.join_timestamp
          ? (Number(t.join_timestamp) > 1e11 ? Number(t.join_timestamp) / 1000 : Number(t.join_timestamp))
          : (t.created_at ? new Date(t.created_at).getTime() / 1000 : nowSec);
        const joinSec = isNaN(rawJoin) ? nowSec : rawJoin;
        return acc + Math.max(0, nowSec - joinSec);
      }, 0);
      return Math.max(1, Math.round(totalSec / pharmacyQueue.length / 60));
    }
    if (analytics?.average_wait_time !== undefined && analytics?.average_wait_time !== null && Number(analytics.average_wait_time) > 0) {
      return Math.round(Number(analytics.average_wait_time));
    }
    return 0;
  }, [pharmacyQueue, nowSec, analytics]);

  // Real-time Average Dispense Time (Minutes)
  const avgDispenseMinutes = useMemo(() => {
    // 1. Calculate from patient visits completed today
    const todayStr = getLocalDateStr(new Date());
    const completedToday = (patientVisits || []).filter((v) => {
      const vDate = v.queue_date || (v.created_at ? String(v.created_at).split("T")[0] : "");
      return vDate === todayStr && (v.status === "completed" || Boolean(v.dispensed_at));
    });

    if (completedToday.length > 0) {
      let totalDurationSec = 0;
      let countWithDuration = 0;
      completedToday.forEach((v) => {
        const start = v.serve_timestamp || v.called_at || v.created_at;
        const end = v.dispensed_at || v.completed_at || v.updated_at;
        if (start && end) {
          const s = new Date(start).getTime();
          const e = new Date(end).getTime();
          const diffSec = (e - s) / 1000;
          if (diffSec > 0 && diffSec < 7200) {
            totalDurationSec += diffSec;
            countWithDuration++;
          }
        }
      });
      if (countWithDuration > 0) {
        return Math.max(1, Math.round(totalDurationSec / countWithDuration / 60));
      }
    }

    // 2. Check analytics from server
    if (analytics?.avg_service_time || analytics?.average_service_time) {
      const val = Math.round(Number(analytics.avg_service_time || analytics.average_service_time) / 60);
      if (val > 0) return val;
    }

    return 0;
  }, [patientVisits, getLocalDateStr, analytics]);

  // Real-time Dispensed Today Count
  const dispensedTodayCount = useMemo(() => {
    const todayStr = getLocalDateStr(new Date());
    const fromVisits = (patientVisits || []).filter((v) => {
      const vDate = v.queue_date || (v.created_at ? String(v.created_at).split("T")[0] : "");
      return vDate === todayStr && (v.status === "completed" || Boolean(v.dispensed_at));
    }).length;

    if (fromVisits > 0) return fromVisits;
    if (analytics?.completed_today !== undefined && analytics?.completed_today !== null) {
      return Number(analytics.completed_today) || 0;
    }
    return 0;
  }, [patientVisits, getLocalDateStr, analytics]);

  // Real-time Turnaround Time Display
  const avgTurnaroundFormatted = useMemo(() => {
    if (avgDispenseMinutes > 0) {
      return `~${avgDispenseMinutes} min`;
    }
    if (analytics?.average_service_time || analytics?.avg_service_time) {
      const mins = Math.round(Number(analytics.average_service_time || analytics.avg_service_time) / 60);
      if (mins > 0) return `~${mins} min`;
    }
    return "0 min";
  }, [avgDispenseMinutes, analytics]);

  // Color Tokens (Unified Clinical Ocean Blue & Slate Palette)
  const pageBg = isDark ? "#070B14" : "#F8FAFC";
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const cardBorder = isDark ? "1px solid #1E293B" : "1px solid #E2E8F0";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";
  const highlightPrimary = "#0284C7";

  return (
    <div
      className="pharmacy-portal-wrapper"
      style={{
        background: pageBg,
        color: textColor,
        paddingBottom: "12px",
        transition: "all 0.25s ease",
        "--pharma-card-bg": cardBg,
        "--pharma-card-border": isDark ? "#1E293B" : "#E2E8F0",
        "--pharma-card-text": textColor,
      }}
    >
      {/* Embedded CSS Style Rules matching Doctor & Staff Portals */}
      <style>{`
        .pharmacy-portal-wrapper * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .pharmacy-portal-wrapper .user-dashboard-footer {
          margin-top: 14px !important;
          padding-top: 10px !important;
          padding-bottom: 4px !important;
        }

        .pharmacy-hero-container {
          background: radial-gradient(circle at 10% 15%, rgba(2, 132, 199, 0.28) 0%, transparent 45%),
                      radial-gradient(circle at 90% 85%, rgba(56, 189, 248, 0.18) 0%, transparent 50%),
                      linear-gradient(135deg, #090F1E 0%, #0F172A 60%, #162447 100%);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 28px;
          padding: 26px 30px;
          color: #FFFFFF;
          box-shadow: 0 20px 45px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(56, 189, 248, 0.18);
          margin-bottom: 24px;
          position: relative;
          overflow: visible;
          z-index: 50;
        }

        .pharmacy-hero-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 22px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding-top: 18px;
        }

        @media (max-width: 960px) {
          .pharmacy-hero-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 540px) {
          .pharmacy-hero-kpi-grid {
            grid-template-columns: 1fr;
          }
        }

        .pharmacy-kpi-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          padding: 14px 18px;
        }

        .pharmacy-tabs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        @media (max-width: 920px) {
          .pharmacy-tabs-grid {
            grid-template-columns: 1fr;
          }
        }

        .tab-button-modern {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 16px;
          cursor: pointer;
          text-align: left;
          user-select: none;
          outline: none;
        }

        .tab-button-modern.active {
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
          border: 1px solid #0284C7;
          color: #FFFFFF;
          box-shadow: 0 8px 20px rgba(2, 132, 199, 0.28);
        }

        .tab-button-modern.inactive {
          background: var(--pharma-card-bg, #FFFFFF);
          border: 1px solid var(--pharma-card-border, #E2E8F0);
          color: var(--pharma-card-text, #0F172A);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        .tab-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tab-button-modern.active .tab-icon-wrapper {
          background: rgba(255, 255, 255, 0.2);
          color: #BAE6FD;
        }

        .tab-button-modern.inactive .tab-icon-wrapper {
          background: #F0F9FF;
          color: #0284C7;
        }

        .tab-title-text {
          font-size: 13.5px;
          font-weight: 800;
          letter-spacing: -0.2px;
          line-height: 1.2;
        }

        .tab-sub-text {
          font-size: 11px;
          font-weight: 600;
          display: block;
          margin-top: 2px;
          opacity: 0.85;
        }

        .tab-count-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        /* Dark Mode Overrides for Inactive Modern Tab Buttons */
        body.theme-dark .tab-button-modern.inactive,
        [data-theme="dark"] .tab-button-modern.inactive {
          background: #0F172A !important;
          border-color: #1E293B !important;
          color: #F8FAFC !important;
        }

        body.theme-dark .tab-button-modern.inactive .tab-icon-wrapper,
        [data-theme="dark"] .tab-button-modern.inactive .tab-icon-wrapper {
          background: rgba(2, 132, 199, 0.2) !important;
          color: #38BDF8 !important;
        }

        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spinSlow 1s linear infinite;
        }
      `}</style>

      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: toastMsg.type === "error" ? "#EF4444" : toastMsg.type === "warn" ? "#F59E0B" : "#0284C7",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 700,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center" }}>{toastMsg.type === "error" ? <XCircle size={14} /> : toastMsg.type === "warn" ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}</span>
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: "10px", display: "inline-flex", alignItems: "center" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Executive Dark-Navy Clinical Hero Header */}
      <div className="pharmacy-hero-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,0.14)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800, letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Building2 size={12} />
                <span>{brandName.toUpperCase()}</span>
              </span>
              <span style={{ background: "rgba(56, 189, 248, 0.2)", border: "1px solid rgba(56, 189, 248, 0.4)", color: "#BAE6FD", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800 }}>
                {isHi ? "केंद्रीय फार्मेसी एवं दवा वितरण केंद्र" : "CENTRAL PHARMACY STATION"}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, letterSpacing: "-0.5px" }}>
              {isHi ? "फार्मेसी वितरण वर्कस्टेशन" : "Pharmacy Dispensing Workstation"}
            </h1>
            {/* Highlighted Staff & Department One-Liner Glass Capsule */}
            <div
              style={{
                marginTop: "10px",
                display: "inline-flex",
                alignItems: "center",
                flexWrap: "nowrap",
                gap: "10px",
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.6) 100%)",
                border: "1.5px solid rgba(56, 189, 248, 0.45)",
                borderRadius: "30px",
                padding: "5px 14px 5px 6px",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
                maxWidth: "100%",
              }}
            >
              {/* Avatar Icon */}
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.4)",
                  flexShrink: 0,
                }}
              >
                <User size={13} />
              </div>

              {/* Staff Name */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "फार्मासिस्ट:" : "Pharmacist:"}
                </span>
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 900,
                    color: "#FFFFFF",
                    letterSpacing: "0.2px",
                  }}
                >
                  {currentUser?.name || currentUser?.username || "Pharmacist"}
                </span>
              </div>

              {/* Subtle Divider */}
              <span style={{ width: "1px", height: "14px", background: "rgba(255, 255, 255, 0.2)", margin: "0 2px" }} />

              {/* Department */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#34D399",
                    boxShadow: "0 0 8px #10B981, 0 0 3px #34D399",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "विभाग:" : "Dept:"}
                </span>
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 800,
                    color: "#34D399",
                    letterSpacing: "0.4px",
                  }}
                >
                  {(currentUser?.department || "PHARMACY").toUpperCase()}
                </span>
              </div>

              {/* Staff ID Pill if available */}
              {(currentUser?.employee_code || currentUser?.employee_id || currentUser?.id) && (
                <>
                  <span style={{ width: "1px", height: "14px", background: "rgba(255, 255, 255, 0.2)", margin: "0 2px" }} />
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "rgba(255, 255, 255, 0.75)",
                      fontFamily: "monospace",
                      background: "rgba(255, 255, 255, 0.08)",
                      padding: "2px 7px",
                      borderRadius: "6px",
                    }}
                  >
                    ID: {currentUser?.employee_code || currentUser?.employee_id || currentUser?.id}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Assigned Desk Display & Duty Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                borderRadius: "12px",
                padding: "8px 14px",
                backdropFilter: "blur(8px)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#38BDF8",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                <Building2 size={12} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />
                {isHi ? "डेस्क / काउंटर" : "Desk / Counter"}:
              </span>
              <span
                style={{
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 900,
                  letterSpacing: "0.2px",
                }}
              >
                {assignedDesk?.desk_name || activeCounter || "PHARMA-1"}
              </span>
            </div>

            {/* Department Scope Badge */}
            <DeskDepartmentBadge
              deskScope={deskScope}
              assignedDesk={assignedDesk}
              isDark={isDark}
              language={isHi ? "hi" : "en"}
            />

            {/* Pharmacist Duty Status Dropdown (Active on Duty, On Tea Break, Shift Ended) */}
            <div style={{ position: "relative" }} ref={dutyDropdownRef}>
              <button
                type="button"
                onClick={() => setShowDutyDropdown((prev) => !prev)}
                style={{
                  background:
                    pharmaDutyStatus === "ACTIVE"
                      ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                      : pharmaDutyStatus === "ON_BREAK"
                        ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                        : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "12px",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow:
                    pharmaDutyStatus === "ACTIVE"
                      ? "0 4px 14px rgba(16, 185, 129, 0.35)"
                      : pharmaDutyStatus === "ON_BREAK"
                        ? "0 4px 14px rgba(245, 158, 11, 0.35)"
                        : "0 4px 14px rgba(239, 68, 68, 0.35)",
                  transition: "all 0.2s ease",
                }}
                title={isHi ? "ड्यूटी स्थिति बदलें (सक्रिय, ब्रेक, शिफ्ट समाप्त)" : "Select Duty Status (Active on Duty, On Tea Break, Shift Ended)"}
              >
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFFFFF", display: "inline-block" }} />
                <span>
                  {pharmaDutyStatus === "ACTIVE"
                    ? (isHi ? "ड्यूटी पर सक्रिय" : "Active on Duty")
                    : pharmaDutyStatus === "ON_BREAK"
                      ? (isHi ? "अवकाश पर" : "On Tea Break")
                      : (isHi ? "शिफ्ट समाप्त" : "Shift Ended")}
                </span>
                <span style={{ fontSize: "9px", opacity: 0.85, marginLeft: "2px" }}>▼</span>
              </button>

              {showDutyDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.18)" : "1px solid #CBD5E1",
                    borderRadius: "14px",
                    padding: "6px",
                    boxShadow: isDark
                      ? "0 20px 40px -4px rgba(0, 0, 0, 0.7), 0 8px 16px rgba(2, 132, 199, 0.2)"
                      : "0 20px 40px -4px rgba(0, 0, 0, 0.2), 0 8px 16px rgba(2, 132, 199, 0.12)",
                    zIndex: 9999,
                    minWidth: "240px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ padding: "6px 10px 4px 10px", fontSize: "10.5px", fontWeight: 800, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {isHi ? "फार्मासिस्ट ड्यूटी स्थिति चुनें" : "Select Pharmacist Duty Status"}
                  </div>

                  {dutyStatusOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        handleUpdateDutyStatus(opt.id);
                        setShowDutyDropdown(false);
                        showToast(
                          isHi
                            ? `ड्यूटी स्थिति बदलकर '${opt.label}' कर दी गई`
                            : `Duty status updated to '${opt.label}'`,
                          opt.id === "ACTIVE" ? "success" : opt.id === "ON_BREAK" ? "warn" : "info"
                        );
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: pharmaDutyStatus === opt.id ? `1px solid ${opt.border}` : "1px solid transparent",
                        background: pharmaDutyStatus === opt.id ? opt.bg : "transparent",
                        color: isDark ? "#FFFFFF" : "#0F172A",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                        width: "100%",
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>{opt.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: opt.color }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: "10px", color: isDark ? "#94A3B8" : "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {opt.desc}
                        </div>
                      </div>
                      {pharmaDutyStatus === opt.id && (
                        <Check size={12} style={{ color: opt.color }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>


          </div>
        </div>

        {/* Live Metrics Grid (Glassmorphic Telemetry Cards) */}
        <div className="pharmacy-hero-kpi-grid">
          <div className="pharmacy-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "वितरण हेतु प्रतीक्षारत" : "Prescriptions Waiting"}
              </div>
              <Pill size={16} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {pharmacyQueue.length}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "दवा काउंटर पर कतार" : "Live Pharmacy Tokens"}
            </div>
          </div>

          <div className="pharmacy-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "काउंटर पर वितरण जारी" : "Serving at Counter"}
              </div>
              <Clock size={16} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {activeServingTicket
                ? `#${activeServingTicket.ticket_id}`
                : pharmaDutyStatus === "SHIFT_ENDED"
                  ? (isHi ? "शिफ्ट समाप्त" : "Shift Ended")
                  : pharmaDutyStatus === "ON_BREAK"
                    ? (isHi ? "अवकाश" : "On Break")
                    : (isHi ? "काउंटर तैयार" : "Ready")}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {activeServingTicket
                ? activeServingTicket.name
                : pharmaDutyStatus === "SHIFT_ENDED"
                  ? (isHi ? "काउंटर सेवा बंद है" : "Counter offline / closed")
                  : pharmaDutyStatus === "ON_BREAK"
                    ? (isHi ? "अवकाश पर (कॉलिंग रुकी है)" : "Dispensing paused")
                    : (isHi ? `${activeCounter} उपलब्ध` : `${activeCounter} ready`)}
            </div>
          </div>

          <div className="pharmacy-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "आज पूर्ण वितरण" : "Dispensed Today"}
              </div>
              <CheckCircle2 size={16} color="#34D399" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {dispensedTodayCount}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "मरीजों को दवाएं वितरित" : "Prescriptions Fulfilled"}
            </div>
          </div>

          <div className="pharmacy-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "औसत वितरण समय" : "Avg. Turnaround"}
              </div>
              <Sparkles size={16} color="#FBBF24" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {avgTurnaroundFormatted}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "दवा सत्यापन व पैकेजिंग" : "Pick, Pack & Counsel"}
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin Desk Notices and Emergency Desk Banner */}
      <div style={{ maxWidth: "1600px", margin: "16px auto 0 auto", padding: "0 24px" }}>
        <NoDeskNotice desksLoaded={desksLoaded} assignedDesk={assignedDesk} isDark={isDark} language={isHi ? "hi" : "en"} />
        <EmergencyDeskBanner isEmergencyDesk={isEmergencyDesk} isDark={isDark} language={isHi ? "hi" : "en"} />
      </div>

      {/* Duty Status Alert Banner when On Break or Shift Ended */}
      {pharmaDutyStatus !== "ACTIVE" && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 18px",
            borderRadius: "14px",
            background:
              pharmaDutyStatus === "SHIFT_ENDED"
                ? (isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2")
                : (isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB"),
            border:
              pharmaDutyStatus === "SHIFT_ENDED"
                ? (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA")
                : (isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #FDE68A"),
            color:
              pharmaDutyStatus === "SHIFT_ENDED"
                ? (isDark ? "#FCA5A5" : "#B91C1C")
                : (isDark ? "#FDE68A" : "#B45309"),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              {pharmaDutyStatus === "SHIFT_ENDED" ? <Clock size={15} /> : <Coffee size={15} />}
            </span>
            <span>
              {pharmaDutyStatus === "SHIFT_ENDED"
                ? (isHi
                  ? "शिफ्ट समाप्त (Shift Ended): फार्मेसी काउंटर सेवा आज के लिए बंद है। मरीज़ कॉलिंग रुकी है।"
                  : "Shift Ended: Pharmacy counter service is closed. Patient calling is paused.")
                : (isHi
                  ? "चाय / अल्पाहार अवकाश: काउंटर कॉलिंग अस्थायी रूप से रुकी है।"
                  : "On Tea Break: Counter dispensing is temporarily paused.")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleUpdateDutyStatus("ACTIVE")}
            style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
            }}
          >
            <Check size={12} />
            <span>{isHi ? "ड्यूटी पुनः शुरू करें" : "Resume Active Duty"}</span>
          </button>
        </div>
      )}

      {/* Modern 2-Tab Navigation Bar matching Doctor & Staff Portals */}
      <div className="pharmacy-tabs-grid">
        <button
          onClick={() => setActiveTab("dispensing")}
          className={`tab-button-modern ${activeTab === "dispensing" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <Pill size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "दवा वितरण स्टेशन" : "Live Dispensing Counter"}</div>
            <span className="tab-sub-text">{isHi ? "सक्रिय पर्चे व दवा वितरण" : "Active Prescriptions & Queue"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "dispensing" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
              color: activeTab === "dispensing" ? "#FFFFFF" : "#0284C7",
            }}
          >
            {pharmacyQueue.length}
          </span>
        </button>

        {/* Tab 2: Queue & Appointments */}
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`tab-button-modern ${activeTab === "queue" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <CalendarCheck size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "कतार एवं अपॉइंटमेंट्स" : "Queue & Appointments"}</div>
            <span className="tab-sub-text">{isHi ? "लाइव कतार व शेड्यूल्ड अपॉइंटमेंट्स" : "Live Queue & Booked Appointments"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "queue" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
              color: activeTab === "queue" ? "#FFFFFF" : "#0284C7",
            }}
          >
            {combinedLiveQueue.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("history");
            fetchPatientVisits();
          }}
          className={`tab-button-modern ${activeTab === "history" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <History size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "मरीज़ विज़िट इतिहास" : "Patient Visit History"}</div>
            <span className="tab-sub-text">{isHi ? "आए हुए मरीजों का संपूर्ण रिकॉर्ड" : "Past Patient Footfall & Audit"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "history" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
              color: activeTab === "history" ? "#FFFFFF" : "#0284C7",
            }}
          >
            {pharmaScopedVisits.length}
          </span>
        </button>
      </div>

      {/* Main Workspace Body */}
      {activeTab === "dispensing" && (
        <div style={{ width: "100%" }}>
          {/* Active Interactive Clinical Dispensing Terminal (Full Width Workspace) */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: "18px", padding: "24px", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
            {activeServingTicket ? (
              (() => {
                const ticket = activeServingTicket;
                const rxNotes = parseRxNotes(ticket) || {};
                const medicines = Array.isArray(rxNotes.medicines) ? rxNotes.medicines : [];
                const verifiedAll = medicines.length > 0 && medicines.every((_, idx) => dispensedItemsMap[`${ticket.ticket_id}_${idx}`]);

                return (
                  <div>
                    {/* Header Bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "16px", borderBottom: cardBorder, marginBottom: "18px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "20px", fontWeight: 900, color: highlightPrimary }}>
                            Token #{ticket.ticket_id}
                          </span>
                          <span style={{ fontSize: "18px", fontWeight: 800, color: textColor }}>
                            {ticket.name}
                          </span>
                          <span style={{ background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: highlightPrimary, padding: "3px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                            <Building2 size={11} />
                            <span>{activeCounter}</span>
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                          {ticket.age || 30} years old • {ticket.gender || "Patient"} • Phone: <strong>{ticket.phone || "Not provided"}</strong>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#0284C7", fontWeight: 700, marginTop: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                          <Stethoscope size={13} />
                          <span>Prescribed by: <strong>{rxNotes.doctor_name || "Consultant Doctor"}</strong> ({rxNotes.doctor_department || "OPD"})</span>
                          {rxNotes.prescribed_at ? ` • ${new Date(rxNotes.prescribed_at).toLocaleTimeString()}` : ""}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleReAnnounce(ticket)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: "10px",
                            border: cardBorder,
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            color: textColor,
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          title={isHi ? "प्रतीक्षालय डिस्प्ले पर भेजें" : "Call on waiting-room display"}
                        >
                          <Volume2 size={13} color="#0284C7" />
                          <span>{isHi ? "डिस्प्ले पर बुलाएं" : "Call on display"}</span>
                        </button>


                        <button
                          type="button"
                          onClick={() => handlePrintFullPrescription(ticket)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: "10px",
                            border: cardBorder,
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            color: textColor,
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          title="View Official Doctor Prescription Slip"
                        >
                          <FileText size={13} color="#0284C7" />
                          <span>{isHi ? "पर्ची प्रिंट" : "Print Rx"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Clinical Indication Banner */}
                    {(rxNotes.diagnosis || rxNotes.advice) && (
                      <div
                        style={{
                          background: isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF",
                          border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid #BAE6FD",
                          borderRadius: "12px",
                          padding: "12px 16px",
                          marginBottom: "18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase" }}>
                            {isHi ? "रोग निदान व डॉक्टर का निर्देश" : "Clinical Indication & Doctor's Advice"}
                          </div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: textColor, marginTop: "2px" }}>
                            {rxNotes.diagnosis || "Consultation Assessment"}
                          </div>
                          {rxNotes.advice && (
                            <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                              "{rxNotes.advice}"
                            </div>
                          )}
                        </div>
                        {rxNotes.follow_up && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0284C7" }}>
                              {isHi ? "फॉलो-अप" : "Follow-Up"}
                            </div>
                            <div style={{ fontSize: "11.5px", fontWeight: 700, color: textColor }}>
                              {rxNotes.follow_up}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Dispensing Checklist Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Pill size={17} color={highlightPrimary} />
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: textColor }}>
                          {isHi ? "दवा वितरण चेकलिस्ट व सत्यापन" : "Medication Dispensing Checklist"} ({medicines.length})
                        </h4>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {medicines.length > 0 && (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const next = {};
                                medicines.forEach((_, idx) => {
                                  next[`${ticket.ticket_id}_${idx}`] = true;
                                });
                                setDispensedItemsMap((prev) => ({ ...prev, ...next }));
                              }}
                              style={{
                                background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                                border: "1px solid #10B981",
                                color: "#059669",
                                borderRadius: "6px",
                                padding: "2px 8px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {isHi ? "सभी दी गईं" : "Mark All Given"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = {};
                                medicines.forEach((_, idx) => {
                                  next[`${ticket.ticket_id}_${idx}`] = false;
                                });
                                setDispensedItemsMap((prev) => ({ ...prev, ...next }));
                              }}
                              style={{
                                background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                                border: "1px solid #EF4444",
                                color: "#DC2626",
                                borderRadius: "6px",
                                padding: "2px 8px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {isHi ? "सभी बाकी" : "Mark All Not Given"}
                            </button>
                          </div>
                        )}
                        <div style={{ fontSize: "12px", fontWeight: 700, color: verifiedAll ? "#10B981" : mutedText }}>
                          {verifiedAll
                            ? (isHi ? "सभी दवाएं सत्यापित" : "All items verified")
                            : (isHi ? "वितरण के लिए प्रत्येक पर सही का निशान लगाएं" : "Check off items as you pick & pack")}
                        </div>
                      </div>
                    </div>

                    {/* Medication Items List */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                      {medicines.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px", color: mutedText, background: isDark ? "#1E293B" : "#F8FAFC", borderRadius: "12px" }}>
                          {isHi ? "इस पर्चे में कोई दवा सूचीबद्ध नहीं है।" : "No medication items found in this prescription."}
                        </div>
                      ) : (
                        medicines.map((med, idx) => {
                          const itemKey = `${ticket.ticket_id}_${idx}`;
                          const isDispensed = Boolean(dispensedItemsMap[itemKey]);

                          // Calculate total units: frequency (e.g. 1-0-1 = 2) * days (e.g. 5) = 10
                          let calculatedUnits = "As Directed";
                          if (med.frequency && med.duration) {
                            const dailyDoses = med.frequency.split("-").reduce((sum, d) => sum + (parseInt(d, 10) || 0), 0);
                            const days = parseInt(med.duration, 10) || 5;
                            if (dailyDoses > 0) {
                              calculatedUnits = `${dailyDoses * days} Units / Tabs`;
                            }
                          }

                          return (
                            <div
                              key={idx}
                              style={{
                                background: isDispensed ? (isDark ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5") : (isDark ? "#1E293B" : "#F8FAFC"),
                                border: isDispensed ? "1.5px solid #10B981" : cardBorder,
                                borderRadius: "14px",
                                padding: "14px 16px",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                                <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", flex: 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={isDispensed}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setDispensedItemsMap((prev) => ({ ...prev, [itemKey]: checked }));
                                    }}
                                    style={{
                                      width: "18px",
                                      height: "18px",
                                      accentColor: "#0284C7",
                                      marginTop: "3px",
                                      cursor: "pointer",
                                    }}
                                  />
                                  <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: "14px", fontWeight: 800, color: isDispensed ? "#059669" : textColor, textDecoration: isDispensed ? "line-through" : "none" }}>
                                        {idx + 1}. {med.name}
                                      </span>
                                      {med.dosage && (
                                        <span style={{ background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE", color: "#0284C7", padding: "1px 7px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                                          {med.dosage}
                                        </span>
                                      )}
                                      <span style={{ background: isDark ? "rgba(148, 163, 184, 0.2)" : "#E2E8F0", color: mutedText, padding: "1px 7px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                                        {med.duration || "5 days"}
                                      </span>
                                    </div>

                                    {/* Timing schedule badge pills */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706", background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7", padding: "2px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <Clock size={11} />
                                        <span>{med.frequency || "1-0-1"}</span>
                                      </span>
                                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", background: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5", padding: "2px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <Info size={11} />
                                        <span>{med.instructions || (isHi ? "भोजन के बाद" : "After food")}</span>
                                      </span>
                                    </div>
                                  </div>
                                </label>

                                {/* Calculated Total Quantity */}
                                <div style={{ textAlign: "right", minWidth: "110px" }}>
                                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                                    {isHi ? "वितरण मात्रा" : "Total To Pack"}
                                  </div>
                                  <div style={{ fontSize: "14px", fontWeight: 900, color: highlightPrimary, marginTop: "2px" }}>
                                    {calculatedUnits}
                                  </div>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      marginTop: "4px",
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      background: isDispensed ? "#10B981" : isDark ? "#334155" : "#E2E8F0",
                                      color: isDispensed ? "#FFFFFF" : mutedText,
                                    }}
                                  >
                                    {isDispensed ? (isHi ? "दी गई" : "Given") : (isHi ? "बाकी" : "PENDING")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Bottom Completion Actions */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "16px", borderTop: cardBorder }}>
                      <button
                        type="button"
                        onClick={() => setActiveServingTicket(null)}
                        style={{
                          background: "none",
                          border: cardBorder,
                          color: mutedText,
                          borderRadius: "10px",
                          padding: "8px 14px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {isHi ? "कतार पर वापस" : "Deselect Patient"}
                      </button>

                      <div style={{ display: "flex", gap: "10px" }}>

                        <button
                          type="button"
                          disabled={completingTicket}
                          onClick={() => handleCompleteDispensing(ticket)}
                          style={{
                            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "10px",
                            padding: "9px 20px",
                            fontSize: "13px",
                            fontWeight: 900,
                            cursor: completingTicket ? "wait" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "7px",
                            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>
                            {completingTicket
                              ? (isHi ? "वितरण सहेजा जा रहा है..." : "Completing...")
                              : (isHi ? "सभी दवाएं वितरित व परामर्श पूर्ण" : "Mark Dispensed & Complete Visit")}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : filteredQueue.length === 0 ? (
              <div style={{ textAlign: "center", padding: "70px 20px", color: mutedText }}>
                <div
                  style={{
                    width: "68px",
                    height: "68px",
                    borderRadius: "50%",
                    background: isDark ? "rgba(2, 132, 199, 0.2)" : "#F0F9FF",
                    color: highlightPrimary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px auto",
                  }}
                >
                  <Pill size={32} />
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: 800, color: textColor }}>
                  {isHi ? "फार्मेसी काउंटर उपलब्ध है" : "Pharmacy Counter Ready"}
                </h3>
                <p style={{ margin: "0 0 20px 0", fontSize: "13px", maxWidth: "460px", marginInline: "auto", lineHeight: 1.5 }}>
                  {isHi
                    ? "डॉक्टर द्वारा पर्ची स्थानांतरित होते ही यहाँ स्वतः प्रदर्शित होगी। अगला टोकन बुलाने के लिए नीचे बटन दबाएं।"
                    : "Transferred prescriptions from doctor desks will appear here live. Click below to call the next patient to your counter."}
                </p>
                <button
                  type="button"
                  onClick={handleCallNextPatient}
                  disabled={callingNext || pharmacyQueue.length === 0}
                  style={{
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "12px",
                    padding: "10px 24px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: pharmacyQueue.length === 0 ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                    opacity: pharmacyQueue.length === 0 ? 0.6 : 1,
                  }}
                >
                  <Volume2 size={16} />
                  <span>{callingNext ? (isHi ? "बुला रहे हैं..." : "Calling...") : (isHi ? "अगला टोकन बुलाएं" : "Call Next Patient to Counter")}</span>
                </button>
              </div>
            ) : (
              <div>
                {/* Full-width queue stream when tickets are waiting */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: 800, color: textColor }}>
                      {isHi ? "प्रतीक्षारत फार्मेसी कतार" : "Waiting Prescriptions"} ({pharmacyQueue.length})
                    </h3>
                    <p style={{ margin: 0, fontSize: "12.5px", color: mutedText }}>
                      {isHi ? "दवा वितरण प्रारंभ करने हेतु काउंटर पर लें या प्रतीक्षा डिस्प्ले पर कॉल करें।" : "Call next queued patient or select any prescription to dispense at your counter."}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder={isHi ? "टोकन # या नाम खोजें..." : "Filter by token or name..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          padding: "7px 12px 7px 30px",
                          borderRadius: "10px",
                          border: cardBorder,
                          background: isDark ? "#1E293B" : "#F8FAFC",
                          color: textColor,
                          fontSize: "12px",
                          outline: "none",
                          width: "180px",
                        }}
                      />
                      <Search size={13} color={mutedText} style={{ position: "absolute", left: "9px", top: "10px" }} />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          style={{ position: "absolute", right: "6px", top: "7px", background: "none", border: "none", color: mutedText, cursor: "pointer", fontSize: "11px", display: "inline-flex", alignItems: "center" }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleCallNextPatient}
                      disabled={callingNext || pharmacyQueue.length === 0}
                      style={{
                        background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "10px",
                        padding: "8px 18px",
                        fontSize: "12.5px",
                        fontWeight: 800,
                        cursor: pharmacyQueue.length === 0 ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                      }}
                    >
                      <Volume2 size={14} />
                      <span>{callingNext ? (isHi ? "बुला रहे हैं..." : "Calling...") : (isHi ? "अगला टोकन बुलाएं" : "Call Next Patient")}</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
                  {filteredQueue.map((ticket, idx) => {
                    const rxNotes = parseRxNotes(ticket);
                    const medList = Array.isArray(rxNotes?.medicines) ? rxNotes.medicines : [];
                    return (
                      <div
                        key={ticket.ticket_id || idx}
                        style={{
                          padding: "16px",
                          borderRadius: "14px",
                          border: cardBorder,
                          background: isDark ? "#1E293B" : "#F8FAFC",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "16px", fontWeight: 900, color: highlightPrimary }}>
                                #{ticket.ticket_id}
                              </span>
                              <span style={{ fontSize: "15px", fontWeight: 800, color: textColor }}>
                                {ticket.name}
                              </span>
                            </div>
                            <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                              {ticket.age || 30}y, {ticket.gender || "Patient"} • Ph: {ticket.phone || "N/A"}
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: ticket.priority_level === 1
                                ? (isDark ? "rgba(244, 63, 94, 0.25)" : "#FFE4E6")
                                : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
                              color: ticket.priority_level === 1 ? "#E11D48" : "#0284C7",
                            }}
                          >
                            {ticket.priority_level === 1 ? "EMERGENCY" : "STANDARD"}
                          </span>
                        </div>

                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: isDark ? "1px solid #334155" : "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: "11.5px", color: mutedText, display: "flex", alignItems: "center", gap: "4px" }}>
                            <User size={12} color={mutedText} />
                            <span>{rxNotes?.doctor_name || "Doctor"}</span>
                          </div>
                          <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#0284C7", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Pill size={12} />
                            <span>{medList.length} {isHi ? "दवाएं" : "Medicines"}</span>
                          </div>
                        </div>

                        <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => handleReAnnounce(ticket)}
                            style={{
                              flex: 1,
                              padding: "7px 10px",
                              borderRadius: "8px",
                              border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                              background: isDark ? "#0F172A" : "#FFFFFF",
                              color: textColor,
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "5px",
                            }}
                            title={isHi ? "प्रतीक्षालय डिस्प्ले पर भेजें" : "Call on waiting-room display"}
                          >
                            <Volume2 size={12} color="#0284C7" />
                            <span>{isHi ? "डिस्प्ले पर बुलाएं" : "Call on display"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveServingTicket(ticket)}
                            style={{
                              flex: 1.2,
                              padding: "7px 10px",
                              borderRadius: "8px",
                              border: "none",
                              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                              color: "#FFFFFF",
                              fontSize: "12px",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "5px",
                              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                            }}
                          >
                            <span>{isHi ? "काउंटर पर लें" : "Dispense"}</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Queue & Appointments Manager */}
      {activeTab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* 1. SUMMARY STRIP (8 METRICS) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "10px",
            }}
          >
            {/* 1. Waiting */}
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "प्रतीक्षारत" : "Waiting"}
                </span>
                <Clock size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "4px", lineHeight: "1" }}>
                {waitingMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "कतार में सक्रिय मरीज़" : "Active in live queue"}
              </div>
            </div>

            {/* 2. Serving */}
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "वितरण जारी" : "Serving"}
                </span>
                <Pill size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0C2340", marginTop: "4px", lineHeight: "1" }}>
                {servingMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {activeServingTicket ? `#${activeServingTicket.ticket_id} (${activeServingTicket.name})` : (isHi ? "काउंटर तैयार है" : "Counter ready")}
              </div>
            </div>

            {/* 3. On Hold */}
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "होल्ड पर" : "On Hold"}
                </span>
                <Pause size={14} color="#64748B" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#64748B", marginTop: "4px", lineHeight: "1" }}>
                {heldMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "10 मिनट ग्रेस विंडो" : "10-min grace window"}
              </div>
            </div>

            {/* 4. Booked Today */}
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "आज बुक" : "Booked Today"}
                </span>
                <Calendar size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "4px", lineHeight: "1" }}>
                {bookedTodayMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "शेड्यूल्ड अपॉइंटमेंट्स" : "Scheduled bookings"}
              </div>
            </div>

            {/* 5. Checked In */}
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "चेक-इन पूर्ण" : "Checked In"}
                </span>
                <CheckCircle2 size={14} color="#0369A1" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0369A1", marginTop: "4px", lineHeight: "1" }}>
                {checkedInMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "टोकन जारी / कतार में" : "Issued token / in queue"}
              </div>
            </div>

            {/* 6. No-Show / Expired */}
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "अनुपस्थित/समाप्त" : "No-Show / Exp."}
                </span>
                <UserX size={14} color="#EF4444" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#EF4444", marginTop: "4px", lineHeight: "1" }}>
                {noShowExpiredMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "अनुपस्थित / समय समाप्त" : "Missed or expired slots"}
              </div>
            </div>

            {/* 7. Average Wait */}
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "औसत प्रतीक्षा" : "Avg. Wait"}
                </span>
                <Sliders size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "4px", lineHeight: "1" }}>
                {avgWaitMinutes > 0 ? `~${avgWaitMinutes}m` : "0m"}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "वर्तमान कतार विलंब" : "Live queue wait time"}
              </div>
            </div>

            {/* 8. Average Dispense Time */}
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "औसत वितरण" : "Avg. Dispense"}
                </span>
                <Activity size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "4px", lineHeight: "1" }}>
                {avgDispenseMinutes > 0 ? `~${avgDispenseMinutes}m` : "0m"}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "मानक वितरण प्रोटोकॉल" : "Standard dispense protocol"}
              </div>
            </div>
          </div>

          {/* 2. SUB-VIEW CONTROLS & FILTERS BAR */}
          <div
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: "16px",
              padding: "14px 16px",
              boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Top Row: Sub-view Switcher & Quick Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              {/* Segmented Sub-view Switcher */}
              <div
                style={{
                  display: "inline-flex",
                  background: isDark ? "#0F172A" : "#F1F5F9",
                  padding: "4px",
                  borderRadius: "12px",
                  border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                  gap: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setQueueSubView("queue")}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "9px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: queueSubView === "queue" ? 800 : 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    background: queueSubView === "queue" ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : "transparent",
                    color: queueSubView === "queue" ? "#FFFFFF" : mutedText,
                    boxShadow: queueSubView === "queue" ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: queueSubView === "queue" ? "#BAE6FD" : "#94A3B8", display: "inline-block" }} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Activity size={13} /> {isHi ? "लाइव कतार" : "Live Queue"}
                  </span>
                  <span
                    style={{
                      fontSize: "10.5px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: queueSubView === "queue" ? "rgba(255,255,255,0.25)" : (isDark ? "#1E293B" : "#E2E8F0"),
                      color: queueSubView === "queue" ? "#FFFFFF" : mutedText,
                      fontWeight: 800,
                    }}
                  >
                    {combinedLiveQueue.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQueueSubView("appointments")}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "9px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: queueSubView === "appointments" ? 800 : 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    background: queueSubView === "appointments" ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : "transparent",
                    color: queueSubView === "appointments" ? "#FFFFFF" : mutedText,
                    boxShadow: queueSubView === "appointments" ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <CalendarCheck size={14} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    {isHi ? "आज की अपॉइंटमेंट्स" : "Today's Appointments"}
                  </span>
                  <span
                    style={{
                      fontSize: "10.5px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: queueSubView === "appointments" ? "rgba(255,255,255,0.25)" : (isDark ? "#1E293B" : "#E2E8F0"),
                      color: queueSubView === "appointments" ? "#FFFFFF" : mutedText,
                      fontWeight: 800,
                    }}
                  >
                    {filteredAppointments.length}
                  </span>
                </button>
              </div>

              {/* Quick Actions: Call Next + Refresh */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    fetchPharmacyAppointments();
                    if (refreshData) refreshData();
                    showToast(isHi ? "कतार व अपॉइंटमेंट्स रीफ्रेश हुए" : "Queue & appointments refreshed", "info");
                  }}
                  style={{
                    background: cardBg,
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    color: textColor,
                    padding: "7px 12px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                  title="Refresh Queue & Appointments"
                >
                  <RefreshCw size={13} />
                  <span>{isHi ? "रीफ्रेश" : "Refresh"}</span>
                </button>

                {Array.isArray(pharmacyQueue) && pharmacyQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCallNextPatient}
                    disabled={callingNext}
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "7px 14px",
                      borderRadius: "10px",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: callingNext ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                      opacity: callingNext ? 0.7 : 1,
                    }}
                  >
                    <Volume2 size={14} className={callingNext ? "spin-icon" : ""} />
                    <span>{callingNext ? (isHi ? "कॉल जारी है..." : "Calling...") : (isHi ? "अगला मरीज़ बुलाएं" : "Call Next Patient")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Filters Strip (Category Chips + Priority + Status + Search) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                borderTop: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9",
                paddingTop: "10px",
              }}
            >
              {/* Category Chips (hidden on Emergency Desk) */}
              {!isEmergencyDesk && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", marginRight: "2px" }}>
                    {isHi ? "श्रेणी:" : "Category:"}
                  </span>
                  {[
                    { id: "all", label: isHi ? "सभी" : "All" },
                    { id: "Chronic / Refill", label: isHi ? "क्रोनिक / रिफिल" : "Chronic / Refill" },
                    { id: "Acute / Urgent", label: isHi ? "एक्यूट / अर्जेंट" : "Acute / Urgent" },
                    { id: "General OPD", label: isHi ? "सामान्य ओपीडी" : "General OPD" },
                    { id: "Emergency", label: isHi ? "आपातकाल" : "Emergency" },
                  ].map((cat) => {
                    const isSelected = queueCategoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setQueueCategoryFilter(cat.id)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          fontWeight: isSelected ? 800 : 700,
                          cursor: "pointer",
                          border: isSelected ? "1.5px solid #0284C7" : (isDark ? "1px solid #334155" : "1px solid #E2E8F0"),
                          background: isSelected
                            ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE")
                            : (isDark ? "#0F172A" : "#F8FAFC"),
                          color: isSelected ? "#0284C7" : mutedText,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Priority & Status Selectors + Search Input */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {/* Priority Filter */}
                <select
                  value={queuePriorityFilter}
                  onChange={(e) => setQueuePriorityFilter(e.target.value)}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    color: textColor,
                    outline: "none",
                  }}
                >
                  <option value="all">{isHi ? "प्राथमिकता: सभी" : "Priority: All"}</option>
                  <option value="emergency">{isHi ? "आपातकालीन (Emergency)" : "Emergency (P1)"}</option>
                  <option value="urgent">{isHi ? "अत्यावश्यक (Urgent)" : "Urgent (P2)"}</option>
                  <option value="routine">{isHi ? "सामान्य (Routine)" : "Routine (P3)"}</option>
                </select>

                {/* Status Filter */}
                <select
                  value={queueStatusFilter}
                  onChange={(e) => setQueueStatusFilter(e.target.value)}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    color: textColor,
                    outline: "none",
                  }}
                >
                  <option value="all">{isHi ? "स्थिति: सभी" : "Status: All"}</option>
                  {queueSubView === "queue" ? (
                    <>
                      <option value="waiting">{isHi ? "प्रतीक्षारत (Waiting)" : "Waiting in Queue"}</option>
                      <option value="serving">{isHi ? "वितरण जारी (Serving)" : "Currently Serving"}</option>
                      <option value="on_hold">{isHi ? "होल्ड पर (On Hold)" : "On 10-min Hold"}</option>
                    </>
                  ) : (
                    <>
                      <option value="booked">{isHi ? "आरक्षित (Booked)" : "Booked / Scheduled"}</option>
                      <option value="checked_in">{isHi ? "चेक-इन पूर्ण (Checked In)" : "Checked In"}</option>
                      <option value="completed">{isHi ? "पूर्ण (Completed)" : "Completed"}</option>
                      <option value="expired">{isHi ? "समय समाप्त (Expired)" : "Expired Slots"}</option>
                      <option value="cancelled">{isHi ? "रद्द (Cancelled)" : "Cancelled"}</option>
                    </>
                  )}
                </select>

                {/* Date Filter (for Appointments view) */}
                {queueSubView === "appointments" && (
                  <select
                    value={appointmentDateFilter}
                    onChange={(e) => setAppointmentDateFilter(e.target.value)}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      color: textColor,
                      outline: "none",
                    }}
                  >
                    <option value="today">{isHi ? "आज (Today)" : "Today's Appointments"}</option>
                    <option value="all">{isHi ? "सभी तिथियां (All)" : "All Dates"}</option>
                  </select>
                )}

                {/* Search Box */}
                <div style={{ position: "relative", minWidth: "200px" }}>
                  <Search size={13} style={{ position: "absolute", left: "9px", top: "8px", color: mutedText }} />
                  <input
                    type="text"
                    placeholder={isHi ? "नाम, टोकन, फ़ोन खोजें..." : "Search name, token or phone..."}
                    value={queueSearchQuery}
                    onChange={(e) => setQueueSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 10px 5px 28px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#F8FAFC",
                      color: textColor,
                      fontSize: "11.5px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {queueSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setQueueSearchQuery("")}
                      style={{
                        position: "absolute",
                        right: "6px",
                        top: "6px",
                        background: "none",
                        border: "none",
                        color: mutedText,
                        cursor: "pointer",
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. SUB-VIEW 1: LIVE QUEUE LIST */}
          {queueSubView === "queue" && (
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "16px",
                padding: "16px 18px",
                boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 900, color: textColor, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{isEmergencyDesk ? (isHi ? "आपातकालीन कतार" : "Emergency Queue") : (isHi ? "लाइव फार्मेसी कतार स्ट्रीम" : "Live Pharmacy & Dispensing Queue")}</span>
                    <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: "#0284C7" }}>
                      {combinedLiveQueue.length} {isHi ? "मरीज़" : "Patients"}
                    </span>
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: mutedText }}>
                    {isHi
                      ? "आपातकालीन ट्राइएज वरीयता क्रम में क्रमबद्ध • लाइव प्रतीक्षा टाइमर व त्वरित वितरण क्रियाएं"
                      : "Sorted emergency first, then by wait time • Live wait timer & prescription quick actions"}
                  </p>
                </div>

                <div style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444" }} /> {isHi ? "आपातकाल" : "Emergency (P1)"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748B" }} /> {isHi ? "अत्यावश्यक" : "Urgent (P2)"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0284C7" }} /> {isHi ? "सामान्य" : "Routine (P3)"}
                  </span>
                </div>
              </div>

              {combinedLiveQueue.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 10px", color: mutedText }}>
                  <Pill size={40} style={{ opacity: 0.3, margin: "0 auto 10px auto" }} />
                  <div style={{ fontSize: "14px", fontWeight: 800, color: textColor }}>
                    {isEmergencyDesk
                      ? (isHi ? "कोई आपातकालीन मरीज़ प्रतीक्षारत नहीं है" : "No emergency patients waiting")
                      : (isHi ? "कतार में कोई मरीज़ नहीं है" : "No patients in live pharmacy queue")}
                  </div>
                  <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                    {queueSearchQuery || queueCategoryFilter !== "all" || queuePriorityFilter !== "all"
                      ? (isHi ? "फ़िल्टर बदलकर देखें" : "Try clearing filters to see waiting patients")
                      : (isHi ? "जब मरीज़ चेक-इन करेंगे तो यहाँ प्रदर्शित होंगे" : "Patients will appear here automatically when checked in")}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {combinedLiveQueue.map((ticket) => {
                    const parsed = parseRxNotes(ticket) || {};
                    const medList = Array.isArray(parsed.medicines) ? parsed.medicines : [];
                    const cat = detectPharmacyItemCategory(ticket);
                    const isEmergency = isEmergencyTicket(ticket);
                    const isUrgent = Number(ticket.priority_level || ticket.priority) === 2;
                    const isServing = ticket._queueCategory === "serving";
                    const isHeld = ticket._queueCategory === "on_hold";

                    // Wait Time Calculation
                    const rawJoin = ticket.join_timestamp
                      ? (Number(ticket.join_timestamp) > 1e11 ? Number(ticket.join_timestamp) / 1000 : Number(ticket.join_timestamp))
                      : (ticket.created_at ? new Date(ticket.created_at).getTime() / 1000 : nowSec);
                    const joinSec = isNaN(rawJoin) ? nowSec : rawJoin;
                    const elapsedSec = Math.max(0, nowSec - joinSec);
                    const elapsedMin = Math.floor(elapsedSec / 60);
                    const elapsedRemSec = Math.floor(elapsedSec % 60);
                    const isOverdueWait = elapsedMin >= 30;
                    const isModerateWait = elapsedMin >= 15;

                    // Referring Doctor
                    const docRef = parsed.doctor_name ? `${parsed.doctor_name} (${parsed.doctor_department || "OPD"})` : (ticket.department_name || "General OPD");

                    return (
                      <div
                        key={ticket.ticket_id}
                        style={{
                          background: isServing
                            ? (isDark ? "rgba(2, 132, 199, 0.08)" : "#F0F9FF")
                            : isHeld
                              ? (isDark ? "rgba(100, 116, 139, 0.08)" : "#F1F5F9")
                              : isEmergency
                                ? (isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2")
                                : (isDark ? "#0F172A" : "#F8FAFC"),
                          border: isServing
                            ? "1.5px solid #0284C7"
                            : isHeld
                              ? "1.5px solid #64748B"
                              : isEmergency
                                ? "1.5px solid #EF4444"
                                : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                          borderRadius: "14px",
                          padding: "12px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Row 1: Token, Demographics & Action Buttons */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          {/* Left: Token & Patient Info */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <div
                              style={{
                                padding: "6px 12px",
                                borderRadius: "10px",
                                background: isEmergency ? "#EF4444" : isUrgent ? "#64748B" : "#0284C7",
                                color: "#FFFFFF",
                                fontWeight: 900,
                                fontSize: "14px",
                                letterSpacing: "-0.2px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                boxShadow: isEmergency ? "0 2px 10px rgba(239, 68, 68, 0.4)" : "none",
                              }}
                            >
                              <span>#{ticket.ticket_id}</span>
                            </div>

                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 800, fontSize: "14px", color: textColor }}>
                                  {ticket.name || ticket.patient_name || "Patient"}
                                </span>
                                <span style={{ fontSize: "12px", color: mutedText, fontWeight: 600 }}>
                                  {ticket.age || 30}y / {ticket.gender || "M"}
                                </span>
                                {ticket.phone && (
                                  <span style={{ fontSize: "11.5px", color: mutedText }}>
                                    • {ticket.phone}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                                    color: "#0284C7",
                                    border: "1px solid rgba(2, 132, 199, 0.3)",
                                  }}
                                >
                                  {cat}
                                </span>

                                <span style={{ fontSize: "11px", color: mutedText, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <Stethoscope size={11} />
                                  <span>{isHi ? "रेफरल:" : "Ref:"} {docRef}</span>
                                </span>

                                {/* Priority Badge */}
                                {isEmergency ? (
                                  <EmergencyBadge ticket={ticket} language={isHi ? "hi" : "en"} isDark={isDark} showTime={true} />
                                ) : (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 900,
                                      padding: "2px 7px",
                                      borderRadius: "9999px",
                                      background: isUrgent ? "#F1F5F9" : "#EFF6FF",
                                      color: isUrgent ? "#475569" : "#0284C7",
                                      border: isUrgent ? "1px solid #CBD5E1" : "1px solid #BAE6FD",
                                    }}
                                  >
                                    {isUrgent ? (isHi ? "अत्यावश्यक" : "Urgent (P2)") : (isHi ? "सामान्य" : "Routine (P3)")}
                                  </span>
                                )}

                                {/* Status Badge */}
                                {isServing ? (
                                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", background: "#0284C7", color: "#FFFFFF" }}>
                                    {isHi ? "वितरण जारी" : "Serving"}
                                  </span>
                                ) : isHeld ? (
                                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", background: "#64748B", color: "#FFFFFF" }}>
                                    {isHi ? "होल्ड (10 मिनट)" : "On Hold"}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE", color: "#0284C7", border: "1px solid rgba(2, 132, 199, 0.3)" }}>
                                    {isHi ? "प्रतीक्षारत" : "Waiting"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Wait Timer & Quick Action Buttons */}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            {/* Live Wait Timer */}
                            <div
                              style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: isOverdueWait
                                  ? (isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2")
                                  : isModerateWait
                                    ? (isDark ? "rgba(100, 116, 139, 0.2)" : "#F1F5F9")
                                    : (isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE"),
                                color: isOverdueWait ? "#DC2626" : isModerateWait ? "#475569" : "#0284C7",
                                border: isOverdueWait ? "1px solid #FECACA" : isModerateWait ? "1px solid #CBD5E1" : "1px solid #BAE6FD",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontVariantNumeric: "tabular-nums",
                              }}
                              title={isHi ? `प्रतीक्षा समय: ${elapsedMin} मिनट ${elapsedRemSec} सेकंड` : `Live Waiting Duration: ${elapsedMin}m ${elapsedRemSec}s`}
                            >
                              <Clock size={12} />
                              <span>{isHi ? "प्रतीक्षा:" : "Wait:"} {elapsedMin}m {elapsedRemSec}s</span>
                            </div>

                            {/* Serve / Dispense Button */}
                            <button
                              type="button"
                              onClick={() => handleServeFromQueue(ticket)}
                              style={{
                                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                color: "#FFFFFF",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                              }}
                              title="Load patient into active dispensing counter"
                            >
                              <Pill size={13} />
                              <span>{isHi ? "दवा वितरण" : "Serve / Dispense"}</span>
                            </button>

                            {/* Hold / Recall Button */}
                            {isHeld ? (
                              <button
                                type="button"
                                onClick={() => handleRecallHeld(ticket)}
                                style={{
                                  background: "#0284C7",
                                  border: "none",
                                  color: "#FFFFFF",
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Recall ticket back to active queue"
                              >
                                <Play size={12} />
                                <span>{isHi ? "रिकॉल" : "Recall"}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleHold(ticket)}
                                style={{
                                  background: isDark ? "#1E293B" : "#F1F5F9",
                                  border: "1px solid #64748B",
                                  color: "#475569",
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Place on 10-minute hold"
                              >
                                <Pause size={12} />
                                <span>{isHi ? "होल्ड" : "Hold"}</span>
                              </button>
                            )}

                            {/* Complete Button */}
                            <button
                              type="button"
                              onClick={() => handleCompleteDispensing(ticket)}
                              disabled={completingTicket}
                              style={{
                                background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                                border: "1px solid #10B981",
                                color: "#059669",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Mark dispensing completed"
                            >
                              <CheckCircle2 size={12} />
                              <span>{isHi ? "पूर्ण" : "Complete"}</span>
                            </button>

                            {/* No-Show Button */}
                            <button
                              type="button"
                              onClick={() => handleFinalizeNoShow(ticket)}
                              style={{
                                background: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
                                border: "1px solid #EF4444",
                                color: "#DC2626",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Mark as absent / No-Show"
                            >
                              <UserX size={12} />
                              <span>{isHi ? "अनुपस्थित" : "No-Show"}</span>
                            </button>

                            {/* Cancel Button */}
                            <button
                              type="button"
                              onClick={() => handleCancelTicket(ticket)}
                              style={{
                                background: isDark ? "#1E293B" : "#F1F5F9",
                                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                color: mutedText,
                                padding: "6px 8px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              title="Cancel ticket"
                            >
                              <X size={12} />
                            </button>

                            {/* Re-announce to Waiting Room Kiosk */}
                            <button
                              type="button"
                              onClick={() => handleReAnnounce(ticket)}
                              style={{
                                background: isDark ? "#1E293B" : "#F1F5F9",
                                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                color: textColor,
                                padding: "6px 8px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              title="Broadcast to waiting room kiosk display"
                            >
                              <Volume2 size={12} />
                            </button>

                            {/* Print Prescription Slip */}
                            <button
                              type="button"
                              onClick={() => handlePrintFullPrescription(ticket)}
                              style={{
                                background: isDark ? "#1E293B" : "#F1F5F9",
                                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                color: textColor,
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Print doctor prescription slip"
                            >
                              <Printer size={12} />
                              <span>Rx</span>
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Medicines Preview */}
                        <div
                          style={{
                            background: isDark ? "#0F172A" : "#FFFFFF",
                            border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                            borderRadius: "10px",
                            padding: "8px 12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flex: 1 }}>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
                              {isHi ? "दवाएं:" : "Prescribed Meds:"}
                            </span>
                            {medList.length > 0 ? (
                              medList.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 7px",
                                    borderRadius: "5px",
                                    background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                                    color: "#0284C7",
                                    border: "1px solid rgba(2, 132, 199, 0.25)",
                                  }}
                                >
                                  {m.name || m.medicine} {m.dosage ? `(${m.dosage})` : ""}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: "11.5px", color: mutedText, fontStyle: "italic" }}>
                                {parsed.advice || (isHi ? "कोई दवा विवरण नहीं" : "No structured medication items listed")}
                              </span>
                            )}
                          </div>

                          {parsed.notes && (
                            <div style={{ fontSize: "11px", color: mutedText }}>
                              <strong>Note:</strong> {parsed.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. SUB-VIEW 2: TODAY'S APPOINTMENTS (GROUPED BY TIME SLOT) */}
          {queueSubView === "appointments" && (
            <div
              style={{
                background: cardBg,
                border: cardBorder,
                borderRadius: "16px",
                padding: "16px 18px",
                boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 900, color: textColor, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{isHi ? "शेड्यूल्ड फार्मेसी अपॉइंटमेंट्स" : "Today's Booked Pharmacy Appointments"}</span>
                    <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: "#0284C7" }}>
                      {filteredAppointments.length} {isHi ? "अपॉइंटमेंट्स" : "Bookings"}
                    </span>
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: mutedText }}>
                    {isHi
                      ? "समय स्लॉट वार समूहीकृत • मैन्युअल चेक-इन (कतार टोकन जारी), पूर्ण, रद्दीकरण एवं एसएमएस"
                      : "Grouped by time slot • Manual check-in (convert to queue ticket), complete, cancel & SMS"}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => fetchPharmacyAppointments(true)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "8px",
                      background: isDark ? "#1E293B" : "#F1F5F9",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      color: textColor,
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <RefreshCw size={12} className={appointmentsLoading ? "spin-icon" : ""} />
                    <span>{isHi ? "रीलोड" : "Reload"}</span>
                  </button>
                </div>
              </div>

              {appointmentsLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#0284C7" }}>
                  <RefreshCw size={24} className="spin-icon" style={{ margin: "0 auto 8px auto" }} />
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "अपॉइंटमेंट्स लोड हो रही हैं..." : "Loading appointments..."}</div>
                </div>
              ) : Object.keys(appointmentsBySlot).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 10px", color: mutedText }}>
                  <Calendar size={40} style={{ opacity: 0.3, margin: "0 auto 10px auto" }} />
                  <div style={{ fontSize: "14px", fontWeight: 800, color: textColor }}>
                    {isHi ? "कोई अपॉइंटमेंट नहीं मिली" : "No appointments scheduled matching filters"}
                  </div>
                  <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                    {queueSearchQuery || queueCategoryFilter !== "all"
                      ? (isHi ? "फ़िल्टर साफ़ करके पुनः प्रयास करें" : "Try resetting your search query or category filter")
                      : (isHi ? "अपॉइंटमेंट ऑनलाइन या रिसेप्शन से दर्ज होने पर यहाँ दिखाई देंगे" : "Scheduled appointments will appear here automatically")}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {Object.entries(appointmentsBySlot).map(([slotKey, slotApts]) => (
                    <div
                      key={slotKey}
                      style={{
                        background: isDark ? "#0F172A" : "#F8FAFC",
                        border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                        borderRadius: "14px",
                        padding: "12px",
                      }}
                    >
                      {/* Slot Header Banner */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "10px",
                          paddingBottom: "8px",
                          borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 900, color: "#0284C7" }}>
                            {slotKey}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText }}>
                            ({slotApts.length} {slotApts.length === 1 ? (isHi ? "अपॉइंटमेंट" : "Appointment") : (isHi ? "अपॉइंटमेंट्स" : "Appointments")})
                          </span>
                        </div>
                      </div>

                      {/* Appointments inside slot */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {slotApts.map((apt) => {
                          const rawStatus = (apt.status || "booked").toLowerCase();
                          const isCheckedIn = rawStatus === "checked_in" || Boolean(apt.ticket_id && rawStatus !== "cancelled" && rawStatus !== "expired");
                          const isCompleted = rawStatus === "completed";
                          const isCancelled = rawStatus === "cancelled";
                          const isExpired = rawStatus === "expired";
                          const isLate = isAppointmentLate(apt);
                          const isCheckinOpen = !isCheckedIn && !isCompleted && !isCancelled && !isExpired;
                          const cat = detectPharmacyItemCategory(apt);

                          return (
                            <div
                              key={apt.appointment_id}
                              style={{
                                background: isCheckedIn
                                  ? (isDark ? "rgba(2, 132, 199, 0.08)" : "#F0F9FF")
                                  : isLate
                                    ? (isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2")
                                    : (isDark ? "#0F172A" : "#FFFFFF"),
                                border: isCheckedIn
                                  ? "1px solid #0284C7"
                                  : isLate
                                    ? "1.5px solid #EF4444"
                                    : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                                borderRadius: "12px",
                                padding: "10px 14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                }}
                              >
                                {/* Left demographics */}
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", fontFamily: "monospace" }}>
                                      #{apt.appointment_id}
                                    </span>
                                    <span style={{ fontWeight: 800, fontSize: "13.5px", color: textColor }}>
                                      {apt.patient_name || apt.name || "Patient"}
                                    </span>
                                    <span style={{ fontSize: "11.5px", color: mutedText }}>
                                      {apt.age ? `${apt.age}y / ` : ""}{apt.gender || "M"}
                                    </span>
                                    {apt.phone && (
                                      <span style={{ fontSize: "11.5px", color: mutedText }}>
                                        • {apt.phone}
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                                    <span
                                      style={{
                                        fontSize: "10.5px",
                                        fontWeight: 800,
                                        padding: "1px 6px",
                                        borderRadius: "5px",
                                        background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                                        color: "#0284C7",
                                        border: "1px solid rgba(2, 132, 199, 0.3)",
                                      }}
                                    >
                                      {cat} • {apt.doctor_name || apt.department || "Pharmacy"}
                                    </span>

                                    {/* Status Chip */}
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        fontWeight: 800,
                                        padding: "2px 8px",
                                        borderRadius: "9999px",
                                        background: isCheckedIn
                                          ? "#E0F2FE"
                                          : isCompleted
                                            ? "#ECFDF5"
                                            : isCancelled
                                              ? "#F1F5F9"
                                              : isExpired
                                                ? "#FEF2F2"
                                                : "#F1F5F9",
                                        color: isCheckedIn
                                          ? "#0369A1"
                                          : isCompleted
                                            ? "#059669"
                                            : isCancelled
                                              ? "#64748B"
                                              : isExpired
                                                ? "#DC2626"
                                                : "#334155",
                                        border: isCheckedIn
                                          ? "1px solid #BAE6FD"
                                          : isCompleted
                                            ? "1px solid #A7F3D0"
                                            : isCancelled
                                              ? "1px solid #CBD5E1"
                                              : isExpired
                                                ? "1px solid #FECACA"
                                                : "1px solid #CBD5E1",
                                      }}
                                    >
                                      {isCheckedIn
                                        ? `Checked In (#${apt.ticket_id || ""})`
                                        : isCompleted
                                          ? "Completed"
                                          : isCancelled
                                            ? "Cancelled"
                                            : isExpired
                                              ? "Expired"
                                              : isCheckinOpen
                                                ? "Check-in Open"
                                                : "Booked"}
                                    </span>

                                    {/* Late Marker */}
                                    {isLate && (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 900,
                                          padding: "2px 7px",
                                          borderRadius: "9999px",
                                          background: "#EF4444",
                                          color: "#FFFFFF",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                          boxShadow: "0 1px 4px rgba(239, 68, 68, 0.3)",
                                        }}
                                      >
                                        <AlertTriangle size={11} color="#DC2626" />
                                        <span>{isHi ? "विलंबित मरीज़ (Late)" : "LATE / OVERDUE"}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Right actions: Check-in, Mark Completed, Cancel, SMS Reminder */}
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  {/* SMS Reminder Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleSendSmsReminder(apt)}
                                    style={{
                                      background: isDark ? "#1E293B" : "#F1F5F9",
                                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                      color: textColor,
                                      padding: "6px 10px",
                                      borderRadius: "8px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                    title="Send SMS appointment reminder to patient phone"
                                  >
                                    <Phone size={12} />
                                    <span>{isHi ? "एसएमएस" : "SMS"}</span>
                                  </button>

                                  {!isCheckedIn && !isCompleted && !isCancelled && !isExpired && (
                                    <>
                                      {/* Check-In (Convert to Queue Ticket) */}
                                      <button
                                        type="button"
                                        onClick={() => handleCheckInAppointment(apt.appointment_id)}
                                        style={{
                                          background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                          color: "#FFFFFF",
                                          border: "none",
                                          padding: "6px 12px",
                                          borderRadius: "8px",
                                          fontSize: "11.5px",
                                          fontWeight: 800,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                                        }}
                                        title="Issue queue token and check-in patient"
                                      >
                                        <CheckCircle2 size={13} />
                                        <span>{isHi ? "चेक-इन करें" : "Check-In"}</span>
                                      </button>

                                      {/* Mark Completed */}
                                      <button
                                        type="button"
                                        onClick={() => handleCompleteAppointment(apt.appointment_id)}
                                        style={{
                                          background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                                          border: "1px solid #10B981",
                                          color: "#059669",
                                          padding: "6px 10px",
                                          borderRadius: "8px",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                        title="Mark appointment as completed"
                                      >
                                        {isHi ? "पूर्ण" : "Complete"}
                                      </button>

                                      {/* Cancel */}
                                      <button
                                        type="button"
                                        onClick={() => handleCancelAppointment(apt.appointment_id)}
                                        style={{
                                          background: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
                                          border: "1px solid #EF4444",
                                          color: "#DC2626",
                                          padding: "6px 10px",
                                          borderRadius: "8px",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                        title="Cancel scheduled appointment"
                                      >
                                        {isHi ? "रद्द करें" : "Cancel"}
                                      </button>
                                    </>
                                  )}

                                  {isCheckedIn && (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#0284C7",
                                        fontWeight: 800,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      <CheckCircle2 size={14} />
                                      <span>{isHi ? `कतार में सक्रिय (#${apt.ticket_id || ""})` : `In Live Queue (#${apt.ticket_id || ""})`}</span>
                                    </span>
                                  )}

                                  {isCompleted && (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#059669",
                                        fontWeight: 800,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      <CheckCircle2 size={14} />
                                      <span>{isHi ? "विज़िट पूर्ण" : "Completed"}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Patient Visit History */}
      {activeTab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Telemetry Metric Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
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
                  {isHi ? "मेरे कुल परामर्श" : "My Consultations Total"}
                </span>
                <History size={16} color="#0284C7" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: textColor, marginTop: "6px" }}>
                {dateCounts.all}
              </div>
              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                {isHi ? "आपके द्वारा परामर्शित कुल मरीज़" : "Total patients consulted & dispensed by you"}
              </div>
            </div>

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
                  {isHi ? "आज के परामर्श" : "Today's Consultations"}
                </span>
                <Calendar size={16} color="#10B981" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#10B981", marginTop: "6px" }}>
                {dateCounts.today}
              </div>
              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                {isHi ? "आज परामर्शित व दवा प्राप्त मरीज़" : "Consulted & dispensed today"}
              </div>
            </div>

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
                  {isHi ? "कल के परामर्श" : "Yesterday's Consultations"}
                </span>
                <Clock size={16} color="#F59E0B" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#F59E0B", marginTop: "6px" }}>
                {dateCounts.yesterday}
              </div>
              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                {isHi ? "कल परामर्शित व दवा प्राप्त मरीज़" : "Consulted & dispensed yesterday"}
              </div>
            </div>

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
                  {isHi ? "पूर्ण दवा वितरण" : "Completed Dispensing"}
                </span>
                <CheckCircle2 size={16} color="#0284C7" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: textColor, marginTop: "6px" }}>
                {dateCounts.completed}
              </div>
              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                {isHi ? "सफल दवा वितरण व पर्चा ऑडिट" : "Prescriptions fulfilled & closed"}
              </div>
            </div>
          </div>

          {/* Main Table Card */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: "18px", padding: "24px" }}>
            {/* Header Title & Pharmacist Scope Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: textColor, display: "flex", alignItems: "center", gap: "8px" }}>
                  <History size={18} color="#0284C7" />
                  <span>
                    {visitScopeFilter === "my"
                      ? (isHi ? "मेरा दवा वितरण व परामर्श इतिहास" : "My Dispensing & Patient History")
                      : (isHi ? "फार्मेसी मरीज़ विज़िट एवं दवा वितरण इतिहास" : "Pharmacy Patient Visit & Dispensing History")}
                  </span>
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: mutedText }}>
                  {visitScopeFilter === "my"
                    ? (isHi
                        ? "केवल आपके द्वारा परामर्शित एवं दवा वितरित किए गए मरीज़ों का संपूर्ण ऑडिट रिकॉर्ड।"
                        : "Audit records for patients dispensed exclusively by you.")
                    : (isHi
                        ? "इस अस्पताल के फार्मेसी विभाग के सभी मरीज़ों का विज़िट एवं दवा वितरण ऑडिट रिकॉर्ड।"
                        : "All pharmacy consultation and medicine dispensing audit records for this facility.")}
                </p>
              </div>

              {/* Scope Toggle: All Pharmacy Visits vs My Dispensing */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", background: isDark ? "#1E293B" : "#E2E8F0", padding: "3px", borderRadius: "10px", alignItems: "center", gap: "3px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setVisitScopeFilter("all");
                      setVisitPage(1);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "7px",
                      border: "none",
                      background: visitScopeFilter === "all" ? "#0284C7" : "transparent",
                      color: visitScopeFilter === "all" ? "#FFFFFF" : textColor,
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                    title={isHi ? "अस्पताल के सभी फार्मेसी विज़िट देखें" : "View all pharmacy visits for this hospital"}
                  >
                    <Building2 size={13} />
                    <span>{isHi ? "सभी फार्मेसी विज़िट" : "All pharmacy visits"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVisitScopeFilter("my");
                      setVisitPage(1);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "7px",
                      border: "none",
                      background: visitScopeFilter === "my" ? "#0284C7" : "transparent",
                      color: visitScopeFilter === "my" ? "#FFFFFF" : textColor,
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                    title={isHi ? "केवल आपके द्वारा वितरित विज़िट देखें" : "View only visits dispensed by you"}
                  >
                    <User size={13} />
                    <span>{isHi ? "मेरा वितरण" : "My dispensing"}</span>
                  </button>
                </div>

                {visitScopeFilter === "my" && (
                  <span
                    style={{
                      background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                      border: isDark ? "1px solid rgba(2, 132, 199, 0.4)" : "1px solid #BAE6FD",
                      color: "#0284C7",
                      padding: "5px 10px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <User size={12} />
                    <span>{currentUser?.name || currentUser?.username || "Logged-in Pharmacist"}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Filter Controls Bar */}
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
              }}
            >
              {/* Row 1: Date Range Presets & Custom Date Picker */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Calendar size={13} color="#0284C7" />
                    <span>{isHi ? "दिनांक अवधि:" : "Date Range:"}</span>
                  </span>

                  <div style={{ display: "inline-flex", background: isDark ? "#1E293B" : "#E2E8F0", padding: "3px", borderRadius: "10px", alignItems: "center", gap: "3px" }}>
                    {/* Today */}
                    <button
                      type="button"
                      onClick={() => setVisitDateFilter("today")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: visitDateFilter === "today" ? "#10B981" : "transparent",
                        color: visitDateFilter === "today" ? "#FFFFFF" : textColor,
                        fontSize: "11.5px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{isHi ? "आज" : "Today"}</span>
                      <span
                        style={{
                          background: visitDateFilter === "today" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(255,255,255,0.08)" : "#CBD5E1"),
                          color: visitDateFilter === "today" ? "#FFFFFF" : mutedText,
                          padding: "1px 6px",
                          borderRadius: "5px",
                          fontSize: "10px",
                          fontWeight: 900,
                        }}
                      >
                        {dateCounts.today}
                      </span>
                    </button>

                    {/* Yesterday */}
                    <button
                      type="button"
                      onClick={() => setVisitDateFilter("yesterday")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: visitDateFilter === "yesterday" ? "#F59E0B" : "transparent",
                        color: visitDateFilter === "yesterday" ? "#FFFFFF" : textColor,
                        fontSize: "11.5px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{isHi ? "कल" : "Yesterday"}</span>
                      <span
                        style={{
                          background: visitDateFilter === "yesterday" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(255,255,255,0.08)" : "#CBD5E1"),
                          color: visitDateFilter === "yesterday" ? "#FFFFFF" : mutedText,
                          padding: "1px 6px",
                          borderRadius: "5px",
                          fontSize: "10px",
                          fontWeight: 900,
                        }}
                      >
                        {dateCounts.yesterday}
                      </span>
                    </button>

                    {/* Date Wise */}
                    <button
                      type="button"
                      onClick={() => setVisitDateFilter("date_wise")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: visitDateFilter === "date_wise" ? "#0284C7" : "transparent",
                        color: visitDateFilter === "date_wise" ? "#FFFFFF" : textColor,
                        fontSize: "11.5px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{isHi ? "तिथि अनुसार" : "Date Wise"}</span>
                      {visitDateFilter === "date_wise" && (
                        <span
                          style={{
                            background: "rgba(255,255,255,0.25)",
                            color: "#FFFFFF",
                            padding: "1px 6px",
                            borderRadius: "5px",
                            fontSize: "10px",
                            fontWeight: 900,
                          }}
                        >
                          {dateCounts.custom}
                        </span>
                      )}
                    </button>

                    {/* All Dates */}
                    <button
                      type="button"
                      onClick={() => setVisitDateFilter("all")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: visitDateFilter === "all" ? (isDark ? "#475569" : "#64748B") : "transparent",
                        color: visitDateFilter === "all" ? "#FFFFFF" : textColor,
                        fontSize: "11.5px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{isHi ? "सभी तिथियां" : "All Dates"}</span>
                      <span
                        style={{
                          background: visitDateFilter === "all" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(255,255,255,0.08)" : "#CBD5E1"),
                          color: visitDateFilter === "all" ? "#FFFFFF" : mutedText,
                          padding: "1px 6px",
                          borderRadius: "5px",
                          fontSize: "10px",
                          fontWeight: 900,
                        }}
                      >
                        {dateCounts.all}
                      </span>
                    </button>
                  </div>

                  {/* Date Picker Input */}
                  <input
                    type="date"
                    value={customVisitDate}
                    onChange={(e) => {
                      setCustomVisitDate(e.target.value);
                      setVisitDateFilter("date_wise");
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "9px",
                      border: visitDateFilter === "date_wise" ? "1.5px solid #0284C7" : cardBorder,
                      background: isDark ? "#1E293B" : "#FFFFFF",
                      color: textColor,
                      fontSize: "11.5px",
                      fontWeight: 700,
                      outline: "none",
                      cursor: "pointer",
                      boxShadow: visitDateFilter === "date_wise" ? "0 0 0 2px rgba(2, 132, 199, 0.25)" : "none",
                    }}
                    title={isHi ? "कस्टम तिथि का चयन करें" : "Pick custom date"}
                  />
                </div>

                {/* Clear Filters Button if any filter is active */}
                {(visitDateFilter !== "today" || visitStatusFilter !== "all" || visitDoctorFilter !== "all" || Boolean(visitSearchQuery.trim())) && (
                  <button
                    type="button"
                    onClick={() => {
                      setVisitDateFilter("today");
                      setVisitStatusFilter("all");
                      setVisitDoctorFilter("all");
                      setVisitSearchQuery("");
                      setVisitPage(1);
                    }}
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
                      borderRadius: "6px",
                    }}
                    title={isHi ? "सभी फ़िल्टर रीसेट करें" : "Reset all filters"}
                  >
                    <RotateCcw size={12} />
                    <span>{isHi ? "फ़िल्टर रीसेट" : "Reset Filters"}</span>
                  </button>
                )}
              </div>

              {/* Row 2: Status Filter, Doctor Filter, Search Box, Excel, Refresh */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: 1 }}>
                  {/* Status Dropdown */}
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <select
                      value={visitStatusFilter}
                      onChange={(e) => {
                        setVisitStatusFilter(e.target.value);
                        setVisitPage(1);
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
                      <option value="completed">{isHi ? "केवल पूर्ण (Completed)" : "Completed"}</option>
                      <option value="in_progress">{isHi ? "प्रगति में (In Progress)" : "In Progress"}</option>
                      <option value="pending">{isHi ? "प्रतीक्षारत (Pending)" : "Pending"}</option>
                      <option value="cancelled">{isHi ? "रद्द (Cancelled)" : "Cancelled"}</option>
                    </select>
                  </div>

                  {/* Doctor Dropdown */}
                  {availableDoctors.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <select
                        value={visitDoctorFilter}
                        onChange={(e) => {
                          setVisitDoctorFilter(e.target.value);
                          setVisitPage(1);
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
                        <option value="all">{isHi ? "सभी डॉक्टर (All Doctors)" : "All Doctors"}</option>
                        {availableDoctors.map((doc) => (
                          <option key={doc} value={doc}>
                            {doc}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Search Box */}
                  <div style={{ position: "relative", minWidth: "220px", flex: 1, maxWidth: "340px" }}>
                    <Search size={13} color={mutedText} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      placeholder={isHi ? "मरीज़, टोकन, फ़ोन, डॉक्टर..." : "Search patient, token, phone, doctor..."}
                      value={visitSearchQuery}
                      onChange={(e) => {
                        setVisitSearchQuery(e.target.value);
                        setVisitPage(1);
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
                    {visitSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setVisitSearchQuery("");
                          setVisitPage(1);
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
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Excel & Refresh Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {/* Export to Excel */}
                  <button
                    type="button"
                    onClick={handleExportVisitsExcel}
                    style={{
                      background: isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
                      border: isDark ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid #A7F3D0",
                      color: "#10B981",
                      borderRadius: "9px",
                      padding: "7px 12px",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                    title={isHi ? "फ़िल्टर किए गए रिकॉर्ड्स एक्सेल में डाउनलोड करें" : "Download filtered records to Excel"}
                  >
                    <Download size={13} />
                    <span>{isHi ? "एक्सेल" : "Excel"}</span>
                  </button>

                  {/* Refresh */}
                  <button
                    type="button"
                    onClick={fetchPatientVisits}
                    disabled={loadingVisits}
                    style={{
                      background: isDark ? "#1E293B" : "#FFFFFF",
                      border: cardBorder,
                      color: textColor,
                      borderRadius: "9px",
                      padding: "7px 12px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: loadingVisits ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                    title="Reload patient visit history"
                  >
                    <RefreshCw size={12} className={loadingVisits ? "spin-icon" : ""} />
                    <span>{isHi ? "रिफ्रेश" : "Refresh"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Error State with Retry Button */}
            {visitsError && !loadingVisits ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "44px 20px",
                  background: isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2",
                  borderRadius: "14px",
                  border: isDark ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid #FECACA",
                  color: textColor,
                  margin: "10px 0",
                }}
              >
                {visitsError.type === "permission" ? (
                  <ShieldAlert size={38} color="#EF4444" style={{ margin: "0 auto 12px auto", display: "block" }} />
                ) : (
                  <AlertTriangle size={38} color="#EF4444" style={{ margin: "0 auto 12px auto", display: "block" }} />
                )}
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#EF4444" }}>
                  {visitsError.type === "permission"
                    ? (isHi ? "पहुंच अस्वीकृत (Permission Denied - 403)" : "Permission Denied (403 Forbidden)")
                    : (isHi ? "विज़िट इतिहास लोड करने में त्रुटि" : "Failed to Load Visit History")}
                </div>
                <div style={{ fontSize: "13px", marginTop: "8px", maxWidth: "480px", margin: "8px auto 0 auto", color: mutedText, lineHeight: "1.5" }}>
                  {visitsError.message}
                </div>
                <div style={{ marginTop: "18px" }}>
                  <button
                    type="button"
                    onClick={fetchPatientVisits}
                    style={{
                      background: "#0284C7",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 18px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>{isHi ? "पुनः प्रयास करें" : "Retry"}</span>
                  </button>
                </div>
              </div>
            ) : loadingVisits && patientVisits.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: mutedText }}>
                <RefreshCw size={26} className="spin-icon" style={{ margin: "0 auto 12px auto", display: "block", color: "#0284C7" }} />
                <div style={{ fontSize: "14px", fontWeight: 700 }}>
                  {isHi ? "मरीज़ विज़िट इतिहास लोड हो रहा है..." : "Loading patient visit history..."}
                </div>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: mutedText, background: isDark ? "#0B1120" : "#F8FAFC", borderRadius: "14px", border: cardBorder }}>
                <History size={36} color={mutedText} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
                {visitDateFilter !== "all" && dateCounts.all > 0 && !visitSearchQuery ? (
                  <>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: textColor }}>
                      {isHi ? "इस तिथि के लिए कोई विज़िट नहीं" : "No visits for this date"}
                    </div>
                    <div style={{ fontSize: "12.5px", marginTop: "6px", maxWidth: "480px", margin: "6px auto 0 auto", lineHeight: "1.5", color: mutedText }}>
                      {isHi
                        ? `चयनित तिथि पर कोई विज़िट नहीं मिली। सभी तिथियों में कुल ${dateCounts.all} विज़िट उपलब्ध हैं।`
                        : `No visits found for this selected date. There are ${dateCounts.all} visit(s) across all dates.`}
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <button
                        type="button"
                        onClick={() => setVisitDateFilter("all")}
                        style={{
                          background: "#0284C7",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 18px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                        }}
                      >
                        <Calendar size={13} />
                        <span>{isHi ? `सभी तिथियां देखें (${dateCounts.all})` : `Show all dates (${dateCounts.all})`}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: textColor }}>
                      {isHi ? "कोई विज़िट रिकॉर्ड नहीं मिला" : "No consultation records found"}
                    </div>
                    <div style={{ fontSize: "12px", marginTop: "6px", maxWidth: "460px", margin: "6px auto 0 auto", lineHeight: "1.5" }}>
                      {visitSearchQuery
                        ? (isHi ? `'${visitSearchQuery}' से मेल खाता कोई रिकॉर्ड नहीं मिला।` : `No records match search '${visitSearchQuery}'.`)
                        : (isHi ? "इस फ़िल्टर या अस्पताल के लिए कोई फार्मेसी विज़िट रिकॉर्ड नहीं है।" : "No pharmacy visit records found under this filter or hospital.")}
                    </div>
                    {visitDateFilter !== "all" && dateCounts.all > 0 && (
                      <div style={{ marginTop: "14px" }}>
                        <button
                          type="button"
                          onClick={() => setVisitDateFilter("all")}
                          style={{
                            background: "#0284C7",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "8px",
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Calendar size={13} />
                          <span>{isHi ? `सभी तिथियां देखें (${dateCounts.all})` : `Show all dates (${dateCounts.all})`}</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div>
                <style>{`
                  .pharmacy-visit-row {
                    transition: background-color 0.15s ease;
                  }
                  .pharmacy-visit-row:hover {
                    background-color: ${isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC"} !important;
                  }
                `}</style>
                <div style={{ overflowX: "auto", borderRadius: "14px", border: cardBorder, background: cardBg, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <table style={{ width: "100%", minWidth: "1050px", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: isDark ? "#0F172A" : "#F8FAFC", borderBottom: cardBorder, position: "sticky", top: 0, zIndex: 5 }}>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "160px" }}>
                          {isHi ? "टोकन व समय" : "Token & Date/Time"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "170px" }}>
                          {isHi ? "मरीज़ विवरण" : "Patient"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "180px" }}>
                          {isHi ? "ट्रांसफर मार्ग व अवधि" : "Care Pathway & Duration"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "220px" }}>
                          {isHi ? "डॉक्टर व रोग निदान" : "Doctor & Diagnosis"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "190px" }}>
                          {isHi ? "दवा वितरण ऑडिट" : "Dispensed By"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "right", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "250px" }}>
                          {isHi ? "स्थिति व कार्य" : "Status & Actions"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedVisits.map((visit, vIdx) => {
                        const details = parseVisitDetails(visit);

                        return (
                          <tr
                            key={visit.id || visit.ticket_id || vIdx}
                            className="pharmacy-visit-row"
                            style={{
                              borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9",
                              height: "78px",
                              minHeight: "78px",
                              background: vIdx % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.012)" : "rgba(0,0,0,0.01)"),
                            }}
                          >
                            {/* 1. Token & Date/Time */}
                            <td style={{ padding: "16px 20px", verticalAlign: "middle" }}>
                              <TokenDateTimeCell visit={visit} isDark={isDark} mutedText={mutedText} />
                            </td>

                            {/* 2. Patient Info */}
                            <td style={{ padding: "16px 20px", verticalAlign: "middle" }}>
                              <PatientCell visit={visit} textColor={textColor} mutedText={mutedText} />
                            </td>

                            {/* 3. Care Pathway & Duration */}
                            <td style={{ padding: "16px 20px", verticalAlign: "middle" }}>
                              <CarePathwayCell visit={visit} isDark={isDark} textColor={textColor} mutedText={mutedText} />
                            </td>

                            {/* 4. Doctor & Diagnosis */}
                            <td style={{ padding: "16px 20px", verticalAlign: "middle" }}>
                              <DoctorDiagnosisCell details={details} isDark={isDark} textColor={textColor} mutedText={mutedText} />
                            </td>

                            {/* 5. Dispensed By */}
                            <td style={{ padding: "16px 20px", verticalAlign: "middle" }}>
                              <DispensedByCell details={details} textColor={textColor} mutedText={mutedText} />
                            </td>

                            {/* 6. Status & Actions */}
                            <td style={{ padding: "16px 20px", verticalAlign: "middle", textAlign: "right" }}>
                              <StatusActionCell
                                visit={visit}
                                isDark={isDark}
                                textColor={textColor}
                                isHi={isHi}
                                cardBorder={cardBorder}
                                onOpenDetails={setSelectedVisitModal}
                                onPrintRx={handlePrintVisitPrescription}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls Bar */}
                {filteredVisits.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "16px",
                      padding: "12px 18px",
                      borderRadius: "12px",
                      background: isDark ? "#0B1120" : "#F8FAFC",
                      border: cardBorder,
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    {/* Record count info */}
                    <div style={{ fontSize: "12px", color: mutedText, fontWeight: 600 }}>
                      {isHi ? (
                        <span>
                          कुल <strong>{filteredVisits.length}</strong> में से <strong>{Math.min((currentPage - 1) * visitRowsPerPage + 1, filteredVisits.length)}</strong> - <strong>{Math.min(currentPage * visitRowsPerPage, filteredVisits.length)}</strong> रिकॉर्ड प्रदर्शित
                        </span>
                      ) : (
                        <span>
                          Showing <strong>{Math.min((currentPage - 1) * visitRowsPerPage + 1, filteredVisits.length)}</strong> - <strong>{Math.min(currentPage * visitRowsPerPage, filteredVisits.length)}</strong> of <strong>{filteredVisits.length}</strong> records
                        </span>
                      )}
                    </div>

                    {/* Rows per page & Navigation */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                      {/* Rows per page selector */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11.5px", color: mutedText, fontWeight: 700 }}>
                          {isHi ? "प्रति पृष्ठ:" : "Rows per page:"}
                        </span>
                        <select
                          value={visitRowsPerPage}
                          onChange={(e) => {
                            setVisitRowsPerPage(Number(e.target.value));
                            setVisitPage(1);
                          }}
                          style={{
                            padding: "5px 8px",
                            borderRadius: "7px",
                            border: cardBorder,
                            background: isDark ? "#1E293B" : "#FFFFFF",
                            color: textColor,
                            fontSize: "11.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      {/* Page navigation controls */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setVisitPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: cardBorder,
                            background: isDark ? "#1E293B" : "#FFFFFF",
                            color: currentPage <= 1 ? mutedText : textColor,
                            opacity: currentPage <= 1 ? 0.45 : 1,
                            cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            transition: "all 0.15s ease",
                          }}
                          title={isHi ? "पिछला पृष्ठ" : "Previous page"}
                        >
                          <ChevronLeft size={13} />
                          <span>{isHi ? "पिछला" : "Prev"}</span>
                        </button>

                        {/* Page numbers */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => {
                              return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
                            })
                            .map((p, idx, arr) => {
                              const prev = arr[idx - 1];
                              const showEllipsis = prev && p - prev > 1;

                              return (
                                <React.Fragment key={p}>
                                  {showEllipsis && (
                                    <span style={{ padding: "0 4px", color: mutedText, fontSize: "11px" }}>…</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setVisitPage(p)}
                                    style={{
                                      minWidth: "28px",
                                      height: "28px",
                                      padding: "0 6px",
                                      borderRadius: "6px",
                                      border: p === currentPage ? "none" : cardBorder,
                                      background: p === currentPage ? "#0284C7" : (isDark ? "#1E293B" : "#FFFFFF"),
                                      color: p === currentPage ? "#FFFFFF" : textColor,
                                      fontSize: "11.5px",
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    {p}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                        </div>

                        <button
                          type="button"
                          onClick={() => setVisitPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: cardBorder,
                            background: isDark ? "#1E293B" : "#FFFFFF",
                            color: currentPage >= totalPages ? mutedText : textColor,
                            opacity: currentPage >= totalPages ? 0.45 : 1,
                            cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            transition: "all 0.15s ease",
                          }}
                          title={isHi ? "अगला पृष्ठ" : "Next page"}
                        >
                          <span>{isHi ? "अगला" : "Next"}</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Patient Visit Dossier Modal */}
      {selectedVisitModal && (
        (() => {
          const visit = selectedVisitModal;
          const details = parseVisitDetails(visit);
          const rawStatus = String(visit.status || "").trim().toLowerCase();
          const isCompleted = rawStatus === "completed";
          const isInProgress = rawStatus === "in_progress" || rawStatus === "serving";
          const canEdit = isInProgress && !isCompleted;
          return (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 99999,
                padding: "20px",
              }}
              onClick={() => setSelectedVisitModal(null)}
            >
              <div
                style={{
                  background: cardBg,
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.18)" : "1px solid #CBD5E1",
                  borderRadius: "20px",
                  maxWidth: "760px",
                  width: "100%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  padding: "26px",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                  color: textColor,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: cardBorder, paddingBottom: "16px", marginBottom: "18px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: "#0284C7", padding: "3px 10px", borderRadius: "8px", fontSize: "13px", fontWeight: 900, fontFamily: "monospace" }}>
                        Token #{visit.token_number || visit.ticket_id}
                      </span>
                      <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900 }}>
                        {visit.patient_name}
                      </h2>
                      <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", background: (visit.status || "").toLowerCase() === "completed" ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5") : (isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7"), color: (visit.status || "").toLowerCase() === "completed" ? "#10B981" : "#D97706" }}>
                        {(visit.status || "VISIT").toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: mutedText, marginTop: "6px" }}>
                      {visit.age ? `${visit.age} years old` : ""} {visit.gender ? `• ${visit.gender}` : ""} {visit.phone ? `• Phone: ${visit.phone}` : ""} • Date: {visit.queue_date || (visit.created_at ? new Date(visit.created_at).toLocaleDateString() : "Today")}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedVisitModal(null)}
                    style={{
                      background: isDark ? "#1E293B" : "#F1F5F9",
                      border: "none",
                      borderRadius: "10px",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: mutedText,
                      fontWeight: "bold",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Clinical Overview Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "18px" }}>
                  <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", border: cardBorder, borderRadius: "12px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
                      {isHi ? "परामर्श चिकित्सक" : "Attending Doctor"}
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 800, color: textColor, marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <User size={13} color="#0284C7" />
                      <span>{details.doctorName}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                      {visit.origin_department || "Consultation OPD"}
                    </div>
                  </div>

                  <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", border: cardBorder, borderRadius: "12px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
                      {isHi ? "चिकित्सीय निदान (डायग्नोसिस)" : "Clinical Diagnosis"}
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#0284C7", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Stethoscope size={13} color="#0284C7" />
                      <span>{details.diagnosis}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                      {visit.medical_condition || "OPD Case"}
                    </div>
                  </div>

                  <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", border: cardBorder, borderRadius: "12px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
                      {isHi ? "दवा वितरण सत्यापन" : "Dispensation Audit"}
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#10B981", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={13} color="#10B981" />
                      <span>{details.dispensedBy}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Building2 size={11} color={mutedText} />
                      <span>{details.dispensedCounter}</span>
                    </div>
                  </div>
                </div>

                {/* Transfer Pathway Timeline if available */}
                {Array.isArray(visit.transfer_stages) && visit.transfer_stages.length > 1 && (
                  <div style={{ marginBottom: "18px", padding: "12px 16px", borderRadius: "12px", background: isDark ? "rgba(2, 132, 199, 0.12)" : "#F0F9FF", border: isDark ? "1px solid rgba(2, 132, 199, 0.25)" : "1px solid #BAE6FD" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", marginBottom: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <RefreshCw size={12} />
                      <span>{isHi ? "मरीज़ ट्रांसफर मार्ग" : "Multi-Stage Care Pathway"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px", fontWeight: 700 }}>
                      {visit.transfer_stages.map((stg, stgIdx) => (
                        <React.Fragment key={stgIdx}>
                          <span style={{ background: isDark ? "#0F172A" : "#FFFFFF", border: cardBorder, padding: "3px 10px", borderRadius: "6px" }}>
                            Stage {stgIdx + 1}: {stg.department} ({stg.status})
                          </span>
                          {stgIdx < visit.transfer_stages.length - 1 && <ArrowRight size={11} color={mutedText} />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prescribed Medicines Section */}
                <div style={{ marginBottom: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}>
                      <Pill size={14} color="#0284C7" />
                      <span>{isHi ? "निर्धारित दवाएं व खुराक अनुसूची" : "Prescribed Medications & Dosage Schedule"}</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: "#0284C7", padding: "1px 6px", borderRadius: "4px" }}>
                        {details.medicines.length}
                      </span>

                      {/* Dispensation Summary Badges */}
                      {details.medicines.length > 0 && (
                        <div style={{ display: "inline-flex", gap: "5px", marginLeft: "6px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 800,
                              color: "#059669",
                              background: isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
                              border: "1px solid #A7F3D0",
                              padding: "1px 8px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <CheckCircle2 size={11} color="#059669" />
                            <span>{modalStats.given} {isHi ? "दी गईं" : "Given"}</span>
                          </span>
                          {modalStats.notGiven > 0 && (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 800,
                                color: "#DC2626",
                                background: isDark ? "rgba(239, 68, 68, 0.18)" : "#FEF2F2",
                                border: "1px solid #FECACA",
                                padding: "1px 8px",
                                borderRadius: "6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <XCircle size={11} color="#DC2626" />
                              <span>{modalStats.notGiven} {isHi ? "नहीं दी गईं" : "Not Given"}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Mark All Controls (Editable ONLY when consultation is IN PROGRESS) */}
                    {details.medicines.length > 0 && canEdit && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => handleSetAllModalMeds(true)}
                          style={{
                            background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                            border: "1px solid #10B981",
                            color: "#059669",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                          title={isHi ? "सभी दवाओं को 'दी गई' चिह्नित करें" : "Mark all medications as Given"}
                        >
                          {isHi ? "सभी दी गईं" : "Mark All Given"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllModalMeds(false)}
                          style={{
                            background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                            border: "1px solid #EF4444",
                            color: "#DC2626",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                          title={isHi ? "सभी दवाओं को 'नहीं दी गई' चिह्नित करें" : "Mark all medications as Not Given"}
                        >
                          {isHi ? "सभी नहीं दी गईं" : "Mark All Not Given"}
                        </button>
                        {modalHasChanges && (
                          <button
                            type="button"
                            disabled={savingModalDispense}
                            onClick={handleSaveModalDispenseChanges}
                            style={{
                              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                              border: "none",
                              color: "#FFFFFF",
                              fontSize: "11px",
                              fontWeight: 800,
                              padding: "4px 10px",
                              borderRadius: "6px",
                              cursor: savingModalDispense ? "wait" : "pointer",
                              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Save size={12} />
                            <span>{savingModalDispense ? (isHi ? "सहेजा जा रहा है..." : "Saving...") : (isHi ? "सहेजें" : "Save Changes")}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {details.medicines.length > 0 ? (
                    <div style={{ border: cardBorder, borderRadius: "12px", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ background: isDark ? "#1E293B" : "#F1F5F9", borderBottom: cardBorder }}>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>#</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>MEDICINE NAME</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>DOSAGE</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>FREQUENCY</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>DURATION</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>INSTRUCTIONS</th>
                            <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, color: mutedText }}>DISPENSING STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.medicines.map((m, mIdx) => {
                            const isGiven = modalMedStatusMap[mIdx] !== undefined
                              ? modalMedStatusMap[mIdx]
                              : getMedicineDispenseStatus(m, visit).isGiven;

                            return (
                              <tr key={mIdx} style={{ borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9" }}>
                                <td style={{ padding: "8px 12px", fontWeight: 700, color: mutedText }}>{mIdx + 1}</td>
                                <td style={{ padding: "8px 12px", fontWeight: 800, color: textColor }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <Pill size={12} color={isGiven ? "#10B981" : "#EF4444"} />
                                    <span>{m.name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: "8px 12px", color: textColor }}>{m.dosage || "-"}</td>
                                <td style={{ padding: "8px 12px", fontWeight: 700, color: "#0284C7" }}>{m.frequency || "-"}</td>
                                <td style={{ padding: "8px 12px", color: textColor }}>{m.duration || "-"}</td>
                                <td style={{ padding: "8px 12px", color: mutedText }}>{m.instructions || "-"}</td>
                                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleModalMedStatus(mIdx)}
                                      title={isHi ? "स्थिति बदलने के लिए क्लिक करें (दी गई / नहीं दी गई)" : "Click to toggle Given / Not Given"}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        padding: "4px 10px",
                                        borderRadius: "7px",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        border: isGiven ? "1.5px solid #10B981" : "1.5px solid #EF4444",
                                        background: isGiven
                                          ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5")
                                          : (isDark ? "rgba(239, 68, 68, 0.2)" : "#FEF2F2"),
                                        color: isGiven ? "#059669" : "#DC2626",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                                        transition: "all 0.15s ease",
                                      }}
                                    >
                                      {isGiven ? <CheckCircle2 size={13} color="#10B981" /> : <XCircle size={13} color="#EF4444" />}
                                      <span>{isGiven ? (isHi ? "दी गई" : "Given") : (isHi ? "नहीं दी गई" : "Not Given")}</span>
                                    </button>
                                  ) : (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        color: isGiven ? (isDark ? "#34D399" : "#059669") : (isDark ? "#F87171" : "#DC2626"),
                                        userSelect: "none",
                                      }}
                                      title={isCompleted ? (isHi ? "परामर्श पूर्ण - स्थिति लॉक है" : "Consultation is completed. Status cannot be modified.") : ""}
                                    >
                                      {isGiven ? <CheckCircle2 size={13} color={isDark ? "#34D399" : "#059669"} /> : <XCircle size={13} color={isDark ? "#F87171" : "#DC2626"} />}
                                      <span>{isGiven ? (isHi ? "दी गई" : "Given") : (isHi ? "नहीं दी गई" : "Not Given")}</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: "14px", borderRadius: "10px", background: isDark ? "#1E293B" : "#F8FAFC", border: cardBorder, fontSize: "12px", color: mutedText, fontStyle: "italic" }}>
                      {isHi ? "इस विज़िट के लिए कोई दवा प्रविष्टि दर्ज नहीं है।" : "No specific medication items recorded for this visit."}
                    </div>
                  )}
                </div>

                {/* Doctor Advice & Follow-up */}
                {(details.advice || details.followUp) && (
                  <div style={{ marginBottom: "20px", display: "grid", gridTemplateColumns: details.advice && details.followUp ? "1fr 1fr" : "1fr", gap: "12px" }}>
                    {details.advice && (
                      <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#F8FAFC", border: cardBorder }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
                          <FileText size={12} />
                          <span>{isHi ? "चिकित्सक सलाह" : "Doctor Advice"}</span>
                        </div>
                        <div style={{ fontSize: "12px", color: textColor, marginTop: "4px" }}>
                          {details.advice}
                        </div>
                      </div>
                    )}
                    {details.followUp && (
                      <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#F8FAFC", border: cardBorder }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
                          <Calendar size={12} />
                          <span>{isHi ? "फॉलो-अप परामर्श" : "Follow-up Consultation"}</span>
                        </div>
                        <div style={{ fontSize: "12px", color: textColor, marginTop: "4px" }}>
                          {details.followUp}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", paddingTop: "14px", borderTop: cardBorder }}>
                  <div>
                    {modalHasChanges && canEdit && (
                      <button
                        type="button"
                        disabled={savingModalDispense}
                        onClick={handleSaveModalDispenseChanges}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "10px",
                          border: "none",
                          background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: savingModalDispense ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 10px rgba(16, 185, 129, 0.4)",
                        }}
                      >
                        <Save size={13} />
                        <span>{savingModalDispense ? (isHi ? "सहेजा जा रहा है..." : "Saving Changes...") : (isHi ? "वितरण बदलाव सहेजें" : "Save Dispensation Status")}</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => handlePrintVisitPrescription(visit)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                        color: "#FFFFFF",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 8px rgba(2, 132, 199, 0.35)",
                      }}
                    >
                      <Printer size={13} />
                      <span>{isHi ? "डॉक्टर पर्चा प्रिंट करें" : "Print Full Prescription"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedVisitModal(null)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        border: cardBorder,
                        background: isDark ? "#0F172A" : "#FFFFFF",
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
            </div>
          );
        })()
      )}

      {/* Footer Branding with Compact Margin */}
      <div style={{ marginTop: "10px" }}>
        <Footer
          branding={hospitalBranding}
          hospitalName={brandName}
          language={language}
          currentUser={currentUser}
          onShowEmergency={() => { }}
        />
      </div>
    </div>
  );
}
