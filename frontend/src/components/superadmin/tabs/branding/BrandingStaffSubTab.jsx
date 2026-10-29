import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { API_BASE } from "../../../../config/hospitalConfig";
import {
    IconUsers,
    IconPlus,
    IconRefresh,
    IconCheckCircle,
    IconAlertTriangle,
    IconTrash,
    IconCopy,
    IconSearch,
    IconStethoscope,
    IconKey,
    IconX,
    IconDownload,
    IconFileText,
} from "../../SuperAdminIcons";
import { fieldLabelStyle, fieldInputStyle } from "../../superAdminStyles";
import "../../SuperAdmin.css";

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

// Allowed schema mappings: map variations of column headers to canonical staff schema
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

/**
 * Normalizes a department name string by:
 * 1. Lowercasing and replacing punctuation/brackets/hyphens/slashes with spaces.
 * 2. Stripping common hospital department suffixes and prefixes:
 *    department, dept, departments, opd, ipd, unit, section, division, of, the
 * 3. Collapsing multiple spaces and trimming.
 */
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

/**
 * Finds the best matching department from an array of existing department objects.
 * Supports flexible normalization, ignoring brackets, hyphens, and noise words (OPD, Dept, Unit, etc.).
 * Returns the matched department object, or null if no valid match.
 */
function findMatchingDepartment(rawInput, departments = []) {
    if (!rawInput || !Array.isArray(departments) || departments.length === 0) {
        return null;
    }

    const raw = String(rawInput).trim();
    if (!raw) return null;
    const rawLower = raw.toLowerCase();

    // Tier 1: Exact case-insensitive match on dept_code or name
    for (const dept of departments) {
        const code = String(dept.dept_code || "").toLowerCase().trim();
        const name = String(dept.name || "").toLowerCase().trim();
        if (code === rawLower || name === rawLower) {
            return dept;
        }
    }

    // Tier 2: Cleaned alphanumeric match (ignoring brackets, hyphens, extra whitespace)
    const cleanRaw = cleanAlphanumeric(raw);
    if (cleanRaw) {
        for (const dept of departments) {
            const cleanCode = cleanAlphanumeric(dept.dept_code);
            const cleanName = cleanAlphanumeric(dept.name);
            if (cleanCode && cleanCode === cleanRaw) return dept;
            if (cleanName && cleanName === cleanRaw) return dept;
        }
    }

    // Tier 3: Core normalized match (stripping 'Department', 'OPD', 'Unit', 'Section', 'of', etc.)
    const normRaw = normalizeDeptString(raw);
    if (normRaw) {
        for (const dept of departments) {
            const normCode = normalizeDeptString(dept.dept_code);
            const normName = normalizeDeptString(dept.name);
            if (normCode && normCode === normRaw) return dept;
            if (normName && normName === normRaw) return dept;
        }
    }

    // Tier 4: Singular/Plural variations & Word-boundary phrase matching
    if (normRaw && normRaw.length >= 3) {
        // 4a. Check simple plural/singular variations (e.g. pediatric vs pediatrics)
        for (const dept of departments) {
            const normName = normalizeDeptString(dept.name);
            const normCode = normalizeDeptString(dept.dept_code);
            for (const target of [normName, normCode]) {
                if (!target) continue;
                if (normRaw + "s" === target || normRaw === target + "s") return dept;
                if (normRaw + "es" === target || normRaw === target + "es") return dept;
                if (normRaw.replace(/ic$/, "ics") === target || normRaw === target.replace(/ic$/, "ics")) return dept;
            }
        }

        // 4b. Whole word-boundary subphrase match
        let bestMatch = null;
        let bestMatchScore = 0;

        for (const dept of departments) {
            const normName = normalizeDeptString(dept.name);
            const normCode = normalizeDeptString(dept.dept_code);

            for (const target of [normName, normCode]) {
                if (!target || target.length < 3) continue;

                const targetRegex = new RegExp(`(^|\\s)${escapeRegex(target)}(\\s|$)`, "i");
                const rawRegex = new RegExp(`(^|\\s)${escapeRegex(normRaw)}(\\s|$)`, "i");

                if (targetRegex.test(normRaw)) {
                    if (target.length > bestMatchScore) {
                        bestMatchScore = target.length;
                        bestMatch = dept;
                    }
                } else if (normRaw.length >= 4 && rawRegex.test(target)) {
                    if (normRaw.length > bestMatchScore) {
                        bestMatchScore = normRaw.length;
                        bestMatch = dept;
                    }
                }
            }
        }

        if (bestMatch) {
            return bestMatch;
        }
    }

    return null;
}

export default function BrandingStaffSubTab({
    currentHosp,
    notify,
    isHi = false,
    getAuthHeaders,
    hospitalEmployees = [],
    hospitalDepts = [],
    fetchHospitalDeepDive,
    fetchGlobalData,
    showConfirm,
}) {
    const tenantId = currentHosp?.hospital_code || "city-hospital-01";
    const hospName = currentHosp?.name || "Hospital";

    // Staff state
    const [employees, setEmployees] = useState(hospitalEmployees || []);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");

    // Modal state for Add Staff
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState(null);

    // Bulk Excel/CSV upload state
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkParsedStaff, setBulkParsedStaff] = useState([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkStatus, setBulkStatus] = useState(null);
    const [ignoredColumns, setIgnoredColumns] = useState([]);
    const [isHeroDragging, setIsHeroDragging] = useState(false);
    const [isModalDragging, setIsModalDragging] = useState(false);

    // Form state
    const [staffForm, setStaffForm] = useState({
        name: "",
        email: "",
        role: "doctor",
        department: "consultation",
        employee_id: "",
        phone: "",
        password: "doc" + Math.floor(1000 + Math.random() * 9000),
        qualification: "",
        specialization: "",
        license_number: "",
        gender: "other",
        experience_years: 0,
        room_number: "",
    });

    // Available departments for this hospital
    const [availableDepts, setAvailableDepts] = useState(hospitalDepts || []);

    useEffect(() => {
        if (hospitalDepts && hospitalDepts.length > 0) {
            setAvailableDepts(hospitalDepts);
        } else if (tenantId) {
            const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };
            fetch(`${API_BASE}/api/v1/hospitals/${tenantId}/departments`, { headers })
                .then((res) => res.json())
                .then((data) => {
                    if (data.status === "success" && Array.isArray(data.departments)) {
                        setAvailableDepts(data.departments);
                    }
                })
                .catch(() => {});
        }
    }, [hospitalDepts, tenantId]);

    // Sync from parent prop or fetch if empty
    useEffect(() => {
        if (hospitalEmployees && hospitalEmployees.length > 0) {
            setEmployees(hospitalEmployees);
        } else {
            fetchEmployees();
        }
    }, [hospitalEmployees, tenantId]);

    const fetchEmployees = async () => {
        if (!tenantId) return;
        setLoadingEmployees(true);
        try {
            const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${tenantId}/employees`, { headers });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setEmployees(data.employees || []);
            }
        } catch (err) {
            console.warn("Failed to fetch hospital employees:", err);
        } finally {
            setLoadingEmployees(false);
        }
    };

    // Auto-generate employee ID when role changes
    const handleRoleChange = (newRole) => {
        const prefix = newRole === "doctor" ? "DOC" : newRole === "nurse" ? "NUR" : newRole === "receptionist" ? "REC" : newRole === "radiologist" ? "RAD" : newRole === "radiology_technician" ? "XRAY" : newRole === "pathologist" ? "PATH" : "EMP";
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setStaffForm((prev) => ({
            ...prev,
            role: newRole,
            employee_id: prev.employee_id || `${prefix}-${randomNum}`,
            password: "pass" + Math.floor(1000 + Math.random() * 9000),
        }));
    };

    // Handle Create Staff
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${tenantId}/employees`, {
                method: "POST",
                headers,
                body: JSON.stringify(staffForm),
            });
            const data = await res.json();
            setIsSubmitting(false);

            if (res.ok && data.status === "success") {
                setCreatedCredentials({
                    name: data.employee?.username || staffForm.name,
                    email: data.employee?.email || staffForm.email,
                    employee_id: data.employee?.employee_id || staffForm.employee_id,
                    password: staffForm.password,
                    role: data.employee?.role || staffForm.role,
                    department: data.employee?.department || staffForm.department,
                    hospital_name: hospName,
                    specialization: data.employee?.specialization || staffForm.specialization,
                    room_number: data.employee?.room_number || staffForm.room_number,
                });

                if (notify) notify(isHi ? `स्टाफ '${staffForm.name}' सफलतापूर्वक जोड़ा गया!` : `Staff '${staffForm.name}' provisioned successfully!`);

                setShowAddModal(false);
                fetchEmployees();
                if (fetchHospitalDeepDive) fetchHospitalDeepDive(tenantId, true);
                if (fetchGlobalData) fetchGlobalData(true);

                // Reset form
                setStaffForm({
                    name: "",
                    email: "",
                    role: "doctor",
                    department: "consultation",
                    employee_id: "",
                    phone: "",
                    password: "doc" + Math.floor(1000 + Math.random() * 9000),
                    qualification: "",
                    specialization: "",
                    license_number: "",
                    gender: "other",
                    experience_years: 0,
                    room_number: "",
                });
            } else {
                if (notify) notify(data.detail || data.message || "Failed to create staff member.", "error");
            }
        } catch (err) {
            setIsSubmitting(false);
            if (notify) notify(`Error: ${err.message}`, "error");
        }
    };

    // Process file (both from input and drag-and-drop)
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
                // Extract only recognized/mapped fields, completely ignoring extra columns
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
                const matchedDept = findMatchingDepartment(rawDept, availableDepts);
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

                // Fallback email if missing from legacy records
                if (!email && name) {
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
                    email = `${slug || "staff" + idx}@${tenantId}.hospital.org`;
                }

                // Return strictly ONLY the required fields, ignoring any extra fields
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
                    message: isHi
                        ? "फ़ाइल में कोई मान्य स्टाफ पंक्ति नहीं मिली। कृपया सुनिश्चित करें कि 'Name', 'Role', 'Email' जैसे कॉलम मौजूद हैं।"
                        : "No valid staff rows found. Please make sure columns like 'Name', 'Role', 'Email' exist in your Excel / CSV file.",
                });
            }
        } catch (err) {
            console.error("Failed to parse spreadsheet:", err);
            setBulkStatus({
                success: false,
                message: `Failed to parse file: ${err.message}`,
            });
        }
    };

    // Handle File Selection
    const handleBulkFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) processStaffFile(file);
    };

    // Execute Bulk Staff Import
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
                    ? `${data.imported_count} कर्मचारी सफलतापूर्वक जोड़े गए! (${data.skipped_count || 0} छोड़े गए)`
                    : `Successfully imported ${data.imported_count} staff records! (${data.skipped_count || 0} skipped)`);

                setBulkStatus({
                    success: true,
                    imported: data.imported_count,
                    skipped: data.skipped_count,
                    message: reportMsg,
                });

                if (notify) notify(reportMsg);
                fetchEmployees();
                if (fetchHospitalDeepDive) fetchHospitalDeepDive(tenantId, true);
                if (fetchGlobalData) fetchGlobalData(true);
            } else {
                setBulkStatus({
                    success: false,
                    message: data.message || "Failed to import staff.",
                });
            }
        } catch (err) {
            setBulkLoading(false);
            setBulkStatus({ success: false, message: err.message });
        }
    };

    // Download Sample Excel (.xlsx) Template for Staff
    const handleDownloadStaffExcelTemplate = () => {
        const sampleData = [
            {
                "Name": "Dr. Rajesh Sharma",
                "Email": "dr.sharma@hospital.org",
                "Role": "doctor",
                "Department": "consultation",
                "Employee ID": "DOC-1001",
                "Phone": "+91 98765 43210",
                "Password": "doc" + Math.floor(1000 + Math.random() * 9000),
                "Qualification": "MBBS, MD",
                "Specialization": "Chief Cardiologist",
                "License Number": "MCI-48192",
                "Gender": "male",
                "Experience Years": 12,
                "Room Number": "Cabin 101",
            },
            {
                "Name": "Dr. Anita Roy",
                "Email": "dr.anita@hospital.org",
                "Role": "doctor",
                "Department": "pediatrics",
                "Employee ID": "DOC-1002",
                "Phone": "+91 98765 43211",
                "Password": "doc" + Math.floor(1000 + Math.random() * 9000),
                "Qualification": "MBBS, DCH",
                "Specialization": "Pediatrician",
                "License Number": "MCI-52914",
                "Gender": "female",
                "Experience Years": 8,
                "Room Number": "Cabin 104",
            },
            {
                "Name": "Nurse Priya Verma",
                "Email": "priya.verma@hospital.org",
                "Role": "nurse",
                "Department": "emergency",
                "Employee ID": "NUR-2001",
                "Phone": "+91 98765 43212",
                "Password": "nur" + Math.floor(1000 + Math.random() * 9000),
                "Qualification": "B.Sc Nursing",
                "Specialization": "Triage & Emergency",
                "License Number": "NUR-9812",
                "Gender": "female",
                "Experience Years": 5,
                "Room Number": "Triage Bay 1",
            },
            {
                "Name": "Amit Patel",
                "Email": "amit.patel@hospital.org",
                "Role": "receptionist",
                "Department": "reception",
                "Employee ID": "REC-3001",
                "Phone": "+91 98765 43213",
                "Password": "rec" + Math.floor(1000 + Math.random() * 9000),
                "Qualification": "B.Com",
                "Specialization": "Front Desk Operations",
                "License Number": "",
                "Gender": "male",
                "Experience Years": 3,
                "Room Number": "Desk 1",
            },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Staff_Roster");
        XLSX.writeFile(wb, `sample_staff_template_${tenantId}.xlsx`);
    };

    // Download Sample CSV (.csv) Template for Staff
    const handleDownloadStaffCsvTemplate = () => {
        const headers = ["Name", "Email", "Role", "Department", "Employee ID", "Phone", "Password", "Qualification", "Specialization", "License Number", "Gender", "Experience Years", "Room Number"];
        const rows = [
            headers.join(","),
            '"Dr. Rajesh Sharma","dr.sharma@hospital.org","doctor","consultation","DOC-1001","+91 98765 43210","pass8921","MBBS, MD","Chief Cardiologist","MCI-48192","male","12","Cabin 101"',
            '"Dr. Anita Roy","dr.anita@hospital.org","doctor","pediatrics","DOC-1002","+91 98765 43211","pass9922","MBBS, DCH","Pediatrician","MCI-52914","female","8","Cabin 104"',
            '"Nurse Priya Verma","priya.verma@hospital.org","nurse","emergency","NUR-2001","+91 98765 43212","pass7733","B.Sc Nursing","Triage & Emergency","NUR-9812","female","5","Triage Bay 1"',
            '"Amit Patel","amit.patel@hospital.org","receptionist","reception","REC-3001","+91 98765 43213","pass6644","B.Com","Front Desk Operations","","male","3","Desk 1"',
        ];

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", csvContent);
        downloadAnchor.setAttribute("download", `sample_staff_template_${tenantId}.csv`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.removeChild(downloadAnchor);
    };

    // Handle Toggle Active Status
    const handleToggleStatus = async (employee) => {
        try {
            const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };
            const newStatus = !employee.is_active;
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${tenantId}/employees/${employee.id}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ is_active: newStatus }),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                if (notify) notify(isHi ? `कर्मचारी स्थिति अपडेट की गई: ${newStatus ? "सक्रिय" : "निलंबित"}` : `Staff status updated: ${newStatus ? "Active" : "Suspended"}`);
                fetchEmployees();
                if (fetchHospitalDeepDive) fetchHospitalDeepDive(tenantId, true);
            }
        } catch (err) {
            if (notify) notify(`Error toggling employee: ${err.message}`, "error");
        }
    };

    // Handle Delete Staff
    const handleDeleteStaff = (employee) => {
        const empName = employee.username || employee.name || "staff member";
        const confirmMsg = isHi
            ? `क्या आप निश्चित रूप से '${empName}' को हटाना चाहते हैं?`
            : `Are you sure you want to remove staff member '${empName}'?`;

        const executeDelete = async () => {
            try {
                const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };
                const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${tenantId}/employees/${employee.id}`, {
                    method: "DELETE",
                    headers,
                });
                const data = await res.json();
                if (res.ok && data.status === "success") {
                    if (notify) notify(isHi ? "स्टाफ सदस्य सफलतापूर्वक हटाया गया" : "Staff member removed successfully");
                    fetchEmployees();
                    if (fetchHospitalDeepDive) fetchHospitalDeepDive(tenantId, true);
                } else {
                    if (notify) notify(data.detail || data.message || "Failed to delete employee", "error");
                }
            } catch (err) {
                if (notify) notify(`Error deleting employee: ${err.message}`, "error");
            }
        };

        if (showConfirm) {
            showConfirm({
                title: isHi ? "स्टाफ सदस्य हटाएं" : "Remove Staff Member",
                message: confirmMsg,
                confirmText: isHi ? "हाँ, हटाएं" : "Remove",
                cancelText: isHi ? "रद्द करें" : "Cancel",
                isDestructive: true,
                onConfirm: executeDelete,
            });
        } else {
            executeDelete();
        }
    };

    // Filtered list
    const filteredEmployees = employees.filter((emp) => {
        const matchesQuery =
            !searchQuery.trim() ||
            (emp.username || emp.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (emp.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (emp.employee_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (emp.department || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole = roleFilter === "all" || (emp.role || "").toLowerCase() === roleFilter.toLowerCase();
        return matchesQuery && matchesRole;
    });

    const totalStaff = employees.length;
    const totalDoctors = employees.filter((e) => (e.role || "").toLowerCase().includes("doc")).length;
    const totalNurses = employees.filter((e) => (e.role || "").toLowerCase().includes("nur")).length;
    const totalDesk = employees.filter((e) => (e.role || "").toLowerCase().includes("recep") || (e.role || "").toLowerCase().includes("desk")).length;

    const validStaffCount = bulkParsedStaff.filter((s) => s.deptValid).length;
    const skippedStaffCount = bulkParsedStaff.filter((s) => !s.deptValid).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* 1. HEADER & SUMMARY CARDS */}
            <div className="branding-section-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: "rgba(2, 132, 199, 0.15)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#0284C7"
                            }}>
                                <IconUsers size={18} />
                            </span>
                            <span>{isHi ? "अस्पताल स्टाफ रोस्टर एवं नया कर्मचारी जोड़ें" : "Facility Staff Roster & Access Management"}</span>
                        </h3>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            onClick={fetchEmployees}
                            disabled={loadingEmployees}
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
                            <IconRefresh size={14} className={loadingEmployees ? "spin-animation" : ""} />
                            <span>{isHi ? "रीफ़्रेश" : "Refresh"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                handleRoleChange("doctor");
                                setShowAddModal(true);
                            }}
                            style={{
                                padding: "9px 18px",
                                borderRadius: "10px",
                                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                color: "#FFFFFF",
                                border: "none",
                                fontSize: "13px",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                            }}
                        >
                            <IconPlus size={16} />
                            <span>{isHi ? "+ नया कर्मचारी जोड़ें" : "+ Add Staff / Doctor"}</span>
                        </button>
                    </div>
                </div>

                {/* Staff KPI Pills */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "12px",
                    marginTop: "20px",
                }}>
                    <div style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--superadmin-sub-card, #F8FAFC)", border: "1.5px solid var(--superadmin-card-border, #E2E8F0)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>{isHi ? "कुल कर्मचारी" : "Total Staff"}</span>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A", marginTop: "2px" }}>{totalStaff}</div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.08)", border: "1.5px solid rgba(16, 185, 129, 0.25)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>{isHi ? "डॉक्टर / सलाहकार" : "Doctors / OPD"}</span>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#065F46", marginTop: "2px" }}>{totalDoctors}</div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(2, 132, 199, 0.08)", border: "1.5px solid rgba(2, 132, 199, 0.25)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284C7", textTransform: "uppercase" }}>{isHi ? "रिसेप्शन / काउंटर" : "Desk / Reception"}</span>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#0369A1", marginTop: "2px" }}>{totalDesk}</div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(124, 58, 237, 0.08)", border: "1.5px solid rgba(124, 58, 237, 0.25)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#7C3AED", textTransform: "uppercase" }}>{isHi ? "नर्सिंग व ट्राइएज" : "Nurses / Triage"}</span>
                        <div style={{ fontSize: "22px", fontWeight: 900, color: "#5B21B6", marginTop: "2px" }}>{totalNurses}</div>
                    </div>
                </div>
            </div>

            {/* HERO BULK IMPORT PREVIOUS STAFF ROSTER (EXCEL / CSV) */}
            <div className="branding-section-card" style={{
                padding: "22px 24px",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(2, 132, 199, 0.05) 100%)",
                border: "1.5px solid rgba(16, 185, 129, 0.35)",
                borderRadius: "16px",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                            <span style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#059669",
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
                            <IconDownload size={18} color="#059669" />
                            <span>{isHi ? "पूर्व स्टाफ एवं डॉक्टरों का डेटा एक्सेल / CSV फ़ाइल से जोड़ें" : "Upload Previous Staff Data (Excel / CSV)"}</span>
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
                        if (file) processStaffFile(file);
                    }}
                    style={{
                        border: isHeroDragging ? "2px dashed #059669" : "2px dashed rgba(16, 185, 129, 0.4)",
                        borderRadius: "12px",
                        padding: "20px",
                        textAlign: "center",
                        background: isHeroDragging ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.7)",
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
                        id="hero-staff-file-input"
                        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                        onChange={handleBulkFileChange}
                        style={{ display: "none" }}
                    />
                    <label htmlFor="hero-staff-file-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "100%" }}>
                        <div style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "10px",
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "#059669",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <IconDownload size={20} />
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                            {bulkFile ? bulkFile.name : (isHi ? "स्टाफ एक्सेल (.xlsx, .xls) या CSV फ़ाइल यहाँ चुनें अथवा ड्रैग करें" : "Click to select previous staff Excel (.xlsx, .xls) / CSV or drag & drop")}
                        </span>
                    </label>
                </div>

                {/* Parsed Staff Preview & Confirm Button */}
                {bulkParsedStaff.length > 0 && (
                    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 800, color: "#059669", display: "flex", alignItems: "center", gap: "6px" }}>
                                <IconCheckCircle size={16} />
                                <span>
                                    {validStaffCount} {isHi ? "स्टाफ रिकॉर्ड्स आयात हेतु तैयार हैं" : "staff records ready to import"}
                                    {skippedStaffCount > 0 && (
                                        <span style={{ color: "#DC2626", marginLeft: "6px", fontWeight: 700 }}>
                                            ({skippedStaffCount} {isHi ? "अमान्य विभाग के कारण छोड़े जाएंगे" : "skipped due to missing department"})
                                        </span>
                                    )}
                                </span>
                            </span>

                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBulkFile(null);
                                        setBulkParsedStaff([]);
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
                                    disabled={bulkLoading || validStaffCount === 0}
                                    style={{
                                        padding: "8px 18px",
                                        borderRadius: "8px",
                                        background: bulkLoading || validStaffCount === 0 ? "#94A3B8" : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                                        color: "#FFFFFF",
                                        border: "none",
                                        cursor: bulkLoading || validStaffCount === 0 ? "not-allowed" : "pointer",
                                        fontSize: "12.5px",
                                        fontWeight: 800,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
                                    }}
                                >
                                    {bulkLoading ? <IconRefresh size={14} className="spin-animation" /> : <IconCheckCircle size={14} />}
                                    <span>
                                        {bulkLoading
                                            ? (isHi ? "आयात हो रहा है..." : "Importing Staff...")
                                            : skippedStaffCount > 0
                                                ? (isHi ? `केवल ${validStaffCount} वैध कर्मचारी आयात करें (${skippedStaffCount} छोड़े जाएंगे)` : `Import ${validStaffCount} Valid Staff (${skippedStaffCount} skipped)`)
                                                : (isHi ? `सभी ${bulkParsedStaff.length} कर्मचारी आयात करें` : `Confirm & Import ${bulkParsedStaff.length} Staff`)}
                                    </span>
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
                                        ? `अनावश्यक अतिरिक्त कॉलम सुरक्षित रूप से छोड़ दिए गए: ${ignoredColumns.join(", ")} (केवल आवश्यक स्टाफ डेटा निकाला गया)`
                                        : `Safely ignored extra columns: ${ignoredColumns.join(", ")} (only required staff schema fields extracted)`}
                                </span>
                            </div>
                        )}

                        {/* Missing Departments Warning Banner (Option A: Show Warning & Don't Add) */}
                        {skippedStaffCount > 0 && (
                            <div style={{
                                padding: "10px 14px",
                                borderRadius: "8px",
                                background: "rgba(239, 68, 68, 0.08)",
                                border: "1.5px solid rgba(239, 68, 68, 0.28)",
                                color: "#991B1B",
                                fontSize: "12.5px",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexWrap: "wrap",
                            }}>
                                <IconAlertTriangle size={16} color="#DC2626" />
                                <span>
                                    <strong>{isHi ? "⚠️ अज्ञात विभाग छोड़ दिए जाएंगे:" : "⚠️ Unregistered Departments (Option A - Skipped):"}</strong>{" "}
                                    {isHi
                                        ? `${skippedStaffCount} पंक्तियाँ नहीं जोड़ी जाएंगी क्योंकि उनके विभाग इस अस्पताल में पंजीकृत नहीं हैं। केवल ${validStaffCount} वैध कर्मचारी जोड़े जाएंगे।`
                                        : `${skippedStaffCount} staff row${skippedStaffCount > 1 ? "s" : ""} will be skipped and NOT added because their departments do not exist in this hospital. Only ${validStaffCount} valid staff row${validStaffCount > 1 ? "s" : ""} will be imported.`}
                                </span>
                            </div>
                        )}

                        {/* Preview Table */}
                        <div style={{ overflowX: "auto", maxHeight: "210px", border: "1px solid var(--superadmin-card-border, #CBD5E1)", borderRadius: "10px", background: "var(--superadmin-card-bg, #FFFFFF)" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid #CBD5E1" }}>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Name</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Role</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Specialization</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Cabin / Room</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Department</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>Email</th>
                                        <th style={{ padding: "8px 10px", fontWeight: 800 }}>ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bulkParsedStaff.slice(0, 10).map((s, idx) => (
                                        <tr key={idx} style={{
                                            borderBottom: "1px solid rgba(0,0,0,0.04)",
                                            background: !s.deptValid ? "rgba(254, 242, 242, 0.75)" : "transparent",
                                        }}>
                                            <td style={{ padding: "7px 10px", fontWeight: 700 }}>
                                                {s.name}
                                                {s.qualification && <span style={{ fontSize: "10px", color: "#0284C7", marginLeft: "4px" }}>({s.qualification})</span>}
                                                {!s.deptValid && (
                                                    <span style={{ fontSize: "10px", color: "#DC2626", display: "block", fontWeight: 700, marginTop: "2px" }}>
                                                        ❌ Skipped (Will not be added)
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: "7px 10px", textTransform: "capitalize" }}>{s.role}</td>
                                            <td style={{ padding: "7px 10px", color: "#059669", fontWeight: 600 }}>{s.specialization || "—"}</td>
                                            <td style={{ padding: "7px 10px", color: "#D97706", fontWeight: 600 }}>{s.room_number || "—"}</td>
                                            <td style={{ padding: "7px 10px" }}>
                                                {!s.deptValid ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                                        <span style={{ fontWeight: 700, color: "#DC2626" }}>{s.missingDeptName || s.department || "—"}</span>
                                                        <span style={{
                                                            fontSize: "11px",
                                                            padding: "2px 7px",
                                                            borderRadius: "5px",
                                                            background: "#FEE2E2",
                                                            border: "1px solid #FCA5A5",
                                                            color: "#991B1B",
                                                            fontWeight: 700,
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            width: "fit-content",
                                                        }}>
                                                            ⚠️ Department "{s.missingDeptName || s.department}" does not exist in this hospital
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "var(--superadmin-text-main, #0F172A)", fontWeight: 600 }}>
                                                        {s.departmentDisplayName || s.department}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: "7px 10px", color: "#64748B" }}>{s.email}</td>
                                            <td style={{ padding: "7px 10px", fontFamily: "monospace" }}>{s.employee_id}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {bulkParsedStaff.length > 6 && (
                            <span style={{ fontSize: "11px", color: "#64748B" }}>
                                Showing preview of first 6 of {bulkParsedStaff.length} rows...
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

            {/* 2. SEARCH & FILTER CONTROLS */}
            <div className="branding-section-card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
                        <div style={{ position: "relative", width: "100%" }}>
                            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}>
                                <IconSearch size={16} />
                            </span>
                            <input
                                type="text"
                                placeholder={isHi ? "नाम, ईमेल या आईडी से खोजें..." : "Search staff by name, email, employee ID..."}
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

                    {/* Role Filter Pills */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {[
                            { id: "all", label: isHi ? "सभी" : "All Roles" },
                            { id: "doctor", label: isHi ? "डॉक्टर" : "Doctors" },
                            { id: "receptionist", label: isHi ? "रिसेप्शन" : "Desk" },
                            { id: "nurse", label: isHi ? "नर्स" : "Nurses" },
                            { id: "admin", label: isHi ? "एडमिन" : "Admins" },
                        ].map((role) => (
                            <button
                                key={role.id}
                                type="button"
                                onClick={() => setRoleFilter(role.id)}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    border: roleFilter === role.id ? "1.5px solid #0284C7" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                                    background: roleFilter === role.id ? "rgba(2, 132, 199, 0.1)" : "var(--superadmin-card-bg, #FFFFFF)",
                                    color: roleFilter === role.id ? "#0284C7" : "var(--superadmin-text-sub, #64748B)",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                }}
                            >
                                {role.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. STAFF TABLE */}
                <div style={{ marginTop: "16px", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                        <thead>
                            <tr style={{ background: "var(--superadmin-sub-card, #F8FAFC)", borderBottom: "1.5px solid var(--superadmin-card-border, #E2E8F0)" }}>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "कर्मचारी" : "Staff Member"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "पद / भूमिका" : "Role"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "विभाग" : "Department"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{isHi ? "कर्मचारी आईडी" : "Staff ID"}</th>
                                <th style={{ padding: "12px 14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", textAlign: "right" }}>{isHi ? "कार्य" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "#94A3B8" }}>
                                        {loadingEmployees
                                            ? (isHi ? "स्टाफ सूची लोड हो रही है..." : "Loading staff members...")
                                            : (isHi ? "कोई कर्मचारी रिकॉर्ड नहीं मिला।" : "No staff members found matching criteria.")}
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp) => {
                                    const isDoc = (emp.role || "").toLowerCase().includes("doc");

                                    return (
                                        <tr key={emp.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", transition: "background 0.15s ease" }}>
                                            <td style={{ padding: "12px 14px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <div style={{
                                                        width: "36px",
                                                        height: "36px",
                                                        borderRadius: "50%",
                                                        background: isDoc ? "rgba(16, 185, 129, 0.15)" : "rgba(2, 132, 199, 0.12)",
                                                        color: isDoc ? "#059669" : "#0284C7",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontWeight: 800,
                                                        fontSize: "14px",
                                                    }}>
                                                        {isDoc ? <IconStethoscope size={16} /> : (emp.username || emp.name || "U")[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                            <span>{emp.username || emp.name}</span>
                                                            {emp.qualification && (
                                                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284C7" }}>({emp.qualification})</span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "11.5px", color: "#64748B", marginTop: "2px" }}>
                                                            <span>{emp.email}</span>
                                                            {emp.specialization && (
                                                                <span style={{ fontSize: "10.5px", color: "#059669", background: "rgba(16, 185, 129, 0.1)", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>{emp.specialization}</span>
                                                            )}
                                                            {emp.room_number && (
                                                                <span style={{ fontSize: "10.5px", color: "#D97706", background: "rgba(217, 119, 6, 0.1)", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>{emp.room_number}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td style={{ padding: "12px 14px" }}>
                                                <span style={{
                                                    fontSize: "11.5px",
                                                    fontWeight: 700,
                                                    padding: "3px 8px",
                                                    borderRadius: "6px",
                                                    background: isDoc ? "rgba(16, 185, 129, 0.12)" : "rgba(2, 132, 199, 0.1)",
                                                    color: isDoc ? "#059669" : "#0284C7",
                                                    textTransform: "capitalize",
                                                }}>
                                                    {emp.role || "Staff"}
                                                </span>
                                            </td>

                                            <td style={{ padding: "12px 14px", color: "var(--superadmin-text-sub, #475569)", fontWeight: 600 }}>
                                                {emp.department || "General OPD"}
                                            </td>

                                            <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: "12px", color: "#64748B" }}>
                                                {emp.employee_id || `#${emp.id}`}
                                            </td>

                                            <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteStaff(emp)}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        color: "#EF4444",
                                                        cursor: "pointer",
                                                        padding: "4px 8px",
                                                        borderRadius: "6px",
                                                    }}
                                                    title="Delete staff"
                                                >
                                                    <IconTrash size={15} />
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

            {/* 4. BULK CSV IMPORT MODAL */}
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
                        maxWidth: "680px",
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
                                    <IconDownload size={20} color="#059669" />
                                    <span>{isHi ? "CSV/Excel फ़ाइल से स्टाफ जोड़ें" : "Upload Staff from CSV / Excel"}</span>
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
                                if (file) processStaffFile(file);
                            }}
                            style={{
                                border: isModalDragging ? "2px dashed #059669" : "2px dashed var(--superadmin-card-border, #CBD5E1)",
                                borderRadius: "14px",
                                padding: "22px",
                                textAlign: "center",
                                background: isModalDragging ? "rgba(16, 185, 129, 0.1)" : "var(--superadmin-sub-card, #F8FAFC)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "10px",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <input
                                type="file"
                                id="staff-csv-upload-input"
                                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                onChange={handleBulkFileChange}
                                style={{ display: "none" }}
                            />
                            <label htmlFor="staff-csv-upload-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "100%" }}>
                                <div style={{
                                    width: "44px",
                                    height: "44px",
                                    borderRadius: "12px",
                                    background: "rgba(16, 185, 129, 0.15)",
                                    color: "#059669",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}>
                                    <IconDownload size={20} />
                                </div>
                                <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                    {bulkFile ? bulkFile.name : (isHi ? "स्टाफ एक्सेल (.xlsx, .xls) या CSV फ़ाइल चुनें या यहाँ ड्रैग करें" : "Choose Staff Excel (.xlsx, .xls) / CSV or drag & drop")}
                                </span>

                            </label>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px", flexWrap: "wrap", justifyContent: "center" }}>
                                <button
                                    type="button"
                                    onClick={handleDownloadStaffExcelTemplate}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#059669",
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
                                    onClick={handleDownloadStaffCsvTemplate}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#0284C7",
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

                        {/* Preview of Parsed Staff Rows */}
                        {bulkParsedStaff.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#059669" }}>
                                        ✓ {validStaffCount} {isHi ? "स्टाफ रिकॉर्ड्स आयात हेतु तैयार हैं" : "staff records ready to import"}
                                    </span>
                                    {skippedStaffCount > 0 && (
                                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#DC2626", background: "#FEF2F2", padding: "2px 8px", borderRadius: "6px", border: "1px solid #FCA5A5" }}>
                                            ⚠️ {skippedStaffCount} {isHi ? "अमान्य विभाग के कारण छोड़े जाएँगे" : "will be skipped (unregistered dept)"}
                                        </span>
                                    )}
                                </div>

                                {/* Option A Warning Banner in Modal */}
                                {skippedStaffCount > 0 && (
                                    <div style={{
                                        padding: "9px 12px",
                                        borderRadius: "8px",
                                        background: "rgba(239, 68, 68, 0.08)",
                                        border: "1px solid rgba(239, 68, 68, 0.28)",
                                        color: "#B91C1C",
                                        fontSize: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        lineHeight: 1.4,
                                    }}>
                                        <IconAlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0 }} />
                                        <span>
                                            <strong>{isHi ? "चेतावनी (विकल्प A - सख्त नीति):" : "Option A Warning (Strict Policy):"}</strong>{" "}
                                            {isHi
                                                ? `${skippedStaffCount} स्टाफ सदस्य नहीं जोड़े जाएँगे क्योंकि उनका विभाग इस अस्पताल में पंजीकृत नहीं है।`
                                                : `${skippedStaffCount} staff row(s) will be SKIPPED and not added because their department is not registered in this hospital.`}
                                        </span>
                                    </div>
                                )}

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
                                                ? `अनावश्यक अतिरिक्त कॉलम छोड़ दिए गए: ${ignoredColumns.join(", ")} (केवल आवश्यक डेटा निकाला गया)`
                                                : `Safely ignored extra columns: ${ignoredColumns.join(", ")} (only required staff schema fields extracted)`}
                                        </span>
                                    </div>
                                )}

                                <div style={{ overflowX: "auto", maxHeight: "200px", border: "1px solid var(--superadmin-card-border, #CBD5E1)", borderRadius: "10px" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                                        <thead>
                                            <tr style={{ background: "rgba(0,0,0,0.04)", borderBottom: "1px solid #CBD5E1" }}>
                                                <th style={{ padding: "8px 10px" }}>Name</th>
                                                <th style={{ padding: "8px 10px" }}>Email</th>
                                                <th style={{ padding: "8px 10px" }}>Role</th>
                                                <th style={{ padding: "8px 10px" }}>Department</th>
                                                <th style={{ padding: "8px 10px" }}>ID</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkParsedStaff.slice(0, 8).map((s, idx) => (
                                                <tr
                                                    key={idx}
                                                    style={{
                                                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                                                        background: s.deptValid === false ? "rgba(239, 68, 68, 0.06)" : "transparent",
                                                    }}
                                                >
                                                    <td style={{ padding: "7px 10px", fontWeight: 700 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                            {s.deptValid === false && (
                                                                <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", background: "#FEE2E2", color: "#DC2626", fontWeight: 800 }}>
                                                                    SKIP
                                                                </span>
                                                            )}
                                                            <span>{s.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: "7px 10px", color: "#64748B" }}>{s.email}</td>
                                                    <td style={{ padding: "7px 10px", textTransform: "capitalize" }}>{s.role}</td>
                                                    <td style={{ padding: "7px 10px" }}>
                                                        {s.deptValid === false ? (
                                                            <span style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "4px",
                                                                padding: "2px 7px",
                                                                borderRadius: "6px",
                                                                background: "#FEF2F2",
                                                                border: "1px solid #FCA5A5",
                                                                color: "#DC2626",
                                                                fontSize: "11px",
                                                                fontWeight: 700,
                                                            }}>
                                                                ⚠️ Department "{s.missingDeptName || s.department}" does not exist in this hospital
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: "#0F172A", fontWeight: 600 }}>
                                                                {s.departmentDisplayName || s.department}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "7px 10px", fontFamily: "monospace" }}>{s.employee_id}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {bulkParsedStaff.length > 8 && (
                                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                                        Showing first 8 of {bulkParsedStaff.length} rows...
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
                                disabled={bulkLoading || validStaffCount === 0}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: "10px",
                                    background: bulkLoading || validStaffCount === 0 ? "#94A3B8" : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                                    color: "#FFFFFF",
                                    border: "none",
                                    cursor: bulkLoading || validStaffCount === 0 ? "not-allowed" : "pointer",
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                {bulkLoading ? <IconRefresh size={14} className="spin-animation" /> : <IconDownload size={14} />}
                                <span>
                                    {bulkLoading
                                        ? (isHi ? "आयात किया जा रहा है..." : "Importing Staff...")
                                        : validStaffCount === 0
                                            ? (isHi ? "कोई मान्य स्टाफ नहीं है" : "No Valid Staff to Import")
                                            : skippedStaffCount > 0
                                                ? (isHi ? `${validStaffCount} कर्मचारी आयात करें (${skippedStaffCount} छोड़े गए)` : `Import ${validStaffCount} Staff (${skippedStaffCount} Skipped)`)
                                                : (isHi ? `सभी ${validStaffCount} कर्मचारी आयात करें` : `Confirm & Import ${validStaffCount} Staff`)}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. ADD SINGLE EMPLOYEE MODAL */}
            {showAddModal && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.6)",
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
                        maxWidth: "520px",
                        width: "100%",
                        padding: "26px",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                        border: "1.5px solid var(--superadmin-card-border, #CBD5E1)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                                <IconPlus size={18} color="#0284C7" />
                                <span>{isHi ? "नया कर्मचारी / डॉक्टर जोड़ें" : "Add Staff Member to Facility"}</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        <div style={{ maxHeight: "78vh", overflowY: "auto", paddingRight: "4px" }}>
                            <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "पूरा नाम" : "Full Name"} *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Dr. Rajesh Sharma"
                                            value={staffForm.name || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "ईमेल आईडी" : "Email Address"} *</label>
                                        <input
                                            type="email"
                                            required
                                            placeholder="doctor@hospital.org"
                                            value={staffForm.email || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "भूमिका / पद" : "Role"} *</label>
                                        <select
                                            value={staffForm.role || "doctor"}
                                            onChange={(e) => handleRoleChange(e.target.value)}
                                            style={fieldInputStyle}
                                        >
                                            <option value="doctor">{isHi ? "डॉक्टर (Doctor / Consultant)" : "Doctor (Consultant)"}</option>
                                            <option value="receptionist">{isHi ? "रिसेप्शन / डेस्क ऑपरेटर" : "Desk / Receptionist"}</option>
                                            <option value="nurse">{isHi ? "नर्स / ट्राइएज" : "Nurse / Triage"}</option>
                                            <option value="pharmacist">{isHi ? "फार्मासिस्ट" : "Pharmacist"}</option>
                                            <option value="radiologist">{isHi ? "रेडियोलॉजिस्ट (Radiologist)" : "Radiologist"}</option>
                                            <option value="radiology_technician">{isHi ? "रेडियोलॉजी तकनीशियन (Radiographer)" : "Radiology Technician"}</option>
                                            <option value="pathologist">{isHi ? "पैथोलॉजिस्ट (Pathologist)" : "Pathologist"}</option>
                                            <option value="hospital_admin">{isHi ? "अस्पताल व्यवस्थापक" : "Hospital Admin"}</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "विभाग" : "Department"} *</label>
                                        <select
                                            value={staffForm.department || "consultation"}
                                            onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                                            style={fieldInputStyle}
                                        >
                                            <option value="consultation">General OPD (Consultation)</option>
                                            <option value="emergency">Emergency Care</option>
                                            <option value="cardiology">Cardiology</option>
                                            <option value="orthopedics">Orthopedics</option>
                                            <option value="pediatrics">Pediatrics</option>
                                            <option value="pharmacy">Pharmacy</option>
                                            <option value="laboratory">Laboratory / Pathology</option>
                                            <option value="radiology">Radiology</option>
                                            {hospitalDepts && hospitalDepts.map((d) => (
                                                <option key={d.dept_code || d.name} value={d.dept_code || d.name}>
                                                    {d.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "कर्मचारी आईडी" : "Staff ID"}</label>
                                        <input
                                            type="text"
                                            placeholder="DOC-9821"
                                            value={staffForm.employee_id || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, employee_id: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "फ़ोन नंबर" : "Contact Phone"}</label>
                                        <input
                                            type="text"
                                            placeholder="+91 98765 43210"
                                            value={staffForm.phone || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                </div>

                                {/* Clinical & Professional Profile */}
                                <div style={{
                                    margin: "2px 0",
                                    padding: "8px 12px",
                                    borderRadius: "8px",
                                    background: "rgba(2, 132, 199, 0.06)",
                                    border: "1px dashed rgba(2, 132, 199, 0.3)",
                                }}>
                                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        {isHi ? "चिकित्सा एवं व्यावसायिक जानकारी" : "Clinical & Professional Details"}
                                    </span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "योग्यता / डिग्री" : "Medical Qualification"}</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. MBBS, MD, MS"
                                            value={staffForm.qualification || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, qualification: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "विशेषज्ञता / पद" : "Specialization / Designation"}</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Senior Cardiologist, Pediatrician"
                                            value={staffForm.specialization || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "चिकित्सा लाइसेंस संख्या" : "Medical License / Reg No."}</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. MCI/NMC-49210"
                                            value={staffForm.license_number || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, license_number: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "अनुभव (वर्ष)" : "Experience (Years)"}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="60"
                                            placeholder="e.g. 8"
                                            value={staffForm.experience_years !== undefined ? staffForm.experience_years : ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, experience_years: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "ओपीडी केबिन / कमरा संख्या" : "OPD Cabin / Room No."}</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Cabin 104, Room 3"
                                            value={staffForm.room_number || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, room_number: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "लिंग" : "Gender"}</label>
                                        <select
                                            value={staffForm.gender || "other"}
                                            onChange={(e) => setStaffForm({ ...staffForm, gender: e.target.value })}
                                            style={fieldInputStyle}
                                        >
                                            <option value="male">{isHi ? "पुरुष (Male)" : "Male"}</option>
                                            <option value="female">{isHi ? "महिला (Female)" : "Female"}</option>
                                            <option value="other">{isHi ? "अन्य (Other / Unspecified)" : "Other / Unspecified"}</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "अस्थायी पासवर्ड" : "Initial Login Password"} *</label>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <input
                                            type="text"
                                            required
                                            value={staffForm.password || ""}
                                            onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                                            style={{ ...fieldInputStyle, fontFamily: "monospace", fontWeight: 700 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setStaffForm({ ...staffForm, password: "pass" + Math.floor(1000 + Math.random() * 9000) })}
                                            style={{
                                                padding: "8px 12px",
                                                borderRadius: "8px",
                                                border: "1px solid #CBD5E1",
                                                background: "var(--superadmin-sub-card, #F8FAFC)",
                                                cursor: "pointer",
                                                fontSize: "12px",
                                                fontWeight: 700,
                                            }}
                                        >
                                            Generate
                                        </button>
                                    </div>
                                </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{
                                        padding: "10px 16px",
                                        borderRadius: "10px",
                                        border: "1px solid #CBD5E1",
                                        background: "transparent",
                                        cursor: "pointer",
                                        fontSize: "13px",
                                        fontWeight: 700,
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: "10px",
                                        background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                        color: "#FFFFFF",
                                        border: "none",
                                        cursor: isSubmitting ? "not-allowed" : "pointer",
                                        fontSize: "13px",
                                        fontWeight: 800,
                                    }}
                                >
                                    {isSubmitting ? (isHi ? "जोड़ा जा रहा है..." : "Provisioning...") : (isHi ? "कर्मचारी जोड़ें" : "Provision Staff Member")}
                                </button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. CREATED CREDENTIALS CARD */}
            {createdCredentials && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.7)",
                    backdropFilter: "blur(4px)",
                    zIndex: 10000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px",
                }}>
                    <div style={{
                        background: "#FFFFFF",
                        borderRadius: "18px",
                        maxWidth: "460px",
                        width: "100%",
                        padding: "26px",
                        boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
                        border: "2px solid #0284C7",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <IconCheckCircle size={22} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                                    {isHi ? "कर्मचारी क्रेडेंशियल तैयार हैं" : "Staff Credentials Generated!"}
                                </h4>
                                <span style={{ fontSize: "12px", color: "#64748B" }}>
                                    {createdCredentials.hospital_name} ({tenantId})
                                </span>
                            </div>
                        </div>

                        <div style={{
                            padding: "16px",
                            borderRadius: "12px",
                            background: "#F8FAFC",
                            border: "1.5px solid #E2E8F0",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            fontSize: "13px",
                        }}>
                            <div><strong>Name:</strong> {createdCredentials.name}</div>
                            <div><strong>Email / Login:</strong> <span style={{ fontFamily: "monospace" }}>{createdCredentials.email}</span></div>
                            <div><strong>Temporary Password:</strong> <span style={{ fontFamily: "monospace", color: "#0284C7", fontWeight: 800 }}>{createdCredentials.password}</span></div>
                            <div><strong>Role:</strong> <span style={{ textTransform: "capitalize" }}>{createdCredentials.role}</span></div>
                            <div><strong>Department:</strong> {createdCredentials.department}</div>
                            {createdCredentials.specialization && (
                                <div><strong>Specialization:</strong> <span style={{ color: "#0284C7", fontWeight: 700 }}>{createdCredentials.specialization}</span></div>
                            )}
                            {createdCredentials.room_number && (
                                <div><strong>OPD Cabin:</strong> <span style={{ color: "#D97706", fontWeight: 700 }}>{createdCredentials.room_number}</span></div>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const text = `Hospital: ${createdCredentials.hospital_name}\nStaff: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nRole: ${createdCredentials.role}`;
                                    navigator.clipboard.writeText(text);
                                    if (notify) notify(isHi ? "क्रेडेंशियल क्लिपबोर्ड में कॉपी हो गए!" : "Credentials copied to clipboard!");
                                }}
                                style={{
                                    flex: 1,
                                    padding: "10px",
                                    borderRadius: "10px",
                                    background: "#0284C7",
                                    color: "#FFFFFF",
                                    border: "none",
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                }}
                            >
                                <IconCopy size={15} />
                                <span>{isHi ? "क्रेडेंशियल कॉपी करें" : "Copy Credentials"}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCreatedCredentials(null)}
                                style={{
                                    padding: "10px 16px",
                                    borderRadius: "10px",
                                    border: "1px solid #CBD5E1",
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    fontWeight: 700,
                                }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
