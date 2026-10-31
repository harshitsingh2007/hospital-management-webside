import React, { useState } from "react";

// Web Audio API emergency chime for testing sound
function playSoundTest(type = "code_blue") {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    const isCritical = type === "code_blue" || type === "code_red";
    osc1.type = isCritical ? "sawtooth" : "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(isCritical ? 960 : 784, now);
    osc1.frequency.exponentialRampToValueAtTime(isCritical ? 1280 : 1046, now + 0.18);

    osc2.frequency.setValueAtTime(isCritical ? 520 : 523, now);
    osc2.frequency.exponentialRampToValueAtTime(isCritical ? 640 : 659, now + 0.22);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(isCritical ? 0.22 : 0.15, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.7);
    osc2.stop(now + 0.7);
  } catch (e) {
    // browser autoplay restrictions
  }
}

export default function DeliveryOptions({
  duration = "30",
  onDurationChange,
  sound = true,
  onSoundChange,
  scheduledAt = "",
  onScheduleChange,
  alertType = "notice",
  isHi = false,
}) {
  const [showScheduler, setShowScheduler] = useState(!!scheduledAt);

  const durationOptions = [
    { value: "15", label: isHi ? "15 मिनट" : "15 mins" },
    { value: "30", label: isHi ? "30 मिनट" : "30 mins" },
    { value: "60", label: isHi ? "1 घंटा" : "1 hour" },
    { value: "240", label: isHi ? "4 घंटे" : "4 hours" },
    { value: "0", label: isHi ? "मैन्युअल बंद करने तक" : "Until dismissed" },
  ];

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "10px",
        background: "var(--bg-subtle, #f8fafc)",
        border: "1px solid var(--border-color, #e2e8f0)",
        marginBottom: "16px",
      }}
    >
      {/* Auto-Dismiss Duration */}
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{
            display: "block",
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--text-secondary, #64748b)",
            marginBottom: "6px",
          }}
        >
          {isHi ? "स्वचालित समाप्ति अवधि" : "Auto-Dismiss Duration"}
        </label>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {durationOptions.map((opt) => {
            const isSelected = duration === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onDurationChange(opt.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "7px",
                  border: isSelected ? "1.5px solid #2563EB" : "1px solid var(--border-color, #cbd5e1)",
                  background: isSelected ? "#2563EB" : "var(--card-bg, #ffffff)",
                  color: isSelected ? "#ffffff" : "var(--text-secondary, #475569)",
                  fontSize: "12px",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sound Alert and Test Sound */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          paddingTop: "10px",
          borderTop: "1px solid var(--border-color, #e2e8f0)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary, #0f172a)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => onSoundChange(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#2563EB" }}
          />
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            {isHi ? "ऑडियो चाइम बजाएं (ध्वनि अलर्ट)" : "Play Audible Chime upon Delivery"}
          </span>
        </label>

        {sound && (
          <button
            type="button"
            onClick={() => playSoundTest(alertType)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "6px",
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border-color, #cbd5e1)",
              color: "var(--text-secondary, #475569)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {isHi ? "ध्वनि टेस्ट करें" : "Test Sound"}
          </button>
        )}
      </div>

      {/* Schedule for later toggle & input */}
      <div
        style={{
          paddingTop: "10px",
          marginTop: "10px",
          borderTop: "1px solid var(--border-color, #e2e8f0)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary, #64748b)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showScheduler}
              onChange={(e) => {
                setShowScheduler(e.target.checked);
                if (!e.target.checked) onScheduleChange("");
              }}
              style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#2563EB" }}
            />
            <span>{isHi ? "भविष्य के लिए शेड्यूल करें (वैकल्पिक)" : "Schedule for Later (Optional)"}</span>
          </label>
        </div>

        {showScheduler && (
          <div style={{ marginTop: "8px" }}>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => onScheduleChange(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "7px",
                border: "1px solid var(--border-color, #cbd5e1)",
                background: "var(--card-bg, #ffffff)",
                color: "var(--text-primary, #0f172a)",
                fontSize: "12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: "11px", color: "var(--text-secondary, #94a3b8)", marginTop: "4px" }}>
              {isHi
                ? "निर्धारित समय आने पर यह घोषणा अपने आप सभी स्क्रीनों पर सक्रिय हो जाएगी।"
                : "The broadcast will enter 'scheduled' state and activate automatically at the selected time."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

