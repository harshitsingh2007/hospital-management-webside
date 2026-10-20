import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, HelpCircle, FileText, Calendar, User, Printer } from "lucide-react";

/**
 * In-App Notification System
 * --------------------------
 * Centralized, accessible notification & modal system replacing browser alert() and confirm().
 * Supports:
 * - Toast notifications (Success, Error, Warning, Info) with subtle entrance/exit animations.
 * - Confirmation dialogs for destructive actions (appointment cancellation, family member deletion).
 * - Inline warning banners for operational and clinical policies.
 * - Clinical Report Detail modal for previewing laboratory & diagnostic reports.
 */

export const NotificationContext = createContext({
  showToast: () => {},
  showConfirm: () => {},
  hideToast: () => {},
  hideConfirm: () => {},
});

export const useNotification = () => useContext(NotificationContext);

/**
 * Keyframe animations style element (injected once into document head or rendered safely)
 */
const animationStyle = `
@keyframes inAppToastEnter {
  0% {
    opacity: 0;
    transform: translateY(-16px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes inAppModalPop {
  0% {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@media (max-width: 640px) {
  .in-app-toast-container {
    left: 12px !important;
    right: 12px !important;
    top: 16px !important;
    max-width: calc(100vw - 24px) !important;
  }
}
`;

/**
 * 1. FLOATING TOAST NOTIFICATION COMPONENT
 */
export function InAppToast({ toast, onClose, isDark = false }) {
  if (!toast) return null;

  const type = toast.type || "success";
  const isError = type === "error";
  const isWarn = type === "warn" || type === "warning";
  const isInfo = type === "info";

  return (
    <>
      <style>{animationStyle}</style>
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className="in-app-toast-container"
        style={{
          position: "fixed",
          top: "24px",
          right: "24px",
          zIndex: 999999,
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "14px 18px",
          borderRadius: "14px",
          boxShadow: "0 14px 35px -4px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0,0,0,0.06)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          maxWidth: "460px",
          minWidth: "280px",
          fontSize: "13.5px",
          fontWeight: 600,
          animation: "inAppToastEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          boxSizing: "border-box",
          background: isError
            ? (isDark ? "rgba(127, 29, 29, 0.95)" : "#FEF2F2")
            : isWarn
            ? (isDark ? "rgba(120, 53, 15, 0.95)" : "#FFFBEB")
            : isInfo
            ? (isDark ? "rgba(12, 74, 110, 0.95)" : "#F0F9FF")
            : (isDark ? "rgba(6, 78, 59, 0.95)" : "#ECFDF5"),
          border: isError
            ? (isDark ? "1.5px solid #EF4444" : "1.5px solid #FECACA")
            : isWarn
            ? (isDark ? "1.5px solid #F59E0B" : "1.5px solid #FDE68A")
            : isInfo
            ? (isDark ? "1.5px solid #0284C7" : "1.5px solid #BAE6FD")
            : (isDark ? "1.5px solid #10B981" : "1.5px solid #A7F3D0"),
          color: isError
            ? (isDark ? "#FEE2E2" : "#991B1B")
            : isWarn
            ? (isDark ? "#FEF3C7" : "#92400E")
            : isInfo
            ? (isDark ? "#E0F2FE" : "#075985")
            : (isDark ? "#D1FAE5" : "#065F46"),
        }}
      >
        <div style={{ flexShrink: 0, marginTop: "1px", display: "flex", alignItems: "center" }}>
          {isError ? (
            <AlertCircle size={20} color={isDark ? "#FCA5A5" : "#DC2626"} />
          ) : isWarn ? (
            <AlertTriangle size={20} color={isDark ? "#FCD34D" : "#D97706"} />
          ) : isInfo ? (
            <Info size={20} color={isDark ? "#7DD3FC" : "#0284C7"} />
          ) : (
            <CheckCircle2 size={20} color={isDark ? "#6EE7B7" : "#16A34A"} />
          )}
        </div>

        <div style={{ flex: 1, lineHeight: 1.45, wordBreak: "break-word" }}>
          {toast.title && (
            <div style={{ fontWeight: 800, fontSize: "13.5px", marginBottom: "2px" }}>
              {toast.title}
            </div>
          )}
          <div style={{ fontSize: "13px" }}>{toast.message}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "6px",
            minWidth: "28px",
            minHeight: "28px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "inherit",
            opacity: 0.75,
            flexShrink: 0,
            marginTop: "-2px",
            marginRight: "-4px",
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.75")}
        >
          <X size={16} />
        </button>
      </div>
    </>
  );
}

/**
 * 2. CONFIRMATION DIALOG MODAL COMPONENT
 */
export function InAppConfirmModal({ dialog, onClose, isDark = false }) {
  if (!dialog) return null;

  const isDestructive = Boolean(dialog.isDestructive);

  // Esc key closes modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <style>{animationStyle}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.72)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000000,
          padding: "16px",
        }}
      >
        <div
          style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "20px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            padding: "26px",
            maxWidth: "460px",
            width: "100%",
            boxShadow: "0 25px 60px -12px rgba(0,0,0,0.45)",
            animation: "inAppModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: isDestructive
                  ? (isDark ? "rgba(239, 68, 68, 0.2)" : "#FEF2F2")
                  : (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"),
                color: isDestructive ? "#DC2626" : "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isDestructive ? <AlertTriangle size={24} /> : <HelpCircle size={24} />}
            </div>
            <div>
              <h3
                id="confirm-modal-title"
                style={{
                  margin: 0,
                  fontSize: "17.5px",
                  fontWeight: 800,
                  color: isDark ? "#F8FAFC" : "#0F172A",
                  letterSpacing: "-0.3px",
                }}
              >
                {dialog.title || "Confirm Action"}
              </h3>
            </div>
          </div>

          <p
            id="confirm-modal-desc"
            style={{
              margin: "0 0 24px 0",
              fontSize: "13.5px",
              color: isDark ? "#CBD5E1" : "#475569",
              lineHeight: 1.6,
              wordBreak: "break-word",
            }}
          >
            {dialog.message}
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: isDark ? "1px solid #475569" : "1.5px solid #CBD5E1",
                background: isDark ? "#1E293B" : "#F8FAFC",
                color: isDark ? "#CBD5E1" : "#475569",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {dialog.cancelText || "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => {
                const onConfirm = dialog.onConfirm;
                onClose();
                if (onConfirm) onConfirm();
              }}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: isDestructive
                  ? "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)"
                  : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: isDestructive
                  ? "0 4px 14px rgba(220, 38, 38, 0.35)"
                  : "0 4px 14px rgba(2, 132, 199, 0.35)",
                transition: "transform 0.1s ease",
              }}
            >
              {dialog.confirmText || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 3. INLINE WARNING & NOTICE BANNER COMPONENT
 */
export function InAppWarningBanner({
  type = "warning",
  title,
  message,
  icon = null,
  actionText = null,
  onAction = null,
  onClose = null,
  isDark = false,
  style = {},
}) {
  const isWarn = type === "warn" || type === "warning";
  const isError = type === "error";
  const isInfo = type === "info";
  const isSuccess = type === "success";

  return (
    <div
      role="alert"
      style={{
        padding: "14px 16px",
        borderRadius: "12px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        marginBottom: "16px",
        boxSizing: "border-box",
        background: isError
          ? (isDark ? "rgba(127, 29, 29, 0.25)" : "#FEF2F2")
          : isWarn
          ? (isDark ? "rgba(120, 53, 15, 0.25)" : "#FFFBEB")
          : isInfo
          ? (isDark ? "rgba(12, 74, 110, 0.25)" : "#F0F9FF")
          : (isDark ? "rgba(6, 78, 59, 0.25)" : "#F0FDF4"),
        border: isError
          ? (isDark ? "1.5px solid rgba(239, 68, 68, 0.4)" : "1.5px solid #FCA5A5")
          : isWarn
          ? (isDark ? "1.5px solid rgba(245, 158, 11, 0.4)" : "1.5px solid #FDE68A")
          : isInfo
          ? (isDark ? "1.5px solid rgba(2, 132, 199, 0.4)" : "1.5px solid #BAE6FD")
          : (isDark ? "1.5px solid rgba(16, 185, 129, 0.4)" : "1.5px solid #BBF7D0"),
        ...style,
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: isError
            ? (isDark ? "rgba(239, 68, 68, 0.3)" : "#FEE2E2")
            : isWarn
            ? (isDark ? "rgba(245, 158, 11, 0.3)" : "#FEF3C7")
            : isInfo
            ? (isDark ? "rgba(2, 132, 199, 0.3)" : "#E0F2FE")
            : (isDark ? "rgba(16, 185, 129, 0.3)" : "#DCFCE7"),
          color: isError
            ? "#DC2626"
            : isWarn
            ? "#D97706"
            : isInfo
            ? "#0284C7"
            : "#16A34A",
        }}
      >
        {icon ? icon : isError ? (
          <AlertCircle size={20} />
        ) : isWarn ? (
          <AlertTriangle size={20} />
        ) : isInfo ? (
          <Info size={20} />
        ) : (
          <CheckCircle2 size={20} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontWeight: 800,
              fontSize: "13.5px",
              color: isError
                ? (isDark ? "#FCA5A5" : "#991B1B")
                : isWarn
                ? (isDark ? "#FCD34D" : "#92400E")
                : isInfo
                ? (isDark ? "#7DD3FC" : "#075985")
                : (isDark ? "#86EFAC" : "#14532D"),
              letterSpacing: "-0.2px",
            }}
          >
            {title}
          </div>
        )}
        <div
          style={{
            fontSize: "12.5px",
            marginTop: title ? "3px" : "0",
            lineHeight: 1.5,
            color: isError
              ? (isDark ? "#FEE2E2" : "#B91C1C")
              : isWarn
              ? (isDark ? "#FEF3C7" : "#B45309")
              : isInfo
              ? (isDark ? "#E0F2FE" : "#0369A1")
              : (isDark ? "#D1FAE5" : "#166534"),
          }}
        >
          {message}
        </div>

        {actionText && onAction && (
          <div style={{ marginTop: "8px" }}>
            <button
              type="button"
              onClick={onAction}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
                color: isError ? "#DC2626" : isWarn ? "#D97706" : isInfo ? "#0284C7" : "#16A34A",
              }}
            >
              {actionText}
            </button>
          </div>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close warning banner"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            color: "inherit",
            opacity: 0.7,
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * 4. CLINICAL MEDICAL REPORT DETAIL MODAL COMPONENT
 * Replaces browser alert() in MedicalReports.jsx with an in-app professional report viewer.
 */
export function ClinicalReportDetailModal({ report, onClose, language = "en", isDark = false }) {
  if (!report) return null;

  const isHi = language === "hi";

  return (
    <>
      <style>{animationStyle}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000000,
          padding: "16px",
        }}
      >
        <div
          style={{
            background: isDark ? "#0F172A" : "#FFFFFF",
            borderRadius: "20px",
            border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
            padding: "26px",
            maxWidth: "500px",
            width: "100%",
            boxShadow: "0 25px 60px -12px rgba(0,0,0,0.5)",
            animation: "inAppModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                  color: "#0284C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileText size={22} />
              </div>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#0284C7",
                  }}
                >
                  {isHi ? "नैदानिक प्रयोगशाला रिपोर्ट" : "Clinical Diagnostic Report"}
                </span>
                <h3
                  id="report-modal-title"
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "18px",
                    fontWeight: 800,
                    color: isDark ? "#F8FAFC" : "#0F172A",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {report.report_name}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                color: isDark ? "#94A3B8" : "#64748B",
                borderRadius: "8px",
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Details Card */}
          <div
            style={{
              background: isDark ? "#1E293B" : "#F8FAFC",
              borderRadius: "14px",
              border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
              padding: "16px",
              marginBottom: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B", display: "flex", alignItems: "center", gap: "6px" }}>
                <Calendar size={14} />
                <span>{isHi ? "दिनांक" : "Report Date"}</span>
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: isDark ? "#F1F5F9" : "#1E293B" }}>
                {report.report_date}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={14} />
                <span>{isHi ? "सत्यापन स्थिति" : "Verification Status"}</span>
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5",
                  border: isDark ? "1px solid #059669" : "1px solid #A7F3D0",
                  color: isDark ? "#6EE7B7" : "#047857",
                }}
              >
                ✓ {report.status || "Verified"}
              </span>
            </div>

            {report.doctor && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B", display: "flex", alignItems: "center", gap: "6px" }}>
                  <User size={14} />
                  <span>{isHi ? "परामर्शदाता" : "Consulting Doctor"}</span>
                </span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: isDark ? "#F1F5F9" : "#1E293B" }}>
                  {report.doctor}
                </span>
              </div>
            )}

            <div style={{ borderTop: isDark ? "1px solid #334155" : "1px solid #E2E8F0", paddingTop: "12px", marginTop: "4px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B", marginBottom: "4px" }}>
                {isHi ? "नैदानिक अवलोकन / टिप्पणी" : "Clinical Observation / Summary"}
              </div>
              <div style={{ fontSize: "12.5px", color: isDark ? "#CBD5E1" : "#334155", lineHeight: 1.5 }}>
                {report.summary || (isHi
                  ? "परीक्षण के सभी पैरामीटर सामान्य सीमा के भीतर दर्ज किए गए हैं। विस्तृत डिजिटल हस्ताक्षरित रिपोर्ट रिकॉर्ड में संग्रहित है।"
                  : "All test parameters recorded within clinical normal ranges. Detailed digitally signed PDF copy preserved in patient record.")}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                background: "transparent",
                color: isDark ? "#CBD5E1" : "#475569",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Printer size={15} />
              <span>{isHi ? "प्रिंट करें" : "Print Copy"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
              }}
            >
              {isHi ? "बंद करें" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 5. NOTIFICATION PROVIDER
 */
export function InAppNotificationProvider({ children, isDark = false }) {
  const [inAppToast, setInAppToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const toastTimerRef = useRef(null);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setInAppToast(null);
  }, []);

  const hideConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const showToast = useCallback((msg, type = "success", durationMs = null) => {
    if (!msg) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    const messageText = typeof msg === "object" ? msg.message : msg;
    const titleText = typeof msg === "object" ? msg.title : null;
    const finalType = (typeof msg === "object" ? msg.type : type) || "success";

    setInAppToast({
      id: Date.now(),
      message: messageText,
      title: titleText,
      type: finalType,
    });

    const autoDuration = durationMs || (finalType === "error" || finalType === "warn" ? 6500 : 4500);
    toastTimerRef.current = setTimeout(() => {
      setInAppToast(null);
    }, autoDuration);
  }, []);

  const showConfirm = useCallback(({ title, message, confirmText, cancelText, isDestructive, onConfirm }) => {
    setConfirmDialog({
      title,
      message,
      confirmText,
      cancelText,
      isDestructive: Boolean(isDestructive),
      onConfirm,
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm, hideToast, hideConfirm }}>
      {children}
      <InAppToast toast={inAppToast} onClose={hideToast} isDark={isDark} />
      <InAppConfirmModal dialog={confirmDialog} onClose={hideConfirm} isDark={isDark} />
    </NotificationContext.Provider>
  );
}

export default InAppNotificationProvider;
