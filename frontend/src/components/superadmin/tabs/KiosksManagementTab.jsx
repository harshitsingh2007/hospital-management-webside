import React, { useState, useEffect, useMemo } from "react";
import {
    IconHospital,
    IconPlus,
    IconSearch,
    IconEdit,
    IconTrash,
    IconExternalLink,
    IconCopy,
    IconQr,
    IconMonitor,
    IconTv,
    IconWifi,
    IconRefresh,
    IconX,
    IconCheckCircle,
} from "../SuperAdminIcons";
import {
    standaloneCardStyle,
    actionBtnStyle,
    fieldInputStyle,
} from "../superAdminStyles";
import { API_BASE } from "../../../config/hospitalConfig";
import "../SuperAdmin.css";

export default function KiosksManagementTab({
    selectedHospital,
    hospitals = [],
    onSelectHospital,
    hospitalDepts = [],
    getAuthHeaders,
    notify,
    showConfirm,
    language = "en",
    isHi = false,
}) {
    const [kiosks, setKiosks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Modal States
    const [showUpsertModal, setShowUpsertModal] = useState(false);
    const [editingKiosk, setEditingKiosk] = useState(null);
    const [kioskForm, setKioskForm] = useState({
        kiosk_code: "",
        name: "",
        location: "",
        department_id: "",
        is_active: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // QR Code Modal State
    const [qrModalKiosk, setQrModalKiosk] = useState(null);

    const hospCode = selectedHospital?.hospital_code || (hospitals[0]?.hospital_code || "city-hospital-01");

    // 1. Fetch Kiosks for Selected Hospital
    const fetchKiosks = async () => {
        if (!hospCode) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/hospitals/${hospCode}/kiosks`, {
                headers: getAuthHeaders ? getAuthHeaders() : {},
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setKiosks(data.kiosks || []);
            } else {
                setKiosks([]);
            }
        } catch (err) {
            console.error("Fetch kiosks error:", err);
            if (notify) notify(isHi ? "कियोस्क लोड करने में त्रुटि।" : "Failed to load kiosks.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKiosks();
    }, [hospCode]);

    // 2. Open Add / Edit Modal
    const handleOpenAdd = () => {
        setEditingKiosk(null);
        // Suggest next code based on current count
        const nextNum = kiosks.length + 1;
        const suggestedCode = `K-0${nextNum}`;
        setKioskForm({
            kiosk_code: suggestedCode,
            name: `${selectedHospital?.name || "Hospital"} Waiting Room Display ${nextNum}`,
            location: "Main Waiting Lounge",
            department_id: "",
            is_active: true,
        });
        setShowUpsertModal(true);
    };

    const handleOpenEdit = (kiosk) => {
        setEditingKiosk(kiosk);
        setKioskForm({
            kiosk_code: kiosk.kiosk_code,
            name: kiosk.name || "",
            location: kiosk.location || "",
            department_id: kiosk.department_id ? String(kiosk.department_id) : "",
            is_active: kiosk.is_active !== false,
        });
        setShowUpsertModal(true);
    };

    // 3. Submit Kiosk Upsert
    const handleSubmitKiosk = async (e) => {
        e.preventDefault();
        if (!kioskForm.kiosk_code.trim()) {
            if (notify) notify(isHi ? "कियोस्क कोड आवश्यक है।" : "Kiosk code is required.", "warn");
            return;
        }
        if (!kioskForm.name.trim()) {
            if (notify) notify(isHi ? "कियोस्क नाम आवश्यक है।" : "Terminal name is required.", "warn");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                kiosk_code: kioskForm.kiosk_code.trim().toUpperCase(),
                name: kioskForm.name.trim(),
                location: kioskForm.location.trim() || "Main Entrance",
                department_id: kioskForm.department_id ? parseInt(kioskForm.department_id, 10) : null,
                is_active: kioskForm.is_active,
            };

            const res = await fetch(`${API_BASE}/api/v1/hospitals/${hospCode}/kiosks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(getAuthHeaders ? getAuthHeaders() : {}),
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok && data.status === "success") {
                if (notify) {
                    notify(
                        editingKiosk
                            ? (isHi ? "कियोस्क सफलतापूर्वक अपडेट किया गया।" : "Kiosk updated successfully.")
                            : (isHi ? "नया कियोस्क टर्मिनल सफलतापूर्वक जोड़ा गया।" : "New kiosk terminal registered successfully."),
                        "success"
                    );
                }
                setShowUpsertModal(false);
                fetchKiosks();
            } else {
                if (notify) notify(data.message || (isHi ? "सहेजने में विफल।" : "Failed to save kiosk."), "error");
            }
        } catch (err) {
            console.error("Upsert kiosk error:", err);
            if (notify) notify(isHi ? "सर्वर से कनेक्ट करने में त्रुटि।" : "Server connection error.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    // 4. Delete Kiosk
    const handleDeleteKiosk = (kiosk) => {
        if (!showConfirm) return;
        showConfirm({
            title: isHi ? "कियोस्क हटाएं?" : "Delete Kiosk Terminal?",
            message: isHi
                ? `क्या आप वाकई कियोस्क '${kiosk.name}' (${kiosk.kiosk_code}) को हटाना चाहते हैं? यह स्मार्ट टीवी से डिस्कनेक्ट हो जाएगा।`
                : `Are you sure you want to delete '${kiosk.name}' (${kiosk.kiosk_code})? Any TV or display connected to this terminal will stop receiving updates.`,
            confirmText: isHi ? "हां, हटाएं" : "Yes, Delete",
            cancelText: isHi ? "रद्द करें" : "Cancel",
            isDanger: true,
            onConfirm: async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/v1/hospitals/${hospCode}/kiosks/${kiosk.kiosk_code}`, {
                        method: "DELETE",
                        headers: getAuthHeaders ? getAuthHeaders() : {},
                    });
                    const data = await res.json();
                    if (res.ok && data.status === "success") {
                        if (notify) notify(isHi ? "कियोस्क सफलतापूर्वक हटाया गया।" : "Kiosk deleted successfully.", "success");
                        fetchKiosks();
                    } else {
                        if (notify) notify(data.message || (isHi ? "हटाने में विफल।" : "Failed to delete."), "error");
                    }
                } catch (err) {
                    console.error("Delete kiosk error:", err);
                    if (notify) notify(isHi ? "हटाने में त्रुटि।" : "Error deleting kiosk.", "error");
                }
            },
        });
    };

    // Helper: Determine if online (heartbeat within 2 minutes)
    const isKioskOnline = (kiosk) => {
        if (!kiosk.last_seen_at) return false;
        const diffMs = Date.now() - new Date(kiosk.last_seen_at).getTime();
        return diffMs < 120000; // 2 minutes
    };

    // Helper: Generate Display URL
    const getKioskDisplayUrl = (kiosk) => {
        const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
        return `${origin}/kiosk/${hospCode}/${kiosk.kiosk_code}/display`;
    };

    // Helper: Copy URL to clipboard
    const handleCopyUrl = (kiosk) => {
        const url = getKioskDisplayUrl(kiosk);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url)
                .then(() => {
                    if (notify) notify(isHi ? "कियोस्क टीवी डिस्प्ले लिंक कॉपी हो गया!" : "Kiosk TV display link copied to clipboard!", "success");
                })
                .catch(() => {
                    if (notify) notify(url, "info");
                });
        }
    };

    // Helper: Launch in new window/tab
    const handleLaunchKiosk = (kiosk) => {
        const url = getKioskDisplayUrl(kiosk);
        window.open(url, "_blank");
    };

    // 5. Filtered Kiosks
    const filteredKiosks = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return kiosks.filter((k) => {
            const matchesQuery =
                !q ||
                (k.kiosk_code || "").toLowerCase().includes(q) ||
                (k.name || "").toLowerCase().includes(q) ||
                (k.location || "").toLowerCase().includes(q) ||
                (k.departments?.name || "").toLowerCase().includes(q);

            if (!matchesQuery) return false;

            if (statusFilter === "online") return isKioskOnline(k);
            if (statusFilter === "offline") return !isKioskOnline(k);
            if (statusFilter === "inactive") return k.is_active === false;

            return true;
        });
    }, [kiosks, searchQuery, statusFilter]);

    // Statistics
    const stats = useMemo(() => {
        const total = kiosks.length;
        const online = kiosks.filter(isKioskOnline).length;
        const active = kiosks.filter((k) => k.is_active !== false).length;
        return { total, online, active };
    }, [kiosks]);

    return (
        <div style={standaloneCardStyle}>
            <style>{`
                .pulse-green-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #10B981;
                    display: inline-block;
                    box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
                    animation: pulseDot 1.8s infinite;
                }
                @keyframes pulseDot {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .spin-animation {
                    animation: spinRotate 0.9s linear infinite;
                }
                @keyframes spinRotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
            {/* 1. Header Bar with Hospital Selector & Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                    <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", color: "var(--superadmin-text-main, #0F172A)", fontWeight: 800 }}>
                        {isHi ? "कियोस्क टर्मिनल्स एवं वेटिंग रूम टीवी डिस्प्ले" : "Kiosk Terminals & Waiting Room Displays"}
                    </h2>
                    {hospitals && hospitals.length > 1 ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--superadmin-sub-card, #F1F5F9)", padding: "4px 10px", borderRadius: "10px", border: "1px solid var(--superadmin-card-border, #CBD5E1)", marginTop: "2px" }}>
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
                                • {stats.online}/{stats.total} {isHi ? "ऑनलाइन टर्मिनल" : "Online Terminals"}
                            </span>
                        </div>
                    ) : (
                        <p style={{ margin: 0, fontSize: "13px", color: "var(--superadmin-text-muted, #64748B)" }}>
                            {selectedHospital?.name || "Hospital"} • {stats.total} {isHi ? "कियोस्क पंजीकृत" : "Terminals Registered"}
                        </p>
                    )}
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                        type="button"
                        onClick={fetchKiosks}
                        disabled={loading}
                        style={{
                            ...actionBtnStyle,
                            background: "var(--superadmin-sub-card, #F1F5F9)",
                            color: "var(--superadmin-text-main, #334155)",
                            border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            cursor: loading ? "wait" : "pointer",
                        }}
                    >
                        <IconRefresh size={14} className={loading ? "spin-animation" : ""} />
                        <span>{isHi ? "रिफ्रेश" : "Refresh"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenAdd}
                        style={{
                            ...actionBtnStyle,
                            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                            color: "#FFFFFF",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                        }}
                    >
                        <IconPlus size={14} />
                        <span>{isHi ? "नया कियोस्क जोड़ें" : "Add Kiosk Terminal"}</span>
                    </button>
                </div>
            </div>

            {/* 2. Hardware Status Metric Cards */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                    marginBottom: "20px",
                }}
            >
                {/* Total Displays */}
                <div style={statCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={statLabelStyle}>{isHi ? "कुल कियोस्क / टीवी" : "TOTAL TERMINALS"}</span>
                        <div style={{ ...iconBadgeStyle, background: "rgba(2, 132, 199, 0.12)", color: "#0284C7" }}>
                            <IconMonitor size={18} />
                        </div>
                    </div>
                    <div style={statValueStyle}>{stats.total}</div>
                    <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                        {isHi ? "वेटिंग हॉल व लॉबी स्क्रीन्स" : "Lounge TVs & Check-in Desks"}
                    </span>
                </div>

                {/* Online Displays */}
                <div style={statCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={statLabelStyle}>{isHi ? "सक्रिय ऑनलाइन" : "CURRENTLY ONLINE"}</span>
                        <div style={{ ...iconBadgeStyle, background: "rgba(16, 185, 129, 0.12)", color: "#10B981" }}>
                            <IconWifi size={18} />
                        </div>
                    </div>
                    <div style={{ ...statValueStyle, color: "#10B981", display: "flex", alignItems: "center", gap: "8px" }}>
                        {stats.online}
                        {stats.online > 0 && <span className="pulse-green-dot" />}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                        {isHi ? "हार्टबीट 30 सेकंड में प्राप्त" : "Live heartbeat within 2 min"}
                    </span>
                </div>

                {/* Ready / Enabled */}
                <div style={statCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={statLabelStyle}>{isHi ? "सक्षम डिस्प्ले" : "ENABLED DISPLAYS"}</span>
                        <div style={{ ...iconBadgeStyle, background: "rgba(99, 102, 241, 0.12)", color: "#6366F1" }}>
                            <IconTv size={18} />
                        </div>
                    </div>
                    <div style={{ ...statValueStyle, color: "#6366F1" }}>{stats.active}</div>
                    <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                        {isHi ? "प्रसारण हेतु तैयार" : "Configured & Ready for Queue"}
                    </span>
                </div>
            </div>

            {/* 3. Search and Status Filters */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                    <div style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--superadmin-text-muted, #94A3B8)" }}>
                        <IconSearch size={14} />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isHi ? "कियोस्क कोड, नाम, या स्थान खोजें..." : "Search by code, name, or room location..."}
                        style={{
                            ...fieldInputStyle,
                            paddingLeft: "32px",
                            paddingRight: "10px",
                            paddingTop: "7px",
                            paddingBottom: "7px",
                            fontSize: "12.5px",
                        }}
                    />
                </div>

                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {[
                        { id: "all", label: isHi ? "सभी" : "All" },
                        { id: "online", label: isHi ? "ऑनलाइन" : "Online 🟢" },
                        { id: "offline", label: isHi ? "ऑफलाइन" : "Offline ⚪" },
                        { id: "inactive", label: isHi ? "निष्क्रिय" : "Disabled ⚠️" },
                    ].map((pill) => (
                        <button
                            key={pill.id}
                            type="button"
                            onClick={() => setStatusFilter(pill.id)}
                            style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                border: "1px solid",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                background: statusFilter === pill.id ? "#0284C7" : "var(--superadmin-sub-card, #F8FAFC)",
                                borderColor: statusFilter === pill.id ? "#0284C7" : "var(--superadmin-card-border, #CBD5E1)",
                                color: statusFilter === pill.id ? "#FFFFFF" : "var(--superadmin-text-muted, #64748B)",
                            }}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Kiosks Grid List */}
            {loading && kiosks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--superadmin-text-muted, #64748B)" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>
                        {isHi ? "कियोस्क लोड हो रहे हैं..." : "Loading kiosk terminals..."}
                    </div>
                </div>
            ) : filteredKiosks.length === 0 ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: "48px 24px",
                        borderRadius: "14px",
                        background: "var(--superadmin-sub-card, #F8FAFC)",
                        border: "1px dashed var(--superadmin-card-border, #CBD5E1)",
                    }}
                >
                    <IconMonitor size={40} color="#94A3B8" />
                    <h3 style={{ margin: "14px 0 6px 0", fontSize: "16px", color: "var(--superadmin-text-main, #0F172A)", fontWeight: 800 }}>
                        {searchQuery ? (isHi ? "कोई मेल खाने वाला कियोस्क नहीं मिला" : "No matching kiosks found") : (isHi ? "कोई कियोस्क पंजीकृत नहीं है" : "No Kiosk Terminals Registered Yet")}
                    </h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--superadmin-text-muted, #64748B)", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                        {searchQuery
                            ? (isHi ? "कृपया अपना खोज शब्द बदलें।" : "Try refining your search query.")
                            : (isHi ? "प्रतीक्षालय में स्मार्ट टीवी या टैबलेट पर कतार प्रदर्शित करने के लिए नया कियोस्क जोड़ें।" : "Register a kiosk terminal to display live queue tokens and voice announcements on waiting room smart TVs.")}
                    </p>
                    {!searchQuery && (
                        <button
                            type="button"
                            onClick={handleOpenAdd}
                            style={{
                                ...actionBtnStyle,
                                background: "#0284C7",
                                color: "#FFFFFF",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <IconPlus size={14} />
                            <span>{isHi ? "पहला कियोस्क जोड़ें" : "Register First Terminal"}</span>
                        </button>
                    )}
                </div>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                        gap: "16px",
                    }}
                >
                    {filteredKiosks.map((kiosk) => {
                        const online = isKioskOnline(kiosk);
                        const displayUrl = getKioskDisplayUrl(kiosk);

                        return (
                            <div
                                key={kiosk.id || kiosk.kiosk_code}
                                style={{
                                    borderRadius: "14px",
                                    background: "var(--superadmin-sub-card, #FFFFFF)",
                                    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                                    padding: "16px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    position: "relative",
                                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                                }}
                            >
                                {/* Top Badges */}
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span
                                                style={{
                                                    fontSize: "12px",
                                                    fontWeight: 900,
                                                    padding: "3px 8px",
                                                    borderRadius: "6px",
                                                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                                    color: "#FFFFFF",
                                                    letterSpacing: "0.5px",
                                                }}
                                            >
                                                {kiosk.kiosk_code}
                                            </span>

                                            {/* Department Scope */}
                                            <span
                                                style={{
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    padding: "2px 7px",
                                                    borderRadius: "6px",
                                                    background: "rgba(100, 116, 139, 0.1)",
                                                    color: "var(--superadmin-text-muted, #475569)",
                                                }}
                                            >
                                                {kiosk.departments?.name || (isHi ? "सभी विभाग" : "All Departments")}
                                            </span>
                                        </div>

                                        {/* Online/Offline Pill */}
                                        <div
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "5px",
                                                fontSize: "10.5px",
                                                fontWeight: 800,
                                                padding: "3px 8px",
                                                borderRadius: "20px",
                                                background: !kiosk.is_active
                                                    ? "rgba(245, 158, 11, 0.15)"
                                                    : online
                                                    ? "rgba(16, 185, 129, 0.15)"
                                                    : "rgba(148, 163, 184, 0.15)",
                                                color: !kiosk.is_active
                                                    ? "#D97706"
                                                    : online
                                                    ? "#059669"
                                                    : "#64748B",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: "6px",
                                                    height: "6px",
                                                    borderRadius: "50%",
                                                    background: !kiosk.is_active
                                                        ? "#D97706"
                                                        : online
                                                        ? "#10B981"
                                                        : "#94A3B8",
                                                }}
                                            />
                                            {!kiosk.is_active
                                                ? (isHi ? "निष्क्रिय" : "Disabled")
                                                : online
                                                ? (isHi ? "ऑनलाइन" : "Online")
                                                : (isHi ? "ऑफलाइन" : "Standby")}
                                        </div>
                                    </div>

                                    {/* Terminal Name & Location */}
                                    <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                        {kiosk.name}
                                    </h4>
                                    <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                        📍 {kiosk.location || (isHi ? "मुख्य लॉबी" : "Main Lounge")}
                                    </p>

                                    {/* Display URL Snippet */}
                                    <div
                                        style={{
                                            background: "var(--superadmin-card-border, #F1F5F9)",
                                            padding: "6px 8px",
                                            borderRadius: "8px",
                                            fontSize: "11px",
                                            color: "var(--superadmin-text-muted, #64748B)",
                                            fontFamily: "monospace",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            marginBottom: "14px",
                                            border: "1px solid rgba(0,0,0,0.05)",
                                        }}
                                    >
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "6px" }}>
                                            /kiosk/{hospCode}/{kiosk.kiosk_code}/display
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyUrl(kiosk)}
                                            title={isHi ? "लिंक कॉपी करें" : "Copy URL"}
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                cursor: "pointer",
                                                color: "#0284C7",
                                                display: "flex",
                                                alignItems: "center",
                                                padding: "2px",
                                            }}
                                        >
                                            <IconCopy size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom Action Buttons */}
                                <div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "6px", alignItems: "center" }}>
                                        {/* Launch TV Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleLaunchKiosk(kiosk)}
                                            style={{
                                                ...actionBtnStyle,
                                                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                                color: "#FFFFFF",
                                                padding: "6px 12px",
                                                fontSize: "12px",
                                                fontWeight: 800,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "6px",
                                                borderRadius: "8px",
                                            }}
                                        >
                                            <IconExternalLink size={13} />
                                            <span>{isHi ? "टीवी पर खोलें" : "Launch TV"}</span>
                                        </button>

                                        {/* QR Code Button */}
                                        <button
                                            type="button"
                                            onClick={() => setQrModalKiosk(kiosk)}
                                            title={isHi ? "टीवी से कनेक्ट हेतु QR देखें" : "View TV Setup QR Code"}
                                            style={{
                                                background: "var(--superadmin-sub-card, #F1F5F9)",
                                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                borderRadius: "8px",
                                                padding: "7px 9px",
                                                cursor: "pointer",
                                                color: "var(--superadmin-text-main, #334155)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <IconQr size={15} />
                                        </button>

                                        {/* Edit Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(kiosk)}
                                            title={isHi ? "संपादित करें" : "Edit Terminal"}
                                            style={{
                                                background: "var(--superadmin-sub-card, #F1F5F9)",
                                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                                borderRadius: "8px",
                                                padding: "7px 9px",
                                                cursor: "pointer",
                                                color: "var(--superadmin-text-main, #334155)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <IconEdit size={14} />
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteKiosk(kiosk)}
                                            title={isHi ? "हटाएं" : "Delete Terminal"}
                                            style={{
                                                background: "rgba(220, 38, 38, 0.08)",
                                                border: "1px solid rgba(220, 38, 38, 0.2)",
                                                borderRadius: "8px",
                                                padding: "7px 9px",
                                                cursor: "pointer",
                                                color: "#DC2626",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <IconTrash size={14} />
                                        </button>
                                    </div>

                                    {/* Last Seen timestamp */}
                                    <div style={{ marginTop: "8px", fontSize: "10.5px", color: "var(--superadmin-text-muted, #94A3B8)", textAlign: "right" }}>
                                        {kiosk.last_seen_at ? (
                                            <>
                                                {isHi ? "अंतिम संपर्क:" : "Heartbeat:"}{" "}
                                                {new Date(kiosk.last_seen_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                            </>
                                        ) : (
                                            <span>{isHi ? "हार्टबीट प्रतीक्षारत" : "No heartbeat recorded yet"}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 5. MODAL: Add / Edit Kiosk Terminal */}
            {showUpsertModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalBoxStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ ...iconBadgeStyle, background: "rgba(2, 132, 199, 0.12)", color: "#0284C7" }}>
                                    <IconMonitor size={18} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                    {editingKiosk
                                        ? (isHi ? "कियोस्क टर्मिनल संपादित करें" : "Edit Kiosk Terminal")
                                        : (isHi ? "नया कियोस्क टर्मिनल जोड़ें" : "Register New Kiosk Display")}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowUpsertModal(false)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitKiosk}>
                            {/* Kiosk Code */}
                            <div style={{ marginBottom: "12px" }}>
                                <label style={formLabelStyle}>
                                    {isHi ? "कियोस्क कोड (जैसे K-01, TV-OPD):" : "Kiosk Terminal Code (e.g. K-01, TV-OPD):"}
                                </label>
                                <input
                                    type="text"
                                    value={kioskForm.kiosk_code}
                                    onChange={(e) => setKioskForm({ ...kioskForm, kiosk_code: e.target.value.toUpperCase() })}
                                    placeholder="K-01"
                                    required
                                    disabled={!!editingKiosk}
                                    style={{
                                        ...fieldInputStyle,
                                        fontWeight: 800,
                                        letterSpacing: "0.5px",
                                        background: editingKiosk ? "#F1F5F9" : "inherit",
                                    }}
                                />
                                {editingKiosk && (
                                    <span style={{ fontSize: "10.5px", color: "#64748B", marginTop: "2px", display: "block" }}>
                                        {isHi ? "कियोस्क कोड नहीं बदला जा सकता।" : "Terminal code is fixed after creation."}
                                    </span>
                                )}
                            </div>

                            {/* Name */}
                            <div style={{ marginBottom: "12px" }}>
                                <label style={formLabelStyle}>
                                    {isHi ? "डिस्प्ले नाम:" : "Display / Screen Name:"}
                                </label>
                                <input
                                    type="text"
                                    value={kioskForm.name}
                                    onChange={(e) => setKioskForm({ ...kioskForm, name: e.target.value })}
                                    placeholder={isHi ? "जैसे: मुख्य प्रतीक्षालय टीवी" : "e.g. Ground Floor Waiting Lounge TV"}
                                    required
                                    style={fieldInputStyle}
                                />
                            </div>

                            {/* Location */}
                            <div style={{ marginBottom: "12px" }}>
                                <label style={formLabelStyle}>
                                    {isHi ? "भौतिक स्थान / कमरा:" : "Physical Location / Floor:"}
                                </label>
                                <input
                                    type="text"
                                    value={kioskForm.location}
                                    onChange={(e) => setKioskForm({ ...kioskForm, location: e.target.value })}
                                    placeholder={isHi ? "जैसे: भूतल, रूम 3 के सामने" : "e.g. Ground Floor, Wing A, Opposite Room 3"}
                                    style={fieldInputStyle}
                                />
                            </div>

                            {/* Department Scope */}
                            <div style={{ marginBottom: "16px" }}>
                                <label style={formLabelStyle}>
                                    {isHi ? "विभाग फ़िल्टर (वैकल्पिक):" : "Department Scope (Optional):"}
                                </label>
                                <select
                                    value={kioskForm.department_id}
                                    onChange={(e) => setKioskForm({ ...kioskForm, department_id: e.target.value })}
                                    style={{ ...fieldInputStyle, cursor: "pointer" }}
                                >
                                    <option value="">{isHi ? "सभी विभाग (अस्पताल व्यापी कतार)" : "All Departments (Hospital-Wide Queue)"}</option>
                                    {hospitalDepts.map((d) => (
                                        <option key={d.id || d.dept_code} value={d.id}>
                                            {d.name} ({d.dept_code})
                                        </option>
                                    ))}
                                </select>
                                <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)", marginTop: "3px", display: "block" }}>
                                    {isHi ? "यदि कोई विभाग चुना जाता है, तो यह टीवी केवल उसी विभाग के टोकन दिखाएगा।" : "If a department is selected, this TV will exclusively display tokens for that department."}
                                </span>
                            </div>

                            {/* Is Active Toggle */}
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", padding: "10px", background: "var(--superadmin-sub-card, #F8FAFC)", borderRadius: "8px" }}>
                                <input
                                    type="checkbox"
                                    id="kiosk_active_cb"
                                    checked={kioskForm.is_active}
                                    onChange={(e) => setKioskForm({ ...kioskForm, is_active: e.target.checked })}
                                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                />
                                <label htmlFor="kiosk_active_cb" style={{ fontSize: "13px", fontWeight: 700, cursor: "pointer", color: "var(--superadmin-text-main, #0F172A)" }}>
                                    {isHi ? "कियोस्क सक्रिय है (लाइव टोकन प्रसारित करें)" : "Kiosk is Active (Broadcast live queue tokens)"}
                                </label>
                            </div>

                            {/* Submit Buttons */}
                            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                                <button
                                    type="button"
                                    onClick={() => setShowUpsertModal(false)}
                                    style={{
                                        ...actionBtnStyle,
                                        background: "transparent",
                                        border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                        color: "var(--superadmin-text-muted, #64748B)",
                                    }}
                                >
                                    {isHi ? "रद्द करें" : "Cancel"}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    style={{
                                        ...actionBtnStyle,
                                        background: "#0284C7",
                                        color: "#FFFFFF",
                                        cursor: isSubmitting ? "wait" : "pointer",
                                    }}
                                >
                                    {isSubmitting
                                        ? (isHi ? "सहेज रहा है..." : "Saving...")
                                        : editingKiosk
                                        ? (isHi ? "परिवर्तन सहेजें" : "Save Changes")
                                        : (isHi ? "कियोस्क बनाएं" : "Create Terminal")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 6. MODAL: QR Code Setup for Smart TV */}
            {qrModalKiosk && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalBoxStyle, maxWidth: "440px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <IconQr size={20} color="#0284C7" />
                                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                    {qrModalKiosk.kiosk_code} • {isHi ? "टीवी सेटअप QR कोड" : "Smart TV Setup QR Code"}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQrModalKiosk(null)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "14px", border: "1px solid #CBD5E1", display: "inline-block", margin: "0 auto 16px auto", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getKioskDisplayUrl(qrModalKiosk))}`}
                                alt="Kiosk Display QR Code"
                                style={{ width: "190px", height: "190px", display: "block" }}
                            />
                        </div>

                        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--superadmin-text-muted, #64748B)", lineHeight: 1.5 }}>
                            {isHi
                                ? "स्मार्ट टीवी, एंड्रॉइड बॉक्स, या टैबलेट के कैमरे से स्कैन करें ताकि यह वेटिंग रूम डिस्प्ले सीधे खुल सके।"
                                : "Scan with any Smart TV, Android Box, or tablet camera to instantly open this waiting room display without needing to log in."}
                        </p>

                        <div
                            style={{
                                background: "var(--superadmin-sub-card, #F1F5F9)",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                color: "var(--superadmin-text-main, #334155)",
                                fontFamily: "monospace",
                                wordBreak: "break-all",
                                marginBottom: "16px",
                                border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                            }}
                        >
                            {getKioskDisplayUrl(qrModalKiosk)}
                        </div>

                        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                            <button
                                type="button"
                                onClick={() => handleCopyUrl(qrModalKiosk)}
                                style={{
                                    ...actionBtnStyle,
                                    background: "var(--superadmin-sub-card, #F1F5F9)",
                                    border: "1px solid var(--superadmin-card-border, #CBD5E1)",
                                    color: "var(--superadmin-text-main, #334155)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                }}
                            >
                                <IconCopy size={14} />
                                <span>{isHi ? "URL कॉपी करें" : "Copy URL"}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleLaunchKiosk(qrModalKiosk)}
                                style={{
                                    ...actionBtnStyle,
                                    background: "#0284C7",
                                    color: "#FFFFFF",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                }}
                            >
                                <IconExternalLink size={14} />
                                <span>{isHi ? "अभी खोलें" : "Open in New Tab"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Sub-styles
const statCardStyle = {
    background: "var(--superadmin-sub-card, #FFFFFF)",
    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
    borderRadius: "12px",
    padding: "14px 16px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
};

const statLabelStyle = {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.5px",
    color: "var(--superadmin-text-muted, #64748B)",
};

const statValueStyle = {
    fontSize: "24px",
    fontWeight: 900,
    color: "var(--superadmin-text-main, #0F172A)",
    margin: "4px 0 2px 0",
};

const iconBadgeStyle = {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const formLabelStyle = {
    display: "block",
    fontSize: "12.5px",
    fontWeight: 700,
    marginBottom: "5px",
    color: "var(--superadmin-text-main, #334155)",
};

const modalOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    backdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
};

const modalBoxStyle = {
    background: "var(--superadmin-card-bg, #FFFFFF)",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "520px",
    padding: "24px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
    border: "1px solid var(--superadmin-card-border, #E2E8F0)",
};
