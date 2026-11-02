import React from "react";
import { t } from "../../utils/i18n";

/**
 * VisitHistoryHeader
 * ------------------
 * Calm, professional page header:
 * - Title "Medical & Visit History" with small muted total count ("12 records").
 * - Compact family member switcher shown only when account has > 1 member.
 * - Completely hides family switcher when only "Self" is registered.
 */
export default function VisitHistoryHeader({
  language = "en",
  totalRecords = 0,
  familyMembers = [],
  selectedMemberId = "self",
  onSelectMember,
}) {
  const hasMultipleMembers = Array.isArray(familyMembers) && familyMembers.length > 1;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      {/* Title & Count */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "19px",
            color: "var(--patient-text-main, #0F172A)",
            fontWeight: 800,
            letterSpacing: "-0.3px",
          }}
        >
          {t("medicalVisitHistory", language)}
        </h2>
        <span
          style={{
            fontSize: "12.5px",
            color: "var(--patient-text-sub, #64748B)",
            fontWeight: 500,
          }}
        >
          {totalRecords} {t("recordsCount", language)}
        </span>
      </div>

      {/* Compact Family Switcher (Shown ONLY when >1 member exists) */}
      {hasMultipleMembers && (
        <div
          role="group"
          aria-label={language === "hi" ? "पारिवारिक सदस्य चुनें" : "Select patient profile"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "var(--patient-sub-card, #F1F5F9)",
            padding: "3px 4px",
            borderRadius: "10px",
            border: "1px solid var(--patient-card-border, #E2E8F0)",
            maxWidth: "100%",
            overflowX: "auto",
          }}
        >
          {familyMembers.map((member) => {
            const isSelected = String(member.id) === String(selectedMemberId);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectMember && onSelectMember(member)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "7px",
                  border: isSelected ? "1px solid #0284C7" : "1px solid transparent",
                  background: isSelected ? "#0284C7" : "transparent",
                  color: isSelected ? "#FFFFFF" : "var(--patient-text-sub, #475569)",
                  fontSize: "12px",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
                aria-pressed={isSelected}
              >
                {member.name || (language === "hi" ? "स्वयं" : "Self")}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

