/**
 * HeroBanner.jsx
 * --------------
 * Hospital User Dashboard Hero Section.
 * Matches design of IMAGE 2 with responsive layout:
 * - Desktop: 2-column layout (Left content + stats, Right hospital illustration)
 * - Tablet: Responsive flex layout
 * - Mobile: Gracefully stacked layout
 */

import React, { useState, useEffect } from "react";
import { fetchDailyHealthQuote } from "../../utils/dailyHealthTips";

export default function HeroBanner({
  language = "en",
  hospitalName = "City General Hospital",
  onOpenHospitalModal,
  branding = null,
  stats = {
    patientsServed: "0",
    activeDesks: "0 Active Desks",
    avgWaitTime: "0 min",
    currentlyWaiting: "0 Waiting",
  },
}) {
  const isHi = language === "hi";
  const primaryBrandColor = branding?.primary_color || "#38BDF8";
  const secondaryBrandColor = branding?.secondary_color || "#0C4A6E";
  const displayHospName = branding?.hospital_name || branding?.name || hospitalName;

  const [dailyQuote, setDailyQuote] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetchDailyHealthQuote(language).then((q) => {
      if (isMounted && q) setDailyQuote(q);
    });
    return () => {
      isMounted = false;
    };
  }, [language]);

  return (
    <div style={heroContainerStyle} className="hero-banner-container">
      <style>{`
        .hero-banner-container {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          border-radius: 24px;
          overflow: hidden;
          background: radial-gradient(circle at 10% 15%, rgba(2, 132, 199, 0.25) 0%, transparent 45%), radial-gradient(circle at 90% 85%, rgba(56, 189, 248, 0.18) 0%, transparent 50%), linear-gradient(135deg, #090F1E 0%, #0F172A 60%, #162447 100%);
          box-shadow: 0 20px 45px -12px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(56, 189, 248, 0.18);
          border: 1px solid rgba(56, 189, 248, 0.25);
          margin-bottom: 22px;
          position: relative;
          min-height: 220px;
          width: 100%;
          box-sizing: border-box;
        }

        .hero-left-col {
          flex: 1.15;
          padding: 22px 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          z-index: 2;
          background: transparent;
          position: relative;
          box-sizing: border-box;
          min-width: 0;
        }

        /* Divider on wide screens */
        @media (min-width: 900px) {
          .hero-left-col {
            padding-right: 32px;
            margin-right: 0;
            border-right: 1px solid rgba(56, 189, 248, 0.18);
          }
        }

        .hero-right-col {
          flex: 1;
          background: linear-gradient(180deg, #F0F9FF 0%, #E0F2FE 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          min-height: 200px;
          box-sizing: border-box;
        }

        .hero-banner-container * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .hero-title {
          font-size: clamp(22px, 3.4vw, 34px);
          font-weight: 800;
          line-height: 1.16;
          letter-spacing: -1px;
          color: #FFFFFF;
          margin: 0;
        }

        .hero-title-highlight {
          background: linear-gradient(135deg, #0284C7 0%, #06B6D4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
        }

        .hero-subtitle {
          color: rgba(224, 242, 254, 0.9);
          font-size: 14px;
          line-height: 1.55;
          margin-top: 10px;
          margin-bottom: 18px;
          max-width: 480px;
          font-weight: 500;
          letter-spacing: -0.1px;
        }

        .hero-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
        }

        .hero-stat-card {
          background: rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          box-sizing: border-box;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .hero-stat-card:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(56, 189, 248, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -4px rgba(2, 132, 199, 0.25);
        }

        .hero-stat-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: rgba(56, 189, 248, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #38BDF8;
          box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
        }

        .hero-stat-value {
          font-size: 15px;
          font-weight: 800;
          color: #FFFFFF;
          line-height: 1.15;
          letter-spacing: -0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hero-stat-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: rgba(224, 242, 254, 0.75);
          line-height: 1.2;
          margin-top: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 900px) {
          .hero-banner-container {
            flex-direction: column;
            border-radius: 18px;
            min-height: auto;
          }
          .hero-left-col {
            clip-path: none !important;
            padding: 22px 18px;
            margin-right: 0;
            border-right: none !important;
            border-bottom: 1px solid rgba(56, 189, 248, 0.2);
          }
          .hero-right-col {
            min-height: 180px;
            max-height: 240px;
            width: 100%;
          }
          .hero-stats-row {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
        }

        @media (max-width: 580px) {
          .hero-banner-container {
            border-radius: 16px;
            margin-bottom: 16px;
          }
          .hero-left-col {
            padding: 18px 14px;
          }
          .hero-stats-row {
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          .hero-stat-card {
            padding: 6px 8px;
          }
          .hero-right-col {
            min-height: 140px;
            max-height: 180px;
          }
        }

        @media (max-width: 380px) {
          .hero-stats-row {
            grid-template-columns: 1fr;
          }
          .hero-left-col {
            padding: 16px 12px;
          }
          .hero-title {
            word-break: break-word;
          }
        }
      `}</style>

      {/* LEFT COLUMN: Texts & Stats Cards */}
      <div className="hero-left-col">
        <div>
          <h1 className="hero-title">
            {isHi ? (
              <>
                सीधे आएं. परामर्श पाएं.
                <br />
                <span className="hero-title-highlight" style={{ color: primaryBrandColor }}>हम</span> आपके लिए सदैव तत्पर हैं.
              </>
            ) : (
              <>
                Walk-In. Get Seen.
                <br />
                <span className="hero-title-highlight" style={{ color: primaryBrandColor }}>We’re</span> Here for You.
              </>
            )}
          </h1>
          {/* Dynamic Daily Health Quote / Insight */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.07)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(56, 189, 248, 0.22)",
              borderRadius: "14px",
              padding: "10px 14px",
              marginTop: "8px",
              marginBottom: "8px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              maxWidth: "480px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "rgba(56, 189, 248, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginBottom: "3px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#38BDF8",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {isHi ? "दैनिक स्वास्थ्य युक्ति" : "Daily Health Insight"}{" "}
                  {dailyQuote?.category ? `• ${dailyQuote.category}` : ""}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  color: "#E0F2FE",
                  fontSize: "12px",
                  lineHeight: "1.45",
                  fontWeight: 500,
                  fontStyle: "italic",
                }}
              >
                "{dailyQuote?.text || (isHi ? "पर्याप्त पानी पिएं और स्वस्थ रहें।" : "Stay hydrated and prioritize your wellbeing today.")}"
              </p>
              {dailyQuote?.author && (
                <div
                  style={{
                    fontSize: "9.5px",
                    color: "rgba(224, 242, 254, 0.6)",
                    marginTop: "3px",
                    textAlign: "right",
                  }}
                >
                  — {dailyQuote.author}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3 Stats Badges */}
        <div className="hero-stats-row">
          {/* 1. Active Desks */}
          <div className="hero-stat-card">
            <div className="hero-stat-icon-wrap" style={{ color: "#38BDF8" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <div className="hero-stat-value" style={{ color: "#38BDF8" }}>
                {stats.activeDesks || (isHi ? "1 डेस्क" : "1 Desk")}
              </div>
              <div className="hero-stat-label">
                {isHi ? "सक्रिय डॉक्टर डेस्क" : "Active Desks"}
              </div>
            </div>
          </div>

          {/* 3. Avg Wait Time */}
          <div className="hero-stat-card">
            <div className="hero-stat-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div className="hero-stat-value">{stats.avgWaitTime}</div>
              <div className="hero-stat-label">
                {isHi ? "औसत प्रतीक्षा" : "Avg. Wait"}
              </div>
            </div>
          </div>

          {/* 4. Currently in Queue */}
          <div className="hero-stat-card">
            <div className="hero-stat-icon-wrap" style={{ color: "#FDE047" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="hero-stat-value" style={{ color: "#FDE047" }}>
                {stats.currentlyWaiting || (isHi ? "0 प्रतीक्षारत" : "0 Waiting")}
              </div>
              <div className="hero-stat-label">
                {isHi ? "प्रतीक्षारत मरीज़" : "Live in Queue"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Hospital & Ambulance Vector Healthcare Visual */}
      <div className="hero-right-col">
        <HospitalAmbulanceIllustration />
        {branding?.logo_url && (
          <div style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(10px)",
            borderRadius: "14px",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
            border: `1.5px solid ${branding.primary_color || "#0284C7"}40`,
            maxWidth: "240px",
            zIndex: 3,
          }}>
            <img
              src={branding.logo_url}
              alt="Hospital Logo"
              style={{ width: "32px", height: "32px", objectFit: "contain", borderRadius: "8px" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 900, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayHospName}
              </div>
              <div style={{ fontSize: "9.5px", fontWeight: 800, color: branding.primary_color || "#0284C7", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Official Facility
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const heroContainerStyle = {
  width: "100%",
};

/**
 * Detailed SVG Vector Illustration of City General Hospital Building & Ambulance
 * Modeled precisely to match IMAGE 2.
 */
function HospitalAmbulanceIllustration() {
  return (
    <svg
      viewBox="0 0 540 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: "100%",
        height: "100%",
        maxHeight: "260px",
        display: "block",
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Sky gradient */}
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E6F2FA" />
          <stop offset="60%" stopColor="#EFF7FC" />
          <stop offset="100%" stopColor="#F5FBF7" />
        </linearGradient>

        {/* Building wall gradient */}
        <linearGradient id="buildingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>

        {/* Window glass gradient */}
        <linearGradient id="windowGlass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>

        {/* Shadow filter */}
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Background Sky */}
      <rect width="540" height="320" fill="url(#skyGrad)" />

      {/* Background Clouds */}
      <g opacity="0.9">
        {/* Left cloud */}
        <path
          d="M60 70 C60 55, 80 45, 95 55 C105 40, 130 40, 140 55 C155 50, 170 60, 170 75 C170 85, 155 90, 60 90 Z"
          fill="#FFFFFF"
          opacity="0.8"
        />
        {/* Right cloud */}
        <path
          d="M380 50 C380 38, 395 30, 410 38 C420 25, 440 25, 450 38 C465 32, 475 42, 475 55 C475 65, 460 70, 380 70 Z"
          fill="#FFFFFF"
          opacity="0.85"
        />
        {/* Center high cloud */}
        <path
          d="M210 35 C210 25, 222 20, 235 25 C242 15, 258 15, 265 25 C275 20, 285 28, 285 38 C285 45, 275 48, 210 48 Z"
          fill="#FFFFFF"
          opacity="0.6"
        />
      </g>

      {/* Background Trees (Left & Right) */}
      <g>
        {/* Left Side Tree 1 */}
        <ellipse cx="65" cy="220" rx="26" ry="40" fill="#059669" />
        <ellipse cx="50" cy="235" rx="18" ry="28" fill="#10B981" />
        <ellipse cx="78" cy="235" rx="20" ry="30" fill="#047857" />
        <rect x="62" y="245" width="6" height="25" rx="2" fill="#78350F" />

        {/* Right Side Tree */}
        <ellipse cx="475" cy="215" rx="28" ry="42" fill="#059669" />
        <ellipse cx="455" cy="230" rx="20" ry="30" fill="#10B981" />
        <ellipse cx="490" cy="230" rx="22" ry="32" fill="#047857" />
        <rect x="472" y="240" width="6" height="30" rx="2" fill="#78350F" />
      </g>

      {/* Hospital Building Shadow */}
      <rect x="110" y="260" width="310" height="12" rx="6" fill="#64748B" opacity="0.18" />

      {/* MAIN HOSPITAL BUILDING */}
      <g filter="url(#softShadow)">
        {/* Building Base / Steps */}
        <rect x="115" y="252" width="300" height="12" rx="3" fill="#94A3B8" />
        <rect x="125" y="246" width="280" height="8" rx="2" fill="#CBD5E1" />

        {/* Left Wing */}
        <rect x="125" y="130" width="75" height="118" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1.5" />
        <rect x="120" y="124" width="85" height="8" rx="2" fill="#94A3B8" />

        {/* Right Wing */}
        <rect x="330" y="130" width="75" height="118" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1.5" />
        <rect x="325" y="124" width="85" height="8" rx="2" fill="#94A3B8" />

        {/* Center Main Tower */}
        <rect x="190" y="95" width="150" height="153" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" />
        <rect x="182" y="88" width="166" height="9" rx="2" fill="#0F172A" />

        {/* Top Pediment / Header Tower */}
        <rect x="225" y="62" width="80" height="28" rx="4" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1.5" />

        {/* Hospital Green Cross Badge on Top */}
        <circle cx="265" cy="76" r="16" fill="#10B981" />
        {/* Cross Vertical */}
        <rect x="262.5" y="67" width="5" height="18" rx="1.5" fill="#FFFFFF" />
        {/* Cross Horizontal */}
        <rect x="256" y="73.5" width="18" height="5" rx="1.5" fill="#FFFFFF" />

        {/* Center Tower Top Windows */}
        <g fill="url(#windowGlass)" stroke="#38BDF8" strokeWidth="1">
          <rect x="205" y="108" width="36" height="26" rx="2" />
          <line x1="223" y1="108" x2="223" y2="134" stroke="#FFFFFF" strokeWidth="1" />
          <line x1="205" y1="121" x2="241" y2="121" stroke="#FFFFFF" strokeWidth="1" />

          <rect x="249" y="108" width="36" height="26" rx="2" />
          <line x1="267" y1="108" x2="267" y2="134" stroke="#FFFFFF" strokeWidth="1" />
          <line x1="249" y1="121" x2="285" y2="121" stroke="#FFFFFF" strokeWidth="1" />

          <rect x="293" y="108" width="32" height="26" rx="2" />
          <line x1="309" y1="108" x2="309" y2="134" stroke="#FFFFFF" strokeWidth="1" />
          <line x1="293" y1="121" x2="325" y2="121" stroke="#FFFFFF" strokeWidth="1" />
        </g>

        {/* Center Tower 2nd Floor Windows */}
        <g fill="url(#windowGlass)" stroke="#38BDF8" strokeWidth="1">
          <rect x="205" y="144" width="36" height="26" rx="2" />
          <line x1="223" y1="144" x2="223" y2="170" stroke="#FFFFFF" strokeWidth="1" />

          <rect x="249" y="144" width="36" height="26" rx="2" />
          <line x1="267" y1="144" x2="267" y2="170" stroke="#FFFFFF" strokeWidth="1" />

          <rect x="293" y="144" width="32" height="26" rx="2" />
          <line x1="309" y1="144" x2="309" y2="170" stroke="#FFFFFF" strokeWidth="1" />
        </g>

        {/* Left Wing Windows (3 Floors) */}
        <g fill="url(#windowGlass)" stroke="#38BDF8" strokeWidth="1">
          <rect x="135" y="140" width="22" height="24" rx="2" />
          <rect x="165" y="140" width="22" height="24" rx="2" />
          <rect x="135" y="174" width="22" height="24" rx="2" />
          <rect x="165" y="174" width="22" height="24" rx="2" />
          <rect x="135" y="208" width="22" height="24" rx="2" />
          <rect x="165" y="208" width="22" height="24" rx="2" />
        </g>

        {/* Right Wing Windows (3 Floors) */}
        <g fill="url(#windowGlass)" stroke="#38BDF8" strokeWidth="1">
          <rect x="342" y="140" width="22" height="24" rx="2" />
          <rect x="372" y="140" width="22" height="24" rx="2" />
          <rect x="342" y="174" width="22" height="24" rx="2" />
          <rect x="372" y="174" width="22" height="24" rx="2" />
          <rect x="342" y="208" width="22" height="24" rx="2" />
          <rect x="372" y="208" width="22" height="24" rx="2" />
        </g>

        {/* HOSPITAL Sign Banner over Entrance */}
        <rect x="210" y="180" width="110" height="22" rx="4" fill="#0F172A" />
        <text
          x="265"
          y="195"
          fill="#FFFFFF"
          fontSize="11"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="2.5"
          textAnchor="middle"
        >
          HOSPITAL
        </text>

        {/* Entrance Double Doors */}
        <rect x="238" y="206" width="54" height="40" rx="3" fill="#1E293B" />
        {/* Door 1 */}
        <rect x="241" y="209" width="23" height="34" rx="2" fill="#334155" />
        <rect x="244" y="212" width="17" height="15" fill="#64748B" opacity="0.6" />
        <line x1="260" y1="225" x2="260" y2="231" stroke="#E2E8F0" strokeWidth="1.5" />
        {/* Door 2 */}
        <rect x="266" y="209" width="23" height="34" rx="2" fill="#334155" />
        <rect x="269" y="212" width="17" height="15" fill="#64748B" opacity="0.6" />
        <line x1="270" y1="225" x2="270" y2="231" stroke="#E2E8F0" strokeWidth="1.5" />
      </g>

      {/* AMBULANCE VEHICLE (Right Foreground) */}
      <g filter="url(#softShadow)" transform="translate(0, 0)">
        {/* Ambulance Shadow */}
        <ellipse cx="430" cy="254" rx="72" ry="7" fill="#0F172A" opacity="0.25" />

        {/* Ambulance Main Body */}
        {/* Back Cabin Box */}
        <path
          d="M380 205 L475 205 Q482 205 482 212 L482 244 L380 244 Z"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1.2"
        />

        {/* Front Driver Cabin & Windshield Hood */}
        <path
          d="M380 205 L372 208 Q360 216 355 226 L350 236 Q348 244 354 244 L380 244 Z"
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth="1.2"
        />

        {/* Front Windshield Glass */}
        <path
          d="M377 210 L368 214 Q361 221 357 228 L375 228 Z"
          fill="#334155"
        />
        {/* Side Driver Window */}
        <rect x="377" y="210" width="18" height="18" rx="2" fill="#334155" />

        {/* Ambulance Rooftop Light Bar */}
        <rect x="382" y="200" width="28" height="5" rx="2" fill="#CBD5E1" />
        <rect x="384" y="198" width="10" height="4" rx="1.5" fill="#EF4444" />
        <rect x="398" y="198" width="10" height="4" rx="1.5" fill="#3B82F6" />

        {/* Emerald Green Stripe across Ambulance */}
        <rect x="350" y="231" width="132" height="6" fill="#059669" />

        {/* Ambulance Green Medical Cross Emblem */}
        <circle cx="440" cy="222" r="11" fill="#FFFFFF" stroke="#059669" strokeWidth="1.5" />
        {/* Cross Vertical */}
        <rect x="438.5" y="215" width="3" height="14" rx="1" fill="#059669" />
        {/* Cross Horizontal */}
        <rect x="433" y="220.5" width="14" height="3" rx="1" fill="#059669" />

        {/* Rear Door Seam & Window */}
        <rect x="464" y="211" width="12" height="12" rx="2" fill="#94A3B8" opacity="0.6" />
        <line x1="479" y1="205" x2="479" y2="244" stroke="#CBD5E1" strokeWidth="1" />

        {/* Headlight */}
        <path d="M349 237 Q348 241 352 242 L352 236 Z" fill="#FBBF24" />

        {/* Front Bumper */}
        <rect x="346" y="240" width="8" height="5" rx="2" fill="#475569" />

        {/* Front Wheel */}
        <g>
          {/* Wheel Arch Cutout */}
          <circle cx="370" cy="245" r="14" fill="#E2E8F0" />
          {/* Tire Outer */}
          <circle cx="370" cy="246" r="12" fill="#1E293B" />
          {/* Rim */}
          <circle cx="370" cy="246" r="7" fill="#CBD5E1" />
          {/* Hub */}
          <circle cx="370" cy="246" r="3.5" fill="#475569" />
        </g>

        {/* Rear Wheel */}
        <g>
          {/* Wheel Arch Cutout */}
          <circle cx="454" cy="245" r="14" fill="#E2E8F0" />
          {/* Tire Outer */}
          <circle cx="454" cy="246" r="12" fill="#1E293B" />
          {/* Rim */}
          <circle cx="454" cy="246" r="7" fill="#CBD5E1" />
          {/* Hub */}
          <circle cx="454" cy="246" r="3.5" fill="#475569" />
        </g>
      </g>
    </svg>
  );
}
