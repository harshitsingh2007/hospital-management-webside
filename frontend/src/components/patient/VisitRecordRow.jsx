import React from "react";
import { t, getStatusLabel } from "../../utils/i18n";

/**
 * VisitRecordRow
 * --------------
 * One card per visit record (~72px collapsed height):
 * - Line 1: Date (bold) · Type label (Walk-in / Appointment) · Muted ID · Emergency chip (if priority === 1) | Single Status chip + Chevron.
 * - Line 2: Department · Doctor (· Hospital if patient visited multiple hospitals).
 * Keyboard accessible (Enter/Space), aria-expanded, with visible focus ring.
 */
export default function VisitRecordRow({
  record = {},
  recordType = "walkin",
  formattedDate = "",
  deptName = "",
  docName = "",
  hasMultipleHospitals = false,
  hospitalName = "",
  isExpanded = false,
  onToggle,
  language = "en",
  children,
}) {
  const isCancelled = (record.status || "").toLowerCase() === "cancelled";
  const isCompleted = (record.status || "").toLowerCase() === "completed";
  const isEmergency = Number(record.priority) === 1 || (record.priority || "").toLowerCase() === "emergency";

  const identifier = recordType === "walkin"
    ? `#${record.ticket_id}`
    : (record.appointment_id || `#${record.ticket_id || ""}`);

  const typeLabel = recordType === "walkin" ? t("walkinLabel", language) : t("appointmentLabel", language);

  // Status Chip Style
  const statusBg = isCancelled ? "#FEE2E2" : (isCompleted ? "#E0F2FE" : "#FEF3C7");
  const statusColor = isCancelled ? "#DC2626" : (isCompleted ? "#0284C7" : "#92400E");

  // Line 2 parts: Dept · Doctor (· Hospital if multi-hospital)
  const line2Parts = [
    deptName,
    docName,
    record.time_slot ? record.time_slot : null,
    hasMultipleHospitals && hospitalName ? hospitalName : null,
  ].filter(Boolean);

  return (
    <div
      style={{
        background: isCancelled ? "var(--emergency-card-bg, #FEF2F2)" : "var(--patient-card-bg, #FFFFFF)",
        border: isCancelled ? "1px solid var(--emergency-card-border, #FECACA)" : "1px solid var(--patient-card-border, #E2E8F0)",
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
        transition: "all 0.15s ease",
        overflow: "hidden",
      }}
    >
      {/* Clickable Header Row (~72px high) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          minHeight: "70px",
          cursor: "pointer",
          userSelect: "none",
          gap: "12px",
          boxSizing: "border-box",
          outline: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = "inset 0 0 0 2px #0284C7";
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Left Column (Line 1 + Line 2) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Line 1: Date · Type · Muted ID · Emergency */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
            <span
              style={{
                fontSize: "13.5px",
                fontWeight: 800,
                color: "var(--patient-text-main, #0F172A)",
                letterSpacing: "-0.2px",
              }}
            >
              {formattedDate}
            </span>

            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--patient-text-sub, #64748B)",
              }}
            >
              {typeLabel}
            </span>

            {identifier && (
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 500,
                  color: "var(--patient-text-sub, #94A3B8)",
                }}
              >
                {identifier}
              </span>
            )}

            {isEmergency && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: "4px",
                  background: "var(--emergency-card-bg, #FEF2F2)",
                  color: "var(--emergency-card-text, #DC2626)",
                  border: "1px solid var(--emergency-card-border, #FECACA)",
                  textTransform: "uppercase",
                }}
              >
                {t("emergency", language)}
              </span>
            )}
          </div>

          {/* Line 2: Department · Doctor (· Hospital if multi-hospital) */}
          <div
            style={{
              fontSize: "12px",
              color: "var(--patient-text-sub, #64748B)",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {line2Parts.join(" · ")}
          </div>
        </div>

        {/* Right Column: Status Chip + Chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span
            style={{
              padding: "3px 9px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 800,
              background: statusBg,
              color: statusColor,
              whiteSpace: "nowrap",
            }}
          >
            {getStatusLabel(record.status || "completed", language)}
          </span>

          {/* Expand/Collapse Chevron */}
          <div
            style={{
              color: "var(--patient-text-sub, #94A3B8)",
              display: "flex",
              alignItems: "center",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
            aria-hidden="true"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Accordion Content */}
      {isExpanded && children}
    </div>
  );
}

