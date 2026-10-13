import React from "react";
import { t, getCategoryLabel, getStatusLabel, formatSymptomLabel, formatCleanText } from "../../utils/i18n";
import { standaloneCardStyle } from "./patientStyles";

/**
 * DigitalTicketPassCard
 * ---------------------
 * Sleek, high-contrast clinical boarding-pass style digital queue pass.
 * Features live queue pulse, structured metric tiles, biometric QR hub, and interactive controls.
 */
export default function DigitalTicketPassCard({
  activeTicket,
  setActiveTicket,
  familyTickets = {},
  onSwitchTicketPass,
  onTakeTicketForMember,
  members = [],
  ticketQrData,
  language = "en",
  onPrint,
  onOpenAdjustModal,
  onOpenCancelModal,
  onOpenPrescriptionSlip,
  parsePrescription,
}) {
  const isEmergency =
    Number(activeTicket.priority_level || activeTicket.priority) === 1 ||
    Boolean(activeTicket.is_emergency) ||
    String(activeTicket.service_category || "").toLowerCase() === "emergency";

  // Status badge styling helper
  const getStatusConfig = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "serving" || s === "in_consultation") {
      return {
        bg: "rgba(16, 185, 129, 0.12)",
        color: "#059669",
        border: "1px solid rgba(16, 185, 129, 0.35)",
        dot: "#10B981",
        label: language === "hi" ? "परामर्श कक्ष में (In Cabin)" : "Now in Consultation",
        pulse: true,
      };
    }
    if (s === "called") {
      return {
        bg: "rgba(2, 132, 199, 0.12)",
        color: "#0284C7",
        border: "1px solid rgba(2, 132, 199, 0.35)",
        dot: "#0284C7",
        label: language === "hi" ? "बुलाया गया (Proceed to Cabin)" : "Called to Doctor Cabin",
        pulse: true,
      };
    }
    if (s === "on_hold" || s === "hold") {
      return {
        bg: "rgba(234, 88, 12, 0.12)",
        color: "#EA580C",
        border: "1px solid rgba(234, 88, 12, 0.35)",
        dot: "#EA580C",
        label: language === "hi" ? "होल्ड पर (On Hold)" : "On Hold (Grace Period)",
        pulse: true,
      };
    }
    if (s === "completed") {
      return {
        bg: "rgba(100, 116, 139, 0.12)",
        color: "#475569",
        border: "1px solid rgba(100, 116, 139, 0.25)",
        dot: "#64748B",
        label: getStatusLabel(status, language),
        pulse: false,
      };
    }
    // Default: waiting
    if (isEmergency) {
      return {
        bg: "rgba(220, 38, 38, 0.12)",
        color: "#DC2626",
        border: "1.5px solid rgba(220, 38, 38, 0.4)",
        dot: "#DC2626",
        label: language === "hi" ? "🚨 आपातकालीन कतार (Emergency P1)" : "🚨 Emergency Triage (Front of Line)",
        pulse: true,
      };
    }
    return {
      bg: "rgba(245, 158, 11, 0.12)",
      color: "#D97706",
      border: "1px solid rgba(245, 158, 11, 0.35)",
      dot: "#F59E0B",
      label: language === "hi" ? "कतार में प्रतीक्षारत (Waiting)" : "Waiting in Line",
      pulse: true,
    };
  };

  const statusConfig = getStatusConfig(activeTicket.status);

  // Symptoms helper
  const rawSymptoms = activeTicket.symptoms;
  const symptomList = Array.isArray(rawSymptoms)
    ? rawSymptoms
    : typeof rawSymptoms === "string" && rawSymptoms.trim()
    ? rawSymptoms.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      style={{
        ...standaloneCardStyle,
        borderRadius: "20px",
        border: "1.5px solid rgba(2, 132, 199, 0.3)",
        boxShadow: "0 10px 30px -4px rgba(2, 132, 199, 0.1), 0 4px 12px rgba(0, 0, 0, 0.03)",
        position: "relative",
        overflow: "hidden",
        padding: "0",
      }}
    >
      <style>{`
        @keyframes queuePassPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.15); }
        }
        .queue-pulse-dot {
          animation: queuePassPulse 2s ease-in-out infinite;
        }
        .pass-action-btn:hover {
          transform: translateY(-1px);
        }
      `}</style>

      {/* Top Gradient Boarding Accent Bar */}
      <div
        style={{
          height: "6px",
          background: "linear-gradient(90deg, #0284C7 0%, #06B6D4 50%, #3B82F6 100%)",
          width: "100%",
        }}
      />

      <div style={{ padding: "clamp(16px, 3vw, 24px)" }}>


        {/* Boarding Pass Meta Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          {/* Left: Security tag & Live queue active */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "rgba(2, 132, 199, 0.1)",
                color: "#0284C7",
                border: "1px solid rgba(2, 132, 199, 0.25)",
                padding: "3px 8px",
                borderRadius: "6px",
              }}
            >
              <span
                className="queue-pulse-dot"
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#0284C7",
                  display: "inline-block",
                }}
              />
              {t("livePassTitle", language)}
            </span>

            <span
              style={{
                fontSize: "10.5px",
                color: "var(--patient-text-sub, #64748B)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>{language === "hi" ? "आधिकारिक डिजिटल पास" : "Official Digital Pass"}</span>
            </span>
          </div>

          {/* Right: Live Status Badge with Pulse */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "8px",
              background: statusConfig.bg,
              color: statusConfig.color,
              border: statusConfig.border,
              fontSize: "11.5px",
              fontWeight: 800,
            }}
          >
            <span
              className={statusConfig.pulse ? "queue-pulse-dot" : ""}
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: statusConfig.dot,
                display: "inline-block",
              }}
            />
            <span>{statusConfig.label}</span>
          </div>
        </div>

        {/* Hero Ticket Boarding Pass Card */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(14, 165, 233, 0.03) 100%)",
            border: "1.5px solid rgba(2, 132, 199, 0.2)",
            borderRadius: "16px",
            padding: "16px 20px",
            marginBottom: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--patient-text-sub, #64748B)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("tokenId", language)}
              </span>
              {activeTicket.name && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    background: "var(--patient-card-bg, #FFFFFF)",
                    color: "var(--patient-tag-color, #0369A1)",
                    border: "1px solid var(--patient-tag-border, #BAE6FD)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>{activeTicket.name}</span>
                </span>
              )}
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: "clamp(34px, 5vw, 42px)",
                color: "#0284C7",
                fontWeight: 900,
                letterSpacing: "-0.5px",
                lineHeight: 1.1,
              }}
            >
              #{activeTicket.ticket_id}
            </h2>

            <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {/* Department Pill */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#0F172A",
                  background: "var(--patient-card-bg, #FFFFFF)",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--patient-card-border, #CBD5E1)",
                }}
              >
                <span>🏥</span>
                <span>{getCategoryLabel(activeTicket.service_category || "consultation", language)}</span>
              </span>

              {/* Transferred Badge if applicable */}
              {activeTicket.transferred_from_dept && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#0284C7",
                    background: "rgba(14, 165, 233, 0.12)",
                    border: "1px solid #38BDF8",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  🔄 {language === "hi" ? "स्थानांतरित:" : "Transferred from:"} {getCategoryLabel(activeTicket.transferred_from_dept, language)}
                  {activeTicket.parent_ticket_id && <span style={{ opacity: 0.8 }}>(#{activeTicket.parent_ticket_id})</span>}
                </span>
              )}

              {/* Linked Appointment Badge if checked in from slot */}
              {activeTicket.appointment_id && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#0369A1",
                    background: "#E0F2FE",
                    border: "1px solid #BAE6FD",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  📅 {language === "hi" ? "स्लॉट चेक-इन:" : "Slot Check-In:"} {activeTicket.appointment_id}
                </span>
              )}
            </div>
          </div>

          {/* Right Side: Quick Highlight Banner */}
          <div
            style={{
              textAlign: "right",
              background: "var(--patient-card-bg, #FFFFFF)",
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(2, 132, 199, 0.2)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--patient-text-sub, #64748B)", textTransform: "uppercase" }}>
              {language === "hi" ? "प्राथमिकता स्तर" : "Priority Tier"}
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 900,
                color: isEmergency ? "#DC2626" : "#059669",
                marginTop: "2px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {isEmergency ? "🚨 EMERGENCY (P1)" : "STANDARD OPD (P2)"}
            </div>
            <div style={{ fontSize: "10px", color: isEmergency ? "#DC2626" : "var(--patient-text-sub, #94A3B8)", marginTop: "2px", fontWeight: isEmergency ? 800 : 600 }}>
              {isEmergency
                ? (language === "hi" ? "तत्काल प्राथमिकता" : "Immediate Front of Line")
                : (language === "hi" ? `कतार क्रमांक #${activeTicket.position || 1}` : `Queue Sequence #${activeTicket.position || 1}`)}
            </div>
          </div>
        </div>

        {/* 4-Tile High-Impact Metric Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          {/* Tile 1: Patient Demographics */}
          <div
            style={{
              background: "var(--patient-sub-card, #F8FAFC)",
              border: "1px solid var(--patient-card-border, #E2E8F0)",
              borderRadius: "12px",
              padding: "12px 14px",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span style={{ fontSize: "10.5px", color: "var(--patient-text-sub, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>
                {t("patientDemographics", language)}
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", color: "var(--patient-text-main, #0F172A)", fontWeight: 800, fontSize: "14px", wordBreak: "break-word" }}>
              {activeTicket.name}
            </p>
            <span style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", fontWeight: 600 }}>
              {activeTicket.age || 30} {language === "hi" ? "वर्ष" : "yrs"} • {t(activeTicket.gender || "male", language)}
            </span>
          </div>

          {/* Tile 2: Department Category */}
          <div
            style={{
              background: "var(--patient-sub-card, #F8FAFC)",
              border: "1px solid var(--patient-card-border, #E2E8F0)",
              borderRadius: "12px",
              padding: "12px 14px",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              <span style={{ fontSize: "10.5px", color: "var(--patient-text-sub, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>
                {t("deptCategory", language)}
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", color: "#0284C7", fontWeight: 800, fontSize: "14px", wordBreak: "break-word" }}>
              {getCategoryLabel(activeTicket.service_category || "consultation", language)}
            </p>
            <span style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", fontWeight: 600 }}>
              {language === "hi" ? "परामर्श कक्ष" : "Clinical Desk"}
            </span>
          </div>

          {/* Tile 3: Queue Position */}
          <div
            style={{
              background: "var(--patient-sub-card, #F8FAFC)",
              border: "1px solid var(--patient-card-border, #E2E8F0)",
              borderRadius: "12px",
              padding: "12px 14px",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 4 5"/><path d="M3 13h2v-2H3v1h1"/><path d="M3 17h2a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2z"/></svg>
              <span style={{ fontSize: "10.5px", color: "#D97706", fontWeight: 700, textTransform: "uppercase" }}>
                {t("pos", language)}
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", color: "#D97706", fontWeight: 900, fontSize: "24px", lineHeight: 1 }}>
              #{activeTicket.position}
            </p>
            <span style={{ fontSize: "10.5px", color: "var(--patient-text-sub, #64748B)", fontWeight: 600 }}>
              {activeTicket.position <= 1
                ? (language === "hi" ? "आपकी बारी आने वाली है" : "You are next!")
                : (language === "hi" ? `${activeTicket.position - 1} मरीज़ आगे हैं` : `${activeTicket.position - 1} patients ahead`)}
            </span>
          </div>

          {/* Tile 4: Estimated Wait Time */}
          <div
            style={{
              background: "var(--patient-sub-card, #F8FAFC)",
              border: "1px solid var(--patient-card-border, #E2E8F0)",
              borderRadius: "12px",
              padding: "12px 14px",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{ fontSize: "10.5px", color: "#0284C7", fontWeight: 700, textTransform: "uppercase" }}>
                {t("estWait", language)}
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", color: "#0284C7", fontWeight: 900, fontSize: "24px", lineHeight: 1 }}>
              ~{activeTicket.estimated_wait_minutes} <span style={{ fontSize: "13px", fontWeight: 700 }}>{language === "hi" ? "मिनट" : "min"}</span>
            </p>
            <span style={{ fontSize: "10.5px", color: "var(--patient-text-sub, #64748B)", fontWeight: 600 }}>
              {language === "hi" ? "अनुमानित प्रतीक्षा" : "Live dynamic ETA"}
            </span>
          </div>
        </div>

        {/* Symptoms / Clinical Tags (if available) */}
        {symptomList.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
              flexWrap: "wrap",
              background: "var(--patient-sub-card, #F8FAFC)",
              padding: "8px 12px",
              borderRadius: "10px",
              border: "1px solid var(--patient-card-border, #E2E8F0)",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--patient-text-sub, #64748B)" }}>
              🩺 {language === "hi" ? "लक्षण:" : "Reported Symptoms:"}
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {symptomList.map((sym, sIdx) => (
                <span
                  key={sIdx}
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    background: "var(--patient-card-bg, #FFFFFF)",
                    border: "1px solid var(--patient-card-border, #CBD5E1)",
                    color: "var(--patient-text-main, #0F172A)",
                  }}
                >
                  {formatSymptomLabel(sym, language)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Digital E-Prescription (Rx Slip) Section if available or completed */}
        {(activeTicket.prescription_notes || (activeTicket.status || "").toLowerCase() === "completed") && (() => {
          const rx = parsePrescription ? parsePrescription(activeTicket.prescription_notes, activeTicket) : null;
          return (
            <div
              style={{
                marginTop: "16px",
                marginBottom: "16px",
                padding: "16px 18px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(16, 185, 129, 0.06) 50%, rgba(2, 132, 199, 0.08) 100%)",
                border: "2px solid #059669",
                boxShadow: "0 4px 14px rgba(5, 150, 105, 0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  borderBottom: "1px solid rgba(5, 150, 105, 0.25)",
                  paddingBottom: "10px",
                  marginBottom: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#059669",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      fontWeight: 900,
                    }}
                  >
                    ℞
                  </span>
                  <div>
                    <div style={{ fontSize: "14.5px", fontWeight: 900, color: "#10B981", letterSpacing: "-0.2px" }}>
                      {language === "hi" ? "डिजिटल दवा पर्ची (ई-प्रिस्क्रिप्शन)" : "Digital E-Prescription (Rx Slip)"}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#34D399", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                      <span>{rx?.doctor_name ? rx.doctor_name : "Consultant Physician"} {rx?.doctor_department ? `• ${rx.doctor_department}` : ""}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="view-active-rx-slip-btn"
                  onClick={() => onOpenPrescriptionSlip && onOpenPrescriptionSlip(activeTicket.prescription_notes, activeTicket)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#FFFFFF",
                    fontSize: "12.5px",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span>{language === "hi" ? "दवा पर्ची देखें (Rx)" : "View / Print Rx Slip"}</span>
                </button>
              </div>

              {rx?.diagnosis && (
                <div style={{ fontSize: "12.5px", color: "#10B981", marginBottom: "6px" }}>
                  <strong style={{ color: "var(--patient-text-main, #0F172A)" }}>{language === "hi" ? "निदान" : "Diagnosis"}:</strong>{" "}
                  <span style={{ fontWeight: 700, color: "#059669", background: "var(--patient-tag-bg, #D1FAE5)", padding: "2px 8px", borderRadius: "5px", border: "1px solid rgba(5, 150, 105, 0.3)" }}>
                    {formatCleanText(rx.diagnosis, language)}
                  </span>
                </div>
              )}

              {rx?.medicines && rx.medicines.length > 0 && (
                <div style={{ marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#10B981", textTransform: "uppercase" }}>
                    {language === "hi" ? "दवाइयाँ" : "Prescribed Medicines"}:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                    {rx.medicines.map((m, mIdx) => (
                      <span
                        key={mIdx}
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "var(--patient-card-bg, #FFFFFF)",
                          border: "1px solid var(--patient-tag-border, #A7F3D0)",
                          color: "#059669",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                        <span>{formatCleanText(m.name, language)} {m.dosage ? `(${formatCleanText(m.dosage, language)})` : ""}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {rx?.advice && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--patient-text-main, #334155)", background: "var(--patient-card-bg, #FFFFFF)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--patient-tag-border, #A7F3D0)" }}>
                  <strong>{language === "hi" ? "सलाह" : "Advice"}:</strong> {String(rx.advice).replace(/_/g, " ")}
                </div>
              )}
            </div>
          );
        })()}

        {/* Completed Consultation Notice if prescription notes are not yet attached */}
        {activeTicket.status === "completed" && !activeTicket.prescription_notes && (
          <div
            style={{
              marginTop: "14px",
              marginBottom: "14px",
              padding: "12px 16px",
              borderRadius: "10px",
              background: "var(--patient-tag-bg, #F0FDF4)",
              border: "1px solid rgba(5, 150, 105, 0.3)",
              color: "#10B981",
              fontSize: "12.5px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>
              {language === "hi"
                ? "परामर्श पूर्ण हो चुका है। यदि डॉक्टर ने पर्ची दी है तो कृपया फ़ार्मेसी डेस्क पर दिखाएं।"
                : "Consultation completed. If your doctor issued a paper prescription, please show this token at the pharmacy desk."}
            </span>
          </div>
        )}

        {/* Active Ticket Controls: Adjust Queue or Cancel Ticket (WAITING status only) */}
        {activeTicket && (activeTicket.status || "").toLowerCase() === "waiting" && (
          <div style={{ display: "flex", gap: "10px", marginTop: "16px", marginBottom: "18px", flexWrap: "wrap" }}>
            <button
              id="adjust-queue-btn"
              type="button"
              className="pass-action-btn"
              onClick={onOpenAdjustModal}
              disabled={(activeTicket.adjustment_count || 0) >= 3}
              style={{
                flex: 1,
                minWidth: "140px",
                padding: "11px 16px",
                borderRadius: "12px",
                border: (activeTicket.adjustment_count || 0) >= 3 ? "1px solid var(--patient-card-border, #E2E8F0)" : "1.5px solid #0284C7",
                background: (activeTicket.adjustment_count || 0) >= 3 ? "var(--patient-sub-card, #F1F5F9)" : "var(--patient-tag-bg, #F0F9FF)",
                color: (activeTicket.adjustment_count || 0) >= 3 ? "#94A3B8" : "#0284C7",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: (activeTicket.adjustment_count || 0) >= 3 ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>
                {(activeTicket.adjustment_count || 0) >= 3
                  ? (language === "hi" ? "समायोजन सीमा समाप्त (3/3)" : "Adjust Limit Reached (3/3)")
                  : (language === "hi" ? "कतार समायोजित करें" : "Adjust Queue")}
              </span>
            </button>

            <button
              id="cancel-ticket-btn"
              type="button"
              className="pass-action-btn"
              onClick={onOpenCancelModal}
              style={{
                flex: 1,
                minWidth: "140px",
                padding: "11px 16px",
                borderRadius: "12px",
                border: "1.5px solid var(--emergency-card-border, #FECACA)",
                background: "var(--emergency-card-bg, #FEF2F2)",
                color: "var(--emergency-card-text, #DC2626)",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>{language === "hi" ? "टोकन रद्द करें" : "Cancel Ticket"}</span>
            </button>
          </div>
        )}

        {/* Perforated Notched Tear Line */}
        <div
          style={{
            position: "relative",
            margin: "20px 0 16px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: "1px",
              borderTop: "1.5px dashed var(--patient-card-border, #CBD5E1)",
            }}
          />
          <span
            style={{
              position: "relative",
              background: "var(--patient-card-bg, #FFFFFF)",
              padding: "0 12px",
              fontSize: "10px",
              fontWeight: 800,
              color: "var(--patient-text-sub, #94A3B8)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            ✂ {language === "hi" ? "आधिकारिक डिजिटल सत्यापन पास" : "Official Verification Pass"}
          </span>
        </div>

        {/* QR Code Scan Station */}
        {ticketQrData && (
          <div
            style={{
              textAlign: "center",
              background: "var(--patient-sub-card, #F8FAFC)",
              border: "1px solid var(--patient-card-border, #E2E8F0)",
              borderRadius: "16px",
              padding: "16px 14px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "inline-block", position: "relative" }}>
              <img
                src={ticketQrData.qr_code_base64}
                alt="Ticket QR Code"
                style={{
                  width: "135px",
                  height: "135px",
                  borderRadius: "12px",
                  background: "#FFFFFF",
                  padding: "8px",
                  border: "1.5px solid var(--patient-card-border, #CBD5E1)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                  display: "block",
                }}
              />
            </div>
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "var(--patient-text-sub, #64748B)",
              }}
            >
              {t("scanQrHint", language)}
            </p>
          </div>
        )}

        {/* Primary Action: Print Official Pass Slip / Save PDF */}
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            className="pass-action-btn"
            onClick={onPrint}
            style={{
              width: "100%",
              maxWidth: "320px",
              padding: "11px 20px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>{t("printPassBtn", language)}</span>
          </button>
        </div>

        {/* Option to Book Ticket for Family Member */}
        {members && members.length > 0 && (
          <div
            style={{
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: "1px solid var(--patient-card-border, #E2E8F0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "var(--patient-text-sub, #64748B)", fontWeight: 600 }}>
              {language === "hi" ? "अन्य सदस्य के लिए भी टोकन चाहिए?" : "Need a ticket for another family member too?"}
            </span>
            <button
              type="button"
              onClick={() => {
                if (onTakeTicketForMember) {
                  const unbooked = members.find((m) => !familyTickets[m.id]);
                  onTakeTicketForMember(unbooked || null);
                }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                background: "var(--patient-sub-card, #F1F5F9)",
                color: "#0284C7",
                border: "1px solid var(--patient-card-border, #CBD5E1)",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <span>+</span>
              <span>{language === "hi" ? "अन्य सदस्य का टोकन लें" : "Take Ticket for Family Member"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
