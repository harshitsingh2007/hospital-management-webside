/**
 * FamilyMemberSwitcher.jsx
 * ------------------------
 * Horizontal profile selector & modal manager for family dependents:
 * Allows managing queue passes, walk-ins, and bookings for Self, Children, Spouse, Parents, etc.
 * Theme: Soft Green Clinical (Clean Healthcare SaaS)
 */

import React, { useState } from "react";
import { t } from "../../utils/i18n";

export const getRelationLabel = (relation, language = "en") => {
  if (!relation) return t("relation_other", language);
  const key = `relation_${relation.toLowerCase()}`;
  const translated = t(key, language);
  return translated || relation;
};

/**
 * Reusable Add Family Member Modal
 */
export function AddFamilyMemberModal({
  isOpen,
  onClose,
  onAddMember,
  language = "en",
}) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("child");
  const [age, setAge] = useState("8");
  const [gender, setGender] = useState("male");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError(
        language === "hi"
          ? "कृपया सदस्य का पूरा नाम दर्ज करें।"
          : "Please enter the member's full name."
      );
      return;
    }

    const member = {
      id: `dep_${Date.now()}`,
      name: name.trim(),
      relation,
      age: Number(age) || 25,
      gender,
      phone: phone.trim(),
    };

    if (onAddMember) onAddMember(member);
    setName("");
    setRelation("child");
    setAge("8");
    setGender("male");
    setPhone("");
    setFormError("");
    if (onClose) onClose();
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "19px", color: "var(--patient-text-main, #0F172A)", fontWeight: 800, letterSpacing: "-0.4px" }}>
              {t("addMemberTitle", language)}
            </h3>
            <span style={{ fontSize: "13px", color: "var(--patient-text-sub, #64748B)", fontWeight: 500 }}>
              {t("addMemberDesc", language)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={closeBtnStyle}
            title={t("cancelBtn", language)}
          >
            ×
          </button>
        </div>

        {formError && (
          <div style={{ marginBottom: "14px", padding: "8px 12px", borderRadius: "8px", background: "#FEF2F2", color: "#DC2626", fontSize: "12px", fontWeight: 600 }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label style={fieldLabelStyle}>{t("memberNameLabel", language)}</label>
            <input
              type="text"
              placeholder={language === "hi" ? "उदा. आरव शर्मा" : "e.g. Aarav Verma"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              required
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={fieldLabelStyle}>{t("relationshipLabel", language)}</label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                style={inputStyle}
              >
                <option value="child">{getRelationLabel("child", language)}</option>
                <option value="spouse">{getRelationLabel("spouse", language)}</option>
                <option value="parent">{getRelationLabel("parent", language)}</option>
                <option value="sibling">{getRelationLabel("sibling", language)}</option>
                <option value="other">{getRelationLabel("other", language)}</option>
              </select>
            </div>

            <div>
              <label style={fieldLabelStyle}>{t("memberAgeLabel", language)}</label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={fieldLabelStyle}>{language === "hi" ? "फ़ोन नंबर (वैकल्पिक)" : "Phone Number (Optional)"}</label>
            <input
              type="tel"
              placeholder={language === "hi" ? "उदा. +91 9876543210" : "e.g. +91 9876543210"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={fieldLabelStyle}>{t("memberGenderLabel", language)}</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {["male", "female", "other"].map((g) => (
                <label
                  key={g}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: gender === g ? "2px solid #0284C7" : "1px solid var(--patient-card-border, #CBD5E1)",
                    background: gender === g ? "var(--patient-tag-bg, #F0F9FF)" : "var(--patient-sub-card, #FFFFFF)",
                    color: gender === g ? "#0284C7" : "var(--patient-text-sub, #475569)",
                    fontSize: "12px",
                    fontWeight: 700,
                    textAlign: "center",
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="modalMemberGender"
                    value={g}
                    checked={gender === g}
                    onChange={() => setGender(g)}
                    style={{ display: "none" }}
                  />
                  {t(g, language)}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={cancelBtnStyle}
            >
              {t("cancelBtn", language)}
            </button>
            <button
              type="submit"
              style={submitBtnStyle}
            >
              {t("saveMemberBtn", language)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Edit Family Member Modal
 */
export function EditFamilyMemberModal({
  isOpen,
  onClose,
  onSaveMember,
  member,
  language = "en",
}) {
  const [name, setName] = useState(member?.name || "");
  const [relation, setRelation] = useState(member?.relation || "child");
  const [age, setAge] = useState(String(member?.age || "25"));
  const [gender, setGender] = useState(member?.gender || "male");
  const [phone, setPhone] = useState(member?.phone || "");
  const [formError, setFormError] = useState("");

  // Reset on member change
  React.useEffect(() => {
    if (member) {
      setName(member.name || "");
      setRelation(member.relation || "child");
      setAge(String(member.age || "25"));
      setGender(member.gender || "male");
      setPhone(member.phone || "");
      setFormError("");
    }
  }, [member?.id]);

  if (!isOpen || !member) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError(language === "hi" ? "कृपया नाम दर्ज करें." : "Please enter the member's full name.");
      return;
    }
    if (onSaveMember) {
      onSaveMember({
        id: member.id,
        name: name.trim(),
        relation,
        age: Number(age) || 25,
        gender,
        phone: phone.trim(),
      });
    }
    if (onClose) onClose();
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", color: "#0369A1", fontWeight: 800 }}>
              {language === "hi" ? "सदस्य संपादित करें" : "Edit Family Member"}
            </h3>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              {language === "hi" ? "विवरण अपडेट करें" : "Update member details"}
            </span>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {formError && (
          <div style={{ marginBottom: "14px", padding: "8px 12px", borderRadius: "8px", background: "#FEF2F2", color: "#DC2626", fontSize: "12px", fontWeight: 600 }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label style={fieldLabelStyle}>{language === "hi" ? "पूरा नाम" : "Full Name"}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              required
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={fieldLabelStyle}>{language === "hi" ? "संबंध" : "Relationship"}</label>
              <select value={relation} onChange={(e) => setRelation(e.target.value)} style={inputStyle}>
                <option value="child">{getRelationLabel("child", language)}</option>
                <option value="spouse">{getRelationLabel("spouse", language)}</option>
                <option value="parent">{getRelationLabel("parent", language)}</option>
                <option value="sibling">{getRelationLabel("sibling", language)}</option>
                <option value="other">{getRelationLabel("other", language)}</option>
              </select>
            </div>
            <div>
              <label style={fieldLabelStyle}>{language === "hi" ? "आयु" : "Age"}</label>
              <input
                type="number" min="1" max="120"
                value={age} onChange={(e) => setAge(e.target.value)}
                style={inputStyle} required
              />
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={fieldLabelStyle}>{language === "hi" ? "फ़ोन नंबर (वैकल्पिक)" : "Phone Number (Optional)"}</label>
            <input
              type="tel"
              placeholder={language === "hi" ? "उदा. +91 9876543210" : "e.g. +91 9876543210"}
              value={phone} onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={fieldLabelStyle}>{language === "hi" ? "लिंग" : "Gender"}</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {["male", "female", "other"].map((g) => (
                <label key={g} style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: gender === g ? "2px solid #0284C7" : "1px solid var(--patient-card-border, #CBD5E1)", background: gender === g ? "var(--patient-tag-bg, #F0F9FF)" : "var(--patient-sub-card, #FFFFFF)", color: gender === g ? "#0284C7" : "var(--patient-text-sub, #475569)", fontSize: "12px", fontWeight: 700, textAlign: "center", cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s ease" }}>
                  <input type="radio" name="editMemberGender" value={g} checked={gender === g} onChange={() => setGender(g)} style={{ display: "none" }} />
                  {g}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>
              {language === "hi" ? "रद्द करें" : "Cancel"}
            </button>
            <button type="submit" style={submitBtnStyle}>
              {language === "hi" ? "सेव करें" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Main FamilyMemberSwitcher Component
 */
export default function FamilyMemberSwitcher({
  members = [],
  selectedMemberId = "self",
  onSelectMember,
  onAddMember,
  onDeleteMember,
  language = "en",
  familyTickets = {},
}) {
  const activeTicketCount = Object.values(familyTickets || {}).filter(
    (t, idx, arr) =>
      t &&
      t.ticket_id &&
      ["waiting", "serving", "on_hold", "hold"].includes(String(t.status || "").toLowerCase()) &&
      arr.findIndex((x) => x?.ticket_id === t.ticket_id) === idx
  ).length;

  const depNames = (members || [])
    .filter((m) => m && m.relation !== "self" && m.id !== "self")
    .map((m) => String(m.name || "").toLowerCase().trim())
    .filter(Boolean);

  return (
    <div style={containerStyle}>
      <div style={headerRowStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#0369A1", letterSpacing: "0.5px", textTransform: "uppercase" }}>
            {t("bookingFor", language)}
          </span>
          {activeTicketCount > 0 && (
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                background: "#FEF3C7",
                color: "#92400E",
                border: "1px solid #FDE68A",
                padding: "1px 7px",
                borderRadius: "12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>🎟️</span>
              <span>{activeTicketCount} {language === "hi" ? "सक्रिय टोकन" : activeTicketCount === 1 ? "Active Token" : "Active Tokens"}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (onAddMember) onAddMember();
          }}
          style={addTriggerBtnStyle}
          title={t("addMemberTitle", language)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("addMember", language)}
        </button>
      </div>

      {/* Horizontal Pill Bar */}
      <div style={pillsScrollContainerStyle}>
        {(members || []).map((member) => {
          const isSelected = member.id === selectedMemberId;
          const isSelf = member.relation === "self";
          const selfTicket = familyTickets && familyTickets["self"];
          const isSelfTicketValid = selfTicket && !depNames.includes(String(selfTicket.name || "").toLowerCase().trim()) && (!selfTicket.family_member_id || selfTicket.family_member_id === "self");

          const memTicket = isSelf
            ? (isSelfTicketValid ? selfTicket : null)
            : (familyTickets &&
                (familyTickets[member.id] ||
                  familyTickets[String(member.id)] ||
                  (member.name
                    ? familyTickets[`name_${member.name.toLowerCase().trim()}`] ||
                      familyTickets[member.name.toLowerCase().trim()]
                    : null)));
          const isLiveTicket = memTicket && ["waiting", "serving", "on_hold", "hold"].includes(String(memTicket.status || "").toLowerCase());

          return (
            <div
              key={member.id}
              onClick={() => onSelectMember && onSelectMember(member)}
              style={getPillStyle(isSelected)}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {isSelf ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#FFFFFF" : "#0369A1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#FFFFFF" : "#0284C7"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                <span style={{ fontWeight: isSelected ? 800 : 700, fontSize: "13px" }}>
                  {member.name}
                </span>
                <span style={getTagStyle(isSelected, isSelf)}>
                  {getRelationLabel(member.relation, language)}
                </span>
                {isLiveTicket ? (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: "6px",
                      background: isSelected ? "rgba(255, 255, 255, 0.28)" : "#FEF3C7",
                      color: isSelected ? "#FFFFFF" : "#92400E",
                      border: isSelected ? "1px solid rgba(255, 255, 255, 0.45)" : "1px solid #FDE68A",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <span>🎟️</span>
                    <span>#{memTicket.ticket_id}</span>
                  </span>
                ) : null}
              </div>

              {/* Delete Button for dependents */}
              {!isSelf && onDeleteMember && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const msg = language === "hi"
                      ? `क्या आप वाकई ${member.name} को हटाना चाहते हैं?`
                      : `Remove ${member.name}?`;
                    if (window.confirm(msg)) {
                      onDeleteMember(member.id);
                    }
                  }}
                  style={deleteMemberBtnStyle(isSelected)}
                  title={t("removeMemberBtn", language)}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Styling definitions
const containerStyle = {
  background: "var(--patient-card-bg, #FFFFFF)",
  borderRadius: "14px",
  border: "1px solid var(--patient-card-border, #E2E8F0)",
  padding: "12px 16px",
  marginBottom: "18px",
  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.03)",
  color: "var(--patient-text-main, #0F172A)",
};

const headerRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
};

const addTriggerBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "5px 12px",
  borderRadius: "8px",
  border: "1px solid var(--patient-tag-border, #BAE6FD)",
  background: "var(--patient-tag-bg, #F0F9FF)",
  color: "var(--patient-tag-color, #0369A1)",
  fontWeight: 800,
  fontSize: "11.5px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const pillsScrollContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  overflowX: "auto",
  paddingBottom: "6px",
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "none",
};

const getPillStyle = (isSelected) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "7px 13px",
  borderRadius: "10px",
  border: isSelected ? "1.5px solid #0284C7" : "1px solid var(--patient-card-border, #CBD5E1)",
  background: isSelected ? "#0284C7" : "var(--patient-sub-card, #F8FAFC)",
  color: isSelected ? "#FFFFFF" : "var(--patient-text-main, #0F172A)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.2s ease",
  boxShadow: isSelected ? "0 2px 8px rgba(2, 132, 199, 0.25)" : "none",
  flexShrink: 0,
});

const getTagStyle = (isSelected, isSelf) => ({
  padding: "2px 6px",
  borderRadius: "4px",
  fontSize: "10px",
  fontWeight: 800,
  background: isSelected
    ? "rgba(255, 255, 255, 0.25)"
    : "var(--patient-tag-bg, #F0F9FF)",
  color: isSelected
    ? "#FFFFFF"
    : "var(--patient-tag-color, #0369A1)",
  border: isSelected ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid var(--patient-tag-border, transparent)",
});

const deleteMemberBtnStyle = (isSelected) => ({
  background: "transparent",
  border: "none",
  color: isSelected ? "rgba(255, 255, 255, 0.85)" : "#94A3B8",
  fontSize: "15px",
  fontWeight: 800,
  cursor: "pointer",
  padding: "0 0 0 4px",
  lineHeight: 1,
});

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(15, 23, 42, 0.65)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "16px",
};

const modalContentStyle = {
  background: "var(--patient-card-bg, #FFFFFF)",
  borderRadius: "18px",
  border: "1px solid var(--patient-card-border, #E2E8F0)",
  color: "var(--patient-text-main, #0F172A)",
  width: "100%",
  maxWidth: "min(92vw, 440px)",
  maxHeight: "88vh",
  overflowY: "auto",
  padding: "clamp(16px, 3.5vw, 24px)",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.35)",
  boxSizing: "border-box",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "18px",
  paddingBottom: "12px",
  borderBottom: "1px solid var(--patient-card-border, #E2E8F0)",
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  fontSize: "22px",
  color: "#64748B",
  cursor: "pointer",
  lineHeight: 1,
};

const fieldLabelStyle = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  color: "var(--patient-text-sub, #475569)",
  marginBottom: "6px",
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const inputStyle = {
  width: "100%",
  height: "44px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1.5px solid var(--patient-card-border, #CBD5E1)",
  background: "var(--patient-sub-card, #F8FAFC)",
  color: "var(--patient-text-main, #0F172A)",
  fontSize: "14px",
  fontWeight: 500,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const cancelBtnStyle = {
  padding: "9px 18px",
  borderRadius: "10px",
  border: "1px solid var(--patient-card-border, #CBD5E1)",
  background: "var(--patient-sub-card, #FFFFFF)",
  color: "var(--patient-text-sub, #475569)",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const submitBtnStyle = {
  padding: "9px 20px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
  color: "#FFFFFF",
  fontSize: "13.5px",
  fontWeight: 700,
  letterSpacing: "-0.1px",
  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
  cursor: "pointer",
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};
