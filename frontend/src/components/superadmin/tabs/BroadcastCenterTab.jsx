/**
 * BroadcastCenterTab.jsx
 * ----------------------
 * Network-Wide Emergency Broadcast & Announcement Center for Super Admin.
 *
 * Capabilities:
 * - Live alert push across all hospitals or specific tenant facility via WebSockets.
 * - Alert types: Code Blue (Medical Emergency), System Maintenance/OPD Closing, General Public Health Camp.
 * - Target surfaces: Patient Portal, Doctor Desks, Reception Desks, Waiting Room Kiosks & TV Displays.
 * - 1-Click rapid emergency presets.
 * - Real-time animated marquee preview inside a Hospital Screen Simulator.
 * - Live active fleet manager with instant alert kill/dismissal.
 * - Complete responsive containment: strictly zero horizontal overflow across any viewport.
 * - Redesigned spacious Live Broadcast Composer with roomy priority selection cards and surface toggles.
 */

import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../../../config/hospitalConfig";
import {
  IconMegaphone,
  IconBroadcast,
  IconAlertTriangle,
  IconSiren,
  IconVolume2,
  IconVolumeX,
  IconRefresh,
  IconClock,
  IconBuilding,
  IconX,
  IconChecklist,
} from "../SuperAdminIcons";

// Dual-tone Web Audio API sound preview helper
function playChimePreview(type = "code_blue") {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    const isCritical = type === "code_blue";
    osc1.type = isCritical ? "sawtooth" : "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(isCritical ? 960 : 784, now);
    osc1.frequency.exponentialRampToValueAtTime(isCritical ? 1280 : 1046, now + 0.18);

    osc2.frequency.setValueAtTime(isCritical ? 520 : 523, now);
    osc2.frequency.exponentialRampToValueAtTime(isCritical ? 640 : 659, now + 0.22);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(isCritical ? 0.22 : 0.15, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.7);
    osc2.stop(now + 0.7);
  } catch (e) {
    // Audio autoplay policy
  }
}

export default function BroadcastCenterTab({
  hospitals = [],
  selectedHospital = null,
  getAuthHeaders = () => ({}),
  notify = () => {},
  showConfirm = null,
  isHi = false,
  currentUser = null,
  socketConnected = true,
}) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState(null);

  // Form composer state
  const [formScope, setFormScope] = useState("all"); // "all" or specific hospital_code
  const [formType, setFormType] = useState("code_blue"); // "code_blue" | "maintenance" | "general"
  const [formTitle, setFormTitle] = useState("CODE BLUE: Resuscitation Team to Room 304 Immediately");
  const [formMessage, setFormMessage] = useState(
    "Resuscitation & CPR trauma team required immediately at ICU Block 2, Room 304. Keep emergency corridor clear."
  );
  const [formDuration, setFormDuration] = useState("30"); // minutes ("15", "30", "60", "240", "0" for manual)
  const [formSound, setFormSound] = useState(true);
  const [formSurfaces, setFormSurfaces] = useState({
    patient_portal: true,
    doctor_desk: true,
    staff_desk: true,
    kiosk_display: true,
  });

  // Fetch all broadcasts
  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/superadmin/broadcasts`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.status === "success" && Array.isArray(data.broadcasts)) {
        setBroadcasts(data.broadcasts);
      }
    } catch (err) {
      console.warn("Error fetching broadcasts:", err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Listen to socket broadcast events to automatically sync table
  useEffect(() => {
    const handleBroadcastLive = () => {
      fetchBroadcasts();
    };
    window.addEventListener("broadcast_updated_live", handleBroadcastLive);
    return () => window.removeEventListener("broadcast_updated_live", handleBroadcastLive);
  }, [fetchBroadcasts]);

  // Rapid Presets
  const applyPreset = (presetKey) => {
    switch (presetKey) {
      case "code_blue":
        setFormType("code_blue");
        setFormTitle(isHi ? "कोड ब्लू: आपातकालीन पुनर्जीवन टीम कक्ष 304 में तत्काल पहुंचे" : "CODE BLUE: Resuscitation Team to Room 304 Immediately");
        setFormMessage(
          isHi
            ? "आईसीयू ब्लॉक 2, कमरा 304 में तत्काल आपातकालीन प्रतिक्रिया टीम की आवश्यकता है। कृपया गलियारा खाली रखें।"
            : "Emergency resuscitation trauma team required immediately at ICU Block 2, Room 304. Keep emergency corridor clear."
        );
        setFormDuration("30");
        setFormSound(true);
        break;

      case "code_red":
        setFormType("code_blue");
        setFormTitle(isHi ? "कोड रेड: अग्नि सुरक्षा चेतावनी - ब्लॉक सी" : "CODE RED: Fire Safety Alarm - North Wing Block C");
        setFormMessage(
          isHi
            ? "ब्लॉक सी में अग्नि संवेदक सक्रिय हुआ है। सभी डॉक्टर व मरीज़ शांत रहें और आपातकालीन निकास सीढ़ियों का उपयोग करें।"
            : "Smoke detection alarm active in Block C. Staff and visitors please follow illuminated emergency exit corridors."
        );
        setFormDuration("45");
        setFormSound(true);
        break;

      case "opd_closing":
        setFormType("maintenance");
        setFormTitle(isHi ? "ओपीडी पंजीकरण दोपहर 2:00 बजे बंद होगा" : "OPD Token Registration Closing at 2:00 PM");
        setFormMessage(
          isHi
            ? "दैनिक सैनिटाइजेशन और शिफ्ट परिवर्तन के कारण आज की सामान्य ओपीडी टोकन बुकिंग दोपहर 2:00 बजे समाप्त हो जाएगी।"
            : "General OPD walk-in registration counters will conclude at 2:00 PM today for sanitization and clinician shift handover."
        );
        setFormDuration("120");
        setFormSound(false);
        break;

      case "maintenance":
        setFormType("maintenance");
        setFormTitle(isHi ? "सर्वर प्रणाली रखरखाव सूचना - 15 मिनट में" : "Scheduled Core System Maintenance in 15 Minutes");
        setFormMessage(
          isHi
            ? "अस्पताल कतार प्रबंधन प्रणाली का नियमित क्लाउड बैकअप 15 मिनट में शुरू होगा। वर्तमान परामर्श निर्बाध जारी रहेंगे।"
            : "Routine cloud infrastructure maintenance begins in 15 minutes. Ongoing consultations remain unaffected."
        );
        setFormDuration("60");
        setFormSound(false);
        break;

      case "camp":
        setFormType("general");
        setFormTitle(isHi ? "निःशुल्क हृदय एवं मधुमेह जांच शिविर आज" : "Free Cardiology & Diabetic Health Screening Camp Today");
        setFormMessage(
          isHi
            ? "मुख्य ओपीडी लॉबी में आज सायं 4:00 बजे तक निःशुल्क ईसीजी, रक्तचाप और शुगर जांच शिविर आयोजित है। सभी आमंत्रित हैं।"
            : "Free comprehensive ECG, Blood Pressure and Glucose screening camp open today until 4:00 PM at Main Atrium Lobby."
        );
        setFormDuration("240");
        setFormSound(false);
        break;

      case "doc_relocation":
        setFormType("general");
        setFormTitle(isHi ? "डॉक्टर परामर्श काउंटर स्थानांतरण सूचना" : "Clinical Consultation Counter Relocation Notice");
        setFormMessage(
          isHi
            ? "कार्डियोलॉजी विभाग के वरिष्ठ डॉक्टर परामर्श अब काउंटर #4 (कमरा 102) में स्थानांतरित कर दिए गए हैं।"
            : "Cardiology consultations with Dr. Sharma have been relocated to Counter #4 (OPD Examination Room 102)."
        );
        setFormDuration("180");
        setFormSound(false);
        break;

      default:
        break;
    }
    notify(isHi ? "टेम्पलेट लोड किया गया!" : "Preset template loaded into composer!");
  };

  // Quick insertion helpers for headline
  const insertHeadlineSuggestion = (text) => {
    setFormTitle(text);
  };

  // Submit Broadcast
  const handleSubmitBroadcast = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() && !formMessage.trim()) {
      notify(isHi ? "कृपया शीर्षक या संदेश दर्ज करें" : "Please enter a headline or message", "warn");
      return;
    }

    const matchedHosp = hospitals.find((h) => h.hospital_code === formScope);
    const hospitalName = formScope === "all" ? "All Hospitals (Network-Wide)" : (matchedHosp?.name || formScope);

    const payload = {
      hospital_code: formScope,
      hospital_name: hospitalName,
      type: formType,
      title: formTitle.trim(),
      message: formMessage.trim(),
      duration_minutes: Number(formDuration),
      sound: formSound,
      target_surfaces: formSurfaces,
    };

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/superadmin/broadcasts`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        notify(
          isHi
            ? `🚨 लाइव प्रसारण सफलतापूर्वक सभी स्क्रीन पर भेजा गया!`
            : `🚨 Live announcement dispatched instantly across hospital screens!`
        );
        fetchBroadcasts();
      } else {
        notify(data.message || "Failed to dispatch broadcast", "error");
      }
    } catch (err) {
      console.error("Error creating broadcast:", err);
      notify("Network error dispatching broadcast", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dismiss / Kill Active Broadcast
  const handleDismissBroadcast = async (broadcastId) => {
    const executeDismiss = async () => {
      setActionInProgressId(broadcastId);
      try {
        const res = await fetch(`${API_BASE}/api/v1/superadmin/broadcasts/${broadcastId}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.status === "success") {
          notify(isHi ? "प्रसारण समाप्त किया गया" : "Broadcast killed & removed from all screens");
          setBroadcasts((prev) =>
            prev.map((b) => (b.id === broadcastId ? { ...b, is_active: false, dismissed_at: new Date().toISOString() } : b))
          );
        } else {
          notify(data.message || "Failed to dismiss broadcast", "error");
        }
      } catch (err) {
        notify("Network error dismissing broadcast", "error");
      } finally {
        setActionInProgressId(null);
      }
    };

    if (showConfirm) {
      showConfirm({
        title: isHi ? "लाइव प्रसारण समाप्त करें?" : "Kill Live Broadcast?",
        message: isHi
          ? "यह अलर्ट सभी कियोस्क, टीवी डिस्प्ले, डॉक्टर एवं मरीज़ स्क्रीनों से तुरंत हटा दिया जाएगा।"
          : "This will immediately dismiss and strip this announcement banner from all active Kiosks, TV displays, Doctor desks, and Patient portals.",
        confirmText: isHi ? "हां, प्रसारण रोकें" : "Kill Broadcast",
        cancelText: isHi ? "रद्द करें" : "Cancel",
        isDestructive: true,
        onConfirm: executeDismiss,
      });
    } else {
      executeDismiss();
    }
  };

  // Reset composer
  const handleResetComposer = () => {
    setFormScope("all");
    setFormType("code_blue");
    setFormTitle("");
    setFormMessage("");
    setFormDuration("30");
    setFormSound(true);
    setFormSurfaces({
      patient_portal: true,
      doctor_desk: true,
      staff_desk: true,
      kiosk_display: true,
    });
    notify(isHi ? "फॉर्म रीसेट किया गया" : "Composer reset to blank state");
  };

  // Select all or clear surfaces
  const toggleAllSurfaces = (val) => {
    setFormSurfaces({
      patient_portal: val,
      doctor_desk: val,
      staff_desk: val,
      kiosk_display: val,
    });
  };

  const activeBroadcastsList = broadcasts.filter((b) => b.is_active);
  const archivedBroadcastsList = broadcasts.filter((b) => !b.is_active);



  return (
    <div
      className="broadcast-center-tab-root"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      {/* Scoped CSS for responsive grid & aesthetics */}
      <style>{`
        .broadcast-center-tab-root * {
          box-sizing: border-box;
        }

        .broadcast-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          gap: 24px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          align-items: start;
        }

        @media (max-width: 1180px) {
          .broadcast-main-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }

        .broadcast-composer-card {
          background: #FFFFFF;
          border-radius: 18px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
          overflow: hidden;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .broadcast-composer-section {
          padding: 22px 24px;
          border-bottom: 1px solid #F1F5F9;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .broadcast-composer-section:last-child {
          border-bottom: none;
        }

        .broadcast-priority-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          user-select: none;
        }

        .broadcast-priority-card:hover {
          border-color: #CBD5E1;
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.04);
        }

        .broadcast-priority-card.is-selected-critical {
          border-color: #DC2626 !important;
          background: #FEF2F2 !important;
          box-shadow: 0 4px 16px rgba(220, 38, 38, 0.12);
        }

        .broadcast-priority-card.is-selected-warning {
          border-color: #D97706 !important;
          background: #FFFBEB !important;
          box-shadow: 0 4px 16px rgba(217, 119, 6, 0.12);
        }

        .broadcast-priority-card.is-selected-info {
          border-color: #0D9488 !important;
          background: #F0FDFA !important;
          box-shadow: 0 4px 16px rgba(13, 148, 136, 0.12);
        }

        .broadcast-surface-tile {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid #E2E8F0;
          background: #F8FAFC;
          cursor: pointer;
          transition: all 0.18s ease;
          user-select: none;
        }

        .broadcast-surface-tile:hover {
          border-color: #CBD5E1;
          background: #FFFFFF;
        }

        .broadcast-surface-tile.is-active {
          border-color: #4F46E5 !important;
          background: #EEF2FF !important;
        }

        .broadcast-preset-btn {
          background: #FFFFFF;
          border: 1.5px solid #E2E8F0;
          padding: 9px 15px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .broadcast-preset-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.06);
        }


        .pulse-live-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10B981;
          display: inline-block;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: pulseGreen 1.8s infinite;
        }

        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>

      {/* 1. Header Overview & Live Telemetry Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0B132B 0%, #1C2541 100%)",
          borderRadius: "18px",
          padding: "24px 28px",
          color: "#FFFFFF",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", minWidth: 0, flex: "1 1 340px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 20px rgba(220, 38, 38, 0.45)",
              flexShrink: 0,
            }}
          >
            <IconBroadcast size={28} color="#FFFFFF" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.01em", color: "#FFFFFF" }}>
                {isHi ? "नेटवर्क-व्यापी आपातकालीन प्रसारण केंद्र" : "Network-Wide Emergency Broadcast & Announcement Center"}
              </h2>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: socketConnected ? "#34D399" : "#FBBF24",
                  background: "rgba(255, 255, 255, 0.08)",
                  padding: "3px 9px",
                  borderRadius: "20px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                <span className="pulse-live-indicator" style={{ background: socketConnected ? "#10B981" : "#F59E0B" }} />
                {socketConnected ? "WEBSOCKET LIVE" : "POLLING MODE"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#94A3B8", lineHeight: 1.4 }}>
              {isHi
                ? "रीयल-टाइम वेबसॉकेट्स द्वारा सभी अस्पतालों, कियोस्क, टीवी डिस्प्ले, डॉक्टर एवं मरीज़ स्क्रीनों पर तत्काल संदेश भेजें।"
                : "Push instant emergency alerts, code blue calls, and public notices across all hospital terminals via real-time WebSockets."}
            </p>
          </div>
        </div>

        {/* Live Metrics Pill Group */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", flexShrink: 0 }}>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              padding: "10px 18px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              textAlign: "center",
              minWidth: "100px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {isHi ? "सक्रिय प्रसारण" : "Active Alerts"}
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 900,
                color: activeBroadcastsList.length > 0 ? "#F87171" : "#34D399",
                lineHeight: 1.2,
                marginTop: "2px",
              }}
            >
              {activeBroadcastsList.length}
            </div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              padding: "10px 18px",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              textAlign: "center",
              minWidth: "100px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {isHi ? "नेटवर्क पहुंच" : "Target Branches"}
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "#38BDF8", lineHeight: 1.2, marginTop: "2px" }}>
              {hospitals.length || 1}
            </div>
          </div>

          <button
            type="button"
            onClick={fetchBroadcasts}
            title={isHi ? "रीफ्रेश करें" : "Refresh status"}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.16)",
              color: "#FFFFFF",
              borderRadius: "12px",
              padding: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
          >
            <IconRefresh size={18} />
          </button>
        </div>
      </div>

      {/* 2. Quick Presets Bar */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "20px 24px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚡</span>
            <span>{isHi ? "1-क्लिक त्वरित आपातकालीन टेम्पलेट्स" : "1-Click Rapid Emergency Presets"}</span>
          </div>
          <span style={{ fontSize: "11px", color: "#64748B" }}>
            {isHi ? "क्लिक करके तुरंत कंपोज़र में लोड करें" : "Click any preset to pre-fill composer with proven emergency text"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", width: "100%" }}>
          <button
            type="button"
            onClick={() => applyPreset("code_blue")}
            className="broadcast-preset-btn"
            style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#991B1B" }}
          >
            <IconSiren size={16} color="#DC2626" />
            <span>{isHi ? "🚨 कोड ब्लू (कार्डियक अरेस्ट)" : "🚨 Code Blue (Cardiac/Trauma)"}</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("code_red")}
            className="broadcast-preset-btn"
            style={{ borderColor: "#FECDD3", background: "#FFF1F2", color: "#9F1239" }}
          >
            <IconAlertTriangle size={16} color="#E11D48" />
            <span>{isHi ? "🔥 कोड रेड (अग्नि सुरक्षा)" : "🔥 Code Red (Fire Evacuation)"}</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("opd_closing")}
            className="broadcast-preset-btn"
            style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}
          >
            <IconClock size={16} color="#D97706" />
            <span>{isHi ? "⚠️ ओपीडी काउंटर समाप्ति" : "⚠️ OPD Registration Closing"}</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("maintenance")}
            className="broadcast-preset-btn"
            style={{ borderColor: "#FCD34D", background: "#FEF3C7", color: "#854D0E" }}
          >
            <IconBuilding size={16} color="#B45309" />
            <span>{isHi ? "🔧 सर्वर प्रणाली रखरखाव" : "🔧 Scheduled Server Maintenance"}</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("camp")}
            className="broadcast-preset-btn"
            style={{ borderColor: "#BBF7D0", background: "#F0FDF4", color: "#166534" }}
          >
            <IconMegaphone size={16} color="#16A34A" />
            <span>{isHi ? "📢 निःशुल्क स्वास्थ्य शिविर" : "📢 Free Health Camp Today"}</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("doc_relocation")}
            className="broadcast-preset-btn"
            style={{ borderColor: "#BAE6FD", background: "#F0F9FF", color: "#075985" }}
          >
            <IconChecklist size={16} color="#0284C7" />
            <span>{isHi ? "🩺 डॉक्टर रूम स्थानांतरण" : "🩺 Doctor Room Relocation"}</span>
          </button>
        </div>
      </div>

      {/* 3. Main Grid: Redesigned Spacious Composer (Left) & Real-time Live Preview + Active Fleet (Right) */}
      <div className="broadcast-main-grid">
        {/* Left Column: Live Broadcast Composer Form (Redesigned with plenty of breathing room) */}
        <div className="broadcast-composer-card">
          {/* Composer Header */}
          <div
            style={{
              padding: "20px 24px",
              background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
              borderBottom: "1.5px solid #F1F5F9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background: "#EEF2FF",
                  color: "#4F46E5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(79, 70, 229, 0.15)",
                }}
              >
                <IconMegaphone size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                  {isHi ? "नया प्रसारण तैयार करें (लाइव कंपोज़र)" : "Live Broadcast Composer"}
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748B" }}>
                  {isHi ? "संदेश तुरंत सभी जुड़े टर्मिनलों पर प्रसारित होगा" : "Configured announcements stream instantly across hospital terminals"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetComposer}
              style={{
                background: "transparent",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748B",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <IconX size={12} />
              {isHi ? "रीसेट करें" : "Reset Form"}
            </button>
          </div>

          <form onSubmit={handleSubmitBroadcast}>
            {/* SECTION 1: TARGET FACILITY & ALERT CLASSIFICATION (Spacious, Roomy Selector) */}
            <div className="broadcast-composer-section">
              {/* Target Facility Scope */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1E293B", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  📍 {isHi ? "लक्षित सुविधा / अस्पताल शाखा" : "Target Hospital Facility / Scope"}
                </label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #CBD5E1",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: "#F8FAFC",
                    color: "#0F172A",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">🌐 {isHi ? "नेटवर्क-व्यापी (सभी अस्पताल शाखाएं)" : "Network-Wide (All Hospitals & Branches)"}</option>
                  {hospitals.map((h) => (
                    <option key={h.hospital_code} value={h.hospital_code}>
                      🏥 {h.name} ({h.hospital_code})
                    </option>
                  ))}
                </select>
                <span style={{ display: "block", fontSize: "11px", color: "#64748B", marginTop: "5px" }}>
                  {isHi
                    ? "चयनित अस्पताल के सभी मरीज, डॉक्टर व टीवी स्क्रीन्स पर यह संदेश लाइव होगा।"
                    : "Announcements broadcasted under this scope will only show on connected displays matching this facility."}
                </span>
              </div>

              {/* Alert Classification Tone (REDESIGNED: Spacious 3 Selection Cards with complete descriptions, zero squishing!) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    🚨 {isHi ? "अलर्ट का प्रकार एवं प्राथमिकता स्तर" : "Alert Type & Priority Classification"}
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748B" }}>
                    {isHi ? "रिबन का रंग व ऑडियो निर्धारित करता है" : "Governs ticker theme, siren chime & urgency"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* Option 1: Code Blue / Medical Emergency */}
                  <div
                    onClick={() => {
                      setFormType("code_blue");
                      setFormSound(true);
                    }}
                    className={`broadcast-priority-card ${formType === "code_blue" ? "is-selected-critical" : ""}`}
                  >
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        background: formType === "code_blue" ? "#DC2626" : "#FEE2E2",
                        color: formType === "code_blue" ? "#FFFFFF" : "#DC2626",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconSiren size={22} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "#991B1B" }}>
                          {isHi ? "कोड ब्लू / आपातकालीन मेडिकल कॉल" : "Code Blue / Medical Critical"}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            background: "#DC2626",
                            color: "#FFFFFF",
                            padding: "1px 7px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                          }}
                        >
                          Highest Priority
                        </span>
                      </div>
                      <p style={{ margin: "3px 0 0 0", fontSize: "11px", color: "#64748B", lineHeight: 1.3 }}>
                        {isHi
                          ? "तत्काल आपातकालीन प्रतिक्रिया, ट्रॉमा व अग्नि चेतावनी। लाल चमकता टिकर व स्वचालित ऑडियो साइरन।"
                          : "Immediate trauma, resuscitation, or safety call. Flashing crimson banner with dual-tone siren audio."}
                      </p>
                    </div>

                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: formType === "code_blue" ? "6px solid #DC2626" : "2px solid #CBD5E1",
                        background: "#FFFFFF",
                        flexShrink: 0,
                      }}
                    />
                  </div>

                  {/* Option 2: System Maintenance & OPD Notice */}
                  <div
                    onClick={() => setFormType("maintenance")}
                    className={`broadcast-priority-card ${formType === "maintenance" ? "is-selected-warning" : ""}`}
                  >
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        background: formType === "maintenance" ? "#D97706" : "#FEF3C7",
                        color: formType === "maintenance" ? "#FFFFFF" : "#D97706",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconAlertTriangle size={20} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "#92400E" }}>
                          {isHi ? "प्रणाली सूचना व ओपीडी बंद समय" : "System Notice & OPD Operational Cutoff"}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            background: "#D97706",
                            color: "#FFFFFF",
                            padding: "1px 7px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                          }}
                        >
                          Medium Priority
                        </span>
                      </div>
                      <p style={{ margin: "3px 0 0 0", fontSize: "11px", color: "#64748B", lineHeight: 1.3 }}>
                        {isHi
                          ? "पंजीकरण काउंटर समाप्ति, सर्वर रखरखाव व क्लिनिक शिफ्ट सूचना। एम्बर रंग टिकर।"
                          : "Counter closing times, planned system maintenance & staff shifts. Smooth amber warning ribbon."}
                      </p>
                    </div>

                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: formType === "maintenance" ? "6px solid #D97706" : "2px solid #CBD5E1",
                        background: "#FFFFFF",
                        flexShrink: 0,
                      }}
                    />
                  </div>

                  {/* Option 3: General Public Announcement */}
                  <div
                    onClick={() => setFormType("general")}
                    className={`broadcast-priority-card ${formType === "general" ? "is-selected-info" : ""}`}
                  >
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        background: formType === "general" ? "#0D9488" : "#CCFBF1",
                        color: formType === "general" ? "#FFFFFF" : "#0D9488",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconMegaphone size={20} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "#0F766E" }}>
                          {isHi ? "सार्वजनिक स्वास्थ्य घोषणा व शिविर" : "Public Health Announcement & Camp"}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            background: "#0D9488",
                            color: "#FFFFFF",
                            padding: "1px 7px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                          }}
                        >
                          General Notice
                        </span>
                      </div>
                      <p style={{ margin: "3px 0 0 0", fontSize: "11px", color: "#64748B", lineHeight: 1.3 }}>
                        {isHi
                          ? "निःशुल्क जांच शिविर, डॉक्टर कक्ष परिवर्तन व सामान्य मरीज़ परामर्श। शांत टील टिकर।"
                          : "Free medical screening camps, counter relocations & wellness drives. Calming teal information ribbon."}
                      </p>
                    </div>

                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: formType === "general" ? "6px solid #0D9488" : "2px solid #CBD5E1",
                        background: "#FFFFFF",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: ANNOUNCEMENT CONTENT (Headline & Detailed Instructions) */}
            <div className="broadcast-composer-section">
              {/* Headline / Primary Alert Title */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1E293B", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  📢 {isHi ? "घोषणा शीर्षक / प्राथमिक अलर्ट हेडिंग" : "Headline / Primary Alert Title"}
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={isHi ? "उदा. कोड ब्लू: आईसीयू कक्ष 304 में तत्काल टीम पहुंचे" : "e.g. CODE BLUE: Resuscitation Team to Room 304 Immediately"}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #CBD5E1",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#0F172A",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  required
                />

                {/* Quick Suggestion Chips */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#64748B", alignSelf: "center", marginRight: "4px" }}>
                    {isHi ? "सुझाव:" : "Insert:"}
                  </span>
                  {[
                    "CODE BLUE: Cardiac Emergency",
                    "OPD Token Booking Ending Soon",
                    "Scheduled Infrastructure Backup",
                    "Free Screening Camp Open Today",
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => insertHeadlineSuggestion(sug)}
                      style={{
                        background: "#F1F5F9",
                        border: "1px solid #E2E8F0",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Body / Detailed Marquee Text */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1E293B", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  📝 {isHi ? "विस्तृत निर्देश एवं टिकर संदेश" : "Detailed Instructions / Full Marquee Ribbon Text"}
                </label>
                <textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  rows={3}
                  placeholder={isHi ? "मरीजों व स्टाफ के लिए विस्तृत जानकारी..." : "Full message that will scroll smoothly across screen banners..."}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #CBD5E1",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    color: "#0F172A",
                    lineHeight: 1.5,
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                  required
                />
                <span style={{ display: "block", fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                  {isHi
                    ? "यह पूरा वाक्य मरीज उपकरणों, डॉक्टरों की डेस्क और टीवी स्क्रीन पर लगातार स्क्रॉल होगा।"
                    : "This exact message scrolls seamlessly across all target hospital devices, doctor consultation desks, and TV screens."}
                </span>
              </div>
            </div>

            {/* SECTION 3: BROADCAST TRANSMISSION PARAMETERS (Duration, Sound, Surfaces) */}
            <div className="broadcast-composer-section">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                {/* Auto-Dismiss Duration */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1E293B", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    ⏱️ {isHi ? "अलर्ट अवधि (स्वतः समाप्ति)" : "Auto-Dismiss Duration"}
                  </label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: "#F8FAFC",
                      color: "#0F172A",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="15">⏱️ 15 {isHi ? "मिनट (त्वरित कॉल)" : "Minutes (Rapid Call)"}</option>
                    <option value="30">⏱️ 30 {isHi ? "मिनट (मानक आपातकाल)" : "Minutes (Standard Code Blue)"}</option>
                    <option value="60">⏱️ 1 {isHi ? "घंटा (ओपीडी सूचना)" : "Hour (Shift Notice)"}</option>
                    <option value="240">⏱️ 4 {isHi ? "घंटे (विस्तृत रखरखाव)" : "Hours (Extended Maintenance)"}</option>
                    <option value="1440">⏱️ 24 {isHi ? "घंटे (पूरा दिन शिविर)" : "Hours (Full Day Camp)"}</option>
                    <option value="0">🔒 {isHi ? "केवल मैनुअल समाप्ति" : "Manual Dismissal Only"}</option>
                  </select>
                </div>

                {/* Audible Alert Chime with Interactive Preview */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#1E293B", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    🔊 {isHi ? "ऑडियो अलर्ट सायरन" : "Audible Siren Alert Chime"}
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      background: formSound ? "#F0FDF4" : "#F8FAFC",
                      gap: "10px",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        flex: 1,
                        fontSize: "12px",
                        fontWeight: 700,
                        color: formSound ? "#15803D" : "#64748B",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formSound}
                        onChange={(e) => setFormSound(e.target.checked)}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      {formSound ? <IconVolume2 size={16} /> : <IconVolumeX size={16} />}
                      <span>{formSound ? (isHi ? "ध्वनि सक्षम" : "Sound Enabled") : (isHi ? "म्यूट" : "Muted")}</span>
                    </label>

                    {formSound && (
                      <button
                        type="button"
                        onClick={() => playChimePreview(formType)}
                        title={isHi ? "ऑडियो सुनें" : "Test alert sound in browser"}
                        style={{
                          background: "#DCFCE7",
                          border: "1px solid #86EFAC",
                          color: "#166534",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "10px",
                          fontWeight: 800,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🔔 {isHi ? "परीक्षण" : "Test Sound"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Target Display Surfaces Checkboxes (Redesigned as interactive tiles) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 800, color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    🖥️ {isHi ? "लक्षित डिस्प्ले स्क्रीन्स (कहाँ प्रदर्शित करें)" : "Target Display Surfaces"}
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => toggleAllSurfaces(true)}
                      style={{ background: "none", border: "none", color: "#4F46E5", fontSize: "11px", fontWeight: 700, cursor: "pointer", padding: 0 }}
                    >
                      {isHi ? "सभी चुनें" : "Select All"}
                    </button>
                    <span style={{ color: "#CBD5E1" }}>•</span>
                    <button
                      type="button"
                      onClick={() => toggleAllSurfaces(false)}
                      style={{ background: "none", border: "none", color: "#64748B", fontSize: "11px", fontWeight: 700, cursor: "pointer", padding: 0 }}
                    >
                      {isHi ? "हटाएं" : "Clear"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px" }}>
                  {[
                    {
                      key: "patient_portal",
                      icon: "📱",
                      label: isHi ? "मरीज़ पोर्टल" : "Patient Portal",
                      sub: isHi ? "मोबाइल व वेब टोकन ट्रैकिंग" : "Mobile App & Web Displays",
                    },
                    {
                      key: "doctor_desk",
                      icon: "🩺",
                      label: isHi ? "डॉक्टर टर्मिनल्स" : "Doctor Terminals",
                      sub: isHi ? "परामर्श कक्ष स्क्रीन" : "Consultation Desks",
                    },
                    {
                      key: "staff_desk",
                      icon: "🏢",
                      label: isHi ? "रिसेप्शन व स्टाफ" : "Reception & Staff Desks",
                      sub: isHi ? "रजिस्ट्रेशन व टोकन काउंटर" : "Counters & Triage Desks",
                    },
                    {
                      key: "kiosk_display",
                      icon: "📺",
                      label: isHi ? "कियोस्क व टीवी डिस्प्ले" : "Kiosks & Waiting TVs",
                      sub: isHi ? "प्रतीक्षालय वॉल स्क्रीन्स" : "Hall Wall Displays & TVs",
                    },
                  ].map((s) => {
                    const active = Boolean(formSurfaces[s.key]);
                    return (
                      <div
                        key={s.key}
                        onClick={() => setFormSurfaces((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                        className={`broadcast-surface-tile ${active ? "is-active" : ""}`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <span style={{ fontSize: "18px" }}>{s.icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: active ? "#312E81" : "#1E293B" }}>
                              {s.label}
                            </div>
                            <div style={{ fontSize: "10px", color: active ? "#4338CA" : "#64748B" }}>
                              {s.sub}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "6px",
                            background: active ? "#4F46E5" : "#FFFFFF",
                            border: active ? "none" : "1.5px solid #CBD5E1",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#FFFFFF",
                            fontSize: "12px",
                            fontWeight: 900,
                            flexShrink: 0,
                          }}
                        >
                          {active ? "✓" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SECTION 4: DISPATCH ACTION BUTTON */}
            <div style={{ padding: "20px 24px", background: "#F8FAFC", borderTop: "1px solid #F1F5F9" }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  background:
                    formType === "code_blue"
                      ? "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
                      : formType === "maintenance"
                      ? "linear-gradient(135deg, #D97706 0%, #B45309 100%)"
                      : "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "12px",
                  padding: "16px",
                  fontWeight: 900,
                  fontSize: "14px",
                  letterSpacing: "0.02em",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  boxShadow:
                    formType === "code_blue"
                      ? "0 6px 20px rgba(220, 38, 38, 0.35)"
                      : formType === "maintenance"
                      ? "0 6px 20px rgba(217, 119, 6, 0.35)"
                      : "0 6px 20px rgba(13, 148, 136, 0.35)",
                  transition: "all 0.15s ease",
                }}
              >
                <IconBroadcast size={20} />
                {isSubmitting
                  ? (isHi ? "प्रसारण भेजा जा रहा है..." : "Broadcasting via WebSockets...")
                  : formType === "code_blue"
                  ? (isHi ? "🚨 कोड ब्लू आपातकालीन प्रसारण भेजें" : "🚨 DISPATCH CODE BLUE EMERGENCY BROADCAST")
                  : formType === "maintenance"
                  ? (isHi ? "⚠️ प्रणाली रखरखाव सूचना जारी करें" : "⚠️ DISPATCH SYSTEM OPERATIONAL NOTICE")
                  : (isHi ? "📢 सार्वजनिक स्वास्थ्य घोषणा भेजें" : "📢 DISPATCH PUBLIC HEALTH ANNOUNCEMENT")}
              </button>

              <div style={{ textAlign: "center", marginTop: "10px", fontSize: "11px", color: "#64748B" }}>
                ✓ {isHi ? "लाइव वेबसॉकेट्स द्वारा सभी स्क्रीन्स पर तत्काल डिस्प्ले" : "Instant WebSocket push • Display ribbons reflect immediately without page reload"}
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Terminal Screen Simulator & Active Fleet Manager */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >

          {/* Currently Active Broadcasts Fleet Manager */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "22px 24px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 20px rgba(15, 23, 42, 0.05)",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>🔴</span>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>
                  {isHi ? "वर्तमान में सक्रिय प्रसारण" : "Currently Active Broadcasts"} ({activeBroadcastsList.length})
                </h3>
              </div>

              {activeBroadcastsList.length > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#DC2626",
                    background: "#FEF2F2",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  LIVE ON SCREENS
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748B", fontSize: "13px" }}>
                {isHi ? "लोड हो रहा है..." : "Syncing active broadcasts..."}
              </div>
            ) : activeBroadcastsList.length === 0 ? (
              <div
                style={{
                  padding: "36px 20px",
                  textAlign: "center",
                  background: "#F8FAFC",
                  borderRadius: "14px",
                  border: "1.5px dashed #CBD5E1",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🛡️</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                  {isHi ? "कोई सक्रिय आपातकालीन प्रसारण नहीं है" : "All Hospital Systems Normal"}
                </div>
                <p style={{ margin: "6px auto 0 auto", fontSize: "12px", color: "#64748B", maxWidth: "320px", lineHeight: 1.4 }}>
                  {isHi
                    ? "सभी अस्पताल शाखाएं सामान्य रूप से चल रही हैं। किसी भी टर्मिनल पर कोई आपातकालीन बैनर सक्रिय नहीं है।"
                    : "No emergency alerts or ribbons are currently streaming to hospital terminals."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                {activeBroadcastsList.map((b) => {
                  const isCrit = b.type === "code_blue" || b.severity === "critical";
                  const isWarn = b.type === "maintenance" || b.severity === "warning";
                  return (
                    <div
                      key={b.id}
                      style={{
                        padding: "16px",
                        borderRadius: "14px",
                        border: isCrit ? "1.5px solid #FCA5A5" : isWarn ? "1.5px solid #FDE68A" : "1.5px solid #99F6E4",
                        background: isCrit ? "#FEF2F2" : isWarn ? "#FFFBEB" : "#F0FDFA",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "14px",
                        width: "100%",
                        maxWidth: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 900,
                              textTransform: "uppercase",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: isCrit ? "#DC2626" : isWarn ? "#D97706" : "#0D9488",
                              color: "#FFFFFF",
                            }}
                          >
                            {b.type === "code_blue" ? "CODE BLUE" : b.type === "maintenance" ? "SYSTEM" : "ANNOUNCEMENT"}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                            📍 {b.hospital_name || (b.hospital_code === "all" ? "All Hospitals" : b.hospital_code)}
                          </span>
                        </div>

                        <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "4px", wordBreak: "break-word" }}>
                          {b.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.4, wordBreak: "break-word" }}>
                          {b.message}
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", fontSize: "11px", color: "#64748B", flexWrap: "wrap" }}>
                          <span>🕒 {new Date(b.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          {b.expires_at && (
                            <span style={{ color: "#B45309", fontWeight: 700 }}>
                              ⏳ {isHi ? "समाप्ति:" : "Expires:"} {new Date(b.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Kill Broadcast Button */}
                      <button
                        type="button"
                        onClick={() => handleDismissBroadcast(b.id)}
                        disabled={actionInProgressId === b.id}
                        title={isHi ? "तुरंत सभी स्क्रीन से हटाएं" : "Kill and strip from all screens"}
                        style={{
                          background: "#DC2626",
                          border: "none",
                          color: "#FFFFFF",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontSize: "11px",
                          fontWeight: 800,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          boxShadow: "0 2px 8px rgba(220, 38, 38, 0.35)",
                          flexShrink: 0,
                        }}
                      >
                        <IconX size={14} />
                        {actionInProgressId === b.id ? "Stopping..." : isHi ? "रोकें" : "Kill Alert"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Past Broadcasts Audit Trail Table */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "18px",
          padding: "24px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.05)",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>
              📋 {isHi ? "प्रसारण इतिहास एवं ऑडिट लॉग" : "Broadcast Logs & Compliance Audit Trail"}
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748B" }}>
              {isHi
                ? "पिछले सभी आपातकालीन कॉल एवं सूचनाओं का विस्तृत ऑडिट रिकॉर्ड"
                : "Historical archive of past code blue calls, system notices, and broadcast dispatches"}
            </p>
          </div>
        </div>

        {broadcasts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px", color: "#94A3B8", fontSize: "12px" }}>
            {isHi ? "कोई पिछला प्रसारण रिकॉर्ड नहीं है।" : "No broadcast history recorded yet."}
          </div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "600px" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "#475569", fontWeight: 700 }}>{isHi ? "प्रकार" : "Type"}</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "#475569", fontWeight: 700 }}>{isHi ? "शीर्षक / संदेश" : "Title & Message"}</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "#475569", fontWeight: 700 }}>{isHi ? "लक्ष्य" : "Target Facility"}</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "#475569", fontWeight: 700 }}>{isHi ? "प्रेषक" : "Author"}</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "#475569", fontWeight: 700 }}>{isHi ? "समय" : "Dispatched At"}</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "#475569", fontWeight: 700 }}>{isHi ? "स्थिति" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.slice(0, 20).map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "3px 7px",
                          borderRadius: "4px",
                          background: b.type === "code_blue" ? "#FEE2E2" : b.type === "maintenance" ? "#FEF3C7" : "#E0F2FE",
                          color: b.type === "code_blue" ? "#991B1B" : b.type === "maintenance" ? "#92400E" : "#0369A1",
                        }}
                      >
                        {b.type === "code_blue" ? "🚨 CODE BLUE" : b.type === "maintenance" ? "⚠️ NOTICE" : "📢 GENERAL"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>{b.title}</div>
                      <div style={{ color: "#64748B", fontSize: "11px", maxWidth: "340px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {b.message}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#334155", fontWeight: 600 }}>
                      {b.hospital_name || (b.hospital_code === "all" ? "All Hospitals" : b.hospital_code)}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748B" }}>
                      {b.created_by || "Super Admin"}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#64748B", whiteSpace: "nowrap" }}>
                      {new Date(b.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {b.is_active ? (
                        <span style={{ color: "#DC2626", fontWeight: 800, fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#DC2626" }} />
                          LIVE
                        </span>
                      ) : (
                        <span style={{ color: "#64748B", fontSize: "11px" }}>Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
