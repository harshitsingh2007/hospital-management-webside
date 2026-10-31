import React from "react";
import { IconSearch, IconX } from "../../SuperAdminIcons";
import { getCategoryLabel } from "../../../../utils/i18n";

export default function DeskToolbar({
    searchQuery = "",
    onSearchChange,
    selectedDept = "all",
    onSelectDept,
    departmentList = [], // Array of { dept_code, name, total_desks }
    statusFilter = "all",
    onStatusFilterChange,
    viewMode = "grid", // "grid" | "table"
    onViewModeChange,
    allCollapsed = false,
    onToggleCollapseAll,
    language = "en",
    isHi = false,
}) {
    const statusOptions = [
        { value: "all", label: isHi ? "सभी स्थितियां" : "All Statuses" },
        { value: "active", label: isHi ? "सक्रिय / उपलब्ध" : "Available / Open" },
        { value: "serving", label: isHi ? "कार्यरत (Serving)" : "Serving Now" },
        { value: "inactive", label: isHi ? "निष्क्रिय" : "Inactive" },
        { value: "staff_offline", label: isHi ? "स्टाफ ऑफलाइन" : "Staff Offline" },
        { value: "unstaffed", label: isHi ? "असाइन नहीं" : "Unstaffed" },
    ];

    const totalAllDesks = departmentList.reduce((acc, d) => acc + (d.total_desks || 0), 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
            {/* Top Toolbar Row: Search, Status Dropdown, View Toggle & Collapse */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                }}
            >
                {/* Search Box */}
                <div
                    style={{
                        position: "relative",
                        flex: "1 1 240px",
                        minWidth: "220px",
                    }}
                >
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                        placeholder={
                            isHi
                                ? "डेस्क नाम, कार्मिक या विभाग से खोजें..."
                                : "Filter desks by name, staff or dept..."
                        }
                        style={{
                            width: "100%",
                            padding: "9px 34px 9px 34px",
                            borderRadius: "10px",
                            border: "1px solid var(--superadmin-input-border, #CBD5E1)",
                            background: "var(--superadmin-input-bg, #FFFFFF)",
                            color: "var(--superadmin-text-main, #0F172A)",
                            fontSize: "12.5px",
                            outline: "none",
                            transition: "border-color 0.15s ease",
                        }}
                    />
                    <span
                        style={{
                            position: "absolute",
                            left: "11px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            display: "flex",
                            alignItems: "center",
                            color: "var(--superadmin-text-muted, #94A3B8)",
                            pointerEvents: "none",
                        }}
                    >
                        <IconSearch size={14} color="#94A3B8" />
                    </span>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => onSearchChange && onSearchChange("")}
                            style={{
                                position: "absolute",
                                right: "9px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                padding: "3px",
                                cursor: "pointer",
                                color: "var(--superadmin-text-muted, #94A3B8)",
                                display: "flex",
                                alignItems: "center",
                            }}
                            title={isHi ? "खोज हटाएं" : "Clear search"}
                        >
                            <IconX size={13} color="#94A3B8" />
                        </button>
                    )}
                </div>

                {/* Right controls: Status filter, Expand/Collapse, Grid/Table Switcher */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {/* Status Filter Dropdown */}
                    <select
                        value={statusFilter}
                        onChange={(e) => onStatusFilterChange && onStatusFilterChange(e.target.value)}
                        style={{
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            background: "var(--superadmin-card-bg, #FFFFFF)",
                            color: "var(--superadmin-text-main, #0F172A)",
                            fontSize: "12px",
                            fontWeight: 700,
                            outline: "none",
                            cursor: "pointer",
                        }}
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    {/* Expand/Collapse All Sections */}
                    {onToggleCollapseAll && (
                        <button
                            type="button"
                            onClick={onToggleCollapseAll}
                            style={{
                                padding: "8px 12px",
                                borderRadius: "10px",
                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                background: "var(--superadmin-sub-card, #F8FAFC)",
                                color: "var(--superadmin-text-sub, #475569)",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                whiteSpace: "nowrap",
                            }}
                            title={allCollapsed ? (isHi ? "सभी विभाग खोलें" : "Expand all departments") : (isHi ? "सभी विभाग समेटें" : "Collapse all departments")}
                        >
                            <span>{allCollapsed ? (isHi ? "सब खोलें" : "Expand All") : (isHi ? "सब समेटें" : "Collapse All")}</span>
                        </button>
                    )}

                    {/* Grid / Table View Switcher */}
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            background: "var(--superadmin-sub-card, #F1F5F9)",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            borderRadius: "10px",
                            padding: "3px",
                            gap: "2px",
                        }}
                    >
                        {/* Grid Mode Button */}
                        <button
                            type="button"
                            onClick={() => onViewModeChange && onViewModeChange("grid")}
                            aria-label="Grid View"
                            title={isHi ? "ग्रिड दृश्य" : "Grid View"}
                            style={{
                                background: viewMode === "grid" ? "#0284C7" : "transparent",
                                color: viewMode === "grid" ? "#FFFFFF" : "var(--superadmin-text-muted, #64748B)",
                                border: "none",
                                borderRadius: "7px",
                                padding: "5px 9px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                transition: "all 0.15s ease",
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                            <span className="desk-view-text">{isHi ? "ग्रिड" : "Grid"}</span>
                        </button>

                        {/* Table Mode Button */}
                        <button
                            type="button"
                            onClick={() => onViewModeChange && onViewModeChange("table")}
                            aria-label="Table View"
                            title={isHi ? "तालिका दृश्य" : "Table View"}
                            style={{
                                background: viewMode === "table" ? "#0284C7" : "transparent",
                                color: viewMode === "table" ? "#FFFFFF" : "var(--superadmin-text-muted, #64748B)",
                                border: "none",
                                borderRadius: "7px",
                                padding: "5px 9px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                transition: "all 0.15s ease",
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                            <span className="desk-view-text">{isHi ? "तालिका" : "Table"}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Department Filter Chips Row */}
            {departmentList.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        overflowX: "auto",
                        paddingBottom: "4px",
                        scrollbarWidth: "thin",
                    }}
                >
                    {/* All Departments Chip */}
                    <button
                        type="button"
                        onClick={() => onSelectDept && onSelectDept("all")}
                        style={{
                            padding: "5px 12px",
                            borderRadius: "999px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                            background: selectedDept === "all" ? "#0284C7" : "var(--superadmin-sub-card, #F1F5F9)",
                            color: selectedDept === "all" ? "#FFFFFF" : "var(--superadmin-text-sub, #475569)",
                            border: selectedDept === "all" ? "1px solid #0284C7" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                            transition: "all 0.15s ease",
                        }}
                    >
                        {isHi ? "सभी विभाग" : "All Departments"} ({totalAllDesks})
                    </button>

                    {/* Individual Department Chips */}
                    {departmentList.map((dept) => {
                        const isSelected = selectedDept === dept.dept_code;
                        const label = getCategoryLabel(dept.dept_code, language) || dept.name;

                        return (
                            <button
                                key={dept.dept_code}
                                type="button"
                                onClick={() => onSelectDept && onSelectDept(isSelected ? "all" : dept.dept_code)}
                                style={{
                                    padding: "5px 12px",
                                    borderRadius: "999px",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    cursor: "pointer",
                                    background: isSelected ? "#0284C7" : "var(--superadmin-card-bg, #FFFFFF)",
                                    color: isSelected ? "#FFFFFF" : "var(--superadmin-text-sub, #475569)",
                                    border: isSelected ? "1px solid #0284C7" : "1px solid var(--superadmin-card-border, #CBD5E1)",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                {label} ({dept.total_desks || 0})
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

