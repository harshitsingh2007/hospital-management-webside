import React from "react";
import {
    IconDesk,
    IconCheckCircle,
    IconActivity,
    IconAlertTriangle,
    IconUser,
} from "../../SuperAdminIcons";

export default function DeskSummaryStrip({
    totalDesks = 0,
    activeDesks = 0,
    servingDesks = 0,
    staffOfflineDesks = 0,
    unstaffedDesks = 0,
    statusFilter = "all",
    onSelectStatusFilter,
    isHi = false,
}) {
    const cards = [
        {
            id: "all",
            label: isHi ? "कुल डेस्क" : "Total Desks",
            count: totalDesks,
            icon: IconDesk,
            color: "#0284C7",
            bg: "rgba(2, 132, 199, 0.08)",
            border: "rgba(2, 132, 199, 0.25)",
        },
        {
            id: "active",
            label: isHi ? "सक्रिय डेस्क" : "Active Desks",
            count: activeDesks,
            icon: IconCheckCircle,
            color: "#10B981",
            bg: "rgba(16, 185, 129, 0.08)",
            border: "rgba(16, 185, 129, 0.25)",
        },
        {
            id: "serving",
            label: isHi ? "वर्तमान में कार्यरत" : "Serving Now",
            count: servingDesks,
            icon: IconActivity,
            color: "#6366F1",
            bg: "rgba(99, 102, 241, 0.08)",
            border: "rgba(99, 102, 241, 0.25)",
        },
        {
            id: "staff_offline",
            label: isHi ? "स्टाफ ऑफलाइन" : "Staff Offline",
            count: staffOfflineDesks,
            icon: IconAlertTriangle,
            color: "#D97706",
            bg: "rgba(245, 158, 11, 0.08)",
            border: "rgba(245, 158, 11, 0.25)",
            badgeColor: staffOfflineDesks > 0 ? "#D97706" : undefined,
        },
        {
            id: "unstaffed",
            label: isHi ? "असाइन नहीं" : "Unstaffed Desks",
            count: unstaffedDesks,
            icon: IconUser,
            color: "#64748B",
            bg: "rgba(100, 116, 139, 0.08)",
            border: "rgba(100, 116, 139, 0.25)",
        },
    ];

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "16px",
                overflowX: "auto",
                paddingBottom: "4px",
            }}
        >
            {cards.map((c) => {
                const IconComponent = c.icon;
                const isSelected = statusFilter === c.id;

                return (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                            if (onSelectStatusFilter) {
                                // Toggle between this filter and "all"
                                onSelectStatusFilter(isSelected && c.id !== "all" ? "all" : c.id);
                            }
                        }}
                        style={{
                            background: isSelected
                                ? c.bg
                                : "var(--superadmin-card-bg, #FFFFFF)",
                            border: isSelected
                                ? `1.5px solid ${c.color}`
                                : "1px solid var(--superadmin-card-border, #E2E8F0)",
                            borderRadius: "14px",
                            padding: "12px 14px",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.18s ease",
                            boxShadow: isSelected
                                ? `0 4px 12px ${c.bg}`
                                : "0 1px 3px rgba(0, 0, 0, 0.03)",
                            position: "relative",
                            outline: "none",
                            minWidth: "160px",
                        }}
                        title={
                            isSelected
                                ? (isHi ? "फ़िल्टर हटाएं" : "Click to clear filter")
                                : (isHi ? `${c.label} फ़िल्टर करें` : `Filter by ${c.label}`)
                        }
                    >
                        <div
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "10px",
                                background: c.bg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <IconComponent size={18} color={c.color} />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                                style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: isSelected ? c.color : "var(--superadmin-text-muted, #64748B)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.4px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {c.label}
                            </div>
                            <div
                                style={{
                                    fontSize: "20px",
                                    fontWeight: 800,
                                    color: isSelected ? c.color : "var(--superadmin-text-main, #0F172A)",
                                    lineHeight: 1.2,
                                    marginTop: "2px",
                                }}
                            >
                                {c.count}
                            </div>
                        </div>

                        {isSelected && (
                            <span
                                style={{
                                    position: "absolute",
                                    top: "6px",
                                    right: "8px",
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: c.color,
                                }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

