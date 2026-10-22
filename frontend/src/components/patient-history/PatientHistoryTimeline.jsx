/**
 * PatientHistoryTimeline.jsx
 * --------------------------
 * Master Patient Medical History & Follow-Up Timeline Component.
 * Integrates Summary Badge, Chronological Visits, Prescriptions, and Medical Reports
 * with interactive tabs and search filters.
 */

import React, { useState, useMemo } from "react";
import HistorySummary from "./HistorySummary";
import PatientHistoryCard from "./PatientHistoryCard";
import PrescriptionHistory from "./PrescriptionHistory";
import MedicalReports from "./MedicalReports";

export default function PatientHistoryTimeline({
  patient,
  summary,
  visits = [],
  prescriptions = [],
  reports = [],
  isReturningPatient = false,
  totalVisits = 0,
  loading = false,
  language = "en",
  onUsePreviousPrescription = null,
  collapsible = true,
  defaultExpanded = true,
}) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState("visits"); // visits, prescriptions, reports
  const [searchQuery, setSearchQuery] = useState("");
  const isHi = language === "hi";

  // Filter out any cancelled, no-show, or expired visits (e.g. cancelled tickets)
  const validVisits = useMemo(() => {
    return (visits || []).filter((v) => {
      const st = (v.status || "").toLowerCase();
      return !["cancelled", "no_show", "expired"].includes(st);
    });
  }, [visits]);

  // Filtered visits
  const filteredVisits = useMemo(() => {
    if (!searchQuery.trim()) return validVisits;
    const q = searchQuery.toLowerCase();
    return validVisits.filter((v) => {
      const matchDiag = v.diagnosis && v.diagnosis.toLowerCase().includes(q);
      const matchDoc = v.doctor_name && v.doctor_name.toLowerCase().includes(q);
      const matchDept = v.department && v.department.toLowerCase().includes(q);
      const matchMeds = v.prescription?.medicines?.some((m) => m.name && m.name.toLowerCase().includes(q));
      return matchDiag || matchDoc || matchDept || matchMeds;
    });
  }, [validVisits, searchQuery]);

  // Filtered prescriptions
  const filteredPrescriptions = useMemo(() => {
    if (!searchQuery.trim()) return prescriptions;
    const q = searchQuery.toLowerCase();
    return prescriptions.filter((rx) => {
      const matchDiag = rx.diagnosis && rx.diagnosis.toLowerCase().includes(q);
      const matchDoc = rx.doctor_name && rx.doctor_name.toLowerCase().includes(q);
      const matchMeds = rx.medicines?.some((m) => m.name && m.name.toLowerCase().includes(q));
      return matchDiag || matchDoc || matchMeds;
    });
  }, [prescriptions, searchQuery]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter((r) => r.report_name && r.report_name.toLowerCase().includes(q));
  }, [reports, searchQuery]);

  return (
    <div style={{
      background: "var(--patient-card-bg, #FFFFFF)",
      border: "1px solid var(--patient-card-border, #E2E8F0)",
      borderRadius: "16px",
      boxShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.06)",
      overflow: "hidden",
      marginBottom: "16px",
    }}>
      {/* Top Accordion / Header Bar */}
      <div
        onClick={() => collapsible && setIsOpen(!isOpen)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: collapsible ? "pointer" : "default",
          padding: "12px 16px",
          background: "var(--patient-sub-card, #F8FAFC)",
          borderBottom: isOpen ? "1px solid var(--patient-card-border, #E2E8F0)" : "none",
          borderRadius: isOpen ? "14px 14px 0 0" : "14px",
          userSelect: "none",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(2, 132, 199, 0.22) 100%)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--patient-text-main, #0F172A)", letterSpacing: "-0.2px" }}>
                {isHi ? "मरीज़ मेडिकल इतिहास एवं पूर्व रिकॉर्ड" : "Patient Medical History & Records"}
              </span>
              {totalVisits > 1 && (
                <span style={{
                  background: "rgba(2, 132, 199, 0.12)",
                  color: "#0284C7",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "2px 9px",
                  borderRadius: "9999px",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: "11px" }}>🔄</span>
                  <span>{isHi ? `${totalVisits} विज़िट्स` : `${totalVisits} Past Visits`}</span>
                </span>
              )}
            </div>
            <div style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", marginTop: "2px", lineHeight: 1.3 }}>
              {isHi
                ? "पूर्व परामर्श, प्रिस्क्रिप्शन एवं नैदानिक रिपोर्ट"
                : "Past clinical visits, e-prescriptions & diagnostic reports"}
            </div>
          </div>
        </div>

        {collapsible && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            borderRadius: "8px",
            background: isOpen ? "rgba(2, 132, 199, 0.1)" : "transparent",
            border: isOpen ? "1px solid rgba(2, 132, 199, 0.2)" : "1px solid transparent",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}>
            <span style={{ fontSize: "12px", color: "#0284C7", fontWeight: 700 }}>
              {isOpen ? (isHi ? "छिपाएं" : "Collapse") : (isHi ? "देखें" : "Expand")}
            </span>
            <span style={{ fontSize: "10px", color: "#0284C7" }}>{isOpen ? "▲" : "▼"}</span>
          </div>
        )}
      </div>

      {isOpen && (
        <div style={{ padding: "16px" }}>
          {/* 1. Summary Card */}
          <div style={{ marginBottom: "14px" }}>
            <HistorySummary
              patient={patient}
              summary={summary}
              isReturningPatient={isReturningPatient}
              totalVisits={totalVisits}
              language={language}
            />
          </div>

          {/* 2. Sub-Tabs & Search Controls (Only if returning patient or records exist) */}
          {(validVisits.length > 0 || prescriptions.length > 0 || reports.length > 0) && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                {/* Tabs */}
                <div style={{
                  display: "inline-flex",
                  background: "var(--patient-sub-card, #F1F5F9)",
                  padding: "3px",
                  borderRadius: "10px",
                  gap: "3px",
                }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("visits")}
                    style={{
                      background: activeTab === "visits" ? "var(--patient-card-bg, #FFFFFF)" : "transparent",
                      border: "none",
                      color: activeTab === "visits" ? "var(--patient-text-main, #0F172A)" : "var(--patient-text-sub, #64748B)",
                      fontSize: "12px",
                      fontWeight: activeTab === "visits" ? 800 : 600,
                      padding: "5px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      boxShadow: activeTab === "visits" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    📅 {isHi ? "विज़िट इतिहास" : "Visits"} ({validVisits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("prescriptions")}
                    style={{
                      background: activeTab === "prescriptions" ? "var(--patient-card-bg, #FFFFFF)" : "transparent",
                      border: "none",
                      color: activeTab === "prescriptions" ? "var(--patient-text-main, #0F172A)" : "var(--patient-text-sub, #64748B)",
                      fontSize: "12px",
                      fontWeight: activeTab === "prescriptions" ? 800 : 600,
                      padding: "5px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      boxShadow: activeTab === "prescriptions" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    💊 {isHi ? "प्रिस्क्रिप्शन" : "Prescriptions"} ({prescriptions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("reports")}
                    style={{
                      background: activeTab === "reports" ? "var(--patient-card-bg, #FFFFFF)" : "transparent",
                      border: "none",
                      color: activeTab === "reports" ? "var(--patient-text-main, #0F172A)" : "var(--patient-text-sub, #64748B)",
                      fontSize: "12px",
                      fontWeight: activeTab === "reports" ? 800 : 600,
                      padding: "5px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      boxShadow: activeTab === "reports" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    🧪 {isHi ? "जांच रिपोर्ट" : "Reports"} ({reports.length})
                  </button>
                </div>

                {/* Search */}
                <div style={{ position: "relative", minWidth: "200px" }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isHi ? "निदान, दवा, डॉक्टर खोजें..." : "Filter diagnosis, meds, doc..."}
                    style={{
                      width: "100%",
                      padding: "6px 28px 6px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--patient-card-border, #CBD5E1)",
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                      background: "var(--patient-card-bg, #FFFFFF)",
                      color: "var(--patient-text-main, #0F172A)",
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--patient-text-sub, #94A3B8)" }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              {loading ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--patient-text-sub, #64748B)", fontSize: "13px" }}>
                  ⏳ {isHi ? "मेडिकल इतिहास लोड हो रहा है..." : "Loading patient medical history..."}
                </div>
              ) : (
                <div>
                  {activeTab === "visits" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {filteredVisits.length > 0 ? (
                        filteredVisits.map((v, i) => (
                          <PatientHistoryCard
                            key={v.visit_id || v.ticket_id || i}
                            visit={v}
                            language={language}
                            onUsePreviousPrescription={onUsePreviousPrescription}
                          />
                        ))
                      ) : (
                        <div style={{
                          background: "var(--patient-sub-card, #F8FAFC)",
                          borderRadius: "10px",
                          padding: "16px",
                          textAlign: "center",
                          color: "var(--patient-text-sub, #64748B)",
                          fontSize: "12px",
                          border: "1px dashed var(--patient-card-border, #CBD5E1)",
                        }}>
                          {isHi ? "कोई मेल खाने वाली विज़िट नहीं मिली।" : "No matching visits found."}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "prescriptions" && (
                    <PrescriptionHistory
                      prescriptions={filteredPrescriptions}
                      language={language}
                      onUsePreviousPrescription={onUsePreviousPrescription}
                    />
                  )}

                  {activeTab === "reports" && (
                    <MedicalReports
                      reports={filteredReports}
                      language={language}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
