
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { t, getCategoryLabel, formatCleanText } from "../utils/i18n";
import { announceTicketVoice } from "../utils/voiceSynthesizer";
import { printPrescriptionSlip, printDispensingLabelSlip } from "../utils/printPassHelper";
import Footer from "../components/common/Footer";
import {
  Pill,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Volume2,
  Search,
  RefreshCw,
  User,
  Stethoscope,
  Building2,
  ShieldCheck,
  Layers,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Coffee,
  Check,
  X,
  FileText,
  BadgeAlert,
  SlidersHorizontal,
  ExternalLink,
  Info,
  History,
  Calendar,
  Download,
  Eye,
  Activity,
  Phone
} from "lucide-react";
import * as XLSX from "xlsx";

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

  // Station Counter & Assigned Desk State (Configured by Super Admin)
  const [hospitalDesks, setHospitalDesks] = useState([]);
  const [assignedDesk, setAssignedDesk] = useState(null);
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [activeCounter, setActiveCounter] = useState(() => {
    try {
      const saved = localStorage.getItem("pharmacy_active_counter");
      if (saved) return saved;
    } catch (_) { }
    return "Pharma Desk-1";
  });

  // Fetch Desks from SuperAdmin management API
  useEffect(() => {
    let isMounted = true;
    const fetchHospitalDesks = async () => {
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
        if (isMounted && data && data.status === "success" && Array.isArray(data.desks)) {
          setHospitalDesks(data.desks);

          // Find pharmacy-specific desks
          const pharmaDesks = data.desks.filter((d) => {
            const dCode = (d.dept_code || "").toLowerCase();
            const dName = (d.department_name || "").toLowerCase();
            const deskName = (d.desk_name || "").toLowerCase();
            return dCode === "pharmacy" || dName.includes("pharm") || deskName.includes("pharm");
          });

          // Match the desk specifically assigned to currentUser by Super Admin
          const currentUserId = Number(currentUser?.id);
          const currentEmpCode = String(currentUser?.employee_id || "").trim().toLowerCase();
          const currentUsername = String(currentUser?.username || "").trim().toLowerCase();
          const currentName = String(currentUser?.name || "").trim().toLowerCase();

          const candidateList = pharmaDesks.length > 0 ? pharmaDesks : data.desks;
          const myDesk = candidateList.find((d) => {
            const assignedUserId = Number(d.assigned_user_id);
            const assignedEmpId = Number(d.assigned_employee_id);
            const assignedEmpName = String(d.assigned_employee_name || "").trim().toLowerCase();
            const assignedEmpCode = String(d.assigned_employee_code || "").trim().toLowerCase();

            return (
              (assignedUserId && assignedUserId === currentUserId) ||
              (assignedEmpId && assignedEmpId === currentUserId) ||
              (currentEmpCode && assignedEmpCode === currentEmpCode) ||
              (currentUsername && assignedEmpName === currentUsername) ||
              (currentName && assignedEmpName === currentName)
            );
          });

          if (myDesk) {
            setAssignedDesk(myDesk);
            setSelectedDesk(myDesk);
            setActiveCounter(myDesk.desk_name);
            try {
              localStorage.setItem("pharmacy_active_counter", myDesk.desk_name);
            } catch (_) { }
          } else if (candidateList.length > 0) {
            setSelectedDesk(candidateList[0]);
            setActiveCounter((prev) => {
              const exists = candidateList.some((d) => d.desk_name === prev);
              return exists ? prev : candidateList[0].desk_name;
            });
          }
        }
      } catch (e) {
        console.error("Failed to load desks from superadmin:", e);
      }
    };

    fetchHospitalDesks();
    return () => {
      isMounted = false;
    };
  }, [effectiveHospitalCode, currentUser?.id, currentUser?.username, currentUser?.email, currentUser?.employee_id, currentUser?.name]);

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
          ? (isHi ? " ★ (आपका आवंटित डेस्क)" : " ★ (Your Assigned Desk)")
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
    fetch(`${API_BASE}/api/v1/doctor/duty-status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(currentUser?.email ? { "X-User-Email": currentUser.email } : {}),
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

  // Active Workspace Tab: "dispensing" | "archive" | "history"
  const [activeTab, setActiveTab] = useState("dispensing");

  // Patient Visit History Section State
  const [patientVisits, setPatientVisits] = useState([]);
  const [visitsSummary, setVisitsSummary] = useState({});
  const [loadingVisits, setLoadingVisits] = useState(false);
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

  // Status filter: "all" | "completed" | "in_progress"
  const [visitStatusFilter, setVisitStatusFilter] = useState("all");

  const [selectedVisitModal, setSelectedVisitModal] = useState(null);

  // Fetch Patient Visit History from Backend
  const fetchPatientVisits = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    setLoadingVisits(true);
    try {
      const headers = { "Content-Type": "application/json" };
      if (currentUser?.email) headers["X-User-Email"] = currentUser.email;
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${effectiveHospitalCode}/visits?limit=500`, {
        headers,
      });
      const data = await res.json();
      if (data && data.status === "success") {
        setPatientVisits(Array.isArray(data.visits) ? data.visits : []);
        setVisitsSummary(data.summary || {});
      }
    } catch (err) {
      console.error("Failed to load patient visits:", err);
    } finally {
      setLoadingVisits(false);
    }
  }, [effectiveHospitalCode, currentUser?.email, currentUser?.token]);

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
        if (typeof raw === "string") {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) raw = jsonMatch[0];
          const parsed = JSON.parse(raw);
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
        } else if (typeof raw === "object") {
          doctorName = raw.doctor_name || doctorName;
          diagnosis = raw.diagnosis || diagnosis;
          if (Array.isArray(raw.medicines)) medicines = raw.medicines;
          advice = raw.advice || advice;
          followUp = raw.follow_up || followUp;
          dispensedBy = raw.dispensed_by || dispensedBy;
          dispensedById = raw.dispensed_by_id || dispensedById;
          dispensedByEmail = raw.dispensed_by_email || dispensedByEmail;
          dispensedCounter = raw.dispensing_counter || dispensedCounter;
          dispensedCounterId = raw.dispensed_counter_id || dispensedCounterId;
          dispensedAt = raw.dispensed_at || dispensedAt;
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
          if (Array.isArray(parsedP.medicines) && medicines.length === 0) medicines = parsedP.medicines;
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

  // Check if a visit was consulted / dispensed exclusively by the logged-in pharmacist ("My Only")
  const checkConsultMatch = useCallback((visit, details) => {
    // 1. Mandatory requirement: visit must belong to Pharmacy
    const hasPharmaDept = (visit.dept_code || visit.department || "").toLowerCase().includes("pharm");
    const pharmaStage = Array.isArray(visit.transfer_stages) && visit.transfer_stages.find((s) => {
      const c = (s.dept_code || s.department || "").toLowerCase();
      return c.includes("pharm");
    });
    if (!hasPharmaDept && !pharmaStage) return false;

    // Pharmacist personal identifiers ("his only")
    const myName = (currentUser?.name || "").trim().toLowerCase();
    const myUsername = (currentUser?.username || "").trim().toLowerCase();
    const myEmail = (currentUser?.email || "").trim().toLowerCase();
    const myId = String(currentUser?.id || currentUser?.user_id || currentUser?.employee_id || "").trim().toLowerCase();

    const dispBy = (details.dispensedBy || "").trim().toLowerCase();
    const dispById = String(details.dispensedById || "").trim().toLowerCase();
    const dispByEmail = (details.dispensedByEmail || "").trim().toLowerCase();
    const servedBy = (pharmaStage?.served_by || visit.served_by || "").trim().toLowerCase();

    return Boolean(
      (myName && (dispBy.includes(myName) || myName.includes(dispBy) || servedBy.includes(myName) || myName.includes(servedBy))) ||
      (myUsername && (dispBy.includes(myUsername) || myUsername.includes(dispBy) || servedBy.includes(myUsername) || myUsername.includes(servedBy))) ||
      (myEmail && (dispByEmail === myEmail || dispBy.includes(myEmail) || servedBy.includes(myEmail))) ||
      (myId && (dispById === myId))
    );
  }, [
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

  // All pharmacy visits matching "My Only" consultation records
  const pharmaScopedVisits = useMemo(() => {
    return patientVisits.filter((v) => {
      const details = parseVisitDetails(v);
      return checkConsultMatch(v, details);
    });
  }, [patientVisits, parseVisitDetails, checkConsultMatch]);

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

  // Filtered visits computation
  const filteredVisits = useMemo(() => {
    let list = pharmaScopedVisits;

    // 1. Date filter: today | yesterday | date_wise | all
    list = list.filter((v) => {
      const details = parseVisitDetails(v);
      return checkVisitDateMatch(v, details, visitDateFilter, customVisitDate);
    });

    // 2. Status filter: all | completed | in_progress
    if (visitStatusFilter === "completed") {
      list = list.filter((v) => (v.status || "").toLowerCase() === "completed");
    } else if (visitStatusFilter === "in_progress") {
      list = list.filter((v) => (v.status || "").toLowerCase() !== "completed");
    }

    // 3. Search query
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
    visitSearchQuery,
  ]);

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

  // Re-print dispensing envelope label from visit history record
  const handlePrintVisitEnvelopeLabel = (visit) => {
    if (!visit) return;
    const details = parseVisitDetails(visit);
    const labelData = {
      ticket_id: visit.token_number || visit.ticket_id,
      patient_name: visit.patient_name || "Patient",
      age: visit.age || 30,
      gender: visit.gender || "Patient",
      doctor_name: details.doctorName || "Attending Physician",
      pharmacist_name: details.dispensedBy || currentUser?.name || currentUser?.username || "Licensed Pharmacist",
      counter: details.dispensedCounter || activeCounter,
      hospital_name: brandName,
      medicines: details.medicines || [],
    };
    printDispensingLabelSlip(labelData, language, hospitalBranding);
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

  // Filter queue specifically for Pharmacy Department
  const pharmacyQueue = useMemo(() => {
    return (queueSnapshot || []).filter((t) => {
      const cat = (t.service_category || "").toLowerCase();
      const dept = (t.department_name || t.department || "").toLowerCase();
      return cat === "pharmacy" || dept === "pharmacy" || cat.includes("pharm");
    });
  }, [queueSnapshot]);

  // Serving ticket specifically for pharmacy
  const pharmacyServing = useMemo(() => {
    const fromServing = (servingTickets || []).find((t) => {
      const cat = (t.service_category || "").toLowerCase();
      const dept = (t.department_name || t.department || "").toLowerCase();
      return cat === "pharmacy" || dept === "pharmacy" || cat.includes("pharm");
    });
    return fromServing || null;
  }, [servingTickets]);

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

    setCallingNext(true);
    try {
      if (socketRef && socketRef.current) {
        socketRef.current.emit("serve_next", {
          tenant_id: effectiveHospitalCode,
          department: "pharmacy",
          service_category: "pharmacy",
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
            department: "pharmacy",
            doctor_id: currentUser?.id,
            doctor_name: currentUser?.name || currentUser?.username || "Head Pharmacist",
            desk_id: selectedDesk?.id || assignedDesk?.id || null,
            desk_name: activeCounter,
          }),
        });
        if (refreshData) refreshData();
      }

      showToast(
        isHi ? "फार्मेसी कतार से अगले मरीज को बुलाया गया!" : "Called next patient to Pharmacy Counter!",
        "success"
      );
    } catch (e) {
      showToast(`Error calling patient: ${e.message}`, "error");
    } finally {
      setTimeout(() => setCallingNext(false), 800);
    }
  };

  // Re-announce patient on loudspeaker
  const handleReAnnounce = (ticket) => {
    if (!ticket) return;
    try {
      announceTicketVoice(
        {
          ...ticket,
          service_category: "PHARMACY",
        },
        language
      );
      showToast(
        isHi
          ? `📢 टोकन #${ticket.ticket_id} (${ticket.name}) की कॉल लाउडस्पीकर पर प्रसारित की गई!`
          : `📢 Announced Token #${ticket.ticket_id} (${ticket.name}) to Pharmacy Counter!`,
        "info"
      );
    } catch (e) {
      console.warn("Announcement error:", e);
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
      const unverifiedCount = medicines.filter((_, idx) => !dispensedItemsMap[`${ticket.ticket_id}_${idx}`]).length;

      const completionPayload = {
        ...rxNotes,
        dispensed_by: currentUser?.name || currentUser?.username || "Head Pharmacist",
        dispensed_by_id: currentUser?.id || currentUser?.user_id || currentUser?.employee_id || "",
        dispensed_by_email: currentUser?.email || "",
        dispensed_at: new Date().toISOString(),
        dispensing_counter: activeCounter,
        dispensed_counter_id: assignedDesk?.id || "",
        all_verified: unverifiedCount === 0,
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
          ? `✓ टोकन #${ticket.ticket_id} (${ticket.name}) की दवाएं सफलतापूर्वक वितरित व पूर्ण की गईं!`
          : `✓ Successfully dispensed all medications & completed Token #${ticket.ticket_id} (${ticket.name})!`,
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

  // Print Envelope Label Sticker
  const handlePrintEnvelopeLabel = (ticket) => {
    if (!ticket) return;
    const parsed = parseRxNotes(ticket);
    const labelData = {
      ticket_id: ticket.ticket_id,
      patient_name: ticket.name,
      age: ticket.age || 30,
      gender: ticket.gender || "Patient",
      doctor_name: parsed?.doctor_name || "Attending Physician",
      pharmacist_name: currentUser?.name || currentUser?.username || "Licensed Pharmacist",
      counter: activeCounter.includes(" - ") ? activeCounter.split(" - ")[0].trim() : activeCounter,
      hospital_name: brandName,
      medicines: Array.isArray(parsed?.medicines) ? parsed.medicines : [],
    };
    printDispensingLabelSlip(labelData, language, hospitalBranding);
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
          overflow: hidden;
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
          <span>{toastMsg.type === "error" ? "✕" : toastMsg.type === "warn" ? "⚠️" : "✓"}</span>
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: "10px", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Executive Dark-Navy Clinical Hero Header */}
      <div className="pharmacy-hero-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,0.14)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800, letterSpacing: "0.5px" }}>
                🏥 {brandName.toUpperCase()}
              </span>
              <span style={{ background: "rgba(56, 189, 248, 0.2)", border: "1px solid rgba(56, 189, 248, 0.4)", color: "#BAE6FD", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800 }}>
                {isHi ? "केंद्रीय फार्मेसी एवं दवा वितरण केंद्र" : "CENTRAL PHARMACY STATION"}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, letterSpacing: "-0.5px" }}>
              {isHi ? "फार्मेसी वितरण वर्कस्टेशन" : "Pharmacy Dispensing Workstation"}
            </h1>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", opacity: 0.9, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <User size={14} color="#38BDF8" />
              <span>
                {isHi ? "लॉगिन फार्मासिस्ट" : "Active Pharmacist"}: <strong>{currentUser?.name || currentUser?.username}</strong>
                {currentUser?.department ? ` • Dept: ${currentUser.department.toUpperCase()}` : ""}
              </span>
            </p>
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
                        <span style={{ color: opt.color, fontSize: "12px", fontWeight: 900 }}>✓</span>
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
              {analytics?.completed_today || 18}
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
              ~3.8 min
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "दवा सत्यापन व पैकेजिंग" : "Pick, Pack & Counsel"}
            </div>
          </div>
        </div>
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
            <span>{pharmaDutyStatus === "SHIFT_ENDED" ? "🛑" : "☕"}</span>
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
            <span>✓</span>
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

        <button
          onClick={() => setActiveTab("archive")}
          className={`tab-button-modern ${activeTab === "archive" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <FileText size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "दवा वितरण अभिलेख व खोज" : "Prescription Lookup & Audit"}</div>
            <span className="tab-sub-text">{isHi ? "अस्पताल के सभी पर्चों का ऑडिट" : "Search & Reprint Dispensed Rx"}</span>
          </div>
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
                          title="Broadcast Audio Call Chime"
                        >
                          <Volume2 size={13} color="#0284C7" />
                          <span>{isHi ? "लाउडस्पीकर" : "Re-Announce"}</span>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Pill size={17} color={highlightPrimary} />
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: textColor }}>
                          {isHi ? "दवा वितरण चेकलिस्ट व सत्यापन" : "Medication Dispensing Checklist"} ({medicines.length})
                        </h4>
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: verifiedAll ? "#10B981" : mutedText }}>
                        {verifiedAll
                          ? (isHi ? "✓ सभी दवाएं सत्यापित" : "✓ All items verified")
                          : (isHi ? "वितरण के लिए प्रत्येक पर सही का निशान लगाएं" : "Check off items as you pick & pack")}
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
                                    {isDispensed ? (isHi ? "सत्यापित ✓" : "VERIFIED ✓") : (isHi ? "बाकी" : "PENDING")}
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
                              : (isHi ? "✓ सभी दवाएं वितरित व परामर्श पूर्ण" : "✓ Mark Dispensed & Complete Visit")}
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
                      {isHi ? "दवा वितरण प्रारंभ करने हेतु काउंटर पर लें या लाउडस्पीकर पर कॉल करें।" : "Call next queued patient or select any prescription to dispense at your counter."}
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
                          style={{ position: "absolute", right: "6px", top: "7px", background: "none", border: "none", color: mutedText, cursor: "pointer", fontSize: "11px" }}
                        >
                          ✕
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
                          >
                            <Volume2 size={12} color="#0284C7" />
                            <span>{isHi ? "कॉल करें" : "Announce"}</span>
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
                            <span>{isHi ? "काउंटर पर लें ➔" : "Dispense ➔"}</span>
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

      {/* Tab 2: Prescription Lookup & Audit Archive */}
      {activeTab === "archive" && (
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "18px", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: textColor }}>
                {isHi ? "दवा वितरण अभिलेख व प्रिस्क्रिप्शन खोज" : "Prescription Lookup & Dispense Audit Archive"}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: mutedText }}>
                {isHi ? "अस्पताल के सभी सक्रिय एवं पूर्ण पर्चों का त्वरित ऑडिट एवं पुनः प्रिंट।" : "Search and inspect all active, transferred, and dispensed prescriptions across the hospital."}
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder={isHi ? "टोकन # या मरीज खोजें..." : "Search by Token # or patient name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: cardBorder,
                  background: isDark ? "#1E293B" : "#F8FAFC",
                  color: textColor,
                  fontSize: "12.5px",
                  outline: "none",
                }}
              />
              <button
                onClick={refreshData}
                style={{
                  background: cardBg,
                  border: cardBorder,
                  color: textColor,
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RefreshCw size={13} />
                <span>{isHi ? "रिफ्रेश" : "Refresh"}</span>
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
              <thead>
                <tr style={{ background: isDark ? "#1E293B" : "#F1F5F9", borderBottom: cardBorder }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>TOKEN #</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>PATIENT NAME</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>DOCTOR</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>MEDICINES</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, color: mutedText }}>STATUS</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: mutedText }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {queueSnapshot.map((t, idx) => {
                  const parsed = parseRxNotes(t);
                  const medList = Array.isArray(parsed?.medicines) ? parsed.medicines : [];
                  const isPharma = (t.service_category || "").toLowerCase() === "pharmacy";

                  return (
                    <tr key={t.ticket_id || idx} style={{ borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 800, color: highlightPrimary, fontFamily: "monospace" }}>
                        #{t.ticket_id}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: textColor }}>
                        {t.name}
                        <div style={{ fontSize: "11px", color: mutedText }}>{t.age}y / {t.gender}</div>
                      </td>
                      <td style={{ padding: "10px 12px", color: mutedText }}>
                        {parsed?.doctor_name || "Physician"}
                      </td>
                      <td style={{ padding: "10px 12px", color: textColor }}>
                        {medList.length > 0 ? (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {medList.slice(0, 3).map((m, mIdx) => (
                              <span key={mIdx} style={{ background: isDark ? "rgba(2, 132, 199, 0.2)" : "#F0F9FF", color: "#0284C7", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
                                {m.name}
                              </span>
                            ))}
                            {medList.length > 3 && <span style={{ fontSize: "10.5px", color: mutedText }}>+{medList.length - 3}</span>}
                          </div>
                        ) : (
                          <span style={{ color: mutedText, fontSize: "11px" }}>No meds listed</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "10.5px",
                            fontWeight: 800,
                            background: isPharma ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : (isDark ? "#334155" : "#E2E8F0"),
                            color: isPharma ? "#0284C7" : mutedText,
                          }}
                        >
                          {t.status.toUpperCase()} {isPharma ? "• PHARMACY" : ""}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handlePrintFullPrescription(t)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "none",
                              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                              color: "#FFFFFF",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                            }}
                          >
                            Rx
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            {/* Header Title & Pharmacist Identity */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: textColor, display: "flex", alignItems: "center", gap: "8px" }}>
                  <History size={18} color="#0284C7" />
                  <span>{isHi ? "मेरे मरीज़ विज़िट एवं दवा परामर्श इतिहास" : "My Patient Visit & Dispensing History"}</span>
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: mutedText }}>
                  {isHi
                    ? "केवल आपके द्वारा परामर्शित एवं दवा वितरित किए गए मरीज़ों का संपूर्ण ऑडिट रिकॉर्ड।"
                    : "Audit records for patients consulted and dispensed exclusively by you."}
                </p>
              </div>

              {/* Personal Pharmacist Indicator Badge */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                    border: isDark ? "1px solid rgba(2, 132, 199, 0.4)" : "1px solid #BAE6FD",
                    color: "#0284C7",
                    padding: "5px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  title={isHi ? "केवल आपका व्यक्तिगत परामर्श डेटा प्रदर्शित है" : "Displaying your consulted patient data only"}
                >
                  <User size={13} />
                  <span>{currentUser?.name || currentUser?.username || (isHi ? "मेरा परामर्श रिकॉर्ड" : "My Consultations Only")}</span>
                </span>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "12px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: isDark ? "#0B1120" : "#F8FAFC",
                border: cardBorder,
              }}
            >
              {/* Date Filter Buttons & Date Picker */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Calendar size={13} color="#0284C7" />
                  <span>{isHi ? "दिनांक:" : "Date:"}</span>
                </span>

                <div style={{ display: "inline-flex", background: isDark ? "#1E293B" : "#E2E8F0", padding: "3px", borderRadius: "10px", alignItems: "center", gap: "3px" }}>
                  {/* Today Button */}
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

                  {/* Yesterday Button */}
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

                  {/* Date Wise Button */}
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

                  {/* All Dates Button */}
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

              {/* Status, Search, Excel & Refresh Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {/* Status Dropdown */}
                <select
                  value={visitStatusFilter}
                  onChange={(e) => setVisitStatusFilter(e.target.value)}
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
                  <option value="all">{isHi ? "सभी स्थितियां" : "All Status"}</option>
                  <option value="completed">{isHi ? "केवल पूर्ण वितरण" : "Completed Only"}</option>
                  <option value="in_progress">{isHi ? "प्रगति में" : "In Progress"}</option>
                </select>

                {/* Search Box */}
                <div style={{ position: "relative" }}>
                  <Search size={13} color={mutedText} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    placeholder={isHi ? "मरीज़, टोकन, डॉक्टर, दवा..." : "Search patient, token, doctor, medicine..."}
                    value={visitSearchQuery}
                    onChange={(e) => setVisitSearchQuery(e.target.value)}
                    style={{
                      padding: "7px 10px 7px 30px",
                      borderRadius: "9px",
                      border: cardBorder,
                      background: isDark ? "#1E293B" : "#FFFFFF",
                      color: textColor,
                      fontSize: "11.5px",
                      outline: "none",
                      width: "190px",
                    }}
                  />
                  {visitSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setVisitSearchQuery("")}
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
                    padding: "7px 11px",
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

            {/* Visit Stream Table */}
            {loadingVisits && patientVisits.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: mutedText }}>
                <RefreshCw size={26} className="spin-icon" style={{ margin: "0 auto 12px auto", display: "block", color: "#0284C7" }} />
                <div style={{ fontSize: "14px", fontWeight: 700 }}>
                  {isHi ? "मरीज़ विज़िट इतिहास लोड हो रहा है..." : "Loading patient visit history..."}
                </div>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: mutedText, background: isDark ? "#0B1120" : "#F8FAFC", borderRadius: "14px", border: cardBorder }}>
                <History size={36} color={mutedText} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
                <div style={{ fontSize: "15px", fontWeight: 800, color: textColor }}>
                  {isHi ? "कोई विज़िट रिकॉर्ड नहीं मिला" : "No consultation records found"}
                </div>
                <div style={{ fontSize: "12px", marginTop: "6px", maxWidth: "460px", margin: "6px auto 0 auto", lineHeight: "1.5" }}>
                  {visitSearchQuery
                    ? (isHi ? `'${visitSearchQuery}' से मेल खाता कोई रिकॉर्ड नहीं मिला।` : `No records match search '${visitSearchQuery}'.`)
                    : visitDateFilter === "today"
                      ? (isHi ? "आज के लिए कोई परामर्शित मरीज़ दर्ज नहीं है। आप 'कल', 'तिथि अनुसार' या 'सभी तिथियां' चुन सकते हैं।" : "No consultations recorded for today. You can switch to Yesterday or All Dates.")
                      : visitDateFilter === "yesterday"
                        ? (isHi ? "कल के लिए कोई परामर्शित मरीज़ दर्ज नहीं है।" : "No consultations recorded for yesterday.")
                        : (isHi ? "इस फ़िल्टर या तिथि में कोई मरीज़ दर्ज नहीं है।" : "No patient visits recorded under this filter or date.")}
                </div>
                {visitDateFilter !== "all" && dateCounts.all > 0 && (
                  <div style={{ marginTop: "14px", display: "flex", justifyContent: "center", gap: "8px" }}>
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
                      }}
                    >
                      {isHi ? `सभी तिथियां देखें (${dateCounts.all})` : `View All Dates (${dateCounts.all})`}
                    </button>
                    {visitDateFilter !== "yesterday" && dateCounts.yesterday > 0 && (
                      <button
                        type="button"
                        onClick={() => setVisitDateFilter("yesterday")}
                        style={{
                          background: isDark ? "#1E293B" : "#E2E8F0",
                          color: textColor,
                          border: cardBorder,
                          borderRadius: "8px",
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {isHi ? `कल के परामर्श (${dateCounts.yesterday})` : `View Yesterday (${dateCounts.yesterday})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto", borderRadius: "12px", border: cardBorder }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: isDark ? "#0F172A" : "#F8FAFC", borderBottom: cardBorder }}>
                      <th style={{ padding: "12px 14px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Token / Date</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Patient Info</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Care Pathway</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Doctor & Diagnosis</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Prescribed Medicines</th>
                      <th style={{ padding: "12px 14px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dispensing Audit</th>
                      <th style={{ padding: "12px 14px", textAlign: "center", fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                      <th style={{ padding: "12px 14px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map((visit, vIdx) => {
                      const details = parseVisitDetails(visit);
                      const isComplete = (visit.status || "").toLowerCase() === "completed";
                      const dateDisplay = visit.queue_date || (visit.created_at ? new Date(visit.created_at).toLocaleDateString() : "Today");
                      const timeDisplay = visit.created_at ? new Date(visit.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                      const originDept = (visit.origin_department || "OPD").replace(/General Consultation\s*\(OPD\)/i, "OPD").replace(/Pharmacy\s*&\s*Medicine/i, "Pharmacy");
                      const destDept = (visit.department || "Pharmacy").replace(/Pharmacy\s*&\s*Medicine/i, "Pharmacy");

                      return (
                        <tr
                          key={visit.id || visit.ticket_id || vIdx}
                          style={{
                            borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9",
                            background: vIdx % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.01)"),
                            transition: "background 0.15s ease",
                          }}
                        >
                          {/* Token & Date */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF",
                                border: isDark ? "1px solid rgba(2, 132, 199, 0.3)" : "1px solid #BAE6FD",
                                color: isDark ? "#38BDF8" : "#0284C7",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontWeight: 700,
                                fontFamily: "monospace",
                                fontSize: "12px",
                              }}
                            >
                              #{visit.token_number || visit.ticket_id}
                            </div>
                            <div style={{ fontSize: "11px", color: mutedText, marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Calendar size={11} color={mutedText} />
                              <span>{dateDisplay}</span>
                              {timeDisplay && (
                                <>
                                  <span style={{ opacity: 0.4 }}>•</span>
                                  <span>{timeDisplay}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Patient Info */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            <div style={{ fontWeight: 700, color: textColor, fontSize: "13px", letterSpacing: "-0.2px" }}>
                              {visit.patient_name}
                            </div>
                            <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px", display: "flex", alignItems: "center", gap: "5px" }}>
                              <span>{visit.age ? `${visit.age}y` : "Age N/A"}</span>
                              <span style={{ opacity: 0.4 }}>•</span>
                              <span style={{ textTransform: "capitalize" }}>{visit.gender || "Patient"}</span>
                            </div>
                            {visit.phone && (
                              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Phone size={10} color={mutedText} />
                                <span style={{ fontFamily: "monospace" }}>{visit.phone}</span>
                              </div>
                            )}
                          </td>

                          {/* Care Pathway */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", fontWeight: 600 }}>
                              <span style={{ color: textColor }}>{originDept}</span>
                              <ArrowRight size={11} color={mutedText} />
                              <span style={{ color: "#0284C7", fontWeight: 700 }}>{destDept}</span>
                            </div>
                            {visit.service_duration_minutes ? (
                              <div style={{ fontSize: "11px", color: mutedText, marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Clock size={10} color={mutedText} />
                                <span>{visit.service_duration_minutes} min duration</span>
                              </div>
                            ) : null}
                          </td>

                          {/* Doctor & Diagnosis */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            <div style={{ fontWeight: 600, color: textColor, fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                              <User size={12} color="#0284C7" />
                              <span>{details.doctorName || "OPD Doctor"}</span>
                            </div>
                            {details.diagnosis && (
                              <div style={{ marginTop: "4px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    maxWidth: "180px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: isDark ? "#93C5FD" : "#1D4ED8",
                                    background: isDark ? "rgba(59, 130, 246, 0.12)" : "#EFF6FF",
                                    border: isDark ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid #DBEAFE",
                                    padding: "2px 7px",
                                    borderRadius: "5px",
                                  }}
                                  title={details.diagnosis}
                                >
                                  {details.diagnosis}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Prescribed Medicines */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            {details.medicines && details.medicines.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "240px" }}>
                                  {details.medicines.slice(0, 2).map((m, mIdx) => (
                                    <span
                                      key={mIdx}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        background: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                                        border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #E2E8F0",
                                        color: textColor,
                                        padding: "2px 7px",
                                        borderRadius: "5px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                      }}
                                    >
                                      <Pill size={10} color="#0284C7" />
                                      <span>{m.name}</span>
                                      {m.dosage && (
                                        <span style={{ color: mutedText, fontSize: "10px", fontWeight: 500 }}>
                                          · {m.dosage}
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                  {details.medicines.length > 2 && (
                                    <span
                                      style={{
                                        fontSize: "10.5px",
                                        color: "#0284C7",
                                        fontWeight: 700,
                                        background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                                        padding: "2px 6px",
                                        borderRadius: "5px",
                                        alignSelf: "center",
                                      }}
                                      title={details.medicines.slice(2).map((m) => m.name).join(", ")}
                                    >
                                      +{details.medicines.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: "11.5px", color: mutedText }}>—</span>
                            )}
                          </td>

                          {/* Dispensing Audit */}
                          <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                            <div style={{ fontSize: "11.5px", fontWeight: 700, color: textColor, display: "flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={11} color="#10B981" />
                              <span>{details.dispensedBy}</span>
                            </div>
                            {details.dispensedCounter && (
                              <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Building2 size={10} color={mutedText} />
                                <span>{details.dispensedCounter}</span>
                              </div>
                            )}
                            {details.dispensedAt && (
                              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Clock size={10} color={mutedText} />
                                <span>{new Date(details.dispensedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "12px 14px", textAlign: "center", verticalAlign: "middle" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "3px 9px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                letterSpacing: "0.2px",
                                background: isComplete
                                  ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5")
                                  : (isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB"),
                                color: isComplete ? "#059669" : "#D97706",
                                border: isComplete
                                  ? (isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #A7F3D0")
                                  : (isDark ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #FDE68A"),
                              }}
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: isComplete ? "#10B981" : "#F59E0B",
                                }}
                              />
                              <span>{isComplete ? (isHi ? "पूर्ण" : "Completed") : (isHi ? "प्रगति में" : "In Progress")}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "12px 14px", textAlign: "right", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => setSelectedVisitModal(visit)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: cardBorder,
                                  background: isDark ? "#1E293B" : "#FFFFFF",
                                  color: textColor,
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                                  transition: "all 0.15s ease",
                                }}
                                title={isHi ? "पूर्ण विज़िट विवरण देखें" : "View Visit Details"}
                              >
                                <Eye size={12} color="#0284C7" />
                                <span>{isHi ? "विवरण" : "Details"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePrintVisitPrescription(visit)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: "none",
                                  background: "#0284C7",
                                  color: "#FFFFFF",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  boxShadow: "0 1px 3px rgba(2, 132, 199, 0.25)",
                                  transition: "all 0.15s ease",
                                }}
                                title={isHi ? "डॉक्टर पर्चा प्रिंट करें" : "Print Doctor Prescription"}
                              >
                                <Printer size={12} />
                                <span>Rx</span>
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
          </div>
        </div>
      )}

      {/* Patient Visit Dossier Modal */}
      {selectedVisitModal && (
        (() => {
          const visit = selectedVisitModal;
          const details = parseVisitDetails(visit);
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
                    ✕
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
                  <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Pill size={14} color="#0284C7" />
                    <span>{isHi ? "निर्धारित दवाएं व खुराक अनुसूची" : "Prescribed Medications & Dosage Schedule"}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: "#0284C7", padding: "1px 6px", borderRadius: "4px" }}>
                      {details.medicines.length}
                    </span>
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
                          </tr>
                        </thead>
                        <tbody>
                          {details.medicines.map((m, mIdx) => (
                            <tr key={mIdx} style={{ borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 700, color: mutedText }}>{mIdx + 1}</td>
                              <td style={{ padding: "8px 12px", fontWeight: 800, color: textColor }}>{m.name}</td>
                              <td style={{ padding: "8px 12px", color: textColor }}>{m.dosage || "-"}</td>
                              <td style={{ padding: "8px 12px", fontWeight: 700, color: "#0284C7" }}>{m.frequency || "-"}</td>
                              <td style={{ padding: "8px 12px", color: textColor }}>{m.duration || "-"}</td>
                              <td style={{ padding: "8px 12px", color: mutedText }}>{m.instructions || "-"}</td>
                            </tr>
                          ))}
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
                        <div style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
                          📋 {isHi ? "चिकित्सक सलाह" : "Doctor Advice"}
                        </div>
                        <div style={{ fontSize: "12px", color: textColor, marginTop: "4px" }}>
                          {details.advice}
                        </div>
                      </div>
                    )}
                    {details.followUp && (
                      <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#F8FAFC", border: cardBorder }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
                          📅 {isHi ? "फॉलो-अप परामर्श" : "Follow-up Consultation"}
                        </div>
                        <div style={{ fontSize: "12px", color: textColor, marginTop: "4px" }}>
                          {details.followUp}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "14px", borderTop: cardBorder }}>

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
