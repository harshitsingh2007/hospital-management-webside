/**
 * KioskHeader.jsx
 * ---------------
 * Dedicated header bar for Hospital Kiosk terminal / Public TV Display.
 * Displays hospital branding, kiosk hardware identity, location,
 * real-time live connection status, digital clock, mode toggle, and fullscreen control.
 */

import React from "react";
import { t } from "../../utils/i18n";

export default function KioskHeader({
  hospital = {},
  kiosk = {},
  department = null,
  socketConnected = true,
  currentTime = new Date(),
  isFullscreen = false,
  toggleFullscreen = () => {},
  language = "en",
  setLanguage = () => {},
  navigateTo = null,
  branding = {},
}) {
  const brandPrimary = branding.primary_color || "#0284C7";
  const brandSecondary = branding.secondary_color || "#0369A1";
  const isHi = language === "hi";

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const hospitalName = hospital.name || "Hospital Queue System";
  const kioskName = kiosk.name || "Main Waiting Room Kiosk";
  const kioskCode = kiosk.kiosk_code || "K-01";
  const location = kiosk.location || "Main Entrance";
  const deptName = department ? department.name : null;

  return (
    <header style={headerContainerStyle}>
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.18); }
        }
        .live-pulse-dot {
          animation: pulseGlow 1.8s infinite ease-in-out;
        }
        @media (max-width: 900px) {
          .kiosk-hdr-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .kiosk-hdr-center {
            order: 3 !important;
            justify-content: center !important;
          }
          .kiosk-hdr-right {
            order: 2 !important;
            justify-content: space-between !important;
          }
        }
      `}</style>

      <div className="kiosk-hdr-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        {/* Left: Hospital Branding & Kiosk Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "min(240px, 100%)" }}>
          {/* Hospital Shield Logo */}
          <div style={{ ...logoBadgeStyle, background: hospital.logo_url ? "#FFFFFF" : brandPrimary }}>
            {hospital.logo_url ? (
              <img
                src={hospital.logo_url}
                alt="Hospital Logo"
                style={{ width: "32px", height: "32px", objectFit: "contain" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 2.5L4.5 5.5v5.5c0 5.1 3.2 9.85 7.5 11 4.3-1.15 7.5-5.9 7.5-11V5.5L12 2.5z" fill="#FFFFFF" />
                <path d="M12 7.5v9M7.5 12h9" stroke={brandPrimary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>
                {hospitalName}
              </h1>
              {deptName && (
                <span style={{ padding: "3px 8px", borderRadius: "8px", background: "#EFF6FF", color: "#1D4ED8", fontSize: "11px", fontWeight: 800, border: "1px solid #BFDBFE" }}>
                  {deptName}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: 800, color: brandSecondary }}>
                KIOSK {kioskCode}
              </span>
              <span style={{ color: "#94A3B8" }}>•</span>
              <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>
                {kioskName} ({location})
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Digital Clock & Status Badge */}
        <div className="kiosk-hdr-center" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Hardware Connection Status */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 14px",
              borderRadius: "9999px",
              background: socketConnected ? "#ECFDF5" : "#FFFBEB",
              border: socketConnected ? "1px solid #A7F3D0" : "1px solid #FDE68A",
              color: socketConnected ? "#047857" : "#B45309",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.4px",
            }}
          >
            <span
              className={socketConnected ? "live-pulse-dot" : ""}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: socketConnected ? "#10B981" : "#F59E0B",
                boxShadow: socketConnected ? "0 0 8px #10B981" : "none",
                display: "inline-block",
              }}
            />
            {socketConnected ? "● LIVE" : "○ RECONNECTING..."}
          </div>

          {/* Large Digital Clock */}
          <div style={digitalClockBoxStyle}>
            <div style={{ fontSize: "20px", fontWeight: 900, color: "#0F172A", letterSpacing: "1px", fontVariantNumeric: "tabular-nums" }}>
              {formattedTime}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 700 }}>
              {formattedDate}
            </div>
          </div>
        </div>

        {/* Right: Language, Fullscreen & Controls */}
        <div className="kiosk-hdr-right" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Language Switcher */}
          <div style={langSwitcherStyle}>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              style={langBtnStyle(language === "en")}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("hi")}
              style={langBtnStyle(language === "hi")}
            >
              हिंदी
            </button>
          </div>

          {/* Fullscreen TV Mode Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={actionBtnStyle}
            title="Toggle TV Fullscreen (F11)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              )}
            </svg>
          </button>

          {/* Discreet Exit Button (if staff or admin opened kiosk) */}
          {navigateTo && (
            <button
              type="button"
              onClick={() => navigateTo("patient", "walkin")}
              style={{ ...actionBtnStyle, background: "#F8FAFC", color: "#64748B" }}
              title="Exit Kiosk to Hospital System"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// Styling Tokens
const headerContainerStyle = {
  background: "#FFFFFF",
  borderRadius: "20px",
  padding: "16px 24px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.05)",
  marginBottom: "20px",
};

const logoBadgeStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.2)",
  flexShrink: 0,
};

const digitalClockBoxStyle = {
  background: "#F8FAFC",
  borderRadius: "14px",
  padding: "6px 18px",
  border: "1px solid #E2E8F0",
  textAlign: "center",
};


const langSwitcherStyle = {
  display: "flex",
  background: "#F1F5F9",
  borderRadius: "12px",
  padding: "3px",
  border: "1px solid #E2E8F0",
};

const langBtnStyle = (active) => ({
  padding: "6px 10px",
  borderRadius: "9px",
  border: "none",
  background: active ? "#0284C7" : "transparent",
  color: active ? "#FFFFFF" : "#475569",
  fontSize: "11px",
  fontWeight: 800,
  cursor: "pointer",
  transition: "all 0.15s ease",
});

const actionBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  borderRadius: "12px",
  border: "1px solid #E2E8F0",
  background: "#FFFFFF",
  color: "#0F172A",
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  transition: "all 0.15s ease",
};
