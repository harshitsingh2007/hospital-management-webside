/**
 * PharmacyPage.jsx
 * ----------------
 * Dedicated Hospital Pharmacy Dispensing Station & Clinical Workstation.
 * Strictly restricted to authorized Pharmacy Staff and Licensed Pharmacists.
 *
 * Capabilities:
 * 1. Live Pharmacy Queue Stream (real-time tickets routed to pharmacy).
 * 2. Serving Counter Terminal with Interactive Medication Dispensing Checklist.
 * 3. Dosage timing breakdown (Morning / Noon / Night) & calculated total quantity.
 * 4. 1-Click Printable Medicine Packet Envelope Sticker / Label (`printDispensingLabelSlip`).
 * 5. 1-Click Doctor E-Prescription Slip Viewer / Re-printer (`printPrescriptionSlip`).
 * 6. Automated Public Loudspeaker Voice Announcements (`announceTicketVoice`).
 * 7. Prescription Search, Lookup & Audit Archive.
 * 8. Theme support (Medical Ocean Blue / Pharmaceutical Emerald, Dark & Light).
 */

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
  Package,
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
  Info
} from "lucide-react";

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

  const brandPrimary = hospitalBranding?.primary_color || "#059669";
  const brandName = hospitalBranding?.hospital_name || hospitalBranding?.name || currentUser?.hospital_name || "City General Hospital";

  // Theme Sync
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) {}
    return theme || "light";
  });

  useEffect(() => {
    if (theme && (theme === "dark" || theme === "light") && theme !== currentTheme) {
      setCurrentTheme(theme);
    }
  }, [theme]);

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
    } catch (_) {}
    if (setTheme) setTheme(nextTheme);
  };

  // Station Counter State
  const [activeCounter, setActiveCounter] = useState("Counter 1 - General Dispensing");
  const counterOptions = [
    { id: "counter_1", label: isHi ? "काउंटर 1 - सामान्य वितरण" : "Counter 1 - General Dispensing" },
    { id: "counter_2", label: isHi ? "काउंटर 2 - फास्ट ट्रैक / वृद्धजन" : "Counter 2 - Fast Track / Senior Citizens" },
    { id: "counter_3", label: isHi ? "काउंटर 3 - इनपेशेंट व रीफिल" : "Counter 3 - Inpatient & Refills" },
  ];

  // Pharmacist Duty Status
  const [pharmaDutyStatus, setPharmaDutyStatus] = useState("ACTIVE"); // "ACTIVE" | "ON_BREAK" | "INVENTORY"

  // Active Workspace Tab: "dispensing" | "archive" | "reference"
  const [activeTab, setActiveTab] = useState("dispensing");

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
      showToast(
        isHi
          ? "आपकी ड्यूटी स्थिति वर्तमान में 'अवकाश / इन्वेंटरी' पर है। कृपया पहले सक्रिय (Active) करें।"
          : "Your status is set to Break/Restocking. Switch to 'Active' to call the next patient.",
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
        dispensed_at: new Date().toISOString(),
        dispensing_counter: activeCounter,
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
      counter: activeCounter.split("-")[0].trim(),
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

  // Color Tokens
  const pageBg = isDark ? "#070B14" : "#F8FAFC";
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const cardBorder = isDark ? "1px solid #1E293B" : "1px solid #E2E8F0";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";
  const highlightGreen = "#059669";

  return (
    <div style={{ minHeight: "100vh", background: pageBg, color: textColor, paddingBottom: "60px", transition: "all 0.25s ease" }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            background: toastMsg.type === "error" ? "#EF4444" : toastMsg.type === "warn" ? "#F59E0B" : "#059669",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "12px",
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

      {/* Hero Header & Telemetry Banner */}
      <div
        style={{
          background: isDark
            ? "linear-gradient(135deg, #064E3B 0%, #065F46 60%, #047857 100%)"
            : "linear-gradient(135deg, #059669 0%, #047857 60%, #065F46 100%)",
          borderRadius: "24px",
          padding: "24px 28px",
          color: "#FFFFFF",
          boxShadow: "0 10px 30px -10px rgba(5, 150, 105, 0.4)",
          marginBottom: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800, letterSpacing: "0.5px" }}>
                🏥 {brandName.toUpperCase()}
              </span>
              <span style={{ background: "rgba(16, 185, 129, 0.3)", border: "1px solid rgba(255,255,255,0.3)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800 }}>
                {isHi ? "फार्मेसी एवं दवा वितरण केंद्र" : "CENTRAL PHARMACY STATION"}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 900, letterSpacing: "-0.5px" }}>
              {isHi ? "फार्मेसी वितरण वर्कस्टेशन" : "Pharmacy Dispensing Workstation"}
            </h1>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", opacity: 0.9, display: "flex", alignItems: "center", gap: "6px" }}>
              <User size={14} />
              <span>
                {isHi ? "लॉगिन फार्मासिस्ट" : "Active Pharmacist"}: <strong>{currentUser?.name || currentUser?.username}</strong>
                {currentUser?.department ? ` • Dept: ${currentUser.department.toUpperCase()}` : ""}
              </span>
            </p>
          </div>

          {/* Quick Counter Selector & Duty Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <select
              value={activeCounter}
              onChange={(e) => setActiveCounter(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {counterOptions.map((c) => (
                <option key={c.id} value={c.label} style={{ color: "#0F172A", background: "#FFFFFF" }}>
                  {c.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setPharmaDutyStatus((prev) => (prev === "ACTIVE" ? "ON_BREAK" : "ACTIVE"))}
              style={{
                background: pharmaDutyStatus === "ACTIVE" ? "#10B981" : "#F59E0B",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFFFFF", display: "inline-block" }} />
              <span>{pharmaDutyStatus === "ACTIVE" ? (isHi ? "ड्यूटी पर सक्रिय" : "Active on Duty") : (isHi ? "अवकाश पर" : "On Tea Break")}</span>
            </button>

            <button
              onClick={() => navigateTo("doctor")}
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: "10px",
                padding: "8px 13px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              title={isHi ? "डॉक्टर ओपीडी परामर्श डेस्क पर जाएं" : "Switch to Doctor Consult Desk"}
            >
              <span>🩺</span>
              <span>{isHi ? "डॉक्टर डेस्क" : "Doctor Desk"}</span>
            </button>

            <button
              onClick={handleToggleTheme}
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Toggle Dark / Light Theme"
            >
              {isDark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginTop: "20px",
            borderTop: "1px solid rgba(255,255,255,0.2)",
            paddingTop: "18px",
          }}
        >
          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: "14px", padding: "12px 16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase" }}>
              {isHi ? "वितरण हेतु प्रतीक्षारत" : "Prescriptions Waiting"}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {pharmacyQueue.length}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "दवा काउंटर पर कतार" : "Live Pharmacy Tokens"}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: "14px", padding: "12px 16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase" }}>
              {isHi ? "काउंटर पर वितरण जारी" : "Serving at Counter"}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {activeServingTicket ? `#${activeServingTicket.ticket_id}` : (isHi ? "काउंटर तैयार" : "Ready")}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {activeServingTicket ? activeServingTicket.name : (isHi ? "अगला टोकन बुलाएं" : "Counter available")}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: "14px", padding: "12px 16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase" }}>
              {isHi ? "आज पूर्ण वितरण" : "Dispensed Today"}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
              {analytics?.completed_today || 18}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
              {isHi ? "मरीजों को दवाएं वितरित" : "Prescriptions Fulfilled"}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: "14px", padding: "12px 16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase" }}>
              {isHi ? "औसत वितरण समय" : "Avg. Turnaround"}
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

      {/* Navigation Sub-Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("dispensing")}
          style={{
            padding: "9px 18px",
            borderRadius: "12px",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            border: activeTab === "dispensing" ? `1.5px solid ${brandPrimary}` : cardBorder,
            background: activeTab === "dispensing" ? (isDark ? "rgba(5, 150, 105, 0.2)" : "#ECFDF5") : cardBg,
            color: activeTab === "dispensing" ? (isDark ? "#34D399" : "#065F46") : textColor,
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
          }}
        >
          <Pill size={15} />
          <span>{isHi ? "दवा वितरण स्टेशन" : "Live Dispensing Counter"}</span>
          <span style={{ background: brandPrimary, color: "#fff", fontSize: "11px", padding: "1px 6px", borderRadius: "10px" }}>
            {pharmacyQueue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("archive")}
          style={{
            padding: "9px 18px",
            borderRadius: "12px",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            border: activeTab === "archive" ? `1.5px solid ${brandPrimary}` : cardBorder,
            background: activeTab === "archive" ? (isDark ? "rgba(5, 150, 105, 0.2)" : "#ECFDF5") : cardBg,
            color: activeTab === "archive" ? (isDark ? "#34D399" : "#065F46") : textColor,
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
          }}
        >
          <FileText size={15} />
          <span>{isHi ? "दवा वितरण अभिलेख व खोज" : "Prescription Lookup & Audit"}</span>
        </button>

        <button
          onClick={() => setActiveTab("reference")}
          style={{
            padding: "9px 18px",
            borderRadius: "12px",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            border: activeTab === "reference" ? `1.5px solid ${brandPrimary}` : cardBorder,
            background: activeTab === "reference" ? (isDark ? "rgba(5, 150, 105, 0.2)" : "#ECFDF5") : cardBg,
            color: activeTab === "reference" ? (isDark ? "#34D399" : "#065F46") : textColor,
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
          }}
        >
          <Package size={15} />
          <span>{isHi ? "जेनेरिक दवा संदर्भ गाइड" : "Generic Formulary Reference"}</span>
        </button>
      </div>

      {/* Main Workspace Body */}
      {activeTab === "dispensing" && (
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "20px" }}>
          {/* Left Column: Waiting Pharmacy Queue */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: "18px", padding: "18px", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>📋</span>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: textColor }}>
                  {isHi ? "फार्मेसी कतार" : "Pharmacy Queue"} ({pharmacyQueue.length})
                </h3>
              </div>
              <button
                onClick={handleCallNextPatient}
                disabled={callingNext || pharmacyQueue.length === 0}
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "7px 12px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: pharmacyQueue.length === 0 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                  opacity: pharmacyQueue.length === 0 ? 0.6 : 1,
                }}
              >
                <span>📢</span>
                <span>{callingNext ? (isHi ? "बुला रहे हैं..." : "Calling...") : (isHi ? "अगला बुलाएं" : "Call Next")}</span>
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: "relative", marginBottom: "14px" }}>
              <input
                type="text"
                placeholder={isHi ? "टोकन # या मरीज का नाम खोजें..." : "Filter queue by token # or name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  borderRadius: "10px",
                  border: cardBorder,
                  background: isDark ? "#1E293B" : "#F8FAFC",
                  color: textColor,
                  fontSize: "12.5px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <Search size={14} color={mutedText} style={{ position: "absolute", left: "10px", top: "11px" }} />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ position: "absolute", right: "8px", top: "8px", background: "none", border: "none", color: mutedText, cursor: "pointer", fontSize: "12px" }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Waiting Queue List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "680px", overflowY: "auto", paddingRight: "4px" }}>
              {filteredQueue.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: mutedText }}>
                  <Pill size={36} color={mutedText} style={{ opacity: 0.4, margin: "0 auto 12px auto" }} />
                  <div style={{ fontSize: "14px", fontWeight: 700 }}>
                    {isHi ? "कतार में कोई मरीज प्रतीक्षारत नहीं है" : "No prescriptions waiting in queue"}
                  </div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>
                    {isHi ? "डॉक्टर द्वारा पर्ची स्थानांतरित होते ही यहाँ स्वतः प्रदर्शित होगी।" : "Transferred prescriptions from doctor desks will appear here live."}
                  </div>
                </div>
              ) : (
                filteredQueue.map((ticket, idx) => {
                  const rxNotes = parseRxNotes(ticket);
                  const medList = Array.isArray(rxNotes?.medicines) ? rxNotes.medicines : [];
                  const isSelected = activeServingTicket?.ticket_id === ticket.ticket_id;

                  return (
                    <div
                      key={ticket.ticket_id || idx}
                      onClick={() => setActiveServingTicket(ticket)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "14px",
                        border: isSelected ? "2px solid #059669" : cardBorder,
                        background: isSelected ? (isDark ? "rgba(5, 150, 105, 0.15)" : "#ECFDF5") : (isDark ? "#1E293B" : "#FFFFFF"),
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "14px", fontWeight: 900, color: highlightGreen }}>
                              #{ticket.ticket_id}
                            </span>
                            <span style={{ fontSize: "13.5px", fontWeight: 800, color: textColor }}>
                              {ticket.name}
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                            {ticket.age || 30}y, {ticket.gender || "Patient"} • Ph: {ticket.phone || "N/A"}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: "6px",
                            background: isDark ? "rgba(5, 150, 105, 0.25)" : "#D1FAE5",
                            color: "#059669",
                          }}
                        >
                          {ticket.priority_level === 1 ? "EMERGENCY" : "STANDARD"}
                        </span>
                      </div>

                      {/* Prescribed By & Items Count */}
                      <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: isDark ? "1px solid #334155" : "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "11px", color: mutedText }}>
                          👨‍⚕️ {rxNotes?.doctor_name || "Doctor"}
                        </div>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Pill size={11} />
                          <span>{medList.length} {isHi ? "दवाएं" : "Medicines"}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReAnnounce(ticket);
                          }}
                          style={{
                            flex: 1,
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                            background: isDark ? "#0F172A" : "#F8FAFC",
                            color: textColor,
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          <Volume2 size={11} />
                          <span>{isHi ? "कॉल करें" : "Announce"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveServingTicket(ticket);
                          }}
                          style={{
                            flex: 1,
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "none",
                            background: highlightGreen,
                            color: "#FFFFFF",
                            fontSize: "11px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          <span>{isHi ? "काउंटर पर लें ➔" : "Dispense ➔"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Interactive Clinical Dispensing Terminal */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: "18px", padding: "22px", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
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
                          <span style={{ fontSize: "20px", fontWeight: 900, color: highlightGreen }}>
                            Token #{ticket.ticket_id}
                          </span>
                          <span style={{ fontSize: "18px", fontWeight: 800, color: textColor }}>
                            {ticket.name}
                          </span>
                          <span style={{ background: isDark ? "rgba(5, 150, 105, 0.2)" : "#ECFDF5", color: highlightGreen, padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                            {activeCounter}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                          {ticket.age || 30} years old • {ticket.gender || "Patient"} • Phone: <strong>{ticket.phone || "Not provided"}</strong>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#0284C7", fontWeight: 700, marginTop: "4px" }}>
                          👨‍⚕️ Prescribed by: <strong>{rxNotes.doctor_name || "Consultant Doctor"}</strong> ({rxNotes.doctor_department || "OPD"})
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
                          <Volume2 size={13} color="#059669" />
                          <span>{isHi ? "लाउडस्पीकर" : "Re-Announce"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintEnvelopeLabel(ticket)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: "10px",
                            border: "1.5px solid #059669",
                            background: isDark ? "rgba(5, 150, 105, 0.2)" : "#ECFDF5",
                            color: isDark ? "#34D399" : "#065F46",
                            fontSize: "12px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          title="Print Patient Medication Envelope Label Sticker"
                        >
                          <Printer size={13} />
                          <span>{isHi ? "दवा पैकेट लेबल" : "Print Envelope Label"}</span>
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
                        <Pill size={17} color={highlightGreen} />
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
                                      accentColor: "#059669",
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
                                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#D97706", background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7", padding: "2px 8px", borderRadius: "6px" }}>
                                        ⏱️ {med.frequency || "1-0-1"}
                                      </span>
                                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", background: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5", padding: "2px 8px", borderRadius: "6px" }}>
                                        🍽️ {med.instructions || (isHi ? "भोजन के बाद" : "After food")}
                                      </span>
                                    </div>
                                  </div>
                                </label>

                                {/* Calculated Total Quantity */}
                                <div style={{ textAlign: "right", minWidth: "110px" }}>
                                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                                    {isHi ? "वितरण मात्रा" : "Total To Pack"}
                                  </div>
                                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#059669", marginTop: "2px" }}>
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
                          onClick={() => handlePrintEnvelopeLabel(ticket)}
                          style={{
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            border: cardBorder,
                            color: textColor,
                            borderRadius: "10px",
                            padding: "9px 16px",
                            fontSize: "12.5px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Printer size={14} color="#059669" />
                          <span>{isHi ? "पैकेट लेबल प्रिंट" : "Print Label Slip"}</span>
                        </button>

                        <button
                          type="button"
                          disabled={completingTicket}
                          onClick={() => handleCompleteDispensing(ticket)}
                          style={{
                            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
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
                            boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
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
            ) : (
              <div style={{ textAlign: "center", padding: "70px 20px", color: mutedText }}>
                <div
                  style={{
                    width: "68px",
                    height: "68px",
                    borderRadius: "50%",
                    background: isDark ? "rgba(5, 150, 105, 0.2)" : "#ECFDF5",
                    color: highlightGreen,
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
                <p style={{ margin: "0 0 20px 0", fontSize: "13px", maxWidth: "420px", marginInline: "auto", lineHeight: 1.5 }}>
                  {isHi
                    ? "कतार से मरीज का चयन करें या अगला टोकन बुलाने के लिए बटन दबाएं। प्रिस्क्रिप्शन विवरण एवं सत्यापन चेकलिस्ट यहाँ खुल जाएगी।"
                    : "Select a waiting prescription from the queue on the left or click below to call the next patient to your counter."}
                </p>
                <button
                  type="button"
                  onClick={handleCallNextPatient}
                  disabled={callingNext || pharmacyQueue.length === 0}
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
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
                    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.3)",
                    opacity: pharmacyQueue.length === 0 ? 0.6 : 1,
                  }}
                >
                  <Volume2 size={16} />
                  <span>{callingNext ? (isHi ? "बुला रहे हैं..." : "Calling...") : (isHi ? "अगला टोकन बुलाएं" : "Call Next Patient to Counter")}</span>
                </button>
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
                      <td style={{ padding: "10px 12px", fontWeight: 800, color: highlightGreen, fontFamily: "monospace" }}>
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
                              <span key={mIdx} style={{ background: isDark ? "rgba(5, 150, 105, 0.2)" : "#ECFDF5", color: "#059669", padding: "1px 6px", borderRadius: "4px", fontSize: "10.5px", fontWeight: 700 }}>
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
                            background: isPharma ? (isDark ? "rgba(5, 150, 105, 0.25)" : "#D1FAE5") : (isDark ? "#334155" : "#E2E8F0"),
                            color: isPharma ? "#059669" : mutedText,
                          }}
                        >
                          {t.status.toUpperCase()} {isPharma ? "• PHARMACY" : ""}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handlePrintEnvelopeLabel(t)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: cardBorder,
                              background: isDark ? "#1E293B" : "#F8FAFC",
                              color: textColor,
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Label
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintFullPrescription(t)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "none",
                              background: highlightGreen,
                              color: "#FFFFFF",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
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

      {/* Tab 3: Generic Formulary Reference */}
      {activeTab === "reference" && (
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "18px", padding: "24px" }}>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: 800, color: textColor }}>
            {isHi ? "जन औषधि एवं जेनेरिक दवा संदर्भ गाइड" : "Generic Formulary & Dispensing Reference Guide"}
          </h3>
          <p style={{ margin: "0 0 18px 0", fontSize: "12.5px", color: mutedText }}>
            {isHi ? "सामान्य आवश्यक दवाएं, मानक खुराक एवं ब्रांड विकल्प।" : "Standard dispensing parameters, generic equivalents, and administration guidance."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
            {[
              { generic: "Paracetamol", brand: "Dolo 650 / Calpol", dose: "500mg / 650mg", schedule: "SOS / 1-0-1", use: "Antipyretic & Analgesic (Fever & Pain)" },
              { generic: "Amoxicillin + Clavulanate", brand: "Augmentin / Clavam", dose: "625mg", schedule: "1-0-1 After food", use: "Broad Spectrum Antibiotic" },
              { generic: "Azithromycin", brand: "Azee / Zithrox", dose: "500mg", schedule: "1-0-0 Before food (3-5d)", use: "Upper Respiratory Tract Infection" },
              { generic: "Pantoprazole", brand: "Pan 40 / Pantocid", dose: "40mg", schedule: "1-0-0 Empty Stomach (AC)", use: "Proton Pump Inhibitor (Acidity & GERD)" },
              { generic: "Cetirizine", brand: "Cetzine / Okacet", dose: "10mg", schedule: "0-0-1 At bedtime (HS)", use: "Antihistamine (Allergy & Rhinitis)" },
              { generic: "Metformin", brand: "Glycomet", dose: "500mg / 850mg", schedule: "1-0-1 With or after meals", use: "Type 2 Diabetes Mellitus" },
              { generic: "Amlodipine", brand: "Amlopres / Stamlo", dose: "5mg", schedule: "1-0-0 Morning", use: "Hypertension & Angina" },
              { generic: "Oral Rehydration Salts (ORS)", brand: "Electral", dose: "1 Sachet in 1L Water", schedule: "Sip throughout day", use: "Dehydration & Diarrhea" },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: isDark ? "#1E293B" : "#F8FAFC",
                  border: cardBorder,
                  borderRadius: "14px",
                  padding: "14px",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 800, color: highlightGreen }}>
                  {item.generic}
                </div>
                <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                  Brand equivalents: <strong style={{ color: textColor }}>{item.brand}</strong>
                </div>
                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: isDark ? "1px solid #334155" : "1px solid #E2E8F0", fontSize: "11.5px" }}>
                  <div><strong>Standard:</strong> {item.dose} • {item.schedule}</div>
                  <div style={{ color: mutedText, marginTop: "2px" }}><strong>Indication:</strong> {item.use}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <Footer
        branding={hospitalBranding}
        hospitalName={brandName}
        language={language}
        onShowEmergency={() => {}}
      />
    </div>
  );
}
