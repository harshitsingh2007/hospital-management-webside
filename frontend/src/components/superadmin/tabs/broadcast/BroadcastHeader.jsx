import React from "react";

export default function BroadcastHeader({
  stats = { activeCount: 0, connectedScreens: 0, totalHospitals: 0 },
  socketConnected = true,
  onRefresh = () => {},
  isRefreshing = false,
  isHi = false,
}) {
  const connectionStatus = socketConnected ? "live" : "offline";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "16px 20px",
        borderRadius: "14px",
        background: "var(--card-bg, #ffffff)",
        border: "1px solid var(--border-color, #e2e8f0)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        marginBottom: "16px",
      }}
    >
      {/* Title & Connection Status */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
            <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
            <circle cx="12" cy="12" r="2" />
            <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
            <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
          </svg>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "19px",
                fontWeight: 700,
                color: "var(--text-primary, #0f172a)",
                letterSpacing: "-0.01em",
              }}
            >
              {isHi ? "आपातकालीन एवं नेटवर्क प्रसारण केंद्र" : "Broadcast & Emergency Control Center"}
            </h2>

            {/* Socket Live Pill */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background:
                  connectionStatus === "live"
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                color: connectionStatus === "live" ? "#059669" : "#DC2626",
                border: `1px solid ${
                  connectionStatus === "live"
                    ? "rgba(16, 185, 129, 0.3)"
                    : "rgba(239, 68, 68, 0.3)"
                }`,
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: connectionStatus === "live" ? "#10B981" : "#EF4444",
                  boxShadow:
                    connectionStatus === "live"
                      ? "0 0 6px rgba(16, 185, 129, 0.8)"
                      : "0 0 6px rgba(239, 68, 68, 0.8)",
                  animation: connectionStatus === "live" ? "pulse 2s infinite" : "none",
                }}
              />
              {connectionStatus === "live"
                ? (isHi ? "लाइव सॉकेट सक्रिय" : "LIVE SOCKET")
                : (isHi ? "ऑफ़लाइन (पोलिंग)" : "OFFLINE (POLLING)")}
            </span>
          </div>

          <p
            style={{
              margin: "3px 0 0 0",
              fontSize: "12px",
              color: "var(--text-secondary, #64748b)",
            }}
          >
            {isHi
              ? "सभी अस्पतालों के स्क्रीन, कियोस्क, डॉक्टर और रिसेप्शन टर्मिनलों पर रियल-टाइम संदेश भेजें।"
              : "Dispatch instant synchronized alerts across patient apps, kiosks, waiting TVs, and doctor terminals."}
          </p>
        </div>
      </div>

      {/* Stats and Refresh Action */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {/* Active Alerts Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            borderRadius: "10px",
            background: stats.activeCount > 0 ? "rgba(239, 68, 68, 0.08)" : "var(--bg-subtle, #f8fafc)",
            border: stats.activeCount > 0 ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid var(--border-color, #e2e8f0)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stats.activeCount > 0 ? "#DC2626" : "#64748b"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)", lineHeight: 1 }}>
              {isHi ? "सक्रिय अलर्ट" : "Active Alerts"}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: stats.activeCount > 0 ? "#DC2626" : "var(--text-primary, #0f172a)", lineHeight: 1.2 }}>
              {stats.activeCount}
            </div>
          </div>
        </div>

        {/* Connected Screens Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            borderRadius: "10px",
            background: "var(--bg-subtle, #f8fafc)",
            border: "1px solid var(--border-color, #e2e8f0)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)", lineHeight: 1 }}>
              {isHi ? "कनेक्टेड स्क्रीन" : "Live Screens"}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#2563EB", lineHeight: 1.2 }}>
              {stats.connectedScreens}
            </div>
          </div>
        </div>

        {/* Facilities Count Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            borderRadius: "10px",
            background: "var(--bg-subtle, #f8fafc)",
            border: "1px solid var(--border-color, #e2e8f0)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
            <path d="M9 10h6M12 7v6" />
          </svg>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)", lineHeight: 1 }}>
              {isHi ? "अस्पताल नेटवर्क" : "Facilities"}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#059669", lineHeight: 1.2 }}>
              {stats.totalHospitals}
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title={isHi ? "रिफ्रेश करें" : "Refresh Broadcasts"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "var(--bg-subtle, #f1f5f9)",
            border: "1px solid var(--border-color, #cbd5e1)",
            color: "var(--text-primary, #334155)",
            cursor: isRefreshing ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: isRefreshing ? "spin 1s linear infinite" : "none",
            }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

