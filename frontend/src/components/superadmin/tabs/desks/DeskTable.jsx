import React, { useState, useRef, useEffect } from "react";
import { IconEdit, IconTrash, IconZap } from "../../SuperAdminIcons";
import { getCleanRoleLabel, getInitials, getDeskVisualState } from "./roleUtils";
import { getCategoryLabel } from "../../../../utils/i18n";

export default function DeskTable({
    desks = [],
    onOpenEditDesk,
    onToggleDeskStatus,
    onOpenAssignDesk,
    onUnassignDesk,
    onDeleteDesk,
    formatRelativeLogin,
    showConfirm,
    language = "en",
    isHi = false,
}) {
    const [openMenuDeskId, setOpenMenuDeskId] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!openMenuDeskId) return;
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuDeskId(null);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") setOpenMenuDeskId(null);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [openMenuDeskId]);

    const thStyle = {
        padding: "10px 14px",
        fontWeight: 800,
        color: "var(--superadmin-text-muted, #475569)",
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        background: "var(--superadmin-sub-card, #F8FAFC)",
        borderBottom: "1.5px solid var(--superadmin-card-border, #CBD5E1)",
        textAlign: "left",
        whiteSpace: "nowrap",
        position: "sticky",
        top: 0,
        zIndex: 10,
    };

    const tdStyle = {
        padding: "11px 14px",
        color: "var(--superadmin-text-sub, #334155)",
        fontSize: "12.5px",
        borderBottom: "1px solid var(--superadmin-card-border, #E2E8F0)",
        verticalAlign: "middle",
    };

    return (
        <div
            style={{
                width: "100%",
                overflowX: "auto",
                borderRadius: "14px",
                border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                background: "var(--superadmin-card-bg, #FFFFFF)",
                boxShadow: "0 2px 8px -2px rgba(15, 23, 42, 0.05)",
            }}
        >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "750px" }}>
                <thead>
                    <tr>
                        <th style={{ ...thStyle, width: "22%" }}>{isHi ? "डेस्क" : "Desk"}</th>
                        <th style={{ ...thStyle, width: "18%" }}>{isHi ? "विभाग" : "Department"}</th>
                        <th style={{ ...thStyle, width: "12%" }}>{isHi ? "स्थिति" : "Status"}</th>
                        <th style={{ ...thStyle, width: "22%" }}>{isHi ? "नियुक्त कार्मिक" : "Assigned Staff"}</th>
                        <th style={{ ...thStyle, width: "12%" }}>{isHi ? "उपस्थिति" : "Presence"}</th>
                        <th style={{ ...thStyle, width: "14%", textAlign: "right" }}>{isHi ? "कार्य" : "Actions"}</th>
                    </tr>
                </thead>
                <tbody>
                    {desks.length === 0 ? (
                        <tr>
                            <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: "36px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                {isHi ? "कोई डेस्क नहीं मिला।" : "No desks match your filter."}
                            </td>
                        </tr>
                    ) : (
                        desks.map((desk) => {
                            const visual = getDeskVisualState(desk);
                            const hasStaff = Boolean(desk.assigned_employee_id);
                            const staffName = desk.assigned_employee_name || desk.staff_name || "";
                            const staffRole = desk.assigned_employee_role || "Staff";
                            const cleanRole = getCleanRoleLabel(staffRole, isHi);
                            const isStaffOnline = (desk.assigned_employee_status || "").toLowerCase() === "active";
                            const initials = getInitials(staffName);
                            const deptLabel = getCategoryLabel(desk.dept_code, language) || desk.dept_name || desk.dept_code;

                            const lastActiveRaw = desk.assigned_employee_last_login || desk.last_active_at;
                            const lastActiveFormatted = lastActiveRaw
                                ? (formatRelativeLogin ? formatRelativeLogin(lastActiveRaw) : String(lastActiveRaw))
                                : null;

                            const isMenuOpen = openMenuDeskId === desk.id;

                            const handleUnassignClick = () => {
                                setOpenMenuDeskId(null);
                                const confirmMsg = isHi
                                    ? `क्या आप वाकई '${desk.desk_name}' से '${staffName || "कार्मिक"}' को अनअसाइन करना चाहते हैं?`
                                    : `Unassign '${staffName || "Staff"}' from '${desk.desk_name}'?`;

                                if (showConfirm) {
                                    showConfirm({
                                        title: isHi ? "डेस्क अनअसाइन करें" : "Unassign Staff",
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
                            };

                            const handleDeleteClick = () => {
                                setOpenMenuDeskId(null);
                                const confirmMsg = isHi
                                    ? `क्या आप वाकई डेस्क '${desk.desk_name}' को हटाना चाहते हैं?`
                                    : `Are you sure you want to delete desk '${desk.desk_name}'?`;

                                if (showConfirm) {
                                    showConfirm({
                                        title: isHi ? "डेस्क हटाएं" : "Delete Desk",
                                        message: confirmMsg,
                                        confirmText: isHi ? "हाँ, हटाएं" : "Delete Desk",
                                        cancelText: isHi ? "रद्द करें" : "Cancel",
                                        isDestructive: true,
                                        onConfirm: () => {
                                            if (onDeleteDesk) onDeleteDesk(desk);
                                        },
                                    });
                                } else {
                                    if (onDeleteDesk) onDeleteDesk(desk);
                                }
                            };

                            return (
                                <tr
                                    key={desk.id}
                                    style={{
                                        borderLeft: visual.borderLeft,
                                        transition: "background 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "var(--superadmin-sub-card, #F8FAFC)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "transparent";
                                    }}
                                >
                                    {/* 1. Desk Column */}
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", fontSize: "13.5px" }}>
                                            {desk.desk_name}
                                        </div>
                                        {desk.desk_number && (
                                            <div style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                                {isHi ? `डेस्क #${desk.desk_number}` : `Desk #${desk.desk_number}`}
                                            </div>
                                        )}
                                    </td>

                                    {/* 2. Department Column */}
                                    <td style={tdStyle}>
                                        <span
                                            style={{
                                                fontSize: "11.5px",
                                                fontWeight: 700,
                                                color: "var(--superadmin-text-sub, #334155)",
                                                background: "var(--superadmin-sub-card, #F1F5F9)",
                                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                padding: "3px 8px",
                                                borderRadius: "6px",
                                                display: "inline-block",
                                            }}
                                        >
                                            {deptLabel}
                                        </span>
                                    </td>

                                    {/* 3. Desk Status Column */}
                                    <td style={tdStyle}>
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "6px",
                                                fontSize: "10.5px",
                                                fontWeight: 800,
                                                letterSpacing: "0.3px",
                                                textTransform: "uppercase",
                                                background: visual.badgeBg,
                                                color: visual.badgeColor,
                                                border: visual.badgeBorder,
                                            }}
                                        >
                                            {visual.key === "serving" && (
                                                <span
                                                    style={{
                                                        width: "5px",
                                                        height: "5px",
                                                        borderRadius: "50%",
                                                        background: visual.badgeColor,
                                                    }}
                                                />
                                            )}
                                            <span>{isHi ? visual.statusLabelHi : visual.statusLabel}</span>
                                        </span>
                                    </td>

                                    {/* 4. Assigned Staff Column */}
                                    <td style={tdStyle}>
                                        {hasStaff ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <div
                                                    style={{
                                                        width: "28px",
                                                        height: "28px",
                                                        borderRadius: "6px",
                                                        background: isStaffOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                                                        color: isStaffOnline ? "#059669" : "#64748B",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "11px",
                                                        fontWeight: 800,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {initials}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: "12.5px", color: "var(--superadmin-text-main, #0F172A)" }}>
                                                        {staffName}
                                                    </div>
                                                    <div style={{ fontSize: "10.5px", color: "#0284C7", fontWeight: 600 }}>
                                                        {cleanRole}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #94A3B8)", fontStyle: "italic" }}>
                                                {isHi ? "असाइन नहीं" : "Unassigned"}
                                            </span>
                                        )}
                                    </td>

                                    {/* 5. Presence Column */}
                                    <td style={tdStyle}>
                                        {hasStaff ? (
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", fontWeight: 700, color: isStaffOnline ? "#059669" : "#D97706" }}>
                                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isStaffOnline ? "#10B981" : "#F59E0B" }} />
                                                    <span>{isStaffOnline ? (isHi ? "ऑनलाइन" : "Online") : (isHi ? "ऑफलाइन" : "Offline")}</span>
                                                </div>
                                                {lastActiveFormatted && (
                                                    <div style={{ fontSize: "10px", color: "var(--superadmin-text-muted, #64748B)", marginTop: "2px" }}>
                                                        {lastActiveFormatted}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: "var(--superadmin-text-muted, #94A3B8)", fontSize: "11.5px" }}>—</span>
                                        )}
                                    </td>

                                    {/* 6. Actions Column */}
                                    <td style={{ ...tdStyle, textAlign: "right" }}>
                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                                            {/* Primary Assign / Reassign Button */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onOpenAssignDesk) {
                                                        onOpenAssignDesk(desk, String(desk.assigned_employee_id || ""));
                                                    }
                                                }}
                                                style={{
                                                    padding: "5px 10px",
                                                    fontSize: "11.5px",
                                                    fontWeight: 700,
                                                    borderRadius: "7px",
                                                    border: hasStaff ? "1px solid var(--superadmin-card-border, #CBD5E1)" : "none",
                                                    background: hasStaff ? "var(--superadmin-card-bg, #FFFFFF)" : "#0284C7",
                                                    color: hasStaff ? "var(--superadmin-text-main, #0F172A)" : "#FFFFFF",
                                                    cursor: "pointer",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {hasStaff ? (isHi ? "बदलें" : "Reassign") : (isHi ? "सौंपें" : "Assign")}
                                            </button>

                                            {/* 3-dots Menu for Edit, Toggle, Unassign, Delete */}
                                            <div ref={isMenuOpen ? menuRef : null} style={{ position: "relative" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenMenuDeskId(isMenuOpen ? null : desk.id)}
                                                    aria-label="Desk Options"
                                                    style={{
                                                        width: "28px",
                                                        height: "28px",
                                                        borderRadius: "7px",
                                                        border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                        background: isMenuOpen ? "var(--superadmin-sub-card, #F1F5F9)" : "transparent",
                                                        color: "var(--superadmin-text-sub, #475569)",
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "14px",
                                                        fontWeight: 800,
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    ⋯
                                                </button>

                                                {isMenuOpen && (
                                                    <div
                                                        style={{
                                                            position: "absolute",
                                                            right: 0,
                                                            top: "32px",
                                                            background: "var(--superadmin-card-bg, #FFFFFF)",
                                                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                            borderRadius: "10px",
                                                            boxShadow: "0 10px 25px -4px rgba(0, 0, 0, 0.15)",
                                                            padding: "4px",
                                                            zIndex: 40,
                                                            minWidth: "160px",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            gap: "2px",
                                                            textAlign: "left",
                                                        }}
                                                    >
                                                        {/* Edit Desk */}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setOpenMenuDeskId(null);
                                                                if (onOpenEditDesk) onOpenEditDesk(desk, desk.dept_code);
                                                            }}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "8px",
                                                                padding: "7px 10px",
                                                                background: "none",
                                                                border: "none",
                                                                borderRadius: "6px",
                                                                color: "var(--superadmin-text-main, #0F172A)",
                                                                fontSize: "12px",
                                                                fontWeight: 600,
                                                                cursor: "pointer",
                                                                textAlign: "left",
                                                                width: "100%",
                                                            }}
                                                        >
                                                            <IconEdit size={13} color="#0284C7" />
                                                            <span>{isHi ? "डेस्क संपादित करें" : "Edit Desk"}</span>
                                                        </button>

                                                        {/* Toggle Status */}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setOpenMenuDeskId(null);
                                                                if (onToggleDeskStatus) onToggleDeskStatus(desk);
                                                            }}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "8px",
                                                                padding: "7px 10px",
                                                                background: "none",
                                                                border: "none",
                                                                borderRadius: "6px",
                                                                color: "var(--superadmin-text-main, #0F172A)",
                                                                fontSize: "12px",
                                                                fontWeight: 600,
                                                                cursor: "pointer",
                                                                textAlign: "left",
                                                                width: "100%",
                                                            }}
                                                        >
                                                            <IconZap size={13} color="#D97706" />
                                                            <span>{isHi ? "स्थिति बदलें" : "Toggle Status"}</span>
                                                        </button>

                                                        {/* Unassign Staff */}
                                                        {hasStaff && (
                                                            <button
                                                                type="button"
                                                                onClick={handleUnassignClick}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "8px",
                                                                    padding: "7px 10px",
                                                                    background: "none",
                                                                    border: "none",
                                                                    borderRadius: "6px",
                                                                    color: "#DC2626",
                                                                    fontSize: "12px",
                                                                    fontWeight: 600,
                                                                    cursor: "pointer",
                                                                    textAlign: "left",
                                                                    width: "100%",
                                                                }}
                                                            >
                                                                <span style={{ fontSize: "14px", lineHeight: 1 }}>⊘</span>
                                                                <span>{isHi ? "अनअसाइन करें" : "Unassign Staff"}</span>
                                                            </button>
                                                        )}

                                                        <div style={{ height: "1px", background: "var(--superadmin-card-border, #E2E8F0)", margin: "3px 0" }} />

                                                        {/* Delete Desk */}
                                                        <button
                                                            type="button"
                                                            onClick={handleDeleteClick}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "8px",
                                                                padding: "7px 10px",
                                                                background: "rgba(239, 68, 68, 0.06)",
                                                                border: "none",
                                                                borderRadius: "6px",
                                                                color: "#EF4444",
                                                                fontSize: "12px",
                                                                fontWeight: 700,
                                                                cursor: "pointer",
                                                                textAlign: "left",
                                                                width: "100%",
                                                            }}
                                                        >
                                                            <IconTrash size={13} color="#EF4444" />
                                                            <span>{isHi ? "डेस्क हटाएं" : "Delete Desk"}</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

