import React, { useState } from "react";
import { t, formatCleanText } from "../../utils/i18n";

/**
 * VisitSummaryStats
 * -----------------
 * Compact 3-stat overview row:
 * 1. Total Visits (with small 'First visit' badge if count === 1)
 * 2. Last Visit (Date + doctor name in small muted text)
 * 3. Last Diagnosis (shortened single item)
 * Includes a collapsible 'Show past diagnoses' link, closed by default.
 */
export default function VisitSummaryStats({
  summary = null,
  totalVisits = 0,
  fallbackLastVisitDate = null,
  fallbackLastDoctor = null,
  fallbackLastDiagnosis = null,
  language = "en",
}) {
  const [showPastDiagnoses, setShowPastDiagnoses] = useState(false);

  const displayTotal = totalVisits || summary?.total_visits || 0;
  const lastDate = summary?.last_visit || fallbackLastVisitDate || "—";
  const lastDoctor = summary?.last_doctor || fallbackLastDoctor || "";

  // Resolve and clean last diagnosis
  const rawDiag =
    (summary?.past_diagnoses && summary.past_diagnoses.length > 0
      ? summary.past_diagnoses[0]
      : summary?.last_diagnosis || fallbackLastDiagnosis) || "—";
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
        marginBottom: "16px",
      }}
    >
      {/* 3 Compact Stats Row */}
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
                letterSpacing: "-0.3px",
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

      {/* Collapsible Past Diagnoses Link (only if past diagnoses exist) */}
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

