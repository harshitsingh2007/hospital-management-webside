/**
 * ClinicalPrescriptionWorkstation.jsx
 * -----------------------------------
 * Dedicated Full-Page Clinical Consultation & E-Prescription Workstation.
 * Replaces narrow popup dialogs with an expansive 2-column EHR layout:
 * - Left Column: Patient Profile, Medical History Timeline, Clinical Findings & 1-Tap Lab Orders.
 * - Right Column: Generous Medication Grid (Full width), Doctor Advice, Follow-Up, and Care Routing.
 * - Sticky Top Bar: Patient token, Name, Age/Gender, "IN CONSULTATION" live pulse, Auto-save draft status,
 *   [🗗 Popup Mode] toggle, [🖨️ Print Rx], [📥 PDF], and [← Back to Queue].
 * - Supports seamless switching between Full-Page mode and Floating Window (Modal) mode.
 */

import React, { useState } from "react";
import { t, getCategoryLabel, formatSymptomLabel } from "../../utils/i18n";
import PatientHistoryTimeline from "../patient-history/PatientHistoryTimeline";
import {
  IconStethoscope,
  IconPill,
  IconClipboard,
  IconCalendar,
  IconHospital,
  IconDoctor,
  IconAlertTriangle,
  IconSave,
  IconClock,
  IconRepeat,
  IconHeartPulse,
  IconActivity,
} from "../common/MedicalIcons";

export default function ClinicalPrescriptionWorkstation({
  ticket,
  currentUser,
  language = "en",
  isDark = false,
  localBranding,
  hospitalDepartments = [],
  rxViewMode = "page", // "page" | "modal"
  onToggleViewMode,
  onClose,
  onSave,
  onPrint,
  // Form State & Setters
  rxDiagnosis,
  setRxDiagnosis,
  rxCustomFinding,
  setRxCustomFinding,
  rxMedicines = [],
  setRxMedicines,
  handleAddMedicineRow,
  handleRemoveMedicineRow,
  handleMedicineChange,
  rxLabTests,
  setRxLabTests,
  rxCustomLabTest,
  setRxCustomLabTest,
  rxAdvice,
  setRxAdvice,
  rxFollowUp,
  setRxFollowUp,
  rxRoutingDept,
  setRxRoutingDept,
  rxTransferNotes,
  setRxTransferNotes,
  rxSaving = false,
  rxStatusMsg = "",
  rxAutoSaveStatus = "idle",
  rxLastSavedAt = null,
  rxPreFillWarning = "",
  // Patient History Props
  patient,
  summary,
  visits = [],
  prescriptions = [],
  reports = [],
  isReturningPatient = false,
  totalVisits = 0,
  historyLoading = false,
  onUsePreviousPrescription,
}) {
  const [historyOpen, setHistoryOpen] = useState(false);

  if (!ticket) return null;

  // Findings computation
  const currentFindings = rxDiagnosis
    ? rxDiagnosis
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const handleToggleFinding = (item) => {
    const exists = currentFindings.some((f) => f.toLowerCase() === item.toLowerCase());
    let next;
    if (exists) {
      next = currentFindings.filter((f) => f.toLowerCase() !== item.toLowerCase());
    } else {
      next = [...currentFindings, item];
    }
    setRxDiagnosis(next.join(", "));
  };

  const handleRemoveFinding = (item) => {
    const next = currentFindings.filter((f) => f.toLowerCase() !== item.toLowerCase());
    setRxDiagnosis(next.join(", "));
  };

  const handleAddCustomFinding = () => {
    const raw = (rxCustomFinding || "").trim();
    if (!raw) return;
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const merged = [...currentFindings];
    parts.forEach((p) => {
      if (!merged.some((m) => m.toLowerCase() === p.toLowerCase())) {
        merged.push(p);
      }
    });
    setRxDiagnosis(merged.join(", "));
    setRxCustomFinding("");
  };

  // Lab Tests computation
  const currentTests = rxLabTests
    ? rxLabTests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const quickLabOptions = [
    { id: "CBC", label: "CBC", desc: "Complete Blood Count", icon: "🩸" },
    { id: "LFT", label: "LFT", desc: "Liver Function Test", icon: "🧪" },
    { id: "KFT", label: "KFT", desc: "Kidney Function Test", icon: "🧪" },
    { id: "Chest X-Ray", label: "Chest X-Ray", desc: "Chest X-Ray PA View", icon: "🩻" },
    { id: "ECG", label: "ECG", desc: "12-Lead Electrocardiogram", icon: "💓" },
    { id: "Urine R/M", label: "Urine R/M", desc: "Urine Routine & Microscopy", icon: "🔬" },
    { id: "Blood Sugar (FBS/PP)", label: "Blood Sugar", desc: "Fasting & Post-Prandial Blood Sugar", icon: "🩸" },
    { id: "Lipid Profile", label: "Lipid Profile", desc: "Cholesterol & Triglycerides", icon: "🧪" },
    { id: "HbA1c", label: "HbA1c", desc: "Glycated Hemoglobin", icon: "🩸" },
    { id: "Serum Electrolytes", label: "Electrolytes", desc: "Serum Electrolytes (Na+, K+, Cl-)", icon: "⚡" },
    { id: "USG Abdomen", label: "USG Abdomen", desc: "Ultrasound Abdomen & Pelvis", icon: "🩻" },
    { id: "Thyroid (TSH)", label: "Thyroid (TSH)", desc: "Thyroid Stimulating Hormone", icon: "🔬" },
  ];

  const isTestSelected = (testItem) => {
    return currentTests.some(
      (t) =>
        t.toLowerCase() === testItem.id.toLowerCase() ||
        t.toLowerCase() === testItem.label.toLowerCase() ||
        t.toLowerCase().startsWith(testItem.id.toLowerCase() + " ") ||
        t.toLowerCase().startsWith(testItem.label.toLowerCase() + " ")
    );
  };

  const handleToggleTest = (testItem) => {
    const selected = isTestSelected(testItem);
    let next;
    if (selected) {
      next = currentTests.filter(
        (t) =>
          t.toLowerCase() !== testItem.id.toLowerCase() &&
          t.toLowerCase() !== testItem.label.toLowerCase() &&
          !t.toLowerCase().startsWith(testItem.id.toLowerCase() + " ") &&
          !t.toLowerCase().startsWith(testItem.label.toLowerCase() + " ")
      );
    } else {
      next = [...currentTests, testItem.label];
    }
    setRxLabTests(next.join(", "));
  };

  const handleRemoveTest = (item) => {
    const next = currentTests.filter((t) => t.toLowerCase() !== item.toLowerCase());
    setRxLabTests(next.join(", "));
  };

  const handleAddCustomLabTest = () => {
    const raw = (rxCustomLabTest || "").trim();
    if (!raw) return;
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const merged = [...currentTests];
    parts.forEach((p) => {
      if (!merged.some((m) => m.toLowerCase() === p.toLowerCase())) {
        merged.push(p);
      }
    });
    setRxLabTests(merged.join(", "));
    setRxCustomLabTest("");
  };

  // Quick Prescription Bundles for doctors
  const applyMedicinePreset = (presetName) => {
    let bundle = [];
    if (presetName === "fever") {
      bundle = [
        { name: "Tab. Paracetamol", dosage: "650mg", frequency: "1-0-1", duration: "3 days", instructions: "After food" },
        { name: "Tab. Pantoprazole", dosage: "40mg", frequency: "1-0-0", duration: "3 days", instructions: "Empty stomach" },
      ];
    } else if (presetName === "cold") {
      bundle = [
        { name: "Tab. Cetirizine", dosage: "10mg", frequency: "0-0-1", duration: "5 days", instructions: "Bedtime" },
        { name: "Syp. Ambroxol + Guaifenesin", dosage: "10ml", frequency: "1-1-1", duration: "5 days", instructions: "After food" },
        { name: "Tab. Vitamin C", dosage: "500mg", frequency: "1-0-0", duration: "7 days", instructions: "After food" },
      ];
    } else if (presetName === "gastritis") {
      bundle = [
        { name: "Cap. Pantoprazole + Domperidone", dosage: "40mg/30mg", frequency: "1-0-0", duration: "5 days", instructions: "Empty stomach" },
        { name: "Syp. Antacid Gel", dosage: "10ml", frequency: "1-1-1", duration: "5 days", instructions: "After food" },
      ];
    } else if (presetName === "infection") {
      bundle = [
        { name: "Tab. Amoxicillin + Clavulanate", dosage: "625mg", frequency: "1-0-1", duration: "5 days", instructions: "After food" },
        { name: "Tab. Paracetamol", dosage: "650mg", frequency: "SOS", duration: "5 days", instructions: "After food" },
        { name: "Tab. Pantoprazole", dosage: "40mg", frequency: "1-0-0", duration: "5 days", instructions: "Empty stomach" },
      ];
    }
    // Replace empty placeholder or append
    setRxMedicines((prev) => {
      const filtered = prev.filter((m) => m.name && m.name.trim() !== "");
      return [...filtered, ...bundle];
    });
  };

  // Resolve canonical routing departments from hospitalDepartments with zero duplicates
  const isLabDept = (code) => ["laboratory", "pathology", "lab", "pathology_lab"].includes((code || "").toLowerCase());
  const isPharmaDept = (code) => ["pharmacy", "pharma", "dispensary"].includes((code || "").toLowerCase());
  const isRadiologyDept = (code) => ["radiology", "imaging", "xray"].includes((code || "").toLowerCase());

  const labDept = hospitalDepartments?.find((d) => isLabDept(d.dept_code));
  const pharmacyDept = hospitalDepartments?.find((d) => isPharmaDept(d.dept_code));
  const radiologyDept = hospitalDepartments?.find((d) => isRadiologyDept(d.dept_code));

  const labCode = labDept?.dept_code || "laboratory";
  const pharmacyCode = pharmacyDept?.dept_code || "pharmacy";
  const radiologyCode = radiologyDept?.dept_code || "radiology";

  // Filter out pharmacy, lab, and radiology from otherDepts so NO department is ever duplicated
  const otherDepts = (hospitalDepartments || []).filter(
    (d) => !isPharmaDept(d.dept_code) && !isLabDept(d.dept_code) && !isRadiologyDept(d.dept_code)
  );

  // Normalized current routing dept value to ensure select dropdown matches correctly
  const resolvedRoutingDept = isLabDept(rxRoutingDept)
    ? labCode
    : isPharmaDept(rxRoutingDept)
    ? pharmacyCode
    : isRadiologyDept(rxRoutingDept)
    ? radiologyCode
    : rxRoutingDept || "none";

  // Theme Styles
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const cardBorder = isDark ? "1px solid #334155" : "1px solid #E2E8F0";
  const subBg = isDark ? "#1E293B" : "#F8FAFC";
  const subBorder = isDark ? "1px solid #334155" : "1px solid #E2E8F0";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedColor = isDark ? "#94A3B8" : "#64748B";

  // RENDER EHR CONTENT (Shared between Full-Page and Modal)
  const renderWorkstationBody = () => (
    <div style={{ display: "grid", gridTemplateColumns: rxViewMode === "page" ? "minmax(360px, 420px) 1fr" : "minmax(320px, 380px) 1fr", gap: "20px", alignItems: "start" }}>
      {/* ===================== LEFT COLUMN: CLINICAL CONTEXT & DIAGNOSTICS ===================== */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Card 1: Patient Vitals & Demographics */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "16px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#0284C7" }}>
                  #{ticket.ticket_id}
                </span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: textColor }}>
                  {ticket.name}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: mutedColor, marginTop: "2px" }}>
                {ticket.age || 30} yrs • {ticket.gender || "Patient"} • {ticket.phone || "No phone"}
              </div>
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#0284C7",
                background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                padding: "3px 8px",
                borderRadius: "6px",
              }}
            >
              {getCategoryLabel(ticket.service_category, language)}
            </span>
          </div>

          {/* Chief Complaint / Symptoms */}
          <div style={{ background: subBg, border: subBorder, borderRadius: "10px", padding: "10px 12px", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: mutedColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {language === "hi" ? "मुख्य लक्षण / समस्या" : "Chief Complaint / Reported Symptoms"}
            </span>
            <div style={{ fontSize: "13.5px", fontWeight: 800, color: textColor, marginTop: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
              <IconStethoscope size={15} color="#0284C7" />
              <span>{formatSymptomLabel(ticket.medical_condition, language) || (language === "hi" ? "सामान्य परामर्श" : "General Consultation")}</span>
            </div>
          </div>

          {/* Attending Doctor Attribution */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: mutedColor }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <IconDoctor size={13} color="#0284C7" />
              <strong>{currentUser?.name || currentUser?.username || "Attending Consultant"}</strong>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <IconClock size={12} color={mutedColor} />
              {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Safety Warning Banner for Pre-filled Historical Rx */}
        {rxPreFillWarning && (
          <div style={{ background: "#FFFBEB", border: "1.5px solid #FCD34D", color: "#B45309", padding: "10px 14px", borderRadius: "12px", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 2px 6px rgba(245, 158, 11, 0.1)" }}>
            <IconAlertTriangle size={16} color="#B45309" />
            <div style={{ flex: 1 }}>{rxPreFillWarning}</div>
          </div>
        )}

        {/* Card 2: Medical History & Past Visits (Collapsible) */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "16px", padding: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: historyOpen ? "12px" : "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <IconRepeat size={16} color="#0284C7" />
              <span style={{ fontSize: "13px", fontWeight: 800, color: textColor }}>
                {language === "hi" ? "पूर्व चिकित्सीय इतिहास" : "Patient Medical History"}
              </span>
              {totalVisits > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 800, background: isDark ? "#1E293B" : "#F1F5F9", color: "#0284C7", padding: "1px 7px", borderRadius: "999px", border: subBorder }}>
                  {totalVisits} {totalVisits === 1 ? "visit" : "visits"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              style={{
                background: isDark ? "#1E293B" : "#F8FAFC",
                border: subBorder,
                borderRadius: "8px",
                padding: "4px 10px",
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#0284C7",
                cursor: "pointer",
              }}
            >
              {historyOpen ? (language === "hi" ? "संक्षिप्त करें ▲" : "Collapse ▲") : (language === "hi" ? "देखें ▼" : "View Timeline ▼")}
            </button>
          </div>

          {historyOpen && (
            <div style={{ marginTop: "12px" }}>
              <PatientHistoryTimeline
                patient={patient}
                summary={summary}
                visits={visits}
                prescriptions={prescriptions}
                reports={reports}
                isReturningPatient={isReturningPatient}
                totalVisits={totalVisits}
                loading={historyLoading}
                language={language}
                onUsePreviousPrescription={onUsePreviousPrescription}
                collapsible={false}
                defaultExpanded={true}
              />
            </div>
          )}
        </div>

        {/* Card 3: Provisional Diagnosis & Findings */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "16px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <IconStethoscope size={16} color="#0284C7" />
              <label style={{ fontSize: "13px", fontWeight: 800, color: textColor }}>
                {language === "hi" ? "रोग निदान व निष्कर्ष" : "Clinical Diagnosis & Findings"}
              </label>
            </div>
            {currentFindings.length > 0 && (
              <button
                type="button"
                onClick={() => { setRxDiagnosis(""); setRxCustomFinding(""); }}
                style={{ background: "none", border: "none", fontSize: "11px", color: "#EF4444", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
              >
                {language === "hi" ? "सभी हटाएं" : "Clear All"}
              </button>
            )}
          </div>

          {/* Active Findings Chips */}
          {currentFindings.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px", padding: "8px 10px", borderRadius: "10px", background: subBg, border: subBorder }}>
              {currentFindings.map((finding, fIdx) => (
                <span
                  key={fIdx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 9px",
                    borderRadius: "8px",
                    background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                    border: isDark ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid #BAE6FD",
                    color: isDark ? "#38BDF8" : "#0369A1",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <span>{finding}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFinding(finding)}
                    style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontWeight: 900, padding: 0, fontSize: "12px" }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add Custom Finding Input */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder={language === "hi" ? "निदान लिखें और Enter दबाएं..." : "Type custom finding & press Enter..."}
              value={rxCustomFinding}
              onChange={(e) => setRxCustomFinding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  handleAddCustomFinding();
                }
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "10px",
                border: subBorder,
                fontSize: "12.5px",
                outline: "none",
                background: subBg,
                color: textColor,
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomFinding}
              disabled={!rxCustomFinding.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                background: rxCustomFinding.trim() ? "#0284C7" : (isDark ? "#334155" : "#E2E8F0"),
                color: rxCustomFinding.trim() ? "#FFFFFF" : (isDark ? "#64748B" : "#94A3B8"),
                border: "none",
                fontWeight: 800,
                fontSize: "12px",
                cursor: rxCustomFinding.trim() ? "pointer" : "not-allowed",
              }}
            >
              + {language === "hi" ? "जोड़ें" : "Add"}
            </button>
          </div>

          {/* Quick Suggestions */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              "Viral Fever / Flu",
              "Acute Pharyngitis",
              "Hypertension",
              "GERD / Gastritis",
              "Type 2 Diabetes",
              "Bronchitis / Cough",
              "Migraine / Headache",
              "Routine Checkup",
            ].map((quick) => {
              const isSelected = currentFindings.some((f) => f.toLowerCase() === quick.toLowerCase());
              return (
                <button
                  key={quick}
                  type="button"
                  onClick={() => handleToggleFinding(quick)}
                  style={{
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "7px",
                    fontWeight: isSelected ? 800 : 600,
                    background: isSelected ? "#0284C7" : subBg,
                    border: isSelected ? "1px solid #0284C7" : subBorder,
                    color: isSelected ? "#FFFFFF" : textColor,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{isSelected ? "✓" : "+"}</span>
                  <span>{quick}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card 4: Quick 1-Tap Lab Orders */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "16px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span style={{ fontSize: "16px" }}>🧪</span>
              <label style={{ fontSize: "13px", fontWeight: 800, color: textColor }}>
                {language === "hi" ? "जांच एवं निदान (Lab Tests)" : "Diagnostic Orders & Lab Tests"}
              </label>
            </div>
            {currentTests.length > 0 && (
              <button
                type="button"
                onClick={() => { setRxLabTests(""); setRxCustomLabTest(""); }}
                style={{ background: "none", border: "none", fontSize: "11px", color: "#EF4444", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
              >
                {language === "hi" ? "सभी हटाएं" : "Clear All"}
              </button>
            )}
          </div>

          {/* Active Lab Tests Chips */}
          {currentTests.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px", padding: "8px 10px", borderRadius: "10px", background: subBg, border: subBorder }}>
              {currentTests.map((test, tIdx) => (
                <span
                  key={tIdx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 9px",
                    borderRadius: "8px",
                    background: isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5",
                    border: isDark ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid #A7F3D0",
                    color: isDark ? "#34D399" : "#047857",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <span>{test}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTest(test)}
                    style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontWeight: 900, padding: 0, fontSize: "12px" }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Quick 12 Lab Test Chips */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))", gap: "6px", marginBottom: "12px" }}>
            {quickLabOptions.map((opt) => {
              const isSelected = isTestSelected(opt);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleToggleTest(opt)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: isSelected ? 800 : 600,
                    background: isSelected ? "#059669" : subBg,
                    border: isSelected ? "1px solid #059669" : subBorder,
                    color: isSelected ? "#FFFFFF" : textColor,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    justifyContent: "flex-start",
                    transition: "all 0.15s ease",
                  }}
                  title={opt.desc}
                >
                  <span>{isSelected ? "✓" : opt.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Lab Test Input */}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder={language === "hi" ? "अन्य जांच (उदा. सीरम फेरिटिन)..." : "Add other specific test..."}
              value={rxCustomLabTest}
              onChange={(e) => setRxCustomLabTest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  handleAddCustomLabTest();
                }
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "10px",
                border: subBorder,
                fontSize: "12px",
                outline: "none",
                background: subBg,
                color: textColor,
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomLabTest}
              disabled={!rxCustomLabTest.trim()}
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                background: rxCustomLabTest.trim() ? "#059669" : (isDark ? "#334155" : "#E2E8F0"),
                color: rxCustomLabTest.trim() ? "#FFFFFF" : (isDark ? "#64748B" : "#94A3B8"),
                border: "none",
                fontWeight: 800,
                fontSize: "12px",
                cursor: rxCustomLabTest.trim() ? "pointer" : "not-allowed",
              }}
            >
              + {language === "hi" ? "जोड़ें" : "Add"}
            </button>
          </div>

          {/* Smart Auto-Routing Suggestion */}
          {currentTests.length > 0 && !isLabDept(rxRoutingDept) && !isRadiologyDept(rxRoutingDept) && (
            <div style={{ marginTop: "10px", padding: "8px 10px", borderRadius: "8px", background: isDark ? "rgba(2, 132, 199, 0.15)" : "#F0F9FF", border: isDark ? "1px dashed #38BDF8" : "1px dashed #BAE6FD", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: isDark ? "#38BDF8" : "#0369A1", fontWeight: 700 }}>
                💡 {language === "hi" ? "मरीज़ को सीधे लैब रेफर करें?" : "Route to diagnostic lab?"}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setRxRoutingDept(labCode)}
                  style={{ background: "#0284C7", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "3px 8px", fontSize: "10.5px", fontWeight: 800, cursor: "pointer" }}
                >
                  🧪 {language === "hi" ? "पैथोलॉजी लैब" : "Pathology Lab"}
                </button>
                {currentTests.some((t) => /x-ray|xray|mri|ct|usg|scan/i.test(t)) && (
                  <button
                    type="button"
                    onClick={() => setRxRoutingDept(radiologyCode)}
                    style={{ background: "#0369A1", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "3px 8px", fontSize: "10.5px", fontWeight: 800, cursor: "pointer" }}
                  >
                    🩻 {language === "hi" ? "रेडियोलॉजी" : "Radiology"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ===================== RIGHT COLUMN: MEDICATION GRID & CLINICAL ACTIONS ===================== */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Card 1: Prescribed Medications Table (Full-Width Generous Layout) */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "16px", padding: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 900 }}>
                ℞
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 800, color: textColor, display: "block" }}>
                  {language === "hi" ? "दवाएं, खुराक एवं सेवन समय (Medication Table)" : "Prescribed Medications & Dosages"}
                </label>
                <span style={{ fontSize: "11px", color: mutedColor }}>
                  {rxMedicines.length} {rxMedicines.length === 1 ? "medicine listed" : "medicines listed"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={handleAddMedicineRow}
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                }}
              >
                <span>+</span>
                <span>{language === "hi" ? "दवा जोड़ें" : "Add Medicine Row"}</span>
              </button>
            </div>
          </div>

          {/* Quick Medicine Preset Bundles */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px", padding: "8px 12px", borderRadius: "10px", background: subBg, border: subBorder }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: mutedColor }}>
              {language === "hi" ? "त्वरित प्रिस्क्रिप्शन बंडल:" : "Quick Rx Bundles:"}
            </span>
            <button
              type="button"
              onClick={() => applyMedicinePreset("fever")}
              style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", border: subBorder, background: cardBg, color: textColor, fontWeight: 700, cursor: "pointer" }}
            >
              💊 Fever (PCM + Panto)
            </button>
            <button
              type="button"
              onClick={() => applyMedicinePreset("cold")}
              style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", border: subBorder, background: cardBg, color: textColor, fontWeight: 700, cursor: "pointer" }}
            >
              💊 Cold & Cough (Cetirizine + Ambroxol)
            </button>
            <button
              type="button"
              onClick={() => applyMedicinePreset("gastritis")}
              style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", border: subBorder, background: cardBg, color: textColor, fontWeight: 700, cursor: "pointer" }}
            >
              💊 Acidity (Panto-D + Gel)
            </button>
            <button
              type="button"
              onClick={() => applyMedicinePreset("infection")}
              style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", border: subBorder, background: cardBg, color: textColor, fontWeight: 700, cursor: "pointer" }}
            >
              💊 Infection (Amox-Clav + PCM)
            </button>
          </div>

          {/* Spacious Medication Grid Header */}
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "32px minmax(180px, 2fr) minmax(75px, 0.8fr) minmax(110px, 1fr) minmax(75px, 0.8fr) minmax(110px, 1fr) minmax(105px, 1fr) 32px", gap: "10px", padding: "8px 10px", background: subBg, borderRadius: "8px", fontSize: "11.5px", fontWeight: 800, color: mutedColor, marginBottom: "8px" }}>
              <span>#</span>
              <span>{language === "hi" ? "दवा का नाम" : "Medicine Name & Strength"}</span>
              <span>{language === "hi" ? "खुराक" : "Dosage"}</span>
              <span>{language === "hi" ? "आवृत्ति (Frequency)" : "Frequency"}</span>
              <span>{language === "hi" ? "अवधि" : "Duration"}</span>
              <span>{language === "hi" ? "सेवन निर्देश" : "Instructions"}</span>
              <span>{language === "hi" ? "स्थिति" : "Status"}</span>
              <span></span>
            </div>

            {/* Medication Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {rxMedicines.map((med, idx) => {
                const isTktCompleted = String(ticket?.status || "").toLowerCase() === "completed";
                const isItemGiven = med.dispense_status === "given" || med.given === true || med.dispensed === true;

                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px minmax(180px, 2fr) minmax(75px, 0.8fr) minmax(110px, 1fr) minmax(75px, 0.8fr) minmax(110px, 1fr) minmax(105px, 1fr) 32px",
                      gap: "10px",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      background: cardBg,
                      border: subBorder,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 800, color: mutedColor, textAlign: "center" }}>
                      {idx + 1}
                    </span>

                    {/* Medicine Name Input */}
                    <input
                      type="text"
                      placeholder="e.g. Paracetamol 650mg, Amoxicillin 500mg..."
                      value={med.name}
                      onChange={(e) => handleMedicineChange(idx, "name", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: subBorder,
                        fontSize: "13px",
                        fontWeight: 600,
                        background: subBg,
                        color: textColor,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />

                    {/* Dosage Input */}
                    <input
                      type="text"
                      placeholder="500mg"
                      value={med.dosage}
                      onChange={(e) => handleMedicineChange(idx, "dosage", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: subBorder,
                        fontSize: "12.5px",
                        background: subBg,
                        color: textColor,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />

                    {/* Frequency Select */}
                    <select
                      value={med.frequency}
                      onChange={(e) => handleMedicineChange(idx, "frequency", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: subBorder,
                        fontSize: "12px",
                        background: subBg,
                        color: textColor,
                        outline: "none",
                        boxSizing: "border-box",
                        cursor: "pointer",
                      }}
                    >
                      <option value="1-0-1">1-0-1 (Twice daily)</option>
                      <option value="1-1-1">1-1-1 (Thrice daily)</option>
                      <option value="1-0-0">1-0-0 (Morning only)</option>
                      <option value="0-0-1">0-0-1 (Night only)</option>
                      <option value="1-0-0-1">1-0-0-1 (4 times daily)</option>
                      <option value="SOS">SOS (As needed)</option>
                      <option value="Once weekly">Once weekly</option>
                    </select>

                    {/* Duration Input */}
                    <input
                      type="text"
                      placeholder="5 days"
                      value={med.duration}
                      onChange={(e) => handleMedicineChange(idx, "duration", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: subBorder,
                        fontSize: "12.5px",
                        background: subBg,
                        color: textColor,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />

                    {/* Instructions Select */}
                    <select
                      value={med.instructions}
                      onChange={(e) => handleMedicineChange(idx, "instructions", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 8px",
                        borderRadius: "8px",
                        border: subBorder,
                        fontSize: "12px",
                        background: subBg,
                        color: textColor,
                        outline: "none",
                        boxSizing: "border-box",
                        cursor: "pointer",
                      }}
                    >
                      <option value="After food">After food</option>
                      <option value="Before food">Before food</option>
                      <option value="Empty stomach">Empty stomach</option>
                      <option value="Bedtime">Bedtime</option>
                      <option value="With warm water">With warm water</option>
                    </select>

                    {/* Given / Not Given Status (Editable dropdown if IN_PROGRESS, plain text if COMPLETED) */}
                    <div>
                      {!isTktCompleted ? (
                        <select
                          value={isItemGiven ? "given" : "not_given"}
                          onChange={(e) => {
                            const isG = e.target.value === "given";
                            handleMedicineChange(idx, "dispense_status", e.target.value);
                            handleMedicineChange(idx, "given", isG);
                            handleMedicineChange(idx, "dispensed", isG);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 6px",
                            borderRadius: "8px",
                            border: isItemGiven ? "1.5px solid #10B981" : subBorder,
                            fontSize: "11px",
                            fontWeight: 700,
                            background: isItemGiven
                              ? (isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5")
                              : subBg,
                            color: isItemGiven ? "#059669" : textColor,
                            outline: "none",
                            boxSizing: "border-box",
                            cursor: "pointer",
                          }}
                        >
                          <option value="not_given">{language === "hi" ? "नहीं दी गई" : "Not Given"}</option>
                          <option value="given">{language === "hi" ? "दी गई ✓" : "Given ✓"}</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: isItemGiven ? (isDark ? "#34D399" : "#059669") : (isDark ? "#F87171" : "#DC2626"),
                            display: "block",
                            textAlign: "center",
                          }}
                        >
                          {isItemGiven ? (language === "hi" ? "दी गई" : "Given") : (language === "hi" ? "नहीं दी गई" : "Not Given")}
                        </span>
                      )}
                    </div>

                    {/* Delete Button */}
                    <div>
                      {rxMedicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicineRow(idx)}
                          style={{
                            background: isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2",
                            border: "none",
                            color: "#EF4444",
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            fontSize: "13px",
                          }}
                          title="Remove Medicine"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Clinical Advice & Dietary Instructions */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "16px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 800, color: textColor, marginBottom: "8px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <IconClipboard size={16} color="#0284C7" />
              {language === "hi" ? "चिकित्सकीय सलाह एवं परहेज (Doctor Advice & Lifestyle)" : "Doctor Advice, Diet & Lifestyle Guidelines"}
            </span>
          </label>
          <textarea
            rows={3}
            placeholder={
              language === "hi"
                ? "उदा. पर्याप्त गर्म पानी पिएं (दिन में 3 लीटर), नमक कम खाएं, भारी काम से बचें, बुखार दोबारा आने पर अस्पताल आएं..."
                : "e.g. Drink plenty of warm fluids (3L daily), light digestible diet, avoid heavy lifting, steam inhalation twice daily..."
            }
            value={rxAdvice}
            onChange={(e) => setRxAdvice(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "10px",
              border: subBorder,
              fontSize: "13px",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              background: subBg,
              color: textColor,
            }}
          />
        </div>

        {/* Card 3: Follow-Up Consultation */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "16px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 800, color: textColor, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <IconCalendar size={16} color="#0284C7" />
              {language === "hi" ? "पुनः परामर्श / फॉलो-अप (Follow-Up Advice)" : "Follow-Up Consultation Schedule"}
            </label>
            <div style={{ display: "flex", gap: "4px" }}>
              {["After 3 days", "After 5 days", "After 1 week", "SOS"].map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setRxFollowUp(pill === "SOS" ? "SOS if symptoms persist or fever spikes" : `${pill} with lab reports`)}
                  style={{ fontSize: "10.5px", padding: "2px 7px", borderRadius: "6px", border: subBorder, background: subBg, color: "#0284C7", fontWeight: 700, cursor: "pointer" }}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            placeholder={language === "hi" ? "उदा. 5 दिन बाद जांच रिपोर्ट के साथ आएं" : "e.g. Review after 5 days with lab reports, or SOS if fever spikes"}
            value={rxFollowUp}
            onChange={(e) => setRxFollowUp(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "10px",
              border: subBorder,
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
              background: subBg,
              color: textColor,
            }}
          />
        </div>

        {/* Card 4: Next Destination / Care Routing */}
        <div style={{ background: cardBg, border: cardBorder, borderRadius: "16px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 800, color: textColor, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <IconHospital size={16} color="#0284C7" />
              {language === "hi" ? "मरीज़ का अगला गंतव्य / विभाग रेफरल" : "Next Destination / Care Routing"}
            </label>
            <span style={{ fontSize: "11px", color: mutedColor, fontWeight: 600 }}>
              {language === "hi" ? "परामर्श उपरांत मरीज़ हेतु विभाग चुनें" : "Select target department for patient routing"}
            </span>
          </div>

          <select
            value={resolvedRoutingDept}
            onChange={(e) => setRxRoutingDept(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "10px",
              border: subBorder,
              fontSize: "13px",
              fontWeight: 700,
              outline: "none",
              background: subBg,
              color: textColor,
              boxSizing: "border-box",
              cursor: "pointer",
            }}
          >
            <option value="none">
              🏥 {language === "hi" ? "सीधे छुट्टी / परामर्श पूर्ण (Direct Discharge)" : "Direct Discharge / None (Complete Consultation)"}
            </option>
            <option value={pharmacyCode}>
              💊 {pharmacyDept?.name || (language === "hi" ? "फार्मेसी (दवा वितरण काउंटर)" : "Pharmacy (Medication Dispensing Counter)")}
            </option>
            <option value={labCode}>
              🧪 {labDept?.name || (language === "hi" ? "पैथोलॉजी एवं लैब जांच (रक्त व नमूना)" : "Pathology Lab (Blood & Specimen Lab)")}
            </option>
            <option value={radiologyCode}>
              🩻 {radiologyDept?.name || (language === "hi" ? "रेडियोलॉजी (एक्स-रे, सीटी, एमआरआई)" : "Radiology (X-Ray & MRI Imaging)")}
            </option>
            {otherDepts.length > 0 ? (
              otherDepts.map((d) => (
                <option key={d.dept_code} value={d.dept_code}>
                  {d.dept_code === "emergency" ? "🚨 " : d.dept_code === "billing" ? "💳 " : d.dept_code === "reception" ? "🏢 " : "🩺 "}
                  {d.name || getCategoryLabel(d.dept_code, language)}
                </option>
              ))
            ) : (
              <>
                <option value="consultation">🩺 General Consultation (OPD)</option>
                <option value="cardiology">🩺 Cardiology OPD</option>
                <option value="orthopedics">🩺 Orthopedics / Fracture Clinic</option>
                <option value="pulmonology">🩺 Pulmonology & Respiratory</option>
                <option value="pediatrics">🩺 Pediatrics OPD</option>
                <option value="gynecology">🩺 Gynecology & Obstetrics</option>
                <option value="dermatology">🩺 Dermatology Clinic</option>
              </>
            )}
          </select>

          {/* Transfer notes / Handover details */}
          {rxRoutingDept && rxRoutingDept !== "none" && (
            <div style={{ marginTop: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: mutedColor, marginBottom: "6px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <IconClipboard size={14} color="#0284C7" />
                  {language === "hi"
                    ? `हस्तांतरित विभाग हेतु निर्देश / पर्ची विवरण (${getCategoryLabel(rxRoutingDept, language)}):`
                    : `Prescription / Description for Transferred Department (${getCategoryLabel(rxRoutingDept, language)}):`}
                </span>
              </label>
              <textarea
                rows={2}
                placeholder={
                  language === "hi"
                    ? "हस्तांतरित विभाग के कर्मचारियों हेतु निर्देश, दवा वितरण नोट्स या आवश्यक जांच विवरण लिखें..."
                    : "Enter clinical instructions, medicine dispensing notes, or specific testing requirements for the receiving department..."
                }
                value={rxTransferNotes}
                onChange={(e) => setRxTransferNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: subBorder,
                  fontSize: "12.5px",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  background: subBg,
                  color: textColor,
                }}
              />
            </div>
          )}
        </div>

        {/* Status Feedback Message */}
        {rxStatusMsg && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: rxStatusMsg.includes("✓") ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#F0FDF4") : (isDark ? "rgba(2, 132, 199, 0.2)" : "#F0F9FF"),
              border: rxStatusMsg.includes("✓") ? "1px solid #86EFAC" : "1px solid #BAE6FD",
              color: rxStatusMsg.includes("✓") ? "#166534" : "#0369A1",
              fontSize: "13px",
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            {rxStatusMsg}
          </div>
        )}

        {/* Bottom Submission Toolbar */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "4px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              border: subBorder,
              background: subBg,
              color: mutedColor,
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {language === "hi" ? "← कतार में लौटें" : "← Back to Queue"}
          </button>

          <button
            type="button"
            onClick={() => onPrint(false)}
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              border: isDark ? "1.5px solid #0284C7" : "1.5px solid #BAE6FD",
              background: isDark ? "rgba(2, 132, 199, 0.2)" : "#F0F9FF",
              color: isDark ? "#38BDF8" : "#0284C7",
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            title={language === "hi" ? "दवा पर्ची प्रिंट करें" : "Print Official Prescription Slip"}
          >
            <span style={{ fontSize: "16px" }}>🖨️</span>
            <span>{language === "hi" ? "पर्ची प्रिंट करें" : "Print Rx"}</span>
          </button>

          <button
            type="button"
            onClick={() => onPrint(true)}
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              border: subBorder,
              background: subBg,
              color: textColor,
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
            title={language === "hi" ? "पीडीएफ डाउनलोड करें" : "Download PDF"}
          >
            <span>📥</span>
            <span>PDF</span>
          </button>

          <button
            type="button"
            disabled={rxSaving}
            onClick={() => onSave(true)}
            style={{
              flex: 1,
              minWidth: "220px",
              padding: "13px 22px",
              borderRadius: "12px",
              border: "none",
              background: rxRoutingDept && rxRoutingDept !== "none"
                ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                : "linear-gradient(135deg, #059669 0%, #047857 100%)",
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: "14px",
              cursor: rxSaving ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: rxRoutingDept && rxRoutingDept !== "none"
                ? "0 4px 14px rgba(2, 132, 199, 0.35)"
                : "0 4px 14px rgba(5, 150, 105, 0.35)",
              transition: "all 0.2s ease",
            }}
          >
            <span>✓</span>
            <span>
              {rxRoutingDept && rxRoutingDept !== "none"
                ? (language === "hi"
                    ? `सहेजें एवं ${getCategoryLabel(rxRoutingDept, language)} में भेजें ➔`
                    : `Save Rx & Route to ${getCategoryLabel(rxRoutingDept, language)} ➔`)
                : (language === "hi"
                    ? "सहेजें एवं परामर्श पूर्ण करें"
                    : "Save Rx & Complete Visit")}
            </span>
          </button>
        </div>

      </div>
    </div>
  );

  // =========================================================================
  // VIEW MODE 1: DEDICATED FULL-PAGE CLINICAL WORKSTATION
  // =========================================================================
  if (rxViewMode === "page") {
    return (
      <div style={{ padding: "0 0 40px 0" }}>
        {/* Sticky Command Bar */}
        <div
          style={{
            position: "sticky",
            top: "10px",
            zIndex: 100,
            marginBottom: "20px",
            padding: "12px 20px",
            borderRadius: "16px",
            background: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
            border: cardBorder,
            backdropFilter: "blur(12px)",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {/* Left: Back button & Patient Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: subBg,
                border: subBorder,
                borderRadius: "10px",
                padding: "8px 14px",
                fontSize: "12.5px",
                fontWeight: 800,
                color: textColor,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              title="Return to patient queue dashboard (Draft is safely preserved)"
            >
              <span>←</span>
              <span>{language === "hi" ? "कतार में लौटें" : "Back to Queue"}</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 900,
                  boxShadow: "0 3px 10px rgba(2, 132, 199, 0.3)",
                }}
              >
                ℞
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 900, color: textColor }}>
                    Token #{ticket.ticket_id}
                  </span>
                  <span style={{ color: mutedColor }}>•</span>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#0284C7" }}>
                    {ticket.name}
                  </span>
                  <span style={{ fontSize: "12px", color: mutedColor }}>
                    ({ticket.age || 30}y, {ticket.gender || "Patient"})
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "1px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#0369A1", background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", padding: "1px 6px", borderRadius: "4px" }}>
                    {getCategoryLabel(ticket.service_category, language)}
                  </span>
                  <span style={{ fontSize: "10.5px", color: "#10B981", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", display: "inline-block", boxShadow: "0 0 6px #10B981" }} />
                    {language === "hi" ? "परामर्श जारी" : "IN CONSULTATION"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Auto-Save Status & Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Cloud Auto-Save Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 10px",
                borderRadius: "8px",
                background: subBg,
                border: subBorder,
                fontSize: "11px",
                fontWeight: 700,
                color: rxAutoSaveStatus === "saving" ? "#0284C7" : rxAutoSaveStatus === "saved" ? "#10B981" : mutedColor,
              }}
              title="EHR Draft Auto-Saver automatically synchronizes your prescription changes"
            >
              <IconSave size={12} color={rxAutoSaveStatus === "saving" ? "#0284C7" : rxAutoSaveStatus === "saved" ? "#10B981" : mutedColor} />
              <span>
                {rxAutoSaveStatus === "saving"
                  ? (language === "hi" ? "ड्राफ्ट सहेजा जा रहा है..." : "Saving draft...")
                  : rxAutoSaveStatus === "saved"
                  ? (language === "hi" ? "ड्राफ्ट सहेजा गया ✓" : "Draft saved ✓")
                  : (language === "hi" ? "स्वतः सहेजना चालू" : "Auto-save active")}
              </span>
            </div>

            {/* Toggle Mode: Switch to Popup Mode */}
            <button
              type="button"
              onClick={onToggleViewMode}
              style={{
                padding: "7px 12px",
                borderRadius: "10px",
                border: subBorder,
                background: subBg,
                color: textColor,
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
              title={language === "hi" ? "फ्लोटिंग पॉपअप विंडो में बदलें" : "Switch to floating popup window"}
            >
              <span>🗗</span>
              <span>{language === "hi" ? "पॉपअप विंडो" : "Popup Mode"}</span>
            </button>

            {/* Print Rx */}
            <button
              type="button"
              onClick={() => onPrint(false)}
              style={{
                padding: "7px 13px",
                borderRadius: "10px",
                border: isDark ? "1.5px solid #0284C7" : "1.5px solid #BAE6FD",
                background: isDark ? "rgba(2, 132, 199, 0.2)" : "#F0F9FF",
                color: isDark ? "#38BDF8" : "#0284C7",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
              title={language === "hi" ? "दवा पर्ची प्रिंट करें" : "Print Official Prescription Slip"}
            >
              <span>🖨️</span>
              <span>{language === "hi" ? "प्रिंट पर्ची" : "Print Rx"}</span>
            </button>

            {/* Download PDF */}
            <button
              type="button"
              onClick={() => onPrint(true)}
              style={{
                padding: "7px 11px",
                borderRadius: "10px",
                border: subBorder,
                background: subBg,
                color: textColor,
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              title="Download Prescription PDF"
            >
              <span>📥</span>
              <span>PDF</span>
            </button>

            {/* Primary Save CTA */}
            <button
              type="button"
              disabled={rxSaving}
              onClick={() => onSave(true)}
              style={{
                padding: "8px 18px",
                borderRadius: "10px",
                border: "none",
                background: rxRoutingDept && rxRoutingDept !== "none"
                  ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                  : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                color: "#FFFFFF",
                fontSize: "12.5px",
                fontWeight: 900,
                cursor: rxSaving ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 3px 12px rgba(2, 132, 199, 0.3)",
              }}
            >
              <span>✓</span>
              <span>
                {rxRoutingDept && rxRoutingDept !== "none"
                  ? `${getCategoryLabel(rxRoutingDept, language)} ➔`
                  : (language === "hi" ? "परामर्श पूर्ण" : "Complete Visit")}
              </span>
            </button>
          </div>
        </div>

        {/* Workstation 2-Column Body */}
        {renderWorkstationBody()}
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE 2: WIDENED 1240px FLOATING MODAL WINDOW
  // =========================================================================
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: isDark ? "#0B1120" : "#FFFFFF",
          border: cardBorder,
          borderRadius: "20px",
          maxWidth: "1260px",
          width: "95vw",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "24px 28px",
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.3)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", borderBottom: subBorder, paddingBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 900, boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)" }}>
              ℞
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", color: textColor, fontWeight: 800 }}>
                {language === "hi" ? "चिकित्सकीय दवा पर्ची (ई-प्रिस्क्रिप्शन)" : "Doctor Clinical E-Prescription (Rx)"}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 800, color: "#0284C7" }}>
                  Token #{ticket.ticket_id}
                </span>
                <span style={{ color: mutedColor }}>•</span>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: textColor }}>
                  {ticket.name} ({ticket.age || 30} yrs, {ticket.gender || "Patient"})
                </span>
                <span style={{ color: mutedColor }}>•</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369A1", background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", padding: "1px 6px", borderRadius: "4px" }}>
                  {getCategoryLabel(ticket.service_category, language)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Expand to Full Page Button */}
            <button
              type="button"
              onClick={onToggleViewMode}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: subBorder,
                background: subBg,
                color: textColor,
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
              title={language === "hi" ? "पूर्ण पृष्ठ कार्यक्षेत्र में विस्तारित करें" : "Expand to dedicated Full-Page Workstation"}
            >
              <span>⛶</span>
              <span>{language === "hi" ? "पूर्ण पृष्ठ" : "Full Page"}</span>
            </button>

            {/* Print Rx */}
            <button
              type="button"
              onClick={() => onPrint(false)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: isDark ? "1.5px solid #0284C7" : "1.5px solid #BAE6FD",
                background: isDark ? "rgba(2, 132, 199, 0.2)" : "#F0F9FF",
                color: isDark ? "#38BDF8" : "#0284C7",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>🖨️</span>
              <span>{language === "hi" ? "प्रिंट" : "Print Rx"}</span>
            </button>

            {/* PDF */}
            <button
              type="button"
              onClick={() => onPrint(true)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: subBorder,
                background: subBg,
                color: textColor,
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>📥</span>
              <span>PDF</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: "20px", color: mutedColor, cursor: "pointer", padding: "4px", marginLeft: "4px" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {renderWorkstationBody()}
      </div>
    </div>
  );
}
