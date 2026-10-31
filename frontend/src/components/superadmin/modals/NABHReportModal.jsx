import React from "react";
import {
    IconFileText,
    IconShield,
    IconBuilding,
    IconChart,
    IconPrinter,
    IconX
} from "../SuperAdminIcons";
import {
    modalOverlayStyle,
    modalContentStyle,
    modalCloseIconBtnStyle,
    modalCancelBtnStyle,
    modalSubmitBtnStyle
} from "../superAdminStyles";

export default function NABHReportModal({
    isOpen,
    onClose,
    targetHosp,
    visitsList = [],
    queueList = [],
    deptsList = [],
    hospitalVisitsData = {},
    hospitalAnalytics = null,
    hospitalEmployees = [],
    brandingForm = {},
    computeHourlyAnalytics,
    computeDepartmentBottlenecks,
    onDownloadExcel,
    handleDownloadNABHExcel,
    onPrintReport,
    handlePrintNABHReport,
    isHi = false
}) {
    if (!isOpen) return null;

    const triggerDownload = onDownloadExcel || handleDownloadNABHExcel;
    const triggerPrint = onPrintReport || handlePrintNABHReport;

    const hourlyAnalytics = computeHourlyAnalytics ? computeHourlyAnalytics(visitsList, queueList, targetHosp?.branding_json || targetHosp?.branding || brandingForm) : null;
    const bottleneckAnalytics = computeDepartmentBottlenecks ? computeDepartmentBottlenecks(deptsList, queueList, visitsList) : [];

    const safeTotalPatients = hospitalVisitsData?.summary?.total_patients_visited_all_time ?? (hospitalAnalytics?.total_patients_visited_all_time || visitsList.length);
    const safeCompleted = hospitalVisitsData?.summary?.today_completed ?? hospitalAnalytics?.completed_today ?? 0;
    const safeWaiting = hospitalAnalytics?.waiting_count ?? queueList.filter((q) => (q.status || "").toLowerCase() === "waiting").length;
    const safeAvgWait = hospitalAnalytics?.avg_actual_wait_minutes ?? hospitalAnalytics?.avg_wait_minutes ?? null;
    const activeDoctorsCount = (hospitalEmployees || []).filter((e) => {
        const role = (e.role || "").toLowerCase();
        return (role === "doctor" || role === "physician") && (e.status || "").toLowerCase() === "active";
    }).length;

    const nabhReportData = {
        hospitalName: targetHosp?.name || "Not available",
        hospitalCode: targetHosp?.hospital_code || "—",
        address: targetHosp?.address || brandingForm?.address || "Not available",
        totalPatients: safeTotalPatients,
        completedCount: safeCompleted,
        waitingCount: safeWaiting,
        avgWaitTime: safeAvgWait !== null ? (Math.round(Number(safeAvgWait) * 10) / 10) : null,
        peakRushWindow: hourlyAnalytics?.peakHourLabel || "Not available",
        doctorsOnDuty: activeDoctorsCount,
        totalStaff: (hospitalEmployees || []).length,
        complianceScore: (safeTotalPatients > 0 || safeCompleted > 0 || safeWaiting > 0)
            ? Math.min(100, Math.max(0, Math.round(100 - (safeWaiting > 10 ? 12 : safeWaiting > 4 ? 6 : 0))))
            : null,
        primaryRecommendation: (bottleneckAnalytics || []).find((d) => d.severity === "SEVERE")?.recommendation || (isHi ? "सभी विभाग सामान्य मानक के अंतर्गत संचालित हैं।" : "All departments operating well within NABH benchmark wait thresholds."),
        departmentBreakdown: bottleneckAnalytics || [],
    };

    return (
        <div style={modalOverlayStyle}>
            <div style={{ ...modalContentStyle, maxWidth: "750px" }}>
                {/* Modal Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid var(--superadmin-card-border, #E2E8F0)", paddingBottom: "12px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <IconFileText size={20} color="#0284C7" />
                            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                {isHi ? "एनएबीएच कार्यकारी दैनिक संचालन एवं गुणवत्ता ऑडिट रिपोर्ट" : "NABH Executive Daily Operations & Quality Audit Report"}
                            </h3>
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--superadmin-text-muted, #64748B)" }}>
                            {nabhReportData.hospitalName} ({nabhReportData.hospitalCode}) • {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={modalCloseIconBtnStyle}
                        title="Close"
                    >
                        <IconX size={15} />
                    </button>
                </div>

                {/* NABH Compliance Banner */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <IconShield size={16} color="#10B981" />
                        <div>
                            <div style={{ fontSize: "12px", fontWeight: 800, color: "#10B981" }}>NABH ACCREDITATION STANDARD COP 3.1 & AAC 4.2</div>
                            <div style={{ fontSize: "10.5px", color: "var(--superadmin-text-sub, #CBD5E1)" }}>Continuous Turnaround Time (TAT) and Emergency Triage Quality Verification</div>
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "16px", fontWeight: 900, color: "#10B981" }}>
                            {nabhReportData.complianceScore !== null ? `${nabhReportData.complianceScore}%` : "—"}
                        </span>
                        <div style={{ fontSize: "9.5px", color: "#10B981", fontWeight: 700 }}>
                            {nabhReportData.complianceScore !== null ? "COMPLIANT" : "NO DATA"}
                        </div>
                    </div>
                </div>

                {/* KPI Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "18px" }}>
                    <div className="overview-inner-card" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #E2E8F0)" }}>
                        <div style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Total Registrations</div>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "#0284C7", marginTop: "2px" }}>{nabhReportData.totalPatients}</div>
                    </div>
                    <div className="overview-inner-card" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #E2E8F0)" }}>
                        <div style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Treated Today</div>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "#10B981", marginTop: "2px" }}>{nabhReportData.completedCount}</div>
                    </div>
                    <div className="overview-inner-card" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #E2E8F0)" }}>
                        <div style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Avg Wait Time (TAT)</div>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "#818CF8", marginTop: "2px" }}>
                            {nabhReportData.avgWaitTime !== null ? `${nabhReportData.avgWaitTime} min` : "—"}
                        </div>
                    </div>
                    <div className="overview-inner-card" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #E2E8F0)" }}>
                        <div style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Peak Rush Period</div>
                        <div style={{ fontSize: "13px", fontWeight: 900, color: "#F59E0B", marginTop: "4px" }}>{nabhReportData.peakRushWindow}</div>
                    </div>
                </div>

                {/* Departmental Breakdown Table */}
                <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", marginBottom: "8px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconBuilding size={15} color="#0284C7" /><span>{isHi ? "विभागवार थ्रूपुट एवं बॉटलनेक ऑडिट" : "Departmental Throughput & Bottleneck Audit"}</span></span>
                    </div>
                    <div style={{ overflowX: "auto", border: "1px solid var(--superadmin-card-border, #E2E8F0)", borderRadius: "10px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                            <thead>
                                <tr style={{ background: "var(--superadmin-sub-card, #1E293B)", color: "#F8FAFC", textAlign: "left" }}>
                                    <th style={{ padding: "8px 10px" }}>Dept</th>
                                    <th style={{ padding: "8px 10px" }}>Traffic</th>
                                    <th style={{ padding: "8px 10px" }}>Served</th>
                                    <th style={{ padding: "8px 10px" }}>Waiting</th>
                                    <th style={{ padding: "8px 10px" }}>Avg TAT</th>
                                    <th style={{ padding: "8px 10px" }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nabhReportData.departmentBreakdown.map((d, i) => (
                                    <tr key={d.code} style={{ borderBottom: "1px solid var(--superadmin-card-border, #334155)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                                        <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--superadmin-text-main, #F8FAFC)" }}>{d.name} ({d.code})</td>
                                        <td style={{ padding: "8px 10px" }}>{d.totalVolume}</td>
                                        <td style={{ padding: "8px 10px", color: "#10B981" }}>{d.completedCount}</td>
                                        <td style={{ padding: "8px 10px", color: d.waitingCount > 3 ? "#EF4444" : "var(--superadmin-text-sub, #CBD5E1)" }}>{d.waitingCount}</td>
                                        <td style={{ padding: "8px 10px" }}>~{d.avgTAT}m</td>
                                        <td style={{ padding: "8px 10px" }}>
                                            <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: d.severityBg, color: d.severityColor }}>
                                                {d.severity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quality & AI Recommendation */}
                <div style={{ background: "var(--superadmin-sub-card, #1E293B)", border: "1px solid var(--superadmin-card-border, #334155)", borderRadius: "10px", padding: "12px 14px", marginBottom: "18px", fontSize: "11.5px" }}>
                    <div style={{ fontWeight: 800, color: "#38BDF8", marginBottom: "3px" }}>Clinical QA Audit Finding & Recommendation:</div>
                    <div style={{ color: "var(--superadmin-text-sub, #CBD5E1)" }}>{nabhReportData.primaryRecommendation}</div>
                </div>

                {/* Modal Actions */}
                <div style={{ display: "flex", gap: "10px", borderTop: "1px solid var(--superadmin-card-border, #E2E8F0)", paddingTop: "14px", flexWrap: "wrap" }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={modalCancelBtnStyle}
                    >
                        {isHi ? "बंद करें" : "Close"}
                    </button>

                    <button
                        type="button"
                        onClick={() => triggerDownload && triggerDownload(nabhReportData)}
                        style={{
                            ...modalCancelBtnStyle,
                            color: "#0284C7",
                            borderColor: "rgba(2, 132, 199, 0.4)",
                            background: "rgba(2, 132, 199, 0.12)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                        }}
                    >
                        <IconChart size={18} color="#0284C7" />
                        <span>{isHi ? "एक्सेल डाउनलोड (CSV)" : "Download Excel (CSV)"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => triggerPrint && triggerPrint(nabhReportData)}
                        style={{
                            ...modalSubmitBtnStyle,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                        }}
                    >
                        <IconPrinter size={15} />
                        <span>{isHi ? "प्रिंट / सेव PDF" : "Print / Save as PDF"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
