import React from "react";
import {
    IconHospital,
    IconPlus,
    IconSearch,
    IconStethoscope,
    IconEdit,
    IconX,
    IconUser,
    IconZap,
    IconAlertTriangle,
} from "../SuperAdminIcons";
import {
    standaloneCardStyle,
    actionBtnStyle,
    fieldInputStyle,
    deptDeskBoxStyle,
    deskCardItemStyle,
    deskStatusPillStyle,
    deleteDeskIconBtnStyle,
    toggleDeskBtnStyle,
} from "../superAdminStyles";
import { getCategoryLabel } from "../../../utils/i18n";
import "../SuperAdmin.css";

export default function DesksManagementTab({
    selectedHospital,
    hospitals = [],
    onSelectHospital,
    hospitalDesksData = { departments: [], active_desks: 0, total_desks: 0 },
    hospitalDepts = [],
    deskSearchQuery = "",
    setDeskSearchQuery,
    onBulkDeskStatus,
    onToggleDeskStatus,
    onOpenAddDesk,
    onOpenEditDesk,
    onOpenAssignDesk,
    onUnassignDesk,
    onDeleteDesk,
    formatRelativeLogin,
    language = "en",
    isHi = false,
    notify,
    showConfirm,
}) {
    const q = deskSearchQuery.trim().toLowerCase();
    const rawGroups = hospitalDesksData.departments || [];
    const filteredDeptGroups = rawGroups.map((deptGroup) => {
        if (!q) return deptGroup;
        const matchesDept = (deptGroup.dept_code || "").toLowerCase().includes(q) ||
            (deptGroup.name || "").toLowerCase().includes(q) ||
            getCategoryLabel(deptGroup.dept_code, language).toLowerCase().includes(q);
        const matchingDesks = (deptGroup.desks || []).filter(
            (desk) => matchesDept || (desk.desk_name || "").toLowerCase().includes(q)
        );
        return {
            ...deptGroup,
            desks: matchingDesks,
        };
    }).filter((g) => (g.desks && g.desks.length > 0) || (!q && hospitalDepts.some((d) => d.dept_code === g.dept_code)));

    return (
        <div style={standaloneCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                    <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", color: "var(--superadmin-text-main, #0F172A)", fontWeight: 800 }}>
                        {isHi ? "सक्रिय काउंटर एवं डेस्क प्रबंधन" : "Active Desk & Counter Management"}
                    </h2>
                    {hospitals && hospitals.length > 1 ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--superadmin-sub-card, #F1F5F9)", padding: "4px 10px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #CBD5E1)", marginTop: "2px" }}>
                            <IconHospital size={14} color="#0284C7" />
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)" }}>
                                {isHi ? "शाखा:" : "Facility:"}
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
                                • {hospitalDesksData.active_desks || 0} / {hospitalDesksData.total_desks || 0} {isHi ? "सक्रिय डेस्क" : "Active Desks"}
                            </span>
                        </div>
                    ) : (
                        <span style={{ fontSize: "12px", color: "#0284C7", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                            <IconHospital size={14} color="#0284C7" />
                            <span>{selectedHospital ? selectedHospital.name : "Select a Hospital"} ({hospitalDesksData.active_desks || 0} / {hospitalDesksData.total_desks || 0} Active Desks)</span>
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => {
                        if (hospitalDepts.length === 0) {
                            const msg = isHi ? "डेस्क जोड़ने से पहले कृपया कम से कम एक विभाग बनाएं।" : "Please create at least one clinical department in the Departments tab before adding a desk.";
                            if (notify) notify(msg, "warn");
                            return;
                        }
                        if (onOpenAddDesk) onOpenAddDesk();
                    }}
                    style={actionBtnStyle}
                >
                    <IconPlus size={14} color="#FFFFFF" />
                    <span>{isHi ? "नया डेस्क जोड़ें" : "+ Add New Desk"}</span>
                </button>
            </div>

            {/* Desk Search Input */}
            <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ position: "relative", minWidth: "260px", flex: "1 1 260px" }}>
                    <input
                        type="text"
                        placeholder={isHi ? "डेस्क या विभाग से खोजें..." : "Filter desks by name or department..."}
                        value={deskSearchQuery}
                        onChange={(e) => setDeskSearchQuery && setDeskSearchQuery(e.target.value)}
                        style={{ ...fieldInputStyle, paddingLeft: "32px", fontSize: "12.5px" }}
                    />
                    <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", display: "flex", alignItems: "center" }}>
                        <IconSearch size={14} color="#94A3B8" />
                    </span>
                </div>
                {deskSearchQuery && (
                    <span style={{ fontSize: "12px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 600 }}>
                        Filtered across {filteredDeptGroups.length} departments
                    </span>
                )}
            </div>

            {/* Department Desks */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {filteredDeptGroups.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px", color: "var(--superadmin-text-muted, #64748B)", background: "var(--superadmin-sub-card, #F8FAFC)", borderRadius: "12px", border: "1px solid var(--superadmin-card-border, #E2E8F0)" }}>
                        {deskSearchQuery ? "No desks match your filter." : "No desks found for this hospital. Click '+ Add New Desk' above."}
                    </div>
                ) : (
                    filteredDeptGroups.map((deptGroup) => (
                        <div key={deptGroup.dept_code} style={deptDeskBoxStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid var(--superadmin-card-border, #E2E8F0)", paddingBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <IconStethoscope size={16} color="#38BDF8" />
                                    <h4 style={{ margin: 0, fontSize: "15px", color: "var(--superadmin-text-main, #0F172A)", fontWeight: 800 }}>
                                        {getCategoryLabel(deptGroup.dept_code, language)}
                                    </h4>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#38BDF8", background: "rgba(2, 132, 199, 0.15)", border: "1px solid rgba(2, 132, 199, 0.3)", padding: "2px 8px", borderRadius: "6px" }}>
                                        {deptGroup.active_desks} / {deptGroup.total_desks} Active
                                    </span>
                                    {/* Bulk Deactivate / Activate per Department */}
                                    <button
                                        type="button"
                                        onClick={() => onBulkDeskStatus && onBulkDeskStatus(deptGroup.dept_code, "UNAVAILABLE")}
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            padding: "3px 8px",
                                            background: "rgba(220, 38, 38, 0.15)",
                                            color: "#EF4444",
                                            border: "1px solid rgba(220, 38, 38, 0.3)",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                        }}
                                        title="Deactivate all desks in this department"
                                    >
                                        Deactivate All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onBulkDeskStatus && onBulkDeskStatus(deptGroup.dept_code, "AVAILABLE")}
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            padding: "3px 8px",
                                            background: "rgba(22, 163, 74, 0.15)",
                                            color: "#10B981",
                                            border: "1px solid rgba(22, 163, 74, 0.3)",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                        }}
                                        title="Activate all desks in this department"
                                    >
                                        Activate All
                                    </button>
                                </div>
                            </div>

                            {(!deptGroup.desks || deptGroup.desks.length === 0) ? (
                                <div style={{ padding: "14px 16px", background: "var(--superadmin-sub-card, #1E293B)", borderRadius: "8px", border: "1px dashed var(--superadmin-card-border, #334155)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                                    <span style={{ fontSize: "12px", color: "var(--superadmin-text-muted, #94A3B8)" }}>
                                        {isHi ? "इस विभाग में अभी कोई डेस्क नहीं है।" : "No desks created in this department yet."}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => onOpenAddDesk && onOpenAddDesk(deptGroup.dept_code)}
                                        style={{ ...actionBtnStyle, padding: "5px 12px", fontSize: "11.5px" }}
                                    >
                                        <IconPlus size={12} color="#FFFFFF" />
                                        <span>{isHi ? "डेस्क जोड़ें" : "+ Add Desk"}</span>
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "14px" }}>
                                    {deptGroup.desks.map((desk) => (
                                        <div key={desk.id} style={deskCardItemStyle(desk.status)}>
                                            {/* Desk Header: Title, Status Badge, Edit & Delete */}
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                                                <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                        <span
                                                            style={{
                                                                fontSize: "14.5px",
                                                                fontWeight: 800,
                                                                color: "var(--superadmin-text-main, #0F172A)",
                                                                letterSpacing: "0.2px",
                                                                lineHeight: 1.3,
                                                                wordBreak: "break-word",
                                                            }}
                                                        >
                                                            {desk.desk_name}
                                                        </span>
                                                        <span style={deskStatusPillStyle(desk.status)}>
                                                            {desk.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                                    {/* Edit Desk Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenEditDesk && onOpenEditDesk(desk, deptGroup.dept_code)}
                                                        style={{
                                                            ...deleteDeskIconBtnStyle,
                                                            color: "#0284C7",
                                                            background: "rgba(2, 132, 199, 0.08)",
                                                            border: "1px solid rgba(2, 132, 199, 0.25)",
                                                        }}
                                                        title={isHi ? "डेस्क संपादित करें" : "Edit Desk"}
                                                    >
                                                        <IconEdit size={13} color="#0284C7" />
                                                    </button>
                                                    {/* Delete Desk Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteDesk && onDeleteDesk(desk)}
                                                        style={deleteDeskIconBtnStyle}
                                                        title={isHi ? "डेस्क हटाएं" : "Remove Desk"}
                                                    >
                                                        <IconX size={15} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Assigned Doctor / Staff Card Section */}
                                            {desk.assigned_employee_id ? (() => {
                                                const isDoc = (desk.assigned_employee_role || "").toLowerCase() === "doctor";
                                                const isOnline = (desk.assigned_employee_status || "").toLowerCase() === "active";
                                                const isDeskOpen = ["AVAILABLE", "ACTIVE", "BUSY", "OCCUPIED"].includes((desk.status || "").toUpperCase());

                                                return (
                                                    <React.Fragment>
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                flexDirection: "column",
                                                                gap: "10px",
                                                                background: isDoc
                                                                    ? (isOnline ? "rgba(16, 185, 129, 0.07)" : "rgba(239, 68, 68, 0.06)")
                                                                    : "var(--superadmin-sub-card, #F8FAFC)",
                                                                border: isDoc
                                                                    ? (isOnline ? "1px solid rgba(16, 185, 129, 0.28)" : "1px solid rgba(239, 68, 68, 0.22)")
                                                                    : "1px solid var(--superadmin-card-border, #E2E8F0)",
                                                                borderRadius: "10px",
                                                                padding: "10px 12px",
                                                                margin: "4px 0",
                                                            }}
                                                        >
                                                            {/* Doctor Info Row: Icon, Name & Role/Activity */}
                                                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                                                                <div
                                                                    style={{
                                                                        width: "34px",
                                                                        height: "34px",
                                                                        borderRadius: "8px",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        fontSize: "16px",
                                                                        background: isDoc
                                                                            ? (isOnline ? "rgba(16, 185, 129, 0.16)" : "rgba(239, 68, 68, 0.12)")
                                                                            : "rgba(100, 116, 139, 0.12)",
                                                                        flexShrink: 0,
                                                                    }}
                                                                >
                                                                    {isDoc ? "🩺" : "👤"}
                                                                </div>
                                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                                    <div
                                                                        style={{
                                                                            fontSize: "13px",
                                                                            fontWeight: 800,
                                                                            color: "var(--superadmin-text-main, #0F172A)",
                                                                            lineHeight: 1.3,
                                                                            wordBreak: "break-word",
                                                                        }}
                                                                    >
                                                                        {desk.assigned_employee_name || desk.staff_name}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            fontSize: "11px",
                                                                            color: isDoc ? (isOnline ? "#059669" : "#DC2626") : "var(--superadmin-text-muted, #64748B)",
                                                                            fontWeight: 600,
                                                                            marginTop: "2px",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            gap: "6px",
                                                                            flexWrap: "wrap",
                                                                        }}
                                                                    >
                                                                        <span style={{ textTransform: "capitalize" }}>{desk.assigned_employee_role || "Staff"}</span>
                                                                        {desk.assigned_employee_last_login && isOnline && (
                                                                            <span style={{ opacity: 0.85 }}>
                                                                                • {formatRelativeLogin ? formatRelativeLogin(desk.assigned_employee_last_login) : desk.assigned_employee_last_login}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Doctor Status Badge & Action Controls */}
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "space-between",
                                                                    paddingTop: "8px",
                                                                    borderTop: isDoc
                                                                        ? (isOnline ? "1px solid rgba(16, 185, 129, 0.18)" : "1px solid rgba(239, 68, 68, 0.15)")
                                                                        : "1px solid var(--superadmin-card-border, #E2E8F0)",
                                                                    gap: "8px",
                                                                }}
                                                            >
                                                                {/* Online / Offline Pill */}
                                                                <span
                                                                    style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        gap: "5px",
                                                                        padding: "2px 8px",
                                                                        borderRadius: "999px",
                                                                        fontSize: "10.5px",
                                                                        fontWeight: 700,
                                                                        background: isOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                                                                        color: isOnline ? "#059669" : "#64748B",
                                                                        border: isOnline ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(100, 116, 139, 0.3)",
                                                                    }}
                                                                >
                                                                    <span
                                                                        style={{
                                                                            width: "6px",
                                                                            height: "6px",
                                                                            borderRadius: "50%",
                                                                            background: isOnline ? "#10B981" : "#94A3B8",
                                                                        }}
                                                                    />
                                                                    <span>{isOnline ? (isHi ? "ऑनलाइन" : "Online") : (isHi ? "ऑफलाइन" : "Offline")}</span>
                                                                </span>

                                                                {/* Change & Unassign Actions */}
                                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onOpenAssignDesk && onOpenAssignDesk(desk, String(desk.assigned_employee_id || ""))}
                                                                        style={{
                                                                            background: "#FFFFFF",
                                                                            border: "1px solid #CBD5E1",
                                                                            borderRadius: "6px",
                                                                            padding: "3px 8px",
                                                                            fontSize: "11px",
                                                                            fontWeight: 700,
                                                                            color: "#0284C7",
                                                                            cursor: "pointer",
                                                                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                                                                        }}
                                                                        title={isHi ? "कार्मिक बदलें" : "Reassign Doctor / Staff"}
                                                                    >
                                                                        {isHi ? "बदलें" : "Change"}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const staffName = desk.assigned_employee_name || desk.staff_name || "Doctor";
                                                                            const confirmMsg = isHi
                                                                                ? `क्या आप वाकई '${desk.desk_name}' से '${staffName}' को हटाना (अनअसाइन) चाहते हैं?`
                                                                                : `Unassign '${staffName}' from '${desk.desk_name}'?`;
                                                                            if (showConfirm) {
                                                                                showConfirm({
                                                                                    title: isHi ? "डेस्क अनअसाइन करें" : "Unassign Desk",
                                                                                    message: confirmMsg,
                                                                                    confirmText: isHi ? "हाँ, अनअसाइन करें" : "Unassign",
                                                                                    cancelText: isHi ? "रद्द करें" : "Cancel",
                                                                                    isDestructive: true,
                                                                                    onConfirm: () => {
                                                                                        if (onUnassignDesk) onUnassignDesk(desk);
                                                                                    },
                                                                                });
                                                                            } else {
                                                                                if (onUnassignDesk) onUnassignDesk(desk);
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            background: "rgba(239, 68, 68, 0.1)",
                                                                            border: "1px solid rgba(239, 68, 68, 0.25)",
                                                                            borderRadius: "6px",
                                                                            width: "26px",
                                                                            height: "26px",
                                                                            display: "inline-flex",
                                                                            alignItems: "center",
                                                                            justifyContent: "center",
                                                                            color: "#EF4444",
                                                                            cursor: "pointer",
                                                                            transition: "all 0.15s ease",
                                                                        }}
                                                                        title={isHi ? "अनअसाइन करें" : "Unassign Desk"}
                                                                    >
                                                                        <IconX size={14} color="#EF4444" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Warning banner if open desk has logged-out doctor */}
                                                        {!isOnline && isDeskOpen && (
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "6px",
                                                                    padding: "6px 10px",
                                                                    background: "rgba(245, 158, 11, 0.1)",
                                                                    border: "1px solid rgba(245, 158, 11, 0.3)",
                                                                    borderRadius: "7px",
                                                                    marginBottom: "4px",
                                                                    fontSize: "11px",
                                                                    color: "#92400E",
                                                                    fontWeight: 600,
                                                                    lineHeight: 1.35,
                                                                }}
                                                            >
                                                                <IconAlertTriangle size={15} color="#D97706" style={{ flexShrink: 0 }} />
                                                                <span>{isHi ? "सावधानी: नियुक्त कार्मिक वर्तमान में ऑफलाइन हैं" : "Assigned doctor is currently offline"}</span>
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })() : (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        background: "var(--superadmin-sub-card, #F8FAFC)",
                                                        border: "1px dashed var(--superadmin-card-border, #CBD5E1)",
                                                        borderRadius: "10px",
                                                        padding: "10px 12px",
                                                        margin: "4px 0",
                                                        gap: "10px",
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                                                        <div
                                                            style={{
                                                                width: "32px",
                                                                height: "32px",
                                                                borderRadius: "8px",
                                                                background: "rgba(245, 158, 11, 0.15)",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <IconZap size={16} color="#D97706" />
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--superadmin-text-main, #334155)" }}>
                                                                {isHi ? "स्वचालित बे" : "Auto Bay / Unassigned"}
                                                            </div>
                                                            <div style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                                                {isHi ? "कोई डॉक्टर नियुक्त नहीं" : "No doctor assigned"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenAssignDesk && onOpenAssignDesk(desk, "")}
                                                        style={{
                                                            background: "#0284C7",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            padding: "5px 12px",
                                                            fontSize: "11px",
                                                            fontWeight: 700,
                                                            color: "#FFFFFF",
                                                            cursor: "pointer",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            flexShrink: 0,
                                                            boxShadow: "0 1px 3px rgba(2, 132, 199, 0.25)",
                                                        }}
                                                    >
                                                        <span>+</span>
                                                        <span>{isHi ? "सौंपें" : "Assign"}</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Desk Footer Actions */}
                                            <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleDeskStatus && onToggleDeskStatus(desk)}
                                                    style={{ ...toggleDeskBtnStyle, flex: 1, margin: 0, padding: "7px 10px", fontSize: "11.5px" }}
                                                >
                                                    {isHi ? "स्थिति बदलें" : "Toggle Status"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenAssignDesk && onOpenAssignDesk(desk, String(desk.assigned_employee_id || ""))}
                                                    style={{
                                                        padding: "7px 12px",
                                                        fontSize: "11.5px",
                                                        fontWeight: 700,
                                                        background: "#F0F9FF",
                                                        border: "1px solid #BAE6FD",
                                                        borderRadius: "8px",
                                                        color: "#0369A1",
                                                        cursor: "pointer",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "5px",
                                                        transition: "all 0.15s ease",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                    title={isHi ? "डॉक्टर या स्टाफ सौंपें" : "Assign Doctor or Staff"}
                                                >
                                                    <IconUser size={14} />
                                                    <span>{desk.assigned_employee_id ? (isHi ? "पुनः" : "Reassign") : (isHi ? "सौंपें" : "Assign")}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
