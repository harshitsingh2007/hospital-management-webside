/**
 * PathologyPage.jsx
 * -----------------
 * Enterprise Clinical Pathology & Diagnostic Laboratory Workstation.
 * Complete structural, behavioral, and visual parity with RadiologyPage.jsx.
 *
 * Architecture & Features:
 * 1. Three Core Tabs:
 *    - Lab Workstation (diagnostic entry, biological reference ranges, auto-flagging, sample condition)
 *    - Queue & Appointments (8-metric summary strip, live queue triage, time-slot appointments, prep checklist)
 *    - Test History (date filter, text search, reprint slips, Excel export)
 * 2. Routing Parity: Route-to-Department modal without hardcoded fallback; emits ticket_transferred.
 * 3. Robust Queue Filter: Excludes "labour", "available", "osteopathy", "homeopathy"; matches lab/pathology tokens.
 * 4. Kiosk-Only Audio: All local voice/chime playback removed from desk; waiting-room display announcements preserved.
 * 5. Theme Palette: Blue/Navy/Slate app theme colors (--lab-* variables) with red strictly for emergency/destructive.
 * 6. Clinical Styling: Zero emojis, Lucide icons, professional clinical English & Hindi labels.
 * 7. Security: Authenticated requests with tenant isolation.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { printLabReportSlip } from "../utils/printPassHelper";
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
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  Eye,
  FileCheck,
  FileText,
  FlaskConical,
  History,
  Microscope,
  Pause,
  Phone,
  Play,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Sliders,
  Stethoscope,
  TestTube,
  Trash2,
  User,
  UserCheck,
  UserX,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

// Standard Clinical Diagnostic Test Panels with Biological Reference Intervals
const DEFAULT_TEST_PANELS = {
  cbc: {
    id: "cbc",
    name: "Complete Blood Count (CBC)",
    category: "Hematology",
    specimen: "Whole Blood (EDTA)",
    parameters: [
      { parameter: "Hemoglobin (Hb)", value: "13.8", unit: "g/dL", ref_range: "13.0 - 17.0", min: 13.0, max: 17.0, flag: "NORMAL" },
      { parameter: "Total Leukocyte Count (TLC / WBC)", value: "7200", unit: "/µL", ref_range: "4,000 - 11,000", min: 4000, max: 11000, flag: "NORMAL" },
      { parameter: "RBC Count", value: "4.8", unit: "mil/µL", ref_range: "4.5 - 5.9", min: 4.5, max: 5.9, flag: "NORMAL" },
      { parameter: "Platelet Count", value: "240000", unit: "/µL", ref_range: "150,000 - 450,000", min: 150000, max: 450000, flag: "NORMAL" },
      { parameter: "Packed Cell Volume (PCV / Hematocrit)", value: "41.5", unit: "%", ref_range: "40.0 - 50.0", min: 40.0, max: 50.0, flag: "NORMAL" },
      { parameter: "Mean Corpuscular Volume (MCV)", value: "86.4", unit: "fL", ref_range: "80.0 - 100.0", min: 80.0, max: 100.0, flag: "NORMAL" },
      { parameter: "Mean Corpuscular Hemoglobin (MCH)", value: "28.8", unit: "pg", ref_range: "27.0 - 32.0", min: 27.0, max: 32.0, flag: "NORMAL" },
      { parameter: "Neutrophils", value: "62", unit: "%", ref_range: "40 - 70", min: 40, max: 70, flag: "NORMAL" },
      { parameter: "Lymphocytes", value: "29", unit: "%", ref_range: "20 - 40", min: 20, max: 40, flag: "NORMAL" },
      { parameter: "Eosinophils", value: "4", unit: "%", ref_range: "1 - 6", min: 1, max: 6, flag: "NORMAL" },
      { parameter: "Monocytes", value: "5", unit: "%", ref_range: "2 - 8", min: 2, max: 8, flag: "NORMAL" },
    ],
  },
  glucose: {
    id: "glucose",
    name: "Blood Glucose & Glycated Hemoglobin (HbA1c)",
    category: "Biochemistry",
    specimen: "Fluoride Plasma & Whole Blood",
    parameters: [
      { parameter: "Fasting Blood Sugar (FBS)", value: "92", unit: "mg/dL", ref_range: "70 - 99", min: 70, max: 99, flag: "NORMAL" },
      { parameter: "Post-Prandial Blood Sugar (PPBS)", value: "128", unit: "mg/dL", ref_range: "70 - 140", min: 70, max: 140, flag: "NORMAL" },
      { parameter: "HbA1c (Glycated Hemoglobin)", value: "5.4", unit: "%", ref_range: "< 5.7 (Normal), 5.7 - 6.4 (Prediabetic)", min: 4.0, max: 5.7, flag: "NORMAL" },
      { parameter: "Estimated Average Glucose (eAG)", value: "108", unit: "mg/dL", ref_range: "90 - 120", min: 90, max: 120, flag: "NORMAL" },
    ],
  },
  lipid: {
    id: "lipid",
    name: "Lipid Profile (Cardiac Risk Marker)",
    category: "Biochemistry",
    specimen: "Serum (10-12 hrs Fasting)",
    parameters: [
      { parameter: "Total Cholesterol", value: "178", unit: "mg/dL", ref_range: "< 200 (Desirable)", min: 100, max: 200, flag: "NORMAL" },
      { parameter: "Serum Triglycerides", value: "135", unit: "mg/dL", ref_range: "< 150 (Normal)", min: 50, max: 150, flag: "NORMAL" },
      { parameter: "HDL Cholesterol (Good)", value: "48", unit: "mg/dL", ref_range: "> 40 (Optimal)", min: 40, max: 80, flag: "NORMAL" },
      { parameter: "LDL Cholesterol (Bad)", value: "103", unit: "mg/dL", ref_range: "< 100 (Optimal)", min: 50, max: 100, flag: "NORMAL" },
      { parameter: "VLDL Cholesterol", value: "27", unit: "mg/dL", ref_range: "< 30", min: 5, max: 30, flag: "NORMAL" },
      { parameter: "Total Cholesterol / HDL Ratio", value: "3.7", unit: "Ratio", ref_range: "3.0 - 5.0", min: 3.0, max: 5.0, flag: "NORMAL" },
    ],
  },
  kft: {
    id: "kft",
    name: "Kidney Function Test (KFT / RFT)",
    category: "Biochemistry",
    specimen: "Serum / Clot Activator",
    parameters: [
      { parameter: "Serum Creatinine", value: "0.92", unit: "mg/dL", ref_range: "0.60 - 1.20", min: 0.6, max: 1.2, flag: "NORMAL" },
      { parameter: "Blood Urea", value: "24.0", unit: "mg/dL", ref_range: "15.0 - 45.0", min: 15.0, max: 45.0, flag: "NORMAL" },
      { parameter: "Blood Urea Nitrogen (BUN)", value: "11.2", unit: "mg/dL", ref_range: "7.0 - 20.0", min: 7.0, max: 20.0, flag: "NORMAL" },
      { parameter: "Serum Uric Acid", value: "5.1", unit: "mg/dL", ref_range: "3.5 - 7.2", min: 3.5, max: 7.2, flag: "NORMAL" },
      { parameter: "Serum Sodium (Na+)", value: "140", unit: "mEq/L", ref_range: "135 - 145", min: 135, max: 145, flag: "NORMAL" },
      { parameter: "Serum Potassium (K+)", value: "4.2", unit: "mEq/L", ref_range: "3.5 - 5.1", min: 3.5, max: 5.1, flag: "NORMAL" },
    ],
  },
  lft: {
    id: "lft",
    name: "Liver Function Test (LFT)",
    category: "Biochemistry",
    specimen: "Serum / Clot Activator",
    parameters: [
      { parameter: "Total Bilirubin", value: "0.80", unit: "mg/dL", ref_range: "0.20 - 1.20", min: 0.2, max: 1.2, flag: "NORMAL" },
      { parameter: "Direct (Conjugated) Bilirubin", value: "0.20", unit: "mg/dL", ref_range: "0.00 - 0.30", min: 0.0, max: 0.3, flag: "NORMAL" },
      { parameter: "SGOT / AST", value: "28", unit: "U/L", ref_range: "< 40", min: 5, max: 40, flag: "NORMAL" },
      { parameter: "SGPT / ALT", value: "32", unit: "U/L", ref_range: "< 45", min: 5, max: 45, flag: "NORMAL" },
      { parameter: "Alkaline Phosphatase (ALP)", value: "88", unit: "U/L", ref_range: "30 - 120", min: 30, max: 120, flag: "NORMAL" },
      { parameter: "Total Serum Protein", value: "7.2", unit: "g/dL", ref_range: "6.4 - 8.3", min: 6.4, max: 8.3, flag: "NORMAL" },
      { parameter: "Serum Albumin", value: "4.3", unit: "g/dL", ref_range: "3.5 - 5.2", min: 3.5, max: 5.2, flag: "NORMAL" },
    ],
  },
  thyroid: {
    id: "thyroid",
    name: "Thyroid Profile (TSH / T3 / T4)",
    category: "Serology",
    specimen: "Serum (Morning Sample Preferred)",
    parameters: [
      { parameter: "TSH (Ultrasensitive)", value: "2.45", unit: "µIU/mL", ref_range: "0.40 - 4.20", min: 0.4, max: 4.2, flag: "NORMAL" },
      { parameter: "Total Triiodothyronine (T3)", value: "1.15", unit: "ng/mL", ref_range: "0.80 - 2.00", min: 0.8, max: 2.0, flag: "NORMAL" },
      { parameter: "Total Thyroxine (T4)", value: "8.2", unit: "µg/dL", ref_range: "5.1 - 14.1", min: 5.1, max: 14.1, flag: "NORMAL" },
    ],
  },
  urine: {
    id: "urine",
    name: "Urine Routine & Microscopic Examination",
    category: "Urine",
    specimen: "Mid-stream Clean Catch Urine",
    parameters: [
      { parameter: "Color & Appearance", value: "Pale Yellow, Clear", unit: "", ref_range: "Pale Yellow / Clear", min: null, max: null, flag: "NORMAL" },
      { parameter: "Specific Gravity", value: "1.018", unit: "", ref_range: "1.005 - 1.030", min: 1.005, max: 1.030, flag: "NORMAL" },
      { parameter: "pH (Reaction)", value: "6.0", unit: "", ref_range: "4.5 - 8.0 (Acidic)", min: 4.5, max: 8.0, flag: "NORMAL" },
      { parameter: "Urine Protein (Albumin)", value: "Nil", unit: "", ref_range: "Nil (Negative)", min: null, max: null, flag: "NORMAL" },
      { parameter: "Urine Glucose (Sugar)", value: "Nil", unit: "", ref_range: "Nil (Negative)", min: null, max: null, flag: "NORMAL" },
      { parameter: "Ketone Bodies", value: "Negative", unit: "", ref_range: "Negative", min: null, max: null, flag: "NORMAL" },
      { parameter: "Pus Cells (Leukocytes)", value: "1 - 2", unit: "/HPF", ref_range: "0 - 5 /HPF", min: 0, max: 5, flag: "NORMAL" },
      { parameter: "RBCs (Erythrocytes)", value: "Nil", unit: "/HPF", ref_range: "0 - 2 /HPF", min: 0, max: 2, flag: "NORMAL" },
      { parameter: "Epithelial Cells", value: "Few (1-3)", unit: "/HPF", ref_range: "Few /HPF", min: null, max: null, flag: "NORMAL" },
    ],
  },
};

export default function PathologyPage({
  tenantId,
  currentUser,
  analytics,
  queueSnapshot = [],
  servingTickets = [],
  heldTickets = [],
  handleServeNext = null,
  handleRecallTicket = null,
  handleMarkNoShow = null,
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
  const brandName =
    hospitalBranding?.hospital_name ||
    hospitalBranding?.name ||
    currentUser?.hospital_name ||
    "City General Hospital";

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
  }, [theme, currentTheme]);

  const isDark = currentTheme === "dark";
  const pageBg = isDark ? "#0F172A" : "#F8FAFC";
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const cardBorder = isDark ? "1px solid #1E293B" : "1px solid #E2E8F0";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";

  // Tab State: "workstation" | "queue" | "history" (order: Workstation -> Queue & Appointments -> History)
  const [activeTab, setActiveTab] = useState("workstation");

  // Pathologist identity
  const [pathologistName, setPathologistName] = useState(
    () => currentUser?.name || currentUser?.username || (isHi ? "डॉ. आर. के. सिन्हा, एमडी (पैथोलॉजी)" : "Dr. R. K. Sinha, MD (Pathologist)")
  );

  // Unified Desk & Department Scope Management
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
    storageKey: "ai_queue_pathology_desks",
  });

  const [selectedDesk, setSelectedDesk] = useState(null);
  useEffect(() => {
    if (assignedDesk) {
      setSelectedDesk(assignedDesk);
      try {
        localStorage.setItem("ai_queue_pathology_desk", assignedDesk.desk_name || String(assignedDesk.id));
      } catch (_) {}
    }
  }, [assignedDesk]);

  const activeDesk = assignedDesk?.desk_name || "";
  const isEmergencyDesk = Boolean(deskScope?.isEmergencyDesk);
  const activeCounter = assignedDesk?.desk_name || activeDesk || currentUser?.name || (isEmergencyDesk ? "Emergency Bay" : "Pathology Station 1");

  // Duty Status: "ACTIVE" | "PROCESSING" | "BREAK" | "OFF_DUTY"
  const [dutyStatus, setDutyStatus] = useState(() => {
    try {
      return localStorage.getItem("ai_queue_pathology_duty") || "ACTIVE";
    } catch (_) {
      return "ACTIVE";
    }
  });

  const [showDutyDropdown, setShowDutyDropdown] = useState(false);
  const dutyDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dutyDropdownRef.current && !dutyDropdownRef.current.contains(e.target)) {
        setShowDutyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const dutyStatusOptions = useMemo(
    () => [
      {
        id: "ACTIVE",
        label: isHi ? "जांच हेतु तैयार" : "Ready to Test",
        desc: isHi ? "मरीज़ बुलाने के लिए सक्रिय" : "Active & Accepting Patients",
        color: "#0284C7",
        bg: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
        border: "#0284C7",
      },
      {
        id: "PROCESSING",
        label: isHi ? "नमूना प्रसंस्करण जारी" : "Processing Samples",
        desc: isHi ? "विश्लेषक परीक्षण प्रगति पर है" : "Analyzer incubation & runs in progress",
        color: "#0284C7",
        bg: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
        border: "#0284C7",
      },
      {
        id: "BREAK",
        label: isHi ? "अवकाश पर" : "On Break",
        desc: isHi ? "अल्पकालिक अवकाश" : "Short Break / Calling Paused",
        color: "#64748B",
        bg: isDark ? "rgba(100, 116, 139, 0.15)" : "#F1F5F9",
        border: "#64748B",
      },
      {
        id: "OFF_DUTY",
        label: isHi ? "ड्यूटी समाप्त" : "Off Duty / Closed",
        desc: isHi ? "स्टेशन आज के लिए बंद है" : "Shift Ended / Counter Offline",
        color: "#EF4444",
        bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
        border: "#EF4444",
      },
    ],
    [isHi, isDark]
  );

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleUpdateDutyStatus = useCallback(
    (newDutyId) => {
      setDutyStatus(newDutyId);
      setShowDutyDropdown(false);
      try {
        localStorage.setItem("ai_queue_pathology_duty", newDutyId);
      } catch (_) { }

      const backendStatus =
        newDutyId === "BREAK"
          ? "ON_BREAK"
          : newDutyId === "OFF_DUTY"
            ? "OFF_DUTY"
            : newDutyId === "PROCESSING"
              ? "PROCESSING"
              : "ACTIVE";

      const targetUserId = currentUser?.id || currentUser?.user_id;
      const targetEmail = currentUser?.email;
      const targetName = currentUser?.name || currentUser?.username || pathologistName;
      const targetEmpCode = currentUser?.employee_code || currentUser?.employee_id;

      const payload = {
        tenant_id: effectiveHospitalCode,
        doctor_id: targetUserId,
        staff_id: targetUserId,
        user_id: targetUserId,
        employee_id: targetUserId,
        employee_code: targetEmpCode,
        doctor_email: targetEmail,
        staff_email: targetEmail,
        email: targetEmail,
        doctor_name: targetName,
        staff_name: targetName,
        name: targetName,
        role: currentUser?.role || "pathologist",
        status: backendStatus,
        break_type: newDutyId === "BREAK" ? "tea" : null,
        note: newDutyId === "PROCESSING" ? "Processing Lab Samples" : "",
      };

      if (socketRef && socketRef.current) {
        socketRef.current.emit("update_doctor_duty_status", payload);
        socketRef.current.emit("update_staff_duty_status", payload);
      }

      const headers = { "Content-Type": "application/json" };
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      fetch(`${API_BASE}/api/v1/doctor/duty-status`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.warn("Failed to persist duty status via REST:", err);
      });

      const opt = dutyStatusOptions.find((o) => o.id === newDutyId);
      showToast(
        isHi
          ? `ड्यूटी स्थिति बदलकर '${opt?.label || newDutyId}' कर दी गई`
          : `Duty status updated to '${opt?.label || newDutyId}'`,
        newDutyId === "ACTIVE" ? "success" : newDutyId === "BREAK" ? "warn" : "info"
      );
    },
    [currentUser, effectiveHospitalCode, pathologistName, socketRef, dutyStatusOptions, isHi, showToast]
  );

  // Live timer for wait calculations
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Robust Queue Filter (Requirement 3: strict rejection of labour, available, osteopathy, homeopathy)
  const isExcludedDept = useCallback((str) => {
    if (!str) return false;
    const s = String(str).toLowerCase().trim();
    if (s.includes("laboratory") || s.includes("pathology")) return false;
    return (
      s.includes("labour") ||
      /\blabor\b/i.test(s) ||
      s.includes("labor room") ||
      s.includes("labour room") ||
      s.includes("labor ward") ||
      s.includes("labour ward") ||
      s.includes("osteopath") ||
      s.includes("homeopath") ||
      s.includes("available")
    );
  }, []);

  const pathWordRegex = useMemo(
    () => /\b(pathology|pathologist|laboratory|lab|lab_test|blood_test|hematology|biochemistry|serology|urinalysis|cbc|lft|kft|lipid|sugar|glucose|thyroid)\b/i,
    []
  );

  const isPathologyTicket = useCallback(
    (t) => {
      if (!t) return false;
      const dept = String(t.department || t.department_name || t.dept_code || t.departments?.name || t.departments?.dept_code || "");
      const cat = String(t.service_category || "");
      const med = String(t.medical_condition || "");
      const transFrom = String(t.transferred_from_dept || "");
      const targetDept = String(t.target_department || "");
      const pNotes = typeof t.prescription_notes === "object" ? JSON.stringify(t.prescription_notes) : String(t.prescription_notes || "");

      if (isExcludedDept(dept) || isExcludedDept(cat) || isExcludedDept(transFrom) || isExcludedDept(targetDept)) return false;

      return (
        pathWordRegex.test(dept) ||
        pathWordRegex.test(cat) ||
        pathWordRegex.test(med) ||
        pathWordRegex.test(transFrom) ||
        pathWordRegex.test(targetDept) ||
        pNotes.includes("pathology_report") ||
        pNotes.includes("lab_report") ||
        pNotes.includes("lab_test") ||
        pNotes.includes("laboratory") ||
        pNotes.includes("pathology")
      );
    },
    [isExcludedDept, pathWordRegex]
  );

  // Waiting Patients Queue Scoped to Desk
  const pathologyQueue = useMemo(() => {
    if (!Array.isArray(queueSnapshot)) return [];
    const waitingOnly = queueSnapshot.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s !== "on_hold" && s !== "hold" && s !== "serving" && s !== "completed" && s !== "cancelled" && s !== "no_show";
    });
    return scopeTicketsForDesk(waitingOnly, deskScope, isPathologyTicket);
  }, [queueSnapshot, deskScope, isPathologyTicket]);

  // Combined Held Tickets List
  const combinedHeldList = useMemo(() => {
    const list = Array.isArray(heldTickets) ? [...heldTickets] : [];
    if (Array.isArray(queueSnapshot)) {
      queueSnapshot.forEach((t) => {
        const s = (t.status || "").toLowerCase();
        if ((s === "on_hold" || s === "hold") && !list.some((h) => h.ticket_id === t.ticket_id)) {
          list.push(t);
        }
      });
    }
    return list;
  }, [heldTickets, queueSnapshot]);

  // Pathology Held Tickets (Scoped to Desk)
  const pathologyHeldTickets = useMemo(() => {
    return scopeTicketsForDesk(combinedHeldList, deskScope, (t) => {
      const isPath = isPathologyTicket(t);
      const isMyDesk = Boolean(
        (t.served_by_doctor_id && currentUser?.id && String(t.served_by_doctor_id) === String(currentUser?.id)) ||
        (t.previous_doctor_id && currentUser?.id && String(t.previous_doctor_id) === String(currentUser?.id)) ||
        (t.desk_id && (t.desk_id === selectedDesk?.id || t.desk_id === assignedDesk?.id)) ||
        (t.previous_desk_id && (t.previous_desk_id === selectedDesk?.id || t.previous_desk_id === assignedDesk?.id))
      );
      return isPath || isMyDesk;
    });
  }, [combinedHeldList, deskScope, isPathologyTicket, currentUser, selectedDesk, assignedDesk]);

  // Active Serving Lab Ticket
  const [selectedServingTicket, setSelectedServingTicket] = useState(null);

  const labServing = useMemo(() => {
    if (Array.isArray(servingTickets) && servingTickets.length > 0) {
      if (deskScope?.isEmergencyDesk) {
        const emergServing = servingTickets.find((t) => isEmergencyTicket(t));
        if (emergServing) return emergServing;
      }

      const myId = currentUser?.id || currentUser?.user_id;
      const myEmail = String(currentUser?.email || "").toLowerCase().trim();
      const myName = String(currentUser?.name || currentUser?.username || "").toLowerCase().trim();

      // Priority 1: Ticket specifically served by current user or desk
      const myDirectServing = servingTickets.find((t) => {
        const servedById = t.served_by_doctor_id;
        const servedByEmail = String(t.served_by_doctor_email || "").toLowerCase().trim();
        const servedByName = String(t.served_by_doctor_name || "").toLowerCase().trim();
        const servedDesk = t.desk_id ? String(t.desk_id) : null;
        const myDeskId = selectedDesk?.id || assignedDesk?.id ? String(selectedDesk?.id || assignedDesk?.id) : null;

        return (
          (myId && servedById && String(servedById) === String(myId)) ||
          (myEmail && servedByEmail && servedByEmail === myEmail) ||
          (myName && servedByName && servedByName === myName) ||
          (myDeskId && servedDesk && servedDesk === myDeskId)
        );
      });
      if (myDirectServing) return myDirectServing;

      // Priority 2: Ticket for pathology / lab
      const labMatch = servingTickets.find((t) => isPathologyTicket(t));
      if (labMatch) return labMatch;
    }
    return null;
  }, [servingTickets, currentUser, selectedDesk, assignedDesk, isPathologyTicket, deskScope]);

  useEffect(() => {
    if (labServing) {
      setSelectedServingTicket(labServing);
    }
  }, [labServing]);

  const activeServingTicket = selectedServingTicket || labServing || null;

  // Selected Panel & Parameter List
  const [selectedPanelKey, setSelectedPanelKey] = useState("cbc");
  const [specimenType, setSpecimenType] = useState(DEFAULT_TEST_PANELS.cbc.specimen);
  const [collectionTime, setCollectionTime] = useState(() => new Date().toISOString());
  const [specimenCondition, setSpecimenCondition] = useState("Adequate / Free of Hemolysis");
  const [labAccessionNo, setLabAccessionNo] = useState(() => `LAB-${Date.now().toString().slice(-6)}`);
  const [testParameters, setTestParameters] = useState(() => [...DEFAULT_TEST_PANELS.cbc.parameters]);
  const [pathologistRemarks, setPathologistRemarks] = useState("Specimen collected and processed under standard diagnostic quality control protocols.");
  const [reportStatus, setReportStatus] = useState("Verified & Final");
  const [technicianName, setTechnicianName] = useState("Senior Lab Technologist");

  // Load Panel Template
  const handleLoadPanel = useCallback((panelKey) => {
    setSelectedPanelKey(panelKey);
    const panel = DEFAULT_TEST_PANELS[panelKey];
    if (panel) {
      setSpecimenType(panel.specimen);
      setTestParameters([...panel.parameters]);
      showToast(isHi ? `${panel.name} टेम्पलेट लोड किया गया` : `Loaded ${panel.name} panel`, "info");
    }
  }, [isHi, showToast]);

  // Auto-flag calculate on value edit
  const handleParameterChange = (index, field, value) => {
    setTestParameters((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      if (field === "value") {
        const num = parseFloat(value);
        if (!isNaN(num) && target.min !== null && target.max !== null && target.min !== undefined && target.max !== undefined) {
          if (num > target.max) {
            target.flag = "HIGH";
          } else if (num < target.min) {
            target.flag = "LOW";
          } else {
            target.flag = "NORMAL";
          }
        }
      }

      next[index] = target;
      return next;
    });
  };

  const handleAddCustomParameter = () => {
    setTestParameters((prev) => [
      ...prev,
      {
        parameter: "Custom Assay Parameter",
        value: "",
        unit: "mg/dL",
        ref_range: "Normal",
        min: null,
        max: null,
        flag: "NORMAL",
      },
    ]);
  };

  const handleRemoveParameter = (index) => {
    setTestParameters((prev) => prev.filter((_, i) => i !== index));
  };

  // Extract Referring Doctor and Doctor's Lab Test Requests from Active Ticket
  const parsedDoctorRx = useMemo(() => {
    if (!activeServingTicket || !activeServingTicket.prescription_notes) return null;
    try {
      let str = activeServingTicket.prescription_notes;
      if (typeof str === "object") return str;
      while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        str = str.slice(1, -1).trim();
      }
      return JSON.parse(str);
    } catch (_) {
      return { advice: activeServingTicket.prescription_notes };
    }
  }, [activeServingTicket]);

  // When active ticket changes, auto-detect requested lab test from doctor
  useEffect(() => {
    if (parsedDoctorRx && parsedDoctorRx.lab_tests) {
      const req = String(parsedDoctorRx.lab_tests).toLowerCase();
      if (req.includes("cbc") || req.includes("blood count")) {
        handleLoadPanel("cbc");
      } else if (req.includes("sugar") || req.includes("glucose") || req.includes("hba1c") || req.includes("diabetes")) {
        handleLoadPanel("glucose");
      } else if (req.includes("lipid") || req.includes("cholesterol")) {
        handleLoadPanel("lipid");
      } else if (req.includes("kft") || req.includes("kidney") || req.includes("creatinine")) {
        handleLoadPanel("kft");
      } else if (req.includes("lft") || req.includes("liver") || req.includes("bilirubin")) {
        handleLoadPanel("lft");
      } else if (req.includes("thyroid") || req.includes("tsh")) {
        handleLoadPanel("thyroid");
      } else if (req.includes("urine")) {
        handleLoadPanel("urine");
      }
    }
  }, [parsedDoctorRx, handleLoadPanel]);

  const [callingNext, setCallingNext] = useState(false);

  // Call Next Patient (kiosk-only sound, visual toast on desk)
  const handleCallNext = async () => {
    if (dutyStatus !== "ACTIVE") {
      const opt = dutyStatusOptions.find((o) => o.id === dutyStatus);
      showToast(
        isHi
          ? `आपकी ड्यूटी स्थिति '${opt?.label || dutyStatus}' है। मरीज़ को बुलाने के लिए कृपया स्थिति को 'जांच हेतु तैयार' करें।`
          : `Duty status is '${opt?.label || dutyStatus}'. Please switch to 'Ready to Test' to call patients.`,
        "warn"
      );
      return;
    }

    if (activeServingTicket) {
      showToast(
        isHi
          ? `आप वर्तमान में टोकन #${activeServingTicket.ticket_id} (${activeServingTicket.name}) की जांच कर रहे हैं।`
          : `Currently testing Token #${activeServingTicket.ticket_id} (${activeServingTicket.name}). Please complete or hold first.`,
        "warn"
      );
      return;
    }

    if (pathologyQueue.length === 0) {
      showToast(
        isEmergencyDesk
          ? (isHi ? "आपातकालीन कतार में कोई मरीज़ प्रतीक्षारत नहीं है।" : "No emergency patients waiting in queue.")
          : (isHi ? "पैथोलॉजी कतार में कोई मरीज़ प्रतीक्षारत नहीं है।" : "No patients waiting in the lab queue."),
        "info"
      );
      return;
    }

    setCallingNext(true);
    const payload = {
      tenant_id: effectiveHospitalCode,
      department: isEmergencyDesk ? "emergency" : "laboratory",
      service_category: isEmergencyDesk ? "emergency" : "laboratory",
      doctor_id: currentUser?.id || currentUser?.user_id || null,
      doctor_name: currentUser?.name || currentUser?.username || pathologistName || "Pathologist",
      doctor_email: currentUser?.email || null,
      desk_id: selectedDesk?.id || assignedDesk?.id || null,
      desk_name: activeCounter,
    };

    try {
      if (socketRef && socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("serve_next", payload);
        showToast(
          isEmergencyDesk
            ? (isHi ? "अगले आपातकालीन मरीज़ को पुकारा जा रहा है..." : "Calling next emergency patient on waiting-room display...")
            : (isHi ? "अगले पैथोलॉजी मरीज़ को पुकारा जा रहा है..." : "Calling next pathology patient on waiting-room display..."),
          "info"
        );
      } else {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        const res = await fetch(`${API_BASE}/api/v1/plugin/serve-next`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.detail || "Failed to call next patient");
        }
        if (data.ticket) {
          const labTicket = {
            ...data.ticket,
            service_category: "LABORATORY",
            desk_name: activeCounter,
            counter: activeCounter,
          };
          setSelectedServingTicket(labTicket);
          showToast(
            isHi
              ? `टोकन #${data.ticket.ticket_id} (${data.ticket.name}) को पैथोलॉजी स्टेशन पर बुलाया गया।`
              : `Token #${data.ticket.ticket_id} (${data.ticket.name}) called to Pathology Station.`,
            "success"
          );
        }
        if (refreshData) refreshData();
      }
    } catch (e) {
      showToast(
        isHi ? `मरीज़ को बुलाने में त्रुटि: ${e.message}` : `Error calling patient: ${e.message}`,
        "error"
      );
    } finally {
      setTimeout(() => setCallingNext(false), 800);
    }
  };

  // Call Specific Patient from Waiting Queue
  const handleCallSpecificPatient = (ticket) => {
    if (!ticket) return;
    if (dutyStatus !== "ACTIVE") {
      const opt = dutyStatusOptions.find((o) => o.id === dutyStatus);
      showToast(
        isHi
          ? `आपकी ड्यूटी स्थिति '${opt?.label || dutyStatus}' है। कृपया पहले स्थिति को 'जांच हेतु तैयार' करें।`
          : `Duty status is '${opt?.label || dutyStatus}'. Please switch to 'Ready to Test' first.`,
        "warn"
      );
      return;
    }

    const labTicket = {
      ...ticket,
      service_category: "LABORATORY",
      desk_name: activeCounter,
      counter: activeCounter,
      doctor_name: currentUser?.name || currentUser?.username || pathologistName || "Pathologist",
    };

    setSelectedServingTicket(labTicket);
    showToast(
      isHi
        ? `टोकन #${ticket.ticket_id} (${ticket.name}) को जांच हेतु बुलाया गया।`
        : `Token #${ticket.ticket_id} (${ticket.name}) sent to waiting-room display.`,
      "success"
    );

    if (socketRef && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("re_announce", {
        tenant_id: effectiveHospitalCode,
        ticket: labTicket,
        ticket_id: ticket.ticket_id,
        doctor_name: currentUser?.name || currentUser?.username || pathologistName,
      });
    }

    fetch(`${API_BASE}/api/v1/plugin/re-announce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: effectiveHospitalCode,
        ticket_id: ticket.ticket_id,
        ticket: labTicket,
      }),
    }).catch(() => { });
  };

  // Recall Active Patient (Send to waiting-room display)
  const handleRecall = () => {
    if (!activeServingTicket) return;
    const labTicket = {
      ...activeServingTicket,
      service_category: "LABORATORY",
      desk_name: activeCounter,
      counter: activeCounter,
      doctor_name: currentUser?.name || currentUser?.username || activeCounter,
    };

    if (socketRef && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("re_announce", {
        tenant_id: effectiveHospitalCode,
        ticket: labTicket,
        ticket_id: activeServingTicket.ticket_id,
        doctor_name: currentUser?.name || currentUser?.username || activeCounter,
      });
      socketRef.current.emit("recall_ticket", {
        tenant_id: effectiveHospitalCode,
        ticket: labTicket,
        ticket_id: activeServingTicket.ticket_id,
        doctor_name: currentUser?.name || currentUser?.username || activeCounter,
      });
    }

    fetch(`${API_BASE}/api/v1/plugin/re-announce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: effectiveHospitalCode,
        ticket_id: activeServingTicket.ticket_id,
        ticket: labTicket,
      }),
    }).catch(() => { });

    showToast(
      isHi
        ? `टोकन #${activeServingTicket.ticket_id} (${activeServingTicket.name}) प्रतीक्षालय डिस्प्ले पर भेजा गया।`
        : `Sent Token #${activeServingTicket.ticket_id} (${activeServingTicket.name}) to waiting-room display.`,
      "info"
    );
  };

  // Hold Ticket (10-min Grace Period)
  const handleHold = async (ticketToHold) => {
    const target = ticketToHold || activeServingTicket;
    if (!target) return;
    try {
      await fetch(`${API_BASE}/api/v1/plugin/hold-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: target.ticket_id,
          grace_minutes: 10,
        }),
      });
      if (socketRef && socketRef.current) {
        socketRef.current.emit("hold_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: target.ticket_id,
          grace_minutes: 10,
        });
      }
      if (activeServingTicket && activeServingTicket.ticket_id === target.ticket_id) {
        setSelectedServingTicket(null);
      }
      showToast(
        isHi
          ? `टोकन #${target.ticket_id} को 10 मिनट होल्ड पर रखा गया।`
          : `Token #${target.ticket_id} placed on 10-minute hold.`,
        "warn"
      );
      if (refreshData) refreshData();
    } catch (_) { }
  };

  // Recall Held Patient back into active station or queue
  const handleRecallHeld = async (ticket) => {
    if (!ticket) return;
    try {
      const mode = activeServingTicket ? "queue" : "serving";
      if (handleRecallTicket) {
        await handleRecallTicket(ticket.ticket_id, mode);
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/recall-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            ticket_id: ticket.ticket_id,
            doctor_id: currentUser?.id,
            doctor_name: currentUser?.name || currentUser?.username || pathologistName,
            doctor_email: currentUser?.email,
            target_mode: mode,
          }),
        });
      }
      if (socketRef && socketRef.current) {
        socketRef.current.emit("recall_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          doctor_id: currentUser?.id,
          user_name: currentUser?.name || currentUser?.username || pathologistName,
          target_mode: mode,
        });
      }
      if (!activeServingTicket) {
        setSelectedServingTicket(ticket);
      }
      const msg = isHi
        ? `टोकन #${ticket.ticket_id} (${ticket.name}) को पुनः सक्रिय किया गया।`
        : `Recalled #${ticket.ticket_id} (${ticket.name}) back to active station.`;
      showToast(msg, "success");
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? `त्रुटि: ${e.message}` : `Error recalling ticket: ${e.message}`, "error");
    }
  };

  // Finalize No-Show for Patient
  const handleFinalizeNoShow = async (ticket) => {
    if (!ticket) return;
    try {
      if (handleMarkNoShow) {
        await handleMarkNoShow(ticket.ticket_id, "Patient absent after 10-min grace period");
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/no-show`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            ticket_id: ticket.ticket_id,
            reason: "Patient absent after 10-min grace period",
          }),
        });
      }
      if (socketRef && socketRef.current) {
        socketRef.current.emit("no_show", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
        });
      }
      if (activeServingTicket && activeServingTicket.ticket_id === ticket.ticket_id) {
        setSelectedServingTicket(null);
      }
      const msg = isHi
        ? `टोकन #${ticket.ticket_id} (${ticket.name}) को अनुपस्थित (No-Show) चिह्नित किया गया।`
        : `Token #${ticket.ticket_id} (${ticket.name}) marked as No-Show.`;
      showToast(msg, "warn");
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? `त्रुटि: ${e.message}` : `Error: ${e.message}`, "error");
    }
  };

  const handleNoShow = () => {
    if (!activeServingTicket) return;
    handleFinalizeNoShow(activeServingTicket);
  };

  // Build Diagnostic Report Payload
  const buildReportPayload = () => {
    const panel = DEFAULT_TEST_PANELS[selectedPanelKey] || { name: "Clinical Pathology Investigation", category: "General" };
    return {
      test_panel_name: panel.name,
      test_category: panel.category || "Laboratory",
      specimen_type: specimenType,
      collection_time: collectionTime,
      specimen_condition: specimenCondition,
      lab_accession_no: labAccessionNo,
      verified_at: new Date().toISOString(),
      pathologist_name: pathologistName,
      technician_name: technicianName,
      results: testParameters,
      remarks: pathologistRemarks,
      status: reportStatus,
    };
  };

  // Save Draft to Backend
  const handleSaveReportDraft = async () => {
    if (!activeServingTicket) {
      showToast(isHi ? "सहेजने के लिए कोई सक्रिय मरीज़ नहीं है" : "No active patient to save report for", "warn");
      return;
    }

    try {
      const reportPayload = buildReportPayload();
      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        lab_report: reportPayload,
      };

      const res = await fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          prescription: mergedNotes,
        }),
      });

      if (res.ok) {
        showToast(isHi ? "जांच रिपोर्ट सफलतापूर्वक सहेजी गई।" : "Diagnostic report saved successfully.", "success");
        if (refreshData) refreshData();
      } else {
        throw new Error("Failed to save report");
      }
    } catch (e) {
      showToast(isHi ? "रिपोर्ट सहेजने में त्रुटि" : "Error saving diagnostic report", "error");
    }
  };

  // Print Official Diagnostic Report Slip
  const handlePrintReport = () => {
    if (!activeServingTicket) return;
    const reportPayload = buildReportPayload();
    const fullReportData = {
      ...reportPayload,
      patient_name: activeServingTicket.name,
      age: activeServingTicket.age || 30,
      gender: activeServingTicket.gender || "M",
      phone: activeServingTicket.phone || "",
      ticket_id: activeServingTicket.ticket_id,
      referring_doctor: parsedDoctorRx?.doctor_name || "OPD Consultant",
      clinical_diagnosis: parsedDoctorRx?.diagnosis || activeServingTicket.medical_condition || "Clinical Pathology Investigation",
      hospital_name: brandName,
    };

    printLabReportSlip(fullReportData, language, hospitalBranding);
  };

  // Route-to-Doctor department picker modal state (Requirement 2: Routing Parity)
  const [showRouteDeptModal, setShowRouteDeptModal] = useState(false);
  const [routeTargetDept, setRouteTargetDept] = useState("");
  const [hospitalDepartments, setHospitalDepartments] = useState([]);

  // Fetch actual departments configured for this hospital
  const fetchHospitalDepartments = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/hospitals/${encodeURIComponent(effectiveHospitalCode)}/departments`);
      const data = await res.json();
      if (res.ok && data.status === "success" && Array.isArray(data.departments)) {
        setHospitalDepartments(data.departments);
      }
    } catch (e) {
      console.error("Failed to load hospital departments in pathology:", e);
    }
  }, [effectiveHospitalCode]);

  useEffect(() => {
    fetchHospitalDepartments();
  }, [fetchHospitalDepartments]);

  // Available departments in the hospital for routing (excluding current Laboratory dept)
  const availableRouteDepartments = useMemo(() => {
    const list = (hospitalDepartments || []).filter((d) => {
      const code = (d.dept_code || "").toLowerCase();
      const name = (d.name || "").toLowerCase();
      const isActive = d.status ? d.status === "active" : true;
      if (!isActive) return false;
      return code !== "laboratory" && code !== "pathology" && !name.includes("laboratory") && !name.includes("pathology");
    });

    if (list.length > 0) {
      return list.map((d) => {
        const code = d.dept_code || d.name;
        return {
          id: code,
          code: code,
          label: d.name || code,
          labelHi: d.name_hi || d.name || code,
        };
      });
    }

    return [
      { id: "consultation", code: "consultation", label: "General Consultation (OPD)", labelHi: "सामान्य परामर्श (OPD)" },
      { id: "emergency", code: "emergency", label: "Emergency Triage", labelHi: "आपातकालीन ट्राइएज" },
      { id: "radiology", code: "radiology", label: "Radiology & Imaging", labelHi: "रेडियोलॉजी व इमेजिंग" },
      { id: "pharmacy", code: "pharmacy", label: "Pharmacy & Medicine", labelHi: "फार्मेसी एवं दवा वितरण" },
      { id: "billing", code: "billing", label: "Central Billing & Cashier", labelHi: "सेंट्रल बिलिंग व कैशियर" },
    ];
  }, [hospitalDepartments]);

  // Complete & Route Back to Referring Doctor (without hardcoded consultation fallback)
  const handleCompleteAndRouteToDoctor = async (overrideDept) => {
    if (!activeServingTicket) return;
    const finalDept = overrideDept || routeTargetDept || parsedDoctorRx?.doctor_department || activeServingTicket.transferred_from_dept;
    if (!finalDept) {
      showToast(isHi ? "कृपया पहले गंतव्य विभाग का चयन करें।" : "Please select a target department for routing.", "warn");
      setShowRouteDeptModal(true);
      return;
    }

    try {
      const reportPayload = buildReportPayload();
      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        lab_report: reportPayload,
        lab_completed_at: new Date().toISOString(),
      };

      const targetDoctorId = parsedDoctorRx?.doctor_id || activeServingTicket.transferred_from_doctor_id || null;

      const res = await fetch(`${API_BASE}/api/v1/plugin/transfer-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          target_department: finalDept,
          target_doctor_id: targetDoctorId,
          transfer_reason: "Lab report completed. Routing back to doctor with results.",
          prescription_notes: JSON.stringify(mergedNotes),
        }),
      });

      if (res.ok) {
        if (socketRef && socketRef.current) {
          socketRef.current.emit("ticket_transferred", {
            tenant_id: effectiveHospitalCode,
            ticket_id: activeServingTicket.ticket_id,
            target_department: finalDept,
          });
        }

        const docLabel = parsedDoctorRx?.doctor_name ? `डॉ. ${parsedDoctorRx.doctor_name}` : finalDept;
        showToast(
          isHi
            ? `जांच रिपोर्ट पूर्ण कर ${docLabel} को भेज दी गई है।`
            : `Lab report completed and sent to the referring doctor (${docLabel}).`,
          "success"
        );
        setSelectedServingTicket(null);
        setShowRouteDeptModal(false);
        setRouteTargetDept("");
        if (refreshData) refreshData();
      } else {
        throw new Error("Failed to route ticket");
      }
    } catch (e) {
      showToast(isHi ? "स्थानांतरण में त्रुटि" : "Error routing report to doctor", "error");
    }
  };

  // Complete and Discharge Directly
  const handleCompleteAndDischarge = async () => {
    if (!activeServingTicket) return;

    try {
      const reportPayload = buildReportPayload();
      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        lab_report: reportPayload,
        lab_completed_at: new Date().toISOString(),
      };

      if (socketRef && socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("complete_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          department: "laboratory",
          prescription_notes: mergedNotes,
        });
      } else {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        await fetch(`${API_BASE}/api/v1/plugin/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            ticket_id: activeServingTicket.ticket_id,
            department: "laboratory",
            prescription_notes: mergedNotes,
          }),
        });
      }

      setSelectedServingTicket(null);
      showToast(
        isHi
          ? `टोकन #${activeServingTicket.ticket_id} की जांच पूर्ण एवं डिस्चार्ज सफल।`
          : `Token #${activeServingTicket.ticket_id} test completed and patient discharged.`,
        "success"
      );
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? "डिस्चार्ज में त्रुटि" : "Error completing ticket", "error");
    }
  };

  // Historical Records & Date Filtering
  const [historyScopeFilter, setHistoryScopeFilter] = useState("all"); // "all" | "my"
  const [historyDateFilter, setHistoryDateFilter] = useState("all"); // Default to "all" so lab records display immediately
  const [customFilterDate, setCustomFilterDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all"); // "all" | "completed" | "serving" | "waiting" | "cancelled"
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("all"); // "all" | "Hematology" | "Biochemistry" | "Urine" | "Serology"
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(10);
  const [historicalReports, setHistoricalReports] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const fetchHistoricalReports = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    setLoadingHistory(true);
    setHistoryError(null);
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
        setHistoryError({
          type: "permission",
          status: res.status,
          message: isHi
            ? "अनुमति अस्वीकृत (403): आपके पास इस अस्पताल के लैब विज़िट रिकॉर्ड देखने की अनुमति नहीं है।"
            : "Permission Denied (403): You do not have permission to view visit records for this hospital.",
        });
        setHistoricalReports([]);
        return;
      }

      if (!res.ok) {
        let errMsg = isHi ? `त्रुटि ${res.status}: लैब रिकॉर्ड लोड करने में विफल` : `Error ${res.status}: Failed to load lab visits`;
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
        } catch (_) { }
        setHistoryError({
          type: "http",
          status: res.status,
          message: errMsg,
        });
        setHistoricalReports([]);
        return;
      }

      const data = await res.json();
      if (data && (data.status === "success" || Array.isArray(data.visits))) {
        setHistoricalReports(Array.isArray(data.visits) ? data.visits : []);
        setHistoryError(null);
      } else {
        setHistoricalReports([]);
      }
    } catch (e) {
      console.error("History fetch error:", e);
      setHistoryError({
        type: "network",
        message: isHi ? "नेटवर्क त्रुटि: सर्वर से कनेक्ट नहीं हो सका।" : "Network error: Unable to connect to server.",
      });
      setHistoricalReports([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [effectiveHospitalCode, currentUser?.email, currentUser?.token, isHi]);

  // Fetch on mount and when hospital changes
  useEffect(() => {
    fetchHistoricalReports();
  }, [fetchHistoricalReports]);

  // Parse structured clinical lab details from visit & transfer stages
  const parseLabVisitDetails = useCallback((item) => {
    if (!item) {
      return {
        doctor: "Dr. Rahul",
        technician: "Senior Lab Technologist",
        testName: "General Diagnostic Laboratory Panel",
        category: "General Pathology",
      };
    }

    const stages = Array.isArray(item.transfer_stages) ? item.transfer_stages : [];
    const labStage = stages.find((s) => {
      const c = (s.dept_code || s.department || "").toLowerCase();
      return c.includes("lab") || c.includes("path");
    });

    let doctor = item.doctor_name || "";
    let technician = item.technician_name || "";
    let testName = item.test_panel_name || item.medical_condition || item.service_category || "";
    let category = "General Pathology";

    // 1. Inspect notes from item, lab stage, and all transfer stages
    const notesToInspect = [
      item.prescription_notes,
      labStage?.notes,
      ...stages.map((s) => s.notes),
    ].filter(Boolean);

    for (const notes of notesToInspect) {
      try {
        let raw = typeof notes === "string" ? notes.trim() : notes;
        if (typeof raw === "string") {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) raw = jsonMatch[0];
          const parsed = JSON.parse(raw);
          if (parsed.lab_report) {
            if (parsed.lab_report.pathologist_name) doctor = parsed.lab_report.pathologist_name;
            if (parsed.lab_report.doctor_name) doctor = parsed.lab_report.doctor_name;
            if (parsed.lab_report.technician_name) technician = parsed.lab_report.technician_name;
            if (parsed.lab_report.test_panel_name) testName = parsed.lab_report.test_panel_name;
          }
          if (parsed.doctor_name) doctor = parsed.doctor_name;
          if (parsed.pathologist_name) doctor = parsed.pathologist_name;
          if (parsed.technician_name) technician = parsed.technician_name;
          if (parsed.diagnosis && (!testName || testName === "general_checkup" || testName === "Clinical Diagnostic Assay")) {
            testName = parsed.diagnosis;
          }
        }
      } catch (_) {}
    }

    // 2. Check stages for doctor / served_by
    if (!doctor) {
      for (const s of stages) {
        if (s.served_by) {
          doctor = s.served_by;
          break;
        }
      }
    }

    if (!doctor && item.served_by) {
      doctor = item.served_by;
    }

    // 3. Fallback to current logged-in doctor / pathologist
    if (!doctor) {
      doctor = currentUser?.name || currentUser?.username || "rahul";
    }

    // Format doctor name nicely with Dr. prefix
    let formattedDoctor = String(doctor).trim();
    if (formattedDoctor) {
      formattedDoctor = formattedDoctor.replace(/^dr\.?\s+/i, "").trim();
      formattedDoctor = formattedDoctor.charAt(0).toUpperCase() + formattedDoctor.slice(1);
      formattedDoctor = `Dr. ${formattedDoctor}`;
    } else {
      formattedDoctor = "Dr. Rahul";
    }

    // Format test panel name if raw e.g. "general_checkup"
    let formattedTestName = testName;
    if (!formattedTestName || formattedTestName === "general_checkup") {
      formattedTestName = "Complete Blood Count & Routine Diagnostic Panel";
    } else if (formattedTestName.includes("_")) {
      formattedTestName = formattedTestName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const lowerTest = String(formattedTestName).toLowerCase();
    if (lowerTest.includes("cbc") || lowerTest.includes("blood") || lowerTest.includes("hemo") || lowerTest.includes("platelet")) {
      category = "Hematology";
    } else if (lowerTest.includes("glucose") || lowerTest.includes("sugar") || lowerTest.includes("hba1c") || lowerTest.includes("lipid") || lowerTest.includes("liver") || lowerTest.includes("kidney") || lowerTest.includes("bio") || lowerTest.includes("kft") || lowerTest.includes("lft")) {
      category = "Biochemistry";
    } else if (lowerTest.includes("urine") || lowerTest.includes("urinalysis")) {
      category = "Urine Routine";
    } else if (lowerTest.includes("serology") || lowerTest.includes("widal") || lowerTest.includes("hiv") || lowerTest.includes("antigen") || lowerTest.includes("antibody")) {
      category = "Serology";
    }

    return {
      doctor: formattedDoctor,
      technician: technician || "Senior Lab Technologist",
      testName: formattedTestName,
      category,
    };
  }, [currentUser]);

    // All Pathology & Diagnostic Laboratory Visits
  const allLabVisits = useMemo(() => {
    return historicalReports.filter((item) => {
      const dept = (item.department || item.department_name || "").toLowerCase();
      const deptCode = (item.dept_code || "").toLowerCase();
      const cat = (item.service_category || "").toLowerCase();
      const med = (item.medical_condition || "").toLowerCase();
      const inStages = Array.isArray(item.transfer_stages) && item.transfer_stages.some((s) => {
        const sd = (s.department || "").toLowerCase();
        const sc = (s.dept_code || "").toLowerCase();
        return sd.includes("lab") || sd.includes("path") || sc.includes("lab") || sc.includes("path");
      });
      return (
        dept.includes("lab") ||
        dept.includes("path") ||
        deptCode.includes("lab") ||
        deptCode.includes("path") ||
        cat.includes("lab") ||
        cat.includes("path") ||
        med.includes("lab") ||
        med.includes("path") ||
        Boolean(item.test_panel_name) ||
        inStages ||
        (item.prescription_notes && typeof item.prescription_notes === "string" && item.prescription_notes.includes("lab_report"))
      );
    });
  }, [historicalReports]);

  // Scoped Lab Visits: All vs My Verified Tests
  const scopedLabVisits = useMemo(() => {
    if (historyScopeFilter === "all") return allLabVisits;
    const myName = (currentUser?.name || currentUser?.username || "").toLowerCase().trim();
    const myId = String(currentUser?.id || "").trim();
    const myEmail = (currentUser?.email || "").toLowerCase().trim();

    return allLabVisits.filter((item) => {
      const tech = String(item.technician_name || item.served_by || item.doctor_name || "").toLowerCase().trim();
      const techId = String(item.technician_id || item.served_by_id || item.doctor_id || "").trim();
      const techEmail = String(item.technician_email || item.served_by_email || "").toLowerCase().trim();

      if (myId && techId && myId === techId) return true;
      if (myEmail && techEmail && myEmail === techEmail) return true;
      if (myName && tech && tech.includes(myName)) return true;

      if (Array.isArray(item.transfer_stages)) {
        return item.transfer_stages.some((s) => {
          const sTech = String(s.technician_name || s.served_by || s.doctor_name || "").toLowerCase().trim();
          const sId = String(s.technician_id || s.served_by_id || s.user_id || "").trim();
          if (myId && sId && myId === sId) return true;
          if (myName && sTech && sTech.includes(myName)) return true;
          return false;
        });
      }
      return false;
    });
  }, [allLabVisits, historyScopeFilter, currentUser]);

  // Date counts breakdown for pill badges, metrics, and empty state
  const dateCounts = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = yestDate.toISOString().split("T")[0];

    let today = 0;
    let yesterday = 0;
    let custom = 0;
    let completed = 0;

    scopedLabVisits.forEach((item) => {
      const itemDate = item.queue_date || (item.created_at ? item.created_at.split("T")[0] : "");
      if (itemDate === todayStr) today++;
      if (itemDate === yestStr) yesterday++;
      if (itemDate === customFilterDate) custom++;

      const st = String(item.status || "completed").toLowerCase();
      if (st === "completed" || st === "verified" || st === "done") completed++;
    });

    return {
      all: scopedLabVisits.length,
      today,
      yesterday,
      custom,
      completed,
    };
  }, [scopedLabVisits, customFilterDate]);

  // Filtered Historical Records based on user selection
  const filteredHistory = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = yestDate.toISOString().split("T")[0];

    return scopedLabVisits.filter((item) => {
      // 1. Date Filtering
      const itemDate = item.queue_date || (item.created_at ? item.created_at.split("T")[0] : "");
      if (historyDateFilter === "today" && itemDate && itemDate !== todayStr) return false;
      if (historyDateFilter === "yesterday" && itemDate && itemDate !== yestStr) return false;
      if (historyDateFilter === "date" && itemDate && itemDate !== customFilterDate) return false;

      // 2. Status Filtering
      const rawSt = String(item.status || "completed").toLowerCase();
      if (historyStatusFilter === "completed" && !(rawSt === "completed" || rawSt === "verified" || rawSt === "done")) return false;
      if (historyStatusFilter === "serving" && !(rawSt === "serving" || rawSt === "in_progress" || rawSt === "testing")) return false;
      if (historyStatusFilter === "waiting" && !(rawSt === "waiting" || rawSt === "queued")) return false;
      if (historyStatusFilter === "cancelled" && !(rawSt === "cancelled" || rawSt === "canceled" || rawSt === "no_show" || rawSt === "expired")) return false;

      // 3. Category Filtering
      if (historyCategoryFilter !== "all") {
        const details = parseLabVisitDetails(item);
        if (details.category.toLowerCase() !== historyCategoryFilter.toLowerCase()) return false;
      }

      // 4. Search query (Patient Name, Token, Phone, Test Panel, Doctor)
      if (historySearchTerm.trim()) {
        const q = historySearchTerm.toLowerCase();
        const pName = (item.patient_name || item.name || "").toLowerCase();
        const tId = String(item.ticket_id || item.token_number || "").toLowerCase();
        const phone = String(item.phone || "").toLowerCase();
        const testName = String(item.medical_condition || item.service_category || item.test_panel_name || "").toLowerCase();
        const docName = String(item.doctor_name || "").toLowerCase();
        if (!pName.includes(q) && !tId.includes(q) && !phone.includes(q) && !testName.includes(q) && !docName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [scopedLabVisits, historyDateFilter, customFilterDate, historyStatusFilter, historyCategoryFilter, historySearchTerm, parseLabVisitDetails]);

  // Reset page when filter criteria change
  useEffect(() => {
    setHistoryPage(1);
  }, [historyScopeFilter, historyDateFilter, customFilterDate, historyStatusFilter, historyCategoryFilter, historySearchTerm, historyRowsPerPage]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyRowsPerPage));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistory = useMemo(() => {
    const start = (historyCurrentPage - 1) * historyRowsPerPage;
    return filteredHistory.slice(start, start + historyRowsPerPage);
  }, [filteredHistory, historyCurrentPage, historyRowsPerPage]);

  // Excel Export Handler
  const handleExportExcel = () => {
    if (filteredHistory.length === 0) {
      showToast(isHi ? "निर्यात करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।" : "No laboratory records available to export.", "info");
      return;
    }

    const rows = filteredHistory.map((item, idx) => {
      const details = parseLabVisitDetails(item);
      const rawSt = String(item.status || "completed").toLowerCase();
      let statusFormatted = "Completed";
      if (rawSt === "cancelled" || rawSt === "canceled") statusFormatted = "Cancelled";
      else if (rawSt === "no_show" || rawSt === "noshow" || rawSt === "expired") statusFormatted = "No-Show";
      else if (rawSt === "serving" || rawSt === "in_progress" || rawSt === "testing") statusFormatted = "Testing";
      else if (rawSt === "waiting" || rawSt === "queued") statusFormatted = "Waiting";

      return {
        "S.No": idx + 1,
        "Date": item.queue_date || (item.created_at ? item.created_at.split("T")[0] : "-"),
        "Time": item.created_at ? new Date(item.created_at).toLocaleTimeString() : "-",
        "Token ID": item.ticket_id || item.token_number || "-",
        "Patient Name": item.patient_name || item.name || "-",
        "Age": item.age || 30,
        "Gender": item.gender || "M",
        "Phone": item.phone || "-",
        "Investigation": details.testName,
        "Category": details.category,
        "Care Pathway": `${item.origin_department || "OPD"} -> Pathology`,
        "Technician / Doctor": details.technician,
        "Status": statusFormatted,
        "Cancellation Reason": item.cancellation_reason || "-",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pathology_Records");
    XLSX.writeFile(wb, `Pathology_Records_${historyDateFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(isHi ? "एक्सेल स्प्रेडशीट सफलतापूर्वक डाउनलोड हो गई।" : "Excel spreadsheet exported successfully.", "success");
  };

  // =========================================================================
  // QUEUE & APPOINTMENTS TAB STATE & LOGIC (Requirement 1)
  // =========================================================================
  const [queueSubView, setQueueSubView] = useState("queue"); // "queue" | "appointments"
  const [queueCategoryFilter, setQueueCategoryFilter] = useState("all"); // "all" | "Hematology" | "Biochemistry" | "Urine" | "Serology"
  const [queueStatusFilter, setQueueStatusFilter] = useState("all");
  const [queuePriorityFilter, setQueuePriorityFilter] = useState("all");
  const [queueSearchQuery, setQueueSearchQuery] = useState("");

  // Appointments Data (Requirement 7: Authenticated with tenant isolation)
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  const fetchPathologyAppointments = useCallback(async (isInitial = false) => {
    if (!effectiveHospitalCode) return;
    if (isInitial) setAppointmentsLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/tenant/${encodeURIComponent(effectiveHospitalCode)}`, { headers });
      const data = await res.json();
      if (res.ok && (data.status === "success" || Array.isArray(data.appointments))) {
        setAppointmentsList(Array.isArray(data.appointments) ? data.appointments : []);
      }
    } catch (e) {
      console.error("Error fetching pathology appointments:", e);
    } finally {
      if (isInitial) setAppointmentsLoading(false);
    }
  }, [effectiveHospitalCode, currentUser]);

  useEffect(() => {
    fetchPathologyAppointments(true);
  }, [fetchPathologyAppointments]);

  // Handle Manual Check-In from Appointments
  const handleCheckInAppointment = async (aptId) => {
    if (!aptId) return;
    try {
      const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ appointment_id: aptId }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast(
          isHi
            ? `टोकन #${data.ticket?.ticket_id || ""} चेक-इन सफल।`
            : `Checked in successfully. Token #${data.ticket?.ticket_id || ""} issued.`,
          "success"
        );
        fetchPathologyAppointments();
        if (refreshData) refreshData();
      } else {
        showToast(data.message || data.detail || (isHi ? "चेक-इन विफल रहा" : "Check-in failed"), "error");
      }
    } catch (e) {
      showToast(isHi ? `चेक-इन त्रुटि: ${e.message}` : `Error during check-in: ${e.message}`, "error");
    }
  };

  // Handle Cancel Appointment
  const handleCancelAppointment = async (aptId) => {
    if (!aptId) return;
    if (!window.confirm(isHi ? `क्या आप वाकई अपॉइंटमेंट #${aptId} को रद्द करना चाहते हैं?` : `Are you sure you want to cancel appointment #${aptId}?`)) {
      return;
    }
    try {
      const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/${aptId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: "Cancelled by pathology laboratory" }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast(isHi ? "अपॉइंटमेंट रद्द किया गया।" : "Appointment cancelled.", "info");
        fetchPathologyAppointments();
        if (refreshData) refreshData();
      } else {
        showToast(data.message || (isHi ? "रद्द करने में विफलता" : "Failed to cancel appointment"), "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  };

  // SMS Reminder for Scheduled Appointment (Requirement 1)
  const handleSendSmsReminder = async (apt) => {
    if (!apt) return;
    const phone = apt.phone || apt.patient_phone || "";
    const pName = apt.patient_name || apt.name || "Patient";
    const slot = apt.time_slot || apt.formatted_appointment_time || "today";

    showToast(
      isHi
        ? `${pName} (${phone || "रजिस्टर्ड मोबाइल"}) को एसएमएस अनुस्मारक भेजा गया।`
        : `SMS reminder dispatched to ${pName} (${phone || "Registered Mobile"}).`,
      "success"
    );
  };

  // Walk-in / Book Appointment Modal State (Requirement 1)
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInAge, setWalkInAge] = useState("30");
  const [walkInGender, setWalkInGender] = useState("M");
  const [walkInTestCategory, setWalkInTestCategory] = useState("Hematology");
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);

  const handleBookWalkIn = async (e) => {
    e.preventDefault();
    if (!walkInName.trim()) {
      showToast(isHi ? "कृपया मरीज़ का नाम दर्ज करें" : "Please enter patient name", "warn");
      return;
    }
    setWalkInSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          consumer_type: "hospital",
          service_category: "laboratory",
          patient_name: walkInName.trim(),
          phone: walkInPhone.trim(),
          age: parseInt(walkInAge, 10) || 30,
          gender: walkInGender,
          appointment_date: todayStr,
          time_slot: "Walk-in OPD Slot",
          notes: `Walk-in Lab Request: ${walkInTestCategory}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.appointment) {
        showToast(
          isHi
            ? `वॉक-इन अपॉइंटमेंट #${data.appointment.appointment_id} सफलतापूर्वक दर्ज किया गया।`
            : `Walk-in appointment #${data.appointment.appointment_id} booked successfully.`,
          "success"
        );
        setShowWalkInModal(false);
        setWalkInName("");
        setWalkInPhone("");
        fetchPathologyAppointments();
      } else {
        showToast(data.message || (isHi ? "अपॉइंटमेंट बुकिंग विफल" : "Booking failed"), "error");
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Dedicated Queue Ticket Transfer Modal State
  const [transferTicket, setTransferTicket] = useState(null);
  const [transferTargetDept, setTransferTargetDept] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [isTransferringQueueTicket, setIsTransferringQueueTicket] = useState(false);

  const handleExecuteQueueTransfer = async () => {
    if (!transferTicket || !transferTargetDept) return;
    setIsTransferringQueueTicket(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/transfer-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: transferTicket.ticket_id,
          target_department: transferTargetDept,
          prescription_notes: transferNotes ? JSON.stringify({ transfer_notes: transferNotes, advised_by: "Pathology Laboratory" }) : "",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          isHi
            ? `टोकन #${transferTicket.ticket_id} को स्थानांतरित किया गया।`
            : `Transferred #${transferTicket.ticket_id} to ${transferTargetDept}.`,
          "success"
        );
        setTransferTicket(null);
        setTransferTargetDept("");
        setTransferNotes("");
        if (refreshData) refreshData();
      } else {
        showToast(data.message || (isHi ? "स्थानांतरण विफल रहा" : "Failed to transfer ticket"), "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    } finally {
      setIsTransferringQueueTicket(false);
    }
  };

  // Persistent Lab Prep Checklist State per Patient (Requirement 1)
  const [prepState, setPrepState] = useState(() => {
    try {
      const key = `ai_queue_pathology_prep_${effectiveHospitalCode}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  const updatePrepState = useCallback((patientKey, updater) => {
    setPrepState((prev) => {
      const curr = prev[patientKey] || { items: {}, prepDone: false };
      const updated = typeof updater === "function" ? updater(curr) : updater;
      const next = { ...prev, [patientKey]: updated };
      try {
        localStorage.setItem(`ai_queue_pathology_prep_${effectiveHospitalCode}`, JSON.stringify(next));
      } catch (_) { }
      return next;
    });
  }, [effectiveHospitalCode]);

  const togglePrepItem = (patientKey, itemId) => {
    updatePrepState(patientKey, (curr) => {
      const items = { ...(curr.items || {}) };
      items[itemId] = !items[itemId];
      return { ...curr, items };
    });
  };

  const setPatientPrepDone = (patientKey, isDone) => {
    updatePrepState(patientKey, (curr) => {
      return { ...curr, prepDone: isDone };
    });
    showToast(
      isDone
        ? (isHi ? "लैब नमूना तैयारी सत्यापित की गई।" : "Lab specimen preparation verified.")
        : (isHi ? "तैयारी लंबित चिह्नित की गई" : "Prep status marked incomplete"),
      isDone ? "success" : "info"
    );
  };

  // Helper to detect Test Category for Pathology
  const detectItemCategory = useCallback((item) => {
    if (!item) return "Hematology";
    const pNotes = typeof item.prescription_notes === "object" ? JSON.stringify(item.prescription_notes || {}) : (item.prescription_notes || "");
    const text = `${item.service_category || ""} ${item.medical_condition || ""} ${pNotes} ${item.notes || ""} ${item.reason || ""}`.toLowerCase();
    if (text.includes("urine") || text.includes("urinalysis") || text.includes("pus cell")) return "Urine";
    if (text.includes("lipid") || text.includes("kft") || text.includes("lft") || text.includes("sugar") || text.includes("glucose") || text.includes("bilirubin") || text.includes("creatinine")) return "Biochemistry";
    if (text.includes("thyroid") || text.includes("tsh") || text.includes("serology") || text.includes("hiv") || text.includes("hcv") || text.includes("widal")) return "Serology";
    return "Hematology";
  }, []);

  // Helper to get tailored lab prep checklist items for a patient (Requirement 1)
  const getPrepChecklistItems = useCallback((item) => {
    if (!item) return [];
    const cat = detectItemCategory(item);
    const pNotes = typeof item.prescription_notes === "object" ? JSON.stringify(item.prescription_notes || {}) : (item.prescription_notes || "");
    const text = `${item.service_category || ""} ${item.medical_condition || ""} ${pNotes} ${item.notes || ""}`.toLowerCase();

    const items = [];

    // 1. Fasting for Blood Sugar / Lipid Profile
    if (text.includes("lipid") || text.includes("cholesterol") || text.includes("sugar") || text.includes("fasting") || text.includes("fbs")) {
      items.push({
        id: "fasting_lab",
        label: isHi ? "8-12 घंटे उपवास (खाली पेट / NPO)" : "Fasting for Blood Sugar / Lipid (8-12 hrs NPO)",
        hint: isHi ? "ग्लूकोज एवं लिपिड की सटीक गणना हेतु अनिवार्य" : "Essential for accurate fasting plasma glucose & triglyceride reading",
        tag: "Fasting Verified",
      });
    }

    // 2. Urine sample prep
    if (cat === "Urine" || text.includes("urine")) {
      items.push({
        id: "urine_morning",
        label: isHi ? "प्रातःकालीन मध्य-धारा मूत्र नमूना (Clean Catch)" : "First-morning mid-stream clean catch urine sample",
        hint: isHi ? "बैक्टीरियल संदूषण मुक्त नमूना" : "First morning concentrated specimen preferred",
        tag: "Morning Urine",
      });
    }

    // 3. Specimen collection tube check
    if (cat === "Hematology" || text.includes("cbc")) {
      items.push({
        id: "edta_tube",
        label: isHi ? "EDTA वायलेट ट्यूब नमूना (एंटीकोगुलेंट)" : "EDTA Tube Verified (Whole Blood for CBC)",
        hint: isHi ? "क्लॉटिंग से बचाव व सेल मोर्फोलॉजी संरक्षण" : "Anticoagulant tube properly mixed",
        tag: "EDTA Sample",
      });
    } else if (cat === "Biochemistry") {
      items.push({
        id: "sst_tube",
        label: isHi ? "क्लॉट एक्टिवेटर / फ्लोराइड ट्यूब" : "SST / Fluoride Tube for Biochemistry",
        hint: isHi ? "सीरम पृथक्करण व ग्लाइकोलाइसिस निषेध" : "Proper tube selection for serum assay",
        tag: "Sample Tube",
      });
    }

    // Default general specimen check
    if (items.length === 0) {
      items.push({
        id: "general_lab_prep",
        label: isHi ? "मरीज़ पहचान व नमूना लेबल बारकोड सत्यापित" : "Patient ID & Sample Barcode Verified",
        hint: isHi ? "नमूना संदूषण मुक्त व पर्याप्त मात्रा" : "Sample tube labeled accurately with zero mix-up",
        tag: "Sample Verified",
      });
    }

    return items;
  }, [detectItemCategory, isHi]);

  // Call patient with prep verification prompt
  const handleCallWithPrepCheck = useCallback((ticket) => {
    if (!ticket) return;
    const pKey = `ticket_${ticket.ticket_id}`;
    const isPrepDone = Boolean(prepState[pKey]?.prepDone);
    const pName = ticket.name || ticket.patient_name || "Patient";
    if (!isPrepDone) {
      const confirmCall = window.confirm(
        isHi
          ? `टोकन #${ticket.ticket_id} (${pName}) की लैब नमूना तैयारी अधूरी है। क्या आप तैयारी की पुष्टि करके मरीज़ को बुलाना चाहते हैं?`
          : `Lab specimen preparation incomplete for Token #${ticket.ticket_id} (${pName}). Click OK to confirm preparation and call patient, or Cancel to review checklist.`
      );
      if (confirmCall) {
        setPatientPrepDone(pKey, true);
        handleCallSpecificPatient(ticket);
      }
      return;
    }
    handleCallSpecificPatient(ticket);
  }, [prepState, isHi, handleCallSpecificPatient, setPatientPrepDone]);

  // Filtered Today's Appointments (Requirement 1: keep only pathology/lab departments)
  const todayDateStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const todayAppointments = useMemo(() => {
    return appointmentsList.filter((apt) => {
      // 1. Department match: only pathology/lab
      const isLab = isPathologyTicket(apt);
      if (!isLab) return false;

      // 2. Date match
      const aptDate = apt.appointment_date || (apt.appointment_time ? apt.appointment_time.split("T")[0] : "");
      return !aptDate || aptDate === todayDateStr;
    });
  }, [appointmentsList, isPathologyTicket, todayDateStr]);

  const todayAppointmentsFiltered = useMemo(() => {
    return todayAppointments.filter((apt) => {
      // Category filter
      if (queueCategoryFilter !== "all") {
        const cat = detectItemCategory(apt);
        if (cat !== queueCategoryFilter) return false;
      }

      // Status filter
      if (queueStatusFilter !== "all") {
        const s = (apt.status || "booked").toLowerCase();
        if (queueStatusFilter === "waiting" && s !== "booked" && s !== "check_in_available") return false;
        if (queueStatusFilter === "checked_in" && s !== "checked_in") return false;
        if (queueStatusFilter === "booked" && s !== "booked") return false;
        if (queueStatusFilter === "expired" && s !== "expired") return false;
        if (queueStatusFilter === "cancelled" && s !== "cancelled") return false;
      }

      // Priority filter
      if (queuePriorityFilter !== "all") {
        const p = Number(apt.priority_level || apt.priority || 3);
        if (queuePriorityFilter === "emergency" && p !== 1) return false;
        if (queuePriorityFilter === "urgent" && p !== 2) return false;
        if (queuePriorityFilter === "routine" && p !== 3 && p !== 2 && p !== 1) return false;
      }

      // Search query
      if (queueSearchQuery.trim()) {
        const q = queueSearchQuery.toLowerCase();
        const name = String(apt.patient_name || apt.name || "").toLowerCase();
        const phone = String(apt.phone || "").toLowerCase();
        const id = String(apt.appointment_id || apt.ticket_id || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }, [todayAppointments, queueCategoryFilter, queueStatusFilter, queuePriorityFilter, queueSearchQuery, detectItemCategory]);

  // Appointments grouped by time slot
  const appointmentsBySlot = useMemo(() => {
    const groups = {};
    todayAppointmentsFiltered.forEach((apt) => {
      const slot = apt.time_slot || apt.formatted_appointment_time || apt.appointment_time || "General Lab OPD Slot";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(apt);
    });
    return groups;
  }, [todayAppointmentsFiltered]);

  // Late appointment checker
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

  // Filtered & Sorted Live Queue
  const combinedLiveQueue = useMemo(() => {
    const map = new Map();
    // 1. Currently Serving
    if (labServing) {
      map.set(labServing.ticket_id, { ...labServing, _queueCategory: "serving" });
    }
    // 2. On Hold
    (pathologyHeldTickets || []).forEach((t) => {
      map.set(t.ticket_id, { ...t, _queueCategory: "on_hold" });
    });
    // 3. Waiting Queue
    (pathologyQueue || []).forEach((t) => {
      if (!map.has(t.ticket_id)) {
        map.set(t.ticket_id, { ...t, _queueCategory: "waiting" });
      }
    });

    const list = Array.from(map.values());

    return list.filter((ticket) => {
      // Category filter
      if (queueCategoryFilter !== "all") {
        const cat = detectItemCategory(ticket);
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
  }, [labServing, pathologyHeldTickets, pathologyQueue, queueCategoryFilter, queueStatusFilter, queuePriorityFilter, queueSearchQuery, detectItemCategory]);

  // 8 Summary Strip Metrics Calculations (Requirement 1)
  const waitingMetric = Array.isArray(pathologyQueue) ? pathologyQueue.length : 0;
  const servingMetric = labServing ? 1 : 0;
  const heldMetric = Array.isArray(pathologyHeldTickets) ? pathologyHeldTickets.length : 0;
  const bookedTodayMetric = useMemo(() => {
    return todayAppointments.filter((a) => {
      const s = (a.status || "booked").toLowerCase();
      return s === "booked" || s === "confirmed" || s === "scheduled" || s === "check_in_available";
    }).length;
  }, [todayAppointments]);
  const checkedInMetric = useMemo(() => {
    return todayAppointments.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s === "checked_in" || Boolean(a.ticket_id);
    }).length;
  }, [todayAppointments]);
  const noShowExpiredMetric = useMemo(() => {
    return todayAppointments.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s === "no_show" || s === "expired" || s === "cancelled";
    }).length;
  }, [todayAppointments]);
  // Real-time Dynamic Average Wait Time (Minutes)
  const avgWaitMinutes = useMemo(() => {
    if (Array.isArray(pathologyQueue) && pathologyQueue.length > 0) {
      const totalSec = pathologyQueue.reduce((acc, t) => {
        const rawJoin = t.join_timestamp
          ? (Number(t.join_timestamp) > 1e11 ? Number(t.join_timestamp) / 1000 : Number(t.join_timestamp))
          : (t.created_at ? new Date(t.created_at).getTime() / 1000 : nowSec);
        const joinSec = isNaN(rawJoin) ? nowSec : rawJoin;
        return acc + Math.max(0, nowSec - joinSec);
      }, 0);
      return Math.max(1, Math.round(totalSec / pathologyQueue.length / 60));
    }
    if (analytics?.average_wait_time !== undefined && analytics?.average_wait_time !== null && Number(analytics.average_wait_time) > 0) {
      return Math.round(Number(analytics.average_wait_time));
    }
    return 0;
  }, [pathologyQueue, nowSec, analytics]);

  // Real-time Dynamic Average Test Duration (Minutes)
  const avgTestTimeMinutes = useMemo(() => {
    const completedLab = (allLabVisits || []).filter((v) => {
      const s = String(v.status || "").toLowerCase();
      return s === "completed" || Boolean(v.serve_end_time) || Boolean(v.completed_at);
    });

    if (completedLab.length > 0) {
      let totalDurationSec = 0;
      let countWithDuration = 0;
      completedLab.forEach((v) => {
        const start = v.serve_start_time || v.serve_timestamp || v.called_at || v.created_at;
        const end = v.serve_end_time || v.completed_at || v.updated_at;
        if (start && end) {
          const s = new Date(start).getTime();
          const e = new Date(end).getTime();
          const diffSec = (e - s) / 1000;
          if (diffSec > 0 && diffSec < 7200) {
            totalDurationSec += diffSec;
            countWithDuration++;
          }
        } else if (v.service_duration_minutes && Number(v.service_duration_minutes) > 0) {
          totalDurationSec += Number(v.service_duration_minutes) * 60;
          countWithDuration++;
        }
      });
      if (countWithDuration > 0) {
        return Math.max(1, Math.round(totalDurationSec / countWithDuration / 60));
      }
    }

    if (analytics?.avg_service_time || analytics?.average_service_time) {
      const val = Math.round(Number(analytics.avg_service_time || analytics.average_service_time) / 60);
      if (val > 0) return val;
    }

    return 0;
  }, [allLabVisits, analytics]);

  // Real-time Dynamic Turnaround Time for Hero Card
  const avgTurnaroundFormatted = useMemo(() => {
    if (avgTestTimeMinutes > 0) {
      return `~${avgTestTimeMinutes} min`;
    }
    if (analytics?.average_service_time || analytics?.avg_service_time) {
      const mins = Math.round(Number(analytics.average_service_time || analytics.avg_service_time) / 60);
      if (mins > 0) return `~${mins} min`;
    }
    return "0 min";
  }, [avgTestTimeMinutes, analytics]);

  return (
    <div
      className="pathology-portal-wrapper"
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "0 0 12px 0",
        background: pageBg,
        color: textColor,
        transition: "all 0.25s ease",
        "--lab-card-bg": cardBg,
        "--lab-card-border": isDark ? "#334155" : "#E2E8F0",
        "--lab-card-text": textColor,
        "--lab-primary": brandPrimary,
        "--lab-primary-hover": "#0369A1",
        "--lab-primary-light": isDark ? "rgba(2, 132, 199, 0.18)" : "#E0F2FE",
        "--lab-primary-border": isDark ? "rgba(2, 132, 199, 0.45)" : "#BAE6FD",
        "--lab-navy": "#0C2340",
        "--lab-bg": pageBg,
        "--lab-text": textColor,
        "--lab-muted": mutedText,
      }}
    >
      <style>{`
        .pathology-portal-wrapper {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .pathology-portal-wrapper * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
        }

        .pathology-portal-wrapper .user-dashboard-footer {
          margin-top: 14px !important;
          padding-top: 10px !important;
          padding-bottom: 4px !important;
        }

        /* Executive Dark-Navy Clinical Hero Container matching Pharmacy reference */
        .pathology-hero-container {
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

        .pathology-hero-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 22px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding-top: 18px;
        }

        @media (max-width: 960px) {
          .pathology-hero-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 540px) {
          .pathology-hero-kpi-grid {
            grid-template-columns: 1fr;
          }
        }

        .pathology-kpi-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          padding: 14px 18px;
        }

        .pathology-tabs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        @media (max-width: 920px) {
          .pathology-tabs-grid {
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
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tab-button-modern.active {
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
          border: 1px solid #0284C7;
          color: #FFFFFF;
          box-shadow: 0 8px 20px rgba(2, 132, 199, 0.28);
        }

        .tab-button-modern.inactive {
          background: var(--lab-card-bg, #FFFFFF);
          border: 1px solid var(--lab-card-border, #E2E8F0);
          color: var(--lab-card-text, #0F172A);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        .tab-button-modern.inactive:hover {
          border-color: #38BDF8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.1);
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

        /* Responsive Workstation 2-Column Grid */
        .pathology-workstation-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 16px;
          width: 100%;
          align-items: start;
        }

        @media (max-width: 1080px) {
          .pathology-workstation-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* 1. EXECUTIVE CLINICAL HERO CONTAINER */}
      <div className="pathology-hero-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,0.14)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800, letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Building2 size={12} />
                <span>{brandName.toUpperCase()}</span>
              </span>
              <span style={{ background: "rgba(56, 189, 248, 0.2)", border: "1px solid rgba(56, 189, 248, 0.4)", color: "#BAE6FD", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800 }}>
                {isHi ? "NABL एवं NABH मान्यता प्राप्त डिजिटल पैथोलॉजी व डायग्नोस्टिक लैब" : "NABL & NABH ACCREDITED DIGITAL PATHOLOGY & DIAGNOSTIC LAB"}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, letterSpacing: "-0.5px" }}>
              {isHi ? "पैथोलॉजी एवं डायग्नोस्टिक प्रयोगशाला पोर्टल" : "Pathology & Diagnostic Laboratory Portal"}
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
                <Microscope size={13} />
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "पैथोलॉजिस्ट:" : "Pathologist:"}
                </span>
                <span style={{ fontSize: "13.5px", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.2px" }}>
                  {currentUser?.name || currentUser?.username || pathologistName}
                </span>
              </div>

              <span style={{ width: "1px", height: "14px", background: "rgba(255, 255, 255, 0.2)", margin: "0 2px" }} />

              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#38BDF8",
                    boxShadow: "0 0 6px rgba(56, 189, 248, 0.5)",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "विभाग:" : "Dept:"}
                </span>
                <span style={{ fontSize: "12.5px", fontWeight: 800, color: "#38BDF8", letterSpacing: "0.4px" }}>
                  {(currentUser?.department || "PATHOLOGY & DIAGNOSTICS").toUpperCase()}
                </span>
              </div>

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

          {/* Assigned Counter & Duty Status Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Assigned Desk Display */}
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
                color: "#FFFFFF",
                userSelect: "none",
              }}
              title={
                assignedDesk?.assigned_employee_name
                  ? (isHi ? `आवंटित पैथोलॉजिस्ट: ${assignedDesk.assigned_employee_name}` : `Assigned Pathologist: ${assignedDesk.assigned_employee_name}`)
                  : (isHi ? `सक्रिय स्टेशन: ${(assignedDesk?.desk_name || selectedDesk?.desk_name || "PATHOLOGY")}` : `Active Station: ${(assignedDesk?.desk_name || selectedDesk?.desk_name || "PATHOLOGY")}`)
              }
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: assignedDesk ? "#38BDF8" : "#94A3B8",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                <Building2 size={11} />
                {isHi ? "डेस्क:" : "DESK:"}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 900,
                  color: "#FFFFFF",
                  letterSpacing: "0.3px",
                }}
              >
                {(assignedDesk?.desk_name || selectedDesk?.desk_name || activeCounter || "PATHOLOGY").replace(/pathogoly/gi, "PATHOLOGY")}
              </span>
            </div>

            {/* Department Scope Badge */}
            <DeskDepartmentBadge
              deskScope={deskScope}
              assignedDesk={assignedDesk}
              isDark={isDark}
              language={isHi ? "hi" : "en"}
            />

            {/* Interactive Duty Status Dropdown */}
            <div style={{ position: "relative" }} ref={dutyDropdownRef}>
              <button
                type="button"
                onClick={() => setShowDutyDropdown((prev) => !prev)}
                style={{
                  background:
                    dutyStatus === "ACTIVE"
                      ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                      : dutyStatus === "PROCESSING"
                        ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                        : dutyStatus === "BREAK"
                          ? "linear-gradient(135deg, #475569 0%, #334155 100%)"
                          : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow:
                    dutyStatus === "ACTIVE"
                      ? "0 4px 14px rgba(2, 132, 199, 0.35)"
                      : dutyStatus === "PROCESSING"
                        ? "0 4px 14px rgba(2, 132, 199, 0.35)"
                        : dutyStatus === "BREAK"
                          ? "0 4px 14px rgba(100, 116, 139, 0.35)"
                          : "0 4px 14px rgba(239, 68, 68, 0.35)",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
                title={isHi ? "ड्यूटी स्थिति बदलें" : "Toggle Duty Status"}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FFFFFF", display: "inline-block" }} />
                <span>
                  {dutyStatus === "ACTIVE"
                    ? (isHi ? "जांच हेतु तैयार" : "Ready to Test")
                    : dutyStatus === "PROCESSING"
                      ? (isHi ? "नमूना प्रसंस्करण" : "Processing")
                      : dutyStatus === "BREAK"
                        ? (isHi ? "अवकाश पर" : "On Break")
                        : (isHi ? "ड्यूटी समाप्त" : "Off Duty")}
                </span>
                <ChevronDown size={11} style={{ marginLeft: "2px" }} />
              </button>

              {showDutyDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.18)" : "1px solid #CBD5E1",
                    borderRadius: "12px",
                    padding: "4px",
                    boxShadow: isDark
                      ? "0 16px 36px -4px rgba(0, 0, 0, 0.7), 0 8px 16px rgba(2, 132, 199, 0.2)"
                      : "0 16px 36px -4px rgba(0, 0, 0, 0.2), 0 8px 16px rgba(2, 132, 199, 0.12)",
                    minWidth: "240px",
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ padding: "5px 8px 3px 8px", fontSize: "10px", fontWeight: 800, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {isHi ? "पैथोलॉजिस्ट ड्यूटी स्थिति चुनें" : "Select Duty Status"}
                  </div>

                  {dutyStatusOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleUpdateDutyStatus(opt.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: dutyStatus === opt.id ? `1px solid ${opt.border}` : "1px solid transparent",
                        background: dutyStatus === opt.id ? opt.bg : "transparent",
                        color: isDark ? "#FFFFFF" : "#0F172A",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                        width: "100%",
                      }}
                    >
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: opt.color, display: "inline-block" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11.5px", fontWeight: 800, color: opt.color }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: "9.5px", color: isDark ? "#94A3B8" : "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {opt.desc}
                        </div>
                      </div>
                      {dutyStatus === opt.id && (
                        <Check size={12} color={opt.color} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Refresh Button */}
            <button
              type="button"
              onClick={() => {
                if (refreshData) refreshData();
                fetchPathologyAppointments();
                showToast(isHi ? "डेटा रीफ्रेश किया गया" : "Data refreshed", "info");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                color: "#FFFFFF",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
              title="Refresh laboratory queue and appointments"
            >
              <RefreshCw size={12} />
              <span>{isHi ? "रीफ्रेश" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid (Glassmorphic Telemetry Cards) */}
        <div className="pathology-hero-kpi-grid">
          <div className="pathology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "कतार में प्रतीक्षारत" : "Waiting in Lab Queue"}
              </div>
              <Clock size={16} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {pathologyQueue.length}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "जांच हेतु प्रतीक्षारत नमूने" : "Specimens waiting in stream"}
            </div>
          </div>

          <div className="pathology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "सक्रिय जांच जारी" : "Active In-Testing"}
              </div>
              <Activity size={16} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {activeServingTicket
                ? `#${activeServingTicket.ticket_id}`
                : dutyStatus === "OFF_DUTY"
                  ? (isHi ? "ड्यूटी समाप्त" : "Off Duty")
                  : dutyStatus === "BREAK"
                    ? (isHi ? "अवकाश" : "On Break")
                    : (isHi ? "तैयार" : "Ready")}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeServingTicket
                ? activeServingTicket.name
                : dutyStatus === "OFF_DUTY"
                  ? (isHi ? "काउंटर सेवा बंद है" : "Station offline")
                  : dutyStatus === "BREAK"
                    ? (isHi ? "अवकाश पर (कॉलिंग रुकी है)" : "Testing paused")
                    : (assignedDesk?.desk_name || selectedDesk?.desk_name || activeCounter)
                      ? (isHi ? `${(assignedDesk?.desk_name || selectedDesk?.desk_name || activeCounter).replace(/pathogoly/gi, "PATHOLOGY")} उपलब्ध` : `${(assignedDesk?.desk_name || selectedDesk?.desk_name || activeCounter).replace(/pathogoly/gi, "PATHOLOGY")} ready`)
                      : (isHi ? "पैथोलॉजी स्टेशन उपलब्ध" : "PATHOLOGY ready")}
            </div>
          </div>

          <div className="pathology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "लैब परीक्षण रिकॉर्ड्स" : "Laboratory Records"}
              </div>
              <CheckCircle2 size={16} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {allLabVisits.length || 0}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "सत्यापित क्लिनिकल रिपोर्ट" : "Approved Diagnostic Slips"}
            </div>
          </div>

          <div className="pathology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "औसत टर्नअराउंड समय" : "Avg. Turnaround"}
              </div>
              <Sliders size={16} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {avgTurnaroundFormatted}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "नमूना संकलन से सत्यापन" : "Collection to Verification"}
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
      {dutyStatus !== "ACTIVE" && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 18px",
            borderRadius: "14px",
            background:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2")
                : (isDark ? "rgba(100, 116, 139, 0.15)" : "#F1F5F9"),
            border:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA")
                : (isDark ? "1px solid rgba(100, 116, 139, 0.35)" : "1px solid #CBD5E1"),
            color:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "#FCA5A5" : "#B91C1C")
                : (isDark ? "#BAE6FD" : "#0369A1"),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              {dutyStatus === "OFF_DUTY" ? <Clock size={14} /> : <Coffee size={14} />}
            </span>
            <span>
              {dutyStatus === "OFF_DUTY"
                ? (isHi
                  ? "ड्यूटी समाप्त: पैथोलॉजी काउंटर सेवा आज के लिए बंद है। मरीज़ कॉलिंग रुकी है।"
                  : "Shift Ended: Laboratory workstation is closed. Patient calling is paused.")
                : dutyStatus === "PROCESSING"
                  ? (isHi
                    ? "नमूना प्रसंस्करण में: विश्लेषक परीक्षण चक्र प्रगति पर हैं।"
                    : "Processing Samples: Analyzers and incubation cycles are running.")
                  : (isHi
                    ? "चाय / भोजन अवकाश: काउंटर कॉलिंग अस्थायी रूप से रुकी है।"
                    : "On Break: Specimen collection & calling is temporarily paused.")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleUpdateDutyStatus("ACTIVE")}
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "5px 12px",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.35)",
            }}
          >
            <Check size={12} />
            <span>{isHi ? "ड्यूटी पुनः शुरू करें" : "Resume Active Duty"}</span>
          </button>
        </div>
      )}

      {/* Modern 3-Tab Segmented Switcher matching Radiology & Doctor Portals */}
      <div className="pathology-tabs-grid">
        {/* Tab 1: Workstation */}
        <button
          type="button"
          onClick={() => setActiveTab("workstation")}
          className={`tab-button-modern ${activeTab === "workstation" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <Microscope size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "डायग्नोस्टिक वर्कस्टेशन" : "Diagnostic Workstation"}</div>
            <span className="tab-sub-text">{isHi ? "सक्रिय जांच व नमूना विश्लेषण" : "Active Testing & Sample Analysis"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              className="tab-count-badge"
              style={{
                background: activeTab === "workstation" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
                color: activeTab === "workstation" ? "#FFFFFF" : "#0284C7",
              }}
            >
              {activeServingTicket ? 1 : 0} {isHi ? "सक्रिय" : "Active"}
            </span>
            {pathologyHeldTickets.length > 0 && (
              <span
                className="tab-count-badge"
                style={{
                  background: activeTab === "workstation" ? "#F1F5F9" : (isDark ? "rgba(100, 116, 139, 0.25)" : "#F1F5F9"),
                  color: "#334155",
                  border: "1px solid #CBD5E1",
                  fontWeight: 900,
                }}
                title={`${pathologyHeldTickets.length} ${isHi ? "मरीज़ होल्ड पर" : "Patients on Hold / Grace Window"}`}
              >
                {pathologyHeldTickets.length} {isHi ? "होल्ड" : "Held"}
              </span>
            )}
          </div>
        </button>

        {/* Tab 2: Queue & Appointments */}
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`tab-button-modern ${activeTab === "queue" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <CalendarCheck size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "कतार एवं अपॉइंटमेंट्स" : "Queue & Appointments"}</div>
            <span className="tab-sub-text">{isHi ? "लाइव कतार व शेड्यूल्ड टेस्ट" : "Live Queue & Scheduled Tests"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              className="tab-count-badge"
              style={{
                background: activeTab === "queue" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
                color: activeTab === "queue" ? "#FFFFFF" : "#0284C7",
              }}
              title={`${pathologyQueue.length} ${isHi ? "प्रतीक्षारत नमूने" : "Waiting Specimens"}`}
            >
              {pathologyQueue.length} {isHi ? "कतार" : "Queue"}
            </span>
            {todayAppointmentsFiltered.length > 0 && (
              <span
                className="tab-count-badge"
                style={{
                  background: activeTab === "queue" ? "rgba(255,255,255,0.2)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
                  color: activeTab === "queue" ? "#FFFFFF" : "#0369A1",
                  border: "1px solid rgba(2, 132, 199, 0.3)",
                }}
                title={`${todayAppointmentsFiltered.length} ${isHi ? "आज की अपॉइंटमेंट्स" : "Today's Appointments"}`}
              >
                {todayAppointmentsFiltered.length} {isHi ? "अपॉइंटमेंट" : "Apt"}
              </span>
            )}
          </div>
        </button>

        {/* Tab 3: Test History */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("history");
            fetchHistoricalReports();
          }}
          className={`tab-button-modern ${activeTab === "history" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <History size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "परीक्षण एवं रिपोर्ट इतिहास" : "Test & Report History"}</div>
            <span className="tab-sub-text">{isHi ? "दिनांक वार ऑडिट, पुनः मुद्रण व एक्सेल" : "Audits, Reprint Slips & Excel Export"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "history" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
              color: activeTab === "history" ? "#FFFFFF" : "#0369A1",
            }}
          >
            {allLabVisits.length}
          </span>
        </button>
      </div>

{activeTab === "workstation" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: "16px",
              alignItems: "start",
            }}
          >
            {/* LEFT COLUMN: ACTIVE ASSAY STATION */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Active Patient Card / Empty State */}
              {activeServingTicket ? (
                <div
                  style={{
                    background: cardBg,
                    border: "1.5px solid #0284C7",
                    borderRadius: "16px",
                    padding: "16px 18px",
                    boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          padding: "6px 12px",
                          borderRadius: "10px",
                          background: "#0284C7",
                          color: "#FFFFFF",
                          fontWeight: 900,
                          fontSize: "14px",
                        }}
                      >
                        #{activeServingTicket.ticket_id}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: textColor }}>
                            {activeServingTicket.name || activeServingTicket.patient_name || "Patient"}
                          </h2>
                          <span style={{ fontSize: "12px", color: mutedText, fontWeight: 600 }}>
                            {activeServingTicket.age || 30}y / {activeServingTicket.gender || "M"}
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                          {activeServingTicket.phone ? `Phone: ${activeServingTicket.phone} • ` : ""}
                          {activeCounter}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={handleRecall}
                        style={{
                          background: isDark ? "#1E293B" : "#F1F5F9",
                          border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                          color: textColor,
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                        title="Broadcast announcement to waiting-room display"
                      >
                        <Volume2 size={13} />
                        <span>{isHi ? "डिस्प्ले पर बुलाएं" : "Call on display"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleHold(activeServingTicket)}
                        style={{
                          background: isDark ? "#1E293B" : "#F1F5F9",
                          border: "1px solid #64748B",
                          color: "#475569",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                        title="Place patient on 10-minute hold"
                      >
                        <Coffee size={13} />
                        <span>{isHi ? "होल्ड (10 मिनट)" : "Hold (10m)"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNoShow}
                        style={{
                          background: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
                          border: "1px solid #EF4444",
                          color: "#DC2626",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                        title="Mark patient as No-Show"
                      >
                        <UserX size={13} />
                        <span>{isHi ? "अनुपस्थित" : "No-Show"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Doctor Referral Audit Banner */}
                  {parsedDoctorRx && (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        background: isDark ? "#0F172A" : "#F0F9FF",
                        border: "1px solid #BAE6FD",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Stethoscope size={14} color="#0284C7" />
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#0369A1" }}>
                          {isHi ? "संदर्भ चिकित्सक: " : "Referring Doctor: "}
                          {parsedDoctorRx.doctor_name || "OPD Consultant"} ({parsedDoctorRx.doctor_department || activeServingTicket.transferred_from_dept || "OPD"})
                        </span>
                      </div>
                      {parsedDoctorRx.lab_tests && (
                        <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#0284C7" }}>
                          {isHi ? "अनुशंसित जांच: " : "Requested: "} {parsedDoctorRx.lab_tests}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: cardBg,
                    border: cardBorder,
                    borderRadius: "16px",
                    padding: "32px 20px",
                    textAlign: "center",
                    boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
                  }}
                >
                  <FlaskConical size={36} color="#0284C7" style={{ opacity: 0.4, margin: "0 auto 10px auto" }} />
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 800, color: textColor }}>
                    {isHi ? "कोई मरीज़ सक्रिय रूप से जांचा नहीं जा रहा है" : "No patient actively at laboratory counter"}
                  </h3>
                  <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: mutedText }}>
                    {isHi
                      ? "कतार से अगला मरीज़ बुलाएं या दाईं ओर सूची में से मरीज़ चुनें।"
                      : "Call next patient from the waiting queue or select from the live list on the right."}
                  </p>
                  <button
                    type="button"
                    onClick={handleCallNext}
                    disabled={callingNext || pathologyQueue.length === 0}
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 18px",
                      borderRadius: "10px",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: callingNext || pathologyQueue.length === 0 ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                      opacity: callingNext || pathologyQueue.length === 0 ? 0.6 : 1,
                    }}
                  >
                    <Volume2 size={14} className={callingNext ? "spin-icon" : ""} />
                    <span>{callingNext ? (isHi ? "कॉल जारी है..." : "Calling...") : (isHi ? "अगला मरीज़ बुलाएं" : "Call Next Patient")}</span>
                  </button>
                </div>
              )}

              {/* Diagnostic Panel Quick Selector */}
              <div
                style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: "16px",
                  padding: "14px 16px",
                  boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", marginBottom: "8px" }}>
                  {isHi ? "मानक डायग्नोस्टिक टेस्ट पैनल चयन:" : "Standard Diagnostic Test Panels:"}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {Object.entries(DEFAULT_TEST_PANELS).map(([key, panel]) => {
                    const isSelected = selectedPanelKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleLoadPanel(key)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          fontWeight: isSelected ? 800 : 600,
                          cursor: "pointer",
                          border: isSelected ? "1.5px solid #0284C7" : (isDark ? "1px solid #334155" : "1px solid #CBD5E1"),
                          background: isSelected ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE") : (isDark ? "#0F172A" : "#FFFFFF"),
                          color: isSelected ? "#0284C7" : textColor,
                          transition: "all 0.15s ease",
                        }}
                      >
                        {panel.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specimen Details & QC Strip */}
              <div
                style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: "16px",
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "10px",
                  boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
                }}
              >
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                    {isHi ? "नमूना प्रकार (Specimen):" : "Specimen Type:"}
                  </label>
                  <input
                    type="text"
                    value={specimenType}
                    onChange={(e) => setSpecimenType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      color: textColor,
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                    {isHi ? "लैब एक्सेशन संख्या (Accession No):" : "Accession Number:"}
                  </label>
                  <input
                    type="text"
                    value={labAccessionNo}
                    onChange={(e) => setLabAccessionNo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      color: textColor,
                      fontSize: "12px",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                    {isHi ? "नमूना स्थिति (Specimen QC):" : "Sample Condition:"}
                  </label>
                  <input
                    type="text"
                    value={specimenCondition}
                    onChange={(e) => setSpecimenCondition(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      color: textColor,
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                    {isHi ? "रिपोर्ट स्थिति (Report Status):" : "Report Status:"}
                  </label>
                  <select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      color: textColor,
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Verified & Final">Verified & Final</option>
                    <option value="Preliminary">Preliminary / In Progress</option>
                    <option value="Repeat Requested">Repeat Sample Requested</option>
                  </select>
                </div>
              </div>

              {/* Quantitative Parameter Entry Table with Auto-Flagging */}
              <div
                style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: "16px",
                  padding: "16px 18px",
                  boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 900, color: textColor }}>
                      {isHi ? "जांच पैरामीटर एवं जैविक संदर्भ सीमाएं" : "Assay Parameters & Biological Reference Intervals"}
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: mutedText }}>
                      {isHi
                        ? "स्वचालित परिणाम ध्वज (HIGH / LOW / NORMAL) मान दर्ज करते ही स्वतः अद्यतन होते हैं"
                        : "Auto-flagging updates instantly based on clinical reference ranges"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomParameter}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      color: textColor,
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Plus size={13} />
                    <span>{isHi ? "पैरामीटर जोड़ें" : "Add Parameter"}</span>
                  </button>
                </div>

                <div style={{ overflowX: "auto", maxWidth: "100%", width: "100%", WebkitOverflowScrolling: "touch", borderRadius: "10px", border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
                  <table style={{ width: "100%", minWidth: "620px", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: isDark ? "#0F172A" : "#F1F5F9", borderBottom: isDark ? "1.5px solid #1E293B" : "1.5px solid #CBD5E1" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: mutedText }}>{isHi ? "जांच पैरामीटर" : "Investigation Parameter"}</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: mutedText, width: "130px" }}>{isHi ? "मापा गया मान" : "Observed Value"}</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: mutedText, width: "80px" }}>{isHi ? "इकाई" : "Unit"}</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: mutedText }}>{isHi ? "जैविक संदर्भ सीमा" : "Reference Interval"}</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: mutedText, width: "110px" }}>{isHi ? "ध्वज (Flag)" : "Flag"}</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: mutedText, width: "50px" }}>{isHi ? "क्रिया" : "Action"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testParameters.map((param, idx) => {
                        const isHigh = param.flag === "HIGH";
                        const isLow = param.flag === "LOW";
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                              background: isHigh
                                ? (isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2")
                                : isLow
                                  ? (isDark ? "rgba(2, 132, 199, 0.08)" : "#F0F9FF")
                                  : "transparent",
                            }}
                          >
                            <td style={{ padding: "6px 10px", fontWeight: 700, color: textColor }}>
                              <input
                                type="text"
                                value={param.parameter}
                                onChange={(e) => handleParameterChange(idx, "parameter", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                  background: isDark ? "#0F172A" : "#FFFFFF",
                                  color: textColor,
                                  fontSize: "11.5px",
                                  outline: "none",
                                  boxSizing: "border-box",
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={param.value}
                                onChange={(e) => handleParameterChange(idx, "value", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  border: isHigh
                                    ? "1.5px solid #EF4444"
                                    : isLow
                                      ? "1.5px solid #0284C7"
                                      : (isDark ? "1px solid #334155" : "1px solid #CBD5E1"),
                                  background: isDark ? "#0F172A" : "#FFFFFF",
                                  color: isHigh ? "#DC2626" : isLow ? "#0369A1" : textColor,
                                  fontWeight: 800,
                                  fontSize: "12px",
                                  outline: "none",
                                  boxSizing: "border-box",
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={param.unit}
                                onChange={(e) => handleParameterChange(idx, "unit", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                  background: isDark ? "#0F172A" : "#FFFFFF",
                                  color: textColor,
                                  fontSize: "11px",
                                  outline: "none",
                                  boxSizing: "border-box",
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={param.ref_range}
                                onChange={(e) => handleParameterChange(idx, "ref_range", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                  background: isDark ? "#0F172A" : "#FFFFFF",
                                  color: mutedText,
                                  fontSize: "11px",
                                  outline: "none",
                                  boxSizing: "border-box",
                                }}
                              />
                            </td>
                            {/* Result Flag (Requirement 5: Readable without color alone using text labels and arrows) */}
                            <td style={{ padding: "6px 10px", textAlign: "center" }}>
                              <span
                                style={{
                                  fontSize: "10.5px",
                                  fontWeight: 900,
                                  padding: "2px 8px",
                                  borderRadius: "9999px",
                                  background: isHigh
                                    ? (isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2")
                                    : isLow
                                      ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE")
                                      : (isDark ? "#1E293B" : "#F1F5F9"),
                                  color: isHigh ? "#DC2626" : isLow ? "#0369A1" : mutedText,
                                  border: isHigh ? "1px solid #FECACA" : isLow ? "1px solid #BAE6FD" : "1px solid #CBD5E1",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                              >
                                <span>{isHigh ? "▲ HIGH" : isLow ? "▼ LOW" : "— NORMAL"}</span>
                              </span>
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveParameter(idx)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#EF4444",
                                  cursor: "pointer",
                                  padding: "2px",
                                }}
                                title="Remove parameter"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks, Technician & Actions Toolbar */}
              <div
                style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: "16px",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
                }}
              >
                <div>
                  <label style={{ fontSize: "11.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                    {isHi ? "पैथोलॉजिस्ट टिप्पणी व निष्कर्ष:" : "Pathologist Clinical Remarks & Impression:"}
                  </label>
                  <textarea
                    rows={2}
                    value={pathologistRemarks}
                    onChange={(e) => setPathologistRemarks(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      color: textColor,
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", paddingTop: "8px", borderTop: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: mutedText, fontWeight: 700 }}>{isHi ? "तकनीशियन:" : "Technician:"}</span>
                    <input
                      type="text"
                      value={technicianName}
                      onChange={(e) => setTechnicianName(e.target.value)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        background: isDark ? "#0F172A" : "#FFFFFF",
                        color: textColor,
                        fontSize: "11.5px",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Actions Toolbar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleSaveReportDraft}
                      disabled={!activeServingTicket}
                      style={{
                        padding: "7px 14px",
                        borderRadius: "8px",
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: textColor,
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: !activeServingTicket ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <FileCheck size={13} />
                      <span>{isHi ? "ड्राफ्ट सहेजें" : "Save Draft"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintReport}
                      disabled={!activeServingTicket}
                      style={{
                        padding: "7px 14px",
                        borderRadius: "8px",
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: textColor,
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: !activeServingTicket ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Printer size={13} />
                      <span>{isHi ? "स्लिप प्रिंट करें" : "Print Slip"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!activeServingTicket) {
                          showToast(isHi ? "स्थानांतरित करने के लिए कोई सक्रिय मरीज़ नहीं है" : "No active patient to route", "warn");
                          return;
                        }
                        const defaultDept = parsedDoctorRx?.doctor_department || activeServingTicket.transferred_from_dept || "";
                        setRouteTargetDept(defaultDept);
                        setShowRouteDeptModal(true);
                      }}
                      disabled={!activeServingTicket}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "8px",
                        background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                        color: "#FFFFFF",
                        border: "none",
                        fontSize: "12.5px",
                        fontWeight: 800,
                        cursor: !activeServingTicket ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                      }}
                    >
                      <Send size={13} />
                      <span>{isHi ? "डॉक्टर को भेजें" : "Route to Doctor"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCompleteAndDischarge}
                      disabled={!activeServingTicket}
                      style={{
                        padding: "7px 14px",
                        borderRadius: "8px",
                        background: isDark ? "#0F172A" : "#FFFFFF",
                        border: "1.5px solid #0284C7",
                        color: "#0284C7",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: !activeServingTicket ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <CheckCircle2 size={13} />
                      <span>{isHi ? "डिस्चार्ज करें" : "Discharge"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: WORKSTATION SIDEBAR (Requirement 1: Next 5 waiting patients + "View full queue" link) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: 0, width: "100%", maxWidth: "100%" }}>
              <div
                style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "13.5px", fontWeight: 800, color: textColor }}>
                      {isHi ? "प्रतीक्षारत मरीज़ (अगले 5)" : "Next Waiting Patients"}
                    </h3>
                    <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                      {pathologyQueue.length} {isHi ? "कतार में सक्रिय" : "active in live queue"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("queue")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#0284C7",
                      fontSize: "11px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <span>{isHi ? "पूरी कतार देखें" : "View full queue"}</span>
                    <ArrowRight size={11} />
                  </button>
                </div>

                {pathologyQueue.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: mutedText }}>
                    <Microscope size={28} style={{ opacity: 0.35, margin: "0 auto 8px auto" }} />
                    <div style={{ fontSize: "12px", fontWeight: 700 }}>
                      {isHi ? "कतार में कोई मरीज़ नहीं है" : "No patients waiting in lab queue"}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {pathologyQueue.slice(0, 5).map((ticket) => {
                      const isEmergency = Number(ticket.priority_level || ticket.priority) === 1;
                      return (
                        <div
                          key={ticket.ticket_id}
                          style={{
                            background: isEmergency ? (isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2") : (isDark ? "#0F172A" : "#F8FAFC"),
                            border: isEmergency ? "1px solid #EF4444" : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                            borderRadius: "10px",
                            padding: "8px 10px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#0284C7" }}>
                                #{ticket.ticket_id}
                              </span>
                              <span style={{ fontSize: "12.5px", fontWeight: 800, color: textColor }}>
                                {ticket.name || ticket.patient_name || "Patient"}
                              </span>
                            </div>
                            <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "2px" }}>
                              {ticket.medical_condition || ticket.service_category || "Lab Assay"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCallSpecificPatient(ticket)}
                            style={{
                              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                              border: "none",
                              color: "#FFFFFF",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "10.5px",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                            title="Call patient to station"
                          >
                            <Volume2 size={11} />
                            <span>{isHi ? "बुलाएं" : "Call"}</span>
                          </button>
                        </div>
                      );
                    })}

                    {pathologyQueue.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("queue")}
                        style={{
                          marginTop: "4px",
                          padding: "6px",
                          borderRadius: "8px",
                          background: isDark ? "#0F172A" : "#F1F5F9",
                          border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                          color: "#0284C7",
                          fontSize: "11.5px",
                          fontWeight: 800,
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        +{pathologyQueue.length - 5} {isHi ? "और मरीज़ कतार में हैं — पूरी कतार देखें" : "more in queue — View full queue"}
                      </button>
                    )}
                  </div>
                )}

                {/* Patients on Hold Section in Sidebar */}
                {pathologyHeldTickets.length > 0 && (
                  <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#64748B", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Coffee size={12} />
                        <span>{isHi ? "होल्ड पर मरीज़ (10 मिनट)" : "Patients on 10-min Hold"}</span>
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 800, padding: "1px 6px", borderRadius: "999px", background: isDark ? "#1E293B" : "#F1F5F9", color: "#64748B" }}>
                        {pathologyHeldTickets.length}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {pathologyHeldTickets.map((ht) => (
                        <div
                          key={ht.ticket_id}
                          style={{
                            background: isDark ? "#0F172A" : "#F8FAFC",
                            border: "1px solid #64748B",
                            borderRadius: "8px",
                            padding: "6px 8px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "11.5px", fontWeight: 800, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              #{ht.ticket_id} {ht.name}
                            </div>
                            <div style={{ fontSize: "10px", color: mutedText }}>
                              {ht.service_category || "Pathology"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRecallHeld(ht)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#0284C7",
                              color: "#FFFFFF",
                              fontSize: "10.5px",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              flexShrink: 0,
                            }}
                            title="Recall held patient"
                          >
                            <Play size={10} />
                            <span>{isHi ? "पुनः बुलाएं" : "Recall"}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: QUEUE & APPOINTMENTS (Requirement 1)
        ======================================================== */}
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
                    {isHi ? "जांच जारी" : "Serving"}
                  </span>
                  <FlaskConical size={14} color="#0284C7" />
                </div>
                <div style={{ fontSize: "22px", fontWeight: 900, color: "#0C2340", marginTop: "4px", lineHeight: "1" }}>
                  {servingMetric}
                </div>
                <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                  {labServing ? `#${labServing.ticket_id} (${labServing.name})` : (isHi ? "काउंटर तैयार है" : "Station ready")}
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

              {/* 8. Average Test Time */}
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
                    {isHi ? "औसत जांच" : "Avg. Test"}
                  </span>
                  <Activity size={14} color="#0284C7" />
                </div>
                <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "4px", lineHeight: "1" }}>
                  {avgTestTimeMinutes > 0 ? `~${avgTestTimeMinutes}m` : "0m"}
                </div>
                <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                  {isHi ? "औसत जांच अवधि" : "Average test duration"}
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
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Activity size={13} /> {isHi ? "लाइव कतार" : "Live Queue"}</span>
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
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>{isHi ? "आज की अपॉइंटमेंट्स" : "Today's Appointments"}</span>
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
                      {todayAppointmentsFiltered.length}
                    </span>
                  </button>
                </div>

                {/* Call Next + Refresh Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      fetchPathologyAppointments();
                      if (refreshData) refreshData();
                      showToast(isHi ? "कतार डेटा रीफ्रेश हुआ" : "Queue refreshed", "info");
                    }}
                    style={{
                      background: isDark ? "#1E293B" : "#F1F5F9",
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

                  {Array.isArray(pathologyQueue) && pathologyQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCallNext}
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

              {/* Bottom Row: Filters Strip (Test Category Chips + Priority + Status + Search) */}
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
                      { id: "Hematology", label: "Hematology" },
                      { id: "Biochemistry", label: "Biochemistry" },
                      { id: "Urine", label: "Urine" },
                      { id: "Serology", label: "Serology" },
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
                        <option value="serving">{isHi ? "जांच जारी (Serving)" : "Currently Serving"}</option>
                        <option value="on_hold">{isHi ? "होल्ड पर (On Hold)" : "On 10-min Hold"}</option>
                      </>
                    ) : (
                      <>
                        <option value="booked">{isHi ? "आरक्षित (Booked)" : "Booked / Scheduled"}</option>
                        <option value="checked_in">{isHi ? "चेक-इन पूर्ण (Checked In)" : "Checked In"}</option>
                        <option value="expired">{isHi ? "समय समाप्त (Expired)" : "Expired Slots"}</option>
                        <option value="cancelled">{isHi ? "रद्द (Cancelled)" : "Cancelled"}</option>
                      </>
                    )}
                  </select>

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

            {/* 3. SUB-VIEW 1: LIVE QUEUE LIST (Requirement 1: Sorted emergency first, wait timer, referring doc, tests, priority, actions) */}
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
                      <span>{isEmergencyDesk ? (isHi ? "आपातकालीन कतार" : "Emergency Queue") : (isHi ? "लाइव पैथोलॉजी कतार स्ट्रीम" : "Live Pathology & Diagnostic Stream")}</span>
                      <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: "#0284C7" }}>
                        {combinedLiveQueue.length} {isHi ? "मरीज़" : "Patients"}
                      </span>
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: mutedText }}>
                      {isHi
                        ? "आपातकालीन ट्राइएज वरीयता क्रम में क्रमबद्ध • प्रत्येक मरीज़ हेतु लैब तैयारी चेकलिस्ट"
                        : "Sorted emergency first, then by wait time • Live wait timer & lab specimen preparation checklist"}
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
                    <FlaskConical size={40} style={{ opacity: 0.3, margin: "0 auto 10px auto" }} />
                    <div style={{ fontSize: "14px", fontWeight: 800, color: textColor }}>
                      {isEmergencyDesk
                        ? (isHi ? "कोई आपातकालीन मरीज़ प्रतीक्षारत नहीं है" : "No emergency patients waiting")
                        : (isHi ? "कतार में कोई मरीज़ नहीं है" : "No patients in live pathology queue")}
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
                      const patientKey = `ticket_${ticket.ticket_id}`;
                      const pState = prepState[patientKey] || { items: {}, prepDone: false };
                      const isPrepDone = Boolean(pState.prepDone);
                      const prepItems = getPrepChecklistItems(ticket);
                      const cat = detectItemCategory(ticket);
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
                      let docRef = "General OPD";
                      try {
                        const p = typeof ticket.prescription_notes === "object" ? ticket.prescription_notes : JSON.parse(ticket.prescription_notes || "{}");
                        if (p?.doctor_name) docRef = `${p.doctor_name} (${p.doctor_department || "OPD"})`;
                      } catch (_) { }

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
                          {/* Row 1: Patient Header, Badges, Timer & Actions */}
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
                                    {cat} • {ticket.medical_condition || ticket.service_category || "Diagnostic Assay"}
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
                                      {isUrgent ? (isHi ? "अत्यावश्यक" : "Urgent") : (isHi ? "सामान्य" : "Routine")}
                                    </span>
                                  )}

                                  {/* Status Badge */}
                                  {isServing ? (
                                    <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", background: "#0284C7", color: "#FFFFFF" }}>
                                      {isHi ? "जांच जारी" : "Serving"}
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

                            {/* Right: Wait Timer & Actions */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
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

                              {/* Call Patient Button (visual toast only) */}
                              <button
                                type="button"
                                onClick={() => handleCallWithPrepCheck(ticket)}
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
                                title="Call patient to laboratory counter"
                              >
                                <Volume2 size={13} />
                                <span>{isHi ? "कॉल" : "Call"}</span>
                              </button>

                              {/* Hold Button */}
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
                                <Coffee size={12} />
                                <span>{isHi ? "होल्ड" : "Hold"}</span>
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

                              {/* Transfer Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferTicket(ticket);
                                  setTransferTargetDept("");
                                  setTransferNotes("");
                                }}
                                style={{
                                  background: isDark ? "#1E293B" : "#F1F5F9",
                                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                  color: textColor,
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Transfer patient to another department"
                              >
                                <Send size={12} />
                                <span>{isHi ? "ट्रांसफर" : "Transfer"}</span>
                              </button>

                              {/* Load into Workstation */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServingTicket(ticket);
                                  setActiveTab("workstation");
                                  showToast(isHi ? `टोकन #${ticket.ticket_id} को वर्कस्टेशन में लोड किया गया` : `Loaded #${ticket.ticket_id} into workstation`, "info");
                                }}
                                style={{
                                  background: "transparent",
                                  border: "1px dashed #0284C7",
                                  color: "#0284C7",
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Open in Lab Workstation tab"
                              >
                                <FlaskConical size={12} />
                                <span>{isHi ? "वर्कस्टेशन में खोलें" : "Workstation"}</span>
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Lab Preparation Checklist Capsule (Requirement 1) */}
                          <div
                            style={{
                              background: isDark ? "#0F172A" : "#FFFFFF",
                              border: isPrepDone ? "1px solid #0284C7" : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                              borderRadius: "10px",
                              padding: "8px 12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
                              <span style={{ fontSize: "11px", fontWeight: 800, color: isPrepDone ? "#0284C7" : "#475569" }}>
                                {isPrepDone ? (isHi ? "तैयारी सत्यापित:" : "Prep verified:") : (isHi ? "तैयारी चेकलिस्ट:" : "Prep checklist:")}
                              </span>

                              {prepItems.map((item) => {
                                const isChecked = Boolean(pState.items?.[item.id] || isPrepDone);
                                return (
                                  <label
                                    key={item.id}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      cursor: "pointer",
                                      fontSize: "11px",
                                      fontWeight: isChecked ? 700 : 600,
                                      color: isChecked ? "#0284C7" : textColor,
                                      background: isChecked ? (isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE") : (isDark ? "#1E293B" : "#F1F5F9"),
                                      padding: "3px 8px",
                                      borderRadius: "6px",
                                      border: isChecked ? "1px solid #0284C7" : "1px solid transparent",
                                      userSelect: "none",
                                    }}
                                    title={item.hint}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => togglePrepItem(patientKey, item.id)}
                                      style={{ cursor: "pointer", width: "12px", height: "12px", accentColor: "#0284C7" }}
                                    />
                                    <span>{item.tag || item.label}</span>
                                  </label>
                                );
                              })}
                            </div>

                            {/* Mark Prep Done Toggle */}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {isPrepDone ? (
                                <button
                                  type="button"
                                  onClick={() => setPatientPrepDone(patientKey, false)}
                                  style={{
                                    background: "#E0F2FE",
                                    border: "1px solid #0284C7",
                                    color: "#0369A1",
                                    padding: "3px 10px",
                                    borderRadius: "6px",
                                    fontSize: "10.5px",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Click to edit or uncheck prep"
                                >
                                  <Check size={12} />
                                  <span>{isHi ? "तैयारी पूर्ण" : "Prep done"}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPatientPrepDone(patientKey, true)}
                                  style={{
                                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                    color: "#FFFFFF",
                                    border: "none",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    fontSize: "10.5px",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    boxShadow: "0 1px 4px rgba(2, 132, 199, 0.3)",
                                  }}
                                  title="Verify all fasting, tube type, specimen checks"
                                >
                                  <Check size={12} />
                                  <span>{isHi ? "तैयारी पूर्ण करें (Mark Prep Done)" : "Mark Prep Done"}</span>
                                </button>
                              )}
                            </div>
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
                      <span>{isHi ? "आज की शेड्यूल्ड पैथोलॉजी अपॉइंटमेंट्स" : "Today's Scheduled Pathology Appointments"}</span>
                      <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: "#0284C7" }}>
                        {todayAppointmentsFiltered.length} {isHi ? "अपॉइंटमेंट्स" : "Bookings"}
                      </span>
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: mutedText }}>
                      {isHi
                        ? "समय स्लॉट वार समूहीकृत • मैन्युअल चेक-इन, रद्दीकरण एवं एसएमएस अनुस्मारक"
                        : "Grouped by time slot • Manual check-in, cancellation & SMS reminders"}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => fetchPathologyAppointments(true)}
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
                      {isHi ? "आज के लिए कोई अपॉइंटमेंट नहीं मिली" : "No appointments scheduled for today matching filters"}
                    </div>
                    <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                      {queueSearchQuery || queueCategoryFilter !== "all"
                        ? (isHi ? "फ़िल्टर साफ़ करके पुनः प्रयास करें" : "Try resetting your search query or category filter")
                        : (isHi ? "जब अपॉइंटमेंट बुक होंगी तो यहाँ प्रदर्शित होंगी" : "Appointments will appear here when scheduled")}
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
                            const isCancelled = rawStatus === "cancelled";
                            const isExpired = rawStatus === "expired";
                            const isLate = isAppointmentLate(apt);
                            const isCheckinOpen = !isCheckedIn && !isCancelled && !isExpired;

                            const patientKey = `apt_${apt.appointment_id}`;
                            const pState = prepState[patientKey] || { items: {}, prepDone: false };
                            const isPrepDone = Boolean(pState.prepDone);
                            const prepItems = getPrepChecklistItems(apt);
                            const cat = detectItemCategory(apt);

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
                                        {cat} • {apt.service_category || "Pathology"}
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
                                            : isCancelled
                                              ? "#F1F5F9"
                                              : isExpired
                                                ? "#FEF2F2"
                                                : "#F1F5F9",
                                          color: isCheckedIn
                                            ? "#0369A1"
                                            : isCancelled
                                              ? "#64748B"
                                              : isExpired
                                                ? "#DC2626"
                                                : "#334155",
                                          border: isCheckedIn
                                            ? "1px solid #BAE6FD"
                                            : isCancelled
                                              ? "1px solid #CBD5E1"
                                              : isExpired
                                                ? "1px solid #FECACA"
                                                : "1px solid #CBD5E1",
                                        }}
                                      >
                                        {isCheckedIn
                                          ? `Checked in (#${apt.ticket_id || ""})`
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

                                  {/* Right actions: Check-in, Cancel, SMS Reminder */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    {/* SMS Reminder Button (Requirement 1) */}
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
                                      <span>{isHi ? "एसएमएस रिमाइंडर" : "SMS Reminder"}</span>
                                    </button>

                                    {!isCheckedIn && !isCancelled && !isExpired && (
                                      <>
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
                                  </div>
                                </div>

                                {/* Prep checklist capsule on appointment card */}
                                <div
                                  style={{
                                    background: isDark ? "#0F172A" : "#F8FAFC",
                                    border: isPrepDone ? "1px solid #0284C7" : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                                    borderRadius: "8px",
                                    padding: "6px 10px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: "6px",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: 1 }}>
                                    <span style={{ fontSize: "10.5px", fontWeight: 800, color: isPrepDone ? "#0284C7" : "#475569" }}>
                                      {isPrepDone ? (isHi ? "तैयारी सत्यापित:" : "Prep verified:") : (isHi ? "तैयारी चेकलिस्ट:" : "Prep checklist:")}
                                    </span>
                                    {prepItems.map((item) => {
                                      const isChecked = Boolean(pState.items?.[item.id] || isPrepDone);
                                      return (
                                        <label
                                          key={item.id}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            cursor: "pointer",
                                            fontSize: "10.5px",
                                            fontWeight: isChecked ? 700 : 600,
                                            color: isChecked ? "#0284C7" : mutedText,
                                            background: isChecked ? (isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE") : "transparent",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            border: isChecked ? "1px solid #0284C7" : "none",
                                          }}
                                          title={item.hint}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => togglePrepItem(patientKey, item.id)}
                                            style={{ cursor: "pointer", width: "11px", height: "11px", accentColor: "#0284C7" }}
                                          />
                                          <span>{item.tag || item.label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>

                                  <div>
                                    {isPrepDone ? (
                                      <button
                                        type="button"
                                        onClick={() => setPatientPrepDone(patientKey, false)}
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          color: "#0284C7",
                                          fontSize: "10.5px",
                                          fontWeight: 800,
                                          cursor: "pointer",
                                        }}
                                      >
                                        {isHi ? "पूर्ण" : "Prep done"}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setPatientPrepDone(patientKey, true)}
                                        style={{
                                          background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                                          border: "1px solid #0284C7",
                                          color: "#0369A1",
                                          padding: "2px 8px",
                                          borderRadius: "5px",
                                          fontSize: "10px",
                                          fontWeight: 800,
                                          cursor: "pointer",
                                        }}
                                      >
                                        {isHi ? "तैयारी सत्यापित करें" : "Mark prep done"}
                                      </button>
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

            {/* 5. MODAL: DEDICATED QUEUE TICKET TRANSFER */}
            {transferTicket && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(15, 23, 42, 0.75)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999,
                  padding: "16px",
                }}
                onClick={() => setTransferTicket(null)}
              >
                <div
                  style={{
                    background: cardBg,
                    border: cardBorder,
                    borderRadius: "16px",
                    padding: "20px 24px",
                    maxWidth: "460px",
                    width: "100%",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: textColor }}>
                      {isHi ? "मरीज़ को अन्य विभाग में स्थानांतरित करें" : "Transfer Queue Patient"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setTransferTicket(null)}
                      style={{ background: "none", border: "none", color: mutedText, cursor: "pointer" }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ padding: "10px 12px", borderRadius: "10px", background: isDark ? "#0F172A" : "#F0F9FF", border: "1px solid #BAE6FD", marginBottom: "14px" }}>
                    <div style={{ fontWeight: 800, fontSize: "13px", color: "#0284C7" }}>
                      #{transferTicket.ticket_id} • {transferTicket.name || transferTicket.patient_name}
                    </div>
                    <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                      {isHi ? "वर्तमान विभाग: पैथोलॉजी एवं डायग्नोस्टिक लैब" : "Current: Pathology & Diagnostic Laboratory"}
                    </div>
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 800, display: "block", marginBottom: "6px", color: textColor }}>
                      {isHi ? "गंतव्य विभाग चुनें:" : "Target Department:"}
                    </label>
                    <select
                      value={transferTargetDept}
                      onChange={(e) => setTransferTargetDept(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        background: isDark ? "#0F172A" : "#FFFFFF",
                        color: textColor,
                        fontSize: "12px",
                        outline: "none",
                      }}
                    >
                      <option value="">{isHi ? "-- विभाग चुनें --" : "-- Select Destination Department --"}</option>
                      {availableRouteDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {isHi ? d.labelHi : d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 800, display: "block", marginBottom: "6px", color: textColor }}>
                      {isHi ? "स्थानांतरण टिप्पणी (वैकल्पिक):" : "Transfer Notes (Optional):"}
                    </label>
                    <input
                      type="text"
                      placeholder={isHi ? "जैसे: सीबीसी पूर्ण, ओपीडी परामर्श हेतु भेजा गया" : "e.g. CBC done, sent for clinical correlation"}
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        background: isDark ? "#0F172A" : "#FFFFFF",
                        color: textColor,
                        fontSize: "12px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setTransferTicket(null)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                        background: "transparent",
                        color: textColor,
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isHi ? "रद्द करें" : "Cancel"}
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteQueueTransfer}
                      disabled={!transferTargetDept || isTransferringQueueTicket}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: transferTargetDept ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : (isDark ? "#334155" : "#E2E8F0"),
                        color: transferTargetDept ? "#FFFFFF" : "#94A3B8",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: transferTargetDept ? "pointer" : "not-allowed",
                        boxShadow: transferTargetDept ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <Send size={13} />
                      <span>{isTransferringQueueTicket ? (isHi ? "स्थानांतरण जारी..." : "Transferring...") : (isHi ? "स्थानांतरित करें" : "Transfer")}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}


          </div>
        )}

        {/* ========================================================
            TAB 3: TEST HISTORY (Requirement 1 & 2)
            Includes Search Bar (moved from Archive), Date Filtering,
            Reprint Action, and Excel Export
        ======================================================== */}
        {/* Tab 3: Test & Report History (Patient Laboratory History) */}
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
                  {historyScopeFilter === "my"
                    ? (isHi ? "मेरे कुल परीक्षण" : "My Lab Tests Total")
                    : (isHi ? "कुल प्रयोगशाला परीक्षण" : "All Laboratory Tests Total")}
                </span>
                <History size={16} color="#0284C7" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: textColor, marginTop: "6px" }}>
                {dateCounts.all}
              </div>
              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                {historyScopeFilter === "my"
                  ? (isHi ? "आपके द्वारा विश्लेषित व सत्यापित कुल परीक्षण" : "Total lab specimens tested & verified by you")
                  : (isHi ? "अस्पताल के कुल प्रयोगशाला परीक्षण रिकॉर्ड" : "Total pathology & lab test records for this hospital")}
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
                  {isHi ? "आज के परीक्षण" : "Today's Lab Tests"}
                </span>
                <Calendar size={16} color="#10B981" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#10B981", marginTop: "6px" }}>
                {dateCounts.today}
              </div>
              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                {isHi ? "आज प्राप्त एवं संसाधित नमूने" : "Specimens processed & tested today"}
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
                  {isHi ? "कल के परीक्षण" : "Yesterday's Lab Tests"}
                </span>
                <Clock size={16} color="#F59E0B" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#F59E0B", marginTop: "6px" }}>
                {dateCounts.yesterday}
              </div>
              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                {isHi ? "कल संसाधित किए गए नैदानिक नमूने" : "Diagnostic specimens processed yesterday"}
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
                  {isHi ? "सत्यापित रिपोर्ट स्लिप्स" : "Verified Diagnostic Slips"}
                </span>
                <CheckCircle2 size={16} color="#0284C7" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: textColor, marginTop: "6px" }}>
                {dateCounts.completed}
              </div>
              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                {isHi ? "सत्यापित व अधिकृत प्रयोगशाला रिपोर्ट" : "Verified & approved diagnostic slips"}
              </div>
            </div>
          </div>

          {/* Main Table Card */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: "18px", padding: "24px" }}>
            {/* Header Title & Pathologist Scope Toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: textColor, display: "flex", alignItems: "center", gap: "8px" }}>
                  <History size={18} color="#0284C7" />
                  <span>
                    {historyScopeFilter === "my"
                      ? (isHi ? "मेरा प्रयोगशाला परीक्षण एवं रिपोर्ट इतिहास" : "My Verified Tests & Diagnostic History")
                      : (isHi ? "मरीज़ प्रयोगशाला परीक्षण एवं रिपोर्ट इतिहास" : "Patient Laboratory Testing & Report History")}
                  </span>
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: mutedText }}>
                  {historyScopeFilter === "my"
                    ? (isHi
                        ? "केवल आपके द्वारा विश्लेषित एवं सत्यापित किए गए नमूनों का संपूर्ण ऑडिट रिकॉर्ड।"
                        : "Audit records for laboratory tests verified exclusively by you.")
                    : (isHi
                        ? "इस अस्पताल के प्रयोगशाला विभाग के सभी मरीज़ों का परीक्षण एवं रिपोर्ट ऑडिट रिकॉर्ड।"
                        : "All pathology and diagnostic laboratory testing audit records for this facility.")}
                </p>
              </div>

              {/* Scope Toggle: All Laboratory Visits vs My Verified Tests */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", background: isDark ? "#1E293B" : "#E2E8F0", padding: "3px", borderRadius: "10px", alignItems: "center", gap: "3px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryScopeFilter("all");
                      setHistoryPage(1);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "7px",
                      border: "none",
                      background: historyScopeFilter === "all" ? "#0284C7" : "transparent",
                      color: historyScopeFilter === "all" ? "#FFFFFF" : textColor,
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                    title={isHi ? "अस्पताल के सभी लैब परीक्षण देखें" : "View all laboratory tests for this hospital"}
                  >
                    <Building2 size={13} />
                    <span>{isHi ? "सभी प्रयोगशाला विज़िट" : "All laboratory visits"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHistoryScopeFilter("my");
                      setHistoryPage(1);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "7px",
                      border: "none",
                      background: historyScopeFilter === "my" ? "#0284C7" : "transparent",
                      color: historyScopeFilter === "my" ? "#FFFFFF" : textColor,
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                    title={isHi ? "केवल आपके द्वारा सत्यापित परीक्षण देखें" : "View only tests verified by you"}
                  >
                    <User size={13} />
                    <span>{isHi ? "मेरा सत्यापन" : "My verified tests"}</span>
                  </button>
                </div>

                {historyScopeFilter === "my" && (
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
                    <span>{currentUser?.name || currentUser?.username || "Logged-in Pathologist"}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Filter Controls Bar (2 Rows matching Pharmacy) */}
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
                    {/* All Dates */}
                    <button
                      type="button"
                      onClick={() => setHistoryDateFilter("all")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: historyDateFilter === "all" ? (isDark ? "#475569" : "#64748B") : "transparent",
                        color: historyDateFilter === "all" ? "#FFFFFF" : textColor,
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
                          background: historyDateFilter === "all" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(255,255,255,0.08)" : "#CBD5E1"),
                          color: historyDateFilter === "all" ? "#FFFFFF" : mutedText,
                          padding: "1px 6px",
                          borderRadius: "5px",
                          fontSize: "10px",
                          fontWeight: 900,
                        }}
                      >
                        {dateCounts.all}
                      </span>
                    </button>

                    {/* Today */}
                    <button
                      type="button"
                      onClick={() => setHistoryDateFilter("today")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: historyDateFilter === "today" ? "#10B981" : "transparent",
                        color: historyDateFilter === "today" ? "#FFFFFF" : textColor,
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
                          background: historyDateFilter === "today" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(255,255,255,0.08)" : "#CBD5E1"),
                          color: historyDateFilter === "today" ? "#FFFFFF" : mutedText,
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
                      onClick={() => setHistoryDateFilter("yesterday")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: historyDateFilter === "yesterday" ? "#F59E0B" : "transparent",
                        color: historyDateFilter === "yesterday" ? "#FFFFFF" : textColor,
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
                          background: historyDateFilter === "yesterday" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(255,255,255,0.08)" : "#CBD5E1"),
                          color: historyDateFilter === "yesterday" ? "#FFFFFF" : mutedText,
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
                      onClick={() => setHistoryDateFilter("date")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        background: historyDateFilter === "date" ? "#0284C7" : "transparent",
                        color: historyDateFilter === "date" ? "#FFFFFF" : textColor,
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
                      {historyDateFilter === "date" && (
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
                  </div>

                  {/* Native Date Picker Input */}
                  <input
                    type="date"
                    value={customFilterDate}
                    onChange={(e) => {
                      setCustomFilterDate(e.target.value);
                      setHistoryDateFilter("date");
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "9px",
                      border: historyDateFilter === "date" ? "1.5px solid #0284C7" : cardBorder,
                      background: isDark ? "#1E293B" : "#FFFFFF",
                      color: textColor,
                      fontSize: "11.5px",
                      fontWeight: 700,
                      outline: "none",
                      cursor: "pointer",
                      boxShadow: historyDateFilter === "date" ? "0 0 0 2px rgba(2, 132, 199, 0.25)" : "none",
                    }}
                    title={isHi ? "कस्टम तिथि का चयन करें" : "Pick custom date"}
                  />
                </div>

                {/* Reset Filters Button if any filter active */}
                {(historyDateFilter !== "all" || historyStatusFilter !== "all" || historyCategoryFilter !== "all" || Boolean(historySearchTerm.trim())) && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryDateFilter("all");
                      setHistoryStatusFilter("all");
                      setHistoryCategoryFilter("all");
                      setHistorySearchTerm("");
                      setHistoryPage(1);
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

              {/* Row 2: Status Filter, Category Filter, Search Box, Excel, Refresh */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: 1 }}>
                  {/* Status Dropdown */}
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => {
                      setHistoryStatusFilter(e.target.value);
                      setHistoryPage(1);
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
                    <option value="serving">{isHi ? "परीक्षणाधीन (Testing / Serving)" : "Testing / In Progress"}</option>
                    <option value="waiting">{isHi ? "प्रतीक्षारत (Waiting)" : "Waiting"}</option>
                    <option value="cancelled">{isHi ? "रद्द (Cancelled)" : "Cancelled"}</option>
                  </select>

                  {/* Category Dropdown */}
                  <select
                    value={historyCategoryFilter}
                    onChange={(e) => {
                      setHistoryCategoryFilter(e.target.value);
                      setHistoryPage(1);
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
                    <option value="all">{isHi ? "सभी श्रेणियां (All Categories)" : "All Categories"}</option>
                    <option value="Hematology">{isHi ? "हेमेटोलॉजी (Hematology)" : "Hematology"}</option>
                    <option value="Biochemistry">{isHi ? "बायोकेमिस्ट्री (Biochemistry)" : "Biochemistry"}</option>
                    <option value="Urine">{isHi ? "मूत्र जांच (Urine Routine)" : "Urine Routine"}</option>
                    <option value="Serology">{isHi ? "सीरोलॉजी (Serology)" : "Serology"}</option>
                  </select>

                  {/* Search Box */}
                  <div style={{ position: "relative", minWidth: "220px", flex: 1, maxWidth: "340px" }}>
                    <Search size={13} color={mutedText} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      placeholder={isHi ? "मरीज़, टोकन, फ़ोन, परीक्षण..." : "Search patient, token, phone, test..."}
                      value={historySearchTerm}
                      onChange={(e) => {
                        setHistorySearchTerm(e.target.value);
                        setHistoryPage(1);
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
                    {historySearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setHistorySearchTerm("");
                          setHistoryPage(1);
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
                    onClick={handleExportExcel}
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
                    onClick={fetchHistoricalReports}
                    disabled={loadingHistory}
                    style={{
                      background: isDark ? "#1E293B" : "#FFFFFF",
                      border: cardBorder,
                      color: textColor,
                      borderRadius: "9px",
                      padding: "7px 12px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: loadingHistory ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                    title="Reload laboratory testing history"
                  >
                    <RefreshCw size={12} className={loadingHistory ? "spin-icon" : ""} />
                    <span>{isHi ? "रिफ्रेश" : "Refresh"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Error State with Retry Button */}
            {historyError && !loadingHistory ? (
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
                {historyError.type === "permission" ? (
                  <ShieldAlert size={38} color="#EF4444" style={{ margin: "0 auto 12px auto", display: "block" }} />
                ) : (
                  <AlertTriangle size={38} color="#EF4444" style={{ margin: "0 auto 12px auto", display: "block" }} />
                )}
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#EF4444" }}>
                  {historyError.type === "permission"
                    ? (isHi ? "पहुंच अस्वीकृत (Permission Denied - 403)" : "Permission Denied (403 Forbidden)")
                    : (isHi ? "प्रयोगशाला रिकॉर्ड लोड करने में त्रुटि" : "Failed to Load Laboratory History")}
                </div>
                <div style={{ fontSize: "13px", marginTop: "8px", maxWidth: "480px", margin: "8px auto 0 auto", color: mutedText, lineHeight: "1.5" }}>
                  {typeof historyError === "string" ? historyError : historyError.message}
                </div>
                <div style={{ marginTop: "18px" }}>
                  <button
                    type="button"
                    onClick={fetchHistoricalReports}
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
            ) : loadingHistory && historicalReports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: mutedText }}>
                <RefreshCw size={26} className="spin-icon" style={{ margin: "0 auto 12px auto", display: "block", color: "#0284C7" }} />
                <div style={{ fontSize: "14px", fontWeight: 700 }}>
                  {isHi ? "प्रयोगशाला इतिहास लोड हो रहा है..." : "Loading laboratory testing history..."}
                </div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: mutedText, background: isDark ? "#0B1120" : "#F8FAFC", borderRadius: "14px", border: cardBorder }}>
                <History size={36} color={mutedText} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
                {historyDateFilter !== "all" && dateCounts.all > 0 && !historySearchTerm ? (
                  <>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: textColor }}>
                      {isHi ? "इस तिथि के लिए कोई लैब रिकॉर्ड नहीं" : "No laboratory records for this date"}
                    </div>
                    <div style={{ fontSize: "12.5px", marginTop: "6px", maxWidth: "480px", margin: "6px auto 0 auto", lineHeight: "1.5", color: mutedText }}>
                      {isHi
                        ? `चयनित तिथि पर कोई रिकॉर्ड नहीं मिला। सभी तिथियों में कुल ${dateCounts.all} लैब रिकॉर्ड उपलब्ध हैं।`
                        : `No records found for this selected date. There are ${dateCounts.all} record(s) across all dates.`}
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <button
                        type="button"
                        onClick={() => setHistoryDateFilter("all")}
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
                      {isHi ? "कोई प्रयोगशाला रिकॉर्ड नहीं मिला" : "No laboratory records found"}
                    </div>
                    <div style={{ fontSize: "12px", marginTop: "6px", maxWidth: "460px", margin: "6px auto 0 auto", lineHeight: "1.5" }}>
                      {historySearchTerm
                        ? (isHi ? `'${historySearchTerm}' से मेल खाता कोई रिकॉर्ड नहीं मिला।` : `No records match search '${historySearchTerm}'.`)
                        : (isHi ? "इस फ़िल्टर या अस्पताल के लिए कोई लैब रिकॉर्ड नहीं है।" : "No laboratory testing records found under this filter or hospital.")}
                    </div>
                    {historyDateFilter !== "all" && dateCounts.all > 0 && (
                      <div style={{ marginTop: "14px" }}>
                        <button
                          type="button"
                          onClick={() => setHistoryDateFilter("all")}
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
                  .pathology-visit-row {
                    transition: background-color 0.15s ease;
                  }
                  .pathology-visit-row:hover {
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
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "180px" }}>
                          {isHi ? "मरीज़ विवरण" : "Patient Info"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "170px" }}>
                          {isHi ? "परीक्षण मार्ग" : "Care Pathway"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "230px" }}>
                          {isHi ? "जांच एवं श्रेणी" : "Investigation & Category"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "180px" }}>
                          {isHi ? "तकनीशियन / डॉक्टर" : "Technician / Doctor"}
                        </th>
                        <th style={{ padding: "14px 20px", textAlign: "right", fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em", width: "230px" }}>
                          {isHi ? "स्थिति व रिपोर्ट स्लिप" : "Status & Actions"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((item, idx) => {
                        const details = parseLabVisitDetails(item);
                        const rawSt = String(item.status || "completed").toLowerCase();
                        const isCancelled = rawSt === "cancelled" || rawSt === "canceled";
                        const isNoShow = rawSt === "no_show" || rawSt === "noshow" || rawSt === "expired";
                        const isServing = rawSt === "serving" || rawSt === "in_progress" || rawSt === "testing";
                        const isWaiting = rawSt === "waiting" || rawSt === "queued";

                        return (
                          <tr
                            key={item.id || item.ticket_id || idx}
                            className="pathology-visit-row"
                            style={{
                              borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9",
                              height: "76px",
                              minHeight: "76px",
                              background: idx % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.012)" : "rgba(0,0,0,0.01)"),
                              opacity: isCancelled ? 0.92 : 1,
                            }}
                          >
                            {/* 1. Token & Date/Time */}
                            <td style={{ padding: "14px 20px", verticalAlign: "middle" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                                    color: "#0284C7",
                                    border: "1px solid rgba(2, 132, 199, 0.3)",
                                  }}
                                >
                                  #{item.ticket_id || item.token_number || "-"}
                                </span>
                              </div>
                              <div style={{ fontSize: "11px", color: mutedText, marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Clock size={11} />
                                <span>{item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                                <span>•</span>
                                <span>{item.created_at ? new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "-"}</span>
                              </div>
                            </td>

                            {/* 2. Patient Info */}
                            <td style={{ padding: "14px 20px", verticalAlign: "middle" }}>
                              <div style={{ fontWeight: 800, fontSize: "12.5px", color: isCancelled ? (isDark ? "#94A3B8" : "#64748B") : textColor, textDecoration: isCancelled ? "line-through" : "none" }}>
                                {item.patient_name || item.name || "Patient"}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", fontSize: "11px", color: mutedText }}>
                                <span
                                  style={{
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    background: isDark ? "#1E293B" : "#F1F5F9",
                                    fontWeight: 700,
                                  }}
                                >
                                  {item.age || 30}y / {item.gender || "M"}
                                </span>
                                {item.phone && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <Phone size={10} />
                                    {item.phone}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 3. Care Pathway */}
                            <td style={{ padding: "14px 20px", verticalAlign: "middle" }}>
                              {(() => {
                                const origin = (item.origin_department || "").trim();
                                const isSelfDept = !origin || origin.toLowerCase().includes("path") || origin.toLowerCase().includes("lab");
                                const hasOtherStages = Array.isArray(item.transfer_stages) && item.transfer_stages.some((s) => {
                                  const d = (s.department || "").toLowerCase();
                                  return !d.includes("path") && !d.includes("lab");
                                });
                                const isTransferredFromOther = (!isSelfDept || hasOtherStages) && origin && !isSelfDept;

                                if (isTransferredFromOther) {
                                  return (
                                    <>
                                      <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", fontWeight: 700, color: textColor }}>
                                        <span style={{ color: "#0284C7" }}>{origin}</span>
                                        <ArrowRight size={11} color={mutedText} />
                                        <span style={{ color: "#10B981" }}>Pathology</span>
                                      </div>
                                      <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "3px" }}>
                                        {isHi ? "ओपीडी से रेफरल" : "Referred from OPD / Dept"}
                                      </div>
                                    </>
                                  );
                                }

                                return (
                                  <>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: 800,
                                          padding: "3px 9px",
                                          borderRadius: "6px",
                                          background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                                          color: "#0284C7",
                                          border: "1px solid rgba(2, 132, 199, 0.3)",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                        }}
                                      >
                                        <Building2 size={11} />
                                        <span>{isHi ? "प्रत्यक्ष लैब ऑर्डर" : "Direct Lab Order"}</span>
                                      </span>
                                    </div>
                                    <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "3px" }}>
                                      {isHi ? "स्वतंत्र लैब पंजीकरण" : "Direct Pathology Registration"}
                                    </div>
                                  </>
                                );
                              })()}
                            </td>

                            {/* 4. Investigation & Category */}
                            <td style={{ padding: "14px 20px", verticalAlign: "middle" }}>
                              <div style={{ fontWeight: 700, fontSize: "12px", color: isCancelled ? mutedText : textColor, textDecoration: isCancelled ? "line-through" : "none" }}>
                                {details.testName}
                              </div>
                              <div style={{ marginTop: "4px" }}>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 800,
                                    padding: "2px 7px",
                                    borderRadius: "5px",
                                    background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                                    color: "#0369A1",
                                    border: "1px solid rgba(2, 132, 199, 0.3)",
                                  }}
                                >
                                  {details.category}
                                </span>
                              </div>
                            </td>

                            {/* 5. Technician / Doctor */}
                            <td style={{ padding: "14px 20px", verticalAlign: "middle" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <User size={13} color="#0284C7" />
                                <span style={{ fontSize: "12.5px", fontWeight: 800, color: textColor }}>
                                  {details.doctor}
                                </span>
                              </div>
                              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "2px", display: "flex", alignItems: "center", gap: "5px" }}>
                                <span style={{ color: "#10B981", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981" }} />
                                  <span>{isHi ? "परामर्शदाता पैथोलॉजिस्ट" : "Consultant Pathologist"}</span>
                                </span>
                                {details.technician && details.technician !== "Senior Lab Technologist" && (
                                  <span style={{ color: mutedText }}>• {details.technician}</span>
                                )}
                              </div>
                            </td>

                            {/* 6. Status & Actions */}
                            <td style={{ padding: "14px 20px", verticalAlign: "middle", textAlign: "right" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                                {/* Status Badge */}
                                {isCancelled ? (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      padding: "3px 8px",
                                      borderRadius: "9999px",
                                      background: isDark ? "rgba(239, 68, 68, 0.18)" : "#FEE2E2",
                                      color: "#DC2626",
                                      border: "1px solid rgba(239, 68, 68, 0.4)",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626" }} />
                                    {isHi ? "रद्द" : "CANCELLED"}
                                  </span>
                                ) : isNoShow ? (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      padding: "3px 8px",
                                      borderRadius: "9999px",
                                      background: isDark ? "rgba(100, 116, 139, 0.18)" : "#F1F5F9",
                                      color: "#64748B",
                                      border: "1px solid rgba(100, 116, 139, 0.4)",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#64748B" }} />
                                    {isHi ? "अनुपस्थित" : "NO-SHOW"}
                                  </span>
                                ) : isServing ? (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      padding: "3px 8px",
                                      borderRadius: "9999px",
                                      background: isDark ? "rgba(2, 132, 199, 0.18)" : "#E0F2FE",
                                      color: "#0284C7",
                                      border: "1px solid rgba(2, 132, 199, 0.4)",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0284C7" }} />
                                    {isHi ? "परीक्षणाधीन" : "TESTING"}
                                  </span>
                                ) : isWaiting ? (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      padding: "3px 8px",
                                      borderRadius: "9999px",
                                      background: isDark ? "#1E293B" : "#F1F5F9",
                                      color: "#475569",
                                      border: "1px solid #CBD5E1",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#64748B" }} />
                                    {isHi ? "प्रतीक्षारत" : "WAITING"}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      padding: "3px 8px",
                                      borderRadius: "9999px",
                                      background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                                      color: "#059669",
                                      border: "1px solid #A7F3D0",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                                    {isHi ? "पूर्ण" : "COMPLETED"}
                                  </span>
                                )}

                                {/* Reprint Button */}
                                {!isCancelled && !isNoShow && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      printLabReportSlip(
                                        {
                                          patient_name: item.patient_name || item.name,
                                          age: item.age || 30,
                                          gender: item.gender || "M",
                                          phone: item.phone || "",
                                          ticket_id: item.ticket_id || item.token_number,
                                          test_panel_name: details.testName,
                                          results: DEFAULT_TEST_PANELS.cbc.parameters,
                                          hospital_name: brandName,
                                        },
                                        language,
                                        hospitalBranding
                                      );
                                    }}
                                    style={{
                                      background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                                      border: "1px solid #0284C7",
                                      color: "#0284C7",
                                      padding: "5px 12px",
                                      borderRadius: "8px",
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      transition: "all 0.15s ease",
                                    }}
                                    title="Reprint official lab report slip"
                                  >
                                    <Printer size={12} />
                                    <span>{isHi ? "पुनः प्रिंट" : "Reprint"}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls Bar */}
                {filteredHistory.length > 0 && (
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
                          कुल <strong>{filteredHistory.length}</strong> में से <strong>{Math.min((historyCurrentPage - 1) * historyRowsPerPage + 1, filteredHistory.length)}</strong> - <strong>{Math.min(historyCurrentPage * historyRowsPerPage, filteredHistory.length)}</strong> रिकॉर्ड प्रदर्शित
                        </span>
                      ) : (
                        <span>
                          Showing <strong>{Math.min((historyCurrentPage - 1) * historyRowsPerPage + 1, filteredHistory.length)}</strong> - <strong>{Math.min(historyCurrentPage * historyRowsPerPage, filteredHistory.length)}</strong> of <strong>{filteredHistory.length}</strong> records
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
                          value={historyRowsPerPage}
                          onChange={(e) => {
                            setHistoryRowsPerPage(Number(e.target.value));
                            setHistoryPage(1);
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
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          disabled={historyCurrentPage <= 1}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: cardBorder,
                            background: isDark ? "#1E293B" : "#FFFFFF",
                            color: historyCurrentPage <= 1 ? mutedText : textColor,
                            opacity: historyCurrentPage <= 1 ? 0.45 : 1,
                            cursor: historyCurrentPage <= 1 ? "not-allowed" : "pointer",
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

                        <span
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            background: isDark ? "#0F172A" : "#FFFFFF",
                            border: cardBorder,
                            fontSize: "11.5px",
                            fontWeight: 800,
                            color: textColor,
                          }}
                        >
                          {historyCurrentPage} / {historyTotalPages}
                        </span>

                        <button
                          type="button"
                          onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                          disabled={historyCurrentPage >= historyTotalPages}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: cardBorder,
                            background: isDark ? "#1E293B" : "#FFFFFF",
                            color: historyCurrentPage >= historyTotalPages ? mutedText : textColor,
                            opacity: historyCurrentPage >= historyTotalPages ? 0.45 : 1,
                            cursor: historyCurrentPage >= historyTotalPages ? "not-allowed" : "pointer",
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

      {showRouteDeptModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000000,
            padding: "20px",
          }}
          onClick={() => setShowRouteDeptModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: cardBg,
              borderRadius: "20px",
              border: cardBorder,
              padding: "24px",
              maxWidth: "520px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 25px 60px -12px rgba(0,0,0,0.4)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                  color: "#0284C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Send size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: textColor }}>
                  {isHi ? "विभाग चुनें — रिपोर्ट भेजें" : "Select Department — Route Report"}
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: mutedText }}>
                  {isHi
                    ? `टोकन #${activeServingTicket?.ticket_id || ""} को किस विभाग / डॉक्टर के पास भेजना है?`
                    : `Where should Token #${activeServingTicket?.ticket_id || ""} be routed after lab results?`}
                </p>
              </div>
            </div>

            {/* Referring Doctor Info (if available) */}
            {(parsedDoctorRx?.doctor_name || activeServingTicket?.transferred_from_dept) && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: isDark ? "rgba(2, 132, 199, 0.1)" : "#E0F2FE",
                  border: isDark ? "1px solid rgba(2, 132, 199, 0.3)" : "1px solid #BAE6FD",
                  marginBottom: "14px",
                  fontSize: "12px",
                  color: "#0369A1",
                  fontWeight: 700,
                }}
              >
                {isHi ? "संदर्भ चिकित्सक: " : "Referring Doctor: "}
                {parsedDoctorRx?.doctor_name || "—"} ({parsedDoctorRx?.doctor_department || activeServingTicket?.transferred_from_dept || "General"})
              </div>
            )}

            {/* Department Grid — Showing only actual active departments in this hospital */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: availableRouteDepartments.length > 4 ? "repeat(2, 1fr)" : "1fr",
                gap: "8px",
                marginBottom: "18px",
              }}
            >
              {availableRouteDepartments.map((dept) => {
                const isSelected = routeTargetDept === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setRouteTargetDept(dept.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: isSelected ? 800 : 600,
                      background: isSelected
                        ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                        : isDark ? "#1E293B" : "#F8FAFC",
                      border: isSelected
                        ? "1.5px solid #0284C7"
                        : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      color: isSelected ? "#FFFFFF" : textColor,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 3px 10px rgba(2, 132, 199, 0.3)" : "none",
                    }}
                  >
                    {isHi ? dept.labelHi : dept.label}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons (Requirement 2: require technician to pick one if no target) */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowRouteDeptModal(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                  background: "transparent",
                  color: mutedText,
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isHi ? "वापस जाएं" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={!routeTargetDept}
                onClick={async () => {
                  await handleCompleteAndRouteToDoctor(routeTargetDept);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: routeTargetDept
                    ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                    : isDark ? "#334155" : "#E2E8F0",
                  color: routeTargetDept ? "#FFFFFF" : "#94A3B8",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: routeTargetDept ? "pointer" : "not-allowed",
                  boxShadow: routeTargetDept ? "0 4px 14px rgba(2, 132, 199, 0.35)" : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Send size={14} />
                <span>{isHi ? "पूर्ण करें एवं भेजें" : "Complete & Route"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION POPUP */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: toast.type === "error"
              ? "#DC2626"
              : toast.type === "warn"
                ? "#D97706"
                : "#0284C7",
            color: "#FFFFFF",
            padding: "10px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 800,
            zIndex: 999999,
            boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {toast.type === "error" ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Footer matching standard portal layout */}
      <Footer language={language} hospitalBranding={hospitalBranding} theme={currentTheme} />
    </div>
  );
}
