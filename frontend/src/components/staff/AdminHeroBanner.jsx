/**
 * AdminHeroBanner.jsx
 * -------------------
 * Doctor & Staff Desk Dashboard Hero Section.
 * Aligned to the design, layout, aesthetics, and structure of the Patient Portal (HeroBanner.jsx):
 * - Desktop: 2-column layout (Left content & stats, Right hospital illustration)
 * - Tablet: Responsive flex layout
 * - Mobile: Gracefully stacked layout
 */

import React, { useState, useEffect, useRef } from "react";
import { getCategoryLabel } from "../../utils/i18n";
import { fetchDailyHealthQuote } from "../../utils/dailyHealthTips";
import {
  IconDoctor,
  IconHospital,
  IconTag,
  IconCoffee,
  IconSiren,
  IconShield,
  IconActivity,
} from "../common/MedicalIcons";

export default function AdminHeroBanner({
  language = "en",
  adminDept = "all",
  hospitalName = "City General Hospital",
  currentUser,
  analytics,
  branding = null,
  waitingCount = 0,
  servingCount = 0,
  heldCount = 0,
  servingTicket,
  nextTicket,
  appointmentsCount = 0,
  handleCounterChange,
  handleServeNext,
  isDoctorBusy = false,
  myServingTicket = null,
  navigateTo,
  doctorDutyStatus = "ACTIVE",
  onUpdateDutyStatus = null,
  dutyTimerText = "",
  onEndBreak = null,
  isDark = false,
}) {
  const isHi = language === "hi";
  const isDarkMode = isDark || (typeof document !== "undefined" && (document.body.classList.contains("theme-dark") || document.documentElement.getAttribute("data-theme") === "dark"));
  const deptLabel = getCategoryLabel(adminDept, language);
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

  const activeServing = myServingTicket || servingTicket;
  const liveServingCount =
    (typeof servingCount === "number" ? servingCount : null) ??
    analytics?.serving_count ??
    analytics?.currently_serving ??
    0;

  const displayServing = activeServing
    ? `#${activeServing.ticket_id}`
    : liveServingCount > 0
    ? `${liveServingCount} Active`
    : isHi
    ? "डेस्क खाली"
    : "Desk Ready";

  const activeCounters = analytics && typeof analytics.active_counters === "number" 
    ? analytics.active_counters 
    : 1;

  const doctorName = currentUser?.name || currentUser?.full_name || (isHi ? "डॉक्टर" : "Doctor");
  const completedCount =
    analytics?.completed_today ??
    analytics?.total_completed ??
    0;
  const patientsServed = analytics
    ? `${completedCount + liveServingCount}`
    : (liveServingCount > 0 ? `${liveServingCount}` : "0");

  const userRole = (currentUser?.role || "").toLowerCase();
  const isStaffOrDoctor = ["doctor", "staff", "nurse", "receptionist"].includes(userRole);
  const canModifyDesks = !isStaffOrDoctor && (userRole === "super_admin" || userRole === "superadmin");


  return (
    <div style={heroContainerStyle} className="hero-banner-container">
      <style>{`
        .hero-banner-container {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          border-radius: 28px;
          overflow: hidden;
          background: #0F172A;
          box-shadow: 0 16px 36px -8px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(2, 132, 199, 0.05);
          border: 1px solid rgba(2, 132, 199, 0.2);
          margin-bottom: 24px;
          position: relative;
          min-height: 280px;
          width: 100%;
        }

        /* Hospital Branding Card Dark/Light Modes */
        .hero-branding-pill {
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1.5px solid rgba(2, 132, 199, 0.25) !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12) !important;
        }

        .hero-branding-pill .hero-hospital-title {
          color: #0F172A !important;
        }

        body.theme-dark .hero-branding-pill,
        [data-theme="dark"] .hero-branding-pill,
        .dark-theme-staff .hero-branding-pill {
          background: #0F172A !important;
          border: 1.5px solid rgba(56, 189, 248, 0.35) !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
        }

        body.theme-dark .hero-branding-pill .hero-hospital-title,
        [data-theme="dark"] .hero-branding-pill .hero-hospital-title,
        .dark-theme-staff .hero-branding-pill .hero-hospital-title {
          color: #F8FAFC !important;
        }

        .hero-left-col {
          flex: 1.15;
          padding: 24px 30px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          z-index: 2;
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 70%, ${secondaryBrandColor} 100%);
          position: relative;
        }

        /* Divider on wide screens */
        @media (min-width: 900px) {
          .hero-left-col {
            padding-right: 40px;
            margin-right: 0;
            border-right: 1px solid rgba(2, 132, 199, 0.2);
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
          min-height: 260px;
        }

        .hero-pills-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .hero-pill-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 11px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .hero-title {
          font-size: 32px;
          font-weight: 800;
          line-height: 1.18;
          letter-spacing: -0.6px;
          color: #FFFFFF;
          margin: 0;
        }

        .hero-title-highlight {
          color: #38BDF8;
        }

        .hero-subtitle {
          color: rgba(224, 242, 254, 0.88);
          font-size: 13.5px;
          line-height: 1.5;
          margin-top: 12px;
          margin-bottom: 24px;
          max-width: 480px;
          font-weight: 500;
        }

        .hero-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          width: 100%;
        }

        .hero-stat-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          box-sizing: border-box;
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        .hero-stat-card:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(56, 189, 248, 0.4);
        }

        .hero-stat-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(56, 189, 248, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #38BDF8;
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
          font-weight: 600;
          color: rgba(255, 255, 255, 0.78);
          line-height: 1.2;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .counter-btn-micro {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.12);
          color: #FFFFFF;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          line-height: 1;
          padding: 0;
          transition: all 0.15s ease;
        }

        .counter-btn-micro:hover:not(:disabled) {
          background: #0284C7;
          border-color: #38BDF8;
        }

        .counter-btn-micro:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        @keyframes pulseTimerGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
          }
          70% {
            box-shadow: 0 0 0 7px rgba(245, 158, 11, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
          }
        }

        @keyframes pulseEmergencyGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.8);
          }
          70% {
            box-shadow: 0 0 0 7px rgba(244, 63, 94, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(244, 63, 94, 0);
          }
        }

        .duty-status-badge-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
          user-select: none;
        }

        .duty-status-badge-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.2);
        }

        .duty-timer-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.2px;
          user-select: none;
        }

        .duty-resume-action-btn {
          background: #10B981;
          color: #FFFFFF;
          border: none;
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .duty-resume-action-btn:hover {
          background: #059669;
          transform: scale(1.06);
        }

        @media (max-width: 1240px) {
          .hero-stats-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 900px) {
          .hero-banner-container {
            flex-direction: column;
          }
          .hero-left-col {
            clip-path: none !important;
            padding: 30px 24px;
            margin-right: 0;
            border-right: none !important;
            border-bottom: 1px solid rgba(16, 185, 129, 0.25);
          }
          .hero-right-col {
            min-height: 220px;
            width: 100%;
          }
        }

        @media (max-width: 540px) {
          .hero-title {
            font-size: clamp(22px, 6.5vw, 28px);
          }
          .hero-left-col {
            padding: 20px 14px;
          }
          .hero-stats-row {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .hero-stat-card {
            padding: 8px 10px;
          }
        }

        @media (max-width: 380px) {
          .hero-stats-row {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      {/* LEFT COLUMN: Header Pills, Typography & 4 Stats Cards */}
      <div className="hero-left-col">
        <div>


          <h1 className="hero-title">
            {isHi ? (
              <>
                डॉक्टर एवं स्टाफ कंसोल.
                <br />
                <span className="hero-title-highlight" style={{ color: primaryBrandColor }}>हम</span> सदैव सेवा में तत्पर हैं.
              </>
            ) : (
              <>
                Doctor & Staff Desk.
                <br />
                <span className="hero-title-highlight" style={{ color: primaryBrandColor }}>We’re</span> Here to Serve.
              </>
            )}
          </h1>


          {/* Dynamic Daily Health Quote / Clinical Insight (matching Patient Portal) */}
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
              maxWidth: "500px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
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
                  {isHi ? "दैनिक स्वास्थ्य एवं क्लिनिकल युक्ति" : "Daily Clinical & Health Insight"}{" "}
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
                "{dailyQuote?.text || (isHi ? "पर्याप्त पानी पिएं और स्वस्थ रहें।" : "Stay hydrated and prioritize patient wellbeing today.")}"
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

        {/* 4 Stats Badges matching HeroBanner */}
        <div className="hero-stats-row">
          {/* 1. Patients Served Today */}
          <div className="hero-stat-card">
            <div className="hero-stat-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="hero-stat-value">{patientsServed}</div>
              <div className="hero-stat-label">
                {isHi ? "आज सेवारत मरीज़" : "Patients Today"}
              </div>
            </div>
          </div>

          {/* 2. Active Desks with subtle stepper */}
          <div className="hero-stat-card">
            <div className="hero-stat-icon-wrap" style={{ color: "#38BDF8" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="hero-stat-value" style={{ color: "#38BDF8" }}>
                  {activeCounters} {isHi ? "डेस्क" : (activeCounters === 1 ? "Desk" : "Desks")}
                </span>
                {canModifyDesks && handleCounterChange && (
                  <div style={{ display: "inline-flex", gap: "3px", marginLeft: "2px" }}>
                    <button
                      type="button"
                      className="counter-btn-micro"
                      onClick={() => handleCounterChange(-1)}
                      disabled={activeCounters <= 1}
                      title="Decrease Counter"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="counter-btn-micro"
                      onClick={() => handleCounterChange(1)}
                      disabled={activeCounters >= 10}
                      title="Increase Counter"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              <div className="hero-stat-label">
                {isHi ? "सक्रिय डॉक्टर डेस्क" : "Active Desks"}
              </div>
            </div>
          </div>

          {/* 3. Live Waiting in Queue */}
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
              <div className="hero-stat-value" style={{ color: "#FDE047", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>{waitingCount} {isHi ? "प्रतीक्षारत" : "Waiting"}</span>
                {heldCount > 0 && (
                  <span style={{ fontSize: "11.5px", color: "#FB923C", background: "rgba(251, 146, 60, 0.18)", padding: "1px 6px", borderRadius: "6px" }}>
                    {heldCount} ⏸️
                  </span>
                )}
              </div>
              <div className="hero-stat-label">
                {isHi ? "प्रतीक्षारत मरीज़" : "Live in Queue"}
              </div>
            </div>
          </div>

          {/* 4. Now Serving / Next Patient */}
          <div className="hero-stat-card">
            <div className="hero-stat-icon-wrap" style={{ color: "#34D399" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                <span className="hero-stat-value" style={{ color: "#34D399" }}>
                  {displayServing}
                </span>
              </div>
              <div className="hero-stat-label">
                {isHi ? "वर्तमान सेवारत" : "Now Serving"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Hospital & Ambulance Vector Healthcare Visual matching Patient Portal */}
      <div className="hero-right-col">
        {/* Floating Live Desk Badge */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "9999px",
            padding: "4px 12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#38BDF8",
            fontSize: "11px",
            fontWeight: 700,
            zIndex: 3,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#34D399",
              display: "inline-block",
              boxShadow: "0 0 8px #34D399",
            }}
          />
          <span>{isHi ? "लाइव स्टाफ कंसोल" : "Live Staff Console"}</span>
        </div>


        <HospitalAmbulanceIllustration />
        {branding?.logo_url && (
          <div
            className="hero-branding-pill"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              borderRadius: "14px",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              maxWidth: "240px",
              zIndex: 4,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
              flexShrink: 0,
            }}>
              <img
                src={branding.logo_url}
                alt="Hospital Logo"
                style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "6px" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                className="hero-hospital-title"
                style={{
                  fontSize: "12px",
                  fontWeight: 900,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayHospName}
              </div>
              <div style={{ fontSize: "9.5px", fontWeight: 800, color: isDarkMode ? "#38BDF8" : (branding.primary_color || "#0284C7"), textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Clinical Desk
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
 * Modeled precisely to match the Patient Portal Hero Banner.
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
        maxHeight: "320px",
        display: "block",
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Sky gradient */}
        <linearGradient id="staffSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E6F2FA" />
          <stop offset="60%" stopColor="#EFF7FC" />
          <stop offset="100%" stopColor="#F5FBF7" />
        </linearGradient>

        {/* Building wall gradient */}
        <linearGradient id="staffBuildingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>

        {/* Window glass gradient */}
        <linearGradient id="staffWindowGlass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>

        {/* Shadow filter */}
        <filter id="staffSoftShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Background Sky */}
      <rect width="540" height="320" fill="url(#staffSkyGrad)" />

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
      <g filter="url(#staffSoftShadow)">
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
        <g fill="url(#staffWindowGlass)" stroke="#38BDF8" strokeWidth="1">
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
        <g fill="url(#staffWindowGlass)" stroke="#38BDF8" strokeWidth="1">
          <rect x="205" y="144" width="36" height="26" rx="2" />
          <line x1="223" y1="144" x2="223" y2="170" stroke="#FFFFFF" strokeWidth="1" />

          <rect x="249" y="144" width="36" height="26" rx="2" />
          <line x1="267" y1="144" x2="267" y2="170" stroke="#FFFFFF" strokeWidth="1" />

          <rect x="293" y="144" width="32" height="26" rx="2" />
          <line x1="309" y1="144" x2="309" y2="170" stroke="#FFFFFF" strokeWidth="1" />
        </g>

        {/* Left Wing Windows (3 Floors) */}
        <g fill="url(#staffWindowGlass)" stroke="#38BDF8" strokeWidth="1">
          <rect x="135" y="140" width="22" height="24" rx="2" />
          <rect x="165" y="140" width="22" height="24" rx="2" />
          <rect x="135" y="174" width="22" height="24" rx="2" />
          <rect x="165" y="174" width="22" height="24" rx="2" />
          <rect x="135" y="208" width="22" height="24" rx="2" />
          <rect x="165" y="208" width="22" height="24" rx="2" />
        </g>

        {/* Right Wing Windows (3 Floors) */}
        <g fill="url(#staffWindowGlass)" stroke="#38BDF8" strokeWidth="1">
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
      <g filter="url(#staffSoftShadow)" transform="translate(0, 0)">
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
