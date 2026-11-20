/**
 * DoctorHistorySection.jsx
 * ------------------------
 * Dedicated Patient Consultation & OPD Visit History for General Consultation (OPD) Desk.
 * Allows attending doctors and clinical staff to:
 *  - Review past OPD consultation logs and clinical visits with live backend data
 *  - Filter by date range (Today, Yesterday, Last 7 Days, Select Date, All Dates)
 *  - Filter by Doctor (My Patients vs All OPD Doctors)
 *  - Filter by Status (Completed, In-Consultation, Cancelled/No-Show)
 *  - Search by patient name, token, phone, diagnosis, or medicine
 *  - View comprehensive prescription details (Diagnosis, Medicines, Lab Tests, Clinical Advice, Follow-up)
 *  - Reprint Rx Slip or download prescription PDF
 *  - "Use as Template / Re-prescribe" for currently active patient
 *  - Export filtered records to Excel / CSV
 *
 * Strictly matches the Doctor Portal theme, visual hierarchy, and layout standards.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  History,
  Calendar,
  Search,
  RefreshCw,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Clock,
  Building2,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  FileText,
  BadgeCheck,
  Tag,
  ArrowRight,
  Pill,
  Activity,
  Copy,
  Check,
  X,
  FileSpreadsheet,
  AlertTriangle
} from "lucide-react";
import { API_BASE } from "../../config/hospitalConfig";
import { apiFetch } from "../../utils/apiFetch";
import { printPrescriptionSlip, downloadPrescriptionPDF } from "../../utils/printPassHelper";
import { formatCleanText, cleanAdviceText } from "../../utils/i18n";

/**
 * Extracts the JSON object for a named block from a multi-block prescription_notes string.
 * Uses brace-counting so nested objects don't confuse the parser.
 * Format: "[Block Name]: { ... } [Other Block]: { ... }"
 */
function parseBalancedJson(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return { jsonStr: text.slice(startIndex, i + 1), endIndex: i };
      }
    }
  }
  return null;
}

function extractJsonBlock(text, preferredKeywords) {
  if (!text) return null;
  const labelPattern = /\[([^\]]+)\]:\s*\{/g;
  const blocks = [];
  let m;
  while ((m = labelPattern.exec(text)) !== null) {
    const label = m[1].trim();
    const start = m.index + m[0].length - 1;
    const balanced = parseBalancedJson(text, start);
    if (balanced) {
      try {
        const parsed = JSON.parse(balanced.jsonStr);
        blocks.push({ label, parsed });
      } catch (_) {}
      labelPattern.lastIndex = balanced.endIndex + 1;
    }
  }
  if (blocks.length === 0) {
    const firstBrace = text.indexOf("{");
    if (firstBrace !== -1) {
      const balanced = parseBalancedJson(text, firstBrace);
      if (balanced) {
        try {
          return JSON.parse(balanced.jsonStr);
        } catch (_) {}
      }
    }
    return null;
  }

  const keywords = preferredKeywords || ["consult", "opd", "general", "emerg", "triage"];
  for (const kw of keywords) {
    const hit = blocks.find((b) => b.label.toLowerCase().includes(kw));
    if (hit) return hit.parsed;
  }
  return blocks[0].parsed;
}

/**
 * Extracts and normalizes clinical details from ticket prescription_notes.
 * Handles: plain object, plain JSON string, single-quoted JSON, and multi-block strings.
 */
function extractConsultationDetails(ticket) {
  let notesObj = null;
  const raw = ticket?.prescription_notes || ticket?.notes;

  if (raw) {
    if (typeof raw === "object") {
      notesObj = raw;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();

      // 1. Try direct JSON parse (plain JSON or double-quoted wrapper)
      try {
        let clean = trimmed;
        while (
          (clean.startsWith('"') && clean.endsWith('"')) ||
          (clean.startsWith("'") && clean.endsWith("'"))
        ) {
          clean = clean.slice(1, -1).trim();
        }
        notesObj = JSON.parse(clean);
      } catch (_) {
        // 2. Try multi-block format: "[Label]: { … } [Label2]: { … }"
        notesObj = extractJsonBlock(trimmed, ["consult", "opd", "general", "emerg", "triage"]);
      }
    }
  }

  const rawDiag =
    notesObj?.diagnosis ||
    ticket?.medical_condition ||
    ticket?.diagnosis ||
    "General Clinical Consultation";
  const diagnosis = formatCleanText ? formatCleanText(rawDiag) : rawDiag.replace(/_/g, " ");

  let medicines = [];
  if (Array.isArray(notesObj?.medicines)) {
    medicines = notesObj.medicines;
  } else if (notesObj?.medicines && typeof notesObj.medicines === "string") {
    medicines = [{ name: notesObj.medicines, dosage: "", frequency: "", duration: "" }];
  }

  const labTests = notesObj?.lab_tests || ticket?.test_panel_name || "";
  
  // Doctor advice: strictly prevent raw JSON string leaking
  let rawAdvice = notesObj?.advice || "";
  if (!rawAdvice && typeof raw === "string") {
    const trimmedRaw = raw.trim();
    if (!trimmedRaw.startsWith("{") && !trimmedRaw.startsWith("[") && !trimmedRaw.includes('"doctor_name"') && !trimmedRaw.includes('":')) {
      rawAdvice = trimmedRaw;
    }
  }
  const advice = cleanAdviceText ? cleanAdviceText(rawAdvice) : rawAdvice;
  const followUp = notesObj?.follow_up || "";

  const patientNameRaw = String(ticket?.patient_name || ticket?.name || "").trim().toLowerCase();

  let rawDoc =
    notesObj?.doctor_name ||
    ticket?.served_by_doctor_name ||
    ticket?.served_by ||
    ticket?.doctor_name;

  if (!rawDoc && Array.isArray(ticket?.transfer_stages)) {
    const consultStage = ticket.transfer_stages.find((s) => {
      const c = String(s.dept_code || s.department || "").toLowerCase();
      return c.includes("consult") || c.includes("opd");
    });
    if (consultStage?.served_by) {
      rawDoc = consultStage.served_by;
    }
  }

  // Safety check: Doctor cannot have the exact same name as the patient!
  if (rawDoc && patientNameRaw) {
    const normPatient = patientNameRaw.replace(/^(mr|mrs|ms|dr|master|shri|smt)\.?\s+/i, "").replace(/[^a-z0-9]/gi, "");
    const normDoc = String(rawDoc).replace(/^(mr|mrs|ms|dr|master|shri|smt)\.?\s+/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normDoc && normPatient && (normDoc === normPatient || (normDoc.length > 3 && normPatient.includes(normDoc)))) {
      rawDoc = null;
    }
  }

  const doctorName = rawDoc ? (formatCleanText ? formatCleanText(rawDoc) : rawDoc) : "Attending Consultant";

  const doctorDept =
    notesObj?.doctor_department ||
    ticket?.departments?.name ||
    ticket?.department ||
    ticket?.service_category ||
    "General Consultation (OPD)";

  return {
    notesObj,
    diagnosis,
    medicines,
    labTests,
    advice,
    followUp,
    doctorName,
    doctorDept,
    hasRx: Boolean(notesObj || medicines.length > 0 || labTests || advice),
  };
}

export default function DoctorHistorySection({
  hospitalCode,
  currentUser,
  assignedDesk = null,
  isEmergencyDesk = false,
  theme = "light",
  language = "en",
  isDark = false,
  hospitalBranding = null,
  onCountChange = null,
  onPrintPrescription = null,
  onUsePreviousPrescription = null,
}) {
  const isHi = language === "hi";

  // Data & Fetch State
  const [historyVisits, setHistoryVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Filter States
  const [dateFilter, setDateFilter] = useState("all"); // "today" | "yesterday" | "7days" | "date" | "all"
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [scopeFilter, setScopeFilter] = useState("all"); // "all" | "my"
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "completed" | "serving" | "cancelled"
  const [rxOnlyFilter, setRxOnlyFilter] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal State for Inspection
  const [inspectedVisit, setInspectedVisit] = useState(null);

  // Colors matching Doctor Portal Theme
  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const cardBorder = isDark ? "1px solid #334155" : "1px solid #E2E8F0";
  const subBg = isDark ? "#0F172A" : "#F8FAFC";
  const subBorder = isDark ? "1px solid #1E293B" : "1px solid #F1F5F9";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";
  const brandPrimary = "#0284C7";

  // 1. Fetch Hospital Visits
  const fetchVisits = useCallback(async () => {
    if (!hospitalCode) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const response = await apiFetch(`${API_BASE}/api/v1/hospitals/${encodeURIComponent(hospitalCode)}/visits?limit=1000`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setErrorMsg(isHi ? "अनुमति अस्वीकृत: इस अस्पताल का डेटा देखने की अनुमति नहीं है।" : "Permission Denied: Cannot access visit records.");
        } else {
          setErrorMsg(isHi ? "परामर्श इतिहास लोड करने में त्रुटि।" : "Failed to load consultation records.");
        }
        setHistoryVisits([]);
        return;
      }
      const res = await response.json();
      if (res && (res.status === "success" || Array.isArray(res.visits))) {
        const visits = Array.isArray(res.visits) ? res.visits : [];
        setHistoryVisits(visits);
      } else {
        setHistoryVisits([]);
      }
    } catch (err) {
      console.error("Error fetching doctor consultation history:", err);
      setErrorMsg(isHi ? "परामर्श इतिहास लोड करने में त्रुटि।" : "Failed to load consultation records.");
      setHistoryVisits([]);
    } finally {
      setLoading(false);
    }
  }, [hospitalCode, isHi]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // 2. Filter Clinical Consultation records (General OPD, Emergency Triage, Clinical Specializations)
  const opdVisits = useMemo(() => {
    return historyVisits.filter((item) => {
      const dept = String(item.department || item.department_name || "").toLowerCase();
      const cat = String(item.service_category || "").toLowerCase();
      const code = String(item.dept_code || "").toLowerCase();

      // Check if ticket or any transfer stage was in OPD / Consultation / Emergency
      const hasClinicalStage = Array.isArray(item.transfer_stages) && item.transfer_stages.some((s) => {
        const sc = String(s.dept_code || s.department || "").toLowerCase();
        return (
          sc.includes("consult") ||
          sc.includes("opd") ||
          sc.includes("emerg") ||
          sc.includes("triage") ||
          Boolean(s.served_by)
        );
      });

      const isDirectClinical =
        dept.includes("consult") ||
        dept.includes("opd") ||
        dept.includes("emerg") ||
        dept.includes("triage") ||
        cat.includes("consult") ||
        cat.includes("opd") ||
        cat.includes("emerg") ||
        cat.includes("triage") ||
        code.includes("consult") ||
        code.includes("opd") ||
        code.includes("emerg") ||
        code.includes("triage") ||
        Boolean(item.served_by_doctor_name);

      // Strictly exclude pure auxiliary visits (direct pharmacy OTC, pure radiology scans, standalone lab tests, billing cashier, reception)
      // UNLESS the visit had an OPD or Emergency clinical consultation stage
      const isPureAuxiliary =
        (cat.includes("radiology") || cat.includes("rad") || cat.includes("xray") || cat.includes("mri") ||
         cat.includes("pharmacy") || cat.includes("laboratory") || cat.includes("pathology") || cat.includes("lab") ||
         cat.includes("billing") || cat.includes("cashier") || cat.includes("reception")) &&
        !hasClinicalStage && !isDirectClinical;

      if (isPureAuxiliary) return false;

      return isDirectClinical || hasClinicalStage;
    });
  }, [historyVisits]);

  // Notify parent of total consultation count
  useEffect(() => {
    if (onCountChange) {
      onCountChange(opdVisits.length);
    }
  }, [opdVisits.length, onCountChange]);

  // 3. Filtered Records
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const utcTodayStr = now.toISOString().split("T")[0];

    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const localYestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
    const utcYestStr = yest.toISOString().split("T")[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const candidateDocNames = [
      currentUser?.name,
      currentUser?.username,
      currentUser?.displayName,
      currentUser?.full_name,
      assignedDesk?.employees?.name,
      assignedDesk?.doctor_name,
      assignedDesk?.employee_name,
    ].filter(Boolean).map((s) => String(s).trim().toLowerCase());

    const candidateDocIds = [
      currentUser?.id,
      currentUser?.user_id,
      currentUser?.employee_id,
      currentUser?.employee_code,
      assignedDesk?.assigned_employee_id,
      assignedDesk?.employees?.id,
      assignedDesk?.employees?.employee_code,
    ].filter(Boolean).map((s) => String(s).trim().toLowerCase());

    const candidateDocEmails = [
      currentUser?.email,
      currentUser?.doctor_email,
      assignedDesk?.employees?.email,
      assignedDesk?.employees?.users?.email,
    ].filter(Boolean).map((s) => String(s).trim().toLowerCase());

    return opdVisits.filter((item) => {
      // 1. Date Filter (Timezone resilient: checks local date, UTC date, and queue_date)
      const itemDateStr = item.queue_date || (item.created_at ? item.created_at.split("T")[0] : "");
      const itemCreatedAtStr = item.created_at ? item.created_at.split("T")[0] : "";
      if (dateFilter === "today") {
        const matchesToday =
          itemDateStr === localTodayStr ||
          itemDateStr === utcTodayStr ||
          itemCreatedAtStr === localTodayStr ||
          itemCreatedAtStr === utcTodayStr;
        if (!matchesToday) return false;
      }
      if (dateFilter === "yesterday") {
        const matchesYest =
          itemDateStr === localYestStr ||
          itemDateStr === utcYestStr ||
          itemCreatedAtStr === localYestStr ||
          itemCreatedAtStr === utcYestStr;
        if (!matchesYest) return false;
      }
      if (dateFilter === "date") {
        if (itemDateStr !== customDate && itemCreatedAtStr !== customDate) return false;
      }
      if (dateFilter === "7days") {
        const itemCreated = item.created_at ? new Date(item.created_at) : new Date(itemDateStr);
        if (itemCreated < sevenDaysAgo) return false;
      }

      // 2. Doctor Scope Filter — robust multi-field match
      if (scopeFilter === "my") {
        const docNameRaw = String(item.served_by_doctor_name || item.doctor_name || item.served_by || "").toLowerCase().trim();
        const docIdRaw = String(item.doctor_id || item.served_by_id || "").trim().toLowerCase();

        let notesDoctorName = "";
        let notesEmpId = "";
        let notesEmail = "";
        try {
          const raw = item.prescription_notes || item.notes;
          if (raw && typeof raw === "object") {
            notesDoctorName = String(raw.doctor_name || "").toLowerCase();
            notesEmpId = String(raw.doctor_employee_id || "").toLowerCase();
            notesEmail = String(raw.doctor_email || "").toLowerCase();
          } else if (raw && typeof raw === "string") {
            const parsed = extractJsonBlock(raw, ["consult", "opd", "general"]) ||
                           extractJsonBlock(raw, []);
            if (parsed) {
              notesDoctorName = String(parsed.doctor_name || "").toLowerCase();
              notesEmpId = String(parsed.doctor_employee_id || "").toLowerCase();
              notesEmail = String(parsed.doctor_email || "").toLowerCase();
            }
          }
        } catch (_) {}

        let stageDoctorNames = [];
        if (Array.isArray(item.transfer_stages)) {
          item.transfer_stages.forEach((stg) => {
            if (stg.served_by) stageDoctorNames.push(String(stg.served_by).toLowerCase());
            if (stg.doctor_name) stageDoctorNames.push(String(stg.doctor_name).toLowerCase());
          });
        }

        const matchesName = candidateDocNames.some((cand) => {
          if (!cand) return false;
          const cleanCand = cand.replace(/^(dr|mr|ms|mrs)\.?\s+/i, "").trim();
          if (!cleanCand) return false;
          const words = cleanCand.split(/\s+/).filter((w) => w.length > 2);
          return (
            (docNameRaw && (docNameRaw.includes(cleanCand) || words.some((w) => docNameRaw.includes(w)))) ||
            (notesDoctorName && (notesDoctorName.includes(cleanCand) || words.some((w) => notesDoctorName.includes(w)))) ||
            stageDoctorNames.some((sn) => sn.includes(cleanCand) || words.some((w) => sn.includes(w)))
          );
        });

        const matchesId = candidateDocIds.some((candId) => {
          if (!candId) return false;
          return (
            (docIdRaw && docIdRaw === candId) ||
            (notesEmpId && (notesEmpId === candId || notesEmpId.includes(candId) || candId.includes(notesEmpId))) ||
            (docNameRaw && docNameRaw.includes(candId))
          );
        });

        const matchesEmail = candidateDocEmails.some((candEmail) => {
          if (!candEmail) return false;
          return (
            notesEmail === candEmail ||
            (item.served_by_doctor_email && String(item.served_by_doctor_email).toLowerCase().trim() === candEmail)
          );
        });

        const matchesDesk = assignedDesk?.id && (
          (item.desk_id && String(item.desk_id) === String(assignedDesk.id))
        );

        if (!matchesName && !matchesId && !matchesEmail && !matchesDesk) return false;
      }

      // 3. Status Filter
      const rawSt = String(item.status || "completed").toLowerCase();
      if (statusFilter === "completed" && !(rawSt === "completed" || rawSt === "done" || rawSt === "served")) return false;
      if (statusFilter === "serving" && !(rawSt === "serving" || rawSt === "in_progress" || rawSt === "active")) return false;
      if (statusFilter === "cancelled" && !(rawSt === "cancelled" || rawSt === "canceled" || rawSt === "no_show" || rawSt === "expired")) return false;

      // 4. Prescription Only Filter
      const details = extractConsultationDetails(item);
      if (rxOnlyFilter && !details.hasRx) return false;

      // 5. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const pName = String(item.patient_name || item.name || "").toLowerCase();
        const pPhone = String(item.patient_phone || item.phone || "").toLowerCase();
        const tNum = String(item.ticket_number || item.ticket_id || "").toLowerCase();
        const pId = String(item.patient_id || "").toLowerCase();
        const diag = String(details.diagnosis || "").toLowerCase();
        const medNames = details.medicines.map((m) => (m.name || "").toLowerCase()).join(" ");

        const matches =
          pName.includes(q) ||
          pPhone.includes(q) ||
          tNum.includes(q) ||
          pId.includes(q) ||
          diag.includes(q) ||
          medNames.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    opdVisits,
    dateFilter,
    customDate,
    scopeFilter,
    statusFilter,
    rxOnlyFilter,
    searchTerm,
    currentUser,
    assignedDesk,
    isEmergencyDesk,
  ]);

  // KPI Metrics calculation
  const kpis = useMemo(() => {
    let completed = 0;
    let withRx = 0;
    let cancelled = 0;

    filteredRecords.forEach((item) => {
      const st = String(item.status || "completed").toLowerCase();
      if (st === "completed" || st === "done" || st === "served") completed++;
      if (st === "cancelled" || st === "canceled" || st === "no_show" || st === "expired") cancelled++;

      const details = extractConsultationDetails(item);
      if (details.hasRx) withRx++;
    });

    return {
      total: filteredRecords.length,
      completed,
      withRx,
      cancelled,
    };
  }, [filteredRecords]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, customDate, scopeFilter, statusFilter, rxOnlyFilter, searchTerm, rowsPerPage]);

  // Excel / CSV Export
  const handleExportCSV = useCallback(() => {
    if (filteredRecords.length === 0) {
      alert(isHi ? "निर्यात करने हेतु कोई रिकॉर्ड उपलब्ध नहीं है।" : "No consultation records to export.");
      return;
    }

    const headers = [
      "#",
      "Date & Time",
      "Token Number",
      "Patient Name",
      "Age",
      "Gender",
      "Phone",
      "Department",
      "Attending Doctor",
      "Diagnosis",
      "Prescribed Medicines",
      "Advised Lab Tests",
      "Clinical Advice",
      "Follow-up",
      "Status",
    ];

    const rows = filteredRecords.map((item, idx) => {
      const details = extractConsultationDetails(item);
      const medList = details.medicines
        .map((m) => `${m.name} (${m.dosage || "-"}, ${m.frequency || "-"})`)
        .join("; ");

      return [
        idx + 1,
        item.created_at ? new Date(item.created_at).toLocaleString() : item.queue_date || "-",
        item.ticket_number || item.ticket_id || "-",
        item.patient_name || item.name || "Patient",
        item.patient_age || item.age || "-",
        item.patient_gender || item.gender || "-",
        item.patient_phone || item.phone || "-",
        details.doctorDept,
        details.doctorName,
        details.diagnosis,
        medList || "-",
        details.labTests || "-",
        details.advice || "-",
        details.followUp || "-",
        item.status || "completed",
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `OPD_Consultation_History_${hospitalCode || "Hospital"}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredRecords, hospitalCode, isHi]);

  // Print Prescription Wrapper - guaranteed clean and structured
  const handlePrintRx = (ticket, asPdf = false) => {
    const details = extractConsultationDetails(ticket);
    const rxData = {
      ...(details.notesObj || {}),
      patient_name: ticket.patient_name || ticket.name || "Patient",
      age: ticket.patient_age || ticket.age || 30,
      gender: ticket.patient_gender || ticket.gender || "male",
      phone: ticket.patient_phone || ticket.phone || "",
      ticket_id: ticket.ticket_id || ticket.token_number || "",
      appointment_id: ticket.appointment_id || "",
      service_category: ticket.service_category || "General Consultation (OPD)",
      doctor_name: details.doctorName,
      doctor_department: details.doctorDept,
      doctor_employee_id: details.notesObj?.doctor_employee_id || currentUser?.employee_id || currentUser?.employee_code || "",
      diagnosis: details.diagnosis,
      medicines: details.medicines,
      advice: cleanAdviceText ? cleanAdviceText(details.advice) : details.advice,
      lab_tests: details.labTests,
      follow_up: details.followUp,
      hospital_name: hospitalBranding?.hospital_name || currentUser?.hospital_name || "City General Hospital",
      prescribed_at: ticket.created_at || new Date().toISOString(),
    };
    if (asPdf) {
      downloadPrescriptionPDF(rxData, language, hospitalBranding);
    } else {
      printPrescriptionSlip(rxData, language, hospitalBranding);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* 1. HEADER HERO BANNER */}
      <div
        style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: "20px",
          padding: "20px 24px",
          boxShadow: isDark ? "0 10px 30px rgba(0, 0, 0, 0.4)" : "0 4px 18px rgba(2, 132, 199, 0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
              color: "#0284C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <History size={26} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: textColor, letterSpacing: "-0.3px" }}>
                {isHi ? (isEmergencyDesk ? "आपातकालीन ट्राइएज एवं परामर्श इतिहास" : "मरीज़ परामर्श एवं ओपीडी विज़िट इतिहास") : (isEmergencyDesk ? "Patient Consultation & Emergency History" : "Patient Consultation & OPD Visit History")}
              </h2>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                  color: "#0284C7",
                  border: isDark ? "1px solid rgba(2, 132, 199, 0.45)" : "1px solid #BAE6FD",
                }}
              >
                {filteredRecords.length} {isHi ? "परामर्श रिकॉर्ड" : "Records"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: mutedText }}>
              {isHi
                ? "ओपीडी परामर्श रिकॉर्ड खोजें, दिनांक अनुसार फ़िल्टर करें, दवा पर्ची व क्लिनिकल नोट्स देखें एवं एक्सेल में निर्यात करें।"
                : "Search past OPD consultation records, review clinical diagnosis & prescribed medications, reprint prescriptions, or export to Excel."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={fetchVisits}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 14px",
              borderRadius: "12px",
              border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
              background: isDark ? "#0F172A" : "#FFFFFF",
              color: textColor,
              fontSize: "12px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            <span>{isHi ? "ताज़ा करें" : "Refresh"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 16px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 800,
              cursor: filteredRecords.length === 0 ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)",
              opacity: filteredRecords.length === 0 ? 0.6 : 1,
              transition: "all 0.15s ease",
            }}
          >
            <Download size={14} />
            <span>{isHi ? "एक्सेल निर्यात" : "Export Excel"}</span>
          </button>
        </div>
      </div>

      {/* 2. CLINICAL KPI STRIP */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {/* KPI 1: Total Consultations */}
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            padding: "14px 18px",
            boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
              {isHi ? "कुल परामर्श" : "Total Consultations"}
            </span>
            <Stethoscope size={16} color="#0284C7" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#0284C7", lineHeight: 1.1 }}>
            {kpis.total}
          </div>
          <span style={{ fontSize: "11px", color: mutedText }}>
            {isHi ? "वर्तमान फ़िल्टर में कुल विज़िट" : "In current active selection"}
          </span>
        </div>

        {/* KPI 2: Completed Consultations */}
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            padding: "14px 18px",
            boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
              {isHi ? "सफल परामर्श" : "Completed Consultations"}
            </span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#059669", lineHeight: 1.1 }}>
            {kpis.completed}
          </div>
          <span style={{ fontSize: "11px", color: mutedText }}>
            {isHi ? "परामर्श प्रक्रिया पूर्ण" : "Fully served & closed"}
          </span>
        </div>

        {/* KPI 3: With E-Prescription */}
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            padding: "14px 18px",
            boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
              {isHi ? "दवा पर्ची सहित (Rx)" : "With E-Prescriptions"}
            </span>
            <Pill size={16} color="#7C3AED" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#7C3AED", lineHeight: 1.1 }}>
            {kpis.withRx}
          </div>
          <span style={{ fontSize: "11px", color: mutedText }}>
            {isHi ? "दवाएं व जांच निर्धारित" : "With medication & advice"}
          </span>
        </div>

        {/* KPI 4: Cancelled / No-Show */}
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: "16px",
            padding: "14px 18px",
            boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
              {isHi ? "रद्द / अनुपस्थित" : "Cancelled / No-Show"}
            </span>
            <XCircle size={16} color="#DC2626" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#DC2626", lineHeight: 1.1 }}>
            {kpis.cancelled}
          </div>
          <span style={{ fontSize: "11px", color: mutedText }}>
            {isHi ? "मरीज़ उपस्थित नहीं हुआ" : "Missed or cancelled slots"}
          </span>
        </div>
      </div>

      {/* 3. FILTER & SEARCH CONTROLS TOOLBAR */}
      <div
        style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: "16px",
          padding: "16px 18px",
          boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.02)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {/* Row 1: Date Range Presets */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", marginRight: "4px" }}>
              {isHi ? "दिनांक अवधि:" : "Date Period:"}
            </span>

            {[
              { id: "all", label: isHi ? "सभी दिनांक" : "All Dates" },
              { id: "today", label: isHi ? "आज (Today)" : "Today" },
              { id: "yesterday", label: isHi ? "कल (Yesterday)" : "Yesterday" },
              { id: "7days", label: isHi ? "पिछले 7 दिन" : "Last 7 Days" },
              { id: "date", label: isHi ? "दिनांक चुनें" : "Select Date" },
            ].map((btn) => {
              const active = dateFilter === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setDateFilter(btn.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "9999px",
                    fontSize: "11.5px",
                    fontWeight: active ? 800 : 700,
                    cursor: "pointer",
                    border: active ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: active ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                    color: active ? "#0284C7" : mutedText,
                    transition: "all 0.15s ease",
                  }}
                >
                  {btn.label}
                </button>
              );
            })}

            {dateFilter === "date" && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: isDark ? "#0F172A" : "#FFFFFF",
                  color: textColor,
                  fontSize: "11.5px",
                  fontWeight: 700,
                  outline: "none",
                }}
              />
            )}
          </div>

          {/* Doctor Scope Selector (All vs My Patients) */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
              {isHi ? "डॉक्टर:" : "Doctor:"}
            </span>
            <div style={{ display: "inline-flex", background: subBg, padding: "3px", borderRadius: "10px", border: subBorder }}>
              <button
                type="button"
                onClick={() => setScopeFilter("all")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "7px",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: scopeFilter === "all" ? 800 : 600,
                  background: scopeFilter === "all" ? (isDark ? "#334155" : "#FFFFFF") : "transparent",
                  color: scopeFilter === "all" ? "#0284C7" : mutedText,
                  cursor: "pointer",
                  boxShadow: scopeFilter === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {isHi ? "सभी डॉक्टर" : "All Doctors"}
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("my")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "7px",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: scopeFilter === "my" ? 800 : 600,
                  background: scopeFilter === "my" ? (isDark ? "#334155" : "#FFFFFF") : "transparent",
                  color: scopeFilter === "my" ? "#0284C7" : mutedText,
                  cursor: "pointer",
                  boxShadow: scopeFilter === "my" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {isHi ? "केवल मेरे मरीज़" : `My Patients (${currentUser?.name || assignedDesk?.employees?.name || currentUser?.username || "Dr"})`}
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Status Chips, Prescription Checkbox & Search Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            borderTop: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9",
            paddingTop: "12px",
          }}
        >
          {/* Status & Rx Filter Chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
              {isHi ? "स्थिति:" : "Status:"}
            </span>

            {[
              { id: "all", label: isHi ? "सभी" : "All" },
              { id: "completed", label: isHi ? "पूर्ण" : "Completed" },
              { id: "serving", label: isHi ? "परामर्श जारी" : "In Progress" },
              { id: "cancelled", label: isHi ? "रद्द" : "Cancelled" },
            ].map((st) => {
              const active = statusFilter === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: active ? 800 : 700,
                    cursor: "pointer",
                    border: active ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                    background: active ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE") : "transparent",
                    color: active ? "#0284C7" : mutedText,
                    transition: "all 0.15s ease",
                  }}
                >
                  {st.label}
                </button>
              );
            })}

            {/* Toggle Prescription Only */}
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                marginLeft: "6px",
                fontSize: "11.5px",
                fontWeight: 700,
                color: rxOnlyFilter ? "#7C3AED" : mutedText,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={rxOnlyFilter}
                onChange={(e) => setRxOnlyFilter(e.target.checked)}
                style={{ accentColor: "#7C3AED", cursor: "pointer" }}
              />
              <span>{isHi ? "केवल दवा पर्ची (Rx) वाले" : "Rx Only"}</span>
            </label>
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", minWidth: "220px", maxWidth: "min(340px, 100%)", flex: "1 1 auto" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "9px", color: mutedText }} />
            <input
              type="text"
              placeholder={isHi ? "नाम, टोकन, फोन, निदान या दवा खोजें..." : "Search name, token, phone, diagnosis..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 28px 6px 32px",
                borderRadius: "10px",
                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                background: isDark ? "#0F172A" : "#FFFFFF",
                color: textColor,
                fontSize: "12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "7px",
                  background: "none",
                  border: "none",
                  color: mutedText,
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. HISTORICAL RECORDS TABLE */}
      <div
        className="staff-table-scroll-wrapper"
        style={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          boxSizing: "border-box",
          borderRadius: "16px",
          border: cardBorder,
          background: cardBg,
          boxShadow: isDark ? "0 4px 18px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.02)",
        }}
      >
        {loading && historyVisits.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: mutedText }}>
            <RefreshCw size={28} className="spin-icon" style={{ margin: "0 auto 10px auto", color: "#0284C7" }} />
            <div style={{ fontSize: "14px", fontWeight: 800 }}>
              {isHi ? "परामर्श रिकॉर्ड लोड हो रहे हैं..." : "Loading consultation records..."}
            </div>
          </div>
        ) : errorMsg ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#DC2626" }}>
            <AlertCircle size={32} style={{ margin: "0 auto 8px auto" }} />
            <div style={{ fontSize: "14px", fontWeight: 800 }}>{errorMsg}</div>
            <button
              type="button"
              onClick={fetchVisits}
              style={{
                marginTop: "12px",
                padding: "6px 14px",
                borderRadius: "8px",
                background: "#0284C7",
                color: "#FFFFFF",
                border: "none",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {isHi ? "पुनः प्रयास करें" : "Try Again"}
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: mutedText }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                background: isDark ? "#0F172A" : "#F0F9FF",
                border: `1px solid ${isDark ? "#334155" : "#BAE6FD"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <History size={26} color="#0284C7" />
            </div>
            <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", color: textColor, fontWeight: 800 }}>
              {isHi ? "कोई परामर्श रिकॉर्ड नहीं मिला" : "No Consultation Records Found"}
            </h4>
            <p style={{ margin: 0, fontSize: "12.5px", color: mutedText }}>
              {isHi
                ? "चयनित दिनांक या खोज फ़िल्टर के अनुसार कोई ओपीडी विज़िट नहीं मिली। फ़िल्टर रीसेट करें।"
                : "No past patient visits match the selected filter or search keyword. Try selecting 'All Dates'."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", minWidth: "1060px", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr
                style={{
                  background: isDark ? "#0F172A" : "#F8FAFC",
                  borderBottom: isDark ? "1.5px solid #1E293B" : "1.5px solid #E2E8F0",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "10px 12px", fontWeight: 800, color: mutedText }}>#</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: mutedText }}>{isHi ? "दिनांक व समय" : "Date & Time"}</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: mutedText }}>{isHi ? "टोकन #" : "Token #"}</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: mutedText }}>{isHi ? "मरीज़ विवरण" : "Patient Details"}</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: mutedText }}>{isHi ? "क्लिनिकल निदान" : "Clinical Diagnosis"}</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: mutedText }}>{isHi ? "दवा पर्ची (Rx)" : "Prescription (Rx)"}</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: mutedText }}>{isHi ? "परामर्श डॉक्टर" : "Consultant"}</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: mutedText }}>{isHi ? "स्थिति व कार्रवाई" : "Status & Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((item, idx) => {
                const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
                const details = extractConsultationDetails(item);
                const rawSt = String(item.status || "completed").toLowerCase();
                const isCompleted = rawSt === "completed" || rawSt === "done" || rawSt === "served";
                const isCancelled = rawSt === "cancelled" || rawSt === "canceled" || rawSt === "no_show" || rawSt === "expired";
                const isServing = rawSt === "serving" || rawSt === "in_progress" || rawSt === "active";

                const isP1 = String(item.priority || "").toLowerCase().includes("1") || String(item.priority || "").toLowerCase().includes("emer");

                return (
                  <tr
                    key={item.ticket_id || idx}
                    style={{
                      borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                      background: isCancelled
                        ? (isDark ? "rgba(239, 68, 68, 0.04)" : "rgba(254, 242, 242, 0.6)")
                        : isServing
                        ? (isDark ? "rgba(245, 158, 11, 0.04)" : "rgba(255, 251, 235, 0.5)")
                        : "transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* Index */}
                    <td style={{ padding: "10px 12px", color: mutedText, fontWeight: 700 }}>
                      {globalIdx}
                    </td>

                    {/* Date & Time */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 800, color: textColor }}>
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </div>
                      <div style={{ fontSize: "11px", color: mutedText, marginTop: "1px" }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : (item.queue_date || "-")}
                      </div>
                    </td>

                    {/* Token Number & Priority Badge */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 900,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                            color: "#0284C7",
                            border: isDark ? "1px solid rgba(2, 132, 199, 0.45)" : "1px solid #BAE6FD",
                          }}
                        >
                          #{item.ticket_number || item.ticket_id}
                        </span>
                        {isP1 && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 900,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isDark ? "rgba(220, 38, 38, 0.25)" : "#FEE2E2",
                              color: "#DC2626",
                            }}
                          >
                            P1
                          </span>
                        )}
                      </div>
                      {item.appointment_id && (
                        <div style={{ fontSize: "10px", color: "#7C3AED", fontWeight: 700, marginTop: "2px" }}>
                          📅 {isHi ? "अपॉइंटमेंट" : "Appointment"}
                        </div>
                      )}
                    </td>

                    {/* Patient Information */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 800, color: textColor, fontSize: "12.5px" }}>
                        {item.patient_name || item.name || "Patient"}
                      </div>
                      <div style={{ fontSize: "11px", color: mutedText, marginTop: "1px", display: "flex", alignItems: "center", gap: "6px" }}>
                        {(item.patient_age || item.age) && (
                          <span>{item.patient_age || item.age}y</span>
                        )}
                        {(item.patient_gender || item.gender) && (
                          <span>• {item.patient_gender || item.gender}</span>
                        )}
                        {(item.patient_phone || item.phone) && (
                          <span>• 📞 {item.patient_phone || item.phone}</span>
                        )}
                      </div>
                    </td>

                    {/* Diagnosis & Clinical Assessment */}
                    <td style={{ padding: "10px 12px", maxWidth: "220px" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: textColor,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={details.diagnosis}
                      >
                        {details.diagnosis}
                      </div>
                      {details.labTests && (
                        <div style={{ fontSize: "10.5px", color: "#0284C7", marginTop: "2px", fontWeight: 600 }}>
                          🔬 Lab: {details.labTests}
                        </div>
                      )}
                    </td>

                    {/* Prescribed Medicines Summary */}
                    <td style={{ padding: "10px 12px" }}>
                      {details.medicines.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11px",
                              fontWeight: 800,
                              color: "#7C3AED",
                              background: isDark ? "rgba(124, 58, 237, 0.18)" : "#F5F3FF",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              width: "fit-content",
                            }}
                          >
                            <Pill size={11} />
                            {details.medicines.length} {isHi ? "दवाएं" : "Medicines"}
                          </span>
                          <span style={{ fontSize: "10.5px", color: mutedText }}>
                            {details.medicines.slice(0, 2).map((m) => m.name).join(", ")}
                            {details.medicines.length > 2 ? "..." : ""}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: mutedText, fontStyle: "italic" }}>
                          {isHi ? "कोई दवा नहीं" : "No Rx recorded"}
                        </span>
                      )}
                    </td>

                    {/* Attending Doctor */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 700, color: textColor, display: "flex", alignItems: "center", gap: "5px" }}>
                        <Stethoscope size={13} color="#0284C7" />
                        <span>{details.doctorName}</span>
                      </div>
                      <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "1px" }}>
                        {details.doctorDept}
                      </div>
                    </td>

                    {/* Status & Clinical Actions */}
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
                        {/* Status Badge */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 800,
                            background: isCompleted
                              ? (isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5")
                              : isServing
                              ? (isDark ? "rgba(245, 158, 11, 0.18)" : "#FEF3C7")
                              : (isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2"),
                            color: isCompleted
                              ? (isDark ? "#6EE7B7" : "#065F46")
                              : isServing
                              ? (isDark ? "#FDE68A" : "#92400E")
                              : (isDark ? "#FCA5A5" : "#DC2626"),
                            border: `1px solid ${
                              isCompleted
                                ? (isDark ? "rgba(16, 185, 129, 0.35)" : "#A7F3D0")
                                : isServing
                                ? (isDark ? "rgba(245, 158, 11, 0.35)" : "#FDE68A")
                                : (isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA")
                            }`,
                          }}
                        >
                          {isCompleted ? <CheckCircle2 size={12} /> : isServing ? <Clock size={12} /> : <XCircle size={12} />}
                          <span>{item.status || "Completed"}</span>
                        </span>

                        {/* View Rx Details Button */}
                        <button
                          type="button"
                          onClick={() => setInspectedVisit(item)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                            background: isDark ? "#0F172A" : "#FFFFFF",
                            color: "#0284C7",
                            fontSize: "11px",
                            fontWeight: 800,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          title={isHi ? "पूर्ण दवा पर्ची व क्लिनिकल नोट्स देखें" : "View Full Clinical Prescription & Notes"}
                        >
                          <Eye size={12} />
                          <span>{isHi ? "देखें" : "View"}</span>
                        </button>

                        {/* Reprint Button */}
                        {details.hasRx && (
                          <button
                            type="button"
                            onClick={() => handlePrintRx(item, false)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "none",
                              background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                              color: "#0284C7",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            title={isHi ? "दवा पर्ची प्रिंट करें" : "Reprint Prescription Slip"}
                          >
                            <Printer size={12} />
                            <span>{isHi ? "प्रिंट" : "Print"}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. PAGINATION TOOLBAR */}
      {filteredRecords.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "8px 4px",
          }}
        >
          {/* Left: Showing range */}
          <div style={{ fontSize: "12px", color: mutedText, fontWeight: 600 }}>
            {isHi ? (
              <>
                कुल <strong>{filteredRecords.length}</strong> में से{" "}
                <strong>{(currentPage - 1) * rowsPerPage + 1}</strong> -{" "}
                <strong>{Math.min(currentPage * rowsPerPage, filteredRecords.length)}</strong> रिकॉर्ड
              </>
            ) : (
              <>
                Showing <strong>{(currentPage - 1) * rowsPerPage + 1}</strong> -{" "}
                <strong>{Math.min(currentPage * rowsPerPage, filteredRecords.length)}</strong> of{" "}
                <strong>{filteredRecords.length}</strong> consultation records
              </>
            )}
          </div>

          {/* Right: Page Navigation & Rows per page */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Rows Per Page */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11.5px", color: mutedText }}>{isHi ? "प्रति पृष्ठ:" : "Rows:"}</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                style={{
                  padding: "4px 8px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: isDark ? "#0F172A" : "#FFFFFF",
                  color: textColor,
                  fontSize: "11.5px",
                  fontWeight: 700,
                  outline: "none",
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Prev Button */}
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "5px 10px",
                borderRadius: "8px",
                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                background: isDark ? "#0F172A" : "#FFFFFF",
                color: textColor,
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                opacity: currentPage <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} />
              <span>{isHi ? "पिछला" : "Prev"}</span>
            </button>

            {/* Page indicator */}
            <span style={{ fontSize: "11.5px", fontWeight: 800, color: textColor }}>
              {currentPage} / {totalPages}
            </span>

            {/* Next Button */}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "5px 10px",
                borderRadius: "8px",
                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                background: isDark ? "#0F172A" : "#FFFFFF",
                color: textColor,
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                opacity: currentPage >= totalPages ? 0.5 : 1,
              }}
            >
              <span>{isHi ? "अगला" : "Next"}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 6. DETAILED CLINICAL PRESCRIPTION MODAL */}
      {inspectedVisit && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000000,
            padding: "16px",
            boxSizing: "border-box",
          }}
          onClick={() => setInspectedVisit(null)}
        >
          {(() => {
            const details = extractConsultationDetails(inspectedVisit);
            return (
              <div
                style={{
                  background: cardBg,
                  borderRadius: "20px",
                  border: cardBorder,
                  padding: "24px",
                  maxWidth: "min(720px, calc(100vw - 32px))",
                  width: "100%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxSizing: "border-box",
                  boxShadow: "0 25px 60px -12px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: isDark ? "1px solid #334155" : "1px solid #E2E8F0", paddingBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                        color: "#0284C7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FileText size={22} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: textColor }}>
                          {isHi ? "क्लिनिकल परामर्श एवं दवा पर्ची" : "Consultation & Prescription Summary"}
                        </h3>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                            color: "#0284C7",
                          }}
                        >
                          #{inspectedVisit.ticket_number || inspectedVisit.ticket_id}
                        </span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                        {inspectedVisit.created_at ? new Date(inspectedVisit.created_at).toLocaleString() : "-"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInspectedVisit(null)}
                    style={{
                      background: isDark ? "#334155" : "#F1F5F9",
                      border: "none",
                      borderRadius: "8px",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: mutedText,
                      cursor: "pointer",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Patient & Doctor Demographics Card */}
                <div
                  style={{
                    background: subBg,
                    border: subBorder,
                    borderRadius: "14px",
                    padding: "14px 16px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "10.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
                      {isHi ? "मरीज़" : "Patient"}
                    </span>
                    <div style={{ fontSize: "13.5px", fontWeight: 900, color: textColor, marginTop: "2px" }}>
                      {inspectedVisit.patient_name || inspectedVisit.name || "Patient"}
                    </div>
                    <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                      {inspectedVisit.patient_age || inspectedVisit.age || 30}y • {inspectedVisit.patient_gender || inspectedVisit.gender || "other"}
                      {(inspectedVisit.patient_phone || inspectedVisit.phone) && ` • 📞 ${inspectedVisit.patient_phone || inspectedVisit.phone}`}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "10.5px", fontWeight: 800, color: mutedText, textTransform: "uppercase" }}>
                      {isHi ? "परामर्श डॉक्टर" : "Consultant"}
                    </span>
                    <div style={{ fontSize: "13.5px", fontWeight: 900, color: "#0284C7", marginTop: "2px" }}>
                      {details.doctorName}
                    </div>
                    <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                      {details.doctorDept}
                    </div>
                  </div>
                </div>

                {/* Clinical Diagnosis */}
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 800, color: textColor, display: "flex", alignItems: "center", gap: "6px" }}>
                    <Stethoscope size={15} color="#0284C7" />
                    <span>{isHi ? "निदान एवं क्लिनिकल मूल्यांकन" : "Diagnosis & Clinical Assessment"}</span>
                  </h4>
                  <div
                    style={{
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                      borderRadius: "12px",
                      padding: "12px 14px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: textColor,
                    }}
                  >
                    {details.diagnosis}
                  </div>
                </div>

                {/* Prescribed Medications Table */}
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 800, color: textColor, display: "flex", alignItems: "center", gap: "6px" }}>
                    <Pill size={15} color="#7C3AED" />
                    <span>{isHi ? "निर्धारित दवाएं" : "Prescribed Medications"} ({details.medicines.length})</span>
                  </h4>

                  {details.medicines.length === 0 ? (
                    <div style={{ padding: "14px", textAlign: "center", color: mutedText, background: subBg, borderRadius: "10px", fontSize: "12px" }}>
                      {isHi ? "कोई दवा दर्ज नहीं की गई है।" : "No specific medications prescribed for this visit."}
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", borderRadius: "10px", border: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ background: isDark ? "#0F172A" : "#F8FAFC", borderBottom: isDark ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: mutedText, fontWeight: 800 }}>#</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: mutedText, fontWeight: 800 }}>{isHi ? "दवा का नाम" : "Medicine Name"}</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: mutedText, fontWeight: 800 }}>{isHi ? "खुराक" : "Dosage"}</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: mutedText, fontWeight: 800 }}>{isHi ? "आवृत्ति" : "Frequency"}</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: mutedText, fontWeight: 800 }}>{isHi ? "अवधि" : "Duration"}</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", color: mutedText, fontWeight: 800 }}>{isHi ? "निर्देश" : "Instructions"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.medicines.map((med, mIdx) => (
                            <tr key={mIdx} style={{ borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9" }}>
                              <td style={{ padding: "8px 10px", color: mutedText, fontWeight: 700 }}>{mIdx + 1}</td>
                              <td style={{ padding: "8px 10px", fontWeight: 800, color: textColor }}>{med.name}</td>
                              <td style={{ padding: "8px 10px", color: textColor }}>{med.dosage || "-"}</td>
                              <td style={{ padding: "8px 10px", color: "#7C3AED", fontWeight: 700 }}>{med.frequency || "-"}</td>
                              <td style={{ padding: "8px 10px", color: textColor }}>{med.duration || "-"}</td>
                              <td style={{ padding: "8px 10px", color: mutedText }}>{med.instructions || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Advised Diagnostic / Lab Tests */}
                {details.labTests && (
                  <div>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "12.5px", fontWeight: 800, color: textColor }}>
                      🔬 {isHi ? "निर्धारित लैब / पैथोलॉजी जांचें" : "Advised Diagnostic & Lab Tests"}
                    </h4>
                    <div
                      style={{
                        background: isDark ? "rgba(2, 132, 199, 0.12)" : "#F0F9FF",
                        border: isDark ? "1px solid rgba(2, 132, 199, 0.3)" : "1px solid #BAE6FD",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        color: "#0284C7",
                      }}
                    >
                      {details.labTests}
                    </div>
                  </div>
                )}

                {/* Doctor's Advice & Lifestyle Guidelines */}
                {details.advice && (
                  <div>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "12.5px", fontWeight: 800, color: textColor }}>
                      💡 {isHi ? "डॉक्टर की सलाह एवं निर्देश" : "Doctor's Advice & Instructions"}
                    </h4>
                    <div
                      style={{
                        background: subBg,
                        border: subBorder,
                        borderRadius: "10px",
                        padding: "10px 14px",
                        fontSize: "12px",
                        color: textColor,
                        lineHeight: 1.5,
                      }}
                    >
                      {details.advice}
                    </div>
                  </div>
                )}

                {/* Follow-up Note */}
                {details.followUp && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: isDark ? "rgba(245, 158, 11, 0.12)" : "#FFFBEB", border: isDark ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #FDE68A", borderRadius: "10px", padding: "8px 12px" }}>
                    <Calendar size={14} color="#D97706" />
                    <span style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#FDE68A" : "#92400E" }}>
                      {isHi ? "पुनः परामर्श / फॉलो-अप:" : "Follow-Up / Review:"} {details.followUp}
                    </span>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderTop: isDark ? "1px solid #334155" : "1px solid #E2E8F0", paddingTop: "14px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {/* Re-prescribe / Use as template */}
                    {/* Use Rx as Template removed per clinical request */}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {/* Print Slip */}
                    <button
                      type="button"
                      onClick={() => handlePrintRx(inspectedVisit, false)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        background: isDark ? "#0F172A" : "#FFFFFF",
                        color: textColor,
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      <Printer size={14} />
                      <span>{isHi ? "प्रिंट पर्ची" : "Print Rx"}</span>
                    </button>

                    {/* Download PDF */}
                    <button
                      type="button"
                      onClick={() => handlePrintRx(inspectedVisit, true)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        border: "none",
                        background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                        color: "#FFFFFF",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                      }}
                    >
                      <Download size={14} />
                      <span>{isHi ? "पीडीएफ डाउनलोड" : "Download PDF"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
