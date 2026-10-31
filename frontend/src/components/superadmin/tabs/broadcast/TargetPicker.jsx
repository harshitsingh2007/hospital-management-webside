import React from "react";

export default function TargetPicker({
  hospitals = [],
  scopeValue = "",
  onScopeChange,
  surfaces = {
    patient_portal: true,
    doctor_desk: true,
    staff_desk: true,
    kiosk_display: true,
  },
  onSurfaceToggle,
  onSelectAllSurfaces,
  onClearSurfaces,
  isHi = false,
}) {
  const surfaceOptions = [
    {
      id: "patient_portal",
      label: isHi ? "मरीज पोर्टल एवं मोबाइल" : "Patient Portal & App",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      ),
    },
    {
      id: "doctor_desk",
      label: isHi ? "डॉक्टर परामर्श कंसोल" : "Doctor Terminals",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: "staff_desk",
      label: isHi ? "रिसेप्शन एवं बिलिंग डेस्क" : "Reception & Staff Desks",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      id: "kiosk_display",
      label: isHi ? "वेटिंग हॉल टीवी व कियोस्क" : "Kiosks & Waiting TVs",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <polyline points="17 2 12 7 7 2" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Facility Target Selector */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-secondary, #64748b)",
            }}
          >
            {isHi ? "लक्षित अस्पताल / दायरा *" : "Target Facility Scope *"}
          </label>
          {scopeValue === "all" && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#DC2626",
                background: "rgba(239, 68, 68, 0.1)",
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              {isHi ? "नेटवर्क-व्यापी (सभी अस्पताल)" : "All Hospitals (Network-Wide)"}
            </span>
          )}
        </div>

        <select
          value={scopeValue}
          onChange={(e) => onScopeChange(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: "9px",
            border: !scopeValue ? "1.5px solid #EF4444" : "1.5px solid var(--border-color, #cbd5e1)",
            background: "var(--input-bg, #ffffff)",
            color: "var(--text-primary, #0f172a)",
            fontSize: "13px",
            fontWeight: 500,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="" disabled>
            {isHi ? "-- लक्षित अस्पताल चुनें (अनिवार्य) --" : "-- Select Target Facility (Required) --"}
          </option>
          <option value="all" style={{ fontWeight: 700, color: "#DC2626" }}>
            {isHi ? "🚨 नेटवर्क-व्यापी: सभी अस्पताल एवं स्क्रीन (ALL HOSPITALS)" : "🚨 Network-Wide: Broadcast to All Hospitals & Facilities"}
          </option>
          {hospitals.map((h) => (
            <option key={h.hospital_code || h.code} value={h.hospital_code || h.code}>
              {h.name} ({h.hospital_code || h.code})
            </option>
          ))}
        </select>
        {!scopeValue && (
          <div style={{ fontSize: "11px", color: "#EF4444", marginTop: "4px" }}>
            {isHi ? "कृपया प्रसारण शुरू करने से पहले एक अस्पताल या 'सभी अस्पताल' चुनें।" : "Please explicitly select a hospital or 'Network-Wide' to continue."}
          </div>
        )}
      </div>

      {/* Target Surfaces Section */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <label
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-secondary, #64748b)",
            }}
          >
            {isHi ? "डिलीवरी स्क्रीन व माध्यम" : "Target Surfaces & Endpoints"}
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={onSelectAllSurfaces}
              style={{
                background: "none",
                border: "none",
                padding: "2px 6px",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--accent-color, #2563EB)",
                cursor: "pointer",
              }}
            >
              {isHi ? "सभी चुनें" : "Select all"}
            </button>
            <span style={{ color: "var(--border-color, #cbd5e1)" }}>|</span>
            <button
              type="button"
              onClick={onClearSurfaces}
              style={{
                background: "none",
                border: "none",
                padding: "2px 6px",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-secondary, #64748b)",
                cursor: "pointer",
              }}
            >
              {isHi ? "साफ़ करें" : "Clear"}
            </button>
          </div>
        </div>

        {/* Chips for surfaces */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "8px",
          }}
        >
          {surfaceOptions.map((opt) => {
            const isChecked = !!surfaces[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSurfaceToggle(opt.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: isChecked ? "1.5px solid #2563EB" : "1.5px solid var(--border-color, #e2e8f0)",
                  background: isChecked ? "rgba(37, 99, 235, 0.08)" : "var(--bg-subtle, #f8fafc)",
                  color: isChecked ? "#1D4ED8" : "var(--text-secondary, #64748b)",
                  fontSize: "12px",
                  fontWeight: isChecked ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "16px",
                    height: "16px",
                    borderRadius: "4px",
                    border: isChecked ? "1.5px solid #2563EB" : "1.5px solid #94a3b8",
                    background: isChecked ? "#2563EB" : "transparent",
                    color: "#ffffff",
                    flexShrink: 0,
                  }}
                >
                  {isChecked && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center" }}>{opt.icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

