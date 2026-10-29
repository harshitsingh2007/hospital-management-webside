import React, { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../config/hospitalConfig";
import { t, getCategoryLabel } from "../utils/i18n";
import { generateOperatingHoursText } from "../utils/operatingHoursHelper";
import Footer from "../components/common/Footer";
import "../components/superadmin/SuperAdmin.css";
import { InAppToast, InAppConfirmModal } from "../components/common/InAppNotification";

// Modular SuperAdmin Components
import {
    IconShield,
    IconHospital,
    IconUsers,
    IconDesk,
    IconChart,
    IconBuilding,
    IconPlus,
    IconClock,
    IconPhone,
    IconMapPin,
    IconTrendingUp,
    IconPalette,
    IconChecklist,
    IconX,
    IconSliders,
    IconRefresh,
    IconFileText,
    IconExternalLink,
    IconSave,
    IconMonitor,
    IconMenu,
} from "../components/superadmin/SuperAdminIcons";

import SuperAdminSidebar from "../components/superadmin/SuperAdminSidebar";
import SuperAdminHospitalIllustration from "../components/superadmin/SuperAdminIllustration";

import {
    standaloneCardStyle,
    feedbackToastStyle,
    searchInputStyle,
    actionBtnStyle,
    sidebarSelectStyle,
} from "../components/superadmin/superAdminStyles";

import {
    Hospital360Overview,
    HospitalsDirectoryTab,
    StaffRosterTab,
    DesksManagementTab,
    DepartmentsTab,
    BrandingStudioTab,
    PatientVisitsTab,
    KiosksManagementTab,
    BroadcastCenterTab,
} from "../components/superadmin/tabs";

import {
    AddHospitalModal,
    AddEmployeeModal,
    EditEmployeeModal,
    ChangePasswordModal,
    AddDeskModal,
    EditDeskModal,
    AssignDeskModal,
    AddDeptModal,
    EditDeptModal,
    NABHReportModal,
} from "../components/superadmin/modals";

export default function SuperAdminPage({
    currentUser,
    language = "en",
    onSelectHospitalTenant,
    navigateTo,
    hospitalBranding = null,
    onUpdateHospitalBranding = null,
    theme = "light",
    setTheme = null,
    socketConnected: propSocketConnected = null,
}) {
    const isHi = language === "hi";
    const isDark = theme === "dark";

    // In-App Toast & Confirmation Modal States (replaces all browser alert() and confirm())
    const [inAppToast, setInAppToast] = useState(null); // { id, message, title, type: "success" | "error" | "warn" | "info" }
    const toastTimerRef = useRef(null);
    const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, confirmText, cancelText, isDestructive, onConfirm }

    const showToast = useCallback((msg, type = "success", durationMs = null) => {
        if (!msg) return;
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        const messageText = typeof msg === "object" ? msg.message : msg;
        const titleText = typeof msg === "object" ? msg.title : null;
        const finalType = (typeof msg === "object" ? msg.type : type) || "success";
        setInAppToast({ id: Date.now(), message: messageText, title: titleText, type: finalType });
        const autoDuration = durationMs || (finalType === "error" || finalType === "warn" ? 6500 : 4500);
        toastTimerRef.current = setTimeout(() => {
            setInAppToast(null);
        }, autoDuration);
    }, []);

    const showConfirm = useCallback(({ title, message, confirmText, cancelText, isDestructive, onConfirm }) => {
        setConfirmDialog({
            title,
            message,
            confirmText,
            cancelText,
            isDestructive: Boolean(isDestructive),
            onConfirm,
        });
    }, []);

    // Global State (Live Telemetry)
    const [overview, setOverview] = useState({
        total_hospitals: 0,
        active_hospitals: 0,
        total_employees: 0,
        active_doctors: 0,
        total_desks: 0,
        active_desks: 0,
        patients_today: 0,
        active_queues: 0,
    });
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [feedbackMsg, setFeedbackMsg] = useState("");

    // Navigation Tabs: "overview" | "hospitals" | "employees" | "desks" | "depts" | "visits" | "branding" | "kiosks" | "broadcasts"
    const [activeTab, setActiveTab] = useState("overview");
    const [activeBroadcastsCount, setActiveBroadcastsCount] = useState(0);

    // Sidebar & Real-time Connectivity States
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem("ai_queue_superadmin_sidebar_collapsed") === "true";
        } catch (e) {
            return false;
        }
    });
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [socketConnected, setSocketConnected] = useState(Boolean(propSocketConnected));

    useEffect(() => {
        if (propSocketConnected !== null) {
            setSocketConnected(Boolean(propSocketConnected));
        }
    }, [propSocketConnected]);

    // Escape Key Listener to dismiss mobile drawer
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && mobileDrawerOpen) {
                setMobileDrawerOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mobileDrawerOpen]);

    // Deep-Dive Selected Hospital Mode
    const [selectedHospital, setSelectedHospital] = useState(null);
    const selectedHospitalRef = useRef(selectedHospital);

    // Selected Hospital Sub-Data & Live Operations Telemetry
    const [hospitalEmployees, setHospitalEmployees] = useState([]);
    const [hospitalDesksData, setHospitalDesksData] = useState({ departments: [] });
    const [hospitalDepts, setHospitalDepts] = useState([]);
    const [hospitalAnalytics, setHospitalAnalytics] = useState(null);
    const [hospitalQueueSnapshot, setHospitalQueueSnapshot] = useState([]);
    const [hospitalServingTickets, setHospitalServingTickets] = useState([]);
    const [hospitalVisitsData, setHospitalVisitsData] = useState({ summary: {}, visits: [] });
    const [visitHistorySearchQuery, setVisitHistorySearchQuery] = useState("");
    const [visitHistoryStatusFilter, setVisitHistoryStatusFilter] = useState("all");
    const [showVisitHistoryTable, setShowVisitHistoryTable] = useState(true);

    // 1-Click Patient Visit History & Treatment Log CSV Export
    const handleDownloadVisitHistory = (visitsToExport, hospitalName) => {
        const list = visitsToExport || [];
        if (list.length === 0) {
            notify(isHi ? "डाउनलोड करने के लिए कोई विज़िट रिकॉर्ड उपलब्ध नहीं है।" : "No patient visit records available to download.", "warn");
            return;
        }
        const headers = [
            "Ticket ID",
            "Patient Name",
            "Age",
            "Gender",
            "Phone",
            "Clinical Department",
            "Visit Date & Time",
            "Consult Duration (Minutes)",
            "Status",
        ];
        const csvRows = [headers.join(",")];

        list.forEach((v) => {
            const dateStr = v.created_at
                ? new Date(v.created_at).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                })
                : v.queue_date || "Today";

            const row = [
                `"${(v.ticket_id || `#${v.id}` || "").toString().replace(/"/g, '""')}"`,
                `"${(v.patient_name || "Patient").toString().replace(/"/g, '""')}"`,
                `"${(v.age || "").toString().replace(/"/g, '""')}"`,
                `"${(v.gender || "").toString().replace(/"/g, '""')}"`,
                `"${(v.phone || "").toString().replace(/"/g, '""')}"`,
                `"${(v.department || "General OPD").toString().replace(/"/g, '""')}"`,
                `"${dateStr.toString().replace(/"/g, '""')}"`,
                `"${(v.service_duration_minutes || "").toString().replace(/"/g, '""')}"`,
                `"${(v.status || "completed").toString().replace(/"/g, '""')}"`,
            ];
            csvRows.push(row.join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
        const downloadAnchor = document.createElement("a");
        const safeHospName = (hospitalName || "Hospital").replace(/[^a-zA-Z0-9_-]/g, "_");
        const dateStamp = new Date().toISOString().split("T")[0];
        downloadAnchor.setAttribute("href", csvContent);
        downloadAnchor.setAttribute("download", `${safeHospName}_Patient_Visit_History_${dateStamp}.csv`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
    };

    // Real-time Live Operations Telemetry States
    const [lastSyncedAt, setLastSyncedAt] = useState(new Date());

    // Modals
    const [showAddHospitalModal, setShowAddHospitalModal] = useState(false);
    const [showEditHospitalModal, setShowEditHospitalModal] = useState(false);
    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
    const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
    const [showAddDeptModal, setShowAddDeptModal] = useState(false);
    const [showAddDeskModal, setShowAddDeskModal] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState(null);

    // Hospital Customization & Branding States
    const [brandingTargetHospital, setBrandingTargetHospital] = useState(null);
    const brandingLoadedHospCodeRef = useRef(null);
    const [brandingForm, setBrandingForm] = useState({
        name: "",
        hospital_code: "",
        status: "active",
        description: "",
        phone: "",
        email: "",
        address: "",
        logo_url: "",
        primary_color: "#0284C7",
        secondary_color: "#0369A1",
        accent_color: "#F0F9FF",
        tagline: "Care you can trust • NABH Accredited",
        emergency_helpline: "Emergency Helpline: 108 / +91 98765 43210",
        slip_footer_text: "Non-transferable official patient record. Please keep until consultation is complete.",
        about_us_title: "About City General Hospital",
        about_us_subtitle: "Care you can trust • NABH Accredited",
        about_us: "City General Hospital is a premier medical institution dedicated to patient-first care. Our AI-driven intelligent queue orchestration minimizes waiting times and prioritizes critical medical needs dynamically.",
        about_us_hi: "सिटी जनरल अस्पताल मरीज़-प्रथम सेवा हेतु समर्पित एक अग्रणी चिकित्सा संस्थान है। हमारा एआई-संचालित बुद्धिमान कतार प्रबंधन प्रतीक्षा समय को कम करता है और गंभीर मामलों को प्राथमिकता देता है।",
        about_service_1: "24/7 Emergency Triage • Priority ambulance & ICU care",
        about_service_2: "AI Wait Prediction • Live queue synchronization",
        about_service_3: "Multi-Specialty OPD • General, Cardiac, Neuro, Ortho",
        about_service_4: "Digital E-Prescriptions • Seamless pharmacy refills",
        about_stat_1_val: "15,000+",
        about_stat_1_lbl: "Monthly Patients",
        about_stat_2_val: "98%",
        about_stat_2_lbl: "Satisfaction Rate",
        about_stat_3_val: "< 8 min",
        about_stat_3_lbl: "Avg. Wait Time",
        about_stat_4_val: "24 / 7",
        about_stat_4_lbl: "Always Available",
        about_badge_1: "NABH Accredited",
        about_badge_1_sub: "National Standards",
        about_badge_2: "ISO 27001 Certified",
        about_badge_2_sub: "Data Security",
        about_badge_3: "Ayushman Bharat",
        about_badge_3_sub: "Govt. Empanelled",
        about_tech_highlights: "AI Queue Orchestration, Real-Time Socket Sync, Digital Prescriptions, QR Check-In, Priority Escalation, Multi-Language, Family Profiles, Live Analytics",
        about_why_choose: "No physical queue — get your token digitally from anywhere\nAI auto-escalates critical/emergency cases instantly\nBook for all family members from a single account\nLive queue status on mobile + real-time alerts\nDigital e-prescriptions — zero paperwork needed",
        opd_start_time: "08:00",
        opd_end_time: "20:00",
        registration_cutoff_time: "19:00",
        operating_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        available_time_slots: [
            "09:00 AM", "09:45 AM", "10:30 AM", "11:15 AM", "12:00 PM",
            "02:00 PM", "02:45 PM", "03:30 PM", "04:15 PM", "05:00 PM"
        ],
        closed_notice: "Registrations are closed for today. Please visit during OPD hours or book an appointment for tomorrow.",
        opd_helpdesk_phone: "+1 (800) 456-7890 (Ext: 101)",
        opd_helpdesk_hours: "Mon – Sat: 8:00 AM – 8:00 PM",
        opd_helpdesk_hours_hi: "सोम – शनि: सुबह 8:00 – रात 8:00",
        support_email: "support@citygeneralhospital.org",
    });
    const [isSavingBranding, setIsSavingBranding] = useState(false);
    const [activeBrandingTab, setActiveBrandingTab] = useState("profile");
    const [brandingPreviewMode, setBrandingPreviewMode] = useState("portal");

    const getAuthHeaders = useCallback(() => {
        const headers = { "Content-Type": "application/json" };
        if (currentUser?.email) {
            headers["X-User-Email"] = currentUser.email;
        }
        try {
            const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
        } catch (e) { }
        return headers;
    }, [currentUser?.email, currentUser?.token]);

    // Form States
    const [newHospitalForm, setNewHospitalForm] = useState({
        hospital_code: "",
        name: "",
        address: "",
        phone: "",
        email: "",
        description: "",
        status: "active",
    });

    const [editHospitalForm, setEditHospitalForm] = useState({
        hospital_code: "",
        name: "",
        address: "",
        phone: "",
        email: "",
        description: "",
        status: "active",
    });

    const [newEmployeeForm, setNewEmployeeForm] = useState({
        name: "",
        email: "",
        role: "doctor",
        department: "consultation",
        employee_id: "",
        phone: "",
        password: "pass" + Math.floor(1000 + Math.random() * 9000),
        qualification: "",
        specialization: "",
        license_number: "",
        gender: "other",
        experience_years: 0,
        room_number: "",
    });

    const [editEmployeeForm, setEditEmployeeForm] = useState({
        id: null,
        name: "",
        phone: "",
        role: "doctor",
        department: "consultation",
        employee_id: "",
        status: "active",
        password: "",
        qualification: "",
        specialization: "",
        license_number: "",
        gender: "other",
        experience_years: 0,
        room_number: "",
    });

    const [newDeptForm, setNewDeptForm] = useState({
        dept_code: "",
        name: "",
        description: "",
    });

    const [newDeskForm, setNewDeskForm] = useState({
        dept_code: "consultation",
        desk_name: "",
        status: "AVAILABLE",
        assigned_employee_id: "",
    });

    // Edit Department & Desk Modal States
    const [showEditDeptModal, setShowEditDeptModal] = useState(false);
    const [editDeptForm, setEditDeptForm] = useState({
        dept_code: "",
        name: "",
        description: "",
    });

    const [showEditDeskModal, setShowEditDeskModal] = useState(false);
    const [editDeskForm, setEditDeskForm] = useState({
        id: null,
        desk_name: "",
        dept_code: "",
        status: "AVAILABLE",
        assigned_employee_id: "",
    });

    // Dedicated Assign Desk Modal States
    const [showAssignDeskModal, setShowAssignDeskModal] = useState(false);
    const [assignDeskTarget, setAssignDeskTarget] = useState({ desk: null, employee_id: "" });
    const [assignSearchQuery, setAssignSearchQuery] = useState("");

    // Executive Report & Visual Analytics States
    const [showNABHReportModal, setShowNABHReportModal] = useState(false);
    const [hoveredChartHour, setHoveredChartHour] = useState(null);
    const [analyticsViewTab, setAnalyticsViewTab] = useState("all");

    // Real-Time Hourly Clinical Telemetry Computations Engine
    // Real-Time Hourly Clinical Telemetry Computations Engine (Dynamically scoped to hospital operating timing)
    const computeHourlyAnalytics = useCallback((visitsList = [], queueList = [], customBranding = null) => {
        // 1. Resolve authentic hospital operating timing
        let rawBranding = customBranding || null;
        if (!rawBranding && selectedHospital) {
            if (selectedHospital.branding_json) {
                if (typeof selectedHospital.branding_json === "string") {
                    try { rawBranding = JSON.parse(selectedHospital.branding_json); } catch (_) {}
                } else if (typeof selectedHospital.branding_json === "object") {
                    rawBranding = selectedHospital.branding_json;
                }
            }
            if (!rawBranding) {
                rawBranding = selectedHospital.branding || null;
            }
        }
        if (!rawBranding) {
            rawBranding = brandingForm || hospitalBranding || null;
        }

        const startTimeStr =
            rawBranding?.opd_start_time ||
            rawBranding?.registration_open_time ||
            brandingForm?.opd_start_time ||
            "08:00";

        const endTimeStr =
            rawBranding?.opd_end_time ||
            rawBranding?.registration_close_time ||
            rawBranding?.registration_cutoff_time ||
            brandingForm?.opd_end_time ||
            "20:00";

        const parseH = (str, def) => {
            if (!str) return def;
            const [h] = String(str).trim().split(":").map(Number);
            return isNaN(h) ? def : Math.max(0, Math.min(23, h));
        };

        let startHour = parseH(startTimeStr, 8);
        let endHour = parseH(endTimeStr, 20);

        if (endHour <= startHour) {
            if (startHour === 0 && (endHour === 0 || endTimeStr.includes("23:59") || endTimeStr.includes("23:58"))) {
                endHour = 23;
            } else if (startHour === 0 && endHour === 0) {
                endHour = 23;
            } else {
                endHour = Math.min(23, startHour + 12);
            }
        }

        let effectiveStart = startHour;
        let effectiveEnd = endHour;

        // Gracefully expand if actual visit records took place outside normal hours
        (visitsList || []).forEach((v) => {
            const ts = v.created_at || v.timestamp || v.visit_time;
            if (ts) {
                const d = new Date(ts);
                if (!isNaN(d.getTime())) {
                    const h = d.getHours();
                    if (h < effectiveStart) effectiveStart = Math.max(0, h);
                    if (h > effectiveEnd) effectiveEnd = Math.min(23, h);
                }
            }
        });

        const totalSlots = Math.max(1, effectiveEnd - effectiveStart + 1);
        const now = new Date();
        const currHour = now.getHours();
        const currMinute = now.getMinutes();
        const minuteFraction = Math.max(0.05, Math.min(0.95, currMinute / 60));

        let currentHourIdx = currHour - effectiveStart;
        const isCurrentlyActive = currHour >= effectiveStart && currHour <= effectiveEnd;

        // Helper to format hour label (12-hour AM/PM format)
        const formatHourLabel = (h) => {
            const ampm = h >= 12 ? "PM" : "AM";
            const displayH = h % 12 || 12;
            return `${displayH} ${ampm}`;
        };

        const getHourPhase = (h, isHindi) => {
            if (h >= 6 && h < 9) return isHindi ? "ओपीडी पंजीयन व ट्राइएज" : "Triage & Registration Opening";
            if (h >= 9 && h < 10) return isHindi ? "प्रातःकालीन परामर्श प्रारंभ" : "Morning Clinic Intake";
            if (h >= 10 && h < 12) return isHindi ? "सर्वोच्च भीड़ का समय" : "Peak Morning Surge";
            if (h >= 12 && h < 13) return isHindi ? "सघन ओपीडी परामर्श" : "High-Density Clinical Consults";
            if (h >= 13 && h < 14) return isHindi ? "दोपहर ओपीडी व शिफ्ट राउंड" : "Midday Outpatient Flow";
            if (h >= 14 && h < 16) return isHindi ? "अपराह्न ओपीडी प्रवाह" : "Afternoon Clinic Rush";
            if (h >= 16 && h < 17) return isHindi ? "विशेषज्ञ डॉक्टर परामर्श" : "Specialist Consultations";
            if (h >= 17 && h < 18) return isHindi ? "जांच रिपोर्ट समीक्षा" : "Diagnostic Reviews & Follow-ups";
            if (h >= 18 && h < 19) return isHindi ? "शाम का क्लिनिकल राउंड" : "Evening Clinic Handover";
            if (h >= 19 && h < 20) return isHindi ? "डेस्क समापन व राउंड" : "Counters Wrap-up & IPD Rounds";
            if (h >= 20 && h < 21) return isHindi ? "शाम का ओपीडी समापन" : "Evening OPD Closure";
            if (h >= 21 && h < 23) return isHindi ? "रात्रि आपातकालीन सेवा" : "Night Shift & Emergency Care";
            return isHindi ? "24/7 आपातकालीन ट्राइएज" : "Emergency Ward & Night Intake";
        };

        // 1. Process actual visit records (strictly genuine timestamps and real durations)
        const realHourCounts = new Array(totalSlots).fill(0);
        const realWaitMinutes = new Array(totalSlots).fill(0);
        const realConsultMinutes = new Array(totalSlots).fill(0);
        let totalRealVisits = 0;

        (visitsList || []).forEach((v) => {
            const ts = v.created_at || v.timestamp || v.visit_time;
            if (!ts) return;
            const d = new Date(ts);
            if (isNaN(d.getTime())) return;
            const h = d.getHours();
            const idx = h - effectiveStart;
            if (idx >= 0 && idx < totalSlots) {
                realHourCounts[idx] += 1;
                const wait = Number(v.wait_time_minutes ?? v.waitTime ?? 0);
                const consult = Number(v.service_duration_minutes ?? v.serviceDuration ?? 0);
                realWaitMinutes[idx] += wait;
                realConsultMinutes[idx] += consult;
                totalRealVisits += 1;
            }
        });

        // 2. Blend real queue data into active hour
        const liveQueueCount = (queueList || []).length;
        if (liveQueueCount > 0 && currentHourIdx >= 0 && currentHourIdx < totalSlots) {
            realHourCounts[currentHourIdx] += liveQueueCount;
            let totalQueueWait = 0;
            (queueList || []).forEach((q) => {
                const waitMin = Number(q.estimated_wait_minutes ?? q.waiting_time ?? q.waitTime ?? 0);
                totalQueueWait += waitMin;
            });
            realWaitMinutes[currentHourIdx] += totalQueueWait;
        }

        let peakIndex = 0;
        let maxVolume = 0;

        const hours = [];
        for (let i = 0; i < totalSlots; i++) {
            const h = effectiveStart + i;
            const hourStr = `${String(h).padStart(2, "0")}:00`;
            const label = formatHourLabel(h);
            const phase = getHourPhase(h, isHi);

            const count = realHourCounts[i];
            let avgWait = 0;
            let avgConsult = 0;

            if (count > 0) {
                avgWait = Math.round((realWaitMinutes[i] / count) * 10) / 10;
                avgConsult = Math.round((realConsultMinutes[i] / count) * 10) / 10;
            }

            if (count > maxVolume) {
                maxVolume = count;
                peakIndex = i;
            }

            const isPast = isCurrentlyActive ? i < currentHourIdx : (currHour > effectiveEnd);
            const isCurrent = isCurrentlyActive && i === currentHourIdx;
            const isFuture = isCurrentlyActive ? i > currentHourIdx : (currHour < effectiveStart);
            const compliancePct = count === 0
                ? 100
                : Math.max(50, Math.min(100, Math.round(100 - Math.max(0, avgWait - 15) * 3.2)));

            hours.push({
                hour: hourStr,
                label,
                phase,
                count,
                avgWait,
                avgConsult,
                compliancePct,
                isPast,
                isCurrent,
                isFuture,
                liveQueue: isCurrent ? liveQueueCount : 0,
            });
        }

        const peakHour = maxVolume > 0 ? (hours[peakIndex] || hours[0]) : null;
        const safeCurrentIdx = Math.max(0, Math.min(hours.length - 1, currentHourIdx >= 0 ? currentHourIdx : 0));
        const currentHourObj = hours[safeCurrentIdx] || { count: 0, avgWait: 0, avgConsult: 0 };

        return {
            hourlyData: hours,
            maxVolume: maxVolume,
            totalVisits: totalRealVisits + liveQueueCount,
            peakHourLabel: peakHour
                ? `${peakHour.label || ""} – ${hours[Math.min(hours.length - 1, peakIndex + 1)]?.label || (isHi ? "समापन" : "Close")}`
                : (isHi ? "कोई आवक नहीं" : "No Activity"),
            peakVolume: peakHour ? peakHour.count : 0,
            peakAvgWait: peakHour ? peakHour.avgWait : 0,
            currentHourIdx: isCurrentlyActive ? currentHourIdx : (currHour > effectiveEnd ? hours.length - 1 : 0),
            isCurrentlyActive,
            minuteFraction,
            currentThroughput: currentHourObj.count || 0,
            currentWait: currentHourObj.avgWait || 0,
            currentConsult: currentHourObj.avgConsult || 0,
            operatingHoursLabel: `${formatHourLabel(effectiveStart)} – ${formatHourLabel(effectiveEnd)}`,
        };
    }, [isHi, selectedHospital, brandingForm, hospitalBranding]);

    // Department Bottleneck Analytics Computations Engine
    const computeDepartmentBottlenecks = useCallback((departments = [], queueSnapshot = [], rawVisits = []) => {
        const depts = (departments || []).map((d) => {
            const dCode = d.dept_code || d.code || d.name;
            const name = d.name || d.department_name || dCode;

            const waitingList = (queueSnapshot || []).filter(
                (q) => (q.dept_code === dCode || q.department_code === dCode || q.department === name || q.dept === name) && (q.status === "waiting" || q.status === "WAITING")
            );
            const servingList = (queueSnapshot || []).filter(
                (q) => (q.dept_code === dCode || q.department_code === dCode || q.department === name || q.dept === name) && (q.status === "serving" || q.status === "SERVING")
            );

            const deptVisits = (rawVisits || []).filter(
                (v) => v.department === name || v.department === dCode || v.department_code === dCode || (v.dept_code && v.dept_code === dCode)
            );

            const totalVolume = deptVisits.length + waitingList.length + servingList.length;
            const waitingCount = waitingList.length;
            const servingCount = servingList.length;

            let totalTat = 0;
            deptVisits.forEach((v) => {
                totalTat += Number(v.service_duration_minutes || 0) + Number(v.wait_time_minutes || 0);
            });
            const avgTAT = deptVisits.length > 0
                ? Math.round((totalTat / deptVisits.length) * 10) / 10
                : (waitingCount > 0 ? Math.round((waitingCount * 2.5) * 10) / 10 : 0);

            let severity = "OPTIMAL";
            let severityColor = "#10B981";
            let severityBg = "rgba(16, 185, 129, 0.15)";
            let severityBorder = "rgba(16, 185, 129, 0.3)";
            let recommendation = isHi ? "प्रवाह सामान्य है • कोई अतिरिक्त डेस्क की आवश्यकता नहीं" : "Flow is optimal • Standard staffing sufficient";

            if (waitingCount >= 5 || avgTAT > 22) {
                severity = "SEVERE";
                severityColor = "#EF4444";
                severityBg = "rgba(239, 68, 68, 0.15)";
                severityBorder = "rgba(239, 68, 68, 0.3)";
                recommendation = isHi
                    ? `गंभीर लोड: ${name} में तत्काल +1 अतिरिक्त डेस्क सक्रिय करें या डॉक्टर पुनः असाइन करें।`
                    : `Congestion Surge: Activate +1 desk in ${name} immediately or reassign standby clinician.`;
            } else if (waitingCount >= 2 || avgTAT > 14) {
                severity = "MODERATE";
                severityColor = "#F59E0B";
                severityBg = "rgba(245, 158, 11, 0.15)";
                severityBorder = "rgba(245, 158, 11, 0.3)";
                recommendation = isHi
                    ? `मध्यम प्रतीक्षा: परामर्श थ्रूपुट पर नजर रखें।`
                    : `Moderate queue: Monitor consultation throughput.`;
            }

            return {
                code: dCode,
                name,
                totalVolume,
                waitingCount,
                servingCount,
                completedCount: deptVisits.length,
                avgTAT,
                severity,
                severityColor,
                severityBg,
                severityBorder,
                recommendation,
            };
        });

        const grandTotal = depts.reduce((acc, cur) => acc + cur.totalVolume, 0) || 1;
        depts.forEach((d) => {
            d.sharePercent = Math.round((d.totalVolume / grandTotal) * 100);
        });

        return depts;
    }, [isHi]);

    // 1-Click NABH-Compliant Executive Daily Report Print Handler
    const handlePrintNABHReport = (reportData) => {
        try {
            const dateStr = new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
            const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

            const safeHospName = reportData?.hospitalName || "City General Hospital";
            const safeHospCode = reportData?.hospitalCode || "HOSP-HQ";
            const safeAddress = reportData?.address || "742 Evergreen Healthcare Ave";
            const safeTotalPatients = reportData?.totalPatients ?? 0;
            const safeCompleted = reportData?.completedCount ?? 0;
            const safeWaiting = reportData?.waitingCount ?? 0;
            const safeAvgWait = reportData?.avgWaitTime ?? 12;
            const safePeakRush = reportData?.peakRushWindow || "10:00 AM – 12:00 PM";
            const safeScore = reportData?.complianceScore ?? 98;
            const safeRec = reportData?.primaryRecommendation || "All clinical departments operating within standard NABH benchmark wait thresholds.";
            const depts = reportData?.departmentBreakdown || [];

            const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeHospName} - NABH Executive Daily Audit Report</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0F172A; background: #FFFFFF; margin: 0; padding: 20px; font-size: 10pt; line-height: 1.45; }
    .header { border-bottom: 2.5px solid #0284C7; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start; }
    .hospital-title { font-size: 19pt; font-weight: 800; color: #0284C7; margin: 0 0 4px 0; }
    .hospital-meta { font-size: 9pt; color: #475569; }
    .nabh-badge { border: 1.5px solid #16A34A; background: #F0FDF4; color: #15803D; padding: 6px 12px; border-radius: 8px; font-size: 9pt; font-weight: 700; text-align: right; }
    .section-title { font-size: 11pt; font-weight: 800; color: #0F172A; margin: 16px 0 8px 0; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; display: flex; justify-content: space-between; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi-box { border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; background: #F8FAFC; }
    .kpi-label { font-size: 8pt; color: #64748B; font-weight: 700; text-transform: uppercase; }
    .kpi-val { font-size: 15pt; font-weight: 900; color: #0284C7; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9pt; }
    th { background: #0F172A; color: #FFFFFF; text-align: left; padding: 7px 9px; font-weight: 700; font-size: 8.5pt; }
    td { padding: 7px 9px; border-bottom: 1px solid #E2E8F0; }
    tr:nth-child(even) td { background: #F8FAFC; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 8pt; font-weight: 700; }
    .badge-optimal { background: #DCFCE7; color: #15803D; }
    .badge-moderate { background: #FEF3C7; color: #B45309; }
    .badge-severe { background: #FEE2E2; color: #B91C1C; }
    .signatures { margin-top: 36px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    .sign-box { width: 190px; border-top: 1.5px solid #64748B; padding-top: 6px; text-align: center; font-size: 8.5pt; color: #475569; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="hospital-title">${safeHospName}</h1>
      <div class="hospital-meta">
        <strong>Facility Code:</strong> ${safeHospCode} &bull; <strong>Address:</strong> ${safeAddress}<br />
        <strong>Report:</strong> Daily Executive Operations & Clinical Audit Log &bull; <strong>Date:</strong> ${dateStr} (${timeStr})
      </div>
    </div>
    <div class="nabh-badge">
      &#10003; NABH ACCREDITED AUDIT<br />
      <span style="font-size: 8pt; font-weight: normal; color: #475569;">ISO 9001:2015 Healthcare Standard</span>
    </div>
  </div>

  <div class="section-title">
    <span>1. EXECUTIVE QUALITY & QUEUE BENCHMARKS (NABH STANDARD COP 3.1)</span>
    <span style="font-size: 8.5pt; font-weight: normal; color: #64748B;">Target Turnaround Time &lt; 15 mins</span>
  </div>
  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-label">Total Patient Registrations</div>
      <div class="kpi-val">${safeTotalPatients}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Consultations Completed</div>
      <div class="kpi-val" style="color: #10B981;">${safeCompleted}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Average Wait Time (TAT)</div>
      <div class="kpi-val" style="color: #6366F1;">${safeAvgWait} min</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Peak Rush Window</div>
      <div class="kpi-val" style="font-size: 12pt; color: #D97706; margin-top: 5px;">${safePeakRush}</div>
    </div>
  </div>

  <div class="section-title">
    <span>2. DEPARTMENTAL THROUGHPUT & BOTTLENECK AUDIT</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Department</th>
        <th>Total Traffic</th>
        <th>Served</th>
        <th>Waiting</th>
        <th>Avg Turnaround Time</th>
        <th>Bottleneck Status</th>
      </tr>
    </thead>
    <tbody>
      ${depts.map((d) => `
        <tr>
          <td><strong>${d.name || d.code}</strong> (${d.code})</td>
          <td>${d.totalVolume ?? 0} patients</td>
          <td>${d.completedCount ?? 0}</td>
          <td>${d.waitingCount ?? 0}</td>
          <td>${d.avgTAT ?? 12} mins</td>
          <td>
            <span class="badge ${d.severity === 'OPTIMAL' ? 'badge-optimal' : d.severity === 'MODERATE' ? 'badge-moderate' : 'badge-severe'}">
              ${d.severity || 'OPTIMAL'}
            </span>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title" style="margin-top: 20px;">
    <span>3. AI OPERATIONAL RECOMMENDATIONS & COMPLIANCE SIGN-OFF</span>
  </div>
  <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px 14px; border-radius: 8px; font-size: 9pt;">
    <strong>Quality Assurance Finding:</strong> Hospital turnaround time is operating at <strong>${safeScore}%</strong> compliance with national NABH standards. Peak volume period detected at <em>${safePeakRush}</em>. 
    <br />
    <strong>Action Item:</strong> ${safeRec}
  </div>

  <div class="signatures">
    <div class="sign-box">
      <strong>Dr. In-Charge / Medical Superintendent</strong><br />
      Clinical Administration
    </div>
    <div class="sign-box">
      <strong>NABH Quality Assurance Officer</strong><br />
      Compliance & Safety Board
    </div>
    <div class="sign-box">
      <strong>Hospital Super Admin</strong><br />
      Executive Operations
    </div>
  </div>
</body>
</html>`;

            let iframe = document.getElementById("nabh-print-iframe");
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "nabh-print-iframe";
                iframe.style.position = "fixed";
                iframe.style.right = "0";
                iframe.style.bottom = "0";
                iframe.style.width = "0";
                iframe.style.height = "0";
                iframe.style.border = "0";
                document.body.appendChild(iframe);
            }

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(htmlContent);
            doc.close();

            setTimeout(() => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (printErr) {
                    console.warn("iFrame print failed, opening fallback window:", printErr);
                    const printWindow = window.open("", "_blank");
                    if (printWindow) {
                        printWindow.document.open();
                        printWindow.document.write(htmlContent);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => printWindow.print(), 350);
                    }
                }
            }, 350);
        } catch (err) {
            console.error("Error generating NABH Report:", err);
            notify("Error generating report: " + err.message, "error");
        }
    };

    // 1-Click NABH Executive Daily CSV / Excel Export Handler with UTF-8 BOM
    const handleDownloadNABHExcel = (reportData) => {
        try {
            const safeHospName = reportData?.hospitalName || "City General Hospital";
            const safeHospCode = reportData?.hospitalCode || "HOSP-HQ";
            const safeAddress = reportData?.address || "742 Evergreen Healthcare Ave";
            const safeTotalPatients = reportData?.totalPatients ?? 0;
            const safeCompleted = reportData?.completedCount ?? 0;
            const safeWaiting = reportData?.waitingCount ?? 0;
            const safeAvgWait = reportData?.avgWaitTime ?? 12;
            const safePeakRush = reportData?.peakRushWindow || "10:00 AM – 12:00 PM";
            const safeDocs = reportData?.doctorsOnDuty ?? 0;
            const safeStaff = reportData?.totalStaff ?? 0;
            const safeScore = reportData?.complianceScore ?? 98;
            const depts = reportData?.departmentBreakdown || [];

            const headers = [
                "--- NABH EXECUTIVE DAILY OPERATIONS AUDIT REPORT ---",
                `Hospital Name,${safeHospName}`,
                `Facility Code,${safeHospCode}`,
                `Campus Address,"${safeAddress.replace(/"/g, '""')}"`,
                `Generated At,${new Date().toLocaleString()}`,
                `NABH Compliance Standard,COP 3.1 & AAC 4.2`,
                "",
                "--- EXECUTIVE KEY PERFORMANCE METRICS ---",
                `Total Patients Registered,${safeTotalPatients}`,
                `Consultations Completed,${safeCompleted}`,
                `Currently In Queue,${safeWaiting}`,
                `Average Turnaround Time (Minutes),${safeAvgWait}`,
                `Peak Rush Hour Window,"${safePeakRush}"`,
                `Doctors On Duty,${safeDocs}`,
                `Total Staff,${safeStaff}`,
                `NABH Compliance Score,${safeScore}%`,
                "",
                "--- DEPARTMENT BOTTLENECK ANALYSIS ---",
                "Department Code,Department Name,Total Volume,Completed,Waiting,Avg TAT (Mins),Status,Recommendation",
            ];

            const deptRows = depts.map((d) =>
                [
                    `"${d.code || ''}"`,
                    `"${(d.name || d.code || '').replace(/"/g, '""')}"`,
                    `"${d.totalVolume ?? 0}"`,
                    `"${d.completedCount ?? 0}"`,
                    `"${d.waitingCount ?? 0}"`,
                    `"${d.avgTAT ?? 12}"`,
                    `"${d.severity || 'OPTIMAL'}"`,
                    `"${(d.recommendation || '').replace(/"/g, '""')}"`,
                ].join(",")
            );

            const bom = "\uFEFF";
            const csvString = bom + headers.concat(deptRows).join("\r\n");
            const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);

            const downloadAnchor = document.createElement("a");
            const cleanHospName = safeHospName.replace(/[^a-zA-Z0-9_-]/g, "_");
            const dateStamp = new Date().toISOString().split("T")[0];
            downloadAnchor.setAttribute("href", url);
            downloadAnchor.setAttribute("download", `${cleanHospName}_NABH_Daily_Executive_Report_${dateStamp}.csv`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            document.body.removeChild(downloadAnchor);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error exporting NABH CSV:", err);
            notify("Error exporting CSV: " + err.message, "error");
        }
    };

    // Normalize desks data ensuring department grouping and desk counters are always populated
    const normalizeDesksData = useCallback((rawDesks, deptsList = []) => {
        if (!rawDesks) return { total_desks: 0, active_desks: 0, departments: [] };
        if (!Array.isArray(rawDesks) && Array.isArray(rawDesks.departments)) {
            return rawDesks;
        }
        const deskList = Array.isArray(rawDesks) ? rawDesks : (rawDesks.list || rawDesks.raw || []);
        const deptMap = {};
        (deptsList || []).forEach((d) => {
            deptMap[d.dept_code] = {
                dept_code: d.dept_code,
                name: d.name,
                description: d.description || "",
                total_desks: 0,
                active_desks: 0,
                desks: [],
            };
        });
        let activeCount = 0;
        deskList.forEach((desk) => {
            const dCode = desk.dept_code || "consultation";
            if (!deptMap[dCode]) {
                deptMap[dCode] = {
                    dept_code: dCode,
                    name: desk.department_name || dCode,
                    description: "",
                    total_desks: 0,
                    active_desks: 0,
                    desks: [],
                };
            }
            deptMap[dCode].total_desks += 1;
            const st = (desk.status || "").toUpperCase();
            const isAssigned = Boolean(desk.assigned_employee_id || desk.assigned_user_id || desk.assigned_employee_name || desk.staff_name);
            if (["ACTIVE", "OCCUPIED", "BUSY", "SERVING"].includes(st) || (st === "AVAILABLE" && isAssigned)) {
                deptMap[dCode].active_desks += 1;
                activeCount += 1;
            }
            deptMap[dCode].desks.push({
                ...desk,
                assigned_employee_id: desk.assigned_employee_id || null,
                assigned_user_id: desk.assigned_user_id || null,
                assigned_employee_name: desk.assigned_employee_name || desk.staff_name || "",
                assigned_employee_role: desk.assigned_employee_role || "",
                assigned_employee_code: desk.assigned_employee_code || "",
                assigned_employee_status: desk.assigned_employee_status || "inactive",
                assigned_employee_last_login: desk.assigned_employee_last_login || null,
                staff_name: desk.assigned_employee_name || desk.staff_name || "",
            });
        });
        return {
            total_desks: deskList.length,
            active_desks: activeCount,
            departments: Object.values(deptMap),
        };
    }, []);

    const getEmployeeCurrentDesk = useCallback((empOrId) => {
        if (!empOrId) return null;
        let targetIds = [];

        if (typeof empOrId === "object") {
            targetIds = [empOrId.employee_id_num, empOrId.user_id, empOrId.id].filter(Boolean).map(Number);
        } else {
            targetIds = [Number(empOrId)];
        }

        const allDepts = hospitalDesksData.departments || [];
        for (const dept of allDepts) {
            for (const d of dept.desks || []) {
                if (d.assigned_employee_id && targetIds.includes(Number(d.assigned_employee_id))) {
                    return d;
                }
                if (d.assigned_user_id && targetIds.includes(Number(d.assigned_user_id))) {
                    return d;
                }
            }
        }

        if (typeof empOrId === "object") {
            const targetName = (empOrId.name || empOrId.username || "").trim().toLowerCase();
            if (targetName) {
                for (const dept of allDepts) {
                    for (const d of dept.desks || []) {
                        if (d.assigned_employee_name && d.assigned_employee_name.trim().toLowerCase() === targetName) {
                            return d;
                        }
                    }
                }
            }
        }

        return null;
    }, [hospitalDesksData]);

    // Search & Pagination inside Drill-In View
    const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
    const [employeePage, setEmployeePage] = useState(1);
    const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all");
    const [isTogglingEmpStatus, setIsTogglingEmpStatus] = useState(null);
    const [deskSearchQuery, setDeskSearchQuery] = useState("");

    // Helper to format relative login / activity time
    const formatRelativeLogin = useCallback((isoString) => {
        if (!isoString) return isHi ? "लॉगिन नहीं किया" : "Not logged in";
        try {
            const d = new Date(isoString);
            const now = new Date();
            const diffSec = Math.max(0, Math.floor((now - d) / 1000));
            if (diffSec < 60) return isHi ? "अभी सक्रिय" : "Just now";
            const diffMin = Math.floor(diffSec / 60);
            if (diffMin < 60) return `${diffMin}m ${isHi ? "पहले" : "ago"}`;
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `${diffHr}h ${isHi ? "पहले" : "ago"}`;
            return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        } catch (e) {
            return "";
        }
    }, [isHi]);

    // Fast toggle active/inactive status for doctors & staff
    const handleToggleEmployeeStatus = async (emp) => {
        if (!selectedHospital || !emp) return;
        const currentIsActive = (emp.status || "").toLowerCase() === "active";
        const newStatus = currentIsActive ? "inactive" : "active";
        const empTargetId = emp.user_id || emp.id || emp.employee_id_num;
        setIsTogglingEmpStatus(empTargetId);
        try {
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/employees/${empTargetId}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    status: newStatus,
                }),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setHospitalEmployees((prev) =>
                    prev.map((e) =>
                        (e.user_id === empTargetId || e.id === empTargetId || e.employee_id_num === empTargetId)
                            ? { ...e, status: newStatus }
                            : e
                    )
                );
                notify(
                    isHi
                        ? `'${emp.name || emp.username}' की स्थिति '${newStatus === "active" ? "सक्रिय (ऑनलाइन)" : "निष्क्रिय (ऑफलाइन)"}' में बदली गई!`
                        : `Status for '${emp.name || emp.username}' changed to ${newStatus === "active" ? "Active (Online)" : "Inactive (Offline)"}!`
                );
                fetchHospitalDeepDive(selectedHospital.hospital_code);
            } else {
                notify(data.message || (isHi ? "स्थिति बदलने में विफल" : "Failed to toggle status"));
            }
        } catch (err) {
            console.error("Error toggling employee status:", err);
            notify(isHi ? "सर्वर से कनेक्ट करने में विफल" : "Network error toggling status");
        } finally {
            setIsTogglingEmpStatus(null);
        }
    };

    // Change Password Modal States for Doctors & Staff
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [passwordTargetEmployee, setPasswordTargetEmployee] = useState(null);
    const [newPasswordValue, setNewPasswordValue] = useState("");
    const [showPasswordText, setShowPasswordText] = useState(true);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState(null);

    const notify = useCallback((msg, type = "success") => {
        const text = typeof msg === "object" ? msg?.message || JSON.stringify(msg) : msg;
        setFeedbackMsg(text);
        setTimeout(() => setFeedbackMsg(""), 4000);
        showToast(msg, type);
    }, [showToast]);

    useEffect(() => {
        setEmployeeSearchQuery("");
        setEmployeePage(1);
        setEmployeeStatusFilter("all");
        setDeskSearchQuery("");
    }, [selectedHospital?.hospital_code]);

    useEffect(() => {
        selectedHospitalRef.current = selectedHospital;
    }, [selectedHospital]);

    // 1. Fetch Global Overview & Hospital Directory
    const fetchGlobalData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const headers = getAuthHeaders();
            const [overviewRes, hospitalsRes, broadcastsRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/superadmin/overview`, { headers }).then((r) => r.json()).catch(() => null),
                fetch(`${API_BASE}/api/v1/superadmin/hospitals`, { headers }).then((r) => r.json()).catch(() => null),
                fetch(`${API_BASE}/api/v1/broadcasts/active`, { headers }).then((r) => r.json()).catch(() => null),
            ]);

            if (overviewRes && overviewRes.status === "success") {
                setOverview((prev) => (JSON.stringify(prev) === JSON.stringify(overviewRes.overview) ? prev : overviewRes.overview));
            }
            if (broadcastsRes && broadcastsRes.status === "success" && typeof broadcastsRes.count === "number") {
                setActiveBroadcastsCount(broadcastsRes.count);
            }
            if (hospitalsRes && hospitalsRes.status === "success") {
                let list = hospitalsRes.hospitals || [];

                // Filter to only hospitals related to current user if user has an assigned hospital or owned facility
                const userHospCode = currentUser?.primary_hospital_code || currentUser?.hospital_code;
                const userEmail = (currentUser?.email || "").toLowerCase();
                const userId = currentUser?.id;

                if (currentUser && (userHospCode || userId || userEmail)) {
                    const scoped = list.filter((h) => {
                        if (userHospCode && userHospCode !== "all" && h.hospital_code === userHospCode) return true;
                        if (userId && h.owner_user_id && String(h.owner_user_id) === String(userId)) return true;
                        if (userEmail && h.email && h.email.toLowerCase() === userEmail) return true;
                        return false;
                    });
                    if (scoped.length > 0) {
                        list = scoped;
                    }
                }

                // Ensure logo_url is populated from branding_json if present
                list = list.map((h) => {
                    const bJson = typeof h.branding_json === "string"
                        ? (() => { try { return JSON.parse(h.branding_json); } catch (e) { return {}; } })()
                        : (h.branding_json || {});
                    return {
                        ...h,
                        logo_url: h.logo_url || bJson?.logo_url || "",
                    };
                });

                setHospitals((prev) => {
                    if (prev.length === list.length && JSON.stringify(prev) === JSON.stringify(list)) {
                        return prev;
                    }
                    return list;
                });
                if (list.length > 0) {
                    const preferredCode = currentUser?.primary_hospital_code || currentUser?.hospital_code;
                    const match = preferredCode ? list.find((h) => h.hospital_code === preferredCode) : null;
                    if (!selectedHospitalRef.current || !list.some((h) => h.hospital_code === selectedHospitalRef.current.hospital_code)) {
                        setSelectedHospital(match || list[0]);
                    }
                }
            }
            if (!silent) setLoading(false);
        } catch (e) {
            console.log("Superadmin fetch error:", e);
            if (!silent) setLoading(false);
        }
    }, [getAuthHeaders, currentUser]);

    // 2. Fetch Selected Hospital Deep-Dive Data
    const fetchHospitalDeepDive = useCallback(async (hCode, silent = false) => {
        if (!hCode) return;
        try {
            const headers = getAuthHeaders();
            const [detailRes, empRes, desksRes, deptsRes, analyticsRes, snapshotRes, visitsRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/superadmin/hospitals/${hCode}`, { headers }).then((r) => r.json()).catch(() => null),
                fetch(`${API_BASE}/api/v1/superadmin/hospitals/${hCode}/employees`, { headers }).then((r) => r.json()).catch(() => null),
                fetch(`${API_BASE}/api/v1/superadmin/hospitals/${hCode}/desks`, { headers }).then((r) => r.json()).catch(() => null),
                fetch(`${API_BASE}/api/v1/superadmin/hospitals/${hCode}/departments`, { headers }).then((r) => r.json()).catch(() => null),
                fetch(`${API_BASE}/api/v1/plugin/analytics/${hCode}`).then((r) => r.json()).catch(() => null),
                fetch(`${API_BASE}/api/v1/plugin/queue/snapshot/${hCode}`).then((r) => r.json()).catch(() => null),
                fetch(`${API_BASE}/api/v1/superadmin/hospitals/${hCode}/visits?limit=500`, { headers }).then((r) => r.json()).catch(() => null),
            ]);

            if (detailRes && detailRes.status === "success") {
                const hospObj = { ...detailRes.hospital };
                const bJson = typeof hospObj.branding_json === "string"
                    ? (() => { try { return JSON.parse(hospObj.branding_json); } catch (e) { return {}; } })()
                    : (hospObj.branding_json || {});
                if (!hospObj.logo_url && bJson?.logo_url) {
                    hospObj.logo_url = bJson.logo_url;
                }
                setSelectedHospital((prev) => {
                    if (prev && prev.hospital_code === hospObj.hospital_code) {
                        if (JSON.stringify(prev) === JSON.stringify(hospObj)) return prev;
                        return { ...prev, ...hospObj };
                    }
                    return hospObj;
                });
            }
            if (empRes && empRes.status === "success") {
                setHospitalEmployees((prev) => (JSON.stringify(prev) === JSON.stringify(empRes.employees) ? prev : empRes.employees));
            }
            const depts = (deptsRes && deptsRes.status === "success") ? deptsRes.departments : [];
            if (deptsRes && deptsRes.status === "success") {
                setHospitalDepts((prev) => (JSON.stringify(prev) === JSON.stringify(depts) ? prev : depts));
            }
            if (desksRes && desksRes.status === "success") {
                const normDesks = normalizeDesksData(desksRes.desks, depts);
                setHospitalDesksData((prev) => (JSON.stringify(prev) === JSON.stringify(normDesks) ? prev : normDesks));
            }
            if (analyticsRes) {
                setHospitalAnalytics((prev) => (JSON.stringify(prev) === JSON.stringify(analyticsRes) ? prev : analyticsRes));
            }
            if (snapshotRes) {
                const nextSnap = Array.isArray(snapshotRes.snapshot) ? snapshotRes.snapshot : [];
                const nextServing = Array.isArray(snapshotRes.serving) ? snapshotRes.serving : [];
                setHospitalQueueSnapshot((prev) => (JSON.stringify(prev) === JSON.stringify(nextSnap) ? prev : nextSnap));
                setHospitalServingTickets((prev) => (JSON.stringify(prev) === JSON.stringify(nextServing) ? prev : nextServing));
            }
            if (visitsRes && visitsRes.status === "success") {
                const nextVisits = {
                    summary: visitsRes.summary || {},
                    visits: Array.isArray(visitsRes.visits) ? visitsRes.visits : [],
                };
                setHospitalVisitsData((prev) => (JSON.stringify(prev) === JSON.stringify(nextVisits) ? prev : nextVisits));
            }
            if (!silent) setLastSyncedAt(new Date());
        } catch (e) {
            console.log("Deep dive fetch error:", e);
        }
    }, [getAuthHeaders, normalizeDesksData]);

    // Real-Time Socket.IO Live Telemetry Integration
    useEffect(() => {
        const hCode = selectedHospital?.hospital_code;
        if (!hCode) return;

        let socket;
        try {
            socket = io(API_BASE, {
                transports: ["websocket", "polling"],
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
            });

            socket.on("connect", () => {
                setSocketConnected(true);
                socket.emit("join_room", { tenant_id: hCode });
            });
            socket.on("disconnect", () => setSocketConnected(false));
            socket.on("connect_error", () => setSocketConnected(false));

            const handleLiveStreamData = (data) => {
                if (!data) return;
                setLastSyncedAt(new Date());
                if (data.snapshot && Array.isArray(data.snapshot)) {
                    setHospitalQueueSnapshot(data.snapshot);
                }
                if (data.serving && Array.isArray(data.serving)) {
                    setHospitalServingTickets(data.serving);
                }
                if (data.analytics) {
                    setHospitalAnalytics(data.analytics);
                }
            };

            socket.on("queue_update", handleLiveStreamData);
            socket.on("queue_updated", handleLiveStreamData);
            socket.on("analytics_update", (analytics) => {
                if (analytics) {
                    setLastSyncedAt(new Date());
                    setHospitalAnalytics(analytics);
                }
            });
            socket.on("hospital_data_changed", () => {
                setLastSyncedAt(new Date());
                fetchHospitalDeepDive(hCode, true);
                fetchGlobalData(true);
            });
            const handleDutyStatusChange = (data) => {
                if (!data) return;
                setLastSyncedAt(new Date());
                const staffId = data.doctor_id || data.staff_id || data.user_id || data.employee_id;
                const staffCode = String(data.employee_code || data.employee_id || "").trim().toLowerCase();
                const staffEmail = String(data.doctor_email || data.staff_email || data.email || "").trim().toLowerCase();
                const staffName = String(data.doctor_name || data.staff_name || data.name || "").trim().toLowerCase();
                const newDuty = (data.duty?.status || data.status || "ACTIVE").toUpperCase();
                const isOff = newDuty === "OFF_DUTY" || newDuty === "SHIFT_ENDED";
                const newStatus = isOff ? "off_duty" : (newDuty === "ACTIVE" ? "active" : newDuty.toLowerCase());

                setHospitalEmployees((prev) =>
                    prev.map((emp) => {
                        const empName = String(emp.name || "").trim().toLowerCase();
                        const empUsername = String(emp.username || "").trim().toLowerCase();
                        const empCode = String(emp.employee_id || emp.employee_code || "").trim().toLowerCase();
                        const empEmail = String(emp.email || "").trim().toLowerCase();

                        const matches =
                            (staffId && (
                                String(emp.id) === String(staffId) ||
                                String(emp.user_id) === String(staffId) ||
                                String(emp.employee_id_num) === String(staffId)
                            )) ||
                            (staffCode && empCode === staffCode) ||
                            (staffEmail && empEmail && empEmail === staffEmail) ||
                            (staffName && (empName === staffName || empUsername === staffName));

                        if (matches) {
                            return {
                                ...emp,
                                status: newStatus,
                                duty_status: newDuty,
                            };
                        }
                        return emp;
                    })
                );
                fetchHospitalDeepDive(hCode, true);
                fetchGlobalData(true);
            };

            socket.on("doctor_duty_status_changed", handleDutyStatusChange);
            socket.on("staff_duty_status_changed", handleDutyStatusChange);
            socket.on("hospital_data_changed", (msg) => {
                if (msg?.type === "duty_status_update" || !msg?.type) {
                    fetchHospitalDeepDive(hCode, true);
                }
            });
            socket.on("ticket_served", () => fetchHospitalDeepDive(hCode, true));
            socket.on("ticket_transferred", () => fetchHospitalDeepDive(hCode, true));
            socket.on("ticket_completed", () => fetchHospitalDeepDive(hCode, true));
            socket.on("ticket_cancelled", () => fetchHospitalDeepDive(hCode, true));
            socket.on("desk_update", () => fetchHospitalDeepDive(hCode, true));
        } catch (err) {
            console.log("SuperAdmin Socket live stream error:", err);
        }

        return () => {
            if (socket) {
                setSocketConnected(false);
                socket.disconnect();
            }
        };
    }, [selectedHospital?.hospital_code, fetchHospitalDeepDive, fetchGlobalData]);

    // Live Telemetry Sync (WebSocket handles real-time events; relaxed 20s background heartbeat fallback)
    useEffect(() => {
        fetchGlobalData();
        const pollInterval = setInterval(() => {
            // Never poll during branding customization to ensure inputs remain 100% stable
            if (activeTab === "branding") return;
            fetchGlobalData(true);
            if (selectedHospitalRef.current?.hospital_code) {
                fetchHospitalDeepDive(selectedHospitalRef.current.hospital_code, true);
            }
        }, 20000);

        return () => {
            clearInterval(pollInterval);
        };
    }, [fetchGlobalData, fetchHospitalDeepDive, activeTab]);

    useEffect(() => {
        if (selectedHospital && selectedHospital.hospital_code) {
            fetchHospitalDeepDive(selectedHospital.hospital_code);
        }
    }, [selectedHospital?.hospital_code, fetchHospitalDeepDive]);

    // 3. Create Hospital Handler
    const handleCreateHospitalSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(newHospitalForm),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowAddHospitalModal(false);
                setNewHospitalForm({
                    hospital_code: "",
                    name: "",
                    address: "",
                    phone: "",
                    email: "",
                    description: "",
                    status: "active",
                });
                notify(isHi ? `अस्पताल '${data.hospital.name}' सफलतापूर्वक पंजीकृत!` : `Hospital '${data.hospital.name}' registered successfully!`);
                fetchGlobalData();
                setSelectedHospital(data.hospital);
            } else {
                notify(data.message || data.detail || "Failed to create hospital.", "error");
            }
        } catch (err) {
            notify(`Error creating hospital: ${err.message}`, "error");
        }
    };

    // 4. Update Hospital Handler
    const handleUpdateHospitalSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${editHospitalForm.hospital_code}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(editHospitalForm),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowEditHospitalModal(false);
                notify(isHi ? `अस्पताल जानकारी अद्यतन की गई!` : `Hospital details updated successfully!`);

                window.dispatchEvent(new CustomEvent("hospital_branding_updated", {
                    detail: {
                        hospital_code: editHospitalForm.hospital_code,
                        branding: {
                            hospital_name: editHospitalForm.name,
                            address: editHospitalForm.address,
                            phone: editHospitalForm.phone,
                            email: editHospitalForm.email,
                        },
                    },
                }));

                fetchGlobalData();
                fetchHospitalDeepDive(editHospitalForm.hospital_code);
            } else {
                notify(data.detail || "Failed to update hospital.", "error");
            }
        } catch (err) {
            notify(`Error updating hospital: ${err.message}`, "error");
        }
    };

    // Delete Hospital Handler
    const handleDeleteHospital = (hosp) => {
        const confirmMsg = isHi
            ? `क्या आप वाकई अस्पताल '${hosp.name}' (${hosp.hospital_code}) को हटाना चाहते हैं? इसके सभी संबंधित कर्मचारी, विभाग और डेस्क भी हटा दिए जाएंगे।`
            : `Are you sure you want to delete hospital '${hosp.name}' (${hosp.hospital_code}) and all its associated staff, departments, and desks?`;

        showConfirm({
            title: isHi ? "अस्पताल हटाएं" : "Delete Hospital",
            message: confirmMsg,
            confirmText: isHi ? "हाँ, हटाएं" : "Delete Hospital",
            cancelText: isHi ? "रद्द करें" : "Cancel",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${hosp.hospital_code}`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                    });
                    const data = await res.json();
                    if (res.ok && data.status === "success") {
                        notify(isHi ? `अस्पताल '${hosp.name}' सफलतापूर्वक हटा दिया गया!` : `Hospital '${hosp.name}' successfully deleted!`);
                        fetchGlobalData();
                        if (selectedHospital?.hospital_code === hosp.hospital_code) {
                            setSelectedHospital(null);
                        }
                    } else {
                        notify(data.detail || data.message || "Failed to delete hospital.", "error");
                    }
                } catch (err) {
                    notify(`Error deleting hospital: ${err.message}`, "error");
                }
            },
        });
    };

    // 4.5. Hospital Customization & Branding Handlers
    const loadHospitalBrandingData = useCallback(async (hosp) => {
        if (!hosp) return;
        setBrandingTargetHospital(hosp);
        brandingLoadedHospCodeRef.current = hosp.hospital_code;
        const defaultData = {
            name: hosp.name || "",
            hospital_code: hosp.hospital_code || "",
            status: hosp.status || "active",
            description: hosp.description || "",
            phone: hosp.phone || "",
            email: hosp.email || "",
            address: hosp.address || "",
            logo_url: hosp.logo_url || "",
            primary_color: "#0284C7",
            secondary_color: "#0369A1",
            accent_color: "#F0F9FF",
            tagline: "Care you can trust • NABH Accredited",
            emergency_helpline: "Emergency Helpline: 108 / +91 98765 43210",
            slip_footer_text: "Non-transferable official patient record. Please keep until consultation is complete.",
            about_us_title: `About ${hosp.name || "City General Hospital"}`,
            about_us_subtitle: "Care you can trust • NABH Accredited",
            about_us: hosp.description || "City General Hospital is a premier medical institution dedicated to patient-first care. Our AI-driven intelligent queue orchestration minimizes waiting times and prioritizes critical medical needs dynamically.",
            about_us_hi: "सिटी जनरल अस्पताल मरीज़-प्रथम सेवा हेतु समर्पित एक अग्रणी चिकित्सा संस्थान है। हमारा एआई-संचालित बुद्धिमान कतार प्रबंधन प्रतीक्षा समय को कम करता है और गंभीर मामलों को प्राथमिकता देता है।",
            about_service_1: "24/7 Emergency Triage • Priority ambulance & ICU care",
            about_service_2: "AI Wait Prediction • Live queue synchronization",
            about_service_3: "Multi-Specialty OPD • General, Cardiac, Neuro, Ortho",
            about_service_4: "Digital E-Prescriptions • Seamless pharmacy refills",
            opd_start_time: "08:00",
            opd_end_time: "20:00",
            registration_cutoff_time: "19:00",
            operating_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            available_time_slots: [
                "09:00 AM", "09:45 AM", "10:30 AM", "11:15 AM", "12:00 PM",
                "02:00 PM", "02:45 PM", "03:30 PM", "04:15 PM", "05:00 PM"
            ],
            closed_notice: "Registrations are closed for today. Please visit during OPD hours or book an appointment for tomorrow.",
            opd_helpdesk_phone: hosp.phone || "+1 (800) 456-7890 (Ext: 101)",
            opd_helpdesk_hours: "Mon – Sat: 8:00 AM – 8:00 PM",
            opd_helpdesk_hours_hi: "सोम – शनि: सुबह 8:00 – रात 8:00",
            support_email: hosp.email || "support@citygeneralhospital.org",
        };
        setBrandingForm(defaultData);

        try {
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${hosp.hospital_code}/branding`, {
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (res.ok && data.branding) {
                setBrandingForm({
                    name: data.branding.hospital_name || data.branding.name || hosp.name || "",
                    hospital_code: hosp.hospital_code || "",
                    status: hosp.status || "active",
                    description: data.branding.about_us || hosp.description || "",
                    phone: data.branding.opd_helpdesk_phone || hosp.phone || "",
                    email: data.branding.support_email || data.branding.email || hosp.email || "",
                    address: data.branding.address || hosp.address || "",
                    logo_url: data.branding.logo_url || hosp.logo_url || "",
                    primary_color: data.branding.primary_color || "#0284C7",
                    secondary_color: data.branding.secondary_color || "#0369A1",
                    accent_color: data.branding.accent_color || "#F0F9FF",
                    tagline: data.branding.tagline || "Care you can trust • NABH Accredited",
                    emergency_helpline: data.branding.emergency_helpline || "Emergency Helpline: 108 / +91 98765 43210",
                    slip_footer_text: data.branding.slip_footer_text || "Non-transferable official patient record. Please keep until consultation is complete.",
                    about_us_title: data.branding.about_us_title || `About ${hosp.name || "City General Hospital"}`,
                    about_us_subtitle: data.branding.about_us_subtitle || data.branding.tagline || "Care you can trust • NABH Accredited",
                    about_us: data.branding.about_us || hosp.description || "",
                    about_us_hi: data.branding.about_us_hi || "",
                    about_service_1: data.branding.about_service_1 || "",
                    about_service_2: data.branding.about_service_2 || "",
                    about_service_3: data.branding.about_service_3 || "",
                    about_service_4: data.branding.about_service_4 || "",
                    about_stat_1_val: data.branding.about_stat_1_val || "15,000+",
                    about_stat_1_lbl: data.branding.about_stat_1_lbl || "Monthly Patients",
                    about_stat_2_val: data.branding.about_stat_2_val || "98%",
                    about_stat_2_lbl: data.branding.about_stat_2_lbl || "Satisfaction Rate",
                    about_stat_3_val: data.branding.about_stat_3_val || "< 8 min",
                    about_stat_3_lbl: data.branding.about_stat_3_lbl || "Avg. Wait Time",
                    about_stat_4_val: data.branding.about_stat_4_val || "24 / 7",
                    about_stat_4_lbl: data.branding.about_stat_4_lbl || "Always Available",
                    about_badge_1: data.branding.about_badge_1 || "NABH Accredited",
                    about_badge_1_sub: data.branding.about_badge_1_sub || "National Standards",
                    about_badge_2: data.branding.about_badge_2 || "ISO 27001 Certified",
                    about_badge_2_sub: data.branding.about_badge_2_sub || "Data Security",
                    about_badge_3: data.branding.about_badge_3 || "Ayushman Bharat",
                    about_badge_3_sub: data.branding.about_badge_3_sub || "Govt. Empanelled",
                    about_tech_highlights: data.branding.about_tech_highlights || "AI Queue Orchestration, Real-Time Socket Sync, Digital Prescriptions, QR Check-In, Priority Escalation, Multi-Language, Family Profiles, Live Analytics",
                    about_why_choose: data.branding.about_why_choose || "No physical queue — get your token digitally from anywhere\nAI auto-escalates critical/emergency cases instantly\nBook for all family members from a single account\nLive queue status on mobile + real-time alerts\nDigital e-prescriptions — zero paperwork needed",
                    opd_start_time: data.branding.opd_start_time || "08:00",
                    opd_end_time: data.branding.opd_end_time || "20:00",
                    registration_cutoff_time: data.branding.registration_cutoff_time || "19:00",
                    operating_days: Array.isArray(data.branding.operating_days) ? data.branding.operating_days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                    available_time_slots: Array.isArray(data.branding.available_time_slots) && data.branding.available_time_slots.length > 0
                        ? data.branding.available_time_slots
                        : (Array.isArray(data.branding.time_slots) && data.branding.time_slots.length > 0
                            ? data.branding.time_slots
                            : [
                                "09:00 AM", "09:45 AM", "10:30 AM", "11:15 AM", "12:00 PM",
                                "02:00 PM", "02:45 PM", "03:30 PM", "04:15 PM", "05:00 PM"
                              ]),
                    closed_notice: data.branding.closed_notice || "",
                    opd_helpdesk_phone: data.branding.opd_helpdesk_phone || hosp.phone || "",
                    opd_helpdesk_hours: data.branding.opd_helpdesk_hours || "Mon – Sat: 8:00 AM – 8:00 PM",
                    opd_helpdesk_hours_hi: data.branding.opd_helpdesk_hours_hi || "सोम – शनि: सुबह 8:00 – रात 8:00",
                    support_email: data.branding.support_email || data.branding.email || hosp.email || "",
                });
            }
        } catch (e) {
            console.log("Error loading branding:", e);
        }
    }, [getAuthHeaders]);

    const handleResetBrandingDefaults = () => {
        const targetHosp = brandingTargetHospital || selectedHospital;
        if (!targetHosp) return;
        setBrandingForm({
            name: targetHosp.name || "",
            hospital_code: targetHosp.hospital_code || "",
            status: targetHosp.status || "active",
            description: targetHosp.description || "",
            phone: targetHosp.phone || "",
            email: targetHosp.email || "",
            address: targetHosp.address || "",
            logo_url: "",
            primary_color: "#0284C7",
            secondary_color: "#0369A1",
            accent_color: "#F0F9FF",
            tagline: "Care you can trust • NABH Accredited",
            emergency_helpline: "Emergency Helpline: 108 / +91 98765 43210",
            slip_footer_text: "Non-transferable official patient record. Please keep until consultation is complete.",
            about_us_title: `About ${targetHosp.name || "City General Hospital"}`,
            about_us_subtitle: "Care you can trust • NABH Accredited",
            about_us: "City General Hospital is a premier medical institution dedicated to patient-first care. Our AI-driven intelligent queue orchestration minimizes waiting times and prioritizes critical medical needs dynamically.",
            about_us_hi: "सिटी जनरल अस्पताल मरीज़-प्रथम सेवा हेतु समर्पित एक अग्रणी चिकित्सा संस्थान है। हमारा एआई-संचालित बुद्धिमान कतार प्रबंधन प्रतीक्षा समय को कम करता है और गंभीर मामलों को प्राथमिकता देता है।",
            about_service_1: "24/7 Emergency Triage • Priority ambulance & ICU care",
            about_service_2: "AI Wait Prediction • Live queue synchronization",
            about_service_3: "Multi-Specialty OPD • General, Cardiac, Neuro, Ortho",
            about_service_4: "Digital E-Prescriptions • Seamless pharmacy refills",
            about_stat_1_val: "15,000+",
            about_stat_1_lbl: "Monthly Patients",
            about_stat_2_val: "98%",
            about_stat_2_lbl: "Satisfaction Rate",
            about_stat_3_val: "< 8 min",
            about_stat_3_lbl: "Avg. Wait Time",
            about_stat_4_val: "24 / 7",
            about_stat_4_lbl: "Always Available",
            about_badge_1: "NABH Accredited",
            about_badge_1_sub: "National Standards",
            about_badge_2: "ISO 27001 Certified",
            about_badge_2_sub: "Data Security",
            about_badge_3: "Ayushman Bharat",
            about_badge_3_sub: "Govt. Empanelled",
            about_tech_highlights: "AI Queue Orchestration, Real-Time Socket Sync, Digital Prescriptions, QR Check-In, Priority Escalation, Multi-Language, Family Profiles, Live Analytics",
            about_why_choose: "No physical queue — get your token digitally from anywhere\nAI auto-escalates critical/emergency cases instantly\nBook for all family members from a single account\nLive queue status on mobile + real-time alerts\nDigital e-prescriptions — zero paperwork needed",
            opd_start_time: "08:00",
            opd_end_time: "20:00",
            registration_cutoff_time: "19:00",
            operating_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            available_time_slots: [
                "09:00 AM", "09:45 AM", "10:30 AM", "11:15 AM", "12:00 PM",
                "02:00 PM", "02:45 PM", "03:30 PM", "04:15 PM", "05:00 PM"
            ],
            closed_notice: "Registrations are closed for today. Please visit during OPD hours or book an appointment for tomorrow.",
            opd_helpdesk_phone: targetHosp.phone || "+1 (800) 456-7890 (Ext: 101)",
            opd_helpdesk_hours: "Mon – Sat: 8:00 AM – 8:00 PM",
            opd_helpdesk_hours_hi: "सोम – शनि: सुबह 8:00 – रात 8:00",
            support_email: targetHosp.email || "support@citygeneralhospital.org",
        });
        notify(isHi ? "डिफ़ॉल्ट सेटिंग्स लोड की गईं" : "Reset to standard medical defaults");
    };

    const handleSaveBrandingSubmit = async (e, forcedTargetHosp) => {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        const targetHosp = forcedTargetHosp || brandingTargetHospital || selectedHospital || hospitals[0];
        if (!targetHosp) {
            notify(isHi ? "कृपया पहले एक अस्पताल चुनें।" : "Please select a hospital first.", "warn");
            return;
        }
        setIsSavingBranding(true);
        try {
            let formToSave = { ...brandingForm };
            // Automatic Google Translate with fast timeout so saving never hangs
            const translateFieldToHindi = async (text) => {
                if (!text || typeof text !== "string" || !/[a-zA-Z]/.test(text)) return text;
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1600);
                    const tRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(text)}`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    if (tRes.ok) {
                        const tData = await tRes.json();
                        if (tData && tData[0]) {
                            return tData[0].map((item) => item[0]).join("");
                        }
                    }
                } catch (tErr) {
                    // Safe fallback to original text if translation service fails or times out
                }
                return text;
            };

            const fieldsToTranslate = [
                { src: "name", dest: "name_hi" },
                { src: "tagline", dest: "tagline_hi" },
                { src: "address", dest: "address_hi" },
                { src: "about_us", dest: "about_us_hi" },
                { src: "closed_notice", dest: "closed_notice_hi" },
                { src: "about_service_1", dest: "about_service_1_hi" },
                { src: "about_service_2", dest: "about_service_2_hi" },
                { src: "about_service_3", dest: "about_service_3_hi" },
                { src: "about_service_4", dest: "about_service_4_hi" },
                { src: "about_stat_1_lbl", dest: "about_stat_1_lbl_hi" },
                { src: "about_stat_2_lbl", dest: "about_stat_2_lbl_hi" },
                { src: "about_stat_3_lbl", dest: "about_stat_3_lbl_hi" },
                { src: "about_stat_4_lbl", dest: "about_stat_4_lbl_hi" },
                { src: "about_badge_1", dest: "about_badge_1_hi" },
                { src: "about_badge_1_sub", dest: "about_badge_1_sub_hi" },
                { src: "about_badge_2", dest: "about_badge_2_hi" },
                { src: "about_badge_2_sub", dest: "about_badge_2_sub_hi" },
                { src: "about_badge_3", dest: "about_badge_3_hi" },
                { src: "about_badge_3_sub", dest: "about_badge_3_sub_hi" },
                { src: "about_why_choose", dest: "about_why_choose_hi" },
            ];

            await Promise.allSettled(
                fieldsToTranslate.map(async ({ src, dest }) => {
                    const text = formToSave[src];
                    if (text && /[a-zA-Z]/.test(text)) {
                        const hi = await translateFieldToHindi(text);
                        if (hi) {
                            formToSave[dest] = hi;
                        }
                    }
                })
            );
            if (formToSave.name_hi) formToSave.hospital_name_hi = formToSave.name_hi;

            // Auto-compute Help Desk Hours directly from Operating Days, Start Time, and End Time
            formToSave.opd_helpdesk_hours = generateOperatingHoursText(
                formToSave.operating_days,
                formToSave.opd_start_time,
                formToSave.opd_end_time,
                false
            );
            formToSave.opd_helpdesk_hours_hi = generateOperatingHoursText(
                formToSave.operating_days,
                formToSave.opd_start_time,
                formToSave.opd_end_time,
                true
            );

            if (Array.isArray(formToSave.available_time_slots)) {
                formToSave.available_time_slots = formToSave.available_time_slots
                    .map((s) => String(s || "").trim())
                    .filter(Boolean);
            }

            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${targetHosp.hospital_code}/branding`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(formToSave),
            });
            const data = await res.json();

            await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${targetHosp.hospital_code}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    hospital_code: targetHosp.hospital_code,
                    name: brandingForm.name || targetHosp.name,
                    address: brandingForm.address || targetHosp.address,
                    phone: brandingForm.phone || brandingForm.opd_helpdesk_phone || targetHosp.phone,
                    email: brandingForm.email || brandingForm.support_email || targetHosp.email,
                    description: brandingForm.description || brandingForm.about_us || targetHosp.description,
                    status: brandingForm.status || targetHosp.status || "active",
                }),
            }).catch(() => null);

            if (res.ok && data.status === "success") {
                const hospDisplayName = brandingForm.name || targetHosp.name;
                notify(isHi ? `'${hospDisplayName}' की कस्टमाइज़ेशन व ब्रांडिंग सेटिंग्स सहेजी गईं!` : `Customization & branding updated for '${hospDisplayName}'!`);

                window.dispatchEvent(new CustomEvent("hospital_branding_updated", {
                    detail: {
                        hospital_code: targetHosp.hospital_code,
                        branding: data.branding,
                    },
                }));

                if (typeof onUpdateHospitalBranding === "function") {
                    const activeHospCode = localStorage.getItem("ai_queue_current_hospital") || "city-hospital-01";
                    if (String(activeHospCode).trim() === String(targetHosp.hospital_code).trim()) {
                        onUpdateHospitalBranding(data.branding);
                    }
                }

                fetchGlobalData(true);
                if (selectedHospital?.hospital_code === targetHosp.hospital_code) {
                    fetchHospitalDeepDive(selectedHospital.hospital_code);
                }
            } else {
                notify(data.detail || data.message || "Failed to save branding settings.", "error");
            }
        } catch (err) {
            notify(`Error saving branding: ${err.message}`, "error");
        } finally {
            setIsSavingBranding(false);
        }
    };

    useEffect(() => {
        if (activeTab === "branding") {
            const target = brandingTargetHospital || selectedHospital || hospitals[0];
            if (target && target.hospital_code) {
                if (brandingLoadedHospCodeRef.current !== target.hospital_code) {
                    brandingLoadedHospCodeRef.current = target.hospital_code;
                    setBrandingTargetHospital(target);
                    loadHospitalBrandingData(target);
                }
            }
        } else {
            brandingLoadedHospCodeRef.current = null;
        }
    }, [activeTab, brandingTargetHospital?.hospital_code, selectedHospital?.hospital_code, hospitals, loadHospitalBrandingData]);

    // Relocated Header Actions & Hospital Switch Listeners
    useEffect(() => {
        const handleAddStaff = () => {
            setCreatedCredentials(null);
            setShowAddEmployeeModal(true);
        };
        const handleAddDesk = () => {
            setNewDeskForm({
                dept_code: hospitalDepts[0]?.dept_code || "consultation",
                desk_name: "",
                status: "AVAILABLE",
                assigned_employee_id: "",
            });
            setShowAddDeskModal(true);
        };
        const handleSwitchTab = (e) => {
            const tab = e?.detail;
            if (tab) {
                setActiveTab(tab);
                if (tab === "branding") {
                    setActiveBrandingTab("profile");
                    const target = selectedHospital || hospitals[0];
                    if (target) loadHospitalBrandingData(target);
                }
            }
        };
        const handleHospitalChanged = (e) => {
            const code = e?.detail;
            if (code && hospitals.length > 0) {
                const found = hospitals.find((h) => h.hospital_code === code);
                if (found) {
                    setSelectedHospital(found);
                    if (onSelectHospitalTenant) onSelectHospitalTenant(found.hospital_code);
                    fetchHospitalDeepDive(found.hospital_code);
                }
            }
        };

        window.addEventListener("superadmin_action_add_staff", handleAddStaff);
        window.addEventListener("superadmin_action_add_desk", handleAddDesk);
        window.addEventListener("superadmin_switch_tab", handleSwitchTab);
        window.addEventListener("hospital_changed", handleHospitalChanged);

        return () => {
            window.removeEventListener("superadmin_action_add_staff", handleAddStaff);
            window.removeEventListener("superadmin_action_add_desk", handleAddDesk);
            window.removeEventListener("superadmin_switch_tab", handleSwitchTab);
            window.removeEventListener("hospital_changed", handleHospitalChanged);
        };
    }, [hospitalDepts, hospitals, selectedHospital, onSelectHospitalTenant, fetchHospitalDeepDive, loadHospitalBrandingData]);

    // 5. Add Employee Handler (Doctor, Staff, Admin)
    const handleAddEmployeeSubmit = async (e) => {
        e.preventDefault();
        if (!selectedHospital) return;
        try {
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/employees`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(newEmployeeForm),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowAddEmployeeModal(false);
                setCreatedCredentials({
                    name: data.employee.username,
                    email: data.employee.email,
                    employee_id: data.employee.employee_id || newEmployeeForm.employee_id,
                    password: newEmployeeForm.password,
                    role: data.employee.role,
                    department: data.employee.department,
                    hospital_name: selectedHospital.name,
                    specialization: data.employee.specialization || newEmployeeForm.specialization,
                    room_number: data.employee.room_number || newEmployeeForm.room_number,
                });
                setNewEmployeeForm({
                    name: "",
                    email: "",
                    role: "doctor",
                    department: "consultation",
                    employee_id: "",
                    phone: "",
                    password: "pass" + Math.floor(1000 + Math.random() * 9000),
                    qualification: "",
                    specialization: "",
                    license_number: "",
                    gender: "other",
                    experience_years: 0,
                    room_number: "",
                });
                notify(isHi ? `कर्मचारी '${data.employee.username}' सफलतापूर्वक जोड़ा गया!` : `Employee '${data.employee.username}' provisioned successfully!`);
                fetchHospitalDeepDive(selectedHospital.hospital_code);
                fetchGlobalData(true);
            } else {
                notify(data.detail || "Failed to add employee.", "error");
            }
        } catch (err) {
            notify(`Error: ${err.message}`, "error");
        }
    };

    // 6. Update Employee Handler
    const handleUpdateEmployeeSubmit = async (e) => {
        e.preventDefault();
        if (!selectedHospital || !editEmployeeForm.id) return;
        try {
            const payload = { ...editEmployeeForm };
            if (!payload.password || !payload.password.trim()) {
                delete payload.password;
            }
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/employees/${editEmployeeForm.id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowEditEmployeeModal(false);
                setEditEmployeeForm({ ...editEmployeeForm, password: "" });
                notify(isHi ? `कर्मचारी रिकॉर्ड एवं पासवर्ड अपडेट हुआ!` : `Employee record and credentials updated!`);
                fetchHospitalDeepDive(selectedHospital.hospital_code);
                fetchGlobalData();
            } else {
                notify(data.detail || "Failed to update employee.", "error");
            }
        } catch (err) {
            notify(`Error: ${err.message}`, "error");
        }
    };

    // 7. Delete Employee Handler
    const handleDeleteEmployee = (emp) => {
        if (!selectedHospital) return;
        const empName = emp.name || emp.username || emp.email;
        const confirmMsg = isHi
            ? `क्या आप वाकई कर्मचारी/डॉक्टर '${empName}' को हटाना चाहते हैं?`
            : `Are you sure you want to remove employee/doctor '${empName}'?`;

        showConfirm({
            title: isHi ? "कर्मचारी हटाएं" : "Remove Employee",
            message: confirmMsg,
            confirmText: isHi ? "हाँ, हटाएं" : "Remove",
            cancelText: isHi ? "रद्द करें" : "Cancel",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const empId = emp.id || emp.employee_id_num;
                    const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/employees/${empId}`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                    });
                    const data = await res.json();
                    if (res.ok && data.status === "success") {
                        notify(isHi ? `कर्मचारी '${empName}' हटा दिया गया!` : `Employee '${empName}' removed!`);
                        fetchHospitalDeepDive(selectedHospital.hospital_code);
                        fetchGlobalData();
                    } else {
                        notify(data.detail || "Failed to delete employee.", "error");
                    }
                } catch (err) {
                    notify(`Error deleting employee: ${err.message}`, "error");
                }
            },
        });
    };

    // 8. Add Department Handler
    const handleAddDeptSubmit = async (e) => {
        e.preventDefault();
        if (!selectedHospital) return;
        try {
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/departments`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(newDeptForm),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowAddDeptModal(false);
                setNewDeptForm({ dept_code: "", name: "", description: "" });
                notify(isHi ? `विभाग '${data.department.name}' जोड़ा गया!` : `Department '${data.department.name}' added!`);
                fetchHospitalDeepDive(selectedHospital.hospital_code);
                window.dispatchEvent(new CustomEvent("hospital_departments_updated", { detail: { hospital_code: selectedHospital.hospital_code } }));
            } else {
                notify(data.detail || "Failed to add department.", "error");
            }
        } catch (err) {
            notify(`Error: ${err.message}`, "error");
        }
    };

    // 9. Delete Department Handler
    const handleDeleteDepartment = (dept) => {
        if (!selectedHospital) return;
        const confirmMsg = isHi
            ? `क्या आप वाकई विभाग '${dept.name}' और इसके सभी डेस्क हटाना चाहते हैं?`
            : `Are you sure you want to remove department '${dept.name}' and all its desks?`;

        showConfirm({
            title: isHi ? "विभाग हटाएं" : "Remove Department",
            message: confirmMsg,
            confirmText: isHi ? "हाँ, हटाएं" : "Remove",
            cancelText: isHi ? "रद्द करें" : "Cancel",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/departments/${dept.dept_code}`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                    });
                    const data = await res.json();
                    if (res.ok && data.status === "success") {
                        notify(isHi ? `विभाग '${dept.name}' हटा दिया गया!` : `Department '${dept.name}' removed!`);
                        fetchHospitalDeepDive(selectedHospital.hospital_code);
                        fetchGlobalData();
                        window.dispatchEvent(new CustomEvent("hospital_departments_updated", { detail: { hospital_code: selectedHospital.hospital_code } }));
                    } else {
                        notify(data.detail || "Failed to delete department.", "error");
                    }
                } catch (err) {
                    notify(`Error deleting department: ${err.message}`, "error");
                }
            },
        });
    };

    // 10. Add Desk Handler
    const handleAddDeskSubmit = async (e) => {
        e.preventDefault();
        if (!selectedHospital) return;
        if (!newDeskForm.dept_code) {
            notify(isHi ? "कृपया पहले एक विभाग चुनें।" : "Please select a department for this desk.", "warn");
            return;
        }
        try {
            const payload = {
                dept_code: newDeskForm.dept_code,
                desk_name: newDeskForm.desk_name,
                status: newDeskForm.status || "AVAILABLE",
                assigned_employee_id: newDeskForm.assigned_employee_id ? Number(newDeskForm.assigned_employee_id) : null,
            };
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/desks`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowAddDeskModal(false);
                setNewDeskForm({
                    dept_code: hospitalDepts[0]?.dept_code || "consultation",
                    desk_name: "",
                    status: "AVAILABLE",
                    assigned_employee_id: "",
                });
                notify(isHi ? `🪑 नया डेस्क '${data.desk.desk_name}' जोड़ा गया!` : `🪑 New desk '${data.desk.desk_name}' added!`);
                fetchHospitalDeepDive(selectedHospital.hospital_code);
                fetchGlobalData();
            } else {
                notify(data.detail || "Failed to add desk.", "error");
            }
        } catch (err) {
            notify(`Error adding desk: ${err.message}`, "error");
        }
    };

    // 11. Delete Desk Handler
    const handleDeleteDesk = (desk) => {
        if (!selectedHospital) return;
        const confirmMsg = isHi
            ? `क्या आप वाकई डेस्क '${desk.desk_name}' को हटाना चाहते हैं?`
            : `Are you sure you want to remove desk '${desk.desk_name}'?`;

        showConfirm({
            title: isHi ? "डेस्क हटाएं" : "Remove Desk",
            message: confirmMsg,
            confirmText: isHi ? "हाँ, हटाएं" : "Remove",
            cancelText: isHi ? "रद्द करें" : "Cancel",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/desks/${desk.id}`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                    });
                    const data = await res.json();
                    if (res.ok && data.status === "success") {
                        notify(isHi ? `डेस्क '${desk.desk_name}' हटा दिया गया!` : `Desk '${desk.desk_name}' removed!`);
                        fetchHospitalDeepDive(selectedHospital.hospital_code);
                        fetchGlobalData();
                    } else {
                        notify(data.detail || "Failed to delete desk.", "error");
                    }
                } catch (err) {
                    notify(`Error deleting desk: ${err.message}`, "error");
                }
            },
        });
    };

    // 12. Toggle Desk Status Handler
    const handleToggleDeskStatus = async (desk) => {
        if (!selectedHospital || !desk) return;
        const currentStatus = (desk.status || "").toUpperCase();
        const nextStatus = (currentStatus === "ACTIVE" || currentStatus === "AVAILABLE") ? "UNAVAILABLE" : "AVAILABLE";
        try {
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/desks/${desk.id}/status`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                notify(
                    isHi
                        ? `डेस्क '${desk.desk_name}' की स्थिति बदलकर '${nextStatus === "AVAILABLE" ? "सक्रिय (उपलब्ध)" : "अनुपलब्ध"}' की गई!`
                        : `Desk '${desk.desk_name}' status updated to ${nextStatus === "AVAILABLE" ? "Active (Available)" : "Unavailable"}!`
                );
                fetchHospitalDeepDive(selectedHospital.hospital_code);
                fetchGlobalData();
            } else {
                notify(data.detail || data.message || "Failed to update desk status.", "error");
            }
        } catch (e) {
            console.error("Desk update error:", e);
            notify(`Error updating desk: ${e.message}`, "error");
        }
    };

    // 13. Update Department Handler
    const handleUpdateDepartmentSubmit = async (e) => {
        e.preventDefault();
        if (!selectedHospital) return;
        try {
            const res = await fetch(
                `${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/departments/${editDeptForm.dept_code}`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        name: editDeptForm.name,
                        description: editDeptForm.description,
                    }),
                }
            );
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowEditDeptModal(false);
                notify(isHi ? `विभाग जानकारी अद्यतन की गई!` : `Department '${data.department.name}' updated!`);
                fetchHospitalDeepDive(selectedHospital.hospital_code);
                window.dispatchEvent(new CustomEvent("hospital_departments_updated", { detail: { hospital_code: selectedHospital.hospital_code } }));
            } else {
                notify(data.detail || "Failed to update department.", "error");
            }
        } catch (err) {
            notify(`Error updating department: ${err.message}`, "error");
        }
    };

    // 14. Update Desk Handler
    const handleUpdateDeskSubmit = async (e) => {
        e.preventDefault();
        if (!selectedHospital || !editDeskForm.id) return;
        try {
            const payload = {
                desk_name: editDeskForm.desk_name,
                dept_code: editDeskForm.dept_code,
                assigned_employee_id: editDeskForm.assigned_employee_id ? Number(editDeskForm.assigned_employee_id) : null,
            };
            const res = await fetch(
                `${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/desks/${editDeskForm.id}`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload),
                }
            );
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowEditDeskModal(false);
                notify(isHi ? `डेस्क अद्यतन किया गया!` : `Desk '${data.desk.desk_name}' updated!`);
                fetchHospitalDeepDive(selectedHospital.hospital_code);
                fetchGlobalData();
            } else {
                notify(data.message || data.detail || "Failed to update desk.", "error");
            }
        } catch (err) {
            notify(`Error updating desk: ${err.message}`, "error");
        }
    };

    // 14b. Assign Desk to Staff / Doctor Handler
    const handleAssignDesk = async (deskId, employeeId) => {
        if (!selectedHospital || !deskId) return;
        try {
            const empId = employeeId && Number(employeeId) > 0 ? Number(employeeId) : null;
            const res = await fetch(
                `${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/desks/${deskId}/assign`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ assigned_employee_id: empId }),
                }
            );
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setShowAssignDeskModal(false);
                setAssignDeskTarget({ desk: null, employee_id: "" });
                notify(
                    empId
                        ? (isHi ? `डेस्क को '${data.desk?.assigned_employee_name || "कार्मिक"}' को सौंपा गया!` : `Desk assigned to '${data.desk?.assigned_employee_name || "Staff"}'!`)
                        : (isHi ? "डेस्क को अनअसाइन (स्वचालित बे) किया गया!" : "Desk unassigned (set to Auto-Assigned Bay)!")
                );
                fetchHospitalDeepDive(selectedHospital.hospital_code);
                fetchGlobalData();
            } else {
                notify(data.message || data.detail || "Failed to update desk assignment.", "error");
            }
        } catch (err) {
            notify(`Error assigning desk: ${err.message}`, "error");
        }
    };

    // 15. Bulk Update Desk Status by Department
    const handleBulkDeskStatus = (deptCode, targetStatus) => {
        if (!selectedHospital) return;
        const confirmMsg = isHi
            ? `क्या आप वाकई विभाग '${deptCode}' के सभी डेस्क को ${targetStatus === "AVAILABLE" ? "सक्रिय" : "निष्क्रिय"} करना चाहते हैं?`
            : `Are you sure you want to set all desks in department '${deptCode}' to ${targetStatus}?`;

        showConfirm({
            title: isHi ? "डेस्क स्थिति अपडेट करें" : "Update Desks Status",
            message: confirmMsg,
            confirmText: isHi ? "हाँ, अपडेट करें" : "Update All",
            cancelText: isHi ? "रद्द करें" : "Cancel",
            isDestructive: false,
            onConfirm: async () => {
                try {
                    const res = await fetch(
                        `${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/desks/bulk-status`,
                        {
                            method: "POST",
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ dept_code: deptCode, status: targetStatus }),
                        }
                    );
                    const data = await res.json();
                    if (res.ok && data.status === "success") {
                        notify(
                            isHi
                                ? `✓ ${data.result.updated_count} डेस्क अपडेट किए गए!`
                                : `Successfully set ${data.result.updated_count} desks to ${targetStatus}!`
                        );
                        fetchHospitalDeepDive(selectedHospital.hospital_code);
                        fetchGlobalData();
                    } else {
                        notify(data.detail || "Failed to update desks in bulk.", "error");
                    }
                } catch (err) {
                    notify(`Error updating desks in bulk: ${err.message}`, "error");
                }
            },
        });
    };

    // 16. Update Employee / Doctor Password Handler
    const handleUpdatePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!selectedHospital || !passwordTargetEmployee) return;
        if (!newPasswordValue || newPasswordValue.trim().length < 4) {
            notify(isHi ? "पासवर्ड कम से कम 4 अक्षरों का होना चाहिए।" : "Password must be at least 4 characters.", "warn");
            return;
        }
        setIsUpdatingPassword(true);
        try {
            const empId = passwordTargetEmployee.user_id || passwordTargetEmployee.id || passwordTargetEmployee.employee_id_num;
            const res = await fetch(
                `${API_BASE}/api/v1/superadmin/hospitals/${selectedHospital.hospital_code}/employees/${empId}/password`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        new_password: newPasswordValue.trim(),
                        password: newPasswordValue.trim(),
                    }),
                }
            );

            const contentType = res.headers.get("content-type") || "";
            let data = {};
            if (contentType.includes("application/json")) {
                data = await res.json();
            } else {
                const text = await res.text();
                throw new Error(`Server returned HTTP ${res.status}: ${text.slice(0, 160)}`);
            }

            if (res.ok && data.status === "success") {
                setPasswordUpdateSuccess({
                    name: passwordTargetEmployee.name || passwordTargetEmployee.username,
                    email: passwordTargetEmployee.email,
                    role: passwordTargetEmployee.role,
                    password: newPasswordValue.trim(),
                    hospital_name: selectedHospital.name,
                });
                notify(
                    isHi
                        ? `'${passwordTargetEmployee.name || passwordTargetEmployee.username}' का पासवर्ड सफलतापूर्वक अपडेट किया गया!`
                        : `Password for '${passwordTargetEmployee.name || passwordTargetEmployee.username}' updated successfully!`
                );
            } else {
                notify(data.detail || data.message || "Failed to update password.", "error");
            }
        } catch (err) {
            notify(`Error updating password: ${err.message}`, "error");
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    return (
        <div className="superadmin-portal-root" style={{ width: "100%", maxWidth: "100%", margin: "0", padding: "0", boxSizing: "border-box" }}>
            <div className={`superadmin-layout-container ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
                {/* Mobile Drawer Overlay Backdrop */}
                {mobileDrawerOpen && (
                    <div
                        className="superadmin-sidebar-backdrop"
                        onClick={() => setMobileDrawerOpen(false)}
                    />
                )}

                {/* Left Side: Modern Persistent Control Center Sidebar (Reference Rail) */}
                <SuperAdminSidebar
                    mobileOpen={mobileDrawerOpen}
                    onCloseMobile={() => setMobileDrawerOpen(false)}
                    activeTab={activeTab}
                    onSelectTab={(tabId) => {
                        setActiveTab(tabId);
                        if (tabId === "branding") {
                            setActiveBrandingTab("profile");
                            const target = selectedHospital || hospitals[0];
                            if (target) {
                                loadHospitalBrandingData(target);
                            }
                        }
                        setMobileDrawerOpen(false);
                    }}
                    selectedHospital={selectedHospital}
                    hospitals={hospitals}
                    hospitalEmployees={hospitalEmployees}
                    hospitalDesksData={hospitalDesksData}
                    hospitalDepts={hospitalDepts}
                    hospitalVisitsData={hospitalVisitsData}
                    hospitalBranding={hospitalBranding}
                    brandingForm={brandingForm}
                    activeBroadcastsCount={activeBroadcastsCount}
                    socketConnected={socketConnected}
                    lastSyncedAt={lastSyncedAt}
                    isHi={isHi}
                />

                {/* Right Side: Main Workspace */}
                <main className="superadmin-workspace">
                    {/* Mobile Navigation Header Bar with Hamburger */}
                    <div className="superadmin-mobile-topbar">
                        <button
                            type="button"
                            className="superadmin-mobile-menu-btn"
                            onClick={() => setMobileDrawerOpen(true)}
                            aria-label="Open Super Admin Navigation"
                        >
                            <IconMenu size={20} />
                        </button>
                        <div className="superadmin-mobile-title">
                            <IconShield size={18} color="#0284C7" />
                            <span>{selectedHospital?.name || (isHi ? "सुपर एडमिन" : "Super Admin Control Center")}</span>
                        </div>
                    </div>

                    {/* 1. SUPER ADMIN HERO SECTION (Real-Time Live Telemetry) */}
                    <section className="superadmin-hero-container">
                <div className="superadmin-hero-left-col">
                    <div>
                        {selectedHospital && (
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "4px 12px",
                                borderRadius: "20px",
                                background: "rgba(56, 189, 248, 0.12)",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                marginBottom: "12px",
                                backdropFilter: "blur(8px)"
                            }}>
                                <IconHospital size={14} color="#38BDF8" />
                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#E0F2FE", letterSpacing: "0.2px" }}>
                                    {selectedHospital.name} <span style={{ opacity: 0.75 }}>({selectedHospital.hospital_code})</span>
                                </span>
                            </div>
                        )}
                        <h1 className="superadmin-hero-title">
                            {isHi ? (
                                <>
                                    अस्पताल नेटवर्क प्रबंधन.
                                    <br />
                                    <span className="superadmin-hero-title-highlight">शाखाएं एवं</span> डॉक्टर नियंत्रण.
                                </>
                            ) : (
                                <>
                                    Hospital Network Control.
                                    <br />
                                    <span className="superadmin-hero-title-highlight">Multi-Branch</span> Fleet & Desks.
                                </>
                            )}
                        </h1>
                        <p className="superadmin-hero-subtitle">
                            {selectedHospital
                                ? (isHi
                                    ? `${selectedHospital.name} के क्लिनिकल विभागों, डॉक्टर रोस्टर, लाइव काउंटर डेस्क एवं ओपीडी टेलीमेट्री की निगरानी।`
                                    : `Real-time operations for ${selectedHospital.name}: department counters, clinician roster, active desks & telemetry.`)
                                : (isHi
                                    ? "सभी अस्पतालों, क्लिनिकल विभागों, डॉक्टर रोस्टर, लाइव काउंटर डेस्क एवं एनएबीएच अनुपालन रिपोर्ट की केंद्रीय निगरानी।"
                                    : "Enterprise multi-tenant orchestration: Manage branches, department counters, doctors, active desk pods & real-time telemetry.")}
                        </p>
                    </div>

                    {/* Live Synchronized Telemetry Metrics */}
                    {(() => {
                        const hospitalDocs = (hospitalEmployees || []).filter(e => {
                            const role = (e.role || "").toLowerCase();
                            return role === "doctor" || role === "physician" || (e.name || "").toLowerCase().startsWith("dr.");
                        });
                        const activeDocs = hospitalDocs.filter(e => (e.status || "active").toLowerCase() === "active").length;
                        const effectiveDocsCount = selectedHospital
                            ? (activeDocs > 0 ? activeDocs : hospitalDocs.length)
                            : (overview.active_doctors || 0);

                        const effectiveActiveDesks = selectedHospital
                            ? (hospitalDesksData.active_desks || 0)
                            : (overview.active_desks || 0);
                        const effectiveTotalDesks = selectedHospital
                            ? (hospitalDesksData.total_desks || 0)
                            : (overview.total_desks || 0);

                        const effectivePatientsToday = selectedHospital
                            ? (hospitalVisitsData?.summary?.today_patients_visited != null
                                ? hospitalVisitsData.summary.today_patients_visited
                                : ((hospitalAnalytics?.completed_today || 0) + (hospitalQueueSnapshot.length + hospitalServingTickets.length)))
                            : (overview.patients_today || 0);

                        return (
                            <div className="superadmin-hero-stats-row">

                                <div className="superadmin-hero-stat-card">
                                    <div className="superadmin-hero-stat-icon-wrap" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34D399" }}>
                                        <IconUsers size={20} />
                                    </div>
                                    <div>
                                        <div className="superadmin-hero-stat-value" style={{ color: "#34D399" }}>
                                            {effectiveDocsCount}
                                        </div>
                                        <div className="superadmin-hero-stat-label">{isHi ? "सक्रिय डॉक्टर" : "Active Clinicians"}</div>
                                    </div>
                                </div>

                                <div className="superadmin-hero-stat-card">
                                    <div className="superadmin-hero-stat-icon-wrap" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#FBBF24" }}>
                                        <IconDesk size={20} />
                                    </div>
                                    <div>
                                        <div className="superadmin-hero-stat-value" style={{ color: "#FBBF24" }}>
                                            {effectiveActiveDesks}/{effectiveTotalDesks}
                                        </div>
                                        <div className="superadmin-hero-stat-label">{isHi ? "सक्रिय डेस्क" : "Online Desks"}</div>
                                    </div>
                                </div>

                                <div className="superadmin-hero-stat-card">
                                    <div className="superadmin-hero-stat-icon-wrap" style={{ background: "rgba(234, 179, 8, 0.2)", color: "#FDE047" }}>
                                        <IconTrendingUp size={20} />
                                    </div>
                                    <div>
                                        <div className="superadmin-hero-stat-value" style={{ color: "#FDE047" }}>
                                            {effectivePatientsToday}
                                        </div>
                                        <div className="superadmin-hero-stat-label">{isHi ? "आज के मरीज़" : "Patients Today"}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Right Column: Live Network Telemetry & Hospital Vector */}
                <div className="superadmin-hero-right-col" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px", position: "relative", boxSizing: "border-box" }}>
                    {(() => {
                        const effectiveActiveQueues = selectedHospital
                            ? (hospitalQueueSnapshot.length + hospitalServingTickets.length || (hospitalAnalytics ? ((hospitalAnalytics.waiting_count || 0) + (hospitalAnalytics.serving_count || 0)) : 0))
                            : (overview.active_queues || 0);

                        const effectiveTotalTickets = selectedHospital
                            ? (hospitalVisitsData?.summary?.total_patients_visited_all_time != null
                                ? hospitalVisitsData.summary.total_patients_visited_all_time
                                : (hospitalAnalytics?.total_completed || 0))
                            : (overview.total_tickets || 0);

                        const effectiveUsers = selectedHospital
                            ? (hospitalEmployees || []).length
                            : (overview.total_users || 0);

                        return (
                            <>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", width: "100%", margin: "0", zIndex: 3 }}>
                                    <div className="superadmin-hero-telemetry-card" style={{ background: "rgba(255, 255, 255, 0.92)", backdropFilter: "blur(10px)", border: "1px solid #BAE6FD", borderRadius: "14px", padding: "12px 14px", boxShadow: "0 4px 12px rgba(2, 132, 199, 0.06)" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                            <span className="superadmin-telemetry-label" style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>{isHi ? "सक्रिय कतारें" : "Active In Queue"}</span>
                                            <span style={{ color: "#0284C7" }}><IconClock size={16} /></span>
                                        </div>
                                        <div className="superadmin-telemetry-val" style={{ fontSize: "22px", fontWeight: 800, color: "#0284C7", lineHeight: 1.1 }}>
                                            {effectiveActiveQueues}
                                        </div>
                                        <span className="superadmin-telemetry-sub" style={{ fontSize: "10px", color: "#0369A1", fontWeight: 600, display: "block", marginTop: "2px" }}>
                                            {isHi ? "प्रतीक्षारत / सेवारत टोकन" : "Waiting & Serving Tokens"}
                                        </span>
                                    </div>

                                    <div className="superadmin-hero-telemetry-card" style={{ background: "rgba(255, 255, 255, 0.92)", backdropFilter: "blur(10px)", border: "1px solid #BAE6FD", borderRadius: "14px", padding: "12px 14px", boxShadow: "0 4px 12px rgba(2, 132, 199, 0.06)" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                            <span className="superadmin-telemetry-label" style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>{isHi ? "कुल विज़िट" : "Lifetime Visits"}</span>
                                            <span style={{ color: "#16A34A" }}><IconTrendingUp size={16} /></span>
                                        </div>
                                        <div className="superadmin-telemetry-val" style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
                                            {effectiveTotalTickets}
                                        </div>
                                        <span style={{ fontSize: "10px", color: "#16A34A", fontWeight: 700, display: "block", marginTop: "2px" }}>
                                            ✓ {effectiveUsers} {selectedHospital ? (isHi ? "पंजीकृत स्टाफ / कर्मचारी" : "Registered Staff & Accounts") : (isHi ? "पंजीकृत उपयोगकर्ता" : "Registered Accounts")}
                                        </span>
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {/* Background Vector Graphic Silhouette */}
                    <div style={{ position: "absolute", right: "-10px", bottom: "-10px", opacity: 0.12, pointerEvents: "none", zIndex: 1, width: "240px", maxHeight: "200px" }}>
                        <SuperAdminHospitalIllustration />
                    </div>
                </div>
            </section>

            {/* Feedback Toast */}
            {feedbackMsg && (
                <div style={feedbackToastStyle}>
                    {feedbackMsg}
                </div>
            )}

                    {/* Main Active Module Workspace View */}
                    <div className="superadmin-module-content" style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
                        {/* TAB 0: 360° VISUAL HOSPITAL OPERATIONS DASHBOARD */}
                    {activeTab === "overview" && (
                        <Hospital360Overview
                            selectedHospital={selectedHospital}
                            hospitals={hospitals}
                            setSelectedHospital={setSelectedHospital}
                            onSelectHospitalTenant={onSelectHospitalTenant}
                            hospitalBranding={hospitalBranding}
                            hospitalAnalytics={hospitalAnalytics}
                            hospitalQueueSnapshot={hospitalQueueSnapshot}
                            hospitalServingTickets={hospitalServingTickets}
                            hospitalDesksData={hospitalDesksData}
                            hospitalEmployees={hospitalEmployees}
                            hospitalDepts={hospitalDepts}
                            hospitalVisitsData={hospitalVisitsData}
                            visitHistorySearchQuery={visitHistorySearchQuery}
                            setVisitHistorySearchQuery={setVisitHistorySearchQuery}
                            visitHistoryStatusFilter={visitHistoryStatusFilter}
                            setVisitHistoryStatusFilter={setVisitHistoryStatusFilter}
                            showVisitHistoryTable={showVisitHistoryTable}
                            setShowVisitHistoryTable={setShowVisitHistoryTable}
                            analyticsViewTab={analyticsViewTab}
                            setAnalyticsViewTab={setAnalyticsViewTab}
                            hoveredChartHour={hoveredChartHour}
                            setHoveredChartHour={setHoveredChartHour}
                            lastSyncedAt={lastSyncedAt}
                            theme={theme}
                            brandingForm={brandingForm}
                            loadHospitalBrandingData={loadHospitalBrandingData}
                            setActiveTab={setActiveTab}
                            setActiveBrandingTab={setActiveBrandingTab}
                            setShowAddHospitalModal={setShowAddHospitalModal}
                            setShowAddDeskModal={setShowAddDeskModal}
                            setShowNABHReportModal={setShowNABHReportModal}
                            handleDownloadVisitHistory={handleDownloadVisitHistory}
                            computeHourlyAnalytics={computeHourlyAnalytics}
                            computeDepartmentBottlenecks={computeDepartmentBottlenecks}
                            isHi={isHi}
                        />
                    )}

                    {/* TAB 1: HOSPITALS DIRECTORY */}
                    {activeTab === "hospitals" && (
                        <HospitalsDirectoryTab
                            hospitals={hospitals}
                            selectedHospital={selectedHospital}
                            setSelectedHospital={(hosp) => {
                                setSelectedHospital(hosp);
                                if (onSelectHospitalTenant) onSelectHospitalTenant(hosp.hospital_code);
                            }}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            onOpenAddModal={() => setShowAddHospitalModal(true)}
                            onDeleteHospital={handleDeleteHospital}
                            onManageStaff={(hosp) => {
                                setSelectedHospital(hosp);
                                if (onSelectHospitalTenant) onSelectHospitalTenant(hosp.hospital_code);
                                setActiveTab("employees");
                                window.scrollTo({ top: 380, behavior: "smooth" });
                            }}
                            onCustomizeBranding={(hosp) => {
                                setSelectedHospital(hosp);
                                loadHospitalBrandingData(hosp);
                                setActiveBrandingTab("profile");
                                setActiveTab("branding");
                                window.scrollTo({ top: 380, behavior: "smooth" });
                            }}
                            hospitalVisitsData={hospitalVisitsData}
                            isHi={isHi}
                        />
                    )}

                    {/* TAB 2: CLINICIANS & STAFF ROSTER */}
                    {activeTab === "employees" && (
                        <StaffRosterTab
                            selectedHospital={selectedHospital}
                            hospitals={hospitals}
                            onSelectHospital={(hosp) => {
                                setSelectedHospital(hosp);
                                if (onSelectHospitalTenant) onSelectHospitalTenant(hosp.hospital_code);
                            }}
                            hospitalEmployees={hospitalEmployees}
                            hospitalDepts={hospitalDepts}
                            employeeStatusFilter={employeeStatusFilter}
                            setEmployeeStatusFilter={setEmployeeStatusFilter}
                            employeeSearchQuery={employeeSearchQuery}
                            setEmployeeSearchQuery={setEmployeeSearchQuery}
                            employeePage={employeePage}
                            setEmployeePage={setEmployeePage}
                            isTogglingEmpStatus={isTogglingEmpStatus}
                            onToggleStatus={handleToggleEmployeeStatus}
                            onEditEmployee={(emp) => {
                                setEditEmployeeForm({
                                    id: emp.id || emp.employee_id_num || emp.user_id,
                                    name: emp.name || emp.username || "",
                                    phone: emp.phone || "",
                                    role: emp.role || "doctor",
                                    department: emp.department || "consultation",
                                    employee_id: emp.employee_id || "",
                                    status: emp.status || "active",
                                    password: "",
                                    assigned_desk_id: emp.assigned_desk_id || null,
                                    qualification: emp.qualification || "",
                                    specialization: emp.specialization || "",
                                    license_number: emp.license_number || "",
                                    gender: emp.gender || "other",
                                    experience_years: emp.experience_years || 0,
                                    room_number: emp.room_number || "",
                                });
                                setShowEditEmployeeModal(true);
                            }}
                            onChangePassword={(emp) => {
                                setPasswordTargetEmployee(emp);
                                setNewPasswordValue("");
                                setPasswordUpdateSuccess(null);
                                setShowChangePasswordModal(true);
                            }}
                            onDeleteEmployee={handleDeleteEmployee}
                            onAddEmployee={() => {
                                setCreatedCredentials(null);
                                setShowAddEmployeeModal(true);
                            }}
                            getEmployeeCurrentDesk={getEmployeeCurrentDesk}
                            formatRelativeLogin={formatRelativeLogin}
                            notify={notify}
                            language={language}
                            isHi={isHi}
                            getAuthHeaders={getAuthHeaders}
                            fetchHospitalDeepDive={fetchHospitalDeepDive}
                            fetchGlobalData={fetchGlobalData}
                        />
                    )}

                    {/* TAB 3: ACTIVE DESKS MANAGEMENT */}
                    {activeTab === "desks" && (
                        <DesksManagementTab
                            selectedHospital={selectedHospital}
                            hospitals={hospitals}
                            onSelectHospital={(hosp) => {
                                setSelectedHospital(hosp);
                                if (onSelectHospitalTenant) onSelectHospitalTenant(hosp.hospital_code);
                            }}
                            hospitalDesksData={hospitalDesksData}
                            hospitalDepts={hospitalDepts}
                            deskSearchQuery={deskSearchQuery}
                            setDeskSearchQuery={setDeskSearchQuery}
                            onBulkDeskStatus={handleBulkDeskStatus}
                            onToggleDeskStatus={handleToggleDeskStatus}
                            onOpenAddDesk={() => {
                                setNewDeskForm({
                                    dept_code: hospitalDepts[0]?.dept_code || "consultation",
                                    desk_name: "",
                                    status: "AVAILABLE",
                                    assigned_employee_id: "",
                                });
                                setShowAddDeskModal(true);
                            }}
                            onOpenEditDesk={(desk) => {
                                setEditDeskForm({
                                    id: desk.id,
                                    desk_name: desk.desk_name,
                                    dept_code: desk.dept_code,
                                    status: desk.status,
                                    assigned_employee_id: desk.assigned_employee_id || "",
                                });
                                setShowEditDeskModal(true);
                            }}
                            onOpenAssignDesk={(desk) => {
                                setAssignDeskTarget({ desk, employee_id: desk.assigned_employee_id || "" });
                                setAssignSearchQuery("");
                                setShowAssignDeskModal(true);
                            }}
                            onUnassignDesk={(deskOrId) => {
                                const id = typeof deskOrId === "object" && deskOrId !== null ? deskOrId.id : deskOrId;
                                if (id) handleAssignDesk(id, null);
                            }}
                            onDeleteDesk={handleDeleteDesk}
                            formatRelativeLogin={formatRelativeLogin}
                            language={language}
                            isHi={isHi}
                            notify={notify}
                            showConfirm={showConfirm}
                        />
                    )}

                    {/* TAB 4: CLINICAL DEPARTMENTS */}
                    {activeTab === "depts" && (
                        <DepartmentsTab
                            selectedHospital={selectedHospital}
                            hospitals={hospitals}
                            onSelectHospital={(hosp) => {
                                setSelectedHospital(hosp);
                                if (onSelectHospitalTenant) onSelectHospitalTenant(hosp.hospital_code);
                            }}
                            hospitalDepts={hospitalDepts}
                            onOpenAddDept={() => setShowAddDeptModal(true)}
                            onOpenEditDept={(dept) => {
                                setEditDeptForm({
                                    dept_code: dept.dept_code,
                                    name: dept.name,
                                    description: dept.description || "",
                                });
                                setShowEditDeptModal(true);
                            }}
                            onDeleteDepartment={handleDeleteDepartment}
                            isHi={isHi}
                        />
                    )}

                    {/* TAB 5: PATIENT VISITS ARCHIVE */}
                    {activeTab === "visits" && (
                        <PatientVisitsTab
                            selectedHospital={selectedHospital}
                            hospitals={hospitals}
                            notify={notify}
                            isHi={isHi}
                            getAuthHeaders={getAuthHeaders}
                            hospitalVisitsData={hospitalVisitsData}
                            handleDownloadVisitHistory={handleDownloadVisitHistory}
                            fetchHospitalDeepDive={fetchHospitalDeepDive}
                        />
                    )}

                    {/* TAB 6: BRANDING STUDIO */}
                    {activeTab === "branding" && (
                        <BrandingStudioTab
                            brandingTargetHospital={brandingTargetHospital}
                            selectedHospital={selectedHospital}
                            hospitals={hospitals}
                            setSelectedHospital={(hosp) => {
                                setSelectedHospital(hosp);
                                loadHospitalBrandingData(hosp);
                            }}
                            loadHospitalBrandingData={loadHospitalBrandingData}
                            brandingForm={brandingForm}
                            setBrandingForm={setBrandingForm}
                            activeBrandingTab={activeBrandingTab}
                            setActiveBrandingTab={setActiveBrandingTab}
                            brandingPreviewMode={brandingPreviewMode}
                            setBrandingPreviewMode={setBrandingPreviewMode}
                            isSavingBranding={isSavingBranding}
                            handleSaveBrandingSubmit={handleSaveBrandingSubmit}
                            handleResetBrandingDefaults={handleResetBrandingDefaults}
                            notify={notify}
                            isHi={isHi}
                            hospitalEmployees={hospitalEmployees}
                            hospitalVisitsData={hospitalVisitsData}
                            hospitalDepts={hospitalDepts}
                            handleDownloadVisitHistory={handleDownloadVisitHistory}
                            fetchHospitalDeepDive={fetchHospitalDeepDive}
                            fetchGlobalData={fetchGlobalData}
                            getAuthHeaders={getAuthHeaders}
                            currentUser={currentUser}
                            showConfirm={showConfirm}
                        />
                    )}

                    {/* TAB 7: KIOSKS & WAITING ROOM DISPLAYS */}
                    {activeTab === "kiosks" && (
                        <KiosksManagementTab
                            selectedHospital={selectedHospital}
                            hospitals={hospitals}
                            onSelectHospital={(hosp) => {
                                setSelectedHospital(hosp);
                                if (onSelectHospitalTenant) onSelectHospitalTenant(hosp.hospital_code);
                            }}
                            hospitalDepts={hospitalDepts}
                            getAuthHeaders={getAuthHeaders}
                            notify={notify}
                            showConfirm={showConfirm}
                            language={language}
                            isHi={isHi}
                        />
                    )}

                    {/* TAB 8: EMERGENCY BROADCAST & ANNOUNCEMENT CENTER */}
                    {activeTab === "broadcasts" && (
                        <BroadcastCenterTab
                            hospitals={hospitals}
                            selectedHospital={selectedHospital}
                            getAuthHeaders={getAuthHeaders}
                            notify={notify}
                            showConfirm={showConfirm}
                            isHi={isHi}
                            currentUser={currentUser}
                            socketConnected={socketConnected}
                        />
                    )}
                    </div>

                    {/* FOOTER */}
                    <div style={{ marginTop: "24px", marginBottom: "0px", width: "100%" }}>
                        <Footer
                            language={language}
                            hospitalName={selectedHospital?.name || currentUser?.hospital_name || "City General Hospital"}
                            currentUser={currentUser}
                        />
                    </div>
                </main>
            </div>

            {/* 4. MODALS */}
            <AddHospitalModal
                isOpen={showAddHospitalModal}
                onClose={() => setShowAddHospitalModal(false)}
                newHospitalForm={newHospitalForm}
                setNewHospitalForm={setNewHospitalForm}
                onSubmit={handleCreateHospitalSubmit}
                isHi={isHi}
            />

            <AddEmployeeModal
                isOpen={showAddEmployeeModal}
                onClose={() => setShowAddEmployeeModal(false)}
                newEmployeeForm={newEmployeeForm}
                setNewEmployeeForm={setNewEmployeeForm}
                onSubmit={handleAddEmployeeSubmit}
                hospitalDepts={hospitalDepts}
                createdCredentials={createdCredentials}
                onCloseCredentials={() => setCreatedCredentials(null)}
                onNotify={notify}
                isHi={isHi}
            />

            <EditEmployeeModal
                isOpen={showEditEmployeeModal}
                onClose={() => {
                    setShowEditEmployeeModal(false);
                    setEditEmployeeForm({ id: null, name: "", phone: "", role: "doctor", department: "consultation", employee_id: "", status: "active", password: "" });
                }}
                editEmployeeForm={editEmployeeForm}
                setEditEmployeeForm={setEditEmployeeForm}
                onSubmit={handleUpdateEmployeeSubmit}
                hospitalDepts={hospitalDepts}
                isHi={isHi}
            />

            <ChangePasswordModal
                isOpen={showChangePasswordModal}
                onClose={() => {
                    setShowChangePasswordModal(false);
                    setPasswordTargetEmployee(null);
                    setPasswordUpdateSuccess(null);
                    setNewPasswordValue("");
                }}
                targetEmployee={passwordTargetEmployee}
                selectedHospital={selectedHospital}
                passwordUpdateSuccess={passwordUpdateSuccess}
                setPasswordUpdateSuccess={setPasswordUpdateSuccess}
                newPasswordValue={newPasswordValue}
                setNewPasswordValue={setNewPasswordValue}
                onSubmit={handleUpdatePasswordSubmit}
                isUpdatingPassword={isUpdatingPassword}
                onNotify={notify}
                showPasswordText={showPasswordText}
                setShowPasswordText={setShowPasswordText}
                isHi={isHi}
            />

            <AddDeskModal
                isOpen={showAddDeskModal}
                onClose={() => setShowAddDeskModal(false)}
                newDeskForm={newDeskForm}
                setNewDeskForm={setNewDeskForm}
                onSubmit={handleAddDeskSubmit}
                hospitalDepts={hospitalDepts}
                hospitalEmployees={hospitalEmployees}
                getEmployeeCurrentDesk={getEmployeeCurrentDesk}
                language={language}
                isHi={isHi}
            />

            <EditDeskModal
                isOpen={showEditDeskModal}
                onClose={() => {
                    setShowEditDeskModal(false);
                    setEditDeskForm({ id: null, desk_name: "", dept_code: "", status: "AVAILABLE", assigned_employee_id: "" });
                }}
                editDeskForm={editDeskForm}
                setEditDeskForm={setEditDeskForm}
                onSubmit={handleUpdateDeskSubmit}
                hospitalDepts={hospitalDepts}
                hospitalEmployees={hospitalEmployees}
                getEmployeeCurrentDesk={getEmployeeCurrentDesk}
                language={language}
                isHi={isHi}
            />

            <AssignDeskModal
                isOpen={showAssignDeskModal}
                onClose={() => {
                    setShowAssignDeskModal(false);
                    setAssignDeskTarget({ desk: null, employee_id: "" });
                }}
                assignDeskTarget={assignDeskTarget}
                setAssignDeskTarget={setAssignDeskTarget}
                onSubmit={() => handleAssignDesk(assignDeskTarget?.desk?.id, assignDeskTarget?.employee_id)}
                hospitalEmployees={hospitalEmployees}
                hospitalDesksData={hospitalDesksData}
                assignSearchQuery={assignSearchQuery}
                setAssignSearchQuery={setAssignSearchQuery}
                language={language}
                isHi={isHi}
            />

            <AddDeptModal
                isOpen={showAddDeptModal}
                onClose={() => setShowAddDeptModal(false)}
                newDeptForm={newDeptForm}
                setNewDeptForm={setNewDeptForm}
                onSubmit={handleAddDeptSubmit}
                isHi={isHi}
            />

            <EditDeptModal
                isOpen={showEditDeptModal}
                onClose={() => {
                    setShowEditDeptModal(false);
                    setEditDeptForm({ dept_code: "", name: "", description: "" });
                }}
                editDeptForm={editDeptForm}
                setEditDeptForm={setEditDeptForm}
                onSubmit={handleUpdateDepartmentSubmit}
                isHi={isHi}
            />

            <NABHReportModal
                isOpen={showNABHReportModal}
                onClose={() => setShowNABHReportModal(false)}
                targetHosp={selectedHospital || hospitals[0]}
                visitsList={hospitalVisitsData?.visits || []}
                queueList={hospitalQueueSnapshot || []}
                deptsList={hospitalDepts || []}
                hospitalVisitsData={hospitalVisitsData}
                hospitalAnalytics={hospitalAnalytics}
                hospitalEmployees={hospitalEmployees}
                brandingForm={brandingForm}
                computeHourlyAnalytics={computeHourlyAnalytics}
                computeDepartmentBottlenecks={computeDepartmentBottlenecks}
                onPrintReport={handlePrintNABHReport}
                onDownloadExcel={handleDownloadNABHExcel}
                handlePrintNABHReport={handlePrintNABHReport}
                handleDownloadNABHExcel={handleDownloadNABHExcel}
                isHi={isHi}
            />



            {/* IN-APP TOAST AND CONFIRMATION MODALS */}
            <InAppToast toast={inAppToast} onClose={() => setInAppToast(null)} isDark={isDark} />
            <InAppConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} isDark={isDark} />
        </div>
    );
}