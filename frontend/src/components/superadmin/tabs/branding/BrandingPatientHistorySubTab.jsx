import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { API_BASE } from "../../../../config/hospitalConfig";
import {
    IconFileText,
    IconDownload,
    IconRefresh,
    IconSearch,
    IconClock,
    IconCheckCircle,
    IconAlertTriangle,
    IconX,
    IconStethoscope,
    IconUser,
    IconPlus,
    IconPrinter,
} from "../../SuperAdminIcons";
import { fieldInputStyle } from "../../superAdminStyles";
import "../../SuperAdmin.css";
import { printPrescriptionSlip, downloadPrescriptionPDF } from "../../../../utils/printPassHelper";

// Robust parser for clinical notes/prescriptions that converts raw JSON strings into clean structured records
function parseClinicalRecord(raw) {
    if (!raw) return null;
    let data = raw;
    if (typeof raw === "string") {
        let trimmed = raw.trim();
        while ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            trimmed = trimmed.slice(1, -1).trim();
        }
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
                data = JSON.parse(trimmed);
            } catch (e) {
                try { data = JSON.parse(JSON.parse(raw)); } catch (e2) {}
            }
        } else {
            return { rawText: raw };
        }
    }
    if (typeof data === "object" && data !== null) {
        return data;
    }
    return { rawText: String(raw) };
}

// Resilient spreadsheet parser supporting .xlsx, .xls, .csv via SheetJS
async function parseSpreadsheetData(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    return rawRows;
}

// Allowed schema mappings for past patient visit logs
const VISITS_FIELD_MAPPINGS = {
    patient_name: ["patient_name", "name", "patient", "full_name", "fullname", "patient_full_name", "first_name", "last_name", "client_name"],
    phone: ["phone", "mobile", "contact", "phone_number", "mobile_number", "mobile_no", "contact_no", "cell", "tel"],
    age: ["age", "patient_age", "years", "age_years"],
    gender: ["gender", "sex"],
    department: ["department", "dept", "dept_name", "department_name", "service_category", "specialty", "clinic", "ward"],
    doctor_name: ["doctor_name", "doctor", "dr_name", "attending_physician", "physician", "consultant", "dr", "doctor_in_charge"],
    service_duration_minutes: ["service_duration_minutes", "duration", "duration_min", "duration_minutes", "consult_duration", "consultation_minutes", "time_spent", "minutes", "service_time"],
    visit_date: ["visit_date", "date", "queue_date", "appointment_date", "consultation_date", "visit_time", "entry_date"],
    status: ["status", "visit_status", "state"],
    symptoms: ["symptoms", "medical_condition", "condition", "diagnosis", "chief_complaint", "reason_for_visit", "complaint", "disease", "illness", "problem"],
    prescription: ["prescription", "rx", "advice", "treatment", "notes", "medication", "medicines", "drugs", "clinical_notes"],
};

export default function BrandingPatientHistorySubTab({
    currentHosp,
    notify,
    isHi = false,
    getAuthHeaders,
    hospitalVisitsData = { summary: {}, visits: [] },
    handleDownloadVisitHistory,
    fetchHospitalDeepDive,
}) {
    const tenantId = currentHosp?.hospital_code || "city-hospital-01";
    const hospName = currentHosp?.name || "Hospital";

    const [visits, setVisits] = useState(hospitalVisitsData?.visits || []);
    const [summary, setSummary] = useState(hospitalVisitsData?.summary || {});
    const [loadingVisits, setLoadingVisits] = useState(false);

    // Filter and search
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedVisitDetail, setSelectedVisitDetail] = useState(null);

    // Bulk Excel/CSV upload state
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkParsedVisits, setBulkParsedVisits] = useState([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkStatus, setBulkStatus] = useState(null);
    const [ignoredColumns, setIgnoredColumns] = useState([]);
    const [isHeroDragging, setIsHeroDragging] = useState(false);
    const [isModalDragging, setIsModalDragging] = useState(false);

    // Sync from parent or fetch
    useEffect(() => {
        if (hospitalVisitsData && Array.isArray(hospitalVisitsData.visits) && hospitalVisitsData.visits.length > 0) {
            setVisits(hospitalVisitsData.visits);
            setSummary(hospitalVisitsData.summary || {});
        } else {
            fetchVisits();
        }
    }, [hospitalVisitsData, tenantId]);

    const fetchVisits = async () => {
        if (!tenantId) return;
        setLoadingVisits(true);
        try {
            const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${tenantId}/visits?limit=500`, { headers });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setVisits(data.visits || []);
                setSummary(data.summary || {});
            }
        } catch (err) {
            console.warn("Failed to fetch hospital visits:", err);
        } finally {
            setLoadingVisits(false);
        }
    };

    // Filtered visits
    const filteredVisits = visits.filter((v) => {
        const matchesQuery =
            !searchQuery.trim() ||
            (v.ticket_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.phone || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.doctor_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.department || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.transfer_trail || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (Array.isArray(v.transfer_stages) && v.transfer_stages.some((st) => (st.department || "").toLowerCase().includes(searchQuery.toLowerCase())));

        const isVisitTransferred = Boolean(
            v.is_transferred ||
            (v.status || "").toLowerCase() === "transferred" ||
            v.transfer_trail ||
            v.transferred_from_dept ||
            (Array.isArray(v.transfer_stages) && v.transfer_stages.length > 1)
        );

        let matchesStatus = false;
        if (statusFilter === "all") {
            matchesStatus = true;
        } else if (statusFilter === "transferred") {
            matchesStatus = isVisitTransferred;
        } else {
            matchesStatus = (v.status || "completed").toLowerCase() === statusFilter.toLowerCase();
        }

        return matchesQuery && matchesStatus;
    });

    const statusCounts = useMemo(() => {
        let completed = 0;
        let transferred = 0;
        let noShow = 0;
        let cancelled = 0;

        visits.forEach((v) => {
            const s = (v.status || "completed").toLowerCase();
            const isTrans = Boolean(
                v.is_transferred ||
                s === "transferred" ||
                v.transfer_trail ||
                v.transferred_from_dept ||
                (Array.isArray(v.transfer_stages) && v.transfer_stages.length > 1)
            );
            if (isTrans) transferred++;
            if (s === "completed") completed++;
            else if (s === "no_show") noShow++;
            else if (s === "cancelled") cancelled++;
        });

        return { all: visits.length, completed, transferred, no_show: noShow, cancelled };
    }, [visits]);

    // Process visits file (both from input and drag-and-drop)
    const processVisitsFile = async (file) => {
        if (!file) return;
        setBulkFile(file);
        setBulkStatus(null);
        setIgnoredColumns([]);

        try {
            const rawRows = await parseSpreadsheetData(file);
            if (!rawRows || rawRows.length === 0) {
                setBulkParsedVisits([]);
                setBulkStatus({
                    success: false,
                    message: isHi ? "फ़ाइल में कोई डेटा पंक्ति नहीं मिली।" : "No data rows found in the spreadsheet.",
                });
                return;
            }

            // Identify all columns in the file and find which are extra/unrecognized
            const allOriginalHeaders = Object.keys(rawRows[0] || {});
            const ignored = [];
            const headerToFieldMap = {};

            for (const origHeader of allOriginalHeaders) {
                const cleanKey = String(origHeader).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
                let matchedField = null;
                for (const [canonicalField, aliases] of Object.entries(VISITS_FIELD_MAPPINGS)) {
                    if (aliases.includes(cleanKey)) {
                        matchedField = canonicalField;
                        break;
                    }
                }
                if (matchedField) {
                    headerToFieldMap[origHeader] = matchedField;
                } else {
                    ignored.push(origHeader);
                }
            }
            setIgnoredColumns(ignored);

            const normalized = rawRows.map((r, idx) => {
                // Extract only recognized/mapped fields, completely ignoring extra columns
                const fieldValues = {};
                for (const [origHeader, val] of Object.entries(r)) {
                    const targetField = headerToFieldMap[origHeader];
                    if (targetField) {
                        fieldValues[targetField] = typeof val === "string" ? val.trim() : String(val ?? "");
                    }
                }

                const patientName = fieldValues.patient_name || "";
                const phone = fieldValues.phone || "";
                const age = parseInt(fieldValues.age || 30, 10) || 30;
                const gender = (fieldValues.gender || "other").toLowerCase();
                const department = fieldValues.department || "consultation";
                const doctor = fieldValues.doctor_name || "Attending Consultant";
                const duration = parseFloat(fieldValues.service_duration_minutes || 12.0) || 12.0;
                const date = fieldValues.visit_date || new Date().toISOString().split("T")[0];
                const status = (fieldValues.status || "completed").toLowerCase();
                const symptoms = fieldValues.symptoms || "Routine Consultation";
                const prescription = fieldValues.prescription || "";

                // Return strictly ONLY the required fields, ignoring any extra fields
                return {
                    patient_name: patientName,
                    phone,
                    age,
                    gender,
                    department,
                    doctor_name: doctor,
                    service_duration_minutes: duration,
                    visit_date: date,
                    status,
                    symptoms,
                    prescription,
                };
            }).filter((v) => v.patient_name);

            setBulkParsedVisits(normalized);
            if (normalized.length === 0) {
                setBulkStatus({
                    success: false,
                    message: isHi
                        ? "फ़ाइल में कोई मान्य मरीज़ रिकॉर्ड नहीं मिला। कृपया सुनिश्चित करें कि 'Patient Name' जैसा कॉलम मौजूद है।"
                        : "No valid patient visit rows found in file. Please ensure column headers like 'Patient Name' exist.",
                });
            }
        } catch (err) {
            console.error("Failed to parse patient visits file:", err);
            setBulkStatus({
                success: false,
                message: `Failed to parse file: ${err.message}`,
            });
        }
    };

    // Handle Bulk File Selection & Parsing
    const handleBulkFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) processVisitsFile(file);
    };

    // Execute Bulk Visits Import
    const handleExecuteBulkImport = async () => {
        if (!bulkParsedVisits || bulkParsedVisits.length === 0) return;
        setBulkLoading(true);
        setBulkStatus(null);

        try {
            const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${tenantId}/visits/bulk`, {
                method: "POST",
                headers,
                body: JSON.stringify({ visits: bulkParsedVisits }),
            });
            const data = await res.json();
            setBulkLoading(false);

            if (res.ok && data.status === "success") {
                setBulkStatus({
                    success: true,
                    imported: data.imported_count,
                    skipped: data.skipped_count,
                    message: isHi
                        ? `${data.imported_count} मरीज़ विज़िट रिकॉर्ड्स सफलतापूर्वक आयात किए गए! (${data.skipped_count || 0} छोड़े गए)`
                        : `Successfully imported ${data.imported_count} patient visit records! (${data.skipped_count || 0} skipped)`,
                });

                if (notify) notify(isHi ? `${data.imported_count} विज़िट रिकॉर्ड्स जोड़े गए!` : `Imported ${data.imported_count} patient visit records!`);
                fetchVisits();
                if (fetchHospitalDeepDive) fetchHospitalDeepDive(tenantId, true);
            } else {
                setBulkStatus({
                    success: false,
                    message: data.message || "Failed to import patient visits.",
                });
            }
        } catch (err) {
            setBulkLoading(false);
            setBulkStatus({ success: false, message: err.message });
        }
    };

    // Download Sample Excel (.xlsx) Template for Patient Visits
    const handleDownloadVisitsExcelTemplate = () => {
        const sampleData = [
            {
                "Patient Name": "Ramesh Kumar",
                "Phone": "+91 98765 11111",
                "Age": 45,
                "Gender": "male",
                "Department": "consultation",
                "Doctor": "Dr. Rajesh Sharma",
                "Duration (Min)": 15,
                "Visit Date": "2026-10-01",
                "Status": "completed",
                "Symptoms": "Chest tightness & mild fatigue",
                "Prescription": "Tab Atorvastatin 20mg OD, EcoSprin 75mg OD. Advised ECG follow-up.",
            },
            {
                "Patient Name": "Sunita Devi",
                "Phone": "+91 98765 22222",
                "Age": 32,
                "Gender": "female",
                "Department": "consultation",
                "Doctor": "Dr. Anita Roy",
                "Duration (Min)": 10,
                "Visit Date": "2026-10-02",
                "Status": "completed",
                "Symptoms": "Persistent dry cough and mild fever",
                "Prescription": "Paracetamol 650mg SOS, Azithromycin 500mg OD for 3 days.",
            },
            {
                "Patient Name": "Vikram Singh",
                "Phone": "+91 98765 33333",
                "Age": 60,
                "Gender": "male",
                "Department": "orthopedics",
                "Doctor": "Dr. Sunil Mehta",
                "Duration (Min)": 20,
                "Visit Date": "2026-10-03",
                "Status": "completed",
                "Symptoms": "Left knee joint stiffness and pain",
                "Prescription": "Tab Chondroitin + Glucosamine, Hot compress twice daily.",
            },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Patient_Visits");
        XLSX.writeFile(wb, `sample_patient_visits_template_${tenantId}.xlsx`);
    };

    // Download Sample CSV (.csv) Template for Patient Visits
    const handleDownloadVisitsCsvTemplate = () => {
        const headers = [
            "Patient Name",
            "Phone",
            "Age",
            "Gender",
            "Department",
            "Doctor",
            "Duration (Min)",
            "Visit Date",
            "Status",
            "Symptoms",
            "Prescription",
        ];
        const rows = [
            headers.join(","),
            '"Ramesh Kumar","+91 98765 11111","45","male","consultation","Dr. Rajesh Sharma","15","2026-10-01","completed","Chest tightness & mild fatigue","Tab Atorvastatin 20mg OD, EcoSprin 75mg OD. Advised ECG follow-up."',
            '"Sunita Devi","+91 98765 22222","32","female","consultation","Dr. Anita Roy","10","2026-10-02","completed","Persistent dry cough and mild fever","Paracetamol 650mg SOS, Azithromycin 500mg OD for 3 days."',
            '"Vikram Singh","+91 98765 33333","60","male","orthopedics","Dr. Sunil Mehta","20","2026-10-03","completed","Left knee joint stiffness and pain","Tab Chondroitin + Glucosamine, Hot compress twice daily."',
        ];

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", csvContent);
        downloadAnchor.setAttribute("download", `sample_patient_visits_template_${tenantId}.csv`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.removeChild(downloadAnchor);
    };

    // 1-Click CSV Export fallback if not passed as prop
    const handleExportCsv = () => {
        if (handleDownloadVisitHistory) {
            handleDownloadVisitHistory(filteredVisits, hospName);
            return;
        }

        if (filteredVisits.length === 0) {
            const msg = isHi ? "डाउनलोड करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।" : "No patient visit records available to download.";
            if (notify) notify(msg, "warn");
            return;
        }

        const headers = [
            "Ticket ID",
            "Patient Name",
            "Age",
            "Gender",
            "Phone",
            "Department",
            "Doctor",
            "Visit Date & Time",
            "Consult Duration (Min)",
            "Status",
        ];

        const csvRows = [headers.join(",")];
        filteredVisits.forEach((v) => {
            const dateStr = v.created_at
                ? new Date(v.created_at).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : v.queue_date || "Today";

            const row = [
                `"${(v.ticket_id || `#${v.id}` || "").toString().replace(/"/g, '""')}"`,
                `"${(v.patient_name || "Patient").toString().replace(/"/g, '""')}"`,
                `"${(v.age || "").toString().replace(/"/g, '""')}"`,
                `"${(v.gender || "").toString().replace(/"/g, '""')}"`,
                `"${(v.phone || "").toString().replace(/"/g, '""')}"`,
                `"${(v.department || "General OPD").toString().replace(/"/g, '""')}"`,
                `"${(v.doctor_name || "Assigned Doctor").toString().replace(/"/g, '""')}"`,
                `"${dateStr.toString().replace(/"/g, '""')}"`,
                `"${(v.service_duration_minutes || "").toString().replace(/"/g, '""')}"`,
                `"${(v.status || "completed").toString().replace(/"/g, '""')}"`,
            ];
            csvRows.push(row.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
        const downloadAnchor = document.createElement("a");
        const safeHospName = (hospName || "Hospital").replace(/[^a-zA-Z0-9_-]/g, "_");
        const dateStamp = new Date().toISOString().split("T")[0];
        downloadAnchor.setAttribute("href", csvContent);
        downloadAnchor.setAttribute("download", `${safeHospName}_Patient_Visit_History_${dateStamp}.csv`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);

        if (notify) notify(isHi ? "मरीज़ विज़िट इतिहास CSV डाउनलोड हो गया!" : "Patient visit history CSV downloaded!");
    };

    const totalVisitsCount = summary.today_completed ?? summary.total_completed_today ?? visits.filter((v) => (v.status || "").toLowerCase() === "completed").length;
    const avgDuration = summary.avg_service_duration_minutes ?? (
        visits.length > 0
            ? (visits.reduce((acc, curr) => acc + (Number(curr.service_duration_minutes) || 12), 0) / visits.length).toFixed(1)
            : "14.5"
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* 1. TOP HEADER & TELEMETRY SUMMARY */}
            <div className="branding-section-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: "rgba(14, 165, 233, 0.15)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#0284C7"
                            }}>
                                <IconFileText size={18} />
                            </span>
                            <span>{isHi ? "पूर्व विज़िट किए गए मरीज़ों का डेटा व परामर्श लॉग" : "Previous Visited Patient Records & Consultation Archive"}</span>
                        </h3>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            onClick={fetchVisits}
                            disabled={loadingVisits}
                            style={{
                                padding: "9px 14px",
                                borderRadius: "10px",
                                border: "1.5px solid var(--superadmin-card-border, #CBD5E1)",
                                background: "var(--superadmin-card-bg, #FFFFFF)",
                                color: "var(--superadmin-text-main, #0F172A)",
                                fontSize: "12.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <IconRefresh size={14} className={loadingVisits ? "spin-animation" : ""} />
                            <span>{isHi ? "रीफ़्रेश" : "Refresh"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportCsv}
                            style={{
                                padding: "9px 18px",
                                borderRadius: "10px",
                                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                                color: "#FFFFFF",
                                border: "none",
                                fontSize: "13px",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
                            }}
                        >
                            <IconDownload size={15} />
                            <span>{isHi ? "विज़िट इतिहास CSV डाउनलोड करें" : "Download Visit History CSV"}</span>
                        </button>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                    marginTop: "20px",
                }}>
                    <div style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--superadmin-sub-card, #F8FAFC)", border: "1.5px solid var(--superadmin-card-border, #E2E8F0)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{isHi ? "कुल विज़िट रिकॉर्ड्स" : "Total Logged Visits"}</span>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", marginTop: "2px" }}>
                            {summary.total_patients_visited_all_time ?? visits.length}
                        </div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.08)", border: "1.5px solid rgba(16, 185, 129, 0.25)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>{isHi ? "आज पूर्ण परामर्श" : "Completed Consultations today"}</span>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#065F46", marginTop: "2px" }}>{totalVisitsCount}</div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(2, 132, 199, 0.08)", border: "1.5px solid rgba(2, 132, 199, 0.25)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284C7", textTransform: "uppercase" }}>{isHi ? "औसत परामर्श समय" : "Avg Consult Duration"}</span>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#0369A1", marginTop: "2px" }}>
                            {avgDuration} <span style={{ fontSize: "13px", fontWeight: 700 }}>min</span>
                        </div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(124, 58, 237, 0.08)", border: "1.5px solid rgba(124, 58, 237, 0.25)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#7C3AED", textTransform: "uppercase" }}>{isHi ? "सक्रिय कतार सुविधा" : "Facility Tenant Code"}</span>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "#5B21B6", marginTop: "4px", fontFamily: "monospace" }}>{tenantId}</div>
                    </div>
                </div>
            </div>

            {/* HERO BULK IMPORT PREVIOUS PATIENT VISITS (EXCEL / CSV) */}
            <div className="branding-section-card" style={{
                padding: "22px 24px",
                background: "linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%)",
                border: "1.5px solid rgba(2, 132, 199, 0.35)",
                borderRadius: "16px",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                            <span style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: "rgba(2, 132, 199, 0.15)",
                                color: "#0284C7",
                                fontWeight: 900,
                                fontSize: "11px",
                                letterSpacing: "0.6px",
                                textTransform: "uppercase",
                            }}>
                                Excel & CSV Ingestion
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--superadmin-text-sub, #64748B)" }}>
                                Hospital: <strong>{hospName}</strong> (<span style={{ fontFamily: "monospace" }}>{tenantId}</span>)
                            </span>
                        </div>
                        <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", display: "flex", alignItems: "center", gap: "8px" }}>
                            <IconDownload size={18} color="#0284C7" />
                            <span>{isHi ? "पूर्व मरीज़ विज़िट एवं परामर्श डेटा एक्सेल / CSV फ़ाइल से जोड़ें" : "Upload Previous Patient Visits Data (Excel / CSV)"}</span>
                        </h4>

                    </div>

                </div>

                {/* Drag-and-Drop Dropzone Box */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsHeroDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsHeroDragging(false); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsHeroDragging(false);
                        const file = e.dataTransfer?.files?.[0];
                        if (file) processVisitsFile(file);
                    }}
                    style={{
                        border: isHeroDragging ? "2px dashed #0284C7" : "2px dashed rgba(2, 132, 199, 0.4)",
                        borderRadius: "12px",
                        padding: "20px",
                        textAlign: "center",
                        background: isHeroDragging ? "rgba(2, 132, 199, 0.12)" : "rgba(255, 255, 255, 0.7)",
                        transition: "all 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                    }}
                >
                    <input
                        type="file"
                        id="hero-visits-file-input"
                        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                        onChange={handleBulkFileChange}
                        style={{ display: "none" }}
                    />
                    <label htmlFor="hero-visits-file-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "100%" }}>
                        <div style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "10px",
                            background: "rgba(2, 132, 199, 0.15)",
                            color: "#0284C7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <IconDownload size={20} />
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                            {bulkFile ? bulkFile.name : (isHi ? "मरीज़ विज़िट एक्सेल (.xlsx, .xls) या CSV फ़ाइल यहाँ चुनें अथवा ड्रैग करें" : "Click to select previous patient visits Excel (.xlsx, .xls) / CSV or drag & drop")}
                        </span>

                    </label>
                </div>

                {/* Parsed Visits Preview & Confirm Button */}
                {bulkParsedVisits.length > 0 && (
                    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 800, color: "#0284C7", display: "flex", alignItems: "center", gap: "6px" }}>
                                <IconCheckCircle size={16} />
                                <span>{bulkParsedVisits.length} {isHi ? "मरीज़ रिकॉर्ड्स आयात हेतु तैयार हैं" : "patient visit records extracted and ready to import"}</span>
                            </span>

                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBulkFile(null);
                                        setBulkParsedVisits([]);
                                        setBulkStatus(null);
                                        setIgnoredColumns([]);
                                    }}
                                    style={{
                                        padding: "7px 12px",
                                        borderRadius: "8px",
                                        border: "1px solid #CBD5E1",
                                        background: "transparent",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {isHi ? "रद्द करें" : "Clear"}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleExecuteBulkImport}
                                    disabled={bulkLoading}
                                    style={{
                                        padding: "8px 18px",
                                        borderRadius: "8px",
                                        background: bulkLoading ? "#94A3B8" : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                        color: "#FFFFFF",
                                        border: "none",
                                        cursor: bulkLoading ? "not-allowed" : "pointer",
                                        fontSize: "12.5px",
                                        fontWeight: 800,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                                    }}
                                >
                                    {bulkLoading ? <IconRefresh size={14} className="spin-animation" /> : <IconCheckCircle size={14} />}
                                    <span>{bulkLoading ? (isHi ? "आयात हो रहा है..." : "Importing Visits...") : (isHi ? `सभी ${bulkParsedVisits.length} रिकॉर्ड्स आयात करें` : `Confirm & Import ${bulkParsedVisits.length} Visits`)}</span>
                                </button>
                            </div>
                        </div>

                        {/* Auto-Filtered Extra Columns Banner */}
                        {ignoredColumns.length > 0 && (
                            <div style={{
                                padding: "8px 12px",
                                borderRadius: "8px",
                                background: "rgba(245, 158, 11, 0.09)",
                                border: "1px solid rgba(245, 158, 11, 0.28)",
                                color: "#B45309",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexWrap: "wrap",
                            }}>
                                <IconAlertTriangle size={15} color="#D97706" />
                                <span>
                                    <strong>{isHi ? "स्वतः फ़िल्टर किया गया:" : "Auto-Filtered:"}</strong>{" "}
                                    {isHi
                                        ? `अनावश्यक अतिरिक्त कॉलम सुरक्षित रूप से छोड़ दिए गए: ${ignoredColumns.join(", ")} (केवल आवश्यक विज़िट डेटा निकाला गया)`
                                        : `Safely ignored extra columns: ${ignoredColumns.join(", ")} (only required visit schema fields extracted)`}
                                </span>
                            </div>
                        )}

                        {/* Preview Table */}
                        <div style={{ overflowX: "auto", maxHeight: "190px", border: "1px solid var(--superadmin-card-border, #CBD5E1)", borderRadius: "10px", background: "var(--superadmin-card-bg, #FFFFFF)" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid #CBD5E1" }}>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Patient</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Phone</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Age / Gender</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Department</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Doctor</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Duration</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bulkParsedVisits.slice(0, 6).map((v, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                                            <td style={{ padding: "7px 10px", fontWeight: 700 }}>{v.patient_name}</td>
                                            <td style={{ padding: "7px 10px", color: "#64748B" }}>{v.phone || "—"}</td>
                                            <td style={{ padding: "7px 10px", textTransform: "capitalize" }}>{v.age}y / {v.gender}</td>
                                            <td style={{ padding: "7px 10px" }}>{v.department}</td>
                                            <td style={{ padding: "7px 10px", color: "#0284C7", fontWeight: 600 }}>{v.doctor_name}</td>
                                            <td style={{ padding: "7px 10px" }}>{v.service_duration_minutes}m</td>
                                            <td style={{ padding: "7px 10px", color: "#64748B" }}>{v.visit_date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {bulkParsedVisits.length > 6 && (
                            <span style={{ fontSize: "11px", color: "#64748B" }}>
                                Showing preview of first 6 of {bulkParsedVisits.length} rows...
                            </span>
                        )}
                    </div>
                )}

                {/* Bulk Status Alert */}
                {bulkStatus && (
                    <div style={{
                        marginTop: "12px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: bulkStatus.success ? "#ECFDF5" : "#FEF2F2",
                        border: `1px solid ${bulkStatus.success ? "#A7F3D0" : "#FCA5A5"}`,
                        color: bulkStatus.success ? "#065F46" : "#DC2626",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}>
                        {bulkStatus.success ? <IconCheckCircle size={16} /> : <IconAlertTriangle size={16} />}
                        <span>{bulkStatus.message}</span>
                    </div>
                )}
            </div>

            {/* 2. SEARCH & FILTER SECTION */}
            <div className="branding-section-card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
                        <div style={{ position: "relative", width: "100%" }}>
                            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
                                <IconSearch size={16} />
                            </span>
                            <input
                                type="text"
                                placeholder={isHi ? "मरीज़ का नाम, फ़ोन, टोकन आईडी या डॉक्टर से खोजें..." : "Search by patient name, phone, ticket ID, or doctor..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    ...fieldInputStyle,
                                    paddingLeft: "36px",
                                    fontSize: "13px",
                                    width: "100%",
                                }}
                            />
                        </div>
                    </div>

                    {/* Status Filter Pills */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {[
                            { id: "all", label: isHi ? `सभी विज़िट (${statusCounts.all})` : `All Visits (${statusCounts.all})` },
                            { id: "completed", label: isHi ? `सफल (${statusCounts.completed})` : `Completed (${statusCounts.completed})` },
                            { id: "transferred", label: isHi ? `स्थानांतरित (${statusCounts.transferred})` : `Transferred (${statusCounts.transferred})` },
                            { id: "no_show", label: isHi ? `नो-शो (${statusCounts.no_show})` : `No-Show (${statusCounts.no_show})` },
                            { id: "cancelled", label: isHi ? `रद्द (${statusCounts.cancelled})` : `Cancelled (${statusCounts.cancelled})` },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setStatusFilter(item.id)}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    border: statusFilter === item.id ? "1.5px solid #0284C7" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                                    background: statusFilter === item.id ? "rgba(2, 132, 199, 0.1)" : "var(--superadmin-card-bg, #FFFFFF)",
                                    color: statusFilter === item.id ? "#0284C7" : "var(--superadmin-text-sub, #64748B)",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. VISITS TABLE */}
                <div style={{ marginTop: "16px", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                        <thead>
                            <tr style={{ background: "var(--superadmin-sub-card, #F8FAFC)", borderBottom: "1.5px solid var(--superadmin-card-border, #E2E8F0)" }}>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "टोकन व तारीख" : "Ticket & Timestamp"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "मरीज़ का नाम व विवरण" : "Patient Demographics"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "विभाग व डॉक्टर" : "Department & Doctor"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "परामर्श अवधि" : "Duration"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "स्थिति" : "Status"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", textAlign: "right" }}>{isHi ? "विवरण" : "Details"}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVisits.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#94A3B8" }}>
                                        {loadingVisits
                                            ? (isHi ? "मरीज़ विज़िट इतिहास लोड हो रहा है..." : "Loading visit logs...")
                                            : (isHi ? "कोई विज़िट रिकॉर्ड नहीं मिला।" : "No patient visit records found matching criteria.")}
                                    </td>
                                </tr>
                            ) : (
                                filteredVisits.map((visit, idx) => {
                                    const dateStr = visit.created_at
                                        ? new Date(visit.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                                        : visit.queue_date || "Today";
                                    const statusVal = (visit.status || "completed").toLowerCase();
                                    const isCompleted = statusVal === "completed" || statusVal === "served";
                                    const isCancelled = statusVal === "cancelled" || statusVal === "no_show";

                                    return (
                                        <tr key={visit.id || visit.ticket_id || idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", transition: "background 0.15s ease" }}>
                                            <td style={{ padding: "12px 14px" }}>
                                                <div style={{ fontWeight: 800, color: "#0284C7", fontFamily: "monospace", fontSize: "13.5px" }}>
                                                    {visit.ticket_id || `#${visit.id}`}
                                                </div>
                                                <div style={{ fontSize: "11px", color: "#64748B", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                                    <IconClock size={11} />
                                                    <span>{dateStr}</span>
                                                </div>
                                            </td>

                                            <td style={{ padding: "12px 14px" }}>
                                                <div style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                                    {visit.patient_name || "Walk-in Patient"}
                                                </div>
                                                <div style={{ fontSize: "11.5px", color: "#64748B" }}>
                                                    {visit.age ? `${visit.age} yrs` : ""} {visit.gender ? `• ${visit.gender}` : ""} {visit.phone ? `• ${visit.phone}` : ""}
                                                </div>
                                            </td>

                                            <td style={{ padding: "12px 14px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <span style={{ fontWeight: 700, color: "var(--superadmin-text-main, #0F172A)" }}>
                                                        {visit.department || "General OPD"}
                                                    </span>
                                                    {visit.is_transferred && (
                                                        <span
                                                            style={{
                                                                fontSize: "10px",
                                                                fontWeight: 800,
                                                                padding: "2px 6px",
                                                                borderRadius: "5px",
                                                                background: "#EFF6FF",
                                                                color: "#0284C7",
                                                                border: "1px solid #BAE6FD",
                                                                letterSpacing: "0.2px",
                                                            }}
                                                            title={visit.transfer_trail || `Transferred from ${visit.transferred_from_dept}`}
                                                        >
                                                            {isHi ? "स्थानांतरित" : "Transferred"}
                                                        </span>
                                                    )}
                                                </div>
                                                {visit.transfer_trail ? (
                                                    <div style={{ fontSize: "11px", color: "#0284C7", fontWeight: 700, marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                                        <span>🔄</span>
                                                        <span>{visit.transfer_trail}</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: "11.5px", color: "#059669", display: "flex", alignItems: "center", gap: "4px" }}>
                                                        <IconStethoscope size={12} />
                                                        <span>{visit.doctor_name || "Consultant"}</span>
                                                    </div>
                                                )}
                                            </td>

                                            <td style={{ padding: "12px 14px" }}>
                                                <div style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                                    {visit.service_duration_minutes ? `${Number(visit.service_duration_minutes).toFixed(0)} min` : "12 min"}
                                                </div>
                                                {visit.wait_time_minutes && (
                                                    <div style={{ fontSize: "11px", color: "#64748B" }}>
                                                        Wait: {visit.wait_time_minutes}m
                                                    </div>
                                                )}
                                            </td>

                                            <td style={{ padding: "12px 14px" }}>
                                                <span style={{
                                                    fontSize: "11px",
                                                    fontWeight: 800,
                                                    padding: "3px 8px",
                                                    borderRadius: "6px",
                                                    background: isCompleted ? "#DEF7EC" : isCancelled ? "#FEE2E2" : "#FEF3C7",
                                                    color: isCompleted ? "#03543F" : isCancelled ? "#991B1B" : "#92400E",
                                                    textTransform: "capitalize",
                                                }}>
                                                    {visit.status || "Completed"}
                                                </span>
                                            </td>

                                            <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedVisitDetail(visit)}
                                                    style={{
                                                        padding: "5px 10px",
                                                        borderRadius: "8px",
                                                        border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                        background: "var(--superadmin-card-bg, #FFFFFF)",
                                                        color: "#0284C7",
                                                        fontSize: "11.5px",
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    {isHi ? "पर्ची देखें" : "View Slip"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. BULK CSV IMPORT MODAL FOR VISITS */}
            {showBulkModal && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.65)",
                    backdropFilter: "blur(4px)",
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px",
                }}>
                    <div style={{
                        background: "var(--superadmin-card-bg, #FFFFFF)",
                        borderRadius: "18px",
                        maxWidth: "750px",
                        width: "100%",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        padding: "26px",
                        boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
                        border: "1.5px solid var(--superadmin-card-border, #CBD5E1)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <IconDownload size={20} color="#0284C7" />
                                    <span>{isHi ? "CSV/Excel फ़ाइल से पूर्व विज़िट डेटा आयात करें" : "Upload Patient Visit Logs from CSV / Excel"}</span>
                                </h3>
                                <span style={{ fontSize: "12px", color: "var(--superadmin-text-sub, #64748B)" }}>
                                    Target Facility: <strong>{hospName}</strong> ({tenantId})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBulkModal(false);
                                    setIgnoredColumns([]);
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        {/* File Upload Box & Template Links */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsModalDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsModalDragging(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsModalDragging(false);
                                const file = e.dataTransfer?.files?.[0];
                                if (file) processVisitsFile(file);
                            }}
                            style={{
                                border: isModalDragging ? "2px dashed #0284C7" : "2px dashed var(--superadmin-card-border, #CBD5E1)",
                                borderRadius: "14px",
                                padding: "22px",
                                textAlign: "center",
                                background: isModalDragging ? "rgba(2, 132, 199, 0.1)" : "var(--superadmin-sub-card, #F8FAFC)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "10px",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <input
                                type="file"
                                id="visits-csv-upload-input"
                                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                onChange={handleBulkFileChange}
                                style={{ display: "none" }}
                            />
                            <label htmlFor="visits-csv-upload-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "100%" }}>
                                <div style={{
                                    width: "44px",
                                    height: "44px",
                                    borderRadius: "12px",
                                    background: "rgba(2, 132, 199, 0.15)",
                                    color: "#0284C7",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}>
                                    <IconDownload size={20} />
                                </div>
                                <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                    {bulkFile ? bulkFile.name : (isHi ? "मरीज़ विज़िट एक्सेल (.xlsx, .xls) या CSV फ़ाइल चुनें या यहाँ ड्रैग करें" : "Choose Patient Visits Excel (.xlsx, .xls) / CSV or drag & drop")}
                                </span>

                            </label>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px", flexWrap: "wrap", justifyContent: "center" }}>
                                <button
                                    type="button"
                                    onClick={handleDownloadVisitsExcelTemplate}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#0284C7",
                                        fontSize: "12px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                    }}
                                >
                                    📥 {isHi ? "सैंपल एक्सेल (.xlsx) डाउनलोड करें" : "Download Sample Excel (.xlsx)"}
                                </button>
                                <span style={{ color: "#CBD5E1" }}>|</span>
                                <button
                                    type="button"
                                    onClick={handleDownloadVisitsCsvTemplate}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#64748B",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                    }}
                                >
                                    📥 {isHi ? "सैंपल CSV (.csv) डाउनलोड करें" : "Download Sample CSV (.csv)"}
                                </button>
                            </div>
                        </div>

                        {/* Preview of Parsed Visit Rows */}
                        {bulkParsedVisits.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#059669" }}>
                                        ✓ {bulkParsedVisits.length} {isHi ? "मरीज़ रिकॉर्ड्स आयात हेतु तैयार हैं" : "patient visit records ready to import"}
                                    </span>
                                </div>

                                {/* Auto-Filtered Extra Columns Banner in Modal */}
                                {ignoredColumns.length > 0 && (
                                    <div style={{
                                        padding: "8px 12px",
                                        borderRadius: "8px",
                                        background: "rgba(245, 158, 11, 0.09)",
                                        border: "1px solid rgba(245, 158, 11, 0.28)",
                                        color: "#B45309",
                                        fontSize: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        flexWrap: "wrap",
                                    }}>
                                        <IconAlertTriangle size={15} color="#D97706" />
                                        <span>
                                            <strong>{isHi ? "स्वतः फ़िल्टर किया गया:" : "Auto-Filtered:"}</strong>{" "}
                                            {isHi
                                                ? `अनावश्यक अतिरिक्त कॉलम छोड़ दिए गए: ${ignoredColumns.join(", ")} (केवल आवश्यक विज़िट डेटा निकाला गया)`
                                                : `Safely ignored extra columns: ${ignoredColumns.join(", ")} (only required visit schema fields extracted)`}
                                        </span>
                                    </div>
                                )}

                                <div style={{ overflowX: "auto", maxHeight: "190px", border: "1px solid var(--superadmin-card-border, #CBD5E1)", borderRadius: "10px" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                                        <thead>
                                            <tr style={{ background: "rgba(0,0,0,0.04)", borderBottom: "1px solid #CBD5E1" }}>
                                                <th style={{ padding: "8px 10px" }}>Patient</th>
                                                <th style={{ padding: "8px 10px" }}>Phone</th>
                                                <th style={{ padding: "8px 10px" }}>Dept</th>
                                                <th style={{ padding: "8px 10px" }}>Doctor</th>
                                                <th style={{ padding: "8px 10px" }}>Duration</th>
                                                <th style={{ padding: "8px 10px" }}>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkParsedVisits.slice(0, 5).map((v, idx) => (
                                                <tr key={idx} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                                                    <td style={{ padding: "7px 10px", fontWeight: 700 }}>{v.patient_name}</td>
                                                    <td style={{ padding: "7px 10px", color: "#64748B" }}>{v.phone || "N/A"}</td>
                                                    <td style={{ padding: "7px 10px" }}>{v.department}</td>
                                                    <td style={{ padding: "7px 10px", color: "#059669" }}>{v.doctor_name}</td>
                                                    <td style={{ padding: "7px 10px", fontWeight: 700 }}>{v.service_duration_minutes}m</td>
                                                    <td style={{ padding: "7px 10px", color: "#64748B" }}>{v.visit_date}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {bulkParsedVisits.length > 5 && (
                                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                                        Showing first 5 of {bulkParsedVisits.length} rows...
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Bulk Status Feedback */}
                        {bulkStatus && (
                            <div style={{
                                padding: "12px 14px",
                                borderRadius: "10px",
                                background: bulkStatus.success ? "#ECFDF5" : "#FEF2F2",
                                border: `1px solid ${bulkStatus.success ? "#A7F3D0" : "#FCA5A5"}`,
                                color: bulkStatus.success ? "#065F46" : "#DC2626",
                                fontSize: "12.5px",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}>
                                {bulkStatus.success ? <IconCheckCircle size={16} /> : <IconAlertTriangle size={16} />}
                                <span>{bulkStatus.message}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                            <button
                                type="button"
                                onClick={() => setShowBulkModal(false)}
                                style={{
                                    padding: "9px 16px",
                                    borderRadius: "10px",
                                    border: "1px solid #CBD5E1",
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: "12.5px",
                                    fontWeight: 700,
                                }}
                            >
                                {isHi ? "बंद करें" : "Close"}
                            </button>

                            <button
                                type="button"
                                onClick={handleExecuteBulkImport}
                                disabled={bulkLoading || bulkParsedVisits.length === 0}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: "10px",
                                    background: bulkLoading || bulkParsedVisits.length === 0 ? "#94A3B8" : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                    color: "#FFFFFF",
                                    border: "none",
                                    cursor: bulkLoading || bulkParsedVisits.length === 0 ? "not-allowed" : "pointer",
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                {bulkLoading ? <IconRefresh size={14} className="spin-animation" /> : <IconDownload size={14} />}
                                <span>{bulkLoading ? (isHi ? "आयात किया जा रहा है..." : "Importing Visits...") : (isHi ? `सभी ${bulkParsedVisits.length} विज़िट आयात करें` : `Confirm & Import ${bulkParsedVisits.length} Records`)}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. REDESIGNED CLINICAL SLIP MODAL */}
            {selectedVisitDetail && (() => {
                const stages = Array.isArray(selectedVisitDetail.transfer_stages) ? selectedVisitDetail.transfer_stages : [];
                const isMultiStage = stages.length > 1;
                const statusVal = (selectedVisitDetail.status || "completed").toLowerCase();
                const isCompleted = statusVal === "completed" || statusVal === "served";

                // Extract or synthesize slip data for official printing & downloading
                const slipExportData = (() => {
                    let docName = selectedVisitDetail.doctor_name || "Attending Medical Officer";
                    let docDept = selectedVisitDetail.department || "General OPD";
                    let docId = "DOC-1";
                    let diagnosis = selectedVisitDetail.medical_condition || selectedVisitDetail.symptoms || "Clinical Consultation & OPD Assessment";
                    let advice = "";
                    let followUp = "";
                    const allMeds = [];
                    const seenMeds = new Set();
                    const labTests = [];

                    stages.forEach((stg) => {
                        const parsed = parseClinicalRecord(stg.notes);
                        if (parsed) {
                            if (parsed.doctor_name && parsed.doctor_name !== "Attending Medical Officer") docName = parsed.doctor_name;
                            if (parsed.doctor_department) docDept = parsed.doctor_department;
                            if (parsed.doctor_employee_id) docId = parsed.doctor_employee_id;
                            if (parsed.diagnosis && parsed.diagnosis !== "Consultation & Clinical Assessment") diagnosis = parsed.diagnosis;
                            if (parsed.advice && parsed.advice.trim()) {
                                advice = advice ? `${advice} • ${parsed.advice}` : parsed.advice;
                            }
                            if (parsed.follow_up) followUp = parsed.follow_up;
                            if (parsed.lab_tests && parsed.lab_tests !== "no") labTests.push(parsed.lab_tests);
                            if (Array.isArray(parsed.medicines)) {
                                parsed.medicines.forEach((m) => {
                                    const k = `${m.name || ""}_${m.dosage || ""}`;
                                    if (!seenMeds.has(k)) {
                                        seenMeds.add(k);
                                        allMeds.push(m);
                                    }
                                });
                            }
                        }
                    });

                    if (selectedVisitDetail.prescription) {
                        const topParsed = parseClinicalRecord(selectedVisitDetail.prescription);
                        if (topParsed) {
                            if (topParsed.doctor_name) docName = topParsed.doctor_name;
                            if (topParsed.diagnosis) diagnosis = topParsed.diagnosis;
                            if (topParsed.advice) advice = advice ? `${advice} • ${topParsed.advice}` : topParsed.advice;
                            if (Array.isArray(topParsed.medicines)) {
                                topParsed.medicines.forEach((m) => {
                                    const k = `${m.name || ""}_${m.dosage || ""}`;
                                    if (!seenMeds.has(k)) {
                                        seenMeds.add(k);
                                        allMeds.push(m);
                                    }
                                });
                            }
                        }
                    }

                    return {
                        patient_name: selectedVisitDetail.patient_name || "Patient",
                        age: selectedVisitDetail.age || 30,
                        gender: selectedVisitDetail.gender || "male",
                        phone: selectedVisitDetail.phone || "",
                        ticket_id: selectedVisitDetail.ticket_id || `#${selectedVisitDetail.id}`,
                        doctor_name: docName,
                        doctor_department: docDept,
                        doctor_employee_id: docId,
                        diagnosis: diagnosis,
                        medicines: allMeds,
                        lab_tests: labTests.join(", "),
                        advice: advice || "Consultation completed. Regular medical review as advised.",
                        follow_up: followUp || "After 5 days or if needed",
                        prescribed_at: selectedVisitDetail.created_at || selectedVisitDetail.queue_date || new Date().toISOString(),
                        hospital_name: hospName,
                        logo_url: currentHosp?.logo_url || currentHosp?.hospital_logo || "",
                    };
                })();

                return (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15, 23, 42, 0.65)",
                        backdropFilter: "blur(6px)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px",
                    }}>
                        <div style={{
                            background: "#FFFFFF",
                            borderRadius: "20px",
                            maxWidth: "700px",
                            width: "100%",
                            maxHeight: "92vh",
                            boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(226, 232, 240, 0.8)",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        }}>
                            {/* MODAL HEADER */}
                            <div style={{
                                padding: "18px 24px",
                                borderBottom: "1.5px solid #E2E8F0",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    <div style={{
                                        width: "42px",
                                        height: "42px",
                                        borderRadius: "12px",
                                        background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                        color: "#FFFFFF",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontWeight: 900,
                                        fontSize: "22px",
                                        fontFamily: "serif",
                                        boxShadow: "0 4px 10px rgba(2, 132, 199, 0.3)",
                                        flexShrink: 0,
                                    }}>
                                        ℞
                                    </div>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#0F172A", letterSpacing: "-0.2px" }}>
                                                {isHi ? "मरीज़ क्लिनिकल परामर्श रिकॉर्ड" : "Clinical Consultation Record"}
                                            </h3>
                                            <span style={{
                                                fontSize: "12px",
                                                color: "#0284C7",
                                                fontFamily: "monospace",
                                                fontWeight: 800,
                                                background: "#E0F2FE",
                                                padding: "2px 8px",
                                                borderRadius: "6px",
                                                border: "1px solid #BAE6FD",
                                            }}>
                                                Token #{selectedVisitDetail.ticket_id || selectedVisitDetail.id}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: "11.5px", color: "#64748B", marginTop: "2px" }}>
                                            {hospName} • <span style={{ fontFamily: "monospace" }}>{tenantId}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    {isMultiStage ? (
                                        <span style={{
                                            fontSize: "11px",
                                            fontWeight: 800,
                                            padding: "4px 10px",
                                            borderRadius: "8px",
                                            background: "#EFF6FF",
                                            color: "#0284C7",
                                            border: "1.5px solid #BAE6FD",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "5px",
                                        }}>
                                            <span>🔄</span>
                                            <span>Multi-Dept Transfer ({stages.length} Stages)</span>
                                        </span>
                                    ) : (
                                        <span style={{
                                            fontSize: "11px",
                                            fontWeight: 800,
                                            padding: "4px 10px",
                                            borderRadius: "8px",
                                            background: isCompleted ? "#DEF7EC" : "#FEF3C7",
                                            color: isCompleted ? "#03543F" : "#92400E",
                                            border: `1.5px solid ${isCompleted ? "#A7F3D0" : "#FDE68A"}`,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "5px",
                                        }}>
                                            <span>{isCompleted ? "✓" : "⏳"}</span>
                                            <span style={{ textTransform: "capitalize" }}>{selectedVisitDetail.status || "Completed"}</span>
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setSelectedVisitDetail(null)}
                                        style={{
                                            width: "32px",
                                            height: "32px",
                                            borderRadius: "50%",
                                            background: "#F1F5F9",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "#64748B",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "background 0.15s ease",
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "#E2E8F0"; e.currentTarget.style.color = "#0F172A"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.color = "#64748B"; }}
                                    >
                                        <IconX size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* MODAL BODY (SCROLLABLE) */}
                            <div style={{
                                padding: "20px 24px",
                                overflowY: "auto",
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                            }}>
                                {/* PATIENT DEMOGRAPHICS TILES */}
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                    gap: "12px",
                                    background: "#F8FAFC",
                                    padding: "14px 16px",
                                    borderRadius: "14px",
                                    border: "1.5px solid #E2E8F0",
                                }}>
                                    <div>
                                        <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                            {isHi ? "मरीज़ विवरण" : "Patient Demographics"}
                                        </div>
                                        <div style={{ fontSize: "14px", fontWeight: 900, color: "#0F172A", marginTop: "3px" }}>
                                            {selectedVisitDetail.patient_name || "Patient"}
                                        </div>
                                        <div style={{ fontSize: "11.5px", color: "#64748B", marginTop: "2px" }}>
                                            {selectedVisitDetail.age ? `${selectedVisitDetail.age} yrs` : "N/A"} • {selectedVisitDetail.gender || "male"} • Phone: {selectedVisitDetail.phone || "N/A"}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                            {isHi ? "विजिट विभाग व डॉक्टर" : "Department & Doctor"}
                                        </div>
                                        <div style={{ fontSize: "14px", fontWeight: 800, color: "#0284C7", marginTop: "3px" }}>
                                            {selectedVisitDetail.department || "General OPD"}
                                        </div>
                                        <div style={{ fontSize: "11.5px", color: "#475569", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                            <IconStethoscope size={12} color="#059669" />
                                            <span>{selectedVisitDetail.doctor_name || "Attending Medical Officer"}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                            {isHi ? "अवधि व समय" : "Duration & Date"}
                                        </div>
                                        <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#0F172A", marginTop: "3px" }}>
                                            ⏱️ {selectedVisitDetail.service_duration_minutes ? `${Number(selectedVisitDetail.service_duration_minutes).toFixed(1)} min` : "10 min"}
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                                            {selectedVisitDetail.created_at ? new Date(selectedVisitDetail.created_at).toLocaleString() : (selectedVisitDetail.queue_date || "Today")}
                                        </div>
                                    </div>
                                </div>

                                {/* MULTI-STAGE DEPARTMENT TRANSFER JOURNEY TIMELINE */}
                                {isMultiStage && (
                                    <div style={{
                                        padding: "16px 18px",
                                        borderRadius: "14px",
                                        background: "linear-gradient(135deg, rgba(2, 132, 199, 0.04) 0%, rgba(14, 165, 233, 0.02) 100%)",
                                        border: "1.5px solid #BAE6FD",
                                    }}>
                                        <div style={{
                                            fontSize: "12.5px",
                                            fontWeight: 900,
                                            color: "#0369A1",
                                            marginBottom: "14px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "15px" }}>🔄</span>
                                                <span>{isHi ? "स्थानांतरण परामर्श यात्रा (मल्टी-डिपार्टमेंट टाइमलाइन)" : "Transfer Journey (Multi-Department Clinical Timeline)"}</span>
                                            </div>
                                            <span style={{
                                                fontSize: "11px",
                                                fontWeight: 800,
                                                background: "#0284C7",
                                                color: "#FFFFFF",
                                                padding: "2px 8px",
                                                borderRadius: "10px",
                                            }}>
                                                {stages.length} Stages
                                            </span>
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}>
                                            {stages.map((stg, sIdx) => {
                                                const isLatest = sIdx === stages.length - 1;
                                                const parsed = parseClinicalRecord(stg.notes);
                                                const isTransferred = (stg.status || "").toLowerCase() === "transferred";
                                                const stageMeds = Array.isArray(parsed?.medicines) ? parsed.medicines : [];

                                                return (
                                                    <div key={sIdx} style={{ display: "flex", alignItems: "flex-start", gap: "12px", position: "relative" }}>
                                                        {/* Stage Step Icon / Connector */}
                                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                                                            <div style={{
                                                                width: "28px",
                                                                height: "28px",
                                                                borderRadius: "50%",
                                                                background: isLatest ? "#0284C7" : "#0369A1",
                                                                color: "#FFFFFF",
                                                                fontSize: "12px",
                                                                fontWeight: 900,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                boxShadow: isLatest ? "0 0 0 4px rgba(2, 132, 199, 0.2)" : "none",
                                                            }}>
                                                                {stg.stage_number || sIdx + 1}
                                                            </div>
                                                            {sIdx < stages.length - 1 && (
                                                                <div style={{
                                                                    width: "2px",
                                                                    flexGrow: 1,
                                                                    minHeight: "36px",
                                                                    background: "#BAE6FD",
                                                                    marginTop: "4px",
                                                                }} />
                                                            )}
                                                        </div>

                                                        {/* Stage Body Card */}
                                                        <div style={{
                                                            flex: 1,
                                                            minWidth: 0,
                                                            background: "#FFFFFF",
                                                            padding: "12px 14px",
                                                            borderRadius: "12px",
                                                            border: "1.5px solid #E2E8F0",
                                                            boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            gap: "8px",
                                                        }}>
                                                            {/* Stage Title Header */}
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                                    <strong style={{ color: "#0F172A", fontSize: "13.5px", fontWeight: 800 }}>
                                                                        {stg.department}
                                                                    </strong>
                                                                    <span style={{ fontSize: "11px", color: "#0284C7", fontFamily: "monospace", fontWeight: 700 }}>
                                                                        Ticket: {stg.ticket_id}
                                                                    </span>
                                                                    {stg.duration_minutes ? (
                                                                        <span style={{ fontSize: "11px", color: "#64748B" }}>
                                                                            • ~{stg.duration_minutes}m
                                                                        </span>
                                                                    ) : null}
                                                                </div>

                                                                <span style={{
                                                                    fontSize: "10.5px",
                                                                    fontWeight: 800,
                                                                    padding: "2px 8px",
                                                                    borderRadius: "6px",
                                                                    background: isTransferred ? "#FEF3C7" : "#DEF7EC",
                                                                    color: isTransferred ? "#92400E" : "#03543F",
                                                                    border: `1px solid ${isTransferred ? "#FDE68A" : "#A7F3D0"}`,
                                                                    textTransform: "uppercase",
                                                                }}>
                                                                    {stg.status}
                                                                </span>
                                                            </div>

                                                            {/* Doctor Badge */}
                                                            <div style={{ fontSize: "12px", color: "#475569", display: "flex", alignItems: "center", gap: "6px" }}>
                                                                <IconStethoscope size={13} color="#0284C7" />
                                                                <span style={{ fontWeight: 700, color: "#0F172A" }}>
                                                                    {parsed?.doctor_name || "Attending Medical Officer"}
                                                                </span>
                                                                {parsed?.doctor_employee_id && (
                                                                    <span style={{ fontSize: "10.5px", color: "#64748B", background: "#F1F5F9", padding: "1px 6px", borderRadius: "4px" }}>
                                                                        {parsed.doctor_employee_id}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Diagnosis */}
                                                            {parsed?.diagnosis && (
                                                                <div style={{
                                                                    fontSize: "12px",
                                                                    background: "#F0FDF4",
                                                                    border: "1px solid #BBF7D0",
                                                                    padding: "6px 10px",
                                                                    borderRadius: "8px",
                                                                    color: "#166534",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "6px",
                                                                }}>
                                                                    <strong>📋 Diagnosis:</strong>
                                                                    <span>{parsed.diagnosis}</span>
                                                                </div>
                                                            )}

                                                            {/* Prescribed Medicines (if any) */}
                                                            {stageMeds.length > 0 && (
                                                                <div style={{ marginTop: "2px" }}>
                                                                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: "4px" }}>
                                                                        ℞ Prescribed Medicines ({stageMeds.length}):
                                                                    </div>
                                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                                                        {stageMeds.map((med, mIdx) => (
                                                                            <span key={mIdx} style={{
                                                                                fontSize: "11.5px",
                                                                                padding: "4px 8px",
                                                                                borderRadius: "6px",
                                                                                background: "#EFF6FF",
                                                                                color: "#1E40AF",
                                                                                border: "1px solid #BFDBFE",
                                                                                display: "inline-flex",
                                                                                alignItems: "center",
                                                                                gap: "4px",
                                                                            }}>
                                                                                <strong>{med.name}</strong>
                                                                                {med.dosage && <span>• {med.dosage}</span>}
                                                                                {med.frequency && <span style={{ color: "#0284C7" }}>[{med.frequency}]</span>}
                                                                                {med.duration && <span>({med.duration})</span>}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Lab tests */}
                                                            {parsed?.lab_tests && parsed.lab_tests !== "no" && (
                                                                <div style={{ fontSize: "11.5px", color: "#0369A1", background: "#F0F9FF", padding: "5px 9px", borderRadius: "6px", border: "1px solid #BAE6FD" }}>
                                                                    <strong>🧪 Investigations / Lab:</strong> {parsed.lab_tests}
                                                                </div>
                                                            )}

                                                            {/* Doctor's Advice */}
                                                            {parsed?.advice && parsed.advice.trim() && (
                                                                <div style={{ fontSize: "11.5px", color: "#166534", background: "#F0FDF4", padding: "5px 9px", borderRadius: "6px", border: "1px solid #BBF7D0" }}>
                                                                    <strong>💡 Doctor's Advice:</strong> {parsed.advice}
                                                                </div>
                                                            )}

                                                            {/* Follow-up */}
                                                            {parsed?.follow_up && (
                                                                <div style={{ fontSize: "11.5px", color: "#64748B" }}>
                                                                    <strong>🗓️ Follow-up:</strong> {parsed.follow_up}
                                                                </div>
                                                            )}

                                                            {/* Transfer Note / Target Department */}
                                                            {(parsed?.target_department || parsed?.transfer_notes) && (
                                                                <div style={{
                                                                    fontSize: "11.5px",
                                                                    color: "#92400E",
                                                                    background: "#FFFBEB",
                                                                    padding: "6px 9px",
                                                                    borderRadius: "6px",
                                                                    border: "1px solid #FDE68A",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "6px",
                                                                }}>
                                                                    <span>➡️</span>
                                                                    <span>
                                                                        <strong>Transferred to:</strong> {parsed.target_department || "Next Department"}
                                                                        {parsed.transfer_notes ? ` • Note: "${parsed.transfer_notes}"` : ""}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Unparsed Plain Text Notes */}
                                                            {parsed?.rawText && !parsed?.doctor_name && (
                                                                <div style={{ fontSize: "11.5px", color: "#334155", background: "#F8FAFC", padding: "6px 9px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                                                                    <strong>Notes:</strong> {parsed.rawText}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* SYMPTOMS / TRIAGE NOTES */}
                                {selectedVisitDetail.symptoms && (
                                    <div style={{
                                        padding: "12px 14px",
                                        borderRadius: "12px",
                                        background: "#F8FAFC",
                                        border: "1.5px solid #E2E8F0",
                                    }}>
                                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                                            Symptoms / Triage Chief Complaints:
                                        </div>
                                        <div style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600 }}>
                                            {selectedVisitDetail.symptoms}
                                        </div>
                                    </div>
                                )}

                                {/* STANDALONE PRESCRIPTION (WHEN NOT A MULTI-STAGE TRANSFER OR TOP-LEVEL RX) */}
                                {!isMultiStage && selectedVisitDetail.prescription && (() => {
                                    const parsedRx = parseClinicalRecord(selectedVisitDetail.prescription);
                                    const rxMeds = Array.isArray(parsedRx?.medicines) ? parsedRx.medicines : [];
                                    return (
                                        <div style={{
                                            padding: "14px 16px",
                                            borderRadius: "14px",
                                            background: "#F0FDF4",
                                            border: "1.5px solid #BBF7D0",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                        }}>
                                            <div style={{ fontSize: "12.5px", fontWeight: 900, color: "#166534", display: "flex", alignItems: "center", gap: "6px" }}>
                                                <span>℞</span>
                                                <span>Clinical E-Prescription & Care Plan</span>
                                            </div>

                                            {parsedRx?.diagnosis && (
                                                <div style={{ fontSize: "12.5px", color: "#15803D" }}>
                                                    <strong>Diagnosis:</strong> {parsedRx.diagnosis}
                                                </div>
                                            )}

                                            {rxMeds.length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#166534", textTransform: "uppercase", marginBottom: "4px" }}>
                                                        Prescribed Medications:
                                                    </div>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                                        {rxMeds.map((med, idx) => (
                                                            <span key={idx} style={{
                                                                fontSize: "11.5px",
                                                                padding: "4px 8px",
                                                                borderRadius: "6px",
                                                                background: "#DCFCE7",
                                                                color: "#166534",
                                                                border: "1px solid #86EFAC",
                                                                fontWeight: 700,
                                                            }}>
                                                                {med.name} {med.dosage ? `• ${med.dosage}` : ""} {med.frequency ? `[${med.frequency}]` : ""}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {parsedRx?.advice && (
                                                <div style={{ fontSize: "12px", color: "#166534" }}>
                                                    <strong>Advice:</strong> {parsedRx.advice}
                                                </div>
                                            )}

                                            {parsedRx?.rawText && !parsedRx?.diagnosis && (
                                                <div style={{ fontSize: "12.5px", color: "#166534", whiteSpace: "pre-wrap" }}>
                                                    {parsedRx.rawText}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* MODAL FOOTER WITH PRINT & DOWNLOAD ACTIONS */}
                            <div style={{
                                padding: "14px 24px",
                                borderTop: "1.5px solid #E2E8F0",
                                background: "#F8FAFC",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "10px",
                            }}>
                                <div style={{ fontSize: "11.5px", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                                    <IconCheckCircle size={14} color="#059669" />
                                    <span>{isHi ? "प्रमाणित आउटपेशेंट ई-पर्ची" : "NABH Authenticated Clinical E-Slip"}</span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <button
                                        type="button"
                                        onClick={() => printPrescriptionSlip(slipExportData, isHi ? "hi" : "en", currentHosp)}
                                        style={{
                                            padding: "8px 14px",
                                            borderRadius: "9px",
                                            background: "#FFFFFF",
                                            color: "#0284C7",
                                            border: "1.5px solid #BAE6FD",
                                            fontSize: "12.5px",
                                            fontWeight: 800,
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            transition: "all 0.15s ease",
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "#F0F9FF"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; }}
                                        title="Print Official Clinical Prescription Slip"
                                    >
                                        <IconPrinter size={15} />
                                        <span>{isHi ? "पर्ची प्रिंट करें" : "Print Slip"}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => downloadPrescriptionPDF(slipExportData, isHi ? "hi" : "en", currentHosp)}
                                        style={{
                                            padding: "8px 14px",
                                            borderRadius: "9px",
                                            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                            color: "#FFFFFF",
                                            border: "none",
                                            fontSize: "12.5px",
                                            fontWeight: 800,
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                                            transition: "all 0.15s ease",
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.08)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
                                        title="Download PDF Clinical Prescription Slip"
                                    >
                                        <IconDownload size={15} />
                                        <span>{isHi ? "PDF डाउनलोड" : "Download PDF"}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedVisitDetail(null)}
                                        style={{
                                            padding: "8px 16px",
                                            borderRadius: "9px",
                                            background: "#E2E8F0",
                                            color: "#334155",
                                            border: "none",
                                            fontSize: "12.5px",
                                            fontWeight: 800,
                                            cursor: "pointer",
                                            transition: "background 0.15s ease",
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "#CBD5E1"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "#E2E8F0"; }}
                                    >
                                        {isHi ? "बंद करें" : "Close"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
