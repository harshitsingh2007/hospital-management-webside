/**
 * KioskPage.jsx
 * -------------
 * Dedicated Standalone Hospital Queue Display & Self-Service Kiosk Portal.
 *
 * Route: /kiosk/:hospitalCode/:kioskCode
 *        /kiosk/:hospitalCode/:kioskCode/display
 *
 * Features:
 * - Completely independent identity from Patient, Staff & SuperAdmin portals.
 * - Backed by PostgreSQL `kiosks` database model with real-time validation.
 * - Real-time Socket.IO room subscription (hospital/tenant scoped).
 * - Automatic hardware heartbeat reporting (`last_seen_at` every 30s).
 * - High-visibility "NOW SERVING" with calling wave animation.
 * - "NEXT IN QUEUE" with upcoming tokens and AI wait-time estimation.
 * - Voice audio announcement with deduplication.
 * - Dual modes: Large Wall TV Display mode & Interactive Touchscreen Check-In mode.
 * - Responsive from 360px mobile to 1920px+ 4K monitors.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { API_BASE, WS_URL, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { announceTicketVoice } from "../utils/voiceSynthesizer";
import { t } from "../utils/i18n";

// Dedicated Kiosk Subcomponents
import KioskHeader from "../components/kiosk/KioskHeader";
import NowServing from "../components/kiosk/NowServing";
import NextQueue from "../components/kiosk/NextQueue";
import QueueSummary from "../components/kiosk/QueueSummary";

export default function KioskPage({
  tenantId: propTenantId,
  analytics: propAnalytics,
  servingTickets: propServingTickets,
  queueSnapshot: propQueueSnapshot,
  kioskQrData: propKioskQrData,
  language: propLanguage = "en",
  setLanguage: propSetLanguage,
  navigateTo = null,
}) {
  // 1. URL Path Parsing: /kiosk/:hospitalCode/:kioskCode or /kiosk/:hospitalCode/:kioskCode/display
  const parseUrlParams = () => {
    if (typeof window === "undefined") {
      return { hospitalCode: propTenantId || "city-hospital-01", kioskCode: "K-01", isDisplayMode: false };
    }

    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);
    const kioskIdx = parts.findIndex((p) => p.toLowerCase() === "kiosk");

    let hCode = null;
    let kCode = null;
    let isDisplay = false;

    if (kioskIdx !== -1) {
      if (parts[kioskIdx + 1]) hCode = parts[kioskIdx + 1];
      if (parts[kioskIdx + 2]) kCode = parts[kioskIdx + 2];
      if (parts[kioskIdx + 3] && parts[kioskIdx + 3].toLowerCase() === "display") {
        isDisplay = true;
      }
    }

    // Also check query parameters as fallback
    const params = new URLSearchParams(window.location.search);
    if (!hCode) hCode = params.get("hospital") || params.get("tenant") || propTenantId || "city-hospital-01";
    if (!kCode) kCode = params.get("kiosk") || params.get("code") || "K-01";
    if (params.get("mode") === "display" || params.get("view") === "display") {
      isDisplay = true;
    }

    return {
      hospitalCode: String(hCode).trim(),
      kioskCode: String(kCode).trim().toUpperCase(),
      isDisplayMode: isDisplay,
    };
  };

  const initialRoute = parseUrlParams();
  const [hospitalCode, setHospitalCode] = useState(initialRoute.hospitalCode);
  const [kioskCode, setKioskCode] = useState(initialRoute.kioskCode);

  // Kiosk Metadata State
  const [kioskData, setKioskData] = useState(null);
  const [hospitalData, setHospitalData] = useState(null);
  const [departmentData, setDepartmentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);

  // Live Queue & Telemetry State
  const [queueSnapshot, setQueueSnapshot] = useState(propQueueSnapshot || []);
  const [servingTickets, setServingTickets] = useState(propServingTickets || []);
  const [analytics, setAnalytics] = useState(propAnalytics || null);
  const [kioskQrData, setKioskQrData] = useState(propKioskQrData || null);

  // Hardware & Clock State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [language, setLanguage] = useState(propLanguage || "en");

  // References for socket and audio announcements
  const socketRef = useRef(null);
  const lastAnnouncedTicketRef = useRef(null);
  const languageRef = useRef(language);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Sync language with parent if provided
  const handleSetLanguage = (lang) => {
    setLanguage(lang);
    if (propSetLanguage) propSetLanguage(lang);
  };

  // Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, []);

  // Fullscreen TV Mode Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => console.log(err));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch((err) => console.log(err));
      }
    }
  };

  // 2. Fetch & Validate Kiosk Metadata from Database
  const fetchKioskMetadata = useCallback(async () => {
    setLoading(true);
    setErrorState(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/kiosk/${hospitalCode}/${kioskCode}`);
      const data = await res.json();

      if (res.ok && data.status === "success") {
        setKioskData(data.kiosk);
        setHospitalData(data.hospital);
        setDepartmentData(data.department);

        // Apply hospital brand theme colors if configured
        if (data.hospital?.branding?.primary_color) {
          document.documentElement.style.setProperty("--brand-primary", data.hospital.branding.primary_color);
        }
      } else {
        setErrorState({
          code: data.error_code || "UNAVAILABLE",
          message: data.message || "Kiosk terminal unavailable.",
        });
      }
    } catch (err) {
      console.log("Kiosk fetch error:", err);
      setErrorState({
        code: "NETWORK_ERROR",
        message: "Unable to connect to the hospital queue server. Please check local network connection.",
      });
    } finally {
      setLoading(false);
    }
  }, [hospitalCode, kioskCode]);

  useEffect(() => {
    fetchKioskMetadata();
  }, [fetchKioskMetadata]);

  // 3. Hardware Heartbeat: Reports online status every 30 seconds
  useEffect(() => {
    if (!kioskData) return;

    const sendHeartbeat = () => {
      fetch(`${API_BASE}/api/v1/kiosk/${hospitalCode}/${kioskCode}/heartbeat`, {
        method: "POST",
      }).catch((e) => console.log("Kiosk heartbeat error:", e));
    };

    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(heartbeatTimer);
  }, [hospitalCode, kioskCode, kioskData]);

  // 4. Fetch Queue & QR Data
  const refreshQueueData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/kiosk/${hospitalCode}/${kioskCode}/queue`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setQueueSnapshot(data.snapshot || []);
          setServingTickets(data.serving || []);
          if (data.analytics) setAnalytics(data.analytics);
        }
      }
    } catch (err) {
      console.log("Queue refresh error:", err);
    }

    // Fetch Mobile QR Code
    try {
      const qrRes = await fetch(`${API_BASE}/api/v1/plugin/qr/${hospitalCode}`);
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        setKioskQrData(qrData);
      }
    } catch (err) {
      console.log("QR refresh error:", err);
    }
  }, [hospitalCode, kioskCode]);

  useEffect(() => {
    refreshQueueData();
    const pollTimer = setInterval(refreshQueueData, 5000);
    return () => clearInterval(pollTimer);
  }, [refreshQueueData]);

  // 5. Audio Chime & Synthesizer Announcement
  const playChimeSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch (e) {
      console.log("Audio play error:", e);
    }
  };

  // 6. Real-Time Socket.IO Subscription
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      auth: { tenant_id: hospitalCode },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("join_room", { tenant_id: hospitalCode });
    });

    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));

    // Handle live queue updates
    socket.on("queue_update", (data) => {
      if (data.snapshot) setQueueSnapshot(data.snapshot);
      if (data.serving) setServingTickets(data.serving);
    });

    socket.on("queue_updated", (data) => {
      if (data.snapshot) setQueueSnapshot(data.snapshot);
      if (data.serving) setServingTickets(data.serving);
      if (data.analytics) setAnalytics(data.analytics);
    });

    socket.on("analytics_update", (data) => {
      if (data) setAnalytics(data);
    });

    // Handle ticket call (Now Serving announcement)
    socket.on("now_serving", (data) => {
      if (data && data.ticket) {
        const ticket = data.ticket;
        // Prevent duplicate announcements on quick socket reconnects
        if (lastAnnouncedTicketRef.current !== ticket.ticket_id) {
          lastAnnouncedTicketRef.current = ticket.ticket_id;
          playChimeSound();
          setTimeout(() => {
            announceTicketVoice(ticket, languageRef.current || "en");
          }, 400);
        }
      }
      refreshQueueData();
    });

    return () => socket.disconnect();
  }, [hospitalCode, refreshQueueData]);

  // =========================================================================
  // RENDER STATES: Loading, Kiosk Unavailable, or Dedicated Portal UI
  // =========================================================================

  // A. Loading State
  if (loading) {
    return (
      <div style={fullScreenCenterStyle}>
        <div style={loadingCardStyle}>
          <div style={spinnerStyle} />
          <h2 style={{ margin: "16px 0 6px 0", fontSize: "22px", color: "#0F172A", fontWeight: 800 }}>
            {language === "hi" ? "अस्पताल कियोस्क से कनेक्ट हो रहा है..." : "Connecting to Hospital Kiosk..."}
          </h2>
          <span style={{ fontSize: "13px", color: "#64748B" }}>
            {hospitalCode} • Kiosk {kioskCode}
          </span>
        </div>
      </div>
    );
  }

  // B. Invalid Kiosk / Unavailable Error State
  if (errorState) {
    return (
      <div style={fullScreenCenterStyle}>
        <div style={errorCardStyle}>
          <div style={errorIconBadgeStyle}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h2 style={{ margin: "14px 0 6px 0", fontSize: "24px", color: "#0F172A", fontWeight: 900 }}>
            {language === "hi" ? "कियोस्क अनुपलब्ध (Kiosk Unavailable)" : "Kiosk Unavailable"}
          </h2>

          <p style={{ margin: "0 0 20px 0", fontSize: "14.5px", color: "#64748B", lineHeight: "1.5" }}>
            {errorState.message}
          </p>

          <div style={errorDetailsBoxStyle}>
            <div><strong>Hospital:</strong> {hospitalCode}</div>
            <div><strong>Kiosk Terminal:</strong> {kioskCode}</div>
            <div><strong>Status Code:</strong> {errorState.code}</div>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
            <button
              type="button"
              onClick={fetchKioskMetadata}
              style={retryBtnStyle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {language === "hi" ? "पुनः प्रयास करें" : "Retry Connection"}
            </button>

            {navigateTo && (
              <button
                type="button"
                onClick={() => navigateTo("patient", "walkin")}
                style={homeBtnStyle}
              >
                {language === "hi" ? "मुख्य पोर्टल" : "Return to Portal"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // C. Standalone Dedicated Kiosk Portal Interface
  const branding = hospitalData?.branding || {};

  return (
    <div style={{ ...kioskPortalWrapperStyle, padding: isFullscreen ? "16px 24px" : "20px 28px" }}>
      <style>{`
        body {
          margin: 0;
          padding: 0;
          background: #F8FAFC;
        }
        @media (max-width: 960px) {
          .kiosk-grid-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      {/* 1. Dedicated Kiosk Top Identity Bar */}
      <KioskHeader
        hospital={hospitalData}
        kiosk={kioskData}
        department={departmentData}
        socketConnected={socketConnected}
        currentTime={currentTime}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        language={language}
        setLanguage={handleSetLanguage}
        navigateTo={navigateTo}
        branding={branding}
      />

      {/* 2. Main Kiosk Grid: NOW SERVING (Left) & NEXT IN QUEUE (Right) */}
      <main
        className="kiosk-grid-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 1.15fr",
          gap: "24px",
          flex: 1,
        }}
      >
        {/* Left Column: Huge NOW SERVING Display */}
        <NowServing
          servingTickets={servingTickets}
          language={language}
          branding={branding}
        />

        {/* Right Column: Upcoming NEXT IN QUEUE Tickets */}
        <NextQueue
          queueSnapshot={queueSnapshot}
          language={language}
          branding={branding}
        />
      </main>

      {/* 3. Telemetry Footer Summary & Mobile QR Code */}
      <QueueSummary
        analytics={analytics}
        waitingCount={queueSnapshot.length}
        servingCount={servingTickets.length}
        department={departmentData}
        kioskQrData={kioskQrData}
        language={language}
        branding={branding}
      />
    </div>
  );
}

// Styling Tokens
const kioskPortalWrapperStyle = {
  minHeight: "100vh",
  width: "100vw",
  boxSizing: "border-box",
  background: "linear-gradient(135deg, #F8FAFC 0%, #F0F9FF 100%)",
  color: "#0F172A",
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  display: "flex",
  flexDirection: "column",
  overflowX: "hidden",
};

const fullScreenCenterStyle = {
  minHeight: "100vh",
  width: "100vw",
  background: "#F8FAFC",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  boxSizing: "border-box",
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
};

const loadingCardStyle = {
  background: "#FFFFFF",
  borderRadius: "24px",
  padding: "40px",
  textAlign: "center",
  border: "1px solid #E2E8F0",
  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  maxWidth: "420px",
  width: "100%",
};

const spinnerStyle = {
  width: "44px",
  height: "44px",
  border: "4px solid #E0F2FE",
  borderTopColor: "#0284C7",
  borderRadius: "50%",
  margin: "0 auto",
  animation: "spin 0.8s linear infinite",
};

const errorCardStyle = {
  background: "#FFFFFF",
  borderRadius: "24px",
  padding: "36px",
  textAlign: "center",
  border: "1px solid #FECACA",
  boxShadow: "0 16px 40px -8px rgba(220, 38, 38, 0.1)",
  maxWidth: "480px",
  width: "100%",
};

const errorIconBadgeStyle = {
  width: "64px",
  height: "64px",
  borderRadius: "50%",
  background: "#FEF2F2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto",
};

const errorDetailsBoxStyle = {
  background: "#F8FAFC",
  borderRadius: "12px",
  padding: "12px 16px",
  border: "1px solid #E2E8F0",
  fontSize: "13px",
  color: "#475569",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const retryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 20px",
  borderRadius: "12px",
  border: "none",
  background: "#0284C7",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
};

const homeBtnStyle = {
  padding: "12px 20px",
  borderRadius: "12px",
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  color: "#334155",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

