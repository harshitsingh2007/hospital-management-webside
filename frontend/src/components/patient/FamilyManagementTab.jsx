import React from "react";
import { t } from "../../utils/i18n";
import { getRelationLabel } from "./FamilyMemberSwitcher";
import { standaloneCardStyle } from "./patientStyles";

/**
 * FamilyManagementTab
 * -------------------
 * Dedicated family dependent and profile manager. Allows viewing, selecting,
 * adding, editing, and removing family member profiles.
 */
export default function FamilyManagementTab({
  language = "en",
  familyMembers = [],
  selectedMemberId = "self",
  handleSelectMember,
  handleTabChange,
  setShowAddMemberModal,
  setEditingMember,
  handleDeleteMember,
  showConfirm,
  familyTickets = {},
}) {
  return (
    <div style={standaloneCardStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px", borderBottom: "1px solid var(--patient-card-border, #E2E8F0)", paddingBottom: "18px" }}>
        <div>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "22px", color: "var(--patient-text-main, #0F172A)", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--patient-tag-bg, #E0F2FE)", color: "#0284C7", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span>{language === "hi" ? "परिवार सदस्य एवं आश्रित प्रोफ़ाइल" : "Family Member & Dependent Profiles"}</span>
          </h3>
          <span style={{ fontSize: "13px", color: "var(--patient-text-sub, #64748B)" }}>
            {language === "hi"
              ? "एक-क्लिक टोकन एवं क्लिनिक अपॉइंटमेंट के लिए अपने बच्चों, जीवनसाथी या बुजुर्ग माता-पिता को जोड़ें।"
              : "Easily register children, spouse, or elderly parents for one-tap queue tickets and scheduled clinic visits."}
          </span>
        </div>
        <button
          type="button"
          id="add-family-member-btn"
          onClick={() => setShowAddMemberModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "13.5px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
            transition: "all 0.15s ease",
          }}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
          <span>{language === "hi" ? "नया सदस्य जोड़ें" : "Add Family Member"}</span>
        </button>
      </div>

      {/* Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "16px" }}>
        {(() => {
          const depNames = familyMembers.filter((m) => m && m.id !== "self").map((m) => String(m.name || "").toLowerCase().trim()).filter(Boolean);
          return familyMembers.map((member) => {
            const isSelected = selectedMemberId === member.id;
            const isSelf = member.id === "self";
            const relationLabel = isSelf
              ? (language === "hi" ? "प्राथमिक (स्वयं)" : "Primary (Self)")
              : getRelationLabel(member.relation, language);
            const selfTicket = familyTickets["self"];
            const isSelfTicketValid = selfTicket && !depNames.includes(String(selfTicket.name || "").toLowerCase().trim()) && (!selfTicket.family_member_id || selfTicket.family_member_id === "self");
            const memberTicket = isSelf
              ? (isSelfTicketValid ? selfTicket : null)
              : (familyTickets[member.id] ||
                 familyTickets[String(member.id)] ||
                 (member.name
                   ? familyTickets[`name_${member.name.toLowerCase().trim()}`] ||
                     familyTickets[member.name.toLowerCase().trim()]
                   : null));
            const isLiveTicket = memberTicket && ["waiting", "serving", "on_hold", "hold"].includes(String(memberTicket.status || "").toLowerCase());

          return (
            <div
              key={member.id}
              style={{
                background: isSelected ? "var(--patient-tag-bg, #F0F9FF)" : "var(--patient-card-bg, #FFFFFF)",
                borderRadius: "16px",
                border: isSelected ? "2px solid #0284C7" : "1px solid var(--patient-card-border, #E2E8F0)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "16px",
                boxShadow: isSelected ? "0 4px 14px rgba(2, 132, 199, 0.12)" : "0 1px 3px rgba(0,0,0,0.03)",
                transition: "all 0.2s ease",
              }}
            >
              <div>
                {/* Top Row: Icon + Name + Badge */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: isSelected ? "#0284C7" : "var(--patient-sub-card, #F1F5F9)",
                        color: isSelected ? "#FFFFFF" : "var(--patient-tag-color, #0369A1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                        fontWeight: 800,
                      }}
                    >
                      {isSelf ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      ) : member.relation === "child" ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M10 15c.5.5 1.2.8 2 .8s1.5-.3 2-.8"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/></svg>
                      ) : member.relation === "parent" ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M9 11h6"/></svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 2px 0", fontSize: "16px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>
                        {member.name}
                      </h4>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: isSelf ? "var(--patient-tag-bg, #E0F2FE)" : "var(--patient-sub-card, #F1F5F9)",
                          color: isSelf ? "var(--patient-tag-color, #0369A1)" : "#0284C7",
                          border: "1px solid var(--patient-tag-border, #BAE6FD)",
                        }}
                      >
                        {relationLabel}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: "#0284C7",
                        color: "#FFFFFF",
                        fontSize: "10.5px",
                        fontWeight: 800,
                        letterSpacing: "0.3px",
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Member Details */}
                <div style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #64748B)", display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
                  <div>
                    <strong>{language === "hi" ? "उम्र" : "Age"}:</strong> {member.age || "—"} {language === "hi" ? "वर्ष" : "yrs"}
                    {" • "}
                    <strong>{language === "hi" ? "लिंग" : "Gender"}:</strong> {member.gender ? member.gender.toUpperCase() : "—"}
                  </div>
                  {member.phone && (
                    <div>
                      <strong>{language === "hi" ? "फ़ोन" : "Phone"}:</strong> {member.phone}
                    </div>
                  )}
                  {isLiveTicket && (
                    <div style={{ marginTop: "6px", padding: "6px 10px", borderRadius: "8px", background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E", fontSize: "11.5px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/></svg>
                      <span>Active Token #{memberTicket.ticket_id} (Pos #{memberTicket.position})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Actions */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "12px", borderTop: "1px solid var(--patient-card-border, #E2E8F0)" }}>
                {!isSelected ? (
                  <button
                    type="button"
                    onClick={() => handleSelectMember(member)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--patient-tag-border, #BAE6FD)",
                      background: "var(--patient-tag-bg, #E0F2FE)",
                      color: "#0284C7",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {language === "hi" ? "प्रोफ़ाइल चुनें" : "Select Profile"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTabChange("walkin")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "none",
                      background: isLiveTicket ? "#059669" : "#0284C7",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isLiveTicket
                      ? (language === "hi" ? "सक्रिय टोकन देखें" : "View Active Token")
                      : (language === "hi" ? "टोकन लें" : "Get Token")}
                  </button>
                )}

                {!isSelf && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingMember(member)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--patient-card-border, #CBD5E1)",
                        background: "var(--patient-card-bg, #FFFFFF)",
                        color: "var(--patient-text-main, #475569)",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={language === "hi" ? "संपादित करें" : "Edit Profile"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (showConfirm) {
                          showConfirm({
                            title: language === "hi" ? "सदस्य प्रोफ़ाइल हटाएं" : "Remove Family Member",
                            message: language === "hi"
                              ? `क्या आप वाकई ${member.name} (${t(`relation_${member.relation}`, language) || member.relation}) की प्रोफ़ाइल हटाना चाहते हैं?`
                              : `Are you sure you want to remove ${member.name} (${t(`relation_${member.relation}`, language) || member.relation}) from your family profile?`,
                            confirmText: language === "hi" ? "हाँ, हटाएं" : "Yes, Remove",
                            cancelText: language === "hi" ? "रद्द करें" : "Cancel",
                            isDestructive: true,
                            onConfirm: () => handleDeleteMember(member.id),
                          });
                        } else {
                          handleDeleteMember(member.id);
                        }
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #FECACA",
                        background: "#FEF2F2",
                        color: "#DC2626",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={language === "hi" ? "हटाएं" : "Delete Profile"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        });
      })()}
      </div>
    </div>
  );
}
