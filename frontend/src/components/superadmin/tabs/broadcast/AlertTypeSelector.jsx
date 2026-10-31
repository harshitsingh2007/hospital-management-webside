import React from "react";

export default function AlertTypeSelector({ value, onChange, isHi = false }) {
  const alertTypes = [
    {
      id: "code_blue",
      label: isHi ? "कोड ब्लू" : "Code Blue",
      sub: isHi ? "मेडिकल इमरजेंसी / सीपीआर" : "Resuscitation / CPR",
      accent: "#1E3A8A",
      bgActive: "rgba(30, 58, 138, 0.12)",
      borderColor: "#1E3A8A",
      priority: isHi ? "अति-गंभीर" : "Critical",
      pulseColor: "#2563EB",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    {
      id: "code_red",
      label: isHi ? "कोड रेड" : "Code Red",
      sub: isHi ? "आग एवं निकासी अलार्म" : "Fire & Evacuation",
      accent: "#881337",
      bgActive: "rgba(136, 19, 55, 0.12)",
      borderColor: "#881337",
      priority: isHi ? "अति-गंभीर" : "Critical",
      pulseColor: "#E11D48",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      ),
    },
    {
      id: "notice",
      label: isHi ? "प्रणाली सूचना" : "System Notice",
      sub: isHi ? "काउंटर, देरी व रखरखाव" : "Operations & Delays",
      accent: "#D97706",
      bgActive: "rgba(217, 119, 6, 0.12)",
      borderColor: "#D97706",
      priority: isHi ? "मध्यम / उच्च" : "Notice",
      pulseColor: "#F59E0B",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      id: "announcement",
      label: isHi ? "घोषणा" : "Announcement",
      sub: isHi ? "स्वास्थ्य शिविर व सूचना" : "Public Awareness",
      accent: "#059669",
      bgActive: "rgba(5, 150, 105, 0.12)",
      borderColor: "#059669",
      priority: isHi ? "सामान्य" : "Normal",
      pulseColor: "#10B981",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ marginBottom: "16px" }}>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-secondary, #64748b)",
          marginBottom: "8px",
        }}
      >
        {isHi ? "अलर्ट का प्रकार एवं गंभीरता" : "Alert Type & Severity"}
      </label>

      {/* Grid of 4 Segment Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
        }}
      >
        {alertTypes.map((type) => {
          const isSelected = value === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onChange(type.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: "10px",
                border: isSelected ? `2px solid ${type.borderColor}` : "1.5px solid var(--border-color, #e2e8f0)",
                background: isSelected ? type.bgActive : "var(--bg-subtle, #f8fafc)",
                cursor: "pointer",
                textAlign: "left",
                position: "relative",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  marginBottom: "6px",
                  color: isSelected ? type.accent : "var(--text-secondary, #64748b)",
                }}
              >
                <span>{type.icon}</span>

                {/* Priority Indicator Dot */}
                <span
                  title={type.priority}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: type.accent,
                    background: isSelected ? "rgba(255, 255, 255, 0.8)" : "transparent",
                    padding: "2px 6px",
                    borderRadius: "999px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: type.pulseColor,
                      boxShadow: isSelected ? `0 0 6px ${type.pulseColor}` : "none",
                    }}
                  />
                  {type.priority}
                </span>
              </div>

              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: isSelected ? type.accent : "var(--text-primary, #1e293b)",
                  lineHeight: 1.2,
                }}
              >
                {type.label}
              </div>

              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-secondary, #64748b)",
                  marginTop: "2px",
                  lineHeight: 1.2,
                }}
              >
                {type.sub}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

