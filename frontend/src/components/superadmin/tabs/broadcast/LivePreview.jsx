import React, { useState } from "react";
import EmergencyBroadcastBanner from "../../../common/EmergencyBroadcastBanner";

export default function LivePreview({
  formValues = {},
  hospitals = [],
  activeBroadcasts = [],
  onExtend = () => {},
  onDismiss = () => {},
  onDuplicate = () => {},
  isHi = false,
}) {
  const [previewSurface, setPreviewSurface] = useState("patient_portal");

  const surfaceTabs = [
    { id: "patient_portal", label: isHi ? "मरीज पोर्टल" : "Patient App" },
    { id: "doctor_desk", label: isHi ? "डॉक्टर कंसोल" : "Doctor Desk" },
    { id: "kiosk_display", label: isHi ? "वेटिंग टीवी" : "Waiting TV" },
  ];

  const targetHospitalName =
    formValues.hospital_code === "all"
      ? (isHi ? "सभी अस्पताल" : "All Facilities")
      : hospitals.find((h) => (h.hospital_code || h.code) === formValues.hospital_code)?.name ||
        formValues.hospital_code ||
        "—";

  // Mock broadcast object for EmergencyBroadcastBanner preview
  const previewBroadcast = {
    id: "preview_simulation_broadcast",
    title: formValues.title || (isHi ? "अलर्ट का शीर्षक यहां दिखेगा" : "Alert headline will appear here..."),
    message:
      formValues.message ||
      (isHi
        ? "विस्तृत निर्देश एवं अलर्ट विवरण इस तरह स्क्रीन पर प्रदर्शित होंगे।"
        : "Detailed operational directive or emergency message will stream across screens like this."),
    type: formValues.type || "notice",
    severity:
      formValues.type === "code_blue" || formValues.type === "code_red"
        ? "critical"
        : formValues.type === "notice"
        ? "warning"
        : "info",
    hospital_code: formValues.hospital_code || "all",
    hospital_name: targetHospitalName,
    target_surfaces: formValues.surfaces || {
      patient_portal: true,
      doctor_desk: true,
      staff_desk: true,
      kiosk_display: true,
    },
    sound: false, // don't sound chime during live typing preview
    is_active: true,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Live Preview Monitor Chrome */}
      <div
        style={{
          borderRadius: "14px",
          background: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border-color, #e2e8f0)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
        }}
      >
        {/* Terminal Title Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "var(--bg-subtle, #f1f5f9)",
            borderBottom: "1px solid var(--border-color, #cbd5e1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#EF4444" }} />
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#F59E0B" }} />
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#10B981" }} />
            <span
              style={{
                marginLeft: "6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--text-secondary, #475569)",
                letterSpacing: "0.02em",
              }}
            >
              {isHi ? "लाइव स्क्रीन सिमुलेटर" : "Live Screen Simulator"}
            </span>
          </div>

          {/* Surface Preview Tabs */}
          <div style={{ display: "flex", gap: "4px" }}>
            {surfaceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPreviewSurface(tab.id)}
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: "none",
                  background: previewSurface === tab.id ? "var(--accent-color, #2563EB)" : "transparent",
                  color: previewSurface === tab.id ? "#ffffff" : "var(--text-secondary, #64748b)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Simulator Viewport Body */}
        <div
          style={{
            padding: "14px",
            minHeight: "140px",
            background: "var(--bg-card, #ffffff)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "100%" }}>
            <EmergencyBroadcastBanner
              broadcasts={[previewBroadcast]}
              currentHospitalCode={formValues.hospital_code || "all"}
              surface={previewSurface}
              language={isHi ? "hi" : "en"}
              isStaffOrAdmin={false}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "var(--text-secondary, #94a3b8)",
              paddingTop: "6px",
            }}
          >
            <span>
              {isHi ? "टारगेट सतह: " : "Surface: "}
              <strong style={{ color: "var(--text-secondary, #475569)" }}>
                {surfaceTabs.find((s) => s.id === previewSurface)?.label}
              </strong>
            </span>
            <span>
              {isHi ? "दायरा: " : "Scope: "}
              <strong style={{ color: formValues.hospital_code === "all" ? "#DC2626" : "var(--text-secondary, #475569)" }}>
                {targetHospitalName}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Currently Active Broadcasts Compact List */}
      <div
        style={{
          borderRadius: "14px",
          background: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border-color, #e2e8f0)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
          padding: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: activeBroadcasts.length > 0 ? "#10B981" : "#94a3b8",
              }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-primary, #0f172a)",
              }}
            >
              {isHi ? "वर्तमान में सक्रिय प्रसारण" : "Currently Active Broadcasts"} ({activeBroadcasts.length})
            </h3>
          </div>
        </div>

        {activeBroadcasts.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              background: "var(--bg-subtle, #f8fafc)",
              borderRadius: "10px",
              border: "1px dashed var(--border-color, #cbd5e1)",
              color: "var(--text-secondary, #64748b)",
              fontSize: "13px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 6px", display: "block", opacity: 0.5 }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            {isHi
              ? "वर्तमान में कोई आपातकालीन प्रसारण सक्रिय नहीं है। सभी स्क्रीन सामान्य हैं।"
              : "No active broadcasts on the network. All terminal screens are normal."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "360px", overflowY: "auto" }}>
            {activeBroadcasts.map((b) => {
              const isCrit = b.type === "code_blue" || b.type === "code_red";
              const typeColor =
                b.type === "code_blue"
                  ? "#1E3A8A"
                  : b.type === "code_red"
                  ? "#881337"
                  : b.type === "notice"
                  ? "#D97706"
                  : "#059669";

              // Remaining minutes calculation
              let remainingLabel = isHi ? "मैन्युअल" : "Manual dismiss";
              if (b.expires_at) {
                const diffMs = new Date(b.expires_at) - new Date();
                const diffMin = Math.max(0, Math.round(diffMs / 60000));
                remainingLabel = isHi ? `${diffMin} मि. शेष` : `${diffMin}m left`;
              }

              return (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "var(--card-bg, #ffffff)",
                    border: `1.5px solid ${isCrit ? typeColor : "var(--border-color, #e2e8f0)"}`,
                    borderLeft: `5px solid ${typeColor}`,
                    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "2px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: typeColor,
                            color: "#ffffff",
                          }}
                        >
                          {b.type.replace("_", " ")}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: b.hospital_code === "all" ? "#DC2626" : "var(--text-secondary, #475569)",
                          }}
                        >
                          {b.hospital_code === "all" ? (isHi ? "सभी अस्पताल" : "All Hospitals") : b.hospital_name || b.hospital_code}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--text-primary, #0f172a)",
                          lineHeight: 1.3,
                        }}
                      >
                        {b.title}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--text-secondary, #64748b)",
                        whiteSpace: "nowrap",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "var(--bg-subtle, #f1f5f9)",
                      }}
                    >
                      {remainingLabel}
                    </div>
                  </div>

                  {b.message && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary, #64748b)",
                        lineHeight: 1.35,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {b.message}
                    </div>
                  )}

                  {/* Actions & Delivery Stats */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "6px",
                      borderTop: "1px solid var(--border-color, #f1f5f9)",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
                      {isHi ? "स्क्रीन डिलीवरी: " : "Delivered: "}
                      <strong style={{ color: "#2563EB" }}>{b.delivered_count ?? 0} screens</strong>
                    </span>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => onDuplicate(b)}
                        title={isHi ? "फॉर्म में कॉपी करें" : "Duplicate to composer"}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "5px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "var(--bg-subtle, #f1f5f9)",
                          border: "1px solid var(--border-color, #cbd5e1)",
                          color: "var(--text-primary, #334155)",
                          cursor: "pointer",
                        }}
                      >
                        {isHi ? "कॉपी" : "Copy"}
                      </button>

                      <button
                        type="button"
                        onClick={() => onExtend(b.id)}
                        title={isHi ? "+15 मिनट समय बढ़ाएं" : "Extend duration by 15 mins"}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "5px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "rgba(37, 99, 235, 0.08)",
                          border: "1px solid rgba(37, 99, 235, 0.25)",
                          color: "#1D4ED8",
                          cursor: "pointer",
                        }}
                      >
                        +15m
                      </button>

                      <button
                        type="button"
                        onClick={() => onDismiss(b.id)}
                        title={isHi ? "अभी बंद करें" : "Dismiss broadcast immediately"}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "5px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.25)",
                          color: "#DC2626",
                          cursor: "pointer",
                        }}
                      >
                        {isHi ? "बंद करें" : "Dismiss"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

