/**
 * App.jsx
 * -------
 * Clean Top-Level Router & Real-Time Socket.IO Provider.
 * Theme: Soft Green Clinical (Clean Healthcare Palette 4)
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { API_BASE, WS_URL, HOSPITAL_CONFIG } from "./config/hospitalConfig";

// Modular Components & Pages
import Header from "./components/common/Header";
import AuthModal from "./components/common/AuthModal";
import AccessDeniedGuard from "./components/common/AccessDeniedGuard";
import MandatoryAuthScreen from "./components/common/MandatoryAuthScreen";
import ErrorBoundary from "./components/common/ErrorBoundary";

import PatientPage from "./pages/PatientPage";
import DoctorPage from "./pages/DoctorPage";
import StaffPortalPage from "./pages/StaffPortalPage";
import MLAdminPage from "./pages/MLAdminPage";
import DatabaseInspectorPage from "./pages/DatabaseInspectorPage";
import KioskPage from "./pages/KioskPage";
import SuperAdminPage from "./pages/SuperAdminPage";

import { announceTicketVoice } from "./utils/voiceSynthesizer";
import { updateBrowserTabBrand } from "./utils/dynamicFavicon";

export function getInitialPage(user) {
  let effectiveUser = user;
  if (!effectiveUser && typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("ai_queue_user");
      if (saved) effectiveUser = JSON.parse(saved);
    } catch (e) {}
  }
  const userRole = effectiveUser ? (effectiveUser.role || "").toLowerCase() : "";
  const isSuperAdminUser = userRole === "super_admin" || userRole === "superadmin" || effectiveUser?.email === "superadmin@hospital.com" || effectiveUser?.is_superadmin;
  const isDoctorUser = userRole === "doctor" || userRole === "physician";
  const isStaffUser = ["staff", "receptionist", "nurse"].includes(userRole);
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith("/kiosk") || path.includes("kiosk") || path.includes("tv")) return "kiosk";

  const params = new URLSearchParams(window.location.search);
  const pageParam = params.get("page") || params.get("view");
  if (pageParam && pageParam.toLowerCase() !== "hub") {
    const p = pageParam.toLowerCase();
    if (p === "kiosk" || p === "tv") return "kiosk";
    if (["superadmin", "super_admin", "super-admin", "owner"].includes(p)) return "superadmin";
    if (["doctor"].includes(p)) {
      if (isStaffUser && !isDoctorUser) return "staff";
      return "doctor";
    }
    if (["staff", "reception", "desk"].includes(p)) {
      if (isDoctorUser) return "doctor";
      return "staff";
    }
    if (["admin", "ml"].includes(p)) return "admin";
    if (["db", "database"].includes(p)) return "db";
    // Tab aliases for the patient portal should route to patient page
    if (["patient", "history", "appointment_history", "past_appointments", "my_apts", "appointments", "my_appointments", "book", "family"].includes(p)) {
      if (isSuperAdminUser) return "superadmin";
      if (isDoctorUser) return "doctor";
      if (isStaffUser) return "staff";
      return "patient";
    }
    return p;
  }

  if (path.includes("superadmin") || path.includes("super_admin") || path.includes("super-admin")) return "superadmin";
  if (path.includes("doctor")) {
    if (isStaffUser && !isDoctorUser) return "staff";
    return "doctor";
  }
  if (path.includes("staff") || path.includes("reception")) {
    if (isDoctorUser) return "doctor";
    return "staff";
  }
  if (path.includes("admin") || path.includes("ml")) return "admin";
  if (path.includes("db") || path.includes("database")) return "db";
  if (path.includes("patient") || path.includes("history") || path.includes("appointment")) {
    if (isSuperAdminUser) return "superadmin";
    if (isDoctorUser) return "doctor";
    if (isStaffUser) return "staff";
    return "patient";
  }

  if (isSuperAdminUser) return "superadmin";
  if (isDoctorUser) return "doctor";
  if (isStaffUser) return "staff";

  return "patient";
}

export default function App() {
  // User Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const p = new URLSearchParams(window.location.search);
        const m = p.get("mode") || p.get("auth") || p.get("page") || p.get("view");
        if (m && (m.includes("reg") || m.includes("signup"))) return null;
      }
      const saved = localStorage.getItem("ai_queue_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Family Profile State (Patient/User role only)
  const [familyMembers, setFamilyMembers] = useState([]);
  const [activeFamilyMember, setActiveFamilyMember] = useState(null); // null = self

  const [currentHospitalTenant, setCurrentHospitalTenant] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const parts = path.split("/").filter(Boolean);
        const kioskIdx = parts.findIndex((p) => p.toLowerCase() === "kiosk");
        if (kioskIdx !== -1 && parts[kioskIdx + 1]) {
          return parts[kioskIdx + 1];
        }

        const p = new URLSearchParams(window.location.search);
        const urlHosp = p.get("hospital") || p.get("tenant") || p.get("facility");
        if (urlHosp) return urlHosp;
      }
      const savedHosp = localStorage.getItem("ai_queue_current_hospital");
      if (savedHosp) return savedHosp;
      const saved = localStorage.getItem("ai_queue_user");
      if (saved) {
        const u = JSON.parse(saved);
        if (u && u.hospital_code && u.hospital_code !== "all") return u.hospital_code;
      }
    } catch (e) {}
    return HOSPITAL_CONFIG.tenantId;
  });

  const [activePage, setActivePage] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_user");
      const u = saved ? JSON.parse(saved) : null;
      return getInitialPage(u);
    } catch (e) {
      return "patient";
    }
  });
  const [currentTab, setCurrentTab] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (tabParam && ["walkin", "book", "my_apts", "history", "family"].includes(tabParam.toLowerCase())) {
          return tabParam.toLowerCase();
        }
        const pageParam = (params.get("page") || params.get("view") || "").toLowerCase();
        if (["history", "appointment_history", "past_appointments"].includes(pageParam)) return "history";
        if (["my_apts", "appointments", "my_appointments"].includes(pageParam)) return "my_apts";
        if (["book", "booking", "schedule"].includes(pageParam)) return "book";
        if (["family", "dependents"].includes(pageParam)) return "family";
        const path = window.location.pathname.toLowerCase();
        if (path.includes("history")) return "history";
        if (path.includes("appointment")) return "my_apts";
      }
    } catch (e) {}
    return "walkin";
  });
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_theme");
      if (saved === "dark" || saved === "light") return saved;
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch (e) {}
    return "light";
  });

  useEffect(() => {
    try {
      localStorage.setItem("ai_queue_theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      if (theme === "dark" && (activePage === "patient" || activePage === "superadmin" || activePage === "staff" || activePage === "doctor" || activePage === "admin")) {
        document.body.classList.add("theme-dark");
        document.body.style.backgroundColor = "#090D16";
        document.body.style.color = "#F1F5F9";
      } else {
        document.body.classList.remove("theme-dark");
        document.body.style.backgroundColor = "#F8FAFC";
        document.body.style.color = "#0F172A";
      }
    } catch (e) {}
  }, [theme, activePage]);

  useEffect(() => {
    const handleThemeChange = (e) => {
      const newTheme = typeof e?.detail === "string" ? e.detail : e?.detail?.theme;
      if (newTheme && (newTheme === "dark" || newTheme === "light")) {
        setTheme(newTheme);
      }
    };
    window.addEventListener("theme_changed", handleThemeChange);
    return () => window.removeEventListener("theme_changed", handleThemeChange);
  }, []);

  const tenantId =
    (currentUser && ["admin", "doctor", "staff", "receptionist"].includes((currentUser.role || "").toLowerCase()) && (currentUser.hospital_code || currentUser.primary_hospital_code) && (currentUser.hospital_code || currentUser.primary_hospital_code) !== "all" && activePage !== "patient")
      ? (currentUser.hospital_code || currentUser.primary_hospital_code)
      : (currentHospitalTenant || HOSPITAL_CONFIG.tenantId || "city-hospital-01");

  // Global White-Label Hospital Branding State
  const [hospitalBranding, setHospitalBranding] = useState(null);

  const fetchBranding = useCallback((hCode) => {
    if (!hCode) return;
    const cleanCode = String(hCode).trim();
    fetch(`${API_BASE}/api/v1/hospital/branding/${cleanCode}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success" && d.branding) {
          setHospitalBranding(d.branding);
        }
      })
      .catch((e) => console.log("Branding fetch error in App:", e));
  }, []);

  useEffect(() => {
    const activeCode =
      (currentUser && ["admin", "doctor", "staff", "receptionist"].includes(currentUser.role) && currentUser.hospital_code && currentUser.hospital_code !== "all")
        ? currentUser.hospital_code
        : (currentHospitalTenant || HOSPITAL_CONFIG.tenantId);
    fetchBranding(activeCode);
  }, [currentHospitalTenant, currentUser, fetchBranding]);

  useEffect(() => {
    if (hospitalBranding?.primary_color) {
      document.documentElement.style.setProperty("--brand-primary", hospitalBranding.primary_color);
    }
    if (hospitalBranding?.secondary_color) {
      document.documentElement.style.setProperty("--brand-secondary", hospitalBranding.secondary_color);
    }
    if (hospitalBranding?.accent_color) {
      document.documentElement.style.setProperty("--brand-accent", hospitalBranding.accent_color);
    }
  }, [hospitalBranding]);

  // Dynamic Browser Tab Favicon and Title Scoped Exclusively to Hospital-Affiliated Patients and Staff
  useEffect(() => {
    const role = (currentUser?.role || "").toLowerCase();
    const isSuperAdminGlobal = Boolean(
      activePage === "superadmin" ||
      role === "super_admin" ||
      role === "superadmin"
    );

    const isStaffAffiliate = Boolean(
      currentUser &&
      ["admin", "doctor", "staff", "receptionist"].includes(role) &&
      currentUser.hospital_code &&
      currentUser.hospital_code !== "all" &&
      activePage !== "superadmin"
    );

    const isPatientAffiliate = Boolean(
      currentUser &&
      (activePage === "patient" || activePage === "kiosk" || role === "user" || role === "patient") &&
      activePage !== "superadmin"
    );

    // Only apply hospital brand logo in tab for patients and staff of that hospital; never in super admin portal
    const isAffiliate = (isStaffAffiliate || isPatientAffiliate) && !isSuperAdminGlobal && activePage !== "superadmin";

    updateBrowserTabBrand({
      logoUrl: hospitalBranding?.logo_url,
      hospitalName: hospitalBranding?.hospital_name || hospitalBranding?.name,
      isAffiliate,
      isSuperAdmin: isSuperAdminGlobal,
      role,
    });
  }, [hospitalBranding, currentUser, activePage]);

  useEffect(() => {
    const handleBrandingEvent = (e) => {
      const targetCode = e?.detail?.hospital_code;
      const b = e?.detail?.branding || e?.detail;
      if (!b) return;

      const activeCode =
        (currentUser && ["admin", "doctor", "staff", "receptionist"].includes(currentUser.role) && currentUser.hospital_code && currentUser.hospital_code !== "all")
          ? currentUser.hospital_code
          : (currentHospitalTenant || HOSPITAL_CONFIG.tenantId);

      // Only apply branding updates if the event is for the hospital currently active/affiliated
      if (!targetCode || String(targetCode).trim().toLowerCase() === String(activeCode).trim().toLowerCase()) {
        setHospitalBranding((prev) => ({ ...prev, ...b }));
      }
    };
    window.addEventListener("hospital_branding_updated", handleBrandingEvent);
    return () => window.removeEventListener("hospital_branding_updated", handleBrandingEvent);
  }, [currentUser, currentHospitalTenant]);

  const navigateTo = useCallback((page, tab = null) => {
    let targetPage = page;
    let targetTab = tab;

    // Gracefully handle alias pages so they resolve directly
    const lower = (page || "").toLowerCase();
    if (["superadmin", "super_admin", "super-admin", "owner"].includes(lower)) {
      targetPage = "superadmin";
    } else if (["doctor", "doc"].includes(lower)) {
      targetPage = "doctor";
    } else if (["staff", "reception", "desk"].includes(lower)) {
      targetPage = "staff";
    } else if (["admin", "ml"].includes(lower)) {
      targetPage = "admin";
    } else if (["db", "database"].includes(lower)) {
      targetPage = "db";
    } else if (["history", "appointment_history", "past_appointments"].includes(lower)) {
      targetPage = "patient";
      targetTab = targetTab || "history";
    } else if (["my_apts", "appointments", "my_appointments"].includes(lower)) {
      targetPage = "patient";
      targetTab = targetTab || "my_apts";
    } else if (["book", "booking", "schedule"].includes(lower)) {
      targetPage = "patient";
      targetTab = targetTab || "book";
    } else if (["family", "dependents"].includes(lower)) {
      targetPage = "patient";
      targetTab = targetTab || "family";
    }

    setActivePage(targetPage);
    const effectiveTab = targetTab || (targetPage === "patient" ? (currentTab || "walkin") : null);
    if (effectiveTab) {
      setCurrentTab(effectiveTab);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("page", targetPage);
    if (effectiveTab && targetPage === "patient") {
      url.searchParams.set("tab", effectiveTab);
    } else if (targetPage !== "patient") {
      url.searchParams.delete("tab");
    }
    window.history.pushState({}, "", url.toString());
    window.dispatchEvent(new Event("popstate"));
  }, [currentTab]);

  // Sync state on browser back/forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const u = currentUser || (() => {
          try {
            const s = localStorage.getItem("ai_queue_user");
            return s ? JSON.parse(s) : null;
          } catch (e) { return null; }
        })();
        const p = getInitialPage(u);
        setActivePage(p);

        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        const pageParam = (params.get("page") || params.get("view") || "").toLowerCase();
        if (tabParam && ["walkin", "book", "my_apts", "history", "family"].includes(tabParam.toLowerCase())) {
          setCurrentTab(tabParam.toLowerCase());
        } else if (["history", "appointment_history", "past_appointments"].includes(pageParam)) {
          setCurrentTab("history");
        } else if (["my_apts", "appointments", "my_appointments"].includes(pageParam)) {
          setCurrentTab("my_apts");
        } else if (["book", "booking", "schedule"].includes(pageParam)) {
          setCurrentTab("book");
        } else if (["family", "dependents"].includes(pageParam)) {
          setCurrentTab("family");
        } else if (p === "patient") {
          setCurrentTab("walkin");
        }
      } catch (e) {}
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentUser]);

  // Auto-redirect privileged roles away from incorrect pages
  useEffect(() => {
    if (currentUser) {
      const r = (currentUser.role || "").toLowerCase();
      if ((r === "super_admin" || r === "superadmin") && activePage === "patient") {
        navigateTo("superadmin");
      } else if ((r === "doctor" || r === "physician") && (activePage === "patient" || activePage === "staff")) {
        // Logged-in doctor should immediately be on doctor consultation desk
        navigateTo("doctor");
      } else if (["staff", "receptionist", "nurse"].includes(r) && (activePage === "patient" || activePage === "doctor")) {
        // Logged-in staff/receptionist should immediately be on staff reception desk
        navigateTo("staff");
      } else if (["admin"].includes(r) && activePage === "patient") {
        navigateTo("doctor");
      }
    }
  }, [currentUser, activePage, navigateTo]);

  // Sync latest user profile on initial mount only if not already initialized
  useEffect(() => {
    if (currentUser?.email && !currentUser.hospital_code) {
      fetch(`${API_BASE}/api/v1/auth/me?email=${encodeURIComponent(currentUser.email)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success" && data.user) {
            setCurrentUser((prev) => {
              const updated = { ...prev, ...data.user };
              try {
                localStorage.setItem("ai_queue_user", JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
            const savedHosp = localStorage.getItem("ai_queue_current_hospital");
            if (!savedHosp && data.user.hospital_code && data.user.hospital_code !== "all") {
              setCurrentHospitalTenant(data.user.hospital_code);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setShowAuthModal(false);
    try {
      localStorage.setItem("ai_queue_user", JSON.stringify(userData));
    } catch (e) {}

    if (userData.hospital_code && userData.hospital_code !== "all") {
      setCurrentHospitalTenant(userData.hospital_code);
    }

    // Reset family state on new login
    setActiveFamilyMember(null);
    setFamilyMembers([]);

    // Fetch family members on login for unified patient experience
    fetchFamilyMembers(userData);

    // Role-based auto dashboard direct redirect (zero patient interference)
    const normalizedRole = (userData.role || "").toLowerCase();
    if (normalizedRole === "super_admin" || normalizedRole === "superadmin") {
      navigateTo("superadmin");
    } else if (normalizedRole === "doctor" || normalizedRole === "physician") {
      navigateTo("doctor");
    } else if (["staff", "receptionist", "nurse"].includes(normalizedRole)) {
      navigateTo("staff");
    } else if (normalizedRole === "admin") {
      navigateTo("doctor");
    } else {
      navigateTo("patient", "walkin");
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      try {
        fetch(`${API_BASE}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(currentUser.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
          },
          body: JSON.stringify({
            id: currentUser.id,
            email: currentUser.email,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch (e) {}
    }
    setCurrentUser(null);
    setActiveFamilyMember(null);
    setFamilyMembers([]);
    try {
      localStorage.removeItem("ai_queue_user");
    } catch (e) {}
    navigateTo("patient", "walkin");
  };

  // Fetch family members from backend
  const fetchFamilyMembers = useCallback((user) => {
    let savedUser = null;
    try {
      const s = localStorage.getItem("ai_queue_user");
      if (s) savedUser = JSON.parse(s);
    } catch (e) {}
    const u = user || currentUser || savedUser;
    const token = u?.token || localStorage.getItem("ai_queue_token");
    const validToken = token && token !== "undefined" && token !== "null" ? token : null;
    const ident = u?.email || u?.username || localStorage.getItem("last_patient_name") || "";
    const phone = u?.phone || "";

    const q = new URLSearchParams();
    if (ident) q.set("email", ident);
    if (phone) q.set("phone", phone);
    if (u?.id) q.set("user_id", String(u.id));

    fetch(`${API_BASE}/api/v1/family-members?${q.toString()}`, {
      headers: {
        ...(ident ? { "X-User-Email": ident } : {}),
        ...(phone ? { "X-User-Phone": phone } : {}),
        ...(validToken ? { Authorization: `Bearer ${validToken}` } : {})
      }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "success" && Array.isArray(data.members)) {
          setFamilyMembers(data.members.filter((m) => m && m.id !== "self"));
        }
      })
      .catch((e) => console.log("Family members fetch error:", e));
  }, [currentUser]);

  // Real-time synchronization when family members are updated anywhere in the app (including other tabs)
  useEffect(() => {
    let bc = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("hospital_family_sync");
        bc.onmessage = (event) => {
          if (event.data?.type === "FAMILY_MEMBERS_UPDATED" && Array.isArray(event.data.members)) {
            setFamilyMembers(event.data.members.filter((m) => m && m.id !== "self"));
          } else if (event.data?.type === "FAMILY_TICKET_ADDED") {
            fetchFamilyMembers();
            if (event.data.famMap) {
              window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: event.data.famMap }));
            }
            if (event.data.ticket) {
              window.dispatchEvent(new CustomEvent("active_ticket_updated", { detail: event.data.ticket }));
            }
          } else {
            fetchFamilyMembers();
          }
        };
      }
    } catch (e) {}

    const handleFamilySync = (e) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setFamilyMembers((prev) => {
          const map = new Map((Array.isArray(prev) ? prev : []).map((m) => [m.id, m]));
          e.detail.forEach((m) => {
            if (m && m.id && m.id !== "self") map.set(m.id, m);
          });
          return Array.from(map.values());
        });
      } else {
        fetchFamilyMembers();
      }
    };

    const handleStorage = (e) => {
      if (e.key && e.key.startsWith("family_members_") && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFamilyMembers(parsed.filter((m) => m && m.id !== "self"));
          }
        } catch (err) {}
      }
    };

    window.addEventListener("family_members_updated", handleFamilySync);
    window.addEventListener("storage", handleStorage);
    return () => {
      if (bc) bc.close();
      window.removeEventListener("family_members_updated", handleFamilySync);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchFamilyMembers]);

  // Load family members when user is available
  useEffect(() => {
    fetchFamilyMembers(currentUser);
  }, [currentUser, fetchFamilyMembers]);

  // Handle profile switch from header
  const handleSwitchProfile = useCallback((member) => {
    setActiveFamilyMember(member);
    // Dispatch event so PatientPage can sync
    window.dispatchEvent(new CustomEvent("switch_patient_profile", { detail: member }));
  }, []);

  // Handle add family member from header
  const handleAddFamilyMemberFromHeader = useCallback(async (newMember) => {
    if (!currentUser || !currentUser.email) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/family-members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Email": currentUser.email
        },
        body: JSON.stringify(newMember)
      });
      const data = await res.json();
      if (data.status === "success" && data.member) {
        setFamilyMembers((prev) => [...prev, data.member]);
        window.dispatchEvent(new CustomEvent("family_members_updated", { detail: [...familyMembers, data.member] }));
        return data.member;
      }
    } catch (err) {
      console.log("Add family member error:", err);
    }
  }, [currentUser, familyMembers]);

  // Handle manage family members - navigate to patient page
  const handleManageFamilyMembers = useCallback(() => {
    navigateTo("patient", "family");
  }, [navigateTo]);

  // Real-time Queue State
  const [analytics, setAnalytics] = useState(null);
  const [queueSnapshot, setQueueSnapshot] = useState([]);
  const [servingTickets, setServingTickets] = useState([]);
  const [heldTickets, setHeldTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_active_ticket");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && ["waiting", "serving", "on_hold", "hold"].includes(String(parsed.status || "").toLowerCase())) {
          return parsed;
        }
        localStorage.removeItem("ai_queue_active_ticket");
      }
      return null;
    } catch (e) {
      return null;
    }
  });
  const [ticketQrData, setTicketQrData] = useState(null);
  const [kioskQrData, setKioskQrData] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [language, setLanguage] = useState("en"); // 'en' | 'hi'
  const socketRef = useRef(null);
  const languageRef = useRef(language);
  const activeTicketRef = useRef(activeTicket);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    activeTicketRef.current = activeTicket;
    try {
      if (
        activeTicket &&
        activeTicket.ticket_id &&
        ["waiting", "serving", "on_hold", "hold"].includes(String(activeTicket.status || "").toLowerCase())
      ) {
        localStorage.setItem("ai_queue_active_ticket", JSON.stringify(activeTicket));
      } else {
        localStorage.removeItem("ai_queue_active_ticket");
      }
    } catch (e) {}
  }, [activeTicket]);

  // Ensure QR code is loaded whenever activeTicket is restored or active
  useEffect(() => {
    if (
      activeTicket &&
      activeTicket.ticket_id &&
      ["waiting", "serving", "on_hold", "hold"].includes(String(activeTicket.status || "").toLowerCase()) &&
      !ticketQrData
    ) {
      fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${activeTicket.ticket_id}`)
        .then((r) => r.json())
        .then((qr) => setTicketQrData(qr))
        .catch((e) => console.log("QR error in App:", e));
    }
  }, [activeTicket?.ticket_id, activeTicket?.status, ticketQrData]);

  // Verify activeTicket status against backend on mount or whenever ticket_id changes
  useEffect(() => {
    if (!activeTicket?.ticket_id) return;
    fetch(`${API_BASE}/api/v1/plugin/ticket/${activeTicket.ticket_id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.status === "success" && d.ticket) {
          const live = ["waiting", "serving", "on_hold", "hold"].includes(
            String(d.ticket.status || "").toLowerCase()
          );
          if (!live) {
            setActiveTicket(null);
            setTicketQrData(null);
            try {
              localStorage.removeItem("ai_queue_active_ticket");
            } catch (e) {}
          } else {
            setActiveTicket((prev) => ({ ...prev, ...d.ticket }));
          }
        }
      })
      .catch((e) => console.log("Ticket verification error in App:", e));
  }, [activeTicket?.ticket_id]);

  // Auto-restore active ticket and sync family tickets from history on mount / login / event
  useEffect(() => {
    const handleActiveTicketBroadcast = (e) => {
      if (e?.detail && e.detail.ticket_id) {
        const t = e.detail;
        const depNames = (familyMembers || [])
          .filter((m) => m && m.id !== "self")
          .map((m) => String(m.name || "").toLowerCase().trim())
          .filter(Boolean);
        const isDep = (t.family_member_id && t.family_member_id !== "self") || (t.name && depNames.includes(String(t.name).toLowerCase().trim()));

        if (activeFamilyMember) {
          const curMemName = String(activeFamilyMember.name || "").toLowerCase().trim();
          const curMemId = String(activeFamilyMember.id);
          if (String(t.family_member_id) === curMemId || String(t.name || "").toLowerCase().trim() === curMemName) {
            setActiveTicket(t);
          }
        } else {
          if (!isDep) {
            setActiveTicket(t);
          }
        }
      }
    };
    window.addEventListener("active_ticket_updated", handleActiveTicketBroadcast);

    const ident =
      currentUser?.email ||
      currentUser?.phone ||
      currentUser?.username ||
      localStorage.getItem("last_patient_name") ||
      "";
    if (!ident.trim()) return () => window.removeEventListener("active_ticket_updated", handleActiveTicketBroadcast);

    fetch(`${API_BASE}/api/v1/plugin/tickets/history/${encodeURIComponent(ident.trim())}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.tickets)) {
          const liveTickets = d.tickets.filter((t) =>
            ["waiting", "serving", "on_hold", "hold"].includes(String(t.status || "").toLowerCase())
          );

          const depList = (familyMembers || []).filter((m) => m && m.id !== "self");
          const depNames = depList.map((m) => String(m.name || "").toLowerCase().trim()).filter(Boolean);

          // 1. Map tickets to family tickets dictionary
          const activeTicketsMap = {};
          liveTickets.forEach((t) => {
            const tName = String(t.name || "").toLowerCase().trim();
            const matchingDep = depList.find((m) =>
              (t.family_member_id && String(t.family_member_id) === String(m.id)) ||
              (tName && String(m.name || "").toLowerCase().trim() === tName)
            );

            if (matchingDep) {
              activeTicketsMap[matchingDep.id] = t;
              activeTicketsMap[String(matchingDep.id)] = t;
              if (matchingDep.name) {
                activeTicketsMap[`name_${matchingDep.name.toLowerCase().trim()}`] = t;
                activeTicketsMap[matchingDep.name.toLowerCase().trim()] = t;
              }
            } else if (!t.family_member_id || t.family_member_id === "self") {
              if (!depNames.includes(tName)) {
                activeTicketsMap["self"] = t;
              }
            }
            if (t.name) {
              activeTicketsMap[`name_${tName}`] = t;
            }
          });

          // Sync into localStorage & dispatch event so PatientPage and Header update instantly
          const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
          try {
            const saved = localStorage.getItem(ticketStorageKey);
            const currentMap = saved ? JSON.parse(saved) : {};
            if (currentMap["self"]) {
              const selfTName = String(currentMap["self"].name || "").toLowerCase().trim();
              if (depNames.includes(selfTName) || (currentMap["self"].family_member_id && currentMap["self"].family_member_id !== "self")) {
                delete currentMap["self"];
              }
            }
            const merged = { ...currentMap, ...activeTicketsMap };
            localStorage.setItem(ticketStorageKey, JSON.stringify(merged));
            window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: merged }));
          } catch (e) {}

          // 2. Set primary active ticket if present
          const selfActiveTicket = liveTickets.find((t) => {
            const tName = String(t.name || "").toLowerCase().trim();
            const isDep = (t.family_member_id && t.family_member_id !== "self") || depNames.includes(tName);
            return !isDep;
          });

          if (activeFamilyMember) {
            const curMemName = String(activeFamilyMember.name || "").toLowerCase().trim();
            const curMemId = String(activeFamilyMember.id);
            const depTicket = liveTickets.find((t) =>
              String(t.family_member_id) === curMemId || String(t.name || "").toLowerCase().trim() === curMemName
            );
            setActiveTicket(depTicket || null);
          } else {
            if (selfActiveTicket) {
              setActiveTicket((prev) => {
                if (!prev || prev.ticket_id !== selfActiveTicket.ticket_id) {
                  return selfActiveTicket;
                }
                return { ...prev, ...selfActiveTicket };
              });
            } else {
              // No live tickets found for self; clear stale self active ticket
              setActiveTicket(null);
              setTicketQrData(null);
              try {
                localStorage.removeItem("ai_queue_active_ticket");
              } catch (e) {}
            }
          }
        }
      })
      .catch((e) => console.log("Active ticket restore error:", e));

    return () => window.removeEventListener("active_ticket_updated", handleActiveTicketBroadcast);
  }, [currentUser, familyMembers, activeFamilyMember]);

  // Sync page & tab state when URL changes
  useEffect(() => {
    const handlePopState = () => {
      setActivePage(getInitialPage());
      const params = new URLSearchParams(window.location.search);
      setCurrentTab(params.get("tab") || "walkin");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const isSuperAdmin = Boolean(
    currentUser && (
      currentUser.role === "super_admin" ||
      currentUser.role === "superadmin" ||
      (currentUser.role || "").toLowerCase() === "super_admin" ||
      (currentUser.role || "").toLowerCase() === "superadmin" ||
      currentUser.email === "superadmin@hospital.com" ||
      currentUser.is_superadmin === true
    )
  );
  const isStaffOrAdmin = currentUser && ["admin", "doctor", "staff", "receptionist"].includes((currentUser.role || "").toLowerCase());
  const isAdmin = isStaffOrAdmin;
  const userRole = (currentUser?.role || "").toLowerCase();
  const isPatientOrGuest = !currentUser || userRole === "user" || userRole === "patient";
  const isDoctorAccess = Boolean(currentUser) && (
    ["doctor", "physician", "admin"].includes(userRole) || isSuperAdmin
  );
  const isStaffAccess = Boolean(currentUser) && (
    ["staff", "receptionist", "nurse", "admin"].includes(userRole) || isSuperAdmin
  );
  const canAccessDbInspector =
    Boolean(currentUser) &&
    userRole !== "doctor" &&
    ["receptionist", "staff", "super_admin", "superadmin", "admin"].includes(userRole);
  const adminDepartment = currentUser && currentUser.department ? currentUser.department.toLowerCase() : "all";
  const adminDeptRef = useRef(adminDepartment);
  const activePageRef = useRef(activePage);
  const isAdminRef = useRef(isAdmin);

  useEffect(() => {
    adminDeptRef.current = adminDepartment;
    activePageRef.current = activePage;
    isAdminRef.current = isAdmin;
  }, [adminDepartment, activePage, isAdmin]);

  // Socket.IO Connection Setup
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      auth: { tenant_id: tenantId }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("join_room", { tenant_id: tenantId });
    });

    socket.on("disconnect", () => setSocketConnected(false));

    const handleQueueSync = (data) => {
      const dept = adminDeptRef.current;
      const snap = data.snapshot || [];
      const srv = data.serving || [];
      const hld = data.held || [];

      if (data.snapshot) {
        setQueueSnapshot(dept && dept !== "all" ? snap.filter(t => (t.service_category || "").toLowerCase() === dept) : snap);
      }
      if (data.serving) {
        setServingTickets(dept && dept !== "all" ? srv.filter(t => (t.service_category || "").toLowerCase() === dept) : srv);
      }
      if (data.held) {
        setHeldTickets(dept && dept !== "all" ? hld.filter(t => (t.service_category || "").toLowerCase() === dept) : hld);
      }
      if (data.analytics) setAnalytics(data.analytics);

      // Sync active ticket across snapshot, serving, and held
      const cur = activeTicketRef.current;
      if (cur && cur.ticket_id) {
        const match =
          snap.find((t) => t.ticket_id === cur.ticket_id) ||
          srv.find((t) => t.ticket_id === cur.ticket_id) ||
          hld.find((t) => t.ticket_id === cur.ticket_id);
        if (match) {
          const s = String(match.status || "").toLowerCase();
          if (["waiting", "serving", "on_hold", "hold"].includes(s)) {
            setActiveTicket((prev) => ({ ...prev, ...match }));
            try {
              localStorage.setItem("ai_queue_active_ticket", JSON.stringify({ ...(cur || {}), ...match }));
            } catch (e) {}
          } else {
            setActiveTicket(null);
            setTicketQrData(null);
            try {
              localStorage.removeItem("ai_queue_active_ticket");
            } catch (e) {}
          }
        }
      }
      window.dispatchEvent(new CustomEvent("queue_updated_live", { detail: data }));
    };

    socket.on("queue_update", handleQueueSync);
    socket.on("queue_updated", handleQueueSync);

    socket.on("ticket_cancelled", (data) => {
      const tId = data?.ticket?.ticket_id || data?.ticket_id;
      if (tId) {
        const cur = activeTicketRef.current;
        if (cur && cur.ticket_id === tId) {
          setActiveTicket(null);
          setTicketQrData(null);
          try {
            localStorage.removeItem("ai_queue_active_ticket");
          } catch (e) {}
        }
        // Also cleanup family tickets in localStorage
        try {
          const u = currentUser;
          const idents = [u?.username, u?.email, u?.phone, "guest"].filter(Boolean);
          idents.forEach((k) => {
            const famKey = `family_tickets_${k}`;
            const s = localStorage.getItem(famKey);
            if (s) {
              const m = JSON.parse(s);
              let changed = false;
              Object.keys(m).forEach((mk) => {
                if (m[mk]?.ticket_id === tId) {
                  delete m[mk];
                  changed = true;
                }
              });
              if (changed) {
                localStorage.setItem(famKey, JSON.stringify(m));
                window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: m }));
              }
            }
          });
        } catch (e) {}
        window.dispatchEvent(new CustomEvent("ticket_cancelled", { detail: data }));
      }
      refreshData();
    });

    const handleTicketUpdated = (data) => {
      const t = data?.ticket;
      const tid = t?.ticket_id || data?.ticket_id;
      if (t && tid) {
        const cur = activeTicketRef.current;
        if (cur && cur.ticket_id === tid) {
          const s = String(t.status || "").toLowerCase();
          if (["waiting", "serving", "on_hold", "hold"].includes(s)) {
            setActiveTicket(t);
            try {
              localStorage.setItem("ai_queue_active_ticket", JSON.stringify(t));
            } catch (e) {}
          } else {
            setActiveTicket(null);
            setTicketQrData(null);
            try {
              localStorage.removeItem("ai_queue_active_ticket");
            } catch (e) {}
          }
        }
        // Also sync family tickets in localStorage
        try {
          const u = currentUser;
          const idents = [u?.username, u?.email, u?.phone, "guest"].filter(Boolean);
          idents.forEach((k) => {
            const famKey = `family_tickets_${k}`;
            const s = localStorage.getItem(famKey);
            if (s) {
              const m = JSON.parse(s);
              let changed = false;
              Object.keys(m).forEach((mk) => {
                if (m[mk]?.ticket_id === tid) {
                  m[mk] = { ...m[mk], ...t };
                  changed = true;
                }
              });
              if (changed) {
                localStorage.setItem(famKey, JSON.stringify(m));
                window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: m }));
              }
            }
          });
        } catch (e) {}
      }
      window.dispatchEvent(new CustomEvent("active_ticket_updated", { detail: t || data }));
      refreshData();
    };

    socket.on("ticket_updated", handleTicketUpdated);
    socket.on("priority_changed", handleTicketUpdated);
    socket.on("ticket_held", handleTicketUpdated);
    socket.on("ticket_recalled", handleTicketUpdated);

    socket.on("ticket_completed", (data) => {
      if (data && (data.ticket || data.ticket_id)) {
        const tId = data.ticket?.ticket_id || data.ticket_id;
        const cur = activeTicketRef.current;
        if (cur && cur.ticket_id === tId) {
          setActiveTicket(null);
          setTicketQrData(null);
          try {
            localStorage.removeItem("ai_queue_active_ticket");
          } catch (e) {}
        }
        try {
          const u = currentUser;
          const idents = [u?.username, u?.email, u?.phone, "guest"].filter(Boolean);
          idents.forEach((k) => {
            const famKey = `family_tickets_${k}`;
            const s = localStorage.getItem(famKey);
            if (s) {
              const m = JSON.parse(s);
              let changed = false;
              Object.keys(m).forEach((mk) => {
                if (m[mk]?.ticket_id === tId) {
                  delete m[mk];
                  changed = true;
                }
              });
              if (changed) {
                localStorage.setItem(famKey, JSON.stringify(m));
                window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: m }));
              }
            }
          });
        } catch (e) {}
      }
      refreshData();
    });

    socket.on("prescription_saved", handleTicketUpdated);

    socket.on("analytics_update", (data) => {
      if (data) setAnalytics(data);
    });

    socket.on("hospital_branding_updated", (data) => {
      if (data && data.branding) {
        const targetCode = data.hospital_code || data.branding.hospital_code;
        const activeCode =
          (currentUser && ["admin", "doctor", "staff", "receptionist"].includes(currentUser.role) && currentUser.hospital_code && currentUser.hospital_code !== "all")
            ? currentUser.hospital_code
            : (currentHospitalTenant || HOSPITAL_CONFIG.tenantId);

        if (!targetCode || String(targetCode).trim().toLowerCase() === String(activeCode).trim().toLowerCase()) {
          setHospitalBranding((prev) => ({ ...prev, ...data.branding }));
        }
      }
    });

    socket.on("ticket_transferred", (data) => {
      if (data && data.new_ticket) {
        const origId = data.original_ticket?.ticket_id;
        const newT = data.new_ticket;
        const cur = activeTicketRef.current;
        if (cur && (cur.ticket_id === origId || cur.ticket_id === newT.ticket_id)) {
          setActiveTicket(newT);
          try {
            localStorage.setItem("ai_queue_active_ticket", JSON.stringify(newT));
          } catch (e) {}
          fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${newT.ticket_id}`)
            .then((r) => r.json())
            .then((qr) => setTicketQrData(qr))
            .catch((e) => console.log("QR fetch error:", e));
        }
        // Update family tickets
        try {
          const u = currentUser;
          const idents = [u?.username, u?.email, u?.phone, "guest"].filter(Boolean);
          idents.forEach((k) => {
            const famKey = `family_tickets_${k}`;
            const s = localStorage.getItem(famKey);
            if (s) {
              const m = JSON.parse(s);
              let changed = false;
              Object.keys(m).forEach((mk) => {
                if (m[mk]?.ticket_id === origId) {
                  m[mk] = { ...newT };
                  changed = true;
                }
              });
              if (changed) {
                localStorage.setItem(famKey, JSON.stringify(m));
                window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: m }));
              }
            }
          });
        } catch (e) {}
        window.dispatchEvent(new CustomEvent("active_ticket_updated", { detail: newT }));
      }
      refreshData();
    });

    socket.on("now_serving", (data) => {
      if (data && data.ticket) {
        const cur = activeTicketRef.current;
        if (cur && data.ticket.ticket_id === cur.ticket_id) {
          const newStatus = data.ticket.status === "serving" ? "serving" : (data.re_announced ? (cur.status || "waiting") : (data.ticket.status || "serving"));
          setActiveTicket((prev) => ({ ...prev, ...data.ticket, status: newStatus }));
        }

        // Only play audio chime & voice announcement on the Dedicated Waiting Room Kiosk TV (NOT on Patient/User Portal)
        if (activePageRef.current === "kiosk") {
          playChimeSound();
          announceTicketVoice(data.ticket, languageRef.current || "en");
        }
      }
    });

    socket.on("ticket_announced", (data) => {
      if (data && data.ticket) {
        if (activePageRef.current === "kiosk") {
          playChimeSound();
          announceTicketVoice(data.ticket, languageRef.current || "en");
        }
      }
    });

    socket.on("ticket_noshow", (data) => {
      const tid = data?.ticket_id;
      if (tid) {
        const cur = activeTicketRef.current;
        if (cur && cur.ticket_id === tid) {
          setActiveTicket(null);
          setTicketQrData(null);
          try {
            localStorage.removeItem("ai_queue_active_ticket");
          } catch (e) {}
        }
      }
      refreshData();
    });

    socket.on("serve_error", (data) => {
      if (data && data.message) {
        window.dispatchEvent(new CustomEvent("queue_serve_error", { detail: data }));
      }
    });

    socket.on("family_members_updated", (data) => {
      fetchFamilyMembers();
      window.dispatchEvent(new CustomEvent("family_members_updated", { detail: data }));
    });

    socket.on("ticket_created", (data) => {
      window.dispatchEvent(new CustomEvent("ticket_created", { detail: data }));
    });

    return () => socket.disconnect();
  }, [tenantId]);

  // Fetch Queue & Analytics with Department Security Boundary
  const refreshData = useCallback(() => {
    const deptQuery = adminDepartment && adminDepartment !== "all" ? `?department=${encodeURIComponent(adminDepartment)}` : "";

    fetch(`${API_BASE}/api/v1/plugin/analytics/${tenantId}${deptQuery}`)
      .then((r) => r.json())
      .then((d) => setAnalytics(d))
      .catch((e) => console.log("Analytics error:", e));

    fetch(`${API_BASE}/api/v1/plugin/queue/${tenantId}${deptQuery}`)
      .then((r) => r.json())
      .then((d) => {
        const snap = d.snapshot || [];
        const srv = d.serving || [];
        const hld = d.held || [];
        setQueueSnapshot(snap);
        setServingTickets(srv);
        setHeldTickets(hld);

        const cur = activeTicketRef.current;
        if (cur && cur.ticket_id) {
          const match =
            snap.find((t) => t.ticket_id === cur.ticket_id) ||
            srv.find((t) => t.ticket_id === cur.ticket_id) ||
            hld.find((t) => t.ticket_id === cur.ticket_id);
          if (match) {
            const s = String(match.status || "").toLowerCase();
            if (["waiting", "serving", "on_hold", "hold"].includes(s)) {
              setActiveTicket((prev) => ({ ...prev, ...match }));
            } else {
              setActiveTicket(null);
              setTicketQrData(null);
              try {
                localStorage.removeItem("ai_queue_active_ticket");
              } catch (e) {}
            }
          } else {
            // Ticket is no longer in live queue; verify if it was completed or departed
            fetch(`${API_BASE}/api/v1/plugin/ticket/${cur.ticket_id}`)
              .then((r) => r.json())
              .then((td) => {
                if (td && td.ticket) {
                  const s = String(td.ticket.status || "").toLowerCase();
                  if (!["waiting", "serving", "on_hold", "hold"].includes(s)) {
                    setActiveTicket(null);
                    setTicketQrData(null);
                    try {
                      localStorage.removeItem("ai_queue_active_ticket");
                    } catch (e) {}
                  }
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch((e) => console.log("Queue error:", e));

    fetch(`${API_BASE}/api/v1/plugin/qr/${tenantId}`)
      .then((r) => r.json())
      .then((d) => setKioskQrData(d))
      .catch((e) => console.log("QR error:", e));
  }, [tenantId, adminDepartment]);

  useEffect(() => {
    // When on superadmin, SuperAdminPage manages its own scoped telemetry; avoid 4s root App re-renders
    if (activePage === "superadmin") return;
    refreshData();
    const timer = setInterval(refreshData, 4000);
    return () => clearInterval(timer);
  }, [refreshData, activePage]);

  // Handle hospital facility switch from Header or Patient portal
  const handleSwitchHospital = useCallback((hospitalCode, hospitalName = null) => {
    if (!hospitalCode) return;
    const cleanCode = String(hospitalCode).trim();
    setCurrentHospitalTenant(cleanCode);
    try {
      localStorage.setItem("ai_queue_current_hospital", cleanCode);
    } catch (e) {}

    // Update URL query parameter
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("hospital", cleanCode);
      window.history.pushState({}, "", url.toString());
    } catch (e) {}

    // Reset active ticket / QR pass for prior facility queue
    setActiveTicket(null);
    setTicketQrData(null);
    setAnalytics(null);
    setQueueSnapshot([]);
    setServingTickets([]);
    setHeldTickets([]);

    // Immediately fetch new hospital telemetry
    fetch(`${API_BASE}/api/v1/plugin/analytics/${cleanCode}`)
      .then((r) => r.json())
      .then((d) => setAnalytics(d))
      .catch((e) => console.log("Analytics error on switch:", e));

    fetch(`${API_BASE}/api/v1/plugin/queue/${cleanCode}`)
      .then((r) => r.json())
      .then((d) => {
        setQueueSnapshot(d.snapshot || []);
        setServingTickets(d.serving || []);
        setHeldTickets(d.held || []);
      })
      .catch((e) => console.log("Queue error on switch:", e));

    // Update user's facility preference in local state and localStorage
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        hospital_code: cleanCode,
        ...(hospitalName ? { hospital_name: hospitalName } : {})
      };
      try {
        localStorage.setItem("ai_queue_user", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Also persist primary hospital choice to backend if user is logged in
    if (currentUser?.email) {
      fetch(`${API_BASE}/api/v1/auth/primary-hospital`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email, hospital_code: cleanCode }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.status === "success") {
            setCurrentUser((prev) => {
              if (!prev) return prev;
              const u = {
                ...prev,
                hospital_code: d.hospital_code,
                hospital_name: d.hospital_name || hospitalName || prev.hospital_name,
              };
              try {
                localStorage.setItem("ai_queue_user", JSON.stringify(u));
              } catch (e) {}
              return u;
            });
          }
        })
        .catch((e) => console.log("Primary hospital update error:", e));
    }

    // Notify listeners across components
    window.dispatchEvent(new CustomEvent("hospital_changed", { detail: cleanCode }));

    setTimeout(() => {
      refreshData();
    }, 100);
  }, [currentUser?.email, refreshData]);

  // Audio Chime
  const playChimeSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.log("Audio play error:", e);
    }
  };

  // Staff Desk Actions
  const handleServeNext = async () => {
    if (socketRef.current) {
      const dept = adminDepartment && adminDepartment !== "all" ? adminDepartment : undefined;
      socketRef.current.emit("serve_next", {
        tenant_id: tenantId,
        department: dept,
        service_category: dept,
        doctor_id: currentUser?.id,
        doctor_name: currentUser?.name || currentUser?.username,
        doctor_email: currentUser?.email,
      });
    }
  };

  const handleCompleteTicket = async (ticketId, prescriptionNotes = null) => {
    if (socketRef.current) {
      const dept = adminDepartment && adminDepartment !== "all" ? adminDepartment : undefined;
      socketRef.current.emit("complete_ticket", {
        tenant_id: tenantId,
        ticket_id: ticketId,
        department: dept,
        prescription_notes: prescriptionNotes,
      });
    }
  };

  const handleHoldTicket = async (ticketId, graceMinutes = 10) => {
    if (socketRef.current) {
      socketRef.current.emit("hold_ticket", {
        tenant_id: tenantId,
        ticket_id: ticketId,
        grace_minutes: graceMinutes,
      });
    } else {
      await fetch(`${API_BASE}/api/v1/plugin/hold-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, ticket_id: ticketId, grace_minutes: graceMinutes }),
      }).catch(() => {});
      refreshData();
    }
  };

  const handleRecallTicket = async (ticketId, targetMode = "auto") => {
    if (socketRef.current) {
      socketRef.current.emit("recall_ticket", {
        tenant_id: tenantId,
        ticket_id: ticketId,
        doctor_id: currentUser?.id,
        doctor_name: currentUser?.name || currentUser?.username,
        doctor_email: currentUser?.email,
        target_mode: targetMode,
      });
    } else {
      await fetch(`${API_BASE}/api/v1/plugin/recall-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          ticket_id: ticketId,
          doctor_id: currentUser?.id,
          doctor_name: currentUser?.name || currentUser?.username,
          doctor_email: currentUser?.email,
          target_mode: targetMode,
        }),
      }).catch(() => {});
      refreshData();
    }
  };

  const handleMarkNoShow = async (ticketId, reason = "Patient did not appear after grace period") => {
    if (socketRef.current) {
      socketRef.current.emit("mark_noshow", {
        tenant_id: tenantId,
        ticket_id: ticketId,
        reason,
      });
    } else {
      await fetch(`${API_BASE}/api/v1/plugin/no-show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, ticket_id: ticketId, reason }),
      }).catch(() => {});
      refreshData();
    }
  };

  const handleCounterChange = async (delta) => {
    const userRole = (currentUser?.role || "").toLowerCase();
    if (["doctor", "staff", "nurse", "receptionist"].includes(userRole)) {
      return;
    }
    const current = analytics ? analytics.active_counters : 2;
    const next = Math.max(1, current + delta);
    if (socketRef.current) socketRef.current.emit("set_counters", { tenant_id: tenantId, active_counters: next, role: userRole });
  };

  // Dedicated Independent Kiosk Portal (Full-Viewport, Zero Patient/Doctor Navbar, No Auth Required)
  if (activePage === "kiosk") {
    return (
      <ErrorBoundary fallbackTitle="Hospital Kiosk Display Error">
        <KioskPage
          tenantId={tenantId}
          analytics={analytics}
          servingTickets={servingTickets}
          queueSnapshot={queueSnapshot}
          kioskQrData={kioskQrData}
          language={language}
          setLanguage={setLanguage}
          navigateTo={navigateTo}
        />
      </ErrorBoundary>
    );
  }

  // Dedicated full-viewport view for unauthenticated login screen (no outer wrapper padding / scrolling)
  if (!currentUser) {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const urlMode = params ? (params.get("mode") || params.get("auth") || params.get("page") || params.get("view")) : null;
    const isRegMode = urlMode && (urlMode.includes("reg") || urlMode.includes("signup"));
    const initialAuthMode = isRegMode
      ? (urlMode.includes("super") || urlMode.includes("admin") ? "signup-superadmin" : "signup-patient")
      : "login";

    return (
      <div style={{ minHeight: "100vh", width: "100vw", overflowX: "hidden", margin: 0, padding: 0 }}>
        <MandatoryAuthScreen
          initialMode={initialAuthMode}
          onLoginSuccess={(user) => {
            handleLoginSuccess(user);
          }}
          language={language}
          setLanguage={setLanguage}
          navigateTo={navigateTo}
        />
        {showAuthModal && (
          <AuthModal
            authMode={authMode}
            setAuthMode={setAuthMode}
            onClose={() => setShowAuthModal(false)}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`app-main-layout-wrapper ${(activePage === "patient" || activePage === "superadmin" || activePage === "staff" || activePage === "doctor" || activePage === "admin") && theme === "dark" ? "dark-theme" : ""}`}
      style={(activePage === "patient" || activePage === "superadmin" || activePage === "staff" || activePage === "doctor" || activePage === "admin") && theme === "dark" ? darkAppBgStyle : appBgStyle}
    >
      <style>{`
        .app-main-layout-wrapper {
          min-height: 100vh;
          width: 100%;
          max-width: 100vw;
          overflow-x: hidden;
          box-sizing: border-box;
          padding: 18px 24px 8px 24px;
          transition: background-color 0.25s ease, color 0.25s ease;
        }
        @media (max-width: 1024px) {
          .app-main-layout-wrapper {
            padding: 14px 16px 8px 16px;
          }
        }
        @media (max-width: 640px) {
          .app-main-layout-wrapper {
            padding: 10px 8px 6px 8px;
          }
        }
        .app-main-layout-inner {
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .app-main-layout-inner.superadmin-wide {
          max-width: 1680px;
        }
      `}</style>
      <div className={`app-main-layout-inner ${activePage === "superadmin" ? "superadmin-wide" : ""}`}>
        {/* Top Navigation Header Bar */}
        <Header
          currentUser={currentUser}
          activePage={activePage}
          navigateTo={navigateTo}
          handleLogout={handleLogout}
          setShowAuthModal={setShowAuthModal}
          socketConnected={socketConnected}
          language={language}
          setLanguage={setLanguage}
          currentTab={currentTab}
          familyMembers={familyMembers}
          activeFamilyMember={activeFamilyMember}
          onSwitchProfile={handleSwitchProfile}
          onAddFamilyMember={handleAddFamilyMemberFromHeader}
          onManageFamilyMembers={handleManageFamilyMembers}
          currentHospitalTenant={currentHospitalTenant}
          onSwitchHospital={handleSwitchHospital}
          hospitalBranding={hospitalBranding}
          theme={theme}
          setTheme={setTheme}
        />

        {/* Main Content View with Access Control Guard */}
        <main style={mainContentStyle}>
          <>
            {activePage === "patient" && (
              !isPatientOrGuest ? (
                <AccessDeniedGuard
                  requiredRole="patient"
                  pageName="Patient Portal"
                  currentUser={currentUser}
                  onLoginSuccess={handleLoginSuccess}
                  navigateTo={navigateTo}
                />
              ) : (
                <ErrorBoundary>
                  <PatientPage
                    tenantId={tenantId}
                    currentUser={currentUser}
                    activeTicket={activeTicket}
                    setActiveTicket={setActiveTicket}
                    ticketQrData={ticketQrData}
                    setTicketQrData={setTicketQrData}
                    refreshData={refreshData}
                    language={language}
                    setLanguage={setLanguage}
                    navigateTo={navigateTo}
                    currentTab={currentTab}
                    analytics={analytics}
                    queueSnapshot={queueSnapshot}
                    servingTickets={servingTickets}
                    kioskQrData={kioskQrData}
                    socketConnected={socketConnected}
                    socketRef={socketRef}
                    familyMembers={familyMembers}
                    setFamilyMembers={setFamilyMembers}
                    activeFamilyMember={activeFamilyMember}
                    setActiveFamilyMember={setActiveFamilyMember}
                    onSwitchProfile={handleSwitchProfile}
                    onFamilyMembersChange={fetchFamilyMembers}
                    currentHospitalTenant={currentHospitalTenant}
                    onSwitchHospital={handleSwitchHospital}
                    hospitalBranding={hospitalBranding}
                    onUpdateHospitalBranding={setHospitalBranding}
                    theme={theme}
                  />
                </ErrorBoundary>
              )
            )}

            {activePage === "superadmin" && (
              !isSuperAdmin ? (
                <AccessDeniedGuard
                  requiredRole="super_admin"
                  pageName="Executive Super Admin Dashboard"
                  currentUser={currentUser}
                  onLoginSuccess={handleLoginSuccess}
                  navigateTo={navigateTo}
                  language={language}
                />
              ) : (
                <ErrorBoundary fallbackTitle="Super Admin Dashboard Error">
                  <SuperAdminPage
                    currentUser={currentUser}
                    language={language}
                    onSelectHospitalTenant={setCurrentHospitalTenant}
                    navigateTo={navigateTo}
                    hospitalBranding={hospitalBranding}
                    onUpdateHospitalBranding={setHospitalBranding}
                    theme={theme}
                    setTheme={setTheme}
                  />
                </ErrorBoundary>
              )
            )}

            {activePage === "doctor" && (
              !isDoctorAccess ? (
                <AccessDeniedGuard
                  requiredRole="doctor"
                  pageName="Doctor Consultation Desk"
                  currentUser={currentUser}
                  onLoginSuccess={handleLoginSuccess}
                  navigateTo={navigateTo}
                />
              ) : (
                <DoctorPage
                  tenantId={tenantId}
                  currentUser={currentUser}
                  analytics={analytics}
                  queueSnapshot={queueSnapshot}
                  servingTickets={servingTickets}
                  heldTickets={heldTickets}
                  handleServeNext={handleServeNext}
                  handleCompleteTicket={handleCompleteTicket}
                  handleHoldTicket={handleHoldTicket}
                  handleRecallTicket={handleRecallTicket}
                  handleMarkNoShow={handleMarkNoShow}
                  handleCounterChange={handleCounterChange}
                  refreshData={refreshData}
                  language={language}
                  socketRef={socketRef}
                  navigateTo={navigateTo}
                  hospitalBranding={hospitalBranding}
                  onUpdateHospitalBranding={setHospitalBranding}
                  theme={theme}
                  setTheme={setTheme}
                />
              )
            )}

            {activePage === "staff" && (
              !isStaffAccess ? (
                <AccessDeniedGuard
                  requiredRole="staff"
                  pageName="Staff Reception & Queue Terminal"
                  currentUser={currentUser}
                  onLoginSuccess={handleLoginSuccess}
                  navigateTo={navigateTo}
                />
              ) : (
                <StaffPortalPage
                  tenantId={tenantId}
                  currentUser={currentUser}
                  analytics={analytics}
                  queueSnapshot={queueSnapshot}
                  servingTickets={servingTickets}
                  heldTickets={heldTickets}
                  refreshData={refreshData}
                  language={language}
                  socketRef={socketRef}
                  navigateTo={navigateTo}
                  hospitalBranding={hospitalBranding}
                  theme={theme}
                  setTheme={setTheme}
                />
              )
            )}

            {activePage === "admin" && (
              !isAdmin ? (
                <AccessDeniedGuard
                  requiredRole="admin"
                  pageName="Hospital ML Studio & Training"
                  currentUser={currentUser}
                  onLoginSuccess={handleLoginSuccess}
                  navigateTo={navigateTo}
                />
              ) : (
                <MLAdminPage tenantId={tenantId} />
              )
            )}

            {activePage === "db" && (
              !canAccessDbInspector ? (
                <AccessDeniedGuard
                  requiredRole="staff"
                  pageName="Database Inspector"
                  currentUser={currentUser}
                  onLoginSuccess={handleLoginSuccess}
                  navigateTo={navigateTo}
                />
              ) : (
                <DatabaseInspectorPage
                  currentUser={currentUser}
                  currentHospitalTenant={currentHospitalTenant}
                  tenantId={tenantId}
                />
              )
            )}
          </>
        </main>

        {/* Auth Modal Overlay */}
        {showAuthModal && (
          <AuthModal
            authMode={authMode}
            setAuthMode={setAuthMode}
            onClose={() => setShowAuthModal(false)}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
      </div>
    </div>
  );
}

// Global Soft Medical Blue & Cyan Clinical Theme Styles
const appBgStyle = {
  background: "linear-gradient(135deg, #F8FAFC 0%, #F0F9FF 100%)",
  color: "#0F172A",
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
};

const darkAppBgStyle = {
  background: "linear-gradient(135deg, #090D16 0%, #0F172A 100%)",
  color: "#F1F5F9",
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
};

const mainContentStyle = { minHeight: "75vh" };
