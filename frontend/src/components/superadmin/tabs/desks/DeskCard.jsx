import React, { useState, useRef, useEffect } from "react";
import { IconEdit, IconTrash, IconZap } from "../../SuperAdminIcons";
import { getCleanRoleLabel, getInitials, getDeskVisualState } from "./roleUtils";

export default function DeskCard({
    desk,
    deptCode,
    onOpenEditDesk,
    onToggleDeskStatus,
    onOpenAssignDesk,
    onUnassignDesk,
    onDeleteDesk,
    formatRelativeLogin,
    showConfirm,
    isHi = false,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu on outside click or Esc
    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [menuOpen]);

    const visual = getDeskVisualState(desk);
    const hasStaff = Boolean(desk.assigned_employee_id);
    const staffName = desk.assigned_employee_name || desk.staff_name || "";
    const staffRole = desk.assigned_employee_role || "Staff";
    const cleanRole = getCleanRoleLabel(staffRole, isHi);
    const isStaffOnline = (desk.assigned_employee_status || "").toLowerCase() === "active";
    const initials = getInitials(staffName);

    // Last login / active relative time string
    const lastActiveRaw = desk.assigned_employee_last_login || desk.last_active_at;
    const lastActiveFormatted = lastActiveRaw
        ? (formatRelativeLogin ? formatRelativeLogin(lastActiveRaw) : String(lastActiveRaw))
        : null;

    const handleUnassignClick = () => {
        setMenuOpen(false);
        const confirmMsg = isHi
            ? `क्या आप वाकई '${desk.desk_name}' से '${staffName || "कार्मिक"}' को अनअसाइन करना चाहते हैं?`
            : `Unassign '${staffName || "Staff"}' from '${desk.desk_name}'?`;

        if (showConfirm) {
            showConfirm({
                title: isHi ? "डेस्क अनअसाइन करें" : "Unassign Staff Member",
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
        setMenuOpen(false);
        const confirmMsg = isHi
            ? `क्या आप वाकई डेस्क '${desk.desk_name}' को हटाना चाहते हैं?`
            : `Are you sure you want to delete desk '${desk.desk_name}'? This cannot be undone.`;

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
        <div
            style={{
                background: "var(--superadmin-card-bg, #FFFFFF)",
                border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                borderLeft: visual.borderLeft,
                borderRadius: "14px",
                padding: "14px 16px",
                boxShadow: "0 2px 8px -2px rgba(15, 23, 42, 0.05)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px",
                position: "relative",
                transition: "all 0.18s ease",
            }}
        >
            {/* Top Row: Desk Name, Status Pill, Kebab Menu */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span
                            style={{
                                fontSize: "14.5px",
                                fontWeight: 800,
                                color: "var(--superadmin-text-main, #0F172A)",
                                letterSpacing: "-0.2px",
                                lineHeight: 1.3,
                                wordBreak: "break-word",
                            }}
                        >
                            {desk.desk_name}
                        </span>

                        {/* Desk Status Pill */}
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                fontSize: "10px",
                                fontWeight: 800,
                                letterSpacing: "0.4px",
                                textTransform: "uppercase",
                                background: visual.badgeBg,
                                color: visual.badgeColor,
                                border: visual.badgeBorder,
                            }}
                        >
                            {visual.key === "serving" && (
                                <span
                                    style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        background: visual.badgeColor,
                                        display: "inline-block",
                                    }}
                                />
                            )}
                            <span>{isHi ? visual.statusLabelHi : visual.statusLabel}</span>
                        </span>
                    </div>

                    {desk.desk_number && (
                        <div style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", marginTop: "2px", fontWeight: 600 }}>
                            {isHi ? `डेस्क #${desk.desk_number}` : `Desk #${desk.desk_number}`}
                        </div>
                    )}
                </div>

                {/* 3-Dots Kebab Action Menu */}
                <div ref={menuRef} style={{ position: "relative" }}>
                    <button
                        type="button"
                        onClick={() => setMenuOpen((prev) => !prev)}
                        aria-label="Desk Actions"
                        title={isHi ? "डेस्क विकल्प" : "Desk actions"}
                        style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "7px",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: menuOpen ? "var(--superadmin-sub-card, #F1F5F9)" : "transparent",
                            color: "var(--superadmin-text-sub, #475569)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            fontWeight: 800,
                            lineHeight: 1,
                            transition: "background 0.15s ease",
                        }}
                    >
                        ⋯
                    </button>

                    {menuOpen && (
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
                                zIndex: 30,
                                minWidth: "160px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                            }}
                        >
                            {/* 1. Edit Desk */}
                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false);
                                    if (onOpenEditDesk) onOpenEditDesk(desk, deptCode);
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

                            {/* 2. Toggle Status */}
                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false);
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
                                <span>{isHi ? "स्थिति बदलें (Toggle)" : "Toggle Status"}</span>
                            </button>

                            {/* 3. Unassign Staff (Only if assigned) */}
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
                                    <span>{isHi ? "कार्मिक अनअसाइन करें" : "Unassign Staff"}</span>
                                </button>
                            )}

                            <div style={{ height: "1px", background: "var(--superadmin-card-border, #E2E8F0)", margin: "3px 0" }} />

                            {/* 4. Delete Desk (Destructive, Red) */}
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

            {/* Body: Assigned Staff Info OR Unassigned Placeholder */}
            {hasStaff ? (
                <div
                    style={{
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                    }}
                >
                    {/* Staff Row: Avatar, Name, Role Chip */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                            style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "8px",
                                background: isStaffOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                                color: isStaffOnline ? "#059669" : "#64748B",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                fontWeight: 800,
                                flexShrink: 0,
                            }}
                        >
                            {initials}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                                style={{
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    color: "var(--superadmin-text-main, #0F172A)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    lineHeight: 1.25,
                                }}
                                title={staffName}
                            >
                                {staffName}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
                                <span
                                    style={{
                                        fontSize: "10.5px",
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        background: "rgba(2, 132, 199, 0.1)",
                                        color: "#0284C7",
                                        display: "inline-block",
                                    }}
                                >
                                    {cleanRole}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Presence Row: Dot + Online / Staff offline + Last active */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            paddingTop: "6px",
                            borderTop: "1px solid var(--superadmin-card-border, #E2E8F0)",
                            color: isStaffOnline ? "#059669" : "#D97706",
                            flexWrap: "wrap",
                        }}
                    >
                        <span
                            style={{
                                width: "6.5px",
                                height: "6.5px",
                                borderRadius: "50%",
                                background: isStaffOnline ? "#10B981" : "#F59E0B",
                                flexShrink: 0,
                            }}
                        />
                        <span>
                            {isStaffOnline
                                ? (isHi ? "ऑनलाइन" : "Online")
                                : (isHi ? "स्टाफ ऑफलाइन" : "Staff offline")}
                        </span>
                        {lastActiveFormatted && (
                            <span style={{ color: "var(--superadmin-text-muted, #64748B)", fontWeight: 500, fontSize: "10.5px" }}>
                                • {lastActiveFormatted}
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                <div
                    style={{
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        border: "1px dashed var(--superadmin-card-border, #CBD5E1)",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <div
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            background: "rgba(100, 116, 139, 0.1)",
                            color: "var(--superadmin-text-muted, #64748B)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            flexShrink: 0,
                        }}
                    >
                        👤
                    </div>
                    <div>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--superadmin-text-sub, #475569)" }}>
                            {isHi ? "असाइन नहीं" : "Unassigned"}
                        </div>
                        <div style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #94A3B8)" }}>
                            {isHi ? "कोई कार्मिक नियुक्त नहीं" : "No staff member assigned"}
                        </div>
                    </div>
                </div>
            )}

            {/* Footer: Exactly ONE Primary Button (Assign / Reassign) */}
            <button
                type="button"
                onClick={() => {
                    if (onOpenAssignDesk) {
                        onOpenAssignDesk(desk, String(desk.assigned_employee_id || ""));
                    }
                }}
                style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: hasStaff
                        ? "1px solid var(--superadmin-card-border, #CBD5E1)"
                        : "none",
                    background: hasStaff
                        ? "var(--superadmin-sub-card, #F1F5F9)"
                        : "#0284C7",
                    color: hasStaff
                        ? "var(--superadmin-text-main, #0F172A)"
                        : "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                    boxShadow: hasStaff ? "none" : "0 2px 6px rgba(2, 132, 199, 0.25)",
                }}
            >
                <span>{hasStaff ? (isHi ? "कार्मिक बदलें" : "Reassign Staff") : (isHi ? "+ कार्मिक सौंपें" : "+ Assign Staff")}</span>
            </button>
        </div>
    );
}

