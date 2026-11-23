import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AlertCircle, AlertTriangle, ShieldAlert, Clock, Building2 } from "lucide-react";
import { API_BASE } from "../config/hospitalConfig";

/**
 * Checks whether a ticket is an Emergency ticket.
 * Matches backend ticketService.js isEmergencyTicket logic:
 * - Category / Department equals or contains "emergency"
 * - Transferred from emergency department
 * - Priority level is 1
 * - Flag is_emergency is true
 */
export function isEmergencyTicket(ticket) {
  if (!ticket) return false;
  const cat = String(ticket.service_category || ticket.department || ticket.department_name || "").trim().toLowerCase();
  const fromDept = String(ticket.transferred_from_dept || "").trim().toLowerCase();
  const prio = Number(ticket.priority_level || ticket.priority || 2);
  return (
    cat === "emergency" ||
    cat === "emergency triage" ||
    cat.includes("emergency") ||
    fromDept === "emergency" ||
    fromDept.includes("emergency") ||
    prio === 1 ||
    Boolean(ticket.is_emergency)
  );
}

/**
 * Formats time elapsed since patient arrival / queue entry
 */
export function formatTimeSinceArrival(joinTs, language = "en") {
  if (!joinTs) return null;
  let sec = typeof joinTs === "number" ? joinTs : new Date(joinTs).getTime() / 1000;
  if (sec > 1e11) sec = sec / 1000;
  if (isNaN(sec) || sec <= 0) return null;
  const now = Date.now() / 1000;
  const diffMins = Math.max(0, Math.floor((now - sec) / 60));
  if (diffMins < 1) return language === "hi" ? "अभी पहुंचे" : "< 1m ago";
  if (diffMins < 60) return `${diffMins}${language === "hi" ? "मि. पहले" : "m ago"}`;
  const hrs = Math.floor(diffMins / 60);
  const remM = diffMins % 60;
  return `${hrs}h ${remM}m ${language === "hi" ? "पहले" : "ago"}`;
}

/**
 * Resolves the desk assigned to a user from the desks list.
 * Checks assigned_user_id, assigned_employee_id, assigned_employee_code,
 * assigned_employee_name, and email. Fixes server mismatch where server sends
 * assigned_employee_name instead of assigned_user_name or assigned_name.
 */
export function resolveAssignedDesk(desks = [], currentUser = null) {
  if (!Array.isArray(desks) || desks.length === 0 || !currentUser) return null;

  const uId = currentUser.id || currentUser.user_id;
  const uEmail = String(currentUser.email || "").trim().toLowerCase();
  const uEmpCode = String(currentUser.employee_code || currentUser.employee_badge || currentUser.badge_id || "").trim().toLowerCase();
  const uName = String(currentUser.name || currentUser.username || "").trim().toLowerCase();

  return desks.find((d) => {
    // 1. Check assigned_user_id
    if (d.assigned_user_id && uId && String(d.assigned_user_id) === String(uId)) return true;

    // 2. Check assigned_employee_id
    if (d.assigned_employee_id && uId && String(d.assigned_employee_id) === String(uId)) return true;

    // 3. Check assigned_employee_code
    if (uEmpCode && d.assigned_employee_code && String(d.assigned_employee_code).trim().toLowerCase() === uEmpCode) return true;

    // 4. Check assigned employee email (if nested or direct)
    const empEmail = String(d.assigned_employee_email || d.employee_email || d.email || d.employees?.email || "").trim().toLowerCase();
    if (uEmail && empEmail && empEmail === uEmail) return true;

    // 5. Check assigned_employee_name / assigned_user_name
    const empName = String(d.assigned_employee_name || d.assigned_user_name || d.assigned_name || d.employees?.name || "").trim().toLowerCase();
    if (uName && empName && empName === uName) return true;

    return false;
  }) || null;
}

/**
 * Returns desk department scope metadata: { deptCode, deptName, isEmergencyDesk }
 */
export function getDeskScope(desk) {
  if (!desk) {
    return {
      deptCode: "",
      deptName: "",
      isEmergencyDesk: false,
    };
  }

  const deptCode = String(
    desk.dept_code ||
    desk.department_code ||
    desk.departments?.dept_code ||
    desk.department_id ||
    ""
  ).trim().toLowerCase();

  const deptName = String(
    desk.department_name ||
    desk.departments?.department_name ||
    desk.department ||
    ""
  ).trim();

  const isEmergencyDesk =
    deptCode === "emergency" ||
    deptCode.includes("emergency") ||
    deptName.toLowerCase().includes("emergency");

  return {
    deptCode,
    deptName: deptName || (isEmergencyDesk ? "Emergency Triage" : "General"),
    isEmergencyDesk,
  };
}

/**
 * Common sorting comparator for queues:
 * 1. Priority 1 (Emergency) always comes first
 * 2. Earlier effective timestamp / join timestamp (longest wait) comes first
 */
function sortEmergencyAndWait(a, b) {
  const prioA = Number(a.priority_level || a.priority || 2);
  const prioB = Number(b.priority_level || b.priority || 2);
  if (prioA !== prioB) {
    return prioA - prioB; // 1 before 2
  }
  const timeA = a.effective_timestamp || a.join_timestamp || 0;
  const timeB = b.effective_timestamp || b.join_timestamp || 0;
  return timeA - timeB;
}

/**
 * Scopes a list of tickets for a desk:
 * - If scope.isEmergencyDesk is true: returns ONLY tickets that match isEmergencyTicket, sorted Priority 1 first, then longest wait.
 * - Otherwise: applies normalFilter(ticket) if provided. Ensures emergency tickets routed to this department are NOT hidden and are sorted first.
 */
export function scopeTicketsForDesk(tickets = [], scope = {}, normalFilter = null) {
  if (!Array.isArray(tickets)) return [];

  const isEmergDesk = Boolean(scope?.isEmergencyDesk);

  if (isEmergDesk) {
    return tickets
      .filter((t) => isEmergencyTicket(t))
      .sort(sortEmergencyAndWait);
  }

  // Normal desk
  const filtered = typeof normalFilter === "function"
    ? tickets.filter(normalFilter)
    : tickets;

  return filtered.sort((a, b) => {
    const isEmergA = isEmergencyTicket(a);
    const isEmergB = isEmergencyTicket(b);
    if (isEmergA && !isEmergB) return -1;
    if (!isEmergA && isEmergB) return 1;
    return sortEmergencyAndWait(a, b);
  });
}

/**
 * Custom React hook that resolves and tracks desk assignment for the current user.
 * Automatically refreshes on window focus, socket events, and a light periodic interval (15s)
 * so Super Admin desk reassignments take effect without logging out.
 */
export function useAssignedDesk({ hospitalCode, currentUser, socketRef, storageKey = null }) {
  const [desks, setDesks] = useState([]);
  const [desksLoaded, setDesksLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const fetchDesks = useCallback(async () => {
    if (!hospitalCode) return;
    try {
      const token = currentUser?.token || localStorage.getItem("ai_queue_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let fetchedDesks = null;

      // 1. Try Superadmin desks endpoint
      try {
        const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${hospitalCode}/desks`, { credentials: "omit", headers });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.desks)) {
            fetchedDesks = data.desks;
          }
        }
      } catch (e) {
        // Fallback below
      }

      // 2. Fallback to doctor desk-scope endpoint if superadmin endpoint was forbidden or failed
      if (!fetchedDesks && currentUser?.id) {
        try {
          const res = await fetch(`${API_BASE}/api/v1/doctor/desk-scope?hospital_code=${hospitalCode}&user_id=${currentUser.id}`, { credentials: "omit", headers });
          if (res.ok) {
            const data = await res.json();
            if (data?.desk) {
              fetchedDesks = [data.desk];
            }
          }
        } catch (e) {}
      }

      if (fetchedDesks) {
        setDesks(fetchedDesks);
        setDesksLoaded(true);
        setLastRefresh(Date.now());
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(fetchedDesks));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Desk fetch notice:", err?.message);
    } finally {
      setDesksLoaded(true);
    }
  }, [hospitalCode, currentUser?.id, currentUser?.token, storageKey]);

  // Initial load & cached desks restore
  useEffect(() => {
    if (storageKey) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDesks(parsed);
            setDesksLoaded(true);
          }
        }
      } catch (e) {}
    }
    fetchDesks();
  }, [fetchDesks, storageKey]);

  // Periodic polling (15s) & Window Focus refetch
  useEffect(() => {
    const handleFocus = () => fetchDesks();
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(() => {
      fetchDesks();
    }, 15000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [fetchDesks]);

  // Socket listener for dynamic desk reassignment
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handleDeskUpdated = () => fetchDesks();
    socket.on("desk_updated", handleDeskUpdated);
    socket.on("desks_updated", handleDeskUpdated);
    socket.on("employee_assigned", handleDeskUpdated);

    return () => {
      socket.off("desk_updated", handleDeskUpdated);
      socket.off("desks_updated", handleDeskUpdated);
      socket.off("employee_assigned", handleDeskUpdated);
    };
  }, [socketRef, fetchDesks]);

  const assignedDesk = useMemo(() => {
    return resolveAssignedDesk(desks, currentUser);
  }, [desks, currentUser]);

  const deskScope = useMemo(() => {
    return getDeskScope(assignedDesk);
  }, [assignedDesk]);

  return {
    desks,
    assignedDesk,
    deskScope,
    desksLoaded,
    lastRefresh,
    refetchDesks: fetchDesks,
  };
}

/**
 * UI Component: Desk Department Badge for headers
 */
export function DeskDepartmentBadge({ deskScope, assignedDesk, isDark = false, language = "en", customStyle = null }) {
  const isEmergency = Boolean(deskScope?.isEmergencyDesk);
  const isHi = language === "hi";

  const containerStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: isEmergency
      ? (isDark ? "rgba(220, 38, 38, 0.2)" : "#FEF2F2")
      : (isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.15)"),
    border: isEmergency
      ? (isDark ? "1px solid rgba(220, 38, 38, 0.4)" : "1px solid #FECDD3")
      : "1px solid rgba(255, 255, 255, 0.25)",
    borderRadius: "10px",
    padding: "6px 12px",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    color: isEmergency ? (isDark ? "#FCA5A5" : "#DC2626") : "#FFFFFF",
    fontSize: "12px",
    fontWeight: 800,
    userSelect: "none",
    letterSpacing: "0.3px",
    ...(typeof customStyle === "object" && customStyle ? customStyle : {}),
  };

  if (isEmergency) {
    return (
      <div style={containerStyle} title={isHi ? "आपातकालीन ट्राइएज डेस्क" : "Emergency Triage Desk"}>
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#DC2626",
            display: "inline-block",
            flexShrink: 0,
            boxShadow: "0 0 6px rgba(220, 38, 38, 0.6)",
          }}
        />
        <span>{isHi ? "आपातकालीन ट्राइएज डेस्क" : "Emergency Triage Desk"}</span>
      </div>
    );
  }

  const deptLabel =
    deskScope?.deptName ||
    assignedDesk?.department_name ||
    assignedDesk?.desk_name ||
    (isHi ? "सामान्य डेस्क" : "General Desk");

  return (
    <div style={containerStyle} title={deptLabel}>
      <Building2 size={12} color="#38BDF8" style={{ flexShrink: 0 }} />
      <span>{deptLabel}</span>
    </div>
  );
}

/**
 * UI Component: Emergency Desk Banner shown at top of workstation/queue tab
 */
export function EmergencyDeskBanner({ isEmergencyDesk, isDark = false, language = "en" }) {
  if (!isEmergencyDesk) return null;
  const isHi = language === "hi";

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 18px",
        borderRadius: "14px",
        background: isDark ? "rgba(220, 38, 38, 0.15)" : "#FEF2F2",
        border: isDark ? "1px solid rgba(220, 38, 38, 0.4)" : "1px solid #FECDD3",
        color: isDark ? "#FCA5A5" : "#991B1B",
        marginBottom: "16px",
        boxShadow: isDark
          ? "0 4px 14px rgba(220, 38, 38, 0.12)"
          : "0 4px 14px rgba(220, 38, 38, 0.08)",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: isDark ? "rgba(220, 38, 38, 0.25)" : "#FEE2E2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ShieldAlert size={20} color="#DC2626" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 900,
            color: isDark ? "#FCA5A5" : "#B91C1C",
          }}
        >
          {isHi ? "आपातकालीन ट्राइएज मोड सक्रिय" : "Emergency Triage Mode Active"}
        </div>
        <div
          style={{
            fontSize: "11.5px",
            fontWeight: 600,
            opacity: 0.9,
            marginTop: "1px",
            color: isDark ? "#FECDD3" : "#7F1D1D",
          }}
        >
          {isHi
            ? "आप आपातकालीन ट्राइएज डेस्क पर नियुक्त हैं। केवल आपातकालीन मरीज दिखाए जा रहे हैं।"
            : "You are assigned to the Emergency Triage desk. Showing emergency patients only."}
        </div>
      </div>
    </div>
  );
}

/**
 * UI Component: Notice shown when staff/doctor has no desk assigned
 */
export function NoDeskNotice({ desksLoaded, assignedDesk, isDark = false, language = "en" }) {
  if (!desksLoaded || assignedDesk) return null;
  const isHi = language === "hi";

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 18px",
        borderRadius: "14px",
        background: isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB",
        border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid #FDE68A",
        color: isDark ? "#FDE68A" : "#92400E",
        marginBottom: "16px",
        boxShadow: isDark
          ? "0 4px 14px rgba(245, 158, 11, 0.12)"
          : "0 4px 14px rgba(245, 158, 11, 0.08)",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: isDark ? "rgba(245, 158, 11, 0.25)" : "#FEF3C7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={20} color="#D97706" />
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: "12.5px" }}>
        <span style={{ fontWeight: 800, color: isDark ? "#FDE68A" : "#B45309" }}>
          {isHi ? "कोई डेस्क असाइन नहीं है।" : "No desk assigned."}{" "}
        </span>
        <span style={{ opacity: 0.9, fontWeight: 500 }}>
          {isHi
            ? "कृपया अपने प्रशासक से संपर्क करें ताकि आपको एक स्टेशन सौंपा जा सके।"
            : "Contact your administrator to be assigned to a workstation."}
        </span>
      </div>
    </div>
  );
}

/**
 * UI Component: Emergency Badge for ticket rows
 */
export function EmergencyBadge({ ticket, language = "en", isDark = false, showTime = true }) {
  if (!isEmergencyTicket(ticket)) return null;
  const isHi = language === "hi";
  const isUnassigned = Boolean(ticket.is_emergency_unassigned || ticket.emergency_unassigned);
  const timeSinceArrival = showTime ? formatTimeSinceArrival(ticket.join_timestamp || ticket.created_at, language) : null;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "2px 8px",
          borderRadius: "9999px",
          fontSize: "10.5px",
          fontWeight: 800,
          background: isDark ? "rgba(220, 38, 38, 0.2)" : "#FEF2F2",
          color: isDark ? "#FCA5A5" : "#DC2626",
          border: isDark ? "1px solid rgba(220, 38, 38, 0.4)" : "1px solid #FECDD3",
          userSelect: "none",
          whiteSpace: "nowrap",
          letterSpacing: "0.2px",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#DC2626",
            display: "inline-block",
            boxShadow: "0 0 4px rgba(220, 38, 38, 0.6)",
          }}
        />
        {isUnassigned
          ? (isHi ? "आपातकालीन - असाइन नहीं" : "Emergency - unassigned")
          : (isHi ? "आपातकालीन" : "Emergency")}
      </span>
      {timeSinceArrival && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "11px",
            fontWeight: 700,
            color: isDark ? "#FCA5A5" : "#DC2626",
            whiteSpace: "nowrap",
          }}
          title={isHi ? "आगमन का समय" : "Time since arrival"}
        >
          <Clock size={11} style={{ flexShrink: 0 }} />
          {timeSinceArrival}
        </span>
      )}
    </div>
  );
}

const deskScopeModule = {
  isEmergencyTicket,
  formatTimeSinceArrival,
  resolveAssignedDesk,
  getDeskScope,
  scopeTicketsForDesk,
  useAssignedDesk,
  DeskDepartmentBadge,
  EmergencyDeskBanner,
  NoDeskNotice,
  EmergencyBadge,
};

export default deskScopeModule;

