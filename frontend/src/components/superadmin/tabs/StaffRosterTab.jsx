import React, { useState } from "react";
import * as XLSX from "xlsx";
import { API_BASE } from "../../../config/hospitalConfig";
import {
    IconHospital,
    IconPlus,
    IconSearch,
    IconEdit,
    IconTrash,
    IconKey,
    IconDownload,
    IconCheckCircle,
    IconAlertTriangle,
    IconRefresh,
    IconX,
    IconFileText,
} from "../SuperAdminIcons";
import {
    standaloneCardStyle,
    actionBtnStyle,
    secondarySmallBtnStyle,
    fieldInputStyle,
    tableThStyle,
    tableTdStyle,
    editSmallBtnStyle,
    deleteSmallBtnStyle,
    roleBadgeStyle,
} from "../superAdminStyles";
import { getCategoryLabel } from "../../../utils/i18n";
import "../SuperAdmin.css";

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

// Field mappings for flexible column detection
const STAFF_FIELD_MAPPINGS = {
    name: ["name", "full_name", "fullname", "staff_name", "employee_name", "emp_name", "doctor_name", "doc_name", "dr_name", "user_name", "username", "first_name", "last_name", "surname"],
    email: ["email", "email_id", "emailid", "email_address", "mail", "e_mail", "official_email", "work_email"],
    role: ["role", "designation", "position", "staff_role", "job_title", "post", "category", "user_role", "type"],
    department: ["department", "dept", "dept_name", "department_name", "specialty", "ward", "division", "dept_code"],
    employee_id: ["employee_id", "employee_code", "emp_id", "empid", "staff_id", "staff_code", "badge_id", "badge_number", "id", "code", "emp_code"],
    phone: ["phone", "mobile", "contact", "phone_number", "mobile_number", "mobile_no", "contact_no", "cell", "tel", "telephone"],
    password: ["password", "pwd", "pass"],
    qualification: ["qualification", "qualifications", "degree", "degrees", "education", "credentials"],
    specialization: ["specialization", "speciality", "specialty", "sub_specialty", "clinical_specialization", "expertise", "field"],
    license_number: ["license_number", "license_no", "medical_license", "registration_number", "reg_no", "mci_no", "nmc_no", "license"],
    gender: ["gender", "sex"],
    experience_years: ["experience_years", "experience", "years_of_experience", "exp_years", "exp", "yrs_exp", "work_exp"],
    room_number: ["room_number", "room", "room_no", "cabin", "cabin_number", "cabin_no", "chamber", "opd_room", "desk", "counter"],
};

function normalizeDeptString(str) {
    if (!str) return "";
    let s = String(str).toLowerCase();
    s = s.replace(/[\(\)\[\]\{\}\-_/\\.,:;]/g, " ");
    s = s.replace(/\b(department|dept|departments|opd|ipd|unit|section|division|of|the)\b/gi, " ");
    return s.replace(/\s+/g, " ").trim();
}

function cleanAlphanumeric(str) {
    if (!str) return "";
    return String(str)
        .toLowerCase()
        .replace(/[\(\)\[\]\{\}\-_/\\.,:;]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatchingDepartment(rawInput, departments = []) {
    if (!rawInput || !Array.isArray(departments) || departments.length === 0) {
        return null;
    }
    const raw = String(rawInput).trim();
    if (!raw) return null;
    const rawLower = raw.toLowerCase();

    for (const dept of departments) {
        const code = String(dept.dept_code || "").toLowerCase().trim();
        const name = String(dept.name || "").toLowerCase().trim();
        if (code === rawLower || name === rawLower) {
            return dept;
        }
    }

    const normRaw = normalizeDeptString(raw);
    if (!normRaw) return null;

    for (const dept of departments) {
        const normCode = normalizeDeptString(dept.dept_code || "");
        const normName = normalizeDeptString(dept.name || "");
        if ((normCode && normCode === normRaw) || (normName && normName === normRaw)) {
            return dept;
        }
    }

    const cleanInput = cleanAlphanumeric(raw);
    for (const dept of departments) {
        const cleanName = cleanAlphanumeric(dept.name || "");
        if (cleanName && cleanInput) {
            const pattern = new RegExp(`\\b${escapeRegex(cleanName)}\\b`, "i");
            if (pattern.test(cleanInput)) {
                return dept;
            }
        }
    }

    for (const dept of departments) {
        const cleanName = cleanAlphanumeric(dept.name || "");
        if (cleanName && cleanInput) {
            const pattern = new RegExp(`\\b${escapeRegex(cleanInput)}\\b`, "i");
            if (pattern.test(cleanName)) {
                return dept;
            }
        }
    }

    return null;
}

export default function StaffRosterTab({
    selectedHospital,
    hospitals = [],
    onSelectHospital,
    hospitalEmployees = [],
    hospitalDepts = [],
    employeeStatusFilter = "all",
    setEmployeeStatusFilter,
    employeeSearchQuery = "",
    setEmployeeSearchQuery,
    employeePage = 1,
    setEmployeePage,
    isTogglingEmpStatus,
    onToggleStatus,
    onEditEmployee,
    onChangePassword,
    onDeleteEmployee,
    onAddEmployee,
    getEmployeeCurrentDesk,
    formatRelativeLogin,
    notify,
    language = "en",
    isHi = false,
    getAuthHeaders,
    fetchHospitalDeepDive,
    fetchGlobalData,
}) {
    const currentHosp = selectedHospital || (hospitals && hospitals[0]) || null;
    const tenantId = currentHosp?.hospital_code || "";
    const hospName = currentHosp?.name || "";

    // Bulk Import state
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkParsedStaff, setBulkParsedStaff] = useState([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkStatus, setBulkStatus] = useState(null);
    const [ignoredColumns, setIgnoredColumns] = useState([]);
    const [isHeroDragging, setIsHeroDragging] = useState(false);

    // Role filter local state
    const [roleFilter, setRoleFilter] = useState("all");

    const onBreakCount = hospitalEmployees.filter((e) => {
        const d = (e.duty_status || "").toUpperCase();
        const s = (e.status || "").toLowerCase();
        return d === "ON_BREAK" || s === "on_break";
    }).length;

    const emergencyCount = hospitalEmployees.filter((e) => {
        const d = (e.duty_status || "").toUpperCase();
        const s = (e.status || "").toLowerCase();
        return d === "EMERGENCY_ROUND" || s === "emergency_round";
    }).length;

    const activeOnlineCount = hospitalEmployees.filter((e) => {
        const d = (e.duty_status || "").toUpperCase();
        const s = (e.status || "").toLowerCase();
        const isBreak = d === "ON_BREAK" || s === "on_break";
        const isEmergency = d === "EMERGENCY_ROUND" || s === "emergency_round";
        const isShiftEnded = d === "OFF_DUTY" || d === "SHIFT_ENDED" || s === "off_duty" || s === "shift_ended";
        return (s === "active" || d === "ACTIVE") && !isBreak && !isEmergency && !isShiftEnded;
    }).length;

    const totalOnDutyCount = activeOnlineCount + onBreakCount + emergencyCount;
    const offlineCount = Math.max(0, hospitalEmployees.length - totalOnDutyCount);

    // Filter staff
    const filteredEmployees = hospitalEmployees.filter((emp) => {
        const d = (emp.duty_status || "").toUpperCase();
        const s = (emp.status || "").toLowerCase();
        const isBreak = d === "ON_BREAK" || s === "on_break";
        const isEmergency = d === "EMERGENCY_ROUND" || s === "emergency_round";
        const isShiftEnded = d === "OFF_DUTY" || d === "SHIFT_ENDED" || s === "off_duty" || s === "shift_ended";
        const isActive = (s === "active" || d === "ACTIVE") && !isBreak && !isEmergency && !isShiftEnded;

        // Status filter
        if (employeeStatusFilter === "active" && !isActive) return false;
        if (employeeStatusFilter === "break" && !isBreak && !isEmergency) return false;
        if (employeeStatusFilter === "inactive" && (isActive || isBreak || isEmergency)) return false;

        // Role filter
        if (roleFilter !== "all") {
            const r = (emp.role || "").toLowerCase();
            if (roleFilter === "doctor" && !r.includes("doc")) return false;
            if (roleFilter === "pharmacist" && !r.includes("pharma")) return false;
            if (roleFilter === "receptionist" && !r.includes("rec") && !r.includes("desk")) return false;
            if (roleFilter === "nurse" && !r.includes("nur")) return false;
            if (roleFilter === "admin" && !r.includes("admin")) return false;
        }

        // Search query
        if (!employeeSearchQuery.trim()) return true;
        const q = employeeSearchQuery.trim().toLowerCase();
        return (
            (emp.name || "").toLowerCase().includes(q) ||
            (emp.username || "").toLowerCase().includes(q) ||
            (emp.email || "").toLowerCase().includes(q) ||
            (emp.employee_id || "").toLowerCase().includes(q) ||
            (emp.role || "").toLowerCase().includes(q) ||
            (emp.department || "").toLowerCase().includes(q) ||
            (emp.phone || "").toLowerCase().includes(q)
        );
    });

    const EMP_PAGE_SIZE = 10;
    const totalEmpPages = Math.ceil(filteredEmployees.length / EMP_PAGE_SIZE) || 1;
    const safePage = Math.min(Math.max(1, employeePage), totalEmpPages);
    const paginatedEmployees = filteredEmployees.slice(
        (safePage - 1) * EMP_PAGE_SIZE,
        safePage * EMP_PAGE_SIZE
    );

    // Process uploaded file
    const processStaffFile = async (file) => {
        if (!file) return;
        setBulkFile(file);
        setBulkStatus(null);
        setIgnoredColumns([]);

        try {
            const rawRows = await parseSpreadsheetData(file);
            if (!rawRows || rawRows.length === 0) {
                setBulkParsedStaff([]);
                setBulkStatus({
                    success: false,
                    message: isHi ? "फ़ाइल में कोई डेटा पंक्ति नहीं मिली।" : "No data rows found in spreadsheet.",
                });
                return;
            }

            const allOriginalHeaders = Object.keys(rawRows[0] || {});
            const ignored = [];
            const headerToFieldMap = {};

            for (const origHeader of allOriginalHeaders) {
                const cleanKey = String(origHeader).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
                let matchedField = null;
                for (const [canonicalField, aliases] of Object.entries(STAFF_FIELD_MAPPINGS)) {
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
                const fieldValues = {};
                for (const [origHeader, val] of Object.entries(r)) {
                    const targetField = headerToFieldMap[origHeader];
                    if (targetField) {
                        fieldValues[targetField] = typeof val === "string" ? val.trim() : String(val ?? "");
                    }
                }

                const name = fieldValues.name || "";
                let email = fieldValues.email || "";
                let role = (fieldValues.role || "doctor").toLowerCase();
                if (role.includes("doc")) role = "doctor";
                else if (role.includes("nur")) role = "nurse";
                else if (role.includes("recep") || role.includes("desk") || role.includes("front")) role = "receptionist";
                else if (role.includes("admin")) role = "hospital_admin";
                else if (role.includes("pharm")) role = "pharmacist";

                const rawDept = (fieldValues.department || "").trim();
                const matchedDept = findMatchingDepartment(rawDept, hospitalDepts);
                const isDeptValid = Boolean(matchedDept);
                const department = matchedDept ? matchedDept.dept_code : rawDept;
                const departmentDisplayName = matchedDept ? matchedDept.name : rawDept;

                const employee_id = fieldValues.employee_id || `EMP-${1000 + idx}`;
                const phone = fieldValues.phone || "";
                const password = fieldValues.password || ("pass" + Math.floor(1000 + Math.random() * 9000));
                const qualification = fieldValues.qualification || "";
                const specialization = fieldValues.specialization || "";
                const license_number = fieldValues.license_number || "";
                let gender = fieldValues.gender || "other";
                if (gender.includes("m") && !gender.includes("fe")) gender = "male";
                else if (gender.includes("f")) gender = "female";
                else gender = "other";
                const experience_years = parseInt(fieldValues.experience_years || 0, 10) || 0;
                const room_number = fieldValues.room_number || "";

                if (!email && name) {
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
                    email = `${slug || "staff" + idx}@${tenantId}.hospital.org`;
                }

                return {
                    name,
                    email,
                    role,
                    department,
                    departmentDisplayName,
                    deptValid: isDeptValid,
                    missingDeptName: !isDeptValid ? (rawDept || "Unassigned") : null,
                    employee_id,
                    phone,
                    password,
                    qualification,
                    specialization,
                    license_number,
                    gender,
                    experience_years,
                    room_number,
                };
            }).filter((s) => s.name);

            setBulkParsedStaff(normalized);
            if (normalized.length === 0) {
                setBulkStatus({
                    success: false,
                    message: isHi ? "फ़ाइल में कोई मान्य स्टाफ पंक्ति नहीं मिली।" : "No valid staff rows found. Ensure Name, Role, Email exist.",
                });
            }
        } catch (err) {
            console.error("Failed to parse spreadsheet:", err);
            setBulkStatus({ success: false, message: `Failed to parse file: ${err.message}` });
        }
    };

    const handleExecuteBulkImport = async () => {
        if (!bulkParsedStaff || bulkParsedStaff.length === 0) return;
        setBulkLoading(true);
        setBulkStatus(null);

        try {
            const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${tenantId}/employees/bulk`, {
                method: "POST",
                headers,
                body: JSON.stringify({ employees: bulkParsedStaff }),
            });
            const data = await res.json();
            setBulkLoading(false);

            if (res.ok && data.status === "success") {
                const reportMsg = data.message || (isHi
                    ? `${data.imported_count} कर्मचारी सफलतापूर्वक जोड़े गए!`
                    : `Successfully imported ${data.imported_count} staff records!`);
                setBulkStatus({
                    success: true,
                    imported: data.imported_count,
                    skipped: data.skipped_count,
                    message: reportMsg,
                });
                if (notify) notify(reportMsg);
                if (fetchHospitalDeepDive) fetchHospitalDeepDive(tenantId, true);
                if (fetchGlobalData) fetchGlobalData(true);
            } else {
                setBulkStatus({ success: false, message: data.message || "Failed to import staff." });
            }
        } catch (err) {
            setBulkLoading(false);
            setBulkStatus({ success: false, message: err.message });
        }
    };

    const handleDownloadStaffExcelTemplate = () => {
        const sampleData = [
            {
                "Name": "Dr. Rajesh Sharma",
                "Email": "dr.sharma@hospital.org",
                "Role": "doctor",
                "Department": hospitalDepts[0]?.name || "General Consultation",
                "Staff ID": "DOC-101",
                "Phone": "+91 98765 43210",
                "Qualification": "MBBS, MD Internal Medicine",
                "Specialization": "Cardiology",
                "License Number": "MCI-45892",
                "Experience Years": 12,
                "Room Number": "Room 102",
                "Gender": "Male",
                "Temporary Password": "DocPassword123!",
            },
            {
                "Name": "Pooja Verma",
                "Email": "pooja.v@hospital.org",
                "Role": "receptionist",
                "Department": hospitalDepts[0]?.name || "General Consultation",
                "Staff ID": "REC-102",
                "Phone": "+91 98765 43211",
                "Qualification": "B.Com, Hospital Administration",
                "Specialization": "Desk Operations",
                "License Number": "",
                "Experience Years": 4,
                "Room Number": "Counter 1",
                "Gender": "Female",
                "Temporary Password": "RecPassword123!",
            },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Staff_Roster_Template");
        XLSX.writeFile(wb, `Staff_Template_${tenantId || "hospital"}.xlsx`);
    };

    const validStaffCount = bulkParsedStaff.filter((s) => s.deptValid).length;
    const skippedStaffCount = bulkParsedStaff.length - validStaffCount;

    return (
        <div style={standaloneCardStyle}>
            {/* 1. TOP HEADER & PRIMARY ACTION BUTTONS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                    <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", color: "var(--superadmin-text-main, #0F172A)", fontWeight: 800 }}>
                        {isHi ? "स्टाफ एवं डॉक्टर रोस्टर" : "Doctor & Employee Roster"}
                    </h2>
                    {hospitals && hospitals.length > 1 && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--superadmin-sub-card, #F1F5F9)", padding: "4px 10px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #CBD5E1)", marginTop: "2px" }}>
                            <IconHospital size={14} color="#0284C7" />
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)" }}>
                                {isHi ? "अस्पताल:" : "Facility:"}
                            </span>
                            <select
                                value={selectedHospital?.hospital_code || ""}
                                onChange={(e) => {
                                    const found = hospitals.find((h) => h.hospital_code === e.target.value);
                                    if (found && onSelectHospital) onSelectHospital(found);
                                }}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    fontSize: "12.5px",
                                    fontWeight: 800,
                                    color: "var(--superadmin-text-main, #0F172A)",
                                    outline: "none",
                                    cursor: "pointer",
                                }}
                            >
                                {hospitals.map((h) => (
                                    <option key={h.hospital_code} value={h.hospital_code}>
                                        {h.name} ({h.hospital_code})
                                    </option>
                                ))}
                            </select>
                            <span style={{ fontSize: "11px", color: "#0284C7", fontWeight: 700, marginLeft: "4px" }}>
                                • {hospitalEmployees.length} {isHi ? "कार्मिक" : "Staff Members"}
                            </span>
                        </div>
                    )}
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                        type="button"
                        onClick={() => setShowBulkImport((prev) => !prev)}
                        style={{
                            ...secondarySmallBtnStyle,
                            background: showBulkImport ? "rgba(5, 150, 105, 0.15)" : "#F0FDF4",
                            color: "#059669",
                            borderColor: "#86EFAC",
                            padding: "8px 14px",
                            fontWeight: 800,
                        }}
                        title={isHi ? "एक्सेल या CSV से स्टाफ इम्पोर्ट करें" : "Import Staff from CSV / Excel"}
                    >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <IconDownload size={15} color="#059669" />
                            <span>{isHi ? "एक्सेल / CSV इम्पोर्ट" : "Import (CSV/Excel)"}</span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onAddEmployee}
                        style={actionBtnStyle}
                    >
                        <IconPlus size={15} color="#FFFFFF" />
                        <span>{isHi ? "+ डॉक्टर / कर्मचारी जोड़ें" : "+ Add Doctor / Staff"}</span>
                    </button>
                </div>
            </div>

            {/* 2. STAFF PRESENCE SUMMARY CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "var(--superadmin-sub-card, #F8FAFC)", border: "1px solid var(--superadmin-card-border, #CBD5E1)" }}>
                    <div style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>
                        {isHi ? "कुल कार्मिक" : "Total Personnel"}
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", marginTop: "4px" }}>
                        {hospitalEmployees.length}
                    </div>
                </div>

                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16A34A" }} />
                        <span style={{ fontSize: "11.5px", color: "#10B981", fontWeight: 700 }}>
                            {isHi ? "सक्रिय / उपलब्ध" : "Available & Online"}
                        </span>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#10B981", marginTop: "4px" }}>
                        {activeOnlineCount}
                    </div>
                </div>

                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B" }} />
                        <span style={{ fontSize: "11.5px", color: "#D97706", fontWeight: 700 }}>
                            {isHi ? "अवकाश / राउंड" : "On Break / Round"}
                        </span>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#D97706", marginTop: "4px" }}>
                        {onBreakCount + emergencyCount}
                    </div>
                </div>

                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "var(--superadmin-sub-card, #F8FAFC)", border: "1px solid var(--superadmin-card-border, #CBD5E1)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#94A3B8" }} />
                        <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>
                            {isHi ? "ऑफलाइन / शिफ्ट समाप्त" : "Offline / Shift Ended"}
                        </span>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--superadmin-text-muted, #64748B)", marginTop: "4px" }}>
                        {offlineCount}
                    </div>
                </div>
            </div>

            {/* 3. INTEGRATED BULK CSV / EXCEL UPLOAD DRAWER */}
            {showBulkImport && (
                <div style={{
                    marginBottom: "20px",
                    padding: "20px",
                    borderRadius: "14px",
                    background: "linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)",
                    border: "1.5px solid #86EFAC",
                    boxShadow: "0 6px 18px rgba(16, 185, 129, 0.08)",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <IconDownload size={18} color="#059669" />
                            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#065F46" }}>
                                {isHi ? "एक्सेल / CSV से स्टाफ डेटा आयात करें" : "Bulk Import Staff from Excel / CSV"}
                            </h3>
                        </div>

                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <button
                                type="button"
                                onClick={handleDownloadStaffExcelTemplate}
                                style={{
                                    ...secondarySmallBtnStyle,
                                    background: "#FFFFFF",
                                    color: "#059669",
                                    borderColor: "#86EFAC",
                                    fontSize: "11.5px",
                                }}
                            >
                                <IconFileText size={13} color="#059669" />
                                <span>{isHi ? "सैंपल टेम्पलेट (.xlsx)" : "Sample Template (.xlsx)"}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBulkImport(false)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
                            >
                                <IconX size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Drag-and-drop box */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsHeroDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsHeroDragging(false); }}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsHeroDragging(false);
                            const file = e.dataTransfer?.files?.[0];
                            if (file) processStaffFile(file);
                        }}
                        style={{
                            border: isHeroDragging ? "2px dashed #059669" : "2px dashed rgba(16, 185, 129, 0.4)",
                            borderRadius: "12px",
                            padding: "18px",
                            textAlign: "center",
                            background: isHeroDragging ? "rgba(16, 185, 129, 0.12)" : "#FFFFFF",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="file"
                            id="roster-bulk-file-input"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) processStaffFile(f);
                            }}
                            style={{ display: "none" }}
                        />
                        <label htmlFor="roster-bulk-file-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                            <IconDownload size={24} color="#059669" />
                            <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                                {bulkFile ? bulkFile.name : (isHi ? "स्टाफ फ़ाइल चुनें या यहाँ ड्रैग करें (.xlsx, .xls, .csv)" : "Choose staff file or drag & drop here (.xlsx, .xls, .csv)")}
                            </span>
                        </label>
                    </div>

                    {/* Ignored columns alert */}
                    {ignoredColumns.length > 0 && (
                        <div style={{ marginTop: "10px", padding: "8px 12px", borderRadius: "8px", background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E", fontSize: "11.5px" }}>
                            ℹ️ Extra unneeded columns ({ignoredColumns.join(", ")}) automatically ignored.
                        </div>
                    )}

                    {/* Preview Table & Confirm button */}
                    {bulkParsedStaff.length > 0 && (
                        <div style={{ marginTop: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                                <span style={{ fontSize: "12.5px", fontWeight: 800, color: "#059669" }}>
                                    {validStaffCount} staff records ready to import
                                    {skippedStaffCount > 0 && (
                                        <span style={{ color: "#DC2626", marginLeft: "6px" }}>
                                            ({skippedStaffCount} rows skipped due to invalid department)
                                        </span>
                                    )}
                                </span>

                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                        type="button"
                                        onClick={() => { setBulkFile(null); setBulkParsedStaff([]); setBulkStatus(null); }}
                                        style={{ ...secondarySmallBtnStyle, fontSize: "11.5px" }}
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExecuteBulkImport}
                                        disabled={bulkLoading || validStaffCount === 0}
                                        style={{
                                            ...actionBtnStyle,
                                            background: validStaffCount === 0 ? "#94A3B8" : "#059669",
                                            fontSize: "12px",
                                            padding: "6px 14px",
                                        }}
                                    >
                                        {bulkLoading ? <IconRefresh size={14} className="spin-animation" /> : <IconCheckCircle size={14} color="#FFFFFF" />}
                                        <span>Confirm & Import ({validStaffCount})</span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                                    <thead>
                                        <tr style={{ background: "#F1F5F9" }}>
                                            <th style={{ padding: "6px 10px" }}>Name</th>
                                            <th style={{ padding: "6px 10px" }}>Role</th>
                                            <th style={{ padding: "6px 10px" }}>Department</th>
                                            <th style={{ padding: "6px 10px" }}>Email</th>
                                            <th style={{ padding: "6px 10px" }}>Staff ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkParsedStaff.slice(0, 10).map((s, idx) => (
                                            <tr key={idx} style={{ borderBottom: "1px solid #E2E8F0", background: !s.deptValid ? "#FEF2F2" : "#FFFFFF" }}>
                                                <td style={{ padding: "6px 10px", fontWeight: 700 }}>
                                                    {s.name}
                                                    {!s.deptValid && (
                                                        <span style={{ fontSize: "10px", color: "#DC2626", display: "block" }}>
                                                            ❌ Skipped (Dept "{s.missingDeptName}" not registered)
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "6px 10px", textTransform: "capitalize" }}>{s.role}</td>
                                                <td style={{ padding: "6px 10px" }}>{s.departmentDisplayName || s.department}</td>
                                                <td style={{ padding: "6px 10px", color: "#64748B" }}>{s.email}</td>
                                                <td style={{ padding: "6px 10px" }}>{s.employee_id}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {bulkStatus && (
                        <div style={{
                            marginTop: "10px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: bulkStatus.success ? "#ECFDF5" : "#FEF2F2",
                            border: `1px solid ${bulkStatus.success ? "#A7F3D0" : "#FCA5A5"}`,
                            color: bulkStatus.success ? "#065F46" : "#DC2626",
                            fontSize: "12px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}>
                            {bulkStatus.success ? <IconCheckCircle size={15} /> : <IconAlertTriangle size={15} />}
                            <span>{bulkStatus.message}</span>
                        </div>
                    )}
                </div>
            )}

            {/* 4. FILTER PILLS & SEARCH BAR */}
            <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                {/* Status & Role filter pills */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                        type="button"
                        onClick={() => { setEmployeeStatusFilter("all"); setEmployeePage(1); }}
                        style={{
                            padding: "5px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: employeeStatusFilter === "all" ? "1.5px solid #0284C7" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: employeeStatusFilter === "all" ? "rgba(2, 132, 199, 0.12)" : "var(--superadmin-card-bg, #FFFFFF)",
                            color: employeeStatusFilter === "all" ? "#0284C7" : "var(--superadmin-text-muted, #64748B)",
                        }}
                    >
                        {isHi ? "सभी कार्मिक" : "All Staff"} ({hospitalEmployees.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => { setEmployeeStatusFilter("active"); setEmployeePage(1); }}
                        style={{
                            padding: "5px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            border: employeeStatusFilter === "active" ? "1.5px solid #16A34A" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: employeeStatusFilter === "active" ? "rgba(16, 185, 129, 0.12)" : "var(--superadmin-card-bg, #FFFFFF)",
                            color: employeeStatusFilter === "active" ? "#10B981" : "var(--superadmin-text-muted, #64748B)",
                        }}
                    >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16A34A" }} />
                        <span>{isHi ? "ऑनलाइन" : "Online"} ({activeOnlineCount})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setEmployeeStatusFilter("break"); setEmployeePage(1); }}
                        style={{
                            padding: "5px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            border: employeeStatusFilter === "break" ? "1.5px solid #F59E0B" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: employeeStatusFilter === "break" ? "rgba(245, 158, 11, 0.12)" : "var(--superadmin-card-bg, #FFFFFF)",
                            color: employeeStatusFilter === "break" ? "#D97706" : "var(--superadmin-text-muted, #64748B)",
                        }}
                    >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B" }} />
                        <span>{isHi ? "अवकाश / राउंड" : "On Break / Round"} ({onBreakCount + emergencyCount})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setEmployeeStatusFilter("inactive"); setEmployeePage(1); }}
                        style={{
                            padding: "5px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            border: employeeStatusFilter === "inactive" ? "1.5px solid #64748B" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: employeeStatusFilter === "inactive" ? "rgba(100, 116, 139, 0.12)" : "var(--superadmin-card-bg, #FFFFFF)",
                            color: employeeStatusFilter === "inactive" ? "#475569" : "var(--superadmin-text-muted, #64748B)",
                        }}
                    >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#94A3B8" }} />
                        <span>{isHi ? "ऑफलाइन" : "Offline"} ({offlineCount})</span>
                    </button>

                    <span style={{ color: "#CBD5E1", margin: "0 2px" }}>|</span>

                    {/* Quick Role filters */}
                    {[
                        { id: "all", label: isHi ? "सभी भूमिकाएं" : "All Roles" },
                        { id: "doctor", label: isHi ? "डॉक्टर" : "Doctors" },
                        { id: "pharmacist", label: isHi ? "फार्मासिस्ट" : "Pharmacists" },
                        { id: "receptionist", label: isHi ? "डेस्क" : "Desk" },
                        { id: "nurse", label: isHi ? "नर्स" : "Nurses" },
                        { id: "admin", label: isHi ? "एडमिन" : "Admins" },
                    ].map((rf) => (
                        <button
                            key={rf.id}
                            type="button"
                            onClick={() => { setRoleFilter(rf.id); setEmployeePage(1); }}
                            style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                border: roleFilter === rf.id ? "1.5px solid #0284C7" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                                background: roleFilter === rf.id ? "rgba(2, 132, 199, 0.1)" : "transparent",
                                color: roleFilter === rf.id ? "#0284C7" : "var(--superadmin-text-sub, #64748B)",
                            }}
                        >
                            {rf.label}
                        </button>
                    ))}
                </div>

                {/* Search input */}
                <div style={{ position: "relative", minWidth: "260px", flex: "1 1 260px" }}>
                    <input
                        type="text"
                        placeholder={isHi ? "नाम, ईमेल या आईडी से खोजें..." : "Search by name, email, employee ID..."}
                        value={employeeSearchQuery}
                        onChange={(e) => { setEmployeeSearchQuery(e.target.value); setEmployeePage(1); }}
                        style={{ ...fieldInputStyle, paddingLeft: "32px", fontSize: "12.5px" }}
                    />
                    <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", display: "flex", alignItems: "center" }}>
                        <IconSearch size={14} color="#94A3B8" />
                    </span>
                </div>
            </div>

            {/* 5. COMPLETE ROSTER TABLE WITH ALL ACTION BUTTONS */}
            <div style={{ overflowX: "auto", borderRadius: "14px", border: "1px solid var(--superadmin-card-border, #CBD5E1)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                    <thead>
                        <tr style={{ background: "var(--superadmin-sub-card, #F8FAFC)", borderBottom: "1.5px solid var(--superadmin-card-border, #E2E8F0)" }}>
                            <th style={tableThStyle}>{isHi ? "कर्मचारी" : "Staff Member"}</th>
                            <th style={tableThStyle}>{isHi ? "आईडी" : "Emp ID"}</th>
                            <th style={tableThStyle}>{isHi ? "भूमिका" : "Role"}</th>
                            <th style={tableThStyle}>{isHi ? "विभाग" : "Department"}</th>
                            <th style={tableThStyle}>{isHi ? "संबद्ध डेस्क" : "Assigned Desk"}</th>
                            <th style={tableThStyle}>{isHi ? "संपर्क" : "Contact"}</th>
                            <th style={tableThStyle}>{isHi ? "स्थिति" : "Status & Presence"}</th>
                            <th style={{ ...tableThStyle, textAlign: "right" }}>{isHi ? "कार्रवाई" : "Actions"}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedEmployees.length === 0 ? (
                            <tr>
                                <td colSpan="8" style={{ textAlign: "center", padding: "32px", color: "var(--superadmin-text-muted, #94A3B8)" }}>
                                    {employeeSearchQuery ? "No staff members match the search query." : "No staff or doctors found for this filter."}
                                </td>
                            </tr>
                        ) : (
                            paginatedEmployees.map((emp) => {
                                const isActive = (emp.status || "").toLowerCase() === "active";
                                const isDoc = (emp.role || "").toLowerCase().includes("doc");

                                return (
                                    <tr key={emp.id || emp.employee_id_num || emp.user_id} style={{ borderBottom: "1px solid var(--superadmin-card-border, #E2E8F0)" }}>
                                        <td style={tableTdStyle}>
                                            <div style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", fontSize: "13.5px" }}>
                                                {emp.name || emp.username || "Staff Member"}
                                                {emp.qualification && (
                                                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#0284C7", marginLeft: "5px" }}>
                                                        ({emp.qualification})
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                                    {emp.email}
                                                </span>
                                                {emp.specialization && (
                                                    <span style={{ fontSize: "10.5px", background: "rgba(5, 150, 105, 0.1)", color: "#059669", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                                        {emp.specialization}
                                                    </span>
                                                )}
                                                {emp.room_number && (
                                                    <span style={{ fontSize: "10.5px", background: "rgba(217, 119, 6, 0.1)", color: "#D97706", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                                        {emp.room_number}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ ...tableTdStyle, fontWeight: 700, color: "#0284C7", fontFamily: "monospace" }}>
                                            {emp.employee_id || `EMP-${emp.id || emp.employee_id_num}`}
                                        </td>
                                        <td style={tableTdStyle}>
                                            <span style={roleBadgeStyle(emp.role)}>
                                                {(emp.role || "").toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ ...tableTdStyle, fontWeight: 700, color: "var(--superadmin-text-main, #0F172A)" }}>
                                            {getCategoryLabel(emp.department, language)}
                                        </td>
                                        <td style={tableTdStyle}>
                                            {(() => {
                                                const currentDesk = getEmployeeCurrentDesk ? getEmployeeCurrentDesk(emp) : null;
                                                return currentDesk ? (
                                                    <span
                                                        style={{
                                                            fontSize: "11.5px",
                                                            fontWeight: 700,
                                                            color: "#0284C7",
                                                            background: "rgba(2, 132, 199, 0.1)",
                                                            border: "1px solid rgba(2, 132, 199, 0.3)",
                                                            padding: "3px 8px",
                                                            borderRadius: "6px",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                        }}
                                                    >
                                                        <span>🪑</span>
                                                        <span>{currentDesk.desk_name}</span>
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #94A3B8)" }}>
                                                        {isHi ? "अनअसाइंड" : "Unassigned"}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={tableTdStyle}>
                                            {emp.phone || "—"}
                                        </td>
                                        <td style={{ ...tableTdStyle, whiteSpace: "nowrap" }}>
                                            {(() => {
                                                const d = (emp.duty_status || "").toUpperCase();
                                                const s = (emp.status || "").toLowerCase();
                                                const isOnBreak = d === "ON_BREAK" || s === "on_break";
                                                const isEmergency = d === "EMERGENCY_ROUND" || s === "emergency_round";
                                                const isShiftEnded = d === "OFF_DUTY" || d === "SHIFT_ENDED" || s === "off_duty" || s === "shift_ended";
                                                const isActiveOnline = (s === "active" || d === "ACTIVE") && !isOnBreak && !isEmergency && !isShiftEnded;

                                                if (isOnBreak) {
                                                    return (
                                                        <span
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "5px",
                                                                padding: "3px 9px",
                                                                borderRadius: "999px",
                                                                fontSize: "11px",
                                                                fontWeight: 800,
                                                                background: "#FEF3C7",
                                                                color: "#92400E",
                                                                border: "1px solid #FCD34D",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                            title={isHi ? "चाय / भोजन अवकाश" : "Tea / Lunch break"}
                                                        >
                                                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B" }} />
                                                            <span>{isHi ? "अवकाश" : "ON BREAK"}</span>
                                                        </span>
                                                    );
                                                }

                                                if (isEmergency) {
                                                    return (
                                                        <span
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "5px",
                                                                padding: "3px 9px",
                                                                borderRadius: "999px",
                                                                fontSize: "11px",
                                                                fontWeight: 800,
                                                                background: "#FFE4E6",
                                                                color: "#BE123C",
                                                                border: "1px solid #FECDD3",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                            title={isHi ? "आपातकालीन ICU वार्ड" : "Critical care / ICU emergency"}
                                                        >
                                                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#E11D48" }} />
                                                            <span>{isHi ? "इमरजेंसी" : "EMERGENCY"}</span>
                                                        </span>
                                                    );
                                                }

                                                if (isShiftEnded) {
                                                    return (
                                                        <span
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "5px",
                                                                padding: "3px 9px",
                                                                borderRadius: "999px",
                                                                fontSize: "11px",
                                                                fontWeight: 700,
                                                                background: "#F1F5F9",
                                                                color: "#475569",
                                                                border: "1px solid #CBD5E1",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                            title={isHi ? "शिफ्ट समाप्त / ऑफ ड्यूटी" : "Shift concluded / Off duty"}
                                                        >
                                                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#64748B" }} />
                                                            <span>{isHi ? "ड्यूटी समाप्त" : "SHIFT ENDED"}</span>
                                                        </span>
                                                    );
                                                }

                                                if (isActiveOnline) {
                                                    return (
                                                        <span
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "5px",
                                                                padding: "3px 9px",
                                                                borderRadius: "999px",
                                                                fontSize: "11px",
                                                                fontWeight: 800,
                                                                background: "rgba(16, 185, 129, 0.15)",
                                                                color: "#059669",
                                                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                            title={emp.last_login_at && formatRelativeLogin ? `${isHi ? "लॉगिन:" : "Logged in:"} ${formatRelativeLogin(emp.last_login_at)}` : (isHi ? "सक्रिय सत्र" : "Active session")}
                                                        >
                                                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981" }} />
                                                            <span>{isHi ? "ऑनलाइन" : "ONLINE"}</span>
                                                        </span>
                                                    );
                                                }

                                                return (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "5px",
                                                            padding: "3px 9px",
                                                            borderRadius: "999px",
                                                            fontSize: "11px",
                                                            fontWeight: 700,
                                                            background: "rgba(100, 116, 139, 0.12)",
                                                            color: "#64748B",
                                                            border: "1px solid rgba(100, 116, 139, 0.2)",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                        title={emp.last_login_at && formatRelativeLogin ? `${isHi ? "अंतिम:" : "Last:"} ${formatRelativeLogin(emp.last_login_at)}` : (isHi ? "लॉगिन नहीं किया" : "Not logged in")}
                                                    >
                                                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#94A3B8" }} />
                                                        <span>{isHi ? "ऑफलाइन" : "OFFLINE"}</span>
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ ...tableTdStyle, textAlign: "right" }}>
                                            <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                                {/* 1. Toggle Online/Offline Status */}
                                                {(() => {
                                                    const d = (emp.duty_status || "").toUpperCase();
                                                    const s = (emp.status || "").toLowerCase();
                                                    const isOnDuty = (s === "active" || d === "ACTIVE" || d === "ON_BREAK" || s === "on_break" || d === "EMERGENCY_ROUND" || s === "emergency_round") && d !== "OFF_DUTY" && d !== "SHIFT_ENDED" && s !== "off_duty" && s !== "shift_ended";

                                                    return (
                                                        <button
                                                            type="button"
                                                            disabled={isTogglingEmpStatus === (emp.user_id || emp.id || emp.employee_id_num)}
                                                            onClick={() => onToggleStatus && onToggleStatus(emp)}
                                                            style={{
                                                                ...editSmallBtnStyle,
                                                                background: isOnDuty ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                                                color: isOnDuty ? "#DC2626" : "#059669",
                                                                border: isOnDuty ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
                                                                fontWeight: 700,
                                                                fontSize: "11px",
                                                                opacity: isTogglingEmpStatus === (emp.user_id || emp.id || emp.employee_id_num) ? 0.6 : 1,
                                                            }}
                                                            title={isOnDuty ? (isHi ? "ऑफलाइन सेट करें" : "Set to Offline") : (isHi ? "ऑनलाइन सेट करें" : "Set to Online")}
                                                        >
                                                            {isOnDuty
                                                                ? (isHi ? "ऑफलाइन करें" : "Set Offline")
                                                                : (isHi ? "सक्रिय करें" : "Set Active")}
                                                        </button>
                                                    );
                                                })()}

                                                {/* 2. Edit Employee */}
                                                <button
                                                    type="button"
                                                    onClick={() => onEditEmployee && onEditEmployee(emp)}
                                                    style={editSmallBtnStyle}
                                                    title={isHi ? "संपादित करें" : "Edit Staff"}
                                                >
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                        <IconEdit size={11} />
                                                        <span>{isHi ? "संपादित" : "Edit"}</span>
                                                    </span>
                                                </button>

                                                {/* 3. Change Password */}
                                                <button
                                                    type="button"
                                                    onClick={() => onChangePassword && onChangePassword(emp)}
                                                    style={{
                                                        ...editSmallBtnStyle,
                                                        background: "#FEF3C7",
                                                        color: "#92400E",
                                                        border: "1px solid #F59E0B",
                                                    }}
                                                    title={isHi ? "पासवर्ड बदलें" : "Change Password"}
                                                >
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                        <IconKey size={12} color="#92400E" />
                                                        <span>{isHi ? "पासवर्ड" : "Password"}</span>
                                                    </span>
                                                </button>

                                                {/* 4. Delete Employee */}
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteEmployee && onDeleteEmployee(emp)}
                                                    style={deleteSmallBtnStyle}
                                                    title={isHi ? "कर्मचारी हटाएं" : "Remove Employee"}
                                                >
                                                    <IconTrash size={14} color="#EF4444" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* 6. PAGINATION CONTROLS */}
            {totalEmpPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--superadmin-text-muted, #64748B)" }}>
                        Page {safePage} of {totalEmpPages} ({filteredEmployees.length} staff members)
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                        <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setEmployeePage && setEmployeePage((p) => Math.max(1, p - 1))}
                            style={{
                                ...secondarySmallBtnStyle,
                                opacity: safePage <= 1 ? 0.5 : 1,
                                cursor: safePage <= 1 ? "not-allowed" : "pointer",
                            }}
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            disabled={safePage >= totalEmpPages}
                            onClick={() => setEmployeePage && setEmployeePage((p) => Math.min(totalEmpPages, p + 1))}
                            style={{
                                ...secondarySmallBtnStyle,
                                opacity: safePage >= totalEmpPages ? 0.5 : 1,
                                cursor: safePage >= totalEmpPages ? "not-allowed" : "pointer",
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
