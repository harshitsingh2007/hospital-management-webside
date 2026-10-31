import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    IconHospital,
    IconPlus,
    IconDesk,
    IconSearch,
} from "../SuperAdminIcons";
import { standaloneCardStyle, actionBtnStyle } from "../superAdminStyles";
import "../SuperAdmin.css";

import DeskSummaryStrip from "./desks/DeskSummaryStrip";
import DeskToolbar from "./desks/DeskToolbar";
import DepartmentSection from "./desks/DepartmentSection";
import DeskTable from "./desks/DeskTable";
import { getCategoryLabel } from "../../../utils/i18n";

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
    // -------------------------------------------------------------
    // View Mode: Grid vs Table with localStorage persistence
    // -------------------------------------------------------------
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem("superadmin_desk_view_mode") || "grid";
        } catch (_) {
            return "grid";
        }
    });

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem("superadmin_desk_view_mode", mode);
        } catch (_) {}
    };

    // -------------------------------------------------------------
    // Filter States: Status filter & Department Chip selection
    // -------------------------------------------------------------
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedDept, setSelectedDept] = useState("all");

    // -------------------------------------------------------------
    // Collapsible Departments State (Map of dept_code -> boolean)
    // -------------------------------------------------------------
    const [collapsedDepts, setCollapsedDepts] = useState({});
    const [allCollapsed, setAllCollapsed] = useState(false);

    const toggleDeptCollapse = (deptCode) => {
        setCollapsedDepts((prev) => ({
            ...prev,
            [deptCode]: !prev[deptCode],
        }));
    };

    const handleToggleCollapseAll = () => {
        const nextState = !allCollapsed;
        setAllCollapsed(nextState);
        const updated = {};
        (hospitalDesksData.departments || []).forEach((d) => {
            updated[d.dept_code] = nextState;
        });
        setCollapsedDepts(updated);
    };

    // -------------------------------------------------------------
    // Compute Summary Stats across all desks in the hospital
    // -------------------------------------------------------------
    const rawGroups = hospitalDesksData.departments || [];

    const allDesksFlat = useMemo(() => {
        const list = [];
        rawGroups.forEach((dept) => {
            (dept.desks || []).forEach((desk) => {
                list.push({
                    ...desk,
                    dept_code: dept.dept_code,
                    dept_name: dept.name,
                });
            });
        });
        return list;
    }, [rawGroups]);

    const totalDesksCount = allDesksFlat.length;
    const activeDesksCount = allDesksFlat.filter((d) =>
        ["AVAILABLE", "ACTIVE", "BUSY", "SERVING"].includes((d.status || "").toUpperCase())
    ).length;
    const servingDesksCount = allDesksFlat.filter(
        (d) =>
            (d.status || "").toUpperCase() === "BUSY" ||
            (d.status || "").toUpperCase() === "SERVING" ||
            Boolean(d.current_ticket_id)
    ).length;
    const staffOfflineDesksCount = allDesksFlat.filter(
        (d) => Boolean(d.assigned_employee_id) && (d.assigned_employee_status || "").toLowerCase() !== "active"
    ).length;
    const unstaffedDesksCount = allDesksFlat.filter((d) => !d.assigned_employee_id).length;

    // List of departments with total desks for the toolbar chips
    const deptChipList = useMemo(() => {
        return rawGroups.map((d) => ({
            dept_code: d.dept_code,
            name: d.name,
            total_desks: (d.desks || []).length,
        }));
    }, [rawGroups]);

    // -------------------------------------------------------------
    // Filter Departments and Desks based on search, dept, status
    // -------------------------------------------------------------
    const q = (deskSearchQuery || "").trim().toLowerCase();

    const filteredDeptGroups = useMemo(() => {
        return rawGroups
            .filter((deptGroup) => {
                if (selectedDept !== "all" && deptGroup.dept_code !== selectedDept) return false;
                return true;
            })
            .map((deptGroup) => {
                const matchingDesks = (deptGroup.desks || []).filter((desk) => {
                    // 1. Text Search matching
                    if (q) {
                        const matchesDeskName = (desk.desk_name || "").toLowerCase().includes(q);
                        const matchesDeskNumber = String(desk.desk_number || "").includes(q);
                        const matchesDeptCode = (deptGroup.dept_code || "").toLowerCase().includes(q);
                        const matchesDeptName = (deptGroup.name || "").toLowerCase().includes(q);
                        const matchesDeptLabel = getCategoryLabel(deptGroup.dept_code, language).toLowerCase().includes(q);
                        const matchesStaffName = (desk.assigned_employee_name || desk.staff_name || "").toLowerCase().includes(q);
                        const matchesStaffRole = (desk.assigned_employee_role || "").toLowerCase().includes(q);

                        if (
                            !matchesDeskName &&
                            !matchesDeskNumber &&
                            !matchesDeptCode &&
                            !matchesDeptName &&
                            !matchesDeptLabel &&
                            !matchesStaffName &&
                            !matchesStaffRole
                        ) {
                            return false;
                        }
                    }

                    // 2. Status Filter matching
                    const st = (desk.status || "").toUpperCase();
                    const isServing = st === "BUSY" || st === "SERVING" || Boolean(desk.current_ticket_id);
                    const isActive = st === "AVAILABLE" || st === "ACTIVE" || isServing;
                    const hasStaff = Boolean(desk.assigned_employee_id);
                    const isStaffOnline = (desk.assigned_employee_status || "").toLowerCase() === "active";

                    if (statusFilter === "active" && !isActive) return false;
                    if (statusFilter === "serving" && !isServing) return false;
                    if (statusFilter === "inactive" && isActive) return false;
                    if (statusFilter === "staff_offline" && (!hasStaff || isStaffOnline)) return false;
                    if (statusFilter === "unstaffed" && hasStaff) return false;

                    return true;
                });

                return {
                    ...deptGroup,
                    desks: matchingDesks,
                };
            })
            .filter((deptGroup) => {
                // If filters are active, only show departments that have matching desks
                if (q || statusFilter !== "all" || selectedDept !== "all") {
                    return deptGroup.desks.length > 0;
                }
                // When no search or filters, show all depts with desks, plus empty depts configured in hospitalDepts
                return (
                    (deptGroup.desks && deptGroup.desks.length > 0) ||
                    hospitalDepts.some((d) => d.dept_code === deptGroup.dept_code)
                );
            });
    }, [rawGroups, q, selectedDept, statusFilter, hospitalDepts, language]);

    // Flatten matching desks for Table View
    const filteredDesksFlat = useMemo(() => {
        const list = [];
        filteredDeptGroups.forEach((dept) => {
            (dept.desks || []).forEach((desk) => {
                list.push({
                    ...desk,
                    dept_code: dept.dept_code,
                    dept_name: dept.name,
                });
            });
        });
        return list;
    }, [filteredDeptGroups]);

    // Reset all applied filters helper
    const handleResetFilters = () => {
        if (setDeskSearchQuery) setDeskSearchQuery("");
        setSelectedDept("all");
        setStatusFilter("all");
    };

    const hasActiveFilters = Boolean(q || statusFilter !== "all" || selectedDept !== "all");

    return (
        <div style={standaloneCardStyle}>
            {/* --------------------------------------------------------- */}
            {/* A. Page Header: Title, Facility Selector, Primary Add Desk */}
            {/* --------------------------------------------------------- */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "12px",
                }}
            >
                <div>
                    <h2
                        style={{
                            margin: "0 0 4px 0",
                            fontSize: "20px",
                            color: "var(--superadmin-text-main, #0F172A)",
                            fontWeight: 800,
                        }}
                    >
                        {isHi ? "सक्रिय काउंटर एवं डेस्क प्रबंधन" : "Active Desk & Counter Management"}
                    </h2>

                    {/* Facility Selector */}
                    {hospitals && hospitals.length > 1 ? (
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "var(--superadmin-sub-card, #F1F5F9)",
                                padding: "4px 10px",
                                borderRadius: "10px",
                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                marginTop: "2px",
                            }}
                        >
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
                                • {activeDesksCount} / {totalDesksCount} {isHi ? "सक्रिय" : "Active"}
                            </span>
                        </div>
                    ) : (
                        <span
                            style={{
                                fontSize: "12px",
                                color: "#0284C7",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                            }}
                        >
                            <IconHospital size={14} color="#0284C7" />
                            <span>
                                {selectedHospital ? selectedHospital.name : "Select a Hospital"} ({activeDesksCount} / {totalDesksCount} Active)
                            </span>
                        </span>
                    )}
                </div>

                {/* Primary Add New Desk Button */}
                <button
                    type="button"
                    onClick={() => {
                        if (hospitalDepts.length === 0) {
                            const msg = isHi
                                ? "डेस्क जोड़ने से पहले कृपया कम से कम एक विभाग बनाएं।"
                                : "Please create at least one clinical department in the Departments tab before adding a desk.";
                            if (notify) notify(msg, "warn");
                            return;
                        }
                        if (onOpenAddDesk) onOpenAddDesk();
                    }}
                    style={actionBtnStyle}
                >
                    <IconPlus size={14} color="#FFFFFF" />
                    <span>{isHi ? "+ नया डेस्क जोड़ें" : "+ Add New Desk"}</span>
                </button>
            </div>

            {/* --------------------------------------------------------- */}
            {/* B. Summary Strip: 5 Interactive Stat Cards                */}
            {/* --------------------------------------------------------- */}
            <DeskSummaryStrip
                totalDesks={totalDesksCount}
                activeDesks={activeDesksCount}
                servingDesks={servingDesksCount}
                staffOfflineDesks={staffOfflineDesksCount}
                unstaffedDesks={unstaffedDesksCount}
                statusFilter={statusFilter}
                onSelectStatusFilter={(filterKey) => setStatusFilter(filterKey)}
                isHi={isHi}
            />

            {/* --------------------------------------------------------- */}
            {/* C. Toolbar: Search, Dept Chips, Status Dropdown, View Toggle */}
            {/* --------------------------------------------------------- */}
            <DeskToolbar
                searchQuery={deskSearchQuery}
                onSearchChange={setDeskSearchQuery}
                selectedDept={selectedDept}
                onSelectDept={(deptCode) => setSelectedDept(deptCode)}
                departmentList={deptChipList}
                statusFilter={statusFilter}
                onStatusFilterChange={(status) => setStatusFilter(status)}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                allCollapsed={allCollapsed}
                onToggleCollapseAll={handleToggleCollapseAll}
                language={language}
                isHi={isHi}
            />

            {/* --------------------------------------------------------- */}
            {/* D. Main Content Area: Grid View OR Table View             */}
            {/* --------------------------------------------------------- */}
            {/* Case 1: Entire Hospital Has Zero Desks */}
            {totalDesksCount === 0 && !hasActiveFilters ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: "54px 20px",
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        borderRadius: "16px",
                        border: "1.5px dashed var(--superadmin-card-border, #CBD5E1)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <div
                        style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "50%",
                            background: "rgba(2, 132, 199, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <IconDesk size={28} color="#0284C7" />
                    </div>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: "17px",
                            fontWeight: 800,
                            color: "var(--superadmin-text-main, #0F172A)",
                        }}
                    >
                        {isHi ? "अभी कोई डेस्क कॉन्फ़िगर नहीं है" : "No Desks Configured Yet"}
                    </h3>
                    <p
                        style={{
                            margin: 0,
                            fontSize: "13px",
                            color: "var(--superadmin-text-muted, #64748B)",
                            maxWidth: "420px",
                            lineHeight: 1.5,
                        }}
                    >
                        {isHi
                            ? "रोगी कतारों का संचालन करने के लिए अपने क्लिनिकल विभागों में काउंटर और परामर्श डेस्क जोड़ें।"
                            : "Set up counters and consultation desks for your clinical departments to begin managing queue stations."}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            if (hospitalDepts.length === 0) {
                                const msg = isHi
                                    ? "डेस्क जोड़ने से पहले कृपया कम से कम एक विभाग बनाएं।"
                                    : "Please create at least one department first.";
                                if (notify) notify(msg, "warn");
                                return;
                            }
                            if (onOpenAddDesk) onOpenAddDesk();
                        }}
                        style={{ ...actionBtnStyle, marginTop: "6px" }}
                    >
                        <IconPlus size={14} color="#FFFFFF" />
                        <span>{isHi ? "+ पहला डेस्क जोड़ें" : "+ Add First Desk"}</span>
                    </button>
                </div>
            ) : filteredDeptGroups.length === 0 || (viewMode === "table" && filteredDesksFlat.length === 0) ? (
                /* Case 2: Filters Return Zero Matches */
                <div
                    style={{
                        textAlign: "center",
                        padding: "44px 20px",
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        borderRadius: "14px",
                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <div
                        style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            background: "rgba(100, 116, 139, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <IconSearch size={22} color="#64748B" />
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                        {isHi ? "फ़िल्टर से कोई डेस्क नहीं मिला" : "No desks match your filter criteria"}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--superadmin-text-muted, #64748B)", maxWidth: "380px" }}>
                        {isHi
                            ? "कृपया खोज शब्द बदलें या सक्रिय फ़िल्टर साफ़ करें।"
                            : "Try adjusting your search query, changing status, or clearing department filters."}
                    </div>
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        style={{
                            padding: "7px 16px",
                            borderRadius: "8px",
                            background: "#0284C7",
                            color: "#FFFFFF",
                            border: "none",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                            marginTop: "4px",
                        }}
                    >
                        {isHi ? "फ़िल्टर हटाएं" : "Reset All Filters"}
                    </button>
                </div>
            ) : viewMode === "table" ? (
                /* Case 3: Table View */
                <DeskTable
                    desks={filteredDesksFlat}
                    onOpenEditDesk={onOpenEditDesk}
                    onToggleDeskStatus={onToggleDeskStatus}
                    onOpenAssignDesk={onOpenAssignDesk}
                    onUnassignDesk={onUnassignDesk}
                    onDeleteDesk={onDeleteDesk}
                    formatRelativeLogin={formatRelativeLogin}
                    showConfirm={showConfirm}
                    language={language}
                    isHi={isHi}
                />
            ) : (
                /* Case 4: Grid View (Department Sections with Responsive Cards) */
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {filteredDeptGroups.map((deptGroup) => (
                        <DepartmentSection
                            key={deptGroup.dept_code}
                            deptGroup={deptGroup}
                            isCollapsed={Boolean(collapsedDepts[deptGroup.dept_code])}
                            onToggleCollapse={() => toggleDeptCollapse(deptGroup.dept_code)}
                            onBulkDeskStatus={onBulkDeskStatus}
                            onOpenAddDesk={onOpenAddDesk}
                            onOpenEditDesk={onOpenEditDesk}
                            onToggleDeskStatus={onToggleDeskStatus}
                            onOpenAssignDesk={onOpenAssignDesk}
                            onUnassignDesk={onUnassignDesk}
                            onDeleteDesk={onDeleteDesk}
                            formatRelativeLogin={formatRelativeLogin}
                            showConfirm={showConfirm}
                            language={language}
                            isHi={isHi}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
