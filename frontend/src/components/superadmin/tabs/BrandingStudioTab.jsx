import React from "react";
import {
    IconHospital,
    IconPalette,
    IconImage,
    IconBookOpen,
    IconTicket,
    IconClock,
    IconMapPin,
    IconRefresh,
    IconSave,
    IconBuilding,
    IconSmartphone,
    IconAlertTriangle,
    IconCalendar,
    IconPlus,
    IconX,
    IconTrash,
    IconZap,
    IconUsers,
    IconFileText,
} from "../SuperAdminIcons";
import {
    fieldLabelStyle,
    fieldInputStyle,
} from "../superAdminStyles";
import { generateOperatingHoursText } from "../../../utils/operatingHoursHelper";
import "../SuperAdmin.css";

export default function BrandingStudioTab({
    brandingTargetHospital,
    selectedHospital,
    hospitals = [],
    setSelectedHospital,
    loadHospitalBrandingData,
    brandingForm = {},
    setBrandingForm,
    activeBrandingTab,
    setActiveBrandingTab,
    brandingPreviewMode,
    setBrandingPreviewMode,
    isSavingBranding,
    handleSaveBrandingSubmit,
    handleResetBrandingDefaults,
    notify,
    isHi = false,
    hospitalEmployees = [],
    hospitalVisitsData = { summary: {}, visits: [] },
    hospitalDepts = [],
    handleDownloadVisitHistory,
    fetchHospitalDeepDive,
    fetchGlobalData,
    getAuthHeaders,
    currentUser,
}) {
    const currentHosp =
        brandingTargetHospital ||
        selectedHospital ||
        hospitals.find(
            (h) =>
                h.hospital_code === currentUser?.primary_hospital_code ||
                h.hospital_code === currentUser?.hospital_code ||
                h.owner_user_id === currentUser?.id
        ) ||
        hospitals[0] ||
        null;
    const primaryClr = brandingForm.primary_color || "#0284C7";
    const secondaryClr = brandingForm.secondary_color || "#0369A1";

    const translateTimeoutRef = React.useRef(null);
    const [isTranslatingHindi, setIsTranslatingHindi] = React.useState(false);

    React.useEffect(() => {
        return () => {
            if (translateTimeoutRef.current) {
                clearTimeout(translateTimeoutRef.current);
            }
        };
    }, []);

    const handleDescriptionChange = (newVal) => {
        setBrandingForm((prev) => ({
            ...prev,
            about_us: newVal,
            description: prev.description === prev.about_us ? newVal : (prev.description || newVal),
        }));

        if (translateTimeoutRef.current) {
            clearTimeout(translateTimeoutRef.current);
        }

        if (!newVal || !newVal.trim()) {
            setBrandingForm((prev) => ({ ...prev, about_us: "", about_us_hi: "" }));
            return;
        }

        // Auto-detect if English / Latin characters exist
        const hasEnglish = /[a-zA-Z]/.test(newVal);
        if (!hasEnglish) {
            setBrandingForm((prev) => ({ ...prev, about_us_hi: newVal }));
            return;
        }

        setIsTranslatingHindi(true);
        translateTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=hi&dt=t&q=${encodeURIComponent(newVal)}`
                );
                if (res.ok) {
                    const data = await res.json();
                    if (data && data[0]) {
                        const translated = data[0].map((item) => item[0]).join("");
                        setBrandingForm((prev) => ({ ...prev, about_us_hi: translated }));
                    }
                }
            } catch (err) {
                console.warn("Auto-translate to Hindi failed:", err);
            } finally {
                setIsTranslatingHindi(false);
            }
        }, 500);
    };

    const cleanEmergencyNumber = (val) => {
        if (!val) return "";
        return String(val).replace(/^(Emergency\s*(Helpline|no\.?|number)?\s*[:-]?\s*)/i, "");
    };

    const cleanOpdNumber = (val) => {
        if (!val) return "";
        return String(val).replace(/^(OPD\s*(Helpline|no\.?|number|phone)?\s*[:-]?\s*)/i, "");
    };

    const handleEmergencyNumberChange = (raw) => {
        const cleaned = cleanEmergencyNumber(raw);
        const formatted = cleaned.trim() ? `Emergency No: ${cleaned}` : "";
        setBrandingForm((prev) => ({
            ...prev,
            emergency_helpline: formatted,
            emergency_no: cleaned.trim(),
        }));
    };

    const handleOpdNumberChange = (raw) => {
        const cleaned = cleanOpdNumber(raw);
        const formatted = cleaned.trim() ? `OPD No: ${cleaned}` : "";
        setBrandingForm((prev) => ({
            ...prev,
            opd_helpdesk_phone: formatted,
            phone: prev.phone && prev.phone !== prev.opd_helpdesk_phone ? prev.phone : (cleaned.trim() || formatted),
        }));
    };

    const updateOperatingHours = (updates) => {
        setBrandingForm((prev) => {
            const next = { ...prev, ...updates };
            const en = generateOperatingHoursText(next.operating_days, next.opd_start_time, next.opd_end_time, false);
            const hi = generateOperatingHoursText(next.operating_days, next.opd_start_time, next.opd_end_time, true);
            return {
                ...next,
                opd_helpdesk_hours: en,
                opd_helpdesk_hours_hi: hi,
            };
        });
    };

    const DEFAULT_BRANDING_TIME_SLOTS = React.useMemo(() => [
        "09:00 AM", "09:45 AM", "10:30 AM", "11:15 AM", "12:00 PM",
        "02:00 PM", "02:45 PM", "03:30 PM", "04:15 PM", "05:00 PM"
    ], []);

    const [slotHour, setSlotHour] = React.useState("09");
    const [slotMinute, setSlotMinute] = React.useState("00");
    const [slotPeriod, setSlotPeriod] = React.useState("AM");
    const [slotGenInterval, setSlotGenInterval] = React.useState(45);

    const format24To12 = (time24) => {
        if (!time24) return "";
        let [h, m] = time24.split(":").map(Number);
        if (isNaN(h)) return time24;
        m = isNaN(m) ? 0 : m;
        const period = h >= 12 ? "PM" : "AM";
        let hour12 = h % 12;
        if (hour12 === 0) hour12 = 12;
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(hour12)}:${pad(m)} ${period}`;
    };

    const slotToMinutes = (slot) => {
        if (!slot || typeof slot !== "string") return 0;
        const trimmed = slot.trim();
        const parts = trimmed.split(" ");
        if (parts.length >= 2) {
            const [time, period] = parts;
            let [h, m] = time.split(":").map(Number);
            h = h || 0;
            m = m || 0;
            if (period?.toUpperCase() === "PM" && h !== 12) h += 12;
            if (period?.toUpperCase() === "AM" && h === 12) h = 0;
            return h * 60 + m;
        }
        const [h, m] = trimmed.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const sortSlots = (slots) => {
        return [...slots].sort((a, b) => slotToMinutes(a) - slotToMinutes(b));
    };

    const currentSlots = Array.isArray(brandingForm.available_time_slots) && brandingForm.available_time_slots.length > 0
        ? brandingForm.available_time_slots
        : (Array.isArray(brandingForm.time_slots) && brandingForm.time_slots.length > 0
            ? brandingForm.time_slots
            : DEFAULT_BRANDING_TIME_SLOTS);

    const handleAddSlot = (overrideSlot) => {
        let slotFormatted = "";
        if (typeof overrideSlot === "string" && overrideSlot.trim()) {
            slotFormatted = overrideSlot.includes("AM") || overrideSlot.includes("PM") ? overrideSlot.trim() : format24To12(overrideSlot);
        } else {
            const pad = (n) => String(n).padStart(2, "0");
            slotFormatted = `${pad(slotHour)}:${pad(slotMinute)} ${slotPeriod}`;
        }
        if (!slotFormatted) return;
        if (currentSlots.includes(slotFormatted)) {
            if (notify) notify(isHi ? `स्लॉट '${slotFormatted}' पहले से मौजूद है` : `Slot '${slotFormatted}' already exists in list`);
            return;
        }
        const updated = sortSlots([...currentSlots, slotFormatted]);
        setBrandingForm((prev) => ({
            ...prev,
            available_time_slots: updated,
        }));
        if (notify) notify(isHi ? `स्लॉट '${slotFormatted}' जोड़ा गया` : `Added slot '${slotFormatted}'`);
    };

    const handleRemoveSlot = (slotToRemove) => {
        const updated = currentSlots.filter((s) => s !== slotToRemove);
        setBrandingForm((prev) => ({
            ...prev,
            available_time_slots: updated,
        }));
        if (notify) notify(isHi ? `स्लॉट '${slotToRemove}' हटाया गया` : `Removed slot '${slotToRemove}'`);
    };

    const handleAutoGenerateSlots = () => {
        const start = brandingForm.opd_start_time || "08:00";
        const end = brandingForm.registration_cutoff_time || brandingForm.opd_end_time || "20:00";
        const startM = slotToMinutes(start);
        const endM = slotToMinutes(end);
        const interval = Number(slotGenInterval) || 45;

        if (endM <= startM) {
            if (notify) notify(isHi ? "प्रारंभ समय समाप्ति समय से पहले होना चाहिए" : "OPD start time must be earlier than cutoff/closing time");
            return;
        }

        const generated = [];
        for (let m = startM; m < endM; m += interval) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const period = h >= 12 ? "PM" : "AM";
            let hour12 = h % 12;
            if (hour12 === 0) hour12 = 12;
            const pad = (n) => String(n).padStart(2, "0");
            generated.push(`${pad(hour12)}:${pad(min)} ${period}`);
        }

        if (generated.length === 0) {
            if (notify) notify(isHi ? "कोई स्लॉट जनरेट नहीं हुआ" : "No slots generated for current hours");
            return;
        }

        setBrandingForm((prev) => ({
            ...prev,
            available_time_slots: generated,
        }));
        if (notify) notify(isHi ? `${generated.length} स्लॉट ओपीडी घंटों से बनाए गए` : `Generated ${generated.length} slots from OPD hours (${start} to ${end})`);
    };

    const handleResetSlotsToDefault = () => {
        setBrandingForm((prev) => ({
            ...prev,
            available_time_slots: [...DEFAULT_BRANDING_TIME_SLOTS],
        }));
        if (notify) notify(isHi ? "डिफ़ॉल्ट 10 समय स्लॉट लोड किए गए" : "Reset to standard 10 time slots");
    };

    const handleClearAllSlots = () => {
        setBrandingForm((prev) => ({
            ...prev,
            available_time_slots: [],
        }));
        if (notify) notify(isHi ? "सभी स्लॉट हटा दिए गए" : "Cleared all booking slots");
    };

    return (
        <div className="branding-studio-container">
            {/* 1. STUDIO HERO HEADER BAR */}
            <div style={{
                background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0B3B60 100%)",
                borderRadius: "22px",
                padding: "24px 28px",
                color: "#FFFFFF",
                boxShadow: "0 14px 32px -6px rgba(15, 23, 42, 0.28)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "18px",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                position: "relative",
                overflow: "hidden",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", zIndex: 2 }}>
                    <div style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "16px",
                        background: primaryClr,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 8px 20px -2px ${primaryClr}66`,
                        border: "2px solid rgba(255, 255, 255, 0.3)",
                        overflow: "hidden",
                        flexShrink: 0,
                    }}>
                        {brandingForm.logo_url ? (
                            <img src={brandingForm.logo_url} alt="Brand Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                            <IconHospital size={28} color="#FFFFFF" />
                        )}
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                                {isHi ? "अस्पताल ब्रांडिंग एवं व्हाइट-लेबलिंग स्टूडियो" : "Hospital Branding & White-Labeling Studio"}
                            </h2>
                            {currentHosp && (
                                <span style={{
                                    fontSize: "11px",
                                    background: "rgba(56, 189, 248, 0.18)",
                                    color: "#7DD3FC",
                                    border: "1px solid rgba(56, 189, 248, 0.35)",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    fontWeight: 700,
                                    fontFamily: "monospace",
                                }}>
                                    {currentHosp.hospital_code}
                                </span>
                            )}
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94A3B8" }}>
                            {isHi
                                ? "मरीज़ पोर्टल थीम, संस्थागत लोगो, द्विभाषी मिशन, थर्मल पर्ची, संचालन समय और सहायता डेस्क कस्टमाइज़ करें।"
                                : "Configure live tenant branding, theme palettes, favicon, digital slips, OPD schedules, and helpdesk endpoints."}
                        </p>
                    </div>
                </div>

                {/* Top Right Action & Switcher */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", zIndex: 2 }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: "rgba(255, 255, 255, 0.08)",
                        padding: "6px 12px",
                        borderRadius: "12px",
                        border: "1px solid rgba(255, 255, 255, 0.14)",
                    }}>
                        <label style={{ fontSize: "12px", fontWeight: 700, color: "#CBD5E1" }}>
                            {isHi ? "सक्रिय अस्पताल:" : "Active Facility:"}
                        </label>
                        <select
                            value={currentHosp?.hospital_code || ""}
                            onChange={(e) => {
                                const found = hospitals.find((h) => h.hospital_code === e.target.value);
                                if (found) {
                                    if (setSelectedHospital) setSelectedHospital(found);
                                    if (loadHospitalBrandingData) loadHospitalBrandingData(found);
                                }
                            }}
                            style={{
                                background: "#0F172A",
                                color: "#FFFFFF",
                                border: "1px solid rgba(255, 255, 255, 0.25)",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontSize: "12.5px",
                                fontWeight: 700,
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
                    </div>

                    <button
                        type="button"
                        onClick={handleResetBrandingDefaults}
                        style={{
                            padding: "9px 14px",
                            borderRadius: "10px",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "#E2E8F0",
                            fontSize: "12.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            transition: "all 0.15s ease",
                        }}
                        title="Reset current hospital branding to medical defaults"
                    >
                        <IconRefresh size={14} />
                        <span>{isHi ? "डिफ़ॉल्ट रीसेट" : "Reset Defaults"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSaveBrandingSubmit(null, currentHosp)}
                        disabled={isSavingBranding}
                        style={{
                            background: isSavingBranding
                                ? "#64748B"
                                : `linear-gradient(135deg, ${primaryClr} 0%, ${secondaryClr} 100%)`,
                            color: "#FFFFFF",
                            border: "1px solid rgba(255, 255, 255, 0.3)",
                            borderRadius: "12px",
                            padding: "10px 22px",
                            fontSize: "13.5px",
                            fontWeight: 800,
                            cursor: isSavingBranding ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: `0 6px 18px ${primaryClr}55`,
                            transition: "all 0.2s ease",
                        }}
                    >
                        {isSavingBranding ? <IconRefresh size={14} /> : <IconSave size={14} />}
                        <span>{isSavingBranding ? (isHi ? "सहेजा जा रहा है..." : "Saving...") : (isHi ? "ब्रांडिंग सहेजें" : "Save All Changes")}</span>
                    </button>
                </div>
            </div>

            {/* 2. SUB-NAVIGATION PILLS */}
            <div className="branding-sub-nav-bar">
                {[
                    { id: "profile", label: isHi ? "अस्पताल प्रोफाइल" : "Hospital Profile", icon: IconHospital },
                    { id: "theme", label: isHi ? "थीम और रंग" : "Theme & Colors", icon: IconPalette },
                    { id: "logo", label: isHi ? "लोगो और आइकन" : "Logo & Favicon", icon: IconImage },
                    { id: "about", label: isHi ? "अबाउट अस मॉडल" : "About Us Modal", icon: IconBookOpen },
                    { id: "hours", label: isHi ? "संचालन समय व कटऑफ" : "Operating Hours & Cutoff", icon: IconClock },
                ].map((tab) => {
                    const isActive = activeBrandingTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveBrandingTab(tab.id)}
                            className={`branding-tab-pill ${isActive ? "active" : ""}`}
                        >
                            <tab.icon size={16} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* 3. STUDIO WORKSPACE (2-COLUMN SIMULATOR) */}
            <div className="branding-studio-grid">
                    {/* LEFT COLUMN: Configuration Form Controls */}
                    <form onSubmit={(e) => handleSaveBrandingSubmit(e, currentHosp)} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        {/* TAB 0: HOSPITAL PROFILE & CORE CONFIGURATION */}
                        {activeBrandingTab === "profile" && (
                        <div className="branding-section-card">
                            <div>
                                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <IconHospital size={18} color="#0284C7" />
                                    <span>{isHi ? "अस्पताल प्रोफाइल एवं मुख्य सेटिंग्स" : "Hospital Profile & General Settings"}</span>
                                </h3>
                                <p style={{ margin: 0, fontSize: "12.5px" }}>
                                    {isHi ? "अस्पताल का नाम, पहचान कोड, परिचालन स्थिति और आधिकारिक विवरण अपडेट करें।" : "Manage the primary hospital name, unique tenant code, operating status, and facility description."}
                                </p>
                            </div>

                            <div className="branding-inset-box" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "अस्पताल का पूरा नाम" : "Hospital Official Name"} *</label>
                                        <input
                                            type="text"
                                            required
                                            value={brandingForm.name || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, name: e.target.value })}
                                            placeholder={isHi ? "उदा. सिटी जनरल अस्पताल" : "e.g. City General Hospital"}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "अस्पताल कोड (Tenant ID)" : "Hospital Identifier (Code)"}</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={currentHosp?.hospital_code || brandingForm.hospital_code || ""}
                                            style={{ ...fieldInputStyle, background: "var(--superadmin-sub-card, #F1F5F9)", cursor: "not-allowed", color: "#64748B", fontWeight: 700 }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "अस्पताल टैगलाइन व ध्येय (Tagline / Motto)" : "Hospital Tagline / Care Motto"}</label>
                                    <input
                                        type="text"
                                        placeholder="Care you can trust • NABH Accredited"
                                        value={brandingForm.tagline || brandingForm.about_us_subtitle || ""}
                                        onChange={(e) => setBrandingForm({ ...brandingForm, tagline: e.target.value, about_us_subtitle: e.target.value })}
                                        style={fieldInputStyle}
                                    />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                                    {/* 24x7 Emergency Helpline */}
                                    <div>
                                        <label style={{ ...fieldLabelStyle, color: "#EF4444" }}>
                                            {isHi ? "24x7 आपातकालीन नंबर (Emergency No.) *" : "24x7 Emergency Helpline No. *"}
                                        </label>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "stretch",
                                            border: "1.5px solid rgba(239, 68, 68, 0.45)",
                                            borderRadius: "10px",
                                            background: "var(--superadmin-input-bg, #FFFFFF)",
                                            overflow: "hidden",
                                            transition: "border-color 0.2s ease",
                                        }}>
                                            <span style={{
                                                background: "rgba(239, 68, 68, 0.12)",
                                                color: "#EF4444",
                                                fontWeight: 800,
                                                fontSize: "12.5px",
                                                padding: "10px 14px",
                                                borderRight: "1.5px solid rgba(239, 68, 68, 0.25)",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                whiteSpace: "nowrap",
                                                userSelect: "none",
                                            }}>
                                                🚨 Emergency No:
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="112 / 6969696969 / 108"
                                                value={cleanEmergencyNumber(brandingForm.emergency_helpline || "")}
                                                onChange={(e) => handleEmergencyNumberChange(e.target.value)}
                                                style={{
                                                    ...fieldInputStyle,
                                                    border: "none",
                                                    borderRadius: 0,
                                                    padding: "10px 14px",
                                                    flex: 1,
                                                    outline: "none",
                                                    fontWeight: 600,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* OPD Helpline / Enquiry No */}
                                    <div>
                                        <label style={{ ...fieldLabelStyle, color: "#0284C7" }}>
                                            {isHi ? "ओपीडी सहायता नंबर (OPD Helpline No.)" : "OPD Helpline / Enquiry No."}
                                        </label>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "stretch",
                                            border: "1.5px solid rgba(2, 132, 199, 0.4)",
                                            borderRadius: "10px",
                                            background: "var(--superadmin-input-bg, #FFFFFF)",
                                            overflow: "hidden",
                                            transition: "border-color 0.2s ease",
                                        }}>
                                            <span style={{
                                                background: "rgba(2, 132, 199, 0.1)",
                                                color: "#0284C7",
                                                fontWeight: 800,
                                                fontSize: "12.5px",
                                                padding: "10px 14px",
                                                borderRight: "1.5px solid rgba(2, 132, 199, 0.25)",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                whiteSpace: "nowrap",
                                                userSelect: "none",
                                            }}>
                                                📞 OPD No:
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="011-23456789 / +91 98765 43210"
                                                value={cleanOpdNumber(brandingForm.opd_helpdesk_phone || "")}
                                                onChange={(e) => handleOpdNumberChange(e.target.value)}
                                                style={{
                                                    ...fieldInputStyle,
                                                    border: "none",
                                                    borderRadius: 0,
                                                    padding: "10px 14px",
                                                    flex: 1,
                                                    outline: "none",
                                                    fontWeight: 600,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "परिचालन स्थिति" : "Operational Status"} *</label>
                                        <select
                                            value={brandingForm.status || "active"}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, status: e.target.value })}
                                            style={fieldInputStyle}
                                        >
                                            <option value="active">{isHi ? "सक्रिय (Active / Accepting Patients)" : "Active (Accepting Patients)"}</option>
                                            <option value="maintenance">{isHi ? "रखरखाव (Under Maintenance)" : "Under Maintenance"}</option>
                                            <option value="inactive">{isHi ? "निष्क्रिय (Inactive / Suspended)" : "Inactive / Suspended"}</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "सहायता / संपर्क ईमेल" : "Support Email"}</label>
                                        <input
                                            type="email"
                                            placeholder="support@citygeneralhospital.org"
                                            value={brandingForm.support_email || brandingForm.email || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, support_email: e.target.value, email: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "अस्पताल परिसर पता (Campus Address)" : "Hospital Campus Address"}</label>
                                    <textarea
                                        rows="2"
                                        placeholder="e.g. 742 Evergreen Healthcare Ave, Medical District, Suite 100"
                                        value={brandingForm.address || ""}
                                        onChange={(e) => setBrandingForm({ ...brandingForm, address: e.target.value })}
                                        style={{ ...fieldInputStyle, resize: "vertical" }}
                                    />
                                </div>

                                <div>
                                    <label style={fieldLabelStyle}>
                                        {isHi ? "अस्पताल का विवरण" : "Hospital Description"}
                                    </label>
                                    <textarea
                                        rows="4"
                                        placeholder={isHi ? "अस्पताल का विवरण दर्ज करें..." : "Premier medical institution dedicated to patient-first care with AI queue orchestration..."}
                                        value={brandingForm.about_us || brandingForm.description || ""}
                                        onChange={(e) => handleDescriptionChange(e.target.value)}
                                        style={{ ...fieldInputStyle, resize: "vertical" }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 1: THEME & COLOR SYSTEM */}
                    {activeBrandingTab === "theme" && (
                        <div className="branding-section-card">
                            <div>
                                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <IconPalette size={16} color="#0284C7" />
                                    <span>{isHi ? "क्लिनिकल थीम व रंग प्रणाली" : "Clinical Color System & Palettes"}</span>
                                </h3>
                                <p style={{ margin: 0, fontSize: "12.5px" }}>
                                    {isHi ? "एक क्लिक में सिद्ध मेडिकल पैलेट चुनें या अपने अस्पताल का सटीक हेक्स कोड दर्ज करें।" : "Select curated healthcare colorways or fine-tune custom brand hex codes."}
                                </p>
                            </div>

                            {/* Presets Row */}
                            <div>
                                <label style={{ ...fieldLabelStyle, marginBottom: "8px" }}>
                                    {isHi ? "त्वरित रंग पट्टियाँ (One-Click Healthcare Presets)" : "Quick Healthcare Color Palettes"}
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                                    {[
                                        { name: "Ocean Blue", primary: "#0284C7", secondary: "#0369A1", accent: "#F0F9FF" },
                                        { name: "Emerald Healing", primary: "#059669", secondary: "#047857", accent: "#ECFDF5" },
                                        { name: "Royal Purple", primary: "#7C3AED", secondary: "#6D28D9", accent: "#F5F3FF" },
                                        { name: "Crimson Care", primary: "#DC2626", secondary: "#B91C1C", accent: "#FEF2F2" },
                                        { name: "Slate Teal", primary: "#0D9488", secondary: "#0F766E", accent: "#F0FDFA" },
                                        { name: "Sunset Amber", primary: "#D97706", secondary: "#B45309", accent: "#FFFBEB" },
                                        { name: "Modern Indigo", primary: "#4F46E5", secondary: "#4338CA", accent: "#EEF2FF" },
                                        { name: "Rose Coral", primary: "#E11D48", secondary: "#BE123C", accent: "#FFF1F2" },
                                    ].map((pal) => {
                                        const isSelected = brandingForm.primary_color === pal.primary;
                                        return (
                                            <button
                                                key={pal.name}
                                                type="button"
                                                onClick={() => setBrandingForm({
                                                    ...brandingForm,
                                                    primary_color: pal.primary,
                                                    secondary_color: pal.secondary,
                                                    accent_color: pal.accent,
                                                })}
                                                className={`branding-preset-btn ${isSelected ? "active" : ""}`}
                                            >
                                                <div style={{ display: "flex", width: "100%", height: "20px", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.15)" }}>
                                                    <div style={{ flex: 2, background: pal.primary }} />
                                                    <div style={{ flex: 1.2, background: pal.secondary }} />
                                                    <div style={{ flex: 1, background: pal.accent, borderLeft: "0.5px solid rgba(255,255,255,0.3)" }} />
                                                </div>
                                                <span style={{ fontSize: "11px", fontWeight: 700 }}>
                                                    {isSelected ? "✓ " : ""}{pal.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Color Pickers */}
                            <div className="branding-inset-box" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "प्राथमिक रंग (Primary)" : "Primary Brand Color"}</label>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                        <input
                                            type="color"
                                            value={brandingForm.primary_color || "#0284C7"}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                                            style={{ width: "40px", height: "40px", border: "none", borderRadius: "10px", cursor: "pointer", padding: 0 }}
                                        />
                                        <input
                                            type="text"
                                            value={brandingForm.primary_color || "#0284C7"}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                                            style={{ ...fieldInputStyle, padding: "8px 10px", fontSize: "13px", fontFamily: "monospace", fontWeight: 700 }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "द्वितीयक रंग (Secondary)" : "Secondary Accent Color"}</label>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                        <input
                                            type="color"
                                            value={brandingForm.secondary_color || "#0369A1"}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, secondary_color: e.target.value })}
                                            style={{ width: "40px", height: "40px", border: "none", borderRadius: "10px", cursor: "pointer", padding: 0 }}
                                        />
                                        <input
                                            type="text"
                                            value={brandingForm.secondary_color || "#0369A1"}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, secondary_color: e.target.value })}
                                            style={{ ...fieldInputStyle, padding: "8px 10px", fontSize: "13px", fontFamily: "monospace", fontWeight: 700 }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "कार्ड टिंट (Card Accent Tint)" : "Card Accent Tint"}</label>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                        <input
                                            type="color"
                                            value={brandingForm.accent_color || "#F0F9FF"}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, accent_color: e.target.value })}
                                            style={{ width: "40px", height: "40px", border: "none", borderRadius: "10px", cursor: "pointer", padding: 0 }}
                                        />
                                        <input
                                            type="text"
                                            value={brandingForm.accent_color || "#F0F9FF"}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, accent_color: e.target.value })}
                                            style={{ ...fieldInputStyle, padding: "8px 10px", fontSize: "13px", fontFamily: "monospace", fontWeight: 700 }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Color preview test badge */}
                            <div style={{
                                padding: "12px 16px",
                                borderRadius: "12px",
                                background: `linear-gradient(135deg, ${primaryClr} 0%, ${secondaryClr} 100%)`,
                                color: "#FFFFFF",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "12.5px",
                                fontWeight: 700,
                            }}>
                                <span>Active Brand Gradient Preview</span>
                                <span style={{ background: "rgba(255,255,255,0.2)", padding: "3px 10px", borderRadius: "8px", fontSize: "11px" }}>
                                    WCAG AA Compliant
                                </span>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: LOGO & FAVICON */}
                    {activeBrandingTab === "logo" && (
                        <div className="branding-section-card">
                            <div>
                                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <IconImage size={16} color="#0284C7" />
                                    <span>{isHi ? "अस्पताल का आधिकारिक लोगो और आइकन" : "Hospital Official Logo & Browser Icon"}</span>
                                </h3>
                                <p style={{ margin: 0, fontSize: "12.5px" }}>
                                    {isHi ? "मरीज़ पोर्टल, पर्चियों, और ब्राउज़र टैब (Favicon) पर प्रदर्शित होने वाला लोगो सेट करें।" : "Appears on patient portal headers, queue tickets, kiosks, and custom browser favicon."}
                                </p>
                            </div>

                            {/* Quick Preset Logos */}
                            <div>
                                <label style={{ ...fieldLabelStyle, marginBottom: "8px" }}>
                                    {isHi ? "त्वरित लोगो प्रीसेट (Quick Preset Logos)" : "Quick Preset Healthcare Logos"}
                                </label>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {[
                                        { label: "Shield Cross", url: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=120&auto=format&fit=crop&q=80" },
                                        { label: "Modern Cross", url: "https://cdn-icons-png.flaticon.com/512/2966/2966327.png" },
                                        { label: "Red Cross", url: "https://cdn-icons-png.flaticon.com/512/883/883407.png" },
                                        { label: "Heartbeat", url: "https://cdn-icons-png.flaticon.com/512/2966/2966384.png" },
                                        { label: "Clear (Default)", url: "" },
                                    ].map((item) => {
                                        const isSelected = brandingForm.logo_url === item.url;
                                        return (
                                            <button
                                                key={item.label}
                                                type="button"
                                                onClick={() => setBrandingForm({ ...brandingForm, logo_url: item.url })}
                                                className={`branding-preset-btn ${isSelected ? "active" : ""}`}
                                                style={{
                                                    padding: "6px 14px",
                                                    borderRadius: "10px",
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {isSelected ? "✓ " : ""}{item.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Upload & URL Box */}
                            <div className="branding-inset-box" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                    <input
                                        type="file"
                                        id="superadmin-branding-file-input"
                                        accept="image/png, image/jpeg, image/svg+xml, image/webp"
                                        style={{ display: "none" }}
                                        onChange={(e) => {
                                            const file = e.target.files && e.target.files[0];
                                            if (file) {
                                                if (file.size > 2 * 1024 * 1024) {
                                                    if (notify) notify(isHi ? "लोगो फ़ाइल 2MB से कम होनी चाहिए" : "Logo image must be under 2MB", "error");
                                                    return;
                                                }
                                                const reader = new FileReader();
                                                reader.onload = (loadEvt) => {
                                                    setBrandingForm({ ...brandingForm, logo_url: loadEvt.target.result });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById("superadmin-branding-file-input")?.click()}
                                        style={{
                                            padding: "9px 18px",
                                            borderRadius: "10px",
                                            border: `1.5px solid ${primaryClr}`,
                                            background: primaryClr,
                                            color: "#FFFFFF",
                                            fontSize: "13px",
                                            fontWeight: 800,
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                                        }}
                                    >
                                        <IconBuilding size={16} color="#FFFFFF" />
                                        <span>{isHi ? "कंप्यूटर से लोगो अपलोड करें" : "Upload Logo from Device"}</span>
                                    </button>

                                    {brandingForm.logo_url && (
                                        <button
                                            type="button"
                                            onClick={() => setBrandingForm({ ...brandingForm, logo_url: "" })}
                                            className="superadmin-secondary-btn"
                                            style={{
                                                padding: "9px 14px",
                                                borderRadius: "10px",
                                                fontSize: "12.5px",
                                                fontWeight: 700,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isHi ? "लोगो हटाएं" : "Remove Logo"}
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={fieldLabelStyle}>{isHi ? "या छवि URL पेस्ट करें" : "Or Image Web URL (HTTPS)"}</label>
                                        <input
                                            type="url"
                                            placeholder="https://example.com/hospital-logo.png"
                                            value={brandingForm.logo_url || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, logo_url: e.target.value })}
                                            style={{ ...fieldInputStyle, marginTop: "4px" }}
                                        />
                                    </div>
                                    <div className="branding-inset-box" style={{
                                        width: "56px",
                                        height: "56px",
                                        borderRadius: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                        marginTop: "20px",
                                        padding: 0,
                                    }}>
                                        {brandingForm.logo_url ? (
                                            <img
                                                src={brandingForm.logo_url}
                                                alt="Logo"
                                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                                onError={(e) => { e.target.style.display = "none"; }}
                                            />
                                        ) : (
                                            <IconHospital size={24} color="#0284C7" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: ABOUT US MODAL SETTINGS */}
                    {activeBrandingTab === "about" && (
                        <div className="branding-section-card">
                            <div>
                                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <IconBookOpen size={18} color="#0284C7" />
                                    <span>{isHi ? "मरीज़ पोर्टल 'About Us' मॉडल सेटिंग्स" : "Patient Portal 'About Us' Modal Settings"}</span>
                                </h3>
                                <p style={{ margin: 0, fontSize: "12.5px" }}>
                                    {isHi ? "मरीज़ पोर्टल के अबाउट मॉडल में दिखने वाले आंकड़े, विशेषताएं, प्रमाणपत्र और लाभ अनुकूलित करें।" : "Configure metrics, clinical specializations, accreditation badges, technology highlights, and patient benefits."}
                                </p>
                            </div>

                            {/* 1. 4 Clinical Highlights */}
                            <div className="branding-inset-box">
                                <label style={{ ...fieldLabelStyle, marginBottom: "8px" }}>
                                    🏥 {isHi ? "4 प्रमुख सेवाएं व विशेषताएं (4 Clinical Highlights)" : "4 Key Clinical Features / Specializations"}
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Service 1</span>
                                        <input
                                            type="text"
                                            placeholder="24/7 Emergency Triage • Priority ambulance & ICU"
                                            value={brandingForm.about_service_1 || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_service_1: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Service 2</span>
                                        <input
                                            type="text"
                                            placeholder="AI Wait Prediction • Live queue sync"
                                            value={brandingForm.about_service_2 || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_service_2: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Service 3</span>
                                        <input
                                            type="text"
                                            placeholder="Multi-Specialty OPD • General, Cardiac, Neuro"
                                            value={brandingForm.about_service_3 || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_service_3: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Service 4</span>
                                        <input
                                            type="text"
                                            placeholder="Digital E-Prescriptions • Zero paperwork"
                                            value={brandingForm.about_service_4 || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_service_4: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 2. Key Performance & Achievement Stats (4 Metrics) */}
                            <div className="branding-inset-box">
                                <label style={{ ...fieldLabelStyle, marginBottom: "8px" }}>
                                    📊 {isHi ? "4 मुख्य प्रदर्शन आंकड़े (Key Performance & Achievement Metrics)" : "4 Key Achievement & Performance Metrics"}
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Stat 1 (Value / Label)</span>
                                        <input
                                            type="text"
                                            placeholder="15,000+"
                                            value={brandingForm.about_stat_1_val || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_stat_1_val: e.target.value })}
                                            style={{ ...fieldInputStyle, marginBottom: "4px" }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Monthly Patients"
                                            value={brandingForm.about_stat_1_lbl || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_stat_1_lbl: e.target.value })}
                                            style={{ ...fieldInputStyle, fontSize: "11.5px" }}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Stat 2 (Value / Label)</span>
                                        <input
                                            type="text"
                                            placeholder="98%"
                                            value={brandingForm.about_stat_2_val || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_stat_2_val: e.target.value })}
                                            style={{ ...fieldInputStyle, marginBottom: "4px" }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Satisfaction Rate"
                                            value={brandingForm.about_stat_2_lbl || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_stat_2_lbl: e.target.value })}
                                            style={{ ...fieldInputStyle, fontSize: "11.5px" }}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Stat 3 (Value / Label)</span>
                                        <input
                                            type="text"
                                            placeholder="< 8 min"
                                            value={brandingForm.about_stat_3_val || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_stat_3_val: e.target.value })}
                                            style={{ ...fieldInputStyle, marginBottom: "4px" }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Avg. Wait Time"
                                            value={brandingForm.about_stat_3_lbl || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_stat_3_lbl: e.target.value })}
                                            style={{ ...fieldInputStyle, fontSize: "11.5px" }}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Stat 4 (Value / Label)</span>
                                        <input
                                            type="text"
                                            placeholder="24 / 7"
                                            value={brandingForm.about_stat_4_val || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_stat_4_val: e.target.value })}
                                            style={{ ...fieldInputStyle, marginBottom: "4px" }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Always Available"
                                            value={brandingForm.about_stat_4_lbl || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_stat_4_lbl: e.target.value })}
                                            style={{ ...fieldInputStyle, fontSize: "11.5px" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 3. Accreditations & Certifications */}
                            <div className="branding-inset-box">
                                <label style={{ ...fieldLabelStyle, marginBottom: "8px" }}>
                                    🏅 {isHi ? "मान्यता व प्रमाणपत्र (3 Accreditations & Badges)" : "3 Accreditations & Certifications"}
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Badge 1 (Name / Subtitle)</span>
                                        <input
                                            type="text"
                                            placeholder="NABH Accredited"
                                            value={brandingForm.about_badge_1 || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_badge_1: e.target.value })}
                                            style={{ ...fieldInputStyle, marginBottom: "4px" }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="National Standards"
                                            value={brandingForm.about_badge_1_sub || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_badge_1_sub: e.target.value })}
                                            style={{ ...fieldInputStyle, fontSize: "11.5px" }}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Badge 2 (Name / Subtitle)</span>
                                        <input
                                            type="text"
                                            placeholder="ISO 27001 Certified"
                                            value={brandingForm.about_badge_2 || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_badge_2: e.target.value })}
                                            style={{ ...fieldInputStyle, marginBottom: "4px" }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Data Security"
                                            value={brandingForm.about_badge_2_sub || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_badge_2_sub: e.target.value })}
                                            style={{ ...fieldInputStyle, fontSize: "11.5px" }}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700 }}>Badge 3 (Name / Subtitle)</span>
                                        <input
                                            type="text"
                                            placeholder="Ayushman Bharat"
                                            value={brandingForm.about_badge_3 || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_badge_3: e.target.value })}
                                            style={{ ...fieldInputStyle, marginBottom: "4px" }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Govt. Empanelled"
                                            value={brandingForm.about_badge_3_sub || ""}
                                            onChange={(e) => setBrandingForm({ ...brandingForm, about_badge_3_sub: e.target.value })}
                                            style={{ ...fieldInputStyle, fontSize: "11.5px" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 4. Technology Highlights */}
                            <div className="branding-inset-box">
                                <label style={{ ...fieldLabelStyle, marginBottom: "4px" }}>
                                    ⚙️ {isHi ? "प्रौद्योगिकी एवं नवाचार टैग (Technology Stack - Comma Separated)" : "Technology & Innovation Stack (Comma Separated)"}
                                </label>
                                <input
                                    type="text"
                                    placeholder="AI Queue Orchestration, Real-Time Socket Sync, Digital Prescriptions, QR Check-In"
                                    value={brandingForm.about_tech_highlights || ""}
                                    onChange={(e) => setBrandingForm({ ...brandingForm, about_tech_highlights: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>

                            {/* 5. Why Choose Us Highlights */}
                            <div className="branding-inset-box">
                                <label style={{ ...fieldLabelStyle, marginBottom: "4px" }}>
                                    💡 {isHi ? "हमें क्यों चुनें? (Why Choose Us - प्रत्येक बिंदु नई पंक्ति में)" : "Why Choose Us Points (Each benefit on a new line)"}
                                </label>
                                <textarea
                                    rows="4"
                                    placeholder={"No physical queue — get your token digitally from anywhere\nAI auto-escalates critical/emergency cases instantly\nBook for all family members from a single account\nLive queue status on mobile + real-time alerts\nDigital e-prescriptions — zero paperwork needed"}
                                    value={brandingForm.about_why_choose || ""}
                                    onChange={(e) => setBrandingForm({ ...brandingForm, about_why_choose: e.target.value })}
                                    style={{ ...fieldInputStyle, resize: "vertical" }}
                                />
                            </div>
                        </div>
                    )}



                    {/* TAB 5: OPERATING HOURS & CUTOFF */}
                    {activeBrandingTab === "hours" && (
                        <div className="branding-section-card">
                            <div>
                                <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                                    <IconClock size={18} color="#0284C7" />
                                    <span>{isHi ? "संचालन समय एवं पंजीकरण कटऑफ" : "OPD Operating Hours & Daily Cutoff"}</span>
                                </h3>
                                <p style={{ margin: 0, fontSize: "12.5px" }}>
                                    {isHi ? "ओपीडी खुलने, बंद होने और टोकन कटऑफ का समय निर्धारित करें।" : "Set daily OPD opening, closing, and automatic non-emergency registration cutoffs."}
                                </p>
                            </div>

                            <div className="branding-inset-box" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
                                <div>
                                    <label style={fieldLabelStyle}>
                                        {isHi ? "ओपीडी प्रारंभ (Start)" : "OPD Opening Time"}
                                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", marginLeft: "6px" }}>
                                            ({format24To12(brandingForm.opd_start_time || "08:00")})
                                        </span>
                                    </label>
                                    <input
                                        type="time"
                                        value={brandingForm.opd_start_time || "08:00"}
                                        onChange={(e) => updateOperatingHours({ opd_start_time: e.target.value })}
                                        style={fieldInputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={fieldLabelStyle}>
                                        {isHi ? "ओपीडी समाप्ति (Close)" : "OPD Closing Time"}
                                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", marginLeft: "6px" }}>
                                            ({format24To12(brandingForm.opd_end_time || "20:00")})
                                        </span>
                                    </label>
                                    <input
                                        type="time"
                                        value={brandingForm.opd_end_time || "20:00"}
                                        onChange={(e) => {
                                            const newEnd = e.target.value;
                                            updateOperatingHours({
                                                opd_end_time: newEnd,
                                                registration_close_time: newEnd,
                                                registration_cutoff_time: (!brandingForm.registration_cutoff_time || brandingForm.registration_cutoff_time === brandingForm.opd_end_time) ? newEnd : brandingForm.registration_cutoff_time,
                                            });
                                        }}
                                        style={fieldInputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={{ ...fieldLabelStyle, color: "#EF4444" }}>
                                        {isHi ? "दैनिक कटऑफ समय *" : "Registration Cutoff *"}
                                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#EF4444", marginLeft: "6px" }}>
                                            ({format24To12(brandingForm.registration_cutoff_time || "19:00")})
                                        </span>
                                    </label>
                                    <input
                                        type="time"
                                        value={brandingForm.registration_cutoff_time || "19:00"}
                                        onChange={(e) => setBrandingForm({ ...brandingForm, registration_cutoff_time: e.target.value })}
                                        style={{ ...fieldInputStyle, borderColor: "rgba(239, 68, 68, 0.4)" }}
                                    />
                                </div>
                            </div>

                            {/* Cutoff Explanation Banner */}
                            <div style={{ background: "rgba(2, 132, 199, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "20px" }}>ℹ️</span>
                                <span style={{ fontSize: "12px", color: "var(--superadmin-text-main, #0F172A)", lineHeight: 1.45 }}>
                                    {isHi
                                        ? "कटऑफ समय के बाद गैर-आपातकालीन (Standard/Vulnerable) मरीज टोकन जनरेट नहीं कर सकते। आपातकालीन (Emergency) मरीज 24/7 कभी भी रजिस्टर कर सकते हैं।"
                                        : "Non-emergency patients cannot register or join the queue after this cutoff time. Emergency triage registrations remain active 24/7."}
                                </span>
                            </div>

                            {/* Weekly Days Selector */}
                            <div>
                                <label style={{ ...fieldLabelStyle, marginBottom: "8px" }}>
                                    {isHi ? "सक्रिय ओपीडी संचालन दिवस (Weekly Operating Days)" : "Weekly OPD Operating Days"}
                                </label>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                                        const isChecked = (brandingForm.operating_days || []).includes(day);
                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => {
                                                    const currentDays = brandingForm.operating_days || [];
                                                    const newDays = isChecked
                                                        ? currentDays.filter((d) => d !== day)
                                                        : [...currentDays, day];
                                                    updateOperatingHours({ operating_days: newDays });
                                                }}
                                                className={`branding-tab-pill ${isChecked ? "active" : ""}`}
                                                style={{
                                                    padding: "8px 16px",
                                                    borderRadius: "10px",
                                                    fontSize: "12.5px",
                                                }}
                                            >
                                                {isChecked ? "✓ " : ""}{day}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Off-Hours Closed Notice */}
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "क्लिनिक बंद होने की सूचना (Off-Hours Closed Notice)" : "Off-Hours Closed Notice to Patients"}</label>
                                <textarea
                                    rows="2"
                                    placeholder="Registrations are closed for today. Please visit during OPD hours or book an appointment for tomorrow."
                                    value={brandingForm.closed_notice || ""}
                                    onChange={(e) => setBrandingForm({ ...brandingForm, closed_notice: e.target.value })}
                                    style={{ ...fieldInputStyle, resize: "vertical" }}
                                />
                            </div>

                            {/* SECTION: PATIENT PORTAL AVAILABLE TIME SLOTS */}
                            <div style={{
                                marginTop: "10px",
                                paddingTop: "18px",
                                borderTop: "1.5px solid var(--superadmin-card-border, #E2E8F0)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                                    <div>
                                        <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px", color: "var(--superadmin-text-main, #0F172A)" }}>
                                            <IconCalendar size={18} color="#0284C7" />
                                            <span>{isHi ? "मरीज़ पोर्टल: उपलब्ध समय स्लॉट (Select Available Time Slot)" : "Patient Portal: Select Available Time Slot"}</span>
                                        </h4>
                                        <p style={{ margin: 0, fontSize: "12px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                            {isHi
                                                ? "मरीज़ पोर्टल के 'बुक स्लॉट' में दिखने वाले समय स्लॉट संपादित करें। मरीज इन्हीं स्लॉट्स में से अपॉइंटमेंट बुक कर सकते हैं।"
                                                : "Configure the available appointment booking time slots displayed in the Patient Portal under 'Select Available Time Slot'."}
                                        </p>
                                    </div>
                                    <span style={{
                                        fontSize: "12px",
                                        fontWeight: 800,
                                        color: currentSlots.length > 0 ? "#0284C7" : "#EF4444",
                                        background: currentSlots.length > 0 ? "rgba(2, 132, 199, 0.1)" : "rgba(239, 68, 68, 0.1)",
                                        border: `1px solid ${currentSlots.length > 0 ? "rgba(2, 132, 199, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                                        padding: "4px 12px",
                                        borderRadius: "20px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                    }}>
                                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: currentSlots.length > 0 ? "#0284C7" : "#EF4444" }} />
                                        {currentSlots.length} {isHi ? "सक्रिय स्लॉट" : "Active Slots"}
                                    </span>
                                </div>

                                {/* Smart Slot Builder / Add Controls */}
                                <div className="branding-inset-box" style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                                    gap: "14px",
                                    alignItems: "end",
                                    background: "var(--superadmin-sub-card, #F8FAFC)",
                                }}>
                                    {/* 12-Hour Manual Add Slot */}
                                    <div>
                                        <label style={{ ...fieldLabelStyle, marginBottom: "6px" }}>
                                            {isHi ? "नया समय स्लॉट जोड़ें (12-घंटे चयन)" : "Add Custom Time Slot (12-Hour Format)"}
                                        </label>
                                        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                            {/* 12-Hour Dropdown (01 to 12) */}
                                            <select
                                                value={slotHour}
                                                onChange={(e) => setSlotHour(e.target.value)}
                                                style={{
                                                    ...fieldInputStyle,
                                                    width: "68px",
                                                    padding: "8px 6px",
                                                    fontWeight: 800,
                                                    fontSize: "13px",
                                                    textAlign: "center",
                                                    cursor: "pointer",
                                                }}
                                                title="Select Hour (1-12)"
                                            >
                                                {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>

                                            <span style={{ fontWeight: 900, fontSize: "16px", color: "var(--superadmin-text-main, #0F172A)" }}>:</span>

                                            {/* Minute Dropdown */}
                                            <select
                                                value={slotMinute}
                                                onChange={(e) => setSlotMinute(e.target.value)}
                                                style={{
                                                    ...fieldInputStyle,
                                                    width: "68px",
                                                    padding: "8px 6px",
                                                    fontWeight: 800,
                                                    fontSize: "13px",
                                                    textAlign: "center",
                                                    cursor: "pointer",
                                                }}
                                                title="Select Minute"
                                            >
                                                {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>

                                            {/* AM / PM Toggle Buttons */}
                                            <div style={{
                                                display: "inline-flex",
                                                background: "var(--superadmin-sub-card, #E2E8F0)",
                                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                borderRadius: "10px",
                                                padding: "2px",
                                                gap: "2px",
                                            }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setSlotPeriod("AM")}
                                                    style={{
                                                        padding: "6px 11px",
                                                        borderRadius: "7px",
                                                        border: "none",
                                                        fontSize: "11.5px",
                                                        fontWeight: 900,
                                                        cursor: "pointer",
                                                        background: slotPeriod === "AM" ? "#0284C7" : "transparent",
                                                        color: slotPeriod === "AM" ? "#FFFFFF" : "var(--superadmin-text-sub, #475569)",
                                                        boxShadow: slotPeriod === "AM" ? "0 2px 6px rgba(2, 132, 199, 0.3)" : "none",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    AM
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSlotPeriod("PM")}
                                                    style={{
                                                        padding: "6px 11px",
                                                        borderRadius: "7px",
                                                        border: "none",
                                                        fontSize: "11.5px",
                                                        fontWeight: 900,
                                                        cursor: "pointer",
                                                        background: slotPeriod === "PM" ? "#0284C7" : "transparent",
                                                        color: slotPeriod === "PM" ? "#FFFFFF" : "var(--superadmin-text-sub, #475569)",
                                                        boxShadow: slotPeriod === "PM" ? "0 2px 6px rgba(2, 132, 199, 0.3)" : "none",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    PM
                                                </button>
                                            </div>

                                            {/* Add Slot Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleAddSlot()}
                                                style={{
                                                    padding: "9px 15px",
                                                    borderRadius: "10px",
                                                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                                    color: "#FFFFFF",
                                                    border: "none",
                                                    fontSize: "12px",
                                                    fontWeight: 800,
                                                    cursor: "pointer",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                    boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                <IconPlus size={14} />
                                                <span>{isHi ? "स्लॉट जोड़ें" : "Add Slot"}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Auto-Generate from OPD Hours */}
                                    <div>
                                        <label style={{ ...fieldLabelStyle, marginBottom: "6px" }}>
                                            {isHi ? "ओपीडी समय से स्वतः जनरेट करें (Auto-Generate)" : "Auto-Generate from OPD Hours"}
                                        </label>
                                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                            <select
                                                value={slotGenInterval}
                                                onChange={(e) => setSlotGenInterval(Number(e.target.value))}
                                                style={{ ...fieldInputStyle, flex: 1 }}
                                            >
                                                <option value={15}>Every 15 mins</option>
                                                <option value={30}>Every 30 mins</option>
                                                <option value={45}>Every 45 mins (Standard)</option>
                                                <option value={60}>Every 60 mins (Hourly)</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleAutoGenerateSlots}
                                                style={{
                                                    padding: "9px 14px",
                                                    borderRadius: "10px",
                                                    background: "rgba(2, 132, 199, 0.12)",
                                                    color: "#0284C7",
                                                    border: "1.5px solid rgba(2, 132, 199, 0.35)",
                                                    fontSize: "12px",
                                                    fontWeight: 800,
                                                    cursor: "pointer",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                    whiteSpace: "nowrap",
                                                }}
                                                title={`Generate slots between ${brandingForm.opd_start_time || "08:00"} and ${brandingForm.registration_cutoff_time || brandingForm.opd_end_time || "20:00"}`}
                                            >
                                                <span>⚡ {isHi ? "स्वतः बनाएं" : "Generate"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Slots Visual Chips Grid */}
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--superadmin-text-main, #0F172A)" }}>
                                            {isHi ? "वर्तमान में उपलब्ध स्लॉट्स (मरीज़ पोर्टल दृश्य)" : "Current Available Slots (Live Patient Portal Order)"}
                                        </span>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                type="button"
                                                onClick={handleResetSlotsToDefault}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "#0284C7",
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                    padding: "2px 6px",
                                                    textDecoration: "underline",
                                                }}
                                            >
                                                {isHi ? "डिफ़ॉल्ट 10 स्लॉट रीसेट करें" : "Reset Standard 10 Slots"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClearAllSlots}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "#EF4444",
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                    padding: "2px 6px",
                                                    textDecoration: "underline",
                                                }}
                                            >
                                                {isHi ? "सभी स्लॉट हटाएं" : "Clear All"}
                                            </button>
                                        </div>
                                    </div>

                                    {currentSlots.length === 0 ? (
                                        <div style={{
                                            padding: "20px",
                                            borderRadius: "12px",
                                            border: "1.5px dashed #FCA5A5",
                                            background: "#FEF2F2",
                                            textAlign: "center",
                                            color: "#DC2626",
                                            fontSize: "12.5px",
                                            fontWeight: 700,
                                        }}>
                                            ⚠️ {isHi ? "कोई समय स्लॉट कॉन्फ़िगर नहीं है! मरीज अपॉइंटमेंट बुक नहीं कर पाएंगे। कृपया स्लॉट जोड़ें या 'स्वतः बनाएं' पर क्लिक करें।" : "No booking slots configured! Patients will be unable to reserve appointment slots. Please add slots or click 'Auto-Generate'."}
                                        </div>
                                    ) : (
                                        <div style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                                            gap: "8px",
                                            maxHeight: "220px",
                                            overflowY: "auto",
                                            padding: "4px",
                                        }}>
                                            {currentSlots.map((slot) => (
                                                <div
                                                    key={slot}
                                                    style={{
                                                        padding: "8px 10px",
                                                        borderRadius: "8px",
                                                        border: "1.5px solid var(--superadmin-card-border, #CBD5E1)",
                                                        background: "var(--superadmin-card-bg, #FFFFFF)",
                                                        color: "var(--superadmin-text-main, #0F172A)",
                                                        fontSize: "12px",
                                                        fontWeight: 800,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    <span style={{ letterSpacing: "-0.2px" }}>{slot}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSlot(slot)}
                                                        title={`Remove ${slot}`}
                                                        style={{
                                                            background: "rgba(239, 68, 68, 0.1)",
                                                            border: "none",
                                                            color: "#DC2626",
                                                            borderRadius: "4px",
                                                            width: "20px",
                                                            height: "20px",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            cursor: "pointer",
                                                            fontSize: "12px",
                                                            fontWeight: 900,
                                                            padding: 0,
                                                            marginLeft: "6px",
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Patient Experience Notice */}
                                <div style={{
                                    background: "rgba(2, 132, 199, 0.08)",
                                    border: "1px solid rgba(2, 132, 199, 0.25)",
                                    borderRadius: "12px",
                                    padding: "10px 14px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                }}>
                                    <span style={{ fontSize: "16px" }}>ℹ️</span>
                                    <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-main, #0F172A)", lineHeight: 1.45 }}>
                                        {isHi
                                            ? "सहेजे गए समय स्लॉट मरीज पोर्टल के 'अपॉइंटमेंट स्लॉट बुक करें' में तुरंत लाइव दिखेंगे। निर्धारित स्लॉट से 30 मिनट पहले चेक-इन स्वतः सक्रिय हो जाता है।"
                                            : "Saved slots instantly reflect in the Patient Portal under 'Select Available Time Slot'. The arrival check-in window automatically activates 30 minutes before each slot."}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}


                </form>

                {/* RIGHT COLUMN: Sticky Real-Time Interactive Simulator Mockup */}
                <div className="branding-sticky-preview">
                    {/* Mockup Mode Selector Pills */}
                    <div className="branding-mode-pills-bar">
                        {[
                            { id: "portal", label: isHi ? "मरीज़ पोर्टल" : "Patient View", icon: IconSmartphone },
                            { id: "slip", label: isHi ? "टोकन पर्ची" : "Queue Pass", icon: IconTicket },
                            { id: "about", label: isHi ? "About Us" : "About Modal", icon: IconBookOpen },
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => setBrandingPreviewMode(mode.id)}
                                className={`branding-mode-pill-btn ${brandingPreviewMode === mode.id ? "active" : ""}`}
                            >
                                <mode.icon size={15} />
                                <span>{mode.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* LIVE SIMULATOR DEVICE CONTAINER */}
                    <div className="branding-preview-container">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--superadmin-text-muted, #64748B)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                LIVE PREVIEW SIMULATOR
                            </span>
                            <span style={{ fontSize: "11px", color: primaryClr, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                                Auto-Synced
                            </span>
                        </div>

                        {/* MODE 1: PATIENT PORTAL PREVIEW */}
                        {brandingPreviewMode === "portal" && (
                            <div className="branding-sim-portal-card" style={{
                                borderRadius: "20px",
                                border: `1.5px solid ${primaryClr}35`,
                                overflow: "hidden",
                                boxShadow: "0 14px 34px -6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.04)",
                                background: "var(--superadmin-card-bg, #FFFFFF)",
                                maxWidth: "340px",
                                margin: "0 auto",
                            }}>
                                {/* Simulated Phone Bezel Bar */}
                                <div style={{
                                    background: `linear-gradient(135deg, ${primaryClr} 0%, ${secondaryClr} 100%)`,
                                    padding: "8px 16px 2px 16px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.2px" }}>09:41</span>
                                    <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.4)" }} />
                                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>5G 100%</span>
                                </div>

                                {/* Simulated Portal Header */}
                                <div style={{
                                    background: `linear-gradient(135deg, ${primaryClr} 0%, ${secondaryClr} 100%)`,
                                    padding: "14px 16px 16px 16px",
                                    color: "#FFFFFF",
                                    position: "relative",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{
                                            width: "44px",
                                            height: "44px",
                                            borderRadius: "12px",
                                            background: "#FFFFFF",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            overflow: "hidden",
                                            flexShrink: 0,
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                            border: "2px solid rgba(255,255,255,0.9)",
                                        }}>
                                            {brandingForm.logo_url ? (
                                                <img src={brandingForm.logo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                            ) : (
                                                <IconHospital size={22} color={primaryClr} />
                                            )}
                                        </div>
                                        <div style={{ overflow: "hidden", flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                                <div style={{ fontWeight: 900, fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.2px" }}>
                                                    {currentHosp?.name || "City General Hospital"}
                                                </div>
                                                <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.25)", padding: "1px 5px", borderRadius: "4px", fontWeight: 800 }}>✓</span>
                                            </div>
                                            <div style={{ fontSize: "10.5px", opacity: 0.92, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "1px" }}>
                                                {brandingForm.tagline || (isHi ? "भरोसेमंद स्वास्थ्य सेवा • एनएबीएच मान्यता प्राप्त" : "Care you can trust • NABH Accredited")}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Hotline Banner (Sleek Clinical Ribbon) */}
                                {(brandingForm.emergency_helpline || "108") && (
                                    <div style={{
                                        margin: "10px 14px 0 14px",
                                        background: "linear-gradient(90deg, #FEF2F2 0%, #FFF1F2 100%)",
                                        border: "1px solid #FECACA",
                                        borderRadius: "10px",
                                        padding: "6px 10px",
                                        color: "#DC2626",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: "6px",
                                        boxShadow: "0 2px 6px rgba(220, 38, 38, 0.06)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ background: "#DC2626", color: "#FFFFFF", fontSize: "9px", padding: "1px 6px", borderRadius: "4px", fontWeight: 900 }}>
                                                24/7
                                            </span>
                                            <span>{isHi ? "आपातकालीन नंबर:" : "Emergency No:"}</span>
                                        </div>
                                        <span style={{ fontWeight: 900, letterSpacing: "0.2px" }}>
                                            {cleanEmergencyNumber(brandingForm.emergency_helpline || "108")}
                                        </span>
                                    </div>
                                )}

                                {/* Portal Body Mockup */}
                                <div style={{ padding: "12px 14px 16px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {/* OPD Status Pill */}
                                    <div className="branding-sim-inner-box" style={{
                                        borderRadius: "12px",
                                        padding: "9px 12px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                                        background: "rgba(2, 132, 199, 0.04)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.25)" }} />
                                            <div>
                                                <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                                    {isHi ? "ओपीडी खुली है" : "OPD Open"}: {brandingForm.opd_start_time || "08:00"} – {brandingForm.opd_end_time || "20:00"}
                                                </div>
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: "10px",
                                            color: "#D97706",
                                            fontWeight: 800,
                                            background: "#FEF3C7",
                                            border: "1px solid #FDE68A",
                                            padding: "2px 7px",
                                            borderRadius: "6px",
                                        }}>
                                            Cutoff: {brandingForm.registration_cutoff_time || "19:00"}
                                        </span>
                                    </div>

                                    {/* Simulated Quick Action Card (Ultra Modern Smart AI Queue Card) */}
                                    <div style={{
                                        background: `linear-gradient(135deg, ${primaryClr}12 0%, ${secondaryClr}08 100%)`,
                                        border: `1.5px solid ${primaryClr}35`,
                                        borderRadius: "16px",
                                        padding: "16px 14px",
                                        textAlign: "center",
                                        boxShadow: `0 6px 20px ${primaryClr}12`,
                                        position: "relative",
                                        overflow: "hidden",
                                    }}>
                                        <div style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            fontSize: "9.5px",
                                            fontWeight: 800,
                                            color: primaryClr,
                                            background: "#FFFFFF",
                                            border: `1px solid ${primaryClr}30`,
                                            padding: "2px 8px",
                                            borderRadius: "20px",
                                            marginBottom: "8px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.4px",
                                        }}>
                                            ⚡ {isHi ? "स्मार्ट एआई कतार" : "AI-POWERED QUEUE"}
                                        </div>

                                        <div style={{ fontSize: "14px", fontWeight: 900, color: primaryClr, marginBottom: "3px", letterSpacing: "-0.2px" }}>
                                            {isHi ? "त्वरित डिजिटल टोकन" : "Instant Token Generation"}
                                        </div>
                                        <div style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)", marginBottom: "12px", lineHeight: 1.4 }}>
                                            {isHi ? "रीयल-टाइम कतार ट्रैकिंग एवं स्वचालित परामर्श समय" : "Smart AI Queue Assignment with Real-Time Turn Estimator"}
                                        </div>

                                        {/* Micro Feature Highlights */}
                                        <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
                                            <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--superadmin-text-main, #0F172A)", background: "#FFFFFF", border: "1px solid var(--superadmin-card-border, #E2E8F0)", padding: "2px 6px", borderRadius: "5px" }}>
                                                ⏱ ~12 min wait
                                            </span>
                                            <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--superadmin-text-main, #0F172A)", background: "#FFFFFF", border: "1px solid var(--superadmin-card-border, #E2E8F0)", padding: "2px 6px", borderRadius: "5px" }}>
                                                📱 QR & SMS Pass
                                            </span>
                                        </div>

                                        <div style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "6px",
                                            background: `linear-gradient(135deg, ${primaryClr} 0%, ${secondaryClr} 100%)`,
                                            color: "#FFFFFF",
                                            padding: "8px 20px",
                                            borderRadius: "10px",
                                            fontSize: "12px",
                                            fontWeight: 800,
                                            boxShadow: `0 4px 14px ${primaryClr}45`,
                                            cursor: "pointer",
                                        }}>
                                            <span>{isHi ? "कतार में शामिल हों" : "Join Live Queue"}</span>
                                            <span>→</span>
                                        </div>
                                    </div>

                                    {/* Simulated Available Time Slot Picker in Simulator */}
                                    <div style={{
                                        background: "var(--superadmin-sub-card, #F8FAFC)",
                                        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                                        borderRadius: "14px",
                                        padding: "11px 12px",
                                        textAlign: "left",
                                    }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                                            <span style={{ fontSize: "10.5px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", display: "flex", alignItems: "center", gap: "5px" }}>
                                                <IconCalendar size={12} color={primaryClr} />
                                                <span>{isHi ? "उपलब्ध समय स्लॉट" : "Select Available Time Slot"}</span>
                                            </span>
                                            <span style={{ fontSize: "9px", fontWeight: 800, color: primaryClr, background: `${primaryClr}15`, padding: "1px 6px", borderRadius: "10px" }}>
                                                {currentSlots.length} slots
                                            </span>
                                        </div>
                                        {currentSlots.length === 0 ? (
                                            <div style={{ fontSize: "9.5px", color: "#DC2626", textAlign: "center", padding: "6px" }}>
                                                {isHi ? "कोई स्लॉट कॉन्फ़िगर नहीं है" : "No slots configured"}
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "5px" }}>
                                                    {currentSlots.slice(0, 6).map((slot, idx) => (
                                                        <div
                                                            key={slot + idx}
                                                            style={{
                                                                padding: "5px 2px",
                                                                borderRadius: "6px",
                                                                fontSize: "9px",
                                                                fontWeight: 700,
                                                                textAlign: "center",
                                                                border: idx === 0 ? `1.5px solid ${primaryClr}` : "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                                background: idx === 0 ? `${primaryClr}12` : "var(--superadmin-card-bg, #FFFFFF)",
                                                                color: idx === 0 ? primaryClr : "var(--superadmin-text-sub, #475569)",
                                                            }}
                                                        >
                                                            {slot}
                                                        </div>
                                                    ))}
                                                </div>
                                                {currentSlots.length > 6 && (
                                                    <div style={{ fontSize: "8.5px", color: "var(--superadmin-text-muted, #64748B)", textAlign: "center", marginTop: "5px", fontWeight: 600 }}>
                                                        +{currentSlots.length - 6} more slots in patient portal
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Help Desk Footer */}
                                    <div style={{
                                        fontSize: "10px",
                                        color: "var(--superadmin-text-muted, #64748B)",
                                        textAlign: "center",
                                        borderTop: "1px solid var(--superadmin-card-border, #E2E8F0)",
                                        paddingTop: "10px",
                                        lineHeight: 1.5,
                                    }}>
                                        <div>
                                            📍 {brandingForm.address || currentHosp?.address || "Medical District Blvd"}
                                        </div>
                                        <div style={{ fontWeight: 700, color: "var(--superadmin-text-main, #0F172A)", marginTop: "2px" }}>
                                            📞 {brandingForm.opd_helpdesk_phone ? (String(brandingForm.opd_helpdesk_phone).startsWith("OPD") ? brandingForm.opd_helpdesk_phone : `OPD No: ${brandingForm.opd_helpdesk_phone}`) : (currentHosp?.phone || "Helpdesk")}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MODE 2: THERMAL TOKEN SLIP PREVIEW */}
                        {brandingPreviewMode === "slip" && (
                            <div className="branding-sim-slip-card" style={{
                                borderRadius: "16px",
                                border: `1.5px solid var(--superadmin-card-border, #CBD5E1)`,
                                padding: "16px",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                background: "var(--superadmin-card-bg, #FFFFFF)",
                                maxWidth: "340px",
                                margin: "0 auto",
                            }}>
                                {/* Top Accent Bar */}
                                <div style={{ height: "4px", background: primaryClr, borderRadius: "2px", marginBottom: "10px" }} />

                                {/* Slip Header */}
                                <div style={{ textAlign: "center", borderBottom: "1.5px solid var(--superadmin-card-border, #E2E8F0)", paddingBottom: "10px", marginBottom: "10px" }}>
                                    <div style={{
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "8px",
                                        background: "rgba(2, 132, 199, 0.12)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto 6px auto",
                                        overflow: "hidden",
                                    }}>
                                        {brandingForm.logo_url ? (
                                            <img src={brandingForm.logo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                        ) : (
                                            <IconHospital size={20} color={primaryClr} />
                                        )}
                                    </div>
                                    <div style={{ fontWeight: 900, fontSize: "14px", color: "var(--superadmin-text-main, #0F172A)", textTransform: "uppercase" }}>
                                        {currentHosp?.name || "City General Hospital"}
                                    </div>
                                    <div style={{ fontSize: "10px", color: primaryClr, fontWeight: 700, marginTop: "2px" }}>
                                        {brandingForm.tagline || (isHi ? "भरोसेमंद स्वास्थ्य सेवा • आधिकारिक पास" : "Care you can trust • Official Clinical Pass")}
                                    </div>
                                    <div style={{ fontSize: "9.5px", color: "var(--superadmin-text-muted, #64748B)", marginTop: "2px" }}>
                                        Today at 09:30 AM
                                    </div>
                                </div>

                                {/* Helpline Banner */}
                                {[brandingForm.emergency_helpline || "Emergency No: 108", brandingForm.opd_helpdesk_phone ? (String(brandingForm.opd_helpdesk_phone).startsWith("OPD") ? brandingForm.opd_helpdesk_phone : `OPD No: ${brandingForm.opd_helpdesk_phone}`) : ""].filter(Boolean).length > 0 && (
                                    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "4px 8px", marginBottom: "10px", color: "#DC2626", fontWeight: 800, fontSize: "9.5px", textAlign: "center" }}>
                                        {[brandingForm.emergency_helpline || "Emergency No: 108", brandingForm.opd_helpdesk_phone ? (String(brandingForm.opd_helpdesk_phone).startsWith("OPD") ? brandingForm.opd_helpdesk_phone : `OPD No: ${brandingForm.opd_helpdesk_phone}`) : ""].filter(Boolean).join(" • ")}
                                    </div>
                                )}

                                {/* Token Hero Card */}
                                <div style={{ textAlign: "center", border: `2px solid ${primaryClr}`, borderRadius: "12px", padding: "10px 8px", margin: "8px 0", background: "rgba(2, 132, 199, 0.06)" }}>
                                    <span style={{ fontSize: "9px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", background: "#FFFFFF", border: "1px solid #CBD5E1", padding: "2px 8px", borderRadius: "20px", textTransform: "uppercase" }}>
                                        ● {isHi ? "टोकन संख्या" : "TOKEN PASS"}
                                    </span>
                                    <div style={{ fontSize: "36px", fontWeight: 900, color: primaryClr, lineHeight: 1.1, margin: "4px 0 2px 0" }}>
                                        #P-104
                                    </div>
                                    <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", background: "#FFFFFF", padding: "2px 8px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                                        🏥 General Medicine • Desk 02
                                    </span>
                                </div>

                                {/* 2x2 Clinical Tiles Grid */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", margin: "8px 0" }}>
                                    <div style={{ background: "rgba(2, 132, 199, 0.04)", border: "1px solid var(--superadmin-card-border, #E2E8F0)", borderRadius: "8px", padding: "6px 8px" }}>
                                        <div style={{ fontSize: "8.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Patient</div>
                                        <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>Amit Verma</div>
                                        <div style={{ fontSize: "9.5px", color: "var(--superadmin-text-muted, #64748B)" }}>34Y / M</div>
                                    </div>
                                    <div style={{ background: "rgba(2, 132, 199, 0.04)", border: "1px solid var(--superadmin-card-border, #E2E8F0)", borderRadius: "8px", padding: "6px 8px" }}>
                                        <div style={{ fontSize: "8.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Status</div>
                                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#D97706" }}>● Waiting</div>
                                        <div style={{ fontSize: "9.5px", color: "var(--superadmin-text-muted, #64748B)" }}>Standard OPD</div>
                                    </div>
                                    <div style={{ background: "rgba(2, 132, 199, 0.04)", border: "1px solid var(--superadmin-card-border, #E2E8F0)", borderRadius: "8px", padding: "6px 8px" }}>
                                        <div style={{ fontSize: "8.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Position</div>
                                        <div style={{ fontSize: "16px", fontWeight: 900, color: "#D97706" }}>#4</div>
                                    </div>
                                    <div style={{ background: "rgba(2, 132, 199, 0.04)", border: "1px solid var(--superadmin-card-border, #E2E8F0)", borderRadius: "8px", padding: "6px 8px" }}>
                                        <div style={{ fontSize: "8.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Est. Wait</div>
                                        <div style={{ fontSize: "16px", fontWeight: 900, color: primaryClr }}>~25 min</div>
                                    </div>
                                </div>

                                {/* Tear Notch Separator */}
                                <div style={{ borderTop: "1.5px dashed var(--superadmin-card-border, #CBD5E1)", margin: "10px 0 8px 0", textAlign: "center", position: "relative" }}>
                                    <span style={{ fontSize: "9px", color: "var(--superadmin-text-muted, #94A3B8)", background: "var(--superadmin-card-bg, #FFFFFF)", padding: "0 6px", position: "relative", top: "-7px" }}>
                                        ✂ Official Ticket Pass
                                    </span>
                                </div>

                                {/* Permanent Legal notice */}
                                <div style={{ fontSize: "8.5px", color: "var(--superadmin-text-muted, #64748B)", textAlign: "center", lineHeight: 1.3 }}>
                                    {isHi
                                        ? "अहस्तांतरणीय आधिकारिक मरीज़ रिकॉर्ड • कृपया परामर्श समाप्ति तक संभाल कर रखें"
                                        : "Non-transferable official patient record • Retain until consultation is complete"}
                                </div>
                            </div>
                        )}

                        {/* MODE 3: ABOUT US MODAL PREVIEW */}
                        {brandingPreviewMode === "about" && (
                            <div className="branding-sim-about-card" style={{
                                borderRadius: "16px",
                                border: `1.5px solid ${primaryClr}44`,
                                padding: "16px",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                                maxHeight: "560px",
                                overflowY: "auto",
                            }}>
                                {/* Header */}
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <div style={{
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "10px",
                                        background: primaryClr,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                    }}>
                                        {brandingForm.logo_url ? (
                                            <img src={brandingForm.logo_url} alt="Logo" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                                        ) : (
                                            <IconHospital size={18} color="#FFFFFF" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800 }}>
                                            {brandingForm.about_us_title || `About ${currentHosp?.name || "City General Hospital"}`}
                                        </h4>
                                        <span style={{ fontSize: "10.5px", color: "var(--superadmin-text-muted, #64748B)", fontWeight: 600 }}>
                                            {brandingForm.tagline || brandingForm.about_us_subtitle || "Care you can trust • NABH"}
                                        </span>
                                    </div>
                                </div>

                                {/* Key Metrics Row */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "12px" }}>
                                    {[
                                        { val: brandingForm.about_stat_1_val || "15,000+", lbl: brandingForm.about_stat_1_lbl || "Patients", icon: "👥" },
                                        { val: brandingForm.about_stat_2_val || "98%", lbl: brandingForm.about_stat_2_lbl || "Satisfaction", icon: "⭐" },
                                        { val: brandingForm.about_stat_3_val || "< 8 min", lbl: brandingForm.about_stat_3_lbl || "Avg Wait", icon: "⚡" },
                                        { val: brandingForm.about_stat_4_val || "24/7", lbl: brandingForm.about_stat_4_lbl || "Available", icon: "🕐" },
                                    ].map((s, idx) => (
                                        <div key={idx} style={{ background: "var(--superadmin-input-bg, #FFFFFF)", border: "1px solid var(--superadmin-card-border, #CBD5E1)", borderRadius: "8px", padding: "6px 4px", textAlign: "center" }}>
                                            <div style={{ fontSize: "11px" }}>{s.icon}</div>
                                            <div style={{ fontSize: "11.5px", fontWeight: 900, color: primaryClr }}>{s.val}</div>
                                            <div style={{ fontSize: "8.5px", color: "var(--superadmin-text-muted, #64748B)" }}>{s.lbl}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Mission Statement */}
                                <p style={{ fontSize: "11.5px", color: "var(--superadmin-text-sub, #334155)", lineHeight: "1.5", margin: "0 0 10px 0" }}>
                                    {brandingForm.about_us || "Premier medical institution dedicated to patient-first care with AI-driven intelligent queue orchestration..."}
                                </p>

                                {/* 4 Clinical Highlights */}
                                <div className="branding-sim-inner-box" style={{ borderRadius: "10px", padding: "8px", marginBottom: "10px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "10px" }}>
                                        <div style={{ color: primaryClr, fontWeight: 700 }}>✓ {brandingForm.about_service_1 || "24/7 Triage"}</div>
                                        <div style={{ color: primaryClr, fontWeight: 700 }}>✓ {brandingForm.about_service_2 || "AI Predictions"}</div>
                                        <div style={{ color: primaryClr, fontWeight: 700 }}>✓ {brandingForm.about_service_3 || "Multi-OPD"}</div>
                                        <div style={{ color: primaryClr, fontWeight: 700 }}>✓ {brandingForm.about_service_4 || "E-Prescriptions"}</div>
                                    </div>
                                </div>

                                {/* Accreditations */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "10px" }}>
                                    {[
                                        { title: brandingForm.about_badge_1 || "NABH", sub: brandingForm.about_badge_1_sub || "Accredited", icon: "🏅" },
                                        { title: brandingForm.about_badge_2 || "ISO 27001", sub: brandingForm.about_badge_2_sub || "Certified", icon: "🛡️" },
                                        { title: brandingForm.about_badge_3 || "Ayushman", sub: brandingForm.about_badge_3_sub || "Bharat", icon: "🤝" },
                                    ].map((b, idx) => (
                                        <div key={idx} style={{ background: "var(--superadmin-input-bg, #FFFFFF)", border: "1px solid var(--superadmin-card-border, #CBD5E1)", borderRadius: "8px", padding: "6px 4px", textAlign: "center" }}>
                                            <div style={{ fontSize: "12px" }}>{b.icon}</div>
                                            <div style={{ fontSize: "10px", fontWeight: 800 }}>{b.title}</div>
                                            <div style={{ fontSize: "8px", color: "var(--superadmin-text-muted, #64748B)" }}>{b.sub}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Emergency CTA Preview */}
                                <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: "8px", padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#DC2626" }}>🚨 Emergency Helpline</span>
                                    <span style={{ background: "#DC2626", color: "#FFFFFF", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 800 }}>
                                        📞 {brandingForm.emergency_helpline?.replace(/^Emergency Helpline:\s*/i, "").split("/")[0].trim() || "108"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sticky Save Footer Action Bar */}
                    <div className="branding-bottom-bar">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: primaryClr }} />
                            <span style={{ fontSize: "12px", fontWeight: 700 }}>
                                {currentHosp?.name}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleSaveBrandingSubmit(null, currentHosp)}
                            disabled={isSavingBranding}
                            style={{
                                background: `linear-gradient(135deg, ${primaryClr} 0%, ${secondaryClr} 100%)`,
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "10px",
                                padding: "8px 18px",
                                fontSize: "12.5px",
                                fontWeight: 800,
                                cursor: isSavingBranding ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                boxShadow: `0 4px 12px ${primaryClr}44`,
                            }}
                        >
                            {isSavingBranding ? <IconRefresh size={14} /> : <IconSave size={14} />}
                            <span>{isSavingBranding ? (isHi ? "सहेजा जा रहा है..." : "Saving...") : (isHi ? "सहेजें" : "Save Changes")}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
