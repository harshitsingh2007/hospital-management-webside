/**
 * PathologyPage.jsx
 * -----------------
 * Enterprise Clinical Pathology & Diagnostic Laboratory Workstation.
 * Features:
 * - Real-Time Laboratory Queue & Specimen Collection Stream
 * - Active Test Execution Station with Doctor Referral Audit
 * - Structured Diagnostic Test Report Entry with Biological Reference Intervals & Auto-Flagging
 * - Pre-configured Diagnostic Panels (CBC, Glucose/HbA1c, Lipid, KFT, LFT, Thyroid, Urine Routine)
 * - Printable Hospital-Branded Lab Test Report Slips
 * - Ticket Routing (Discharge or Route back to Referring OPD Doctor)
 * - Historical Lab Archives & Date-Filtered Reports with Excel Export
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { announceTicketVoice } from "../utils/voiceSynthesizer";
import { printLabReportSlip } from "../utils/printPassHelper";
import Footer from "../components/common/Footer";
import {
  FlaskConical,
  TestTube,
  Microscope,
  Activity,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  Search,
  RefreshCw,
  Clock,
  User,
  Stethoscope,
  Building2,
  Sparkles,
  Coffee,
  History,
  Calendar,
  Eye,
  Phone,
  Plus,
  Trash2,
  Shield,
  ArrowRight,
  ChevronDown,
  Check,
  FileCheck,
  Sliders,
  Share2,
  UserCheck,
  Send,
  AlertCircle,
  Pill,
  Volume2
} from "lucide-react";
import * as XLSX from "xlsx";

// Standard Clinical Diagnostic Test Panels with Biological Reference Intervals
const DEFAULT_TEST_PANELS = {
  cbc: {
    id: "cbc",
    name: "Complete Blood Count (CBC)",
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
      { parameter: "Monocytes", value: "5", unit: "%", ref_range: "2 - 8", min: 2, max: 8, flag: "NORMAL" }
    ]
  },
  glucose: {
    id: "glucose",
    name: "Blood Glucose & Glycated Hemoglobin (HbA1c)",
    specimen: "Fluoride Plasma & Whole Blood",
    parameters: [
      { parameter: "Fasting Blood Sugar (FBS)", value: "92", unit: "mg/dL", ref_range: "70 - 99", min: 70, max: 99, flag: "NORMAL" },
      { parameter: "Post-Prandial Blood Sugar (PPBS)", value: "128", unit: "mg/dL", ref_range: "70 - 140", min: 70, max: 140, flag: "NORMAL" },
      { parameter: "HbA1c (Glycated Hemoglobin)", value: "5.4", unit: "%", ref_range: "< 5.7 (Normal), 5.7-6.4 (Pre-diabetes)", min: 4.0, max: 5.6, flag: "NORMAL" },
      { parameter: "Estimated Average Glucose (eAG)", value: "108", unit: "mg/dL", ref_range: "90 - 120", min: 90, max: 120, flag: "NORMAL" }
    ]
  },
  lipid: {
    id: "lipid",
    name: "Lipid Profile (Cardiac Risk Marker)",
    specimen: "Serum (10-12 hrs Fasting)",
    parameters: [
      { parameter: "Total Cholesterol", value: "178", unit: "mg/dL", ref_range: "< 200 (Desirable)", min: 120, max: 200, flag: "NORMAL" },
      { parameter: "Serum Triglycerides", value: "135", unit: "mg/dL", ref_range: "< 150 (Normal)", min: 50, max: 150, flag: "NORMAL" },
      { parameter: "HDL Cholesterol (Good)", value: "48", unit: "mg/dL", ref_range: "> 40 (Optimal)", min: 40, max: 70, flag: "NORMAL" },
      { parameter: "LDL Cholesterol (Bad)", value: "103", unit: "mg/dL", ref_range: "< 100 (Optimal)", min: 50, max: 100, flag: "HIGH" },
      { parameter: "VLDL Cholesterol", value: "27", unit: "mg/dL", ref_range: "< 30", min: 5, max: 30, flag: "NORMAL" },
      { parameter: "Total Cholesterol / HDL Ratio", value: "3.7", unit: "Ratio", ref_range: "3.0 - 5.0", min: 3.0, max: 5.0, flag: "NORMAL" }
    ]
  },
  kft: {
    id: "kft",
    name: "Kidney Function Test (KFT / RFT)",
    specimen: "Serum / Clot Activator",
    parameters: [
      { parameter: "Serum Creatinine", value: "0.92", unit: "mg/dL", ref_range: "0.60 - 1.20", min: 0.6, max: 1.2, flag: "NORMAL" },
      { parameter: "Blood Urea", value: "24.0", unit: "mg/dL", ref_range: "15.0 - 45.0", min: 15.0, max: 45.0, flag: "NORMAL" },
      { parameter: "Blood Urea Nitrogen (BUN)", value: "11.2", unit: "mg/dL", ref_range: "7.0 - 20.0", min: 7.0, max: 20.0, flag: "NORMAL" },
      { parameter: "Serum Uric Acid", value: "5.1", unit: "mg/dL", ref_range: "3.5 - 7.2", min: 3.5, max: 7.2, flag: "NORMAL" },
      { parameter: "Serum Sodium (Na+)", value: "140", unit: "mEq/L", ref_range: "135 - 145", min: 135, max: 145, flag: "NORMAL" },
      { parameter: "Serum Potassium (K+)", value: "4.2", unit: "mEq/L", ref_range: "3.5 - 5.1", min: 3.5, max: 5.1, flag: "NORMAL" }
    ]
  },
  lft: {
    id: "lft",
    name: "Liver Function Test (LFT)",
    specimen: "Serum / Clot Activator",
    parameters: [
      { parameter: "Total Bilirubin", value: "0.80", unit: "mg/dL", ref_range: "0.20 - 1.20", min: 0.2, max: 1.2, flag: "NORMAL" },
      { parameter: "Direct (Conjugated) Bilirubin", value: "0.20", unit: "mg/dL", ref_range: "0.00 - 0.30", min: 0.0, max: 0.3, flag: "NORMAL" },
      { parameter: "SGOT / AST", value: "28", unit: "U/L", ref_range: "< 40", min: 5, max: 40, flag: "NORMAL" },
      { parameter: "SGPT / ALT", value: "32", unit: "U/L", ref_range: "< 45", min: 5, max: 45, flag: "NORMAL" },
      { parameter: "Alkaline Phosphatase (ALP)", value: "88", unit: "U/L", ref_range: "30 - 120", min: 30, max: 120, flag: "NORMAL" },
      { parameter: "Total Serum Protein", value: "7.2", unit: "g/dL", ref_range: "6.4 - 8.3", min: 6.4, max: 8.3, flag: "NORMAL" },
      { parameter: "Serum Albumin", value: "4.3", unit: "g/dL", ref_range: "3.5 - 5.2", min: 3.5, max: 5.2, flag: "NORMAL" }
    ]
  },
  thyroid: {
    id: "thyroid",
    name: "Thyroid Profile (TSH / T3 / T4)",
    specimen: "Serum (Morning Sample Preferred)",
    parameters: [
      { parameter: "TSH (Ultrasensitive)", value: "2.45", unit: "µIU/mL", ref_range: "0.40 - 4.20", min: 0.4, max: 4.2, flag: "NORMAL" },
      { parameter: "Total Triiodothyronine (T3)", value: "1.15", unit: "ng/mL", ref_range: "0.80 - 2.00", min: 0.8, max: 2.0, flag: "NORMAL" },
      { parameter: "Total Thyroxine (T4)", value: "8.2", unit: "µg/dL", ref_range: "5.1 - 14.1", min: 5.1, max: 14.1, flag: "NORMAL" }
    ]
  },
  urine: {
    id: "urine",
    name: "Urine Routine & Microscopic Examination",
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
      { parameter: "Epithelial Cells", value: "Few (1-3)", unit: "/HPF", ref_range: "Few /HPF", min: null, max: null, flag: "NORMAL" }
    ]
  }
};

export default function PathologyPage({
  tenantId,
  currentUser,
  analytics,
  queueSnapshot = [],
  servingTickets = [],
  heldTickets = [],
  handleServeNext = null,
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

  // Tab State: "workstation" (Diagnostic Station) | "archive" (Lab Reports Archive) | "history" (Patient Lab Visit History)
  const [activeTab, setActiveTab] = useState("workstation");

  // Pathologist identity state
  const [pathologistName, setPathologistName] = useState(() => currentUser?.name || currentUser?.username || "Dr. S. Mehta, MD (Pathology)");

  // Desks & Desk Assignment (Assigned by SuperAdmin Portal)
  const [hospitalDesks, setHospitalDesks] = useState([]);
  const [assignedDesk, setAssignedDesk] = useState(null);
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [activeDesk, setActiveDesk] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_pathology_desk");
      return saved || "";
    } catch (_) {
      return "";
    }
  });

  const activeCounter = assignedDesk?.desk_name || activeDesk || (currentUser?.name || "Pathology Station");

  // Fetch Desks from SuperAdmin management API
  const fetchHospitalDesks = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    try {
      const headers = { "Content-Type": "application/json" };
      if (currentUser?.email) headers["X-User-Email"] = currentUser.email;
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${effectiveHospitalCode}/desks`, {
        headers,
      });
      const data = await res.json();
      if (data && data.status === "success" && Array.isArray(data.desks)) {
        setHospitalDesks(data.desks);

        // Match the desk specifically assigned to currentUser by Super Admin
        const currentUserId = Number(currentUser?.id || currentUser?.user_id);
        const currentEmpCode = String(currentUser?.employee_code || currentUser?.employee_id || "").trim().toLowerCase();
        const currentUsername = String(currentUser?.username || "").trim().toLowerCase();
        const currentName = String(currentUser?.name || "").trim().toLowerCase();

        const allDesks = Array.isArray(data.desks) ? data.desks : [];
        const myDesk = allDesks.find((d) => {
          const assignedUserId = Number(d.assigned_user_id);
          const assignedEmpId = Number(d.assigned_employee_id);
          const assignedEmpName = String(d.assigned_employee_name || "").trim().toLowerCase();
          const assignedEmpCode = String(d.assigned_employee_code || "").trim().toLowerCase();

          return (
            (assignedUserId && assignedUserId === currentUserId) ||
            (assignedEmpId && assignedEmpId === currentUserId) ||
            (currentEmpCode && (assignedEmpCode === currentEmpCode || String(assignedEmpId) === currentEmpCode)) ||
            (currentUsername && assignedEmpName && assignedEmpName === currentUsername) ||
            (currentName && assignedEmpName && assignedEmpName === currentName)
          );
        });

        if (myDesk) {
          setAssignedDesk(myDesk);
          setSelectedDesk(myDesk);
          setActiveDesk(myDesk.desk_name);
          try {
            localStorage.setItem("ai_queue_pathology_desk", myDesk.desk_name);
          } catch (_) { }
        } else {
          setAssignedDesk(null);
          setSelectedDesk(null);
          setActiveDesk("");
          try {
            localStorage.removeItem("ai_queue_pathology_desk");
          } catch (_) { }
        }
      }
    } catch (e) {
      console.error("Failed to load desks from superadmin in pathology:", e);
    }
  }, [effectiveHospitalCode, currentUser?.id, currentUser?.user_id, currentUser?.username, currentUser?.email, currentUser?.employee_id, currentUser?.employee_code, currentUser?.name]);

  useEffect(() => {
    fetchHospitalDesks();
  }, [fetchHospitalDesks]);

  const [dutyStatus, setDutyStatus] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_pathology_duty");
      return saved || "ACTIVE";
    } catch (_) {
      return "ACTIVE";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ai_queue_pathology_desk", activeDesk);
      localStorage.setItem("ai_queue_pathology_counter", activeCounter);
    } catch (_) { }
  }, [activeDesk, activeCounter]);

  useEffect(() => {
    try {
      localStorage.setItem("ai_queue_pathology_duty", dutyStatus);
    } catch (_) { }
  }, [dutyStatus]);

  // Theme and Language toggles matching Pharmacy & Doctor Portals
  const handleToggleTheme = () => {
    const next = currentTheme === "dark" ? "light" : "dark";
    setCurrentTheme(next);
    if (setTheme) setTheme(next);
    try {
      localStorage.setItem("ai_queue_theme", next);
      document.body.className = `theme-${next}`;
      document.documentElement.setAttribute("data-theme", next);
    } catch (_) { }
  };


  const [refreshing, setRefreshing] = useState(false);
  const handleManualRefresh = () => {
    setRefreshing(true);
    if (refreshData) refreshData();
    fetchHospitalDesks();
    showToast(isHi ? "कतार व डेस्क डेटा रीफ्रेश हुआ" : "Diagnostic queue & desk status refreshed", "info");
    setTimeout(() => setRefreshing(false), 800);
  };

  const [showDutyDropdown, setShowDutyDropdown] = useState(false);
  const dutyDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dutyDropdownRef.current && !dutyDropdownRef.current.contains(e.target)) {
        setShowDutyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dutyStatusOptions = [
    {
      id: "ACTIVE",
      label: isHi ? "ड्यूटी पर सक्रिय (जांच हेतु तैयार)" : "Active on Duty (Ready to Test)",
      desc: isHi ? "मरीज़ बुलाएं व जांच निष्पादित करें" : "Ready to call patients & run assays",
      color: "#10B981",
      border: "rgba(16, 185, 129, 0.4)",
      bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
      icon: "🟢",
    },
    {
      id: "PROCESSING",
      label: isHi ? "नमूना प्रसंस्करण जारी" : "Processing Samples",
      desc: isHi ? "बायोकेमिस्ट्री/हेमेटोलॉजी विश्लेषक कार्यरत" : "Analyzer incubation & specimen runs in progress",
      color: "#0284C7",
      border: "rgba(2, 132, 199, 0.4)",
      bg: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
      icon: "🔬",
    },
    {
      id: "BREAK",
      label: isHi ? "चाय / भोजन अवकाश" : "On Tea / Meal Break",
      desc: isHi ? "कतार कॉलिंग अस्थायी रूप से रुकी है" : "Specimen collection paused temporarily",
      color: "#F59E0B",
      border: "rgba(245, 158, 11, 0.4)",
      bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB",
      icon: "☕",
    },
    {
      id: "OFF_DUTY",
      label: isHi ? "ड्यूटी समाप्त" : "Shift Ended / Off Duty",
      desc: isHi ? "लैब काउंटर सेवा बंद है" : "Station offline for the day",
      color: "#EF4444",
      border: "rgba(239, 68, 68, 0.4)",
      bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
      icon: "🔴",
    },
  ];

  // Unified Design Tokens matching Pharmacy & Doctor Portals
  const pageBg = isDark ? "#070B14" : "#F8FAFC";
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const cardBorder = isDark ? "1px solid #1E293B" : "1px solid #E2E8F0";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";

  // Notifications
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // Live Duty Status update handler: updates React state, emits socket event, and persists to DB
  const handleUpdateDutyStatus = useCallback((newDutyId) => {
    setDutyStatus(newDutyId);
    setShowDutyDropdown(false);

    try {
      localStorage.setItem("ai_queue_pathology_duty", newDutyId);
    } catch (_) { }

    // Map UI duty status to backend status
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
      note: newDutyId === "PROCESSING" ? "Processing Samples" : "",
    };

    // 1. Emit live over WebSocket to immediately sync SuperAdmin & all monitors
    if (socketRef && socketRef.current) {
      socketRef.current.emit("update_doctor_duty_status", payload);
      socketRef.current.emit("update_staff_duty_status", payload);
    }

    // 2. Persist to backend database via REST API
    const headers = { "Content-Type": "application/json" };
    if (currentUser?.email) headers["X-User-Email"] = currentUser.email;
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
  }, [currentUser, effectiveHospitalCode, pathologistName, socketRef, dutyStatusOptions, isHi, showToast]);

  // Sync duty status live across terminals / from SuperAdmin
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handleIncomingDutyChange = (data) => {
      if (!data) return;
      const staffId = data.doctor_id || data.staff_id || data.user_id || data.employee_id;
      const staffEmail = String(data.doctor_email || data.staff_email || data.email || "").trim().toLowerCase();
      const staffName = String(data.doctor_name || data.staff_name || data.name || "").trim().toLowerCase();
      const currentUserId = currentUser?.id || currentUser?.user_id;
      const currentEmail = String(currentUser?.email || "").trim().toLowerCase();
      const currentName = String(currentUser?.name || currentUser?.username || "").trim().toLowerCase();

      const matches =
        (staffId && String(staffId) === String(currentUserId)) ||
        (staffEmail && currentEmail && staffEmail === currentEmail) ||
        (staffName && currentName && staffName === currentName);

      if (matches) {
        const rawStatus = (data.duty?.status || data.status || "").toUpperCase();
        if (rawStatus === "ON_BREAK") {
          setDutyStatus("BREAK");
          try { localStorage.setItem("ai_queue_pathology_duty", "BREAK"); } catch (_) { }
        } else if (rawStatus === "OFF_DUTY" || rawStatus === "SHIFT_ENDED") {
          setDutyStatus("OFF_DUTY");
          try { localStorage.setItem("ai_queue_pathology_duty", "OFF_DUTY"); } catch (_) { }
        } else if (rawStatus === "PROCESSING") {
          setDutyStatus("PROCESSING");
          try { localStorage.setItem("ai_queue_pathology_duty", "PROCESSING"); } catch (_) { }
        } else if (rawStatus === "ACTIVE") {
          setDutyStatus("ACTIVE");
          try { localStorage.setItem("ai_queue_pathology_duty", "ACTIVE"); } catch (_) { }
        }
      }
    };

    socket.on("doctor_duty_status_changed", handleIncomingDutyChange);
    socket.on("staff_duty_status_changed", handleIncomingDutyChange);

    return () => {
      socket.off("doctor_duty_status_changed", handleIncomingDutyChange);
      socket.off("staff_duty_status_changed", handleIncomingDutyChange);
    };
  }, [socketRef, currentUser]);

  // Filter Pathology & Diagnostic Lab Queue
  const pathologyQueue = useMemo(() => {
    if (!Array.isArray(queueSnapshot)) return [];
    return queueSnapshot.filter((t) => {
      const dept = (t.department || t.department_name || "").toLowerCase();
      const cat = (t.service_category || "").toLowerCase();
      const med = (t.medical_condition || "").toLowerCase();
      const transFrom = (t.transferred_from_dept || "").toLowerCase();

      return (
        dept.includes("path") ||
        dept.includes("lab") ||
        cat.includes("path") ||
        cat.includes("lab") ||
        cat.includes("diagnos") ||
        med.includes("path") ||
        med.includes("lab") ||
        transFrom.includes("path") ||
        transFrom.includes("lab") ||
        (t.prescription_notes && typeof t.prescription_notes === "string" && t.prescription_notes.includes("lab_tests"))
      );
    });
  }, [queueSnapshot]);

  // Selected ticket being actively tested at the station
  const [selectedServingTicket, setSelectedServingTicket] = useState(null);

  // Active Serving Lab Ticket
  const labServing = useMemo(() => {
    if (Array.isArray(servingTickets) && servingTickets.length > 0) {
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

      // Priority 2: Ticket for pathology / laboratory
      const labMatch = servingTickets.find((t) => {
        const dept = (t.department || t.department_name || "").toLowerCase();
        const cat = (t.service_category || "").toLowerCase();
        return dept.includes("path") || dept.includes("lab") || cat.includes("path") || cat.includes("lab") || cat.includes("diagnos");
      });
      if (labMatch) return labMatch;
    }
    return null;
  }, [servingTickets, currentUser, selectedDesk, assignedDesk]);

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
  const [pathologistRemarks, setPathologistRemarks] = useState("Specimen collected and processed under standard laboratory protocols. Biological reference intervals correlated.");
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
        flag: "NORMAL"
      }
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
      } else if (req.includes("sugar") || req.includes("glucose") || req.includes("hba1c") || req.includes("fbs")) {
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

  // Call Next Patient
  const handleCallNext = async () => {
    if (dutyStatus !== "ACTIVE") {
      const opt = dutyStatusOptions.find((o) => o.id === dutyStatus);
      showToast(
        isHi
          ? `आपकी ड्यूटी स्थिति '${opt?.label || dutyStatus}' है। मरीज़ को बुलाने के लिए कृपया स्थिति को 'ड्यूटी पर सक्रिय' में बदलें।`
          : `Duty status is '${opt?.label || dutyStatus}'. Please switch to 'Active on Duty' to call patients.`,
        "warn"
      );
      return;
    }

    if (activeServingTicket) {
      showToast(
        isHi
          ? `आप वर्तमान में टोकन #${activeServingTicket.ticket_id} (${activeServingTicket.name}) की जांच कर रहे हैं। कृपया अगला टोकन बुलाने से पहले यह जांच पूर्ण करें।`
          : `Currently testing Token #${activeServingTicket.ticket_id} (${activeServingTicket.name}). Please complete or route this report before calling next.`,
        "warn"
      );
      return;
    }

    if (pathologyQueue.length === 0) {
      showToast(
        isHi ? "पैथोलॉजी कतार में कोई मरीज़ प्रतीक्षारत नहीं है।" : "No patients waiting in the lab queue.",
        "info"
      );
      return;
    }

    setCallingNext(true);
    const payload = {
      tenant_id: effectiveHospitalCode,
      department: "laboratory",
      service_category: "laboratory",
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
          isHi ? "अगले पैथोलॉजी मरीज़ को पुकारा जा रहा है..." : "Calling next pathology patient...",
          "info"
        );
      } else {
        const res = await fetch(`${API_BASE}/api/v1/plugin/serve-next`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(currentUser?.email ? { "X-User-Email": currentUser.email } : {}),
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
          announceTicketVoice(labTicket, language);
          showToast(
            isHi
              ? `टोकन #${data.ticket.ticket_id} (${data.ticket.name}) को पैथोलॉजी स्टेशन पर बुलाया गया!`
              : `Called Token #${data.ticket.ticket_id} (${data.ticket.name}) to Pathology Station!`,
            "success"
          );

          // Broadcast announcement across all tabs and windows
          try {
            if (typeof BroadcastChannel !== "undefined") {
              const bc = new BroadcastChannel("hospital_live_queue_sync");
              bc.postMessage({ type: "now_serving", ticket: labTicket, tenant_id: effectiveHospitalCode });
              bc.close();
            }
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("now_serving", { detail: { ticket: labTicket } }));
            }
          } catch (e) { }
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
          ? `आपकी ड्यूटी स्थिति '${opt?.label || dutyStatus}' है। कृपया पहले स्थिति को 'ड्यूटी पर सक्रिय' करें।`
          : `Duty status is '${opt?.label || dutyStatus}'. Please switch to 'Active on Duty' first.`,
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
    announceTicketVoice(labTicket, language);
    showToast(
      isHi
        ? `टोकन #${ticket.ticket_id} (${ticket.name}) को जांच हेतु काउंटर पर बुलाया गया!`
        : `Token #${ticket.ticket_id} (${ticket.name}) called to Pathology Counter!`,
      "success"
    );

    // 1. Emit live announcement via WebSocket to sync Staff Portal & Waiting Room TV
    if (socketRef && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("re_announce", {
        tenant_id: effectiveHospitalCode,
        ticket: labTicket,
        ticket_id: ticket.ticket_id,
        doctor_name: currentUser?.name || currentUser?.username || pathologistName,
      });
    }

    // 2. Broadcast via REST endpoint as reliable fallback
    fetch(`${API_BASE}/api/v1/plugin/re-announce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: effectiveHospitalCode,
        ticket_id: ticket.ticket_id,
        ticket: labTicket,
      }),
    }).catch(() => { });

    // 3. Cross-Tab & In-Window Real-time Broadcast
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("hospital_live_queue_sync");
        bc.postMessage({
          type: "now_serving",
          ticket: labTicket,
          tenant_id: effectiveHospitalCode,
        });
        bc.close();
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("now_serving", { detail: { ticket: labTicket } }));
        window.dispatchEvent(new CustomEvent("ticket_called", { detail: { ticket: labTicket } }));
      }
    } catch (e) { }

    if (refreshData) refreshData();
  };

  // Listen to queue serve errors
  useEffect(() => {
    const handleServeErrEvent = (e) => {
      const msg = e.detail?.message;
      if (msg) {
        showToast(msg, "error");
        setCallingNext(false);
      }
    };
    window.addEventListener("queue_serve_error", handleServeErrEvent);
    return () => window.removeEventListener("queue_serve_error", handleServeErrEvent);
  }, [showToast]);

  // Real-time socket listener for incoming ticket calls and serve errors
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handleNowServing = (data) => {
      if (data && data.ticket) {
        const t = data.ticket;
        const dept = (t.department_name || t.department || "").toLowerCase();
        const cat = (t.service_category || "").toLowerCase();
        const myId = currentUser?.id || currentUser?.user_id;
        const isMine = myId && t.served_by_doctor_id && String(t.served_by_doctor_id) === String(myId);
        const isLab = isMine || dept.includes("path") || dept.includes("lab") || cat.includes("path") || cat.includes("lab") || cat.includes("diagnos");

        if (isLab) {
          const labTicket = {
            ...t,
            service_category: "LABORATORY",
          };
          setSelectedServingTicket(labTicket);
          announceTicketVoice(labTicket, language);
          showToast(
            isHi
              ? `टोकन #${t.ticket_id} (${t.name}) को पैथोलॉजी काउंटर पर बुलाया गया!`
              : `Token #${t.ticket_id} (${t.name}) called to Pathology Counter!`,
            "success"
          );
          setCallingNext(false);
          try {
            if (typeof BroadcastChannel !== "undefined") {
              const bc = new BroadcastChannel("hospital_live_queue_sync");
              bc.postMessage({ type: "now_serving", ticket: labTicket, tenant_id: effectiveHospitalCode });
              bc.close();
            }
          } catch (e) { }
          if (refreshData) refreshData();
        }
      }
    };

    const handleSocketServeErr = (data) => {
      if (data && data.message) {
        showToast(data.message, "error");
        setCallingNext(false);
      }
    };

    socket.on("now_serving", handleNowServing);
    socket.on("serve_error", handleSocketServeErr);

    return () => {
      socket.off("now_serving", handleNowServing);
      socket.off("serve_error", handleSocketServeErr);
    };
  }, [socketRef, currentUser, isHi, language, showToast, refreshData]);

  // Re-announce / Recall Active Patient
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

    // Call REST endpoint
    fetch(`${API_BASE}/api/v1/plugin/re-announce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: effectiveHospitalCode,
        ticket_id: activeServingTicket.ticket_id,
        ticket: labTicket,
      }),
    }).catch(() => { });

    // Broadcast across browser tabs/windows
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("hospital_live_queue_sync");
        bc.postMessage({
          type: "now_serving",
          ticket: labTicket,
          tenant_id: effectiveHospitalCode,
        });
        bc.close();
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("now_serving", { detail: { ticket: labTicket } }));
        window.dispatchEvent(new CustomEvent("ticket_called", { detail: { ticket: labTicket } }));
      }
    } catch (e) { }

    announceTicketVoice(labTicket, language);
    showToast(
      isHi
        ? `टोकन #${activeServingTicket.ticket_id} (${activeServingTicket.name}) की कॉल लाउडस्पीकर पर पुनः प्रसारित की गई!`
        : `Token #${activeServingTicket.ticket_id} (${activeServingTicket.name}) re-announced on loudspeaker!`,
      "info"
    );
  };

  // Hold Ticket (10-min Grace Period)
  const handleHold = () => {
    if (!activeServingTicket) return;
    if (socketRef && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("hold_ticket", {
        tenant_id: effectiveHospitalCode,
        ticket_id: activeServingTicket.ticket_id,
        grace_minutes: 10,
      });
    }
    setSelectedServingTicket(null);
    showToast(
      isHi
        ? `टोकन #${activeServingTicket.ticket_id} को 10 मिनट होल्ड पर रखा गया।`
        : `Token #${activeServingTicket.ticket_id} placed on 10-minute hold.`,
      "warn"
    );
    if (refreshData) refreshData();
  };

  // Mark No-Show
  const handleNoShow = () => {
    if (!activeServingTicket) return;
    if (socketRef && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("mark_noshow", {
        tenant_id: effectiveHospitalCode,
        ticket_id: activeServingTicket.ticket_id,
        reason: "Patient did not appear for specimen collection",
      });
    }
    setSelectedServingTicket(null);
    showToast(
      isHi
        ? `टोकन #${activeServingTicket.ticket_id} को अनुपस्थित (No-Show) चिह्नित किया गया।`
        : `Token #${activeServingTicket.ticket_id} marked as no-show.`,
      "error"
    );
    if (refreshData) refreshData();
  };

  // Build Diagnostic Report Payload
  const buildReportPayload = () => {
    const panel = DEFAULT_TEST_PANELS[selectedPanelKey] || { name: "Clinical Pathology Investigation" };
    return {
      test_panel_name: panel.name,
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
        showToast(isHi ? "जांच रिपोर्ट सफलतापूर्वक सहेजी गई ✓" : "Diagnostic report saved successfully ✓", "success");
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
      clinical_diagnosis: parsedDoctorRx?.diagnosis || activeServingTicket.medical_condition || "Clinical Assessment",
      hospital_name: brandName,
    };

    printLabReportSlip(fullReportData, language, hospitalBranding);
  };

  // Complete and Route Back to Referring Doctor
  const handleCompleteAndRouteToDoctor = async () => {
    if (!activeServingTicket) return;

    try {
      const reportPayload = buildReportPayload();
      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        lab_report: reportPayload,
        lab_completed_at: new Date().toISOString(),
      };

      const targetDept = parsedDoctorRx?.doctor_department || activeServingTicket.transferred_from_dept || "consultation";

      const res = await fetch(`${API_BASE}/api/v1/plugin/transfer-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          target_department: targetDept,
          prescription_notes: JSON.stringify(mergedNotes),
        }),
      });

      if (res.ok) {
        setSelectedServingTicket(null);
        showToast(
          isHi
            ? `जांच पूर्ण! मरीज़ को परिणाम सहित डॉ. के पास वापस स्थानांतरित किया गया ✓`
            : `Testing complete! Patient routed back to Doctor with report ✓`,
          "success"
        );
        if (refreshData) refreshData();
      } else {
        throw new Error("Failed to route ticket");
      }
    } catch (e) {
      showToast(isHi ? "स्थानांतरण में त्रुटि" : "Error routing patient back to doctor", "error");
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
        await fetch(`${API_BASE}/api/v1/plugin/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(currentUser?.email ? { "X-User-Email": currentUser.email } : {}),
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
          ? `टोकन #${activeServingTicket.ticket_id} की जांच पूर्ण एवं डिस्चार्ज सफल ✓`
          : `Token #${activeServingTicket.ticket_id} test completed & discharged ✓`,
        "success"
      );
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? "डिस्चार्ज में त्रुटि" : "Error completing ticket", "error");
    }
  };

  // Historical Records & Date Filtering
  const [historyDateFilter, setHistoryDateFilter] = useState("today"); // "today" | "yesterday" | "date" | "all"
  const [customFilterDate, setCustomFilterDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historicalReports, setHistoricalReports] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistoricalReports = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/patient-history?hospital_id=${effectiveHospitalCode}`);
      const data = await res.json();
      if (data && Array.isArray(data.visits)) {
        setHistoricalReports(data.visits);
      } else {
        // Fallback or empty
        setHistoricalReports([]);
      }
    } catch (e) {
      console.log("History fetch error:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [effectiveHospitalCode]);

  useEffect(() => {
    if (activeTab === "history" || activeTab === "archive") {
      fetchHistoricalReports();
    }
  }, [activeTab, fetchHistoricalReports]);

  // Filtered Historical Records
  const filteredHistory = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = yestDate.toISOString().split("T")[0];

    return historicalReports.filter((item) => {
      const itemDate = item.created_at ? item.created_at.split("T")[0] : "";
      if (historyDateFilter === "today" && itemDate !== todayStr) return false;
      if (historyDateFilter === "yesterday" && itemDate !== yestStr) return false;
      if (historyDateFilter === "date" && itemDate !== customFilterDate) return false;

      if (historySearchTerm) {
        const q = historySearchTerm.toLowerCase();
        const name = (item.patient_name || item.name || "").toLowerCase();
        const tid = String(item.ticket_id || "").toLowerCase();
        const phone = String(item.phone || "");
        if (!name.includes(q) && !tid.includes(q) && !phone.includes(q)) return false;
      }

      return true;
    });
  }, [historicalReports, historyDateFilter, customFilterDate, historySearchTerm]);

  // Excel Export
  const handleExportExcel = () => {
    if (filteredHistory.length === 0) {
      showToast(isHi ? "निर्यात करने हेतु कोई डेटा उपलब्ध नहीं" : "No records to export", "warn");
      return;
    }

    const rows = filteredHistory.map((item, idx) => ({
      "S.No": idx + 1,
      "Date": item.created_at ? new Date(item.created_at).toLocaleDateString() : "",
      "Token ID": item.ticket_id || "",
      "Patient Name": item.patient_name || item.name || "",
      "Age / Gender": `${item.age || "-"} / ${item.gender || "-"}`,
      "Contact": item.phone || "",
      "Test / Condition": item.medical_condition || item.service_category || "Diagnostic Assay",
      "Status": item.status || "Completed"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lab_Records");
    XLSX.writeFile(wb, `Pathology_Records_${historyDateFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(isHi ? "एक्सेल स्प्रेडशीट डाउनलोड हो गई ✓" : "Excel spreadsheet exported successfully ✓", "success");
  };

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
        "--path-card-bg": cardBg,
        "--path-card-border": isDark ? "#1E293B" : "#E2E8F0",
        "--path-card-text": textColor,
      }}
    >
      {/* Embedded CSS Style Rules matching Doctor & Pharmacy Portals */}
      <style>{`
        .pathology-portal-wrapper * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .pathology-portal-wrapper .user-dashboard-footer {
          margin-top: 16px !important;
          margin-bottom: 0px !important;
          padding-top: 16px !important;
          padding-bottom: 16px !important;
        }

        /* Executive Dark-Navy Clinical Hero Container */
        .pathology-hero-container {
          background: radial-gradient(circle at 10% 15%, rgba(2, 132, 199, 0.28) 0%, transparent 45%),
                      radial-gradient(circle at 90% 85%, rgba(56, 189, 248, 0.18) 0%, transparent 50%),
                      linear-gradient(135deg, #090F1E 0%, #0F172A 60%, #162447 100%);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 20px;
          padding: 20px 24px;
          color: #FFFFFF;
          box-shadow: 0 16px 36px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(56, 189, 248, 0.18);
          margin-bottom: 16px;
          position: relative;
          overflow: hidden;
        }

        .pathology-hero-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding-top: 12px;
        }

        @media (max-width: 960px) {
          .pathology-hero-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }

        @media (max-width: 540px) {
          .pathology-hero-kpi-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }

        .pathology-kpi-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          padding: 10px 14px;
        }

        .pathology-tabs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        @media (max-width: 920px) {
          .pathology-tabs-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }

        .tab-button-modern {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          min-height: 58px;
          box-sizing: border-box;
          border-radius: 14px;
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
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.28);
        }

        .tab-button-modern.inactive {
          background: var(--path-card-bg, #FFFFFF);
          border: 1px solid var(--path-card-border, #E2E8F0);
          color: var(--path-card-text, #0F172A);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        .tab-button-modern.inactive:hover {
          border-color: #38BDF8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.1);
        }

        .tab-icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 10px;
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
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.2px;
          line-height: 1.2;
        }

        .tab-sub-text {
          font-size: 10.5px;
          font-weight: 600;
          display: block;
          margin-top: 1px;
          opacity: 0.85;
        }

        .tab-count-badge {
          font-size: 10.5px;
          font-weight: 800;
          padding: 2px 7px;
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

        @media (max-width: 1024px) {
          .pathology-workstation-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spinSlow 0.9s linear infinite;
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 20px",
            borderRadius: "14px",
            background:
              toast.type === "error"
                ? "#EF4444"
                : toast.type === "warn"
                  ? "#F59E0B"
                  : toast.type === "info"
                    ? brandPrimary
                    : "#10B981",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "13px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: "8px", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}


      {/* Executive Dark-Navy Clinical Hero Container */}
      <div className="pathology-hero-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,0.14)", padding: "3px 8px", borderRadius: "6px", fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Building2 size={12} />
                <span>{brandName.toUpperCase()}</span>
              </span>
              <span style={{ background: "rgba(56, 189, 248, 0.2)", border: "1px solid rgba(56, 189, 248, 0.4)", color: "#BAE6FD", padding: "3px 8px", borderRadius: "6px", fontSize: "10.5px", fontWeight: 800 }}>
                {isHi ? "एनबीएल मान्यता प्राप्त केंद्रीय पैथोलॉजी व डायग्नोस्टिक लैब" : "NABL ACCREDITED CENTRAL PATHOLOGY & DIAGNOSTIC LAB"}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 900, letterSpacing: "-0.4px", lineHeight: "1.2" }}>
              {isHi ? "पैथोलॉजी एवं डायग्नोस्टिक प्रयोगशाला पोर्टल" : "Pathology & Diagnostic Laboratory Portal"}
            </h1>

            {/* Highlighted Staff & Department One-Liner Glass Capsule */}
            <div
              style={{
                marginTop: "8px",
                display: "inline-flex",
                alignItems: "center",
                flexWrap: "nowrap",
                gap: "8px",
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.6) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.45)",
                borderRadius: "30px",
                padding: "3px 10px 3px 5px",
                backdropFilter: "blur(12px)",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)",
                maxWidth: "100%",
              }}
            >
              {/* Avatar Icon */}
              <div
                style={{
                  width: "22px",
                  height: "22px",
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
                <Microscope size={12} />
              </div>

              {/* Staff Name */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "पैथोलॉजिस्ट:" : "Pathologist:"}
                </span>
                <span style={{ fontSize: "12.5px", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.2px" }}>
                  {currentUser?.name || currentUser?.username || pathologistName || "Dr. S. Mehta, MD (Pathology)"}
                </span>
              </div>

              {/* Subtle Divider */}
              <span style={{ width: "1px", height: "12px", background: "rgba(255, 255, 255, 0.2)", margin: "0 1px" }} />

              {/* Department */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#34D399",
                    boxShadow: "0 0 6px #10B981",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "विभाग:" : "Dept:"}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#34D399", letterSpacing: "0.3px" }}>
                  {(currentUser?.department || "PATHOLOGY & DIAGNOSTICS").toUpperCase()}
                </span>
              </div>

              {/* Staff ID Pill if available */}
              {(currentUser?.employee_code || currentUser?.employee_id || currentUser?.id) && (
                <>
                  <span style={{ width: "1px", height: "12px", background: "rgba(255, 255, 255, 0.2)", margin: "0 1px" }} />
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "rgba(255, 255, 255, 0.75)",
                      fontFamily: "monospace",
                      background: "rgba(255, 255, 255, 0.08)",
                      padding: "1px 5px",
                      borderRadius: "4px",
                    }}
                  >
                    ID: {currentUser?.employee_code || currentUser?.employee_id || currentUser?.id}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Assigned Counter & Duty Status Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Assigned Desk Display (Assigned by SuperAdmin Portal) */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: assignedDesk
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(245, 158, 11, 0.14)",
                border: assignedDesk
                  ? "1px solid rgba(255, 255, 255, 0.25)"
                  : "1px solid rgba(245, 158, 11, 0.4)",
                borderRadius: "10px",
                padding: "6px 12px",
                backdropFilter: "blur(8px)",
                color: "#FFFFFF",
                userSelect: "none",
              }}
              title={
                assignedDesk
                  ? (isHi ? `सुपरएडमिन द्वारा आवंटित डेस्क: ${assignedDesk.desk_name}` : `Assigned Desk: ${assignedDesk.desk_name} (Allocated in SuperAdmin Portal)`)
                  : (isHi ? "सुपरएडमिन पोर्टल द्वारा कोई डेस्क आवंटित नहीं है" : "No desk assigned in SuperAdmin portal")
              }
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: assignedDesk ? "#38BDF8" : "#FBBF24",
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
                  color: assignedDesk ? "#FFFFFF" : "#FDE68A",
                  letterSpacing: "0.3px",
                }}
              >
                {assignedDesk?.desk_name || (isHi ? "अनअसाइंड" : "Unassigned")}
              </span>
            </div>

            {/* Interactive Duty Status Dropdown */}
            <div style={{ position: "relative" }} ref={dutyDropdownRef}>
              <button
                type="button"
                onClick={() => setShowDutyDropdown((prev) => !prev)}
                style={{
                  background:
                    dutyStatus === "ACTIVE"
                      ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                      : dutyStatus === "PROCESSING"
                        ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                        : dutyStatus === "BREAK"
                          ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
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
                      ? "0 4px 14px rgba(16, 185, 129, 0.35)"
                      : dutyStatus === "PROCESSING"
                        ? "0 4px 14px rgba(2, 132, 199, 0.35)"
                        : dutyStatus === "BREAK"
                          ? "0 4px 14px rgba(245, 158, 11, 0.35)"
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
                <span style={{ fontSize: "9px", opacity: 0.85, marginLeft: "2px" }}>▼</span>
              </button>

              {/* Duty Status Options Menu */}
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
                    zIndex: 9999,
                    minWidth: "240px",
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
                      <span style={{ fontSize: "13px" }}>{opt.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11.5px", fontWeight: 800, color: opt.color }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: "9.5px", color: isDark ? "#94A3B8" : "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {opt.desc}
                        </div>
                      </div>
                      {dutyStatus === opt.id && (
                        <span style={{ color: opt.color, fontSize: "11px", fontWeight: 900 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Refresh Button */}
            <button
              type="button"
              onClick={handleManualRefresh}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                borderRadius: "10px",
                padding: "6px 12px",
                backdropFilter: "blur(8px)",
                color: "#FFFFFF",
                cursor: "pointer",
                outline: "none",
                fontSize: "11.5px",
                fontWeight: 800,
                transition: "all 0.15s ease",
              }}
              title={isHi ? "कतार रीफ्रेश करें" : "Refresh Lab Queue"}
            >
              <RefreshCw size={12} className={refreshing ? "spin-icon" : ""} style={{ color: "#38BDF8" }} />
              <span>{isHi ? "रीफ्रेश" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid (Glassmorphic Telemetry Cards) */}
        <div className="pathology-hero-kpi-grid">
          <div className="pathology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "कतार में प्रतीक्षारत" : "Waiting in Lab Queue"}
              </div>
              <Clock size={15} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              {pathologyQueue.length}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {isHi ? "जांच हेतु प्रतीक्षारत नमूने" : "Specimens waiting in stream"}
            </div>
          </div>

          <div className="pathology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "सक्रिय जांच जारी" : "Active In-Testing"}
              </div>
              <Activity size={15} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              {activeServingTicket
                ? `#${activeServingTicket.ticket_id}`
                : dutyStatus === "OFF_DUTY"
                  ? (isHi ? "ड्यूटी समाप्त" : "Off Duty")
                  : dutyStatus === "BREAK"
                    ? (isHi ? "अवकाश" : "On Break")
                    : (isHi ? "तैयार" : "Ready")}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeServingTicket
                ? activeServingTicket.name
                : dutyStatus === "OFF_DUTY"
                  ? (isHi ? "काउंटर सेवा बंद है" : "Station offline")
                  : dutyStatus === "BREAK"
                    ? (isHi ? "अवकाश पर (कॉलिंग रुकी है)" : "Testing paused")
                    : assignedDesk?.desk_name
                      ? (isHi ? `${assignedDesk.desk_name} उपलब्ध` : `${assignedDesk.desk_name} ready`)
                      : (isHi ? "अनअसाइंड" : "Unassigned")}
            </div>
          </div>

          <div className="pathology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "आज सत्यापित रिपोर्ट" : "Verified Today"}
              </div>
              <CheckCircle2 size={15} color="#34D399" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              {historicalReports.length || 0}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {isHi ? "सत्यापित क्लिनिकल रिपोर्ट" : "Approved Diagnostic Slips"}
            </div>
          </div>

          <div className="pathology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "औसत टर्नअराउंड समय" : "Avg. Turnaround"}
              </div>
              <Sliders size={15} color="#FBBF24" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              ~14.5 min
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {isHi ? "नमूना संकलन से सत्यापन" : "Collection to Verification"}
            </div>
          </div>
        </div>
      </div>

      {/* Duty Status Alert Banner when On Break or Shift Ended */}
      {dutyStatus !== "ACTIVE" && (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            borderRadius: "12px",
            background:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2")
                : (isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB"),
            border:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA")
                : (isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #FDE68A"),
            color:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "#FCA5A5" : "#B91C1C")
                : (isDark ? "#FDE68A" : "#B45309"),
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
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
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
              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.35)",
            }}
          >
            <span>✓</span>
            <span>{isHi ? "ड्यूटी पुनः शुरू करें" : "Resume Active Duty"}</span>
          </button>
        </div>
      )}

      {/* Modern 3-Tab Segmented Switcher matching Pharmacy & Doctor Portals */}
      <div className="pathology-tabs-grid">
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
            <span className="tab-sub-text">{isHi ? "सक्रिय जांच व लाइव कतार" : "Active Testing Station & Queue"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "workstation" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
              color: activeTab === "workstation" ? "#FFFFFF" : "#0284C7",
            }}
          >
            {pathologyQueue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("archive")}
          className={`tab-button-modern ${activeTab === "archive" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <FileText size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "लैब रिपोर्ट अभिलेखागार" : "Lab Reports Archive"}</div>
            <span className="tab-sub-text">{isHi ? "सत्यापित रिपोर्ट खोज व प्रिंट" : "Search & Reprint Lab Slips"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "archive" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"),
              color: activeTab === "archive" ? "#FFFFFF" : "#6366F1",
            }}
          >
            {historicalReports.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`tab-button-modern ${activeTab === "history" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <History size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "मरीज़ परीक्षण इतिहास" : "Patient Test History"}</div>
            <span className="tab-sub-text">{isHi ? "दिनांक वार ऑडिट व एक्सेल" : "Date Filtering & Excel Export"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "history" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(16, 185, 129, 0.25)" : "#ECFDF5"),
              color: activeTab === "history" ? "#FFFFFF" : "#059669",
            }}
          >
            {filteredHistory.length}
          </span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: DIAGNOSTIC WORKSTATION (ACTIVE TEST EXECUTION)
         ======================================================== */}
      {activeTab === "workstation" && (
        <div className="pathology-workstation-grid">
          {/* Main Left Execution Workspace */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0, width: "100%" }}>
            {/* Active Serving Patient Card */}
            {activeServingTicket ? (
              <div
                style={{
                  background: "var(--path-card-bg, #FFFFFF)",
                  border: isDark ? "1.5px solid rgba(56, 189, 248, 0.45)" : "1.5px solid #BAE6FD",
                  borderRadius: "16px",
                  padding: "16px 18px",
                  boxShadow: isDark ? "0 10px 30px rgba(0, 0, 0, 0.4)" : "0 8px 24px rgba(2, 132, 199, 0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "19px",
                          fontWeight: 900,
                          color: textColor,
                          letterSpacing: "-0.3px",
                        }}
                      >
                        {activeServingTicket.name}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                          color: "#0284C7",
                          fontFamily: "monospace",
                        }}
                      >
                        #{activeServingTicket.ticket_id}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          background: activeServingTicket.priority_level === 1 ? "#FEE2E2" : "#ECFDF5",
                          color: activeServingTicket.priority_level === 1 ? "#DC2626" : "#059669",
                          border: `1px solid ${activeServingTicket.priority_level === 1 ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                        }}
                      >
                        {activeServingTicket.priority_level === 1 ? "EMERGENCY PRIORITY" : "STANDARD"}
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                      {activeServingTicket.age || 30} {isHi ? "वर्ष" : "Yrs"} • {String(activeServingTicket.gender || "M").toUpperCase()} •{" "}
                      {activeServingTicket.phone || "N/A"}
                    </div>
                  </div>

                  {/* Desk Serving Action Controls */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={handleRecall}
                      style={{
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: isDark ? "#CBD5E1" : "#475569",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s ease",
                      }}
                      title="Re-broadcast announcement over loudspeaker"
                    >
                      <Volume2 size={13} color="#0284C7" />
                      <span>{isHi ? "पुनः उद्घोषणा (Recall)" : "Re-announce"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleHold}
                      style={{
                        background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                        border: "1px solid #F59E0B",
                        color: "#D97706",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isHi ? "होल्ड (10 मिनट)" : "Hold (10m)"}
                    </button>
                    <button
                      type="button"
                      onClick={handleNoShow}
                      style={{
                        background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
                        border: "1px solid #EF4444",
                        color: "#DC2626",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isHi ? "अनुपस्थित (No-Show)" : "No-Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedServingTicket(null)}
                      style={{
                        background: "transparent",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: mutedText,
                        padding: "6px 10px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      title="Return to waiting stream without saving"
                    >
                      {isHi ? "हटाएं" : "Clear"}
                    </button>
                  </div>
                </div>

                {/* Doctor Referral Context Box */}
                {parsedDoctorRx && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      background: isDark ? "#131D31" : "#F8FAFC",
                      border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                      <div>
                        <strong style={{ color: "#0284C7" }}>{isHi ? "परामर्शदाता डॉक्टर:" : "Referring Doctor:"}</strong>{" "}
                        {parsedDoctorRx.doctor_name || "OPD Doctor"} (
                        {parsedDoctorRx.doctor_department || activeServingTicket.transferred_from_dept || "General Medicine"})
                      </div>
                      <div>
                        <strong>{isHi ? "क्लिनिकल निदान:" : "Diagnosis:"}</strong> {parsedDoctorRx.diagnosis || "Clinical Assessment"}
                      </div>
                    </div>
                    {parsedDoctorRx.lab_tests && (
                      <div style={{ marginTop: "6px", color: isDark ? "#38BDF8" : "#0284C7", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                        <FlaskConical size={14} />
                        <span>{isHi ? "डॉक्टर द्वारा निर्धारित जांचें:" : "Prescribed Lab Investigations:"} {parsedDoctorRx.lab_tests}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: isDark ? "#0F172A" : "#FFFFFF",
                  border: isDark ? "1.5px dashed #334155" : "1.5px dashed #CBD5E1",
                  borderRadius: "16px",
                  padding: "26px 16px",
                  textAlign: "center",
                }}
              >
                <FlaskConical size={36} style={{ color: "#0284C7", opacity: 0.6, margin: "0 auto 8px auto" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                  {isHi ? "वर्तमान में कोई सक्रिय जांच चयनित नहीं है" : "No Active Lab Patient Serving"}
                </h3>
                <p style={{ margin: "4px 0 14px 0", fontSize: "12.5px", color: mutedText }}>
                  {isHi
                    ? "कतार से अगले मरीज़ को बुलाने के लिए नीचे दिए गए बटन पर क्लिक करें।"
                    : "Click below to call the next patient from the laboratory waiting stream."}
                </p>
                <button
                  type="button"
                  onClick={handleCallNext}
                  disabled={callingNext || pathologyQueue.length === 0}
                  style={{
                    background: pathologyQueue.length === 0 ? (isDark ? "#334155" : "#E2E8F0") : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    color: pathologyQueue.length === 0 ? (isDark ? "#94A3B8" : "#64748B") : "#FFFFFF",
                    border: "none",
                    padding: "9px 20px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: pathologyQueue.length === 0 || callingNext ? "not-allowed" : "pointer",
                    boxShadow: pathologyQueue.length === 0 ? "none" : "0 4px 14px rgba(2, 132, 199, 0.35)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Volume2 size={15} />
                  <span>
                    {callingNext
                      ? (isHi ? "बुलाया जा रहा है..." : "Calling...")
                      : (isHi ? "अगला मरीज़ बुलाएं (Call Next)" : "Call Next Patient to Station")}
                  </span>
                </button>
              </div>
            )}

            {/* Specimen Collection Audit Card */}
            <div
              style={{
                background: "var(--path-card-bg, #FFFFFF)",
                border: "var(--path-card-border, #E2E8F0)",
                borderRadius: "16px",
                padding: "16px 18px",
                boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, display: "flex", alignItems: "center", gap: "7px" }}>
                  <TestTube size={16} style={{ color: "#0284C7" }} />
                  <span>{isHi ? "नमूना संकलन विवरण (Specimen Audit)" : "Specimen Collection Audit"}</span>
                </h3>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE", padding: "2px 7px", borderRadius: "6px", fontFamily: "monospace" }}>
                  Accession #{labAccessionNo}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "12px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "4px", color: isDark ? "#CBD5E1" : "#475569" }}>
                    {isHi ? "नमूना प्रकार" : "Sample Type"}
                  </label>
                  <select
                    value={specimenType}
                    onChange={(e) => setSpecimenType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#F8FAFC",
                      color: textColor,
                      fontSize: "12px",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  >
                    <option value="Whole Blood (EDTA)">Whole Blood (EDTA Purple Top)</option>
                    <option value="Serum (Clot Activator Red Top)">Serum (Clot Activator Red Top)</option>
                    <option value="Fluoride Plasma (Glucose Grey Top)">Fluoride Plasma (Glucose Grey Top)</option>
                    <option value="Mid-stream Clean Catch Urine">Mid-stream Clean Catch Urine</option>
                    <option value="Nasopharyngeal Swab">Nasopharyngeal Swab</option>
                    <option value="Sputum / Respiratory Sample">Sputum / Respiratory Sample</option>
                    <option value="Stool Specimen">Stool Specimen</option>
                    <option value="Body Fluid / Other">Body Fluid / Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "4px", color: isDark ? "#CBD5E1" : "#475569" }}>
                    {isHi ? "नमूना स्थिति / गुणवत्ता" : "Specimen Integrity"}
                  </label>
                  <select
                    value={specimenCondition}
                    onChange={(e) => setSpecimenCondition(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#F8FAFC",
                      color: textColor,
                      fontSize: "12px",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  >
                    <option value="Adequate / Free of Hemolysis">Adequate / Free of Hemolysis</option>
                    <option value="Mild Hemolysis (Documented)">Mild Hemolysis (Documented)</option>
                    <option value="Lipemic Specimen">Lipemic Specimen</option>
                    <option value="Fasting (10-12 hrs confirmed)">Fasting (10-12 hrs confirmed)</option>
                    <option value="Random / Post-Prandial">Random / Post-Prandial</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "4px", color: isDark ? "#CBD5E1" : "#475569" }}>
                    {isHi ? "संकलन समय" : "Collection Timestamp"}
                  </label>
                  <input
                    type="datetime-local"
                    value={collectionTime ? collectionTime.slice(0, 16) : ""}
                    onChange={(e) => setCollectionTime(new Date(e.target.value).toISOString())}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#F8FAFC",
                      color: textColor,
                      fontSize: "12px",
                      fontWeight: 600,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Structured Test Report Entry Form */}
            <div
              style={{
                background: "var(--path-card-bg, #FFFFFF)",
                border: "var(--path-card-border, #E2E8F0)",
                borderRadius: "16px",
                padding: "16px 18px",
                width: "100%",
                boxSizing: "border-box",
                boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 900, display: "flex", alignItems: "center", gap: "7px" }}>
                    <Activity size={17} style={{ color: "#0284C7" }} />
                    <span>{isHi ? "जांच रिपोर्ट विवरण प्रविष्टि (Diagnostic Parameters Entry)" : "Diagnostic Test Report Parameters Entry"}</span>
                  </h3>
                  <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                    {isHi
                      ? "मानक संदर्भ सीमाओं के साथ परिणाम दर्ज करें। असामान्य परिणाम स्वतः चिह्नित होंगे।"
                      : "Enter observed values with biological reference intervals. Out-of-range values auto-flag."}
                  </div>
                </div>

                {/* Predefined Panel Selectors */}
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {Object.keys(DEFAULT_TEST_PANELS).map((key) => {
                    const p = DEFAULT_TEST_PANELS[key];
                    const active = selectedPanelKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleLoadPanel(key)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "9999px",
                          fontSize: "11px",
                          fontWeight: 800,
                          cursor: "pointer",
                          border: active ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                          background: active ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : isDark ? "#1E293B" : "#F8FAFC",
                          color: active ? "#0284C7" : isDark ? "#CBD5E1" : "#475569",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {p.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Parameter Grid Table */}
              <div style={{ overflowX: "auto", marginBottom: "12px", borderRadius: "10px", border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: isDark ? "#131D31" : "#F1F5F9", borderBottom: isDark ? "1.5px solid #1E293B" : "1.5px solid #E2E8F0" }}>
                      <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>
                        {isHi ? "परीक्षण पैरामीटर" : "Investigation Parameter"}
                      </th>
                      <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569", width: "120px" }}>
                        {isHi ? "परिणाम" : "Observed Result"}
                      </th>
                      <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569", width: "75px" }}>
                        {isHi ? "इकाई" : "Unit"}
                      </th>
                      <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569", width: "150px" }}>
                        {isHi ? "जैविक संदर्भ सीमा" : "Biological Ref. Interval"}
                      </th>
                      <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569", width: "100px" }}>
                        {isHi ? "स्थिति" : "Flag"}
                      </th>
                      <th style={{ padding: "7px 8px", textAlign: "center", width: "36px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {testParameters.map((row, idx) => {
                      const isHigh = row.flag === "HIGH";
                      const isLow = row.flag === "LOW";
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: isDark ? "1px solid rgba(51, 65, 85, 0.4)" : "1px solid #E2E8F0",
                            background: isHigh
                              ? isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2"
                              : isLow
                                ? isDark ? "rgba(59, 130, 246, 0.08)" : "#EFF6FF"
                                : "transparent",
                          }}
                        >
                          <td style={{ padding: "5px 8px" }}>
                            <input
                              type="text"
                              value={row.parameter}
                              onChange={(e) => handleParameterChange(idx, "parameter", e.target.value)}
                              style={{
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                color: textColor,
                                fontWeight: 700,
                                fontSize: "12px",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>
                            <input
                              type="text"
                              value={row.value}
                              onChange={(e) => handleParameterChange(idx, "value", e.target.value)}
                              placeholder="0.0"
                              style={{
                                width: "100%",
                                height: "28px",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                border: isHigh
                                  ? "1.5px solid #EF4444"
                                  : isLow
                                    ? "1.5px solid #3B82F6"
                                    : isDark
                                      ? "1px solid #334155"
                                      : "1px solid #CBD5E1",
                                background: isDark ? "#0F172A" : "#FFFFFF",
                                color: isHigh ? "#EF4444" : isLow ? "#3B82F6" : textColor,
                                fontWeight: 800,
                                fontSize: "12px",
                                textAlign: "right",
                                fontFamily: "monospace",
                                outline: "none",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => handleParameterChange(idx, "unit", e.target.value)}
                              style={{
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                color: mutedText,
                                fontSize: "11.5px",
                                textAlign: "center",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            <input
                              type="text"
                              value={row.ref_range}
                              onChange={(e) => handleParameterChange(idx, "ref_range", e.target.value)}
                              style={{
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                color: isDark ? "#CBD5E1" : "#475569",
                                fontSize: "11.5px",
                                textAlign: "center",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "center" }}>
                            <select
                              value={row.flag}
                              onChange={(e) => handleParameterChange(idx, "flag", e.target.value)}
                              style={{
                                height: "26px",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 800,
                                border: "1px solid",
                                outline: "none",
                                cursor: "pointer",
                                borderColor: isHigh ? "#EF4444" : isLow ? "#3B82F6" : "#10B981",
                                background: isHigh
                                  ? isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2"
                                  : isLow
                                    ? isDark ? "rgba(59, 130, 246, 0.2)" : "#DBEAFE"
                                    : isDark ? "rgba(16, 185, 129, 0.2)" : "#D1FAE5",
                                color: isHigh ? "#DC2626" : isLow ? "#1D4ED8" : "#047857",
                              }}
                            >
                              <option value="NORMAL">NORMAL</option>
                              <option value="HIGH">HIGH ▲</option>
                              <option value="LOW">LOW ▼</option>
                              <option value="ABNORMAL">ABNORMAL</option>
                            </select>
                          </td>
                          <td style={{ padding: "5px 6px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveParameter(idx)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: mutedText,
                                cursor: "pointer",
                                padding: "2px",
                              }}
                              title="Delete row"
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

              {/* Add Custom Parameter Button */}
              <button
                type="button"
                onClick={handleAddCustomParameter}
                style={{
                  background: isDark ? "#1E293B" : "#F1F5F9",
                  border: isDark ? "1px dashed #334155" : "1px dashed #CBD5E1",
                  color: "#0284C7",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "12px",
                  transition: "all 0.15s ease",
                }}
              >
                <Plus size={13} />
                <span>{isHi ? "+ अन्य परीक्षण पैरामीटर जोड़ें" : "+ Add Custom Parameter Row"}</span>
              </button>

              {/* Pathologist Clinical Remarks & Observations */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 800, marginBottom: "4px", color: isDark ? "#CBD5E1" : "#334155" }}>
                  {isHi ? "पैथोलॉजिस्ट क्लिनिकल अभिमत एवं टिप्पणियां (Clinical Impression):" : "Pathologist Remarks & Clinical Impressions:"}
                </label>
                <textarea
                  rows={2}
                  value={pathologistRemarks}
                  onChange={(e) => setPathologistRemarks(e.target.value)}
                  placeholder={isHi ? "क्लिनिकल टिप्पणियाँ दर्ज करें..." : "Enter clinical impressions or morphologic observations..."}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#F8FAFC",
                    color: textColor,
                    fontSize: "12px",
                    fontWeight: 500,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Action Toolbar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                  paddingTop: "16px",
                  borderTop: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                }}
              >
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleSaveReportDraft}
                    style={{
                      background: isDark ? "#1E293B" : "#F1F5F9",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      color: textColor,
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <FileCheck size={15} style={{ color: "#0284C7" }} />
                    <span>{isHi ? "ड्राफ्ट सहेजें" : "Save Draft"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintReport}
                    style={{
                      background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                      border: "1.5px solid #0284C7",
                      color: "#0284C7",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Printer size={15} />
                    <span>{isHi ? "आधिकारिक रिपोर्ट प्रिंट करें" : "Print Official Report"}</span>
                  </button>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleCompleteAndRouteToDoctor}
                    style={{
                      background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Send size={14} />
                    <span>{isHi ? "पूर्ण करें एवं डॉक्टर को भेजें" : "Complete & Route to Doctor"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteAndDischarge}
                    style={{
                      background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>{isHi ? "जांच पूर्ण एवं डिस्चार्ज" : "Complete & Discharge"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Laboratory Waiting Stream */}
          <div>
            <div
              style={{
                background: "var(--path-card-bg, #FFFFFF)",
                border: "var(--path-card-border, #E2E8F0)",
                borderRadius: "16px",
                padding: "16px",
                position: "sticky",
                top: "16px",
                boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, display: "flex", alignItems: "center", gap: "7px" }}>
                  <Clock size={15} style={{ color: "#0284C7" }} />
                  <span>{isHi ? "लाइव पैथोलॉजी कतार" : "Live Lab Queue"}</span>
                </h3>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                    color: "#0284C7",
                  }}
                >
                  {pathologyQueue.length} {isHi ? "मरीज़" : "Patients"}
                </span>
              </div>

              {/* Call Next Patient Button at Top of Queue */}
              <button
                type="button"
                onClick={handleCallNext}
                disabled={callingNext || pathologyQueue.length === 0}
                style={{
                  width: "100%",
                  marginBottom: "10px",
                  background: pathologyQueue.length === 0 ? (isDark ? "#1E293B" : "#F1F5F9") : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: pathologyQueue.length === 0 ? (isDark ? "#64748B" : "#94A3B8") : "#FFFFFF",
                  border: pathologyQueue.length === 0 ? (isDark ? "1px solid #334155" : "1px solid #CBD5E1") : "none",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  fontWeight: 800,
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  cursor: pathologyQueue.length === 0 || callingNext ? "not-allowed" : "pointer",
                  opacity: callingNext ? 0.7 : 1,
                  boxShadow: pathologyQueue.length === 0 ? "none" : "0 3px 12px rgba(2, 132, 199, 0.25)",
                  transition: "all 0.15s ease",
                }}
                title={pathologyQueue.length === 0 ? "No patients in queue" : "Call the next priority patient to the station"}
              >
                <Volume2 size={14} />
                <span>
                  {callingNext
                    ? (isHi ? "पुकारा जा रहा है..." : "Calling...")
                    : (isHi ? "अगला मरीज़ बुलाएं" : "Call Next Patient")}
                </span>
              </button>

              {pathologyQueue.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 10px", color: mutedText }}>
                  <CheckCircle2 size={26} style={{ opacity: 0.5, margin: "0 auto 6px auto" }} />
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>
                    {isHi ? "कतार में कोई मरीज़ प्रतीक्षारत नहीं है" : "No patients waiting in lab queue"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "560px", overflowY: "auto" }}>
                  {pathologyQueue.map((ticket) => {
                    const isServing = activeServingTicket && activeServingTicket.ticket_id === ticket.ticket_id;
                    return (
                      <div
                        key={ticket.ticket_id}
                        style={{
                          background: isServing
                            ? isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"
                            : isDark ? "#131D31" : "#F8FAFC",
                          border: isServing
                            ? "1.5px solid #0284C7"
                            : isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                          borderRadius: "12px",
                          padding: "10px 12px",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 800, color: textColor }}>
                                {ticket.name}
                              </span>
                              {ticket.priority_level === 1 && (
                                <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "4px", background: "#FEE2E2", color: "#DC2626" }}>
                                  EMERGENCY
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                              #{ticket.ticket_id} • {ticket.age || 30}y / {ticket.gender || "M"}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "6px",
                              background: isServing
                                ? "#0284C7"
                                : (isDark ? "#1E293B" : "#E2E8F0"),
                              color: isServing ? "#FFFFFF" : (isDark ? "#CBD5E1" : "#475569"),
                            }}
                          >
                            {isServing ? "SERVING" : ticket.status}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", paddingTop: "5px", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)" }}>
                          {ticket.transferred_from_dept ? (
                            <div style={{ fontSize: "10.5px", color: "#0284C7", fontWeight: 700 }}>
                              Ref: {ticket.transferred_from_dept}
                            </div>
                          ) : (
                            <div style={{ fontSize: "10.5px", color: mutedText }}>
                              {ticket.medical_condition ? ticket.medical_condition.replace(/_/g, " ") : "Lab Assay"}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCallSpecificPatient(ticket)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: isServing
                                ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5")
                                : (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"),
                              border: isServing
                                ? "1px solid #10B981"
                                : "1px solid #0284C7",
                              color: isServing ? "#10B981" : "#0284C7",
                              fontSize: "10.5px",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            title={isServing ? "Re-announce active ticket" : "Call this patient to station"}
                          >
                            <Volume2 size={11} />
                            <span>{isServing ? (isHi ? "उद्घोषणा" : "Announce") : (isHi ? "बुलाएं" : "Call")}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: LAB REPORTS ARCHIVE & VERIFICATION SEARCH
         ======================================================== */}
      {activeTab === "archive" && (
        <div
          style={{
            background: "var(--path-card-bg, #FFFFFF)",
            border: "var(--path-card-border, #E2E8F0)",
            borderRadius: "16px",
            padding: "16px 18px",
            boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: textColor }}>
                {isHi ? "नैदानिक परीक्षण रिपोर्ट अभिलेखागार" : "Diagnostic Laboratory Reports Archive"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: mutedText }}>
                {isHi ? "मरीज़ के नाम, टोकन नंबर या फ़ोन से रिपोर्ट खोजें एवं पुनः प्रिंट करें।" : "Lookup, verify and re-print historical patient lab slips."}
              </p>
            </div>

            <div style={{ position: "relative", width: "260px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "9px", color: mutedText }} />
              <input
                type="text"
                placeholder={isHi ? "नाम, टोकन या फ़ोन खोजें..." : "Search name, token or phone..."}
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 12px 6px 32px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: isDark ? "#0F172A" : "#F8FAFC",
                  color: textColor,
                  fontSize: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#0284C7" }}>
              <RefreshCw size={22} className="spin-icon" style={{ margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "12.5px", fontWeight: 700 }}>{isHi ? "रिपोर्ट्स लोड हो रही हैं..." : "Loading reports..."}</div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: mutedText }}>
              <FileText size={36} style={{ opacity: 0.35, margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "कोई रिपोर्ट नहीं मिली" : "No lab reports match your criteria"}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "12px", border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F1F5F9", borderBottom: isDark ? "1.5px solid #1E293B" : "1.5px solid #E2E8F0" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "दिनांक" : "Date"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "टोकन #" : "Token #"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "मरीज़ का नाम" : "Patient Name"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "आयु/लिंग" : "Age/Sex"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "जांच परीक्षण" : "Investigation"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "स्थिति" : "Status"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "कार्रवाई" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                      }}
                    >
                      <td style={{ padding: "6px 10px", color: mutedText }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recent"}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 800, color: "#0284C7", fontFamily: "monospace" }}>
                        #{item.ticket_id || "-"}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 700, color: textColor }}>
                        {item.patient_name || item.name || "Patient"}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        {item.age || "-"}y / {item.gender || "-"}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>
                        {item.medical_condition || item.service_category || "Diagnostic Investigation"}
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: "#ECFDF5",
                            color: "#059669",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                          }}
                        >
                          VERIFIED
                        </span>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => {
                            printLabReportSlip(
                              {
                                patient_name: item.patient_name || item.name,
                                age: item.age || 30,
                                gender: item.gender || "M",
                                phone: item.phone || "",
                                ticket_id: item.ticket_id,
                                test_panel_name: item.medical_condition || "Complete Blood Count (CBC)",
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
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <Printer size={12} />
                          <span>{isHi ? "प्रिंट" : "Print"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 3: PATIENT LAB VISIT HISTORY (DATE FILTERING & EXPORT)
         ======================================================== */}
      {activeTab === "history" && (
        <div
          style={{
            background: "var(--path-card-bg, #FFFFFF)",
            border: "var(--path-card-border, #E2E8F0)",
            borderRadius: "16px",
            padding: "16px 18px",
            boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: textColor }}>
                {isHi ? "मरीज़ प्रयोगशाला परीक्षण इतिहास" : "Patient Laboratory Testing History"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: mutedText }}>
                {isHi ? "दिनांक अनुसार फ़िल्टर करें और परीक्षण रिकॉर्ड्स एक्सेल में डाउनलोड करें।" : "Filter clinical records by date range and export to Excel spreadsheet."}
              </p>
            </div>

            {/* Date Filtering Pill Group */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setHistoryDateFilter("today")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyDateFilter === "today" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyDateFilter === "today" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyDateFilter === "today" ? "#0284C7" : mutedText,
                  transition: "all 0.15s ease",
                }}
              >
                {isHi ? "आज (Today)" : "Today"}
              </button>

              <button
                type="button"
                onClick={() => setHistoryDateFilter("yesterday")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyDateFilter === "yesterday" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyDateFilter === "yesterday" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyDateFilter === "yesterday" ? "#0284C7" : mutedText,
                  transition: "all 0.15s ease",
                }}
              >
                {isHi ? "कल (Yesterday)" : "Yesterday"}
              </button>

              <button
                type="button"
                onClick={() => setHistoryDateFilter("date")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyDateFilter === "date" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyDateFilter === "date" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyDateFilter === "date" ? "#0284C7" : mutedText,
                  transition: "all 0.15s ease",
                }}
              >
                {isHi ? "दिनांक चुनें" : "Select Date"}
              </button>

              {historyDateFilter === "date" && (
                <input
                  type="date"
                  value={customFilterDate}
                  onChange={(e) => setCustomFilterDate(e.target.value)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    color: textColor,
                    fontSize: "11.5px",
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => setHistoryDateFilter("all")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyDateFilter === "all" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyDateFilter === "all" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyDateFilter === "all" ? "#0284C7" : mutedText,
                  transition: "all 0.15s ease",
                }}
              >
                {isHi ? "सभी दिनांक" : "All Dates"}
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "10px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  marginLeft: "4px",
                  boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)",
                  transition: "all 0.15s ease",
                }}
              >
                <Download size={14} />
                <span>{isHi ? "Excel निर्यात" : "Export Excel"}</span>
              </button>
            </div>
          </div>

          {/* Historical Table */}
          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: mutedText }}>
              <History size={36} style={{ opacity: 0.35, margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "इस तिथि का कोई रिकॉर्ड नहीं मिला" : "No lab test records found for the selected date filter"}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "12px", border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F1F5F9", borderBottom: isDark ? "1.5px solid #1E293B" : "1.5px solid #E2E8F0" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>#</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "दिनांक व समय" : "Date & Time"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "टोकन #" : "Token #"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "मरीज़ का नाम" : "Patient Name"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "आयु/लिंग" : "Age/Sex"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "परीक्षण" : "Investigation"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "स्थिति" : "Status"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "कार्रवाई" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                      }}
                    >
                      <td style={{ padding: "6px 10px", color: mutedText }}>{idx + 1}</td>
                      <td style={{ padding: "6px 10px", color: mutedText }}>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 800, color: "#0284C7", fontFamily: "monospace" }}>
                        #{item.ticket_id || "-"}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 700, color: textColor }}>
                        {item.patient_name || item.name || "Patient"}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        {item.age || "-"}y / {item.gender || "-"}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>
                        {item.medical_condition || item.service_category || "Diagnostic Assay"}
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: "#ECFDF5",
                            color: "#059669",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                          }}
                        >
                          COMPLETED
                        </span>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => {
                            printLabReportSlip(
                              {
                                patient_name: item.patient_name || item.name,
                                age: item.age || 30,
                                gender: item.gender || "M",
                                phone: item.phone || "",
                                ticket_id: item.ticket_id,
                                test_panel_name: item.medical_condition || "Complete Blood Count (CBC)",
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
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <Printer size={12} />
                          <span>{isHi ? "प्रिंट" : "Print"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <Footer language={language} hospitalBranding={hospitalBranding} theme={currentTheme} />
    </div>
  );
}
