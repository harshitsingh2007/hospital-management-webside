import React from "react";
import { t, getCategoryLabel, getStatusLabel, SYMPTOM_OPTIONS, RISK_OPTIONS } from "../../utils/i18n";
import { HOSPITAL_CONFIG } from "../../config/hospitalConfig";

/**
 * WalkinTab
 * ---------
 * Patient self-checkin walk-in tab with 1-ticket guard, registration cutoff alerts,
 * demographic inputs, department selection, and triage priority.
 */
export default function WalkinTab({
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
  registrationStatus = { isClosed: false, reason: "" },
  handleJoinQueue,
  name,
  setName,
  age,
  setAge,
  gender,
  setGender,
  category,
  setCategory,
  availableDepartments = [],
  getDeptDisplayName = (id) => id,
  medicalCondition,
  setMedicalCondition,
  customSymptom,
  setCustomSymptom,
  preExistingCondition,
  setPreExistingCondition,
  priority,
  setPriority,
}) {
  return (
    <div>
      {/* Form Header with Walk-In Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "22px", color: "var(--patient-text-main, #0F172A)", fontWeight: 800, letterSpacing: "-0.4px" }}>
            {t("instantWalkin", language)}
          </h2>
          <p style={{ margin: 0, color: "var(--patient-text-sub, #64748B)", fontSize: "13.5px", fontWeight: 500, lineHeight: 1.55 }}>
            {hospitalBranding?.hospital_name || hospitalBranding?.name || HOSPITAL_CONFIG.name} — {language === "hi" ? "तत्काल टोकन एवं प्रतीक्षा ट्रैकर" : "Instant Token & Real-Time Wait Tracker"}
          </p>
        </div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            background: "var(--patient-tag-bg, #F0F9FF)",
            color: "var(--patient-tag-color, #0284C7)",
            border: "1px solid var(--patient-tag-border, #BAE6FD)",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          Walk-In
        </span>
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
      ) : (
        <>
          {/* Operating Hours & Cutoff Status Banner */}
          {registrationStatus.isClosed ? (
            <div
              style={{
                marginBottom: "18px",
                padding: "14px 16px",
                borderRadius: "12px",
                background: "#FFFBEB",
                border: "1.5px solid #FDE68A",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", color: "#D97706", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: "#B45309", fontSize: "13.5px" }}>
                  {language === "hi" ? "दैनिक ओपीडी पंजीकरण बंद है" : "OPD Registration Currently Closed"}
                </div>
                <div style={{ fontSize: "12px", color: "#92400E", marginTop: "2px", lineHeight: 1.4 }}>
                  {hospitalBranding?.closed_notice ||
                    (language === "hi"
                      ? "आज के लिए ओपीडी पंजीकरण बंद है। आपातकालीन (Emergency) मरीज 24/7 कभी भी रजिस्टर कर सकते हैं।"
                      : "Registrations are closed for today. Emergency triage registrations remain active 24/7.")}
                </div>
                <div style={{ fontSize: "11.5px", color: "#B45309", marginTop: "5px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <span>{registrationStatus.reason}</span>
                </div>
              </div>
            </div>
          ) : hospitalBranding?.registration_cutoff_time ? (
            <div
              style={{
                marginBottom: "16px",
                padding: "8px 14px",
                borderRadius: "10px",
                background: "#F0F9FF",
                border: "1px solid #BAE6FD",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "#0369A1",
                fontWeight: 700,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>
                {language === "hi"
                  ? `ओपीडी पंजीकरण खुला है • दैनिक कटऑफ: ${hospitalBranding.registration_cutoff_time} तक`
                  : `OPD Registration Open • Daily Cutoff: ${hospitalBranding.registration_cutoff_time}`}
              </span>
            </div>
          ) : null}

          <form onSubmit={handleJoinQueue}>
            {/* Row 1: Patient Full Name & Patient Age & Gender */}
            <div className="form-grid-2col">
              <div>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className="form-field-label">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {t("ageLabel", language)}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="modern-form-input"
                  />
                </div>
                <div>
                  <label className="form-field-label">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    {t("genderLabel", language)}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="modern-form-input modern-form-select"
                  >
                    <option value="male">{t("male", language)}</option>
                    <option value="female">{t("female", language)}</option>
                    <option value="other">{t("other", language)}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2: Service Department & Primary Medical Concern */}
            <div className="form-grid-2col">
              <div>
                <label className="form-field-label">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <path d="M9 22v-4h6v4" />
                  </svg>
                  {t("serviceDeptLabel", language)}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="modern-form-input modern-form-select"
                >
                  {availableDepartments.map((c) => (
                    <option key={c.id} value={c.id}>
                      {getDeptDisplayName(c.id)}
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
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  {t("symptomLabel", language)}
                </label>
                <select
                  value={medicalCondition}
                  onChange={(e) => {
                    setMedicalCondition(e.target.value);
                    if (e.target.value !== "other_custom") {
                      setCustomSymptom("");
                    }
                  }}
                  className="modern-form-input modern-form-select"
                >
                  {SYMPTOM_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {language === "hi" ? opt.labelHi : opt.label}
                    </option>
                  ))}
                </select>

                {/* Custom Symptom Input if user selects Other */}
                {medicalCondition === "other_custom" && (
                  <div style={{ marginTop: "10px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "#0284C7", display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      <span>{t("customSymptomLabel", language)}</span>
                    </label>
                    <input
                      type="text"
                      value={customSymptom}
                      onChange={(e) => setCustomSymptom(e.target.value)}
                      placeholder={t("customSymptomPlaceholder", language)}
                      required
                      className="modern-form-input"
                      style={{
                        borderColor: "#0284C7",
                        background: "var(--patient-tag-bg, #F0F9FF)",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Pre-Existing Condition Risk */}
            <div style={{ marginBottom: "16px" }}>
              <label className="form-field-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {t("preExistingLabel", language)}
              </label>
              <select
                value={preExistingCondition}
                onChange={(e) => setPreExistingCondition(e.target.value)}
                className="modern-form-input modern-form-select"
              >
                {RISK_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {language === "hi" ? opt.labelHi : opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 4: Priority & Triage Level Selection */}
            <div style={{ marginBottom: "24px" }}>
              <label className="form-field-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {t("priorityTriageLabel", language)}
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                {/* Routine Case Option */}
                <button
                  type="button"
                  onClick={() => setPriority(2)}
                  className={`modern-triage-card ${priority === 2 ? "active-routine" : "inactive-triage"}`}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: priority === 2 ? "#0284C7" : "var(--patient-sub-card, #F1F5F9)",
                      color: priority === 2 ? "#FFFFFF" : "var(--patient-text-sub, #64748B)",
                      border: priority === 2 ? "none" : "1px solid var(--patient-card-border, #CBD5E1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.18s ease",
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={priority === 2 ? "3" : "2"} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <div className="triage-title">
                      {t("routineCase", language)}
                    </div>
                    <div className="triage-subtitle" style={{ marginTop: "2px" }}>
                      {t("standardOrder", language)}
                    </div>
                  </div>
                </button>

                {/* Emergency Case Option */}
                <button
                  type="button"
                  onClick={() => setPriority(1)}
                  className={`modern-triage-card ${priority === 1 ? "active-emergency" : "inactive-triage"}`}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: priority === 1 ? "#EF4444" : "var(--patient-sub-card, #F1F5F9)",
                      color: priority === 1 ? "#FFFFFF" : "var(--patient-text-sub, #64748B)",
                      border: priority === 1 ? "none" : "1px solid var(--patient-card-border, #CBD5E1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.18s ease",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={priority === 1 ? "2.5" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <div className="triage-title">
                      {t("emergencyCase", language)}
                    </div>
                    <div className="triage-subtitle" style={{ marginTop: "2px" }}>
                      {t("priorityJump", language)}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Submit Primary Button: Only active when OPD is open OR for Emergency triage cases */}
            {registrationStatus.isClosed && Number(priority) !== 1 ? (
              <div
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  background: "#FEF2F2",
                  border: "1.5px solid #FCA5A5",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#DC2626", fontWeight: 800, fontSize: "14px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{language === "hi" ? "ओपीडी पंजीकरण वर्तमान में बंद है" : "OPD Queue Registration Closed"}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#991B1B", fontWeight: 500, lineHeight: 1.4 }}>
                  {registrationStatus.reason || (language === "hi"
                    ? "ओपीडी समय समाप्त हो चुका है। केवल आपातकालीन (Emergency) मरीज ही पंजीकरण कर सकते हैं।"
                    : "Queue registration only works when the OPD is open. For critical emergencies, switch to Emergency Case above.")}
                </div>
              </div>
            ) : (
              <button
                type="submit"
                className="modern-submit-btn"
                style={Number(priority) === 1 ? { background: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)", boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)" } : {}}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                    <polygon points="12 8 13.2 11.4 16.8 11.4 13.9 13.5 15 16.9 12 14.8 9 16.9 10.1 13.5 7.2 11.4 10.8 11.4 12 8" fill="rgba(255,255,255,0.2)" />
                  </svg>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "14.5px", fontWeight: 800, letterSpacing: "-0.2px", color: "#FFFFFF", lineHeight: 1.2 }}>
                      {Number(priority) === 1
                        ? (language === "hi" ? "आपातकालीन टोकन प्राप्त करें" : "Get Emergency Token")
                        : t("getTicketBtn", language)}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: 500, color: Number(priority) === 1 ? "#FECACA" : "#BAE6FD", marginTop: "2px" }}>
                      {Number(priority) === 1 ? "Immediate Triage & Critical Care" : "Generate Token & Join Queue"}
                    </div>
                  </div>
                </div>
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
}
