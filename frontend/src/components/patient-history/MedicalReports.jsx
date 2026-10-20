/**
 * MedicalReports.jsx
 * ------------------
 * Displays diagnostic lab tests, pathology reports, and radiology imaging records.
 */

import React, { useState } from "react";
import { ClinicalReportDetailModal } from "../common/InAppNotification";

export default function MedicalReports({ reports = [], language = "en", isDark = false }) {
  const isHi = language === "hi";
  const [selectedReport, setSelectedReport] = useState(null);

  if (!reports || reports.length === 0) {
    return (
      <div style={{
        background: "var(--patient-sub-card, #F8FAFC)",
        borderRadius: "12px",
        border: "1px dashed var(--patient-card-border, #CBD5E1)",
        padding: "20px",
        textAlign: "center",
      }}>
        <span style={{ fontSize: "24px" }}>🧪</span>
        <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--patient-text-sub, #64748B)", marginTop: "6px" }}>
          {isHi ? "कोई पैथोलॉजी या रेडियोलॉजी रिपोर्ट उपलब्ध नहीं है।" : "No diagnostic or laboratory reports found on file."}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {reports.map((rep, idx) => (
          <div key={rep.id || idx} style={{
            background: "var(--patient-card-bg, #FFFFFF)",
            border: "1px solid var(--patient-card-border, #E2E8F0)",
            borderRadius: "12px",
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: rep.report_type?.includes("Radiology") ? "var(--patient-tag-bg, #EFF6FF)" : "#F0FDF4",
                color: rep.report_type?.includes("Radiology") ? "#0284C7" : "#16A34A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                flexShrink: 0,
              }}>
                {rep.report_type?.includes("Radiology") ? "🩻" : "🧪"}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--patient-text-main, #0F172A)" }}>
                  {rep.report_name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", marginTop: "2px" }}>
                  <span>📅 {rep.report_date}</span>
                  <span style={{ marginLeft: "8px" }}>• {rep.report_type}</span>
                  {rep.doctor_name && <span style={{ marginLeft: "8px" }}>• {rep.doctor_name}</span>}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                background: "#F0FDF4",
                color: "#16A34A",
                fontSize: "10.5px",
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: "5px",
                border: "1px solid #BBF7D0",
              }}>
                ✓ {rep.status || "Verified"}
              </span>
              <button
                type="button"
                onClick={() => setSelectedReport(rep)}
                style={{
                  background: "var(--patient-sub-card, #F8FAFC)",
                  border: "1px solid var(--patient-card-border, #CBD5E1)",
                  color: "var(--patient-text-main, #334155)",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 9px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {isHi ? "रिपोर्ट देखें" : "View Report"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedReport && (
        <ClinicalReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          language={language}
          isDark={isDark}
        />
      )}
    </>
  );
}

