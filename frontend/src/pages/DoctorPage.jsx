/**
 * StaffPage.jsx
 * -------------
 * Doctor & Staff Desk Dashboard (Admin View).
 * Matches the exact UI/UX, aesthetics, and responsive layout of the User Portal (PatientPage).
 * Features Multi-Department Ticket Classification & Security Routing!
 * Theme: Soft Green Clinical (Clean Healthcare Palette 4)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE } from "../config/hospitalConfig";
import { t, getCategoryLabel, getStatusLabel, formatSymptomLabel, formatRiskLabel } from "../utils/i18n";
import AdminHeroBanner from "../components/staff/AdminHeroBanner";
import DoctorShiftSummaryModal from "../components/staff/DoctorShiftSummaryModal";
import ClinicalPrescriptionWorkstation from "../components/staff/ClinicalPrescriptionWorkstation";
import Footer from "../components/common/Footer";
import PatientHistoryTimeline from "../components/patient-history/PatientHistoryTimeline";
import { printPrescriptionSlip, downloadPrescriptionPDF } from "../utils/printPassHelper";
import { usePatientHistory } from "../hooks/usePatientHistory";
import { InAppToast, InAppConfirmModal } from "../components/common/InAppNotification";
import {
  IconDoctor,
  IconHospital,
  IconDesk,
  IconPill,
  IconLab,
  IconClipboard,
  IconPrescription,
  IconCalendar,
  IconClock,
  IconSpeaker,
  IconPause,
  IconCoffee,
  IconAlertTriangle,
  IconCheckCircle,
  IconRepeat,
  IconDatabase,
  IconZap,
  IconUserX,
  IconSave,
  IconStethoscope,
  IconHeartPulse,
  IconEdit,
  IconActivity,
  IconSiren,
  IconPlay,
  IconShield,
} from "../components/common/MedicalIcons";

export default function DoctorPage({
  tenantId,
  currentUser,
  analytics,
  queueSnapshot = [],
  servingTickets = [],
  heldTickets = [],
  handleServeNext,
  handleCompleteTicket,
  handleHoldTicket,
  handleRecallTicket,
  handleMarkNoShow,
  handleCounterChange,
  refreshData,
  language = "en",
  socketRef,
  navigateTo,
  hospitalBranding = null,
  onUpdateHospitalBranding = null,
  theme = "light",
  setTheme = null,
}) {
  const [localBranding, setLocalBranding] = useState(hospitalBranding);

  useEffect(() => {
    if (hospitalBranding) {
      setLocalBranding(hospitalBranding);
    }
  }, [hospitalBranding]);

  // Synchronized Theme State
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_theme");
      if (saved === "dark" || saved === "light") return saved;
      if (theme === "dark" || theme === "light") return theme;
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch (e) {}
    return theme || "light";
  });

  useEffect(() => {
    if (theme && (theme === "dark" || theme === "light") && theme !== currentTheme) {
      setCurrentTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (e) => {
      const t = typeof e?.detail === "string" ? e.detail : e?.detail?.theme;
      if (t && (t === "dark" || t === "light")) {
        setCurrentTheme(t);
      }
    };
    window.addEventListener("theme_changed", handleThemeChange);
    return () => window.removeEventListener("theme_changed", handleThemeChange);
  }, []);

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
    } catch (e) {}
    if (setTheme) setTheme(nextTheme);
  };

  const isDark = currentTheme === "dark";

  // In-App Toast & Confirmation Modal States (replaces all window.alert and window.confirm)
  const [inAppToast, setInAppToast] = useState(null); // { id, message, title, type: "success" | "error" | "warn" | "info" }
  const toastTimerRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, confirmText, cancelText, isDestructive, onConfirm }

  const showToast = useCallback((msg, type = "success", durationMs = null) => {
    if (!msg) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const messageText = typeof msg === "object" ? msg.message : msg;
    const titleText = typeof msg === "object" ? msg.title : null;
    const finalType = (typeof msg === "object" ? msg.type : type) || "success";
    const actionText = typeof msg === "object" ? msg.actionText : null;
    const onAction = typeof msg === "object" ? msg.onAction : null;
    setInAppToast({ id: Date.now(), message: messageText, title: titleText, type: finalType, actionText, onAction });
    const autoDuration = durationMs || (actionText ? 9000 : (finalType === "error" || finalType === "warn" ? 6500 : 4500));
    toastTimerRef.current = setTimeout(() => {
      setInAppToast(null);
    }, autoDuration);
  }, []);

  const showConfirm = useCallback(({ title, message, confirmText, cancelText, isDestructive, onConfirm }) => {
    setConfirmDialog({
      title,
      message,
      confirmText,
      cancelText,
      isDestructive: Boolean(isDestructive),
      onConfirm,
    });
  }, []);

  const [activeTab, setActiveTab] = useState("ops"); // "ops" | "queue" | "apts"
  const [appointments, setAppointments] = useState([]);
  const [bookedSlotsViewMode, setBookedSlotsViewMode] = useState("pending"); // "pending" | "all"
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [targetDept, setTargetDept] = useState("pharmacy");
  const [hospitalDepartments, setHospitalDepartments] = useState([]);
  const [rxNotes, setRxNotes] = useState("");
  const [transferStatusMsg, setTransferStatusMsg] = useState("");
  const [announceFeedbackMsg, setAnnounceFeedbackMsg] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // Announcement Counter map: { [ticketId]: number }
  const [announcementCounts, setAnnouncementCounts] = useState({});

  // Real-time ticking clock for held grace countdown timers
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const timer = setInterval(() => setNowSec(Date.now() / 1000), 1000);
    return () => clearInterval(timer);
  }, []);

  // Doctor Prescription Modal & Full-Page Workstation State
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [rxViewMode, setRxViewMode] = useState("page"); // "page" | "modal"
  const [prescriptionTicket, setPrescriptionTicket] = useState(null);
  const [rxDiagnosis, setRxDiagnosis] = useState("");
  const [rxCustomFinding, setRxCustomFinding] = useState("");
  const [rxMedicines, setRxMedicines] = useState([
    { name: "", dosage: "500mg", frequency: "1-0-1", duration: "5 days", instructions: "After food" },
  ]);
  const [rxLabTests, setRxLabTests] = useState("");
  const [rxCustomLabTest, setRxCustomLabTest] = useState("");
  const [rxAdvice, setRxAdvice] = useState("");
  const [rxFollowUp, setRxFollowUp] = useState("");
  const [rxRoutingDept, setRxRoutingDept] = useState("pharmacy");
  const [rxTransferNotes, setRxTransferNotes] = useState("");
  const [rxSaving, setRxSaving] = useState(false);
  const [rxStatusMsg, setRxStatusMsg] = useState("");
  const [rxAutoSaveStatus, setRxAutoSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const [rxLastSavedAt, setRxLastSavedAt] = useState(null);
  const isInitialLoadRef = useRef(true);
  const autoSaveTimerRef = useRef(null);

  const effectiveHospitalCode =
    localBranding?.hospital_code ||
    hospitalBranding?.hospital_code ||
    (currentUser && (currentUser.hospital_code || currentUser.primary_hospital_code) && (currentUser.hospital_code || currentUser.primary_hospital_code) !== "all"
      ? (currentUser.hospital_code || currentUser.primary_hospital_code)
      : tenantId) ||
    HOSPITAL_CONFIG.tenantId ||
    "city-hospital-01";

  useEffect(() => {
    if (!hospitalBranding && effectiveHospitalCode) {
      fetch(`${API_BASE}/api/v1/hospital/branding/${effectiveHospitalCode}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status === "success" && d.branding) {
            setLocalBranding(d.branding);
          }
        })
        .catch((e) => console.log("Staff branding fetch error:", e));
    }
  }, [effectiveHospitalCode, hospitalBranding]);

  useEffect(() => {
    if (!effectiveHospitalCode) return;
    let isMounted = true;
    const fetchDepartments = () => {
      fetch(`${API_BASE}/api/v1/hospitals/${encodeURIComponent(effectiveHospitalCode)}/departments`)
        .then((r) => r.json())
        .then((data) => {
          if (isMounted && data && data.status === "success" && Array.isArray(data.departments) && data.departments.length > 0) {
            setHospitalDepartments(data.departments);
          }
        })
        .catch(() => {});
    };
    fetchDepartments();
    const handleHospUpdate = () => fetchDepartments();
    window.addEventListener("hospital_departments_updated", handleHospUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("hospital_departments_updated", handleHospUpdate);
    };
  }, [effectiveHospitalCode]);



  const adminDept = currentUser && currentUser.department ? currentUser.department.toLowerCase() : "all";
  const userRole = (currentUser?.role || "").toLowerCase();
  const isStaffOrDoctor = ["doctor", "staff", "nurse", "receptionist"].includes(userRole);
  const canModifyDesks = !isStaffOrDoctor && (userRole === "super_admin" || userRole === "superadmin");
  const canViewDbInspector =
    userRole !== "doctor" &&
    ["receptionist", "staff", "super_admin", "superadmin", "admin"].includes(userRole);
  // Clinical Consultation Tickets only (excluding pharmacy dispensing tickets)
  const clinicalServingTickets = (servingTickets || []).filter(
    (t) => (t.service_category || "").toLowerCase() !== "pharmacy"
  );
  const clinicalQueueSnapshot = (queueSnapshot || []).filter(
    (t) => (t.service_category || "").toLowerCase() !== "pharmacy"
  );
  const clinicalHeldTickets = (heldTickets || []).filter(
    (t) => (t.service_category || "").toLowerCase() !== "pharmacy"
  );
  const pharmacyWaitingCount = (queueSnapshot || []).filter(
    (t) => (t.service_category || "").toLowerCase() === "pharmacy"
  ).length;

  const primaryServing = clinicalServingTickets.length > 0 ? clinicalServingTickets[0] : null;

  // STRICT CLINICAL RULE: A doctor can only serve one patient at a time
  const doctorId = currentUser?.id;
  const doctorEmail = currentUser?.email;
  const doctorName = currentUser?.name;

  const myServingTicket = clinicalServingTickets.find(
    (t) =>
      (t.served_by_doctor_id && doctorId && String(t.served_by_doctor_id) === String(doctorId)) ||
      (t.served_by_doctor_email && doctorEmail && String(t.served_by_doctor_email).toLowerCase() === String(doctorEmail).toLowerCase()) ||
      (t.served_by_doctor_name && doctorName && String(t.served_by_doctor_name).trim().toLowerCase() === String(doctorName).trim().toLowerCase())
  ) || (clinicalServingTickets.length > 0 ? clinicalServingTickets[0] : null);

  // Auto-clear pharmacy tickets from Doctor consultation pad
  useEffect(() => {
    if (prescriptionTicket && (prescriptionTicket.service_category || "").toLowerCase() === "pharmacy") {
      setShowPrescriptionModal(false);
      setPrescriptionTicket(null);
    }
  }, [prescriptionTicket]);

  const isDoctorBusy = Boolean(myServingTicket);
  const [serveFeedbackMsg, setServeFeedbackMsg] = useState("");

  // Patient Medical History for currently consulted patient
  const {
    historyData: servingPatientHistory,
    patient: servingPatient,
    summary: servingPatientSummary,
    visits: servingPatientVisits,
    prescriptions: servingPatientPrescriptions,
    reports: servingPatientReports,
    isReturningPatient: isServingPatientReturning,
    totalVisits: servingPatientTotalVisits,
    loading: servingHistoryLoading,
  } = usePatientHistory({
    ticketId: prescriptionTicket?.ticket_id || myServingTicket?.ticket_id,
    hospitalId: tenantId,
    socketRef,
    autoFetch: Boolean(prescriptionTicket || myServingTicket),
  });

  const [rxPreFillWarning, setRxPreFillWarning] = useState("");

  const handleUsePreviousPrescription = (prevRx) => {
    const targetTicket = prescriptionTicket || myServingTicket;
    if (!targetTicket || !prevRx) return;
    setPrescriptionTicket(targetTicket);
    setRxViewMode("page");
    isInitialLoadRef.current = true;
    setRxAutoSaveStatus("idle");
    setRxLastSavedAt(null);
    setRxDiagnosis(prevRx.diagnosis || "");
    setRxMedicines(
      Array.isArray(prevRx.medicines) && prevRx.medicines.length > 0
        ? prevRx.medicines
        : [{ name: "", dosage: "500mg", frequency: "1-0-1", duration: "5 days", instructions: "After food" }]
    );
    setRxLabTests(prevRx.lab_tests || "");
    setRxAdvice(prevRx.advice || "");
    setRxFollowUp(prevRx.follow_up || "After 5 days or if needed");
    setRxPreFillWarning(
      language === "hi"
        ? "पूर्व प्रिस्क्रिप्शन संदर्भ हेतु लोड किया गया। कृपया सबमिट करने से पहले दवाइयों और खुराक की जांच करें।"
        : "Previous prescription loaded for reference. Please review medicines and dosage before submitting."
    );
    setShowPrescriptionModal(true);
  };

  // Doctor Duty Status & Break Timer State
  const userStorageKey = currentUser?.id || currentUser?.email || "default_doc";
  const [doctorDutyStatus, setDoctorDutyStatus] = useState(() => {
    try {
      return localStorage.getItem(`doctor_duty_status_${userStorageKey}`) || "ACTIVE";
    } catch (e) {
      return "ACTIVE";
    }
  });

  const [dutyStatusChangedAt, setDutyStatusChangedAt] = useState(() => {
    try {
      const saved = localStorage.getItem(`doctor_duty_timer_${userStorageKey}`);
      return saved ? parseInt(saved, 10) : null;
    } catch (e) {
      return null;
    }
  });

  const [dutyTimerText, setDutyTimerText] = useState("");
  const [showShiftSummaryModal, setShowShiftSummaryModal] = useState(false);

  // Live timer interval for break or emergency round
  useEffect(() => {
    const isTimerActive = doctorDutyStatus === "ON_BREAK" || doctorDutyStatus === "EMERGENCY_ROUND";
    if (!isTimerActive || !dutyStatusChangedAt) {
      setDutyTimerText("");
      return;
    }

    const updateTimer = () => {
      const elapsedSecs = Math.max(0, Math.floor((Date.now() - dutyStatusChangedAt) / 1000));
      const mins = Math.floor(elapsedSecs / 60);
      const secs = elapsedSecs % 60;
      setDutyTimerText(`${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [doctorDutyStatus, dutyStatusChangedAt]);

  // Handle duty status change
  const handleUpdateDutyStatus = useCallback(
    async (newStatus) => {
      const finalStatus = (newStatus || "ACTIVE").toUpperCase();
      setDoctorDutyStatus(finalStatus);

      if (finalStatus === "OFF_DUTY") {
        setShowShiftSummaryModal(true);
      } else if (finalStatus === "ACTIVE") {
        showToast(language === "hi" ? "आपकी स्थिति 'सक्रिय (Active)' पर सेट है — मरीज़ों को बुलाने हेतु तैयार।" : "Doctor status: Active — Ready to attend patients.", "success");
      } else if (finalStatus === "ON_BREAK") {
        showToast(language === "hi" ? "आपकी स्थिति 'अवकाश (On Break)' पर सेट है — मरीज़ रूटिंग रोक दी गई है।" : "Doctor status: On Break — Patient routing paused.", "info");
      } else if (finalStatus === "EMERGENCY_ROUND") {
        showToast(language === "hi" ? "स्थिति 'आपातकालीन राउंड' पर सेट है।" : "Doctor status: Emergency / ICU Round.", "warn");
      }

      let timestamp = dutyStatusChangedAt;
      if (finalStatus === "ON_BREAK" || finalStatus === "EMERGENCY_ROUND") {
        if (!dutyStatusChangedAt || doctorDutyStatus === "ACTIVE" || doctorDutyStatus === "OFF_DUTY") {
          timestamp = Date.now();
          setDutyStatusChangedAt(timestamp);
        }
      } else {
        timestamp = null;
        setDutyStatusChangedAt(null);
      }

      try {
        localStorage.setItem(`doctor_duty_status_${userStorageKey}`, finalStatus);
        if (timestamp) {
          localStorage.setItem(`doctor_duty_timer_${userStorageKey}`, String(timestamp));
        } else {
          localStorage.removeItem(`doctor_duty_timer_${userStorageKey}`);
        }
      } catch (e) {}

      // Emit over socket or fallback to HTTP
      const payload = {
        tenant_id: effectiveHospitalCode || tenantId,
        doctor_id: currentUser?.id,
        doctor_email: currentUser?.email,
        doctor_name: currentUser?.name || currentUser?.username,
        status: finalStatus,
        break_type: finalStatus === "ON_BREAK" ? "tea" : finalStatus === "EMERGENCY_ROUND" ? "emergency" : null,
      };

      if (socketRef && socketRef.current) {
        socketRef.current.emit("update_doctor_duty_status", payload);
      }

      fetch(`${API_BASE}/api/v1/doctor/duty-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    },
    [currentUser, tenantId, effectiveHospitalCode, socketRef, userStorageKey, dutyStatusChangedAt, doctorDutyStatus, language, showToast]
  );

  // Sync status from server on mount — only if server has a real stored record.
  // When duty is null, server has no entry (restart / first login) — keep localStorage value.
  useEffect(() => {
    const docId = currentUser?.id || currentUser?.email;
    if (!docId) return;

    fetch(`${API_BASE}/api/v1/doctor/duty-status/${encodeURIComponent(docId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success" && d.duty && d.duty.status) {
          // Server has a real record — trust it and sync
          setDoctorDutyStatus(d.duty.status);
          if (d.duty.status === "ON_BREAK" || d.duty.status === "EMERGENCY_ROUND") {
            setDutyStatusChangedAt(d.duty.status_changed_at || Date.now());
          } else {
            setDutyStatusChangedAt(null);
          }
          try {
            localStorage.setItem(`doctor_duty_status_${userStorageKey}`, d.duty.status);
          } catch (e) {}
        }
        // d.duty is null → server has no record, keep localStorage value — do nothing
      })
      .catch(() => {});
  }, [currentUser]);


  // Socket listener for remote duty status updates
  useEffect(() => {
    if (!socketRef || !socketRef.current) return;
    const s = socketRef.current;
    const handleDutyChange = (data) => {
      if (!data) return;
      const matchesDoc =
        (data.doctor_id && currentUser?.id && String(data.doctor_id) === String(currentUser.id)) ||
        (data.doctor_email && currentUser?.email && String(data.doctor_email).toLowerCase() === String(currentUser.email).toLowerCase());

      if (matchesDoc && data.duty) {
        setDoctorDutyStatus(data.duty.status);
        if (data.duty.status === "ON_BREAK" || data.duty.status === "EMERGENCY_ROUND") {
          setDutyStatusChangedAt(data.duty.status_changed_at || Date.now());
        } else {
          setDutyStatusChangedAt(null);
        }
      }
    };
    s.on("doctor_duty_status_changed", handleDutyChange);
    return () => {
      s.off("doctor_duty_status_changed", handleDutyChange);
    };
  }, [socketRef, currentUser]);

  const [showDutyMenu, setShowDutyMenu] = useState(false);
  const dutyMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dutyMenuRef.current && !dutyMenuRef.current.contains(event.target)) {
        setShowDutyMenu(false);
      }
    }
    if (showDutyMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDutyMenu]);

  const isHi = language === "hi";
  const dutyOptions = [
    {
      id: "ACTIVE",
      label: isHi ? "सक्रिय (ड्यूटी पर)" : "Active (Ready to Call)",
      badgeLabel: isHi ? "सक्रिय" : "Active",
      icon: <IconActivity size={13} color="#10B981" />,
      color: "#10B981",
      bg: isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5",
      border: isDark ? "rgba(16, 185, 129, 0.45)" : "#A7F3D0",
      desc: isHi ? "मरीज़ों को बुलाने एवं परामर्श हेतु तैयार" : "Available to receive & call patients",
    },
    {
      id: "ON_BREAK",
      label: isHi ? "चाय / अल्पाहार अवकाश" : "On Tea / Lunch Break",
      badgeLabel: isHi ? "अवकाश पर" : "On Break",
      icon: <IconCoffee size={13} color="#D97706" />,
      color: "#D97706",
      bg: isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7",
      border: isDark ? "rgba(245, 158, 11, 0.5)" : "#FDE68A",
      desc: isHi ? "कतार कॉलिंग रुकी है, टाइमर सक्रिय" : "Pauses patient routing & starts timer",
    },
    {
      id: "EMERGENCY_ROUND",
      label: isHi ? "आपातकालीन / वार्ड राउंड" : "Emergency / ICU Round",
      badgeLabel: isHi ? "इमरजेंसी राउंड" : "ICU Round",
      icon: <IconSiren size={13} color="#E11D48" />,
      color: "#E11D48",
      bg: isDark ? "rgba(244, 63, 94, 0.2)" : "#FFE4E6",
      border: isDark ? "rgba(244, 63, 94, 0.5)" : "#FECDD3",
      desc: isHi ? "आपातकालीन वार्ड या आईसीयू में उपस्थित" : "Doctor attending emergency patients",
    },
    {
      id: "OFF_DUTY",
      label: isHi ? "ड्यूटी समाप्त (ऑफ ड्यूटी)" : "Shift Ended (Off Duty)",
      badgeLabel: isHi ? "ड्यूटी समाप्त" : "Off Duty",
      icon: <IconShield size={13} color={isDark ? "#94A3B8" : "#64748B"} />,
      color: isDark ? "#94A3B8" : "#64748B",
      bg: isDark ? "rgba(148, 163, 184, 0.2)" : "#F1F5F9",
      border: isDark ? "rgba(148, 163, 184, 0.4)" : "#CBD5E1",
      desc: isHi ? "आज का परामर्श समाप्त, डेस्क बंद" : "Desk consultation closed for today",
    },
  ];

  const currentDuty = dutyOptions.find((d) => d.id === doctorDutyStatus) || dutyOptions[0];
  const isOnBreakOrEmergency = doctorDutyStatus === "ON_BREAK" || doctorDutyStatus === "EMERGENCY_ROUND";


  useEffect(() => {
    const handleServeErr = (e) => {
      if (e.detail?.message) {
        setServeFeedbackMsg(e.detail.message);
        setTimeout(() => setServeFeedbackMsg(""), 6000);
        showToast(e.detail.message, "error");
      }
    };
    window.addEventListener("queue_serve_error", handleServeErr);
    return () => window.removeEventListener("queue_serve_error", handleServeErr);
  }, [showToast]);

  const onCallNextPatient = () => {
    // 1. Guard against calling while on Break / Emergency / Off Duty
    if (doctorDutyStatus !== "ACTIVE") {
      const statusNames = {
        ON_BREAK: language === "hi" ? "चाय / अल्पाहार अवकाश" : "Tea / Lunch Break",
        EMERGENCY_ROUND: language === "hi" ? "आपातकालीन राउंड" : "Emergency / ICU Round",
        OFF_DUTY: language === "hi" ? "ड्यूटी समाप्त" : "Off Duty (Shift Ended)",
      };
      const warnMsg =
        language === "hi"
          ? `आप वर्तमान में '${statusNames[doctorDutyStatus] || doctorDutyStatus}' पर हैं। कतार से मरीज़ों को बुलाने हेतु कृपया अपनी स्थिति 'सक्रिय (Active)' करें।`
          : `You are currently on ${statusNames[doctorDutyStatus] || doctorDutyStatus}. Automatic patient routing is paused. Switch your status to 'Active' to call the next patient.`;
      setServeFeedbackMsg(warnMsg);
      setTimeout(() => setServeFeedbackMsg(""), 7000);
      showToast(warnMsg, "warn");
      return;
    }

    // 2. Strict clinical rule: 1 patient per doctor
    if (isDoctorBusy && myServingTicket) {
      const busyMsg =
        language === "hi"
          ? `डॉक्टर एक समय में केवल 1 मरीज़ को देख सकते हैं। आप वर्तमान में #${myServingTicket.ticket_id} (${myServingTicket.name}) का परामर्श कर रहे हैं। अगला टोकन बुलाने से पहले यह परामर्श पूर्ण (Complete) करें।`
          : `A doctor can only serve one patient at a time. You are currently consulting with Patient #${myServingTicket.ticket_id} (${myServingTicket.name}). Please complete or transfer this consultation before calling the next patient.`;
      setServeFeedbackMsg(busyMsg);
      setTimeout(() => setServeFeedbackMsg(""), 6000);
      showToast(busyMsg, "warn");
      return;
    }
    setServeFeedbackMsg("");
    handleServeNext();
  };

  const handleReAnnounce = async (ticket) => {
    try {
      const tid = ticket.ticket_id;
      const currentCnt = (announcementCounts[tid] || ticket.announcement_count || 1) + 1;
      setAnnouncementCounts((prev) => ({ ...prev, [tid]: currentCnt }));

      if (socketRef && socketRef.current) {
        socketRef.current.emit("re_announce", { tenant_id: tenantId, ticket: { ...ticket, announcement_count: currentCnt }, ticket_id: tid });
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/re-announce`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tenantId, ticket_id: tid }),
        });
      }

      const msg =
        language === "hi"
          ? `टोकन #${tid} (${ticket.name}) की कॉल संख्या ${currentCnt} प्रसारित की गई!`
          : `Broadcasted Announcement #${currentCnt} for Token #${tid} (${ticket.name})!`;
      setAnnounceFeedbackMsg(msg);
      setTimeout(() => setAnnounceFeedbackMsg(""), 3500);
      showToast(msg, "info");
    } catch (e) {
      console.log("Re-announce broadcast error:", e);
    }
  };

  const handleSkipToHold = async (ticket) => {
    if (!ticket) return;
    try {
      if (handleHoldTicket) {
        await handleHoldTicket(ticket.ticket_id, 10);
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/hold-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tenantId, ticket_id: ticket.ticket_id, grace_minutes: 10 }),
        });
        if (refreshData) refreshData();
      }
      const msg =
        language === "hi"
          ? `⏸️ टोकन #${ticket.ticket_id} (${ticket.name}) को 10 मिनट के ग्रेस पीरियड पर रखा गया। डेस्क अगले मरीज़ हेतु खाली है!`
          : `⏸️ Token #${ticket.ticket_id} (${ticket.name}) placed on 10-Minute Grace Period. Desk is now available for next patient!`;
      setAnnounceFeedbackMsg(msg);
      setTimeout(() => setAnnounceFeedbackMsg(""), 6000);
      showToast(msg, "warn");
    } catch (e) {
      console.log("Hold ticket error:", e);
      showToast(
        language === "hi" ? `ग्रेस पीरियड में रखने में त्रुटि: ${e.message || "विफल"}` : `Error holding ticket: ${e.message || "Failed"}`,
        "error"
      );
    }
  };

  const handleRecallHeld = async (ticket) => {
    if (!ticket) return;
    try {
      if (handleRecallTicket) {
        await handleRecallTicket(ticket.ticket_id, isDoctorBusy ? "queue" : "auto");
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/recall-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            ticket_id: ticket.ticket_id,
            doctor_id: currentUser?.id,
            doctor_name: currentUser?.name || currentUser?.username,
            doctor_email: currentUser?.email,
            target_mode: isDoctorBusy ? "queue" : "auto",
          }),
        });
        if (refreshData) refreshData();
      }
      const msg =
        language === "hi"
          ? `टोकन #${ticket.ticket_id} (${ticket.name}) को पुनः सक्रिय किया गया!`
          : `Recalled #${ticket.ticket_id} (${ticket.name}) back to active queue!`;
      setAnnounceFeedbackMsg(msg);
      setTimeout(() => setAnnounceFeedbackMsg(""), 4500);
      showToast(msg, "success");
    } catch (e) {
      console.log("Recall ticket error:", e);
      showToast(
        language === "hi" ? `पुनः सक्रिय करने में त्रुटि: ${e.message || "विफल"}` : `Error recalling ticket: ${e.message || "Failed"}`,
        "error"
      );
    }
  };

  const handleFinalizeNoShow = (ticket) => {
    if (!ticket) return;
    const isHi = language === "hi";
    const confirmMsg =
      isHi
        ? `क्या आप टोकन #${ticket.ticket_id} (${ticket.name}) को 'अनुपस्थित (No-Show)' चिह्नित करना चाहते हैं? मरीज़ को सक्रिय कतार से हटा दिया जाएगा।`
        : `Are you sure you want to mark Token #${ticket.ticket_id} (${ticket.name}) as No-Show? The patient will be removed from the active queue.`;

    showConfirm({
      title: isHi ? "अनुपस्थित (No-Show) चिह्नित करें" : "Mark as No-Show",
      message: confirmMsg,
      confirmText: isHi ? "हाँ, अनुपस्थित दर्ज करें" : "Mark as No-Show",
      cancelText: isHi ? "रद्द करें" : "Cancel",
      isDestructive: true,
      onConfirm: async () => {
        try {
          if (handleMarkNoShow) {
            await handleMarkNoShow(ticket.ticket_id, "Patient absent after repeated announcements & grace period");
          } else {
            await fetch(`${API_BASE}/api/v1/plugin/no-show`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenant_id: tenantId,
                ticket_id: ticket.ticket_id,
                reason: "Patient absent after repeated announcements & grace period",
              }),
            });
            if (refreshData) refreshData();
          }
          const feedbackMsg =
            isHi
              ? `टोकन #${ticket.ticket_id} (${ticket.name}) को 'अनुपस्थित (No-Show)' दर्ज किया गया।`
              : `Token #${ticket.ticket_id} (${ticket.name}) marked as No-Show.`;
          setAnnounceFeedbackMsg(feedbackMsg);
          setTimeout(() => setAnnounceFeedbackMsg(""), 4000);
          showToast(feedbackMsg, "info");
        } catch (e) {
          console.log("Finalize no-show error:", e);
          showToast(
            isHi ? `त्रुटि: ${e.message || "कार्रवाई विफल"}` : `Error marking No-Show: ${e.message || "Failed"}`,
            "error"
          );
        }
      },
    });
  };

  const handleConfirmFinishConsult = (ticket) => {
    if (!ticket) return;
    const isHi = language === "hi";
    showConfirm({
      title: isHi ? "परामर्श पूर्ण करें" : "Complete Consultation",
      message: isHi
        ? `क्या आप टोकन #${ticket.ticket_id} (${ticket.name}) का परामर्श पूर्ण करना चाहते हैं?`
        : `Are you sure you want to finish consultation for Token #${ticket.ticket_id} (${ticket.name})?`,
      confirmText: isHi ? "हाँ, परामर्श पूर्ण करें" : "Complete Consult",
      cancelText: isHi ? "रद्द करें" : "Cancel",
      isDestructive: false,
      onConfirm: async () => {
        try {
          if (handleCompleteTicket) {
            await handleCompleteTicket(ticket.ticket_id);
          }
          const msg = isHi
            ? `✓ टोकन #${ticket.ticket_id} (${ticket.name}) का परामर्श पूर्ण हुआ!`
            : `✓ Consultation completed for Token #${ticket.ticket_id} (${ticket.name})!`;
          showToast(msg, "success");
          if (refreshData) refreshData();
        } catch (e) {
          showToast(
            isHi ? `त्रुटि: ${e.message || "कार्रवाई विफल"}` : `Error completing consultation: ${e.message || "Failed"}`,
            "error"
          );
        }
      },
    });
  };

  const handleOpenTransferModal = (ticket) => {
    handleOpenPrescriptionModal(ticket);
  };

  const handleOpenPrescriptionModal = (ticket) => {
    setPrescriptionTicket(ticket);
    setRxViewMode("page");
    setRxStatusMsg("");
    setRxSaving(false);
    setRxPreFillWarning("");
    setRxCustomFinding("");
    isInitialLoadRef.current = true;
    setRxAutoSaveStatus("idle");
    setRxLastSavedAt(null);

    let parsed = null;
    let localDraft = null;
    try {
      const stored = localStorage.getItem(`rx_draft_${ticket.ticket_id}`);
      if (stored) {
        localDraft = JSON.parse(stored);
      }
    } catch (_) {}

    if (ticket.prescription_notes) {
      try {
        if (typeof ticket.prescription_notes === "object") {
          parsed = ticket.prescription_notes;
        } else if (typeof ticket.prescription_notes === "string") {
          let trimmed = ticket.prescription_notes.trim();
          while (
            (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))
          ) {
            trimmed = trimmed.slice(1, -1).trim();
          }
          if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            parsed = JSON.parse(trimmed);
          } else {
            const direct = JSON.parse(ticket.prescription_notes);
            if (typeof direct === "object" && direct !== null) parsed = direct;
            else if (typeof direct === "string" && direct.trim().startsWith("{")) parsed = JSON.parse(direct);
          }
        }
      } catch (e) {}
    }

    const effectiveData = localDraft || parsed;

    if (effectiveData && typeof effectiveData === "object") {
      setRxDiagnosis(effectiveData.diagnosis || "");
      setRxMedicines(
        Array.isArray(effectiveData.medicines) && effectiveData.medicines.length > 0
          ? effectiveData.medicines
          : [{ name: "", dosage: "500mg", frequency: "1-0-1", duration: "5 days", instructions: "After food" }]
      );
      setRxLabTests(effectiveData.lab_tests || "");
      setRxAdvice(effectiveData.advice || "");
      setRxFollowUp(effectiveData.follow_up || "");
      setRxRoutingDept(
        effectiveData.target_department ||
        (Array.isArray(effectiveData.medicines) && effectiveData.medicines.some((m) => m.name && m.name.trim() !== "")
          ? "pharmacy"
          : "none")
      );
      setRxTransferNotes(effectiveData.transfer_notes || "");
      setRxCustomLabTest("");
      if (localDraft) {
        setRxAutoSaveStatus("saved");
        setRxLastSavedAt(new Date());
      }
    } else {
      setRxDiagnosis(
        ticket.medical_condition && ticket.medical_condition !== "general_checkup"
          ? ticket.medical_condition
          : ""
      );
      setRxMedicines([
        { name: "", dosage: "500mg", frequency: "1-0-1", duration: "5 days", instructions: "After food" },
      ]);
      setRxLabTests("");
      setRxCustomLabTest("");
      setRxAdvice(typeof ticket.prescription_notes === "string" ? ticket.prescription_notes : "");
      setRxFollowUp("After 5 days or if needed");
      setRxRoutingDept("pharmacy");
      setRxTransferNotes("");
    }
    setShowPrescriptionModal(true);
  };

  const handleAddMedicineRow = () => {
    setRxMedicines((prev) => [
      ...prev,
      { name: "", dosage: "500mg", frequency: "1-0-1", duration: "5 days", instructions: "After food" },
    ]);
  };

  const handleRemoveMedicineRow = (idx) => {
    setRxMedicines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMedicineChange = (idx, field, val) => {
    setRxMedicines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const buildPrescriptionPayload = () => {
    let resolvedDocName = currentUser?.name || currentUser?.username || "Attending Doctor";
    if (resolvedDocName && !resolvedDocName.startsWith("Dr.") && !resolvedDocName.startsWith("Dr ")) {
      resolvedDocName = `Dr. ${resolvedDocName}`;
    }

    let finalDiagnosis = rxDiagnosis;
    if (rxCustomFinding && rxCustomFinding.trim()) {
      const pendingParts = rxCustomFinding
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const current = finalDiagnosis
        ? finalDiagnosis.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      pendingParts.forEach((p) => {
        if (!current.some((c) => c.toLowerCase() === p.toLowerCase())) {
          current.push(p);
        }
      });
      finalDiagnosis = current.join(", ");
    }

    let finalLabTests = rxLabTests;
    if (rxCustomLabTest && rxCustomLabTest.trim()) {
      const pendingLabParts = rxCustomLabTest
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const currentLabs = finalLabTests
        ? finalLabTests.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      pendingLabParts.forEach((p) => {
        if (!currentLabs.some((c) => c.toLowerCase() === p.toLowerCase())) {
          currentLabs.push(p);
        }
      });
      finalLabTests = currentLabs.join(", ");
    }

    return {
      doctor_name: resolvedDocName,
      doctor_department: prescriptionTicket?.service_category || currentUser?.department || "General Consultation",
      doctor_employee_id: currentUser?.employee_id || "",
      diagnosis: finalDiagnosis || "Consultation & Clinical Assessment",
      medicines: rxMedicines.filter((m) => m.name && m.name.trim() !== ""),
      lab_tests: finalLabTests,
      advice: rxAdvice,
      follow_up: rxFollowUp,
      target_department: rxRoutingDept && rxRoutingDept !== "none" ? rxRoutingDept : null,
      transfer_notes: rxTransferNotes,
      prescribed_at: new Date().toISOString(),
    };
  };

  const handleClosePrescriptionModal = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
      if (prescriptionTicket?.ticket_id) {
        try {
          const payload = buildPrescriptionPayload();
          localStorage.setItem(`rx_draft_${prescriptionTicket.ticket_id}`, JSON.stringify(payload));
          fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenant_id: tenantId,
              ticket_id: prescriptionTicket.ticket_id,
              prescription: payload,
            }),
          }).catch(() => {});
        } catch (_) {}
      }
    }
    setRxCustomLabTest("");
    setShowPrescriptionModal(false);
  };

  const handlePrintCurrentModalRx = (asPdf = false) => {
    if (!prescriptionTicket) return;
    const payload = buildPrescriptionPayload();
    const rxData = {
      ...payload,
      patient_name: prescriptionTicket.name,
      age: prescriptionTicket.age || 30,
      gender: prescriptionTicket.gender || "male",
      phone: prescriptionTicket.phone || "",
      ticket_id: prescriptionTicket.ticket_id,
      appointment_id: prescriptionTicket.appointment_id || "",
      service_category: prescriptionTicket.service_category,
      hospital_name: localBranding?.hospital_name || currentUser?.hospital_name || "City General Hospital",
      prescribed_at: payload.prescribed_at || new Date().toISOString(),
    };

    if (asPdf) {
      downloadPrescriptionPDF(rxData, language, localBranding);
      showToast(language === "hi" ? "दवा पर्ची पीडीएफ डाउनलोड हो रही है..." : "Downloading prescription PDF...", "info");
    } else {
      printPrescriptionSlip(rxData, language, localBranding);
    }
  };

  const handlePrintTicketPrescription = (ticket, asPdf = false) => {
    if (!ticket) return;
    let parsedNotes = null;
    if (ticket.prescription_notes) {
      if (typeof ticket.prescription_notes === "object") {
        parsedNotes = ticket.prescription_notes;
      } else if (typeof ticket.prescription_notes === "string") {
        try {
          let str = ticket.prescription_notes.trim();
          while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            str = str.slice(1, -1).trim();
          }
          parsedNotes = JSON.parse(str);
        } catch (e) {
          parsedNotes = { advice: ticket.prescription_notes };
        }
      }
    }

    const rxData = {
      ...(parsedNotes || {}),
      patient_name: ticket.name || parsedNotes?.patient_name || "Patient",
      age: ticket.age || parsedNotes?.age || 30,
      gender: ticket.gender || parsedNotes?.gender || "male",
      phone: ticket.phone || parsedNotes?.phone || "",
      ticket_id: ticket.ticket_id,
      appointment_id: ticket.appointment_id || "",
      service_category: ticket.service_category,
      doctor_name: parsedNotes?.doctor_name || currentUser?.name || currentUser?.username || "Dr. Staff Desk",
      doctor_department: parsedNotes?.doctor_department || ticket.service_category || currentUser?.department,
      doctor_employee_id: parsedNotes?.doctor_employee_id || currentUser?.employee_id || currentUser?.employee_code || "",
      hospital_name: localBranding?.hospital_name || currentUser?.hospital_name || "City General Hospital",
      prescribed_at: parsedNotes?.prescribed_at || new Date().toISOString(),
    };

    if (asPdf) {
      downloadPrescriptionPDF(rxData, language, localBranding);
      showToast(language === "hi" ? "दवा पर्ची पीडीएफ डाउनलोड हो रही है..." : "Downloading prescription PDF...", "info");
    } else {
      printPrescriptionSlip(rxData, language, localBranding);
    }
  };

  const handleSavePrescription = async (andComplete = false) => {
    if (!prescriptionTicket) return;
    setRxSaving(true);
    setRxStatusMsg(language === "hi" ? "दवा पर्ची सहेजी जा रही है..." : "Saving E-Prescription...");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const payload = buildPrescriptionPayload();

    try {
      if (andComplete) {
        try {
          localStorage.removeItem(`rx_draft_${prescriptionTicket.ticket_id}`);
        } catch (_) {}

        if (rxRoutingDept && rxRoutingDept !== "none") {
          // ROUTE / TRANSFER TO TARGET DEPARTMENT WITH STRUCTURED PRESCRIPTION
          setRxStatusMsg(
            language === "hi"
              ? `दवा पर्ची सहेजी जा रही है एवं मरीज़ को ${getCategoryLabel(rxRoutingDept, language)} में भेजा जा रहा है...`
              : `Saving Rx & routing patient to ${getCategoryLabel(rxRoutingDept, language)}...`
          );
          const res = await fetch(`${API_BASE}/api/v1/plugin/transfer-ticket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenant_id: tenantId,
              ticket_id: prescriptionTicket.ticket_id,
              target_department: rxRoutingDept,
              prescription_notes: JSON.stringify(payload),
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const newTid = data.new_ticket?.ticket_id || prescriptionTicket.ticket_id;
            const isToPharma = (rxRoutingDept || "").toLowerCase() === "pharmacy";
            const successMsg =
              language === "hi"
                ? `✓ परामर्श पूर्ण हुआ! टोकन #${newTid} को ${getCategoryLabel(rxRoutingDept, language)} में ई-प्रिस्क्रिप्शन सहित स्थानांतरित किया गया।`
                : `✓ Consultation Complete! Token #${newTid} routed to ${getCategoryLabel(rxRoutingDept, language)} with prescription.`;
            setRxStatusMsg(successMsg);
            showToast({
              title: isToPharma ? (language === "hi" ? "फार्मेसी में प्रेषित ✓" : "Patient Routed to Pharmacy ✓") : null,
              message: successMsg,
              type: "success",
              actionText: isToPharma ? (language === "hi" ? "फार्मेसी स्टेशन खोलें ➔" : "Open Pharmacy Station ➔") : null,
              onAction: isToPharma ? () => navigateTo("pharmacy") : null,
            }, "success", 9000);
            if (refreshData) refreshData();
            fetchTenantAppointments();
            setTimeout(() => {
              setShowPrescriptionModal(false);
              setPrescriptionTicket(null);
              setRxSaving(false);
              setRxStatusMsg("");
            }, 600);
          } else {
            const errMsg = `Transfer error: ${data.detail || data.message || "Failed to transfer ticket"}`;
            setRxStatusMsg(errMsg);
            showToast(errMsg, "error");
            setRxSaving(false);
          }
        } else {
          // DIRECT DISCHARGE / COMPLETE
          if (handleCompleteTicket) {
            await handleCompleteTicket(prescriptionTicket.ticket_id, payload);
          }
          const compMsg =
            language === "hi"
              ? "✓ परामर्श पूर्ण हुआ एवं ई-प्रिस्क्रिप्शन मरीज़ पोर्टल पर प्रेषित!"
              : "✓ Consultation Completed & E-Prescription Sent to Patient Portal!";
          setRxStatusMsg(compMsg);
          showToast(compMsg, "success");
          setTimeout(() => {
            setShowPrescriptionModal(false);
            setPrescriptionTicket(null);
            setRxSaving(false);
            setRxStatusMsg("");
            if (refreshData) refreshData();
          }, 1000);
        }
      } else {
        // DRAFT SAVE WITHOUT COMPLETING / ROUTING
        const res = await fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            ticket_id: prescriptionTicket.ticket_id,
            prescription: payload,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          try {
            localStorage.setItem(`rx_draft_${prescriptionTicket.ticket_id}`, JSON.stringify(payload));
          } catch (_) {}
          setRxAutoSaveStatus("saved");
          setRxLastSavedAt(new Date());
          const draftMsg =
            language === "hi"
              ? "✓ ई-प्रिस्क्रिप्शन ड्राफ्ट सफलतापूर्वक सहेजा गया!"
              : "✓ E-Prescription draft saved & updated on Patient Portal!";
          setRxStatusMsg(draftMsg);
          showToast(draftMsg, "success");
          if (refreshData) refreshData();
          setTimeout(() => {
            setShowPrescriptionModal(false);
            setPrescriptionTicket(null);
            setRxSaving(false);
            setRxStatusMsg("");
          }, 1200);
        } else {
          const errMsg = data.message || "Failed to save prescription.";
          setRxStatusMsg(errMsg);
          showToast(errMsg, "error");
          setRxSaving(false);
        }
      }
    } catch (err) {
      const errMsg = "Error: " + err.message;
      setRxStatusMsg(errMsg);
      showToast(errMsg, "error");
      setRxSaving(false);
    }
  };

  // Automatic Prescription Draft Background Auto-Saver (debounced)
  useEffect(() => {
    if (!showPrescriptionModal || !prescriptionTicket?.ticket_id) {
      return;
    }
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    setRxAutoSaveStatus("saving");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const payload = buildPrescriptionPayload();
        try {
          localStorage.setItem(`rx_draft_${prescriptionTicket.ticket_id}`, JSON.stringify(payload));
        } catch (_) {}

        const res = await fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            ticket_id: prescriptionTicket.ticket_id,
            prescription: payload,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setRxAutoSaveStatus("saved");
          setRxLastSavedAt(new Date());
        } else {
          setRxAutoSaveStatus("error");
        }
      } catch (err) {
        console.warn("Auto-save draft error:", err);
        setRxAutoSaveStatus("error");
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    rxDiagnosis,
    rxCustomFinding,
    rxMedicines,
    rxLabTests,
    rxCustomLabTest,
    rxAdvice,
    rxFollowUp,
    rxRoutingDept,
    rxTransferNotes,
    showPrescriptionModal,
    prescriptionTicket?.ticket_id,
  ]);

  const fetchTenantAppointments = useCallback(() => {
    const params = new URLSearchParams();
    if (adminDept && adminDept !== "all") {
      params.set("department", adminDept);
    }
    params.set("active_only", "true");

    fetch(`${API_BASE}/api/v1/plugin/appointments/tenant/${tenantId}?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments || []))
      .catch((e) => console.log("Fetch tenant appointments error:", e));
  }, [tenantId, adminDept]);

  useEffect(() => {
    fetchTenantAppointments();
    if (refreshData) refreshData();
    const interval = setInterval(() => {
      if (document.hidden) return; // Never poll when tab is inactive
      fetchTenantAppointments();
      if (refreshData) refreshData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTenantAppointments, refreshData]);

  // Filtered queue items based on search input (excluding pharmacy dispensing tickets)
  const filteredQueue = clinicalQueueSnapshot.filter((item) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      String(item.ticket_id).includes(query) ||
      (item.medical_condition && item.medical_condition.toLowerCase().includes(query))
    );
  });

  // Only show true booked slots (scheduled/booked appointments not yet merged into the active queue)
  const scheduledBookedSlots = appointments.filter(
    (a) => ["scheduled", "booked", "check_in_available", "expired"].includes((a.status || "").toLowerCase()) && !a.ticket_id
  );
  const displayedAppointments = scheduledBookedSlots;

  return (
    <div
      style={{ maxWidth: "1440px", margin: "0 auto", width: "100%", padding: "0 8px", boxSizing: "border-box" }}
      className={`staff-portal-wrapper ${isDark ? "dark-theme-staff" : ""}`}
    >
      <style>{`
        .staff-portal-wrapper {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          transition: background-color 0.2s ease, color 0.2s ease;
          --staff-card-bg: #FFFFFF;
          --staff-card-border: #E2E8F0;
          --staff-card-text: #0F172A;
          --staff-sub-bg: #F8FAFC;
          --staff-sub-border: #E2E8F0;
          --staff-btn-bg: #FFFFFF;
          --staff-btn-text: #334155;
          --staff-th-bg: #F8FAFC;
          --staff-td-border: #F1F5F9;
          --staff-muted-text: #64748B;
          --staff-dropzone-bg: #F0F9FF;
          --staff-dropzone-border: #BAE6FD;
        }

        .staff-portal-wrapper * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .admin-tabs-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .tab-button-modern {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 16px;
          border: 1px solid var(--staff-card-border, #E2E8F0);
          background: var(--staff-card-bg, #FFFFFF);
          color: var(--staff-card-text, #0F172A);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
          user-select: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
          outline: none;
        }

        .tab-button-modern:hover {
          border-color: #BAE6FD;
          background: #F0F9FF;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.08);
        }

        .tab-button-modern.active {
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
          border-color: #0284C7;
          color: #FFFFFF;
          box-shadow: 0 8px 20px rgba(2, 132, 199, 0.25);
          transform: translateY(-2px);
        }

        .tab-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .tab-button-modern.active .tab-icon-wrapper {
          background: rgba(255, 255, 255, 0.18);
          color: #BAE6FD;
        }

        .tab-button-modern.inactive .tab-icon-wrapper {
          background: #F0F9FF;
          color: #0284C7;
        }

        .tab-title-text {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.2px;
          line-height: 1.2;
        }

        .tab-sub-text {
          font-size: 11px;
          font-weight: 600;
          display: block;
          margin-top: 2px;
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

        .admin-portal-dashboard {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 1040px) {
          .admin-portal-dashboard {
            grid-template-columns: 1fr;
          }
          .admin-tabs-bar {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 580px) {
          .admin-tabs-bar {
            grid-template-columns: 1fr;
          }
        }

        .telemetry-sidebar-card {
          background: var(--staff-card-bg, #FFFFFF);
          border-radius: 20px;
          border: 1px solid var(--staff-card-border, #E2E8F0);
          padding: 20px;
          box-shadow: 0 4px 20px -2px rgba(2, 132, 199, 0.04);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .admin-action-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
          color: #FFFFFF;
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.25);
          transition: all 0.2s ease;
          outline: none;
        }

        .admin-action-btn-primary:hover {
          background: #0369A1;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(2, 132, 199, 0.35);
        }

        .admin-action-btn-primary:active {
          transform: translateY(0);
        }

        /* Top Quick Theme Toggle Bar */
        .staff-theme-toolbar {
          position: relative;
          z-index: 50;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding: 8px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid #E2E8F0;
          backdrop-filter: blur(8px);
        }

        .staff-quick-theme-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 9999px;
          border: 1.5px solid #CBD5E1;
          background: #FFFFFF;
          color: #0F172A;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .staff-quick-theme-btn:hover {
          border-color: #0284C7;
          background: #F0F9FF;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.15);
        }

        /* Doctor Duty Status Interactive Badge Button & Timer */
        .duty-status-badge-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
          user-select: none;
        }

        .duty-status-badge-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        .duty-timer-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.2px;
          user-select: none;
        }

        .duty-resume-action-btn {
          background: #10B981;
          color: #FFFFFF;
          border: none;
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .duty-resume-action-btn:hover {
          background: #059669;
          transform: scale(1.06);
        }

        @keyframes pulseTimerGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
          }
          70% {
            box-shadow: 0 0 0 7px rgba(245, 158, 11, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
          }
        }

        @keyframes pulseEmergencyGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7);
          }
          70% {
            box-shadow: 0 0 0 7px rgba(244, 63, 94, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(244, 63, 94, 0);
          }
        }

        /* ---------------------------------------------------- */
        /* COMPREHENSIVE DARK THEME RULES FOR DOCTOR/STAFF DESK */
        /* ---------------------------------------------------- */
        body.theme-dark,
        [data-theme="dark"],
        .dark-theme-staff {
          color-scheme: dark;
        }

        body.theme-dark .staff-portal-wrapper,
        [data-theme="dark"] .staff-portal-wrapper,
        .dark-theme-staff {
          color: #F1F5F9 !important;
          --staff-card-bg: #0F172A;
          --staff-card-border: #334155;
          --staff-card-text: #F1F5F9;
          --staff-sub-bg: #1E293B;
          --staff-sub-border: #334155;
          --staff-btn-bg: #1E293B;
          --staff-btn-text: #E2E8F0;
          --staff-th-bg: #1E293B;
          --staff-td-border: #1E293B;
          --staff-muted-text: #94A3B8;
          --staff-dropzone-bg: #0B1120;
          --staff-dropzone-border: #0284C7;
        }

        body.theme-dark .staff-theme-toolbar,
        [data-theme="dark"] .staff-theme-toolbar,
        .dark-theme-staff .staff-theme-toolbar {
          background: rgba(15, 23, 42, 0.88) !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
        }

        body.theme-dark .staff-quick-theme-btn,
        [data-theme="dark"] .staff-quick-theme-btn,
        .dark-theme-staff .staff-quick-theme-btn {
          background: #1E293B !important;
          border-color: #475569 !important;
          color: #F8FAFC !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        }

        body.theme-dark .staff-quick-theme-btn:hover,
        [data-theme="dark"] .staff-quick-theme-btn:hover,
        .dark-theme-staff .staff-quick-theme-btn:hover {
          border-color: #38BDF8 !important;
          background: #283548 !important;
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.25) !important;
        }

        body.theme-dark .tab-button-modern.inactive,
        [data-theme="dark"] .tab-button-modern.inactive,
        .dark-theme-staff .tab-button-modern.inactive {
          background: #0F172A !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
        }

        body.theme-dark .tab-button-modern.inactive:hover,
        [data-theme="dark"] .tab-button-modern.inactive:hover,
        .dark-theme-staff .tab-button-modern.inactive:hover {
          background: #1E293B !important;
          border-color: #38BDF8 !important;
          box-shadow: 0 6px 18px rgba(56, 189, 248, 0.15) !important;
        }

        body.theme-dark .tab-button-modern.inactive .tab-icon-wrapper,
        [data-theme="dark"] .tab-button-modern.inactive .tab-icon-wrapper,
        .dark-theme-staff .tab-button-modern.inactive .tab-icon-wrapper {
          background: #1E293B !important;
          color: #38BDF8 !important;
        }

        body.theme-dark .tab-button-modern.inactive .tab-sub-text,
        [data-theme="dark"] .tab-button-modern.inactive .tab-sub-text,
        .dark-theme-staff .tab-button-modern.inactive .tab-sub-text {
          color: #94A3B8 !important;
        }

        body.theme-dark .tab-button-modern.inactive .tab-count-badge,
        [data-theme="dark"] .tab-button-modern.inactive .tab-count-badge,
        .dark-theme-staff .tab-button-modern.inactive .tab-count-badge {
          background: #1E293B !important;
          color: #38BDF8 !important;
          border: 1px solid #334155 !important;
        }

        body.theme-dark .telemetry-sidebar-card,
        [data-theme="dark"] .telemetry-sidebar-card,
        .dark-theme-staff .telemetry-sidebar-card {
          background: #0F172A !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.5) !important;
        }

        body.theme-dark .staff-portal-wrapper input,
        body.theme-dark .staff-portal-wrapper select,
        body.theme-dark .staff-portal-wrapper textarea,
        [data-theme="dark"] .staff-portal-wrapper input,
        [data-theme="dark"] .staff-portal-wrapper select,
        [data-theme="dark"] .staff-portal-wrapper textarea,
        .dark-theme-staff input,
        .dark-theme-staff select,
        .dark-theme-staff textarea {
          background-color: #1E293B !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
        }

        body.theme-dark .staff-portal-wrapper input::placeholder,
        body.theme-dark .staff-portal-wrapper textarea::placeholder,
        [data-theme="dark"] .staff-portal-wrapper input::placeholder,
        [data-theme="dark"] .staff-portal-wrapper textarea::placeholder,
        .dark-theme-staff input::placeholder,
        .dark-theme-staff textarea::placeholder {
          color: #64748B !important;
        }

        body.theme-dark .staff-portal-wrapper input:focus,
        body.theme-dark .staff-portal-wrapper select:focus,
        body.theme-dark .staff-portal-wrapper textarea:focus,
        [data-theme="dark"] .staff-portal-wrapper input:focus,
        [data-theme="dark"] .staff-portal-wrapper select:focus,
        [data-theme="dark"] .staff-portal-wrapper textarea:focus,
        .dark-theme-staff input:focus,
        .dark-theme-staff select:focus,
        .dark-theme-staff textarea:focus {
          border-color: #38BDF8 !important;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2) !important;
        }

        body.theme-dark .staff-portal-wrapper table,
        [data-theme="dark"] .staff-portal-wrapper table,
        .dark-theme-staff table {
          color: #F1F5F9 !important;
        }

        body.theme-dark .staff-portal-wrapper th,
        [data-theme="dark"] .staff-portal-wrapper th,
        .dark-theme-staff th {
          background: #1E293B !important;
          color: #94A3B8 !important;
          border-bottom-color: #334155 !important;
        }

        body.theme-dark .staff-portal-wrapper td,
        [data-theme="dark"] .staff-portal-wrapper td,
        .dark-theme-staff td {
          border-bottom-color: #1E293B !important;
          color: #F1F5F9 !important;
        }

        body.theme-dark .staff-portal-wrapper tr:hover td,
        [data-theme="dark"] .staff-portal-wrapper tr:hover td,
        .dark-theme-staff tr:hover td {
          background: rgba(30, 41, 59, 0.7) !important;
        }

        /* Direct Overrides for Inner Cards & Empty-State Boxes in Dark Mode */
        body.theme-dark .staff-portal-wrapper .staff-empty-box,
        [data-theme="dark"] .staff-portal-wrapper .staff-empty-box,
        .dark-theme-staff .staff-empty-box,
        body.theme-dark .staff-portal-wrapper [style*="background: #F8FAFC"],
        body.theme-dark .staff-portal-wrapper [style*="background:#F8FAFC"],
        body.theme-dark .staff-portal-wrapper [style*="background: rgb(248, 250, 252)"],
        body.theme-dark .staff-portal-wrapper [style*="background: #FFFFFF"],
        body.theme-dark .staff-portal-wrapper [style*="background:#FFFFFF"],
        body.theme-dark .staff-portal-wrapper [style*="background: rgb(255, 255, 255)"],
        .dark-theme-staff [style*="background: #F8FAFC"],
        .dark-theme-staff [style*="background:#F8FAFC"],
        .dark-theme-staff [style*="background: rgb(248, 250, 252)"],
        .dark-theme-staff [style*="background: #FFFFFF"],
        .dark-theme-staff [style*="background:#FFFFFF"],
        .dark-theme-staff [style*="background: rgb(255, 255, 255)"] {
          background: #131D31 !important;
          border-color: #27354E !important;
          color: #F1F5F9 !important;
        }

        body.theme-dark .staff-portal-wrapper [style*="color: #0F172A"],
        body.theme-dark .staff-portal-wrapper [style*="color:#0F172A"],
        body.theme-dark .staff-portal-wrapper [style*="color: rgb(15, 23, 42)"],
        .dark-theme-staff [style*="color: #0F172A"],
        .dark-theme-staff [style*="color:#0F172A"],
        .dark-theme-staff [style*="color: rgb(15, 23, 42)"],
        body.theme-dark .staff-portal-wrapper h2,
        body.theme-dark .staff-portal-wrapper h3,
        body.theme-dark .staff-portal-wrapper h4,
        body.theme-dark .staff-portal-wrapper strong,
        .dark-theme-staff h2,
        .dark-theme-staff h3,
        .dark-theme-staff h4,
        .dark-theme-staff strong {
          color: #F8FAFC !important;
        }

        body.theme-dark .staff-portal-wrapper [style*="color: #64748B"],
        body.theme-dark .staff-portal-wrapper [style*="color:#64748B"],
        body.theme-dark .staff-portal-wrapper [style*="color: rgb(100, 116, 139)"],
        .dark-theme-staff [style*="color: #64748B"],
        .dark-theme-staff [style*="color:#64748B"],
        .dark-theme-staff [style*="color: rgb(100, 116, 139)"],
        body.theme-dark .staff-portal-wrapper p,
        .dark-theme-staff p {
          color: #94A3B8 !important;
        }
      `}</style>

      {/* 1. DEDICATED FULL-PAGE CLINICAL WORKSTATION (OPTION 1) OR QUEUE DASHBOARD */}
      {showPrescriptionModal && prescriptionTicket && rxViewMode === "page" ? (
        <ClinicalPrescriptionWorkstation
          ticket={prescriptionTicket}
          currentUser={currentUser}
          language={language}
          isDark={isDark}
          localBranding={localBranding}
          hospitalDepartments={hospitalDepartments}
          rxViewMode="page"
          onToggleViewMode={() => setRxViewMode("modal")}
          onClose={handleClosePrescriptionModal}
          onSave={handleSavePrescription}
          onPrint={handlePrintCurrentModalRx}
          rxDiagnosis={rxDiagnosis}
          setRxDiagnosis={setRxDiagnosis}
          rxCustomFinding={rxCustomFinding}
          setRxCustomFinding={setRxCustomFinding}
          rxMedicines={rxMedicines}
          setRxMedicines={setRxMedicines}
          handleAddMedicineRow={handleAddMedicineRow}
          handleRemoveMedicineRow={handleRemoveMedicineRow}
          handleMedicineChange={handleMedicineChange}
          rxLabTests={rxLabTests}
          setRxLabTests={setRxLabTests}
          rxCustomLabTest={rxCustomLabTest}
          setRxCustomLabTest={setRxCustomLabTest}
          rxAdvice={rxAdvice}
          setRxAdvice={setRxAdvice}
          rxFollowUp={rxFollowUp}
          setRxFollowUp={setRxFollowUp}
          rxRoutingDept={rxRoutingDept}
          setRxRoutingDept={setRxRoutingDept}
          rxTransferNotes={rxTransferNotes}
          setRxTransferNotes={setRxTransferNotes}
          rxSaving={rxSaving}
          rxStatusMsg={rxStatusMsg}
          rxAutoSaveStatus={rxAutoSaveStatus}
          rxLastSavedAt={rxLastSavedAt}
          rxPreFillWarning={rxPreFillWarning}
          patient={servingPatient}
          summary={servingPatientSummary}
          visits={servingPatientVisits}
          prescriptions={servingPatientPrescriptions}
          reports={servingPatientReports}
          isReturningPatient={isServingPatientReturning}
          totalVisits={servingPatientTotalVisits}
          historyLoading={servingHistoryLoading}
          onUsePreviousPrescription={handleUsePreviousPrescription}
        />
      ) : (
        <>
          {/* 1. EXECUTIVE ADMIN HERO SECTION (100% Live Telemetry) */}
      <AdminHeroBanner
        language={language}
        adminDept={adminDept}
        hospitalName={localBranding?.hospital_name || currentUser?.hospital_name || "City General Hospital"}
        branding={localBranding}
        currentUser={currentUser}
        analytics={analytics}
        isDark={isDark}
        waitingCount={clinicalQueueSnapshot.length}
        servingCount={clinicalServingTickets.length}
        heldCount={clinicalHeldTickets.length}
        servingTicket={primaryServing}
        nextTicket={clinicalQueueSnapshot.length > 0 ? clinicalQueueSnapshot[0] : null}
        appointmentsCount={scheduledBookedSlots.length}
        handleCounterChange={canModifyDesks ? handleCounterChange : null}
        handleServeNext={onCallNextPatient}
        isDoctorBusy={isDoctorBusy}
        myServingTicket={myServingTicket}
        navigateTo={navigateTo}
        doctorDutyStatus={doctorDutyStatus}
        onUpdateDutyStatus={handleUpdateDutyStatus}
        dutyTimerText={dutyTimerText}
        onEndBreak={() => handleUpdateDutyStatus("ACTIVE")}
      />

      {/* 2. UNIFIED ADMIN NAVIGATION HUB (3 TABS) + QUICK THEME SWITCHER */}
      <section style={{ marginBottom: "24px" }}>
        {/* Doctor & Department Telemetry Status Bar */}
        <div className="staff-theme-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", position: "relative", zIndex: 50 }}>
          {/* LEFT: Doctor Identity Badge + Duty Status Interactive Selector side-by-side */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            {/* 1. Doctor Name & Department Identity Badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "6px 14px",
              borderRadius: "12px",
              background: isDark ? "#1E293B" : "#F0F9FF",
              border: `1.5px solid ${isDark ? "#334155" : "#BAE6FD"}`,
              boxShadow: isDark ? "0 2px 6px rgba(0, 0, 0, 0.3)" : "0 1px 3px rgba(2, 132, 199, 0.08)",
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: isDark ? "rgba(2,132,199,0.2)" : "#E0F2FE",
                color: "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                flexShrink: 0,
              }}>
                <IconDoctor size={18} color="#0284C7" />
              </div>
              <div style={{ textAlign: "left", lineHeight: 1.25 }}>
                <div style={{
                  fontSize: "13.5px",
                  fontWeight: 800,
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}>
                  <span>{currentUser?.name || currentUser?.username || "Dr. Staff Desk"}</span>
                  {currentUser?.employee_code && (
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "4px",
                      background: isDark ? "#334155" : "#E2E8F0",
                      color: isDark ? "#94A3B8" : "#64748B",
                    }}>
                      {currentUser.employee_code}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#0284C7",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  marginTop: "2px",
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <IconHospital size={12} color="#0284C7" />
                    {getCategoryLabel(adminDept, language)}
                  </span>
                  {currentUser?.specialization && (
                    <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>• {currentUser.specialization}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. DOCTOR DUTY STATUS INTERACTIVE SELECTOR (Side of Doctor Name in the open space) */}
            <div style={{ position: "relative", zIndex: 60 }} ref={dutyMenuRef}>
              <button
                type="button"
                onClick={() => setShowDutyMenu(!showDutyMenu)}
                className="duty-status-badge-btn"
                style={{
                  background: currentDuty.bg,
                  border: `1.5px solid ${currentDuty.border}`,
                  color: currentDuty.color,
                  padding: "6px 14px",
                  borderRadius: "12px",
                  fontSize: "12.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: isDark ? "0 2px 6px rgba(0, 0, 0, 0.3)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                  transition: "all 0.15s ease",
                }}
                title={isHi ? "ड्यूटी स्थिति बदलें (सक्रिय, ब्रेक, इमरजेंसी, ऑफ ड्यूटी)" : "Toggle Doctor Duty Status (Active, Break, Emergency, Off Duty)"}
              >
                <span style={{ display: "inline-flex", alignItems: "center" }}>{currentDuty.icon}</span>
                <span>{currentDuty.badgeLabel}</span>
                <span style={{ fontSize: "9px", opacity: 0.8, marginLeft: "2px" }}>▼</span>
              </button>

              {/* Duty Status Options Dropdown Menu */}
              {showDutyMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "8px",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.18)" : "1px solid #CBD5E1",
                    borderRadius: "14px",
                    padding: "6px",
                    boxShadow: isDark
                      ? "0 20px 40px -4px rgba(0, 0, 0, 0.7), 0 8px 16px rgba(2, 132, 199, 0.2)"
                      : "0 20px 40px -4px rgba(0, 0, 0, 0.2), 0 8px 16px rgba(2, 132, 199, 0.12)",
                    zIndex: 9999,
                    minWidth: "260px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ padding: "6px 10px 4px 10px", fontSize: "10.5px", fontWeight: 800, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {isHi ? "डॉक्टर ड्यूटी स्थिति चुनें" : "Select Doctor Duty Status"}
                  </div>

                  {dutyOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        handleUpdateDutyStatus(opt.id);
                        if (opt.id === "OFF_DUTY") {
                          setShowShiftSummaryModal(true);
                        }
                        setShowDutyMenu(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: doctorDutyStatus === opt.id ? `1px solid ${opt.border}` : "1px solid transparent",
                        background: doctorDutyStatus === opt.id ? opt.bg : "transparent",
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
                      {doctorDutyStatus === opt.id && (
                        <span style={{ color: opt.color, fontSize: "12px", fontWeight: 900 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. DOCTOR SHIFT SUMMARY & ANALYTICS BUTTON */}
            <button
              type="button"
              onClick={() => setShowShiftSummaryModal(true)}
              className="shift-summary-analytics-btn"
              style={{
                background: isDark ? "rgba(99, 102, 241, 0.18)" : "#EEF2FF",
                border: `1.5px solid ${isDark ? "rgba(99, 102, 241, 0.45)" : "#C7D2FE"}`,
                color: isDark ? "#A5B4FC" : "#4F46E5",
                padding: "6px 14px",
                borderRadius: "12px",
                fontSize: "12.5px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                boxShadow: isDark ? "0 2px 6px rgba(0, 0, 0, 0.3)" : "0 1px 3px rgba(79, 70, 229, 0.08)",
                transition: "all 0.15s ease",
              }}
              title={isHi ? "दैनिक शिफ्ट सारांश और 7-दिवसीय प्रदर्शन ग्राफ़ देखें" : "View End-of-Day Shift Summary & 7-Day Performance Analytics"}
            >
              <span style={{ fontSize: "14px" }}>📊</span>
              <span>{isHi ? "शिफ्ट सारांश व एनालिटिक्स" : "Shift Summary & Stats"}</span>
            </button>

            {/* 4. LIVE BREAK / EMERGENCY ROUND TIMER BADGE */}
            {isOnBreakOrEmergency && (
              <div
                className="duty-timer-live-badge"
                style={{
                  background: doctorDutyStatus === "ON_BREAK" ? (isDark ? "rgba(245, 158, 11, 0.22)" : "#FEF3C7") : (isDark ? "rgba(244, 63, 94, 0.22)" : "#FFE4E6"),
                  border: doctorDutyStatus === "ON_BREAK" ? (isDark ? "1px solid rgba(245, 158, 11, 0.55)" : "1px solid #FDE68A") : (isDark ? "1px solid rgba(244, 63, 94, 0.55)" : "1px solid #FECDD3"),
                  color: doctorDutyStatus === "ON_BREAK" ? (isDark ? "#FDE68A" : "#B45309") : (isDark ? "#FECDD3" : "#BE123C"),
                  animation: doctorDutyStatus === "ON_BREAK" ? "pulseTimerGlow 2s infinite" : "pulseEmergencyGlow 1.5s infinite",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  {doctorDutyStatus === "ON_BREAK" ? (
                    <IconCoffee size={13} color={isDark ? "#FDE68A" : "#B45309"} />
                  ) : (
                    <IconSiren size={13} color={isDark ? "#FECDD3" : "#BE123C"} />
                  )}
                </span>
                <span>
                  {doctorDutyStatus === "ON_BREAK"
                    ? (isHi ? "अवकाश:" : "On Break:")
                    : (isHi ? "आईसीयू राउंड:" : "Round:")}{" "}
                  {dutyTimerText || "00m 01s"}
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateDutyStatus("ACTIVE")}
                  className="duty-resume-action-btn"
                  title={isHi ? "ड्यूटी पुनः प्रारंभ करें" : "Resume Active Duty"}
                >
                  <span>✓</span>
                  <span>{isHi ? "प्रारंभ" : "Resume"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Duty Status & Telemetry Indicators (RIGHT) */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B", flexWrap: "wrap" }}>
            {isDoctorBusy && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
                color: "#D97706",
                background: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7",
                padding: "4px 10px",
                borderRadius: "20px",
                border: `1px solid ${isDark ? "rgba(245,158,11,0.3)" : "#FDE68A"}`,
                fontSize: "11px",
              }}>
                <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#F59E0B" }} />
                {language === "hi" ? "मरीज़ परामर्श जारी" : "In Consultation"}
              </span>
            )}
            <span style={{ color: "#0284C7", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#0284C7" }} />
              {language === "hi" ? "AI कतार सक्रिय" : "Live AI Telemetry"}
            </span>
            {(currentUser?.counter || currentUser?.counter_number || currentUser?.desk) && (
              <>
                <span>•</span>
                <span style={{ fontWeight: 600, color: isDark ? "#CBD5E1" : "#475569", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <IconDesk size={12} color={isDark ? "#94A3B8" : "#64748B"} />
                  Desk {currentUser.counter || currentUser.counter_number || currentUser.desk}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="admin-tabs-bar">
          {/* Tab 1: Desk Operations & Calling */}
          <button
            type="button"
            onClick={() => setActiveTab("ops")}
            className={`tab-button-modern ${activeTab === "ops" ? "active" : "inactive"}`}
          >
            <div className="tab-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="tab-title-text">
                  {language === "hi" ? "डेस्क संचालन" : "Desk Operations"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span
                    className="tab-count-badge"
                    style={{
                      background: activeTab === "ops" ? "#38BDF8" : "#E0F2FE",
                      color: activeTab === "ops" ? "#0F172A" : "#0284C7",
                    }}
                  >
                    {clinicalServingTickets.length}
                  </span>
                  {clinicalHeldTickets.length > 0 && (
                    <span
                      className="tab-count-badge"
                      style={{
                        background: activeTab === "ops" ? "#FCD34D" : "#FEF3C7",
                        color: activeTab === "ops" ? "#78350F" : "#92400E",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                      title={`${clinicalHeldTickets.length} Patients on Hold / Grace`}
                    >
                      {clinicalHeldTickets.length} <IconPause size={9} color={activeTab === "ops" ? "#78350F" : "#92400E"} />
                    </span>
                  )}
                </div>
              </div>
              <span className="tab-sub-text" style={{ color: activeTab === "ops" ? "#BAE6FD" : "#64748B" }}>
                {language === "hi" ? "कॉलिंग एवं ई-प्रिस्क्रिप्शन" : "Calling & E-Prescribe"}
              </span>
            </div>
          </button>

          {/* Tab 2: Department Waiting Queue */}
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`tab-button-modern ${activeTab === "queue" ? "active" : "inactive"}`}
          >
            <div className="tab-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="tab-title-text">
                  {language === "hi" ? "प्रतीक्षारत कतार" : "Waiting Queue"}
                </span>
                <span
                  className="tab-count-badge"
                  style={{
                    background: activeTab === "queue" ? "#38BDF8" : "#E0F2FE",
                    color: activeTab === "queue" ? "#0F172A" : "#0284C7",
                  }}
                >
                  {clinicalQueueSnapshot.length}
                </span>
              </div>
              <span className="tab-sub-text" style={{ color: activeTab === "queue" ? "#BAE6FD" : "#64748B" }}>
                {language === "hi" ? "AI प्राथमिकता सूची" : "AI Prioritized Order"}
              </span>
            </div>
          </button>

          {/* Tab 3: Today's Booked Appointments */}
          <button
            type="button"
            onClick={() => setActiveTab("apts")}
            className={`tab-button-modern ${activeTab === "apts" ? "active" : "inactive"}`}
          >
            <div className="tab-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="tab-title-text">
                  {language === "hi" ? "आज के अपॉइंटमेंट्स" : "Booked Slots"}
                </span>
                <span
                  className="tab-count-badge"
                  style={{
                    background: activeTab === "apts" ? "#38BDF8" : "#E0F2FE",
                    color: activeTab === "apts" ? "#0F172A" : "#0284C7",
                  }}
                >
                  {scheduledBookedSlots.length}
                </span>
              </div>
              <span className="tab-sub-text" style={{ color: activeTab === "apts" ? "#BAE6FD" : "#64748B" }}>
                {language === "hi" ? "आगमन हेतु प्रतीक्षारत" : "Awaiting Arrival"}
              </span>
            </div>
          </button>


        </div>
      </section>

      {/* 3. MAIN RESPONSIVE 2-COLUMN DASHBOARD */}
      <div className="admin-portal-dashboard">
        {/* Left Column: Active Workspace */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* TAB 1: DESK OPERATIONS & LIVE CALLING */}
          {activeTab === "ops" && (
            <div style={standaloneCardStyle}>
              {/* Header with Call Priority Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "22px", color: "#0F172A", fontWeight: 800, letterSpacing: "-0.4px" }}>
                    {getCategoryLabel(adminDept, language)} {t("deskOperations", language)}
                  </h2>
                  <p style={{ margin: 0, color: "#64748B", fontSize: "13px" }}>
                    {language === "hi" ? "डॉक्टर डेस्क से मरीज़ों को बुलाएं एवं जांच रिकॉर्ड दर्ज करें।" : "Call next queued patient, write clinical prescriptions, and manage counter throughput."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onCallNextPatient}
                  className={`admin-action-btn-primary ${isDoctorBusy || doctorDutyStatus !== "ACTIVE" ? "busy-disabled" : ""}`}
                  style={
                    isDoctorBusy || doctorDutyStatus !== "ACTIVE"
                      ? {
                          background: "#F1F5F9",
                          color: "#64748B",
                          border: "1.5px solid #CBD5E1",
                          cursor: "not-allowed",
                          boxShadow: "none",
                          opacity: 0.9,
                        }
                      : {}
                  }
                  title={
                    isDoctorBusy
                      ? (language === "hi"
                          ? `वर्तमान में टोकन #${myServingTicket.ticket_id} का परामर्श चल रहा है। 1 डॉक्टर = 1 मरीज़।`
                          : `Currently consulting #${myServingTicket.ticket_id}. Finish first to call next patient.`)
                      : doctorDutyStatus === "ON_BREAK"
                      ? (language === "hi" ? "अवकाश पर हैं (कतार कॉलिंग रुकी है)" : "On Break: Patient routing paused")
                      : doctorDutyStatus === "EMERGENCY_ROUND"
                      ? (language === "hi" ? "इमरजेंसी राउंड पर हैं" : "Emergency Round: Patient routing paused")
                      : doctorDutyStatus === "OFF_DUTY"
                      ? (language === "hi" ? "ड्यूटी समाप्त" : "Shift Ended: Desk Closed")
                      : "Call Next Patient in AI Priority Order"
                  }
                >
                  {isDoctorBusy ? (
                    <>
                      <IconStethoscope size={14} color="#D97706" />
                      <span>
                        {language === "hi"
                          ? `परामर्श जारी (#${myServingTicket.ticket_id})`
                          : `In Consultation (#${myServingTicket.ticket_id})`}
                      </span>
                    </>
                  ) : doctorDutyStatus === "ON_BREAK" ? (
                    <>
                      <IconCoffee size={14} color="#92400E" />
                      <span>
                        {language === "hi"
                          ? `अवकाश पर (${dutyTimerText || "रुकी है"})`
                          : `On Break (${dutyTimerText || "Paused"})`}
                      </span>
                    </>
                  ) : doctorDutyStatus === "EMERGENCY_ROUND" ? (
                    <>
                      <IconSiren size={14} color="#9F1239" />
                      <span>
                        {language === "hi"
                          ? `इमरजेंसी राउंड (${dutyTimerText || "रुकी है"})`
                          : `ICU Round (${dutyTimerText || "Paused"})`}
                      </span>
                    </>
                  ) : doctorDutyStatus === "OFF_DUTY" ? (
                    <>
                      <IconShield size={14} color="#475569" />
                      <span>
                        {language === "hi" ? "ड्यूटी समाप्त" : "Off Duty (Closed)"}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span>{t("callNextTicket", language)}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Duty Paused Alert Banner (When on Break / Emergency / Off Duty) */}
              {doctorDutyStatus !== "ACTIVE" && (
                <div
                  style={{
                    marginBottom: "18px",
                    padding: "14px 18px",
                    borderRadius: "14px",
                    background:
                      doctorDutyStatus === "ON_BREAK"
                        ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)"
                        : doctorDutyStatus === "EMERGENCY_ROUND"
                        ? "linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)"
                        : "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
                    border:
                      doctorDutyStatus === "ON_BREAK"
                        ? "1.5px solid #FCD34D"
                        : doctorDutyStatus === "EMERGENCY_ROUND"
                        ? "1.5px solid #FECDD3"
                        : "1.5px solid #CBD5E1",
                    color:
                      doctorDutyStatus === "ON_BREAK"
                        ? "#92400E"
                        : doctorDutyStatus === "EMERGENCY_ROUND"
                        ? "#9F1239"
                        : "#334155",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                    flexWrap: "wrap",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "260px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(255,255,255,0.75)",
                      border: "1px solid rgba(0,0,0,0.06)",
                      flexShrink: 0,
                    }}>
                      {doctorDutyStatus === "ON_BREAK" ? (
                        <IconCoffee size={18} color="#92400E" />
                      ) : doctorDutyStatus === "EMERGENCY_ROUND" ? (
                        <IconSiren size={18} color="#9F1239" />
                      ) : (
                        <IconShield size={18} color="#475569" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: 800 }}>
                        {doctorDutyStatus === "ON_BREAK"
                          ? (language === "hi" ? "चाय / अल्पाहार अवकाश सक्रिय" : "Duty Paused: Doctor on Break")
                          : doctorDutyStatus === "EMERGENCY_ROUND"
                          ? (language === "hi" ? "आपातकालीन / वार्ड राउंड सक्रिय" : "Duty Paused: Emergency / ICU Round")
                          : (language === "hi" ? "ड्यूटी समाप्त (ऑफ ड्यूटी)" : "Shift Ended: Desk Consultation Closed")}
                        {dutyTimerText && (
                          <span style={{ marginLeft: "8px", fontWeight: 900, background: "rgba(0,0,0,0.06)", padding: "2px 8px", borderRadius: "6px" }}>
                            ⏱️ {dutyTimerText}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "2px" }}>
                        {language === "hi"
                          ? "मरीज़ों को खाली डेस्क के बाहर प्रतीक्षा से बचाने हेतु स्वचालित कतार आवंटन रोक दिया गया है।"
                          : "Automatic queue routing is paused to prevent patients from waiting outside an unattended room."}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateDutyStatus("ACTIVE")}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#10B981",
                      color: "#FFFFFF",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>✓</span>
                    <span>{language === "hi" ? "ड्यूटी पुनः प्रारंभ करें" : "Resume Active Duty"}</span>
                  </button>
                </div>
              )}

              {serveFeedbackMsg && (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "#FFFBEB",
                    border: "1.5px solid #FDE68A",
                    color: "#92400E",
                    fontSize: "13px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)",
                  }}
                >
                  <IconAlertTriangle size={18} color="#D97706" />
                  <div style={{ flex: 1 }}>{serveFeedbackMsg}</div>
                  <button
                    type="button"
                    onClick={() => setServeFeedbackMsg("")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#92400E",
                      fontSize: "16px",
                      cursor: "pointer",
                      padding: "0 4px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {announceFeedbackMsg && (
                <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0369A1", fontSize: "13px", fontWeight: 700, textAlign: "center" }}>
                  {announceFeedbackMsg}
                </div>
              )}

              {/* Pharmacy Handoff Quick Banner */}
              {pharmacyWaitingCount > 0 && (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    background: isDark ? "rgba(5, 150, 105, 0.18)" : "#ECFDF5",
                    border: isDark ? "1.5px solid #059669" : "1.5px solid #A7F3D0",
                    color: isDark ? "#6EE7B7" : "#065F46",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                    boxShadow: "0 2px 8px rgba(5, 150, 105, 0.1)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>💊</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "13px" }}>
                        {language === "hi"
                          ? `फार्मेसी स्टेशन: ${pharmacyWaitingCount} दवा पर्चियां वितरण हेतु कतार में हैं`
                          : `Pharmacy Station: ${pharmacyWaitingCount} prescription(s) waiting for medicine dispensing`}
                      </div>
                      <div style={{ fontSize: "11px", opacity: 0.85, marginTop: "1px" }}>
                        {language === "hi"
                          ? "परामर्श के बाद मरीज़ काउंटर पर दवा लेने पहुंच रहे हैं।"
                          : "Transferred consultation patients are in line at the Pharmacy Counter."}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo("pharmacy")}
                    style={{
                      padding: "7px 15px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{language === "hi" ? "फार्मेसी स्टेशन खोलें ➔" : "Open Pharmacy Station ➔"}</span>
                  </button>
                </div>
              )}

              {/* Now Serving List */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("nowServingAt", language)} {getCategoryLabel(adminDept, language)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: isDoctorBusy ? "#D97706" : "#059669", background: isDoctorBusy ? "#FEF3C7" : "#ECFDF5", padding: "2px 8px", borderRadius: "6px", border: isDoctorBusy ? "1px solid #FDE68A" : "1px solid #A7F3D0" }}>
                    {isDoctorBusy
                      ? (language === "hi" ? "डॉक्टर व्यस्त (1/1 क्षमता)" : "Doctor Busy (1/1 Capacity)")
                      : (language === "hi" ? "डॉक्टर उपलब्ध (0/1)" : "Doctor Ready (0/1)")}
                  </span>
                </div>
              </div>

              {clinicalServingTickets.length === 0 ? (
                <div
                  className={`staff-empty-box ${isDark ? "dark-mode-box" : ""}`}
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    background: isDark ? "#131D31" : "var(--staff-sub-bg, #F8FAFC)",
                    borderRadius: "16px",
                    border: isDark ? "1px solid #27354E" : "1px solid var(--staff-sub-border, #E2E8F0)",
                    color: isDark ? "#94A3B8" : "var(--staff-muted-text, #94A3B8)",
                  }}
                >
                  <div style={{ fontSize: "36px", marginBottom: "10px" }}>🩺</div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", color: isDark ? "#F8FAFC" : "var(--staff-card-text, #0F172A)" }}>
                    {t("noServingTickets", language)}
                  </h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: isDark ? "#94A3B8" : "var(--staff-muted-text, #64748B)" }}>
                    {language === "hi" ? "कतार में से अगले मरीज़ को बुलाने हेतु 'अगला टोकन बुलाएं' बटन दबाएं।" : "Click 'Call Next Ticket' above to admit the highest-priority patient in line."}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {clinicalServingTickets.map((ticket) => (
                    <div
                      key={ticket.ticket_id}
                      style={{
                        background: "var(--staff-card-bg, #FFFFFF)",
                        border: "1.5px solid var(--staff-card-border, #BAE6FD)",
                        borderRadius: "16px",
                        padding: "18px 20px",
                        boxShadow: "0 4px 16px -2px rgba(2, 132, 199, 0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0px",
                      }}
                    >
                      {/* Top Header: Patient Identity, Token Badge, and Call Status */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                          {/* Token Number Badge */}
                          <div
                            style={{
                              padding: "6px 14px",
                              borderRadius: "10px",
                              background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                              color: "#38BDF8",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "15px",
                              fontWeight: 900,
                              letterSpacing: "0.5px",
                              boxShadow: "0 2px 6px rgba(15, 23, 42, 0.15)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {String(ticket.ticket_id).startsWith("#") ? ticket.ticket_id : `#${ticket.ticket_id}`}
                          </div>

                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <h3 style={{ margin: 0, fontSize: "18px", color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 800 }}>
                                {ticket.name}
                              </h3>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                              {/* Demographics Pill: Age & Gender */}
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "4px 11px",
                                  borderRadius: "8px",
                                  background: isDark ? "#1E293B" : "#F1F5F9",
                                  border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                                  fontSize: "13px",
                                  color: isDark ? "#E2E8F0" : "#334155",
                                }}
                              >
                                <span style={{ opacity: 0.75 }}>👤</span>
                                <span style={{ fontWeight: 800, color: isDark ? "#94A3B8" : "#64748B" }}>
                                  {language === "hi" ? "उम्र:" : "Age:"}
                                </span>
                                <strong style={{ fontWeight: 700 }}>
                                  {ticket.age || 30} {language === "hi" ? "वर्ष" : "yrs"}
                                </strong>
                                <span style={{ color: isDark ? "#475569" : "#CBD5E1", margin: "0 2px" }}>•</span>
                                <span style={{ fontWeight: 800, color: isDark ? "#94A3B8" : "#64748B" }}>
                                  {language === "hi" ? "लिंग:" : "Gender:"}
                                </span>
                                <strong style={{ fontWeight: 700, textTransform: "capitalize" }}>
                                  {t(ticket.gender || "male", language)}
                                </strong>
                              </span>

                              {/* Chief Complaint / Symptoms Badge */}
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "4px 12px",
                                  borderRadius: "8px",
                                  background: isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF",
                                  border: isDark ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid #BAE6FD",
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: isDark ? "#38BDF8" : "#0369A1",
                                }}
                              >
                                <IconStethoscope size={13} color={isDark ? "#38BDF8" : "#0284C7"} />
                                <span style={{ fontWeight: 800, color: isDark ? "#7DD3FC" : "#0284C7" }}>
                                  {language === "hi" ? "लक्षण:" : "Symptom:"}
                                </span>
                                <span style={{ fontWeight: 700, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                                  {formatSymptomLabel(ticket.medical_condition, language)}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Patient Medical History & Past Reports Timeline */}
                      <div style={{ marginBottom: "14px" }}>
                        <PatientHistoryTimeline
                          patient={servingPatient}
                          summary={servingPatientSummary}
                          visits={servingPatientVisits}
                          prescriptions={servingPatientPrescriptions}
                          reports={servingPatientReports}
                          isReturningPatient={isServingPatientReturning}
                          totalVisits={servingPatientTotalVisits}
                          loading={servingHistoryLoading}
                          language={language}
                          onUsePreviousPrescription={handleUsePreviousPrescription}
                          collapsible={true}
                          defaultExpanded={isServingPatientReturning}
                        />
                      </div>

                      {/* Divider */}
                      <div style={{ height: "1px", background: "#E2E8F0", marginBottom: "14px" }} />

                      {/* Bottom Action Toolbar: Utilities on Left, Clinical Actions on Right */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        {/* Left Utilities: Re-Announce, Skip/Hold, Transfer */}
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleReAnnounce(ticket)}
                            style={announceBtnStyle}
                            title="Broadcast Re-Announcement to Patient Portal & Audio Speakers"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                            <span>{t("reAnnounce", language)}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSkipToHold(ticket)}
                            style={{
                              padding: "8px 13px",
                              borderRadius: "10px",
                              border: "1.5px solid #FCD34D",
                              background: "#FFFBEB",
                              color: "#B45309",
                              fontWeight: 800,
                              fontSize: "12px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              transition: "all 0.15s ease",
                              boxShadow: "0 2px 6px rgba(245, 158, 11, 0.12)",
                            }}
                            title="Patient absent after announcements: Put on 10-minute hold grace period and free desk for next patient"
                          >
                            <IconPause size={13} color="#D97706" />
                            <span>{language === "hi" ? "स्किप / होल्ड (10 मि. ग्रेस)" : "Skip / Hold (10m)"}</span>
                          </button>

                        </div>

                        {/* Right Clinical Consultation: Unified Prescribe & Route + Complete */}
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenPrescriptionModal(ticket)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "10px",
                              border: ticket.prescription_notes ? "1.5px solid #059669" : "1.5px solid #0284C7",
                              background: ticket.prescription_notes
                                ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5")
                                : (isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF"),
                              color: ticket.prescription_notes ? "#059669" : "#0284C7",
                              fontWeight: 800,
                              fontSize: "12.5px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "7px",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                            }}
                            title={language === "hi" ? "दवा पर्ची लिखें एवं विभाग में रेफर करें" : "Write E-Prescription & Route to Department"}
                          >
                            <IconPrescription size={15} color={ticket.prescription_notes ? "#059669" : "#0284C7"} />
                            <span>
                              {ticket.prescription_notes
                                ? (language === "hi" ? "दवा पर्ची एवं रेफर संपादित करें (Rx)" : "Edit Rx & Routing")
                                : (language === "hi" ? "दवा पर्ची एवं रेफर (Rx)" : "Prescribe & Route (Rx)")}
                            </span>
                          </button>

                          {ticket.prescription_notes && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePrintTicketPrescription(ticket, false)}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: "10px",
                                  border: isDark ? "1.5px solid #0284C7" : "1.5px solid #BAE6FD",
                                  background: isDark ? "rgba(2, 132, 199, 0.2)" : "#F0F9FF",
                                  color: isDark ? "#38BDF8" : "#0284C7",
                                  fontWeight: 800,
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                }}
                                title={language === "hi" ? "मुद्रित दवा पर्ची प्रिंट करें" : "Print Official Branded Rx Slip"}
                              >
                                <span style={{ fontSize: "14px" }}>🖨️</span>
                                <span>{language === "hi" ? "पर्ची प्रिंट" : "Print Rx"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePrintTicketPrescription(ticket, true)}
                                style={{
                                  padding: "8px 11px",
                                  borderRadius: "10px",
                                  border: isDark ? "1.5px solid #334155" : "1.5px solid #E2E8F0",
                                  background: isDark ? "#1E293B" : "#F8FAFC",
                                  color: isDark ? "#CBD5E1" : "#475569",
                                  fontWeight: 800,
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                title={language === "hi" ? "दवा पर्ची पीडीएफ डाउनलोड करें" : "Download Rx PDF Document"}
                              >
                                <span>📥</span>
                                <span>PDF</span>
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => handleConfirmFinishConsult(ticket)}
                            style={finishBtnStyle}
                            title={language === "hi" ? "परामर्श पूर्ण करें" : "Mark Consultation Complete"}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>{language === "hi" ? "परामर्श पूर्ण करें" : "Finish Consult"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DEDICATED ON-HOLD / 10-MINUTE GRACE PERIOD PATIENTS SECTION */}
              <div
                style={{
                  marginTop: "28px",
                  paddingTop: "24px",
                  borderTop: "1.5px dashed #CBD5E1",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IconPause size={16} color="#B45309" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", color: "#0F172A", fontWeight: 800 }}>
                        {language === "hi" ? "होल्ड / 10 मिनट ग्रेस पीरियड कतार" : "On-Hold / 10-Min Grace Period Patients"}
                      </h3>
                      <span style={{ fontSize: "12px", color: "#64748B" }}>
                        {language === "hi"
                          ? "अनुपस्थित मरीज़ों को 10 मिनट की छूट। आगमन पर पुनः बुलाएं अथवा No-Show चिह्नित करें।"
                          : "Patients absent after 3 calls held for 10-min grace window. Recall on arrival or finalize No-Show."}
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      background: clinicalHeldTickets.length > 0 ? "#FEF3C7" : "#F1F5F9",
                      color: clinicalHeldTickets.length > 0 ? "#B45309" : "#64748B",
                      border: `1px solid ${clinicalHeldTickets.length > 0 ? "#FDE68A" : "#CBD5E1"}`,
                    }}
                  >
                    {clinicalHeldTickets.length} {language === "hi" ? "होल्ड पर" : "On Hold"}
                  </span>
                </div>

                {clinicalHeldTickets.length === 0 ? (
                  <div
                    className={`staff-empty-box ${isDark ? "dark-mode-box" : ""}`}
                    style={{
                      padding: "18px 20px",
                      background: isDark ? "#131D31" : "var(--staff-sub-bg, #F8FAFC)",
                      borderRadius: "14px",
                      border: isDark ? "1px solid #27354E" : "1px solid var(--staff-sub-border, #E2E8F0)",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      color: isDark ? "#94A3B8" : "var(--staff-muted-text, #64748B)",
                      fontSize: "12.5px",
                    }}
                  >
                    <IconCheckCircle size={18} color="#16A34A" />
                    <span>
                      {language === "hi"
                        ? "वर्तमान में कोई मरीज़ होल्ड पर नहीं है। सभी परामर्श सुचारु रूप से चल रहे हैं।"
                        : "No patients currently on hold. All active consultations running on schedule."}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {clinicalHeldTickets.map((ht) => {
                      const holdStart = ht.hold_start_time || ht.join_timestamp || nowSec;
                      const holdUntil = ht.hold_until || (holdStart + 600);
                      const remainingSecs = Math.max(0, Math.floor(holdUntil - nowSec));
                      const mins = Math.floor(remainingSecs / 60);
                      const secs = remainingSecs % 60;
                      const timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                      const isExpired = remainingSecs <= 0;

                      return (
                        <div
                          key={ht.ticket_id}
                          style={{
                            background: isExpired ? "#FFF5F5" : "#FFFDF5",
                            borderRadius: "14px",
                            border: `1.5px solid ${isExpired ? "#FECACA" : "#FDE68A"}`,
                            padding: "14px 18px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "12px",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                              style={{
                                padding: "4px 10px",
                                minWidth: "56px",
                                height: "36px",
                                borderRadius: "10px",
                                background: isExpired ? "#991B1B" : "#B45309",
                                color: "#FFFFFF",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "14px",
                                fontWeight: 900,
                                whiteSpace: "nowrap",
                                letterSpacing: "0.5px",
                                flexShrink: 0,
                              }}
                            >
                              {String(ht.ticket_id).startsWith("#") ? ht.ticket_id : `#${ht.ticket_id}`}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <strong style={{ fontSize: "15px", color: "#0F172A" }}>{ht.name}</strong>
                                <span style={{ padding: "1px 7px", borderRadius: "5px", background: "#FEF3C7", color: "#92400E", fontSize: "10.5px", fontWeight: 700 }}>
                                  {getCategoryLabel(ht.service_category, language)}
                                </span>
                                <span style={{ fontSize: "11px", color: "#64748B" }}>
                                  {ht.age || 30} {language === "hi" ? "वर्ष" : "yrs"} • {formatSymptomLabel(ht.medical_condition, language)}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    background: isExpired ? "#FEE2E2" : "#FEF3C7",
                                    color: isExpired ? "#DC2626" : "#B45309",
                                  }}
                                >
                                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                                    {isExpired ? <IconAlertTriangle size={12} color="#DC2626" /> : <IconClock size={12} color="#B45309" />}
                                  </span>
                                  <span>
                                    {isExpired
                                      ? (language === "hi" ? "10 मिनट ग्रेस समाप्त (No-Show)" : "10-Min Grace Expired")
                                      : (language === "hi" ? `ग्रेस समय शेष: ${timerStr}` : `Grace Remaining: ${timerStr}`)}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {/* Recall / Resume Button */}
                            <button
                              type="button"
                              onClick={() => handleRecallHeld(ht)}
                              style={{
                                padding: "7px 14px",
                                borderRadius: "10px",
                                border: "none",
                                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                                color: "#FFFFFF",
                                fontSize: "12px",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                              }}
                              title="Patient has arrived: Restore into active consultation or top of queue"
                            >
                              <IconPlay size={12} color="#FFFFFF" />
                              <span>{language === "hi" ? "मरीज़ पुनः बुलाएं (Recall)" : "Recall Patient"}</span>
                            </button>

                            {/* Mark No-Show Finalize Button */}
                            <button
                              type="button"
                              onClick={() => handleFinalizeNoShow(ht)}
                              style={{
                                padding: "7px 12px",
                                borderRadius: "10px",
                                border: "1px solid #FECACA",
                                background: "#FEF2F2",
                                color: "#DC2626",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                              }}
                              title="Finalize as No-Show if patient did not appear"
                            >
                              <IconUserX size={12} color="#DC2626" />
                              <span>{language === "hi" ? "अनुपस्थित (No-Show)" : "Mark No-Show"}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DEPARTMENT WAITING QUEUE */}
          {activeTab === "queue" && (
            <div style={standaloneCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "22px", color: "#0F172A", fontWeight: 800, letterSpacing: "-0.4px" }}>
                    {getCategoryLabel(adminDept, language)} {t("waitingQueue", language)} ({queueSnapshot.length})
                  </h2>
                  <p style={{ margin: 0, color: "#64748B", fontSize: "13px" }}>
                    {language === "hi" ? "क्लिनिकल जटिलता एवं एआई ट्राइएज द्वारा निर्धारित प्रतीक्षा सूची।" : "Real-time queue sequence dynamically calculated by AI priority algorithm."}
                  </p>
                </div>

                {/* Search / Filter Input */}
                <input
                  type="text"
                  placeholder={language === "hi" ? "नाम या टोकन संख्या खोजें..." : "Filter by patient name or #..."}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid #CBD5E1", fontSize: "12.5px", width: "220px", outline: "none" }}
                />
              </div>

              {filteredQueue.length === 0 ? (
                <div
                  className={`staff-empty-box ${isDark ? "dark-mode-box" : ""}`}
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    background: isDark ? "#131D31" : "var(--staff-sub-bg, #F8FAFC)",
                    borderRadius: "16px",
                    border: isDark ? "1px solid #27354E" : "1px solid var(--staff-sub-border, #E2E8F0)",
                    color: isDark ? "#94A3B8" : "var(--staff-muted-text, #94A3B8)",
                  }}
                >
                  <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: isDark ? "#1E293B" : "#F0F9FF", border: `1px solid ${isDark ? "#334155" : "#BAE6FD"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <IconClipboard size={26} color="#0284C7" />
                  </div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", color: isDark ? "#F8FAFC" : "var(--staff-card-text, #0F172A)" }}>
                    {t("noWaitingInDept", language)}
                  </h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: isDark ? "#94A3B8" : "var(--staff-muted-text, #64748B)" }}>
                    {language === "hi" ? "इस समय कोई प्रतीक्षारत मरीज़ नहीं है।" : "All patients have been served or no check-ins pending."}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={staffTableStyle}>
                    <thead>
                      <tr>
                        <th style={staffThStyle}>{t("pos", language)}</th>
                        <th style={staffThStyle}>{t("tokenId", language)}</th>
                        <th style={staffThStyle}>{t("patientDemographics", language)}</th>
                        <th style={staffThStyle}>{t("symptomRisk", language)}</th>
                        <th style={staffThStyle}>{t("aiComplexity", language)}</th>
                        <th style={staffThStyle}>{t("estWaitCol", language)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.map((ticket) => (
                        <tr key={ticket.ticket_id} style={{ transition: "background 0.15s ease" }}>
                          <td style={staffTdStyle}>
                            <span style={{ fontWeight: 800, color: "#64748B" }}>#{ticket.position}</span>
                          </td>
                          <td style={{ ...staffTdStyle, fontWeight: 900, color: "#0284C7" }}>
                            <div style={{ fontSize: "14px", fontWeight: 900 }}>#{ticket.ticket_id}</div>
                            {ticket.appointment_id && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  marginTop: "3px",
                                  padding: "2px 7px",
                                  borderRadius: "6px",
                                  fontSize: "10.5px",
                                  fontWeight: 800,
                                  background: isDark ? "rgba(99, 102, 241, 0.2)" : "#EEF2FF",
                                  color: isDark ? "#A5B4FC" : "#4F46E5",
                                  border: `1px solid ${isDark ? "rgba(99, 102, 241, 0.4)" : "#C7D2FE"}`,
                                }}
                                title={`Booked Slot Checked-In: ${ticket.appointment_id}`}
                              >
                                <IconCalendar size={11} color={isDark ? "#A5B4FC" : "#4F46E5"} />
                                <span>{language === "hi" ? "बुक स्लॉट (चेक-इन)" : "Booked Slot"}</span>
                              </span>
                            )}
                          </td>
                          <td style={{ ...staffTdStyle, fontWeight: 700, color: "#0F172A" }}>
                            {ticket.name}
                            <span style={{ fontSize: "11px", color: "#64748B", display: "block", fontWeight: 500 }}>
                              {ticket.age || 30} {language === "hi" ? "वर्ष" : "yrs"} • {t(ticket.gender || "male", language)}
                            </span>
                          </td>
                          <td style={{ ...staffTdStyle, fontSize: "12px", color: "#0284C7", fontWeight: 600 }}>
                            {formatSymptomLabel(ticket.medical_condition, language)}
                            {ticket.pre_existing_condition && ticket.pre_existing_condition !== "none" && (
                              <span style={{ display: "block", fontSize: "10.5px", color: "#64748B" }}>
                                {t("preExistingLabel", language) || "Risk"}: {formatRiskLabel(ticket.pre_existing_condition, language)}
                              </span>
                            )}
                          </td>
                          <td style={staffTdStyle}>
                            <span style={badgePrioStyle(ticket.complexity_score > 1.4 ? "#DC2626" : "#0284C7")}>
                              {ticket.complexity_score || 1.0}x
                            </span>
                          </td>
                          <td style={{ ...staffTdStyle, fontWeight: 800, color: "#0284C7" }}>
                            {ticket.estimated_wait_minutes} {language === "hi" ? "मिनट" : "min"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TODAY'S BOOKED APPOINTMENTS */}
          {activeTab === "apts" && (
            <div style={standaloneCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "22px", color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 800, letterSpacing: "-0.4px" }}>
                    {getCategoryLabel(adminDept, language)} {language === "hi" ? "बुक किए गए स्लॉट" : "Booked Appointment Slots"} ({scheduledBookedSlots.length})
                  </h2>
                  <p style={{ margin: 0, color: isDark ? "#94A3B8" : "#64748B", fontSize: "13px" }}>
                    {language === "hi"
                      ? "आगमन की प्रतीक्षा में निर्धारित स्लॉट। चेक-इन होते ही मरीज़ 'प्रतीक्षारत कतार (Waiting Queue)' में चले जाते हैं।"
                      : "Pre-scheduled appointment slots awaiting arrival. Once checked in, patients move to the live Waiting Queue."}
                  </p>
                </div>
              </div>

              {displayedAppointments.length === 0 ? (
                <div
                  className={`staff-empty-box ${isDark ? "dark-mode-box" : ""}`}
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    background: isDark ? "#131D31" : "var(--staff-sub-bg, #F8FAFC)",
                    borderRadius: "16px",
                    border: isDark ? "1px solid #27354E" : "1px solid var(--staff-sub-border, #E2E8F0)",
                    color: isDark ? "#94A3B8" : "var(--staff-muted-text, #94A3B8)",
                  }}
                >
                  <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: isDark ? "#1E293B" : "#F0F9FF", border: `1px solid ${isDark ? "#334155" : "#BAE6FD"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <IconCalendar size={26} color="#0284C7" />
                  </div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", color: isDark ? "#F8FAFC" : "var(--staff-card-text, #0F172A)" }}>
                    {language === "hi" ? "कोई लंबित बुक किया गया स्लॉट नहीं है" : "No Pending Booked Slots Awaiting Arrival"}
                  </h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: isDark ? "#94A3B8" : "var(--staff-muted-text, #64748B)" }}>
                    {language === "hi"
                      ? "सभी चेक-इन किए गए मरीज़ और लाइव वॉक-इन 'प्रतीक्षारत कतार (Waiting Queue)' में सक्रिय हैं।"
                      : "All checked-in patients and instant walk-ins are active in the live Waiting Queue."}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={staffTableStyle}>
                    <thead>
                      <tr>
                        <th style={staffThStyle}>{t("tokenId", language)}</th>
                        <th style={staffThStyle}>{t("patientDemographics", language)}</th>
                        <th style={staffThStyle}>{t("departmentLabel", language)}</th>
                        <th style={staffThStyle}>{t("reservedSlotLabel", language)}</th>
                        <th style={staffThStyle}>{language === "hi" ? "आगमन एवं ओपीडी स्थिति" : "Arrival & OPD Status"}</th>
                        <th style={staffThStyle}>{language === "hi" ? "कतार टोकन संख्या" : "Queue Token #"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedAppointments.map((apt) => {
                        const statusKey = (apt.status || "").toLowerCase();
                        const isCheckedIn = statusKey === "checked_in" || (apt.ticket_id && statusKey !== "completed" && statusKey !== "cancelled" && statusKey !== "no_show");
                        const isExpired = statusKey === "expired";
                        const isCheckInAvailable = statusKey === "check_in_available";
                        const isBooked = statusKey === "booked" || (statusKey === "scheduled" && !apt.ticket_id);
                        const isServing = statusKey === "serving";
                        const isCompleted = statusKey === "completed";
                        const isCancelled = statusKey === "cancelled" || statusKey === "no_show";

                        return (
                          <tr key={apt.appointment_id}>
                            <td style={{ ...staffTdStyle, fontWeight: 900, color: "#0284C7" }}>{apt.appointment_id}</td>
                            <td style={{ ...staffTdStyle, fontWeight: 700 }}>{apt.patient_name}</td>
                            <td style={{ ...staffTdStyle, fontWeight: 700, color: "#0284C7" }}>
                              {getCategoryLabel(apt.service_category, language)}
                            </td>
                            <td style={{ ...staffTdStyle, fontWeight: 600, color: isDark ? "#E2E8F0" : "#0F172A" }}>
                              {apt.appointment_date} @ {apt.formatted_appointment_time || apt.time_slot}
                            </td>
                            <td style={staffTdStyle}>
                              {isCheckedIn ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 800,
                                    background: isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
                                    color: isDark ? "#6EE7B7" : "#065F46",
                                    border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.35)" : "#A7F3D0"}`,
                                  }}
                                  title={language === "hi" ? "मरीज़ का स्वागत कक्ष / कियोस्क पर चेक-इन पूर्ण हो चुका है और वह प्रतीक्षालय में उपस्थित है।" : "Patient has completed check-in at reception/kiosk and is waiting in the lounge"}
                                >
                                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10B981" }} />
                                  <span>{language === "hi" ? "चेक-इन पूर्ण • प्रतीक्षालय में उपस्थित" : "Checked In & Waiting in Lounge"}</span>
                                </span>
                              ) : isExpired ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 800,
                                    background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                                    color: isDark ? "#FCA5A5" : "#DC2626",
                                    border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA"}`,
                                  }}
                                  title={language === "hi" ? "अपॉइंटमेंट के 1 घंटे बाद चेक-इन खिड़की समाप्त हो गई है।" : "Ticket expired 1 hour after scheduled appointment slot. Check-in closed."}
                                >
                                  <IconUserX size={12} color={isDark ? "#FCA5A5" : "#DC2626"} />
                                  <span>{language === "hi" ? "स्लॉट समाप्त (खिड़की बंद)" : "Expired (Window Closed)"}</span>
                                </span>
                              ) : isCheckInAvailable ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 800,
                                    background: isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
                                    color: isDark ? "#6EE7B7" : "#065F46",
                                    border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.35)" : "#A7F3D0"}`,
                                  }}
                                  title={language === "hi" ? "चेक-इन विंडो खुली है (अपॉइंटमेंट से 30 मिनट पहले)।" : "Check-in window is open (opened 30 minutes prior to slot)."}
                                >
                                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10B981" }} />
                                  <span>{language === "hi" ? "चेक-इन उपलब्ध • आगमन प्रतीक्षारत" : "Check-In Open (Awaiting Arrival)"}</span>
                                </span>
                              ) : isBooked ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    background: isDark ? "rgba(56, 189, 248, 0.12)" : "#F0F9FF",
                                    color: isDark ? "#38BDF8" : "#0284C7",
                                    border: `1px solid ${isDark ? "rgba(56, 189, 248, 0.28)" : "#BAE6FD"}`,
                                  }}
                                  title={language === "hi" ? "आरक्षित स्लॉट। चेक-इन स्लॉट से 30 मिनट पहले खुलेगा।" : "Booked slot. Check-in opens 30 minutes prior to appointment."}
                                >
                                  <IconClock size={12} color={isDark ? "#38BDF8" : "#0284C7"} />
                                  <span>
                                    {language === "hi"
                                      ? `आरक्षित: ${apt.time_slot || "स्लॉट"}`
                                      : `Booked for ${apt.time_slot || "Slot"}`}
                                  </span>
                                </span>
                              ) : isServing ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 800,
                                    background: isDark ? "rgba(245, 158, 11, 0.18)" : "#FEF3C7",
                                    color: isDark ? "#FDE68A" : "#92400E",
                                    border: `1px solid ${isDark ? "rgba(245, 158, 11, 0.35)" : "#FDE68A"}`,
                                  }}
                                >
                                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#F59E0B" }} />
                                  <span>{language === "hi" ? "परामर्श जारी (डेस्क पर)" : "In Consultation (At Desk)"}</span>
                                </span>
                              ) : isCompleted ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    background: isDark ? "#1E293B" : "#F1F5F9",
                                    color: isDark ? "#94A3B8" : "#475569",
                                    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                                  }}
                                >
                                  <IconCheckCircle size={12} color="#16A34A" />
                                  <span>{language === "hi" ? "परामर्श पूर्ण" : "Consultation Completed"}</span>
                                </span>
                              ) : isCancelled ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                                    color: isDark ? "#FCA5A5" : "#DC2626",
                                    border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA"}`,
                                  }}
                                >
                                  <IconUserX size={12} color={isDark ? "#FCA5A5" : "#DC2626"} />
                                  <span>{language === "hi" ? "रद्द / अनुपस्थित" : "Cancelled / No-Show"}</span>
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    background: isDark ? "#1E293B" : "#F8FAFC",
                                    color: isDark ? "#CBD5E1" : "#475569",
                                    border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                                  }}
                                >
                                  {getStatusLabel(apt.status, language)}
                                </span>
                              )}
                            </td>
                            <td style={{ ...staffTdStyle, fontWeight: 800 }}>
                              {apt.ticket_id ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    background: isDark ? "rgba(2,132,199,0.2)" : "#E0F2FE",
                                    color: isDark ? "#38BDF8" : "#0284C7",
                                    fontWeight: 800,
                                  }}
                                >
                                  #{apt.ticket_id}
                                </span>
                              ) : (
                                <span style={{ color: isDark ? "#64748B" : "#94A3B8" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}


        </div>

        {/* Right Column: Admin Telemetry Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* 1. Live Queue Counter Pulse Card */}
          <div className="telemetry-sidebar-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0EA5E9", boxShadow: "0 0 8px #0EA5E9" }} />
                <span style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>
                  {language === "hi" ? "लाइव कतार मॉनिटर" : "Live Queue Monitor"}
                </span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369A1", background: "#F0F9FF", padding: "2px 8px", borderRadius: "6px", border: "1px solid #BAE6FD" }}>
                {analytics
                  ? `${analytics.active_counters || 1} ${language === "hi" ? "डेस्क सक्रिय" : ((analytics.active_counters || 1) === 1 ? "Desk Active" : "Desks Active")}`
                  : (language === "hi" ? "1 डेस्क सक्रिय" : "1 Desk Active")}
              </span>
            </div>

            {/* Live Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
              <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", padding: "10px 12px", borderRadius: "10px", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                <span style={{ fontSize: "10.5px", color: isDark ? "#94A3B8" : "#64748B", display: "block" }}>
                  {language === "hi" ? "औसत प्रतीक्षा" : "Est. Avg Wait"}
                </span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#38BDF8" }}>
                  {analytics ? analytics.avg_wait_minutes : 12} {language === "hi" ? "मिनट" : "min"}
                </span>
              </div>
              <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", padding: "10px 12px", borderRadius: "10px", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                <span style={{ fontSize: "10.5px", color: isDark ? "#94A3B8" : "#64748B", display: "block" }}>
                  {language === "hi" ? "कतार में" : "In Line"}
                </span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {queueSnapshot.length} {language === "hi" ? "मरीज़" : "patients"}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Next Up in Queue Preview */}
          {queueSnapshot.length > 0 && (
            <div className="telemetry-sidebar-card" style={isDark ? { background: "#0F172A", borderColor: "#334155" } : {}}>
              <span style={{ fontSize: "12.5px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                <IconClipboard size={14} color="#0284C7" />
                {language === "hi" ? "कतार में अगले टोकन" : "Next Up in Queue"}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {queueSnapshot.slice(0, 3).map((item) => (
                  <div key={item.ticket_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: "8px", background: isDark ? "#1E293B" : "#F8FAFC", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: isDark ? "#94A3B8" : "#64748B" }}>#{item.position}</span>
                      <div>
                        <strong style={{ fontSize: "12.5px", color: isDark ? "#F8FAFC" : "#0F172A" }}>#{item.ticket_id}</strong>
                        <span style={{ fontSize: "11px", color: isDark ? "#94A3B8" : "#64748B", display: "block" }}>{item.name}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#38BDF8" }}>
                      ~{item.estimated_wait_minutes}{language === "hi" ? "मि" : "m"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Quick Operations Launcher - Staff/Receptionist and Super Admin only (Doctors excluded) */}
          {canViewDbInspector && navigateTo && (
            <div className="telemetry-sidebar-card" style={isDark ? { background: "#0F172A", borderColor: "#334155" } : {}}>
              <span style={{ fontSize: "12.5px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                <IconZap size={14} color="#D97706" />
                {language === "hi" ? "त्वरित संचालन शॉर्टकट" : "Operations Shortcuts"}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => navigateTo("db")}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                    background: isDark ? "#1E293B" : "#F8FAFC",
                    color: isDark ? "#F8FAFC" : "#334155",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <IconDatabase size={14} color={isDark ? "#38BDF8" : "#0284C7"} />
                  <span>{language === "hi" ? "डेटाबेस निरीक्षक खोलें" : "Open Database Inspector"}</span>
                </button>
              </div>
            </div>
          )}


        </div>
      </div>



        </>
      )}

      {/* 4b. DOCTOR E-PRESCRIPTION (Rx) CLINICAL FLOATING MODAL (When rxViewMode === 'modal') */}
      {showPrescriptionModal && prescriptionTicket && rxViewMode === "modal" && (
        <ClinicalPrescriptionWorkstation
          ticket={prescriptionTicket}
          currentUser={currentUser}
          language={language}
          isDark={isDark}
          localBranding={localBranding}
          hospitalDepartments={hospitalDepartments}
          rxViewMode="modal"
          onToggleViewMode={() => setRxViewMode("page")}
          onClose={handleClosePrescriptionModal}
          onSave={handleSavePrescription}
          onPrint={handlePrintCurrentModalRx}
          rxDiagnosis={rxDiagnosis}
          setRxDiagnosis={setRxDiagnosis}
          rxCustomFinding={rxCustomFinding}
          setRxCustomFinding={setRxCustomFinding}
          rxMedicines={rxMedicines}
          setRxMedicines={setRxMedicines}
          handleAddMedicineRow={handleAddMedicineRow}
          handleRemoveMedicineRow={handleRemoveMedicineRow}
          handleMedicineChange={handleMedicineChange}
          rxLabTests={rxLabTests}
          setRxLabTests={setRxLabTests}
          rxCustomLabTest={rxCustomLabTest}
          setRxCustomLabTest={setRxCustomLabTest}
          rxAdvice={rxAdvice}
          setRxAdvice={setRxAdvice}
          rxFollowUp={rxFollowUp}
          setRxFollowUp={setRxFollowUp}
          rxRoutingDept={rxRoutingDept}
          setRxRoutingDept={setRxRoutingDept}
          rxTransferNotes={rxTransferNotes}
          setRxTransferNotes={setRxTransferNotes}
          rxSaving={rxSaving}
          rxStatusMsg={rxStatusMsg}
          rxAutoSaveStatus={rxAutoSaveStatus}
          rxLastSavedAt={rxLastSavedAt}
          rxPreFillWarning={rxPreFillWarning}
          patient={servingPatient}
          summary={servingPatientSummary}
          visits={servingPatientVisits}
          prescriptions={servingPatientPrescriptions}
          reports={servingPatientReports}
          isReturningPatient={isServingPatientReturning}
          totalVisits={servingPatientTotalVisits}
          historyLoading={servingHistoryLoading}
          onUsePreviousPrescription={handleUsePreviousPrescription}
        />
      )}

      {/* 5. DOCTOR END-OF-DAY SHIFT SUMMARY & ANALYTICS MODAL */}
      <DoctorShiftSummaryModal
        isOpen={showShiftSummaryModal}
        onClose={() => setShowShiftSummaryModal(false)}
        currentUser={currentUser}
        tenantId={tenantId}
        effectiveHospitalCode={effectiveHospitalCode}
        language={language}
        isDark={isDark}
        doctorDutyStatus={doctorDutyStatus}
        onDutyStatusChange={handleUpdateDutyStatus}
      />

      {/* 6. FOOTER WITH ECG HEARTBEAT */}
      <Footer
        language={language}
        hospitalName={localBranding?.hospital_name || currentUser?.hospital_name || "City General Hospital"}
        currentUser={currentUser}
      />

      {/* 7. IN-APP TOAST AND CONFIRMATION MODALS */}
      <InAppToast toast={inAppToast} onClose={() => setInAppToast(null)} isDark={isDark} />
      <InAppConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} isDark={isDark} />
    </div>
  );
}

// Styling definitions
const standaloneCardStyle = {
  background: "var(--staff-card-bg, #FFFFFF)",
  borderRadius: "20px",
  border: "1.5px solid var(--staff-card-border, #E2E8F0)",
  padding: "24px 28px",
  boxShadow: "0 4px 20px -2px rgba(2, 132, 199, 0.04)",
  color: "var(--staff-card-text, #0F172A)",
};



const announceBtnStyle = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #BAE6FD",
  background: "#F0F9FF",
  color: "#0369A1",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  transition: "all 0.15s ease",
};

const transferTriggerBtnStyle = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #DDD6FE",
  background: "#F5F3FF",
  color: "#6D28D9",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  transition: "all 0.15s ease",
};

const finishBtnStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
  color: "#FFFFFF",
  fontWeight: 800,
  fontSize: "12px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
  transition: "all 0.15s ease",
};

const refreshBtnStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--staff-card-border, #CBD5E1)",
  background: "var(--staff-btn-bg, #F8FAFC)",
  color: "var(--staff-btn-text, #334155)",
  fontWeight: 700,
  fontSize: "12px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const staffTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const staffThStyle = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1.5px solid var(--staff-card-border, #E2E8F0)",
  background: "var(--staff-th-bg, #F8FAFC)",
  color: "var(--staff-muted-text, #64748B)",
  fontWeight: 800,
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const staffTdStyle = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--staff-td-border, #F1F5F9)",
  color: "var(--staff-card-text, #0F172A)",
  verticalAlign: "middle",
};

const badgePrioStyle = (color) => ({
  padding: "2px 8px",
  borderRadius: "6px",
  background: color === "#DC2626" ? "#FEF2F2" : "#F0F9FF",
  color,
  fontSize: "11px",
  fontWeight: 800,
  border: `1px solid ${color === "#DC2626" ? "#FECACA" : "#BAE6FD"}`,
});



const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.75)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
  padding: "20px",
};

const modalContentStyle = {
  background: "var(--staff-card-bg, #FFFFFF)",
  color: "var(--staff-card-text, #0F172A)",
  borderRadius: "24px",
  maxWidth: "500px",
  width: "100%",
  padding: "28px",
  boxShadow: "0 24px 48px -10px rgba(0, 0, 0, 0.35)",
  border: "1px solid var(--staff-card-border, #E2E8F0)",
  maxHeight: "90vh",
  overflowY: "auto",
  boxSizing: "border-box",
};
