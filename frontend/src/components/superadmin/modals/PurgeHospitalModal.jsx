import React, { useState, useEffect } from "react";
import { IconTrash, IconX } from "../SuperAdminIcons";
import { modalOverlayStyle, modalContentStyle, modalCloseIconBtnStyle } from "../superAdminStyles";

export default function PurgeHospitalModal({
  hospital,
  onClose,
  onPurged,
  apiBase,
  getAuthHeaders,
  notify,
  isDark = false,
  isHi = false,
}) {
  const [typedCode, setTypedCode] = useState("");
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const hCode = hospital?.hospital_code || "";

  useEffect(() => {
    if (!hCode) return;
    let isMounted = true;
    setLoadingSummary(true);

    fetch(`${apiBase}/api/v1/superadmin/hospitals/${encodeURIComponent(hCode)}/purge-summary`, {
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((res) => {
        if (isMounted && res.status === "success" && res.summary) {
          setSummary(res.summary.counts || {});
        }
      })
      .catch((err) => {
        console.error("Failed to load purge summary:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingSummary(false);
      });

    return () => {
      isMounted = false;
    };
  }, [hCode, apiBase, getAuthHeaders]);

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const res = await fetch(`${apiBase}/api/v1/superadmin/hospitals/${encodeURIComponent(hCode)}/export-data`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to export hospital data.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${hCode}_backup_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify(isHi ? "डेटा सफलतापूर्वक निर्यात किया गया!" : "Hospital data exported to CSV!", "success");
    } catch (err) {
      notify(`Export failed: ${err.message}`, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmPurge = async () => {
    if (typedCode.trim() !== hCode) {
      notify(isHi ? "कोड मेल नहीं खाता!" : "Hospital code does not match!", "error");
      return;
    }

    try {
      setIsPurging(true);
      const res = await fetch(`${apiBase}/api/v1/superadmin/hospitals/${encodeURIComponent(hCode)}/purge`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm_code: typedCode.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        notify(
          isHi
            ? `अस्पताल '${hospital?.name}' हमेशा के लिए हटा दिया गया।`
            : `Hospital '${hospital?.name}' has been permanently purged.`,
          "success"
        );
        onPurged(hospital);
        onClose();
      } else {
        notify(data.detail || data.message || "Failed to purge hospital.", "error");
      }
    } catch (err) {
      notify(`Purge failed: ${err.message}`, "error");
    } finally {
      setIsPurging(false);
    }
  };

  const isMatch = typedCode.trim() === hCode;

  return (
    <div style={modalOverlayStyle}>
      <div style={{ ...modalContentStyle, maxWidth: "560px", padding: "28px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconTrash size={20} color="#DC2626" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 800 }}>
                {isHi ? "अस्पताल को हमेशा के लिए हटाएं (Purge)" : "Permanently Purge Hospital"}
              </h2>
              <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>
                {hospital?.name} ({hCode})
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={modalCloseIconBtnStyle} title="Close">
            <IconX size={18} color="#64748B" />
          </button>
        </div>

        {/* Warning Banner */}
        <div
          style={{
            padding: "14px",
            borderRadius: "12px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ color: "#DC2626", fontWeight: 800, fontSize: "14px" }}>⚠️</span>
            <div style={{ fontSize: "12.5px", color: "#991B1B", lineHeight: 1.45 }}>
              <strong style={{ display: "block", marginBottom: "2px" }}>
                {isHi ? "यह क्रिया पूर्ववत नहीं की जा सकती (Irreversible)!" : "This action cannot be undone!"}
              </strong>
              {isHi
                ? "यह अस्पताल और इसके सभी कतार, अपॉइंटमेंट्स, कर्मचारी, डेस्क और बिलिंग रिकॉर्ड डेटाबेस से हमेशा के लिए नष्ट कर दिए जाएंगे।"
                : "This hospital and all related queue tickets, appointments, employees, desks, tariffs, and billing history will be permanently deleted in a single database transaction."}
            </div>
          </div>
        </div>

        {/* Summary of What Will Be Removed */}
        <div style={{ marginBottom: "18px" }}>
          <div style={{ fontSize: "12px", fontWeight: 800, color: isDark ? "#CBD5E1" : "#475569", marginBottom: "8px" }}>
            {isHi ? "हटाए जाने वाले रिकॉर्ड्स का विवरण:" : "Summary of records to be deleted:"}
          </div>

          {loadingSummary ? (
            <div style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic", padding: "8px 0" }}>
              {isHi ? "विवरण लोड हो रहा है..." : "Loading records count..."}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                padding: "12px",
                borderRadius: "10px",
                background: isDark ? "#1E293B" : "#F8FAFC",
                border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>{isHi ? "टिकट" : "Tickets"}</span>
                <strong style={{ fontSize: "14px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {summary?.tickets ?? 0}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>{isHi ? "अपॉइंटमेंट" : "Appointments"}</span>
                <strong style={{ fontSize: "14px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {summary?.appointments ?? 0}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>{isHi ? "कर्मचारी" : "Staff"}</span>
                <strong style={{ fontSize: "14px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {summary?.employees ?? 0}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>{isHi ? "विभाग" : "Departments"}</span>
                <strong style={{ fontSize: "14px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {summary?.departments ?? 0}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>{isHi ? "डेस्क" : "Desks"}</span>
                <strong style={{ fontSize: "14px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {summary?.desks ?? 0}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#64748B", display: "block" }}>{isHi ? "बिल / चालान" : "Bills"}</span>
                <strong style={{ fontSize: "14px", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {summary?.bills ?? 0}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* CSV Export Option */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "10px",
            background: isDark ? "#1E293B" : "#F0FDF4",
            border: isDark ? "1px solid #334155" : "1px solid #BBF7D0",
            marginBottom: "20px",
          }}
        >
          <div>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: isDark ? "#86EFAC" : "#166534", display: "block" }}>
              {isHi ? "डेटा बैकअप डाउनलोड करें" : "Export Backup Data (CSV)"}
            </span>
            <span style={{ fontSize: "11px", color: isDark ? "#94A3B8" : "#15803D" }}>
              {isHi ? "हटाने से पहले सुरक्षा बैकअप डाउनलोड करना अनुशंसित है।" : "Recommended to download a full CSV snapshot before purging."}
            </span>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              background: "#16A34A",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 700,
              border: "none",
              cursor: isExporting ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isExporting ? (isHi ? "डाउनलोड हो रहा..." : "Exporting...") : (isHi ? "CSV डाउनलोड करें" : "Download CSV")}
          </button>
        </div>

        {/* Typed Confirmation Field */}
        <div style={{ marginBottom: "22px" }}>
          <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: isDark ? "#E2E8F0" : "#334155", marginBottom: "6px" }}>
            {isHi ? (
              <>पुष्टि के लिए नीचे अस्पताल कोड <code style={{ color: "#DC2626", background: "rgba(220,38,38,0.1)", padding: "2px 6px", borderRadius: "4px" }}>{hCode}</code> टाइप करें:</>
            ) : (
              <>To confirm, type <code style={{ color: "#DC2626", background: "rgba(220,38,38,0.1)", padding: "2px 6px", borderRadius: "4px" }}>{hCode}</code> in the box below:</>
            )}
          </label>
          <input
            type="text"
            value={typedCode}
            onChange={(e) => setTypedCode(e.target.value)}
            placeholder={hCode}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "10px",
              border: isMatch ? "2px solid #DC2626" : "1.5px solid #CBD5E1",
              background: isDark ? "#0F172A" : "#FFFFFF",
              color: isDark ? "#F8FAFC" : "#0F172A",
              fontSize: "13px",
              fontWeight: 700,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPurging}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              background: "transparent",
              color: isDark ? "#CBD5E1" : "#475569",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isHi ? "रद्द करें" : "Cancel"}
          </button>

          <button
            type="button"
            onClick={handleConfirmPurge}
            disabled={!isMatch || isPurging}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              background: isMatch && !isPurging ? "#DC2626" : "#FCA5A5",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 800,
              cursor: isMatch && !isPurging ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <IconTrash size={15} color="#FFFFFF" />
            <span>
              {isPurging
                ? (isHi ? "हटाया जा रहा है..." : "Purging...")
                : (isHi ? "हमेशा के लिए हटाएं (Purge)" : "Permanently Purge Hospital")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
