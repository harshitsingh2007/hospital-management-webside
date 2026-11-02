/**
 * HistorySummary.jsx
 * ------------------
 * Compact 3-stat summary row for patient history:
 * Total visits | Last visit (date + doctor) | Last diagnosis
 * With collapsible past diagnoses link.
 */

import React, { useState } from "react";
import { t, formatCleanText } from "../../utils/i18n";

export default function HistorySummary({
  patient,
  summary,
  totalVisits = 0,
  language = "en",
}) {
  const [showPastDiagnoses, setShowPastDiagnoses] = useState(false);

  const displayTotal = totalVisits || summary?.total_visits || 0;
  const lastDate = summary?.last_visit || "—";
  const lastDoctor = summary?.last_doctor || "";

  const rawDiag =
    (summary?.past_diagnoses && summary.past_diagnoses.length > 0
      ? summary.past_diagnoses[0]
      : summary?.last_diagnosis) || "—";
  const cleanedDiag = rawDiag !== "—" ? formatCleanText(String(rawDiag).slice(0, 45), language) : "—";

  const pastDiagnosesList = Array.isArray(summary?.past_diagnoses)
    ? summary.past_diagnoses.filter(Boolean)
    : [];

  return (
    <div
      style={{
        background: "var(--patient-sub-card, #F8FAFC)",
        border: "1px solid var(--patient-card-border, #E2E8F0)",
        borderRadius: "14px",
        padding: "12px 16px",
      }}
    >
      {/* 3 Compact Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "12px",
          alignItems: "center",
        }}
      >
        {/* Stat 1: Total Visits */}
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--patient-text-sub, #64748B)",
              display: "block",
              marginBottom: "2px",
            }}
          >
            {t("totalVisitsStat", language)}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "17px",
                fontWeight: 800,
                color: "var(--patient-text-main, #0F172A)",
              }}
            >
              {displayTotal}
            </span>
            {displayTotal === 1 && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#0369A1",
                  background: "var(--patient-tag-bg, #E0F2FE)",
                  border: "1px solid var(--patient-tag-border, #BAE6FD)",
                  padding: "1px 6px",
                  borderRadius: "9999px",
                }}
              >
                {t("firstVisitBadge", language)}
              </span>
            )}
          </div>
        </div>

        {/* Stat 2: Last Visit */}
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--patient-text-sub, #64748B)",
              display: "block",
              marginBottom: "2px",
            }}
          >
            {t("lastVisitStat", language)}
          </span>
          <div
            style={{
              fontSize: "13.5px",
              fontWeight: 700,
              color: "var(--patient-text-main, #0F172A)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {lastDate}
          </div>
          {lastDoctor && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--patient-text-sub, #64748B)",
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {lastDoctor}
            </div>
          )}
        </div>

        {/* Stat 3: Last Diagnosis */}
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--patient-text-sub, #64748B)",
              display: "block",
              marginBottom: "2px",
            }}
          >
            {t("lastDiagnosisStat", language)}
          </span>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: cleanedDiag !== "—" ? "#0284C7" : "var(--patient-text-sub, #64748B)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={rawDiag !== "—" ? rawDiag : ""}
          >
            {cleanedDiag}
          </div>
        </div>
      </div>

      {/* Collapsible Past Diagnoses Link */}
      {pastDiagnosesList.length > 0 && (
        <div
          style={{
            marginTop: "10px",
            paddingTop: "8px",
            borderTop: "1px solid var(--patient-card-border, #E2E8F0)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <button
            type="button"
            onClick={() => setShowPastDiagnoses((prev) => !prev)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "#0284C7",
              fontSize: "11.5px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              alignSelf: "flex-start",
            }}
            aria-expanded={showPastDiagnoses}
          >
            <span>{showPastDiagnoses ? t("hidePastDiagnoses", language) : t("showPastDiagnoses", language)}</span>
            <span style={{ fontSize: "10px" }}>{showPastDiagnoses ? "▲" : "▼"}</span>
          </button>

          {showPastDiagnoses && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginTop: "4px",
              }}
            >
              {pastDiagnosesList.map((diag, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    color: "var(--patient-text-main, #334155)",
                    background: "var(--patient-card-bg, #FFFFFF)",
                    border: "1px solid var(--patient-card-border, #E2E8F0)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {formatCleanText(diag, language)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
