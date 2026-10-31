/**
 * BroadcastCenterTab.jsx
 * ----------------------
 * Network-Wide Emergency Broadcast & Announcement Center for Super Admin.
 *
 * Safety-First Architecture:
 * - Empty default composer (no pre-filled Code Blue or accidental global scope)
 * - Required explicit facility targeting
 * - Deliberate two-stage confirmation modal (type SEND or 1.5s press-and-hold for critical alerts)
 * - Anti-flood rate limiting: max 1 critical broadcast every 30 seconds
 * - Database persistence with PostgreSQL broadcasts table and full audit logging
 * - Real-time WebSockets synchronization across all hospital screen terminals
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE } from "../../../config/hospitalConfig";
import BroadcastHeader from "./broadcast/BroadcastHeader";
import TemplateChips from "./broadcast/TemplateChips";
import AlertTypeSelector from "./broadcast/AlertTypeSelector";
import TargetPicker from "./broadcast/TargetPicker";
import MessageFields from "./broadcast/MessageFields";
import DeliveryOptions from "./broadcast/DeliveryOptions";
import LivePreview from "./broadcast/LivePreview";
import DispatchConfirmModal from "./broadcast/DispatchConfirmModal";
import ActiveBroadcastCard from "./broadcast/ActiveBroadcastCard";
import BroadcastHistoryTable from "./broadcast/BroadcastHistoryTable";

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
  // Navigation sub-tabs inside Broadcast Center
  const [activeTab, setActiveTab] = useState("compose"); // "compose" | "active" | "history"

  // Network stats
  const [stats, setStats] = useState({
    activeCount: 0,
    connectedScreens: 0,
    totalHospitals: hospitals.length || 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Composer state: Opens EMPTY per safety guidelines
  const [formScope, setFormScope] = useState(""); // empty string: forces explicit choice
  const [formType, setFormType] = useState("notice"); // safe default: notice
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formDuration, setFormDuration] = useState("30"); // minutes: "15", "30", "60", "240", "0"
  const [formSound, setFormSound] = useState(true);
  const [formSurfaces, setFormSurfaces] = useState({
    patient_portal: true,
    doctor_desk: true,
    staff_desk: true,
    kiosk_display: true,
  });
  const [scheduledAt, setScheduledAt] = useState("");

  // Rate Limiting & Safety Modal state
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState(null);

  // Broadcasts Data state
  const [activeBroadcasts, setActiveBroadcasts] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyPages, setHistoryPages] = useState(1);
  const [historyFilters, setHistoryFilters] = useState({
    q: "",
    type: "all",
    status: "all",
    hospital_code: "all",
  });

  // Countdown timer ref for rate limit
  const rateLimitTimerRef = useRef(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
    };
  }, []);

  const startRateLimitCountdown = (seconds = 30) => {
    if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
    setRateLimitCountdown(seconds);
    rateLimitTimerRef.current = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(rateLimitTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Fetch Stats from backend
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/superadmin/broadcasts/stats`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.status === "success" && data.stats) {
        setStats(data.stats);
      }
    } catch (e) {
      // silent fallback
    }
  }, [getAuthHeaders]);

  // Fetch Active Broadcasts
  const fetchActiveBroadcasts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/broadcasts/active`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.status === "success" && Array.isArray(data.broadcasts)) {
        setActiveBroadcasts(data.broadcasts);
      }
    } catch (e) {
      console.warn("Failed to fetch active broadcasts:", e);
    }
  }, [getAuthHeaders]);

  // Fetch History with Pagination and Filters
  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(historyPage),
        page_size: String(historyPageSize),
        q: historyFilters.q || "",
        type: historyFilters.type || "all",
        status: historyFilters.status || "all",
        hospital_code: historyFilters.hospital_code || "all",
      });

      const res = await fetch(`${API_BASE}/api/v1/superadmin/broadcasts?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setHistoryData(data.broadcasts || []);
        setHistoryTotal(data.total || 0);
        setHistoryPages(data.pages || 1);
      }
    } catch (e) {
      console.warn("Failed to fetch broadcast history:", e);
    }
  }, [getAuthHeaders, historyPage, historyPageSize, historyFilters]);

  // Refresh all data
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(), fetchActiveBroadcasts(), fetchHistory()]);
    setIsRefreshing(false);
  }, [fetchStats, fetchActiveBroadcasts, fetchHistory]);

  // Initial load
  useEffect(() => {
    handleRefreshAll();
  }, [handleRefreshAll]);

  // Listen to socket events for auto-sync without page reload
  useEffect(() => {
    const handleBroadcastUpdate = () => {
      fetchActiveBroadcasts();
      fetchStats();
      fetchHistory();
    };

    window.addEventListener("broadcast_updated_live", handleBroadcastUpdate);
    window.addEventListener("emergency_broadcast", handleBroadcastUpdate);
    window.addEventListener("broadcast_dismissed", handleBroadcastUpdate);

    return () => {
      window.removeEventListener("broadcast_updated_live", handleBroadcastUpdate);
      window.removeEventListener("emergency_broadcast", handleBroadcastUpdate);
      window.removeEventListener("broadcast_dismissed", handleBroadcastUpdate);
    };
  }, [fetchActiveBroadcasts, fetchStats, fetchHistory]);

  // 20-second background fallback polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveBroadcasts();
      fetchStats();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchActiveBroadcasts, fetchStats]);

  // Template chip selected
  const handleSelectTemplate = (templateData) => {
    if (!templateData) return;
    setFormType(templateData.type || "notice");
    setFormTitle(templateData.title || "");
    setFormMessage(templateData.message || "");
    setFormDuration(String(templateData.duration || "30"));
    setFormSound(templateData.sound !== false);
    notify(
      isHi ? "टेम्पलेट लोड किया गया। कृपया अस्पताल चुनें।" : "Template loaded. Please verify target facility.",
      "info"
    );
  };

  // Reset Form
  const handleResetForm = () => {
    setFormScope("");
    setFormType("notice");
    setFormTitle("");
    setFormMessage("");
    setFormDuration("30");
    setFormSound(true);
    setScheduledAt("");
    setFormSurfaces({
      patient_portal: true,
      doctor_desk: true,
      staff_desk: true,
      kiosk_display: true,
    });
    notify(isHi ? "फॉर्म रीसेट कर दिया गया" : "Composer reset to empty defaults", "info");
  };

  // Surface toggles
  const handleSurfaceToggle = (surfaceKey) => {
    setFormSurfaces((prev) => ({
      ...prev,
      [surfaceKey]: !prev[surfaceKey],
    }));
  };

  const handleSelectAllSurfaces = () => {
    setFormSurfaces({
      patient_portal: true,
      doctor_desk: true,
      staff_desk: true,
      kiosk_display: true,
    });
  };

  const handleClearSurfaces = () => {
    setFormSurfaces({
      patient_portal: false,
      doctor_desk: false,
      staff_desk: false,
      kiosk_display: false,
    });
  };

  // Pre-dispatch Validation & Open Confirm Modal
  const handleOpenDispatchConfirm = (e) => {
    if (e) e.preventDefault();

    if (!formScope) {
      notify(
        isHi
          ? "कृपया लक्षित अस्पताल या 'नेटवर्क-व्यापी' का चयन करें।"
          : "Target facility scope is required. Please select a hospital or 'Network-Wide'.",
        "warn"
      );
      return;
    }

    if (!formTitle.trim()) {
      notify(
        isHi
          ? "प्रसारण हेतु मुख्य शीर्षक (हेडलाइन) अनिवार्य है।"
          : "Headline / Alert title is required before dispatching.",
        "warn"
      );
      return;
    }

    const hasAnySurface = Object.values(formSurfaces).some((v) => v === true);
    if (!hasAnySurface) {
      notify(
        isHi
          ? "कम से कम एक स्क्रीन या डिलीवरी माध्यम का चयन करें।"
          : "Please select at least one target surface.",
        "warn"
      );
      return;
    }

    const isCritical = formType === "code_blue" || formType === "code_red";
    if (isCritical && rateLimitCountdown > 0) {
      notify(
        isHi
          ? `सुरक्षा दर सीमा सक्रिय है। कृपया ${rateLimitCountdown} सेकंड प्रतीक्षा करें।`
          : `Rate limit in effect: please wait ${rateLimitCountdown}s before sending another critical alert.`,
        "warn"
      );
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Final Dispatch execution
  const handleConfirmDispatch = async () => {
    setIsSubmitting(true);
    try {
      const matchedHosp = hospitals.find((h) => (h.hospital_code || h.code) === formScope);
      const hospitalName =
        formScope === "all"
          ? "All Hospitals (Network-Wide)"
          : matchedHosp?.name || formScope;

      const payload = {
        hospital_code: formScope,
        hospital_name: hospitalName,
        type: formType,
        title: formTitle.trim(),
        message: formMessage.trim(),
        duration_minutes: Number(formDuration),
        sound: formSound,
        target_surfaces: formSurfaces,
        scheduled_at: scheduledAt || null,
        priority:
          formType === "code_blue" || formType === "code_red"
            ? "critical"
            : formType === "notice"
            ? "high"
            : "normal",
      };

      const res = await fetch(`${API_BASE}/api/v1/superadmin/broadcasts`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 429) {
        const remaining = data.retry_after_seconds || 30;
        startRateLimitCountdown(remaining);
        notify(
          data.message || `Rate limit in effect. Please wait ${remaining}s.`,
          "error"
        );
        setIsConfirmModalOpen(false);
        return;
      }

      if (res.ok && data.status === "success") {
        notify(
          isHi
            ? "🚨 प्रसारण सफलतापूर्वक सभी लक्षित स्क्रीनों पर प्रेषित किया गया!"
            : "🚨 Live broadcast dispatched successfully across target terminals!",
          "success"
        );

        if (formType === "code_blue" || formType === "code_red") {
          startRateLimitCountdown(30);
        }

        setIsConfirmModalOpen(false);
        handleResetForm();
        handleRefreshAll();
      } else {
        notify(data.message || "Failed to dispatch broadcast.", "error");
      }
    } catch (err) {
      console.error("Error creating broadcast:", err);
      notify("Network error dispatching broadcast.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extend active broadcast +15 mins
  const handleExtendBroadcast = async (broadcastId) => {
    setActionInProgressId(broadcastId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/superadmin/broadcasts/${broadcastId}/extend`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ add_minutes: 15 }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        notify(
          isHi ? "अवधि 15 मिनट बढ़ा दी गई है।" : "Broadcast extended by +15 minutes.",
          "success"
        );
        handleRefreshAll();
      } else {
        notify(data.message || "Failed to extend broadcast.", "error");
      }
    } catch (e) {
      notify("Network error extending broadcast.", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Dismiss active broadcast
  const handleDismissBroadcast = async (broadcastId) => {
    const executeDismiss = async () => {
      setActionInProgressId(broadcastId);
      try {
        const res = await fetch(`${API_BASE}/api/v1/superadmin/broadcasts/${broadcastId}/dismiss`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.status === "success") {
          notify(
            isHi
              ? "प्रसारण समाप्त कर दिया गया और स्क्रीनों से हटा दिया गया।"
              : "Broadcast dismissed & cleared from all screens.",
            "success"
          );
          handleRefreshAll();
        } else {
          notify(data.message || "Failed to dismiss broadcast.", "error");
        }
      } catch (e) {
        notify("Network error dismissing broadcast.", "error");
      } finally {
        setActionInProgressId(null);
      }
    };

    if (showConfirm) {
      showConfirm({
        title: isHi ? "लाइव प्रसारण समाप्त करें?" : "Dismiss Live Broadcast?",
        message: isHi
          ? "यह अलर्ट सभी कियोस्क, टीवी, डॉक्टर एवं मरीज़ स्क्रीनों से तुरंत हटा दिया जाएगा।"
          : "This announcement banner will be instantly stripped from all connected screens and kiosks.",
        confirmText: isHi ? "अलर्ट बंद करें" : "Dismiss Now",
        cancelText: isHi ? "वापस" : "Keep Active",
        danger: true,
        onConfirm: executeDismiss,
      });
    } else {
      if (window.confirm(isHi ? "क्या आप इस अलर्ट को तुरंत बंद करना चाहते हैं?" : "Dismiss this alert from all screens?")) {
        executeDismiss();
      }
    }
  };

  // Duplicate an existing broadcast to Composer
  const handleDuplicateToComposer = (b) => {
    if (!b) return;
    setFormScope(b.hospital_code || "");
    setFormType(b.type || "notice");
    setFormTitle(b.title || "");
    setFormMessage(b.message || "");
    setFormDuration(String(b.duration_minutes || b.duration || "30"));
    setFormSound(b.sound_alert ?? b.sound ?? true);
    if (b.target_surfaces) {
      setFormSurfaces(b.target_surfaces);
    }
    setActiveTab("compose");
    notify(isHi ? "विवरण कंपोज़र में कॉपी किया गया!" : "Duplicated to composer!", "info");
  };

  // Primary action button style determined by alert type
  const isFormValid = !!formScope && !!formTitle.trim() && rateLimitCountdown === 0;
  const primaryButtonColor =
    formType === "code_blue"
      ? "#1E3A8A"
      : formType === "code_red"
      ? "#881337"
      : formType === "notice"
      ? "#D97706"
      : "#059669";

  return (
    <div style={{ maxWidth: "100%", overflowX: "hidden" }}>
      {/* 1. Header with Live Socket Pill & Network Metrics */}
      <BroadcastHeader
        stats={stats}
        socketConnected={socketConnected}
        onRefresh={handleRefreshAll}
        isRefreshing={isRefreshing}
        isHi={isHi}
      />

      {/* Rate Limit Warning Banner if active */}
      {rateLimitCountdown > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 16px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1.5px solid rgba(239, 68, 68, 0.3)",
            color: "#DC2626",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "16px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>
            {isHi
              ? `आपातकालीन दर सीमा सक्रिय: नया क्रिटिकल अलर्ट भेजने से पहले कृपया ${rateLimitCountdown} सेकंड प्रतीक्षा करें।`
              : `Anti-flood rate limit active: please wait ${rateLimitCountdown}s before dispatching another critical emergency alert.`}
          </span>
        </div>
      )}

      {/* 2. Top Tab Navigation: Compose, Active Fleet, History Log */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
          borderBottom: "1px solid var(--border-color, #e2e8f0)",
          paddingBottom: "10px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("compose")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "compose" ? "var(--accent-color, #2563EB)" : "var(--bg-subtle, #f1f5f9)",
            color: activeTab === "compose" ? "#ffffff" : "var(--text-secondary, #475569)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
          </svg>
          {isHi ? "अलर्ट कंपोज़र एवं सिम्युलेटर" : "Composer & Simulator"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("active")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "active" ? "var(--accent-color, #2563EB)" : "var(--bg-subtle, #f1f5f9)",
            color: activeTab === "active" ? "#ffffff" : "var(--text-secondary, #475569)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: activeBroadcasts.length > 0 ? "#10B981" : "#94a3b8",
            }}
          />
          {isHi ? `सक्रिय प्रसारण (${activeBroadcasts.length})` : `Active Fleet (${activeBroadcasts.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: activeTab === "history" ? "var(--accent-color, #2563EB)" : "var(--bg-subtle, #f1f5f9)",
            color: activeTab === "history" ? "#ffffff" : "var(--text-secondary, #475569)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 14 14" />
          </svg>
          {isHi ? "ऑडिट एवं प्रसारण इतिहास" : "Broadcast Log & Audit"}
        </button>
      </div>

      {/* 3. Main Viewport Content based on activeTab */}
      {activeTab === "compose" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* Left Column: Composer */}
          <div
            style={{
              borderRadius: "14px",
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border-color, #e2e8f0)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              padding: "20px",
            }}
          >
            {/* Quick Templates Chips Row */}
            <TemplateChips onSelectTemplate={handleSelectTemplate} isHi={isHi} />

            {/* Alert Type Selector */}
            <AlertTypeSelector value={formType} onChange={setFormType} isHi={isHi} />

            {/* Target Facility & Surface Endpoints */}
            <TargetPicker
              hospitals={hospitals}
              scopeValue={formScope}
              onScopeChange={setFormScope}
              surfaces={formSurfaces}
              onSurfaceToggle={handleSurfaceToggle}
              onSelectAllSurfaces={handleSelectAllSurfaces}
              onClearSurfaces={handleClearSurfaces}
              isHi={isHi}
            />

            {/* Headline and Message Textarea with Live Counters */}
            <MessageFields
              title={formTitle}
              onTitleChange={setFormTitle}
              message={formMessage}
              onMessageChange={setFormMessage}
              isHi={isHi}
            />

            {/* Delivery Duration, Sound & Optional Scheduler */}
            <DeliveryOptions
              duration={formDuration}
              onDurationChange={setFormDuration}
              sound={formSound}
              onSoundChange={setFormSound}
              scheduledAt={scheduledAt}
              onScheduleChange={setScheduledAt}
              alertType={formType}
              isHi={isHi}
            />

            {/* Form Action Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                paddingTop: "12px",
                borderTop: "1px solid var(--border-color, #f1f5f9)",
              }}
            >
              <button
                type="button"
                onClick={handleResetForm}
                disabled={isSubmitting}
                style={{
                  padding: "9px 18px",
                  borderRadius: "9px",
                  background: "var(--bg-subtle, #f1f5f9)",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  color: "var(--text-secondary, #475569)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {isHi ? "फॉर्म रीसेट करें" : "Reset Form"}
              </button>

              <button
                type="button"
                onClick={handleOpenDispatchConfirm}
                disabled={!isFormValid || isSubmitting}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 24px",
                  borderRadius: "9px",
                  border: "none",
                  background: isFormValid ? primaryButtonColor : "var(--border-color, #cbd5e1)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: isFormValid && !isSubmitting ? "pointer" : "not-allowed",
                  opacity: isFormValid ? 1 : 0.6,
                  boxShadow: isFormValid ? `0 4px 14px ${primaryButtonColor}50` : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                  <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                  <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
                </svg>
                {scheduledAt
                  ? (isHi ? "घोषणा शेड्यूल करें" : "Schedule Broadcast")
                  : (isHi ? "प्रसारण प्रेषित करें (डिस्पैच)" : "Dispatch Broadcast")}
              </button>
            </div>
          </div>

          {/* Right Column: Live Screen Simulator & Compact Active Broadcasts */}
          <LivePreview
            formValues={{
              title: formTitle,
              message: formMessage,
              type: formType,
              hospital_code: formScope,
              surfaces: formSurfaces,
            }}
            hospitals={hospitals}
            activeBroadcasts={activeBroadcasts}
            onExtend={handleExtendBroadcast}
            onDismiss={handleDismissBroadcast}
            onDuplicate={handleDuplicateToComposer}
            isHi={isHi}
          />
        </div>
      )}

      {/* Active Fleet Tab */}
      {activeTab === "active" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {activeBroadcasts.length === 0 ? (
            <div
              style={{
                padding: "48px 20px",
                textAlign: "center",
                background: "var(--card-bg, #ffffff)",
                borderRadius: "14px",
                border: "1px dashed var(--border-color, #cbd5e1)",
                color: "var(--text-secondary, #64748b)",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--text-primary, #0f172a)" }}>
                {isHi ? "वर्तमान में कोई सक्रिय आपातकालीन प्रसारण नहीं है" : "No Active Alerts or Broadcasts"}
              </h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                {isHi
                  ? "सभी अस्पतालों के कियोस्क एवं टीवी स्क्रीन सामान्य कार्यप्रणाली पर हैं।"
                  : "All hospital screens, terminals and patient portals are currently operating under normal status."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "14px" }}>
              {activeBroadcasts.map((item) => (
                <ActiveBroadcastCard
                  key={item.id}
                  broadcast={item}
                  hospitals={hospitals}
                  onExtend={handleExtendBroadcast}
                  onDismiss={handleDismissBroadcast}
                  onDuplicate={handleDuplicateToComposer}
                  isActionLoading={actionInProgressId === item.id}
                  isHi={isHi}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* History and Audit Tab */}
      {activeTab === "history" && (
        <BroadcastHistoryTable
          historyData={historyData}
          totalCount={historyTotal}
          currentPage={historyPage}
          pageSize={historyPageSize}
          totalPages={historyPages}
          onPageChange={setHistoryPage}
          onPageSizeChange={(newSize) => {
            setHistoryPageSize(newSize);
            setHistoryPage(1);
          }}
          hospitals={hospitals}
          filters={historyFilters}
          onFilterChange={(newFilters) => {
            setHistoryFilters(newFilters);
            setHistoryPage(1);
          }}
          onExtend={handleExtendBroadcast}
          onDismiss={handleDismissBroadcast}
          onDuplicate={handleDuplicateToComposer}
          isLoading={isRefreshing}
          isHi={isHi}
        />
      )}

      {/* 4. Safety Confirmation Modal */}
      <DispatchConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDispatch}
        formValues={{
          title: formTitle,
          message: formMessage,
          type: formType,
          hospital_code: formScope,
          surfaces: formSurfaces,
          duration: formDuration,
          sound: formSound,
        }}
        hospitals={hospitals}
        isSubmitting={isSubmitting}
        isHi={isHi}
      />
    </div>
  );
}
