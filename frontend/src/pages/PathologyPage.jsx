/**
 * PathologyPage.jsx
 * -----------------
 * Enterprise Clinical Pathology & Diagnostic Laboratory Workstation.
 * Features:
 * - Real-Time Laboratory Queue & Specimen Collection Stream
 * - Active Test Execution Station with Doctor Referral Audit
 * - Structured Diagnostic Test Report Entry with Biological Reference Intervals & Auto-Flagging
 * - Pre-configured Diagnostic Panels (CBC, Glucose/HbA1c, Lipid, KFT, LFT, Thyroid, Urine Routine)
 * - Printable Hospital-Branded Lab Test Report Slips
 * - Ticket Routing (Discharge or Route back to Referring OPD Doctor)
 * - Historical Lab Archives & Date-Filtered Reports with Excel Export
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { announceTicketVoice } from "../utils/voiceSynthesizer";
import { printLabReportSlip } from "../utils/printPassHelper";
import Footer from "../components/common/Footer";
import {
  FlaskConical,
  TestTube,
  Microscope,
  Activity,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  Search,
  RefreshCw,
  Clock,
  User,
  Stethoscope,
  Building2,
  Sparkles,
  Coffee,
  History,
  Calendar,
  Eye,
  Phone,
  Plus,
  Trash2,
  Shield,
  ArrowRight,
  ChevronDown,
  Check,
  FileCheck,
  Sliders,
  Share2,
  UserCheck,
  Send,
  AlertCircle
} from "lucide-react";
import * as XLSX from "xlsx";

// Standard Clinical Diagnostic Test Panels with Biological Reference Intervals
const DEFAULT_TEST_PANELS = {
  cbc: {
    id: "cbc",
    name: "Complete Blood Count (CBC)",
    specimen: "Whole Blood (EDTA)",
    parameters: [
      { parameter: "Hemoglobin (Hb)", value: "13.8", unit: "g/dL", ref_range: "13.0 - 17.0", min: 13.0, max: 17.0, flag: "NORMAL" },
      { parameter: "Total Leukocyte Count (TLC / WBC)", value: "7200", unit: "/µL", ref_range: "4,000 - 11,000", min: 4000, max: 11000, flag: "NORMAL" },
      { parameter: "RBC Count", value: "4.8", unit: "mil/µL", ref_range: "4.5 - 5.9", min: 4.5, max: 5.9, flag: "NORMAL" },
      { parameter: "Platelet Count", value: "240000", unit: "/µL", ref_range: "150,000 - 450,000", min: 150000, max: 450000, flag: "NORMAL" },
      { parameter: "Packed Cell Volume (PCV / Hematocrit)", value: "41.5", unit: "%", ref_range: "40.0 - 50.0", min: 40.0, max: 50.0, flag: "NORMAL" },
      { parameter: "Mean Corpuscular Volume (MCV)", value: "86.4", unit: "fL", ref_range: "80.0 - 100.0", min: 80.0, max: 100.0, flag: "NORMAL" },
      { parameter: "Mean Corpuscular Hemoglobin (MCH)", value: "28.8", unit: "pg", ref_range: "27.0 - 32.0", min: 27.0, max: 32.0, flag: "NORMAL" },
      { parameter: "Neutrophils", value: "62", unit: "%", ref_range: "40 - 70", min: 40, max: 70, flag: "NORMAL" },
      { parameter: "Lymphocytes", value: "29", unit: "%", ref_range: "20 - 40", min: 20, max: 40, flag: "NORMAL" },
      { parameter: "Eosinophils", value: "4", unit: "%", ref_range: "1 - 6", min: 1, max: 6, flag: "NORMAL" },
      { parameter: "Monocytes", value: "5", unit: "%", ref_range: "2 - 8", min: 2, max: 8, flag: "NORMAL" }
    ]
  },
  glucose: {
    id: "glucose",
    name: "Blood Glucose & Glycated Hemoglobin (HbA1c)",
    specimen: "Fluoride Plasma & Whole Blood",
    parameters: [
      { parameter: "Fasting Blood Sugar (FBS)", value: "92", unit: "mg/dL", ref_range: "70 - 99", min: 70, max: 99, flag: "NORMAL" },
      { parameter: "Post-Prandial Blood Sugar (PPBS)", value: "128", unit: "mg/dL", ref_range: "70 - 140", min: 70, max: 140, flag: "NORMAL" },
      { parameter: "HbA1c (Glycated Hemoglobin)", value: "5.4", unit: "%", ref_range: "< 5.7 (Normal), 5.7-6.4 (Pre-diabetes)", min: 4.0, max: 5.6, flag: "NORMAL" },
      { parameter: "Estimated Average Glucose (eAG)", value: "108", unit: "mg/dL", ref_range: "90 - 120", min: 90, max: 120, flag: "NORMAL" }
    ]
  },
  lipid: {
    id: "lipid",
    name: "Lipid Profile (Cardiac Risk Marker)",
    specimen: "Serum (10-12 hrs Fasting)",
    parameters: [
      { parameter: "Total Cholesterol", value: "178", unit: "mg/dL", ref_range: "< 200 (Desirable)", min: 120, max: 200, flag: "NORMAL" },
      { parameter: "Serum Triglycerides", value: "135", unit: "mg/dL", ref_range: "< 150 (Normal)", min: 50, max: 150, flag: "NORMAL" },
      { parameter: "HDL Cholesterol (Good)", value: "48", unit: "mg/dL", ref_range: "> 40 (Optimal)", min: 40, max: 70, flag: "NORMAL" },
      { parameter: "LDL Cholesterol (Bad)", value: "103", unit: "mg/dL", ref_range: "< 100 (Optimal)", min: 50, max: 100, flag: "HIGH" },
      { parameter: "VLDL Cholesterol", value: "27", unit: "mg/dL", ref_range: "< 30", min: 5, max: 30, flag: "NORMAL" },
      { parameter: "Total Cholesterol / HDL Ratio", value: "3.7", unit: "Ratio", ref_range: "3.0 - 5.0", min: 3.0, max: 5.0, flag: "NORMAL" }
    ]
  },
  kft: {
    id: "kft",
    name: "Kidney Function Test (KFT / RFT)",
    specimen: "Serum / Clot Activator",
    parameters: [
      { parameter: "Serum Creatinine", value: "0.92", unit: "mg/dL", ref_range: "0.60 - 1.20", min: 0.6, max: 1.2, flag: "NORMAL" },
      { parameter: "Blood Urea", value: "24.0", unit: "mg/dL", ref_range: "15.0 - 45.0", min: 15.0, max: 45.0, flag: "NORMAL" },
      { parameter: "Blood Urea Nitrogen (BUN)", value: "11.2", unit: "mg/dL", ref_range: "7.0 - 20.0", min: 7.0, max: 20.0, flag: "NORMAL" },
      { parameter: "Serum Uric Acid", value: "5.1", unit: "mg/dL", ref_range: "3.5 - 7.2", min: 3.5, max: 7.2, flag: "NORMAL" },
      { parameter: "Serum Sodium (Na+)", value: "140", unit: "mEq/L", ref_range: "135 - 145", min: 135, max: 145, flag: "NORMAL" },
      { parameter: "Serum Potassium (K+)", value: "4.2", unit: "mEq/L", ref_range: "3.5 - 5.1", min: 3.5, max: 5.1, flag: "NORMAL" }
    ]
  },
  lft: {
    id: "lft",
    name: "Liver Function Test (LFT)",
    specimen: "Serum / Clot Activator",
    parameters: [
      { parameter: "Total Bilirubin", value: "0.80", unit: "mg/dL", ref_range: "0.20 - 1.20", min: 0.2, max: 1.2, flag: "NORMAL" },
      { parameter: "Direct (Conjugated) Bilirubin", value: "0.20", unit: "mg/dL", ref_range: "0.00 - 0.30", min: 0.0, max: 0.3, flag: "NORMAL" },
      { parameter: "SGOT / AST", value: "28", unit: "U/L", ref_range: "< 40", min: 5, max: 40, flag: "NORMAL" },
      { parameter: "SGPT / ALT", value: "32", unit: "U/L", ref_range: "< 45", min: 5, max: 45, flag: "NORMAL" },
      { parameter: "Alkaline Phosphatase (ALP)", value: "88", unit: "U/L", ref_range: "30 - 120", min: 30, max: 120, flag: "NORMAL" },
      { parameter: "Total Serum Protein", value: "7.2", unit: "g/dL", ref_range: "6.4 - 8.3", min: 6.4, max: 8.3, flag: "NORMAL" },
      { parameter: "Serum Albumin", value: "4.3", unit: "g/dL", ref_range: "3.5 - 5.2", min: 3.5, max: 5.2, flag: "NORMAL" }
    ]
  },
  thyroid: {
    id: "thyroid",
    name: "Thyroid Profile (TSH / T3 / T4)",
    specimen: "Serum (Morning Sample Preferred)",
    parameters: [
      { parameter: "TSH (Ultrasensitive)", value: "2.45", unit: "µIU/mL", ref_range: "0.40 - 4.20", min: 0.4, max: 4.2, flag: "NORMAL" },
      { parameter: "Total Triiodothyronine (T3)", value: "1.15", unit: "ng/mL", ref_range: "0.80 - 2.00", min: 0.8, max: 2.0, flag: "NORMAL" },
      { parameter: "Total Thyroxine (T4)", value: "8.2", unit: "µg/dL", ref_range: "5.1 - 14.1", min: 5.1, max: 14.1, flag: "NORMAL" }
    ]
  },
  urine: {
    id: "urine",
    name: "Urine Routine & Microscopic Examination",
    specimen: "Mid-stream Clean Catch Urine",
    parameters: [
      { parameter: "Color & Appearance", value: "Pale Yellow, Clear", unit: "", ref_range: "Pale Yellow / Clear", min: null, max: null, flag: "NORMAL" },
      { parameter: "Specific Gravity", value: "1.018", unit: "", ref_range: "1.005 - 1.030", min: 1.005, max: 1.030, flag: "NORMAL" },
      { parameter: "pH (Reaction)", value: "6.0", unit: "", ref_range: "4.5 - 8.0 (Acidic)", min: 4.5, max: 8.0, flag: "NORMAL" },
      { parameter: "Urine Protein (Albumin)", value: "Nil", unit: "", ref_range: "Nil (Negative)", min: null, max: null, flag: "NORMAL" },
      { parameter: "Urine Glucose (Sugar)", value: "Nil", unit: "", ref_range: "Nil (Negative)", min: null, max: null, flag: "NORMAL" },
      { parameter: "Ketone Bodies", value: "Negative", unit: "", ref_range: "Negative", min: null, max: null, flag: "NORMAL" },
      { parameter: "Pus Cells (Leukocytes)", value: "1 - 2", unit: "/HPF", ref_range: "0 - 5 /HPF", min: 0, max: 5, flag: "NORMAL" },
      { parameter: "RBCs (Erythrocytes)", value: "Nil", unit: "/HPF", ref_range: "0 - 2 /HPF", min: 0, max: 2, flag: "NORMAL" },
      { parameter: "Epithelial Cells", value: "Few (1-3)", unit: "/HPF", ref_range: "Few /HPF", min: null, max: null, flag: "NORMAL" }
    ]
  }
};

export default function PathologyPage({
  tenantId,
  currentUser,
  analytics,
  queueSnapshot = [],
  servingTickets = [],
  heldTickets = [],
  refreshData,
  language = "en",
  setLanguage = null,
  socketRef,
  navigateTo,
  hospitalBranding = null,
  theme = "light",
  setTheme = null,
}) {
  const isHi = language === "hi";
  const effectiveHospitalCode =
    hospitalBranding?.hospital_code ||
    currentUser?.hospital_code ||
    tenantId ||
    HOSPITAL_CONFIG.tenantId ||
    "city-hospital-01";

  const brandPrimary = hospitalBranding?.primary_color || "#0284C7";
  const brandName =
    hospitalBranding?.hospital_name ||
    hospitalBranding?.name ||
    currentUser?.hospital_name ||
    "City General Hospital";

  // Theme Sync
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) {}
    return theme || "light";
  });

  useEffect(() => {
    if (theme && (theme === "dark" || theme === "light") && theme !== currentTheme) {
      setCurrentTheme(theme);
    }
  }, [theme, currentTheme]);

  const isDark = currentTheme === "dark";

  // Tab State: "workstation" (Diagnostic Station) | "archive" (Lab Reports Archive) | "history" (Patient Lab Visit History)
  const [activeTab, setActiveTab] = useState("workstation");

  // Counter & Duty Status
  const [activeCounter, setActiveCounter] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_pathology_counter");
      return saved || "Pathology Lab - 1";
    } catch (_) {
      return "Pathology Lab - 1";
    }
  });

  const [dutyStatus, setDutyStatus] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_pathology_duty");
      return saved || "ACTIVE";
    } catch (_) {
      return "ACTIVE";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ai_queue_pathology_counter", activeCounter);
    } catch (_) {}
  }, [activeCounter]);

  useEffect(() => {
    try {
      localStorage.setItem("ai_queue_pathology_duty", dutyStatus);
    } catch (_) {}
  }, [dutyStatus]);

  // Notifications
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // Filter Pathology & Diagnostic Lab Queue
  const pathologyQueue = useMemo(() => {
    if (!Array.isArray(queueSnapshot)) return [];
    return queueSnapshot.filter((t) => {
      const dept = (t.department || "").toLowerCase();
      const cat = (t.service_category || "").toLowerCase();
      const med = (t.medical_condition || "").toLowerCase();
      const transFrom = (t.transferred_from_dept || "").toLowerCase();

      return (
        dept.includes("path") ||
        dept.includes("lab") ||
        cat.includes("path") ||
        cat.includes("lab") ||
        med.includes("path") ||
        med.includes("lab") ||
        transFrom.includes("path") ||
        transFrom.includes("lab") ||
        (t.prescription_notes && typeof t.prescription_notes === "string" && t.prescription_notes.includes("lab_tests"))
      );
    });
  }, [queueSnapshot]);

  // Active Serving Lab Ticket
  const activeServingTicket = useMemo(() => {
    if (Array.isArray(servingTickets) && servingTickets.length > 0) {
      const match = servingTickets.find((t) => {
        const dept = (t.department || "").toLowerCase();
        const cat = (t.service_category || "").toLowerCase();
        return dept.includes("path") || dept.includes("lab") || cat.includes("path") || cat.includes("lab");
      });
      if (match) return match;
      return servingTickets[0];
    }
    return null;
  }, [servingTickets]);

  // Selected Panel & Parameter List
  const [selectedPanelKey, setSelectedPanelKey] = useState("cbc");
  const [specimenType, setSpecimenType] = useState(DEFAULT_TEST_PANELS.cbc.specimen);
  const [collectionTime, setCollectionTime] = useState(() => new Date().toISOString());
  const [specimenCondition, setSpecimenCondition] = useState("Adequate / Free of Hemolysis");
  const [labAccessionNo, setLabAccessionNo] = useState(() => `LAB-${Date.now().toString().slice(-6)}`);
  const [testParameters, setTestParameters] = useState(() => [...DEFAULT_TEST_PANELS.cbc.parameters]);
  const [pathologistRemarks, setPathologistRemarks] = useState("Specimen collected and processed under standard laboratory protocols. Biological reference intervals correlated.");
  const [reportStatus, setReportStatus] = useState("Verified & Final");
  const [pathologistName, setPathologistName] = useState(() => currentUser?.name || currentUser?.username || "Dr. S. Mehta, MD (Pathology)");
  const [technicianName, setTechnicianName] = useState("Senior Lab Technologist");

  // Load Panel Template
  const handleLoadPanel = useCallback((panelKey) => {
    setSelectedPanelKey(panelKey);
    const panel = DEFAULT_TEST_PANELS[panelKey];
    if (panel) {
      setSpecimenType(panel.specimen);
      setTestParameters([...panel.parameters]);
      showToast(isHi ? `${panel.name} टेम्पलेट लोड किया गया` : `Loaded ${panel.name} panel`, "info");
    }
  }, [isHi, showToast]);

  // Auto-flag calculate on value edit
  const handleParameterChange = (index, field, value) => {
    setTestParameters((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      if (field === "value") {
        const num = parseFloat(value);
        if (!isNaN(num) && target.min !== null && target.max !== null && target.min !== undefined && target.max !== undefined) {
          if (num > target.max) {
            target.flag = "HIGH";
          } else if (num < target.min) {
            target.flag = "LOW";
          } else {
            target.flag = "NORMAL";
          }
        }
      }

      next[index] = target;
      return next;
    });
  };

  const handleAddCustomParameter = () => {
    setTestParameters((prev) => [
      ...prev,
      {
        parameter: "Custom Assay Parameter",
        value: "",
        unit: "mg/dL",
        ref_range: "Normal",
        min: null,
        max: null,
        flag: "NORMAL"
      }
    ]);
  };

  const handleRemoveParameter = (index) => {
    setTestParameters((prev) => prev.filter((_, i) => i !== index));
  };

  // Extract Referring Doctor and Doctor's Lab Test Requests from Active Ticket
  const parsedDoctorRx = useMemo(() => {
    if (!activeServingTicket || !activeServingTicket.prescription_notes) return null;
    try {
      let str = activeServingTicket.prescription_notes;
      if (typeof str === "object") return str;
      while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        str = str.slice(1, -1).trim();
      }
      return JSON.parse(str);
    } catch (_) {
      return { advice: activeServingTicket.prescription_notes };
    }
  }, [activeServingTicket]);

  // When active ticket changes, auto-detect requested lab test from doctor
  useEffect(() => {
    if (parsedDoctorRx && parsedDoctorRx.lab_tests) {
      const req = String(parsedDoctorRx.lab_tests).toLowerCase();
      if (req.includes("cbc") || req.includes("blood count")) {
        handleLoadPanel("cbc");
      } else if (req.includes("sugar") || req.includes("glucose") || req.includes("hba1c") || req.includes("fbs")) {
        handleLoadPanel("glucose");
      } else if (req.includes("lipid") || req.includes("cholesterol")) {
        handleLoadPanel("lipid");
      } else if (req.includes("kft") || req.includes("kidney") || req.includes("creatinine")) {
        handleLoadPanel("kft");
      } else if (req.includes("lft") || req.includes("liver") || req.includes("bilirubin")) {
        handleLoadPanel("lft");
      } else if (req.includes("thyroid") || req.includes("tsh")) {
        handleLoadPanel("thyroid");
      } else if (req.includes("urine")) {
        handleLoadPanel("urine");
      }
    }
  }, [parsedDoctorRx, handleLoadPanel]);

  // Call Next Patient
  const handleCallNext = () => {
    if (socketRef?.current) {
      socketRef.current.emit("serve_next", {
        tenant_id: effectiveHospitalCode,
        department: "pathology",
        service_category: "pathology",
        doctor_id: currentUser?.id,
        doctor_name: activeCounter,
        doctor_email: currentUser?.email,
      });
      showToast(isHi ? "अगले पैथोलॉजी मरीज़ को पुकारा जा रहा है..." : "Calling next pathology patient...", "info");
      if (refreshData) refreshData();
    }
  };

  // Re-announce / Recall Active Patient
  const handleRecall = () => {
    if (!activeServingTicket) return;
    if (socketRef?.current) {
      socketRef.current.emit("recall_ticket", {
        tenant_id: effectiveHospitalCode,
        ticket_id: activeServingTicket.ticket_id,
        doctor_name: activeCounter,
      });
    }
    announceTicketVoice(activeServingTicket, language);
    showToast(
      isHi
        ? `टोकन #${activeServingTicket.ticket_id} को पुनः उद्घोषित किया गया!`
        : `Token #${activeServingTicket.ticket_id} re-announced!`,
      "info"
    );
  };

  // Hold Ticket (10-min Grace Period)
  const handleHold = () => {
    if (!activeServingTicket) return;
    if (socketRef?.current) {
      socketRef.current.emit("hold_ticket", {
        tenant_id: effectiveHospitalCode,
        ticket_id: activeServingTicket.ticket_id,
        grace_minutes: 10,
      });
      showToast(
        isHi
          ? `टोकन #${activeServingTicket.ticket_id} को 10 मिनट होल्ड पर रखा गया।`
          : `Token #${activeServingTicket.ticket_id} placed on 10-minute hold.`,
        "warn"
      );
      if (refreshData) refreshData();
    }
  };

  // Mark No-Show
  const handleNoShow = () => {
    if (!activeServingTicket) return;
    if (socketRef?.current) {
      socketRef.current.emit("mark_noshow", {
        tenant_id: effectiveHospitalCode,
        ticket_id: activeServingTicket.ticket_id,
        reason: "Patient did not appear for specimen collection",
      });
      showToast(
        isHi
          ? `टोकन #${activeServingTicket.ticket_id} को अनुपस्थित (No-Show) चिह्नित किया गया।`
          : `Token #${activeServingTicket.ticket_id} marked as no-show.`,
        "error"
      );
      if (refreshData) refreshData();
    }
  };

  // Build Diagnostic Report Payload
  const buildReportPayload = () => {
    const panel = DEFAULT_TEST_PANELS[selectedPanelKey] || { name: "Clinical Pathology Investigation" };
    return {
      test_panel_name: panel.name,
      specimen_type: specimenType,
      collection_time: collectionTime,
      specimen_condition: specimenCondition,
      lab_accession_no: labAccessionNo,
      verified_at: new Date().toISOString(),
      pathologist_name: pathologistName,
      technician_name: technicianName,
      results: testParameters,
      remarks: pathologistRemarks,
      status: reportStatus,
    };
  };

  // Save Draft to Backend
  const handleSaveReportDraft = async () => {
    if (!activeServingTicket) {
      showToast(isHi ? "सहेजने के लिए कोई सक्रिय मरीज़ नहीं है" : "No active patient to save report for", "warn");
      return;
    }

    try {
      const reportPayload = buildReportPayload();
      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        lab_report: reportPayload,
      };

      const res = await fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          prescription: mergedNotes,
        }),
      });

      if (res.ok) {
        showToast(isHi ? "जांच रिपोर्ट सफलतापूर्वक सहेजी गई ✓" : "Diagnostic report saved successfully ✓", "success");
        if (refreshData) refreshData();
      } else {
        throw new Error("Failed to save report");
      }
    } catch (e) {
      showToast(isHi ? "रिपोर्ट सहेजने में त्रुटि" : "Error saving diagnostic report", "error");
    }
  };

  // Print Official Diagnostic Report Slip
  const handlePrintReport = () => {
    if (!activeServingTicket) return;
    const reportPayload = buildReportPayload();
    const fullReportData = {
      ...reportPayload,
      patient_name: activeServingTicket.name,
      age: activeServingTicket.age || 30,
      gender: activeServingTicket.gender || "M",
      phone: activeServingTicket.phone || "",
      ticket_id: activeServingTicket.ticket_id,
      referring_doctor: parsedDoctorRx?.doctor_name || "OPD Consultant",
      clinical_diagnosis: parsedDoctorRx?.diagnosis || activeServingTicket.medical_condition || "Clinical Assessment",
      hospital_name: brandName,
    };

    printLabReportSlip(fullReportData, language, hospitalBranding);
  };

  // Complete and Route Back to Referring Doctor
  const handleCompleteAndRouteToDoctor = async () => {
    if (!activeServingTicket) return;

    try {
      const reportPayload = buildReportPayload();
      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        lab_report: reportPayload,
        lab_completed_at: new Date().toISOString(),
      };

      const targetDept = parsedDoctorRx?.doctor_department || activeServingTicket.transferred_from_dept || "consultation";

      const res = await fetch(`${API_BASE}/api/v1/plugin/transfer-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          target_department: targetDept,
          prescription_notes: JSON.stringify(mergedNotes),
        }),
      });

      if (res.ok) {
        showToast(
          isHi
            ? `जांच पूर्ण! मरीज़ को परिणाम सहित डॉ. के पास वापस स्थानांतरित किया गया ✓`
            : `Testing complete! Patient routed back to Doctor with report ✓`,
          "success"
        );
        if (refreshData) refreshData();
      } else {
        throw new Error("Failed to route ticket");
      }
    } catch (e) {
      showToast(isHi ? "स्थानांतरण में त्रुटि" : "Error routing patient back to doctor", "error");
    }
  };

  // Complete and Discharge Directly
  const handleCompleteAndDischarge = async () => {
    if (!activeServingTicket) return;

    try {
      const reportPayload = buildReportPayload();
      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        lab_report: reportPayload,
        lab_completed_at: new Date().toISOString(),
      };

      if (socketRef?.current) {
        socketRef.current.emit("complete_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          department: "pathology",
          prescription_notes: mergedNotes,
        });
      }

      showToast(
        isHi
          ? `टोकन #${activeServingTicket.ticket_id} की जांच पूर्ण एवं डिस्चार्ज सफल ✓`
          : `Token #${activeServingTicket.ticket_id} test completed & discharged ✓`,
        "success"
      );
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? "डिस्चार्ज में त्रुटि" : "Error completing ticket", "error");
    }
  };

  // Historical Records & Date Filtering
  const [historyDateFilter, setHistoryDateFilter] = useState("today"); // "today" | "yesterday" | "date" | "all"
  const [customFilterDate, setCustomFilterDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historicalReports, setHistoricalReports] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistoricalReports = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/patient-history?hospital_id=${effectiveHospitalCode}`);
      const data = await res.json();
      if (data && Array.isArray(data.visits)) {
        setHistoricalReports(data.visits);
      } else {
        // Fallback or empty
        setHistoricalReports([]);
      }
    } catch (e) {
      console.log("History fetch error:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [effectiveHospitalCode]);

  useEffect(() => {
    if (activeTab === "history" || activeTab === "archive") {
      fetchHistoricalReports();
    }
  }, [activeTab, fetchHistoricalReports]);

  // Filtered Historical Records
  const filteredHistory = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = yestDate.toISOString().split("T")[0];

    return historicalReports.filter((item) => {
      const itemDate = item.created_at ? item.created_at.split("T")[0] : "";
      if (historyDateFilter === "today" && itemDate !== todayStr) return false;
      if (historyDateFilter === "yesterday" && itemDate !== yestStr) return false;
      if (historyDateFilter === "date" && itemDate !== customFilterDate) return false;

      if (historySearchTerm) {
        const q = historySearchTerm.toLowerCase();
        const name = (item.patient_name || item.name || "").toLowerCase();
        const tid = String(item.ticket_id || "").toLowerCase();
        const phone = String(item.phone || "");
        if (!name.includes(q) && !tid.includes(q) && !phone.includes(q)) return false;
      }

      return true;
    });
  }, [historicalReports, historyDateFilter, customFilterDate, historySearchTerm]);

  // Excel Export
  const handleExportExcel = () => {
    if (filteredHistory.length === 0) {
      showToast(isHi ? "निर्यात करने हेतु कोई डेटा उपलब्ध नहीं" : "No records to export", "warn");
      return;
    }

    const rows = filteredHistory.map((item, idx) => ({
      "S.No": idx + 1,
      "Date": item.created_at ? new Date(item.created_at).toLocaleDateString() : "",
      "Token ID": item.ticket_id || "",
      "Patient Name": item.patient_name || item.name || "",
      "Age / Gender": `${item.age || "-"} / ${item.gender || "-"}`,
      "Contact": item.phone || "",
      "Test / Condition": item.medical_condition || item.service_category || "Diagnostic Assay",
      "Status": item.status || "Completed"
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lab_Records");
    XLSX.writeFile(wb, `Pathology_Records_${historyDateFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(isHi ? "एक्सेल स्प्रेडशीट डाउनलोड हो गई ✓" : "Excel spreadsheet exported successfully ✓", "success");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isDark ? "#090D16" : "#F8FAFC",
        color: isDark ? "#F1F5F9" : "#0F172A",
        padding: "16px 20px 40px 20px",
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 18px",
            borderRadius: "10px",
            background:
              toast.type === "error"
                ? "#EF4444"
                : toast.type === "warn"
                ? "#F59E0B"
                : toast.type === "info"
                ? brandPrimary
                : "#10B981",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "13px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Pathology Station Header */}
      <div
        style={{
          background: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
          border: isDark ? "1px solid rgba(51, 65, 85, 0.8)" : "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "16px 20px",
          marginBottom: "18px",
          boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.03)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
              color: brandPrimary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FlaskConical size={26} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 900, letterSpacing: "-0.3px" }}>
                {isHi ? "पैथोलॉजी एवं डायग्नोस्टिक प्रयोगशाला पोर्टल" : "Pathology & Diagnostic Laboratory Portal"}
              </h1>
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: "9999px",
                  background: isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5",
                  color: "#059669",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                NABL LIS ACCREDITED
              </span>
            </div>
            <div style={{ fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B", marginTop: "3px" }}>
              {brandName} • {isHi ? "स्वचालित बायोकेमिस्ट्री, हेमेटोलॉजी एवं क्लिनिकल परीक्षण" : "Automated Biochemistry, Hematology & Clinical Assays"}
            </div>
          </div>
        </div>

        {/* Counter Picker & Duty Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#CBD5E1" : "#475569" }}>
              {isHi ? "काउंटर:" : "Counter:"}
            </span>
            <select
              value={activeCounter}
              onChange={(e) => setActiveCounter(e.target.value)}
              style={{
                background: isDark ? "#0F172A" : "#F1F5F9",
                color: isDark ? "#F8FAFC" : "#0F172A",
                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 700,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="Pathology Lab - 1">Pathology Lab - 1 (Hematology / CBC)</option>
              <option value="Pathology Lab - 2">Pathology Lab - 2 (Biochemistry & Sugar)</option>
              <option value="Pathology Lab - 3">Pathology Lab - 3 (Clinical Pathology)</option>
              <option value="Sample Collection - 1">Sample Collection Desk - 1</option>
              <option value="Central Lab Processing">Central Diagnostic Processing</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#CBD5E1" : "#475569" }}>
              {isHi ? "ड्यूटी स्थिति:" : "Duty:"}
            </span>
            <select
              value={dutyStatus}
              onChange={(e) => setDutyStatus(e.target.value)}
              style={{
                background:
                  dutyStatus === "ACTIVE"
                    ? isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5"
                    : dutyStatus === "BREAK"
                    ? isDark ? "rgba(245, 158, 11, 0.2)" : "#FFFBEB"
                    : isDark ? "rgba(239, 68, 68, 0.2)" : "#FEF2F2",
                color:
                  dutyStatus === "ACTIVE"
                    ? "#059669"
                    : dutyStatus === "BREAK"
                    ? "#D97706"
                    : "#DC2626",
                border: "1px solid currentColor",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 800,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="ACTIVE">{isHi ? "सक्रिय (जांच हेतु तैयार)" : "Active (Ready to Test)"}</option>
              <option value="PROCESSING">{isHi ? "नमूना प्रसंस्करण में" : "Processing Samples"}</option>
              <option value="BREAK">{isHi ? "चाय / भोजन अवकाश" : "On Break"}</option>
              <option value="OFF_DUTY">{isHi ? "ड्यूटी समाप्त" : "Off Duty"}</option>
            </select>
          </div>

          {/* Quick Refresh */}
          <button
            type="button"
            onClick={() => {
              if (refreshData) refreshData();
              showToast(isHi ? "कतार डेटा रीफ्रेश हुआ" : "Queue refreshed", "info");
            }}
            style={{
              background: isDark ? "#1E293B" : "#F1F5F9",
              border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
              color: isDark ? "#CBD5E1" : "#475569",
              padding: "7px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 700,
            }}
            title="Refresh"
          >
            <RefreshCw size={14} />
            <span>{isHi ? "रीफ्रेश" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            background: isDark ? "rgba(30, 41, 59, 0.5)" : "#FFFFFF",
            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase" }}>
              {isHi ? "कतार में प्रतीक्षारत" : "Waiting in Queue"}
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: brandPrimary, marginTop: "2px" }}>
              {pathologyQueue.length}
            </div>
          </div>
          <Clock size={24} style={{ color: brandPrimary, opacity: 0.8 }} />
        </div>

        <div
          style={{
            background: isDark ? "rgba(30, 41, 59, 0.5)" : "#FFFFFF",
            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase" }}>
              {isHi ? "सक्रिय जांच जारी" : "Active In-Testing"}
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "#10B981", marginTop: "2px" }}>
              {activeServingTicket ? "1" : "0"}
            </div>
          </div>
          <Activity size={24} style={{ color: "#10B981", opacity: 0.8 }} />
        </div>

        <div
          style={{
            background: isDark ? "rgba(30, 41, 59, 0.5)" : "#FFFFFF",
            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase" }}>
              {isHi ? "आज सत्यापित रिपोर्ट" : "Verified Today"}
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "#6366F1", marginTop: "2px" }}>
              {historicalReports.length}
            </div>
          </div>
          <CheckCircle2 size={24} style={{ color: "#6366F1", opacity: 0.8 }} />
        </div>

        <div
          style={{
            background: isDark ? "rgba(30, 41, 59, 0.5)" : "#FFFFFF",
            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase" }}>
              {isHi ? "औसत टर्नअराउंड समय" : "Avg Turnaround Time"}
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "#D97706", marginTop: "2px" }}>
              15 <span style={{ fontSize: "13px", fontWeight: 600 }}>min</span>
            </div>
          </div>
          <Sliders size={24} style={{ color: "#D97706", opacity: 0.8 }} />
        </div>
      </div>

      {/* Tab Navigation Navigation */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
          marginBottom: "20px",
          paddingBottom: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("workstation")}
          style={{
            padding: "8px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 800,
            cursor: "pointer",
            border: activeTab === "workstation" ? `1.5px solid ${brandPrimary}` : "1.5px solid transparent",
            background: activeTab === "workstation" ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE") : "transparent",
            color: activeTab === "workstation" ? brandPrimary : isDark ? "#94A3B8" : "#64748B",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <Microscope size={16} />
          <span>{isHi ? "डायग्नोस्टिक वर्कस्टेशन (लाइव जांच)" : "Diagnostic Workstation"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("archive")}
          style={{
            padding: "8px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 800,
            cursor: "pointer",
            border: activeTab === "archive" ? `1.5px solid ${brandPrimary}` : "1.5px solid transparent",
            background: activeTab === "archive" ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE") : "transparent",
            color: activeTab === "archive" ? brandPrimary : isDark ? "#94A3B8" : "#64748B",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <Search size={16} />
          <span>{isHi ? "लैब रिपोर्ट खोज एवं अभिलेखागार" : "Lab Reports Archive"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          style={{
            padding: "8px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 800,
            cursor: "pointer",
            border: activeTab === "history" ? `1.5px solid ${brandPrimary}` : "1.5px solid transparent",
            background: activeTab === "history" ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE") : "transparent",
            color: activeTab === "history" ? brandPrimary : isDark ? "#94A3B8" : "#64748B",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <History size={16} />
          <span>{isHi ? "मरीज़ परीक्षण इतिहास (दिनांक वार)" : "Patient Test History"}</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: DIAGNOSTIC WORKSTATION (ACTIVE TEST EXECUTION)
         ======================================================== */}
      {activeTab === "workstation" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
          {/* Main Left Execution Workspace */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Active Serving Patient Card */}
            {activeServingTicket ? (
              <div
                style={{
                  background: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
                  border: isDark ? "1.5px solid #0284C7" : "1.5px solid #BAE6FD",
                  borderRadius: "14px",
                  padding: "18px",
                  boxShadow: "0 6px 24px rgba(2, 132, 199, 0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: 900,
                          color: isDark ? "#F8FAFC" : "#0F172A",
                        }}
                      >
                        {activeServingTicket.name}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                          color: brandPrimary,
                          fontFamily: "monospace",
                        }}
                      >
                        #{activeServingTicket.ticket_id}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          background: activeServingTicket.priority_level === 1 ? "#FEE2E2" : "#ECFDF5",
                          color: activeServingTicket.priority_level === 1 ? "#DC2626" : "#059669",
                        }}
                      >
                        {activeServingTicket.priority_level === 1 ? "EMERGENCY PRIORITY" : "STANDARD"}
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B", marginTop: "4px" }}>
                      {activeServingTicket.age || 30} {isHi ? "वर्ष" : "Yrs"} • {String(activeServingTicket.gender || "M").toUpperCase()} •{" "}
                      {activeServingTicket.phone || "N/A"}
                    </div>
                  </div>

                  {/* Desk Serving Action Controls */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleRecall}
                      style={{
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: isDark ? "#CBD5E1" : "#475569",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isHi ? "पुनः उद्घोषणा (Recall)" : "Re-announce"}
                    </button>
                    <button
                      type="button"
                      onClick={handleHold}
                      style={{
                        background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
                        border: "1px solid #F59E0B",
                        color: "#D97706",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isHi ? "होल्ड (10 मिनट)" : "Hold (10m)"}
                    </button>
                    <button
                      type="button"
                      onClick={handleNoShow}
                      style={{
                        background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
                        border: "1px solid #EF4444",
                        color: "#DC2626",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isHi ? "अनुपस्थित (No-Show)" : "No-Show"}
                    </button>
                  </div>
                </div>

                {/* Doctor Referral Context Box */}
                {parsedDoctorRx && (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: isDark ? "rgba(15, 23, 42, 0.6)" : "#F8FAFC",
                      border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                      <div>
                        <strong style={{ color: brandPrimary }}>{isHi ? "परामर्शदाता डॉक्टर:" : "Referring Doctor:"}</strong>{" "}
                        {parsedDoctorRx.doctor_name || "OPD Doctor"} (
                        {parsedDoctorRx.doctor_department || activeServingTicket.transferred_from_dept || "General Medicine"})
                      </div>
                      <div>
                        <strong>{isHi ? "क्लिनिकल निदान:" : "Diagnosis:"}</strong> {parsedDoctorRx.diagnosis || "Clinical Assessment"}
                      </div>
                    </div>
                    {parsedDoctorRx.lab_tests && (
                      <div style={{ marginTop: "6px", color: isDark ? "#38BDF8" : "#0284C7", fontWeight: 700 }}>
                        {isHi ? "डॉक्टर द्वारा निर्धारित जांचें:" : "Prescribed Lab Investigations:"} {parsedDoctorRx.lab_tests}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: isDark ? "rgba(30, 41, 59, 0.4)" : "#FFFFFF",
                  border: isDark ? "1.5px dashed #334155" : "1.5px dashed #CBD5E1",
                  borderRadius: "14px",
                  padding: "32px 20px",
                  textAlign: "center",
                }}
              >
                <FlaskConical size={36} style={{ color: brandPrimary, opacity: 0.6, margin: "0 auto 8px auto" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                  {isHi ? "वर्तमान में कोई सक्रिय जांच चयनित नहीं है" : "No Active Lab Patient Serving"}
                </h3>
                <p style={{ margin: "6px 0 16px 0", fontSize: "12.5px", color: isDark ? "#94A3B8" : "#64748B" }}>
                  {isHi
                    ? "कतार से अगले मरीज़ को बुलाने के लिए नीचे दिए गए बटन पर क्लिक करें।"
                    : "Click below to call the next patient from the laboratory waiting stream."}
                </p>
                <button
                  type="button"
                  onClick={handleCallNext}
                  style={{
                    background: brandPrimary,
                    color: "#FFFFFF",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <ArrowRight size={16} />
                  <span>{isHi ? "अगला मरीज़ बुलाएं (Call Next)" : "Call Next Patient"}</span>
                </button>
              </div>
            )}

            {/* Specimen Collection Audit Card */}
            <div
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
                border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                  <TestTube size={18} style={{ color: brandPrimary }} />
                  <span>{isHi ? "नमूना संकलन विवरण (Specimen Audit)" : "Specimen Collection Audit"}</span>
                </h3>
                <span style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>
                  Accession #{labAccessionNo}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "12px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "4px", color: isDark ? "#CBD5E1" : "#475569" }}>
                    {isHi ? "नमूना प्रकार" : "Sample Type"}
                  </label>
                  <select
                    value={specimenType}
                    onChange={(e) => setSpecimenType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "12px",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  >
                    <option value="Whole Blood (EDTA)">Whole Blood (EDTA Purple Top)</option>
                    <option value="Serum (Clot Activator Red Top)">Serum (Clot Activator Red Top)</option>
                    <option value="Fluoride Plasma (Glucose Grey Top)">Fluoride Plasma (Glucose Grey Top)</option>
                    <option value="Mid-stream Clean Catch Urine">Mid-stream Clean Catch Urine</option>
                    <option value="Nasopharyngeal Swab">Nasopharyngeal Swab</option>
                    <option value="Sputum / Respiratory Sample">Sputum / Respiratory Sample</option>
                    <option value="Stool Specimen">Stool Specimen</option>
                    <option value="Body Fluid / Other">Body Fluid / Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "4px", color: isDark ? "#CBD5E1" : "#475569" }}>
                    {isHi ? "नमूना स्थिति / गुणवत्ता" : "Specimen Integrity"}
                  </label>
                  <select
                    value={specimenCondition}
                    onChange={(e) => setSpecimenCondition(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "12px",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  >
                    <option value="Adequate / Free of Hemolysis">Adequate / Free of Hemolysis</option>
                    <option value="Mild Hemolysis (Documented)">Mild Hemolysis (Documented)</option>
                    <option value="Lipemic Specimen">Lipemic Specimen</option>
                    <option value="Fasting (10-12 hrs confirmed)">Fasting (10-12 hrs confirmed)</option>
                    <option value="Random / Post-Prandial">Random / Post-Prandial</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "4px", color: isDark ? "#CBD5E1" : "#475569" }}>
                    {isHi ? "संकलन समय" : "Collection Timestamp"}
                  </label>
                  <input
                    type="datetime-local"
                    value={collectionTime ? collectionTime.slice(0, 16) : ""}
                    onChange={(e) => setCollectionTime(new Date(e.target.value).toISOString())}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#F8FAFC",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      fontSize: "12px",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Structured Test Report Entry Form */}
            <div
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
                border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "18px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px" }}>
                    <Activity size={18} style={{ color: brandPrimary }} />
                    <span>{isHi ? "जांच रिपोर्ट विवरण प्रविष्टि (Diagnostic Parameters Entry)" : "Diagnostic Test Report Parameters Entry"}</span>
                  </h3>
                  <div style={{ fontSize: "11.5px", color: isDark ? "#94A3B8" : "#64748B", marginTop: "2px" }}>
                    {isHi
                      ? "मानक संदर्भ सीमाओं के साथ परिणाम दर्ज करें। असामान्य परिणाम स्वतः चिह्नित होंगे।"
                      : "Enter observed values with biological reference intervals. Out-of-range values auto-flag."}
                  </div>
                </div>

                {/* Predefined Panel Selectors */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {Object.keys(DEFAULT_TEST_PANELS).map((key) => {
                    const p = DEFAULT_TEST_PANELS[key];
                    const active = selectedPanelKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleLoadPanel(key)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          border: active ? `1.5px solid ${brandPrimary}` : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                          background: active ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : isDark ? "#1E293B" : "#F8FAFC",
                          color: active ? brandPrimary : isDark ? "#CBD5E1" : "#475569",
                        }}
                      >
                        {p.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Parameter Grid Table */}
              <div style={{ overflowX: "auto", marginBottom: "14px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: isDark ? "#0F172A" : "#F1F5F9", borderBottom: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>
                        {isHi ? "परीक्षण पैरामीटर" : "Investigation Parameter"}
                      </th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569", width: "130px" }}>
                        {isHi ? "परिणाम" : "Observed Result"}
                      </th>
                      <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569", width: "80px" }}>
                        {isHi ? "इकाई" : "Unit"}
                      </th>
                      <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569", width: "150px" }}>
                        {isHi ? "जैविक संदर्भ सीमा" : "Biological Ref. Interval"}
                      </th>
                      <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569", width: "100px" }}>
                        {isHi ? "स्थिति" : "Flag"}
                      </th>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {testParameters.map((row, idx) => {
                      const isHigh = row.flag === "HIGH";
                      const isLow = row.flag === "LOW";
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: isDark ? "1px solid rgba(51, 65, 85, 0.4)" : "1px solid #E2E8F0",
                            background: isHigh
                              ? isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2"
                              : isLow
                              ? isDark ? "rgba(59, 130, 246, 0.08)" : "#EFF6FF"
                              : "transparent",
                          }}
                        >
                          <td style={{ padding: "6px 10px" }}>
                            <input
                              type="text"
                              value={row.parameter}
                              onChange={(e) => handleParameterChange(idx, "parameter", e.target.value)}
                              style={{
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                color: isDark ? "#F8FAFC" : "#0F172A",
                                fontWeight: 700,
                                fontSize: "12px",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "right" }}>
                            <input
                              type="text"
                              value={row.value}
                              onChange={(e) => handleParameterChange(idx, "value", e.target.value)}
                              placeholder="0.0"
                              style={{
                                width: "100%",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: isHigh
                                  ? "1.5px solid #EF4444"
                                  : isLow
                                  ? "1.5px solid #3B82F6"
                                  : isDark
                                  ? "1px solid #334155"
                                  : "1px solid #CBD5E1",
                                background: isDark ? "#0F172A" : "#FFFFFF",
                                color: isHigh ? "#EF4444" : isLow ? "#3B82F6" : isDark ? "#F8FAFC" : "#0F172A",
                                fontWeight: 800,
                                fontSize: "12.5px",
                                textAlign: "right",
                                fontFamily: "monospace",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => handleParameterChange(idx, "unit", e.target.value)}
                              style={{
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                color: isDark ? "#94A3B8" : "#64748B",
                                fontSize: "11px",
                                textAlign: "center",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            <input
                              type="text"
                              value={row.ref_range}
                              onChange={(e) => handleParameterChange(idx, "ref_range", e.target.value)}
                              style={{
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                color: isDark ? "#CBD5E1" : "#475569",
                                fontSize: "11px",
                                textAlign: "center",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            <select
                              value={row.flag}
                              onChange={(e) => handleParameterChange(idx, "flag", e.target.value)}
                              style={{
                                padding: "2px 6px",
                                borderRadius: "6px",
                                fontSize: "10.5px",
                                fontWeight: 800,
                                border: "1px solid",
                                outline: "none",
                                cursor: "pointer",
                                borderColor: isHigh ? "#EF4444" : isLow ? "#3B82F6" : "#10B981",
                                background: isHigh
                                  ? isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2"
                                  : isLow
                                  ? isDark ? "rgba(59, 130, 246, 0.2)" : "#DBEAFE"
                                  : isDark ? "rgba(16, 185, 129, 0.2)" : "#D1FAE5",
                                color: isHigh ? "#DC2626" : isLow ? "#1D4ED8" : "#047857",
                              }}
                            >
                              <option value="NORMAL">NORMAL</option>
                              <option value="HIGH">HIGH ▲</option>
                              <option value="LOW">LOW ▼</option>
                              <option value="ABNORMAL">ABNORMAL</option>
                            </select>
                          </td>
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveParameter(idx)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: isDark ? "#64748B" : "#94A3B8",
                                cursor: "pointer",
                                padding: "2px",
                              }}
                              title="Delete row"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Custom Parameter Button */}
              <button
                type="button"
                onClick={handleAddCustomParameter}
                style={{
                  background: isDark ? "#1E293B" : "#F1F5F9",
                  border: isDark ? "1px dashed #334155" : "1px dashed #CBD5E1",
                  color: brandPrimary,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "16px",
                }}
              >
                <Plus size={14} />
                <span>{isHi ? "+ अन्य परीक्षण पैरामीटर जोड़ें" : "+ Add Custom Parameter Row"}</span>
              </button>

              {/* Pathologist Clinical Remarks & Observations */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 800, marginBottom: "5px", color: isDark ? "#CBD5E1" : "#334155" }}>
                  {isHi ? "पैथोलॉजिस्ट क्लिनिकल अभिमत एवं टिप्पणियां (Clinical Impression):" : "Pathologist Remarks & Clinical Impressions:"}
                </label>
                <textarea
                  rows={2}
                  value={pathologistRemarks}
                  onChange={(e) => setPathologistRemarks(e.target.value)}
                  placeholder={isHi ? "क्लिनिकल टिप्पणियाँ दर्ज करें..." : "Enter clinical impressions or morphologic observations..."}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#F8FAFC",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    fontSize: "12px",
                    fontWeight: 500,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Action Toolbar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  paddingTop: "12px",
                  borderTop: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                }}
              >
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleSaveReportDraft}
                    style={{
                      background: isDark ? "#1E293B" : "#F1F5F9",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FileCheck size={15} style={{ color: brandPrimary }} />
                    <span>{isHi ? "ड्राफ्ट सहेजें" : "Save Draft"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintReport}
                    style={{
                      background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                      border: `1.5px solid ${brandPrimary}`,
                      color: brandPrimary,
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Printer size={15} />
                    <span>{isHi ? "आधिकारिक रिपोर्ट प्रिंट करें" : "Print Official Report"}</span>
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleCompleteAndRouteToDoctor}
                    style={{
                      background: "#6366F1",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
                    }}
                  >
                    <Send size={14} />
                    <span>{isHi ? "पूर्ण करें एवं डॉक्टर को भेजें" : "Complete & Route to Doctor"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteAndDischarge}
                    style={{
                      background: "#10B981",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>{isHi ? "जांच पूर्ण एवं डिस्चार्ज" : "Complete & Discharge"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Laboratory Waiting Stream */}
          <div>
            <div
              style={{
                background: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
                border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "16px",
                position: "sticky",
                top: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Clock size={16} style={{ color: brandPrimary }} />
                  <span>{isHi ? "लाइव पैथोलॉजी कतार" : "Live Lab Queue"}</span>
                </h3>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                    color: brandPrimary,
                  }}
                >
                  {pathologyQueue.length} {isHi ? "मरीज़" : "Patients"}
                </span>
              </div>

              {pathologyQueue.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 10px", color: isDark ? "#64748B" : "#94A3B8" }}>
                  <CheckCircle2 size={28} style={{ opacity: 0.5, margin: "0 auto 6px auto" }} />
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>
                    {isHi ? "कतार में कोई मरीज़ प्रतीक्षारत नहीं है" : "No patients waiting in lab queue"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "580px", overflowY: "auto" }}>
                  {pathologyQueue.map((ticket) => {
                    const isServing = activeServingTicket && activeServingTicket.ticket_id === ticket.ticket_id;
                    return (
                      <div
                        key={ticket.ticket_id}
                        style={{
                          background: isServing
                            ? isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE"
                            : isDark ? "#0F172A" : "#F8FAFC",
                          border: isServing
                            ? `1.5px solid ${brandPrimary}`
                            : isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                          borderRadius: "10px",
                          padding: "10px 12px",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                                {ticket.name}
                              </span>
                              {ticket.priority_level === 1 && (
                                <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "4px", background: "#FEE2E2", color: "#DC2626" }}>
                                  EMERGENCY
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "11px", color: isDark ? "#94A3B8" : "#64748B", marginTop: "2px" }}>
                              #{ticket.ticket_id} • {ticket.age || 30}y / {ticket.gender || "M"}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isDark ? "#1E293B" : "#E2E8F0",
                              color: isDark ? "#CBD5E1" : "#475569",
                            }}
                          >
                            {ticket.status}
                          </span>
                        </div>

                        {ticket.transferred_from_dept && (
                          <div style={{ fontSize: "10.5px", color: brandPrimary, marginTop: "4px", fontWeight: 600 }}>
                            Ref: {ticket.transferred_from_dept}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: LAB REPORTS ARCHIVE & VERIFICATION SEARCH
         ======================================================== */}
      {activeTab === "archive" && (
        <div
          style={{
            background: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900 }}>
                {isHi ? "नैदानिक परीक्षण रिपोर्ट अभिलेखागार" : "Diagnostic Laboratory Reports Archive"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B" }}>
                {isHi ? "मरीज़ के नाम, टोकन नंबर या फ़ोन से रिपोर्ट खोजें एवं पुनः प्रिंट करें।" : "Lookup, verify and re-print historical patient lab slips."}
              </p>
            </div>

            <div style={{ position: "relative", width: "260px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "10px", color: isDark ? "#64748B" : "#94A3B8" }} />
              <input
                type="text"
                placeholder={isHi ? "नाम, टोकन या फ़ोन खोजें..." : "Search name, token or phone..."}
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: isDark ? "#0F172A" : "#F8FAFC",
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  fontSize: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: brandPrimary }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "13px", fontWeight: 600 }}>{isHi ? "रिपोर्ट्स लोड हो रही हैं..." : "Loading reports..."}</div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: isDark ? "#64748B" : "#94A3B8" }}>
              <FileText size={36} style={{ opacity: 0.4, margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "कोई रिपोर्ट नहीं मिली" : "No lab reports match your criteria"}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: isDark ? "#0F172A" : "#F1F5F9", borderBottom: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "दिनांक" : "Date"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "टोकन #" : "Token #"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "मरीज़ का नाम" : "Patient Name"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "आयु/लिंग" : "Age/Sex"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "जांच परीक्षण" : "Investigation"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800 }}>{isHi ? "स्थिति" : "Status"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800 }}>{isHi ? "कार्रवाई" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                      }}
                    >
                      <td style={{ padding: "8px 12px", color: isDark ? "#94A3B8" : "#64748B" }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recent"}
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 800, color: brandPrimary, fontFamily: "monospace" }}>
                        #{item.ticket_id || "-"}
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                        {item.patient_name || item.name || "Patient"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        {item.age || "-"}y / {item.gender || "-"}
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                        {item.medical_condition || item.service_category || "Diagnostic Investigation"}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: "#ECFDF5",
                            color: "#059669",
                          }}
                        >
                          VERIFIED
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => {
                            printLabReportSlip(
                              {
                                patient_name: item.patient_name || item.name,
                                age: item.age || 30,
                                gender: item.gender || "M",
                                phone: item.phone || "",
                                ticket_id: item.ticket_id,
                                test_panel_name: item.medical_condition || "Complete Blood Count (CBC)",
                                results: DEFAULT_TEST_PANELS.cbc.parameters,
                                hospital_name: brandName,
                              },
                              language,
                              hospitalBranding
                            );
                          }}
                          style={{
                            background: isDark ? "#1E293B" : "#F1F5F9",
                            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                            color: brandPrimary,
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Printer size={12} />
                          <span>{isHi ? "प्रिंट" : "Print"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 3: PATIENT LAB VISIT HISTORY (DATE FILTERING & EXPORT)
         ======================================================== */}
      {activeTab === "history" && (
        <div
          style={{
            background: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900 }}>
                {isHi ? "मरीज़ प्रयोगशाला परीक्षण इतिहास" : "Patient Laboratory Testing History"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B" }}>
                {isHi ? "दिनांक अनुसार फ़िल्टर करें और परीक्षण रिकॉर्ड्स एक्सेल में डाउनलोड करें।" : "Filter clinical records by date range and export to Excel spreadsheet."}
              </p>
            </div>

            {/* Date Filtering Pill Group */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setHistoryDateFilter("today")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyDateFilter === "today" ? `1.5px solid ${brandPrimary}` : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyDateFilter === "today" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyDateFilter === "today" ? brandPrimary : isDark ? "#94A3B8" : "#64748B",
                }}
              >
                {isHi ? "आज (Today)" : "Today"}
              </button>

              <button
                type="button"
                onClick={() => setHistoryDateFilter("yesterday")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyDateFilter === "yesterday" ? `1.5px solid ${brandPrimary}` : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyDateFilter === "yesterday" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyDateFilter === "yesterday" ? brandPrimary : isDark ? "#94A3B8" : "#64748B",
                }}
              >
                {isHi ? "कल (Yesterday)" : "Yesterday"}
              </button>

              <button
                type="button"
                onClick={() => setHistoryDateFilter("date")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyDateFilter === "date" ? `1.5px solid ${brandPrimary}` : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyDateFilter === "date" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyDateFilter === "date" ? brandPrimary : isDark ? "#94A3B8" : "#64748B",
                }}
              >
                {isHi ? "दिनांक चुनें" : "Select Date"}
              </button>

              {historyDateFilter === "date" && (
                <input
                  type="date"
                  value={customFilterDate}
                  onChange={(e) => setCustomFilterDate(e.target.value)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    fontSize: "12px",
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => setHistoryDateFilter("all")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyDateFilter === "all" ? `1.5px solid ${brandPrimary}` : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyDateFilter === "all" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyDateFilter === "all" ? brandPrimary : isDark ? "#94A3B8" : "#64748B",
                }}
              >
                {isHi ? "सभी दिनांक" : "All Dates"}
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  background: "#10B981",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  marginLeft: "6px",
                }}
              >
                <Download size={14} />
                <span>{isHi ? "Excel निर्यात" : "Export Excel"}</span>
              </button>
            </div>
          </div>

          {/* Historical Table */}
          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: isDark ? "#64748B" : "#94A3B8" }}>
              <History size={36} style={{ opacity: 0.4, margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "इस तिथि का कोई रिकॉर्ड नहीं मिला" : "No lab test records found for the selected date filter"}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: isDark ? "#0F172A" : "#F1F5F9", borderBottom: isDark ? "1px solid #334155" : "1.5px solid #CBD5E1" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>#</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "दिनांक व समय" : "Date & Time"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "टोकन #" : "Token #"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "मरीज़ का नाम" : "Patient Name"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "आयु/लिंग" : "Age/Sex"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>{isHi ? "परीक्षण" : "Investigation"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800 }}>{isHi ? "स्थिति" : "Status"}</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800 }}>{isHi ? "कार्रवाई" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                      }}
                    >
                      <td style={{ padding: "8px 12px", color: isDark ? "#64748B" : "#94A3B8" }}>{idx + 1}</td>
                      <td style={{ padding: "8px 12px", color: isDark ? "#94A3B8" : "#64748B" }}>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 800, color: brandPrimary, fontFamily: "monospace" }}>
                        #{item.ticket_id || "-"}
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                        {item.patient_name || item.name || "Patient"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        {item.age || "-"}y / {item.gender || "-"}
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                        {item.medical_condition || item.service_category || "Diagnostic Assay"}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: "9999px",
                            background: "#ECFDF5",
                            color: "#059669",
                          }}
                        >
                          COMPLETED
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => {
                            printLabReportSlip(
                              {
                                patient_name: item.patient_name || item.name,
                                age: item.age || 30,
                                gender: item.gender || "M",
                                phone: item.phone || "",
                                ticket_id: item.ticket_id,
                                test_panel_name: item.medical_condition || "Complete Blood Count (CBC)",
                                results: DEFAULT_TEST_PANELS.cbc.parameters,
                                hospital_name: brandName,
                              },
                              language,
                              hospitalBranding
                            );
                          }}
                          style={{
                            background: isDark ? "#1E293B" : "#F1F5F9",
                            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                            color: brandPrimary,
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Printer size={12} />
                          <span>{isHi ? "प्रिंट" : "Print"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <Footer language={language} hospitalBranding={hospitalBranding} theme={currentTheme} />
    </div>
  );
}
