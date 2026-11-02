import React from "react";
import { t } from "../../utils/i18n";
import PrescriptionDetails from "./PrescriptionDetails";

/**
 * VisitRecordDetails
 * ------------------
 * Accordion content rendered when a visit record is expanded:
 * - Care journey trail (multi-stage transfers).
 * - Cancellation reason (cancelled visits).
 * - Prescription details (diagnosis, compact medicines, tests, advice).
 * - Actions row: Secondary 'View Rx Slip' & 'Download PDF', plus primary gradient 'Book Follow-Up' (completed only).
 */
export default function VisitRecordDetails({
  record = {},
  recordType = "walkin",
  rx = null,
  effectiveRxNotes = "",
  hospitalBranding = null,
  language = "en",
  handleBookFollowUp,
  handleOpenPrescriptionSlip,
  downloadPrescriptionPDF,
  setStatusMsg,
  showToast,
}) {
  const isCancelled = (record.status || "").toLowerCase() === "cancelled";
  const isCompleted = (record.status || "").toLowerCase() === "completed";
  const cancelReason = record.cancellation_reason || record.cancel_reason;

  return (
    <div
      style={{
        padding: "12px 16px 14px 16px",
        borderTop: "1px solid var(--patient-card-border, #E2E8F0)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Cancellation Reason if cancelled */}
      {isCancelled && cancelReason && (
        <div
          style={{
            fontSize: "12px",
            color: "#DC2626",
            background: "var(--emergency-card-bg, #FEF2F2)",
            border: "1px solid var(--emergency-card-border, #FECACA)",
            padding: "6px 10px",
            borderRadius: "6px",
          }}
        >
          <strong>{t("cancellationReasonLabel", language)}:</strong> {cancelReason}
        </div>
      )}

      {/* Multi-Stage Care Journey (Only when present) */}
      {record.transfer_trail && (
        <div
          style={{
            fontSize: "12px",
            color: "#0369A1",
            background: "var(--patient-tag-bg, #F0F9FF)",
            border: "1px solid var(--patient-tag-border, #BAE6FD)",
            padding: "6px 10px",
            borderRadius: "6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 700 }}>🧭 {t("careJourneyLabel", language)}:</span>
          <span>{record.transfer_trail}</span>
        </div>
      )}

      {/* Prescription Details (compact diagnosis & medicines) */}
      {rx && <PrescriptionDetails rx={rx} language={language} />}

      {/* Bottom Actions Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "4px",
          flexWrap: "wrap",
        }}
      >
        {/* View Prescription Slip (Secondary Outline) */}
        {rx && handleOpenPrescriptionSlip && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenPrescriptionSlip(effectiveRxNotes, record);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--patient-card-border, #CBD5E1)",
              background: "var(--patient-card-bg, #FFFFFF)",
              color: "#0284C7",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>{t("viewRxSlipBtn", language)}</span>
          </button>
        )}

        {/* Download PDF (Secondary Outline) */}
        {rx && downloadPrescriptionPDF && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadPrescriptionPDF(rx, language, hospitalBranding);
              if (setStatusMsg) setStatusMsg(t("downloadRxPdfSuccess", language));
              if (showToast) showToast(t("downloadRxPdfSuccess", language), "success");
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--patient-card-border, #CBD5E1)",
              background: "var(--patient-card-bg, #FFFFFF)",
              color: "var(--patient-text-main, #334155)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease",
            }}
            title={t("downloadClinicalRxPdf", language)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{t("downloadPdfShort", language)}</span>
          </button>
        )}

        {/* Book Follow-Up (The ONLY Primary Gradient Button, Completed visits only) */}
        {isCompleted && handleBookFollowUp && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBookFollowUp(record);
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.2)",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{t("bookFollowUpBtn", language)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

