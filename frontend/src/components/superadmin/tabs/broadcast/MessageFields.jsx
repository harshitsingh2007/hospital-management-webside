import React from "react";

export default function MessageFields({
  title = "",
  onTitleChange,
  message = "",
  onMessageChange,
  isHi = false,
}) {
  const MAX_TITLE = 80;
  const MAX_MESSAGE = 300;

  const titleLength = title.length;
  const messageLength = message.length;

  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Headline Input */}
      <div style={{ marginBottom: "14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "6px",
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
            {isHi ? "मुख्य शीर्षक / हेडलाइन *" : "Headline / Alert Title *"}
          </label>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color:
                titleLength >= MAX_TITLE
                  ? "#DC2626"
                  : titleLength > MAX_TITLE - 10
                  ? "#D97706"
                  : "var(--text-secondary, #94a3b8)",
            }}
          >
            {titleLength} / {MAX_TITLE}
          </span>
        </div>

        <input
          type="text"
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={
            isHi
              ? "उदा. कोड ब्लू: आईसीयू ब्लॉक में आपातकालीन सहायता आवश्यक..."
              : "e.g. CODE BLUE: Resuscitation Team Alert..."
          }
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: "9px",
            border: !title.trim()
              ? "1.5px solid var(--border-color, #cbd5e1)"
              : titleLength >= MAX_TITLE
              ? "1.5px solid #DC2626"
              : "1.5px solid #2563EB",
            background: "var(--input-bg, #ffffff)",
            color: "var(--text-primary, #0f172a)",
            fontSize: "14px",
            fontWeight: 600,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Message Textarea */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "6px",
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
            {isHi ? "विस्तृत विवरण / निर्देश (वैकल्पिक)" : "Detailed Instructions / Message (Optional)"}
          </label>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color:
                messageLength >= MAX_MESSAGE
                  ? "#DC2626"
                  : messageLength > MAX_MESSAGE - 25
                  ? "#D97706"
                  : "var(--text-secondary, #94a3b8)",
            }}
          >
            {messageLength} / {MAX_MESSAGE}
          </span>
        </div>

        <textarea
          rows={3}
          value={message}
          maxLength={MAX_MESSAGE}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder={
            isHi
              ? "विस्तृत निर्देश, कमरे का नंबर, संपर्क जानकारी अथवा आपातकालीन सावधानियां दर्ज करें..."
              : "Provide contextual guidance, room numbers, evacuation directives or action steps..."
          }
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: "9px",
            border:
              messageLength >= MAX_MESSAGE
                ? "1.5px solid #DC2626"
                : "1.5px solid var(--border-color, #cbd5e1)",
            background: "var(--input-bg, #ffffff)",
            color: "var(--text-primary, #0f172a)",
            fontSize: "13px",
            lineHeight: 1.5,
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

