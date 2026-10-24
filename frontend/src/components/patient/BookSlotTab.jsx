import React, { useState, useEffect } from "react";
import { t, getCategoryLabel, getStatusLabel } from "../../utils/i18n";
import { HOSPITAL_CONFIG } from "../../config/hospitalConfig";
import { aptConfirmationBoxStyle } from "./patientStyles";
import { getAppointmentTiming } from "../../utils/appointmentTiming";

/**
 * BookSlotTab
 * -----------
 * Future appointment slot booking tab with date picker, slot grid,
 * active ticket guards, and active appointment reminders.
 */
export default function BookSlotTab({
  language = "en",
  hospitalBranding = null,
  selectedMember = null,
  selectedMemberId = "self",
  familyMembers = [],
  handleSelectMember,
  isLiveTicket = false,
  activeTicket = null,
  familyTickets = {},
  isLiveTicketStatus = () => false,
  onOpenCancelModal,
  currentActiveScheduledApt = null,
  handleAppointmentCheckIn,
  handleCancelAppointment,
  registrationStatus = { isClosed: false, reason: "" },
  name,
  setName,
  category,
  setCategory,
  availableDepartments = [],
  getDeptDisplayName = (id) => id,
  aptDate,
  setAptDate,
  bookingDateBounds = { min: "", max: "" },
  aptTimeSlot,
  setAptTimeSlot,
  timeSlotOptions = [],
  isSlotPast = () => false,
  handleBookSlot,
  bookedAppointment = null,
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const activeAptTiming = currentActiveScheduledApt
    ? getAppointmentTiming(currentActiveScheduledApt, currentTime)
    : null;

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ margin: "0 0 4px 0", fontSize: "22px", color: "var(--patient-text-main, #0F172A)", fontWeight: 800, letterSpacing: "-0.4px" }}>
          {t("bookSlot", language)}
        </h2>
        <p style={{ margin: 0, color: "var(--patient-text-sub, #64748B)", fontSize: "13.5px", fontWeight: 500, lineHeight: 1.55 }}>
          {hospitalBranding?.hospital_name || hospitalBranding?.name || HOSPITAL_CONFIG.name} — {language === "hi" ? "भविष्य का समय स्लॉट रिज़र्व करें" : "Reserve a future appointment slot. Scan code upon arrival to merge into priority queue line."}
        </p>
      </div>

      {/* Dependent Booking Notice Banner */}
      {selectedMember && selectedMember.relation !== "self" && (
        <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "10px", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "#1E40AF", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>{t("bookingFor", language)} <strong>{selectedMember.name}</strong> ({t(`relation_${selectedMember.relation}`, language)}, {selectedMember.age} {t("unit_yrs", language)})</span>
          </span>
          <button
            type="button"
            onClick={() => handleSelectMember(familyMembers[0])}
            style={{ background: "none", border: "none", color: "#2563EB", fontSize: "11px", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
          >
            {language === "hi" ? "स्वयं पर स्विच करें" : "Switch to Self"}
          </button>
        </div>
      )}

      {isLiveTicket ? (
        /* ACTIVE TICKET IN PROGRESS CARD (1 Ticket Per Profile Policy) */
        <div
          style={{
            padding: "24px",
            borderRadius: "16px",
            background: "var(--patient-card-bg, #FFFFFF)",
            border: "1.5px solid var(--patient-card-border, #E2E8F0)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
            marginBottom: "20px",
          }}
        >
          {/* Header Status Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: activeTicket.status === "serving" ? "#10B981" : "#0284C7",
                  boxShadow: activeTicket.status === "serving" ? "0 0 0 4px rgba(16, 185, 129, 0.2)" : "0 0 0 4px rgba(2, 132, 199, 0.2)",
                }}
              />
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>
                {t("activeTicketInProgress", language)}
              </span>
            </div>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "999px",
                background: activeTicket.status === "serving" ? "#DCFCE7" : "#E0F2FE",
                color: activeTicket.status === "serving" ? "#15803D" : "#0284C7",
                fontSize: "12px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {getStatusLabel(activeTicket.status, language)}
            </span>
          </div>

          {/* Policy reminder banner */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(2, 132, 199, 0.08)",
              border: "1px solid #BAE6FD",
              marginBottom: "16px",
              fontSize: "12.5px",
              color: "#0369A1",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>{t("oneTicketPerProfilePolicy", language)}</span>
          </div>

          {/* Big Ticket Highlight Box */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(14, 165, 233, 0.02) 100%)",
              border: "1.5px solid #BAE6FD",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#0284C7", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                {selectedMember?.name || activeTicket.name} • {getCategoryLabel(activeTicket.service_category, language)}
              </div>
              <div style={{ fontSize: "32px", fontWeight: 900, color: "#0369A1", letterSpacing: "-0.5px", margin: "4px 0" }}>
                #{activeTicket.ticket_id}
              </div>
              <div style={{ fontSize: "13px", color: "var(--patient-text-sub, #64748B)", fontWeight: 500 }}>
                {activeTicket.status === "serving" ? (
                  language === "hi" ? "वर्तमान में काउंटर पर डॉक्टर द्वारा देखा जा रहा है" : "Currently being served at consultation desk"
                ) : (
                  <>
                    {language === "hi" ? "कतार स्थिति:" : "Queue Position:"}{" "}
                    <strong style={{ color: "var(--patient-text-main, #0F172A)" }}>#{activeTicket.position || 1}</strong>
                    {" • "}
                    {language === "hi" ? "अनुमानित प्रतीक्षा:" : "Est. Wait:"}{" "}
                    <strong style={{ color: "#0284C7" }}>~{Math.round(activeTicket.estimated_wait_minutes || activeTicket.predicted_service_minutes || 10)} min</strong>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("digital-ticket-pass");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h10"/></svg>
                <span>{t("viewPassBtn", language)}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenCancelModal) onOpenCancelModal();
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  background: "#FFF1F2",
                  color: "#DC2626",
                  border: "1px solid #FECACA",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>{t("cancelCurrentTicketBtn", language)}</span>
              </button>
            </div>
          </div>

          {/* Book for Another Family Member Quick Switcher */}
          {Array.isArray(familyMembers) && familyMembers.filter((m) => m && m.id !== selectedMemberId).length > 0 && (
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed var(--patient-card-border, #E2E8F0)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--patient-text-sub, #64748B)", marginBottom: "8px" }}>
                {t("bookForAnotherMember", language)}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {familyMembers.filter((m) => m && m.id !== selectedMemberId).map((m) => {
                  const memTkt = familyTickets[m.id];
                  const hasLive = memTkt && isLiveTicketStatus(memTkt);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectMember(m)}
                      style={{
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: hasLive ? "1px solid #BBF7D0" : "1px solid var(--patient-card-border, #CBD5E1)",
                        background: hasLive ? "#F0FDF4" : "var(--patient-sub-card, #F8FAFC)",
                        color: hasLive ? "#15803D" : "var(--patient-text-main, #0F172A)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{hasLive ? "🎫" : "👤"} {m.name}</span>
                      <span style={{ fontSize: "11px", color: hasLive ? "#16A34A" : "#64748B" }}>
                        ({hasLive ? `#${memTkt.ticket_id}` : (m.relation === "self" ? (language === "hi" ? "स्वयं" : "Self") : (t(`relation_${m.relation}`, language) || m.relation))})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : currentActiveScheduledApt ? (
        /* ACTIVE SCHEDULED APPOINTMENT CARD (1 Booking Per Profile Policy) */
        <div
          style={{
            padding: "24px",
            borderRadius: "16px",
            background: "var(--patient-card-bg, #FFFFFF)",
            border: "1.5px solid var(--patient-card-border, #E2E8F0)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
            marginBottom: "20px",
          }}
        >
          {/* Header Status Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: activeAptTiming?.status === "CHECK_IN_AVAILABLE" ? "#10B981" : activeAptTiming?.status === "EXPIRED" ? "#EF4444" : "#0284C7",
                  boxShadow: activeAptTiming?.status === "CHECK_IN_AVAILABLE" ? "0 0 0 4px rgba(16, 185, 129, 0.2)" : activeAptTiming?.status === "EXPIRED" ? "0 0 0 4px rgba(239, 68, 68, 0.2)" : "0 0 0 4px rgba(2, 132, 199, 0.2)",
                }}
              />
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>
                {t("activeAppointmentInProgress", language)}
              </span>
            </div>
            <span
              style={{
                padding: "5px 14px",
                borderRadius: "999px",
                background: activeAptTiming?.status === "CHECK_IN_AVAILABLE" ? "#DCFCE7" : activeAptTiming?.status === "EXPIRED" ? "#FEF2F2" : "#E0F2FE",
                color: activeAptTiming?.status === "CHECK_IN_AVAILABLE" ? "#15803D" : activeAptTiming?.status === "EXPIRED" ? "#DC2626" : "#0284C7",
                border: `1px solid ${activeAptTiming?.status === "CHECK_IN_AVAILABLE" ? "#86EFAC" : activeAptTiming?.status === "EXPIRED" ? "#FECACA" : "#BAE6FD"}`,
                fontSize: "12px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: activeAptTiming?.status === "CHECK_IN_AVAILABLE" ? "#16A34A" : activeAptTiming?.status === "EXPIRED" ? "#DC2626" : "#0284C7",
                }}
              />
              {activeAptTiming?.status === "CHECK_IN_AVAILABLE"
                ? (t("check_in_available", language) || "Check-In Available")
                : activeAptTiming?.status === "EXPIRED"
                ? (t("expired", language) || "Expired")
                : (t("booked", language) || "Booked")}
            </span>
          </div>

          {/* Policy reminder banner */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(2, 132, 199, 0.08)",
              border: "1px solid #BAE6FD",
              marginBottom: "16px",
              fontSize: "12.5px",
              color: "#0369A1",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>{t("oneAppointmentPerProfilePolicy", language)}</span>
          </div>

          {/* Big Appointment Highlight Box */}
          <div
            style={{
              padding: "20px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(14, 165, 233, 0.02) 100%)",
              border: "1.5px solid #BAE6FD",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "18px",
              marginBottom: "16px",
            }}
          >
            <div style={{ flex: "1 1 320px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#0284C7", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                {selectedMember?.name || currentActiveScheduledApt.patient_name || name} • {getDeptDisplayName(currentActiveScheduledApt)}
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#0369A1", letterSpacing: "-0.5px", margin: "4px 0" }}>
                {currentActiveScheduledApt.appointment_id}
              </div>

              {/* Timing Metadata Details Grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
                {/* 1. Appointment Time */}
                <div style={{ fontSize: "13px", color: "var(--patient-text-sub, #475569)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>
                    {language === "hi" ? "अपॉइंटमेंट समय:" : "Appointment Time:"}{" "}
                    <strong style={{ color: "var(--patient-text-main, #0F172A)" }}>{currentActiveScheduledApt.appointment_date}</strong> @ <strong style={{ color: "#0284C7" }}>{activeAptTiming?.formattedAppointmentTime || currentActiveScheduledApt.time_slot}</strong>
                  </span>
                </div>

                {/* 2. Check-In Window */}
                <div style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #475569)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeAptTiming?.canCheckIn ? "#10B981" : "#0284C7"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>
                    {language === "hi" ? "चेक-इन विंडो (30 मिनट पहले):" : "Check-In Window (Opens 30m prior):"}{" "}
                    {activeAptTiming?.canCheckIn ? (
                      <strong style={{ color: "#16A34A" }}>
                        {language === "hi" ? `अभी खुला है (${activeAptTiming.formattedExpiresAt} तक)` : `OPEN NOW (until ${activeAptTiming.formattedExpiresAt})`}
                      </strong>
                    ) : activeAptTiming?.isExpired ? (
                      <strong style={{ color: "#DC2626" }}>
                        {language === "hi" ? `समाप्त (${activeAptTiming.formattedExpiresAt} पर बंद)` : `Closed at ${activeAptTiming.formattedExpiresAt}`}
                      </strong>
                    ) : (
                      <strong style={{ color: "#1E40AF" }}>
                        {language === "hi" ? `${activeAptTiming?.formattedCheckInOpensAt || "30 मिनट पहले"} पर खुलेगा` : `Opens at ${activeAptTiming?.formattedCheckInOpensAt}`}
                      </strong>
                    )}
                  </span>
                </div>

                {/* 3. Ticket Expiration */}
                <div style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #475569)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeAptTiming?.isExpired ? "#DC2626" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span>
                    {language === "hi" ? "टिकट समाप्ति (1 घंटे बाद):" : "Ticket Expiration (1h after slot):"}{" "}
                    <strong style={{ color: activeAptTiming?.isExpired ? "#DC2626" : "#64748B" }}>
                      {activeAptTiming?.isExpired
                        ? (language === "hi" ? `समाप्त हो चुका (${activeAptTiming.formattedExpiresAt})` : `EXPIRED at ${activeAptTiming.formattedExpiresAt}`)
                        : (language === "hi" ? `${activeAptTiming?.formattedExpiresAt} पर समाप्त` : `Expires at ${activeAptTiming?.formattedExpiresAt}`)}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
              {(() => {
                const cleanDate = String(currentActiveScheduledApt.appointment_date || "").slice(0, 10);
                const now = new Date();
                const pad = (n) => String(n).padStart(2, "0");
                const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                const isFutureDate = cleanDate && cleanDate > todayStr;

                // 1. Ticket Expired State (> 1 hour after scheduled appointment)
                if (activeAptTiming?.isExpired) {
                  return (
                    <div
                      role="status"
                      data-testid="expired-bookslot-guard"
                      style={{
                        padding: "10px 16px",
                        borderRadius: "10px",
                        background: "#FEF2F2",
                        border: "1.5px solid #FCA5A5",
                        color: "#DC2626",
                        fontSize: "12px",
                        fontWeight: 700,
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        maxWidth: "280px",
                        textAlign: "right",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        <span>{language === "hi" ? "टिकट समाप्त हो गया" : "Ticket Expired"}</span>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "#991B1B", lineHeight: 1.4 }}>
                        {language === "hi"
                          ? `चेक-इन विंडो ${activeAptTiming.formattedExpiresAt} पर बंद हो गई (अपॉइंटमेंट के 1 घंटे बाद)। चेक-इन अब बंद है।`
                          : `Check-in closed at ${activeAptTiming.formattedExpiresAt} (1 hour after appointment). Check-in is permanently disabled.`}
                      </span>
                    </div>
                  );
                }

                // 2. Future Date Guard
                if (isFutureDate) {
                  return (
                    <div
                      role="status"
                      data-testid="future-date-bookslot-guard"
                      title={
                        language === "hi"
                          ? `चेक-इन अपॉइंटमेंट की तारीख (${cleanDate}) को ${activeAptTiming?.formattedCheckInOpensAt || "30 मिनट पहले"} खुलेगा। कृपया अस्पताल पहुंचने पर चेक-इन करें।`
                          : `Check-in opens on appointment date (${cleanDate}) at ${activeAptTiming?.formattedCheckInOpensAt || "30 minutes prior"}. Please check in when you arrive at the hospital.`
                      }
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: "var(--patient-tag-bg, #F0F9FF)",
                        border: "1.5px solid var(--patient-tag-border, #BAE6FD)",
                        color: "#0369A1",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                        cursor: "default",
                        boxShadow: "0 1px 2px rgba(2, 132, 199, 0.08)",
                        userSelect: "none",
                        textAlign: "right",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>
                          {language === "hi"
                            ? `चेक-इन ${cleanDate} को खुलेगा`
                            : `${t("checkInOpensOnDate", language)} ${cleanDate}`}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "#0284C7" }}>
                        {language === "hi"
                          ? `समय: ${activeAptTiming?.formattedCheckInOpensAt} (स्लॉट से 30 मिनट पहले)`
                          : `Opens at ${activeAptTiming?.formattedCheckInOpensAt} (30 mins before slot)`}
                      </span>
                    </div>
                  );
                }

                // 3. Pre-Check-in Window Guard (Today, but > 30 minutes before appointment)
                if (activeAptTiming?.isBooked) {
                  return (
                    <div
                      role="status"
                      data-testid="booked-checkin-window-guard"
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: "#EFF6FF",
                        border: "1.5px solid #BFDBFE",
                        color: "#1E40AF",
                        fontSize: "12px",
                        fontWeight: 700,
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                        textAlign: "right",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>
                          {language === "hi"
                            ? `चेक-इन ${activeAptTiming.formattedCheckInOpensAt} पर खुलेगा`
                            : `Check-In Opens at ${activeAptTiming.formattedCheckInOpensAt}`}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "#2563EB" }}>
                        {language === "hi"
                          ? `(अपॉइंटमेंट से 30 मिनट पहले प्रारंभ ${activeAptTiming.timeUntilCheckInText ? `• ${activeAptTiming.timeUntilCheckInText} में` : ""})`
                          : `(30 mins before appointment${activeAptTiming.timeUntilCheckInText ? ` • in ${activeAptTiming.timeUntilCheckInText}` : ""})`}
                      </span>
                    </div>
                  );
                }

                // 4. Active Ticket In Progress Guard
                if (isLiveTicket && activeTicket && activeTicket.appointment_id !== currentActiveScheduledApt.appointment_id && activeTicket.ticket_id !== currentActiveScheduledApt.ticket_id) {
                  return (
                    <div
                      role="status"
                      data-testid="active-ticket-bookslot-checkin-guard"
                      title={
                        language === "hi"
                          ? (activeTicket?.ticket_id
                              ? `सक्रिय टोकन #${activeTicket.ticket_id} पहले से प्रगति पर है। चेक-इन करने से पहले कृपया मौजूदा टोकन पूरा करें या रद्द करें।`
                              : t("activeTicketInProgressCheckInTooltip", language))
                          : (activeTicket?.ticket_id
                              ? `Active ticket #${activeTicket.ticket_id} is in progress. Complete or cancel your existing ticket before checking in.`
                              : t("activeTicketInProgressCheckInTooltip", language))
                      }
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        background: "#FEF3C7",
                        border: "1.5px solid #FDE68A",
                        color: "#B45309",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "not-allowed",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{t("activeTicketInProgressCheckInGuard", language)}</span>
                    </div>
                  );
                }

                // 5. OPD Closed Guard
                if (registrationStatus.isClosed) {
                  return (
                    <div
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        background: "#FEF2F2",
                        border: "1.5px solid #FCA5A5",
                        color: "#DC2626",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      title={registrationStatus.reason || "OPD is closed"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span>{language === "hi" ? "ओपीडी बंद है" : "OPD Closed"}</span>
                    </div>
                  );
                }

                // 6. Check-in Available Action Button
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => handleAppointmentCheckIn(currentActiveScheduledApt.appointment_id)}
                      style={{
                        padding: "11px 22px",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                        color: "#FFFFFF",
                        border: "none",
                        fontSize: "13.5px",
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: "0 3px 12px rgba(16, 185, 129, 0.35)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      <span>{t("checkInJoinLiveNow", language)}</span>
                    </button>
                    {activeAptTiming?.formattedExpiresAt && (
                      <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>
                        {language === "hi"
                          ? `चेक-इन ${activeAptTiming.formattedExpiresAt} तक खुला है`
                          : `Check-in open until ${activeAptTiming.formattedExpiresAt}`}
                      </span>
                    )}
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={() => handleCancelAppointment(currentActiveScheduledApt.appointment_id, currentActiveScheduledApt.ticket_id || null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  background: "#FFF1F2",
                  color: "#DC2626",
                  border: "1px solid #FECACA",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>{t("cancelCurrentAppointmentBtn", language)}</span>
              </button>
            </div>
          </div>

          {/* Book for Another Family Member Quick Switcher */}
          {Array.isArray(familyMembers) && familyMembers.filter((m) => m && m.id !== selectedMemberId).length > 0 && (
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed var(--patient-card-border, #E2E8F0)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--patient-text-sub, #64748B)", marginBottom: "8px" }}>
                {t("bookSlotForAnotherMember", language)}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {familyMembers.filter((m) => m && m.id !== selectedMemberId).map((m) => {
                  const memTkt = familyTickets[m.id];
                  const hasLive = memTkt && isLiveTicketStatus(memTkt);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectMember(m)}
                      style={{
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: hasLive ? "1px solid #BBF7D0" : "1px solid var(--patient-card-border, #CBD5E1)",
                        background: hasLive ? "#F0FDF4" : "var(--patient-sub-card, #F8FAFC)",
                        color: hasLive ? "#15803D" : "var(--patient-text-main, #0F172A)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{hasLive ? "🎫" : "👤"} {m.name}</span>
                      <span style={{ fontSize: "11px", color: hasLive ? "#16A34A" : "#64748B" }}>
                        ({hasLive ? `#${memTkt.ticket_id}` : (m.relation === "self" ? (language === "hi" ? "स्वयं" : "Self") : (t(`relation_${m.relation}`, language) || m.relation))})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <form onSubmit={handleBookSlot}>
            <div style={{ marginBottom: "16px" }}>
              <label className="form-field-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {t("patientNameLabel", language)}
              </label>
              <input
                type="text"
                placeholder={t("patientNamePlaceholder", language)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="modern-form-input"
              />
            </div>

            <div className="form-grid-2col">
              <div>
                <label className="form-field-label">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <path d="M9 22v-4h6v4" />
                  </svg>
                  {t("medicalDeptLabel", language)}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="modern-form-input modern-form-select"
                >
                  {availableDepartments.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || getDeptDisplayName(c.id)}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", marginTop: "5px", display: "flex", alignItems: "center", gap: "5px", lineHeight: 1.35 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <span>
                    {language === "hi"
                      ? "दवाइयों के लिए डॉक्टर परामर्श के बाद टोकन स्वतः फार्मेसी काउंटर में स्थानांतरित होगा।"
                      : "Prescriptions are automatically transferred to Pharmacy after doctor consultation."}
                  </span>
                </div>
              </div>
              <div>
                <label className="form-field-label">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {t("appointmentDateLabel", language)}
                </label>
                <input
                  type="date"
                  value={aptDate}
                  min={bookingDateBounds.min}
                  max={bookingDateBounds.max}
                  onChange={(e) => setAptDate(e.target.value)}
                  required
                  className="modern-form-input"
                />
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label className="form-field-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {t("selectTimeSlotLabel", language)} <span style={{ color: "#EF4444", fontSize: "11px" }}>*</span>
                </span>
                {aptTimeSlot ? (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284C7", background: "#E0F2FE", padding: "2px 8px", borderRadius: "12px" }}>
                    {t("slotSelected", language)}: {aptTimeSlot}
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#D97706", background: "#FEF3C7", padding: "2px 8px", borderRadius: "12px" }}>
                    {t("chooseSlotHint", language)}
                  </span>
                )}
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "8px" }}>
                {timeSlotOptions.length === 0 ? (
                  <div style={{
                    gridColumn: "1 / -1",
                    padding: "16px",
                    borderRadius: "10px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1.5px dashed rgba(239, 68, 68, 0.3)",
                    textAlign: "center",
                    color: "#DC2626",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}>
                    {language === "hi"
                      ? "इस अस्पताल के लिए कोई अपॉइंटमेंट समय स्लॉट उपलब्ध नहीं है। कृपया सहायता केंद्र से संपर्क करें।"
                      : "No appointment time slots currently available for this hospital. Please contact the help desk."}
                  </div>
                ) : (
                  timeSlotOptions.map((slot) => {
                  const past = isSlotPast(slot);
                  const selected = aptTimeSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={past}
                      onClick={() => !past && setAptTimeSlot(slot)}
                      title={past ? t("slotPassedTitle", language) : `Select ${slot}`}
                      style={{
                        padding: "10px 4px",
                        borderRadius: "8px",
                        border: selected ? "2px solid #0284C7" : past ? "1px dashed #CBD5E1" : "1px solid var(--patient-card-border, #CBD5E1)",
                        background: selected ? "var(--patient-tag-bg, #F0F9FF)" : past ? "#F1F5F9" : "var(--patient-sub-card, #F8FAFC)",
                        color: selected ? "#0284C7" : past ? "#CBD5E1" : "var(--patient-text-sub, #475569)",
                        fontWeight: 700,
                        fontSize: "11.5px",
                        cursor: past ? "not-allowed" : "pointer",
                        transition: "all 0.15s ease",
                        opacity: past ? 0.45 : 1,
                        textDecoration: past ? "line-through" : "none",
                        position: "relative",
                        boxShadow: selected ? "0 0 0 2px rgba(2,132,199,0.2)" : "none",
                      }}
                    >
                      {slot}
                      {past && (
                        <span style={{
                          position: "absolute", top: "-6px", right: "-4px",
                          fontSize: "8px", background: "#94A3B8", color: "#fff",
                          borderRadius: "4px", padding: "1px 3px", fontWeight: 800,
                          lineHeight: 1.2, letterSpacing: "0.3px",
                        }}>{t("slotPassed", language)}</span>
                      )}
                    </button>
                  );
                }))}
              </div>
              {!aptTimeSlot && (
                <p style={{ margin: "8px 0 0 0", fontSize: "11.5px", color: "#64748B", fontStyle: "italic" }}>
                  {t("clickSlotHint", language)}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!aptTimeSlot}
              className="modern-submit-btn"
              style={!aptTimeSlot ? { opacity: 0.6, cursor: "not-allowed" } : {}}
              title={!aptTimeSlot ? t("selectSlotFirst", language) : ""}
            >
              {t("bookSlotBtn", language)}
            </button>
          </form>

          {bookedAppointment && bookedAppointment.status === "cancelled" && (
            <div style={{
              ...aptConfirmationBoxStyle,
              borderColor: "#FECACA",
              background: "#FFF1F2",
              marginTop: "16px",
            }}>
              <span style={{ fontSize: "11px", color: "#DC2626", fontWeight: 700, textTransform: "uppercase" }}>
                {language === "hi" ? "❌ अपॉइंटमेंट रद्द" : "❌ Appointment Cancelled"}
              </span>
              <h3 style={{ margin: "4px 0", color: "#B91C1C", fontSize: "18px", fontWeight: 800 }}>
                {language === "hi" ? "कोड:" : "Code:"} {bookedAppointment.appointment_id}
              </h3>
              <p style={{ margin: 0, color: "#DC2626", fontSize: "12px", fontWeight: 600 }}>
                {language === "hi" ? "यह अपॉइंटमेंट रद्द कर दिया गया है। आप ऊपर नया स्लॉट बुक कर सकते हैं।" : "This appointment has been cancelled. You can reserve a new slot above."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
