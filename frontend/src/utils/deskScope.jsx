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
export function DeskDepartmentBadge({ deskScope, assignedDesk, isDark = false, language = "en", customStyle = "" }) {
  const isEmergency = deskScope?.isEmergencyDesk;
  const isHi = language === "hi";

  if (isEmergency) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border shadow-xs ${
          isDark
            ? "bg-rose-950/40 text-rose-300 border-rose-900/60"
            : "bg-rose-50 text-rose-700 border-rose-200"
        } ${customStyle}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        {isHi ? "आपातकालीन ट्राइएज डेस्क" : "Emergency Triage Desk"}
      </span>
    );
  }

  const deptLabel = deskScope?.deptName || assignedDesk?.desk_name || (isHi ? "सामान्य डेस्क" : "General Desk");
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs ${
        isDark
          ? "bg-slate-800 text-slate-300 border-slate-700"
          : "bg-slate-100 text-slate-700 border-slate-200"
      } ${customStyle}`}
    >
      <Building2 className="w-3 h-3 text-slate-400" />
      {deptLabel}
    </span>
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
      className={`mb-4 px-4 py-3 rounded-xl border flex items-center gap-3 shadow-xs ${
        isDark
          ? "bg-rose-950/30 border-rose-900/60 text-rose-200"
          : "bg-rose-50 border-rose-200 text-rose-900"
      }`}
    >
      <div className={`p-2 rounded-lg ${isDark ? "bg-rose-900/50 text-rose-300" : "bg-rose-100 text-rose-600"}`}>
        <ShieldAlert className="w-5 h-5 shrink-0" />
      </div>
      <div className="flex-1 text-sm font-medium">
        <p className="font-semibold text-rose-700 dark:text-rose-300">
          {isHi ? "आपातकालीन ट्राइएज मोड सक्रिय" : "Emergency Triage Mode Active"}
        </p>
        <p className="text-xs text-rose-600/90 dark:text-rose-300/80 mt-0.5">
          {isHi
            ? "आप आपातकालीन ट्राइएज डेस्क पर नियुक्त हैं। केवल आपातकालीन मरीज दिखाए जा रहे हैं।"
            : "You are assigned to the Emergency Triage desk. Showing emergency patients only."}
        </p>
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
      className={`mb-4 px-4 py-3 rounded-xl border flex items-center gap-3 shadow-xs ${
        isDark
          ? "bg-amber-950/30 border-amber-900/50 text-amber-200"
          : "bg-amber-50 border-amber-200 text-amber-900"
      }`}
    >
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold">
          {isHi ? "कोई डेस्क असाइन नहीं है।" : "No desk assigned."}
        </span>{" "}
        <span className="opacity-90">
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
  const timeSinceArrival = showTime ? formatTimeSinceArrival(ticket.join_timestamp, language) : null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide border shadow-2xs ${
          isDark
            ? "bg-rose-950/50 text-rose-300 border-rose-900/60"
            : "bg-rose-50 text-rose-700 border-rose-200"
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        {isUnassigned
          ? (isHi ? "आपातकालीन - असाइन नहीं" : "Emergency - unassigned")
          : (isHi ? "आपातकालीन" : "Emergency")}
      </span>
      {timeSinceArrival && (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium opacity-80 ${
            isDark ? "text-rose-300/80" : "text-rose-700/80"
          }`}
          title={isHi ? "आगमन का समय" : "Time since arrival"}
        >
          <Clock className="w-3 h-3" />
          {timeSinceArrival}
        </span>
      )}
    </div>
  );
}

const deskScope = {
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

export default deskScope;

