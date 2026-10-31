import React, { useState, useEffect, useRef } from "react";

export default function DispatchConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  formValues = {},
  hospitals = [],
  isSubmitting = false,
  isHi = false,
}) {
  const [typeToSend, setTypeToSend] = useState("");
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef(null);

  const isCritical =
    formValues.type === "code_blue" ||
    formValues.type === "code_red" ||
    formValues.hospital_code === "all";

  // Reset verification inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setTypeToSend("");
      setHoldProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetName =
    formValues.hospital_code === "all"
      ? (isHi ? "🚨 नेटवर्क-व्यापी: सभी अस्पताल एवं स्क्रीन" : "🚨 NETWORK-WIDE: ALL HOSPITALS & SCREENS")
      : hospitals.find((h) => (h.hospital_code || h.code) === formValues.hospital_code)?.name ||
        formValues.hospital_code ||
        "—";

  const surfaceNames = [];
  if (formValues.surfaces?.patient_portal) surfaceNames.push(isHi ? "मरीज पोर्टल" : "Patient Portal");
  if (formValues.surfaces?.doctor_desk) surfaceNames.push(isHi ? "डॉक्टर कंसोल" : "Doctor Desk");
  if (formValues.surfaces?.staff_desk) surfaceNames.push(isHi ? "स्टाफ डेस्क" : "Staff Desk");
  if (formValues.surfaces?.kiosk_display) surfaceNames.push(isHi ? "कियोस्क व टीवी" : "Kiosks & TVs");

  const durationText =
    formValues.duration === "0"
      ? (isHi ? "मैन्युअल बंद करने तक" : "Until Manually Dismissed")
      : (isHi ? `${formValues.duration} मिनट` : `${formValues.duration} minutes`);

  const canConfirm = !isCritical || typeToSend.trim().toUpperCase() === "SEND" || holdProgress >= 100;

  // Press-and-hold handlers
  const handleHoldStart = () => {
    if (isSubmitting || canConfirm) return;
    holdIntervalRef.current = setInterval(() => {
      setHoldProgress((prev) => {
        if (prev >= 100) {
          clearInterval(holdIntervalRef.current);
          return 100;
        }
        return prev + 5; // reaches 100% in ~1.5s (20 ticks of 75ms)
      });
    }, 75);
  };

  const handleHoldEnd = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdProgress < 100) {
      setHoldProgress(0);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "540px",
          borderRadius: "16px",
          background: "var(--card-bg, #ffffff)",
          border: isCritical ? "2px solid #DC2626" : "1px solid var(--border-color, #cbd5e1)",
          boxShadow: isCritical
            ? "0 20px 45px rgba(220, 38, 38, 0.35)"
            : "0 20px 35px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
          animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            background: isCritical
              ? "linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)"
              : "var(--bg-subtle, #f8fafc)",
            color: isCritical ? "#ffffff" : "var(--text-primary, #0f172a)",
            borderBottom: isCritical ? "none" : "1px solid var(--border-color, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: isCritical ? "rgba(255, 255, 255, 0.2)" : "rgba(37, 99, 235, 0.12)",
                color: isCritical ? "#ffffff" : "#2563EB",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                {isCritical
                  ? (isHi ? "पुष्टि आवश्यक: आपातकालीन प्रसारण प्रेषण" : "CRITICAL BROADCAST CONFIRMATION")
                  : (isHi ? "प्रसारण प्रेषण की पुष्टि करें" : "Confirm Broadcast Dispatch")}
              </h3>
              <div style={{ fontSize: "11px", opacity: 0.85, marginTop: "2px" }}>
                {isCritical
                  ? (isHi ? "यह अलर्ट तुरंत कनेक्टेड सभी स्क्रीनों पर फ्लैश होगा।" : "This alert will instantly interrupt live screens.")
                  : (isHi ? "कृपया प्रेषण से पूर्व विवरण जांचें।" : "Please review broadcast parameters before dispatching.")}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: "none",
              border: "none",
              color: isCritical ? "#ffffff" : "var(--text-secondary, #64748b)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body: Summary Cards */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "65vh", overflowY: "auto" }}>
          {/* Target Scope Alert Banner */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: formValues.hospital_code === "all" ? "rgba(220, 38, 38, 0.08)" : "var(--bg-subtle, #f1f5f9)",
              border: formValues.hospital_code === "all" ? "1.5px solid rgba(220, 38, 38, 0.3)" : "1px solid var(--border-color, #e2e8f0)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #64748b)", textTransform: "uppercase" }}>
              {isHi ? "लक्षित दायरा" : "Target Facility"}
            </div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: formValues.hospital_code === "all" ? "#DC2626" : "var(--text-primary, #0f172a)",
                marginTop: "2px",
              }}
            >
              {targetName}
            </div>
          </div>

          {/* Headline & Message Preview */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "var(--bg-subtle, #f8fafc)",
              border: "1px solid var(--border-color, #e2e8f0)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary, #64748b)", textTransform: "uppercase" }}>
              {isHi ? "शीर्षक एवं संदेश" : "Headline & Directive"}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
              {formValues.title}
            </div>
            {formValues.message && (
              <div style={{ fontSize: "12px", color: "var(--text-secondary, #475569)", marginTop: "6px", lineHeight: 1.4 }}>
                {formValues.message}
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "8px 12px", borderRadius: "8px", background: "var(--bg-subtle, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary, #64748b)", textTransform: "uppercase" }}>
                {isHi ? "प्रकार एवं अवधि" : "Type & Duration"}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary, #0f172a)", marginTop: "2px" }}>
                {formValues.type?.replace("_", " ").toUpperCase()} • {durationText}
              </div>
            </div>

            <div style={{ padding: "8px 12px", borderRadius: "8px", background: "var(--bg-subtle, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary, #64748b)", textTransform: "uppercase" }}>
                {isHi ? "ऑडियो चाइम" : "Audible Alert"}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: formValues.sound ? "#059669" : "#64748b", marginTop: "2px" }}>
                {formValues.sound ? (isHi ? "सक्रिय (चाइम बजेगी)" : "Enabled (Chime will ring)") : (isHi ? "म्यूट (मूक अलर्ट)" : "Muted")}
              </div>
            </div>
          </div>

          {/* Surfaces */}
          <div style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
            {isHi ? "लक्षित माध्यम: " : "Surfaces: "}
            <strong style={{ color: "var(--text-primary, #0f172a)" }}>
              {surfaceNames.join(", ") || (isHi ? "कोई नहीं" : "None")}
            </strong>
          </div>

          {/* Extra Deliberate Safety Step for Critical / Network-Wide */}
          {isCritical && (
            <div
              style={{
                marginTop: "6px",
                padding: "12px",
                borderRadius: "10px",
                background: "rgba(220, 38, 38, 0.05)",
                border: "1.5px dashed rgba(220, 38, 38, 0.4)",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#DC2626", marginBottom: "6px" }}>
                {isHi
                  ? "अतिरिक्त सुरक्षा पुष्टि: प्रेषण के लिए 'SEND' टाइप करें या नीचे बटन दबाकर रखें"
                  : "Critical Verification: Type 'SEND' below or press & hold the confirm button"}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="text"
                  value={typeToSend}
                  onChange={(e) => setTypeToSend(e.target.value)}
                  placeholder="Type SEND to confirm"
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: typeToSend.trim().toUpperCase() === "SEND" ? "1.5px solid #059669" : "1.5px solid #cbd5e1",
                    fontSize: "13px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    outline: "none",
                  }}
                />
                {typeToSend.trim().toUpperCase() === "SEND" && (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669" }}>
                    ✓ Verified
                  </span>
                )}
              </div>

              {/* Progress bar for press-and-hold */}
              {holdProgress > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <div style={{ height: "4px", width: "100%", background: "#e2e8f0", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${holdProgress}%`, background: "#DC2626", transition: "width 0.075s linear" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "#DC2626", marginTop: "2px", textAlign: "right" }}>
                    {holdProgress >= 100 ? "Hold complete!" : `Holding... ${holdProgress}%`}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: "14px 20px",
            background: "var(--bg-subtle, #f8fafc)",
            borderTop: "1px solid var(--border-color, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--card-bg, #ffffff)",
              color: "var(--text-secondary, #475569)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isHi ? "रद्द करें" : "Cancel"}
          </button>

          <button
            type="button"
            onClick={canConfirm ? onConfirm : undefined}
            onMouseDown={isCritical ? handleHoldStart : undefined}
            onMouseUp={isCritical ? handleHoldEnd : undefined}
            onMouseLeave={isCritical ? handleHoldEnd : undefined}
            onTouchStart={isCritical ? handleHoldStart : undefined}
            onTouchEnd={isCritical ? handleHoldEnd : undefined}
            disabled={isSubmitting || !canConfirm}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              background: isCritical ? "#DC2626" : "#2563EB",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: isSubmitting || !canConfirm ? "not-allowed" : "pointer",
              opacity: canConfirm ? 1 : 0.6,
              boxShadow: isCritical && canConfirm ? "0 4px 14px rgba(220, 38, 38, 0.4)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            {isSubmitting ? (
              <span>{isHi ? "भेजा जा रहा है..." : "Broadcasting..."}</span>
            ) : isCritical && !canConfirm ? (
              <span>{isHi ? "पुष्टि हेतु दबाए रखें या SEND टाइप करें" : "Hold 1.5s or Type SEND"}</span>
            ) : (
              <span>{isHi ? "🚨 अभी प्रसारित करें (डिस्पैच)" : "🚨 Dispatch Broadcast Now"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

