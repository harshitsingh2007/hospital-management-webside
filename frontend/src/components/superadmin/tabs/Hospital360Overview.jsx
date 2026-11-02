import React, { useEffect } from "react";
import {
    IconHospital,
    IconPlus,
    IconClock,
    IconStethoscope,
    IconCheckCircle,
    IconUsers,
    IconActivity,
    IconDesk,
    IconTrendingUp,
    IconAlertTriangle,
    IconFileText,
    IconZap,
    IconFlame,
    IconLightbulb,
    IconBuilding,
    IconShield,
    IconPhone,
    IconMapPin,
    IconEdit,
    IconChart,
} from "../SuperAdminIcons";
import {
    standaloneCardStyle,
    actionBtnStyle,
} from "../superAdminStyles";
import { getCategoryLabel } from "../../../utils/i18n";
import DoctorProductivitySection from "./DoctorProductivitySection";
import "../SuperAdmin.css";

export function Hospital360OverviewContent({
    selectedHospital,
    hospitals = [],
    setSelectedHospital,
    onSelectHospitalTenant,
    hospitalBranding,
    hospitalAnalytics,
    hospitalQueueSnapshot = [],
    hospitalServingTickets = [],
    hospitalDesksData = { departments: [], active_desks: 0, total_desks: 0 },
    hospitalEmployees = [],
    hospitalDepts = [],
    hospitalVisitsData = {},
    visitHistorySearchQuery = "",
    setVisitHistorySearchQuery,
    visitHistoryStatusFilter = "all",
    setVisitHistoryStatusFilter,
    showVisitHistoryTable = false,
    setShowVisitHistoryTable,
    analyticsViewTab = "all",
    setAnalyticsViewTab,
    hoveredChartHour = null,
    setHoveredChartHour,
    lastSyncedAt,
    socketConnected = null,
    deepDiveError = null,
    visitsPeriod = "today",
    setVisitsPeriod = null,
    theme = "dark",
    brandingForm = {},
    loadHospitalBrandingData,
    setActiveTab,
    setActiveBrandingTab,
    setShowAddHospitalModal,
    setShowAddDeskModal,
    setShowNABHReportModal,
    handleDownloadVisitHistory,
    computeHourlyAnalytics,
    computeDepartmentBottlenecks,
    isHi = false,
    currentHosp,
}) {
    const activeHospital = currentHosp || selectedHospital || hospitals[0];
    const currentHospResolved = activeHospital;
    const activeBranding = activeHospital?.branding || hospitalBranding || {};
    const facilityPrimary = activeBranding.primary_color || "#0284C7";
    const facilitySecondary = activeBranding.secondary_color || "#0369A1";
    const facilityAccent = activeBranding.accent_color || "#F0F9FF";
    const facilityLogo = activeBranding.logo_url || null;
    const facilityTagline = activeBranding.tagline || (isHi ? "एनएबीएच मान्यता प्राप्त • 24x7 क्लिनिकल सेवा" : "Care you can trust • NABH Accredited Facility");
    const facilityHours = activeBranding.opd_start_time && activeBranding.opd_end_time
        ? `${activeBranding.opd_start_time} - ${activeBranding.opd_end_time}`
        : (isHi ? "निर्धारित नहीं" : "Not set");
    const helpline = activeBranding.emergency_helpline || currentHospResolved?.phone || (isHi ? "निर्धारित नहीं" : "Not set");

    // Aggregate metrics & Footfall history
    const footfallSummary = hospitalVisitsData?.summary || {};
    const waitingCount = hospitalAnalytics?.waiting_count ?? hospitalQueueSnapshot.length;
    const servingCount = hospitalAnalytics?.serving_count ?? hospitalServingTickets.length;
    const completedToday = footfallSummary.today_completed ?? hospitalAnalytics?.completed_today ?? 0;
    const avgWaitActual = hospitalAnalytics?.avg_actual_wait_minutes ?? null;
    const avgWaitEstimated = hospitalAnalytics?.estimated_wait_minutes_waiting ?? hospitalAnalytics?.avg_wait_minutes ?? null;
    const activeDesksCount = hospitalDesksData.active_desks || 0;
    const totalDesksCount = hospitalDesksData.total_desks || 0;
    const doctorsCount = hospitalEmployees.filter((e) => (e.role || "").toLowerCase() === "doctor").length;
    const staffCount = hospitalEmployees.filter((e) => (e.role || "").toLowerCase() !== "doctor").length;

    const allTimePatientsVisited = footfallSummary.total_patients_visited_all_time ?? (hospitalAnalytics?.total_patients_visited_all_time || 0);
    const allTimeCompleted = footfallSummary.all_time_completed ?? 0;
    const todayFootfall = footfallSummary.today_patients_visited ?? completedToday;
    const thisMonthFootfall = footfallSummary.this_month_visits ?? 0;
    const rawVisits = hospitalVisitsData?.visits || [];


    // Flatten all desks for visual map
    const allDesks = [];
    (hospitalDesksData.departments || []).forEach((dept) => {
        (dept.desks || []).forEach((desk) => {
            allDesks.push({
                ...desk,
                dept_name: dept.name || desk.department_name || desk.dept_code,
            });
        });
    });

    const isDark360 = theme === "dark";
    const textMuted = isDark360 ? "#94A3B8" : "#64748B";

    // Check OPD Open status:
    const nowTime = new Date();
    const currH = nowTime.getHours();
    const currM = nowTime.getMinutes();
    const [opdStartH = 8, opdStartM = 0] = (activeBranding.opd_start_time || "08:00").split(":").map(Number);
    const [opdEndH = 20, opdEndM = 0] = (activeBranding.opd_end_time || "20:00").split(":").map(Number);
    const isOpdOpen = (currH > opdStartH || (currH === opdStartH && currM >= opdStartM)) &&
        (currH < opdEndH || (currH === opdEndH && currM <= opdEndM));

    // Personnel statistics
    const allPersonnel = hospitalEmployees || [];
    const docsList = allPersonnel.filter(e => {
        const role = (e.role || "").toLowerCase();
        return role === "doctor" || role === "physician" || (e.name || "").toLowerCase().startsWith("dr.");
    });
    const effectiveDocs = docsList.length > 0 ? docsList : allPersonnel;

    let docsAvailable = 0;
    let docsBusy = 0;
    let docsUnavailable = 0;

    effectiveDocs.forEach(d => {
        const isOnline = (d.status || "").toLowerCase() === "active";
        const isServingNow = (hospitalServingTickets || []).some(t =>
            t.served_by_doctor_id === d.id ||
            t.served_by_doctor_id === d.user_id ||
            t.doctor_id === d.id ||
            (t.served_by_doctor_email && d.email && t.served_by_doctor_email.toLowerCase() === d.email.toLowerCase()) ||
            (t.served_by_doctor_name && d.name && t.served_by_doctor_name.trim().toLowerCase() === d.name.trim().toLowerCase())
        );

        if (!isOnline) {
            docsUnavailable += 1;
        } else if (isServingNow) {
            docsBusy += 1;
        } else {
            docsAvailable += 1;
        }
    });

    // Queue Pressure Counts
    const countEmergency = (hospitalQueueSnapshot || []).filter(t => t.priority_level === 1 || (t.priority || "").toLowerCase() === "emergency").length;
    const countHigh = (hospitalQueueSnapshot || []).filter(t => t.priority_level === 2 || (t.priority || "").toLowerCase() === "high").length;
    const countNormal = (hospitalQueueSnapshot || []).filter(t => t.priority_level === 3 || (t.priority || "").toLowerCase() === "normal" || (!t.priority_level && (t.priority || "").toLowerCase() !== "emergency" && (t.priority || "").toLowerCase() !== "high")).length;

    // Block Bar Render Helper
    const renderTelemetryBlocks = (count, max, color, totalChars = 14) => {
        if (count <= 0) {
            return (
                <span style={{ color: textMuted, fontSize: "12px", fontFamily: "ui-monospace, monospace" }}>
                    —
                </span>
            );
        }
        const filled = max > 0 ? Math.max(1, Math.min(totalChars, Math.round((count / max) * totalChars))) : 1;
        return (
            <span style={{
                color,
                letterSpacing: "1.5px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "13px",
                fontWeight: 800,
            }}>
                {"█".repeat(filled)}
            </span>
        );
    };

    const [nowTick, setNowTick] = React.useState(Date.now());
    React.useEffect(() => {
        const timer = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const secondsSinceSync = Math.max(0, Math.floor((nowTick - (lastSyncedAt ? new Date(lastSyncedAt).getTime() : nowTick)) / 1000));
    const syncLabel = secondsSinceSync <= 2 ? (isHi ? "अभी-अभी" : "just now") : (isHi ? `${secondsSinceSync}s पहले` : `${secondsSinceSync}s ago`);

    // Real-Time Telemetry Graph States
    const [chartMetricFilter, setChartMetricFilter] = React.useState("all");
    const [localTelemetryPeriod, setLocalTelemetryPeriod] = React.useState(visitsPeriod || "today");
    const telemetryPeriod = visitsPeriod || localTelemetryPeriod;
    const handlePeriodChange = (newP) => {
        setLocalTelemetryPeriod(newP);
        if (setVisitsPeriod) setVisitsPeriod(newP);
    };

    // Helper functions for silky smooth cubic Bézier splines
    const getSmoothSvgPath = (points) => {
        if (!points || points.length === 0) return "";
        if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }
        return d;
    };

    const getSmoothAreaPath = (points, bottomY = 155) => {
        if (!points || points.length === 0) return "";
        const linePath = getSmoothSvgPath(points);
        const last = points[points.length - 1];
        const first = points[0];
        return `${linePath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
    };

    // Filtered visits based on selected telemetry period (strictly genuine records)
    const filteredPeriodVisits = React.useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        return (rawVisits || []).filter((v) => {
            const ts = v.created_at || v.timestamp || v.visit_time;
            let vDateStr = v.queue_date;
            if (ts) {
                const d = new Date(ts);
                if (!isNaN(d.getTime())) {
                    vDateStr = d.toISOString().split("T")[0];
                }
            }

            if (telemetryPeriod === "today") {
                return vDateStr === todayStr;
            }
            if (telemetryPeriod === "yesterday") {
                return vDateStr === yesterdayStr;
            }
            if (telemetryPeriod === "week") {
                if (ts) {
                    const d = new Date(ts);
                    return !isNaN(d.getTime()) && d >= weekAgo;
                }
                return true;
            }
            if (telemetryPeriod === "month") {
                if (ts) {
                    const d = new Date(ts);
                    return !isNaN(d.getTime()) && d >= monthStart;
                }
                return true;
            }
            return true;
        });
    }, [rawVisits, telemetryPeriod]);

    // Analytics calculations (strictly period-sensitive, no fallback to past visits if 0 today)
    const activeVisitsForHourly = filteredPeriodVisits;
    const hourlyAnalytics = computeHourlyAnalytics
        ? computeHourlyAnalytics(
            activeVisitsForHourly,
            telemetryPeriod === "today" ? hospitalQueueSnapshot : [],
            selectedHospital?.branding_json || selectedHospital?.branding
        )
        : { hourlyData: [], maxVolume: 0, peakHourLabel: "No Activity", peakAvgWait: 0, totalVisits: 0 };
    const bottleneckAnalytics = computeDepartmentBottlenecks ? computeDepartmentBottlenecks(hospitalDepts, hospitalQueueSnapshot, activeVisitsForHourly) : [];


    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* Live Telemetry Error Warning Banner */}
            {deepDiveError && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1.5px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: "14px",
                        padding: "12px 18px",
                        color: "#EF4444",
                        fontSize: "13px",
                        fontWeight: 700,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "16px" }}>⚠️</span>
                        <span>{typeof deepDiveError === "string" ? deepDiveError : deepDiveError.message}</span>
                    </div>
                    <span style={{ fontSize: "11px", opacity: 0.85, fontFamily: "monospace" }}>
                        {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : ""}
                    </span>
                </div>
            )}

            {/* 1. EXECUTIVE FACILITY IDENTITY & CONTROL BANNER */}
            <div
                className="overview-facility-banner"
                style={{
                    background: `linear-gradient(135deg, var(--superadmin-card-bg, #FFFFFF) 0%, ${facilityAccent} 100%)`,
                    borderRadius: "24px",
                    border: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
                    padding: "24px 28px",
                    boxShadow: "var(--superadmin-card-shadow, 0 4px 20px -2px rgba(2, 132, 199, 0.06))",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "260px" }}>
                        {/* Logo or Medical Icon */}
                        <div
                            style={{
                                width: "64px",
                                height: "64px",
                                borderRadius: "18px",
                                background: "var(--superadmin-card-bg, #FFFFFF)",
                                border: `1.5px solid ${facilityPrimary}30`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
                                flexShrink: 0,
                            }}
                        >
                            {facilityLogo ? (
                                <img
                                    src={facilityLogo}
                                    alt={currentHosp.name}
                                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: "4px" }}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.style.display = "none";
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        background: `linear-gradient(135deg, ${facilityPrimary} 0%, ${facilitySecondary} 100%)`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#FFFFFF",
                                    }}
                                >
                                    <IconHospital size={30} />
                                </div>
                            )}
                        </div>

                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                <h1
                                    style={{
                                        margin: 0,
                                        fontSize: "22px",
                                        color: "var(--superadmin-text-main, #0F172A)",
                                        fontWeight: 800,
                                        letterSpacing: "-0.4px",
                                    }}
                                >
                                    {currentHosp.name}
                                </h1>
                                <span
                                    style={{
                                        fontSize: "11.5px",
                                        fontWeight: 700,
                                        padding: "3px 9px",
                                        borderRadius: "20px",
                                        background: currentHosp.status === "active" ? "#DCFCE7" : "var(--superadmin-sub-card, #F1F5F9)",
                                        color: currentHosp.status === "active" ? "#15803D" : "var(--superadmin-text-muted, #64748B)",
                                        border: currentHosp.status === "active" ? "1px solid #BBF7D0" : "1px solid var(--superadmin-card-border, #E2E8F0)",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                    }}
                                >
                                    <span
                                        style={{
                                            width: "6px",
                                            height: "6px",
                                            borderRadius: "50%",
                                            background: currentHosp.status === "active" ? "#16A34A" : "#94A3B8",
                                        }}
                                    />
                                    {currentHosp.status === "active" ? (isHi ? "सक्रिय शाखा" : "Active Facility") : (isHi ? "निष्क्रिय" : "Inactive")}
                                </span>

                                <span
                                    style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        padding: "2px 8px",
                                        borderRadius: "6px",
                                        background: isOpdOpen ? "#DCFCE7" : "#FEF3C7",
                                        color: isOpdOpen ? "#15803D" : "#B45309",
                                        border: isOpdOpen ? "1px solid #BBF7D0" : "1px solid #FDE68A",
                                    }}
                                >
                                    {isOpdOpen ? (isHi ? "ओपीडी खुला है" : "OPD Open") : (isHi ? "ओपीडी बंद है" : "OPD Closed")}
                                </span>
                            </div>
                            <p style={{ margin: "4px 0 0", color: "var(--superadmin-text-sub, #475569)", fontSize: "13px", fontWeight: 500 }}>
                                {facilityTagline}
                            </p>
                        </div>
                    </div>

                    {/* Facility Controls: Switcher, Branding, Edit Hospital */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                background: "var(--superadmin-card-bg, #FFFFFF)",
                                padding: "6px 12px",
                                borderRadius: "12px",
                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                            }}
                        >
                            <IconHospital size={15} color={facilityPrimary} />
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--superadmin-text-sub, #475569)" }}>
                                {isHi ? "अस्पताल:" : "Facility:"}
                            </span>
                            <select
                                value={currentHosp.hospital_code}
                                onChange={(e) => {
                                    const found = hospitals.find((h) => h.hospital_code === e.target.value);
                                    if (found) {
                                        if (setSelectedHospital) setSelectedHospital(found);
                                        if (onSelectHospitalTenant) onSelectHospitalTenant(found.hospital_code);
                                    }
                                }}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "var(--superadmin-text-main, #0F172A)",
                                    cursor: "pointer",
                                    outline: "none",
                                    paddingRight: "6px",
                                }}
                            >
                                {hospitals.map((h) => (
                                    <option key={h.hospital_code} value={h.hospital_code}>
                                        {h.name} ({h.hospital_code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (currentHosp) {
                                    if (setSelectedHospital) setSelectedHospital(currentHosp);
                                    if (loadHospitalBrandingData) loadHospitalBrandingData(currentHosp);
                                }
                                if (setActiveBrandingTab) setActiveBrandingTab("profile");
                                if (setActiveTab) setActiveTab("branding");
                                window.scrollTo({ top: 380, behavior: "smooth" });
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "8px 14px",
                                borderRadius: "12px",
                                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                color: "#FFFFFF",
                                border: "none",
                                fontSize: "12.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                            }}
                            title={isHi ? "अस्पताल कस्टमाइज़ेशन स्टूडियो पर जाएं" : "Go to Hospital Customization Studio"}
                        >
                            <IconEdit size={14} color="#FFFFFF" />
                            <span>{isHi ? "कस्टमाइज़ेशन स्टूडियो" : "Customization Studio"}</span>
                        </button>
                    </div>
                </div>

                {/* Badges / Meta Pills Bar */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        flexWrap: "wrap",
                        paddingTop: "14px",
                        borderTop: "1px solid var(--superadmin-card-border, rgba(226, 232, 240, 0.8))",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--superadmin-text-sub, #475569)" }}>
                        <IconPhone size={14} color={facilityPrimary} />
                        <span style={{ fontWeight: 600 }}>{helpline}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--superadmin-text-sub, #475569)" }}>
                        <IconClock size={14} color={facilityPrimary} />
                        <span style={{ fontWeight: 600 }}>{isHi ? `ओपीडी समय: ${facilityHours}` : `OPD Hours: ${facilityHours}`}</span>
                    </div>

                    {currentHosp.address && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--superadmin-text-sub, #475569)" }}>
                            <IconMapPin size={14} color={facilityPrimary} />
                            <span style={{ fontWeight: 500 }}>{currentHosp.address}</span>
                        </div>
                    )}

                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        {/* Live Socket Connection Badge & Sync Counter */}
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "3px 9px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: 800,
                                background: socketConnected === true ? "rgba(16, 185, 129, 0.12)" : socketConnected === false ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                                border: socketConnected === true ? "1px solid rgba(16, 185, 129, 0.3)" : socketConnected === false ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                                color: socketConnected === true ? "#10B981" : socketConnected === false ? "#EF4444" : "#F59E0B",
                            }}
                            title={socketConnected === true ? "WebSocket connected to real-time telemetry stream" : socketConnected === false ? "Offline. Polling every 15m" : "Reconnecting to live telemetry stream"}
                        >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: socketConnected === true ? "#10B981" : socketConnected === false ? "#EF4444" : "#F59E0B" }} />
                            <span>
                                {socketConnected === true
                                    ? (isHi ? "लाइव" : "Live")
                                    : socketConnected === false
                                    ? (isHi ? "ऑफ़लाइन - हर 15m में रीफ़्रेश" : "Offline – refreshing every 15m")
                                    : (isHi ? "पुनः कनेक्ट हो रहा है…" : "Reconnecting…")}
                            </span>
                            <span style={{ opacity: 0.7, fontWeight: 600, fontSize: "10px", marginLeft: "2px" }}>
                                • {syncLabel}
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)" }}>
                                {isHi ? "अस्पताल कोड:" : "Hospital Code:"}
                            </span>
                            <code
                                style={{
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    padding: "2px 7px",
                                    background: "var(--superadmin-sub-card, #E2E8F0)",
                                    borderRadius: "6px",
                                    color: "var(--superadmin-text-main, #334155)",
                                }}
                            >
                                {currentHosp.hospital_code}
                            </code>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. REAL-TIME CLINICAL KPI TELEMETRY METRICS STRIP (6 HIGH-IMPACT CARDS) */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "14px",
                }}
            >
                {/* KPI 1: Waiting In Queue */}
                <div className="overview-kpi-card" style={{ border: "1.5px solid #FEF3C7" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#D97706" }}>
                            {isHi ? "प्रतीक्षारत मरीज" : "Waiting in Queue"}
                        </span>
                        <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B" }}>
                            <IconClock size={16} />
                        </div>
                    </div>
                    <div style={{ fontSize: "30px", fontWeight: 900, color: "#F59E0B", letterSpacing: "-0.5px" }}>
                        {waitingCount}
                    </div>
                    <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #78350F)", marginTop: "4px", fontWeight: 600 }}>
                        {isHi ? "ओपीडी कतार में सक्रिय" : "Live in waiting lounge"}
                    </span>
                </div>

                {/* KPI 2: Serving Currently */}
                <div className="overview-kpi-card" style={{ border: "1.5px solid #BAE6FD" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0284C7" }}>
                            {isHi ? "परामर्श जारी" : "In Consultation"}
                        </span>
                        <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(2, 132, 199, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284C7" }}>
                            <IconStethoscope size={16} />
                        </div>
                    </div>
                    <div style={{ fontSize: "30px", fontWeight: 900, color: "#0284C7", letterSpacing: "-0.5px" }}>
                        {servingCount}
                    </div>
                    <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #075985)", marginTop: "4px", fontWeight: 600 }}>
                        {isHi ? "डॉक्टर के साथ सक्रिय" : "At active counters right now"}
                    </span>
                </div>

                {/* KPI 3: Completed Today */}
                <div className="overview-kpi-card" style={{ border: "1.5px solid #D1FAE5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#059669" }}>
                            {isHi ? "आज पूर्ण परामर्श" : "Treated Today"}
                        </span>
                        <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981" }}>
                            <IconCheckCircle size={16} />
                        </div>
                    </div>
                    <div style={{ fontSize: "30px", fontWeight: 900, color: "#10B981", letterSpacing: "-0.5px" }}>
                        {completedToday}
                    </div>
                    <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #064E3B)", marginTop: "4px", fontWeight: 600 }}>
                        {isHi ? "आज के सफल डिस्चार्ज" : "Completed patient visits"}
                    </span>
                </div>

                {/* KPI 4: Total Patients Visited Till Now */}
                <div className="overview-kpi-card" style={{ border: "1.5px solid #C7D2FE" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#6366F1" }}>
                            {isHi ? "अब तक कुल मरीज" : "Visited Till Now"}
                        </span>
                        <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366F1" }}>
                            <IconUsers size={16} />
                        </div>
                    </div>
                    <div style={{ fontSize: "30px", fontWeight: 900, color: "#818CF8", letterSpacing: "-0.5px" }}>
                        {allTimePatientsVisited}
                    </div>
                    <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #3730A3)", marginTop: "4px", fontWeight: 600 }}>
                        {isHi ? `आज: ${todayFootfall} • माह: ${thisMonthFootfall}` : `Today: ${todayFootfall} • Month: ${thisMonthFootfall}`}
                    </span>
                </div>

                {/* KPI 5: Avg Consultation Wait */}
                <div className="overview-kpi-card" style={{ border: "1.5px solid #E0E7FF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#4F46E5" }}>
                            {isHi ? "औसत प्रतीक्षा समय" : "Avg. Wait Time"}
                        </span>
                        <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(79, 70, 229, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366F1" }}>
                            <IconActivity size={16} />
                        </div>
                    </div>
                    <div style={{ fontSize: "30px", fontWeight: 900, color: "#6366F1", letterSpacing: "-0.5px" }}>
                        {avgWaitActual !== null ? (
                            <>
                                {Math.round(Number(avgWaitActual) * 10) / 10} <span style={{ fontSize: "14px", fontWeight: 700 }}>min</span>
                            </>
                        ) : avgWaitEstimated !== null ? (
                            <>
                                ~{Math.round(Number(avgWaitEstimated) * 10) / 10} <span style={{ fontSize: "14px", fontWeight: 700 }}>min</span>
                            </>
                        ) : (
                            "—"
                        )}
                    </div>
                    <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #3730A3)", marginTop: "4px", fontWeight: 600 }}>
                        {avgWaitActual !== null
                            ? (isHi ? "वास्तविक प्रतीक्षा (आज का औसत)" : "Actual average wait today")
                            : avgWaitEstimated !== null
                            ? (isHi ? "अनुमानित प्रतीक्षा (कतार मॉडल)" : "Estimated wait (waiting queue)")
                            : (isHi ? "कोई डेटा नहीं" : "No wait data yet")}
                    </span>
                </div>

                {/* KPI 6: Active Desks / Counters */}
                <div className="overview-kpi-card" style={{ border: "1.5px solid #BBF7D0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#16A34A" }}>
                            {isHi ? "सक्रिय डेस्क" : "Active Desks"}
                        </span>
                        <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(34, 197, 94, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#16A34A" }}>
                            <IconBuilding size={16} />
                        </div>
                    </div>
                    <div style={{ fontSize: "30px", fontWeight: 900, color: "#16A34A", letterSpacing: "-0.5px" }}>
                        {activeDesksCount} <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)" }}>/ {totalDesksCount}</span>
                    </div>
                    <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #14532D)", marginTop: "4px", fontWeight: 600 }}>
                        {isHi ? "ड्यूटी पर कार्यरत काउंटर" : "Staffed on duty right now"}
                    </span>
                </div>

            </div>

            {/* 3. CONSOLIDATED REAL-TIME ANALYTICS, HOURLY HEATMAP & BOTTLENECK ANALYZER */}
            <div style={standaloneCardStyle}>
                {/* Section Header with Quick Actions & NABH Report Trigger */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--superadmin-card-border, #E2E8F0)", paddingBottom: "14px" }}>
                    <div>
                        <h2 style={{ margin: "0 0 4px 0", fontSize: "19px", color: "var(--superadmin-text-main, #0F172A)", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                            <IconChart size={18} color="#0284C7" />
                            <span>{isHi ? "रीयल-टाइम क्लिनिकल एनालिटिक्स एवं बॉटलनेक इंटेलिजेंस" : "Unified Visual Analytics & Department Bottleneck Radar"}</span>
                        </h2>
                        <p style={{ margin: 0, color: "var(--superadmin-text-muted, #64748B)", fontSize: "12.5px" }}>
                            {isHi ? "प्रति घंटा मरीज आवक, औसत प्रतीक्षा समय, विभागवार बॉटलनेक विश्लेषण और एनएबीएच रिपोर्टिंग।" : "Hourly footfall velocity, wait-time vs. consultation timeline, department bottlenecks, and NABH audit reporting."}
                        </p>
                    </div>

                    {/* Top Controls: View Switcher + 1-Click NABH Executive Report Button */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        {/* Sub-view switcher pills */}
                        <div style={{ display: "inline-flex", background: "var(--superadmin-sub-card, #1E293B)", padding: "3px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #334155)" }}>
                            {[
                                { id: "all", label: isHi ? "सभी दृश्य" : "360° All", icon: IconZap },
                                { id: "hourly", label: isHi ? "प्रति घंटा हीटमैप" : "Hourly Heatmap", icon: IconTrendingUp },
                                { id: "bottleneck", label: isHi ? "बॉटलनेक विश्लेषक" : "Bottleneck Radar", icon: IconAlertTriangle },
                                { id: "clinicians", label: isHi ? "डॉक्टर उत्पादकता" : "Clinician Telemetry", icon: IconStethoscope },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setAnalyticsViewTab && setAnalyticsViewTab(tab.id)}
                                    style={{
                                        padding: "5px 12px",
                                        borderRadius: "7px",
                                        border: "none",
                                        fontSize: "11.5px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        background: analyticsViewTab === tab.id ? "#0284C7" : "transparent",
                                        color: analyticsViewTab === tab.id ? "#FFFFFF" : "var(--superadmin-text-muted, #94A3B8)",
                                        transition: "all 0.15s ease",
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* 1-Click Executive NABH Daily Report Modal Button */}
                        <button
                            type="button"
                            onClick={() => setShowNABHReportModal && setShowNABHReportModal(true)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "7px",
                                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                color: "#FFFFFF",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                padding: "7px 14px",
                                borderRadius: "10px",
                                fontSize: "12px",
                                fontWeight: 800,
                                cursor: "pointer",
                                boxShadow: "0 2px 10px rgba(2, 132, 199, 0.35)",
                                transition: "all 0.15s ease",
                            }}
                        >
                            <IconFileText size={15} />
                            <span>{isHi ? "एनएबीएच दैनिक रिपोर्ट (PDF/Excel)" : "NABH Executive Report (PDF/Excel)"}</span>
                        </button>
                    </div>
                </div>

                {/* FEATURE 1: REAL-TIME CLINICAL TELEMETRY STREAM & LIVE HOURLY RADAR (HIGH-IMPACT INTERACTIVE SVG) */}
                {(analyticsViewTab === "all" || analyticsViewTab === "hourly") && (
                    <div
                        className="overview-sub-panel"
                        style={{
                            marginBottom: "22px",
                            padding: "22px 24px",
                            borderRadius: "20px",
                            border: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
                            background: "var(--superadmin-card-bg, #FFFFFF)",
                            boxShadow: "0 4px 20px -2px rgba(2, 132, 199, 0.06)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                        }}
                    >
                        {/* 1. Header Bar: Title, Live Telemetry Beacon, Stream Filter Pills & Rush Badge */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", borderBottom: "1px solid var(--superadmin-card-border, #E2E8F0)", paddingBottom: "14px" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "17px", fontWeight: 900, color: "var(--superadmin-text-main, #0F172A)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                                        <IconTrendingUp size={18} color="#0284C7" />
                                        <span>{isHi ? "रीयल-टाइम ओपीडी क्लिनिकल टेलीमेट्री व प्रतीक्षा हीटमैप" : "Real-Time Clinical Telemetry & Patient Flow Heatmap"}</span>
                                    </span>

                                    {/* Dynamic Hospital Operating Timing Badge */}
                                    {hourlyAnalytics.operatingHoursLabel && (
                                        <div
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "5px",
                                                background: "rgba(2, 132, 199, 0.10)",
                                                border: "1px solid rgba(2, 132, 199, 0.3)",
                                                padding: "3px 10px",
                                                borderRadius: "20px",
                                                color: "#0284C7",
                                                fontSize: "11px",
                                                fontWeight: 800,
                                                letterSpacing: "0.2px",
                                            }}
                                        >
                                            <IconClock size={12} color="#0284C7" />
                                            <span>{isHi ? `ओपीडी समय: ${hourlyAnalytics.operatingHoursLabel}` : `OPD Hours: ${hourlyAnalytics.operatingHoursLabel}`}</span>
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: "12px", color: "var(--superadmin-text-muted, #64748B)", marginTop: "2px", display: "block" }}>
                                    {isHi
                                        ? "लाइव मरीज आवक (कर्व व बार्स), एनएबीएच 15-मिनट बेंचमार्क प्रतीक्षा समय (गोल्ड) एवं डॉक्टर परामर्श गति (एमराल्ड)"
                                        : "Continuous patient inflow velocity, NABH 15-min benchmark turnaround times (Gold spline), and consultation speed (Emerald)"}
                                </span>
                            </div>

                            {/* Controls: Period Selector + Stream metric toggle pills + Peak Window badge */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                {/* 1. Period Filter (Today / Yesterday / 7 Days / Month) */}
                                <div style={{ display: "inline-flex", background: "var(--superadmin-sub-card, #F1F5F9)", padding: "3px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #CBD5E1)" }}>
                                    {[
                                        { id: "today", label: isHi ? "आज (लाइव)" : "Today (Live)" },
                                        { id: "yesterday", label: isHi ? "कल" : "Yesterday" },
                                        { id: "week", label: isHi ? "7 दिन" : "7 Days" },
                                        { id: "month", label: isHi ? "महीना" : "Month" },
                                    ].map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => handlePeriodChange(p.id)}
                                            style={{
                                                padding: "4px 9px",
                                                borderRadius: "7px",
                                                border: "none",
                                                fontSize: "10.5px",
                                                fontWeight: 800,
                                                cursor: "pointer",
                                                background: telemetryPeriod === p.id ? "#0284C7" : "transparent",
                                                color: telemetryPeriod === p.id ? "#FFFFFF" : "var(--superadmin-text-muted, #64748B)",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                {/* 2. Stream metric toggle pills */}
                                <div style={{ display: "inline-flex", background: "var(--superadmin-sub-card, #F1F5F9)", padding: "3px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #CBD5E1)" }}>
                                    {[
                                        { id: "all", label: isHi ? "360° सभी" : "All Streams" },
                                        { id: "footfall", label: isHi ? "मरीज संख्या" : "Footfall Inflow" },
                                        { id: "wait", label: isHi ? "प्रतीक्षा समय" : "Avg Wait (TAT)" },
                                        { id: "consult", label: isHi ? "परामर्श अवधि" : "Consult Speed" },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setChartMetricFilter(m.id)}
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: "7px",
                                                border: "none",
                                                fontSize: "11px",
                                                fontWeight: 800,
                                                cursor: "pointer",
                                                background: chartMetricFilter === m.id ? "#0284C7" : "transparent",
                                                color: chartMetricFilter === m.id ? "#FFFFFF" : "var(--superadmin-text-muted, #64748B)",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>

                                {hourlyAnalytics.peakVolume > 0 && (
                                    <div
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            background: "rgba(245, 158, 11, 0.12)",
                                            border: "1px solid rgba(245, 158, 11, 0.35)",
                                            padding: "4px 12px",
                                            borderRadius: "20px",
                                            color: "#F59E0B",
                                            fontSize: "11px",
                                            fontWeight: 800,
                                        }}
                                    >
                                        <IconFlame size={13} color="#F59E0B" />
                                        <span>{isHi ? `शिखर: ${hourlyAnalytics.peakHourLabel} (~${hourlyAnalytics.peakAvgWait}m)` : `Peak: ${hourlyAnalytics.peakHourLabel} (~${hourlyAnalytics.peakAvgWait}m wait)`}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Interactive Telemetry Snapshot Banner (Hovered Hour or Current Live Hour) */}
                        {(() => {
                            const activeIdx = hoveredChartHour !== null
                                ? hoveredChartHour
                                : (hourlyAnalytics.currentHourIdx != null ? Math.max(0, Math.min((hourlyAnalytics.hourlyData?.length || 1) - 1, hourlyAnalytics.currentHourIdx)) : 0);
                            const activeData = hourlyAnalytics.hourlyData[activeIdx] || hourlyAnalytics.hourlyData[0] || {};
                            const hasPatientsInSlot = (activeData.count || 0) > 0;

                            return (
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                        gap: "10px",
                                        padding: "10px 14px",
                                        background: "var(--superadmin-sub-card, #F8FAFC)",
                                        borderRadius: "14px",
                                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                                    }}
                                >
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)", textTransform: "uppercase" }}>
                                            {isHi ? "सक्रिय समय स्लॉट" : "Active Time Slot"}
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ fontSize: "14px", fontWeight: 900, color: "var(--superadmin-text-main, #0F172A)" }}>
                                                {activeData.hour || "10:00"} ({activeData.label || "10 AM"})
                                            </span>
                                            {activeData.isCurrent && (
                                                <span style={{ background: "#0284C7", color: "#FFFFFF", fontSize: "9.5px", fontWeight: 800, padding: "1px 6px", borderRadius: "4px" }}>
                                                    NOW
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: "10.5px", color: "#0284C7", fontWeight: 600 }}>
                                            {activeData.phase || (isHi ? "ओपीडी परामर्श सत्र" : "Clinical OPD Intake")}
                                        </span>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)", textTransform: "uppercase" }}>
                                            {isHi ? "मरीज आवागमन (थ्रूपुट)" : "Patient Inflow (Throughput)"}
                                        </span>
                                        <div style={{ fontSize: "15px", fontWeight: 900, color: "#0284C7" }}>
                                            {activeData.count || 0} <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)" }}>patients/hr</span>
                                        </div>
                                        <span style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                            {hasPatientsInSlot
                                                ? (activeData.liveQueue ? `Live in queue: ${activeData.liveQueue}` : "Scheduled flow optimal")
                                                : (isHi ? "इस स्लॉट में कोई मरीज नहीं" : "No patient inflow in this slot")}
                                        </span>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)", textTransform: "uppercase" }}>
                                            {isHi ? "औसत प्रतीक्षा समय (TAT)" : "Turnaround Time (Avg Wait)"}
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ fontSize: "15px", fontWeight: 900, color: !hasPatientsInSlot ? "#10B981" : (activeData.avgWait || 0) > 20 ? "#EF4444" : (activeData.avgWait || 0) > 15 ? "#F59E0B" : "#10B981" }}>
                                                {hasPatientsInSlot ? `~${activeData.avgWait} min` : "0 min"}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: "9.5px",
                                                    fontWeight: 800,
                                                    padding: "1px 6px",
                                                    borderRadius: "4px",
                                                    background: (!hasPatientsInSlot || (activeData.avgWait || 0) <= 15) ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                                                    color: (!hasPatientsInSlot || (activeData.avgWait || 0) <= 15) ? "#10B981" : "#F59E0B",
                                                }}
                                            >
                                                {!hasPatientsInSlot ? (isHi ? "शून्य प्रतीक्षा" : "No Wait") : ((activeData.avgWait || 0) <= 15 ? "NABH Target Passed" : "Surge Threshold")}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                            Benchmark compliance: {!hasPatientsInSlot || activeData.compliancePct === null || activeData.compliancePct === undefined ? "—" : `${activeData.compliancePct}%`}
                                        </span>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)", textTransform: "uppercase" }}>
                                            {isHi ? "डॉक्टर परामर्श अवधि" : "Consultation Velocity"}
                                        </span>
                                        <div style={{ fontSize: "15px", fontWeight: 900, color: "#10B981" }}>
                                            {hasPatientsInSlot ? `~${activeData.avgConsult} min / consult` : "0 min"}
                                        </div>
                                        <span style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                            {hasPatientsInSlot ? "Clinician capacity active" : (isHi ? "कोई सक्रिय परामर्श नहीं" : "No active consultations")}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 3. High-Definition Interactive SVG Graph Canvas */}
                        <div
                            style={{
                                position: "relative",
                                width: "100%",
                                height: "230px",
                                background: isDark360 ? "#0C1322" : "#F8FAFC",
                                borderRadius: "16px",
                                padding: "16px 12px 10px 12px",
                                border: `1.5px solid ${isDark360 ? "#1E293B" : "#E2E8F0"}`,
                                boxSizing: "border-box",
                                overflow: "hidden",
                            }}
                        >
                            <svg viewBox="0 0 740 195" width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                                <defs>
                                    {/* Patient Footfall Area Gradient */}
                                    <linearGradient id="telemetryFootfallArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#38BDF8" stopOpacity={isDark360 ? "0.45" : "0.3"} />
                                        <stop offset="60%" stopColor="#0284C7" stopOpacity="0.12" />
                                        <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
                                    </linearGradient>

                                    {/* Bar Column Standard Gradient */}
                                    <linearGradient id="telemetryBarColGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#38BDF8" stopOpacity={isDark360 ? "0.85" : "0.75"} />
                                        <stop offset="100%" stopColor="#0284C7" stopOpacity="0.25" />
                                    </linearGradient>

                                    {/* Active Live Bar Column Gradient */}
                                    <linearGradient id="telemetryBarActiveGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#67E8F9" stopOpacity="1" />
                                        <stop offset="50%" stopColor="#0EA5E9" stopOpacity="0.9" />
                                        <stop offset="100%" stopColor="#0284C7" stopOpacity="0.4" />
                                    </linearGradient>

                                    {/* Wait Time Glowing Line Shadow Filter */}
                                    <filter id="neonGlowWait" x="-20%" y="-20%" width="140%" height="140%">
                                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F59E0B" floodOpacity="0.5" />
                                    </filter>

                                    {/* Footfall Glowing Line Shadow Filter */}
                                    <filter id="neonGlowFootfall" x="-20%" y="-20%" width="140%" height="140%">
                                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0284C7" floodOpacity="0.4" />
                                    </filter>
                                </defs>

                                {/* Y-Axis Horizontal Grid & Scale Guidelines */}
                                {[
                                    { y: 25, labelL: "30+", labelR: "30m" },
                                    { y: 65, labelL: "20", labelR: "20m" },
                                    { y: 105, labelL: "10", labelR: "10m" },
                                    { y: 155, labelL: "0", labelR: "0m" },
                                ].map((grid) => (
                                    <g key={grid.y}>
                                        <line
                                            x1="44"
                                            y1={grid.y}
                                            x2="696"
                                            y2={grid.y}
                                            stroke={isDark360 ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.2)"}
                                            strokeDasharray="3 3"
                                        />
                                        <text x="36" y={grid.y + 4} fill={textMuted} fontSize="9" fontWeight="700" textAnchor="end">
                                            {grid.labelL}
                                        </text>
                                        <text x="704" y={grid.y + 4} fill={textMuted} fontSize="9" fontWeight="700" textAnchor="start">
                                            {grid.labelR}
                                        </text>
                                    </g>
                                ))}

                                {/* NABH 15-Minute Benchmark Target Reference Line */}
                                <line
                                    x1="44"
                                    y1="85"
                                    x2="696"
                                    y2="85"
                                    stroke="rgba(245, 158, 11, 0.45)"
                                    strokeDasharray="5 3"
                                    strokeWidth="1.2"
                                />
                                <text x="704" y="88" fill="#F59E0B" fontSize="8.5" fontWeight="800">
                                    NABH (15m)
                                </text>

                                {/* Telemetry Data Points & Curvilinear Projections */}
                                {(() => {
                                    const totalSlots = hourlyAnalytics.hourlyData.length || 12;
                                    const slotW = (696 - 44) / totalSlots;
                                    const maxVol = Math.max(hourlyAnalytics.maxVolume, 10);
                                    const baselineY = 155;

                                    // Build coordinate arrays for smooth splines
                                    const footfallPoints = hourlyAnalytics.hourlyData.map((d, i) => {
                                        const x = 44 + i * slotW + slotW / 2;
                                        const y = Math.max(25, baselineY - (d.count / maxVol) * 125);
                                        return { x, y, ...d };
                                    });

                                    const waitPoints = hourlyAnalytics.hourlyData.map((d, i) => {
                                        const x = 44 + i * slotW + slotW / 2;
                                        const y = Math.max(25, baselineY - (Math.min(d.avgWait, 32) / 32) * 125);
                                        return { x, y, ...d };
                                    });

                                    const consultPoints = hourlyAnalytics.hourlyData.map((d, i) => {
                                        const x = 44 + i * slotW + slotW / 2;
                                        const y = Math.max(25, baselineY - (Math.min(d.avgConsult, 24) / 24) * 125);
                                        return { x, y, ...d };
                                    });

                                    // Generate silky smooth Bézier curves
                                    const footfallSplinePath = getSmoothSvgPath(footfallPoints);
                                    const footfallAreaPath = getSmoothAreaPath(footfallPoints, baselineY);
                                    const waitSplinePath = getSmoothSvgPath(waitPoints);
                                    const consultSplinePath = getSmoothSvgPath(consultPoints);

                                    // Live Scanline Position
                                    const activeHourIdx = hourlyAnalytics.currentHourIdx != null ? Math.max(0, Math.min(totalSlots - 1, hourlyAnalytics.currentHourIdx)) : 0;
                                    const minuteFrac = hourlyAnalytics.minuteFraction ?? (new Date().getMinutes() / 60);
                                    const isLiveActive = hourlyAnalytics.isCurrentlyActive !== false;
                                    const liveScanX = Math.min(694, Math.max(44, 44 + activeHourIdx * slotW + (isLiveActive ? slotW * minuteFrac : slotW / 2)));

                                    return (
                                        <React.Fragment>
                                            {/* Layer 1: Translucent Footfall Area Gradient (if not isolated to wait/consult) */}
                                            {(chartMetricFilter === "all" || chartMetricFilter === "footfall") && (
                                                <path d={footfallAreaPath} fill="url(#telemetryFootfallArea)" />
                                            )}

                                            {/* Layer 2: Glowing Column Bars */}
                                            {(chartMetricFilter === "all" || chartMetricFilter === "footfall") &&
                                                hourlyAnalytics.hourlyData.map((d, i) => {
                                                    const barW = Math.max(8, Math.min(22, slotW * 0.46));
                                                    const x = 44 + i * slotW + (slotW - barW) / 2;
                                                    const barH = d.count > 0 ? Math.max(6, (d.count / maxVol) * 125) : 0;
                                                    const y = baselineY - barH;
                                                    const isHovered = hoveredChartHour === i;
                                                    const isCurrent = d.isCurrent;

                                                    return (
                                                        <g key={`bar-${i}`} style={{ cursor: "pointer" }}>
                                                            {barH > 0 && (
                                                                <rect
                                                                    x={x}
                                                                    y={y}
                                                                    width={barW}
                                                                    height={barH}
                                                                    rx={barW > 12 ? "4" : "2"}
                                                                    fill={isCurrent ? "url(#telemetryBarActiveGrad)" : "url(#telemetryBarColGrad)"}
                                                                    stroke={isHovered ? "#38BDF8" : isCurrent ? "#38BDF8" : "none"}
                                                                    strokeWidth={isHovered ? "1.5" : isCurrent ? "1.2" : "0"}
                                                                    style={isCurrent ? { animation: "livePulseBar 2.5s ease-in-out infinite" } : {}}
                                                                />
                                                            )}
                                                            {/* Count label above bar (only if > 0 or hovered) */}
                                                            {(d.count > 0 || isHovered) && (
                                                                <text
                                                                    x={x + barW / 2}
                                                                    y={y - 4}
                                                                    fill={isHovered ? "#38BDF8" : isCurrent ? "#38BDF8" : isDark360 ? "#94A3B8" : "#64748B"}
                                                                    fontSize={totalSlots > 18 ? "7.5" : "9"}
                                                                    fontWeight="800"
                                                                    textAnchor="middle"
                                                                >
                                                                    {d.count}
                                                                </text>
                                                            )}
                                                        </g>
                                                    );
                                                })}

                                            {/* Layer 3: Doctor Consultation Speed Spline (Emerald) */}
                                            {hourlyAnalytics.totalVisits > 0 && (chartMetricFilter === "all" || chartMetricFilter === "consult") && (
                                                <path
                                                    d={consultSplinePath}
                                                    fill="none"
                                                    stroke="#10B981"
                                                    strokeWidth="2.2"
                                                    strokeDasharray="4 3"
                                                />
                                            )}

                                            {/* Layer 4: Patient Footfall Spline (Cyan) */}
                                            {(chartMetricFilter === "all" || chartMetricFilter === "footfall") && (
                                                <path
                                                    d={footfallSplinePath}
                                                    fill="none"
                                                    stroke="#0284C7"
                                                    strokeWidth="2.8"
                                                    filter="url(#neonGlowFootfall)"
                                                />
                                            )}

                                            {/* Layer 5: Avg Wait Time (Turnaround) Spline (Gold / Amber) */}
                                            {hourlyAnalytics.totalVisits > 0 && (chartMetricFilter === "all" || chartMetricFilter === "wait") && (
                                                <path
                                                    d={waitSplinePath}
                                                    fill="none"
                                                    stroke="#F59E0B"
                                                    strokeWidth="2.6"
                                                    filter="url(#neonGlowWait)"
                                                />
                                            )}

                                            {/* Zero Data Informative Telemetry Status Banner */}
                                            {hourlyAnalytics.totalVisits === 0 && (
                                                <g>
                                                    <rect
                                                        x="195"
                                                        y="68"
                                                        width="350"
                                                        height="38"
                                                        rx="12"
                                                        fill={isDark360 ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.92)"}
                                                        stroke={isDark360 ? "rgba(56, 189, 248, 0.3)" : "rgba(2, 132, 199, 0.25)"}
                                                        strokeWidth="1.2"
                                                    />
                                                    <circle cx="218" cy="87" r="4.5" fill="#38BDF8" style={{ animation: "livePulseBar 1.8s infinite" }} />
                                                    <text
                                                        x="232"
                                                        y="91"
                                                        fill={isDark360 ? "#94A3B8" : "#475569"}
                                                        fontSize="10.5"
                                                        fontWeight="700"
                                                    >
                                                        {isHi ? "आज अभी कोई मरीज नहीं आया • वास्तविक समय टेलीमेट्री सक्रिय" : "No patient arrivals yet • Real-time telemetry monitoring"}
                                                    </text>
                                                </g>
                                            )}

                                            {/* Layer 6: Node Points at each hour */}
                                            {waitPoints.map((pt, i) => {
                                                const isHovered = hoveredChartHour === i;
                                                const isCurrent = pt.isCurrent;
                                                const hasData = (pt.count || 0) > 0;
                                                if (!hasData && !isHovered) return null;

                                                return (
                                                    <g key={`nodes-${i}`}>
                                                        {/* Footfall Dot */}
                                                        {(chartMetricFilter === "all" || chartMetricFilter === "footfall") && (
                                                            <circle
                                                                cx={footfallPoints[i].x}
                                                                cy={footfallPoints[i].y}
                                                                r={isHovered ? "5" : isCurrent ? "4.5" : "3"}
                                                                fill={isCurrent ? "#38BDF8" : "#0284C7"}
                                                                stroke={isDark360 ? "#0C1322" : "#FFFFFF"}
                                                                strokeWidth="1.5"
                                                            />
                                                        )}

                                                        {/* Wait Time Dot */}
                                                        {hourlyAnalytics.totalVisits > 0 && (chartMetricFilter === "all" || chartMetricFilter === "wait") && (
                                                            <circle
                                                                cx={pt.x}
                                                                cy={pt.y}
                                                                r={isHovered ? "5" : isCurrent ? "4.5" : "3"}
                                                                fill="#F59E0B"
                                                                stroke={isDark360 ? "#0C1322" : "#FFFFFF"}
                                                                strokeWidth="1.5"
                                                            />
                                                        )}
                                                    </g>
                                                );
                                            })}

                                            {/* Layer 7: REAL-TIME "LIVE SCANNER" VERTICAL BEACON BEAM */}
                                            <g>
                                                {/* Vertical Laser Scanline */}
                                                <line
                                                    x1={liveScanX}
                                                    y1="20"
                                                    x2={liveScanX}
                                                    y2={baselineY}
                                                    stroke="#38BDF8"
                                                    strokeWidth="1.8"
                                                    strokeDasharray="3 3"
                                                    style={{ animation: "liveScanBeam 2s ease-in-out infinite" }}
                                                />

                                                {/* Top Glowing Beacon Radar Dot */}
                                                <circle cx={liveScanX} cy="18" r="5" fill="#38BDF8" opacity="0.4" />
                                                <circle cx={liveScanX} cy="18" r="2.8" fill="#0284C7" />

                                                {/* Mini Floating "NOW" Pill */}
                                                <rect
                                                    x={liveScanX - (isLiveActive ? 19 : 24)}
                                                    y="5"
                                                    width={isLiveActive ? 38 : 48}
                                                    height="12"
                                                    rx="3"
                                                    fill={isLiveActive ? "#0284C7" : "#64748B"}
                                                />
                                                <text x={liveScanX} y="14" fill="#FFFFFF" fontSize="7" fontWeight="900" textAnchor="middle">
                                                    {isLiveActive ? "LIVE NOW" : (isHi ? "ओपीडी बंद" : "OFF HOURS")}
                                                </text>
                                            </g>

                                            {/* Layer 8: Invisible Hit Areas for Seamless Hover Interaction */}
                                            {hourlyAnalytics.hourlyData.map((d, i) => {
                                                const slotX = 44 + i * slotW;
                                                const isHovered = hoveredChartHour === i;

                                                return (
                                                    <g
                                                        key={`hit-${i}`}
                                                        onMouseEnter={() => setHoveredChartHour && setHoveredChartHour(i)}
                                                        onMouseLeave={() => setHoveredChartHour && setHoveredChartHour(null)}
                                                        style={{ cursor: "pointer" }}
                                                    >
                                                        {/* Full Height Invisible Interactive Strip */}
                                                        <rect
                                                            x={slotX}
                                                            y="15"
                                                            width={slotW}
                                                            height="160"
                                                            fill="transparent"
                                                        />

                                                        {/* Hover Crosshair Guide */}
                                                        {isHovered && (
                                                            <line
                                                                x1={slotX + slotW / 2}
                                                                y1="20"
                                                                x2={slotX + slotW / 2}
                                                                y2={baselineY}
                                                                stroke="rgba(56, 189, 248, 0.4)"
                                                                strokeWidth="1.2"
                                                                strokeDasharray="2 2"
                                                            />
                                                        )}

                                                        {/* X-Axis Hour Label */}
                                                        <text
                                                            x={slotX + slotW / 2}
                                                            y="174"
                                                            fill={isHovered ? "#38BDF8" : d.isCurrent ? "#38BDF8" : isDark360 ? "#94A3B8" : "#64748B"}
                                                            fontSize={totalSlots > 18 ? "7" : totalSlots > 14 ? "8" : "9.5"}
                                                            fontWeight={d.isCurrent || isHovered ? "800" : "600"}
                                                            textAnchor="middle"
                                                        >
                                                            {d.label}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })()}
                            </svg>
                        </div>

                        {/* 4. Interactive Clickable Legend & Live Telemetry Summary Strip */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", fontSize: "11.5px" }}>
                            {/* Clickable Legend Badges */}
                            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                                <button
                                    type="button"
                                    onClick={() => setChartMetricFilter(chartMetricFilter === "footfall" ? "all" : "footfall")}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background: "transparent",
                                        border: "none",
                                        color: chartMetricFilter === "wait" || chartMetricFilter === "consult" ? "var(--superadmin-text-muted, #94A3B8)" : "var(--superadmin-text-main, #0F172A)",
                                        cursor: "pointer",
                                        fontWeight: chartMetricFilter === "footfall" ? 800 : 600,
                                    }}
                                >
                                    <span style={{ width: "12px", height: "10px", background: "linear-gradient(180deg, #38BDF8 0%, #0284C7 100%)", borderRadius: "2px" }} />
                                    <span>{isHi ? "मरीज आवागमन (Footfall Velocity)" : "Patient Footfall Velocity"}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setChartMetricFilter(chartMetricFilter === "wait" ? "all" : "wait")}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background: "transparent",
                                        border: "none",
                                        color: chartMetricFilter === "footfall" || chartMetricFilter === "consult" ? "var(--superadmin-text-muted, #94A3B8)" : "var(--superadmin-text-main, #0F172A)",
                                        cursor: "pointer",
                                        fontWeight: chartMetricFilter === "wait" ? 800 : 600,
                                    }}
                                >
                                    <span style={{ width: "12px", height: "3px", background: "#F59E0B", borderRadius: "2px" }} />
                                    <span>{isHi ? "औसत प्रतीक्षा समय (TAT ~मिनट)" : "Avg Wait Time (Turnaround TAT)"}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setChartMetricFilter(chartMetricFilter === "consult" ? "all" : "consult")}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background: "transparent",
                                        border: "none",
                                        color: chartMetricFilter === "footfall" || chartMetricFilter === "wait" ? "var(--superadmin-text-muted, #94A3B8)" : "var(--superadmin-text-main, #0F172A)",
                                        cursor: "pointer",
                                        fontWeight: chartMetricFilter === "consult" ? 800 : 600,
                                    }}
                                >
                                    <span style={{ width: "12px", height: "2.5px", background: "#10B981", borderRadius: "2px" }} />
                                    <span>{isHi ? "परामर्श अवधि (~मिनट)" : "Doctor Consultation Velocity"}</span>
                                </button>
                            </div>

                            {/* Live Throughput Telemetry Metric */}
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                <span>Throughput: <strong style={{ color: "#0284C7" }}>{hourlyAnalytics.currentThroughput ? `~${hourlyAnalytics.currentThroughput} pts/hr` : "0 pts/hr"}</strong></span>
                                <span>•</span>
                                <span>NABH Target: <strong style={{ color: "#10B981" }}>&lt;15 min</strong></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* FEATURE 2: DEPARTMENT BOTTLENECK ANALYZER & LOAD GAUGES */}
                {(analyticsViewTab === "all" || analyticsViewTab === "bottleneck") && (
                    <div
                        className="overview-sub-panel"
                        style={{
                            marginBottom: "20px",
                            padding: "20px",
                            borderRadius: "18px",
                            border: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "14px",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconAlertTriangle size={16} color="#EF4444" /><span>{isHi ? "विभागवार बॉटलनेक विश्लेषक एवं थ्रूपुट रडार" : "Department Bottleneck Analyzer & Traffic Shares"}</span></span>
                                    </span>
                                </div>
                                <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                    {isHi ? "विभागवार मरीज भार, टर्नअराउंड समय (TAT), एवं स्मार्ट एआई लोड संतुलन सिफारिशें" : "Cross-departmental patient volume distribution, turnaround times, and smart AI load balancing"}
                                </span>
                            </div>

                            <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>
                                {bottleneckAnalytics.length} {isHi ? "सक्रिय विभाग" : "Active Departments Monitored"}
                            </span>
                        </div>

                        {/* 2-Column: Left Donut Distribution & Right Bottleneck Detail Cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                            {/* Department Breakdown Cards */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {bottleneckAnalytics.map((dept) => (
                                    <div
                                        key={dept.code}
                                        className="overview-inner-card"
                                        style={{
                                            borderRadius: "12px",
                                            border: `1.5px solid ${dept.severityBorder}`,
                                            background: dept.severityBg,
                                            padding: "12px 14px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{dept.name}</span>
                                                <span style={{ fontSize: "10px", background: "var(--superadmin-sub-card, #1E293B)", color: "#38BDF8", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>{dept.code}</span>
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: "10.5px",
                                                    fontWeight: 800,
                                                    padding: "2px 8px",
                                                    borderRadius: "6px",
                                                    background: dept.severity === "SEVERE" ? "rgba(239, 68, 68, 0.2)" : dept.severity === "MODERATE" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                                                    color: dept.severityColor,
                                                    border: `1px solid ${dept.severityBorder}`,
                                                }}
                                            >
                                                {dept.severity === "SEVERE" ? "HIGH CONGESTION" : dept.severity === "MODERATE" ? "MODERATE LOAD" : "OPTIMAL FLOW"}
                                            </span>
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "var(--superadmin-text-sub, #CBD5E1)" }}>
                                            <span>Traffic: <strong>{dept.totalVolume}</strong> patients ({dept.sharePercent}%)</span>
                                            <span>In Queue: <strong style={{ color: dept.waitingCount > 3 ? "#EF4444" : "#10B981" }}>{dept.waitingCount}</strong> waiting</span>
                                            <span>Avg TAT: <strong>~{dept.avgTAT}m</strong></span>
                                        </div>

                                        {/* AI Recommendation Pill */}
                                        <div style={{ fontSize: "10.5px", color: dept.severityColor, fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                                            <IconLightbulb size={14} color="#F59E0B" />
                                            <span>{dept.recommendation}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Donut Traffic Distribution Visual Ring */}
                            <div
                                className="overview-inner-card"
                                style={{
                                    borderRadius: "14px",
                                    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                                    padding: "16px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "12px",
                                }}
                            >
                                <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--superadmin-text-sub, #CBD5E1)", textTransform: "uppercase" }}>
                                    {isHi ? "विभागवार मरीज हिस्सा (%)" : "Department Traffic Share Distribution"}
                                </span>

                                {/* Donut SVG */}
                                <svg width="150" height="150" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(148, 163, 184, 0.15)" strokeWidth="16" />
                                    {(() => {
                                        const colors = ["#0284C7", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"];
                                        const circumference = 2 * Math.PI * 38;
                                        let accumulatedPercent = 0;

                                        return bottleneckAnalytics.map((dept, i) => {
                                            const strokeDasharray = `${(dept.sharePercent / 100) * circumference} ${circumference}`;
                                            const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                                            accumulatedPercent += dept.sharePercent;

                                            return (
                                                <circle
                                                    key={dept.code}
                                                    cx="50"
                                                    cy="50"
                                                    r="38"
                                                    fill="none"
                                                    stroke={colors[i % colors.length]}
                                                    strokeWidth="16"
                                                    strokeDasharray={strokeDasharray}
                                                    strokeDashoffset={strokeDashoffset}
                                                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                                                />
                                            );
                                        });
                                    })()}
                                    <text x="50" y="48" textAnchor="middle" fill="var(--superadmin-text-main, #F8FAFC)" fontSize="12" fontWeight="900">
                                        {allTimePatientsVisited}
                                    </text>
                                    <text x="50" y="60" textAnchor="middle" fill="var(--superadmin-text-muted, #94A3B8)" fontSize="7" fontWeight="700">
                                        PATIENTS
                                    </text>
                                </svg>

                                {/* Department Legend */}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", fontSize: "11px" }}>
                                    {bottleneckAnalytics.map((dept, i) => {
                                        const colors = ["#0284C7", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"];
                                        return (
                                            <span key={dept.code} style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--superadmin-text-sub, #CBD5E1)" }}>
                                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: colors[i % colors.length] }} />
                                                <span>{dept.name} ({dept.sharePercent}%)</span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Visual Analytics 2-Column Grid (Triage, Doctor Duty & Live Serving Stream) */}
                {(analyticsViewTab === "all" || analyticsViewTab === "hourly") && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "18px" }}>
                        {/* GRAPH 1: Department Traffic & Capacity Saturation Meters */}
                        <div
                            className="overview-sub-panel"
                            style={{
                                borderRadius: "18px",
                                border: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
                                padding: "18px 20px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconBuilding size={16} color="#0284C7" /><span>{isHi ? "विभागवार क्षमता एवं लोड मीटर" : "Department Traffic & Capacity Meters"}</span></span>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab && setActiveTab("depts")}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "#0284C7",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {isHi ? "प्रबंधित करें →" : "Manage →"}
                                </button>
                            </div>

                            {hospitalDepts.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--superadmin-text-muted, #94A3B8)", fontSize: "12.5px" }}>
                                    {isHi ? "कोई विभाग पंजीकृत नहीं है।" : "No clinical departments registered."}
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {hospitalDepts.map((dept) => {
                                        const dCode = dept.dept_code;
                                        const deptWaiting = hospitalQueueSnapshot.filter(
                                            (t) => (t.dept_code === dCode || t.department === dCode || (t.token_number && t.token_number.startsWith(dCode.substring(0, 1).toUpperCase())))
                                        ).length;
                                        const deptDesksObj = (hospitalDesksData.departments || []).find((d) => d.dept_code === dCode);
                                        const deptDesksCount = deptDesksObj ? deptDesksObj.total_desks : 0;
                                        const deptActiveDesks = deptDesksObj ? deptDesksObj.active_desks : 0;

                                        const loadLevel = deptWaiting > 10 ? "high" : deptWaiting > 3 ? "medium" : "normal";
                                        const barColor = loadLevel === "high" ? "#EF4444" : loadLevel === "medium" ? "#F59E0B" : "#10B981";
                                        const loadPercent = Math.min(100, Math.max(12, deptWaiting * 12));

                                        return (
                                            <div
                                                key={dCode}
                                                className="overview-inner-card"
                                                style={{
                                                    borderRadius: "12px",
                                                    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                                                    padding: "10px 14px",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "6px",
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <span style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{dept.name}</span>
                                                        <code style={{ fontSize: "10px", background: "var(--superadmin-sub-card, #F1F5F9)", color: "var(--superadmin-text-muted, #64748B)", padding: "1px 5px", borderRadius: "4px" }}>
                                                            {dCode}
                                                        </code>
                                                    </div>

                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11.5px" }}>
                                                        <span style={{ color: "var(--superadmin-text-muted, #64748B)" }}>
                                                            {deptActiveDesks}/{deptDesksCount} desks
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontWeight: 800,
                                                                padding: "1px 7px",
                                                                borderRadius: "8px",
                                                                background: loadLevel === "high" ? "#FEE2E2" : loadLevel === "medium" ? "#FEF3C7" : "#DCFCE7",
                                                                color: loadLevel === "high" ? "#B91C1C" : loadLevel === "medium" ? "#B45309" : "#15803D",
                                                            }}
                                                        >
                                                            {deptWaiting} {isHi ? "वेटिंग" : "waiting"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Visual Progress Bar */}
                                                <div style={{ width: "100%", height: "7px", borderRadius: "6px", background: "var(--superadmin-card-border, #E2E8F0)", overflow: "hidden" }}>
                                                    <div
                                                        style={{
                                                            width: `${loadPercent}%`,
                                                            height: "100%",
                                                            background: barColor,
                                                            borderRadius: "6px",
                                                            transition: "width 0.4s ease",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* GRAPH 2: Urgency & Triage Pressure Breakdown */}
                        <div
                            className="overview-sub-panel"
                            style={{
                                borderRadius: "18px",
                                border: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
                                padding: "18px 20px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconShield size={16} color="#0284C7" /><span>{isHi ? "कतार प्राथमिकता एवं ट्राइएज दबाव" : "Queue Urgency & Triage Pressure"}</span></span>
                                    </span>
                                </div>
                                <span
                                    style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        padding: "2px 8px",
                                        borderRadius: "6px",
                                        background: countEmergency > 0 ? "#FEE2E2" : "#DCFCE7",
                                        color: countEmergency > 0 ? "#B91C1C" : "#15803D",
                                        border: countEmergency > 0 ? "1px solid #FECACA" : "1px solid #BBF7D0",
                                    }}
                                >
                                    {countEmergency > 0 ? "PRIORITY SURGE" : "NOMINAL PRESSURE"}
                                </span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444" }} />
                                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#EF4444" }}>Level 1: Emergency ({countEmergency})</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        {renderTelemetryBlocks(countEmergency, Math.max(waitingCount, 1), "#EF4444", 12)}
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B" }} />
                                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#F59E0B" }}>Level 2: Urgent / High ({countHigh})</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        {renderTelemetryBlocks(countHigh, Math.max(waitingCount, 1), "#F59E0B", 12)}
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
                                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#10B981" }}>Level 3: Normal / Standard ({countNormal})</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        {renderTelemetryBlocks(countNormal, Math.max(waitingCount, 1), "#10B981", 12)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* FEATURE 3: CLINICIAN PERFORMANCE & PRODUCTIVITY TELEMETRY */}
                {(analyticsViewTab === "all" || analyticsViewTab === "clinicians") && (
                    <DoctorProductivitySection
                        selectedHospital={currentHosp}
                        hospitalEmployees={hospitalEmployees}
                        hospitalDesksData={hospitalDesksData}
                        hospitalVisitsData={hospitalVisitsData}
                        hospitalQueueSnapshot={hospitalQueueSnapshot}
                        hospitalServingTickets={hospitalServingTickets}
                        isHi={isHi}
                        theme={theme}
                        setActiveTab={setActiveTab}
                    />
                )}

            </div>

        </div>
    );
}

export default function Hospital360Overview(props) {
    const currentHosp = props.selectedHospital || props.hospitals?.[0] || null;

    if (!currentHosp) {
        return (
            <div style={standaloneCardStyle}>
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <IconHospital size={44} color="#94A3B8" />
                    <h3 style={{ margin: "14px 0 6px", color: "var(--superadmin-text-main, #0F172A)", fontSize: "18px", fontWeight: 800 }}>
                        {props.isHi ? "कोई अस्पताल उपलब्ध नहीं है" : "No Hospital Data Available"}
                    </h3>
                    <p style={{ margin: "0 0 20px", color: "var(--superadmin-text-muted, #64748B)", fontSize: "13.5px" }}>
                        {props.isHi ? "कृपया पहले अस्पताल जोड़ें या नेटवर्क से एक का चयन करें।" : "Please add a hospital first or select one from the directory."}
                    </p>
                    <button
                        type="button"
                        onClick={() => props.setShowAddHospitalModal && props.setShowAddHospitalModal(true)}
                        style={{
                            ...actionBtnStyle,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 16px",
                        }}
                    >
                        <IconPlus size={15} />
                        <span>{props.isHi ? "+ नया अस्पताल जोड़ें" : "+ Add Hospital"}</span>
                    </button>
                </div>
            </div>
        );
    }

    return <Hospital360OverviewContent {...props} currentHosp={currentHosp} />;
}
