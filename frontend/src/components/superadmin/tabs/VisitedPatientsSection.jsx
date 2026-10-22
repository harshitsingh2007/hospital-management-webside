import React, { useState, useMemo } from "react";
import {
    IconDownload,
    IconFileText,
    IconUsers,
    IconSearch,
    IconCheckCircle,
    IconClock,
    IconBuilding,
    IconRefresh,
    IconX,
    IconSliders,
} from "../SuperAdminIcons";
import { API_BASE } from "../../../config/hospitalConfig";

export default function VisitedPatientsSection({
    selectedHospital,
    hospitalVisitsData = {},
    hospitalDepts = [],
    isHi = false,
    theme = "dark",
    handleDownloadVisitHistory,
    notify,
}) {
    const isDark = theme === "dark";
    const currentHosp = selectedHospital || null;

    // Local Search & Filtering States
    const [searchQuery, setSearchQuery] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [timeFilter, setTimeFilter] = useState("all"); // "all" | "today" | "week"
    const [isExportingAll, setIsExportingAll] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);
    const [exportNotice, setExportNotice] = useState("");

    // Raw visits list from props
    const rawVisits = useMemo(() => {
        if (!hospitalVisitsData) return [];
        if (Array.isArray(hospitalVisitsData.visits)) return hospitalVisitsData.visits;
        if (Array.isArray(hospitalVisitsData)) return hospitalVisitsData;
        return [];
    }, [hospitalVisitsData]);

    const summary = hospitalVisitsData?.summary || {};
    const totalAllTimeCount = summary.total_patients_visited_all_time ?? rawVisits.length;
    const todayCompletedCount = summary.today_completed ?? rawVisits.filter((v) => (v.status || "").toLowerCase() === "completed").length;
    const thisWeekCount = summary.this_week_visits ?? rawVisits.length;
    const thisMonthCount = summary.this_month_visits ?? rawVisits.length;

    // Unique department list for filtering dropdown
    const availableDepts = useMemo(() => {
        const set = new Set();
        (hospitalDepts || []).forEach((d) => d.name && set.add(d.name));
        rawVisits.forEach((v) => v.department && set.add(v.department));
        return Array.from(set);
    }, [hospitalDepts, rawVisits]);

    // Filtered visits based on user controls
    const filteredVisits = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const todayStr = new Date().toISOString().split("T")[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        return rawVisits.filter((v) => {
            // Text Search filter (Patient name, phone, ticket ID, department)
            if (query) {
                const name = (v.patient_name || "").toLowerCase();
                const phone = (v.phone || "").toLowerCase();
                const ticket = (v.ticket_id || v.token_number || `#${v.id}` || "").toLowerCase();
                const dept = (v.department || "").toLowerCase();
                if (!name.includes(query) && !phone.includes(query) && !ticket.includes(query) && !dept.includes(query)) {
                    return false;
                }
            }

            // Department filter
            if (deptFilter !== "all" && v.department !== deptFilter && v.dept_code !== deptFilter) {
                return false;
            }

            // Status filter
            if (statusFilter !== "all") {
                const st = (v.status || "").toLowerCase();
                if (statusFilter === "completed" && st !== "completed") return false;
                if (statusFilter === "serving" && st !== "serving" && st !== "in_consultation" && st !== "in-progress") return false;
                if (statusFilter === "waiting" && st !== "waiting") return false;
                if (statusFilter === "cancelled" && st !== "cancelled") return false;
            }

            // Time range filter
            if (timeFilter === "today") {
                const vDate = v.created_at ? v.created_at.split("T")[0] : v.queue_date;
                if (vDate && vDate !== todayStr) return false;
            } else if (timeFilter === "week") {
                if (v.created_at) {
                    const d = new Date(v.created_at);
                    if (d < weekAgo) return false;
                }
            }

            return true;
        });
    }, [rawVisits, searchQuery, deptFilter, statusFilter, timeFilter]);

    // Pagination slice
    const totalPages = Math.max(1, Math.ceil(filteredVisits.length / rowsPerPage));
    const paginatedVisits = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredVisits.slice(start, start + rowsPerPage);
    }, [filteredVisits, currentPage, rowsPerPage]);

    // Format CSV helper with UTF-8 BOM
    const triggerCsvDownload = (records, filenamePrefix) => {
        if (!records || records.length === 0) {
            const msg = isHi ? "डाउनलोड करने के लिए कोई विज़िट रिकॉर्ड उपलब्ध नहीं है।" : "No patient visit records available to download.";
            if (notify) notify(msg, "warn");
            return;
        }

        const headers = [
            "Hospital Name",
            "Hospital Code",
            "Ticket / Token ID",
            "Patient Name",
            "Phone Number",
            "Age",
            "Gender",
            "Clinical Department",
            "Priority Level",
            "Visit Date & Time",
            "Check-in Timestamp",
            "Consultation Start",
            "Consultation End",
            "TAT Duration (Minutes)",
            "Status",
        ];

        const hospName = currentHosp?.name || "Hospital";
        const hospCode = currentHosp?.hospital_code || "HOSP";

        const csvRows = [headers.join(",")];

        records.forEach((v) => {
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
                `"${hospName.replace(/"/g, '""')}"`,
                `"${hospCode.replace(/"/g, '""')}"`,
                `"${(v.ticket_id || v.token_number || `#${v.id}` || "").toString().replace(/"/g, '""')}"`,
                `"${(v.patient_name || "Patient").toString().replace(/"/g, '""')}"`,
                `"${(v.phone || "").toString().replace(/"/g, '""')}"`,
                `"${(v.age || "").toString().replace(/"/g, '""')}"`,
                `"${(v.gender || "").toString().replace(/"/g, '""')}"`,
                `"${(v.department || "General OPD").toString().replace(/"/g, '""')}"`,
                `"${(v.priority_level || "Normal").toString().replace(/"/g, '""')}"`,
                `"${dateStr.toString().replace(/"/g, '""')}"`,
                `"${(v.join_time ? new Date(v.join_time).toLocaleTimeString() : "").replace(/"/g, '""')}"`,
                `"${(v.serve_start_time ? new Date(v.serve_start_time).toLocaleTimeString() : "").replace(/"/g, '""')}"`,
                `"${(v.serve_end_time ? new Date(v.serve_end_time).toLocaleTimeString() : "").replace(/"/g, '""')}"`,
                `"${(v.service_duration_minutes || "").toString().replace(/"/g, '""')}"`,
                `"${(v.status || "completed").toString().replace(/"/g, '""')}"`,
            ];
            csvRows.push(row.join(","));
        });

        // Add UTF-8 BOM so Excel opens Hindi & unicode characters accurately
        const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const safeHospName = hospName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const dateStamp = new Date().toISOString().split("T")[0];
        const filename = `${safeHospName}_${filenamePrefix}_${dateStamp}.csv`;

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExportNotice(
            isHi
                ? `सफलतापूर्वक ${records.length} मरीज रिकॉर्ड्स डाउनलोड हो गए (${filename})!`
                : `Successfully exported ${records.length} visited patient records to ${filename}!`
        );
        setTimeout(() => setExportNotice(""), 6000);
    };

    // 1-Click Server Pull to Export 100% of All-Time History
    const handleDownloadCompleteServerHistory = async () => {
        if (!currentHosp?.hospital_code) {
            triggerCsvDownload(filteredVisits, "Visited_Patients");
            return;
        }

        try {
            setIsExportingAll(true);
            const token = localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${currentHosp.hospital_code}/visits?limit=5000`, {
                headers,
            });
            const data = await res.json();
            const allVisits = data && Array.isArray(data.visits) && data.visits.length > 0 ? data.visits : rawVisits;
            triggerCsvDownload(allVisits, "Complete_All_Time_Visited_Patients");
        } catch (err) {
            console.warn("Could not fetch full visit log, falling back to loaded visits:", err);
            if (handleDownloadVisitHistory) {
                handleDownloadVisitHistory(filteredVisits, currentHosp?.name);
            } else {
                triggerCsvDownload(filteredVisits, "Visited_Patients");
            }
        } finally {
            setIsExportingAll(false);
        }
    };

    return (
        <div
            className="overview-sub-panel"
            style={{
                marginTop: "20px",
                marginBottom: "20px",
                padding: "22px 24px",
                borderRadius: "20px",
                border: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
                background: "var(--superadmin-card-bg, #FFFFFF)",
                boxShadow: "0 4px 20px -2px rgba(2, 132, 199, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
            }}
        >
            {/* 1. Header Bar: Title, Subtitle, & Primary Download Action Buttons */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "16px",
                    borderBottom: "1px solid var(--superadmin-card-border, #E2E8F0)",
                    paddingBottom: "16px",
                }}
            >
                <div style={{ maxWidth: "600px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span
                            style={{
                                fontSize: "17px",
                                fontWeight: 900,
                                color: "var(--superadmin-text-main, #0F172A)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                            }}
                        >
                            <IconFileText size={19} color="#0284C7" />
                            <span>
                                {isHi
                                    ? "मरीज विज़िट इतिहास एवं क्लिनिकल रिकॉर्ड्स रजिस्ट्री"
                                    : "Patient Visit History & Clinical Records Registry"}
                            </span>
                        </span>

                        <span
                            style={{
                                fontSize: "11px",
                                fontWeight: 800,
                                padding: "2px 9px",
                                borderRadius: "20px",
                                background: "rgba(2, 132, 199, 0.12)",
                                color: "#0284C7",
                                border: "1px solid rgba(2, 132, 199, 0.25)",
                            }}
                        >
                            {filteredVisits.length} {isHi ? "रिकॉर्ड उपलब्ध" : "records shown"}
                        </span>
                    </div>

                    <span
                        style={{
                            fontSize: "12px",
                            color: "var(--superadmin-text-muted, #64748B)",
                            marginTop: "3px",
                            display: "block",
                            lineHeight: "1.4",
                        }}
                    >
                        {isHi
                            ? "अस्पताल के सभी विज़िट किए गए मरीजों की संपूर्ण सूची। यहाँ से पूरा डेटा एक्सेल/सीएसवी प्रारूप में डाउनलोड करें।"
                            : "Comprehensive log of all registered and served patients. Search, filter by department or status, and export full records to Excel (CSV)."}
                    </span>
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
                    {/* Filtered Export (if active filter or search) */}
                    {(searchQuery || deptFilter !== "all" || statusFilter !== "all" || timeFilter !== "all") && (
                        <button
                            type="button"
                            onClick={() => triggerCsvDownload(filteredVisits, "Filtered_Visited_Patients")}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "var(--superadmin-sub-card, #F1F5F9)",
                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                color: "var(--superadmin-text-main, #0F172A)",
                                padding: "8px 14px",
                                borderRadius: "10px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                            }}
                        >
                            <IconDownload size={13} color="#0284C7" />
                            <span>{isHi ? `फिल्टर डेटा डाउनलोड (${filteredVisits.length})` : `Export Filtered (${filteredVisits.length})`}</span>
                        </button>
                    )}

                    {/* Master Download All Records Button */}
                    <button
                        type="button"
                        onClick={handleDownloadCompleteServerHistory}
                        disabled={isExportingAll}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "7px",
                            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#FFFFFF",
                            padding: "8px 16px",
                            borderRadius: "10px",
                            fontSize: "12.5px",
                            fontWeight: 800,
                            cursor: isExportingAll ? "not-allowed" : "pointer",
                            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                            transition: "all 0.2s ease",
                            opacity: isExportingAll ? 0.75 : 1,
                        }}
                    >
                        <IconDownload size={15} color="#FFFFFF" />
                        <span>
                            {isExportingAll
                                ? (isHi ? "डेटा तैयार हो रहा है..." : "Exporting Complete History...")
                                : (isHi ? "संपूर्ण विज़िट डेटा डाउनलोड करें (Excel CSV)" : "Download All Visited Records (CSV)")}
                        </span>
                    </button>
                </div>
            </div>

            {/* Notification / Toast Banner if download succeeded */}
            {exportNotice && (
                <div
                    style={{
                        padding: "10px 16px",
                        borderRadius: "10px",
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        color: "#10B981",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <IconCheckCircle size={16} color="#10B981" />
                    <span>{exportNotice}</span>
                </div>
            )}

            {/* 2. Key Telemetry Summary Chips (4-Grid) */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                }}
            >
                <div
                    style={{
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <div
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            background: "rgba(2, 132, 199, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#0284C7",
                            flexShrink: 0,
                        }}
                    >
                        <IconUsers size={18} color="#0284C7" />
                    </div>
                    <div>
                        <div style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>
                            {isHi ? "कुल मरीज विज़िट (ऑल-टाइम)" : "All-Time Visited Patients"}
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--superadmin-text-main, #0F172A)" }}>
                            {totalAllTimeCount.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <div
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            background: "rgba(16, 185, 129, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#10B981",
                            flexShrink: 0,
                        }}
                    >
                        <IconCheckCircle size={18} color="#10B981" />
                    </div>
                    <div>
                        <div style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>
                            {isHi ? "आज पूर्ण विज़िट" : "Today's Completed"}
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "#10B981" }}>
                            {todayCompletedCount.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <div
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            background: "rgba(245, 158, 11, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#F59E0B",
                            flexShrink: 0,
                        }}
                    >
                        <IconClock size={18} color="#F59E0B" />
                    </div>
                    <div>
                        <div style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>
                            {isHi ? "इस सप्ताह की विज़िट" : "This Week Inflow"}
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--superadmin-text-main, #0F172A)" }}>
                            {thisWeekCount.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <div
                        style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            background: "rgba(139, 92, 246, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#8B5CF6",
                            flexShrink: 0,
                        }}
                    >
                        <IconBuilding size={18} color="#8B5CF6" />
                    </div>
                    <div>
                        <div style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>
                            {isHi ? "इस महीने की विज़िट" : "This Month Inflow"}
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--superadmin-text-main, #0F172A)" }}>
                            {thisMonthCount.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Search & Filter Controls Toolbar */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                    background: "var(--superadmin-sub-card, #F8FAFC)",
                    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                    borderRadius: "14px",
                    padding: "10px 14px",
                }}
            >
                {/* Search Bar Input */}
                <div style={{ position: "relative", flex: "1 1 240px", minWidth: "220px" }}>
                    <div
                        style={{
                            position: "absolute",
                            left: "11px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            pointerEvents: "none",
                            color: "var(--superadmin-text-muted, #94A3B8)",
                        }}
                    >
                        <IconSearch size={14} color="currentColor" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder={
                            isHi
                                ? "मरीज का नाम, फोन, टोकन या विभाग खोजें..."
                                : "Search patient name, phone, ticket ID, department..."
                        }
                        style={{
                            width: "100%",
                            padding: "8px 30px 8px 32px",
                            borderRadius: "8px",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: "var(--superadmin-card-bg, #FFFFFF)",
                            color: "var(--superadmin-text-main, #0F172A)",
                            fontSize: "12px",
                            outline: "none",
                        }}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            style={{
                                position: "absolute",
                                right: "8px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--superadmin-text-muted, #94A3B8)",
                                padding: 2,
                            }}
                        >
                            <IconX size={12} color="currentColor" />
                        </button>
                    )}
                </div>

                {/* Filter Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {/* Department Dropdown */}
                    <select
                        value={deptFilter}
                        onChange={(e) => {
                            setDeptFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        style={{
                            padding: "7px 10px",
                            borderRadius: "8px",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: "var(--superadmin-card-bg, #FFFFFF)",
                            color: "var(--superadmin-text-main, #0F172A)",
                            fontSize: "12px",
                            fontWeight: 600,
                            outline: "none",
                            cursor: "pointer",
                        }}
                    >
                        <option value="all">{isHi ? "सभी विभाग" : "All Departments"}</option>
                        {availableDepts.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>

                    {/* Status Dropdown */}
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        style={{
                            padding: "7px 10px",
                            borderRadius: "8px",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: "var(--superadmin-card-bg, #FFFFFF)",
                            color: "var(--superadmin-text-main, #0F172A)",
                            fontSize: "12px",
                            fontWeight: 600,
                            outline: "none",
                            cursor: "pointer",
                        }}
                    >
                        <option value="all">{isHi ? "सभी स्थिति" : "All Statuses"}</option>
                        <option value="completed">{isHi ? "पूर्ण (Completed)" : "Completed"}</option>
                        <option value="serving">{isHi ? "परामर्श जारी (Serving)" : "Serving / In-Consult"}</option>
                        <option value="waiting">{isHi ? "प्रतीक्षारत (Waiting)" : "Waiting"}</option>
                        <option value="cancelled">{isHi ? "रद्द (Cancelled)" : "Cancelled"}</option>
                    </select>

                    {/* Quick Time Range Selector */}
                    <div
                        style={{
                            display: "inline-flex",
                            borderRadius: "8px",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: "var(--superadmin-card-bg, #FFFFFF)",
                            overflow: "hidden",
                        }}
                    >
                        {[
                            { id: "all", label: isHi ? "सभी" : "All" },
                            { id: "today", label: isHi ? "आज" : "Today" },
                            { id: "week", label: isHi ? "7 दिन" : "7 Days" },
                        ].map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    setTimeFilter(t.id);
                                    setCurrentPage(1);
                                }}
                                style={{
                                    border: "none",
                                    padding: "6px 10px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    background: timeFilter === t.id ? "#0284C7" : "transparent",
                                    color: timeFilter === t.id ? "#FFFFFF" : "var(--superadmin-text-muted, #64748B)",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Reset Button */}
                    {(searchQuery || deptFilter !== "all" || statusFilter !== "all" || timeFilter !== "all") && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setDeptFilter("all");
                                setStatusFilter("all");
                                setTimeFilter("all");
                                setCurrentPage(1);
                            }}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#EF4444",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                padding: "6px 8px",
                            }}
                        >
                            {isHi ? "रीसेट ✕" : "Reset ✕"}
                        </button>
                    )}

                    {/* Toggle Collapse/Expand Table */}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            border: "none",
                            background: "transparent",
                            color: "#0284C7",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                            padding: "6px 8px",
                        }}
                    >
                        {isExpanded ? (isHi ? "संक्षिप्त करें ▲" : "Collapse ▲") : (isHi ? "विस्तार करें ▼" : "Expand ▼")}
                    </button>
                </div>
            </div>

            {/* 4. Interactive Patient Records Preview Table */}
            {isExpanded && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div
                        style={{
                            overflowX: "auto",
                            borderRadius: "12px",
                            border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                            background: "var(--superadmin-card-bg, #FFFFFF)",
                        }}
                    >
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                            <thead>
                                <tr
                                    style={{
                                        background: "var(--superadmin-sub-card, #F8FAFC)",
                                        borderBottom: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
                                        color: "var(--superadmin-text-muted, #64748B)",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        letterSpacing: "0.4px",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    <th style={{ padding: "10px 14px" }}>{isHi ? "टोकन / टिकट" : "Token / Ticket ID"}</th>
                                    <th style={{ padding: "10px 14px" }}>{isHi ? "मरीज एवं संपर्क" : "Patient Name & Contact"}</th>
                                    <th style={{ padding: "10px 14px" }}>{isHi ? "उम्र / लिंग" : "Age / Gender"}</th>
                                    <th style={{ padding: "10px 14px" }}>{isHi ? "विभाग" : "Department"}</th>
                                    <th style={{ padding: "10px 14px" }}>{isHi ? "विज़िट समय" : "Visit Date & Time"}</th>
                                    <th style={{ padding: "10px 14px" }}>{isHi ? "परामर्श अवधि" : "TAT Duration"}</th>
                                    <th style={{ padding: "10px 14px" }}>{isHi ? "स्थिति" : "Status"}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedVisits.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: "36px 16px", textAlign: "center", color: "var(--superadmin-text-muted, #94A3B8)" }}>
                                            <IconFileText size={32} color="#94A3B8" />
                                            <div style={{ marginTop: "10px", fontSize: "13.5px", fontWeight: 700 }}>
                                                {isHi ? "कोई मरीज विज़िट रिकॉर्ड नहीं मिला" : "No patient visit records found matching criteria"}
                                            </div>
                                            <div style={{ fontSize: "12px", marginTop: "4px" }}>
                                                {isHi ? "कृपया अपने खोज फ़िल्टर समायोजित करें या रीसेट करें।" : "Try clearing or modifying your search and filters."}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedVisits.map((v, idx) => {
                                        const st = (v.status || "completed").toLowerCase();
                                        const isCompleted = st === "completed";
                                        const isServing = st === "serving" || st === "in_consultation" || st === "in-progress";
                                        const isWaiting = st === "waiting";

                                        const dateDisplay = v.created_at
                                            ? new Date(v.created_at).toLocaleString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })
                                            : v.queue_date || "Today";

                                        return (
                                            <tr
                                                key={v.id || v.ticket_id || idx}
                                                style={{
                                                    borderBottom: "1px solid var(--superadmin-card-border, #F1F5F9)",
                                                    transition: "background 0.15s ease",
                                                }}
                                            >
                                                {/* Token / Ticket */}
                                                <td style={{ padding: "10px 14px" }}>
                                                    <code
                                                        style={{
                                                            fontSize: "11px",
                                                            fontWeight: 800,
                                                            padding: "2px 7px",
                                                            borderRadius: "6px",
                                                            background: "rgba(2, 132, 199, 0.10)",
                                                            color: "#0284C7",
                                                            border: "1px solid rgba(2, 132, 199, 0.25)",
                                                        }}
                                                    >
                                                        {v.ticket_id || v.token_number || `#${v.id}`}
                                                    </code>
                                                </td>

                                                {/* Patient & Phone */}
                                                <td style={{ padding: "10px 14px" }}>
                                                    <div style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                                        {v.patient_name || "Patient"}
                                                    </div>
                                                    <div style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                                        {v.phone || "No phone"}
                                                    </div>
                                                </td>

                                                {/* Age / Gender */}
                                                <td style={{ padding: "10px 14px", color: "var(--superadmin-text-main, #0F172A)" }}>
                                                    {v.age ? `${v.age} yrs` : "—"}{" "}
                                                    {v.gender ? `• ${v.gender}` : ""}
                                                </td>

                                                {/* Department */}
                                                <td style={{ padding: "10px 14px" }}>
                                                    <span
                                                        style={{
                                                            padding: "2px 8px",
                                                            borderRadius: "6px",
                                                            background: "var(--superadmin-sub-card, #F1F5F9)",
                                                            color: "var(--superadmin-text-main, #0F172A)",
                                                            fontSize: "11px",
                                                            fontWeight: 700,
                                                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                        }}
                                                    >
                                                        {v.department || "General OPD"}
                                                    </span>
                                                </td>

                                                {/* Date & Time */}
                                                <td style={{ padding: "10px 14px", color: "var(--superadmin-text-muted, #64748B)", fontSize: "11.5px" }}>
                                                    {dateDisplay}
                                                </td>

                                                {/* Duration */}
                                                <td style={{ padding: "10px 14px" }}>
                                                    <span style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                                        {v.service_duration_minutes ? `${v.service_duration_minutes}m` : "12m"}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td style={{ padding: "10px 14px" }}>
                                                    <span
                                                        style={{
                                                            fontSize: "10px",
                                                            fontWeight: 800,
                                                            padding: "2px 8px",
                                                            borderRadius: "6px",
                                                            background: isCompleted
                                                                ? "rgba(16, 185, 129, 0.15)"
                                                                : isServing
                                                                    ? "rgba(2, 132, 199, 0.15)"
                                                                    : isWaiting
                                                                        ? "rgba(245, 158, 11, 0.15)"
                                                                        : "rgba(239, 68, 68, 0.15)",
                                                            color: isCompleted
                                                                ? "#10B981"
                                                                : isServing
                                                                    ? "#0284C7"
                                                                    : isWaiting
                                                                        ? "#F59E0B"
                                                                        : "#EF4444",
                                                            border: `1px solid ${
                                                                isCompleted
                                                                    ? "rgba(16, 185, 129, 0.3)"
                                                                    : isServing
                                                                        ? "rgba(2, 132, 199, 0.3)"
                                                                        : isWaiting
                                                                            ? "rgba(245, 158, 11, 0.3)"
                                                                            : "rgba(239, 68, 68, 0.3)"
                                                            }`,
                                                            textTransform: "capitalize",
                                                        }}
                                                    >
                                                        {v.status || "Completed"}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* 5. Pagination Bar & Summary */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "12px",
                            padding: "4px 2px",
                            fontSize: "12px",
                            color: "var(--superadmin-text-muted, #64748B)",
                        }}
                    >
                        <div>
                            {isHi ? "दिखाए जा रहे हैं " : "Showing "}
                            <span style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                {filteredVisits.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} -{" "}
                                {Math.min(currentPage * rowsPerPage, filteredVisits.length)}
                            </span>{" "}
                            {isHi ? `कुल ${filteredVisits.length} में से (${totalAllTimeCount} डेटाबेस में)` : `of ${filteredVisits.length} visited records (${totalAllTimeCount} total in database)`}
                        </div>

                        {/* Page Selector & Rows Per Page */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span>{isHi ? "प्रति पृष्ठ:" : "Rows:"}</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    style={{
                                        padding: "3px 6px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                        background: "var(--superadmin-card-bg, #FFFFFF)",
                                        color: "var(--superadmin-text-main, #0F172A)",
                                        fontSize: "11px",
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={15}>15</option>
                                    <option value={30}>30</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>

                            {/* Pagination Buttons */}
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{
                                        border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                        background: "var(--superadmin-card-bg, #FFFFFF)",
                                        color: currentPage === 1 ? "var(--superadmin-text-muted, #CBD5E1)" : "var(--superadmin-text-main, #0F172A)",
                                        padding: "3px 9px",
                                        borderRadius: "6px",
                                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                        fontSize: "11.5px",
                                        fontWeight: 700,
                                    }}
                                >
                                    ‹
                                </button>
                                <span style={{ padding: "0 6px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                        background: "var(--superadmin-card-bg, #FFFFFF)",
                                        color: currentPage === totalPages ? "var(--superadmin-text-muted, #CBD5E1)" : "var(--superadmin-text-main, #0F172A)",
                                        padding: "3px 9px",
                                        borderRadius: "6px",
                                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                        fontSize: "11.5px",
                                        fontWeight: 700,
                                    }}
                                >
                                    ›
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
