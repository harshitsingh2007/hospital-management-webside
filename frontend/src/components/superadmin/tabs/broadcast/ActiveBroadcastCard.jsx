import React from "react";

export default function ActiveBroadcastCard({
  broadcast,
  hospitals = [],
  onExtend,
  onDismiss,
  onDuplicate,
  isActionLoading = false,
  isHi = false,
}) {
  if (!broadcast) return null;

  const isCrit = broadcast.type === "code_blue" || broadcast.type === "code_red";
  const typeColor =
    broadcast.type === "code_blue"
      ? "#1E3A8A"
      : broadcast.type === "code_red"
      ? "#881337"
      : broadcast.type === "notice"
      ? "#D97706"
      : "#059669";

  const targetName =
    broadcast.hospital_code === "all"
      ? (isHi ? "🚨 नेटवर्क-व्यापी: सभी अस्पताल" : "🚨 Network-Wide (All Hospitals)")
      : hospitals.find((h) => (h.hospital_code || h.code) === broadcast.hospital_code)?.name ||
        broadcast.hospital_name ||
        broadcast.hospital_code;

  let remainingLabel = isHi ? "मैन्युअल बंद करने तक" : "Manual dismiss";
  if (broadcast.expires_at) {
    const diffMs = new Date(broadcast.expires_at) - new Date();
    const diffMin = Math.max(0, Math.round(diffMs / 60000));
    remainingLabel = isHi ? `${diffMin} मिनट शेष` : `${diffMin}m remaining`;
  }

  const surfaces = broadcast.target_surfaces || {};
  const surfaceBadges = [];
  if (surfaces.patient_portal) surfaceBadges.push(isHi ? "मरीज पोर्टल" : "Patient Portal");
  if (surfaces.doctor_desk) surfaceBadges.push(isHi ? "डॉक्टर कंसोल" : "Doctor Desk");
  if (surfaces.staff_desk) surfaceBadges.push(isHi ? "स्टाफ डेस्क" : "Staff Desk");
  if (surfaces.kiosk_display) surfaceBadges.push(isHi ? "कियोस्क व टीवी" : "Kiosks & TVs");

  return (
    <div
      style={{
        borderRadius: "12px",
        background: "var(--card-bg, #ffffff)",
        border: `1.5px solid ${isCrit ? typeColor : "var(--border-color, #e2e8f0)"}`,
        borderLeft: `6px solid ${typeColor}`,
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "all 0.15s ease",
      }}
    >
      {/* Header Row: Type, Target, Countdown */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: "5px",
              background: typeColor,
              color: "#ffffff",
              letterSpacing: "0.03em",
            }}
          >
            {broadcast.type.replace("_", " ")}
          </span>

          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: broadcast.hospital_code === "all" ? "#DC2626" : "var(--text-primary, #1e293b)",
            }}
          >
            {targetName}
          </span>
        </div>

        {/* Live Countdown Pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "3px 10px",
            borderRadius: "6px",
            background: "var(--bg-subtle, #f1f5f9)",
            border: "1px solid var(--border-color, #cbd5e1)",
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--text-secondary, #475569)",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {remainingLabel}
        </div>
      </div>

      {/* Title & Message */}
      <div>
        <h4
          style={{
            margin: "0 0 4px 0",
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--text-primary, #0f172a)",
            lineHeight: 1.3,
          }}
        >
          {broadcast.title}
        </h4>
        {broadcast.message && (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--text-secondary, #475569)",
              lineHeight: 1.45,
            }}
          >
            {broadcast.message}
          </p>
        )}
      </div>

      {/* Target Surfaces & Delivery Stats */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
          paddingTop: "8px",
          borderTop: "1px solid var(--border-color, #f1f5f9)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
            {isHi ? "सतहें: " : "Surfaces: "}
          </span>
          {surfaceBadges.map((badge, i) => (
            <span
              key={i}
              style={{
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "4px",
                background: "var(--bg-subtle, #f1f5f9)",
                color: "var(--text-secondary, #475569)",
                border: "1px solid var(--border-color, #e2e8f0)",
              }}
            >
              {badge}
            </span>
          ))}
        </div>

        <div style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
          {isHi ? "डिलीवर: " : "Delivered: "}
          <strong style={{ color: "#2563EB" }}>{broadcast.delivered_count ?? 0} screens</strong>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "8px",
          paddingTop: "8px",
          borderTop: "1px solid var(--border-color, #f1f5f9)",
        }}
      >
        <button
          type="button"
          onClick={() => onDuplicate(broadcast)}
          disabled={isActionLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 12px",
            borderRadius: "6px",
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border-color, #cbd5e1)",
            color: "var(--text-secondary, #475569)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {isHi ? "कॉपी" : "Copy to Composer"}
        </button>

        <button
          type="button"
          onClick={() => onExtend(broadcast.id)}
          disabled={isActionLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 12px",
            borderRadius: "6px",
            background: "rgba(37, 99, 235, 0.08)",
            border: "1px solid rgba(37, 99, 235, 0.25)",
            color: "#1D4ED8",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {isHi ? "+15 मि. बढ़ाएं" : "Extend +15m"}
        </button>

        <button
          type="button"
          onClick={() => onDismiss(broadcast.id)}
          disabled={isActionLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 12px",
            borderRadius: "6px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#DC2626",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          {isHi ? "अलर्ट बंद करें" : "Dismiss Now"}
        </button>
      </div>
    </div>
  );
}

