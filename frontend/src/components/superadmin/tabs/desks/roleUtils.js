/**
 * roleUtils.js
 * Utilities for Desk Management: role mapping, avatar initials, state borders, and presence formatting.
 */

export function getCleanRoleLabel(role, isHi = false) {
    if (!role) return isHi ? "स्टाफ" : "Staff";
    const r = String(role).toLowerCase().trim();

    if (r.includes("patholog") || r.includes("lab")) {
        return isHi ? "पैथोलॉजिस्ट" : "Pathologist";
    }
    if (r.includes("radiolog") || r.includes("xray") || r.includes("x-ray") || r.includes("imaging")) {
        return isHi ? "रेडियोलॉजिस्ट" : "Radiologist";
    }
    if (r.includes("pharma")) {
        return isHi ? "फार्मासिस्ट" : "Pharmacist";
    }
    if (r.includes("cash") || r.includes("bill") || r.includes("account")) {
        return isHi ? "कैशियर / बिलिंग" : "Cashier & Billing";
    }
    if (r.includes("reception") || r.includes("front") || r.includes("desk")) {
        return isHi ? "रिसेप्शनिस्ट" : "Receptionist";
    }
    if (r.includes("nurse")) {
        return isHi ? "स्टाफ नर्स" : "Staff Nurse";
    }
    if (r.includes("tech")) {
        return isHi ? "तकनीशियन" : "Technician";
    }
    if (r.includes("doc")) {
        return isHi ? "चिकित्सक" : "Doctor";
    }

    // Capitalize raw role
    return r.charAt(0).toUpperCase() + r.slice(1);
}

export function getInitials(name) {
    if (!name) return "?";
    const parts = String(name).trim().replace(/^dr\.?\s+/i, "").split(/\s+/);
    if (parts.length === 0 || !parts[0]) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Returns visual border state for a desk card
 * - serving: blue solid 3px
 * - staff_offline: amber solid 3px
 * - active_staffed: green solid 3px
 * - unstaffed: dashed gray 3px
 * - inactive: solid gray 3px
 */
export function getDeskVisualState(desk) {
    const status = (desk.status || "").toUpperCase();
    const isServing = status === "BUSY" || status === "SERVING" || status === "OCCUPIED" || Boolean(desk.current_ticket_id);
    const isOpen = status === "AVAILABLE" || status === "ACTIVE" || isServing;
    const hasStaff = Boolean(desk.assigned_employee_id);
    const isStaffOnline = (desk.assigned_employee_status || "").toLowerCase() === "active";

    if (isServing) {
        return {
            key: "serving",
            borderLeft: "3px solid #0284C7",
            statusLabel: "Serving",
            statusLabelHi: "कार्यरत",
            badgeBg: "rgba(2, 132, 199, 0.15)",
            badgeColor: "#0284C7",
            badgeBorder: "1px solid rgba(2, 132, 199, 0.3)",
        };
    }

    if (hasStaff && !isStaffOnline) {
        return {
            key: "staff_offline",
            borderLeft: "3px solid #F59E0B",
            statusLabel: isOpen ? "Available" : "Inactive",
            statusLabelHi: isOpen ? "उपलब्ध" : "निष्क्रिय",
            badgeBg: isOpen ? "rgba(16, 185, 129, 0.12)" : "rgba(100, 116, 139, 0.12)",
            badgeColor: isOpen ? "#059669" : "#64748B",
            badgeBorder: isOpen ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(100, 116, 139, 0.2)",
        };
    }

    if (isOpen && hasStaff && isStaffOnline) {
        return {
            key: "active_staffed",
            borderLeft: "3px solid #10B981",
            statusLabel: "Available",
            statusLabelHi: "उपलब्ध",
            badgeBg: "rgba(16, 185, 129, 0.15)",
            badgeColor: "#059669",
            badgeBorder: "1px solid rgba(16, 185, 129, 0.3)",
        };
    }

    if (!hasStaff) {
        return {
            key: "unstaffed",
            borderLeft: "3px dashed #CBD5E1",
            statusLabel: isOpen ? "Available" : "Inactive",
            statusLabelHi: isOpen ? "उपलब्ध" : "निष्क्रिय",
            badgeBg: isOpen ? "rgba(2, 132, 199, 0.1)" : "rgba(100, 116, 139, 0.12)",
            badgeColor: isOpen ? "#0284C7" : "#64748B",
            badgeBorder: isOpen ? "1px solid rgba(2, 132, 199, 0.25)" : "1px solid rgba(100, 116, 139, 0.2)",
        };
    }

    // Inactive desk
    return {
        key: "inactive",
        borderLeft: "3px solid #94A3B8",
        statusLabel: "Inactive",
        statusLabelHi: "निष्क्रिय",
        badgeBg: "rgba(100, 116, 139, 0.12)",
        badgeColor: "#64748B",
        badgeBorder: "1px solid rgba(100, 116, 139, 0.25)",
    };
}

