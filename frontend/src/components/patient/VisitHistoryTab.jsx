import React from "react";
import { t, getCategoryLabel, getStatusLabel, formatCleanText } from "../../utils/i18n";
import FamilyMemberSwitcher from "./FamilyMemberSwitcher";
import HistorySummary from "../patient-history/HistorySummary";
import { standaloneCardStyle } from "./patientStyles";

/**
 * VisitHistoryTab
 * ---------------
 * Complete chronological medical visit archive, including pre-scheduled appointments,
 * walk-in queue visits, prescriptions, and follow-up booking triggers.
 */
export default function VisitHistoryTab({
  language = "en",
  hospitalBranding = null,
  selectedMember = null,
  selectedMemberId = "self",
  familyMembers = [],
  handleSelectMember,
  handleTabChange,
  handleDeleteMember,
  familyTickets = {},
  displayedHistoryAppointments = [],
  displayedHistoryTickets = [],
  selectedMemberHistoryStats = { patient: null, summary: null, isReturningPatient: false, totalVisits: 0 },
  historyFilterType = "all",
  setHistoryFilterType,
  historySearchQuery = "",
  setHistorySearchQuery,
  showCancelledHistory = false,
  setShowCancelledHistory,
  historyAppointments = [],
  historyTickets = [],
  userTicketHistory = [],
  getHospitalNameForRecord = () => "",
  getDeptDisplayName = (id) => id,
  parsePrescription,
  handleOpenPrescriptionSlip,
  downloadPrescriptionPDF,
  setStatusMsg,
  handleBookFollowUp,
  showToast = null,
}) {
  return (
    <div style={standaloneCardStyle}>
      {/* Quick Profile Switcher for Medical & Visit History */}
      <div style={{ marginBottom: "18px" }}>
        <FamilyMemberSwitcher
          members={familyMembers}
          selectedMemberId={selectedMemberId}
          onSelectMember={handleSelectMember}
          onAddMember={() => handleTabChange("family")}
          onDeleteMember={handleDeleteMember}
          language={language}
          familyTickets={familyTickets}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h3 style={{ margin: 0, fontSize: "20px", color: "var(--patient-text-main, #0F172A)", fontWeight: 800, letterSpacing: "-0.4px" }}>
              {t("medicalVisitHistory", language)}
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
            {language === "hi"
              ? `पुराने परामर्श, ई-प्रिस्क्रिप्शन एवं फॉलो-अप रिकॉर्ड (${selectedMember?.name || "Self"})`
              : `Chronological archive of past clinical visits, e-prescriptions, and follow-ups for ${selectedMember?.name || "Self"}.`}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontSize: "12px",
            fontWeight: 800,
            color: "#0284C7",
            background: "var(--patient-tag-bg, #E0F2FE)",
            border: "1px solid var(--patient-tag-border, #BAE6FD)",
            padding: "4px 12px",
            borderRadius: "20px",
          }}>
            {displayedHistoryAppointments.length + displayedHistoryTickets.length} {t("allRecords", language)}
          </span>
        </div>
      </div>

      {/* Metric Summary Header */}
      <div style={{ marginBottom: "20px" }}>
        <HistorySummary
          patient={selectedMemberHistoryStats.patient}
          summary={selectedMemberHistoryStats.summary}
          isReturningPatient={selectedMemberHistoryStats.isReturningPatient}
          totalVisits={selectedMemberHistoryStats.totalVisits}
          language={language}
        />
      </div>

      {/* Sub-Tabs / Filter Pills + Search & Toggle Bar */}
      <div style={{
        background: "var(--patient-sub-card, #F8FAFC)",
        border: "1px solid var(--patient-card-border, #E2E8F0)",
        borderRadius: "14px",
        padding: "12px 14px",
        marginBottom: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}>
        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: t("allRecords", language), count: historyAppointments.length + historyTickets.length, icon: "📋" },
              { id: "appointments", label: t("prescheduledApts", language), count: historyAppointments.length, icon: "📅" },
              { id: "walkin", label: t("walkinVisits", language), count: historyTickets.length, icon: "🎫" },
              {
                id: "rx",
                label: t("ePrescriptions", language),
                count: (
                  historyTickets.filter((t) => !!t.prescription_notes).length +
                  historyAppointments.filter((a) => !!(a.prescription_notes || (a.ticket_id && userTicketHistory.find((t) => t.ticket_id === a.ticket_id)?.prescription_notes))).length
                ),
                icon: "💊"
              },
            ].map((pill) => {
              const isActive = historyFilterType === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setHistoryFilterType(pill.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: isActive ? "1.5px solid #0284C7" : "1px solid var(--patient-card-border, #E2E8F0)",
                    background: isActive ? "#0284C7" : "var(--patient-card-bg, #FFFFFF)",
                    color: isActive ? "#FFFFFF" : "var(--patient-text-main, #334155)",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{pill.icon}</span>
                  <span>{pill.label}</span>
                  <span style={{
                    padding: "1px 6px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 800,
                    background: isActive ? "rgba(255,255,255,0.25)" : "var(--patient-sub-card, #F1F5F9)",
                    color: isActive ? "#FFFFFF" : "var(--patient-text-sub, #64748B)",
                  }}>
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Show Cancelled / Incomplete Toggle */}
          <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--patient-text-sub, #64748B)", userSelect: "none" }}>
            <input
              type="checkbox"
              id="toggle-show-cancelled-history"
              checked={showCancelledHistory}
              onChange={(e) => setShowCancelledHistory(e.target.checked)}
              style={{ accentColor: "#0284C7", width: "15px", height: "15px", cursor: "pointer" }}
            />
            <span>{t("showCancelledToggle", language)}</span>
          </label>
        </div>

        {/* History Search Bar */}
        <div style={{ position: "relative", width: "100%" }}>
          <input
            type="text"
            id="search-patient-history"
            value={historySearchQuery}
            onChange={(e) => setHistorySearchQuery(e.target.value)}
            placeholder={
              language === "hi"
                ? "🔍 आईडी, डॉक्टर, विभाग, बीमारी या दिनांक से इतिहास खोजें..."
                : "🔍 Search history by Ticket/Apt ID, Doctor, Department, Diagnosis, or Date..."
            }
            style={{
              width: "100%",
              padding: "9px 36px 9px 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--patient-card-border, #CBD5E1)",
              background: "var(--patient-card-bg, #FFFFFF)",
              color: "var(--patient-text-main, #0F172A)",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {historySearchQuery && (
            <button
              type="button"
              onClick={() => setHistorySearchQuery("")}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--patient-text-sub, #94A3B8)",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                padding: "4px",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {displayedHistoryAppointments.length === 0 && displayedHistoryTickets.length === 0 ? (
        <div style={{ padding: "40px 24px", textAlign: "center", background: "var(--patient-sub-card, #F8FAFC)", borderRadius: "16px", border: "1px solid var(--patient-card-border, #E2E8F0)", color: "var(--patient-text-sub, #94A3B8)" }}>
          {historySearchQuery.trim() ? (
            <>
              <p style={{ margin: "0 0 6px 0", color: "var(--patient-text-main, #64748B)", fontWeight: 600, fontSize: "14px" }}>
                {language === "hi"
                  ? `"${historySearchQuery.trim()}" से मेल खाता कोई रिकॉर्ड नहीं मिला`
                  : `No records found matching "${historySearchQuery.trim()}"`}
              </p>
              <button
                type="button"
                onClick={() => setHistorySearchQuery("")}
                style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#0284C7", color: "#FFFFFF", fontWeight: 700, fontSize: "12.5px", cursor: "pointer", marginTop: "10px" }}
              >
                {language === "hi" ? "खोज साफ़ करें" : "Clear Search"}
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 6px 0", color: "var(--patient-text-main, #64748B)", fontWeight: 600, fontSize: "14px" }}>
                {t("noVisitHistoryMsg", language)}
              </p>
              <p style={{ margin: "0 0 14px 0", color: "var(--patient-text-sub, #94A3B8)", fontSize: "12px" }}>
                {t("noVisitHistorySub", language)}
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleTabChange("walkin")}
                  style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: "#0284C7", color: "#FFFFFF", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}
                >
                  {t("getInstantTokenBtn", language)}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("book")}
                  style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid #0284C7", background: "var(--patient-card-bg, #FFFFFF)", color: "#0284C7", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}
                >
                  {t("bookAppointmentBtn", language)}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Walk-in Tickets Section */}
          {displayedHistoryTickets.length > 0 && (
            <>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--patient-text-sub, #64748B)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "4px" }}>
                {t("walkinVisits", language)} ({displayedHistoryTickets.length})
              </div>
              {displayedHistoryTickets.map((tk) => (
                <div
                  key={tk.ticket_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "16px 18px",
                    background: (tk.status || "").toLowerCase() === "cancelled" ? "var(--emergency-card-bg, #FEF2F2)" : "var(--patient-sub-card, #F8FAFC)",
                    border: (tk.status || "").toLowerCase() === "cancelled" ? "1px solid var(--emergency-card-border, #FECACA)" : "1px solid var(--patient-card-border, #E2E8F0)",
                    borderRadius: "14px",
                    flexWrap: "wrap",
                    gap: "14px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "240px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "16px", fontWeight: 900, color: (tk.status || "").toLowerCase() === "cancelled" ? "#DC2626" : "#0284C7" }}>
                        #{tk.ticket_id}
                      </span>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 800,
                        background: (tk.status || "").toLowerCase() === "cancelled" ? "#FEE2E2" : "#E0F2FE",
                        color: (tk.status || "").toLowerCase() === "cancelled" ? "#DC2626" : "#0284C7",
                      }}>
                        {getStatusLabel(tk.status, language)}
                      </span>
                      {tk.transfer_stages && tk.transfer_stages.length > 1 && (
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 800,
                          background: "#EFF6FF",
                          color: "#0284C7",
                          border: "1px solid #BAE6FD",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}>
                          <span>🔄</span>
                          <span>{language === "hi" ? `मल्टी-डिपार्टमेंट (${tk.transfer_stages.length} चरण)` : `Multi-Dept (${tk.transfer_stages.length} Stages)`}</span>
                        </span>
                      )}
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
                        <span>{getHospitalNameForRecord(tk)}</span>
                      </span>
                      {Number(tk.priority) === 1 && (
                        <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 7px", borderRadius: "5px", background: "var(--emergency-card-bg, #FEF2F2)", color: "var(--emergency-card-text, #DC2626)", border: "1px solid var(--emergency-card-border, #FECACA)" }}>
                          {t("emergency", language)}
                        </span>
                      )}
                    </div>

                    <p style={{ margin: "6px 0 2px 0", color: "var(--patient-text-main, #0F172A)", fontWeight: 700, fontSize: "15px" }}>
                      {tk.name} • {getCategoryLabel(tk.service_category, language)}
                    </p>

                    {/* Care Journey Trail for multi-stage transfer */}
                    {tk.transfer_trail && (
                      <div style={{
                        marginTop: "4px",
                        marginBottom: "4px",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        background: "rgba(2, 132, 199, 0.06)",
                        border: "1px solid #BAE6FD",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0369A1",
                        flexWrap: "wrap",
                      }}>
                        <span>🧭 {language === "hi" ? "परामर्श यात्रा:" : "Care Journey:"}</span>
                        <span>{tk.transfer_trail}</span>
                      </div>
                    )}

                    <span style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #64748B)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/><line x1="10" y1="9" x2="14" y2="9"/><line x1="12" y1="7" x2="12" y2="11"/></svg>
                        <strong>{getHospitalNameForRecord(tk)}</strong>
                      </span>
                      <span>•</span>
                      <span>{t("dateLabel", language)}: <strong>{String(tk.created_at || "").slice(0, 10)}</strong></span>
                      {tk.department_name && (
                        <>
                          <span>•</span>
                          <span>Dept: {tk.department_name}</span>
                        </>
                      )}
                      {(tk.all_doctors && tk.all_doctors.length > 1) ? (
                        <>
                          <span>•</span>
                          <span style={{ color: "#0284C7", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                            <span>{language === "hi" ? "चिकित्सक दल" : "Doctors"}: {tk.all_doctors.join(" • ")}</span>
                          </span>
                        </>
                      ) : (tk.doctor_name || tk.served_by_doctor_name) ? (
                        <>
                          <span>•</span>
                          <span style={{ color: "#0284C7", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                            <span>{language === "hi" ? "चिकित्सक" : "Doctor"}: {tk.doctor_name || tk.served_by_doctor_name}</span>
                          </span>
                        </>
                      ) : null}
                    </span>
                    {tk.cancellation_reason && (
                      <p style={{ margin: "4px 0 0 0", fontSize: "11.5px", color: "#DC2626", fontStyle: "italic" }}>
                        Reason: {tk.cancellation_reason}
                      </p>
                    )}

                    {/* Card Actions: Book Follow-Up */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleBookFollowUp(tk)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: "1.5px solid #0284C7",
                          background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 6px rgba(2, 132, 199, 0.2)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>{t("bookFollowUpBtn", language)}</span>
                      </button>
                    </div>

                    {/* Digital Rx Slip section if notes present or visit completed */}
                    {(() => {
                      if (!tk.prescription_notes && (tk.status || "").toLowerCase() !== "completed") return null;
                      const rx = parsePrescription(tk.prescription_notes, tk);
                      if (!rx) return null;
                      return (
                        <div style={{
                          marginTop: "12px",
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(2, 132, 199, 0.02) 100%)",
                          border: "1.5px solid var(--patient-tag-border, #BAE6FD)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--patient-card-border, #E0F2FE)", paddingBottom: "8px", marginBottom: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "12px", fontWeight: 900, color: "#0284C7", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                                <span>{t("ePrescriptionLabel", language)}</span>
                              </span>
                              {rx.doctor_name && (
                                <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "var(--patient-tag-bg, #E0F2FE)", color: "#0369A1", border: "1px solid var(--patient-tag-border, #BAE6FD)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                                  <span>{rx.doctor_name} {rx.doctor_department ? `(${getCategoryLabel(rx.doctor_department, language)})` : ""}</span>
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => handleOpenPrescriptionSlip(tk.prescription_notes, tk)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: "8px",
                                  border: "1.5px solid #0284C7",
                                  background: "var(--patient-card-bg, #FFFFFF)",
                                  color: "#0284C7",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  boxShadow: "0 1px 3px rgba(2, 132, 199, 0.12)",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                <span>{language === "hi" ? "दवा पर्ची देखें (Rx)" : "View Rx Slip"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const parsed = parsePrescription(tk.prescription_notes, tk);
                                  downloadPrescriptionPDF(parsed, language, hospitalBranding);
                                  setStatusMsg(t("downloadRxPdfSuccess", language));
                                  if (showToast) showToast(t("downloadRxPdfSuccess", language), "success");
                                }}
                                title={t("downloadClinicalRxPdf", language)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: "8px",
                                  border: "none",
                                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                  color: "#FFFFFF",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/>
                                  <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                <span>{t("downloadPdfShort", language)}</span>
                              </button>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {rx.diagnosis && (
                              <div style={{ fontSize: "13px", color: "#0369A1" }}>
                                <strong style={{ color: "var(--patient-text-main, #0F172A)" }}>{language === "hi" ? "निदान" : "Diagnosis"}:</strong>{" "}
                                <span style={{ fontWeight: 800, color: "#0284C7", background: "var(--patient-tag-bg, #E0F2FE)", padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--patient-tag-border, #BAE6FD)" }}>
                                  {formatCleanText(rx.diagnosis, language)}
                                </span>
                              </div>
                            )}

                            {rx.medicines && rx.medicines.length > 0 && (
                              <div style={{ marginTop: "4px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 800, color: "#0369A1", textTransform: "uppercase" }}>
                                  {language === "hi" ? "दवाइयाँ" : "Prescribed Medicines"}:
                                </span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                                  {rx.medicines.map((m, mIdx) => (
                                    <span
                                      key={mIdx}
                                      style={{
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        color: "var(--patient-tag-color, #0369A1)",
                                        background: "var(--patient-card-bg, #FFFFFF)",
                                        border: "1px solid var(--patient-tag-border, #BAE6FD)",
                                        padding: "3px 9px",
                                        borderRadius: "6px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                                      }}
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                                      <strong>{formatCleanText(m.name, language)}</strong>
                                      {m.dosage ? ` • ${formatCleanText(m.dosage, language)}` : ""}
                                      {m.frequency ? ` (${formatCleanText(m.frequency, language)})` : ""}
                                      {m.duration ? ` [${formatCleanText(m.duration, language)}]` : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {rx.advice && (
                              <div style={{ fontSize: "12px", color: "var(--patient-tag-color, #0369A1)", marginTop: "4px", fontStyle: "italic" }}>
                                <strong>{language === "hi" ? "सलाह" : "Advice"}:</strong> "{rx.advice}"
                              </div>
                            )}

                            {rx.lab_tests && rx.lab_tests !== "no" && (
                              <div style={{ fontSize: "12px", color: "var(--patient-tag-color, #0369A1)", marginTop: "2px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>
                                <span><strong>{language === "hi" ? "जाँच" : "Tests"}:</strong> {rx.lab_tests}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ textAlign: "right", marginLeft: "14px" }}>
                    <span style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", display: "block" }}>
                      {t("finalVisitStatus", language)}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#0284C7" }}>
                      {getStatusLabel(tk.status || "completed", language)}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Appointment History Section */}
          {displayedHistoryAppointments.length > 0 && (
            <>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--patient-text-sub, #64748B)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "14px" }}>
                {t("prescheduledApts", language)} ({displayedHistoryAppointments.length})
              </div>
              {displayedHistoryAppointments.map((apt) => (
                <div
                  key={apt.appointment_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "16px 18px",
                    background: (apt.status || "").toLowerCase() === "cancelled" ? "var(--emergency-card-bg, #FEF2F2)" : "var(--patient-sub-card, #F8FAFC)",
                    border: (apt.status || "").toLowerCase() === "cancelled" ? "1px solid var(--emergency-card-border, #FECACA)" : "1px solid var(--patient-card-border, #E2E8F0)",
                    borderRadius: "14px",
                    flexWrap: "wrap",
                    gap: "14px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "240px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "16px", fontWeight: 900, color: (apt.status || "").toLowerCase() === "cancelled" ? "#DC2626" : "#0284C7" }}>
                        {apt.appointment_id}
                      </span>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 800,
                        background: (apt.status || "").toLowerCase() === "cancelled" ? "#FEE2E2" : "#E0F2FE",
                        color: (apt.status || "").toLowerCase() === "cancelled" ? "#DC2626" : "#0284C7",
                      }}>
                        {getStatusLabel(apt.status, language)}
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
                    </div>

                    <p style={{ margin: "6px 0 2px 0", color: "var(--patient-text-main, #0F172A)", fontWeight: 700, fontSize: "15px" }}>
                      {apt.patient_name} — {getDeptDisplayName(apt)}
                    </p>

                    <span style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #64748B)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/><line x1="10" y1="9" x2="14" y2="9"/><line x1="12" y1="7" x2="12" y2="11"/></svg>
                        <strong>{getHospitalNameForRecord(apt)}</strong>
                      </span>
                      <span>•</span>
                      <span>{t("dateLabel", language)}: <strong>{apt.appointment_date}</strong></span>
                      <span>•</span>
                      <span>{t("slotLabel", language)}: <strong>{apt.time_slot}</strong></span>
                      <span>•</span>
                      <span>Dept: <strong>{getDeptDisplayName(apt)}</strong></span>
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

                    {/* Card Actions: Book Follow-Up */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleBookFollowUp(apt)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: "1.5px solid #0284C7",
                          background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 6px rgba(2, 132, 199, 0.2)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>{t("bookFollowUpBtn", language)}</span>
                      </button>
                    </div>

                    {/* Digital Rx Slip section if notes present or appointment completed */}
                    {(() => {
                      const effectiveRxNotes = apt.prescription_notes || (apt.ticket_id && userTicketHistory.find((t) => t.ticket_id === apt.ticket_id)?.prescription_notes) || "";
                      if (!effectiveRxNotes && (apt.status || "").toLowerCase() !== "completed") return null;
                      const rx = parsePrescription(effectiveRxNotes, apt);
                      if (!rx) return null;
                      return (
                        <div style={{
                          marginTop: "12px",
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(2, 132, 199, 0.02) 100%)",
                          border: "1.5px solid var(--patient-tag-border, #BAE6FD)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--patient-card-border, #E0F2FE)", paddingBottom: "10px", marginBottom: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "12px", fontWeight: 900, color: "#0284C7", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                                <span>{t("ePrescriptionLabel", language)}</span>
                              </span>
                              {rx.doctor_name && (
                                <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "var(--patient-tag-bg, #E0F2FE)", color: "var(--patient-tag-color, #0369A1)", border: "1px solid var(--patient-tag-border, #BAE6FD)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                                  <span>{rx.doctor_name} {rx.doctor_department ? `(${getCategoryLabel(rx.doctor_department, language)})` : ""}</span>
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => handleOpenPrescriptionSlip(effectiveRxNotes, apt)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: "8px",
                                  border: "1.5px solid #0284C7",
                                  background: "var(--patient-card-bg, #FFFFFF)",
                                  color: "#0284C7",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  boxShadow: "0 1px 3px rgba(2, 132, 199, 0.12)",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--patient-tag-bg, #E0F2FE)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--patient-card-bg, #FFFFFF)"; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                <span>{language === "hi" ? "दवा पर्ची देखें (Rx)" : "View Rx Slip"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const parsed = parsePrescription(effectiveRxNotes, apt);
                                  downloadPrescriptionPDF(parsed, language, hospitalBranding);
                                  setStatusMsg(t("downloadRxPdfSuccess", language));
                                  if (showToast) showToast(t("downloadRxPdfSuccess", language), "success");
                                }}
                                title={t("downloadClinicalRxPdf", language)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: "8px",
                                  border: "none",
                                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                  color: "#FFFFFF",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/>
                                  <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                <span>{t("downloadPdfShort", language)}</span>
                              </button>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {rx.diagnosis && (
                              <div style={{ fontSize: "13px", color: "var(--patient-tag-color, #0369A1)" }}>
                                <strong style={{ color: "var(--patient-text-main, #0F172A)" }}>{language === "hi" ? "निदान" : "Diagnosis"}:</strong>{" "}
                                <span style={{ fontWeight: 800, color: "#0284C7", background: "var(--patient-tag-bg, #E0F2FE)", padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--patient-tag-border, #BAE6FD)" }}>
                                  {formatCleanText(rx.diagnosis, language)}
                                </span>
                              </div>
                            )}

                            {rx.medicines && rx.medicines.length > 0 && (
                              <div style={{ marginTop: "4px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--patient-tag-color, #0369A1)", textTransform: "uppercase" }}>
                                  {language === "hi" ? "दवाइयाँ" : "Prescribed Medicines"}:
                                </span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                                  {rx.medicines.map((m, mIdx) => (
                                    <span
                                      key={mIdx}
                                      style={{
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        color: "var(--patient-tag-color, #0369A1)",
                                        background: "var(--patient-card-bg, #FFFFFF)",
                                        border: "1px solid var(--patient-tag-border, #BAE6FD)",
                                        padding: "3px 9px",
                                        borderRadius: "6px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                                      }}
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                                      <strong>{formatCleanText(m.name, language)}</strong>
                                      {m.dosage ? ` • ${formatCleanText(m.dosage, language)}` : ""}
                                      {m.frequency ? ` (${formatCleanText(m.frequency, language)})` : ""}
                                      {m.duration ? ` [${formatCleanText(m.duration, language)}]` : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {rx.advice && (
                              <div style={{ fontSize: "12px", color: "var(--patient-tag-color, #0369A1)", marginTop: "4px", fontStyle: "italic" }}>
                                <strong>{language === "hi" ? "सलाह" : "Advice"}:</strong> "{rx.advice}"
                              </div>
                            )}

                            {rx.lab_tests && rx.lab_tests !== "no" && (
                              <div style={{ fontSize: "12px", color: "var(--patient-tag-color, #0369A1)", marginTop: "2px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>
                                <span><strong>{language === "hi" ? "जाँच" : "Tests"}:</strong> {rx.lab_tests}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ textAlign: "right", marginLeft: "14px" }}>
                    <span style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", display: "block" }}>
                      {t("finalVisitStatus", language)}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#0284C7" }}>
                      {getStatusLabel(apt.status || "completed", language)}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
