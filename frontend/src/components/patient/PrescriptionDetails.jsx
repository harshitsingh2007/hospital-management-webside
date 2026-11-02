import React from "react";
import { t, formatCleanText, cleanAdviceText } from "../../utils/i18n";

/**
 * PrescriptionDetails
 * -------------------
 * Clean, calm presentation of prescription data without nested heavy boxes:
 * - Diagnosis (one concise line).
 * - Medicines compact list: "Name · dosage · frequency · duration" (one line per med).
 * - Tests & Advice (only when present).
 */
export default function PrescriptionDetails({ rx = null, language = "en" }) {
  if (!rx) return null;

  const cleanAdv = cleanAdviceText(rx.advice);
  const hasTests = rx.lab_tests && rx.lab_tests !== "no" && !String(rx.lab_tests).trim().startsWith("{");
  const hasMedicines = Array.isArray(rx.medicines) && rx.medicines.length > 0;
  const hasDiagnosis = Boolean(rx.diagnosis);

  if (!hasDiagnosis && !hasMedicines && !cleanAdv && !hasTests) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginTop: "8px",
        padding: "10px 12px",
        background: "var(--patient-sub-card, #F8FAFC)",
        borderRadius: "8px",
        border: "1px solid var(--patient-card-border, #E2E8F0)",
      }}
    >
      {/* Diagnosis Line */}
      {hasDiagnosis && (
        <div style={{ fontSize: "12.5px", color: "var(--patient-text-main, #0F172A)" }}>
          <strong style={{ color: "var(--patient-text-sub, #475569)", fontWeight: 600 }}>
            {t("diagnosisLabel", language)}:
          </strong>{" "}
          <span style={{ fontWeight: 700, color: "#0284C7" }}>
            {formatCleanText(rx.diagnosis, language)}
          </span>
        </div>
      )}

      {/* Medicines Compact List */}
      {hasMedicines && (
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--patient-text-sub, #64748B)",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              display: "block",
              marginBottom: "4px",
            }}
          >
            {t("medicinesLabel", language)}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {rx.medicines.map((m, idx) => {
              const parts = [
                formatCleanText(m.name, language),
                m.dosage ? formatCleanText(m.dosage, language) : null,
                m.frequency ? formatCleanText(m.frequency, language) : null,
                m.duration ? formatCleanText(m.duration, language) : null,
              ].filter(Boolean);

              const lineText = parts.join(" · ");
              const instructions = m.instructions ? formatCleanText(m.instructions, language) : null;

              return (
                <div
                  key={idx}
                  style={{
                    fontSize: "12px",
                    color: "var(--patient-text-main, #334155)",
                    display: "flex",
                    alignItems: "baseline",
                    gap: "6px",
                  }}
                >
                  <span style={{ color: "#0284C7", fontSize: "11px" }}>•</span>
                  <span>
                    <strong>{parts[0]}</strong>
                    {parts.length > 1 && ` · ${parts.slice(1).join(" · ")}`}
                    {instructions && (
                      <span style={{ color: "var(--patient-text-sub, #64748B)", fontStyle: "italic", marginLeft: "4px" }}>
                        ({instructions})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Advice Section */}
      {cleanAdv && (
        <div style={{ fontSize: "12px", color: "var(--patient-text-sub, #475569)" }}>
          <strong style={{ fontWeight: 600 }}>{t("adviceLabel", language)}:</strong>{" "}
          <span style={{ fontStyle: "italic" }}>"{cleanAdv}"</span>
        </div>
      )}

      {/* Tests Section */}
      {hasTests && (
        <div style={{ fontSize: "12px", color: "var(--patient-text-sub, #475569)" }}>
          <strong style={{ fontWeight: 600 }}>{t("testsLabel", language)}:</strong>{" "}
          <span>{formatCleanText(rx.lab_tests, language)}</span>
        </div>
      )}
    </div>
  );
}

