/**
 * EmergencyBroadcastBanner.jsx
 * ----------------------------
 * High-Visibility Animated Real-Time Marquee & Emergency Broadcast Ribbon.
 *
 * Appears across Patient Portal, Doctor Desks, Staff Portal, Kiosks & TV Displays.
 * Powered by real-time WebSockets with audio alert chimes and smooth marquee scroll.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  IconMegaphone,
  IconAlertTriangle,
  IconSiren,
} from "../superadmin/SuperAdminIcons";

// Gentle dual-tone Web Audio API emergency chime
function playEmergencyChime(isCritical = false) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = isCritical ? "sawtooth" : "sine";
    osc2.type = "sine";

    // Frequencies: 880Hz (A5) then 1174Hz (D6)
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
    // AudioContext might require user gesture on strict browsers
  }
}

export default function EmergencyBroadcastBanner({
  broadcasts = [],
  currentHospitalCode = "all",
  surface = "patient_portal", // "patient_portal" | "doctor_desk" | "staff_desk" | "kiosk_display" | "superadmin"
  language = "en",
  onDismissBroadcast = null,
  isStaffOrAdmin = false,
  navigateTo = null,
}) {
  const isHi = language === "hi";
  const [activeIdx, setActiveIdx] = useState(0);
  const prevBroadcastIdsRef = useRef(new Set());

  // Filter broadcasts relevant to this surface and hospital
  const visibleBroadcasts = broadcasts.filter((b) => {
    if (!b || !b.is_active) return false;

    // Check hospital code targeting
    if (b.hospital_code && b.hospital_code !== "all") {
      const curCode = (currentHospitalCode || "all").trim().toLowerCase();
      const targetCode = b.hospital_code.trim().toLowerCase();
      if (curCode !== "all" && targetCode !== curCode) {
        return false;
      }
    }

    // Check surface targeting
    if (b.target_surfaces && surface) {
      if (b.target_surfaces[surface] === false) {
        return false;
      }
    }

    return true;
  });

  // Play audio chime when a brand new emergency broadcast arrives (if broadcast has sound enabled)
  useEffect(() => {
    if (visibleBroadcasts.length === 0) return;

    const currentIds = new Set(visibleBroadcasts.map((b) => b.id));
    let hasNewCritical = false;
    let hasNewGeneral = false;

    for (const b of visibleBroadcasts) {
      if (!prevBroadcastIdsRef.current.has(b.id)) {
        if (b.sound !== false) {
          if (b.type === "code_blue" || b.severity === "critical") {
            hasNewCritical = true;
          } else {
            hasNewGeneral = true;
          }
        }
      }
    }

    prevBroadcastIdsRef.current = currentIds;

    if (hasNewCritical || hasNewGeneral) {
      playEmergencyChime(hasNewCritical);
    }
  }, [visibleBroadcasts]);

  // Rotate between multiple broadcasts every 8 seconds if there's more than one
  useEffect(() => {
    if (visibleBroadcasts.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % visibleBroadcasts.length);
    }, 8500);
    return () => clearInterval(interval);
  }, [visibleBroadcasts.length]);

  if (visibleBroadcasts.length === 0) {
    return null;
  }

  const currentBroadcast = visibleBroadcasts[activeIdx % visibleBroadcasts.length] || visibleBroadcasts[0];
  const type = currentBroadcast.type || "general";
  const isEmergency = type === "code_blue" || currentBroadcast.severity === "critical";
  const isWarning = type === "maintenance" || currentBroadcast.severity === "warning";

  // Visual styling configuration based on alert tone
  let themeStyles = {
    background: "linear-gradient(90deg, #064E3B 0%, #0D9488 45%, #0F766E 100%)",
    borderColor: "rgba(153, 246, 228, 0.35)",
    badgeBg: "rgba(255, 255, 255, 0.2)",
    badgeColor: "#F0FDFA",
    glowShadow: "0 4px 18px rgba(13, 148, 136, 0.25)",
    label: isHi ? "सूचना" : "ANNOUNCEMENT",
    icon: <IconMegaphone size={18} color="#FFFFFF" />,
  };

  if (isEmergency) {
    themeStyles = {
      background: "linear-gradient(90deg, #7F1D1D 0%, #DC2626 50%, #991B1B 100%)",
      borderColor: "rgba(254, 202, 202, 0.45)",
      badgeBg: "rgba(255, 255, 255, 0.25)",
      badgeColor: "#FEF2F2",
      glowShadow: "0 4px 22px rgba(220, 38, 38, 0.38)",
      label: isHi ? "आपातकालीन कोड ब्लू" : "CODE BLUE EMERGENCY",
      icon: <IconSiren size={20} color="#FFFFFF" />,
    };
  } else if (isWarning) {
    themeStyles = {
      background: "linear-gradient(90deg, #78350F 0%, #D97706 50%, #92400E 100%)",
      borderColor: "rgba(253, 230, 138, 0.45)",
      badgeBg: "rgba(0, 0, 0, 0.25)",
      badgeColor: "#FFFBEB",
      glowShadow: "0 4px 18px rgba(217, 119, 6, 0.3)",
      label: isHi ? "प्रणाली सूचना" : "SYSTEM NOTICE",
      icon: <IconAlertTriangle size={18} color="#FFFFFF" />,
    };
  }

  const scopeLabel =
    currentBroadcast.hospital_code === "all"
      ? (isHi ? "नेटवर्क-व्यापी (सभी अस्पताल)" : "ALL HOSPITAL TERMINALS")
      : (currentBroadcast.hospital_name || currentBroadcast.hospital_code);

  const fullHeadline = currentBroadcast.title
    ? `${currentBroadcast.title.toUpperCase()} — ${currentBroadcast.message}`
    : currentBroadcast.message;

  return (
    <aside
      className={`emergency-broadcast-ribbon ${isEmergency ? "is-critical-pulse" : ""}`}
      role="alert"
      aria-live={isEmergency ? "assertive" : "polite"}
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        borderRadius: "12px",
        margin: "0 0 16px 0",
        padding: "10px 16px",
        background: themeStyles.background,
        border: `1.5px solid ${themeStyles.borderColor}`,
        boxShadow: themeStyles.glowShadow,
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        zIndex: 999,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <style>{`
        @keyframes broadcastMarquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes sirenPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
        @keyframes emergencyFlash {
          0%, 100% { box-shadow: 0 4px 22px rgba(220, 38, 38, 0.45); }
          50% { box-shadow: 0 4px 32px rgba(239, 68, 68, 0.75); }
        }
        .is-critical-pulse {
          animation: emergencyFlash 1.8s infinite ease-in-out;
        }
        .broadcast-ticker-track {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          animation: broadcastMarquee 26s linear infinite;
        }
        .broadcast-ticker-track:hover {
          animation-play-state: paused;
        }
        @media (max-width: 768px) {
          .broadcast-scope-pill {
            display: none !important;
          }
          .broadcast-badge-label {
            font-size: 10px !important;
          }
        }
      `}</style>

      {/* 1. Left Alert Pill with Siren Icon */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, zIndex: 2 }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "9px",
            background: "rgba(255, 255, 255, 0.22)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: isEmergency ? "sirenPulse 1.2s infinite ease-in-out" : "none",
          }}
        >
          {themeStyles.icon}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className="broadcast-badge-label"
              style={{
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: themeStyles.badgeBg,
                color: themeStyles.badgeColor,
                padding: "2px 8px",
                borderRadius: "6px",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
            >
              {themeStyles.label}
            </span>

            {visibleBroadcasts.length > 1 && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  opacity: 0.9,
                  background: "rgba(0,0,0,0.3)",
                  padding: "2px 6px",
                  borderRadius: "6px",
                }}
              >
                {activeIdx + 1} / {visibleBroadcasts.length}
              </span>
            )}
          </div>

          <span
            className="broadcast-scope-pill"
            style={{
              fontSize: "10px",
              opacity: 0.85,
              fontWeight: 600,
              marginTop: "2px",
              letterSpacing: "0.02em",
            }}
          >
            📍 {scopeLabel}
          </span>
        </div>
      </div>

      {/* 2. Center Marquee Ticker Track */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
          position: "relative",
          margin: "0 10px",
          display: "flex",
          alignItems: "center",
          maskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)",
        }}
        title={isHi ? "विस्तृत विवरण पढ़ने के लिए होवर करें" : "Hover to pause announcement"}
      >
        <div className="broadcast-ticker-track">
          <span style={{ fontSize: "14px", fontWeight: 700, paddingRight: "50px", letterSpacing: "0.01em" }}>
            {fullHeadline}
          </span>
          <span style={{ fontSize: "14px", fontWeight: 700, paddingRight: "50px", letterSpacing: "0.01em", opacity: 0.85 }}>
            • {fullHeadline}
          </span>
        </div>
      </div>
    </aside>
  );
}
