

import React, { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { t, getCategoryLabel, getStatusLabel, formatCleanText, SYMPTOM_OPTIONS } from "../utils/i18n";
import { announceTicketVoice } from "../utils/voiceSynthesizer";
import { printTokenPass } from "../utils/printPassHelper";
import Footer from "../components/common/Footer";
import {
  Users,
  CalendarCheck,
  Megaphone,
  LayoutGrid,
  Search,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Volume2,
  UserX,
  Printer,
  Clock,
  Building2,
  Stethoscope,
  Coffee,
  Siren,
  Phone,
  ArrowRight,
  RefreshCw,
  X,
  Filter,
  Check,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Link2,
  ArrowRightLeft,
  Flame,
  PauseCircle,
  PlayCircle,
  Activity,
  FileText,
  Trash2,
  Info,
  Layers,
  SlidersHorizontal,
  HelpCircle,
  ListOrdered
} from "lucide-react";

export default function StaffPortalPage({
  tenantId,
  currentUser,
  analytics,
  queueSnapshot = [],
  servingTickets = [],
  heldTickets = [],
  refreshData,
  language = "en",
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

  // Tab State: "walkin" | "all_queues" | "checkin" | "counters"
  const [activeTab, setActiveTab] = useState("walkin");

  // Telemetry & Data States
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [desksList, setDesksList] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Live Queue Data Store (Directly fetched and synchronized for this hospital tenant)
  const [localQueueSnapshot, setLocalQueueSnapshot] = useState([]);
  const [localServingTickets, setLocalServingTickets] = useState([]);
  const [localHeldTickets, setLocalHeldTickets] = useState([]);
  const [isQueueLoading, setIsQueueLoading] = useState(false);

  // Search & Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [aptStatusFilter, setAptStatusFilter] = useState("all");
  const [aptDayFilter, setAptDayFilter] = useState("all");

  // All Department Live Queue Filters & State
  const [allQueuesFilterDept, setAllQueuesFilterDept] = useState("all");
  const [allQueuesFilterStatus, setAllQueuesFilterStatus] = useState("all"); // "all" | "waiting" | "serving" | "on_hold"
  const [allQueuesFilterPriority, setAllQueuesFilterPriority] = useState("all"); // "all" | "1" | "2"
  const [allQueuesSearchQuery, setAllQueuesSearchQuery] = useState("");
  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false);

  // Operational Service Counters & Clinicians Tracker Filters & Search State
  const [countersSearchQuery, setCountersSearchQuery] = useState("");
  const [countersFilterType, setCountersFilterType] = useState("all"); // "all" | "counters" | "doctors" | "online"

  // Transfer Ticket Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferModalTicket, setTransferModalTicket] = useState(null);
  const [transferTargetDept, setTransferTargetDept] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Cancel Ticket Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelModalTicket, setCancelModalTicket] = useState(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState("Patient requested cancellation");
  const [cancelReasonCustom, setCancelReasonCustom] = useState("");
  const [isCancellingTicket, setIsCancellingTicket] = useState(false);

  // Priority / Urgency Modal State
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [priorityModalTicket, setPriorityModalTicket] = useState(null);
  const [targetPriorityLevel, setTargetPriorityLevel] = useState(1);
  const [priorityReason, setPriorityReason] = useState("");
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);

  // Ticket Detail / Clinical Info Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailModalTicket, setDetailModalTicket] = useState(null);

  // Fast Walk-in Registration Form State
  const [walkinForm, setWalkinForm] = useState({
    name: "",
    age: 30,
    gender: "male",
    phone: "",
    department: "consultation",
    symptoms: "general_checkup",
    custom_symptom: "",
    priority: 2, // 2 = Routine, 1 = Emergency
  });
  const [isSubmittingWalkin, setIsSubmittingWalkin] = useState(false);
  const [createdWalkinTicket, setCreatedWalkinTicket] = useState(null);

  // Walk-In Patient Phone OTP Verification States
  const [walkinOtpState, setWalkinOtpState] = useState({
    sent: false,
    otp: "",
    phone: "",
    loading: false,
    verified: false,
  });
  const [enteredWalkinOtp, setEnteredWalkinOtp] = useState("");
  const [isVerifyingWalkinOtp, setIsVerifyingWalkinOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Registered Patient & Family Auto-Lookup State for Walk-In Desk
  const [patientLookupQuery, setPatientLookupQuery] = useState("");
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [patientLookupResult, setPatientLookupResult] = useState(null); // { found: true, account_holder, family_members, all_profiles }
  const [selectedProfileId, setSelectedProfileId] = useState(null); // 'self' or family member id
  const [lookupFeedback, setLookupFeedback] = useState(null); // { type: 'success' | 'info' | 'warn', message: '' }
  const [phoneLookupStatus, setPhoneLookupStatus] = useState(null); // null | 'registered' | 'not_registered'
  const [showAddDependentForm, setShowAddDependentForm] = useState(false);
  const [newDependent, setNewDependent] = useState({
    name: "",
    relation: "spouse",
    age: 28,
    gender: "female",
    phone: "",
  });
  const [isAddingDependent, setIsAddingDependent] = useState(false);

  // Lost Token Lookup State
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showLookupModal, setShowLookupModal] = useState(false);

  // Synchronized Theme State
  const isDark = theme === "dark";

  // In-App Toast & Confirmation States (replaces all window.alert and window.confirm)
  const [inAppToast, setInAppToast] = useState(null); // { id, message, type: "success" | "error" | "warn" | "info" }
  const toastTimerRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, confirmText, cancelText, isDestructive, onConfirm }

  // Quick In-App Flash Notification Helper
  const showFeedback = useCallback((msg, type = "success") => {
    if (!msg) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setInAppToast({ id: Date.now(), message: msg, type });
    setFeedbackMsg(msg);
    toastTimerRef.current = setTimeout(() => {
      setInAppToast(null);
      setFeedbackMsg("");
    }, 4500);
  }, []);

  // 1. Fetch Live Multi-Department Queue Snapshot for this Hospital Tenant
  const fetchLiveQueueData = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/queue/${encodeURIComponent(effectiveHospitalCode)}`);
      const data = await res.json();
      if (res.ok && data) {
        setLocalQueueSnapshot(Array.isArray(data.snapshot) ? data.snapshot : []);
        setLocalServingTickets(Array.isArray(data.serving) ? data.serving : []);
        setLocalHeldTickets(Array.isArray(data.held) ? data.held : []);
      }
    } catch (e) {
      console.error("Error fetching live queue data in Reception Portal:", e);
    }
  }, [effectiveHospitalCode]);

  // 2. Fetch Today's Appointments for this Hospital Tenant (silent background sync)
  const fetchAppointments = useCallback(async (isInitial = false) => {
    if (!effectiveHospitalCode) return;
    if (isInitial) setAppointmentsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/tenant/${effectiveHospitalCode}`);
      const data = await res.json();
      if (res.ok && (data.status === "success" || Array.isArray(data.appointments))) {
        setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
      }
    } catch (e) {
      console.error("Error fetching staff appointments:", e);
    } finally {
      if (isInitial) setAppointmentsLoading(false);
    }
  }, [effectiveHospitalCode]);

  // 3. Fetch Hospital Departments
  const fetchDepartments = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/hospitals/${encodeURIComponent(effectiveHospitalCode)}/departments`);
      const data = await res.json();
      if (res.ok && data.status === "success" && Array.isArray(data.departments)) {
        setDepartments(data.departments);
      }
    } catch (e) {
      console.error("Error fetching departments:", e);
    }
  }, [effectiveHospitalCode]);

  // 4. Fetch Clinicians and Counter Desks
  const fetchDesksAndDoctors = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    try {
      const [desksRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/superadmin/hospitals/${effectiveHospitalCode}/desks`).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/v1/superadmin/hospitals/${effectiveHospitalCode}/employees`).then((r) => r.json()).catch(() => null),
      ]);

      if (desksRes && desksRes.status === "success" && Array.isArray(desksRes.desks)) {
        setDesksList(desksRes.desks);
      }
      if (empRes && empRes.status === "success" && Array.isArray(empRes.employees)) {
        setDoctorsList(empRes.employees);
      }
    } catch (e) {
      console.error("Error fetching desks/doctors:", e);
    }
  }, [effectiveHospitalCode]);

  // Helper to broadcast live queue updates across browser tabs and windows
  const broadcastLiveQueueChange = useCallback((actionType, payload = {}) => {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("queue_updated_live", { detail: payload }));
        window.dispatchEvent(new CustomEvent("queue_updated", { detail: payload }));
        if (actionType === "ticket_created" && payload.ticket) {
          window.dispatchEvent(new CustomEvent("ticket_created", { detail: payload }));
        }
      }
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("hospital_live_queue_sync");
        bc.postMessage({ type: actionType, ...payload, tenant_id: effectiveHospitalCode });
        bc.close();
      }
    } catch (e) { }
  }, [effectiveHospitalCode]);

  // Sync props from App.jsx into local queue states whenever they update
  useEffect(() => {
    if (Array.isArray(queueSnapshot) && queueSnapshot.length > 0) {
      setLocalQueueSnapshot(queueSnapshot);
    }
    if (Array.isArray(servingTickets) && servingTickets.length > 0) {
      setLocalServingTickets(servingTickets);
    }
    if (Array.isArray(heldTickets) && heldTickets.length > 0) {
      setLocalHeldTickets(heldTickets);
    }
  }, [queueSnapshot, servingTickets, heldTickets]);

  // Initial and reactive data load
  useEffect(() => {
    fetchLiveQueueData();
    fetchAppointments(true);
    fetchDepartments();
    fetchDesksAndDoctors();
  }, [fetchLiveQueueData, fetchAppointments, fetchDepartments, fetchDesksAndDoctors]);

  // Real-time synchronization: WebSockets, Window CustomEvents, BroadcastChannel, Polling, and Focus triggers
  useEffect(() => {
    const handleRealtimeUpdate = (e) => {
      fetchLiveQueueData();
      fetchAppointments();
      fetchDesksAndDoctors();
      if (refreshData) refreshData();
    };

    // 1. WebSocket Listeners (with interval attachment in case socket connects after mount)
    let attachedSocket = null;
    const attachSocketListeners = () => {
      const socket = socketRef?.current;
      if (socket && socket !== attachedSocket) {
        if (attachedSocket) {
          attachedSocket.off("queue_updated", handleRealtimeUpdate);
          attachedSocket.off("queue_update", handleRealtimeUpdate);
          attachedSocket.off("ticket_created", handleRealtimeUpdate);
          attachedSocket.off("now_serving", handleRealtimeUpdate);
          attachedSocket.off("appointment_updated", handleRealtimeUpdate);
          attachedSocket.off("ticket_called", handleRealtimeUpdate);
          attachedSocket.off("ticket_completed", handleRealtimeUpdate);
          attachedSocket.off("ticket_cancelled", handleRealtimeUpdate);
          attachedSocket.off("ticket_transferred", handleRealtimeUpdate);
          attachedSocket.off("ticket_noshow", handleRealtimeUpdate);
          attachedSocket.off("ticket_priority_updated", handleRealtimeUpdate);
          attachedSocket.off("priority_changed", handleRealtimeUpdate);
          attachedSocket.off("ticket_held", handleRealtimeUpdate);
          attachedSocket.off("ticket_recalled", handleRealtimeUpdate);
        }
        attachedSocket = socket;
        socket.on("queue_updated", handleRealtimeUpdate);
        socket.on("queue_update", handleRealtimeUpdate);
        socket.on("ticket_created", handleRealtimeUpdate);
        socket.on("now_serving", handleRealtimeUpdate);
        socket.on("appointment_updated", handleRealtimeUpdate);
        socket.on("ticket_called", handleRealtimeUpdate);
        socket.on("ticket_completed", handleRealtimeUpdate);
        socket.on("ticket_cancelled", handleRealtimeUpdate);
        socket.on("ticket_transferred", handleRealtimeUpdate);
        socket.on("ticket_noshow", handleRealtimeUpdate);
        socket.on("ticket_priority_updated", handleRealtimeUpdate);
        socket.on("priority_changed", handleRealtimeUpdate);
        socket.on("ticket_held", handleRealtimeUpdate);
        socket.on("ticket_recalled", handleRealtimeUpdate);
      }
    };

    attachSocketListeners();
    const socketCheckInterval = setInterval(() => {
      if (!attachedSocket) attachSocketListeners();
    }, 10000);

    // 2. Window Custom Event Listeners
    const eventNames = [
      "ticket_created",
      "queue_updated_live",
      "queue_updated",
      "queue_update",
      "active_ticket_updated",
      "family_tickets_updated",
      "ticket_cancelled",
      "ticket_updated",
      "priority_changed",
      "ticket_priority_updated",
      "ticket_transferred",
      "ticket_held",
      "ticket_recalled",
      "ticket_completed",
      "now_serving",
      "ticket_noshow",
      "appointment_updated",
      "storage",
    ];

    eventNames.forEach((evName) => {
      window.addEventListener(evName, handleRealtimeUpdate);
    });

    // 3. Cross-Tab / Cross-Window BroadcastChannel
    let bc = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("hospital_live_queue_sync");
        bc.onmessage = (event) => {
          handleRealtimeUpdate(event.data);
        };
      }
    } catch (e) { }

    // 4. Background quiet sync timer (every 30 seconds fallback; WebSockets push live changes)
    const livePollTimer = setInterval(() => {
      if (document.hidden) return; // Do not poll when tab is inactive/hidden!
      fetchLiveQueueData();
      fetchAppointments();
    }, 30000);

    // 5. Immediate sync on Tab Focus & Page Visibility
    const handleFocus = () => {
      if (document.hidden) return;
      fetchLiveQueueData();
      fetchAppointments();
      fetchDesksAndDoctors();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(socketCheckInterval);
      clearInterval(livePollTimer);
      if (attachedSocket) {
        attachedSocket.off("queue_updated", handleRealtimeUpdate);
        attachedSocket.off("queue_update", handleRealtimeUpdate);
        attachedSocket.off("ticket_created", handleRealtimeUpdate);
        attachedSocket.off("now_serving", handleRealtimeUpdate);
        attachedSocket.off("appointment_updated", handleRealtimeUpdate);
        attachedSocket.off("ticket_called", handleRealtimeUpdate);
        attachedSocket.off("ticket_completed", handleRealtimeUpdate);
        attachedSocket.off("ticket_cancelled", handleRealtimeUpdate);
        attachedSocket.off("ticket_transferred", handleRealtimeUpdate);
        attachedSocket.off("ticket_noshow", handleRealtimeUpdate);
        attachedSocket.off("ticket_priority_updated", handleRealtimeUpdate);
        attachedSocket.off("priority_changed", handleRealtimeUpdate);
        attachedSocket.off("ticket_held", handleRealtimeUpdate);
        attachedSocket.off("ticket_recalled", handleRealtimeUpdate);
      }
      eventNames.forEach((evName) => {
        window.removeEventListener(evName, handleRealtimeUpdate);
      });
      if (bc) bc.close();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [socketRef, fetchLiveQueueData, fetchAppointments, fetchDesksAndDoctors, refreshData]);

  // 4. Appointment Check-In Handler
  const handleCheckInAppointment = async (aptId) => {
    if (!aptId) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: aptId }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showFeedback(
          isHi ? `✓ टोकन #${data.ticket?.ticket_id} चेक-इन सफल!` : `✓ Successfully checked in! Token #${data.ticket?.ticket_id} issued.`,
          "success"
        );
        fetchAppointments();
        fetchLiveQueueData();
        if (refreshData) refreshData();
        broadcastLiveQueueChange("ticket_created", { ticket: data.ticket, appointment_id: aptId });
        if (data.ticket) {
          announceTicketVoice(data.ticket, language);
        }
      } else {
        showFeedback(data.message || data.detail || (isHi ? "चेक-इन विफल रहा। कृपया अपॉइंटमेंट स्थिति जांचें।" : "Check-in failed. Please verify appointment status."), "error");
      }
    } catch (e) {
      showFeedback(isHi ? `चेक-इन त्रुटि: ${e.message}` : `Error during check-in: ${e.message}`, "error");
    }
  };

  // 5. Cancel Appointment Handler
  const handleCancelAppointment = (aptId) => {
    if (!aptId) return;
    setConfirmDialog({
      title: isHi ? "अपॉइंटमेंट रद्द करें" : "Cancel Scheduled Appointment",
      message: isHi
        ? `क्या आप वाकई अपॉइंटमेंट #${aptId} को रद्द करना चाहते हैं?`
        : `Are you sure you want to cancel scheduled appointment #${aptId}?`,
      confirmText: isHi ? "हाँ, रद्द करें" : "Yes, Cancel Appointment",
      cancelText: isHi ? "वापस जाएं" : "Keep Appointment",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/${aptId}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Cancelled by reception staff at desk" }),
          });
          const data = await res.json();
          if (res.ok && data.status === "success") {
            showFeedback(isHi ? "✓ अपॉइंटमेंट रद्द किया गया।" : "✓ Appointment cancelled successfully.", "info");
            fetchAppointments();
            fetchLiveQueueData();
            if (refreshData) refreshData();
            broadcastLiveQueueChange("appointment_cancelled", { appointment_id: aptId });
          } else {
            showFeedback(data.message || (isHi ? "अपॉइंटमेंट रद्द करने में विफलता।" : "Failed to cancel appointment."), "error");
          }
        } catch (e) {
          showFeedback(isHi ? `रद्दीकरण त्रुटि: ${e.message}` : `Error cancelling appointment: ${e.message}`, "error");
        }
      },
    });
  };

  // 5b. Registered Patient & Family Auto-Lookup for Walk-In Desk
  const handleLookupPatient = async (queryToSearch) => {
    const q = (queryToSearch !== undefined ? queryToSearch : (patientLookupQuery || walkinForm.phone || "")).trim();
    if (!q || q.length < 3) {
      setLookupFeedback({
        type: "warn",
        message: isHi ? "कृपया कम से कम 3 अंक या अक्षर दर्ज करें।" : "Please enter at least 3 digits / characters to search.",
      });
      showFeedback(isHi ? "कृपया कम से कम 3 अंक या अक्षर दर्ज करें।" : "Please enter at least 3 digits / characters to search.", "warn");
      return;
    }
    setIsSearchingPatient(true);
    setLookupFeedback(null);
    setPhoneLookupStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/patient-lookup?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && data.found) {
        setPhoneLookupStatus("registered");
        setPatientLookupResult(data);
        const primary = data.account_holder;
        setSelectedProfileId(primary.id);
        setWalkinForm((prev) => ({
          ...prev,
          name: primary.name || "",
          age: primary.age || prev.age,
          gender: primary.gender || prev.gender,
          phone: primary.phone || q,
        }));
        setLookupFeedback({
          type: "success",
          message: isHi
            ? `✓ खाता पहचाना गया: ${primary.name} (${data.family_members?.length || 0} परिवार के सदस्य मिले)`
            : `✓ Verified Account: ${primary.name} (${data.family_members?.length || 0} registered family member${data.family_members?.length === 1 ? "" : "s"})`,
        });
        showFeedback(
          isHi
            ? `✓ पंजीकृत खाता मिला: ${primary.name} (+91 ${primary.phone || q})`
            : `✓ Registered account verified: ${primary.name} (+91 ${primary.phone || q})`,
          "success"
        );
      } else {
        setPhoneLookupStatus("not_registered");
        setPatientLookupResult(null);
        setSelectedProfileId(null);
        const warnMsg = isHi
          ? "⚠️ यह मोबाइल नंबर / खाता डेटाबेस में पंजीकृत नहीं है। कृपया नए मरीज के रूप में विवरण दर्ज करें।"
          : "⚠️ Mobile number is not registered in the database. Please proceed as a new walk-in patient.";
        setLookupFeedback({
          type: "warn",
          message: warnMsg,
        });
        showFeedback(warnMsg, "warn");
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setPhoneLookupStatus(null);
      const errMsg = isHi ? "⚠️ सत्यापन सर्वर से संपर्क नहीं हो सका।" : "⚠️ Could not connect to patient lookup service.";
      setLookupFeedback({
        type: "warn",
        message: errMsg,
      });
      showFeedback(errMsg, "error");
    } finally {
      setIsSearchingPatient(false);
    }
  };

  const handleSelectProfile = (profile) => {
    if (!profile) return;
    setSelectedProfileId(profile.id);
    setWalkinForm((prev) => ({
      ...prev,
      name: profile.name || "",
      age: profile.age || prev.age,
      gender: profile.gender || prev.gender,
      phone: profile.phone || patientLookupResult?.account_holder?.phone || prev.phone,
    }));
  };

  const handleClearLinkedPatient = () => {
    setPatientLookupResult(null);
    setSelectedProfileId(null);
    setPatientLookupQuery("");
    setLookupFeedback(null);
    setPhoneLookupStatus(null);
    setShowAddDependentForm(false);
  };

  const handleAddDependentSubmit = async (e) => {
    e.preventDefault();
    if (!newDependent.name.trim()) {
      showFeedback(isHi ? "कृपया सदस्य का नाम दर्ज करें।" : "Please enter dependent name.", "warn");
      return;
    }
    if (!patientLookupResult?.account_holder) return;

    setIsAddingDependent(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/staff-add-family`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: patientLookupResult.account_holder.user_id,
          user_email: patientLookupResult.account_holder.email,
          patient_id: patientLookupResult.account_holder.patient_id,
          account_phone: patientLookupResult.account_holder.phone,
          account_name: patientLookupResult.account_holder.name,
          name: newDependent.name.trim(),
          relation: newDependent.relation,
          age: parseInt(newDependent.age, 10) || 25,
          gender: newDependent.gender,
          phone: newDependent.phone || patientLookupResult.account_holder.phone,
        }),
      });
      const data = await res.json();
      const m = data.member || data.family_member;
      if (res.ok && data.status === "success" && m) {
        const added = {
          id: m.id,
          name: m.name,
          relation: m.relation,
          age: m.age,
          gender: m.gender,
          phone: m.phone,
          patient_id: m.patient_id,
        };
        const updatedFmList = [...(patientLookupResult.family_members || []), added];
        const selfProfile = patientLookupResult.all_profiles?.find((p) => p.id === "self") || {
          id: "self",
          name: patientLookupResult.account_holder?.name || "Self",
          relation: "self",
          age: patientLookupResult.account_holder?.age || 30,
          gender: patientLookupResult.account_holder?.gender || "male",
        };
        const updatedAllList = [selfProfile, ...updatedFmList];

        setPatientLookupResult((prev) => ({
          ...prev,
          account_holder: {
            ...prev.account_holder,
            user_id: data.user_id || m.user_id || prev.account_holder.user_id,
            email: data.user_email || prev.account_holder.email,
          },
          family_members: updatedFmList,
          all_profiles: [
            ...(prev.all_profiles || []).map((p) =>
              p.id === "self"
                ? {
                  ...p,
                  user_id: data.user_id || m.user_id || p.user_id,
                  email: data.user_email || p.email,
                }
                : p
            ),
            added,
          ],
        }));

        // Sync with localStorage across all potential identifier keys
        const idents = [
          patientLookupResult.account_holder?.name,
          patientLookupResult.account_holder?.username,
          patientLookupResult.account_holder?.email,
          patientLookupResult.account_holder?.phone,
          walkinForm?.phone,
          walkinForm?.name,
          "guest",
        ].filter(Boolean);
        idents.forEach((k) => {
          try {
            localStorage.setItem(`family_members_${k}`, JSON.stringify(updatedAllList));
          } catch (e) { }
        });

        // Dispatch real-time events for other pages/tabs
        window.dispatchEvent(new CustomEvent("family_members_updated", { detail: updatedAllList }));
        try {
          if (typeof BroadcastChannel !== "undefined") {
            const bc = new BroadcastChannel("hospital_family_sync");
            bc.postMessage({
              type: "FAMILY_MEMBERS_UPDATED",
              members: updatedAllList,
              account: patientLookupResult.account_holder,
            });
            bc.close();
          }
        } catch (e) { }

        handleSelectProfile(added);
        setShowAddDependentForm(false);
        setNewDependent({ name: "", relation: "spouse", age: 28, gender: "female", phone: "" });
        showFeedback(isHi ? `✓ ${added.name} को खाते में जोड़ा गया!` : `✓ ${added.name} added to family profile!`, "success");
      } else {
        showFeedback(data.message || (isHi ? "परिवार के सदस्य को जोड़ने में विफलता।" : "Failed to add family member."), "error");
      }
    } catch (err) {
      showFeedback(isHi ? `त्रुटि: ${err.message}` : `Error: ${err.message}`, "error");
    } finally {
      setIsAddingDependent(false);
    }
  };

  // Walk-In Mobile Phone OTP Handlers
  const handleSendWalkinOtp = async (phoneToUse) => {
    const rawPhone = phoneToUse || walkinForm.phone || "";
    const cleanDigits = rawPhone.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 7) {
      showFeedback(
        isHi
          ? "कृपया OTP भेजने के लिए कम से कम 7 अंकों का फोन नंबर दर्ज करें।"
          : "Please enter at least 7 digits of mobile number to send OTP.",
        "warn"
      );
      return;
    }
    setWalkinOtpState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/send-mobile-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: rawPhone,
          hospital_code: effectiveHospitalCode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setWalkinOtpState({
          sent: true,
          otp: data.dev_otp || "",
          phone: rawPhone,
          loading: false,
          verified: false,
        });
        setEnteredWalkinOtp("");
        setOtpCooldown(60);
        showFeedback(
          isHi
            ? `✓ OTP मरीज के मोबाइल (+91 ${cleanDigits}) पर भेजा गया। कृपया मरीज से 6-अंकीय कोड पूछें।`
            : `✓ OTP sent via SMS to patient (+91 ${cleanDigits}). Please ask the patient for the 6-digit code.`,
          "success"
        );
      } else {
        setWalkinOtpState((prev) => ({ ...prev, loading: false }));
        showFeedback(data.message || (isHi ? "OTP भेजने में विफल।" : "Failed to send OTP."), "error");
      }
    } catch (err) {
      setWalkinOtpState((prev) => ({ ...prev, loading: false }));
      showFeedback(isHi ? "OTP भेजने में त्रुटि।" : "Error sending OTP.", "error");
    }
  };

  const handleVerifyWalkinOtp = async (otpCode) => {
    const code = otpCode || enteredWalkinOtp;
    const phone =
      walkinOtpState.phone ||
      walkinForm.phone ||
      createdWalkinTicket?.phone ||
      createdWalkinTicket?.otp_info?.phone;
    if (!phone) {
      showFeedback(isHi ? "फोन नंबर उपलब्ध नहीं है।" : "Phone number is missing.", "warn");
      return;
    }
    if (!code || code.trim().length < 4) {
      showFeedback(isHi ? "कृपया 6-अंकीय OTP दर्ज करें।" : "Please enter the 6-digit OTP.", "warn");
      return;
    }
    setIsVerifyingWalkinOtp(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-mobile-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          otp: code.trim(),
          name: walkinForm.name || createdWalkinTicket?.name,
          hospital_code: effectiveHospitalCode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setWalkinOtpState((prev) => ({
          ...prev,
          verified: true,
          loading: false,
          user: data.user,
        }));
        if (createdWalkinTicket) {
          setCreatedWalkinTicket((prev) => ({
            ...prev,
            otp_info: {
              ...(prev?.otp_info || {}),
              is_registered: true,
              user_name: data.user?.username,
              message: "Account verified & all past records linked!",
            },
          }));
        }
        showFeedback(
          isHi
            ? `✓ मरीज का खाता सत्यापित हो गया! पूर्व रिकॉर्ड लिंक हो गए।`
            : `✓ Patient account verified & all past records synced!`,
          "success"
        );
        handleLookupPatient(phone);
      } else {
        showFeedback(data.message || (isHi ? "अमान्य OTP कोड।" : "Invalid OTP code."), "error");
      }
    } catch (err) {
      showFeedback(isHi ? "सत्यापन में त्रुटि।" : "Error verifying OTP.", "error");
    } finally {
      setIsVerifyingWalkinOtp(false);
    }
  };

  // 6. Fast Walk-In Intake Submission
  const handleWalkinSubmit = async (e) => {
    e.preventDefault();
    if (!walkinForm.name.trim()) {
      showFeedback(isHi ? "कृपया मरीज का नाम दर्ज करें।" : "Please enter patient name.", "warn");
      return;
    }
    const cleanPhoneDigits = (walkinForm.phone || "").replace(/\D/g, "");
    if (!cleanPhoneDigits || cleanPhoneDigits.length < 7) {
      showFeedback(
        isHi
          ? "कृपया मरीज का मान्य मोबाइल नंबर (कम से कम 7 अंक) दर्ज करें।"
          : "Please enter a valid patient mobile phone number (at least 7 digits).",
        "warn"
      );
      return;
    }
    setIsSubmittingWalkin(true);
    try {
      const payload = {
        name: walkinForm.name.trim(),
        age: parseInt(walkinForm.age, 10) || 30,
        gender: walkinForm.gender,
        phone: walkinForm.phone.trim(),
        service_category: walkinForm.department || "consultation",
        symptoms: (walkinForm.custom_symptom && walkinForm.custom_symptom.trim()) ? [walkinForm.custom_symptom.trim()] : [walkinForm.symptoms || "general_checkup"],
        medical_condition: (walkinForm.custom_symptom && walkinForm.custom_symptom.trim()) || walkinForm.symptoms || "general_checkup",
        priority: parseInt(walkinForm.priority, 10) || 2,
        tenant_id: effectiveHospitalCode,
        ...(patientLookupResult?.account_holder?.email
          ? { user_email: patientLookupResult.account_holder.email }
          : {}),
        ...(selectedProfileId && selectedProfileId !== "self"
          ? { family_member_id: selectedProfileId }
          : {}),
        skip_otp_sms: Boolean(walkinOtpState.sent || walkinOtpState.verified),
      };

      const res = await fetch(`${API_BASE}/api/v1/plugin/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.status === "success" && data.ticket) {
        const activeProfile = patientLookupResult?.all_profiles?.find((p) => p.id === selectedProfileId);
        setCreatedWalkinTicket({
          ...data.ticket,
          otp_info: data.otp_info || null,
          linkedAccountName: patientLookupResult?.account_holder?.name || data.otp_info?.user_name,
          linkedAccountPhone: patientLookupResult?.account_holder?.phone || data.otp_info?.phone,
          linkedProfileName: walkinForm.name,
          isFamilyMember: Boolean(selectedProfileId && selectedProfileId !== "self"),
          profileRelation: activeProfile?.relation || "self",
        });

        if (data.otp_info?.sent) {
          setWalkinOtpState({
            sent: true,
            otp: data.otp_info.otp || "",
            phone: data.otp_info.phone || walkinForm.phone,
            loading: false,
            verified: false,
          });
          setEnteredWalkinOtp("");
          setOtpCooldown(60);
          showFeedback(
            isHi
              ? `✓ टोकन #${data.ticket.ticket_id} जारी! मोबाइल OTP मरीज को भेजा गया। मरीज से कोड पूछें।`
              : `✓ Token #${data.ticket.ticket_id} issued! Mobile OTP sent to patient. Ask patient for the 6-digit code.`,
            "success"
          );
        } else if (data.otp_info?.is_registered) {
          setWalkinOtpState({
            sent: false,
            otp: "",
            phone: data.otp_info.phone || walkinForm.phone,
            loading: false,
            verified: true,
          });
          showFeedback(
            isHi
              ? `✓ टोकन #${data.ticket.ticket_id} जारी! पंजीकृत खाते (${data.otp_info.user_name}) से लिंक किया गया।`
              : `✓ Token #${data.ticket.ticket_id} generated! Linked to patient account (${data.otp_info.user_name}).`,
            "success"
          );
        } else {
          showFeedback(
            isHi
              ? `✓ टोकन #${data.ticket.ticket_id} जारी किया गया!`
              : `✓ Token #${data.ticket.ticket_id} generated successfully!`,
            "success"
          );
        }
        announceTicketVoice(data.ticket, language);

        // Sync with patient portal state in real time
        try {
          const profileKey = selectedProfileId || "self";
          const ticketObj = {
            ...data.ticket,
            name: walkinForm.name,
            phone: walkinForm.phone,
            family_member_id: selectedProfileId && selectedProfileId !== "self" ? selectedProfileId : null,
          };
          const idents = [
            patientLookupResult?.account_holder?.name,
            patientLookupResult?.account_holder?.username,
            patientLookupResult?.account_holder?.email,
            patientLookupResult?.account_holder?.phone,
            walkinForm?.phone,
            walkinForm?.name,
            "guest",
          ].filter(Boolean);
          let latestFamMap = {};
          idents.forEach((k) => {
            const famKey = `family_tickets_${k}`;
            const currentFam = localStorage.getItem(famKey);
            const famMap = currentFam ? JSON.parse(currentFam) : {};
            famMap[profileKey] = ticketObj;
            if (walkinForm.name) {
              famMap[`name_${walkinForm.name.toLowerCase().trim()}`] = ticketObj;
              famMap[walkinForm.name.toLowerCase().trim()] = ticketObj;
            }
            if (profileKey !== "self" && famMap["self"]?.ticket_id === ticketObj.ticket_id) {
              delete famMap["self"];
            }
            localStorage.setItem(famKey, JSON.stringify(famMap));
            latestFamMap = famMap;
          });

          if (profileKey === "self") {
            localStorage.setItem("ai_queue_active_ticket", JSON.stringify(ticketObj));
            window.dispatchEvent(new CustomEvent("active_ticket_updated", { detail: ticketObj }));
          }
          window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: latestFamMap }));
          try {
            if (typeof BroadcastChannel !== "undefined") {
              const bc = new BroadcastChannel("hospital_family_sync");
              bc.postMessage({
                type: "FAMILY_TICKET_ADDED",
                profileKey,
                ticket: ticketObj,
                famMap: latestFamMap,
                account: patientLookupResult?.account_holder,
              });
              bc.close();
            }
          } catch (e) { }
        } catch (e) { }
        // Reset form
        setWalkinForm({
          name: "",
          age: 30,
          gender: "male",
          phone: "",
          department: departments[0]?.dept_code || "consultation",
          symptoms: "general_checkup",
          custom_symptom: "",
          priority: 2,
        });
        fetchLiveQueueData();
        fetchAppointments();
        if (refreshData) refreshData();
        broadcastLiveQueueChange("ticket_created", { ticket: data.ticket, tenant_id: effectiveHospitalCode });
      } else {
        showFeedback(data.message || data.detail || (isHi ? "वॉक-इन टोकन बनाने में विफलता।" : "Failed to generate walk-in token."), "error");
      }
    } catch (err) {
      showFeedback(isHi ? `टोकन निर्माण त्रुटि: ${err.message}` : `Error creating token: ${err.message}`, "error");
    } finally {
      setIsSubmittingWalkin(false);
    }
  };

  // 7. Loudspeaker Announcement Handler
  const handleAnnounceTicket = (ticket) => {
    if (!ticket) return;
    announceTicketVoice(ticket, language);
    setAnnouncementMsg(isHi ? `टोकन #${ticket.ticket_id} लाउडस्पीकर पर प्रसारित किया गया` : `Announced Token #${ticket.ticket_id} on public PA speaker.`);
    setTimeout(() => setAnnouncementMsg(""), 3500);

    // Call backend announcement endpoint to sync Kiosks
    fetch(`${API_BASE}/api/v1/plugin/re-announce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticket_id: ticket.ticket_id,
        tenant_id: effectiveHospitalCode,
      }),
    }).catch(() => { });
  };

  // 8. Mark No-Show Handler
  const handleMarkNoShow = (ticketId) => {
    if (!ticketId) return;
    setConfirmDialog({
      title: isHi ? "अनुपस्थित (No-Show) चिह्नित करें" : "Mark as Absent / No-Show",
      message: isHi
        ? `क्या आप मरीज टोकन #${ticketId} को 'अनुपस्थित (No-Show)' चिह्नित करना चाहते हैं? यह टोकन को सक्रिय कतार से हटा देगा।`
        : `Are you sure you want to mark patient Ticket #${ticketId} as No-Show / Absent? This will remove the ticket from the active queue.`,
      confirmText: isHi ? "हाँ, अनुपस्थित चिह्नित करें" : "Mark as Absent",
      cancelText: isHi ? "वापस जाएं" : "Cancel",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/plugin/no-show`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticket_id: ticketId,
              tenant_id: effectiveHospitalCode,
              reason: "Patient did not respond to reception PA calls",
            }),
          });
          if (res.ok) {
            showFeedback(isHi ? `✓ टोकन #${ticketId} को अनुपस्थित दर्ज किया गया।` : `✓ Ticket #${ticketId} marked as No-Show.`, "info");
            fetchLiveQueueData();
            if (refreshData) refreshData();
            broadcastLiveQueueChange("ticket_noshow", { ticket_id: ticketId, tenant_id: effectiveHospitalCode });
          } else {
            showFeedback(isHi ? "टोकन को अनुपस्थित चिह्नित करने में विफलता।" : "Failed to mark ticket as no-show.", "error");
          }
        } catch (e) {
          showFeedback(`Error: ${e.message}`, "error");
        }
      },
    });
  };

  // 9. Counter Desk Status Toggle
  const handleToggleDeskStatus = async (deskId, currentStatus) => {
    if (!deskId) return;
    const nextStatus = currentStatus === "AVAILABLE" ? "OFFLINE" : "AVAILABLE";
    try {
      const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${effectiveHospitalCode}/desks/${deskId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        showFeedback(isHi ? `✓ डेस्क की स्थिति '${nextStatus}' में बदली गई!` : `✓ Desk status updated to ${nextStatus}!`, "success");
        fetchDesksAndDoctors();
      } else {
        showFeedback(isHi ? "डेस्क स्थिति अपडेट करने में विफलता।" : "Failed to update desk status.", "error");
      }
    } catch (e) {
      showFeedback(`Error updating desk: ${e.message}`, "error");
    }
  };

  // 10. Lost Token Lookup Search Handler
  const handleLookupSearch = async () => {
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/tickets/history/${encodeURIComponent(lookupQuery.trim())}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.tickets)) {
        setLookupResults(data.tickets);
      } else {
        setLookupResults([]);
      }
    } catch (e) {
      console.error("Lookup error:", e);
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  };

  // Effective Active Queue Collections (Priority: Local fetch > Props)
  const effectiveWaitingTickets = localQueueSnapshot.length > 0 ? localQueueSnapshot : (queueSnapshot || []);
  const effectiveServingTickets = localServingTickets.length > 0 ? localServingTickets : (servingTickets || []);
  const effectiveHeldTickets = localHeldTickets.length > 0 ? localHeldTickets : (heldTickets || []);

  // 11. All Multi-Department Live Queue Combined Store & Actions
  const allActiveLiveTickets = React.useMemo(() => {
    const map = new Map();

    // 1. Waiting Queue
    effectiveWaitingTickets.forEach((t) => {
      if (t && t.ticket_id) {
        map.set(t.ticket_id, {
          ...t,
          status: (t.status || "waiting").toLowerCase(),
          priority_level: Number(t.priority_level || t.priority || 2),
        });
      }
    });

    // 2. Serving Tickets
    effectiveServingTickets.forEach((t) => {
      if (t && t.ticket_id) {
        map.set(t.ticket_id, {
          ...t,
          status: "serving",
          priority_level: Number(t.priority_level || t.priority || 2),
        });
      }
    });

    // 3. Held Tickets
    effectiveHeldTickets.forEach((t) => {
      if (t && t.ticket_id) {
        map.set(t.ticket_id, {
          ...t,
          status: "on_hold",
          priority_level: Number(t.priority_level || t.priority || 2),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // 1. Emergency P1 first
      const pA = Number(a.priority_level || 2);
      const pB = Number(b.priority_level || 2);
      if (pA !== pB) return pA - pB;

      // 2. Serving before waiting
      if (a.status === "serving" && b.status !== "serving") return -1;
      if (b.status === "serving" && a.status !== "serving") return 1;

      // 3. Position order
      const posA = Number(a.position || 999);
      const posB = Number(b.position || 999);
      return posA - posB;
    });
  }, [effectiveWaitingTickets, effectiveServingTickets, effectiveHeldTickets]);

  // Real-time Counts by Department
  const allQueuesDeptCounts = React.useMemo(() => {
    const counts = { all: allActiveLiveTickets.length };
    allActiveLiveTickets.forEach((t) => {
      const d = (t.service_category || "consultation").toLowerCase();
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }, [allActiveLiveTickets]);

  // Filtered Multi-Department Queues
  const filteredAllQueues = React.useMemo(() => {
    return allActiveLiveTickets.filter((t) => {
      // Department Filter
      if (allQueuesFilterDept !== "all") {
        const d = (t.service_category || "").toLowerCase();
        if (d !== allQueuesFilterDept.toLowerCase()) return false;
      }

      // Status Filter
      if (allQueuesFilterStatus !== "all") {
        const s = (t.status || "waiting").toLowerCase();
        if (allQueuesFilterStatus === "waiting" && s !== "waiting") return false;
        if (allQueuesFilterStatus === "serving" && s !== "serving") return false;
        if (allQueuesFilterStatus === "on_hold" && s !== "on_hold" && s !== "hold") return false;
      }

      // Priority Filter
      if (allQueuesFilterPriority !== "all") {
        const p = Number(t.priority_level || t.priority || 2);
        if (String(p) !== String(allQueuesFilterPriority)) return false;
      }

      // Search Query
      if (allQueuesSearchQuery.trim()) {
        const q = allQueuesSearchQuery.trim().toLowerCase();
        const idMatch = (t.ticket_id || "").toLowerCase().includes(q);
        const nameMatch = (t.name || "").toLowerCase().includes(q);
        const phoneMatch = (t.phone || "").toLowerCase().includes(q);
        const docMatch = (t.served_by_doctor_name || t.doctor_name || "").toLowerCase().includes(q);
        const deptMatch = (t.service_category || "").toLowerCase().includes(q);
        const aptMatch = (t.appointment_id || "").toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !phoneMatch && !docMatch && !deptMatch && !aptMatch) {
          return false;
        }
      }

      return true;
    });
  }, [allActiveLiveTickets, allQueuesFilterDept, allQueuesFilterStatus, allQueuesFilterPriority, allQueuesSearchQuery]);

  // 12. Operational Service Counters & Clinicians Filters & Live Telemetry Computation
  // Exclude logged-in staff / doctor's own account from the fleet overview
  const filteredDoctorsList = React.useMemo(() => {
    if (!Array.isArray(doctorsList)) return [];

    return doctorsList.filter((doc) => {
      if (!doc) return false;

      // Check if doc matches the logged-in user to exclude own account
      if (currentUser) {
        const curId = String(currentUser.id || currentUser.user_id || currentUser._id || "");
        const curEmp = String(currentUser.employee_code || currentUser.employee_id || "");
        const curEmail = (currentUser.email || "").toLowerCase().trim();
        const curUser = (currentUser.username || "").toLowerCase().trim();
        const curName = (currentUser.name || "").toLowerCase().trim();

        const docId = String(doc.id || doc.user_id || doc.employee_id || "");
        const docEmp = String(doc.employee_code || doc.employee_id || "");
        const docEmail = (doc.email || "").toLowerCase().trim();
        const docUser = (doc.username || "").toLowerCase().trim();
        const docName = (doc.name || "").toLowerCase().trim();

        if (curId && docId && curId === docId) return false;
        if (curEmp && docEmp && curEmp === docEmp) return false;
        if (curEmail && docEmail && curEmail === docEmail) return false;
        if (curUser && docUser && curUser === docUser) return false;
        if (curName && docName && curName === docName) return false;
      }
      return true;
    });
  }, [doctorsList, currentUser]);

  // Filtered desks based on search and status filter
  const searchedDesksList = React.useMemo(() => {
    if (!Array.isArray(desksList)) return [];
    const q = countersSearchQuery.trim().toLowerCase();

    return desksList.filter((desk) => {
      if (countersFilterType === "doctors") return false;
      if (countersFilterType === "online" && desk.status !== "AVAILABLE") return false;

      if (!q) return true;
      const name = (desk.desk_name || "").toLowerCase();
      const dept = (desk.dept_code || desk.department || "").toLowerCase();
      const deptLabel = getCategoryLabel(desk.dept_code || desk.department, language).toLowerCase();
      const staff = (desk.assigned_employee_name || "").toLowerCase();
      const num = String(desk.desk_number || desk.counter_number || "");
      return name.includes(q) || dept.includes(q) || deptLabel.includes(q) || staff.includes(q) || num.includes(q);
    });
  }, [desksList, countersSearchQuery, countersFilterType, language]);

  // Filtered doctors based on search and status filter
  const searchedDoctorsList = React.useMemo(() => {
    const q = countersSearchQuery.trim().toLowerCase();

    return filteredDoctorsList.filter((doc) => {
      if (countersFilterType === "counters") return false;
      const isOnline = (doc.status || "").toLowerCase() === "active";
      if (countersFilterType === "online" && !isOnline) return false;

      if (!q) return true;
      const name = (doc.name || doc.username || "").toLowerCase();
      const dept = (doc.department || doc.dept_code || "").toLowerCase();
      const deptLabel = getCategoryLabel(doc.department || doc.dept_code, language).toLowerCase();
      const room = String(doc.room_number || doc.room || "").toLowerCase();
      const empCode = String(doc.employee_code || doc.employee_id || "").toLowerCase();
      const role = String(doc.role || "").toLowerCase();
      return name.includes(q) || dept.includes(q) || deptLabel.includes(q) || room.includes(q) || empCode.includes(q) || role.includes(q);
    });
  }, [filteredDoctorsList, countersSearchQuery, countersFilterType, language]);

  // Operational Action Handlers
  const handleManualRefreshQueue = async () => {
    setIsRefreshingQueue(true);
    try {
      await Promise.all([
        fetchLiveQueueData(),
        fetchAppointments(),
        fetchDesksAndDoctors(),
        refreshData ? refreshData() : Promise.resolve(),
      ]);
      showFeedback(isHi ? "✓ लाइव कतार डेटा रीफ्रेश हुआ!" : "✓ Live queue telemetry synchronized!");
    } catch (e) {
      console.error("Refresh error:", e);
    } finally {
      setTimeout(() => setIsRefreshingQueue(false), 500);
    }
  };

  const handleCancelTicketSubmit = async (ticketId, reason) => {
    if (!ticketId) return;
    setIsCancellingTicket(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tickets/${encodeURIComponent(ticketId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: ticketId,
          reason: reason || "Cancelled by desk staff",
        }),
      });
      const data = await res.json();
      if (res.ok && (data.status === "success" || data.success)) {
        showFeedback(isHi ? `✓ टोकन #${ticketId} रद्द किया गया।` : `✓ Ticket #${ticketId} cancelled successfully.`, "info");
        setShowCancelModal(false);
        setCancelModalTicket(null);
        fetchLiveQueueData();
        fetchAppointments();
        if (refreshData) refreshData();
        broadcastLiveQueueChange("ticket_cancelled", { ticket_id: ticketId, tenant_id: effectiveHospitalCode });
      } else {
        showFeedback(data.message || data.detail || (isHi ? "टोकन रद्द करने में विफलता।" : "Failed to cancel ticket."), "error");
      }
    } catch (e) {
      showFeedback(isHi ? `रद्दीकरण त्रुटि: ${e.message}` : `Error cancelling ticket: ${e.message}`, "error");
    } finally {
      setIsCancellingTicket(false);
    }
  };

  const handleTransferTicketSubmit = async (ticketId, targetDept, notes = "") => {
    if (!ticketId || !targetDept) return;
    setIsTransferring(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/transfer-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: ticketId,
          target_department: targetDept,
          prescription_notes: notes ? JSON.stringify({ transfer_notes: notes, advised_by: "Reception Desk" }) : "",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const newTid = data.new_ticket?.ticket_id || ticketId;
        const targetDeptName = getCategoryLabel(targetDept, language);
        showFeedback(
          isHi
            ? `✓ टोकन #${ticketId} को ${targetDeptName} में स्थानांतरित किया गया (नया टोकन: #${newTid})`
            : `✓ Transferred #${ticketId} to ${targetDeptName} (New Token: #${newTid})`,
          "success"
        );
        setShowTransferModal(false);
        setTransferModalTicket(null);
        setTransferNotes("");
        fetchLiveQueueData();
        fetchAppointments();
        if (refreshData) refreshData();
        broadcastLiveQueueChange("ticket_transferred", { ticket_id: ticketId, new_ticket_id: newTid, target_department: targetDept, tenant_id: effectiveHospitalCode });
      } else {
        showFeedback(data.message || data.detail || (isHi ? "स्थानांतरण में विफलता।" : "Failed to transfer ticket."), "error");
      }
    } catch (e) {
      showFeedback(isHi ? `स्थानांतरण त्रुटि: ${e.message}` : `Error transferring ticket: ${e.message}`, "error");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleTogglePriority = async (ticket, newPriority = null, reason = "") => {
    if (!ticket || !ticket.ticket_id) return;
    const curP = Number(ticket.priority_level || ticket.priority || 2);
    const targetP = newPriority !== null ? newPriority : (curP === 1 ? 2 : 1);
    const isNowEmergency = targetP === 1;

    setIsUpdatingPriority(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tickets/${encodeURIComponent(ticket.ticket_id)}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          priority_level: targetP,
          reason: reason || (isNowEmergency ? "Elevated to Emergency Triage by Staff" : "Reverted to Routine OPD"),
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showFeedback(
          isNowEmergency
            ? (isHi ? `🚨 टोकन #${ticket.ticket_id} को आपातकालीन (Emergency P1) में अपग्रेड किया गया!` : `🚨 Ticket #${ticket.ticket_id} elevated to Emergency Triage (P1)! Front of queue.`)
            : (isHi ? `🟢 टोकन #${ticket.ticket_id} को सामान्य ओपीडी (Routine P2) में सेट किया गया।` : `🟢 Ticket #${ticket.ticket_id} moved to Routine OPD (P2).`),
          isNowEmergency ? "warn" : "success"
        );
        setShowPriorityModal(false);
        setPriorityModalTicket(null);
        fetchLiveQueueData();
        if (refreshData) refreshData();
        broadcastLiveQueueChange("priority_changed", { ticket_id: ticket.ticket_id, priority_level: targetP, is_emergency: isNowEmergency, tenant_id: effectiveHospitalCode });
      } else {
        showFeedback(data.message || data.detail || (isHi ? "प्राथमिकता अपडेट में विफलता।" : "Failed to update ticket priority."), "error");
      }
    } catch (e) {
      showFeedback(isHi ? `प्राथमिकता त्रुटि: ${e.message}` : `Error updating priority: ${e.message}`, "error");
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleHoldTicket = async (ticketId, minutes = 15) => {
    if (!ticketId) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/hold-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: ticketId,
          grace_minutes: minutes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showFeedback(isHi ? `⏸ टोकन #${ticketId} को होल्ड पर रखा गया (${minutes} मिनट)` : `⏸ Token #${ticketId} placed on hold (${minutes}m grace period)`, "warn");
        fetchLiveQueueData();
        if (refreshData) refreshData();
        broadcastLiveQueueChange("ticket_held", { ticket_id: ticketId, tenant_id: effectiveHospitalCode });
      } else {
        showFeedback(data.message || (isHi ? "होल्ड करने में विफलता।" : "Failed to put ticket on hold."), "error");
      }
    } catch (e) {
      showFeedback(`Error: ${e.message}`, "error");
    }
  };

  const handleRecallTicket = async (ticketId) => {
    if (!ticketId) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/recall-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: ticketId,
          target_mode: "queue",
        }),
      });
      const data = await res.json();
      if (res.ok && (data.status === "success" || data.success)) {
        showFeedback(isHi ? `▶ टोकन #${ticketId} को कतार में पुनः सक्रिय किया गया!` : `▶ Token #${ticketId} recalled back into active queue!`, "success");
        fetchLiveQueueData();
        fetchAppointments();
        if (refreshData) refreshData();
        broadcastLiveQueueChange("ticket_recalled", { ticket_id: ticketId, tenant_id: effectiveHospitalCode });
      } else {
        showFeedback(data.message || (isHi ? "पुनः सक्रिय करने में विफलता।" : "Failed to recall ticket."), "error");
      }
    } catch (e) {
      showFeedback(`Error: ${e.message}`, "error");
    }
  };

  // Next 3 Days helper array: [Today, Tomorrow, Day+2, Day+3]
  const next3DaysDates = React.useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const label = i === 0 ? (isHi ? "आज (Today)" : "Today") : i === 1 ? (isHi ? "कल (Tomorrow)" : "Tomorrow") : d.toLocaleDateString(isHi ? "hi-IN" : "en-US", { weekday: "short", month: "short", day: "numeric" });
      dates.push({ offset: i, dateStr, label });
    }
    return dates;
  }, [isHi]);

  // Live Appointments (strictly excludes cancelled tickets and limits to Next 3 Days window)
  const liveAppointments = React.useMemo(() => {
    const validDateSet = new Set(next3DaysDates.map((d) => d.dateStr));
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfMaxDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 59, 59);

    return appointments.filter((apt) => {
      const s = (apt.status || "booked").toLowerCase();
      // Exclude cancelled tickets
      if (s === "cancelled" || s === "canceled") return false;

      // Extract appointment date string (YYYY-MM-DD)
      let aptDateStr = "";
      if (apt.appointment_date) {
        if (typeof apt.appointment_date === "string") {
          aptDateStr = apt.appointment_date.split("T")[0].trim();
        } else if (apt.appointment_date instanceof Date) {
          const y = apt.appointment_date.getFullYear();
          const m = String(apt.appointment_date.getMonth() + 1).padStart(2, "0");
          const d = String(apt.appointment_date.getDate()).padStart(2, "0");
          aptDateStr = `${y}-${m}-${d}`;
        }
      }

      if (aptDateStr) {
        if (validDateSet.has(aptDateStr)) return true;
        const aptDateObj = new Date(aptDateStr + "T00:00:00");
        if (!isNaN(aptDateObj.getTime())) {
          if (aptDateObj < startOfToday || aptDateObj > endOfMaxDay) {
            return false;
          }
        }
      }

      return true;
    });
  }, [appointments, next3DaysDates]);

  // Filtered Appointments (shows ONLY live appointments of next 3 days: booked, check-in available, checked-in, and expired; never cancelled)
  const filteredAppointments = React.useMemo(() => {
    return liveAppointments.filter((apt) => {
      const s = (apt.status || "booked").toLowerCase();
      if (aptStatusFilter !== "all") {
        if (aptStatusFilter === "confirmed" && !["booked", "check_in_available", "scheduled", "confirmed"].includes(s)) return false;
        if (aptStatusFilter === "checked_in" && s !== "checked_in") return false;
        if (aptStatusFilter === "expired" && s !== "expired") return false;
      }
      if (deptFilter !== "all" && (apt.department || apt.service_category || "").toLowerCase() !== deptFilter.toLowerCase()) return false;

      if (aptDayFilter !== "all") {
        let aptDateStr = "";
        if (apt.appointment_date) {
          if (typeof apt.appointment_date === "string") {
            aptDateStr = apt.appointment_date.split("T")[0].trim();
          } else if (apt.appointment_date instanceof Date) {
            const y = apt.appointment_date.getFullYear();
            const m = String(apt.appointment_date.getMonth() + 1).padStart(2, "0");
            const d = String(apt.appointment_date.getDate()).padStart(2, "0");
            aptDateStr = `${y}-${m}-${d}`;
          }
        }
        if (aptDateStr && aptDateStr !== aptDayFilter) return false;
      }

      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        (apt.patient_name || "").toLowerCase().includes(q) ||
        (apt.phone || "").toLowerCase().includes(q) ||
        (apt.email || apt.user_email || "").toLowerCase().includes(q) ||
        (apt.appointment_id || "").toLowerCase().includes(q) ||
        (apt.ticket_id || "").toLowerCase().includes(q) ||
        (apt.department || apt.service_category || "").toLowerCase().includes(q)
      );
    });
  }, [liveAppointments, aptStatusFilter, deptFilter, aptDayFilter, searchFilter]);

  return (
    <div className={`staff-portal-container ${isDark ? "dark-theme" : ""}`} style={{ maxWidth: "1400px", margin: "0 auto", paddingBottom: "40px" }}>
      <style>{`
        .staff-portal-container * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* 1. HERO BANNER CONTAINER MATCHING HERO BANNER AND ADMIN HERO BANNER */
        .staff-hero-banner-container {
          border-radius: 24px;
          overflow: hidden;
          background: radial-gradient(circle at 10% 15%, rgba(2, 132, 199, 0.25) 0%, transparent 45%), radial-gradient(circle at 90% 85%, rgba(56, 189, 248, 0.18) 0%, transparent 50%), linear-gradient(135deg, #090F1E 0%, #0F172A 60%, #162447 100%);
          box-shadow: 0 20px 45px -12px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(56, 189, 248, 0.18);
          border: 1px solid rgba(56, 189, 248, 0.25);
          margin-bottom: 22px;
          position: relative;
          padding: 26px 30px;
          width: 100%;
          box-sizing: border-box;
          color: #FFFFFF;
        }

        .staff-hero-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-top: 24px;
        }

        .staff-kpi-card {
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid rgba(56, 189, 248, 0.2);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .staff-kpi-card:hover {
          transform: translateY(-2px);
          border-color: rgba(56, 189, 248, 0.4);
        }

        /* 2. STAFF IDENTITY TOOLBAR */
        .staff-identity-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          padding: 8px 14px;
          border-radius: 14px;
          background: var(--staff-card-bg, #FFFFFF);
          border: 1px solid var(--staff-card-border, #E2E8F0);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
          flex-wrap: wrap;
        }

        body.theme-dark .staff-identity-toolbar,
        [data-theme="dark"] .staff-identity-toolbar,
        .dark-theme .staff-identity-toolbar {
          background: #0F172A !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
        }

        /* 3. MODERN RECEPTION NAVIGATION TABS (MATCHING STAFFPAGE) */
        .staff-tabs-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
          width: 100%;
          box-sizing: border-box;
        }

        @media (max-width: 1100px) {
          .staff-tabs-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .staff-tabs-grid {
            grid-template-columns: 1fr;
          }
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
          color: #FFFFFF !important;
          box-shadow: 0 8px 20px rgba(2, 132, 199, 0.25);
          transform: translateY(-2px);
        }

        .tab-button-modern.active .tab-icon-wrapper {
          background: rgba(255, 255, 255, 0.2) !important;
          color: #BAE6FD !important;
        }

        .tab-button-modern.active .tab-title-text {
          color: #FFFFFF !important;
        }

        .tab-button-modern.active .tab-sub-text {
          color: #BAE6FD !important;
        }

        .tab-button-modern.active .tab-count-badge {
          background: #38BDF8 !important;
          color: #0F172A !important;
        }

        .tab-button-modern.inactive .tab-icon-wrapper {
          background: #F0F9FF;
          color: #0284C7;
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

        .tab-title-text {
          font-size: 13.5px;
          font-weight: 800;
          letter-spacing: -0.2px;
          line-height: 1.25;
        }

        .tab-sub-text {
          font-size: 11px;
          font-weight: 600;
          display: block;
          margin-top: 2px;
          color: #64748B;
        }

        .tab-count-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #E0F2FE;
          color: #0284C7;
        }

        /* 4. DARK MODE OVERRIDES */
        body.theme-dark .staff-portal-container,
        [data-theme="dark"] .staff-portal-container,
        .dark-theme .staff-portal-container {
          color: #F1F5F9;
        }

        body.theme-dark .tab-button-modern.inactive,
        [data-theme="dark"] .tab-button-modern.inactive,
        .dark-theme .tab-button-modern.inactive {
          background: #0F172A !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
        }

        body.theme-dark .tab-button-modern.inactive:hover,
        [data-theme="dark"] .tab-button-modern.inactive:hover,
        .dark-theme .tab-button-modern.inactive:hover {
          background: #1E293B !important;
          border-color: #38BDF8 !important;
          box-shadow: 0 6px 18px rgba(56, 189, 248, 0.15) !important;
        }

        body.theme-dark .tab-button-modern.inactive .tab-icon-wrapper,
        [data-theme="dark"] .tab-button-modern.inactive .tab-icon-wrapper,
        .dark-theme .tab-button-modern.inactive .tab-icon-wrapper {
          background: #1E293B !important;
          color: #38BDF8 !important;
        }

        body.theme-dark .tab-button-modern.inactive .tab-sub-text,
        [data-theme="dark"] .tab-button-modern.inactive .tab-sub-text,
        .dark-theme .tab-button-modern.inactive .tab-sub-text {
          color: #94A3B8 !important;
        }

        body.theme-dark .tab-button-modern.inactive .tab-count-badge,
        [data-theme="dark"] .tab-button-modern.inactive .tab-count-badge,
        .dark-theme .tab-button-modern.inactive .tab-count-badge {
          background: #1E293B !important;
          color: #38BDF8 !important;
          border: 1px solid #334155 !important;
        }

        body.theme-dark .staff-card-panel,
        [data-theme="dark"] .staff-card-panel,
        .dark-theme .staff-card-panel {
          background: #0F172A !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.5) !important;
        }

        body.theme-dark .staff-filter-input,
        [data-theme="dark"] .staff-filter-input,
        .dark-theme .staff-filter-input {
          background-color: #1E293B !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
        }
      `}</style>

      {/* 1. CLINICAL DARK-NAVY HERO BANNER */}
      <section className="staff-hero-banner-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", position: "relative", zIndex: 2 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(56, 189, 248, 0.35)", padding: "5px 14px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700, marginBottom: "12px", backdropFilter: "blur(8px)", color: "#38BDF8" }}>
              <Building2 size={14} color="#38BDF8" />
              <span>{hospitalBranding?.hospital_name || HOSPITAL_CONFIG.name} • {isHi ? "ओपीडी रिसेप्शन डेस्क" : "OPD Reception & Front Desk"}</span>
            </div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", color: "#FFFFFF" }}>
              {isHi ? "रिसेप्शन पोर्टल एवं कतार प्रबंधन" : "Reception Portal & Queue Orchestration"}
            </h1>
            <p style={{ margin: 0, color: "#94A3B8", fontSize: "14px", maxWidth: "620px", lineHeight: 1.55 }}>
              {isHi
                ? "मरीजों का तत्काल वॉक-इन पंजीकरण, अपॉइंटमेंट चेक-इन, लाउडस्पीकर उद्घोषणा एवं काउंटर डेस्क नियंत्रण।"
                : "Manage patient intake, verify scheduled appointments, trigger public loudspeaker announcements, and monitor clinician desks."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setLookupQuery("");
                setLookupResults([]);
                setShowLookupModal(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#FFFFFF",
                padding: "10px 18px",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                transition: "all 0.18s ease",
              }}
            >
              <Search size={16} />
              <span>{isHi ? "खोया टोकन खोजें" : "Lost Token Lookup"}</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Metric Badges */}
        <div className="staff-hero-kpi-grid">
          <div className="staff-kpi-card">
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#94A3B8" }}>{isHi ? "हॉल में प्रतीक्षारत" : "Waiting in Hall"}</div>
            <div style={{ fontSize: "26px", fontWeight: 900, marginTop: "2px", color: "#38BDF8" }}>{effectiveWaitingTickets.length}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>{isHi ? "लाइव मरीज कतार" : "Patients in OPD Queue"}</div>
          </div>

          <div className="staff-kpi-card">
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#94A3B8" }}>{isHi ? "आज के लाइव अपॉइंटमेंट्स" : "Live Booked Today"}</div>
            <div style={{ fontSize: "26px", fontWeight: 900, marginTop: "2px", color: "#FFFFFF" }}>{liveAppointments.length}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>{isHi ? "सक्रिय पूर्व-आरक्षित स्लॉट" : "Active Scheduled Bookings"}</div>
          </div>

          <div className="staff-kpi-card">
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#94A3B8" }}>{isHi ? "सक्रिय काउंटर डेस्क" : "Online Counters"}</div>
            <div style={{ fontSize: "26px", fontWeight: 900, marginTop: "2px", color: "#38BDF8" }}>
              {desksList.filter((d) => d.status === "AVAILABLE").length}/{desksList.length || 2}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>{isHi ? "उपलब्ध सेवा डेस्क" : "Operational Bays"}</div>
          </div>

          <div className="staff-kpi-card">
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#94A3B8" }}>{isHi ? "सक्रिय डॉक्टर" : "Active Clinicians"}</div>
            <div style={{ fontSize: "26px", fontWeight: 900, marginTop: "2px", color: "#FFFFFF" }}>
              {doctorsList.filter((d) => (d.status || "").toLowerCase() === "active").length || 1}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>{isHi ? "ड्यूटी पर तैनात" : "Doctors on OPD Duty"}</div>
          </div>
        </div>
      </section>

      {/* IN-LINE FEEDBACK & PA ANNOUNCEMENT BANNER */}
      {(feedbackMsg || announcementMsg) && (
        <div style={{
          padding: "12px 20px",
          borderRadius: "14px",
          background: announcementMsg
            ? (isDark ? "rgba(120, 53, 15, 0.3)" : "#FEF3C7")
            : inAppToast?.type === "error"
              ? (isDark ? "rgba(127, 29, 29, 0.35)" : "#FEF2F2")
              : inAppToast?.type === "warn"
                ? (isDark ? "rgba(120, 53, 15, 0.35)" : "#FFFBEB")
                : inAppToast?.type === "info"
                  ? (isDark ? "rgba(12, 74, 110, 0.35)" : "#F0F9FF")
                  : (isDark ? "rgba(6, 78, 59, 0.35)" : "#F0FDF4"),
          border: announcementMsg
            ? (isDark ? "1.5px solid #F59E0B" : "1.5px solid #FCD34D")
            : inAppToast?.type === "error"
              ? (isDark ? "1.5px solid #EF4444" : "1.5px solid #FECACA")
              : inAppToast?.type === "warn"
                ? (isDark ? "1.5px solid #F59E0B" : "1.5px solid #FDE68A")
                : inAppToast?.type === "info"
                  ? (isDark ? "1.5px solid #0284C7" : "1.5px solid #BAE6FD")
                  : (isDark ? "1.5px solid #10B981" : "1.5px solid #BBF7D0"),
          color: announcementMsg
            ? (isDark ? "#FDE68A" : "#92400E")
            : inAppToast?.type === "error"
              ? (isDark ? "#FCA5A5" : "#991B1B")
              : inAppToast?.type === "warn"
                ? (isDark ? "#FDE68A" : "#92400E")
                : inAppToast?.type === "info"
                  ? (isDark ? "#BAE6FD" : "#075985")
                  : (isDark ? "#A7F3D0" : "#166534"),
          fontWeight: 800,
          fontSize: "13.5px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {announcementMsg ? (
              <Volume2 size={18} />
            ) : inAppToast?.type === "error" ? (
              <AlertCircle size={18} />
            ) : inAppToast?.type === "warn" ? (
              <AlertTriangle size={18} />
            ) : inAppToast?.type === "info" ? (
              <Info size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span>{announcementMsg || feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setAnnouncementMsg("");
              setFeedbackMsg("");
              setInAppToast(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
              padding: "4px",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. STAFF IDENTITY & STATUS TOOLBAR */}
      <div className="staff-identity-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: isDark ? "rgba(2,132,199,0.2)" : "#E0F2FE",
            color: "#0284C7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <Users size={18} color="#0284C7" />
          </div>
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{currentUser?.name || currentUser?.username || (isHi ? "रिसेप्शन डेस्क" : "Reception Desk")}</span>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: isDark ? "#334155" : "#E2E8F0", color: isDark ? "#94A3B8" : "#64748B" }}>
                {currentUser?.employee_code || "RECEPTION-BAY-1"}
              </span>
            </div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#0284C7", display: "flex", alignItems: "center", gap: "6px", marginTop: "1px" }}>
              <span>🏥 {hospitalBranding?.hospital_name || HOSPITAL_CONFIG.name}</span>
              <span>•</span>
              <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>{isHi ? "ओपीडी रिसेप्शन एवं रोगी ट्राइएज" : "OPD Intake & Patient Triage"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 12px",
            borderRadius: "9999px",
            background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
            border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "#A7F3D0"}`,
            fontSize: "11.5px",
            fontWeight: 700,
            color: isDark ? "#34D399" : "#059669",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981" }} />
            <span>{isHi ? "डेस्क सक्रिय • इनटेक हेतु तैयार" : "Desk Active • Ready for Intake"}</span>
          </div>
        </div>
      </div>

      {/* 3. RECEPTION NAVIGATION TABS (MATCHING STAFFPAGE) */}
      <div className="staff-tabs-grid">
        {/* Tab 1: Fast Walk-In Intake */}
        <button
          type="button"
          onClick={() => setActiveTab("walkin")}
          className={`tab-button-modern ${activeTab === "walkin" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <PlusCircle size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
              <span className="tab-title-text">{isHi ? "वॉक-इन पंजीकरण" : "Walk-In Intake"}</span>
            </div>
            <span className="tab-sub-text">{isHi ? "तत्काल टोकन जारी करें" : "Fast Ticketing"}</span>
          </div>
        </button>

        {/* Tab 2: All Department Live Queues & Ticket Operations */}
        <button
          type="button"
          onClick={() => setActiveTab("all_queues")}
          className={`tab-button-modern ${activeTab === "all_queues" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <Activity size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
              <span className="tab-title-text">{isHi ? "सभी विभाग लाइव कतार एवं टिकट" : "All Dept Live Queues & Ticket"}</span>
              <span className="tab-count-badge" style={{ background: activeTab === "all_queues" ? "#FFFFFF" : "#0284C7", color: activeTab === "all_queues" ? "#0284C7" : "#FFFFFF" }}>
                {allActiveLiveTickets.length}
              </span>
            </div>
            <span className="tab-sub-text">{allActiveLiveTickets.length} {isHi ? "सक्रिय टिकट प्रबंधित करें" : "Live Active Tokens"}</span>
          </div>
        </button>

        {/* Tab 3: Appointments Check-In Terminal */}
        <button
          type="button"
          onClick={() => setActiveTab("checkin")}
          className={`tab-button-modern ${activeTab === "checkin" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <CalendarCheck size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
              <span className="tab-title-text">{isHi ? "अपॉइंटमेंट्स चेक-इन टर्मिनल" : "Appointments Check-In Terminal"}</span>
              <span className="tab-count-badge">{liveAppointments.length}</span>
            </div>
            <span className="tab-sub-text">{liveAppointments.length} {isHi ? "सक्रिय आरक्षित स्लॉट" : "Live Bookings"}</span>
          </div>
        </button>

        {/* Tab 4: Operational Service Counters */}
        <button
          type="button"
          onClick={() => setActiveTab("counters")}
          className={`tab-button-modern ${activeTab === "counters" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <LayoutGrid size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
              <span className="tab-title-text">{isHi ? "ऑपरेशनल सर्विस काउंटर" : "Operational Service Counters"}</span>
              <span className="tab-count-badge">{(desksList.length + filteredDoctorsList.length) || 0}</span>
            </div>
            <span className="tab-sub-text">{desksList.length} {isHi ? "डेस्क" : "Desks"} • {filteredDoctorsList.length} {isHi ? "डॉक्टर" : "Clinicians"}</span>
          </div>
        </button>
      </div>

      {/* 4. TAB 1: FRONT-DESK WALK-IN INTAKE */}
      {activeTab === "walkin" && (
        <div style={{
          display: "grid",
          gridTemplateColumns: createdWalkinTicket ? "1fr 1fr" : "1fr",
          gap: "24px",
        }}>
          {/* Intake Form */}
          <div style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "18px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            padding: "26px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#E0F2FE", color: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PlusCircle size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {isHi ? "वॉक-इन मरीज पंजीकरण डेस्क" : "Front-Desk Walk-In Registration"}
                </h2>
                <div style={{ fontSize: "12.5px", color: "#64748B" }}>
                  {isHi ? "आने वाले मरीज के विवरण दर्ज करें और तुरंत टोकन पास जारी करें।" : "Issue live queue boarding tickets for in-person arriving patients."}
                </div>
              </div>
            </div>

            {/* Fast Patient & Family Account Lookup Bar */}
            <div style={{
              background: isDark ? "#1E293B" : "#F0F9FF",
              border: isDark ? "1px solid #334155" : "1.5px solid #BAE6FD",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={16} color="#0284C7" />
                  <span style={{ fontSize: "13px", fontWeight: 800, color: isDark ? "#E0F2FE" : "#0369A1" }}>
                    {isHi ? "त्वरित पंजीकृत मरीज व परिवार खोज (Mobile / UHID)" : "Quick Registered Patient & Family Auto-Lookup"}
                  </span>
                </div>
                {patientLookupResult && (
                  <button
                    type="button"
                    onClick={handleClearLinkedPatient}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#DC2626",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <X size={14} />
                    <span>{isHi ? "अनलिंक / रीसेट" : "Unlink / Reset"}</span>
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search size={16} color="#64748B" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    placeholder={isHi ? "10-अंकों का मोबाइल नंबर या UHID दर्ज करें..." : "Enter 10-digit Mobile No., UHID, or Patient Email..."}
                    value={patientLookupQuery}
                    onChange={(e) => setPatientLookupQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLookupPatient();
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 36px",
                      borderRadius: "10px",
                      border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleLookupPatient()}
                  disabled={isSearchingPatient}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#0284C7",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: isSearchingPatient ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                  }}
                >
                  {isSearchingPatient ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  <span>{isSearchingPatient ? "Searching..." : isHi ? "पहचानें" : "Find Account"}</span>
                </button>
              </div>

              {/* Feedback Alert if any */}
              {lookupFeedback && (
                <div style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: lookupFeedback.type === "success"
                    ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5")
                    : lookupFeedback.type === "warn"
                      ? (isDark ? "rgba(239, 68, 68, 0.2)" : "#FEF2F2")
                      : (isDark ? "rgba(100, 116, 139, 0.2)" : "#F1F5F9"),
                  color: lookupFeedback.type === "success" ? "#10B981" : lookupFeedback.type === "warn" ? "#EF4444" : "#64748B",
                  border: `1px solid ${lookupFeedback.type === "success" ? "#A7F3D0" : lookupFeedback.type === "warn" ? "#FECACA" : "#E2E8F0"}`,
                }}>
                  <span>{lookupFeedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setLookupFeedback(null)}
                    style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Family Member Auto-Lookup & Selection Card */}
            {patientLookupResult && patientLookupResult.found && (
              <div style={{
                background: isDark ? "linear-gradient(135deg, #0F2942 0%, #0F172A 100%)" : "linear-gradient(135deg, #F0FDF4 0%, #E0F2FE 100%)",
                border: "2px solid #0284C7",
                borderRadius: "16px",
                padding: "18px",
                marginBottom: "22px",
                boxShadow: "0 6px 20px rgba(2, 132, 199, 0.12)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "#10B981",
                      color: "#FFFFFF",
                      fontSize: "11px",
                      fontWeight: 900,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      letterSpacing: "0.5px",
                    }}>
                      <ShieldCheck size={14} />
                      <span>{isHi ? "सत्यापित मरीज खाता" : "VERIFIED PATIENT ACCOUNT"}</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                      {patientLookupResult.account_holder.name}
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>
                      ({patientLookupResult.account_holder.phone || patientLookupResult.account_holder.email})
                    </span>
                  </div>

                  <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#0284C7", background: isDark ? "#1E293B" : "#FFFFFF", padding: "3px 8px", borderRadius: "6px", border: "1px solid #BAE6FD" }}>
                    {patientLookupResult.family_members?.length || 0} {isHi ? "परिवार के सदस्य" : "Family Members"}
                  </span>
                </div>

                <div style={{ fontSize: "12.5px", fontWeight: 700, color: isDark ? "#CBD5E1" : "#334155", marginBottom: "10px" }}>
                  {isHi ? "आज अस्पताल में उपस्थित मरीज चुनें (खाता धारक अथवा परिवार का सदस्य):" : "Select who is visiting the clinic today to link their visit & records:"}
                </div>

                {/* Profiles Grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: "10px",
                  marginBottom: "14px",
                }}>
                  {/* 1. Account Holder (Self) */}
                  <div
                    onClick={() => handleSelectProfile(patientLookupResult.account_holder)}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      cursor: "pointer",
                      border: selectedProfileId === "self" ? "2px solid #0284C7" : isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                      background: selectedProfileId === "self" ? (isDark ? "#1E293B" : "#FFFFFF") : isDark ? "#0F172A" : "#FFFFFF",
                      boxShadow: selectedProfileId === "self" ? "0 4px 12px rgba(2, 132, 199, 0.2)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "13.5px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                        {patientLookupResult.account_holder.name}
                      </strong>
                      {selectedProfileId === "self" ? (
                        <CheckCircle2 size={16} color="#0284C7" />
                      ) : (
                        <span style={{ fontSize: "10px", fontWeight: 800, color: "#0284C7", background: "#E0F2FE", padding: "2px 6px", borderRadius: "4px" }}>
                          SELF
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748B" }}>
                      Age: {patientLookupResult.account_holder.age} • {patientLookupResult.account_holder.gender}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#0284C7", fontWeight: 700, marginTop: "4px" }}>
                      ✓ Account Holder (Self)
                    </div>
                  </div>

                  {/* 2. Registered Family Members */}
                  {patientLookupResult.family_members?.map((fm) => {
                    const isSelected = selectedProfileId === fm.id;
                    return (
                      <div
                        key={fm.id}
                        onClick={() => handleSelectProfile(fm)}
                        style={{
                          padding: "12px",
                          borderRadius: "12px",
                          cursor: "pointer",
                          border: isSelected ? "2px solid #10B981" : isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                          background: isSelected ? (isDark ? "#1E293B" : "#FFFFFF") : isDark ? "#0F172A" : "#FFFFFF",
                          boxShadow: isSelected ? "0 4px 12px rgba(16, 185, 129, 0.2)" : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "13.5px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                            {fm.name}
                          </strong>
                          {isSelected ? (
                            <CheckCircle2 size={16} color="#10B981" />
                          ) : (
                            <span style={{ fontSize: "10px", fontWeight: 800, color: "#7C3AED", background: "#F5F3FF", padding: "2px 6px", borderRadius: "4px" }}>
                              {String(fm.relation || "Dependent").toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#64748B" }}>
                          Age: {fm.age} • {fm.gender}
                        </div>
                        <div style={{ fontSize: "10.5px", color: "#10B981", fontWeight: 700, marginTop: "4px" }}>
                          ✓ Relation: {fm.relation || "Family"}
                        </div>
                      </div>
                    );
                  })}

                  {/* 3. + Add Dependent Button */}
                  <div
                    onClick={() => setShowAddDependentForm(!showAddDependentForm)}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      cursor: "pointer",
                      border: "2px dashed #94A3B8",
                      background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(241, 245, 249, 0.6)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      color: "#64748B",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <UserPlus size={18} color="#0284C7" />
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#0284C7" }}>
                      {showAddDependentForm ? (isHi ? "फॉर्म बंद करें" : "Close Form") : isHi ? "+ नया सदस्य जोड़ें" : "+ Add Dependent"}
                    </span>
                    <span style={{ fontSize: "10.5px", color: "#94A3B8" }}>
                      {isHi ? "खाते में नया पारिवारिक मरीज" : "New family profile"}
                    </span>
                  </div>
                </div>

                {/* Inline Add Dependent Mini-Form */}
                {showAddDependentForm && (
                  <form
                    onSubmit={handleAddDependentSubmit}
                    style={{
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                      borderRadius: "12px",
                      padding: "14px",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ fontSize: "12.5px", fontWeight: 800, color: "#0284C7", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <UserPlus size={14} />
                      <span>{isHi ? "खाते में नया सदस्य पंजीकृत करें" : "Register New Dependent to this Account"}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.8fr 1fr", gap: "10px", marginBottom: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748B", marginBottom: "4px" }}>
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Sunita Verma"
                          value={newDependent.name}
                          onChange={(e) => setNewDependent({ ...newDependent, name: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            color: isDark ? "#F8FAFC" : "#0F172A",
                            fontSize: "12.5px",
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748B", marginBottom: "4px" }}>
                          Relationship *
                        </label>
                        <select
                          value={newDependent.relation}
                          onChange={(e) => setNewDependent({ ...newDependent, relation: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            color: isDark ? "#F8FAFC" : "#0F172A",
                            fontSize: "12.5px",
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        >
                          <option value="spouse">Spouse (पति/पत्नी)</option>
                          <option value="child">Child (बेटा/बेटी)</option>
                          <option value="mother">Mother (माता)</option>
                          <option value="father">Father (पिता)</option>
                          <option value="sibling">Sibling (भाई/बहन)</option>
                          <option value="other">Other Dependent</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748B", marginBottom: "4px" }}>
                          Age
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={newDependent.age}
                          onChange={(e) => setNewDependent({ ...newDependent, age: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            color: isDark ? "#F8FAFC" : "#0F172A",
                            fontSize: "12.5px",
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748B", marginBottom: "4px" }}>
                          Gender
                        </label>
                        <select
                          value={newDependent.gender}
                          onChange={(e) => setNewDependent({ ...newDependent, gender: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            color: isDark ? "#F8FAFC" : "#0F172A",
                            fontSize: "12.5px",
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        >
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setShowAddDependentForm(false)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                          background: "none",
                          color: "#64748B",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isAddingDependent}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#10B981",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: isAddingDependent ? "not-allowed" : "pointer",
                        }}
                      >
                        {isAddingDependent ? "Saving..." : "Save & Select for Visit"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Live Linked Confirmation Banner */}
                <div style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span style={{ fontSize: "12px", color: isDark ? "#A7F3D0" : "#065F46" }}>
                      <strong>{isHi ? "सक्रिय चयन: " : "Active Selection: "}</strong>
                      {walkinForm.name || "Patient"} {selectedProfileId && selectedProfileId !== "self" ? `(Family Dependent: ${patientLookupResult.family_members?.find(m => m.id === selectedProfileId)?.relation || "Family"})` : "(Account Owner)"} • {isHi ? "यह टिकट व पर्चा सीधे मरीज के मेडिकल इतिहास में दर्ज होगा।" : "This walk-in ticket will automatically be linked to their portal visit history."}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#10B981", background: "#FFFFFF", padding: "2px 8px", borderRadius: "10px" }}>
                    ✓ LINKED
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleWalkinSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B" }}>
                      {isHi ? "मरीज का पूरा नाम *" : "Patient Full Name *"}
                    </label>
                    {patientLookupResult && (
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#10B981", background: "#DCFCE7", padding: "2px 6px", borderRadius: "4px" }}>
                        ✓ Auto-filled
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={walkinForm.name}
                    onChange={(e) => setWalkinForm({ ...walkinForm, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B" }}>
                      {isHi ? "मोबाइल फोन नंबर *" : "Mobile Phone Number *"}
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {!patientLookupResult && walkinForm.phone && walkinForm.phone.replace(/\D/g, "").length >= 7 && (
                        <button
                          type="button"
                          disabled={isSearchingPatient}
                          onClick={() => handleLookupPatient(walkinForm.phone)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "2px 6px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: "#0284C7",
                            cursor: isSearchingPatient ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {isSearchingPatient ? (
                            <>
                              <RefreshCw size={12} className="animate-spin" />
                              <span>{isHi ? "जांच रहे हैं..." : "Checking..."}</span>
                            </>
                          ) : (
                            <>
                              <Search size={12} />
                              <span>{isHi ? "मोबाइल नंबर जांचें" : "Check Mobile No"}</span>
                            </>
                          )}
                        </button>
                      )}
                      {walkinForm.phone && walkinForm.phone.replace(/\D/g, "").length >= 7 && (
                        walkinOtpState.verified ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#10B981", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <CheckCircle2 size={13} /> {isHi ? "सत्यापित" : "Verified"}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={walkinOtpState.loading || otpCooldown > 0}
                            onClick={() => handleSendWalkinOtp(walkinForm.phone)}
                            style={{
                              background: otpCooldown > 0 ? (isDark ? "#334155" : "#E2E8F0") : (walkinOtpState.sent ? "#0284C7" : "#0284C715"),
                              color: otpCooldown > 0 ? (isDark ? "#94A3B8" : "#64748B") : (walkinOtpState.sent ? "#FFFFFF" : "#0284C7"),
                              border: otpCooldown > 0 ? "1px solid #CBD5E1" : "1px solid #0284C7",
                              padding: "3px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: (walkinOtpState.loading || otpCooldown > 0) ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {walkinOtpState.loading
                              ? (isHi ? "भेज रहा है..." : "Sending...")
                              : otpCooldown > 0
                                ? `⏳ ${isHi ? "पुनः भेजें" : "Resend in"} (${otpCooldown}s)`
                                : walkinOtpState.sent
                                  ? (isHi ? "✓ पुनः भेजें" : "✓ Resend OTP")
                                  : (isHi ? "📲 OTP भेजें" : "📲 Send OTP")}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder={isHi ? "उदा. 9876543210 (अनिवार्य)" : "e.g. +91 98765 43210 (Required)"}
                    value={walkinForm.phone}
                    onChange={(e) => {
                      setWalkinForm({ ...walkinForm, phone: e.target.value });
                      if (phoneLookupStatus) setPhoneLookupStatus(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: phoneLookupStatus === "not_registered"
                        ? "1.5px solid #EF4444"
                        : phoneLookupStatus === "registered"
                          ? "1.5px solid #10B981"
                          : (isDark ? "1px solid #334155" : "1.5px solid #CBD5E1"),
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />

                  {/* Warning banner when mobile number is not registered */}
                  {phoneLookupStatus === "not_registered" && (
                    <div style={{
                      marginTop: "6px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: isDark ? "rgba(239, 68, 68, 0.18)" : "#FEF2F2",
                      border: "1px solid #FECACA",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#DC2626",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}>
                      <span>⚠️</span>
                      <span>
                        {isHi
                          ? "यह मोबाइल नंबर डेटाबेस में पंजीकृत नहीं है। कृपया नए मरीज के रूप में विवरण दर्ज करें।"
                          : "This mobile number is not registered in the database. Please proceed as a new walk-in patient."}
                      </span>
                    </div>
                  )}

                  {/* Success confirmation when registered */}
                  {phoneLookupStatus === "registered" && patientLookupResult && (
                    <div style={{
                      marginTop: "6px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#059669",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}>
                      <span>✓</span>
                      <span>
                        {isHi
                          ? `पंजीकृत खाता मिल गया: ${patientLookupResult.account_holder?.name || ""}`
                          : `Registered account verified: ${patientLookupResult.account_holder?.name || ""}`}
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: "10.5px", color: "#0284C7", fontWeight: 600, marginTop: "3px" }}>
                    {isHi ? "अनिवार्य — भविष्य में डिजिटल टोकन व मेडिकल रिकॉर्ड सिंक करने हेतु" : "Required — Enables future digital pass & medical record syncing"}
                  </div>

                  {/* Inline OTP Verification Card for Walk-In Registration */}
                  {walkinOtpState.sent && !walkinOtpState.verified && (
                    <div style={{
                      marginTop: "8px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: isDark ? "rgba(2, 132, 199, 0.12)" : "#F0F9FF",
                      border: "1px solid #38BDF8",
                    }}>
                      <div style={{ marginBottom: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369A1" }}>
                          📲 {isHi
                            ? "मरीज के मोबाइल पर SMS भेजा गया। मरीज से 6-अंकीय OTP पूछें:"
                            : "SMS sent to patient's mobile. Ask patient for the 6-digit verification code:"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder={isHi ? "मरीज से OTP पूछकर दर्ज करें" : "Enter 6-digit OTP from patient"}
                          value={enteredWalkinOtp}
                          onChange={(e) => setEnteredWalkinOtp(e.target.value.replace(/\D/g, ""))}
                          style={{
                            width: "160px",
                            padding: "7px 10px",
                            borderRadius: "8px",
                            border: "1.5px solid #38BDF8",
                            fontSize: "13px",
                            fontWeight: 800,
                            letterSpacing: "2px",
                            textAlign: "center",
                            background: isDark ? "#0F172A" : "#FFFFFF",
                            color: isDark ? "#F8FAFC" : "#0F172A",
                            outline: "none",
                          }}
                        />
                        <button
                          type="button"
                          disabled={isVerifyingWalkinOtp || !enteredWalkinOtp || enteredWalkinOtp.length < 4}
                          onClick={() => handleVerifyWalkinOtp(enteredWalkinOtp)}
                          style={{
                            flex: 1,
                            padding: "7px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: (isVerifyingWalkinOtp || !enteredWalkinOtp || enteredWalkinOtp.length < 4) ? "#94A3B8" : "#10B981",
                            color: "#FFFFFF",
                            fontSize: "12px",
                            fontWeight: 800,
                            cursor: (isVerifyingWalkinOtp || !enteredWalkinOtp || enteredWalkinOtp.length < 4) ? "not-allowed" : "pointer",
                          }}
                        >
                          {isVerifyingWalkinOtp
                            ? (isHi ? "सत्यापित कर रहा है..." : "Verifying...")
                            : (isHi ? "✓ सत्यापित करें व लिंक करें" : "✓ Verify & Link Account")}
                        </button>
                      </div>
                    </div>
                  )}

                  {walkinOtpState.verified && (
                    <div style={{
                      marginTop: "6px",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#10B981",
                    }}>
                      <CheckCircle2 size={13} />
                      <span>{isHi ? "मरीज फोन सत्यापित! खाता लिंक हो गया।" : "Phone Verified! Patient account linked."}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B", marginBottom: "6px" }}>
                    {isHi ? "उम्र (वर्ष)" : "Age"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={walkinForm.age}
                    onChange={(e) => setWalkinForm({ ...walkinForm, age: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B", marginBottom: "6px" }}>
                    {isHi ? "लिंग" : "Gender"}
                  </label>
                  <select
                    value={walkinForm.gender}
                    onChange={(e) => setWalkinForm({ ...walkinForm, gender: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B", marginBottom: "6px" }}>
                    {isHi ? "ओपीडी विभाग" : "Department"}
                  </label>
                  <select
                    value={walkinForm.department}
                    onChange={(e) => setWalkinForm({ ...walkinForm, department: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  >
                    {departments.map((d) => (
                      <option key={d.dept_code} value={d.dept_code}>
                        {d.name}
                      </option>
                    ))}
                    {departments.length === 0 && <option value="consultation">General OPD</option>}
                  </select>
                </div>
              </div>

              {/* Patient Symptoms & Disease Reason Section */}
              <div
                style={{
                  marginBottom: "16px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                  background: isDark ? "rgba(30, 41, 59, 0.45)" : "#F8FAFC",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Activity size={15} color="#0284C7" />
                    <label style={{ fontSize: "12.5px", fontWeight: 700, color: isDark ? "#E2E8F0" : "#334155" }}>
                      {isHi ? "मरीज के लक्षण / बीमारी का कारण *" : "Patient Symptoms & Clinical Reason *"}
                    </label>
                  </div>
                  <span style={{ fontSize: "11px", color: isDark ? "#94A3B8" : "#64748B" }}>
                    {isHi ? "डॉक्टर पर्चे व टोकन पर प्रिंट होगा" : "Included on queue ticket & doctor desk"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.9fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", marginBottom: "4px" }}>
                      {isHi ? "लक्षण श्रेणी (Category)" : "Primary Category"}
                    </label>
                    <select
                      value={walkinForm.symptoms || "general_checkup"}
                      onChange={(e) => {
                        const val = e.target.value;
                        const opt = SYMPTOM_OPTIONS.find((s) => s.id === val);
                        setWalkinForm({
                          ...walkinForm,
                          symptoms: val,
                          custom_symptom: !walkinForm.custom_symptom ? (opt ? (isHi ? opt.labelHi : opt.label) : "") : walkinForm.custom_symptom,
                          ...(val === "chest_pain_severe" || val === "breathing_difficulty" ? { priority: 1 } : {}),
                        });
                      }}
                      style={{
                        width: "100%",
                        padding: "9px 11px",
                        borderRadius: "8px",
                        border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                        background: isDark ? "#1E293B" : "#FFFFFF",
                        color: isDark ? "#F8FAFC" : "#0F172A",
                        fontSize: "13px",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    >
                      {SYMPTOM_OPTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {isHi ? s.labelHi : s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#64748B", marginBottom: "4px" }}>
                      {isHi ? "मरीज द्वारा बताई गई बीमारी का विवरण (Patient Complaint)" : "Patient Complaint / Disease Details"}
                    </label>
                    <input
                      type="text"
                      placeholder={isHi ? "उदा. 2 दिन से तेज बुखार, पेट में दर्द, खांसी..." : "e.g. High fever for 2 days, acute abdomen pain, cough with phlegm..."}
                      value={walkinForm.custom_symptom}
                      onChange={(e) => setWalkinForm({ ...walkinForm, custom_symptom: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 11px",
                        borderRadius: "8px",
                        border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                        background: isDark ? "#1E293B" : "#FFFFFF",
                        color: isDark ? "#F8FAFC" : "#0F172A",
                        fontSize: "13px",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Quick Symptom Chips */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
                    {isHi ? "त्वरित लक्षण चयन (Quick Tap Chips):" : "Quick Tap Common Symptoms:"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {[
                      { id: "fever_flu", label: "🤒 " + (isHi ? "तेज़ बुखार" : "High Fever"), text: isHi ? "तेज़ बुखार और कंपकंपी" : "High fever and viral flu" },
                      { id: "cough_cold", label: "🤧 " + (isHi ? "खांसी-जुकाम" : "Cough & Cold"), text: isHi ? "खांसी, जुकाम और गले में खराश" : "Severe cough and cold" },
                      { id: "stomach_pain", label: "🤢 " + (isHi ? "पेट दर्द / उल्टी" : "Stomach Pain"), text: isHi ? "पेट में तेज दर्द एवं उल्टी" : "Acute stomach pain and nausea" },
                      { id: "chest_pain_severe", label: "❤️ " + (isHi ? "सीने में दर्द (🚨 अर्जेंट)" : "Chest Pain (🚨 Urgent)"), text: isHi ? "सीने में गंभीर दर्द व बेचैनी" : "Severe chest pain and discomfort", emergency: true },
                      { id: "breathing_difficulty", label: "🫁 " + (isHi ? "सांस में तकलीफ (🚨)" : "Breathlessness (🚨)"), text: isHi ? "सांस लेने में गंभीर तकलीफ" : "Shortness of breath / asthma attack", emergency: true },
                      { id: "headache_migraine", label: "🤕 " + (isHi ? "सिरदर्द" : "Severe Headache"), text: isHi ? "गंभीर सिरदर्द एवं चक्कर" : "Severe headache and dizziness" },
                      { id: "ortho_joint_pain", label: "🦴 " + (isHi ? "जोड़ों / कमर दर्द" : "Joint / Back Pain"), text: isHi ? "कमर एवं जोड़ों में दर्द" : "Joint stiffness and back pain" },
                      { id: "fracture_trauma", label: "🩹 " + (isHi ? "चोट / घाव" : "Injury & Trauma"), text: isHi ? "हादसा, चोट या शारीरिक मोच" : "Physical injury or trauma" },
                      { id: "general_checkup", label: "🩺 " + (isHi ? "सामान्य जांच" : "Routine Checkup"), text: isHi ? "सामान्य परामर्श एवं नियमित स्वास्थ्य जांच" : "Routine OPD checkup and consultation" },
                    ].map((chip) => {
                      const isSelected = walkinForm.symptoms === chip.id || walkinForm.custom_symptom === chip.text;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            setWalkinForm({
                              ...walkinForm,
                              symptoms: chip.id,
                              custom_symptom: chip.text,
                              ...(chip.emergency ? { priority: 1 } : {}),
                            });
                          }}
                          style={{
                            padding: "4px 9px",
                            borderRadius: "6px",
                            border: isSelected
                              ? (chip.emergency ? "1px solid #DC2626" : "1px solid #0284C7")
                              : (isDark ? "1px solid #334155" : "1.5px solid #CBD5E1"),
                            background: isSelected
                              ? (chip.emergency ? (isDark ? "rgba(220, 38, 38, 0.2)" : "#FEE2E2") : (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"))
                              : (isDark ? "#1E293B" : "#FFFFFF"),
                            color: isSelected
                              ? (chip.emergency ? "#DC2626" : "#0284C7")
                              : (isDark ? "#CBD5E1" : "#475569"),
                            fontSize: "11px",
                            fontWeight: isSelected ? 700 : 500,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Triage Urgency Priority Selector */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B", marginBottom: "8px" }}>
                  {isHi ? "ट्रायज प्राथमिकता स्तर *" : "Triage Urgency Level *"}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setWalkinForm({ ...walkinForm, priority: 2 })}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: walkinForm.priority === 2 ? "2px solid #0284C7" : isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                      background: walkinForm.priority === 2 ? (isDark ? "#1E293B" : "#F0F9FF") : isDark ? "#0F172A" : "#FFFFFF",
                      color: walkinForm.priority === 2 ? "#0284C7" : "#64748B",
                      fontWeight: 800,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: "13.5px" }}>🟢 {isHi ? "सामान्य (Routine)" : "Routine Case"}</div>
                    <div style={{ fontSize: "11px", fontWeight: 500, marginTop: "2px" }}>Standard queue arrival order</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWalkinForm({ ...walkinForm, priority: 1 })}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: walkinForm.priority === 1 ? "2px solid #DC2626" : isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                      background: walkinForm.priority === 1 ? "#FEF2F2" : isDark ? "#0F172A" : "#FFFFFF",
                      color: walkinForm.priority === 1 ? "#DC2626" : "#64748B",
                      fontWeight: 800,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: "13.5px" }}>🚨 {isHi ? "आपातकालीन (Emergency)" : "Emergency Triage"}</div>
                    <div style={{ fontSize: "11px", fontWeight: 500, marginTop: "2px" }}>Immediate queue jump for critical care</div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingWalkin}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "12px",
                  border: "none",
                  background: walkinForm.priority === 1 ? "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)" : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: isSubmittingWalkin ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)",
                }}
              >
                {isSubmittingWalkin ? "Generating Token..." : isHi ? "टोकन पास जारी करें" : "Generate & Print Token Pass"}
              </button>
            </form>
          </div>

          {/* Generated Token Pass Preview Card */}
          {createdWalkinTicket && (
            <div style={{
              background: isDark ? "#0F172A" : "#FFFFFF",
              borderRadius: "18px",
              border: "2px solid #0284C7",
              padding: "24px",
              boxShadow: "0 8px 30px rgba(2, 132, 199, 0.12)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#0284C7", background: "#E0F2FE", padding: "3px 8px", borderRadius: "6px" }}>
                      New Token Issued
                    </span>
                    <h3 style={{ margin: "6px 0 0 0", fontSize: "28px", fontWeight: 900, color: "#0284C7" }}>
                      #{createdWalkinTicket.ticket_id}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreatedWalkinTicket(null)}
                    style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", padding: "14px", borderRadius: "12px", marginBottom: "16px", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#64748B", fontSize: "12px" }}>Patient:</span>
                    <strong style={{ color: isDark ? "#F8FAFC" : "#0F172A" }}>{createdWalkinTicket.name}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#64748B", fontSize: "12px" }}>Department:</span>
                    <strong style={{ color: "#0284C7" }}>{getCategoryLabel(createdWalkinTicket.service_category, language)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "#64748B", fontSize: "12px" }}>Position in Line:</span>
                    <strong style={{ color: "#16A34A" }}>#{createdWalkinTicket.position || 1}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B", fontSize: "12px" }}>Estimated Wait:</span>
                    <strong style={{ color: "#D97706" }}>~{createdWalkinTicket.estimated_wait_minutes || 10} mins</strong>
                  </div>

                  {createdWalkinTicket.linkedAccountName && (
                    <div style={{
                      marginTop: "10px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                      border: "1px solid #A7F3D0",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 800, color: "#10B981" }}>
                        <CheckCircle2 size={13} />
                        <span>{isHi ? "खाते से लिंक किया गया" : "Linked to Registered Account"}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: isDark ? "#E2E8F0" : "#334155", marginTop: "2px" }}>
                        Account: <strong>{createdWalkinTicket.linkedAccountName}</strong>
                        {createdWalkinTicket.isFamilyMember ? ` (Family: ${createdWalkinTicket.profileRelation || "Dependent"})` : " (Primary Self)"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#059669", marginTop: "2px" }}>
                        ✓ Added to patient's personal visit & prescription history
                      </div>
                    </div>
                  )}

                  {/* Walk-In OTP Dispatched & Instant Activation Badge */}
                  {createdWalkinTicket.otp_info?.sent && (
                    <div style={{
                      marginTop: "10px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF",
                      border: "1.5px solid #38BDF8",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 800, color: "#0284C7" }}>
                          <span>📲 {isHi ? "मरीज मोबाइल सत्यापन OTP" : "Patient Mobile Verification OTP"}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: isDark ? "#CBD5E1" : "#475569", marginBottom: "8px" }}>
                        {isHi
                          ? `OTP +91 ${createdWalkinTicket.otp_info.phone} पर SMS द्वारा भेजा गया। मरीज से 6-अंकीय कोड पूछकर दर्ज करें:`
                          : `SMS OTP sent to +91 ${createdWalkinTicket.otp_info.phone}. Ask patient for the 6-digit code to activate account:`}
                      </div>

                      {!walkinOtpState.verified && (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder={isHi ? "मरीज से OTP पूछकर दर्ज करें" : "Enter OTP from patient"}
                            value={enteredWalkinOtp}
                            onChange={(e) => setEnteredWalkinOtp(e.target.value.replace(/\D/g, ""))}
                            style={{
                              width: "160px",
                              padding: "7px 10px",
                              borderRadius: "6px",
                              border: "1.5px solid #38BDF8",
                              fontSize: "13px",
                              fontWeight: 800,
                              letterSpacing: "2px",
                              textAlign: "center",
                              background: isDark ? "#0F172A" : "#FFFFFF",
                              color: isDark ? "#F8FAFC" : "#0F172A",
                              outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleVerifyWalkinOtp(enteredWalkinOtp)}
                            disabled={isVerifyingWalkinOtp || !enteredWalkinOtp || enteredWalkinOtp.length < 4}
                            style={{
                              flex: 1,
                              padding: "7px 10px",
                              borderRadius: "6px",
                              border: "none",
                              background: (isVerifyingWalkinOtp || !enteredWalkinOtp || enteredWalkinOtp.length < 4) ? "#94A3B8" : "#10B981",
                              color: "#FFFFFF",
                              fontSize: "11.5px",
                              fontWeight: 800,
                              cursor: (isVerifyingWalkinOtp || !enteredWalkinOtp || enteredWalkinOtp.length < 4) ? "not-allowed" : "pointer",
                            }}
                          >
                            {isVerifyingWalkinOtp ? "Verifying..." : "⚡ Activate Patient Account Now"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {walkinOtpState.verified && (
                    <div style={{
                      marginTop: "10px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      color: "#10B981",
                    }}>
                      <CheckCircle2 size={13} />
                      <span>{isHi ? "✓ मरीज खाता सत्यापित व सभी पुराने रिकॉर्ड सिंक हो गए!" : "✓ Patient Account Activated & All Historical Records Synced!"}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => printTokenPass(createdWalkinTicket, null, language, hospitalBranding)}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: "10px",
                    border: "1.5px solid #0284C7",
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    color: "#0284C7",
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Printer size={16} />
                  <span>{isHi ? "पर्ची प्रिंट करें" : "Print Pass Slip"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAnnounceTicket(createdWalkinTicket)}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Volume2 size={16} />
                  <span>{isHi ? "लाउडस्पीकर कॉल" : "PA Announce"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 3: ALL DEPARTMENT LIVE QUEUE COMMAND & TICKET OPERATIONS */}
      {activeTab === "all_queues" && (
        <div style={{
          background: isDark ? "#0F172A" : "#FFFFFF",
          borderRadius: "18px",
          border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
          padding: "24px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        }}>
          {/* Header & Live Actions Bar */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "21px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                {isHi ? "सभी विभाग लाइव कतार एवं टिकट नियंत्रण" : "All Department Live Queues & Ticket Operations"}
              </h2>
              <span style={{
                fontSize: "11px",
                fontWeight: 800,
                padding: "3px 9px",
                borderRadius: "9999px",
                background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                color: "#0284C7",
                border: "1px solid #BAE6FD",
              }}>
                {allActiveLiveTickets.length} {isHi ? "कुल सक्रिय टोकन" : "Total Active Tokens"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748B" }}>
              {isHi
                ? "सभी ओपीडी विभागों की लाइव कतार का वास्तविक समय में नियंत्रण: टिकट रद्द करें, विभाग बदलें (स्थानांतरित), ओपीडी को आपातकालीन (Emergency) में अपग्रेड करें, लाउडस्पीकर उद्घोषणा और होल्ड प्रबंधन।"
                : "Central multi-department queue control: cancel tickets, transfer across departments, elevate OPD to Emergency (P1), hold/recall, and trigger loudspeaker announcements."}
            </p>
          </div>

          {/* Quick KPI Stats Summary Bar */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}>
            <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "#1E293B" : "#F0F9FF", border: `1px solid ${isDark ? "#334155" : "#BAE6FD"}` }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#0284C7", textTransform: "uppercase" }}>
                {isHi ? "कतार में प्रतीक्षारत" : "Waiting in Queue"}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "2px" }}>
                {allActiveLiveTickets.filter((t) => t.status === "waiting").length}
              </div>
              <div style={{ fontSize: "10.5px", color: "#64748B" }}>{isHi ? "परामर्श की प्रतीक्षा" : "Awaiting Clinician"}</div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "rgba(16, 185, 129, 0.1)" : "#ECFDF5", border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "#A7F3D0"}` }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>
                {isHi ? "परामर्श जारी (Serving)" : "In Consultation"}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#10B981", marginTop: "2px" }}>
                {allActiveLiveTickets.filter((t) => t.status === "serving").length}
              </div>
              <div style={{ fontSize: "10.5px", color: "#64748B" }}>{isHi ? "डॉक्टर के साथ सक्रिय" : "Inside Doctor Cabin"}</div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "rgba(220, 38, 38, 0.1)" : "#FEF2F2", border: `1px solid ${isDark ? "rgba(220, 38, 38, 0.3)" : "#FECACA"}` }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#DC2626", textTransform: "uppercase" }}>
                {isHi ? "आपातकालीन ट्राइएज" : "Emergency Priority"}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#DC2626", marginTop: "2px" }}>
                {allActiveLiveTickets.filter((t) => Number(t.priority_level || t.priority || 2) === 1).length}
              </div>
              <div style={{ fontSize: "10.5px", color: "#64748B" }}>{isHi ? "कतार में सर्वोच्च प्राथमिकता" : "Immediate Front of Line"}</div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: "12px", background: isDark ? "rgba(245, 158, 11, 0.1)" : "#FFFBEB", border: `1px solid ${isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A"}` }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#D97706", textTransform: "uppercase" }}>
                {isHi ? "होल्ड पर (On Hold)" : "On Hold / Lab"}
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#D97706", marginTop: "2px" }}>
                {allActiveLiveTickets.filter((t) => t.status === "on_hold" || t.status === "hold").length}
              </div>
              <div style={{ fontSize: "10.5px", color: "#64748B" }}>{isHi ? "जांच / रिपोर्ट की प्रतीक्षा" : "Awaiting Lab/Recall"}</div>
            </div>
          </div>

          {/* Department Filter Tabs (Horizontal Pill Selector) */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Building2 size={13} />
              <span>{isHi ? "विभाग अनुसार फ़िल्टर करें:" : "Filter By Department:"}</span>
            </div>
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setAllQueuesFilterDept("all")}
                style={{
                  padding: "7px 14px",
                  borderRadius: "10px",
                  border: allQueuesFilterDept === "all" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                  background: allQueuesFilterDept === "all" ? (isDark ? "#1E293B" : "#F0F9FF") : isDark ? "#0F172A" : "#FFFFFF",
                  color: allQueuesFilterDept === "all" ? "#0284C7" : isDark ? "#F8FAFC" : "#475569",
                  fontWeight: 800,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{isHi ? "सभी विभाग" : "All Departments"}</span>
                <span style={{
                  padding: "1px 6px",
                  borderRadius: "999px",
                  fontSize: "10.5px",
                  fontWeight: 900,
                  background: allQueuesFilterDept === "all" ? "#0284C7" : isDark ? "#334155" : "#E2E8F0",
                  color: allQueuesFilterDept === "all" ? "#FFFFFF" : isDark ? "#CBD5E1" : "#64748B",
                }}>
                  {allQueuesDeptCounts.all || 0}
                </span>
              </button>

              {departments.map((d) => {
                const isSelected = allQueuesFilterDept.toLowerCase() === (d.dept_code || "").toLowerCase();
                const count = allQueuesDeptCounts[(d.dept_code || "").toLowerCase()] || 0;
                return (
                  <button
                    key={d.dept_code}
                    type="button"
                    onClick={() => setAllQueuesFilterDept(d.dept_code)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "10px",
                      border: isSelected ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                      background: isSelected ? (isDark ? "#1E293B" : "#F0F9FF") : isDark ? "#0F172A" : "#FFFFFF",
                      color: isSelected ? "#0284C7" : isDark ? "#F8FAFC" : "#475569",
                      fontWeight: 700,
                      fontSize: "12.5px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{d.name}</span>
                    <span style={{
                      padding: "1px 6px",
                      borderRadius: "999px",
                      fontSize: "10.5px",
                      fontWeight: 900,
                      background: isSelected ? "#0284C7" : count > 0 ? (isDark ? "#334155" : "#E0F2FE") : isDark ? "#1E293B" : "#F1F5F9",
                      color: isSelected ? "#FFFFFF" : count > 0 ? "#0284C7" : "#94A3B8",
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secondary Filter & Search Bar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
            padding: "14px",
            background: isDark ? "#1E293B" : "#F8FAFC",
            borderRadius: "14px",
            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
          }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", flex: 1 }}>
              {/* Search Box */}
              <div style={{ position: "relative", minWidth: "240px", flex: 1 }}>
                <input
                  type="text"
                  placeholder={isHi ? "नाम, फोन, टोकन आईडी या डॉक्टर खोजें..." : "Search patient name, phone, token ID, doctor..."}
                  value={allQueuesSearchQuery}
                  onChange={(e) => setAllQueuesSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 34px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    fontSize: "12.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                {allQueuesSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAllQueuesSearchQuery("")}
                    style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "12px" }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Dropdown */}
              <select
                value={allQueuesFilterStatus}
                onChange={(e) => setAllQueuesFilterStatus(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                  background: isDark ? "#0F172A" : "#FFFFFF",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                <option value="all">{isHi ? "सभी स्थितियां (All Statuses)" : "All Statuses"}</option>
                <option value="waiting">{isHi ? "केवल प्रतीक्षारत (Waiting Only)" : "Waiting in Queue"}</option>
                <option value="serving">{isHi ? "परामर्श जारी (Serving Only)" : "In Consultation (Serving)"}</option>
                <option value="on_hold">{isHi ? "होल्ड पर (On Hold)" : "On Hold / Paused"}</option>
              </select>

              {/* Priority Filter Dropdown */}
              <select
                value={allQueuesFilterPriority}
                onChange={(e) => setAllQueuesFilterPriority(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                  background: isDark ? "#0F172A" : "#FFFFFF",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                <option value="all">{isHi ? "सभी प्राथमिकता (All Triage)" : "All Triage Priorities"}</option>
                <option value="1">🚨 {isHi ? "केवल आपातकालीन (Emergency P1)" : "Emergency Priority (P1)"}</option>
                <option value="2">🟢 {isHi ? "सामान्य ओपीडी (Routine P2)" : "Routine OPD (P2)"}</option>
              </select>
            </div>

            <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B" }}>
              {isHi ? `दिखाए जा रहे हैं: ${filteredAllQueues.length} टोकन` : `Showing ${filteredAllQueues.length} of ${allActiveLiveTickets.length} tokens`}
            </div>
          </div>

          {/* Multi-Department Queue Live Table */}
          {filteredAllQueues.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", background: isDark ? "#1E293B" : "#F8FAFC", borderRadius: "14px", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
              <Activity size={40} color="#94A3B8" style={{ marginBottom: "10px" }} />
              <div style={{ fontWeight: 800, fontSize: "16px", color: isDark ? "#F8FAFC" : "#334155" }}>
                {isHi ? "कोई सक्रिय कतार टोकन नहीं मिला" : "No Active Queue Tickets Found"}
              </div>
              <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
                {allQueuesSearchQuery || allQueuesFilterDept !== "all" || allQueuesFilterStatus !== "all" || allQueuesFilterPriority !== "all"
                  ? (isHi ? "फ़िल्टर साफ़ करें या अन्य विभाग का चयन करें।" : "Try clearing your search or changing the selected filters.")
                  : (isHi ? "अस्पताल के सभी विभागों में कतार खाली है।" : "All hospital departments are currently clear.")}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr style={{
                    background: isDark ? "#1E293B" : "#F1F5F9",
                    borderBottom: `2px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                    color: "#64748B",
                    fontWeight: 800,
                  }}>
                    <th style={{ padding: "12px 14px" }}># Pos / Status</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "टोकन व ट्राइएज" : "Token & Triage"}</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "मरीज का विवरण" : "Patient Profile"}</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "विभाग" : "Department"}</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "डॉक्टर / डेस्क" : "Clinician / Desk"}</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "प्रतीक्षा" : "Wait Time"}</th>
                    <th style={{ padding: "12px 14px", textAlign: "right" }}>{isHi ? "नियंत्रण व कार्रवाइयां" : "Operational Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllQueues.map((tkt, idx) => {
                    const isEmergency = Number(tkt.priority_level || tkt.priority || 2) === 1;
                    const isServing = tkt.status === "serving";
                    const isOnHold = tkt.status === "on_hold" || tkt.status === "hold";
                    const isWaiting = tkt.status === "waiting";

                    return (
                      <tr
                        key={tkt.ticket_id}
                        style={{
                          borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                          background: isEmergency
                            ? (isDark ? "rgba(220,38,38,0.12)" : "#FFF1F2")
                            : isServing
                              ? (isDark ? "rgba(16,185,129,0.08)" : "#F0FDF4")
                              : isOnHold
                                ? (isDark ? "rgba(245,158,11,0.08)" : "#FFFBEB")
                                : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        {/* Position & Status Badge */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 900, color: "#64748B", fontSize: "14px", minWidth: "22px" }}>
                              #{tkt.position || (idx + 1)}
                            </span>
                            {isServing ? (
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: "#DCFCE7",
                                color: "#15803D",
                                fontSize: "11px",
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16A34A" }} />
                                <span>Serving</span>
                              </span>
                            ) : isOnHold ? (
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: "#FEF3C7",
                                color: "#B45309",
                                fontSize: "11px",
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}>
                                <PauseCircle size={11} />
                                <span>On Hold</span>
                              </span>
                            ) : (
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: "#E0F2FE",
                                color: "#0284C7",
                                fontSize: "11px",
                                fontWeight: 800,
                              }}>
                                Waiting
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Token ID & Triage Priority */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span style={{ fontWeight: 900, fontSize: "14px", color: isEmergency ? "#DC2626" : "#0284C7" }}>
                              #{tkt.ticket_id}
                            </span>
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                              {isEmergency ? (
                                <span style={{ background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 800 }}>
                                  🚨 Emergency (P1)
                                </span>
                              ) : (
                                <span style={{ background: isDark ? "#1E293B" : "#F1F5F9", color: "#64748B", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
                                  🟢 Routine (P2)
                                </span>
                              )}
                              {tkt.appointment_id && (
                                <span style={{ background: "#EDE9FE", color: "#6D28D9", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
                                  Appt
                                </span>
                              )}
                              {tkt.transferred_from_dept && (
                                <span style={{ background: "#FEF9C3", color: "#854D0E", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
                                  Transferred
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Patient Profile Details */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A", fontSize: "13.5px" }}>
                            {tkt.name}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "#64748B", display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                            <span>{tkt.age || 30} yrs • {tkt.gender || "Patient"}</span>
                            {tkt.phone && <span>• 📞 {tkt.phone}</span>}
                          </div>
                          {tkt.medical_condition && tkt.medical_condition !== "general_checkup" && (
                            <div style={{ fontSize: "10.5px", color: "#0284C7", marginTop: "2px", fontWeight: 600 }}>
                              Reason: {formatCleanText(tkt.medical_condition)}
                            </div>
                          )}
                        </td>

                        {/* Department Name */}
                        <td style={{ padding: "14px" }}>
                          <span style={{
                            background: isDark ? "#1E293B" : "#F0F9FF",
                            border: `1px solid ${isDark ? "#334155" : "#BAE6FD"}`,
                            color: "#0284C7",
                            padding: "4px 9px",
                            borderRadius: "7px",
                            fontSize: "12px",
                            fontWeight: 800,
                            display: "inline-block",
                          }}>
                            {getCategoryLabel(tkt.service_category, language)}
                          </span>
                          {tkt.transferred_from_dept && (
                            <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
                              From: {getCategoryLabel(tkt.transferred_from_dept, language)}
                            </div>
                          )}
                        </td>

                        {/* Doctor / Assigned Desk */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ fontWeight: 700, color: isDark ? "#F8FAFC" : "#334155", fontSize: "12.5px" }}>
                            {tkt.served_by_doctor_name || tkt.doctor_name ? `Dr. ${String(tkt.served_by_doctor_name || tkt.doctor_name).replace(/^Dr\.?\s*/i, "")}` : (isHi ? "कतार में प्रतीक्षारत" : "In Department Queue")}
                          </div>
                          {tkt.desk_id && (
                            <div style={{ fontSize: "11px", color: "#059669", fontWeight: 700, marginTop: "1px" }}>
                              Desk #{tkt.desk_id}
                            </div>
                          )}
                        </td>

                        {/* Estimated Wait / Time */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ color: "#D97706", fontWeight: 800, fontSize: "13px" }}>
                            ~{tkt.estimated_wait_minutes || 5} mins
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#94A3B8" }}>
                            Est. Turnaround
                          </div>
                        </td>

                        {/* Operational Actions Suite */}
                        <td style={{ padding: "14px", textAlign: "right" }}>
                          {isServing ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                              <span style={{
                                padding: "5px 12px",
                                borderRadius: "999px",
                                background: isDark ? "rgba(16, 185, 129, 0.15)" : "#DCFCE7",
                                border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1.5px solid #BBF7D0",
                                color: isDark ? "#34D399" : "#15803D",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                              }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16A34A" }} />
                                <span>{isHi ? "परामर्श जारी • लॉक" : "In Consultation • Locked"}</span>
                              </span>

                              {/* View Full Details (Read-only) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailModalTicket(tkt);
                                  setShowDetailModal(true);
                                }}
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: "8px",
                                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                  background: isDark ? "#1E293B" : "#F8FAFC",
                                  color: isDark ? "#F8FAFC" : "#64748B",
                                  fontSize: "11.5px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                                title="View Patient & Clinical Details"
                              >
                                <Info size={13} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                              {/* 1. Transfer Department */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferModalTicket(tkt);
                                  const otherDepts = departments.filter((d) => (d.dept_code || "").toLowerCase() !== (tkt.service_category || "").toLowerCase());
                                  setTransferTargetDept(otherDepts[0]?.dept_code || "consultation");
                                  setTransferNotes("");
                                  setShowTransferModal(true);
                                }}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                                  background: isDark ? "#1E293B" : "#FFFFFF",
                                  color: "#0284C7",
                                  fontSize: "11.5px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title={isHi ? "अन्य विभाग में स्थानांतरित करें" : "Transfer to Another Department"}
                              >
                                <ArrowRightLeft size={13} />
                                <span>{isHi ? "ट्रांसफर" : "Transfer"}</span>
                              </button>

                              {/* 2. OPD <-> Emergency Triage Priority Toggle */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPriorityModalTicket(tkt);
                                  setTargetPriorityLevel(isEmergency ? 2 : 1);
                                  setPriorityReason(isEmergency ? "Clinical review complete, routine queue" : "Acute distress / urgent triage elevation");
                                  setShowPriorityModal(true);
                                }}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  border: isEmergency ? "1.5px solid #FECACA" : "1.5px solid #FCA5A5",
                                  background: isEmergency ? "#DCFCE7" : "#FEF2F2",
                                  color: isEmergency ? "#15803D" : "#DC2626",
                                  fontSize: "11.5px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title={isEmergency ? "Revert Emergency to Routine OPD" : "Make Emergency (Move to Front of Queue)"}
                              >
                                {isEmergency ? (
                                  <>
                                    <Check size={13} />
                                    <span>{isHi ? "सामान्य करें" : "Make Routine"}</span>
                                  </>
                                ) : (
                                  <>
                                    <Flame size={13} />
                                    <span>{isHi ? "आपातकालीन करें" : "Make Emergency"}</span>
                                  </>
                                )}
                              </button>

                              {/* 3. PA Announce */}
                              <button
                                type="button"
                                onClick={() => handleAnnounceTicket(tkt)}
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: "8px",
                                  border: "none",
                                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                  color: "#FFFFFF",
                                  fontSize: "11.5px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title={isHi ? "लाउडस्पीकर उद्घोषणा" : "Broadcast Voice Chime on PA Speaker"}
                              >
                                <Volume2 size={13} />
                              </button>

                              {/* 4. Hold / Recall Toggle */}
                              {isOnHold ? (
                                <button
                                  type="button"
                                  onClick={() => handleRecallTicket(tkt.ticket_id)}
                                  style={{
                                    padding: "6px 9px",
                                    borderRadius: "8px",
                                    border: "1px solid #A7F3D0",
                                    background: "#ECFDF5",
                                    color: "#059669",
                                    fontSize: "11.5px",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Recall Ticket back to Active Queue"
                                >
                                  <PlayCircle size={13} />
                                  <span>{isHi ? "रिकॉल" : "Resume"}</span>
                                </button>
                              ) : isWaiting ? (
                                <button
                                  type="button"
                                  onClick={() => handleHoldTicket(tkt.ticket_id, 15)}
                                  style={{
                                    padding: "6px 9px",
                                    borderRadius: "8px",
                                    border: "1px solid #FDE68A",
                                    background: "#FFFBEB",
                                    color: "#D97706",
                                    fontSize: "11.5px",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Put Ticket on 15m Grace Hold"
                                >
                                  <PauseCircle size={13} />
                                </button>
                              ) : null}

                              {/* 5. Cancel Ticket */}
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelModalTicket(tkt);
                                  setCancelReasonPreset("Patient requested cancellation");
                                  setCancelReasonCustom("");
                                  setShowCancelModal(true);
                                }}
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: "8px",
                                  border: "1px solid #FECACA",
                                  background: "#FFF1F2",
                                  color: "#DC2626",
                                  fontSize: "11.5px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                                title={isHi ? "टिकट रद्द करें" : "Cancel Ticket"}
                              >
                                <Trash2 size={13} />
                              </button>

                              {/* 6. View Full Details */}
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailModalTicket(tkt);
                                  setShowDetailModal(true);
                                }}
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: "8px",
                                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                  background: isDark ? "#1E293B" : "#F8FAFC",
                                  color: isDark ? "#F8FAFC" : "#64748B",
                                  fontSize: "11.5px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                                title="View Patient & Clinical Details"
                              >
                                <Info size={13} />
                              </button>
                            </div>
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

      {/* 4. TAB 3: APPOINTMENTS CHECK-IN TERMINAL */}
      {activeTab === "checkin" && (
        <div style={{
          background: isDark ? "#0F172A" : "#FFFFFF",
          borderRadius: "18px",
          border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
          padding: "24px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        }}>
          {/* Header & Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "21px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {isHi ? "अपॉइंटमेंट्स चेक-इन टर्मिनल" : "Appointments Check-In Terminal"}
                </h2>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: "9999px",
                  background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                  color: "#0284C7",
                  border: "1px solid #BAE6FD",
                }}>
                  {liveAppointments.length} {isHi ? "सक्रिय बुक किए गए स्लॉट" : "Active Bookings"}
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748B" }}>
                {isHi
                  ? "सभी पूर्व-आरक्षित लाइव अपॉइंटमेंट टिकट देखें, आगमन पर मरीज का सत्यापन करें और 1-क्लिक में लाइव ओपीडी कतार टोकन जारी करें।"
                  : "View all active booked tickets, verify arriving patients, and issue immediate live OPD queue tokens."}
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Day Filter */}
              <select
                value={aptDayFilter}
                onChange={(e) => setAptDayFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                  background: isDark ? "#1E293B" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "13px",
                  fontWeight: 700,
                  outline: "none",
                }}
              >
                <option value="all">{isHi ? "📅 सभी तिथियां" : "📅 All Dates"}</option>
                {next3DaysDates.map((d) => (
                  <option key={d.dateStr} value={d.dateStr}>
                    {d.label}
                  </option>
                ))}
              </select>

              {/* Search input */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder={isHi ? "नाम, फोन, ईमेल या आईडी खोजें..." : "Search name, phone, email, ID..."}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    padding: "9px 12px 9px 34px",
                    borderRadius: "10px",
                    border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                    background: isDark ? "#1E293B" : "#F8FAFC",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    fontSize: "13px",
                    outline: "none",
                    width: "210px",
                  }}
                />
                <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              </div>

              {/* Department Filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                  background: isDark ? "#1E293B" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "13px",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                <option value="all">{isHi ? "सभी विभाग" : "All Departments"}</option>
                {departments.map((d) => (
                  <option key={d.dept_code} value={d.dept_code}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={aptStatusFilter}
                onChange={(e) => setAptStatusFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                  background: isDark ? "#1E293B" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "13px",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                <option value="all">{isHi ? "सभी स्थितियां" : "All Statuses"}</option>
                <option value="confirmed">{isHi ? "प्रतीक्षारत चेक-इन / आरक्षित" : "Booked / Pending Check-In"}</option>
                <option value="checked_in">{isHi ? "चेक-इन पूर्ण (लाइव कतार)" : "Checked-In (In Queue)"}</option>
                <option value="expired">{isHi ? "समाप्त (Expired)" : "Expired"}</option>
              </select>
            </div>
          </div>

          {/* Appointments Table */}
          {appointmentsLoading && appointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: "8px" }} />
              <div>{isHi ? "अपॉइंटमेंट्स लोड हो रहे हैं..." : "Loading appointments..."}</div>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", background: isDark ? "#1E293B" : "#F8FAFC", borderRadius: "14px" }}>
              <CalendarCheck size={40} color="#94A3B8" style={{ marginBottom: "10px" }} />
              <div style={{ fontWeight: 800, fontSize: "16px", color: isDark ? "#F8FAFC" : "#334155" }}>
                {isHi ? "कोई बुक किया गया टिकट नहीं मिला" : "No Booked Appointments Found"}
              </div>
              <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
                {searchFilter ? "Try adjusting your search criteria." : "No scheduled bookings match the selected filters."}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#1E293B" : "#F1F5F9", borderBottom: `2px solid ${isDark ? "#334155" : "#CBD5E1"}`, color: "#64748B", fontWeight: 800 }}>
                    <th style={{ padding: "12px 14px" }}>ID</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "मरीज विवरण" : "Patient Info"}</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "विभाग" : "Department"}</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "स्लॉट समय" : "Time Slot"}</th>
                    <th style={{ padding: "12px 14px" }}>{isHi ? "स्थिति" : "Status"}</th>
                    <th style={{ padding: "12px 14px", textAlign: "right" }}>{isHi ? "डेस्क कार्रवाई" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((apt) => {
                    const rawStatus = (apt.status || "booked").toLowerCase();
                    const isCheckedIn = rawStatus === "checked_in" || Boolean(apt.ticket_id && rawStatus !== "cancelled" && rawStatus !== "expired");
                    const isCancelled = rawStatus === "cancelled";
                    const isExpired = rawStatus === "expired";

                    return (
                      <tr key={apt.appointment_id} style={{ borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
                        <td style={{ padding: "14px", fontWeight: 800, color: "#0284C7" }}>
                          #{apt.appointment_id}
                        </td>
                        <td style={{ padding: "14px" }}>
                          <div style={{ fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{apt.patient_name || apt.name || "Patient"}</span>
                            {apt.family_member_id && apt.family_member_id !== "self" && (
                              <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: isDark ? "rgba(2, 132, 199, 0.2)" : "#EFF6FF", color: "#0284C7" }}>
                                Family
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748B", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            {apt.phone && <span>📞 {apt.phone}</span>}
                            {(apt.email || apt.user_email) && <span>• {apt.email || apt.user_email}</span>}
                          </div>
                        </td>
                        <td style={{ padding: "14px", fontWeight: 700 }}>
                          <span style={{ background: isDark ? "#1E293B" : "#F0F9FF", color: "#0284C7", padding: "4px 10px", borderRadius: "6px", fontSize: "12px" }}>
                            {getCategoryLabel(apt.department || apt.service_category || apt.department_name, language)}
                          </span>
                        </td>
                        <td style={{ padding: "14px" }}>
                          <div style={{ fontWeight: 700, color: isDark ? "#F8FAFC" : "#334155" }}>
                            {apt.time_slot || apt.formatted_appointment_time || apt.appointment_time || "OPD Slot"}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748B" }}>
                            {apt.appointment_date || "Today"}
                          </div>
                        </td>
                        <td style={{ padding: "14px" }}>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: "9999px",
                            fontSize: "11.5px",
                            fontWeight: 800,
                            background: isCheckedIn
                              ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#DCFCE7")
                              : isExpired
                                ? (isDark ? "rgba(100, 116, 139, 0.2)" : "#F1F5F9")
                                : (isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7"),
                            color: isCheckedIn
                              ? (isDark ? "#34D399" : "#15803D")
                              : isExpired
                                ? (isDark ? "#94A3B8" : "#64748B")
                                : (isDark ? "#FBBF24" : "#B45309"),
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}>
                            {isCheckedIn ? `✓ Checked-In (#${apt.ticket_id || ""})` : getStatusLabel(apt.status || "booked", language)}
                          </span>
                        </td>
                        <td style={{ padding: "14px", textAlign: "right" }}>
                          {!isCheckedIn && !isExpired && (
                            <div style={{ display: "inline-flex", gap: "8px" }}>
                              <button
                                type="button"
                                onClick={() => handleCheckInAppointment(apt.appointment_id)}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: "8px",
                                  border: "none",
                                  background: "linear-gradient(135deg, #16A34A 0%, #15803D 100%)",
                                  color: "#FFFFFF",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
                                }}
                              >
                                <Check size={14} />
                                <span>{isHi ? "चेक-इन करें" : "Check-In"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCancelAppointment(apt.appointment_id)}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  border: "1px solid #FECACA",
                                  background: "#FFF1F2",
                                  color: "#DC2626",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {isHi ? "रद्द" : "Cancel"}
                              </button>
                            </div>
                          )}

                          {isCheckedIn && (
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#16A34A", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={14} /> {isHi ? `कतार में सक्रिय (#${apt.ticket_id || ""})` : `In Live Queue (#${apt.ticket_id || ""})`}
                            </span>
                          )}

                          {isExpired && (
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#94A3B8" }}>
                              {isHi ? "समाप्त" : "Expired"}
                            </span>
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

      {/* 4. TAB 4: COUNTERS & DOCTOR AVAILABILITY FLEET */}
      {activeTab === "counters" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Search & Filter Bar for Counters & Clinicians */}
          <div style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "18px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            padding: "18px 22px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: isDark ? "rgba(2,132,199,0.2)" : "#E0F2FE",
                  color: "#0284C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                    {isHi ? "ऑपरेशनल सर्विस काउंटर एवं चिकित्सक ट्रैकर" : "Operational Service Counters & Clinicians Tracker"}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748B" }}>
                    {isHi
                      ? "लाइव काउंटर स्थिति, वर्तमान सेवा टोकन, प्रतीक्षा कतार और डॉक्टरों की ऑन-ड्यूटी उपलब्धता।"
                      : "Live counter status, currently served tokens, active waiting queues, and clinician duty availability."}
                  </p>
                </div>
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "9999px", background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5", border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "#A7F3D0"}`, fontSize: "11.5px", fontWeight: 700, color: isDark ? "#34D399" : "#059669" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981" }} />
                <span>{isHi ? "लाइव डेटा सिंक्रोनाइज़्ड" : "Live Telemetry Connected"}</span>
              </div>
            </div>

            {/* Search Input and Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              {/* Search input */}
              <div style={{ position: "relative", flex: 1, minWidth: "260px", maxWidth: "480px" }}>
                <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  value={countersSearchQuery}
                  onChange={(e) => setCountersSearchQuery(e.target.value)}
                  placeholder={isHi ? "काउंटर, डॉक्टर, कमरा नंबर या विभाग खोजें..." : "Search counters, clinicians, rooms, or departments..."}
                  style={{
                    width: "100%",
                    padding: "10px 38px 10px 38px",
                    borderRadius: "12px",
                    border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                    background: isDark ? "#1E293B" : "#F8FAFC",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    fontSize: "13px",
                    fontWeight: 600,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {countersSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCountersSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "#94A3B8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "2px",
                    }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Filter Type Pills */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setCountersFilterType("all")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: countersFilterType === "all" ? (isDark ? "#0284C7" : "#0284C7") : (isDark ? "#1E293B" : "#F1F5F9"),
                    color: countersFilterType === "all" ? "#FFFFFF" : (isDark ? "#94A3B8" : "#64748B"),
                    transition: "all 0.15s ease",
                  }}
                >
                  {isHi ? "सभी" : "All"} ({searchedDesksList.length + searchedDoctorsList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setCountersFilterType("counters")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: countersFilterType === "counters" ? (isDark ? "#0284C7" : "#0284C7") : (isDark ? "#1E293B" : "#F1F5F9"),
                    color: countersFilterType === "counters" ? "#FFFFFF" : (isDark ? "#94A3B8" : "#64748B"),
                    transition: "all 0.15s ease",
                  }}
                >
                  {isHi ? "केवल काउंटर" : "Counters Only"} ({searchedDesksList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setCountersFilterType("doctors")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: countersFilterType === "doctors" ? (isDark ? "#0284C7" : "#0284C7") : (isDark ? "#1E293B" : "#F1F5F9"),
                    color: countersFilterType === "doctors" ? "#FFFFFF" : (isDark ? "#94A3B8" : "#64748B"),
                    transition: "all 0.15s ease",
                  }}
                >
                  {isHi ? "केवल चिकित्सक" : "Clinicians Only"} ({searchedDoctorsList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setCountersFilterType("online")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: countersFilterType === "online" ? "#10B981" : (isDark ? "#1E293B" : "#F1F5F9"),
                    color: countersFilterType === "online" ? "#FFFFFF" : (isDark ? "#94A3B8" : "#64748B"),
                    transition: "all 0.15s ease",
                  }}
                >
                  ● {isHi ? "सक्रिय / ऑन-ड्यूटी" : "Active / Online"}
                </button>
              </div>
            </div>
          </div>

          {/* Grid of Desks and Clinicians */}
          <div style={{ display: "grid", gridTemplateColumns: countersFilterType === "counters" ? "1fr" : countersFilterType === "doctors" ? "1fr" : "1fr 1fr", gap: "24px" }}>
            {/* 1. Counter Desks Section */}
            {countersFilterType !== "doctors" && (
              <div style={{
                background: isDark ? "#0F172A" : "#FFFFFF",
                borderRadius: "18px",
                border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                padding: "24px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 2px 0", fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                      {isHi ? "ऑपरेशनल सर्विस काउंटर" : "Operational Service Counters"}
                    </h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                      {isHi ? "काउंटर चालू/बंद करें और लाइव टोकन स्थिति देखें" : "Open/close desks & monitor real-time ticket intake."}
                    </p>
                  </div>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    background: isDark ? "#1E293B" : "#E0F2FE",
                    color: "#0284C7",
                  }}>
                    {searchedDesksList.length} {isHi ? "काउंटर" : "Counters"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "580px", overflowY: "auto", paddingRight: "4px" }}>
                  {searchedDesksList.length === 0 ? (
                    <div style={{
                      padding: "36px 20px",
                      textAlign: "center",
                      borderRadius: "12px",
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      border: isDark ? "1px dashed #334155" : "1px dashed #E2E8F0",
                    }}>
                      <LayoutGrid size={28} color="#94A3B8" style={{ margin: "0 auto 8px auto", display: "block" }} />
                      <div style={{ fontSize: "13px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>
                        {countersSearchQuery
                          ? (isHi ? `"${countersSearchQuery}" से कोई काउंटर नहीं मिला` : `No counters match "${countersSearchQuery}"`)
                          : (isHi ? "कोई ऑपरेशनल काउंटर पंजीकृत नहीं है" : "No operational counters available")}
                      </div>
                    </div>
                  ) : (
                    searchedDesksList.map((desk) => {
                      const isOnline = desk.status === "AVAILABLE";
                      const deskDept = (desk.dept_code || desk.department || "").toLowerCase();

                      // Live telemetry: waiting queue count for this desk's department
                      const waitingForDesk = effectiveWaitingTickets.filter((t) => {
                        const tDept = (t.service_category || t.department || t.dept_code || t.category || "").toLowerCase();
                        return tDept && tDept === deskDept;
                      });
                      const waitingCount = waitingForDesk.length;

                      // Live telemetry: currently serving ticket at this desk
                      const servingTicketForDesk = effectiveServingTickets.find((t) => {
                        if (t.desk_id && String(t.desk_id) === String(desk.id)) return true;
                        if (t.assigned_desk && desk.desk_name && t.assigned_desk.toLowerCase() === desk.desk_name.toLowerCase()) return true;
                        if (t.counter_number && (String(t.counter_number) === String(desk.desk_number) || String(t.counter_number) === String(desk.counter_number))) return true;
                        const tDept = (t.service_category || t.department || t.dept_code || t.category || "").toLowerCase();
                        return tDept && tDept === deskDept;
                      });

                      return (
                        <div
                          key={desk.id}
                          style={{
                            padding: "14px 16px",
                            borderRadius: "14px",
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            border: isOnline
                              ? (isDark ? "1px solid rgba(16,185,129,0.3)" : "1.5px solid #BBF7D0")
                              : (isDark ? "1px solid #334155" : "1.5px solid #E2E8F0"),
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            transition: "all 0.18s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                background: isOnline ? "#10B981" : "#94A3B8",
                                boxShadow: isOnline ? "0 0 8px #10B981" : "none",
                              }} />
                              <div>
                                <div style={{ fontWeight: 800, fontSize: "14px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                                  {desk.desk_name}
                                </div>
                                <div style={{ fontSize: "11px", color: "#64748B", marginTop: "1px" }}>
                                  <span style={{ fontWeight: 600, color: "#0284C7" }}>{getCategoryLabel(desk.dept_code || desk.department, language)}</span>
                                  <span> • {desk.assigned_employee_name || "Auto-Assigned Operator"}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleDeskStatus(desk.id, desk.status)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: "8px",
                                border: "none",
                                fontWeight: 800,
                                fontSize: "11.5px",
                                cursor: "pointer",
                                background: isOnline ? "#DCFCE7" : "#F1F5F9",
                                color: isOnline ? "#15803D" : "#64748B",
                                transition: "all 0.15s ease",
                                flexShrink: 0,
                              }}
                            >
                              {isOnline ? "● ONLINE" : "○ OFFLINE"}
                            </button>
                          </div>

                          {/* Live Telemetry Badges */}
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            paddingTop: "6px",
                            borderTop: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                            fontSize: "11.5px",
                          }}>
                            {/* Live Serving Status */}
                            <div style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: servingTicketForDesk
                                ? (isDark ? "rgba(2,132,199,0.2)" : "#E0F2FE")
                                : (isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9"),
                              color: servingTicketForDesk ? "#0284C7" : "#64748B",
                              fontWeight: 700,
                            }}>
                              <Clock size={12} />
                              <span>
                                {servingTicketForDesk
                                  ? `${isHi ? "सेवा में:" : "Serving:"} #${servingTicketForDesk.ticket_id} (${servingTicketForDesk.name || "Patient"})`
                                  : isOnline ? (isHi ? "काउंटर तैयार • अगला टोकन प्रतीक्षारत" : "Desk Idle • Ready") : (isHi ? "काउंटर बंद" : "Desk Closed")}
                              </span>
                            </div>

                            {/* Live Waiting Queue Count */}
                            <div style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: waitingCount > 0
                                ? (isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7")
                                : (isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9"),
                              color: waitingCount > 0 ? "#D97706" : "#64748B",
                              fontWeight: 700,
                            }}>
                              <Users size={12} />
                              <span>
                                {waitingCount} {isHi ? "कतार में प्रतीक्षारत" : "in Queue"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 2. Clinician Duty Status & Availability Monitor Section */}
            {countersFilterType !== "counters" && (
              <div style={{
                background: isDark ? "#0F172A" : "#FFFFFF",
                borderRadius: "18px",
                border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                padding: "24px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 2px 0", fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                      {isHi ? "डॉक्टर ड्यूटी रोस्टर व उपलब्धता" : "Doctor Roster & Availability Tracker"}
                    </h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
                      {isHi ? "परामर्श कक्ष उपलब्धता एवं लाइव परामर्श स्थिति" : "Real-time consultation room & clinician telemetry."}
                    </p>
                  </div>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    background: isDark ? "#1E293B" : "#E0F2FE",
                    color: "#0284C7",
                  }}>
                    {searchedDoctorsList.length} {isHi ? "चिकित्सक" : "Clinicians"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "580px", overflowY: "auto", paddingRight: "4px" }}>
                  {searchedDoctorsList.length === 0 ? (
                    <div style={{
                      padding: "36px 20px",
                      textAlign: "center",
                      borderRadius: "12px",
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      border: isDark ? "1px dashed #334155" : "1px dashed #E2E8F0",
                    }}>
                      <Stethoscope size={28} color="#94A3B8" style={{ margin: "0 auto 8px auto", display: "block" }} />
                      <div style={{ fontSize: "13px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>
                        {countersSearchQuery
                          ? (isHi ? `"${countersSearchQuery}" से कोई डॉक्टर नहीं मिला` : `No clinicians match "${countersSearchQuery}"`)
                          : (isHi ? "कोई अन्य डॉक्टर पंजीकृत नहीं है" : "No other clinicians found")}
                      </div>
                    </div>
                  ) : (
                    searchedDoctorsList.map((doc) => {
                      const isOnline = (doc.status || "").toLowerCase() === "active";
                      const docDept = (doc.department || doc.dept_code || "").toLowerCase();

                      // Live telemetry: waiting queue count for doctor's department
                      const waitingForDoc = effectiveWaitingTickets.filter((t) => {
                        if (t.doctor_id && (String(t.doctor_id) === String(doc.id) || String(t.doctor_id) === String(doc.employee_id) || String(t.doctor_id) === String(doc.employee_code))) return true;
                        const tDept = (t.service_category || t.department || t.dept_code || t.category || "").toLowerCase();
                        return tDept && tDept === docDept;
                      });
                      const docWaitingCount = waitingForDoc.length;

                      // Live telemetry: currently serving ticket by this doctor
                      const docServingTicket = effectiveServingTickets.find((t) => {
                        if (t.doctor_id && (String(t.doctor_id) === String(doc.id) || String(t.doctor_id) === String(doc.employee_id) || String(t.doctor_id) === String(doc.employee_code))) return true;
                        if (t.doctor_name && doc.name && t.doctor_name.toLowerCase().includes(doc.name.toLowerCase())) return true;
                        if (t.served_by_doctor_name && doc.name && t.served_by_doctor_name.toLowerCase().includes(doc.name.toLowerCase())) return true;
                        const tDept = (t.service_category || t.department || t.dept_code || t.category || "").toLowerCase();
                        return tDept && tDept === docDept;
                      });

                      return (
                        <div
                          key={doc.id || doc.employee_id || doc.user_id}
                          style={{
                            padding: "14px 16px",
                            borderRadius: "14px",
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            border: isOnline
                              ? (isDark ? "1px solid rgba(16,185,129,0.3)" : "1.5px solid #BBF7D0")
                              : (isDark ? "1px solid #334155" : "1.5px solid #E2E8F0"),
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            transition: "all 0.18s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "10px",
                                background: isOnline ? "#E0F2FE" : "#F1F5F9",
                                color: isOnline ? "#0284C7" : "#94A3B8",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}>
                                <Stethoscope size={18} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: "14px", color: isDark ? "#F8FAFC" : "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span>{doc.name || doc.username}</span>
                                  {doc.employee_code && (
                                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: isDark ? "#334155" : "#E2E8F0", color: isDark ? "#94A3B8" : "#64748B" }}>
                                      {doc.employee_code}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: "11px", color: "#64748B", marginTop: "1px" }}>
                                  <span style={{ fontWeight: 600, color: "#0284C7" }}>{getCategoryLabel(doc.department || doc.dept_code, language)}</span>
                                  {doc.room_number ? <span> • Room {doc.room_number}</span> : ""}
                                </div>
                              </div>
                            </div>

                            <span style={{
                              padding: "4px 10px",
                              borderRadius: "9999px",
                              fontSize: "11px",
                              fontWeight: 800,
                              background: isOnline ? "#DCFCE7" : "#F1F5F9",
                              color: isOnline ? "#15803D" : "#64748B",
                              flexShrink: 0,
                            }}>
                              {isOnline ? "● ON DUTY" : "○ OFF DUTY"}
                            </span>
                          </div>

                          {/* Live Telemetry Badges */}
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            paddingTop: "6px",
                            borderTop: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                            fontSize: "11.5px",
                          }}>
                            {/* Live In-Consultation Patient */}
                            <div style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: docServingTicket
                                ? (isDark ? "rgba(16,185,129,0.2)" : "#DCFCE7")
                                : (isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9"),
                              color: docServingTicket ? "#15803D" : "#64748B",
                              fontWeight: 700,
                            }}>
                              <Activity size={12} />
                              <span>
                                {docServingTicket
                                  ? `${isHi ? "परामर्श जारी:" : "In Consultation:"} #${docServingTicket.ticket_id} (${docServingTicket.name || "Patient"})`
                                  : isOnline ? (isHi ? "उपलब्ध • अगले मरीज की प्रतीक्षा" : "Available • Ready for Next Patient") : (isHi ? "ड्यूटी पर नहीं" : "Off Duty")}
                              </span>
                            </div>

                            {/* Live Department Queue Waiting */}
                            <div style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: docWaitingCount > 0
                                ? (isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7")
                                : (isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9"),
                              color: docWaitingCount > 0 ? "#D97706" : "#64748B",
                              fontWeight: 700,
                            }}>
                              <Users size={12} />
                              <span>
                                {docWaitingCount} {isHi ? "विभाग में प्रतीक्षारत" : "waiting in dept"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. LOST TOKEN LOOKUP MODAL */}
      {showLookupModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          padding: "16px",
        }}>
          <div style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "20px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            width: "100%",
            maxWidth: "560px",
            padding: "24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Search size={18} color="#0284C7" />
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {isHi ? "खोया हुआ टोकन खोजें" : "Lost Token Pass Search"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLookupModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input
                type="text"
                placeholder={isHi ? "मरीज का नाम या मोबाइल नंबर दर्ज करें..." : "Enter patient phone number or name..."}
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookupSearch()}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1",
                  background: isDark ? "#1E293B" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "13.5px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleLookupSearch}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {lookupLoading ? "Searching..." : isHi ? "खोजें" : "Search"}
              </button>
            </div>

            {lookupResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                {lookupResults.map((tkt) => (
                  <div
                    key={tkt.ticket_id}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#0284C7", fontSize: "15px" }}>#{tkt.ticket_id}</strong>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#F8FAFC" : "#0F172A" }}>{tkt.name}</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>
                        {tkt.service_category} • {getStatusLabel(tkt.status, language)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => printTokenPass(tkt, null, language, hospitalBranding)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid #0284C7",
                        background: "#FFFFFF",
                        color: "#0284C7",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Printer size={13} />
                      <span>{isHi ? "री-प्रिंट" : "Re-Print"}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: TRANSFER TICKET TO ANOTHER DEPARTMENT */}
      {showTransferModal && transferModalTicket && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px",
        }}>
          <div style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "18px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            padding: "24px",
            maxWidth: "500px",
            width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ padding: "8px", borderRadius: "10px", background: "#E0F2FE", color: "#0284C7" }}>
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                    {isHi ? "रोगी टोकन स्थानांतरित करें (Transfer)" : "Transfer Patient Ticket"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    Token #{transferModalTicket.ticket_id} • {transferModalTicket.name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Department Info */}
            <div style={{ padding: "12px", borderRadius: "10px", background: isDark ? "#1E293B" : "#F8FAFC", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Current Department:</div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#0284C7", marginTop: "2px" }}>
                {getCategoryLabel(transferModalTicket.service_category, language)}
              </div>
            </div>

            {/* Target Department Dropdown */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B", marginBottom: "6px" }}>
                {isHi ? "लक्ष्य विभाग चुनें (Target Department) *" : "Select Target Department *"}
              </label>
              <select
                value={transferTargetDept}
                onChange={(e) => setTransferTargetDept(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "13px",
                  fontWeight: 700,
                  outline: "none",
                }}
              >
                {departments
                  .filter((d) => (d.dept_code || "").toLowerCase() !== (transferModalTicket.service_category || "").toLowerCase())
                  .map((d) => (
                    <option key={d.dept_code} value={d.dept_code}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Transfer / Clinical Notes */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B", marginBottom: "6px" }}>
                {isHi ? "स्थानांतरण कारण / नैदानिक नोट" : "Transfer Reason / Clinical Instructions (Optional)"}
              </label>
              <textarea
                rows={3}
                placeholder={isHi ? "उदा. एक्स-रे जांच या ईसीजी परामर्श हेतु संदर्भित..." : "e.g., Referred for Diagnostic X-Ray or Specialized Cardiology Assessment..."}
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "12.5px",
                  outline: "none",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                  background: "transparent",
                  color: isDark ? "#CBD5E1" : "#64748B",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isHi ? "रद्द करें" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={isTransferring || !transferTargetDept}
                onClick={() => handleTransferTicketSubmit(transferModalTicket.ticket_id, transferTargetDept, transferNotes)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: isTransferring ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ArrowRightLeft size={15} />
                <span>{isTransferring ? (isHi ? "स्थानांतरित हो रहा है..." : "Transferring...") : (isHi ? "स्थानांतरण पूर्ण करें" : "Confirm Transfer")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OPD <-> EMERGENCY PRIORITY TRIAGE MODAL */}
      {showPriorityModal && priorityModalTicket && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px",
        }}>
          <div style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "18px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            padding: "24px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ padding: "8px", borderRadius: "10px", background: targetPriorityLevel === 1 ? "#FEE2E2" : "#DCFCE7", color: targetPriorityLevel === 1 ? "#DC2626" : "#16A34A" }}>
                  {targetPriorityLevel === 1 ? <Flame size={20} /> : <CheckCircle2 size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                    {isHi ? "ट्राइएज प्राथमिकता अपडेट (Triage Priority)" : "Update Triage Priority"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    Token #{priorityModalTicket.ticket_id} • {priorityModalTicket.name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPriorityModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Urgency Level Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setTargetPriorityLevel(2)}
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: targetPriorityLevel === 2 ? "2px solid #10B981" : isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                  background: targetPriorityLevel === 2 ? (isDark ? "#1E293B" : "#ECFDF5") : isDark ? "#0F172A" : "#FFFFFF",
                  color: targetPriorityLevel === 2 ? "#059669" : "#64748B",
                  fontWeight: 800,
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>🟢 {isHi ? "सामान्य (Routine P2)" : "Routine OPD (P2)"}</div>
                <div style={{ fontSize: "10.5px", fontWeight: 500, marginTop: "2px" }}>Standard arrival order</div>
              </button>

              <button
                type="button"
                onClick={() => setTargetPriorityLevel(1)}
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: targetPriorityLevel === 1 ? "2px solid #DC2626" : isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
                  background: targetPriorityLevel === 1 ? (isDark ? "#1E293B" : "#FEF2F2") : isDark ? "#0F172A" : "#FFFFFF",
                  color: targetPriorityLevel === 1 ? "#DC2626" : "#64748B",
                  fontWeight: 800,
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>🚨 {isHi ? "आपातकालीन (Emergency P1)" : "Emergency (P1)"}</div>
                <div style={{ fontSize: "10.5px", fontWeight: 500, marginTop: "2px" }}>Immediate front of queue</div>
              </button>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B", marginBottom: "6px" }}>
                {isHi ? "ट्राइएज का कारण (Clinical Justification)" : "Triage Justification / Reason"}
              </label>
              <input
                type="text"
                value={priorityReason}
                onChange={(e) => setPriorityReason(e.target.value)}
                placeholder="e.g. Acute severe chest pain / critical condition"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "12.5px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowPriorityModal(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                  background: "transparent",
                  color: isDark ? "#CBD5E1" : "#64748B",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isHi ? "रद्द करें" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={isUpdatingPriority}
                onClick={() => handleTogglePriority(priorityModalTicket, targetPriorityLevel, priorityReason)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: targetPriorityLevel === 1 ? "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)" : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: isUpdatingPriority ? "not-allowed" : "pointer",
                }}
              >
                {isUpdatingPriority ? (isHi ? "अपडेट हो रहा है..." : "Updating...") : (isHi ? "प्राथमिकता लागू करें" : "Apply Triage Priority")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CANCEL TICKET MODAL */}
      {showCancelModal && cancelModalTicket && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px",
        }}>
          <div style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "18px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            padding: "24px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ padding: "8px", borderRadius: "10px", background: "#FEF2F2", color: "#DC2626" }}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#DC2626" }}>
                    {isHi ? "टोकन रद्द करें (Cancel Ticket)" : "Cancel Queue Ticket"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    Token #{cancelModalTicket.ticket_id} • {cancelModalTicket.name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: isDark ? "#CBD5E1" : "#475569", lineHeight: 1.5 }}>
              {isHi
                ? `क्या आप वाकई टोकन #${cancelModalTicket.ticket_id} (${cancelModalTicket.name}) को रद्द करना चाहते हैं? यह मरीज को कतार से हटा देगा।`
                : `Are you sure you want to cancel Ticket #${cancelModalTicket.ticket_id} for ${cancelModalTicket.name}? This will remove them from the active queue.`}
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748B", marginBottom: "6px" }}>
                {isHi ? "रद्दीकरण का कारण चुनें" : "Select Cancellation Reason"}
              </label>
              <select
                value={cancelReasonPreset}
                onChange={(e) => setCancelReasonPreset(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                  background: isDark ? "#1E293B" : "#FFFFFF",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "12.5px",
                  outline: "none",
                }}
              >
                <option value="Patient requested cancellation">Patient requested cancellation</option>
                <option value="Patient left hospital / absent">Patient left hospital / absent</option>
                <option value="Duplicate ticket issued">Duplicate ticket issued</option>
                <option value="Registered in wrong department">Registered in wrong department</option>
                <option value="Doctor unavailable / rescheduled">Doctor unavailable / rescheduled</option>
                <option value="Other">Other / Custom Reason</option>
              </select>
            </div>

            {cancelReasonPreset === "Other" && (
              <div style={{ marginBottom: "18px" }}>
                <input
                  type="text"
                  placeholder="Specify custom reason..."
                  value={cancelReasonCustom}
                  onChange={(e) => setCancelReasonCustom(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    fontSize: "12.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                  background: "transparent",
                  color: isDark ? "#CBD5E1" : "#64748B",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isHi ? "वापस जाएं" : "Keep Ticket"}
              </button>
              <button
                type="button"
                disabled={isCancellingTicket}
                onClick={() => {
                  const finalReason = cancelReasonPreset === "Other" ? (cancelReasonCustom || "Cancelled by staff") : cancelReasonPreset;
                  handleCancelTicketSubmit(cancelModalTicket.ticket_id, finalReason);
                }}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "12.5px",
                  fontWeight: 800,
                  cursor: isCancellingTicket ? "not-allowed" : "pointer",
                }}
              >
                {isCancellingTicket ? (isHi ? "रद्द हो रहा है..." : "Cancelling...") : (isHi ? "हाँ, रद्द करें" : "Yes, Cancel Ticket")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: TICKET DETAIL & CLINICAL INFO MODAL */}
      {showDetailModal && detailModalTicket && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px",
        }}>
          <div style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "18px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            padding: "24px",
            maxWidth: "520px",
            width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ padding: "8px", borderRadius: "10px", background: "#E0F2FE", color: "#0284C7" }}>
                  <Info size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                    Token #{detailModalTicket.ticket_id} Details
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    {detailModalTicket.name} • {getCategoryLabel(detailModalTicket.service_category, language)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: isDark ? "#1E293B" : "#F8FAFC", padding: "16px", borderRadius: "12px", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0", marginBottom: "18px", fontSize: "12.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Patient Name:</span>
                <strong style={{ color: isDark ? "#F8FAFC" : "#0F172A" }}>{detailModalTicket.name}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Demographics:</span>
                <span>{detailModalTicket.age || 30} yrs • {detailModalTicket.gender || "other"}</span>
              </div>
              {detailModalTicket.phone && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748B" }}>Contact Phone:</span>
                  <span>📞 {detailModalTicket.phone}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Department:</span>
                <strong style={{ color: "#0284C7" }}>{getCategoryLabel(detailModalTicket.service_category, language)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Triage Priority:</span>
                <span>{Number(detailModalTicket.priority_level || detailModalTicket.priority || 2) === 1 ? "🚨 Emergency (P1)" : "🟢 Routine OPD (P2)"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Current Status:</span>
                <strong style={{ textTransform: "capitalize", color: "#0284C7" }}>{detailModalTicket.status}</strong>
              </div>
              {detailModalTicket.appointment_id && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748B" }}>Linked Appointment:</span>
                  <strong style={{ color: "#6D28D9" }}>{detailModalTicket.appointment_id}</strong>
                </div>
              )}
              {detailModalTicket.medical_condition && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748B" }}>Chief Complaint:</span>
                  <span>{formatCleanText(detailModalTicket.medical_condition)}</span>
                </div>
              )}
              {detailModalTicket.transferred_from_dept && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748B" }}>Origin Department:</span>
                  <span>{getCategoryLabel(detailModalTicket.transferred_from_dept, language)}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <button
                type="button"
                onClick={() => printTokenPass(detailModalTicket, null, language, hospitalBranding)}
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  border: "1.5px solid #0284C7",
                  background: "#FFFFFF",
                  color: "#0284C7",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Printer size={14} />
                <span>{isHi ? "पर्ची प्रिंट करें" : "Print Pass"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  fontSize: "12.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isHi ? "बंद करें" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. GLOBAL IN-APP FLOATING TOAST NOTIFICATION */}
      {inAppToast && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 20px",
            borderRadius: "14px",
            boxShadow: "0 14px 35px -4px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0,0,0,0.06)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            maxWidth: "480px",
            minWidth: "300px",
            fontSize: "13.5px",
            fontWeight: 700,
            background:
              inAppToast.type === "error"
                ? (isDark ? "rgba(127, 29, 29, 0.95)" : "#FEF2F2")
                : inAppToast.type === "warn"
                  ? (isDark ? "rgba(120, 53, 15, 0.95)" : "#FFFBEB")
                  : inAppToast.type === "info"
                    ? (isDark ? "rgba(12, 74, 110, 0.95)" : "#F0F9FF")
                    : (isDark ? "rgba(6, 78, 59, 0.95)" : "#ECFDF5"),
            border:
              inAppToast.type === "error"
                ? (isDark ? "1.5px solid #EF4444" : "1.5px solid #FECACA")
                : inAppToast.type === "warn"
                  ? (isDark ? "1.5px solid #F59E0B" : "1.5px solid #FDE68A")
                  : inAppToast.type === "info"
                    ? (isDark ? "1.5px solid #0284C7" : "1.5px solid #BAE6FD")
                    : (isDark ? "1.5px solid #10B981" : "1.5px solid #A7F3D0"),
            color:
              inAppToast.type === "error"
                ? (isDark ? "#FEE2E2" : "#991B1B")
                : inAppToast.type === "warn"
                  ? (isDark ? "#FEF3C7" : "#92400E")
                  : inAppToast.type === "info"
                    ? (isDark ? "#E0F2FE" : "#075985")
                    : (isDark ? "#D1FAE5" : "#065F46"),
          }}
        >
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            {inAppToast.type === "error" ? (
              <AlertCircle size={20} color={isDark ? "#FCA5A5" : "#DC2626"} />
            ) : inAppToast.type === "warn" ? (
              <AlertTriangle size={20} color={isDark ? "#FCD34D" : "#D97706"} />
            ) : inAppToast.type === "info" ? (
              <Info size={20} color={isDark ? "#7DD3FC" : "#0284C7"} />
            ) : (
              <CheckCircle2 size={20} color={isDark ? "#6EE7B7" : "#16A34A"} />
            )}
          </div>
          <div style={{ flex: 1, lineHeight: 1.45 }}>{inAppToast.message}</div>
          <button
            type="button"
            onClick={() => setInAppToast(null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "inherit",
              opacity: 0.75,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 9. GLOBAL IN-APP CONFIRMATION MODAL */}
      {confirmDialog && (
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
        >
          <div
            style={{
              background: isDark ? "#0F172A" : "#FFFFFF",
              borderRadius: "20px",
              border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
              padding: "26px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 25px 60px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: confirmDialog.isDestructive ? (isDark ? "rgba(239,68,68,0.2)" : "#FEF2F2") : (isDark ? "rgba(2,132,199,0.2)" : "#E0F2FE"),
                  color: confirmDialog.isDestructive ? "#DC2626" : "#0284C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {confirmDialog.isDestructive ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {confirmDialog.title}
                </h3>
              </div>
            </div>

            <p style={{ margin: "0 0 22px 0", fontSize: "13.5px", color: isDark ? "#CBD5E1" : "#475569", lineHeight: 1.55 }}>
              {confirmDialog.message}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                  background: "transparent",
                  color: isDark ? "#CBD5E1" : "#64748B",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {confirmDialog.cancelText || (isHi ? "वापस जाएं" : "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const onConfirm = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  if (onConfirm) onConfirm();
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: confirmDialog.isDestructive
                    ? "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)"
                    : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: confirmDialog.isDestructive
                    ? "0 4px 14px rgba(220, 38, 38, 0.35)"
                    : "0 4px 14px rgba(2, 132, 199, 0.35)",
                }}
              >
                {confirmDialog.confirmText || (isHi ? "पुष्टि करें" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <Footer
        language={language}
        hospitalName={hospitalBranding?.hospital_name || HOSPITAL_CONFIG.name}
        currentUser={currentUser}
      />
    </div>
  );
}
