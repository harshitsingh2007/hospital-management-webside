import React, { useState, useEffect } from "react";
import {
    IconHome,
    IconHospital,
    IconUsers,
    IconDesk,
    IconBuilding,
    IconFileText,
    IconPalette,
    IconMonitor,
    IconBroadcast,
    IconCircleToggle,
    IconX,
} from "./SuperAdminIcons";
import "./SuperAdmin.css";

export default function SuperAdminSidebar({
    mobileOpen = false,
    onCloseMobile,
    activeTab = "overview",
    onSelectTab,
    selectedHospital,
    hospitals = [],
    hospitalEmployees = [],
    hospitalDesksData = { active_desks: 0, total_desks: 0 },
    hospitalDepts = [],
    hospitalVisitsData = null,
    hospitalBranding = null,
    brandingForm = null,
    activeBroadcastsCount = 0,
    socketConnected = true,
    lastSyncedAt = null,
    isHi = false,
}) {
    // Pinned state persisted in localStorage
    const [isPinned, setIsPinned] = useState(() => {
        try {
            return localStorage.getItem("ai_queue_superadmin_sidebar_pinned") === "true";
        } catch (e) {
            return false;
        }
    });

    // Hover state for expansion on hover
    const [isHovered, setIsHovered] = useState(false);

    const handleTogglePin = () => {
        setIsPinned((prev) => {
            const next = !prev;
            try {
                localStorage.setItem("ai_queue_superadmin_sidebar_pinned", String(next));
            } catch (e) {}
            return next;
        });
    };

    const isExpanded = isPinned || isHovered || mobileOpen;

    // All 8 control modules in order
    const menuItems = [
        {
            id: "overview",
            icon: <IconHome size={20} />,
            title: isHi ? "360° अवलोकन" : "Overview",
            badge: null,
        },
        {
            id: "hospitals",
            icon: <IconHospital size={20} />,
            title: isHi ? "अस्पताल नेटवर्क" : "Hospital Network",
            badge: hospitals?.length > 0 ? hospitals.length : null,
        },
        {
            id: "employees",
            icon: <IconUsers size={20} />,
            title: isHi ? "स्टाफ व डॉक्टर" : "Staff & Clinicians",
            badge: hospitalEmployees?.length > 0 ? hospitalEmployees.length : null,
        },
        {
            id: "desks",
            icon: <IconDesk size={20} />,
            title: isHi ? "काउंटर एवं डेस्क" : "Desks & Counters",
            badge: `${hospitalDesksData.active_desks || 0}/${hospitalDesksData.total_desks || 0}`,
        },
        {
            id: "depts",
            icon: <IconBuilding size={20} />,
            title: isHi ? "क्लिनिकल विभाग" : "Clinical Departments",
            badge: hospitalDepts.length,
        },
        {
            id: "visits",
            icon: <IconFileText size={20} />,
            title: isHi ? "मरीज़ विज़िट" : "Patient Visits",
            badge: hospitalVisitsData?.summary?.total_patients_visited_all_time ?? hospitalVisitsData?.visits?.length ?? 0,
        },
        {
            id: "branding",
            icon: <IconPalette size={20} />,
            title: isHi ? "ब्रांडिंग स्टूडियो" : "Branding Studio",
            badge: null,
        },
        {
            id: "kiosks",
            icon: <IconMonitor size={20} />,
            title: isHi ? "कियोस्क एवं डिस्प्ले" : "Kiosks & Displays",
            badge: null,
        },
        {
            id: "broadcasts",
            icon: <IconBroadcast size={20} />,
            title: isHi ? "आपातकालीन प्रसारण" : "Broadcast Center",
            badge: activeBroadcastsCount > 0 ? (isHi ? `${activeBroadcastsCount} लाइव` : `${activeBroadcastsCount} Live`) : null,
        },
    ];

    const [imgError, setImgError] = useState(false);

    const hospitalName = selectedHospital?.name || "City General Hospital";

    // Resolve hospital logo from branding_json, brandingForm, hospitalBranding, or selectedHospital
    const resolvedBrandingJson = typeof selectedHospital?.branding_json === "string"
        ? (() => { try { return JSON.parse(selectedHospital.branding_json); } catch (e) { return {}; } })()
        : (selectedHospital?.branding_json || {});

    const matchedHosp = hospitals?.find(
        (h) => h.hospital_code === selectedHospital?.hospital_code
    );
    const matchedBrandingJson = typeof matchedHosp?.branding_json === "string"
        ? (() => { try { return JSON.parse(matchedHosp.branding_json); } catch (e) { return {}; } })()
        : (matchedHosp?.branding_json || {});

    const logoUrl =
        selectedHospital?.logo_url ||
        resolvedBrandingJson?.logo_url ||
        matchedHosp?.logo_url ||
        matchedBrandingJson?.logo_url ||
        selectedHospital?.branding?.logo_url ||
        brandingForm?.logo_url ||
        hospitalBranding?.logo_url ||
        "";

    useEffect(() => {
        setImgError(false);
    }, [logoUrl]);

    return (
        <aside
            className={`superadmin-geeta-sidebar ${isExpanded ? "expanded" : "collapsed"} ${isPinned ? "is-pinned" : ""} ${mobileOpen ? "mobile-drawer-open" : ""}`}
            aria-label="Super Admin Control Center Navigation"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* 1. TOP LOGO & PIN TOGGLE BAR */}
            <div className="superadmin-rail-top">
                <div className="superadmin-rail-logo-wrap" title={hospitalName}>
                    {logoUrl && !imgError ? (
                        <img
                            src={logoUrl}
                            alt={hospitalName}
                            className="superadmin-rail-logo-img"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="superadmin-rail-crest">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#0C2340" />
                                <path d="M12 7v10M7 12h10" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        </div>
                    )}
                    {isExpanded && (
                        <div className="superadmin-rail-title-wrap">
                            <span className="superadmin-rail-brand-name">{hospitalName}</span>
                            <span className="superadmin-rail-sub-title">CONTROL CENTER</span>
                        </div>
                    )}
                </div>

                {isExpanded && (
                    <button
                        type="button"
                        className={`superadmin-pin-toggle-btn desktop-only ${isPinned ? "is-pinned" : ""}`}
                        onClick={handleTogglePin}
                        title={isPinned ? (isHi ? "साइडबार अनपिन करें" : "Unpin sidebar") : (isHi ? "साइडबार पिन करें" : "Pin sidebar expanded")}
                        aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar expanded"}
                    >
                        <IconCircleToggle size={18} pinned={isPinned} />
                    </button>
                )}

                {mobileOpen && (
                    <button
                        type="button"
                        className="superadmin-mobile-close-btn mobile-only"
                        onClick={onCloseMobile}
                        title={isHi ? "बंद करें" : "Close navigation"}
                        aria-label="Close navigation"
                    >
                        <IconX size={18} />
                    </button>
                )}
            </div>

            {/* 2. FLAT LIST OF MENU ITEMS (44px height, 8px gaps) */}
            <nav className="superadmin-rail-nav">
                {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`superadmin-rail-item ${isActive ? "active" : ""}`}
                            onClick={() => {
                                onSelectTab(item.id);
                                if (onCloseMobile) onCloseMobile();
                            }}
                            title={!isExpanded ? `${item.title}${item.badge !== null ? ` (${item.badge})` : ""}` : undefined}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <span className="superadmin-rail-item-icon">{item.icon}</span>
                            {isExpanded && (
                                <span className="superadmin-rail-item-label">{item.title}</span>
                            )}
                            {isExpanded && item.badge !== null && (
                                <span className={`superadmin-rail-item-badge ${isActive ? "active" : ""}`}>
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

        </aside>
    );
}
