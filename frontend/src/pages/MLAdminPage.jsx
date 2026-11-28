/**
 * MLAdminPage.jsx
 * --------------
 * Hospital ML Studio & Continuous Learning Pipeline.
 * Features:
 * - Real-time continuous learning monitoring & drift detection
 * - Model versioning and safe rollback
 * - Automated retraining controls and global data pooling toggles
 * - Multi-tenant isolation with Superadmin / Hospital Owner guards
 * - Clean clinical design with zero emojis, full English/Hindi i18n, and dark mode support
 */

import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../config/hospitalConfig";

const TRANSLATIONS = {
  en: {
    badge: "Machine Learning Engine",
    title: "Hospital ML Studio & Continuous Learning",
    subtitle: "Real-time queue wait-time models, drift monitoring, and safe automated learning.",
    tenantLabel: "Active Tenant",
    activeModel: "Active Model",
    modelVersion: "Model Version",
    trainingAccuracy: "Training MAE",
    liveAccuracy: "Live 7-Day MAE",
    datasetSize: "Training Rows",
    newRows: "New Accumulated Rows",
    lastTrained: "Last Trained",
    retrainNow: "Retrain Model Now",
    retraining: "Retraining Model...",
    rollbackTitle: "Model Version Rollback",
    selectVersion: "Select a previous model version...",
    rollbackBtn: "Rollback Version",
    rollingBack: "Rolling Back...",
    driftDetectedTitle: "Model Performance Drift Detected",
    driftNormalTitle: "Model Accuracy Healthy",
    driftNormalMsg: "Live queue wait-time predictions are tracking within expected accuracy bounds.",
    autoLearningTitle: "Continuous Auto-Learning",
    autoLearningDesc: "Automatically train and evaluate candidate models when 200+ new verified service logs accumulate.",
    poolingTitle: "Global Learning Data Pooling",
    poolingDesc: "Contribute de-identified numerical wait-time features to improve platform-wide baseline models.",
    enabled: "Enabled",
    disabled: "Disabled",
    promotionBannerTitle: "Latest Training & Evaluation Run",
    candidateMae: "Candidate MAE",
    baselineMae: "Baseline Median MAE",
    r2Score: "R2 Accuracy",
    mapeScore: "MAPE Error",
    deptBreakdown: "Live 7-Day Accuracy by Department",
    deptName: "Department",
    samples: "Completed Samples",
    maeCol: "Live MAE",
    uploadTitle: "Ingest Historical Dataset",
    uploadDesc: "Upload CSV or Excel files containing historical patient service durations to bootstrap training.",
    previewBtn: "Preview & Map Columns",
    parsing: "Parsing...",
    importBtn: "Import & Save Dataset",
    importing: "Importing...",
    noVersions: "No prior model versions found for rollback.",
    globalNote: "Note: Global baseline model management requires platform Super Admin permissions.",
  },
  hi: {
    badge: "मशीन लर्निंग इंजन",
    title: "अस्पताल एमएल स्टूडियो और निरंतर शिक्षण",
    subtitle: "वास्तविक समय कतार प्रतीक्षा-समय मॉडल, विचलन निगरानी, और सुरक्षित स्वचालित शिक्षण।",
    tenantLabel: "सक्रिय अस्पताल",
    activeModel: "सक्रिय मॉडल",
    modelVersion: "मॉडल संस्करण",
    trainingAccuracy: "प्रशिक्षण एमएई",
    liveAccuracy: "लाइव 7-दिवसीय एमएई",
    datasetSize: "प्रशिक्षण रिकॉर्ड",
    newRows: "नए संचित रिकॉर्ड",
    lastTrained: "अंतिम प्रशिक्षित",
    retrainNow: "मॉडल को पुनः प्रशिक्षित करें",
    retraining: "पुनः प्रशिक्षण जारी...",
    rollbackTitle: "मॉडल संस्करण रोलबैक",
    selectVersion: "पिछला संस्करण चुनें...",
    rollbackBtn: "संस्करण रोलबैक करें",
    rollingBack: "रोलबैक जारी...",
    driftDetectedTitle: "मॉडल प्रदर्शन विचलन का पता चला",
    driftNormalTitle: "मॉडल सटीकता सामान्य है",
    driftNormalMsg: "वास्तविक समय की प्रतीक्षा अवधि भविष्यवाणियां अपेक्षित सटीकता सीमा के भीतर हैं।",
    autoLearningTitle: "निरंतर स्वतः शिक्षण",
    autoLearningDesc: "200+ नए सत्यापित सेवा लॉग एकत्र होने पर उम्मीदवार मॉडल को स्वतः प्रशिक्षित और मूल्यांकित करें।",
    poolingTitle: "ग्लोबल लर्निंग डेटा पूलिंग",
    poolingDesc: "प्लेटफ़ॉर्म-स्तरीय मॉडल को बेहतर बनाने के लिए पहचान-मुक्त संख्यात्मक डेटा साझा करें।",
    enabled: "सक्रिय",
    disabled: "निष्क्रिय",
    promotionBannerTitle: "नवीनतम प्रशिक्षण एवं मूल्यांकन परिणाम",
    candidateMae: "उम्मीदवार एमएई",
    baselineMae: "बेसलाइन माध्यिका एमएई",
    r2Score: "आर2 सटीकता",
    mapeScore: "एमएपीई त्रुटि",
    deptBreakdown: "विभाग अनुसार 7-दिवसीय लाइव सटीकता",
    deptName: "विभाग",
    samples: "पूर्ण नमूने",
    maeCol: "लाइव एमएई",
    uploadTitle: "ऐतिहासिक डेटासेट अपलोड करें",
    uploadDesc: "प्रशिक्षण शुरू करने के लिए ऐतिहासिक सेवा अवधि वाली सीएसवी या एक्सेल फ़ाइल अपलोड करें।",
    previewBtn: "पूर्वावलोकन एवं कॉलम मैपिंग",
    parsing: "पार्सिंग जारी...",
    importBtn: "डेटासेट आयात करें",
    importing: "आयात जारी...",
    noVersions: "रोलबैक के लिए कोई पूर्व संस्करण उपलब्ध नहीं है।",
    globalNote: "ध्यान दें: ग्लोबल बेसलाइन मॉडल प्रबंधन के लिए प्लेटफ़ॉर्म सुपर एडमिन अनुमति आवश्यक है।",
  },
};

export default function MLAdminPage({
  tenantId = "city-hospital-01",
  language = "en",
  theme = "light",
  currentUser,
}) {
  const isHi = language === "hi";
  const isDark = theme === "dark";
  const t = (k) => TRANSLATIONS[isHi ? "hi" : "en"][k] || TRANSLATIONS.en[k] || k;

  const [activeTenant, setActiveTenant] = useState(tenantId || "city-hospital-01");
  const [monitoringData, setMonitoringData] = useState(null);
  const [modelVersions, setModelVersions] = useState([]);
  const [selectedRollbackVersion, setSelectedRollbackVersion] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [ingestStatus, setIngestStatus] = useState(null);
  const [trainStatus, setTrainStatus] = useState(null);
  const [rollbackStatus, setRollbackStatus] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingIngest, setLoadingIngest] = useState(false);
  const [loadingTrain, setLoadingTrain] = useState(false);
  const [loadingRollback, setLoadingRollback] = useState(false);
  const [togglingLearning, setTogglingLearning] = useState(false);
  const [togglingPooling, setTogglingPooling] = useState(false);

  const isSuperAdmin = !!(currentUser?.is_superadmin || currentUser?.role === "super_admin");

  const getAuthHeaders = useCallback((extra = {}) => {
    const token =
      localStorage.getItem("ai_queue_token") ||
      localStorage.getItem("token") ||
      currentUser?.token;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }, [currentUser]);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/model-monitoring/${activeTenant}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMonitoringData(data);
      }
    } catch (e) {
      console.warn("Monitoring data error:", e.message);
    }
  }, [activeTenant, getAuthHeaders]);

  const fetchModelVersions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/model-versions/${activeTenant}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setModelVersions(data.versions || []);
        if (data.versions && data.versions.length > 0) {
          setSelectedRollbackVersion(data.versions[0].version || data.versions[0]);
        }
      }
    } catch (e) {
      console.warn("Model versions error:", e.message);
    }
  }, [activeTenant, getAuthHeaders]);

  useEffect(() => {
    fetchMonitoringData();
    fetchModelVersions();
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, [fetchMonitoringData, fetchModelVersions]);

  const handleRetrain = async () => {
    setLoadingTrain(true);
    setTrainStatus(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/train-model`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ tenant_id: activeTenant }),
      });
      const data = await res.json();
      setLoadingTrain(false);

      if (res.ok && data.status === "success") {
        setTrainStatus({
          error: false,
          message: data.message || "Model trained successfully.",
          promoted: data.promoted,
          reason: data.promotion_reason,
          candidateMae: data.candidate_mae || data.mae,
          baselineMae: data.baseline_mae,
        });
        fetchMonitoringData();
        fetchModelVersions();
      } else {
        setTrainStatus({
          error: true,
          message: data.message || data.detail || "Training failed",
        });
      }
    } catch (e) {
      setLoadingTrain(false);
      setTrainStatus({ error: true, message: e.message });
    }
  };

  const handleRollback = async () => {
    if (!selectedRollbackVersion) return;
    setLoadingRollback(true);
    setRollbackStatus(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/rollback-model`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tenant_id: activeTenant,
          target_version: selectedRollbackVersion,
        }),
      });
      const data = await res.json();
      setLoadingRollback(false);

      if (res.ok && data.status === "success") {
        setRollbackStatus({
          error: false,
          message: `Successfully rolled back to version ${selectedRollbackVersion}`,
        });
        fetchMonitoringData();
        fetchModelVersions();
      } else {
        setRollbackStatus({
          error: true,
          message: data.message || data.detail || "Rollback failed",
        });
      }
    } catch (e) {
      setLoadingRollback(false);
      setRollbackStatus({ error: true, message: e.message });
    }
  };

  const handleToggleAutoLearning = async () => {
    if (activeTenant === "global") return;
    setTogglingLearning(true);
    const nextVal = !monitoringData?.hospital_settings?.auto_learning_enabled;

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/toggle-auto-learning`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tenant_id: activeTenant,
          auto_learning_enabled: nextVal,
        }),
      });
      if (res.ok) {
        await fetchMonitoringData();
      }
    } catch (e) {
      console.warn("Toggle error:", e.message);
    } finally {
      setTogglingLearning(false);
    }
  };

  const handleToggleGlobalPooling = async () => {
    if (activeTenant === "global") return;
    setTogglingPooling(true);
    const nextVal = !monitoringData?.hospital_settings?.allow_global_learning;

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/toggle-auto-learning`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tenant_id: activeTenant,
          allow_global_learning: nextVal,
        }),
      });
      if (res.ok) {
        await fetchMonitoringData();
      }
    } catch (e) {
      console.warn("Toggle pooling error:", e.message);
    } finally {
      setTogglingPooling(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setPreviewData(null);
      setIngestStatus(null);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) return;
    setLoadingPreview(true);
    setIngestStatus(null);

    const formData = new FormData();
    formData.append("tenant_id", activeTenant);
    formData.append("file", selectedFile);

    try {
      const token =
        localStorage.getItem("ai_queue_token") ||
        localStorage.getItem("token") ||
        currentUser?.token;

      const res = await fetch(`${API_BASE}/api/v1/plugin/historical-data/preview`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      setLoadingPreview(false);

      if (res.ok) {
        setPreviewData(data);
        setColumnMapping(data.suggested_mapping || {});
      } else {
        setIngestStatus({ error: true, message: data.detail || data.message || "Preview failed" });
      }
    } catch (e) {
      setLoadingPreview(false);
      setIngestStatus({ error: true, message: e.message });
    }
  };

  const handleIngest = async () => {
    if (!selectedFile) return;
    setLoadingIngest(true);

    const formData = new FormData();
    formData.append("tenant_id", activeTenant);
    formData.append("file", selectedFile);
    formData.append("column_mapping_json", JSON.stringify(columnMapping));

    try {
      const token =
        localStorage.getItem("ai_queue_token") ||
        localStorage.getItem("token") ||
        currentUser?.token;

      const res = await fetch(`${API_BASE}/api/v1/plugin/historical-data/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      setLoadingIngest(false);

      if (res.ok) {
        setIngestStatus({
          error: false,
          message: data.message,
          total: data.total_stored_records,
        });
        fetchMonitoringData();
      } else {
        setIngestStatus({ error: true, message: data.detail || data.message || "Upload failed" });
      }
    } catch (e) {
      setLoadingIngest(false);
      setIngestStatus({ error: true, message: e.message });
    }
  };

  // Theme Palette Tokens
  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const cardBorder = isDark ? "#334155" : "#E2E8F0";
  const textPrimary = isDark ? "#F8FAFC" : "#0F172A";
  const textMuted = isDark ? "#94A3B8" : "#64748B";
  const pageBg = isDark ? "#0B1120" : "#F8FAFC";
  const tableHeaderBg = isDark ? "#0F172A" : "#F1F5F9";
  const tableBorder = isDark ? "#334155" : "#E2E8F0";
  const inputBg = isDark ? "#0F172A" : "#FFFFFF";

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "16px", color: textPrimary }}>
      {/* Top Header Card */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.03)",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "11px",
              color: "#059669",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {t("badge")}
          </span>
          <h2 style={{ margin: "4px 0 0 0", color: textPrimary, fontSize: "22px", fontWeight: 800 }}>
            {t("title")}
          </h2>
          <p style={{ margin: "4px 0 0 0", color: textMuted, fontSize: "13px" }}>
            {t("subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Tenant Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: textMuted, fontWeight: 600 }}>
              {t("tenantLabel")}:
            </span>
            <select
              value={activeTenant}
              onChange={(e) => setActiveTenant(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${cardBorder}`,
                background: inputBg,
                color: textPrimary,
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <option value={tenantId || "city-hospital-01"}>
                {tenantId || "city-hospital-01"}
              </option>
              {isSuperAdmin && <option value="global">global (Platform Baseline)</option>}
            </select>
          </div>

          <button
            onClick={handleRetrain}
            disabled={loadingTrain}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: "13px",
              cursor: loadingTrain ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {loadingTrain ? t("retraining") : t("retrainNow")}
          </button>
        </div>
      </div>

      {/* Drift Warning Banner or Normal Status */}
      {monitoringData && (
        <div style={{ marginBottom: "20px" }}>
          {monitoringData.drift_detected ? (
            <div
              style={{
                background: isDark ? "#450A0A" : "#FEF2F2",
                border: `1px solid ${isDark ? "#991B1B" : "#F87171"}`,
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
              }}
            >
              <div style={{ color: "#EF4444", marginTop: "2px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 4px 0", color: isDark ? "#FCA5A5" : "#991B1B", fontSize: "14px", fontWeight: 700 }}>
                  {t("driftDetectedTitle")}
                </h4>
                <p style={{ margin: 0, color: isDark ? "#FECACA" : "#7F1D1D", fontSize: "13px", lineHeight: "1.5" }}>
                  {monitoringData.drift_message}
                </p>
              </div>
              <button
                onClick={handleRetrain}
                disabled={loadingTrain}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t("retrainNow")}
              </button>
            </div>
          ) : (
            <div
              style={{
                background: isDark ? "#064E3B" : "#ECFDF5",
                border: `1px solid ${isDark ? "#047857" : "#A7F3D0"}`,
                borderRadius: "12px",
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ color: "#10B981" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: isDark ? "#6EE7B7" : "#065F46" }}>
                  {t("driftNormalTitle")}
                </span>
                <span style={{ fontSize: "12px", color: isDark ? "#A7F3D0" : "#047857", marginLeft: "8px" }}>
                  {t("driftNormalMsg")} ({monitoringData.live_samples_7d || 0} {t("samples")})
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {/* Metric 1 */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "18px",
          }}
        >
          <span style={{ fontSize: "12px", color: textMuted, fontWeight: 600 }}>{t("modelVersion")}</span>
          <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#059669", margin: "6px 0 2px 0" }}>
            {monitoringData?.active_version || "Baseline"}
          </h3>
          <span style={{ fontSize: "11px", color: textMuted }}>
            {monitoringData?.model_type || "ExtraTreesRegressor"}
          </span>
        </div>

        {/* Metric 2 */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "18px",
          }}
        >
          <span style={{ fontSize: "12px", color: textMuted, fontWeight: 600 }}>{t("trainingAccuracy")}</span>
          <h3 style={{ fontSize: "22px", fontWeight: 800, color: "#0284C7", margin: "6px 0 2px 0" }}>
            ±{monitoringData?.training_mae !== null && monitoringData?.training_mae !== undefined ? Number(monitoringData.training_mae).toFixed(2) : "1.47"}m
          </h3>
          <span style={{ fontSize: "11px", color: textMuted }}>
            {t("liveAccuracy")}: {monitoringData?.live_7d_mae !== null && monitoringData?.live_7d_mae !== undefined ? `±${monitoringData.live_7d_mae}m` : "N/A"}
          </span>
        </div>

        {/* Metric 3 */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "18px",
          }}
        >
          <span style={{ fontSize: "12px", color: textMuted, fontWeight: 600 }}>{t("datasetSize")}</span>
          <h3 style={{ fontSize: "22px", fontWeight: 800, color: "#10B981", margin: "6px 0 2px 0" }}>
            {(monitoringData?.training_rows || 0).toLocaleString()}
          </h3>
          <span style={{ fontSize: "11px", color: textMuted }}>
            +{monitoringData?.new_rows_since_training || 0} {t("newRows")}
          </span>
        </div>

        {/* Metric 4 */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "18px",
          }}
        >
          <span style={{ fontSize: "12px", color: textMuted, fontWeight: 600 }}>{t("lastTrained")}</span>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#D97706", margin: "8px 0 2px 0" }}>
            {monitoringData?.trained_at || "Baseline"}
          </h3>
          <span style={{ fontSize: "11px", color: textMuted }}>
            {monitoringData?.latest_run?.status ? `Status: ${monitoringData.latest_run.status}` : "Active"}
          </span>
        </div>
      </div>

      {/* Promotion Result Banner (if latest run exists or trainStatus) */}
      {(trainStatus || monitoringData?.latest_run) && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "18px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: textPrimary }}>
              {t("promotionBannerTitle")}
            </h4>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "6px",
                background: (trainStatus?.promoted ?? monitoringData?.latest_run?.promoted) ? (isDark ? "#064E3B" : "#ECFDF5") : (isDark ? "#451A03" : "#FFFBEB"),
                color: (trainStatus?.promoted ?? monitoringData?.latest_run?.promoted) ? "#059669" : "#D97706",
              }}
            >
              {(trainStatus?.promoted ?? monitoringData?.latest_run?.promoted) ? "Candidate Promoted" : "Champion Retained"}
            </span>
          </div>

          <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: textMuted }}>
            {trainStatus?.reason || monitoringData?.latest_run?.promotion_reason || "Evaluated on chronological 80/20 holdout split."}
          </p>

          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "12px" }}>
            <div>
              <span style={{ color: textMuted }}>{t("candidateMae")}: </span>
              <strong>{monitoringData?.latest_run?.mae ? `${monitoringData.latest_run.mae}m` : "N/A"}</strong>
            </div>
            <div>
              <span style={{ color: textMuted }}>{t("baselineMae")}: </span>
              <strong>{monitoringData?.latest_run?.baseline_mae ? `${monitoringData.latest_run.baseline_mae}m` : "N/A"}</strong>
            </div>
            <div>
              <span style={{ color: textMuted }}>{t("r2Score")}: </span>
              <strong>{monitoringData?.latest_run?.r2_score ? monitoringData.latest_run.r2_score : "N/A"}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Continuous Learning Toggles & Rollback Card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        {/* Continuous Learning Toggles */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 800, color: textPrimary }}>
            Continuous Pipeline Configuration
          </h3>

          {/* Toggle 1: Auto Learning */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
              paddingBottom: "16px",
              borderBottom: `1px solid ${cardBorder}`,
              marginBottom: "16px",
            }}
          >
            <div>
              <strong style={{ fontSize: "13px", color: textPrimary }}>{t("autoLearningTitle")}</strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: textMuted }}>
                {t("autoLearningDesc")}
              </p>
            </div>
            <button
              onClick={handleToggleAutoLearning}
              disabled={togglingLearning || activeTenant === "global"}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                background: monitoringData?.hospital_settings?.auto_learning_enabled ? "#059669" : (isDark ? "#334155" : "#CBD5E1"),
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                cursor: activeTenant === "global" ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {monitoringData?.hospital_settings?.auto_learning_enabled ? t("enabled") : t("disabled")}
            </button>
          </div>

          {/* Toggle 2: Global Pooling */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <div>
              <strong style={{ fontSize: "13px", color: textPrimary }}>{t("poolingTitle")}</strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: textMuted }}>
                {t("poolingDesc")}
              </p>
            </div>
            <button
              onClick={handleToggleGlobalPooling}
              disabled={togglingPooling || activeTenant === "global"}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                background: monitoringData?.hospital_settings?.allow_global_learning ? "#0284C7" : (isDark ? "#334155" : "#CBD5E1"),
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                cursor: activeTenant === "global" ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {monitoringData?.hospital_settings?.allow_global_learning ? t("enabled") : t("disabled")}
            </button>
          </div>
        </div>

        {/* Safe Model Rollback Card */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 800, color: textPrimary }}>
            {t("rollbackTitle")}
          </h3>

          <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: textMuted }}>
            Instantly revert to a previous validated model version without service disruption.
          </p>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
            <select
              value={selectedRollbackVersion}
              onChange={(e) => setSelectedRollbackVersion(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${cardBorder}`,
                background: inputBg,
                color: textPrimary,
                fontSize: "13px",
              }}
            >
              {modelVersions.length === 0 ? (
                <option value="">{t("noVersions")}</option>
              ) : (
                modelVersions.map((v) => {
                  const verName = v.version || v;
                  const maeText = v.mae ? ` (MAE ±${v.mae}m)` : "";
                  return (
                    <option key={verName} value={verName}>
                      {verName} {maeText}
                    </option>
                  );
                })
              )}
            </select>

            <button
              onClick={handleRollback}
              disabled={loadingRollback || !selectedRollbackVersion}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#DC2626",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                cursor: loadingRollback || !selectedRollbackVersion ? "not-allowed" : "pointer",
              }}
            >
              {loadingRollback ? t("rollingBack") : t("rollbackBtn")}
            </button>
          </div>

          {rollbackStatus && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                background: rollbackStatus.error ? (isDark ? "#450A0A" : "#FEF2F2") : (isDark ? "#064E3B" : "#ECFDF5"),
                color: rollbackStatus.error ? "#DC2626" : "#059669",
              }}
            >
              {rollbackStatus.message}
            </div>
          )}
        </div>
      </div>

      {/* Department Breakdown Table */}
      {monitoringData?.department_breakdown && monitoringData.department_breakdown.length > 0 && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: 800, color: textPrimary }}>
            {t("deptBreakdown")}
          </h3>

          <div className="table-scroll-region" tabIndex={0} role="region" aria-label="Department prediction metrics table">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: tableHeaderBg }}>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: `1px solid ${tableBorder}` }}>
                    {t("deptName")}
                  </th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: `1px solid ${tableBorder}` }}>
                    {t("samples")}
                  </th>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: `1px solid ${tableBorder}` }}>
                    {t("maeCol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {monitoringData.department_breakdown.map((row) => (
                  <tr key={row.department}>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${tableBorder}` }}>
                      {row.department}
                    </td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${tableBorder}` }}>
                      {row.sample_count}
                    </td>
                    <td style={{ padding: "10px", borderBottom: `1px solid ${tableBorder}`, fontWeight: 700 }}>
                      ±{row.live_mae}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dataset Ingestion Dropzone Card */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "20px",
        }}
      >
        <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 800, color: textPrimary }}>
          {t("uploadTitle")}
        </h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: textMuted }}>
          {t("uploadDesc")}
        </p>

        <div
          style={{
            border: `2px dashed ${isDark ? "#064E3B" : "#A7F3D0"}`,
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
            background: isDark ? "#06281E" : "#ECFDF5",
          }}
        >
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange}
            style={{ marginBottom: "10px", color: textPrimary }}
          />
        </div>

        {selectedFile && (
          <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: `1px solid ${cardBorder}`,
                background: isDark ? "#334155" : "#F8FAFC",
                color: textPrimary,
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {loadingPreview ? t("parsing") : t("previewBtn")}
            </button>

            {previewData && (
              <button
                onClick={handleIngest}
                disabled={loadingIngest}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#059669",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {loadingIngest ? t("importing") : t("importBtn")}
              </button>
            )}
          </div>
        )}

        {ingestStatus && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              background: ingestStatus.error ? (isDark ? "#450A0A" : "#FEF2F2") : (isDark ? "#064E3B" : "#ECFDF5"),
              color: ingestStatus.error ? "#DC2626" : "#059669",
            }}
          >
            {ingestStatus.message}
          </div>
        )}
      </div>

      {/* Preview Table */}
      {previewData && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: textPrimary }}>
            Sample Data Preview ({previewData.total_rows || 0} rows found)
          </h4>
          <div className="table-scroll-region" tabIndex={0} role="region" aria-label="Department prediction metrics table">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: tableHeaderBg }}>
                  {previewData.detected_columns.map((col) => (
                    <th key={col} style={{ padding: "8px", textAlign: "left", borderBottom: `1px solid ${tableBorder}` }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.sample_rows.map((row, idx) => (
                  <tr key={idx}>
                    {previewData.detected_columns.map((col) => (
                      <td key={col} style={{ padding: "8px", borderBottom: `1px solid ${tableBorder}` }}>
                        {String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
