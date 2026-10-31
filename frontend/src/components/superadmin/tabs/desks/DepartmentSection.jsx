import React, { useState, useRef, useEffect } from "react";
import { IconPlus, IconStethoscope } from "../../SuperAdminIcons";
import { getCategoryLabel } from "../../../../utils/i18n";
import DeskCard from "./DeskCard";

function getDepartmentGlyph(code) {
    const c = String(code || "").toLowerCase();
    if (c.includes("consult") || c.includes("opd") || c.includes("general")) return "🩺";
    if (c.includes("pharma")) return "💊";
    if (c.includes("lab") || c.includes("patholog")) return "🔬";
    if (c.includes("radio") || c.includes("xray") || c.includes("imaging")) return "🩻";
    if (c.includes("emerg") || c.includes("triage")) return "🚨";
    if (c.includes("bill") || c.includes("cash")) return "💳";
    if (c.includes("recept") || c.includes("desk")) return "🛎️";
    return "🏥";
}

export default function DepartmentSection({
    deptGroup,
    isCollapsed = false,
    onToggleCollapse,
    onBulkDeskStatus,
    onOpenAddDesk,
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
    const [deptMenuOpen, setDeptMenuOpen] = useState(false);
    const deptMenuRef = useRef(null);

    useEffect(() => {
        if (!deptMenuOpen) return;
        const handleClickOutside = (e) => {
            if (deptMenuRef.current && !deptMenuRef.current.contains(e.target)) {
                setDeptMenuOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === "Escape") setDeptMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [deptMenuOpen]);

    const desks = deptGroup.desks || [];
    const totalDesks = deptGroup.total_desks || desks.length;
    const activeDesks = deptGroup.active_desks || desks.filter((d) => ["AVAILABLE", "ACTIVE", "BUSY", "SERVING"].includes((d.status || "").toUpperCase())).length;
    const staffedDesks = desks.filter((d) => Boolean(d.assigned_employee_id)).length;
    const deptLabel = getCategoryLabel(deptGroup.dept_code, language) || deptGroup.name;
    const glyph = getDepartmentGlyph(deptGroup.dept_code);

    const handleBulkActivate = () => {
        setDeptMenuOpen(false);
        const confirmMsg = isHi
            ? `क्या आप वाकई ${deptLabel} के सभी ${desks.length} डेस्क को सक्रिय (Activate) करना चाहते हैं?`
            : `Are you sure you want to activate all ${desks.length} desks in ${deptLabel}?`;

        if (showConfirm) {
            showConfirm({
                title: isHi ? "सभी डेस्क सक्रिय करें" : "Activate All Desks",
                message: confirmMsg,
                confirmText: isHi ? "हाँ, सभी सक्रिय करें" : "Activate All",
                cancelText: isHi ? "रद्द करें" : "Cancel",
                onConfirm: () => {
                    if (onBulkDeskStatus) onBulkDeskStatus(deptGroup.dept_code, "AVAILABLE");
                },
            });
        } else {
            if (onBulkDeskStatus) onBulkDeskStatus(deptGroup.dept_code, "AVAILABLE");
        }
    };

    const handleBulkDeactivate = () => {
        setDeptMenuOpen(false);
        const confirmMsg = isHi
            ? `क्या आप वाकई ${deptLabel} के सभी ${desks.length} डेस्क को निष्क्रिय (Deactivate) करना चाहते हैं?`
            : `Are you sure you want to deactivate all ${desks.length} desks in ${deptLabel}?`;

        if (showConfirm) {
            showConfirm({
                title: isHi ? "सभी डेस्क निष्क्रिय करें" : "Deactivate All Desks",
                message: confirmMsg,
                confirmText: isHi ? "हाँ, सभी निष्क्रिय करें" : "Deactivate All",
                cancelText: isHi ? "रद्द करें" : "Cancel",
                isDestructive: true,
                onConfirm: () => {
                    if (onBulkDeskStatus) onBulkDeskStatus(deptGroup.dept_code, "UNAVAILABLE");
                },
            });
        } else {
            if (onBulkDeskStatus) onBulkDeskStatus(deptGroup.dept_code, "UNAVAILABLE");
        }
    };

    // ---------------------------------------------------------
    // Case 1: Departments with ZERO Desks (Slim row collapsed)
    // ---------------------------------------------------------
    if (desks.length === 0) {
        return (
            <div
                style={{
                    background: "var(--superadmin-sub-card, #F8FAFC)",
                    border: "1px dashed var(--superadmin-card-border, #CBD5E1)",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>{glyph}</span>
                    <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--superadmin-text-main, #0F172A)" }}>
                        {deptLabel}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", background: "rgba(100, 116, 139, 0.1)", padding: "1px 7px", borderRadius: "999px" }}>
                        {isHi ? "कोई डेस्क नहीं" : "No desks yet"}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => onOpenAddDesk && onOpenAddDesk(deptGroup.dept_code)}
                    style={{
                        padding: "5px 12px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        background: "var(--superadmin-card-bg, #FFFFFF)",
                        color: "#0284C7",
                        border: "1px solid #BAE6FD",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        transition: "all 0.15s ease",
                    }}
                >
                    <IconPlus size={12} color="#0284C7" />
                    <span>{isHi ? "डेस्क जोड़ें" : "+ Add Desk"}</span>
                </button>
            </div>
        );
    }

    // ---------------------------------------------------------
    // Case 2: Standard Department with Desks
    // ---------------------------------------------------------
    return (
        <div
            style={{
                background: "var(--superadmin-sub-card, #F8FAFC)",
                borderRadius: "14px",
                padding: "14px",
                border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
            }}
        >
            {/* Header Row: Glyph + Name + Counts + Ghost Add + Kebab Menu + Chevron */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                    paddingBottom: isCollapsed ? "0" : "8px",
                    borderBottom: isCollapsed ? "none" : "1px solid var(--superadmin-card-border, #E2E8F0)",
                }}
            >
                {/* Left: Collapse toggle + Icon + Name + Badges */}
                <div
                    onClick={onToggleCollapse}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        userSelect: "none",
                        flexWrap: "wrap",
                    }}
                    title={isCollapsed ? (isHi ? "विभाग खोलें" : "Expand department") : (isHi ? "विभाग समेटें" : "Collapse department")}
                >
                    {/* Chevron Indicator */}
                    <span
                        style={{
                            fontSize: "12px",
                            color: "var(--superadmin-text-muted, #64748B)",
                            transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                            transition: "transform 0.18s ease",
                            display: "inline-block",
                        }}
                    >
                        ▼
                    </span>

                    <span style={{ fontSize: "16px" }}>{glyph}</span>

                    <h4
                        style={{
                            margin: 0,
                            fontSize: "15px",
                            color: "var(--superadmin-text-main, #0F172A)",
                            fontWeight: 800,
                        }}
                    >
                        {deptLabel}
                    </h4>

                    {/* Active Count Pill */}
                    <span
                        style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "#0284C7",
                            background: "rgba(2, 132, 199, 0.12)",
                            border: "1px solid rgba(2, 132, 199, 0.25)",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            letterSpacing: "0.2px",
                        }}
                    >
                        {activeDesks}/{totalDesks} {isHi ? "सक्रिय" : "Active"}
                    </span>

                    {/* Staffed Count Pill */}
                    <span
                        style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: staffedDesks === totalDesks ? "#059669" : "var(--superadmin-text-muted, #64748B)",
                            background: staffedDesks === totalDesks ? "rgba(16, 185, 129, 0.1)" : "rgba(100, 116, 139, 0.1)",
                            border: staffedDesks === totalDesks ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(100, 116, 139, 0.2)",
                            padding: "2px 8px",
                            borderRadius: "6px",
                        }}
                    >
                        {isHi ? `स्टाफ ${staffedDesks}/${totalDesks}` : `Staffed ${staffedDesks}/${totalDesks}`}
                    </span>
                </div>

                {/* Right: Small Ghost Add Desk Button + Department 3-dots Menu */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* Ghost + Add Desk Button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenAddDesk) onOpenAddDesk(deptGroup.dept_code);
                        }}
                        style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "var(--superadmin-card-bg, #FFFFFF)",
                            color: "#0284C7",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            borderRadius: "7px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.15s ease",
                        }}
                        title={isHi ? "इस विभाग में डेस्क जोड़ें" : "Add desk to this department"}
                    >
                        <IconPlus size={11} color="#0284C7" />
                        <span>{isHi ? "डेस्क जोड़ें" : "+ Add Desk"}</span>
                    </button>

                    {/* 3-dots Menu for Bulk Actions */}
                    <div ref={deptMenuRef} style={{ position: "relative" }}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setDeptMenuOpen((prev) => !prev);
                            }}
                            aria-label="Department Bulk Actions"
                            title={isHi ? "विभाग विकल्प" : "Department actions"}
                            style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "7px",
                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                background: deptMenuOpen ? "var(--superadmin-sub-card, #F1F5F9)" : "var(--superadmin-card-bg, #FFFFFF)",
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

                        {deptMenuOpen && (
                            <div
                                style={{
                                    position: "absolute",
                                    right: 0,
                                    top: "30px",
                                    background: "var(--superadmin-card-bg, #FFFFFF)",
                                    border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                    borderRadius: "10px",
                                    boxShadow: "0 10px 25px -4px rgba(0, 0, 0, 0.15)",
                                    padding: "4px",
                                    zIndex: 30,
                                    minWidth: "170px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={handleBulkActivate}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "7px 10px",
                                        background: "none",
                                        border: "none",
                                        borderRadius: "6px",
                                        color: "#059669",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        width: "100%",
                                    }}
                                >
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
                                    <span>{isHi ? "सभी डेस्क सक्रिय करें" : "Activate all desks"}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleBulkDeactivate}
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
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        width: "100%",
                                    }}
                                >
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444" }} />
                                    <span>{isHi ? "सभी डेस्क निष्क्रिय करें" : "Deactivate all desks"}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Desks Grid (When not collapsed) */}
            {!isCollapsed && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: "14px",
                        width: "100%",
                    }}
                >
                    {desks.map((desk) => (
                        <DeskCard
                            key={desk.id}
                            desk={desk}
                            deptCode={deptGroup.dept_code}
                            onOpenEditDesk={onOpenEditDesk}
                            onToggleDeskStatus={onToggleDeskStatus}
                            onOpenAssignDesk={onOpenAssignDesk}
                            onUnassignDesk={onUnassignDesk}
                            onDeleteDesk={onDeleteDesk}
                            formatRelativeLogin={formatRelativeLogin}
                            showConfirm={showConfirm}
                            isHi={isHi}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

