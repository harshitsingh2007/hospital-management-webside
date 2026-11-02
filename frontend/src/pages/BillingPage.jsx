import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE } from "../config/hospitalConfig";
import { announceTicketVoice } from "../utils/voiceSynthesizer";
import { printBillInvoice, printPaymentReceipt } from "../utils/printPassHelper";
import Footer from "../components/common/Footer";
import {
  CreditCard,
  Receipt,
  DollarSign,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  Search,
  Clock,
  User,
  Building2,
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
  Percent,
  RefreshCw,
  Wallet,
  Landmark,
  Smartphone,
  Tag,
  AlertCircle,
  HelpCircle,
  UserPlus,
  ArrowUpRight,
  Volume2
} from "lucide-react";
import * as XLSX from "xlsx";

export default function BillingPage({
  tenantId = "city-hospital-01",
  currentUser,
  analytics,
  queueSnapshot,
  servingTickets = [],
  heldTickets = [],
  handleServeNext,
  refreshData,
  language = "en",
  setLanguage,
  socketRef,
  navigateTo,
  hospitalBranding,
  theme = "dark",
  setTheme,
}) {
  const isHi = language === "hi";
  const isDark = theme === "dark";

  // Standard Hospital Theme Palette (Matching PathologyPage & RadiologyPage)
  const pageBg = isDark ? "#090D16" : "#F8FAFC";
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const cardBorder = isDark ? "#1E293B" : "#E2E8F0";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";
  const inputBg = isDark ? "#1E293B" : "#FFFFFF";
  const inputBorder = isDark ? "#334155" : "#CBD5E1";
  const brandPrimary = hospitalBranding?.primary_color || "#0284C7";

  // Effective hospital identity
  const effectiveHospitalCode = useMemo(() => {
    return (
      (hospitalBranding && (hospitalBranding.hospital_code || hospitalBranding.code)) ||
      (currentUser && (currentUser.hospital_code || currentUser.primary_hospital_code)) ||
      tenantId ||
      "city-hospital-01"
    );
  }, [hospitalBranding, currentUser, tenantId]);

  const hospitalName =
    (hospitalBranding && (hospitalBranding.hospital_name || hospitalBranding.name)) ||
    (isHi ? "सिटी जनरल अस्पताल" : "City General Hospital");

  const cashierName =
    (currentUser && (currentUser.name || currentUser.full_name || currentUser.username)) ||
    (isHi ? "मुख्य कैशियर" : "Head Cashier");

  // Tabs state: "workstation" | "archive" | "reports" | "shift"
  const [activeTab, setActiveTab] = useState("workstation");

  // Toast notifications
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3600);
  }, []);

  // Duty Status Management (Matches Pathology & Radiology exact states)
  const [dutyStatus, setDutyStatus] = useState(() => {
    try {
      return localStorage.getItem("ai_queue_billing_duty") || "ACTIVE";
    } catch (_) {
      return "ACTIVE";
    }
  });

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

  const dutyStatusOptions = useMemo(
    () => [
      {
        id: "ACTIVE",
        label: isHi ? "डेस्क पर सक्रिय (बिलिंग हेतु तैयार)" : "Active on Duty (Ready to Bill)",
        desc: isHi ? "मरीज़ बुलाएं व भुगतान स्वीकार करें" : "Ready to call patients & accept payments",
        color: "#10B981",
        border: "rgba(16, 185, 129, 0.4)",
        bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
        icon: "🟢",
      },
      {
        id: "BREAK",
        label: isHi ? "चाय / भोजन अवकाश" : "On Tea / Meal Break",
        desc: isHi ? "कतार कॉलिंग अस्थायी रूप से रुकी है" : "Billing desk paused temporarily",
        color: "#F59E0B",
        border: "rgba(245, 158, 11, 0.4)",
        bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB",
        icon: "☕",
      },
      {
        id: "OFF_DUTY",
        label: isHi ? "डेस्क बंद / शिफ्ट समाप्त" : "Desk Closed / Off Duty",
        desc: isHi ? "कैशियर सेवा आज के लिए बंद है" : "Billing desk closed for the day",
        color: "#EF4444",
        border: "rgba(239, 68, 68, 0.4)",
        bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
        icon: "🔴",
      },
    ],
    [isHi, isDark]
  );

  const handleDutyStatusChange = useCallback(
    (newDutyId) => {
      setDutyStatus(newDutyId);
      try {
        localStorage.setItem("ai_queue_billing_duty", newDutyId);
      } catch (_) { }

      const backendStatus = newDutyId === "BREAK" ? "ON_BREAK" : newDutyId === "OFF_DUTY" ? "OFF_DUTY" : "ACTIVE";
      const targetUserId = currentUser?.id || currentUser?.user_id;
      const targetEmail = currentUser?.email;
      const targetName = currentUser?.name || currentUser?.username || cashierName;
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
        role: currentUser?.role || "cashier",
        status: backendStatus,
      };

      if (socketRef && socketRef.current) {
        socketRef.current.emit("update_doctor_duty_status", payload);
        socketRef.current.emit("update_staff_duty_status", payload);
      }

      fetch(`${API_BASE}/api/v1/doctor/duty-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
        body: JSON.stringify(payload),
      }).catch((e) => console.warn("Duty status persist err:", e));

      const opt = dutyStatusOptions.find((o) => o.id === newDutyId);
      showToast(isHi ? `डेस्क स्थिति: ${opt?.label || newDutyId}` : `Status set to ${opt?.label || newDutyId}`, "info");
    },
    [currentUser, effectiveHospitalCode, cashierName, socketRef, dutyStatusOptions, isHi, showToast]
  );

  // Desks & Desk Assignment (Assigned by SuperAdmin Portal - Read-Only)
  const [hospitalDesks, setHospitalDesks] = useState([]);
  const [assignedDesk, setAssignedDesk] = useState(null);
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [activeDesk, setActiveDesk] = useState(() => {
    try {
      return localStorage.getItem("ai_queue_billing_desk") || "";
    } catch (_) {
      return "";
    }
  });

  const activeDeskName = assignedDesk?.desk_name || activeDesk || (currentUser?.name ? `${currentUser.name}'s Desk` : "Billing Desk");

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
        const currentName = String(currentUser?.name || currentUser?.full_name || "").trim().toLowerCase();

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
            localStorage.setItem("ai_queue_billing_desk", myDesk.desk_name);
          } catch (_) { }
        } else {
          setAssignedDesk(null);
          setSelectedDesk(null);
          setActiveDesk("");
          try {
            localStorage.removeItem("ai_queue_billing_desk");
          } catch (_) { }
        }
      }
    } catch (e) {
      console.error("Failed to load desks from superadmin in billing:", e);
    }
  }, [effectiveHospitalCode, currentUser?.id, currentUser?.user_id, currentUser?.username, currentUser?.email, currentUser?.employee_id, currentUser?.employee_code, currentUser?.name, currentUser?.full_name]);

  useEffect(() => {
    fetchHospitalDesks();
  }, [fetchHospitalDesks]);

  // Tariff Master Cache
  const [tariffs, setTariffs] = useState([]);
  const [loadingTariffs, setLoadingTariffs] = useState(false);

  const fetchTariffs = useCallback(async () => {
    setLoadingTariffs(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/tariffs?tenant_id=${effectiveHospitalCode}`, {
        headers: {
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        setTariffs(data.data);
      }
    } catch (err) {
      console.warn("Tariffs fetch error:", err);
    } finally {
      setLoadingTariffs(false);
    }
  }, [effectiveHospitalCode, currentUser]);

  useEffect(() => {
    fetchTariffs();
  }, [fetchTariffs]);

  // Daily Financial Overview / KPI Reports
  const [dailyReport, setDailyReport] = useState({
    total_billed: 0,
    total_collected: 0,
    total_refunded: 0,
    net_collection: 0,
    total_pending_dues: 0,
    bills_count: 0,
    paid_count: 0,
    pending_count: 0,
    by_mode: {},
    by_cashier: {},
    by_department: {},
  });

  const fetchDailyReport = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/reports/daily-collection?tenant_id=${effectiveHospitalCode}`, {
        headers: {
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
      });
      const data = await res.json();
      if (data && data.success && data.data) {
        setDailyReport(data.data);
      }
    } catch (err) {
      console.warn("Daily report error:", err);
    }
  }, [effectiveHospitalCode, currentUser]);

  useEffect(() => {
    fetchDailyReport();
  }, [fetchDailyReport]);

  // Cash Shift Status
  const [shiftStatus, setShiftStatus] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("1000");
  const [shiftNotesInput, setShiftNotesInput] = useState("");
  const [countedCashInput, setCountedCashInput] = useState("");

  const fetchShiftStatus = useCallback(async () => {
    setLoadingShift(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/shifts/status?tenant_id=${effectiveHospitalCode}`, {
        headers: {
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
      });
      const data = await res.json();
      if (data && data.success) {
        setShiftStatus(data.data);
      }
    } catch (err) {
      console.warn("Shift fetch error:", err);
    } finally {
      setLoadingShift(false);
    }
  }, [effectiveHospitalCode, currentUser]);

  useEffect(() => {
    fetchShiftStatus();
  }, [fetchShiftStatus]);

  const handleOpenShift = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/shifts/open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hospital-code": effectiveHospitalCode,
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
        body: JSON.stringify({
          opening_cash: Number(openingCashInput) || 0,
          notes: shiftNotesInput,
          tenant_id: effectiveHospitalCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to open shift");
      setShowOpenShiftModal(false);
      showToast(isHi ? "कैश शिफ्ट सफलतापूर्वक प्रारंभ हुई ✓" : "Cash shift opened successfully ✓", "success");
      fetchShiftStatus();
    } catch (err) {
      showToast(err.message, "warn");
    }
  };

  const handleCloseShift = async () => {
    if (!shiftStatus) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/shifts/${shiftStatus.id}/close`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-hospital-code": effectiveHospitalCode,
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
        body: JSON.stringify({
          counted_cash: Number(countedCashInput) || 0,
          notes: shiftNotesInput,
          tenant_id: effectiveHospitalCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to close shift");
      setShowCloseShiftModal(false);
      showToast(isHi ? "कैश रजिस्टर बंद एवं ऑडिट पूर्ण ✓" : "Shift closed and reconciled ✓", "success");
      fetchShiftStatus();
      fetchDailyReport();
    } catch (err) {
      showToast(err.message, "warn");
    }
  };

  // Filter Live Billing Queue (waiting and serving)
  const billingQueue = useMemo(() => {
    if (!queueSnapshot || !Array.isArray(queueSnapshot)) return [];
    const isBillingMatch = (d) => ["billing", "cashier", "central_billing", "accounts", "cash_counter"].includes(String(d || "").toLowerCase());
    return queueSnapshot.filter(
      (t) => (t.status === "waiting" || t.status === "queued" || t.status === "called") && (isBillingMatch(t.service_category) || isBillingMatch(t.department))
    );
  }, [queueSnapshot]);

  // Active Serving Ticket at this desk
  const activeServingTicket = useMemo(() => {
    if (!servingTickets || !Array.isArray(servingTickets)) return null;
    const isBillingMatch = (d) => ["billing", "cashier", "central_billing", "accounts", "cash_counter"].includes(String(d || "").toLowerCase());
    const myDeskId = selectedDesk?.id || assignedDesk?.id ? String(selectedDesk?.id || assignedDesk?.id) : null;
    const myDeskName = assignedDesk?.desk_name || activeDesk;

    return (
      servingTickets.find(
        (t) =>
          (isBillingMatch(t.service_category) || isBillingMatch(t.department)) &&
          (String(t.doctor_name || "").toLowerCase() === String(cashierName).toLowerCase() ||
            (myDeskId && String(t.desk_id || "") === myDeskId) ||
            (myDeskName && String(t.desk_name || "") === String(myDeskName)) ||
            !t.doctor_name)
      ) || servingTickets.find((t) => isBillingMatch(t.service_category) || isBillingMatch(t.department)) || null
    );
  }, [servingTickets, cashierName, selectedDesk, assignedDesk, activeDesk]);

  // Call Next Patient from Queue
  const [callingNext, setCallingNext] = useState(false);
  const handleCallNext = async () => {
    if (dutyStatus !== "ACTIVE") {
      showToast(isHi ? "मरीज़ बुलाने के लिए कृपया ड्यूटी स्थिति 'सक्रिय' करें।" : "Please set status to 'Active on Duty' to call patients.", "warn");
      return;
    }
    if (activeServingTicket) {
      showToast(isHi ? `टोकन #${activeServingTicket.ticket_id} का बिलिंग सत्र सक्रिय है।` : `Active billing in progress for #${activeServingTicket.ticket_id}. Complete or hold first.`, "warn");
      return;
    }
    if (billingQueue.length === 0) {
      showToast(isHi ? "बिलिंग कतार में कोई मरीज़ प्रतीक्षारत नहीं है।" : "No patients waiting in billing queue.", "info");
      return;
    }

    setCallingNext(true);
    const payload = {
      tenant_id: effectiveHospitalCode,
      department: "billing",
      service_category: "billing",
      doctor_id: currentUser?.id || currentUser?.user_id || null,
      doctor_name: cashierName,
      doctor_email: currentUser?.email || null,
      desk_id: assignedDesk?.id || selectedDesk?.id || null,
      desk_name: activeDeskName,
      counter_name: activeDeskName,
    };

    try {
      if (socketRef && socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("serve_next", payload);
        showToast(isHi ? "अगले बिलिंग मरीज़ को पुकारा जा रहा है..." : "Calling next billing patient...", "info");
      } else {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        await fetch(`${API_BASE}/api/v1/plugin/serve-next`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(currentUser?.email ? { "X-User-Email": currentUser.email } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
      }
      if (refreshData) refreshData();
    } catch (err) {
      showToast(err.message, "warn");
    } finally {
      setCallingNext(false);
    }
  };

  // Re-announce Ticket Voice
  const handleReannounce = (ticket) => {
    if (!ticket) return;
    const voiceText = isHi
      ? `टोकन संख्या ${ticket.ticket_id || ticket.token_number}, कृपया केंद्रीय बिलिंग डेस्क पर पधारें।`
      : `Token number ${ticket.ticket_id || ticket.token_number}, please proceed to the central billing desk.`;
    announceTicketVoice({
      ticket_id: ticket.ticket_id || ticket.token_number,
      department: "Central Billing",
      counter: activeDeskName,
      desk_name: activeDeskName,
      language,
      customText: voiceText,
    });
    showToast(isHi ? `टोकन #${ticket.ticket_id} पुनः पुकारा गया` : `Re-announced Token #${ticket.ticket_id}`, "info");
  };

  // Active Bill Workstation State
  const [activeBillItems, setActiveBillItems] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [billNotes, setBillNotes] = useState("");
  const [activePatientData, setActivePatientData] = useState(null);
  const [currentCreatedBill, setCurrentCreatedBill] = useState(null);
  const [fetchingBillables, setFetchingBillables] = useState(false);

  // Walk-in Billing Modal State
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    patient_name: "",
    age: "",
    gender: "Male",
    phone: "",
    uhid: "",
    guardian_name: "",
    address: "",
    city: "",
    blood_group: "",
    billing_category: "General",
    doctor_name: "",
    department: "General Consultation",
    id_proof: "",
    notes: "",
  });

  // Load / Auto-pull billable items when active ticket changes
  const autoPullTicketItems = useCallback(async (ticketId) => {
    if (!ticketId) return;
    setFetchingBillables(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/ticket/${ticketId}/items?tenant_id=${effectiveHospitalCode}`, {
        headers: {
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
      });
      const data = await res.json();
      if (data && data.success && data.data) {
        setActivePatientData(data.data.patient || null);
        if (Array.isArray(data.data.items) && data.data.items.length > 0) {
          setActiveBillItems(data.data.items);
          showToast(isHi ? `पर्चे एवं जांच से ${data.data.items.length} मदें जोड़ी गईं ✓` : `Auto-pulled ${data.data.items.length} billable items ✓`, "success");
        }
      }
    } catch (err) {
      console.warn("Auto pull err:", err);
    } finally {
      setFetchingBillables(false);
    }
  }, [effectiveHospitalCode, currentUser, isHi, showToast]);

  useEffect(() => {
    if (activeServingTicket && activeServingTicket.ticket_id) {
      autoPullTicketItems(activeServingTicket.ticket_id);
    } else {
      if (!isWalkInModalOpen && !currentCreatedBill) {
        setActiveBillItems([
          {
            tariff_id: null,
            description: "General OPD Consultation Fee",
            department_code: "opd",
            quantity: 1,
            unit_price: 300,
            tax_percent: 0,
            line_total: 300,
            source: "manual",
          },
        ]);
      }
    }
  }, [activeServingTicket, autoPullTicketItems, isWalkInModalOpen, currentCreatedBill]);

  // Adding item to active bill
  const handleAddItemFromTariff = (tariffId) => {
    const tariff = tariffs.find((t) => t.id === Number(tariffId));
    if (!tariff) return;
    const price = Number(tariff.base_price) || 0;
    const tax = Number(tariff.tax_percent) || 0;
    const lineTotal = Math.round(price * (1 + tax / 100) * 100) / 100;

    setActiveBillItems((prev) => [
      ...prev,
      {
        tariff_id: tariff.id,
        description: tariff.service_name,
        department_code: tariff.department_code,
        quantity: 1,
        unit_price: price,
        tax_percent: tax,
        line_total: lineTotal,
        source: "tariff",
      },
    ]);
    showToast(isHi ? `${tariff.service_name} जोड़ा गया` : `Added ${tariff.service_name}`, "info");
  };

  const handleAddCustomItem = () => {
    setActiveBillItems((prev) => [
      ...prev,
      {
        tariff_id: null,
        description: "Medical Procedure / Consumable",
        department_code: "general",
        quantity: 1,
        unit_price: 150,
        tax_percent: 0,
        line_total: 150,
        source: "manual",
      },
    ]);
  };

  const handleUpdateItem = (idx, field, val) => {
    setActiveBillItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[idx], [field]: val };
      const qty = Math.max(0.01, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.unit_price) || 0);
      const taxPct = Math.max(0, Number(item.tax_percent) || 0);
      const lineSub = qty * rate;
      item.line_total = Math.round((lineSub + lineSub * (taxPct / 100)) * 100) / 100;
      copy[idx] = item;
      return copy;
    });
  };

  const handleRemoveItem = (idx) => {
    setActiveBillItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Computations
  const subtotal = useMemo(() => {
    return activeBillItems.reduce((acc, it) => acc + (Number(it.quantity || 1) * Number(it.unit_price || 0)), 0);
  }, [activeBillItems]);

  const taxTotal = useMemo(() => {
    return activeBillItems.reduce((acc, it) => {
      const lineSub = Number(it.quantity || 1) * Number(it.unit_price || 0);
      return acc + (lineSub * (Number(it.tax_percent || 0) / 100));
    }, 0);
  }, [activeBillItems]);

  const grandTotal = useMemo(() => {
    const gross = subtotal + taxTotal;
    return Math.max(0, Math.round((gross - Number(discountAmount || 0)) * 100) / 100);
  }, [subtotal, taxTotal, discountAmount]);

  // Payment Recording Modal & Form
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRefNo, setPaymentRefNo] = useState("");
  const [cashTendered, setCashTendered] = useState("");
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState([
    { mode: "Cash", amount: "", reference_no: "" },
    { mode: "UPI", amount: "", reference_no: "" },
  ]);

  // Return change calculation
  const cashChangeReturn = useMemo(() => {
    const tendered = Number(cashTendered || 0);
    const needed = Number(paymentAmount || grandTotal);
    return tendered > needed ? Math.round((tendered - needed) * 100) / 100 : 0;
  }, [cashTendered, paymentAmount, grandTotal]);

  // Save / Generate Official Bill
  const handleGenerateBill = async () => {
    if (activeBillItems.length === 0) {
      showToast(isHi ? "कृपया बिल में कम से कम एक मद जोड़ें।" : "Please add at least one bill item.", "warn");
      return;
    }

    try {
      const payload = {
        tenant_id: effectiveHospitalCode,
        ticket_id: activeServingTicket?.ticket_id || null,
        patient_id: activePatientData?.id || activeServingTicket?.patient_id || null,
        patient_name: activePatientData?.name || activePatientData?.full_name || activeServingTicket?.name || null,
        phone: activePatientData?.phone || activeServingTicket?.phone || null,
        age: activePatientData?.age || activeServingTicket?.age || null,
        gender: activePatientData?.gender || activeServingTicket?.gender || null,
        medical_id: activePatientData?.medical_id || activePatientData?.uhid || null,
        patient: activePatientData || null,
        items: activeBillItems,
        discount_amount: Number(discountAmount) || 0,
        discount_reason: discountReason,
        notes: [
          billNotes,
          activePatientData?.billing_category && activePatientData?.billing_category !== "General" ? `Category: ${activePatientData.billing_category}` : null,
          activePatientData?.doctor_name ? `Dr: ${activePatientData.doctor_name}` : null,
          activePatientData?.department && activePatientData?.department !== "General Consultation" ? `Dept: ${activePatientData.department}` : null,
          activePatientData?.guardian_name ? `Guardian: ${activePatientData.guardian_name}` : null,
          activePatientData?.address ? `Addr: ${activePatientData.address}${activePatientData.city ? `, ${activePatientData.city}` : ""}` : null,
          activePatientData?.blood_group ? `Blood: ${activePatientData.blood_group}` : null,
          activePatientData?.id_proof ? `ID: ${activePatientData.id_proof}` : null,
          activePatientData?.notes ? `Indication: ${activePatientData.notes}` : null,
        ].filter(Boolean).join(" | "),
        status: "Pending",
      };

      const res = await fetch(`${API_BASE}/api/v1/billing/bills`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hospital-code": effectiveHospitalCode,
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create bill");

      setCurrentCreatedBill(data.data);
      setPaymentAmount(String(data.data.balance_due || data.data.grand_total));
      showToast(isHi ? `चालान #${data.data.bill_number} सृजित हुआ ✓` : `Invoice #${data.data.bill_number} generated ✓`, "success");
      fetchDailyReport();
      setShowPaymentModal(true);
    } catch (err) {
      showToast(err.message, "warn");
    }
  };

  // Submit Payment
  const handleSubmitPayment = async () => {
    const targetBillId = currentCreatedBill?.id;
    if (!targetBillId) {
      showToast(isHi ? "कोई बिल चयनित नहीं है।" : "No active bill selected.", "warn");
      return;
    }

    try {
      let paymentPayload = {};
      if (isSplitPayment) {
        paymentPayload = {
          payments: splitPayments.map((p) => ({
            mode: p.mode,
            amount: Number(p.amount) || 0,
            reference_no: p.reference_no,
          })),
        };
      } else {
        paymentPayload = {
          mode: paymentMode,
          amount: Number(paymentAmount) || Number(currentCreatedBill.balance_due),
          reference_no: paymentRefNo,
        };
      }

      const res = await fetch(`${API_BASE}/api/v1/billing/bills/${targetBillId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hospital-code": effectiveHospitalCode,
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
        body: JSON.stringify(paymentPayload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Payment recording failed");

      setShowPaymentModal(false);
      showToast(isHi ? "भुगतान दर्ज एवं रसीद सृजित ✓" : "Payment received & receipt generated ✓", "success");
      fetchDailyReport();

      // Print Receipt
      const receiptData = data.data.payments[0] || {};
      printPaymentReceipt(
        {
          ...receiptData,
          bill_number: data.data.bill?.bill_number,
          bills: data.data.bill,
          patient_name: activePatientData?.name || activePatientData?.full_name || activeServingTicket?.name,
          ticket_id: activeServingTicket?.ticket_id,
          cashier_name: cashierName,
        },
        language,
        hospitalBranding,
        "thermal"
      );

      // If fully paid and linked to ticket, complete encounter
      if (data.data.bill?.status === "Paid" && activeServingTicket?.ticket_id) {
        if (socketRef && socketRef.current) {
          socketRef.current.emit("complete_ticket", {
            tenant_id: effectiveHospitalCode,
            ticket_id: activeServingTicket.ticket_id,
            prescription_notes: `Billing Cleared: Invoice #${data.data.bill.bill_number} (₹${data.data.bill.grand_total})`,
          });
        }
      }

      // Reset Active Workstation
      setCurrentCreatedBill(null);
      if (refreshData) refreshData();
    } catch (err) {
      showToast(err.message, "warn");
    }
  };

  // Archive & Historical Bills state
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveStatusFilter, setArchiveStatusFilter] = useState("all");
  const [archiveDateFilter, setArchiveDateFilter] = useState("today");
  const [customArchiveDate, setCustomArchiveDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [billsArchiveList, setBillsArchiveList] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const fetchArchiveBills = useCallback(async () => {
    setLoadingArchive(true);
    try {
      let queryUrl = `${API_BASE}/api/v1/billing/bills?tenant_id=${effectiveHospitalCode}&limit=100`;
      if (archiveStatusFilter !== "all") queryUrl += `&status=${archiveStatusFilter}`;
      if (archiveSearch) queryUrl += `&search=${encodeURIComponent(archiveSearch)}`;
      if (archiveDateFilter === "today") {
        queryUrl += `&date=${new Date().toISOString().split("T")[0]}`;
      } else if (archiveDateFilter === "date" && customArchiveDate) {
        queryUrl += `&date=${customArchiveDate}`;
      }

      const res = await fetch(queryUrl, {
        headers: {
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        setBillsArchiveList(data.data);
      }
    } catch (err) {
      console.warn("Archive fetch error:", err);
    } finally {
      setLoadingArchive(false);
    }
  }, [effectiveHospitalCode, currentUser, archiveStatusFilter, archiveSearch, archiveDateFilter, customArchiveDate]);

  useEffect(() => {
    if (activeTab === "archive" || activeTab === "reports") {
      fetchArchiveBills();
    }
  }, [activeTab, fetchArchiveBills]);

  // Excel Export for Financial Audit
  const handleExportFinancialExcel = () => {
    if (billsArchiveList.length === 0) {
      showToast(isHi ? "निर्यात करने हेतु कोई बिल उपलब्ध नहीं" : "No billing records to export", "warn");
      return;
    }

    const rows = billsArchiveList.map((b, idx) => ({
      "S.No": idx + 1,
      "Bill Number": b.bill_number,
      "Date": b.created_at ? new Date(b.created_at).toLocaleDateString() : "",
      "Time": b.created_at ? new Date(b.created_at).toLocaleTimeString() : "",
      "Token ID": b.ticket_id || "-",
      "Patient Name": b.patients?.name || b.patients?.full_name || "Walk-in",
      "Phone": b.patients?.phone || "-",
      "Subtotal (₹)": Number(b.subtotal || 0).toFixed(2),
      "Discount (₹)": Number(b.discount_amount || 0).toFixed(2),
      "Tax (₹)": Number(b.tax_amount || 0).toFixed(2),
      "Grand Total (₹)": Number(b.grand_total || 0).toFixed(2),
      "Amount Paid (₹)": Number(b.amount_paid || 0).toFixed(2),
      "Balance Due (₹)": Number(b.balance_due || 0).toFixed(2),
      "Status": b.status,
      "Cashier": b.employees_bills_created_byToemployees?.name || "Cashier Desk",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hospital_Billing_Audit");
    XLSX.writeFile(wb, `Billing_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(isHi ? "वित्तीय स्प्रेडशीट डाउनलोड हो गई ✓" : "Excel audit exported successfully ✓", "success");
  };

  return (
    <div
      className="billing-portal-wrapper"
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "0 0 12px 0",
        background: pageBg,
        color: textColor,
        transition: "all 0.25s ease",
        "--bill-card-bg": cardBg,
        "--bill-card-border": cardBorder,
        "--bill-card-text": textColor,
      }}
    >
      <style>{`
        .billing-portal-wrapper * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .billing-portal-wrapper .user-dashboard-footer {
          margin-top: 16px !important;
          margin-bottom: 0px !important;
          padding-top: 16px !important;
          padding-bottom: 16px !important;
        }

        /* ========================================================================= */
        /* CUSTOM HOSPITAL-THEMED SCROLLBARS ACROSS ALL TABS, PAGES & CONTAINERS     */
        /* ========================================================================= */
        /* Firefox */
        .billing-portal-wrapper,
        .billing-portal-wrapper *,
        .billing-scrollable {
          scrollbar-width: thin !important;
          scrollbar-color: #0284C7 rgba(2, 132, 199, 0.08) !important;
        }

        body.theme-dark .billing-portal-wrapper,
        body.theme-dark .billing-portal-wrapper *,
        [data-theme="dark"] .billing-portal-wrapper,
        [data-theme="dark"] .billing-portal-wrapper *,
        body.theme-dark .billing-scrollable,
        [data-theme="dark"] .billing-scrollable {
          scrollbar-width: thin !important;
          scrollbar-color: #0284C7 rgba(255, 255, 255, 0.08) !important;
        }

        /* WebKit (Chrome, Edge, Safari) */
        .billing-portal-wrapper ::-webkit-scrollbar,
        .billing-scrollable::-webkit-scrollbar {
          width: 7px !important;
          height: 7px !important;
        }

        .billing-portal-wrapper ::-webkit-scrollbar-track,
        .billing-scrollable::-webkit-scrollbar-track {
          background: rgba(2, 132, 199, 0.05) !important;
          border-radius: 9999px !important;
        }

        body.theme-dark .billing-portal-wrapper ::-webkit-scrollbar-track,
        body.theme-dark .billing-scrollable::-webkit-scrollbar-track,
        [data-theme="dark"] .billing-portal-wrapper ::-webkit-scrollbar-track,
        [data-theme="dark"] .billing-scrollable::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05) !important;
        }

        .billing-portal-wrapper ::-webkit-scrollbar-thumb,
        .billing-scrollable::-webkit-scrollbar-thumb {
          background: #0284C7 !important;
          border-radius: 9999px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          transition: background 0.2s ease !important;
        }

        .billing-portal-wrapper ::-webkit-scrollbar-thumb:hover,
        .billing-scrollable::-webkit-scrollbar-thumb:hover {
          background: #0369A1 !important;
        }

        body.theme-dark .billing-portal-wrapper ::-webkit-scrollbar-thumb,
        body.theme-dark .billing-scrollable::-webkit-scrollbar-thumb,
        [data-theme="dark"] .billing-portal-wrapper ::-webkit-scrollbar-thumb,
        [data-theme="dark"] .billing-scrollable::-webkit-scrollbar-thumb {
          background: #0284C7 !important;
          border: 1px solid rgba(0, 0, 0, 0.3) !important;
        }

        body.theme-dark .billing-portal-wrapper ::-webkit-scrollbar-thumb:hover,
        body.theme-dark .billing-scrollable::-webkit-scrollbar-thumb:hover,
        [data-theme="dark"] .billing-portal-wrapper ::-webkit-scrollbar-thumb:hover,
        [data-theme="dark"] .billing-scrollable::-webkit-scrollbar-thumb:hover {
          background: #38BDF8 !important;
        }

        .billing-portal-wrapper ::-webkit-scrollbar-corner,
        .billing-scrollable::-webkit-scrollbar-corner {
          background: transparent !important;
        }

        /* Executive Dark-Navy Clinical Hero Container matching Pathology & Radiology */
        .billing-hero-container {
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

        .billing-hero-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding-top: 12px;
        }

        @media (max-width: 960px) {
          .billing-hero-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }

        @media (max-width: 540px) {
          .billing-hero-kpi-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }

        .billing-kpi-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          padding: 10px 14px;
        }

        .billing-tabs-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        @media (max-width: 920px) {
          .billing-tabs-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }

        @media (max-width: 540px) {
          .billing-tabs-grid {
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
        }

        .tab-button-modern.active {
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%) !important;
          border: 1px solid #0284C7 !important;
          color: #FFFFFF !important;
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.28);
        }

        .tab-button-modern.inactive {
          background: var(--bill-card-bg, #FFFFFF);
          border: 1px solid var(--bill-card-border, #E2E8F0);
          color: var(--bill-card-text, #0F172A);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
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

        /* Responsive Workstation 2-Column Grid matching Radiology & Pathology */
        .billing-workstation-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 16px;
          width: 100%;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .billing-workstation-grid {
            grid-template-columns: 1fr;
          }
        }

        .billing-table-row {
          height: 42px;
        }
      `}</style>

      {/* Floating Toast Alert */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: toast.type === "success" ? "#065F46" : toast.type === "warn" ? "#9A3412" : "#1E293B",
            color: "#FFFFFF",
            border: `1px solid ${toast.type === "success" ? "#059669" : toast.type === "warn" ? "#EA580C" : "#334155"}`,
          }}
        >
          {toast.type === "success" && <CheckCircle2 size={18} color="#34D399" />}
          {toast.type === "warn" && <AlertTriangle size={18} color="#FBBF24" />}
          {toast.type === "info" && <HelpCircle size={18} color="#38BDF8" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 1. Executive Dark-Navy Clinical Hero Container (Matches Pathology & Radiology) */}
      <div className="billing-hero-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,0.14)", padding: "3px 8px", borderRadius: "6px", fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Building2 size={12} />
                <span>{hospitalName.toUpperCase()}</span>
              </span>
              <span style={{ background: "rgba(56, 189, 248, 0.2)", border: "1px solid rgba(56, 189, 248, 0.4)", color: "#BAE6FD", padding: "3px 8px", borderRadius: "6px", fontSize: "10.5px", fontWeight: 800 }}>
                {isHi ? "NABH मान्यता प्राप्त केंद्रीय बिलिंग व कैशियर काउंटर" : "NABH ACCREDITED CENTRAL BILLING & CASHIER DESK"}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 900, letterSpacing: "-0.4px", lineHeight: "1.2" }}>
              {isHi ? "कैशियर एवं सेंट्रल बिलिंग पोर्टल" : "Cashier & Central Billing Portal"}
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
                <CreditCard size={12} />
              </div>

              {/* Staff Name */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "कैशियर:" : "Cashier:"}
                </span>
                <span style={{ fontSize: "12.5px", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.2px" }}>
                  {currentUser?.name || currentUser?.username || cashierName || "Head Cashier"}
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
                  {(currentUser?.department || "CENTRAL BILLING & CASHIER").toUpperCase()}
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

          {/* Right Top Controls: Desk selector, Duty Status, Walk-in Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Walk-in Billing Button */}
            <button
              type="button"
              onClick={() => setIsWalkInModalOpen(true)}
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
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
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                transition: "all 0.15s ease",
              }}
            >
              <UserPlus size={13} />
              <span>{isHi ? "+ वॉक-इन बिलिंग" : "+ Walk-in Bill"}</span>
            </button>

            {/* Read-Only Desk Badge (Assigned by SuperAdmin Portal) */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(15, 23, 42, 0.55)",
                border: assignedDesk
                  ? "1px solid rgba(255, 255, 255, 0.25)"
                  : "1px solid rgba(245, 158, 11, 0.4)",
                borderRadius: "10px",
                padding: "6px 14px",
                backdropFilter: "blur(12px)",
                userSelect: "none",
              }}
              title={
                assignedDesk
                  ? (isHi ? `सुपरएडमिन द्वारा आबंटित डेस्क: ${assignedDesk.desk_name}` : `Assigned Desk: ${assignedDesk.desk_name}`)
                  : (isHi ? "सुपरएडमिन पोर्टल द्वारा कोई डेस्क आबंटित नहीं। कृपया व्यवस्थापक से संपर्क करें।" : "No desk assigned in SuperAdmin portal. Assigned by Super Admin.")
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
                {assignedDesk?.desk_name || (isHi ? "असाइन नहीं" : "Unassigned")}
              </span>
            </div>

            {/* Interactive Duty Status Dropdown (Matches Pathology style) */}
            <div style={{ position: "relative" }} ref={dutyDropdownRef}>
              <button
                type="button"
                onClick={() => setShowDutyDropdown((prev) => !prev)}
                style={{
                  background:
                    dutyStatus === "ACTIVE"
                      ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
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
                    ? (isHi ? "काउंटर पर सक्रिय" : "Active on Duty")
                    : dutyStatus === "BREAK"
                      ? (isHi ? "भोजन / अवकाश" : "On Break")
                      : (isHi ? "काउंटर बंद" : "Off Duty")}
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
                    {isHi ? "कैशियर ड्यूटी स्थिति चुनें" : "Select Duty Status"}
                  </div>

                  {dutyStatusOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        handleDutyStatusChange(opt.id);
                        setShowDutyDropdown(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: dutyStatus === opt.id ? `1px solid ${opt.border || opt.color}` : "1px solid transparent",
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
          </div>
        </div>

        {/* Live Metrics Grid (Glassmorphic Telemetry Cards matching Pathology) */}
        <div className="billing-hero-kpi-grid">
          <div className="billing-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "कतार में प्रतीक्षारत" : "Waiting in Billing Queue"}
              </div>
              <Clock size={15} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              {billingQueue.length}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {isHi ? "डेस्क पर प्रतीक्षारत मरीज़" : "Patients waiting at desk"}
            </div>
          </div>

          <div className="billing-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "आज का कुल संकलन" : "Today's Collection"}
              </div>
              <TrendingUp size={15} color="#34D399" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2", color: "#34D399" }}>
              ₹{Number(dailyReport.total_collected || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {isHi ? "प्राप्त शुद्ध राशि" : "Net verified revenue"}
            </div>
          </div>

          <div className="billing-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "बकाया देय राशि" : "Pending Dues"}
              </div>
              <AlertCircle size={15} color="#FB7185" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2", color: "#FB7185" }}>
              ₹{Number(dailyReport.total_pending_dues || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {dailyReport.pending_count || 0} {isHi ? "लंबित चालान" : "unsettled bills"}
            </div>
          </div>

          <div className="billing-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "आज सृजित चालान" : "Bills Generated Today"}
              </div>
              <Receipt size={15} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              {dailyReport.bills_count || 0}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {dailyReport.paid_count || 0} {isHi ? "भुगतान पूर्ण" : "settled / paid"}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Modern Tab Segmented Switcher matching Pathology & Radiology */}
      <div className="billing-tabs-grid">
        <button
          type="button"
          onClick={() => setActiveTab("workstation")}
          className={`tab-button-modern ${activeTab === "workstation" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <CreditCard size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tab-title-text">{isHi ? "बिलिंग वर्कस्टेशन" : "Billing Workstation"}</div>
            <span className="tab-sub-text">{isHi ? "सक्रिय डेस्क एवं लाइव कतार" : "Active Desk & Live Queue"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "workstation" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
              color: activeTab === "workstation" ? "#FFFFFF" : "#0284C7",
            }}
          >
            {billingQueue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("archive")}
          className={`tab-button-modern ${activeTab === "archive" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <Receipt size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tab-title-text">{isHi ? "चालान एवं रसीदें" : "Bills & Receipts Archive"}</div>
            <span className="tab-sub-text">{isHi ? "खोज, पुनर्मुद्रण एवं रिफंड" : "Search, Reprint & Refunds"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "archive" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"),
              color: activeTab === "archive" ? "#FFFFFF" : "#6366F1",
            }}
          >
            {dailyReport.bills_count || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`tab-button-modern ${activeTab === "reports" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <TrendingUp size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tab-title-text">{isHi ? "दैनिक संकलन रिपोर्ट" : "Daily Collections & Reports"}</div>
            <span className="tab-sub-text">{isHi ? "विभाग एवं माध्यम वार" : "Mode & Dept breakdown"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "reports" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(16, 185, 129, 0.25)" : "#ECFDF5"),
              color: activeTab === "reports" ? "#FFFFFF" : "#059669",
            }}
          >
            ₹{Math.round((dailyReport.total_collected || 0) / 1000)}k
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shift")}
          className={`tab-button-modern ${activeTab === "shift" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <Wallet size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tab-title-text">{isHi ? "कैश शिफ्ट व मिलान" : "Cash Shift & Reconciliation"}</div>
            <span className="tab-sub-text">{isHi ? "रजिस्टर क्लोजिंग व अंतर" : "Shift closing & drawer audit"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "shift" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(245, 158, 11, 0.25)" : "#FEF3C7"),
              color: activeTab === "shift" ? "#FFFFFF" : "#D97706",
            }}
          >
            {shiftStatus ? "Open" : "Closed"}
          </span>
        </button>
      </div>

      {/* 3. TAB CONTENT */}
      {/* ========================================================================= */}
      {/* TAB 1: BILLING WORKSTATION (2-Column Grid matching Radiology)              */}
      {/* ========================================================================= */}
      {activeTab === "workstation" && (
        <div className="billing-workstation-grid">
          {/* LEFT: Active Patient Billing Station */}
          <div
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "16px",
              padding: "16px 20px",
              boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
            }}
          >
            {/* Header: Patient Banner with Blue Gradient Avatar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cardBorder}`, paddingBottom: "12px", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                  }}
                >
                  <Receipt size={18} />
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: mutedText, fontWeight: 700 }}>
                    {isHi ? "सक्रिय बिलिंग सत्र" : "Active Patient Billing Station"}
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 800 }}>
                    {activeServingTicket ? `${activeServingTicket.name || "Patient"} (#${activeServingTicket.ticket_id})` : (isHi ? "वॉक-इन / नया चालान" : "Walk-in / Open Invoice")}
                  </div>
                </div>
              </div>

              {activeServingTicket && (
                <button
                  type="button"
                  onClick={() => autoPullTicketItems(activeServingTicket.ticket_id)}
                  disabled={fetchingBillables}
                  style={{
                    background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                    color: "#0284C7",
                    border: "1px solid #0284C7",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <RefreshCw size={12} className={fetchingBillables ? "animate-spin" : ""} />
                  <span>{isHi ? "पर्चे से मदें पुनः खींचें" : "Sync Rx Items"}</span>
                </button>
              )}
            </div>

            {/* Patient Context Details (Matches Pathology bar) */}
            <div
              style={{
                background: isDark ? "#1E293B" : "#F8FAFC",
                border: `1px solid ${cardBorder}`,
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "16px",
                fontSize: "12px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "10px",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <span style={{ fontSize: "10px", color: mutedText, display: "block" }}>{isHi ? "मरीज़ का नाम" : "Patient Name"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                    <strong style={{ fontSize: "13px" }}>
                      {activeServingTicket?.name || activePatientData?.name || activePatientData?.full_name || "Walk-in Guest"}
                    </strong>
                    {activePatientData?.blood_group && (
                      <span style={{ fontSize: "9.5px", fontWeight: 800, background: "#EF4444", color: "#FFFFFF", padding: "1px 6px", borderRadius: "4px" }}>
                        {activePatientData.blood_group}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "10px", color: mutedText, marginTop: "2px", fontFamily: "monospace" }}>
                    {activePatientData?.uhid || activeServingTicket?.medical_id ? `ID: ${activePatientData?.uhid || activeServingTicket?.medical_id}` : "Spot Reg"}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "10px", color: mutedText, display: "block" }}>{isHi ? "आयु / लिंग" : "Age / Gender"}</span>
                  <span style={{ fontWeight: 600, display: "block", marginTop: "2px" }}>
                    {activeServingTicket?.age || activePatientData?.age || "-"} Yrs • {activeServingTicket?.gender || activePatientData?.gender || "-"}
                  </span>
                  {activePatientData?.guardian_name && (
                    <div style={{ fontSize: "10px", color: mutedText, marginTop: "2px" }}>
                      C/O {activePatientData.guardian_name}
                    </div>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: "10px", color: mutedText, display: "block" }}>{isHi ? "टोकन / संपर्क" : "Token / Mobile"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <span style={{ color: "#0284C7", fontWeight: 800, fontFamily: "monospace", fontSize: "12px" }}>
                      #{activeServingTicket?.ticket_id || "WALK-IN"}
                    </span>
                    {activePatientData?.billing_category && activePatientData?.billing_category !== "General" && (
                      <span style={{ fontSize: "9px", fontWeight: 700, background: isDark ? "#334155" : "#E0F2FE", color: "#0284C7", padding: "1px 5px", borderRadius: "4px" }}>
                        {activePatientData.billing_category}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "10px", color: mutedText, marginTop: "2px" }}>
                    📱 {activeServingTicket?.phone || activePatientData?.phone || "N/A"}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "10px", color: mutedText, display: "block" }}>{isHi ? "डॉक्टर / विभाग" : "Doctor & Dept"}</span>
                  <span style={{ fontWeight: 600, display: "block", marginTop: "2px" }}>
                    {activePatientData?.doctor_name || activeServingTicket?.doctor_name || "General OPD"}
                  </span>
                  <div style={{ fontSize: "10px", color: mutedText, marginTop: "2px" }}>
                    {activePatientData?.department || activeServingTicket?.service_category || "Central Billing"}
                  </div>
                </div>
              </div>

              {(activePatientData?.address || activePatientData?.notes) && (
                <div
                  style={{
                    borderTop: `1px dashed ${cardBorder}`,
                    marginTop: "8px",
                    paddingTop: "6px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    fontSize: "11px",
                    color: mutedText,
                  }}
                >
                  {activePatientData?.address && (
                    <span>📍 <strong>Address:</strong> {activePatientData.address}{activePatientData.city ? `, ${activePatientData.city}` : ""}</span>
                  )}
                  {activePatientData?.notes && (
                    <span>📝 <strong>Indication:</strong> {activePatientData.notes}</span>
                  )}
                </div>
              )}
            </div>

            {/* Add Item Actions Bar */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "14px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddItemFromTariff(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  style={{
                    width: "100%",
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: textColor,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  <option value="" disabled>
                    {isHi ? "+ टैरिफ मास्टर से जांच / सेवा जोड़ें..." : "+ Add service from Tariff Master..."}
                  </option>
                  {tariffs.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.category}] {t.service_name} — ₹{Number(t.base_price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddCustomItem}
                style={{
                  background: isDark ? "#1E293B" : "#F1F5F9",
                  color: textColor,
                  border: `1px solid ${cardBorder}`,
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <Plus size={14} color="#0284C7" />
                <span>{isHi ? "+ कस्टम मद" : "+ Custom Item"}</span>
              </button>
            </div>

            {/* Bill Items Editable Table */}
            <div
              className="billing-scrollable"
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "360px",
                marginBottom: "14px",
                border: `1px solid ${cardBorder}`,
                borderRadius: "10px",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr style={{ background: isDark ? "#1E293B" : "#F1F5F9", color: mutedText, fontSize: "10.5px", textTransform: "uppercase" }}>
                    <th style={{ padding: "8px 10px", width: "40%" }}>{isHi ? "सेवा विवरण" : "Service Description"}</th>
                    <th style={{ padding: "8px 6px", width: "14%", textAlign: "center" }}>Qty</th>
                    <th style={{ padding: "8px 10px", width: "18%", textAlign: "right" }}>Rate (₹)</th>
                    <th style={{ padding: "8px 10px", width: "20%", textAlign: "right" }}>Total (₹)</th>
                    <th style={{ padding: "8px 6px", width: "8%", textAlign: "center" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {activeBillItems.map((item, idx) => (
                    <tr key={idx} className="billing-table-row" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(idx, "description", e.target.value)}
                          style={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            color: textColor,
                            fontWeight: 600,
                            fontSize: "12px",
                            outline: "none",
                          }}
                        />
                        <span style={{ fontSize: "9.5px", color: mutedText, textTransform: "uppercase" }}>
                          Dept: {item.department_code || "general"} • {item.source}
                        </span>
                      </td>
                      <td style={{ padding: "6px", textAlign: "center" }}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                          style={{
                            width: "48px",
                            textAlign: "center",
                            background: inputBg,
                            border: `1px solid ${inputBorder}`,
                            borderRadius: "6px",
                            padding: "4px",
                            fontSize: "11.5px",
                            color: textColor,
                          }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={item.unit_price}
                          onChange={(e) => handleUpdateItem(idx, "unit_price", e.target.value)}
                          style={{
                            width: "80px",
                            textAlign: "right",
                            background: inputBg,
                            border: `1px solid ${inputBorder}`,
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "11.5px",
                            color: textColor,
                          }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 800, color: "#0284C7" }}>
                        ₹{Number(item.line_total || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "6px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: "4px" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeBillItems.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: mutedText }}>
                        {isHi ? "कोई मद नहीं जोड़ी गई है। कृपया ऊपर से सेवा चुनें।" : "No items added. Add services from the tariff dropdown above."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Discount Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px", background: isDark ? "#1E293B" : "#F8FAFC", padding: "12px 16px", borderRadius: "10px", border: `1px solid ${cardBorder}`, marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                  {isHi ? "छूट / डिस्काउंट (₹) एवं कारण:" : "Discount Amount (₹) & Reason:"}
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountAmount || ""}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    style={{
                      width: "80px",
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: textColor,
                      padding: "6px 8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  />
                  <input
                    type="text"
                    placeholder={isHi ? "छूट का कारण (उदा. बीपीएल, स्टाफ...)" : "Reason (e.g. BPL, Staff family...)"}
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    style={{
                      flex: 1,
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: textColor,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: mutedText }}>Subtotal: <strong>₹{subtotal.toFixed(2)}</strong></div>
                {Number(discountAmount) > 0 && (
                  <div style={{ fontSize: "11px", color: "#059669" }}>Discount: <strong>-₹{Number(discountAmount).toFixed(2)}</strong></div>
                )}
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#0284C7", marginTop: "4px" }}>
                  GRAND TOTAL: ₹{grandTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  printBillInvoice(
                    {
                      bill_number: currentCreatedBill?.bill_number || "INV-DRAFT",
                      patient: activePatientData || { name: activeServingTicket?.name, full_name: activeServingTicket?.name },
                      ticket_id: activeServingTicket?.ticket_id,
                      bill_items: activeBillItems,
                      subtotal,
                      discount_amount: discountAmount,
                      tax_amount: taxTotal,
                      grand_total: grandTotal,
                      amount_paid: 0,
                      balance_due: grandTotal,
                      status: "Pending",
                      cashier_name: cashierName,
                    },
                    language,
                    hospitalBranding
                  );
                }}
                style={{
                  background: isDark ? "#1E293B" : "#F1F5F9",
                  color: textColor,
                  border: `1px solid ${cardBorder}`,
                  borderRadius: "10px",
                  padding: "10px 16px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Printer size={15} color="#0284C7" />
                <span>{isHi ? "चालान प्रिंट (A4)" : "Print Invoice (A4)"}</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateBill}
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                }}
              >
                <CheckCircle2 size={16} />
                <span>{isHi ? "चालान सृजित करें व भुगतान लें" : "Generate Bill & Pay"}</span>
              </button>
            </div>
          </div>

          {/* RIGHT: Live Billing Queue Stream (Matches Pathology & Radiology Queue Layout) */}
          <div>
            <div
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
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
                  <span>{isHi ? "लाइव बिलिंग कतार" : "Live Billing Queue"}</span>
                </h3>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                    color: "#0284C7",
                  }}
                >
                  {billingQueue.length} {isHi ? "मरीज़" : "Patients"}
                </span>
              </div>

              {/* Call Next Patient Button at Top of Queue (Exact Pathology style) */}
              <button
                type="button"
                onClick={handleCallNext}
                disabled={callingNext || billingQueue.length === 0}
                style={{
                  width: "100%",
                  marginBottom: "10px",
                  background: billingQueue.length === 0
                    ? (isDark ? "#1E293B" : "#F1F5F9")
                    : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: billingQueue.length === 0 ? (isDark ? "#64748B" : "#94A3B8") : "#FFFFFF",
                  border: billingQueue.length === 0 ? (isDark ? "1px solid #334155" : "1px solid #CBD5E1") : "none",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  fontWeight: 800,
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  cursor: billingQueue.length === 0 || callingNext ? "not-allowed" : "pointer",
                  opacity: callingNext ? 0.7 : 1,
                  boxShadow: billingQueue.length === 0 ? "none" : "0 3px 12px rgba(2, 132, 199, 0.25)",
                  transition: "all 0.15s ease",
                }}
              >
                <Volume2 size={14} />
                <span>
                  {callingNext
                    ? (isHi ? "पुकारा जा रहा है..." : "Calling...")
                    : (isHi ? "अगला मरीज़ बुलाएं" : "Call Next Patient")}
                </span>
              </button>

              {/* Waiting Queue List */}
              <div
                className="billing-scrollable"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "460px",
                  overflowY: "auto",
                  paddingRight: "6px",
                }}
              >
                {billingQueue.map((t, idx) => (
                  <div
                    key={t.ticket_id || idx}
                    style={{
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      border: `1px solid ${cardBorder}`,
                      borderRadius: "10px",
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 900, color: "#0284C7", fontSize: "13px", fontFamily: "monospace" }}>#{t.ticket_id}</span>
                        <strong style={{ fontSize: "12.5px" }}>{t.name || "Patient"}</strong>
                      </div>
                      <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "2px" }}>
                        {t.age || "-"} Yrs • {t.gender || "-"} • Dept: {t.department || "Consultation"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => handleReannounce(t)}
                        title={isHi ? "पुनः पुकारें" : "Re-announce"}
                        style={{
                          background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                          color: "#0284C7",
                          border: "1px solid rgba(2, 132, 199, 0.4)",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <Volume2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                {billingQueue.length === 0 && (
                  <div style={{ textAlign: "center", padding: "32px 10px", color: mutedText }}>
                    <CheckCircle2 size={28} color="#0284C7" style={{ margin: "0 auto 8px auto", opacity: 0.6 }} />
                    <div style={{ fontSize: "12.5px", fontWeight: 700 }}>
                      {isHi ? "कतार खाली है" : "Billing Queue is Clear"}
                    </div>
                    <div style={{ fontSize: "11px", opacity: 0.7 }}>
                      {isHi ? "सभी प्रतीक्षारत मरीज़ों का बिलिंग पूर्ण हो चुका है।" : "No pending patients waiting at the billing desk."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BILLS & RECEIPTS ARCHIVE                                           */}
      {/* ========================================================================= */}
      {activeTab === "archive" && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
          }}
        >
          {/* Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: mutedText }} />
                <input
                  type="text"
                  placeholder={isHi ? "चालान सं., टोकन या मरीज़ का नाम खोजें..." : "Search Bill #, Token or Patient Name..."}
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 12px 7px 32px",
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: textColor,
                  }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={archiveStatusFilter}
                onChange={(e) => setArchiveStatusFilter(e.target.value)}
                style={{
                  padding: "7px 10px",
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: textColor,
                }}
              >
                <option value="all">{isHi ? "सभी स्थितियां" : "All Status"}</option>
                <option value="Paid">{isHi ? "भुगतान पूर्ण (Paid)" : "Paid"}</option>
                <option value="Pending">{isHi ? "लंबित (Pending)" : "Pending"}</option>
                <option value="Partially Paid">{isHi ? "आंशिक भुगतान" : "Partially Paid"}</option>
                <option value="Cancelled">{isHi ? "रद्द (Cancelled)" : "Cancelled"}</option>
              </select>

              {/* Date Filter */}
              <select
                value={archiveDateFilter}
                onChange={(e) => setArchiveDateFilter(e.target.value)}
                style={{
                  padding: "7px 10px",
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: textColor,
                }}
              >
                <option value="today">{isHi ? "आज के बिल" : "Today"}</option>
                <option value="all">{isHi ? "सभी तिथियां" : "All Time"}</option>
                <option value="date">{isHi ? "विशिष्ट तिथि..." : "Specific Date..."}</option>
              </select>

              {archiveDateFilter === "date" && (
                <input
                  type="date"
                  value={customArchiveDate}
                  onChange={(e) => setCustomArchiveDate(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: textColor,
                  }}
                />
              )}
            </div>

            <button
              type="button"
              onClick={handleExportFinancialExcel}
              style={{
                background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                color: "#0284C7",
                border: "1px solid #0284C7",
                padding: "7px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Download size={13} />
              <span>{isHi ? "एक्सेल डाउनलोड" : "Export Excel"}</span>
            </button>
          </div>

          {/* Bills Archive Table */}
          <div
            className="billing-scrollable"
            style={{
              overflowX: "auto",
              overflowY: "auto",
              maxHeight: "560px",
              border: `1px solid ${cardBorder}`,
              borderRadius: "10px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr style={{ background: isDark ? "#1E293B" : "#F1F5F9", color: mutedText, fontSize: "10.5px", textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 12px" }}>{isHi ? "चालान संख्या" : "Bill #"}</th>
                  <th style={{ padding: "10px 12px" }}>{isHi ? "मरीज़ विवरण" : "Patient Info"}</th>
                  <th style={{ padding: "10px 12px" }}>{isHi ? "टोकन" : "Token"}</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>{isHi ? "कुल राशि (₹)" : "Grand Total"}</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>{isHi ? "जमा (₹)" : "Paid"}</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>{isHi ? "बकाया (₹)" : "Balance"}</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>{isHi ? "स्थिति" : "Status"}</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>{isHi ? "कार्य" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {billsArchiveList.map((bill) => (
                  <tr key={bill.id} className="billing-table-row" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 800, color: "#0284C7" }}>
                      {bill.bill_number}
                      <span style={{ display: "block", fontSize: "9.5px", color: mutedText, fontFamily: "sans-serif" }}>
                        {bill.created_at ? new Date(bill.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <strong>{bill.patients?.name || bill.patients?.full_name || "Walk-in Patient"}</strong>
                      <span style={{ display: "block", fontSize: "10px", color: mutedText }}>
                        Ph: {bill.patients?.phone || "-"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontWeight: 800, color: "#38BDF8", fontFamily: "monospace" }}>#{bill.ticket_id || "WALK-IN"}</span>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                      ₹{Number(bill.grand_total || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                      ₹{Number(bill.amount_paid || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: Number(bill.balance_due) > 0 ? "#DC2626" : mutedText }}>
                      ₹{Number(bill.balance_due || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "10px",
                          fontWeight: 800,
                          background: bill.status === "Paid" ? "rgba(16, 185, 129, 0.15)" : bill.status === "Partially Paid" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: bill.status === "Paid" ? "#10B981" : bill.status === "Partially Paid" ? "#F59E0B" : "#EF4444",
                        }}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => printBillInvoice(bill, language, hospitalBranding)}
                          title={isHi ? "A4 चालान प्रिंट करें" : "Print A4 Invoice"}
                          style={{
                            background: isDark ? "#1E293B" : "#F1F5F9",
                            color: textColor,
                            border: `1px solid ${cardBorder}`,
                            padding: "4px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <Printer size={13} color="#0284C7" />
                        </button>
                        {bill.payments && bill.payments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => printPaymentReceipt(bill.payments[0], language, hospitalBranding, "thermal")}
                            title={isHi ? "80mm POS रसीद प्रिंट करें" : "Print POS Receipt"}
                            style={{
                              background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                              color: "#0284C7",
                              border: "1px solid rgba(2, 132, 199, 0.4)",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                          >
                            <Receipt size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {billsArchiveList.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: mutedText }}>
                      {loadingArchive ? (isHi ? "लोड हो रहा है..." : "Loading bills...") : (isHi ? "कोई चालान नहीं मिला।" : "No bills matching criteria.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DAILY COLLECTIONS & FINANCIAL REPORTS                              */}
      {/* ========================================================================= */}
      {activeTab === "reports" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Mode Breakdown */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "16px", padding: "16px 20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, margin: "0 0 14px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <Wallet size={16} color="#0284C7" />
              {isHi ? "भुगतान माध्यम अनुसार संकलन (Mode Breakdown)" : "Collection by Payment Mode"}
            </h3>
            <div
              className="billing-scrollable"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "360px",
                overflowY: "auto",
                paddingRight: "6px",
              }}
            >
              {Object.entries(dailyReport.by_mode || {}).map(([mode, amt]) => (
                <div key={mode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: isDark ? "#1E293B" : "#F8FAFC", borderRadius: "8px", border: `1px solid ${cardBorder}` }}>
                  <span style={{ fontWeight: 700 }}>{mode.toUpperCase()}</span>
                  <strong style={{ color: "#0284C7" }}>₹{Number(amt).toLocaleString()}</strong>
                </div>
              ))}
              {Object.keys(dailyReport.by_mode || {}).length === 0 && (
                <div style={{ color: mutedText, fontSize: "12px", textAlign: "center", padding: "16px" }}>
                  {isHi ? "आज कोई भुगतान दर्ज नहीं हुआ।" : "No payments recorded today."}
                </div>
              )}
            </div>
          </div>

          {/* Department Breakdown */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "16px", padding: "16px 20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, margin: "0 0 14px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <Building2 size={16} color="#38BDF8" />
              {isHi ? "विभाग अनुसार बिलिंग (Department Breakdown)" : "Revenue by Department"}
            </h3>
            <div
              className="billing-scrollable"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "360px",
                overflowY: "auto",
                paddingRight: "6px",
              }}
            >
              {Object.entries(dailyReport.by_department || {}).map(([dept, amt]) => (
                <div key={dept} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: isDark ? "#1E293B" : "#F8FAFC", borderRadius: "8px", border: `1px solid ${cardBorder}` }}>
                  <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{dept}</span>
                  <strong style={{ color: "#38BDF8" }}>₹{Number(amt).toLocaleString()}</strong>
                </div>
              ))}
              {Object.keys(dailyReport.by_department || {}).length === 0 && (
                <div style={{ color: mutedText, fontSize: "12px", textAlign: "center", padding: "16px" }}>
                  {isHi ? "आज कोई मद बिल नहीं हुई।" : "No department charges billed today."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CASH SHIFTS & CLOSING RECONCILIATION                               */}
      {/* ========================================================================= */}
      {activeTab === "shift" && (
        <div
          className="billing-scrollable"
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "16px",
            padding: "20px 24px",
            maxHeight: "78vh",
            overflowY: "auto",
            paddingRight: "16px",
          }}
        >
          <div style={{ borderBottom: `1px solid ${cardBorder}`, paddingBottom: "14px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 900, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <Wallet size={18} color="#0284C7" />
                {isHi ? "दैनिक कैश रजिस्टर एवं शिफ्ट प्रबंधन" : "Day-End Cash Shift Reconciliation"}
              </h2>
              <div style={{ fontSize: "11.5px", color: mutedText }}>
                {isHi ? "कैशियर हैंडओवर एवं भौतिक नकदी ऑडिट" : "Audit physical counted cash against system recorded cash payments"}
              </div>
            </div>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "9999px",
                fontSize: "11px",
                fontWeight: 800,
                background: shiftStatus ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.15)",
                color: shiftStatus ? "#10B981" : mutedText,
              }}
            >
              {shiftStatus ? (isHi ? "शिफ्ट खुली है" : "SHIFT OPEN") : (isHi ? "शिफ्ट बंद" : "SHIFT CLOSED")}
            </span>
          </div>

          {shiftStatus ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", padding: "12px 16px", borderRadius: "10px", border: `1px solid ${cardBorder}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                  <div>
                    <span style={{ color: mutedText, fontSize: "10.5px" }}>Shift Opened At:</span>
                    <strong style={{ display: "block" }}>{new Date(shiftStatus.opened_at).toLocaleTimeString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: mutedText, fontSize: "10.5px" }}>Opening Cash Balance:</span>
                    <strong style={{ display: "block" }}>₹{Number(shiftStatus.opening_cash || 0).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: mutedText, fontSize: "10.5px" }}>Cash Collected During Shift:</span>
                    <strong style={{ display: "block", color: "#0284C7" }}>₹{Number(shiftStatus.cash_collected || 0).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: mutedText, fontSize: "10.5px" }}>Expected Cash in Drawer:</span>
                    <strong style={{ display: "block", color: "#38BDF8", fontSize: "14px" }}>₹{Number(shiftStatus.expected_cash || 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCloseShiftModal(true)}
                style={{
                  background: "#DC2626",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isHi ? "शिफ्ट बंद करें एवं नकदी मिलान करें" : "Reconcile & Close Cash Shift"}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 12px" }}>
              <Wallet size={36} color={mutedText} style={{ margin: "0 auto 10px auto", opacity: 0.5 }} />
              <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "4px" }}>
                {isHi ? "कोई खुली कैश शिफ्ट नहीं है" : "No Active Shift Open"}
              </div>
              <div style={{ fontSize: "12px", color: mutedText, marginBottom: "16px" }}>
                {isHi ? "काउंटर पर नकद स्वीकारने हेतु कृपया अपनी शिफ्ट प्रारंभ करें।" : "Please open a shift and record your starting drawer cash to accept payments."}
              </div>
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(true)}
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                }}
              >
                {isHi ? "+ नई कैश शिफ्ट खोलें" : "+ Open New Shift"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD PAYMENT MODAL                                             */}
      {/* ========================================================================= */}
      {showPaymentModal && currentCreatedBill && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div
            className="billing-scrollable"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "18px",
              width: "100%",
              maxWidth: "460px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "20px 24px",
              color: textColor,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${cardBorder}`, paddingBottom: "12px", marginBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 900, margin: 0, color: "#0284C7" }}>
                  {isHi ? "भुगतान दर्ज करें (Record Payment)" : "Record Payment & Issue Receipt"}
                </h3>
                <span style={{ fontSize: "11px", color: mutedText }}>Invoice: {currentCreatedBill.bill_number}</span>
              </div>
              <button type="button" onClick={() => setShowPaymentModal(false)} style={{ background: "none", border: "none", color: mutedText, fontSize: "16px", cursor: "pointer" }}>✕</button>
            </div>

            {/* Total Balance Due Box */}
            <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", padding: "10px 14px", borderRadius: "10px", marginBottom: "14px", textAlign: "center", border: `1px solid ${cardBorder}` }}>
              <div style={{ fontSize: "10.5px", color: mutedText, textTransform: "uppercase" }}>Balance Due</div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#0284C7" }}>₹{Number(currentCreatedBill.balance_due || currentCreatedBill.grand_total).toFixed(2)}</div>
            </div>

            {/* Mode Selector */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "6px" }}>Payment Mode</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {["Cash", "UPI", "Card", "Net Banking", "Cheque", "Insurance-TPA"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMode(m)}
                    style={{
                      padding: "8px 4px",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: paymentMode === m ? "1.5px solid #0284C7" : `1px solid ${cardBorder}`,
                      background: paymentMode === m ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : inputBg,
                      color: paymentMode === m ? "#0284C7" : textColor,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>Amount Received (₹)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontWeight: 800, fontSize: "14px" }}
                />
              </div>

              {paymentMode === "Cash" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "10.5px", color: mutedText, display: "block", marginBottom: "4px" }}>Cash Given by Patient (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 1000"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontWeight: 700, fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10.5px", color: mutedText, display: "block", marginBottom: "4px" }}>Change to Return (₹)</label>
                    <div style={{ padding: "7px 10px", background: isDark ? "#064E3B" : "#ECFDF5", borderRadius: "8px", color: "#047857", fontWeight: 900, fontSize: "13px", border: "1px solid #A7F3D0" }}>
                      ₹{cashChangeReturn.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {paymentMode !== "Cash" && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>Txn Reference / UPI Ref / Auth Code</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-9821839210 or POS-AUTH-4412"
                    value={paymentRefNo}
                    onChange={(e) => setPaymentRefNo(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmitPayment}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                padding: "10px",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
              }}
            >
              <CheckCircle2 size={16} />
              <span>{isHi ? "भुगतान पूर्ण करें एवं रसीद दें" : "Complete Payment & Print Receipt"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: WALK-IN BILLING MODAL                                            */}
      {/* ========================================================================= */}
      {isWalkInModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div
            className="billing-scrollable"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "18px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "22px 24px",
              color: textColor,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid ${cardBorder}`, paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 900, margin: 0, color: "#0284C7" }}>
                  {isHi ? "प्रत्यक्ष वॉक-इन मरीज़ बिलिंग" : "Direct Walk-In Patient Billing"}
                </h3>
                <p style={{ margin: "3px 0 0 0", fontSize: "11px", color: mutedText }}>
                  {isHi ? "बिना अपॉइंटमेंट / टोकन त्वरित मरीज़ पंजीकरण एवं स्पॉट डेस्क बिलिंग" : "Instant patient registration, clinical routing & spot desk billing"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                style={{ background: "none", border: "none", color: mutedText, fontSize: "18px", cursor: "pointer", padding: "2px 6px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "18px" }}>
              {/* SECTION 1: Patient Demographics */}
              <div style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC", border: `1px solid ${cardBorder}`, borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>👤</span>
                  <span>{isHi ? "1. मरीज़ पहचान एवं जनसांख्यिकी" : "1. Patient Identification & Demographics"}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "पूरा नाम *" : "Full Name *"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={walkInForm.patient_name}
                      onChange={(e) => setWalkInForm({ ...walkInForm, patient_name: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "UHID / मेडिकल आईडी" : "UHID / Medical ID"}
                    </label>
                    <input
                      type="text"
                      placeholder="Auto if blank"
                      value={walkInForm.uhid}
                      onChange={(e) => setWalkInForm({ ...walkInForm, uhid: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px", fontFamily: "monospace" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "आयु (वर्ष) *" : "Age (Yrs) *"}
                    </label>
                    <input
                      type="number"
                      placeholder="35"
                      min="0"
                      max="125"
                      value={walkInForm.age}
                      onChange={(e) => setWalkInForm({ ...walkInForm, age: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "लिंग *" : "Gender *"}
                    </label>
                    <select
                      value={walkInForm.gender}
                      onChange={(e) => setWalkInForm({ ...walkInForm, gender: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    >
                      <option value="Male">{isHi ? "पुरुष (Male)" : "Male"}</option>
                      <option value="Female">{isHi ? "महिला (Female)" : "Female"}</option>
                      <option value="Other">{isHi ? "अन्य (Other)" : "Other"}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "रक्त समूह" : "Blood Group"}
                    </label>
                    <select
                      value={walkInForm.blood_group}
                      onChange={(e) => setWalkInForm({ ...walkInForm, blood_group: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    >
                      <option value="">{isHi ? "अज्ञात / N/A" : "Unknown"}</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Contact & Guardian Details */}
              <div style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC", border: `1px solid ${cardBorder}`, borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📞</span>
                  <span>{isHi ? "2. संपर्क एवं अभिभावक विवरण" : "2. Contact & Guardian Details"}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "मोबाइल नंबर *" : "Phone Number *"}
                    </label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile"
                      maxLength={15}
                      value={walkInForm.phone}
                      onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "पिता / पति / अभिभावक का नाम" : "Father / Guardian / Spouse"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Suresh Kumar"
                      value={walkInForm.guardian_name}
                      onChange={(e) => setWalkInForm({ ...walkInForm, guardian_name: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "आवासीय पता" : "Residential Address"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. House No. 45, Sector 12"
                      value={walkInForm.address}
                      onChange={(e) => setWalkInForm({ ...walkInForm, address: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "शहर / पिनकोड" : "City / Pincode"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Delhi - 110001"
                      value={walkInForm.city}
                      onChange={(e) => setWalkInForm({ ...walkInForm, city: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Clinical & Billing Classification */}
              <div style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC", border: `1px solid ${cardBorder}`, borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🏥</span>
                  <span>{isHi ? "3. बिलिंग श्रेणी एवं क्लिनिकल संदर्भ" : "3. Clinical & Billing Classification"}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "बिलिंग श्रेणी" : "Billing Category / Tariff Type"}
                    </label>
                    <select
                      value={walkInForm.billing_category}
                      onChange={(e) => setWalkInForm({ ...walkInForm, billing_category: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    >
                      <option value="General">General / Standard</option>
                      <option value="Private OPD">Private OPD / Deluxe</option>
                      <option value="Corporate">Corporate / Staff Panel</option>
                      <option value="Insurance-TPA">Insurance / TPA Mediclaim</option>
                      <option value="Ayushman-BPL">Ayushman Bharat (PM-JAY) / BPL</option>
                      <option value="Senior Citizen">Senior Citizen (Concessional)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "प्रमाणपत्र / TPA कार्ड सं." : "Govt / TPA / ID Card No."}
                    </label>
                    <input
                      type="text"
                      placeholder="Optional (e.g. ABHA / Policy #)"
                      value={walkInForm.id_proof}
                      onChange={(e) => setWalkInForm({ ...walkInForm, id_proof: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "संदर्भित डॉक्टर" : "Referring / Attending Doctor"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. A. Sharma / Self"
                      value={walkInForm.doctor_name}
                      onChange={(e) => setWalkInForm({ ...walkInForm, doctor_name: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      {isHi ? "विभाग" : "Target Department"}
                    </label>
                    <select
                      value={walkInForm.department}
                      onChange={(e) => setWalkInForm({ ...walkInForm, department: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                    >
                      <option value="General Consultation">General OPD</option>
                      <option value="Pathology">Pathology & Lab Tests</option>
                      <option value="Radiology">Radiology & X-Ray</option>
                      <option value="Pharmacy">Pharmacy / Dispensary</option>
                      <option value="Emergency Triage">Emergency & Trauma</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="Gynecology">Gynecology</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Clinical Indication / Notes */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                  {isHi ? "प्रमुख लक्षण / बिलिंग टिप्पणी" : "Chief Complaint / Clinical Indication / Billing Remarks"}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spot blood profile tests, urgent ECG, or direct medication purchase"
                  value={walkInForm.notes}
                  onChange={(e) => setWalkInForm({ ...walkInForm, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                style={{
                  flex: "0 0 90px",
                  background: isDark ? "#334155" : "#E2E8F0",
                  color: textColor,
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isHi ? "रद्द करें" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!walkInForm.patient_name.trim()) {
                    showToast(isHi ? "मरीज़ का नाम आवश्यक है।" : "Patient full name is required.", "warn");
                    return;
                  }
                  if (!walkInForm.phone.trim()) {
                    showToast(isHi ? "मरीज़ का मोबाइल नंबर आवश्यक है।" : "Patient mobile number is required.", "warn");
                    return;
                  }
                  setActivePatientData({
                    name: walkInForm.patient_name.trim(),
                    full_name: walkInForm.patient_name.trim(),
                    age: walkInForm.age,
                    gender: walkInForm.gender,
                    phone: walkInForm.phone.trim(),
                    uhid: walkInForm.uhid.trim(),
                    medical_id: walkInForm.uhid.trim(),
                    guardian_name: walkInForm.guardian_name.trim(),
                    address: walkInForm.address.trim(),
                    city: walkInForm.city.trim(),
                    blood_group: walkInForm.blood_group,
                    billing_category: walkInForm.billing_category,
                    doctor_name: walkInForm.doctor_name.trim(),
                    department: walkInForm.department,
                    id_proof: walkInForm.id_proof.trim(),
                    notes: walkInForm.notes.trim(),
                    is_walkin: true,
                  });
                  setCurrentCreatedBill(null);
                  setIsWalkInModalOpen(false);
                  showToast(isHi ? "वॉक-इन मरीज़ विवरण सफलतापूर्वक सेट हुआ ✓" : "Walk-in patient profile initialized ✓", "success");
                }}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                }}
              >
                <CheckCircle2 size={16} />
                <span>{isHi ? "बिलिंग शुरू करें" : "Start Spot Billing"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: OPEN CASH SHIFT MODAL                                            */}
      {/* ========================================================================= */}
      {showOpenShiftModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div
            className="billing-scrollable"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "18px",
              width: "100%",
              maxWidth: "420px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "20px 24px",
              color: textColor,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 900, margin: "0 0 12px 0", color: "#0284C7" }}>
              {isHi ? "नई कैश शिफ्ट खोलें" : "Open New Cash Shift"}
            </h3>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                Starting Drawer Cash (₹)
              </label>
              <input
                type="number"
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "13px", fontWeight: 800 }}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>Notes (Optional)</label>
              <input
                type="text"
                placeholder={isHi ? "उदा. प्रातः डेस्क शिफ्ट प्रारंभ" : "e.g. Morning desk opening"}
                value={shiftNotesInput}
                onChange={(e) => setShiftNotesInput(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "12px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={() => setShowOpenShiftModal(false)} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: `1px solid ${cardBorder}`, background: "none", color: mutedText, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={handleOpenShift} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)", color: "#FFF", fontWeight: 800, cursor: "pointer" }}>Start Shift</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CLOSE CASH SHIFT MODAL                                           */}
      {/* ========================================================================= */}
      {showCloseShiftModal && shiftStatus && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div
            className="billing-scrollable"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "18px",
              width: "100%",
              maxWidth: "440px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "20px 24px",
              color: textColor,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 900, margin: "0 0 12px 0", color: "#DC2626" }}>
              {isHi ? "कैश शिफ्ट बंद व नकदी मिलान" : "Close Shift & Audit Cash"}
            </h3>
            <div style={{ background: isDark ? "#1E293B" : "#F8FAFC", padding: "10px", borderRadius: "8px", marginBottom: "12px", fontSize: "12px" }}>
              Expected Cash in Drawer: <strong style={{ color: "#0284C7" }}>₹{Number(shiftStatus.expected_cash || 0).toFixed(2)}</strong>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                Physically Counted Cash in Drawer (₹) *
              </label>
              <input
                type="number"
                placeholder="Enter actual counted cash"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: "8px", color: textColor, fontSize: "14px", fontWeight: 800 }}
              />
            </div>
            {countedCashInput && (
              <div style={{ marginBottom: "14px", fontSize: "12px", color: (Number(countedCashInput) - Number(shiftStatus.expected_cash || 0)) === 0 ? "#10B981" : "#EF4444" }}>
                Difference: <strong>₹{(Number(countedCashInput) - Number(shiftStatus.expected_cash || 0)).toFixed(2)}</strong>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={() => setShowCloseShiftModal(false)} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: `1px solid ${cardBorder}`, background: "none", color: mutedText, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={handleCloseShift} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 800, cursor: "pointer" }}>Confirm & Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Footer */}
      <Footer hospitalBranding={hospitalBranding} language={language} theme={theme} />
    </div>
  );
}
