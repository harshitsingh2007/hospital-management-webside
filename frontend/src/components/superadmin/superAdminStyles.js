// Common styles for SuperAdmin components and tabs

export const standaloneCardStyle = {
    background: "var(--superadmin-card-bg, #FFFFFF)",
    borderRadius: "24px",
    border: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
    padding: "26px",
    boxShadow: "var(--superadmin-card-shadow, 0 4px 20px -2px rgba(2, 132, 199, 0.04))",
    color: "var(--superadmin-text-main, #0F172A)",
};

export const feedbackToastStyle = {
    margin: "0 0 18px 0",
    padding: "12px 20px",
    borderRadius: "12px",
    background: "#F0F9FF",
    border: "1px solid #BAE6FD",
    color: "#0369A1",
    fontSize: "13.5px",
    fontWeight: 700,
    textAlign: "center",
    boxShadow: "0 4px 12px rgba(2, 132, 199, 0.12)",
};

export const searchInputStyle = {
    width: "100%",
    padding: "9px 14px",
    borderRadius: "10px",
    border: "1px solid var(--superadmin-input-border, #CBD5E1)",
    background: "var(--superadmin-input-bg, #F8FAFC)",
    color: "var(--superadmin-text-main, #0F172A)",
    fontSize: "12.5px",
    outline: "none",
};

export const hospitalCardStyle = {
    borderRadius: "18px",
    padding: "18px",
    border: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
    background: "var(--superadmin-card-bg, #FFFFFF)",
    color: "var(--superadmin-text-main, #0F172A)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    transition: "all 0.15s ease",
};

export const hospitalStatusBadgeStyle = (status) => ({
    fontSize: "10px",
    fontWeight: 800,
    padding: "2px 7px",
    borderRadius: "6px",
    background: status === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
    color: status === "active" ? "#047857" : "#B91C1C",
    border: status === "active" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
});

export const primarySmallBtnStyle = {
    flex: 1,
    padding: "9px 12px",
    borderRadius: "10px",
    background: "#0284C7",
    color: "#FFFFFF",
    border: "none",
    fontWeight: 800,
    fontSize: "12px",
    cursor: "pointer",
    transition: "background 0.15s ease",
};

export const secondarySmallBtnStyle = {
    padding: "9px 12px",
    borderRadius: "10px",
    background: "var(--superadmin-sub-card, #F8FAFC)",
    color: "var(--superadmin-text-sub, #334155)",
    border: "1px solid var(--superadmin-input-border, #CBD5E1)",
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
};

export const actionBtnStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "9px 16px",
    borderRadius: "10px",
    background: "#0284C7",
    color: "#FFFFFF",
    border: "none",
    fontWeight: 800,
    fontSize: "12.5px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
};

export const sidebarSelectStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid var(--superadmin-input-border, #CBD5E1)",
    background: "var(--superadmin-input-bg, #F8FAFC)",
    color: "var(--superadmin-text-main, #0F172A)",
    fontSize: "13px",
    fontWeight: 700,
    outline: "none",
};

export const tableThStyle = {
    padding: "12px 14px",
    fontWeight: 800,
    color: "var(--superadmin-text-muted, #475569)",
    fontSize: "11.5px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};

export const tableTdStyle = {
    padding: "12px 14px",
    color: "var(--superadmin-text-sub, #334155)",
};

export const roleBadgeStyle = (role) => {
    if (role === "doctor") return { padding: "2px 7px", borderRadius: "6px", fontSize: "10px", fontWeight: 800, background: "#E0F2FE", color: "#075985", border: "1px solid #7DD3FC" };
    if (role === "admin") return { padding: "2px 7px", borderRadius: "6px", fontSize: "10px", fontWeight: 800, background: "#FEF3C7", color: "#92400E", border: "1px solid #F59E0B" };
    if (role === "receptionist") return { padding: "2px 7px", borderRadius: "6px", fontSize: "10px", fontWeight: 800, background: "#F3E8FF", color: "#6B21A8", border: "1px solid #C084FC" };
    return { padding: "2px 7px", borderRadius: "6px", fontSize: "10px", fontWeight: 800, background: "#DBEAFE", color: "#1E40AF", border: "1px solid #93C5FD" };
};

export const copySmallBtnStyle = {
    padding: "4px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(2, 132, 199, 0.3)",
    background: "rgba(2, 132, 199, 0.15)",
    color: "#38BDF8",
    fontSize: "11px",
    cursor: "pointer",
};

export const editSmallBtnStyle = {
    padding: "4px 10px",
    borderRadius: "8px",
    border: "1px solid var(--superadmin-input-border, #CBD5E1)",
    background: "var(--superadmin-sub-card, #F8FAFC)",
    color: "var(--superadmin-text-sub, #334155)",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
};

export const deleteSmallBtnStyle = {
    padding: "4px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    background: "rgba(239, 68, 68, 0.12)",
    color: "#EF4444",
    fontSize: "11px",
    cursor: "pointer",
};

export const deptDeskBoxStyle = {
    background: "var(--superadmin-sub-card, #F8FAFC)",
    borderRadius: "14px",
    padding: "14px",
    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
    color: "var(--superadmin-text-main, #0F172A)",
};

export const deskCardItemStyle = (status) => {
    const s = (status || "").toUpperCase();
    const isActive = s === "ACTIVE";
    const isBusy = s === "BUSY";
    const isAvailable = s === "AVAILABLE";

    return {
        padding: "14px 16px",
        borderRadius: "14px",
        background: isActive
            ? "rgba(2, 132, 199, 0.05)"
            : isBusy
            ? "rgba(245, 158, 11, 0.05)"
            : "var(--superadmin-card-bg, #FFFFFF)",
        border: isActive
            ? "1.5px solid #0284C7"
            : isBusy
            ? "1.5px solid #F59E0B"
            : isAvailable
            ? "1.5px solid #BAE6FD"
            : "1px solid var(--superadmin-card-border, #E2E8F0)",
        boxShadow: "0 2px 8px -2px rgba(15, 23, 42, 0.06)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        color: "var(--superadmin-text-main, #0F172A)",
        transition: "all 0.2s ease",
    };
};

export const deskStatusPillStyle = (status) => {
    const s = (status || "").toUpperCase();
    if (s === "ACTIVE") {
        return {
            padding: "2px 8px",
            borderRadius: "6px",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.4px",
            background: "#0284C7",
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
        };
    }
    if (s === "BUSY") {
        return {
            padding: "2px 8px",
            borderRadius: "6px",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.4px",
            background: "#D97706",
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
        };
    }
    if (s === "AVAILABLE") {
        return {
            padding: "2px 8px",
            borderRadius: "6px",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.4px",
            background: "rgba(2, 132, 199, 0.12)",
            color: "#0284C7",
            border: "1px solid rgba(2, 132, 199, 0.3)",
            display: "inline-flex",
            alignItems: "center",
        };
    }
    return {
        padding: "2px 8px",
        borderRadius: "6px",
        fontSize: "10px",
        fontWeight: 800,
        letterSpacing: "0.4px",
        background: "rgba(100, 116, 139, 0.12)",
        color: "#475569",
        border: "1px solid rgba(100, 116, 139, 0.25)",
        display: "inline-flex",
        alignItems: "center",
    };
};

export const deleteDeskIconBtnStyle = {
    background: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "7px",
    color: "#EF4444",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    padding: 0,
    transition: "all 0.15s ease",
};

export const deleteDeptIconBtnStyle = {
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "6px",
    color: "#EF4444",
    fontSize: "11px",
    cursor: "pointer",
    padding: "3px 6px",
};

export const toggleDeskBtnStyle = {
    padding: "7px 12px",
    borderRadius: "8px",
    border: "1px solid var(--superadmin-card-border, #CBD5E1)",
    background: "var(--superadmin-sub-card, #F8FAFC)",
    color: "var(--superadmin-text-sub, #334155)",
    fontSize: "11.5px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
};

export const deptCardStyle = {
    background: "var(--superadmin-card-bg, #FFFFFF)",
    borderRadius: "12px",
    padding: "14px",
    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
    color: "var(--superadmin-text-main, #0F172A)",
};

export const fieldLabelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--superadmin-text-sub, #334155)",
    marginBottom: "4px",
};

export const fieldInputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid var(--superadmin-input-border, #CBD5E1)",
    fontSize: "13px",
    outline: "none",
    background: "var(--superadmin-input-bg, #FFFFFF)",
    color: "var(--superadmin-text-main, #0F172A)",
    boxSizing: "border-box",
};

export const modalOverlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.65)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: "20px",
};

export const modalContentStyle = {
    background: "var(--superadmin-card-bg, #FFFFFF)",
    borderRadius: "22px",
    maxWidth: "500px",
    width: "100%",
    padding: "26px",
    boxShadow: "0 24px 48px -10px rgba(0, 0, 0, 0.5)",
    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
    color: "var(--superadmin-text-main, #0F172A)",
    maxHeight: "90vh",
    overflowY: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
};

export const modalCloseIconBtnStyle = {
    background: "none",
    border: "none",
    fontSize: "18px",
    color: "#94A3B8",
    cursor: "pointer",
};

export const modalCancelBtnStyle = {
    flex: 1,
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid var(--superadmin-input-border, #CBD5E1)",
    background: "var(--superadmin-sub-card, #F8FAFC)",
    color: "var(--superadmin-text-muted, #64748B)",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
};

export const modalSubmitBtnStyle = {
    flex: 1,
    padding: "10px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
    color: "#FFFFFF",
    fontWeight: 800,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)",
};
