import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  Lock,
  KeyRound,
  LogOut,
} from "lucide-react";
import { API_BASE } from "../config/hospitalConfig";

const STATUS_TABS = ["PENDING", "APPROVED", "REJECTED", "ALL"];

export default function HospitalApprovalsPage({
  language = "en",
  theme = "light",
}) {
  const isHi = language === "hi";
  const isDark = theme === "dark";

  // Keep key in memory only so every page open/refresh requires entering it again
  const [devKey, setDevKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [banner, setBanner] = useState(null);

  const buildHeaders = useCallback(
    (overrideKey = null) => {
      const activeKey = overrideKey !== null ? overrideKey : devKey;
      return {
        "Content-Type": "application/json",
        ...(activeKey ? { "x-developer-key": activeKey } : {}),
      };
    },
    [devKey]
  );

  const fetchRequests = useCallback(
    async (overrideKey = null) => {
      const activeKey = overrideKey !== null ? overrideKey : devKey;
      if (!activeKey) return false;

      setLoading(true);
      setAuthError(null);
      try {
        const query = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
        const res = await fetch(`${API_BASE}/api/v1/superadmin/hospital-requests${query}`, {
          headers: buildHeaders(activeKey),
        });
        const data = await res.json();
        if (res.status === 401 || res.status === 403) {
          setIsUnlocked(false);
          setDevKey("");
          setAuthError(data.message || "Invalid developer access key.");
          return false;
        }
        if (res.ok && data.status === "success") {
          setIsUnlocked(true);
          setRequests(Array.isArray(data.requests) ? data.requests : []);
          return true;
        }
        setBanner({
          type: "error",
          text: data.message || (isHi ? "अनुरोध लोड करने में विफल।" : "Failed to load hospital requests."),
        });
        return false;
      } catch (err) {
        setBanner({ type: "error", text: err.message || "Network error" });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, buildHeaders, devKey, isHi]
  );

  useEffect(() => {
    if (isUnlocked && devKey) {
      fetchRequests(devKey);
    }
  }, [statusFilter, isUnlocked, devKey, fetchRequests]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setAuthError("Please enter the developer access key.");
      return;
    }
    const ok = await fetchRequests(trimmed);
    if (ok) {
      setDevKey(trimmed);
      setKeyInput("");
    }
  };

  const handleLock = () => {
    setDevKey("");
    setKeyInput("");
    setRequests([]);
    setIsUnlocked(false);
    setAuthError(null);
    setBanner(null);
  };

  const handleApprove = async (reqItem) => {
    setActionId(reqItem.id);
    setBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/superadmin/hospital-requests/${reqItem.id}/approve`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ notes: "Approved via Private Developer Portal" }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setBanner({
          type: "success",
          text: data.message || `${reqItem.hospital_name} approved and activated.`,
        });
        fetchRequests();
      } else {
        setBanner({ type: "error", text: data.message || "Approval failed." });
      }
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    } finally {
      setActionId(null);
    }
  };

  const handleRejectConfirm = async (reqItem) => {
    setActionId(reqItem.id);
    setBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/superadmin/hospital-requests/${reqItem.id}/reject`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ reason: rejectReason.trim() || "Rejected by developer" }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setBanner({
          type: "success",
          text: data.message || `${reqItem.hospital_name} rejected.`,
        });
        setRejectingId(null);
        setRejectReason("");
        fetchRequests();
      } else {
        setBanner({ type: "error", text: data.message || "Rejection failed." });
      }
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    } finally {
      setActionId(null);
    }
  };

  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const borderCol = isDark ? "#1E293B" : "#E2E8F0";
  const textMain = isDark ? "#F8FAFC" : "#0F172A";
  const textMuted = isDark ? "#94A3B8" : "#64748B";
  const surfaceBg = isDark ? "#1E293B" : "#F8FAFC";

  const statusBadgeStyle = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "APPROVED") {
      return {
        background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
        color: isDark ? "#34D399" : "#059669",
        border: isDark ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid #A7F3D0",
      };
    }
    if (s === "REJECTED") {
      return {
        background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
        color: isDark ? "#F87171" : "#DC2626",
        border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA",
      };
    }
    return {
      background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB",
      color: isDark ? "#FBBF24" : "#D97706",
      border: isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #FDE68A",
    };
  };

  if (!isUnlocked) {
    return (
      <div style={{ minHeight: "88vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: "18px",
            padding: "28px 24px",
            boxShadow: isDark ? "0 12px 32px rgba(0,0,0,0.45)" : "0 8px 24px rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                flexShrink: 0,
              }}
            >
              <Lock size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: textMain }}>
                Developer Access Only
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: textMuted }}>
                Private portal for hospital registration approvals
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: textMain, marginBottom: "6px" }}>
                Developer Access Key
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Enter DEVELOPER_ACCESS_KEY"
                  autoFocus
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px 10px 36px",
                    borderRadius: "10px",
                    border: `1px solid ${borderCol}`,
                    background: surfaceBg,
                    color: textMain,
                    fontSize: "13.5px",
                  }}
                />
                <KeyRound size={15} color={textMuted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              </div>
            </div>

            {authError && (
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: "9px",
                  background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                  border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA",
                  color: isDark ? "#F87171" : "#DC2626",
                  fontSize: "12.5px",
                  fontWeight: 600,
                }}
              >
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                color: "#FFFFFF",
                fontSize: "13.5px",
                fontWeight: 800,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Verifying..." : "Unlock Portal"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1040px", margin: "24px auto", padding: "0 20px 48px" }}>
      {/* Header Card */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${borderCol}`,
          borderRadius: "18px",
          padding: "20px 24px",
          marginBottom: "18px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.35)" : "0 4px 16px rgba(15,23,42,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={21} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 900, color: textMain }}>
              {isHi ? "अस्पताल पंजीकरण स्वीकृतियां" : "Hospital Approvals"}
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: textMuted, fontWeight: 500 }}>
              {isHi ? "डेवलपर-ओनली स्वीकृति पोर्टल" : "Private developer-only registration review"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => fetchRequests()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              border: `1px solid ${borderCol}`,
              background: surfaceBg,
              color: textMain,
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            <RefreshCw size={14} />
            <span>{isHi ? "रीफ्रेश" : "Refresh"}</span>
          </button>

          <button
            type="button"
            onClick={handleLock}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA",
              background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
              color: isDark ? "#F87171" : "#DC2626",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <LogOut size={14} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatusFilter(tab);
                setRejectingId(null);
              }}
              style={{
                padding: "7px 15px",
                borderRadius: "10px",
                border: active ? "1.5px solid #0284C7" : `1px solid ${borderCol}`,
                background: active ? "#0284C7" : cardBg,
                color: active ? "#FFFFFF" : textMuted,
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                letterSpacing: "0.3px",
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 600,
            background:
              banner.type === "success"
                ? isDark
                  ? "rgba(16, 185, 129, 0.15)"
                  : "#ECFDF5"
                : isDark
                  ? "rgba(239, 68, 68, 0.15)"
                  : "#FEF2F2",
            border:
              banner.type === "success"
                ? isDark
                  ? "1px solid rgba(16, 185, 129, 0.35)"
                  : "1px solid #A7F3D0"
                : isDark
                  ? "1px solid rgba(239, 68, 68, 0.35)"
                  : "1px solid #FECACA",
            color:
              banner.type === "success"
                ? isDark
                  ? "#34D399"
                  : "#065F46"
                : isDark
                  ? "#F87171"
                  : "#991B1B",
          }}
        >
          {banner.type === "success" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Request List */}
      {loading ? (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: "16px",
            padding: "44px 20px",
            textAlign: "center",
            color: textMuted,
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {isHi ? "अस्पताल अनुरोध लोड हो रहे हैं..." : "Loading hospital requests..."}
        </div>
      ) : requests.length === 0 ? (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: "16px",
            padding: "44px 20px",
            textAlign: "center",
            color: textMuted,
          }}
        >
          <Clock size={30} style={{ opacity: 0.5, marginBottom: "8px" }} />
          <div style={{ fontSize: "14.5px", fontWeight: 700, color: textMain }}>
            {isHi ? "कोई अनुरोध नहीं मिला" : `No ${statusFilter.toLowerCase()} requests found`}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {requests.map((reqItem) => {
            const isPending = String(reqItem.status || "").toUpperCase() === "PENDING";
            const isBusy = actionId === reqItem.id;
            const isRejectOpen = rejectingId === reqItem.id;

            return (
              <div
                key={reqItem.id}
                style={{
                  background: cardBg,
                  border: `1px solid ${borderCol}`,
                  borderRadius: "16px",
                  padding: "18px 20px",
                  boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 10px rgba(15,23,42,0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "14px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "min(240px, 100%)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <Building2 size={18} color="#0284C7" />
                      <span style={{ fontSize: "16px", fontWeight: 800, color: textMain }}>
                        {reqItem.hospital_name}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: surfaceBg,
                          border: `1px solid ${borderCol}`,
                          color: textMuted,
                          fontFamily: "monospace",
                        }}
                      >
                        {reqItem.hospital_code}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "2px 10px",
                          borderRadius: "999px",
                          ...statusBadgeStyle(reqItem.status),
                        }}
                      >
                        {reqItem.status}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "16px",
                        marginTop: "10px",
                        fontSize: "12.5px",
                        color: textMuted,
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Mail size={13} /> {reqItem.email}
                      </span>
                      {reqItem.phone && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Phone size={13} /> {reqItem.phone}
                        </span>
                      )}
                      {(reqItem.city || reqItem.state || reqItem.address) && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <MapPin size={13} />
                          {[reqItem.address, reqItem.city, reqItem.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {reqItem.registration_number && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <FileText size={13} /> Reg: {reqItem.registration_number}
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: "8px", fontSize: "11.5px", color: textMuted }}>
                      {isHi ? "सबमिट किया गया:" : "Submitted:"}{" "}
                      {reqItem.created_at ? new Date(reqItem.created_at).toLocaleString() : "—"}
                      {reqItem.rejection_reason ? ` • Reason: ${reqItem.rejection_reason}` : ""}
                    </div>
                  </div>

                  {isPending && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleApprove(reqItem)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 14px",
                          borderRadius: "10px",
                          border: "none",
                          background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                          color: "#FFFFFF",
                          fontSize: "12.5px",
                          fontWeight: 800,
                          cursor: isBusy ? "wait" : "pointer",
                          opacity: isBusy ? 0.7 : 1,
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>{isHi ? "स्वीकृत करें" : "Approve"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectingId(isRejectOpen ? null : reqItem.id);
                          setRejectReason("");
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 14px",
                          borderRadius: "10px",
                          border: isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #FECACA",
                          background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                          color: isDark ? "#F87171" : "#DC2626",
                          fontSize: "12.5px",
                          fontWeight: 800,
                          cursor: isBusy ? "wait" : "pointer",
                        }}
                      >
                        <XCircle size={15} />
                        <span>{isHi ? "अस्वीकृत करें" : "Reject"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {isPending && isRejectOpen && (
                  <div
                    style={{
                      marginTop: "14px",
                      paddingTop: "14px",
                      borderTop: `1px solid ${borderCol}`,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={isHi ? "अस्वीकृति का कारण दर्ज करें (वैकल्पिक)" : "Enter rejection reason (optional)"}
                      style={{
                        flex: 1,
                        minWidth: "min(200px, 100%)",
                        padding: "9px 12px",
                        borderRadius: "9px",
                        border: `1px solid ${borderCol}`,
                        background: surfaceBg,
                        color: textMain,
                        fontSize: "13px",
                      }}
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRejectConfirm(reqItem)}
                      style={{
                        padding: "9px 16px",
                        borderRadius: "9px",
                        border: "none",
                        background: "#DC2626",
                        color: "#FFFFFF",
                        fontSize: "12.5px",
                        fontWeight: 800,
                        cursor: isBusy ? "wait" : "pointer",
                      }}
                    >
                      {isHi ? "अस्वीकृति की पुष्टि करें" : "Confirm Reject"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
