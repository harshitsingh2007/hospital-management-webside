import React, { useState, useEffect } from "react";
import { t, getStatusLabel, formatCleanText } from "../../utils/i18n";
import FamilyMemberSwitcher from "./FamilyMemberSwitcher";
import { standaloneCardStyle, aptCardRowStyle, aptStatusBadgeStyle, checkInNowBtnStyle } from "./patientStyles";
import { getAppointmentTiming } from "../../utils/appointmentTiming";

/**
 * MyAppointmentsTab
 * -----------------
 * Full-view active & scheduled appointments list with profile filtering,
 * time-guard badges, check-in button, cancellation, and direct Rx Slip download.
 */
export default function MyAppointmentsTab({
  language = "en",
  hospitalBranding = null,
  selectedMember = null,
  selectedMemberId = "self",
  familyMembers = [],
  handleSelectMember,
  handleTabChange,
  handleDeleteMember,
  familyTickets = {},
  aptFilterQuery = "",
  setAptFilterQuery,
  displayedActiveAppointments = [],
  isLiveTicket = false,
  activeTicket = null,
  isLiveTicketStatus = () => false,
  getHospitalNameForRecord = () => "",
  getDeptDisplayName = (id) => id,
  userTicketHistory = [],
  parsePrescription,
  handleOpenPrescriptionSlip,
  downloadPrescriptionPDF,
  setStatusMsg,
  registrationStatus = { isClosed: false, reason: "" },
  handleAppointmentCheckIn,
  handleCancelAppointment,
  showConfirm = null,
}) {
  const [nowTime, setNowTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={standaloneCardStyle}>
      {/* Quick Profile Switcher for Active Appointments */}
      <div style={{ marginBottom: "18px" }}>
        <FamilyMemberSwitcher
          members={familyMembers}
          selectedMemberId={selectedMemberId}
          onSelectMember={handleSelectMember}
          onAddMember={() => handleTabChange("family")}
          onDeleteMember={handleDeleteMember}
          showConfirm={showConfirm}
          language={language}
          familyTickets={familyTickets}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h3 style={{ margin: 0, fontSize: "20px", color: "var(--patient-text-main, #0F172A)", fontWeight: 800, letterSpacing: "-0.4px" }}>
              {t("myActiveAppointments", language)}
            </h3>
            <span style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#0369A1",
              background: "var(--patient-tag-bg, #E0F2FE)",
              border: "1px solid var(--patient-tag-border, #BAE6FD)",
              padding: "2px 8px",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <span>👤</span>
              <span>{selectedMember?.name || "Self"}</span>
              {selectedMember?.relation && selectedMember.relation !== "self" && (
                <span style={{ opacity: 0.85 }}>({t(`relation_${selectedMember.relation}`, language) || selectedMember.relation})</span>
              )}
            </span>
          </div>
          <span style={{ fontSize: "13px", color: "var(--patient-text-sub, #64748B)", fontWeight: 500, lineHeight: 1.55 }}>
            {t("activeAptsSubtitle", language)}
          </span>
        </div>
        <div style={{ position: "relative", minWidth: "260px", maxWidth: "360px", flex: 1 }}>
          <input
            id="my-appointments-filter-input"
            type="text"
            value={aptFilterQuery}
            onChange={(e) => setAptFilterQuery(e.target.value)}
            placeholder={language === "hi" ? "आईडी, डॉक्टर, या विभाग द्वारा खोजें..." : "Search by ID, Doctor, or Dept..."}
            style={{
              width: "100%",
              padding: "9px 34px 9px 36px",
              borderRadius: "10px",
              border: "1.5px solid var(--patient-card-border, #CBD5E1)",
              background: "var(--patient-card-bg, #FFFFFF)",
              color: "var(--patient-text-main, #0F172A)",
              fontSize: "12.5px",
              outline: "none",
              boxSizing: "border-box",
              transition: "all 0.15s ease",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#0284C7"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--patient-card-border, #CBD5E1)"; }}
          />
          <span style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: "#64748B", pointerEvents: "none", display: "flex", alignItems: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          {aptFilterQuery && (
            <button
              type="button"
              onClick={() => setAptFilterQuery("")}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={language === "hi" ? "फ़िल्टर हटाएं" : "Clear filter"}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {displayedActiveAppointments.length === 0 ? (
        <div style={{ padding: "40px 24px", textAlign: "center", background: "var(--patient-sub-card, #F8FAFC)", borderRadius: "16px", border: "1px solid var(--patient-card-border, #E2E8F0)", color: "var(--patient-text-sub, #94A3B8)" }}>
          {aptFilterQuery.trim() ? (
            <>
              <p style={{ margin: "0 0 6px 0", color: "var(--patient-text-main, #64748B)", fontWeight: 600, fontSize: "14px" }}>
                {language === "hi"
                  ? `"${aptFilterQuery.trim()}" से मेल खाता कोई अपॉइंटमेंट नहीं मिला`
                  : `No appointments found matching "${aptFilterQuery.trim()}"`}
              </p>
              <p style={{ margin: "0 0 14px 0", color: "var(--patient-text-sub, #94A3B8)", fontSize: "12px" }}>
                {language === "hi"
                  ? "कृपया वर्तनी जांचें या अपॉइंटमेंट आईडी, डॉक्टर का नाम या विभाग से खोजें।"
                  : "Check the spelling or try searching by appointment ID, doctor's name, or department."}
              </p>
              <button
                type="button"
                onClick={() => setAptFilterQuery("")}
                style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#0284C7", color: "#FFFFFF", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}
              >
                {language === "hi" ? "फ़िल्टर हटाएं" : "Clear Filter"}
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 6px 0", color: "var(--patient-text-main, #64748B)", fontWeight: 600, fontSize: "14px" }}>
                {t("noActiveAptsMsg", language)}
              </p>
              <p style={{ margin: "0 0 14px 0", color: "var(--patient-text-sub, #94A3B8)", fontSize: "12px" }}>
                {language === "hi"
                  ? "आपके पास कोई सक्रिय अपॉइंटमेंट नहीं है। नीचे नया स्लॉट बुक करें।"
                  : "You have no active appointments scheduled. Reserve a new slot below."}
              </p>
              <button
                type="button"
                onClick={() => handleTabChange("book")}
                style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: "#0284C7", color: "#FFFFFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                {t("bookAppointmentBtn", language)}
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {displayedActiveAppointments.map((apt) => {
            const cleanAptDate = String(apt.appointment_date || "").slice(0, 10);
            const now = nowTime || new Date();
            const pad = (n) => String(n).padStart(2, "0");
            const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const isFutureAptDate = cleanAptDate && cleanAptDate > todayStr;
            const timing = getAppointmentTiming(apt, now);

            const hasActiveLiveTicket = Boolean(
              (isLiveTicket && activeTicket && activeTicket.appointment_id !== apt.appointment_id && activeTicket.ticket_id !== apt.ticket_id) ||
              (familyTickets && Object.values(familyTickets).some((ft) =>
                ft && isLiveTicketStatus(ft) && (
                  (apt.patient_name && ft.name && apt.patient_name.trim().toLowerCase() === ft.name.trim().toLowerCase())
                ) && ft.appointment_id !== apt.appointment_id && ft.ticket_id !== apt.ticket_id
              ))
            );
            return (
            <div key={apt.appointment_id} style={aptCardRowStyle(timing?.status ? timing.status.toLowerCase() : apt.status)}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "16px", fontWeight: 900, color: "#0284C7" }}>{apt.appointment_id}</span>
                  <span style={aptStatusBadgeStyle(timing?.status ? timing.status.toLowerCase() : apt.status)}>
                    {timing?.status === "CHECK_IN_AVAILABLE"
                      ? (language === "hi" ? "चेक-इन उपलब्ध" : "CHECK-IN AVAILABLE")
                      : timing?.status === "EXPIRED"
                      ? (language === "hi" ? "समाप्त" : "EXPIRED")
                      : timing?.status === "BOOKED"
                      ? (language === "hi" ? "आरक्षित" : "BOOKED")
                      : (getStatusLabel(timing?.status || apt.status, language) || String(apt.status).toUpperCase())}
                  </span>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#0369A1",
                    background: "var(--patient-tag-bg, #F0F9FF)",
                    border: "1px solid var(--patient-tag-border, #BAE6FD)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/><line x1="10" y1="9" x2="14" y2="9"/><line x1="12" y1="7" x2="12" y2="11"/></svg>
                    <span>{getHospitalNameForRecord(apt)}</span>
                  </span>
                  {(apt.doctor_name || apt.served_by_doctor_name) && (
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#1E40AF",
                      background: "var(--patient-tag-bg, #EFF6FF)",
                      border: "1px solid var(--patient-tag-border, #BFDBFE)",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                      <span>{formatCleanText(apt.doctor_name || apt.served_by_doctor_name, language)}</span>
                    </span>
                  )}
                </div>
                <p style={{ margin: "6px 0 0 0", color: "var(--patient-text-main, #0F172A)", fontWeight: 700, fontSize: "15px" }}>
                  {formatCleanText(apt.patient_name, language)} — {getDeptDisplayName(apt)}
                </p>
                <span style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #64748B)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/><line x1="10" y1="9" x2="14" y2="9"/><line x1="12" y1="7" x2="12" y2="11"/></svg>
                    <strong>{getHospitalNameForRecord(apt)}</strong>
                  </span>
                  <span>•</span>
                  <span>Date: <strong>{apt.appointment_date}</strong></span>
                  <span>•</span>
                  <span>{language === "hi" ? "अपॉइंटमेंट समय:" : "Appointment Time:"} <strong style={{ color: "#0284C7" }}>{timing?.formattedAppointmentTime || apt.time_slot}</strong></span>
                  <span>•</span>
                  <span style={{ color: timing?.canCheckIn ? "#16A34A" : timing?.isExpired ? "#DC2626" : "#2563EB", fontWeight: 700 }}>
                    {timing?.canCheckIn
                      ? (language === "hi" ? `🟢 चेक-इन खुला है (${timing.formattedExpiresAt} तक)` : `🟢 Check-In Open (until ${timing.formattedExpiresAt})`)
                      : timing?.isExpired
                      ? (language === "hi" ? `🔴 चेक-इन बंद (${timing.formattedExpiresAt} पर समाप्त)` : `🔴 Check-In Closed (Expired at ${timing.formattedExpiresAt})`)
                      : (language === "hi" ? `🕒 चेक-इन ${timing?.formattedCheckInOpensAt} पर खुलेगा` : `🕒 Check-In Opens at ${timing?.formattedCheckInOpensAt}`)}
                  </span>
                  <span>•</span>
                  <span style={{ color: "#64748B", fontWeight: 600 }}>
                    {language === "hi" ? "समाप्ति:" : "Expires:"} <strong>{timing?.formattedExpiresAt}</strong>
                  </span>
                  <span>•</span>
                  <span style={{ color: "#0284C7", fontWeight: 700 }}>
                    Dept: {getDeptDisplayName(apt)}
                  </span>
                  {(apt.doctor_name || apt.served_by_doctor_name) && (
                    <>
                      <span>•</span>
                      <span style={{ color: "#0284C7", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                        <span>{language === "hi" ? "चिकित्सक" : "Doctor"}: {apt.doctor_name || apt.served_by_doctor_name}</span>
                      </span>
                    </>
                  )}
                </span>

                {/* Digital Rx Slip preview if notes present or completed */}
                {(() => {
                  const effectiveRxNotes = apt.prescription_notes || (apt.ticket_id && userTicketHistory.find((t) => t.ticket_id === apt.ticket_id)?.prescription_notes) || "";
                  if (!effectiveRxNotes && (apt.status || "").toLowerCase() !== "completed") return null;
                  const rx = parsePrescription(effectiveRxNotes, apt);
                  if (!rx) return null;
                  return (
                    <div style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "var(--patient-tag-bg, #F0F9FF)",
                      border: "1.5px solid var(--patient-tag-border, #BAE6FD)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                        <span style={{ fontSize: "12px", fontWeight: 800, color: "#0284C7" }}>
                          {language === "hi" ? "दवा पर्ची संलग्न" : "E-Prescription Available"}
                        </span>
                        {rx.doctor_name && (
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#0369A1" }}>
                            • {rx.doctor_name}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenPrescriptionSlip(effectiveRxNotes, apt)}
                          style={{
                            padding: "5px 12px",
                            borderRadius: "7px",
                            border: "1.5px solid #0284C7",
                            background: "var(--patient-card-bg, #FFFFFF)",
                            color: "#0284C7",
                            fontSize: "11.5px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          <span>{language === "hi" ? "दवा पर्ची देखें" : "View Rx Slip"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const parsed = parsePrescription(effectiveRxNotes, apt);
                            downloadPrescriptionPDF(parsed, language, hospitalBranding);
                            setStatusMsg(t("downloadRxPdfSuccess", language));
                          }}
                          title={t("downloadClinicalRxPdf", language)}
                          style={{
                            padding: "5px 12px",
                            borderRadius: "7px",
                            border: "none",
                            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                            color: "#FFFFFF",
                            fontSize: "11.5px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            boxShadow: "0 1px 3px rgba(2, 132, 199, 0.2)",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          <span>{t("downloadPdfShort", language)}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                {(() => {
                  const isQueueTicket = Boolean(apt.ticket_id || (apt.status || "").toLowerCase() === "checked_in");
                  if (isQueueTicket) {
                    return (
                      <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        <div>
                          <span style={{ fontSize: "13px", color: "#0284C7", fontWeight: 800, display: "block" }}>
                            {t("mergedToken", language)} #{apt.ticket_id}
                          </span>
                          <span style={{ fontSize: "11px", color: "#0284C7", fontWeight: 700 }}>
                            {t("activeInLiveQueue", language)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCancelAppointment(apt.appointment_id, apt.ticket_id)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #FECACA",
                            background: "#FEF2F2",
                            color: "#DC2626",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {language === "hi" ? "टोकन रद्द करें" : "Cancel Token"}
                        </button>
                      </div>
                    );
                  }

                  // Pre-queue Booked Slot (BOOKED, CHECK_IN_AVAILABLE, or EXPIRED)
                  return (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {timing?.isExpired ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                          <span
                            role="status"
                            title={language === "hi" ? "अपॉइंटमेंट समय के 1 घंटे बाद टिकट समाप्त हो चुका है" : "Ticket expired 1 hour after scheduled appointment"}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              color: "#DC2626",
                              fontSize: "11px",
                              fontWeight: 800,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            <span>{language === "hi" ? `टिकट समाप्त (${timing.formattedExpiresAt})` : `Ticket Expired (${timing.formattedExpiresAt})`}</span>
                          </span>
                          <span style={{ fontSize: "10.5px", color: "#B91C1C", fontWeight: 500 }}>
                            {language === "hi" ? "चेक-इन स्थायी रूप से बंद" : "Check-in permanently closed"}
                          </span>
                        </div>
                      ) : isFutureAptDate ? (
                        <div
                          role="status"
                          data-testid="future-date-checkin-guard"
                          title={
                            language === "hi"
                              ? `चेक-इन अपॉइंटमेंट की तारीख (${cleanAptDate}) को ${timing?.formattedCheckInOpensAt || "30 मिनट पहले"} खुलेगा। कृपया अस्पताल पहुंचने पर चेक-इन करें।`
                              : `Check-in opens on appointment date (${cleanAptDate}) at ${timing?.formattedCheckInOpensAt || "30 minutes prior"}. Please check in when you arrive at the hospital.`
                          }
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "var(--patient-tag-bg, #F0F9FF)",
                            border: "1.5px solid var(--patient-tag-border, #BAE6FD)",
                            color: "#0369A1",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            cursor: "default",
                            boxShadow: "0 1px 2px rgba(2, 132, 199, 0.08)",
                            userSelect: "none",
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          <span>
                            {language === "hi"
                              ? `चेक-इन ${cleanAptDate} को खुलेगा`
                              : `${t("checkInOpensOnDate", language)} ${cleanAptDate}`}
                          </span>
                        </div>
                      ) : timing?.isBooked ? (
                        <div
                          role="status"
                          data-testid="booked-checkin-guard"
                          title={
                            language === "hi"
                              ? `चेक-इन अपॉइंटमेंट से 30 मिनट पहले (${timing.formattedCheckInOpensAt}) पर खुलेगा।`
                              : `Check-in opens 30 minutes prior to appointment at ${timing.formattedCheckInOpensAt}.`
                          }
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "#EFF6FF",
                            border: "1.5px solid #BFDBFE",
                            color: "#1E40AF",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span>
                            {language === "hi"
                              ? `चेक-इन ${timing.formattedCheckInOpensAt} पर खुलेगा`
                              : `Check-In Opens at ${timing.formattedCheckInOpensAt}`}
                          </span>
                          {timing.timeUntilCheckInText && (
                            <span style={{ fontSize: "10.5px", color: "#3B82F6", fontWeight: 600 }}>
                              ({timing.timeUntilCheckInText})
                            </span>
                          )}
                        </div>
                      ) : hasActiveLiveTicket ? (
                        <div
                          role="status"
                          data-testid="active-ticket-checkin-guard"
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
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "#FEF3C7",
                            border: "1.5px solid #FDE68A",
                            color: "#B45309",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            cursor: "not-allowed",
                            boxShadow: "0 1px 2px rgba(180, 83, 9, 0.08)",
                            userSelect: "none",
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>{t("activeTicketInProgressCheckInGuard", language)}</span>
                        </div>
                      ) : registrationStatus.isClosed ? (
                        <span
                          title={registrationStatus.reason || "Check-in only works when OPD is open"}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "#FEF2F2",
                            border: "1px solid #FECACA",
                            color: "#DC2626",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <span>{language === "hi" ? "ओपीडी बंद है" : "OPD Closed"}</span>
                        </span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => handleAppointmentCheckIn(apt.appointment_id)}
                            style={{
                              ...checkInNowBtnStyle,
                              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                            }}
                          >
                            {t("checkInJoinLine", language)}
                          </button>
                          {timing?.formattedExpiresAt && (
                            <span style={{ fontSize: "10.5px", color: "#059669", fontWeight: 600 }}>
                              {language === "hi" ? `वैध: ${timing.formattedExpiresAt} तक` : `Valid until ${timing.formattedExpiresAt}`}
                            </span>
                          )}
                        </div>
                      )}

                      {!timing?.isExpired && (
                        <button
                          type="button"
                          onClick={() => handleCancelAppointment(apt.appointment_id, apt.ticket_id)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: "8px",
                            border: "1px solid #FECACA",
                            background: "#FEF2F2",
                            color: "#DC2626",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {language === "hi" ? "रद्द करें" : "Cancel"}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
