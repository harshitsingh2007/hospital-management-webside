/**
 * PatientPage.jsx
 * ---------------
 * Patient Self-Checkin & Pre-scheduled Appointment Booking Kiosk.
 * Theme: Unified Medical Blue & Clean White (Clinical Healthcare System)
 * Professional Healthcare Vector Styling matching IMAGE 2.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { t, getCategoryLabel, getStatusLabel, SYMPTOM_OPTIONS, RISK_OPTIONS, formatSymptomLabel, formatRiskLabel, formatCleanText, cleanAdviceText } from "../utils/i18n";
import { printTokenPass, printAppointmentRecord, printPrescriptionSlip, downloadPrescriptionPDF } from "../utils/printPassHelper";
import HeroBanner from "../components/patient/HeroBanner";
import Footer from "../components/common/Footer";
import FamilyMemberSwitcher, { AddFamilyMemberModal, EditFamilyMemberModal, getRelationLabel } from "../components/patient/FamilyMemberSwitcher";
import { InAppToast, InAppConfirmModal } from "../components/common/InAppNotification";
import HistorySummary from "../components/patient-history/HistorySummary";
import { usePatientHistory } from "../hooks/usePatientHistory";
import WalkinTab from "../components/patient/WalkinTab";
import BookSlotTab from "../components/patient/BookSlotTab";
import MyAppointmentsTab from "../components/patient/MyAppointmentsTab";
import VisitHistoryTab from "../components/patient/VisitHistoryTab";
import FamilyManagementTab from "../components/patient/FamilyManagementTab";
import QueueTelemetrySidebar from "../components/patient/QueueTelemetrySidebar";
import DigitalTicketPassCard from "../components/patient/DigitalTicketPassCard";
import { getAppointmentTiming } from "../utils/appointmentTiming";
import {
  standaloneCardStyle,
  modalBackdropStyle,
  modalContentStyle,
  dashboardFooterStyle,
  footerLogoIconStyle,
} from "../components/patient/patientStyles";

export default function PatientPage({
  tenantId,
  currentUser,
  activeTicket,
  setActiveTicket,
  ticketQrData,
  setTicketQrData,
  refreshData,
  language = "en",
  setLanguage,
  navigateTo,
  currentTab = "walkin",
  analytics,
  queueSnapshot = [],
  servingTickets = [],
  kioskQrData,
  socketConnected = true,
  socketRef = null,
  // App-level family profile state (passed from App.jsx)
  familyMembers: familyMembersProp = null,
  setFamilyMembers: setFamilyMembersProp = null,
  activeFamilyMember: activeFamilyMemberProp = null,
  setActiveFamilyMember: setActiveFamilyMemberProp = null,
  onSwitchProfile = null,
  onFamilyMembersChange = null,
  currentHospitalTenant = null,
  onSwitchHospital = null,
  hospitalBranding: hospitalBrandingProp = null,
  onUpdateHospitalBranding = null,
  theme = "light",
}) {
  // Family Members & Dependents Management
  // Use App-level state when provided, fall back to local storage and self
  const getInitialFamilyMembers = () => {
    let savedUser = null;
    try {
      const s = localStorage.getItem("ai_queue_user");
      if (s) savedUser = JSON.parse(s);
    } catch (e) { }
    const eff = currentUser || savedUser;

    const self = {
      id: "self",
      name: eff ? (eff.username || "Self") : "Self",
      relation: "self",
      age: eff && eff.age ? eff.age : 30,
      gender: eff && eff.gender ? eff.gender.toLowerCase() : "male",
    };
    if (Array.isArray(familyMembersProp) && familyMembersProp.length > 0) {
      return [self, ...familyMembersProp.filter((m) => m && m.id !== "self")];
    }
    try {
      const keys = [
        eff?.email,
        eff?.username,
        eff?.phone,
        localStorage.getItem("last_patient_name"),
        "guest"
      ].filter(Boolean);
      for (const k of keys) {
        const saved = localStorage.getItem(`family_members_${k}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const deps = parsed.filter((m) => m && m.id !== "self");
            if (deps.length > 0) {
              return [self, ...deps];
            }
          }
        }
      }
    } catch (e) { }

    return [self];
  };

  const [localFamilyMembers, setLocalFamilyMembers] = useState(getInitialFamilyMembers);

  // Base primary user object (Self) - memoized to prevent infinite re-render loops
  const selfObj = useMemo(() => ({
    id: "self",
    name: currentUser ? (currentUser.username || "Self") : "Self",
    relation: "self",
    age: currentUser && currentUser.age ? currentUser.age : 30,
    gender: currentUser && currentUser.gender ? currentUser.gender.toLowerCase() : "male",
  }), [currentUser?.username, currentUser?.age, currentUser?.gender]);

  // Keep localFamilyMembers in sync with App-level familyMembersProp when it updates
  useEffect(() => {
    if (Array.isArray(familyMembersProp) && familyMembersProp.length > 0) {
      setLocalFamilyMembers((prev) => {
        const fullList = [selfObj, ...familyMembersProp.filter((m) => m && m.id !== "self")];
        if (JSON.stringify(prev) === JSON.stringify(fullList)) return prev;
        return fullList;
      });
    }
  }, [familyMembersProp, selfObj]);

  // familyMembers is always driven by localFamilyMembers so additions are instant
  const familyMembers = localFamilyMembers;

  const setFamilyMembers = (newMembers) => {
    const list = Array.isArray(newMembers) ? newMembers : [];
    const fullList = list.some((m) => m && m.id === "self") ? list : [selfObj, ...list];
    setLocalFamilyMembers((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(fullList)) return prev;
      return fullList;
    });
    if (setFamilyMembersProp) {
      const deps = fullList.filter((m) => m && m.id !== "self");
      setFamilyMembersProp((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(deps)) return prev;
        return deps;
      });
    }
    try {
      const storageKey = `family_members_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
      localStorage.setItem(storageKey, JSON.stringify(fullList));
    } catch (e) { }
  };

  const fetchFamilyMembersList = useCallback(() => {
    let savedUser = null;
    try {
      const s = localStorage.getItem("ai_queue_user");
      if (s) savedUser = JSON.parse(s);
    } catch (e) { }
    const effUser = currentUser || savedUser;

    const ident = (effUser && (effUser.email || effUser.username)) || localStorage.getItem("last_patient_name") || "";
    const phone = (effUser && effUser.phone) || "";
    const token = (effUser && effUser.token) || localStorage.getItem("ai_queue_token");
    const validToken = token && token !== "undefined" && token !== "null" ? token : null;

    const q = new URLSearchParams();
    if (ident) q.set("email", ident);
    if (phone) q.set("phone", phone);
    if (effUser?.id) q.set("user_id", String(effUser.id));

    fetch(`${API_BASE}/api/v1/family-members?${q.toString()}`, {
      headers: {
        ...(ident ? { "X-User-Email": ident } : {}),
        ...(phone ? { "X-User-Phone": phone } : {}),
        ...(validToken ? { Authorization: `Bearer ${validToken}` } : {}),
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "success" && Array.isArray(data.members)) {
          const self = {
            id: "self",
            name: effUser?.username || "Self",
            relation: "self",
            age: effUser?.age || 30,
            gender: effUser?.gender ? effUser.gender.toLowerCase() : "male",
          };
          const dependents = data.members.filter((m) => m && m.id !== "self");
          const fullList = [self, ...dependents];
          setLocalFamilyMembers((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(fullList)) return prev;
            return fullList;
          });
          if (setFamilyMembersProp) {
            setFamilyMembersProp((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(dependents)) return prev;
              return dependents;
            });
          }
          const keysToSave = [
            effUser?.username,
            effUser?.email,
            effUser?.phone,
            "guest",
          ].filter(Boolean);
          keysToSave.forEach((k) => {
            try {
              localStorage.setItem(`family_members_${k}`, JSON.stringify(fullList));
            } catch (e) { }
          });
        }
      })
      .catch((err) => console.log("PatientPage family fetch error:", err));
  }, [currentUser, setFamilyMembersProp]);

  // Live Patient Medical History & Follow-up records
  const {
    historyData: myMedicalHistoryData,
    patient: myMedicalPatient,
    summary: myMedicalSummary,
    visits: myMedicalVisits,
    prescriptions: myMedicalPrescriptions,
    reports: myMedicalReports,
    isReturningPatient: isMyReturningPatient,
    totalVisits: myMedicalTotalVisits,
    loading: myMedicalHistoryLoading,
  } = usePatientHistory({
    patientId: currentUser?.id,
    phone: currentUser?.phone,
    ticketId: activeTicket?.ticket_id,
    hospitalId: tenantId,
    socketRef,
    autoFetch: true,
  });

  const [selectedMemberId, setSelectedMemberId] = useState("self");
  const selectedMember = (familyMembers || []).find((m) => String(m.id) === String(selectedMemberId)) || familyMembers[0] || selfObj;
  const [editingMember, setEditingMember] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Family Tickets dictionary: { [memberId]: ticketObj }
  const [familyTickets, setFamilyTickets] = useState(() => {
    try {
      const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
      const saved = localStorage.getItem(ticketStorageKey);
      const parsed = saved ? JSON.parse(saved) : {};
      const activeSaved = localStorage.getItem("ai_queue_active_ticket");
      if (activeSaved && !parsed["self"]) {
        try {
          const act = JSON.parse(activeSaved);
          if (act && act.ticket_id) {
            parsed["self"] = act;
          }
        } catch (e) { }
      }
      return parsed;
    } catch (e) {
      return {};
    }
  });

  // Re-sync familyTickets when currentUser changes
  useEffect(() => {
    try {
      const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
      const saved = localStorage.getItem(ticketStorageKey);
      if (saved) {
        setFamilyTickets(JSON.parse(saved));
      }
    } catch (e) { }
  }, [currentUser]);

  // Real-time synchronization for family profiles and tickets across tabs and portals
  useEffect(() => {
    let bc = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("hospital_family_sync");
        bc.onmessage = (event) => {
          if (event.data?.type === "FAMILY_MEMBERS_UPDATED" && Array.isArray(event.data.members)) {
            const deps = event.data.members.filter((m) => m && m.id !== "self");
            setLocalFamilyMembers((prev) => {
              const fullList = [selfObj, ...deps];
              if (JSON.stringify(prev) === JSON.stringify(fullList)) return prev;
              return fullList;
            });
            if (setFamilyMembersProp) {
              setFamilyMembersProp((prev) => {
                if (JSON.stringify(prev) === JSON.stringify(deps)) return prev;
                return deps;
              });
            }
          } else if (event.data?.type === "FAMILY_TICKET_ADDED") {
            if (event.data.famMap) {
              setFamilyTickets((prev) => ({ ...prev, ...event.data.famMap }));
            }
            if (event.data.ticket) {
              setFamilyTickets((prev) => {
                const up = { ...prev };
                if (event.data.ticket.family_member_id) up[event.data.ticket.family_member_id] = event.data.ticket;
                if (event.data.ticket.name) {
                  up[`name_${event.data.ticket.name.toLowerCase().trim()}`] = event.data.ticket;
                  up[event.data.ticket.name.toLowerCase().trim()] = event.data.ticket;
                }
                return up;
              });
            }
          }
        };
      }
    } catch (e) { }

    const handleFamMembersSync = (e) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        const deps = e.detail.filter((m) => m && m.id !== "self");
        setLocalFamilyMembers((prev) => {
          const fullList = [selfObj, ...deps];
          if (JSON.stringify(prev) === JSON.stringify(fullList)) return prev;
          return fullList;
        });
        if (setFamilyMembersProp) {
          setFamilyMembersProp((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(deps)) return prev;
            return deps;
          });
        }
      }
    };

    const handleFamTicketsSync = (e) => {
      if (e?.detail && typeof e.detail === "object") {
        setFamilyTickets((prev) => ({ ...prev, ...e.detail }));
      }
    };

    const handleActiveTicketSync = (e) => {
      if (e?.detail && typeof e.detail === "object") {
        const t = e.detail;
        setFamilyTickets((prev) => {
          const up = { ...prev };
          if (t.family_member_id) up[t.family_member_id] = t;
          if (t.name) {
            up[`name_${t.name.toLowerCase().trim()}`] = t;
            up[t.name.toLowerCase().trim()] = t;
          }
          return up;
        });
      }
    };

    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith("family_members_") && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const deps = parsed.filter((m) => m && m.id !== "self");
            setLocalFamilyMembers((prev) => {
              const fullList = [selfObj, ...deps];
              if (JSON.stringify(prev) === JSON.stringify(fullList)) return prev;
              return fullList;
            });
          }
        } catch (err) { }
      } else if (e.key && e.key.startsWith("family_tickets_") && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === "object") {
            setFamilyTickets((prev) => ({ ...prev, ...parsed }));
          }
        } catch (err) { }
      }
    };

    window.addEventListener("family_members_updated", handleFamMembersSync);
    window.addEventListener("family_tickets_updated", handleFamTicketsSync);
    window.addEventListener("active_ticket_updated", handleActiveTicketSync);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("family_members_updated", handleFamMembersSync);
      window.removeEventListener("family_tickets_updated", handleFamTicketsSync);
      window.removeEventListener("active_ticket_updated", handleActiveTicketSync);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [selfObj, setFamilyMembersProp]);

  const isLiveTicketStatus = (ticket) => {
    if (!ticket || !ticket.status) return false;
    const s = String(ticket.status).toLowerCase();
    return ["waiting", "serving", "on_hold", "hold"].includes(s);
  };

  const isLiveTicket = useMemo(() => {
    if (!activeTicket || !isLiveTicketStatus(activeTicket)) return false;
    const depNames = (familyMembers || [])
      .filter((m) => m && m.id !== "self")
      .map((m) => String(m.name || "").toLowerCase().trim())
      .filter(Boolean);
    const actName = String(activeTicket.name || "").toLowerCase().trim();
    if (selectedMemberId === "self") {
      if (depNames.includes(actName) || (activeTicket.family_member_id && activeTicket.family_member_id !== "self")) {
        return false;
      }
      return true;
    } else {
      const selMember = (familyMembers || []).find((m) => String(m.id) === String(selectedMemberId));
      const selName = String(selMember?.name || "").toLowerCase().trim();
      if (String(activeTicket.family_member_id) === String(selectedMemberId)) return true;
      if (selName && actName === selName) return true;
      return false;
    }
  }, [activeTicket, selectedMemberId, familyMembers]);

  const removeTicketFromFamilyTickets = useCallback((ticketId) => {
    if (!ticketId) return;
    setFamilyTickets((prev) => {
      const updated = { ...prev };
      let changed = false;
      Object.keys(updated).forEach((k) => {
        if (updated[k]?.ticket_id === ticketId) {
          delete updated[k];
          changed = true;
        }
      });
      if (changed) {
        try {
          const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
          localStorage.setItem(ticketStorageKey, JSON.stringify(updated));
        } catch (e) { }
        window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: updated }));
      }
      return changed ? updated : prev;
    });
  }, [currentUser]);

  // If activeTicket becomes completed or departed, clear it immediately from instant check-in
  useEffect(() => {
    if (activeTicket && !isLiveTicketStatus(activeTicket)) {
      const tId = activeTicket.ticket_id;
      setActiveTicket(null);
      if (setTicketQrData) setTicketQrData(null);
      if (selectedMemberId === "self") {
        try {
          localStorage.removeItem("ai_queue_active_ticket");
        } catch (e) { }
      }
      if (tId) {
        removeTicketFromFamilyTickets(tId);
      }
    }
  }, [activeTicket, selectedMemberId, setActiveTicket, setTicketQrData, removeTicketFromFamilyTickets]);

  // Ensure activeTicket is restored from familyTickets or localStorage on mount/refresh ONLY IF LIVE ON SERVER
  // Strictly respects selectedMemberId: dependent profiles will NEVER incorrectly inherit "self"'s ticket!
  const candidateCheckInProgressRef = useRef(null);
  useEffect(() => {
    if (!activeTicket) {
      const depNames = (familyMembers || [])
        .filter((m) => m && m.id !== "self")
        .map((m) => String(m.name || "").toLowerCase().trim())
        .filter(Boolean);

      const candidate = selectedMemberId === "self"
        ? (() => {
          const raw = familyTickets["self"] || (() => {
            try {
              const s = localStorage.getItem("ai_queue_active_ticket");
              return s ? JSON.parse(s) : null;
            } catch (e) { return null; }
          })();
          if (!raw) return null;
          const rawName = String(raw.name || "").toLowerCase().trim();
          if (depNames.includes(rawName) || (raw.family_member_id && raw.family_member_id !== "self")) {
            try { localStorage.removeItem("ai_queue_active_ticket"); } catch (e) { }
            return null;
          }
          return raw;
        })()
        : (familyTickets[selectedMemberId] || (selectedMember?.name ? familyTickets[`name_${selectedMember.name.toLowerCase().trim()}`] : null) || null);

      if (candidate && candidate.ticket_id && isLiveTicketStatus(candidate)) {
        if (candidateCheckInProgressRef.current === candidate.ticket_id) return;
        candidateCheckInProgressRef.current = candidate.ticket_id;

        // Authoritatively check backend to ensure candidate hasn't been completed or cancelled
        fetch(`${API_BASE}/api/v1/plugin/ticket/${candidate.ticket_id}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.status === "success" && d.ticket) {
              if (isLiveTicketStatus(d.ticket)) {
                setActiveTicket(d.ticket);
                if (!ticketQrData || ticketQrData.ticket_id !== d.ticket.ticket_id) {
                  fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${d.ticket.ticket_id}`)
                    .then((rqr) => rqr.json())
                    .then((qr) => {
                      if (setTicketQrData) setTicketQrData(qr);
                    })
                    .catch(() => { });
                }
              } else {
                candidateCheckInProgressRef.current = null;
                // Ticket was already completed or cancelled on the server! Clean up local storage
                removeTicketFromFamilyTickets(candidate.ticket_id);
                if (selectedMemberId === "self") {
                  try {
                    localStorage.removeItem("ai_queue_active_ticket");
                  } catch (e) { }
                }
              }
            }
          })
          .catch(() => {
            candidateCheckInProgressRef.current = null;
            // Offline fallback
            setActiveTicket(candidate);
          });
      }
    } else {
      candidateCheckInProgressRef.current = null;
    }
  }, [activeTicket?.ticket_id, activeTicket?.status, familyTickets, selectedMemberId, selectedMember, familyMembers, setActiveTicket, setTicketQrData, removeTicketFromFamilyTickets, ticketQrData]);

  // Sync tab with URL, including "family" and "history" tabs and aliases
  const [activeTab, setActiveTab] = useState(() => {
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
    return (currentTab && ["walkin", "book", "my_apts", "history", "family"].includes(currentTab.toLowerCase()))
      ? currentTab.toLowerCase()
      : "walkin";
  });

  useEffect(() => {
    if (currentTab && ["walkin", "book", "my_apts", "history", "family"].includes(currentTab.toLowerCase())) {
      setActiveTab(currentTab.toLowerCase());
    }
  }, [currentTab]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const pageParam = (params.get("page") || params.get("view") || "").toLowerCase();
      if (tabParam && ["walkin", "book", "my_apts", "history", "family"].includes(tabParam.toLowerCase())) {
        setActiveTab(tabParam.toLowerCase());
      } else if (["history", "appointment_history", "past_appointments"].includes(pageParam)) {
        setActiveTab("history");
      } else if (["my_apts", "appointments", "my_appointments"].includes(pageParam)) {
        setActiveTab("my_apts");
      } else if (["book", "booking", "schedule"].includes(pageParam)) {
        setActiveTab("book");
      } else if (["family", "dependents"].includes(pageParam)) {
        setActiveTab("family");
      } else if (pageParam === "patient") {
        setActiveTab("walkin");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabChange = (tabKey) => {
    const cleanKey = (tabKey || "").toLowerCase();
    setActiveTab(cleanKey);
    if (cleanKey === "history") {
      fetchUserAppointments();
      fetchUserTicketHistory();
    } else if (cleanKey === "my_apts") {
      fetchUserAppointments();
    } else if (cleanKey === "family") {
      fetchFamilyMembersList();
      fetchUserTicketHistory();
    }
    if (navigateTo) {
      navigateTo("patient", cleanKey);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set("page", "patient");
      url.searchParams.set("tab", cleanKey);
      window.history.pushState({}, "", url.toString());
    }
  };

  const [name, setName] = useState(currentUser ? currentUser.username : "");
  const [age, setAge] = useState(currentUser && currentUser.age ? currentUser.age : 35);
  const [gender, setGender] = useState(currentUser && currentUser.gender ? currentUser.gender.toLowerCase() : "male");
  const [medicalCondition, setMedicalCondition] = useState("general_checkup");
  const [customSymptom, setCustomSymptom] = useState("");
  const [preExistingCondition, setPreExistingCondition] = useState("none");
  const [category, setCategory] = useState("consultation");
  const [priority, setPriority] = useState(2);
  const [statusMsg, setStatusMsg] = useState(null);

  // In-App Toast & Confirmation States (replaces all window.alert and window.confirm)
  const isDark = theme === "dark";
  const [inAppToast, setInAppToast] = useState(null); // { id, message, title, type: "success" | "error" | "warn" | "info" }
  const toastTimerRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, confirmText, cancelText, isDestructive, onConfirm }

  const showToast = useCallback((msg, type = "success", durationMs = null) => {
    if (!msg) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const messageText = typeof msg === "object" ? msg.message : msg;
    const titleText = typeof msg === "object" ? msg.title : null;
    const finalType = (typeof msg === "object" ? msg.type : type) || "success";
    setInAppToast({ id: Date.now(), message: messageText, title: titleText, type: finalType });
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

  // Ticket Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("Running late");
  const [otherCancelReason, setOtherCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Queue Adjustment (Skip Backward) Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedSkipCount, setSelectedSkipCount] = useState(1);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState("");

  // Digital Prescription Slip Modal State
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [viewingPrescriptionData, setViewingPrescriptionData] = useState(null);

  const [activeHospitalCode, setActiveHospitalCode] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const p = new URLSearchParams(window.location.search);
        const urlHosp = p.get("hospital") || p.get("tenant") || p.get("facility");
        if (urlHosp) return urlHosp.trim();
        const saved = localStorage.getItem("ai_queue_current_hospital");
        if (saved) return saved.trim();
      }
    } catch (e) { }
    return tenantId || currentHospitalTenant || currentUser?.hospital_code || "city-hospital-01";
  });

  // Facility-scoped live telemetry for the currently selected hospital
  const [facilityAnalytics, setFacilityAnalytics] = useState(null);
  const [facilityQueue, setFacilityQueue] = useState([]);

  useEffect(() => {
    const targetCode = activeHospitalCode || tenantId || currentHospitalTenant || "city-hospital-01";
    if (!targetCode) return;

    let isMounted = true;
    const fetchTelemetry = () => {
      if (document.hidden) return;
      fetch(`${API_BASE}/api/v1/plugin/analytics/${encodeURIComponent(targetCode)}`)
        .then((r) => r.json())
        .then((d) => {
          if (isMounted && d && !d.error) {
            setFacilityAnalytics(d);
          }
        })
        .catch(() => { });

      fetch(`${API_BASE}/api/v1/plugin/queue/${encodeURIComponent(targetCode)}`)
        .then((r) => r.json())
        .then((d) => {
          if (isMounted && d && Array.isArray(d.snapshot)) {
            setFacilityQueue(d.snapshot);
          }
        })
        .catch(() => { });
    };

    fetchTelemetry();
    // Relaxed 35s heartbeat fallback (WebSocket updates queue and analytics instantly)
    const interval = setInterval(fetchTelemetry, 35000);

    const handleLiveTelemetryEvent = (e) => {
      const d = e?.detail;
      if (d && isMounted) {
        if (Array.isArray(d.snapshot)) setFacilityQueue(d.snapshot);
        if (d.analytics) setFacilityAnalytics(d.analytics);
      }
    };
    window.addEventListener("queue_updated_live", handleLiveTelemetryEvent);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("queue_updated_live", handleLiveTelemetryEvent);
    };
  }, [activeHospitalCode, tenantId, currentHospitalTenant]);

  // Tenant Customization & Branding (White-Labeling) State
  const [hospitalBranding, setHospitalBranding] = useState(hospitalBrandingProp);

  useEffect(() => {
    if (hospitalBrandingProp) {
      setHospitalBranding(hospitalBrandingProp);
    }
  }, [hospitalBrandingProp]);

  useEffect(() => {
    if (tenantId) setActiveHospitalCode(tenantId);
  }, [tenantId]);

  useEffect(() => {
    if (currentHospitalTenant) setActiveHospitalCode(currentHospitalTenant);
  }, [currentHospitalTenant]);

  // Multi-Hospital Facility Switcher State
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState("");
  const [hospitalsList, setHospitalsList] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/hospitals/public`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success" && Array.isArray(d.hospitals)) {
          setHospitalsList(d.hospitals);
        }
      })
      .catch((e) => console.log("Hospitals fetch error in PatientPage:", e));
  }, []);

  const [hospitalDepartments, setHospitalDepartments] = useState([]);

  useEffect(() => {
    const code = activeHospitalCode || tenantId;
    if (!code) return;
    fetch(`${API_BASE}/api/v1/hospital/departments/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success" && Array.isArray(d.departments) && d.departments.length > 0) {
          setHospitalDepartments(d.departments);
        }
      })
      .catch((e) => console.log("Departments fetch error in PatientPage:", e));
  }, [activeHospitalCode, tenantId]);

  const availableDepartments = useMemo(() => {
    const list = hospitalDepartments.length > 0
      ? hospitalDepartments.map((d) => ({
        id: d.dept_code || d.code || String(d.id),
        label: d.name,
      }))
      : HOSPITAL_CONFIG.categories;

    // Clinical Workflow Rule: Pharmacy is a fulfillment stage routed by doctor prescription, NOT a direct patient booking/walk-in entry
    return list.filter((d) => {
      const code = String(d.id || "").toLowerCase().trim();
      const label = String(d.label || "").toLowerCase().trim();
      return code !== "pharmacy" && !label.includes("pharmacy") && !label.includes("दवा");
    });
  }, [hospitalDepartments]);

  useEffect(() => {
    if (category === "pharmacy" || (availableDepartments.length > 0 && !availableDepartments.some((d) => String(d.id).toLowerCase() === String(category).toLowerCase()))) {
      if (availableDepartments.length > 0) {
        setCategory(availableDepartments[0].id);
      }
    }
  }, [availableDepartments, category]);

  const getDeptDisplayName = useCallback((recordOrCode) => {
    if (!recordOrCode) return language === "hi" ? "सामान्य परामर्श (OPD)" : "General Consultation (OPD)";
    if (typeof recordOrCode === "object") {
      if (recordOrCode.department_name) return formatCleanText(recordOrCode.department_name, language);
      if (recordOrCode.department) return formatCleanText(recordOrCode.department, language);
      if (recordOrCode.departments?.name) return formatCleanText(recordOrCode.departments.name, language);
      if (recordOrCode.service_category) return getDeptDisplayName(recordOrCode.service_category);
    }
    const code = String(recordOrCode).toLowerCase().trim();
    const found = availableDepartments.find((d) => String(d.id).toLowerCase() === code || String(d.label).toLowerCase() === code);
    if (found) return found.label;
    return getCategoryLabel(code, language) || formatCleanText(code, language);
  }, [availableDepartments, language]);

  const handleSelectHospital = (hospCode, hospName = null) => {
    if (!hospCode) return;
    const cleanCode = String(hospCode).trim();
    setActiveHospitalCode(cleanCode);
    setFacilityAnalytics(null);
    setFacilityQueue([]);

    // Immediately fetch new hospital telemetry
    fetch(`${API_BASE}/api/v1/plugin/analytics/${encodeURIComponent(cleanCode)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setFacilityAnalytics(d);
      })
      .catch(() => { });

    fetch(`${API_BASE}/api/v1/plugin/queue/${encodeURIComponent(cleanCode)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.snapshot)) setFacilityQueue(d.snapshot);
      })
      .catch(() => { });

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("ai_queue_current_hospital", cleanCode);
        const url = new URL(window.location.href);
        url.searchParams.set("hospital", cleanCode);
        window.history.replaceState({}, "", url.toString());
      }
      window.dispatchEvent(new CustomEvent("hospital_changed", { detail: cleanCode }));
    } catch (e) { }

    if (onSwitchHospital) {
      onSwitchHospital(cleanCode, hospName);
    }

    // Immediately fetch new hospital branding
    fetch(`${API_BASE}/api/v1/hospital/branding/${cleanCode}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success" && d.branding) {
          setHospitalBranding(d.branding);
        }
      })
      .catch((e) => console.log("Branding error:", e));

    setShowHospitalModal(false);
  };

  const safeISODate = (val) => {
    if (!val) return new Date().toISOString();
    try {
      if (typeof val === "number") {
        const ms = val < 1e11 ? val * 1000 : val;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (/^\d+$/.test(trimmed)) {
          const num = Number(trimmed);
          const ms = num < 1e11 ? num * 1000 : num;
          const d = new Date(ms);
          if (!isNaN(d.getTime())) return d.toISOString();
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch (e) { }
    return new Date().toISOString();
  };

  const formatDateSafe = (dateVal) => {
    if (!dateVal) return "";
    try {
      if (typeof dateVal === "number") {
        const ms = dateVal < 1e11 ? dateVal * 1000 : dateVal;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d.toLocaleDateString();
      }
      if (typeof dateVal === "string" && /^\d+$/.test(dateVal.trim())) {
        const num = Number(dateVal.trim());
        const ms = num < 1e11 ? num * 1000 : num;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d.toLocaleDateString();
      }
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    } catch (e) { }
    return String(dateVal);
  };

  const parsePrescription = (prescriptionNotes, fallbackTicket = null) => {
    if (!prescriptionNotes && !fallbackTicket) return null;
    let parsed = null;
    if (typeof prescriptionNotes === "object" && prescriptionNotes !== null) {
      parsed = prescriptionNotes;
    } else if (typeof prescriptionNotes === "string") {
      let trimmed = prescriptionNotes.trim();
      // Strip outer wrapping quotes if double-quoted / escaped string
      while (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        trimmed = trimmed.slice(1, -1).trim();
      }
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          try {
            parsed = JSON.parse(JSON.parse(prescriptionNotes));
          } catch (e2) { }
        }
      } else {
        try {
          const direct = JSON.parse(prescriptionNotes);
          if (typeof direct === "object" && direct !== null) {
            parsed = direct;
          } else if (typeof direct === "string" && direct.trim().startsWith("{")) {
            parsed = JSON.parse(direct);
          }
        } catch (e) { }
      }
    }

    if (parsed && typeof parsed === "object") {
      const resolvedDoctor = (parsed.doctor_name && parsed.doctor_name !== "Dr. Staff Desk")
        ? parsed.doctor_name
        : (fallbackTicket?.doctor_name || fallbackTicket?.served_by_doctor_name || (parsed.doctor_name !== "Dr. Staff Desk" ? parsed.doctor_name : "") || "Consultant Physician");

      const resolvedStages = (Array.isArray(fallbackTicket?.transfer_stages) && fallbackTicket.transfer_stages.length > 0)
        ? fallbackTicket.transfer_stages
        : (Array.isArray(parsed.stages) ? parsed.stages : []);

      let allMeds = Array.isArray(parsed.medicines) ? [...parsed.medicines] : [];
      let allLabTests = parsed.lab_tests ? [parsed.lab_tests] : [];
      const cleanParsedAdv = cleanAdviceText(parsed.advice || parsed.clinical_notes || "");
      let allAdvices = cleanParsedAdv ? [cleanParsedAdv] : [];

      if (resolvedStages.length > 0) {
        const seenMeds = new Set(allMeds.map((m) => `${String(m.name || "").toLowerCase()}_${String(m.dosage || "").toLowerCase()}`));
        resolvedStages.forEach((stg) => {
          let stgRx = null;
          try {
            if (stg.prescription_notes) {
              stgRx = typeof stg.prescription_notes === "object" ? stg.prescription_notes : JSON.parse(stg.prescription_notes);
            }
          } catch (e) { }
          if (stgRx) {
            if (Array.isArray(stgRx.medicines)) {
              stgRx.medicines.forEach((m) => {
                const k = `${String(m.name || "").toLowerCase()}_${String(m.dosage || "").toLowerCase()}`;
                if (!seenMeds.has(k)) {
                  seenMeds.add(k);
                  allMeds.push(m);
                }
              });
            }
            if (stgRx.lab_tests && stgRx.lab_tests !== "no" && !allLabTests.includes(stgRx.lab_tests)) {
              allLabTests.push(stgRx.lab_tests);
            }
            const cleanStgAdv = cleanAdviceText(stgRx.advice || stgRx.clinical_notes || "");
            if (cleanStgAdv && !allAdvices.includes(cleanStgAdv)) {
              allAdvices.push(cleanStgAdv);
            }
          }
        });
      }

      return {
        doctor_name: formatCleanText(resolvedDoctor, language),
        doctor_department: formatCleanText(parsed.doctor_department || fallbackTicket?.service_category || fallbackTicket?.department_name || "General OPD", language),
        doctor_employee_id: parsed.doctor_employee_id || "",
        diagnosis: formatCleanText(parsed.diagnosis || fallbackTicket?.medical_condition || "Clinical Consultation", language),
        medicines: allMeds.map((m) => ({
          ...m,
          name: formatCleanText(m.name, language),
          dosage: m.dosage ? formatCleanText(m.dosage, language) : "",
          frequency: m.frequency ? formatCleanText(m.frequency, language) : "",
          duration: m.duration ? formatCleanText(m.duration, language) : "",
          instructions: m.instructions ? formatCleanText(m.instructions, language) : "After food",
        })),
        lab_tests: formatCleanText(allLabTests.join(", "), language),
        advice: allAdvices.join(" • ").replace(/_/g, " "),
        follow_up: parsed.follow_up ? formatCleanText(parsed.follow_up, language) : "",
        transfer_notes: parsed.transfer_notes ? String(parsed.transfer_notes).replace(/_/g, " ") : "",
        target_department: parsed.target_department ? formatCleanText(parsed.target_department, language) : "",
        prescribed_at: safeISODate(parsed.prescribed_at || fallbackTicket?.serve_end_time || fallbackTicket?.created_at),
        patient_name: formatCleanText(fallbackTicket?.name || fallbackTicket?.patient_name || parsed.patient_name || (currentUser ? (currentUser.username || currentUser.name) : "Patient"), language),
        ticket_id: fallbackTicket?.ticket_id || parsed.ticket_id || "",
        age: fallbackTicket?.age || 30,
        gender: formatCleanText(fallbackTicket?.gender || "Patient", language),
        hospital_name: fallbackTicket?.hospital_name || (fallbackTicket?.hospital_code && Array.isArray(hospitalsList) && hospitalsList.find((h) => String(h.hospital_code) === String(fallbackTicket.hospital_code))?.name) || currentHospitalDisplayName,
        logo_url: fallbackTicket?.logo_url || hospitalBranding?.logo_url || (fallbackTicket?.hospital_code && Array.isArray(hospitalsList) && hospitalsList.find((h) => String(h.hospital_code) === String(fallbackTicket.hospital_code))?.logo_url) || "",
        stages: resolvedStages,
        transfer_stages: resolvedStages,
        transfer_trail: fallbackTicket?.transfer_trail || null,
        is_transferred: Boolean(fallbackTicket?.is_transferred || resolvedStages.length > 1),
      };
    }

    // Clean fallback for plain text advice or completed consultation
    let rawStr = cleanAdviceText(prescriptionNotes);
    if (!rawStr) {
      rawStr = "Clinical consultation completed. Regular medical review as advised.";
    }

    const fallbackDoctor = fallbackTicket?.doctor_name || fallbackTicket?.served_by_doctor_name || "Consultant Physician";

    return {
      doctor_name: formatCleanText(fallbackDoctor, language),
      doctor_department: formatCleanText(fallbackTicket?.service_category || fallbackTicket?.department_name || "General OPD", language),
      diagnosis: formatCleanText(fallbackTicket?.medical_condition || "Clinical Consultation", language),
      medicines: [],
      lab_tests: "",
      advice: rawStr.replace(/_/g, " "),
      follow_up: "Review as advised",
      prescribed_at: safeISODate(fallbackTicket?.serve_end_time || fallbackTicket?.created_at),
      patient_name: formatCleanText(fallbackTicket?.name || fallbackTicket?.patient_name || (currentUser ? (currentUser.username || currentUser.name) : "Patient"), language),
      ticket_id: fallbackTicket?.ticket_id || fallbackTicket?.appointment_id || "",
      age: fallbackTicket?.age || 30,
      gender: formatCleanText(fallbackTicket?.gender || "Patient", language),
      hospital_name: fallbackTicket?.hospital_name || (fallbackTicket?.hospital_code && Array.isArray(hospitalsList) && hospitalsList.find((h) => String(h.hospital_code) === String(fallbackTicket.hospital_code))?.name) || currentHospitalDisplayName,
      logo_url: fallbackTicket?.logo_url || hospitalBranding?.logo_url || (fallbackTicket?.hospital_code && Array.isArray(hospitalsList) && hospitalsList.find((h) => String(h.hospital_code) === String(fallbackTicket.hospital_code))?.logo_url) || "",
    };
  };

  const handleOpenPrescriptionSlip = (prescriptionNotes, fallbackTicket) => {
    const data = parsePrescription(prescriptionNotes, fallbackTicket);
    if (data) {
      setViewingPrescriptionData(data);
      setShowPrescriptionModal(true);
    }
  };

  // Appointment Booking Form State
  const [aptDate, setAptDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [aptTimeSlot, setAptTimeSlot] = useState("");
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [userAppointments, setUserAppointments] = useState([]);
  const [aptFilterQuery, setAptFilterQuery] = useState("");
  const [userTicketHistory, setUserTicketHistory] = useState([]);
  const [historyFilterType, setHistoryFilterType] = useState("all");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [showCancelledHistory, setShowCancelledHistory] = useState(false);

  // ── Booking date window: today → today + 2 days (3 days max) ──────────────
  const bookingDateBounds = useMemo(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = fmt(now);
    const maxD = new Date(now);
    maxD.setDate(maxD.getDate() + 2);
    return { min: todayStr, max: fmt(maxD), todayStr };
  }, []);

  const DEFAULT_TIME_SLOTS = useMemo(() => [
    "09:00 AM", "09:45 AM", "10:30 AM", "11:15 AM", "12:00 PM",
    "02:00 PM", "02:45 PM", "03:30 PM", "04:15 PM", "05:00 PM"
  ], []);

  const timeSlotOptions = useMemo(() => {
    const customSlots = hospitalBranding?.available_time_slots || hospitalBranding?.time_slots;
    if (Array.isArray(customSlots) && customSlots.length > 0) {
      return customSlots
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean);
    }
    return DEFAULT_TIME_SLOTS;
  }, [hospitalBranding?.available_time_slots, hospitalBranding?.time_slots, DEFAULT_TIME_SLOTS]);

  // Parse a "hh:mm AM/PM" slot string into a comparable minute-of-day number
  const slotToMinutes = (slot) => {
    if (!slot || typeof slot !== "string") return 0;
    const parts = slot.trim().split(" ");
    if (parts.length < 2) {
      const [h, m] = slot.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    }
    const [time, period] = parts;
    let [h, m] = time.split(":").map(Number);
    h = h || 0;
    m = m || 0;
    if (period?.toUpperCase() === "PM" && h !== 12) h += 12;
    if (period?.toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  // If currently selected slot is not in timeSlotOptions, reset it
  useEffect(() => {
    if (aptTimeSlot && !timeSlotOptions.includes(aptTimeSlot)) {
      setAptTimeSlot("");
    }
  }, [timeSlotOptions, aptTimeSlot]);

  // Returns true if the slot has already passed (only relevant for today)
  const isSlotPast = useCallback((slot) => {
    if (aptDate !== bookingDateBounds.todayStr) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return slotToMinutes(slot) <= nowMinutes;
  }, [aptDate, bookingDateBounds.todayStr]);

  // When the selected date changes, clamp to valid window.
  // Manual selection: do NOT auto-select slots. If a previously chosen slot passed on the new date, reset it.
  useEffect(() => {
    if (!aptDate) return;
    // Clamp if date goes out of range
    if (aptDate < bookingDateBounds.min || aptDate > bookingDateBounds.max) {
      setAptDate(bookingDateBounds.min);
      return;
    }
    if (aptTimeSlot && isSlotPast(aptTimeSlot)) {
      setAptTimeSlot("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aptDate, bookingDateBounds]);

  const fetchUserAppointments = useCallback((overrideName) => {
    const ident =
      overrideName ||
      (currentUser?.email) ||
      (currentUser?.username) ||
      localStorage.getItem("last_patient_name") ||
      "";
    if (!ident.trim()) return;
    const encodedIdent = encodeURIComponent(ident.trim());
    fetch(`${API_BASE}/api/v1/plugin/appointments/user/${encodedIdent}`)
      .then((r) => r.json())
      .then((d) => {
        const apts = Array.isArray(d?.appointments) ? d.appointments : [];
        if (overrideName) {
          setUserAppointments((prev) => {
            const map = new Map(prev.map((a) => [a.appointment_id, a]));
            apts.forEach((a) => map.set(a.appointment_id, a));
            return Array.from(map.values());
          });
        } else {
          setUserAppointments(apts);
        }
      })
      .catch((e) => console.log("Appointments fetch error:", e));
  }, [currentUser]);

  useEffect(() => {
    if (selectedMemberId === "self") {
      if (currentUser) {
        setName(currentUser.username || "");
        if (currentUser.age) setAge(currentUser.age);
        if (currentUser.gender) setGender(currentUser.gender.toLowerCase());
      } else {
        const savedName = localStorage.getItem("last_patient_name");
        if (savedName) {
          setName(savedName);
        }
      }
    }
    fetchUserAppointments();
  }, [currentUser, fetchUserAppointments]);

  // Automatically sync form demographics (Patient Full Name, Age, Gender) whenever the active member profile changes
  useEffect(() => {
    const mem = (familyMembers || []).find((m) => String(m.id) === String(selectedMemberId)) || (selectedMemberId === "self" ? selfObj : null);
    if (mem && mem.name) {
      setName(mem.name);
      if (mem.age) setAge(mem.age);
      if (mem.gender) setGender(mem.gender.toLowerCase());
    }
  }, [selectedMemberId, familyMembers]);

  useEffect(() => {
    const hospCode = activeHospitalCode || tenantId || currentHospitalTenant || "city-hospital-01";
    if (!hospitalBrandingProp) {
      fetch(`${API_BASE}/api/v1/hospital/branding/${hospCode}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status === "success" && d.branding) {
            setHospitalBranding(d.branding);
          }
        })
        .catch((e) => console.log("Branding fetch error:", e));
    }

    const handleHospEvent = (e) => {
      const newCode = (typeof e?.detail === "string" ? e.detail : e?.detail?.hospital_code) || tenantId || "city-hospital-01";
      setActiveHospitalCode(newCode);
      fetch(`${API_BASE}/api/v1/hospital/branding/${newCode}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status === "success" && d.branding) {
            setHospitalBranding(d.branding);
          }
        })
        .catch((err) => console.log("Branding fetch error:", err));
    };
    window.addEventListener("hospital_changed", handleHospEvent);
    return () => window.removeEventListener("hospital_changed", handleHospEvent);
  }, [tenantId, currentHospitalTenant, activeHospitalCode]);

  // Dynamically resolved hospital display name across entire patient experience
  const currentHospitalDisplayName =
    hospitalBranding?.hospital_name ||
    hospitalBranding?.name ||
    hospitalsList.find((h) => String(h.hospital_code) === String(activeHospitalCode))?.name ||
    (String(currentUser?.hospital_code) === String(activeHospitalCode) ? currentUser?.hospital_name : null) ||
    HOSPITAL_CONFIG.name;

  // Resolve hospital name for any appointment or ticket history record
  const getHospitalNameForRecord = useCallback((record) => {
    if (!record) return currentHospitalDisplayName;
    if (record.hospital_name && record.hospital_name !== "City General Hospital") {
      return record.hospital_name;
    }
    const code = record.hospital_code || record.tenant_id;
    if (code && Array.isArray(hospitalsList)) {
      const match = hospitalsList.find((h) => String(h.hospital_code) === String(code));
      if (match?.name) return match.name;
    }
    if (record.hospital_name) return record.hospital_name;
    return currentHospitalDisplayName;
  }, [currentHospitalDisplayName, hospitalsList]);

  // Operational Schedule & Registration Cutoff Status
  const registrationStatus = (() => {
    const brand = hospitalBranding || {};
    const now = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[now.getDay()];

    if (Array.isArray(brand.operating_days) && brand.operating_days.length > 0) {
      if (!brand.operating_days.includes(todayName)) {
        return {
          isClosed: true,
          reason: language === "hi" ? `आज (${todayName}) ओपीडी बंद है।` : `OPD is closed today (${todayName}).`,
        };
      }
    }

    const opdStart = brand.opd_start_time || brand.registration_open_time || "08:00";
    const opdEnd = brand.opd_end_time || brand.registration_close_time || "20:00";
    const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (curTime < opdStart) {
      return {
        isClosed: true,
        reason: language === "hi"
          ? `ओपीडी पंजीकरण प्रातः ${opdStart} बजे से प्रारंभ होगा।`
          : `OPD registration opens at ${opdStart}.`,
      };
    }

    if (curTime > opdEnd) {
      return {
        isClosed: true,
        reason: language === "hi"
          ? `आज का ओपीडी समय (${opdEnd}) समाप्त हो चुका है।`
          : `Today's OPD hours (${opdStart} - ${opdEnd}) have ended.`,
      };
    }

    return { isClosed: false, reason: "" };
  })();

  const fetchUserTicketHistory = useCallback((overrideName) => {
    const ident =
      overrideName ||
      (currentUser?.email) ||
      (currentUser?.username) ||
      name ||
      localStorage.getItem("last_patient_name") ||
      "";
    if (!ident.trim()) return;
    const encodedIdent = encodeURIComponent(ident.trim());
    const extraName = (!overrideName && name && name.trim() && name.trim().toLowerCase() !== ident.trim().toLowerCase())
      ? `?name=${encodeURIComponent(name.trim())}`
      : "";
    fetch(`${API_BASE}/api/v1/plugin/tickets/history/${encodedIdent}${extraName}`)
      .then((r) => r.json())
      .then((d) => {
        const tickets = Array.isArray(d?.tickets) ? d.tickets : [];
        if (overrideName) {
          setUserTicketHistory((prev) => {
            const map = new Map(prev.map((t) => [t.ticket_id, t]));
            tickets.forEach((t) => map.set(t.ticket_id, t));
            return Array.from(map.values());
          });
        } else {
          setUserTicketHistory(tickets);
        }

        // Auto-sync active live tickets into familyTickets state so every family profile badge updates live
        const liveTickets = tickets.filter(isLiveTicketStatus);
        if (liveTickets.length > 0) {
          setFamilyTickets((prev) => {
            const updated = { ...prev };
            const depList = (familyMembers || []).filter((m) => m && m.id !== "self");
            const depNames = depList.map((m) => String(m.name || "").toLowerCase().trim()).filter(Boolean);

            if (updated["self"]) {
              const selfTName = String(updated["self"].name || "").toLowerCase().trim();
              if (depNames.includes(selfTName) || (updated["self"].family_member_id && updated["self"].family_member_id !== "self")) {
                delete updated["self"];
              }
            }

            liveTickets.forEach((lt) => {
              const ltName = String(lt.name || "").toLowerCase().trim();
              const matchingDep = depList.find((m) =>
                (lt.family_member_id && String(lt.family_member_id) === String(m.id)) ||
                (ltName && String(m.name || "").toLowerCase().trim() === ltName)
              );

              if (matchingDep) {
                updated[matchingDep.id] = lt;
                updated[String(matchingDep.id)] = lt;
                if (matchingDep.name) {
                  updated[`name_${matchingDep.name.toLowerCase().trim()}`] = lt;
                  updated[matchingDep.name.toLowerCase().trim()] = lt;
                }
              } else if (!lt.family_member_id || lt.family_member_id === "self") {
                if (!depNames.includes(ltName)) {
                  updated["self"] = lt;
                }
              }
              if (lt.name) {
                updated[`name_${ltName}`] = lt;
              }
            });
            try {
              const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
              localStorage.setItem(ticketStorageKey, JSON.stringify(updated));
            } catch (e) { }
            return updated;
          });
        }

        // If current activeTicket is present in history and completed/cancelled, clear it
        if (activeTicket?.ticket_id) {
          const matching = tickets.find((t) => t.ticket_id === activeTicket.ticket_id);
          if (matching && !isLiveTicketStatus(matching)) {
            setActiveTicket(null);
            if (setTicketQrData) setTicketQrData(null);
            try {
              localStorage.removeItem("ai_queue_active_ticket");
            } catch (e) { }
            removeTicketFromFamilyTickets(matching.ticket_id);
          }
        }
      })
      .catch((e) => console.log("Ticket history fetch error:", e));
  }, [currentUser, name, activeTicket?.ticket_id, removeTicketFromFamilyTickets, setActiveTicket, setTicketQrData]);

  // Auto-sync latest ticket data (status, position, wait time, prescription_notes) whenever activeTicket exists
  useEffect(() => {
    if (!activeTicket?.ticket_id) return;

    let isSubscribed = true;

    const syncTicketStatus = () => {
      if (document.hidden) return; // Do not poll when tab is inactive
      fetch(`${API_BASE}/api/v1/plugin/ticket/${activeTicket.ticket_id}`)
        .then((r) => r.json())
        .then((d) => {
          if (!isSubscribed) return;
          if (d.status === "success" && d.ticket) {
            const live = isLiveTicketStatus(d.ticket);
            if (!live) {
              // Ticket was completed or cancelled on the server! Clear from active queue view
              setActiveTicket(null);
              if (setTicketQrData) setTicketQrData(null);
              try {
                localStorage.removeItem("ai_queue_active_ticket");
              } catch (e) { }
              removeTicketFromFamilyTickets(d.ticket.ticket_id);
              fetchUserTicketHistory();
              fetchUserAppointments();
            } else {
              setActiveTicket((prev) => ({ ...prev, ...d.ticket }));
            }
          }
        })
        .catch(() => { });
    };

    // Relaxed 30s fallback interval (WebSockets handle live turn calls, completion, holds in real-time)
    const interval = setInterval(syncTicketStatus, 30000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeTicket?.ticket_id, removeTicketFromFamilyTickets, fetchUserTicketHistory, fetchUserAppointments, setActiveTicket, setTicketQrData]);

  // Helper: Matches a record (ticket or appointment) strictly to a specific family profile / member
  const doesRecordMatchMember = useCallback((record, member) => {
    if (!record || !member) return false;
    const memId = String(member.id || "self");
    const memName = String(member.name || "").trim().toLowerCase();

    // 1. Direct family_member_id matching
    const recordFamId = record.family_member_id ? String(record.family_member_id) : null;
    if (recordFamId) {
      if (memId === "self") {
        return recordFamId === "self";
      }
      return recordFamId === memId;
    }

    // 2. Direct patient name matching
    const recName = String(record.patient_name || record.name || "").trim().toLowerCase();
    if (memName && recName) {
      if (recName === memName) return true;
      // If member is self, also allow matching currentUser email or username
      if (memId === "self") {
        const uName = String(currentUser?.username || "").trim().toLowerCase();
        const uEmail = String(currentUser?.email || "").trim().toLowerCase();
        if ((uName && recName === uName) || (uEmail && recName === uEmail)) {
          return true;
        }
      }
    }

    // 3. Fallback for legacy records with no family_member_id:
    // If viewing 'self', make sure the record DOES NOT belong to another registered dependent
    if (memId === "self") {
      const otherDepNames = (familyMembers || [])
        .filter((m) => m && m.id !== "self" && m.name)
        .map((m) => String(m.name).trim().toLowerCase());
      if (recName && otherDepNames.includes(recName)) {
        return false;
      }
      return true;
    }

    return false;
  }, [currentUser, familyMembers]);

  const activeAppointments = useMemo(() => {
    return userAppointments.filter((apt) => {
      const s = (apt.status || "").toLowerCase();
      const isActive = ["scheduled", "booked", "check_in_available", "checked_in", "serving", "waiting", "expired"].includes(s);
      if (!isActive) return false;
      const tId = apt.ticket_id;
      if (tId) {
        if (userTicketHistory.some((t) => t.ticket_id === tId && ["cancelled", "completed", "expired", "no_show"].includes((t.status || "").toLowerCase()))) {
          return false;
        }
      }
      // Strictly scope active appointments to selected profile
      return doesRecordMatchMember(apt, selectedMember);
    });
  }, [userAppointments, userTicketHistory, doesRecordMatchMember, selectedMember]);

  const currentActiveScheduledApt = useMemo(() => {
    const isUnexpiredBooking = (a) => {
      if (!a) return false;
      const s = (a.status || "").toLowerCase();
      if (!["scheduled", "booked", "check_in_available"].includes(s)) return false;
      const timing = getAppointmentTiming(a);
      if (timing && timing.isExpired) return false;
      return true;
    };

    const scheduledFromList = activeAppointments.find(isUnexpiredBooking);
    if (scheduledFromList) return scheduledFromList;
    if (bookedAppointment && isUnexpiredBooking(bookedAppointment)) {
      if (doesRecordMatchMember(bookedAppointment, selectedMember)) {
        return bookedAppointment;
      }
    }
    return null;
  }, [activeAppointments, bookedAppointment, selectedMember, doesRecordMatchMember]);

  const handleBookFollowUp = useCallback((record) => {
    if (record) {
      if (record.patient_name || record.name) {
        setName(record.patient_name || record.name);
      }
      const targetDept = record.service_category || record.department_name || record.department || "consultation";
      if (targetDept) {
        setCategory(targetDept);
      }
      if (record.age) setAge(record.age);
      if (record.gender) setGender(record.gender.toLowerCase());
    }
    handleTabChange("book");
  }, []);

  const historyAppointments = useMemo(() => {
    return userAppointments.filter((apt) => {
      const s = (apt.status || "").toLowerCase();
      const isCompleted = s === "completed" || s === "transferred";
      const isCancelled = s === "cancelled" || s === "no_show" || s === "expired";
      const tId = apt.ticket_id;
      const tMatch = tId && userTicketHistory.find((t) => t.ticket_id === tId);
      const isTicketCompleted = tMatch && ["completed", "transferred"].includes((tMatch.status || "").toLowerCase());
      const isTicketCancelled = tMatch && ["cancelled", "expired", "no_show"].includes((tMatch.status || "").toLowerCase());

      if (!isCompleted && !isTicketCompleted && (!showCancelledHistory || (!isCancelled && !isTicketCancelled))) {
        return false;
      }
      // Strictly scope history appointments to selected profile
      return doesRecordMatchMember(apt, selectedMember);
    });
  }, [userAppointments, userTicketHistory, showCancelledHistory, doesRecordMatchMember, selectedMember]);

  // Helper: safely collapse multi-stage transferred tickets of a visit journey into ONE unified ticket
  const collapseTicketJourneys = useCallback((ticketsList) => {
    if (!Array.isArray(ticketsList) || ticketsList.length === 0) return [];

    const ticketMap = new Map();
    ticketsList.forEach((t) => {
      if (t?.ticket_id) ticketMap.set(String(t.ticket_id), t);
    });

    const parentIdSet = new Set();
    ticketsList.forEach((t) => {
      if (t.parent_ticket_id && ticketMap.has(String(t.parent_ticket_id))) {
        parentIdSet.add(String(t.parent_ticket_id));
      }
      if (Array.isArray(t.queue_events)) {
        t.queue_events.forEach((ev) => {
          if (ev.event_type === "TRANSFERRED" && ev.metadata?.transferred_to_ticket) {
            if (ticketMap.has(String(ev.metadata.transferred_to_ticket))) {
              parentIdSet.add(String(t.ticket_id));
            }
          }
        });
      }
      if (Array.isArray(t.transfers)) {
        t.transfers.forEach((tr) => {
          if (tr.direction === "outgoing" && tr.transferred_to_ticket && ticketMap.has(String(tr.transferred_to_ticket))) {
            parentIdSet.add(String(t.ticket_id));
          }
        });
      }
    });

    const collapsed = [];

    for (const t of ticketsList) {
      const tid = String(t.ticket_id || "");
      const s = String(t.status || "").toLowerCase();

      // If this ticket is marked "transferred" and its target child ticket is present in this list,
      // skip it from the top-level list so it collapses into the child ticket card.
      if (s === "transferred" && parentIdSet.has(tid)) {
        continue;
      }

      // If already has transfer_stages from backend, preserve them
      let stages = Array.isArray(t.transfer_stages) && t.transfer_stages.length > 0 ? [...t.transfer_stages] : [];

      if (stages.length === 0) {
        let curr = t;
        const visitedInChain = new Set();

        while (curr && !visitedInChain.has(String(curr.ticket_id))) {
          visitedInChain.add(String(curr.ticket_id));
          const stageDoc = curr.doctor_name || curr.served_by_doctor_name || "";
          const stageDept = curr.department_name || curr.service_category || "General OPD";

          stages.unshift({
            ticket_id: curr.ticket_id,
            department: stageDept,
            dept_code: curr.service_category || "consultation",
            doctor_name: stageDoc,
            status: (curr.status || "").toLowerCase(),
            prescription_notes: curr.prescription_notes || "",
            medical_condition: curr.medical_condition || "",
            serve_start_time: curr.serve_start_time,
            serve_end_time: curr.serve_end_time,
            created_at: curr.created_at || curr.join_timestamp,
          });

          if (curr.parent_ticket_id && ticketMap.has(String(curr.parent_ticket_id))) {
            curr = ticketMap.get(String(curr.parent_ticket_id));
          } else {
            const parentByTr = ticketsList.find((ot) => {
              if (visitedInChain.has(String(ot.ticket_id))) return false;
              if (Array.isArray(ot.transfers)) {
                return ot.transfers.some(
                  (tr) => tr.direction === "outgoing" && String(tr.transferred_to_ticket) === String(curr.ticket_id)
                );
              }
              return false;
            });
            if (parentByTr) {
              curr = parentByTr;
            } else {
              break;
            }
          }
        }
      }

      stages.forEach((stg, idx) => {
        stg.stage_number = idx + 1;
      });

      const isTransferred = stages.length > 1 || Boolean(t.transferred_from_dept) || Boolean(t.parent_ticket_id) || Boolean(t.is_transferred);
      const transferTrail = stages
        .map((stg) => stg.department)
        .filter((dept, idx, arr) => idx === 0 || dept !== arr[idx - 1])
        .join(" → ");
      const originDept = stages[0]?.department || t.transferred_from_dept || t.department_name || t.service_category || "General OPD";
      const allDoctors = Array.from(new Set(stages.map((stg) => stg.doctor_name).filter(Boolean)));

      // Merge multi-stage prescription notes if stages > 1 and notes not already unified
      let unifiedNotes = t.prescription_notes || "";
      if (stages.length > 1) {
        let mergedDiag = "";
        let mergedAdvices = [];
        let mergedLabTests = [];
        let mergedFollowUp = "";
        let mergedMeds = [];
        const seenMeds = new Set();
        let targetDept = "";
        let transferNotes = "";

        for (const stg of stages) {
          let rx = null;
          try {
            if (stg.prescription_notes) {
              const str = typeof stg.prescription_notes === "object" ? stg.prescription_notes : JSON.parse(stg.prescription_notes);
              rx = str;
            }
          } catch (e) { }

          if (rx) {
            if (rx.diagnosis && rx.diagnosis !== "Clinical Consultation" && rx.diagnosis !== "General OPD") mergedDiag = rx.diagnosis;
            const cleanA = cleanAdviceText(rx.advice || rx.clinical_notes || "");
            if (cleanA && !mergedAdvices.includes(cleanA)) mergedAdvices.push(cleanA);
            if (rx.lab_tests && rx.lab_tests !== "no") mergedLabTests.push(rx.lab_tests);
            if (rx.follow_up) mergedFollowUp = cleanAdviceText(rx.follow_up) || rx.follow_up;
            if (rx.target_department) targetDept = rx.target_department;
            if (rx.transfer_notes) transferNotes = rx.transfer_notes;
            if (Array.isArray(rx.medicines)) {
              for (const m of rx.medicines) {
                const k = `${String(m.name || "").toLowerCase().trim()}_${String(m.dosage || "").toLowerCase().trim()}`;
                if (!seenMeds.has(k)) {
                  seenMeds.add(k);
                  mergedMeds.push(m);
                }
              }
            }
          }
        }

        const topDoc = t.doctor_name || t.served_by_doctor_name || stages[stages.length - 1]?.doctor_name || stages[0]?.doctor_name || "";
        const consolidated = {
          doctor_name: topDoc,
          doctor_department: t.department_name || t.service_category || "General OPD",
          diagnosis: mergedDiag || t.medical_condition || "Clinical Consultation",
          medicines: mergedMeds,
          lab_tests: mergedLabTests.join(", "),
          advice: mergedAdvices.join(" • ") || "Clinical consultation completed.",
          follow_up: mergedFollowUp || "Review as advised",
          target_department: targetDept,
          transfer_notes: transferNotes,
          stages: stages,
          prescribed_at: t.serve_end_time || t.created_at || new Date().toISOString(),
        };
        unifiedNotes = JSON.stringify(consolidated);
      }

      collapsed.push({
        ...t,
        is_transferred: isTransferred,
        transfer_trail: isTransferred ? transferTrail : (t.transfer_trail || null),
        transferred_from_dept: isTransferred ? originDept : (t.transferred_from_dept || null),
        transfer_stages: stages,
        prescription_notes: unifiedNotes,
        all_doctors: allDoctors.length > 0 ? allDoctors : (t.all_doctors || (t.doctor_name ? [t.doctor_name] : [])),
      });
    }

    return collapsed;
  }, []);

  // Walk-in tickets: completed, or cancelled/expired only if toggle is enabled, scoped to selected profile
  // and collapsed into unified single cards per transfer journey
  const historyTickets = useMemo(() => {
    const scoped = userTicketHistory.filter((t) => {
      const s = (t.status || "").toLowerCase();
      const isCompleted = s === "completed" || s === "transferred";
      const isCancelled = s === "cancelled" || s === "no_show" || s === "expired";
      if (!isCompleted && (!showCancelledHistory || !isCancelled)) {
        return false;
      }
      // Strictly scope history tickets to selected profile
      return doesRecordMatchMember(t, selectedMember);
    });
    return collapseTicketJourneys(scoped);
  }, [userTicketHistory, showCancelledHistory, doesRecordMatchMember, selectedMember, collapseTicketJourneys]);

  // Dynamically calculate accurate clinical summary metrics for the selected profile
  const selectedMemberHistoryStats = useMemo(() => {
    const allVisits = [];

    historyTickets.forEach((t) => {
      allVisits.push({
        date: t.created_at || t.join_timestamp || t.serve_end_time,
        department: t.department_name || t.service_category,
        doctor: t.doctor_name || t.served_by_doctor_name,
        diagnosis: t.medical_condition,
        prescription_notes: t.prescription_notes,
      });
    });

    historyAppointments.forEach((a) => {
      allVisits.push({
        date: a.appointment_date,
        department: a.department_name || a.service_category,
        doctor: a.doctor_name || a.served_by_doctor_name,
        diagnosis: a.reason || a.medical_condition,
        prescription_notes: a.prescription_notes,
      });
    });

    allVisits.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const totalVisitsCount = allVisits.length;
    const isReturning = totalVisitsCount > 0;
    const latest = allVisits[0] || null;

    const diagnosesSet = new Set();
    allVisits.forEach((v) => {
      if (v.diagnosis && v.diagnosis !== "general_checkup" && v.diagnosis !== "Clinical Consultation") {
        diagnosesSet.add(v.diagnosis);
      }
      if (v.prescription_notes) {
        try {
          const rx = typeof v.prescription_notes === "object" ? v.prescription_notes : JSON.parse(v.prescription_notes);
          if (rx?.diagnosis && rx.diagnosis !== "Clinical Consultation") {
            diagnosesSet.add(rx.diagnosis);
          }
        } catch (e) { }
      }
    });

    const summaryObj = {
      total_visits: totalVisitsCount,
      last_visit: latest?.date ? new Date(latest.date).toLocaleDateString() : (selectedMemberId === "self" ? myMedicalSummary?.last_visit : null),
      last_department: latest?.department || (selectedMemberId === "self" ? myMedicalSummary?.last_department : null),
      last_doctor: latest?.doctor || (selectedMemberId === "self" ? myMedicalSummary?.last_doctor : null),
      past_diagnoses: diagnosesSet.size > 0 ? Array.from(diagnosesSet).slice(0, 5) : (selectedMemberId === "self" ? (myMedicalSummary?.past_diagnoses || []) : []),
    };

    const patientObj = {
      name: selectedMember.name,
      age: selectedMember.age,
      gender: selectedMember.gender,
      relation: selectedMember.relation,
      total_visits: totalVisitsCount,
    };

    return {
      totalVisits: totalVisitsCount,
      isReturningPatient: isReturning,
      summary: totalVisitsCount > 0 ? summaryObj : null,
      patient: totalVisitsCount > 0 ? patientObj : null,
    };
  }, [historyTickets, historyAppointments, selectedMember, selectedMemberId, myMedicalSummary]);

  const displayedActiveAppointments = useMemo(() => {
    if (!aptFilterQuery.trim()) return activeAppointments;
    const q = aptFilterQuery.trim().toLowerCase();
    return activeAppointments.filter((apt) => {
      const idMatch = (apt.appointment_id || "").toLowerCase().includes(q);
      const ticketMatch = (apt.ticket_id || "").toLowerCase().includes(q);
      const docMatch = (apt.doctor_name || apt.served_by_doctor_name || "").toLowerCase().includes(q);
      const deptMatch = (apt.department_name || apt.service_category || "").toLowerCase().includes(q);
      const patientMatch = (apt.patient_name || "").toLowerCase().includes(q);
      const dateMatch = (apt.appointment_date || "").toLowerCase().includes(q);
      const slotMatch = (apt.time_slot || "").toLowerCase().includes(q);
      const hospMatch = (apt.hospital_name || "").toLowerCase().includes(q);
      return idMatch || ticketMatch || docMatch || deptMatch || patientMatch || dateMatch || slotMatch || hospMatch;
    });
  }, [activeAppointments, aptFilterQuery]);

  const displayedHistoryAppointments = useMemo(() => {
    if (historyFilterType === "walkin") return [];
    let list = historyAppointments;
    if (historyFilterType === "rx") {
      list = list.filter((apt) => {
        const effRx = apt.prescription_notes || (apt.ticket_id && userTicketHistory.find((t) => t.ticket_id === apt.ticket_id)?.prescription_notes);
        return !!effRx;
      });
    }
    if (!historySearchQuery.trim()) return list;
    const q = historySearchQuery.trim().toLowerCase();
    return list.filter((apt) => {
      const idMatch = (apt.appointment_id || "").toLowerCase().includes(q);
      const docMatch = (apt.doctor_name || apt.served_by_doctor_name || "").toLowerCase().includes(q);
      const deptMatch = (apt.department_name || apt.service_category || "").toLowerCase().includes(q);
      const patientMatch = (apt.patient_name || "").toLowerCase().includes(q);
      const diagMatch = (apt.prescription_notes || "").toLowerCase().includes(q);
      const dateMatch = (apt.appointment_date || "").toLowerCase().includes(q);
      return idMatch || docMatch || deptMatch || patientMatch || diagMatch || dateMatch;
    });
  }, [historyAppointments, historyFilterType, historySearchQuery, userTicketHistory]);

  const displayedHistoryTickets = useMemo(() => {
    if (historyFilterType === "appointments") return [];
    let list = historyTickets;
    if (historyFilterType === "rx") {
      list = list.filter((tk) => !!tk.prescription_notes);
    }
    if (!historySearchQuery.trim()) return list;
    const q = historySearchQuery.trim().toLowerCase();
    return list.filter((tk) => {
      const idMatch = String(tk.ticket_id || "").toLowerCase().includes(q) ||
        (Array.isArray(tk.transfer_stages) && tk.transfer_stages.some((s) => String(s.ticket_id || "").toLowerCase().includes(q)));
      const docMatch = (tk.doctor_name || tk.served_by_doctor_name || "").toLowerCase().includes(q) ||
        (Array.isArray(tk.all_doctors) && tk.all_doctors.some((d) => String(d).toLowerCase().includes(q)));
      const deptMatch = (tk.department_name || tk.service_category || "").toLowerCase().includes(q) ||
        (tk.transfer_trail || "").toLowerCase().includes(q);
      const patientMatch = (tk.name || "").toLowerCase().includes(q);
      const diagMatch = (tk.prescription_notes || "").toLowerCase().includes(q);
      const dateMatch = tk.created_at ? new Date(tk.created_at).toLocaleDateString().toLowerCase().includes(q) : false;
      return idMatch || docMatch || deptMatch || patientMatch || diagMatch || dateMatch;
    });
  }, [historyTickets, historyFilterType, historySearchQuery]);

  // Initial fetch on mount / user change to populate badge counts and data immediately
  const initialFetchUserKeyRef = useRef(null);
  useEffect(() => {
    const userKey = currentUser ? (currentUser.id || currentUser.email || currentUser.username) : "guest";
    if (initialFetchUserKeyRef.current === userKey) return;
    initialFetchUserKeyRef.current = userKey;

    fetchUserAppointments();
    fetchUserTicketHistory();
    fetchFamilyMembersList();
  }, [currentUser?.id, currentUser?.email, currentUser?.username]);

  // Live polling for "My Appointments", "History", "Family", and "Book" tabs with relaxed 25s fallback
  useEffect(() => {
    if (activeTab === "my_apts" || activeTab === "history" || activeTab === "book" || activeTab === "family") {
      fetchUserAppointments();
      if (activeTab === "history" || activeTab === "family") fetchUserTicketHistory();
      if (activeTab === "family") fetchFamilyMembersList();
      const interval = setInterval(() => {
        if (document.hidden) return; // Never poll when tab is inactive
        fetchUserAppointments();
        if (activeTab === "history" || activeTab === "family") fetchUserTicketHistory();
        if (activeTab === "family") fetchFamilyMembersList();
      }, 25000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Keep bookedAppointment in sync with the live userAppointments list.
  // If the booked appointment gets cancelled or checked-in via another route,
  // this effect ensures the confirmation card reflects that without a page refresh.
  useEffect(() => {
    if (!bookedAppointment) return;
    const live = userAppointments.find(
      (a) => a.appointment_id === bookedAppointment.appointment_id
    );
    if (!live) return;
    if (live.status !== bookedAppointment.status) {
      setBookedAppointment((prev) => ({ ...prev, status: live.status }));
    }
  }, [userAppointments, bookedAppointment]);

  // Real-time Socket.IO synchronization for appointments and tickets (Debounced & Scoped)
  const userHistoryDebounceRef = useRef(null);
  const appointmentsDebounceRef = useRef(null);
  const familyDebounceRef = useRef(null);

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    // Helper: Debounce ticket history refresh
    const debounceFetchTicketHistory = () => {
      if (userHistoryDebounceRef.current) clearTimeout(userHistoryDebounceRef.current);
      userHistoryDebounceRef.current = setTimeout(() => {
        fetchUserTicketHistory();
      }, 400);
    };

    // Helper: Debounce appointments refresh
    const debounceFetchAppointments = () => {
      if (appointmentsDebounceRef.current) clearTimeout(appointmentsDebounceRef.current);
      appointmentsDebounceRef.current = setTimeout(() => {
        fetchUserAppointments();
      }, 400);
    };

    // Helper: Debounce family list refresh
    const debounceFetchFamily = () => {
      if (familyDebounceRef.current) clearTimeout(familyDebounceRef.current);
      familyDebounceRef.current = setTimeout(() => {
        if (typeof fetchFamilyMembersList === "function") fetchFamilyMembersList();
      }, 400);
    };

    const handleQueueUpdated = (data) => {
      if (data) {
        if (Array.isArray(data.snapshot)) setFacilityQueue(data.snapshot);
        if (data.analytics) setFacilityAnalytics(data.analytics);
      }
    };

    const handleTicketEvent = (data) => {
      const t = data?.ticket || data?.new_ticket;
      const tid = t?.ticket_id || data?.ticket_id;
      if (!tid) return;

      const userEmail = (currentUser?.email || "").toLowerCase().trim();
      const userName = (currentUser?.name || currentUser?.username || "").toLowerCase().trim();
      const tEmail = (t?.user_email || "").toLowerCase().trim();
      const tName = (t?.name || "").toLowerCase().trim();
      const isMyTicket = Boolean(
        (activeTicket?.ticket_id && tid === activeTicket.ticket_id) ||
        (userEmail && tEmail && tEmail === userEmail) ||
        (userName && tName && tName === userName) ||
        (familyMembers && familyMembers.some((m) => m.name && m.name.toLowerCase().trim() === tName))
      );

      if (data?.type === "ticket_cancelled" || data?.status === "cancelled" || !t || !isLiveTicketStatus(t)) {
        if (activeTicket?.ticket_id === tid) {
          setActiveTicket(null);
          if (setTicketQrData) setTicketQrData(null);
          try { localStorage.removeItem("ai_queue_active_ticket"); } catch (e) { }
        }
        removeTicketFromFamilyTickets(tid);
        if (isMyTicket) debounceFetchTicketHistory();
      } else if (t && isLiveTicketStatus(t)) {
        if (activeTicket?.ticket_id === tid || activeTicket?.ticket_id === data?.original_ticket?.ticket_id) {
          setActiveTicket((prev) => ({ ...prev, ...t }));
          try { localStorage.setItem("ai_queue_active_ticket", JSON.stringify(t)); } catch (e) { }
        }
        if (isMyTicket) {
          // Update in familyTickets map
          setFamilyTickets((prev) => {
            const updated = { ...prev };
            let changed = false;
            Object.keys(updated).forEach((k) => {
              if (updated[k]?.ticket_id === tid || updated[k]?.ticket_id === data?.original_ticket?.ticket_id) {
                updated[k] = { ...updated[k], ...t };
                changed = true;
              }
            });
            return changed ? updated : prev;
          });
          debounceFetchTicketHistory();
        }
      }
    };

    socket.on("family_members_updated", debounceFetchFamily);
    socket.on("appointment_updated", debounceFetchAppointments);
    socket.on("queue_updated", handleQueueUpdated);
    socket.on("queue_update", handleQueueUpdated);

    socket.on("ticket_created", handleTicketEvent);
    socket.on("ticket_cancelled", handleTicketEvent);
    socket.on("ticket_completed", handleTicketEvent);
    socket.on("ticket_updated", handleTicketEvent);
    socket.on("priority_changed", handleTicketEvent);
    socket.on("ticket_transferred", handleTicketEvent);
    socket.on("ticket_held", handleTicketEvent);
    socket.on("ticket_recalled", handleTicketEvent);
    socket.on("ticket_noshow", handleTicketEvent);
    socket.on("now_serving", handleTicketEvent);

    return () => {
      socket.off("family_members_updated", debounceFetchFamily);
      socket.off("appointment_updated", debounceFetchAppointments);
      socket.off("queue_updated", handleQueueUpdated);
      socket.off("queue_update", handleQueueUpdated);

      socket.off("ticket_created", handleTicketEvent);
      socket.off("ticket_cancelled", handleTicketEvent);
      socket.off("ticket_completed", handleTicketEvent);
      socket.off("ticket_updated", handleTicketEvent);
      socket.off("priority_changed", handleTicketEvent);
      socket.off("ticket_transferred", handleTicketEvent);
      socket.off("ticket_held", handleTicketEvent);
      socket.off("ticket_recalled", handleTicketEvent);
      socket.off("ticket_noshow", handleTicketEvent);
      socket.off("now_serving", handleTicketEvent);
    };
  }, [socketRef, activeTicket?.ticket_id, currentUser, familyMembers, fetchUserAppointments, fetchUserTicketHistory, removeTicketFromFamilyTickets]);

  const handleSelectMember = (member) => {
    if (!member) return;
    const memId = member.id || "self";
    setSelectedMemberId(memId);
    setName(member.name || "");
    if (member.age) setAge(member.age);
    if (member.gender) setGender(member.gender.toLowerCase());

    if (setActiveFamilyMemberProp) {
      setActiveFamilyMemberProp(memId === "self" ? null : member);
    }

    if (member.name && member.name !== "Self") {
      fetchUserAppointments(member.name);
      fetchUserTicketHistory(member.name);
    }

    // If this family member already has a live active ticket in familyTickets, switch activeTicket to it
    const depNames = (familyMembers || [])
      .filter((m) => m && m.id !== "self")
      .map((m) => String(m.name || "").toLowerCase().trim())
      .filter(Boolean);

    const memTicket = memId === "self"
      ? (() => {
        const cand = familyTickets["self"];
        if (!cand) return null;
        const candName = String(cand.name || "").toLowerCase().trim();
        if (depNames.includes(candName) || (cand.family_member_id && cand.family_member_id !== "self")) {
          return null;
        }
        return cand;
      })()
      : (familyTickets[memId] || familyTickets[String(memId)] || (member.name ? (familyTickets[`name_${member.name.toLowerCase().trim()}`] || familyTickets[member.name.toLowerCase().trim()]) : null));

    if (memTicket && isLiveTicketStatus(memTicket)) {
      setActiveTicket(memTicket);
      fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${memTicket.ticket_id}`)
        .then((r) => r.json())
        .then((qr) => setTicketQrData(qr))
        .catch((e) => console.log("QR error:", e));
    } else {
      // Query backend for active tickets for this member if not found in local memory
      const memberSearchName = member.name && member.name !== "Self" ? member.name : (currentUser?.email || currentUser?.phone || "");
      if (memberSearchName) {
        fetch(`${API_BASE}/api/v1/plugin/tickets/history/${encodeURIComponent(memberSearchName)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d && Array.isArray(d.tickets)) {
              const live = d.tickets.find((t) => {
                const isStatusLive = isLiveTicketStatus(t);
                if (!isStatusLive) return false;
                const tName = String(t.name || "").toLowerCase().trim();
                if (memId === "self") {
                  return (!t.family_member_id || t.family_member_id === "self") && !depNames.includes(tName);
                }
                return String(t.family_member_id) === String(memId) || (member.name && tName === member.name.toLowerCase().trim());
              });
              if (live) {
                setActiveTicket(live);
                setFamilyTickets((prev) => {
                  const updated = { ...prev, [memId]: live };
                  if (member.name) {
                    updated[`name_${member.name.toLowerCase().trim()}`] = live;
                    updated[member.name.toLowerCase().trim()] = live;
                  }
                  if (memId !== "self" && updated["self"]?.ticket_id === live.ticket_id) {
                    delete updated["self"];
                  }
                  try {
                    const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
                    localStorage.setItem(ticketStorageKey, JSON.stringify(updated));
                    window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: updated }));
                  } catch (e) { }
                  return updated;
                });
                fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${live.ticket_id}`)
                  .then((r) => r.json())
                  .then((qr) => setTicketQrData(qr))
                  .catch((e) => console.log("QR error:", e));
                return;
              }
            }
            setActiveTicket(null);
            if (setTicketQrData) setTicketQrData(null);
            if (memId === "self") {
              try {
                localStorage.removeItem("ai_queue_active_ticket");
              } catch (e) { }
            }
          })
          .catch(() => {
            setActiveTicket(null);
            if (setTicketQrData) setTicketQrData(null);
            if (memId === "self") {
              try {
                localStorage.removeItem("ai_queue_active_ticket");
              } catch (e) { }
            }
          });
      } else {
        setActiveTicket(null);
        if (setTicketQrData) setTicketQrData(null);
        if (memId === "self") {
          try {
            localStorage.removeItem("ai_queue_active_ticket");
          } catch (e) { }
        }
      }
    }
  };

  // Sync when activeFamilyMemberProp changes from Header or parent
  useEffect(() => {
    if (activeFamilyMemberProp !== undefined) {
      const targetId = activeFamilyMemberProp ? activeFamilyMemberProp.id : "self";
      if (String(targetId) !== String(selectedMemberId)) {
        const mem = (familyMembers || []).find((m) => String(m.id) === String(targetId)) || (targetId === "self" ? selfObj : activeFamilyMemberProp);
        if (mem) {
          handleSelectMember(mem);
        }
      }
    }
  }, [activeFamilyMemberProp]);



  // Sync when App-level family members prop changes
  useEffect(() => {
    if (familyMembersProp !== null) {
      // familyMembers computed above auto-updates since it reads familyMembersProp
      // If current selected member is no longer in the list, reset to self
      if (selectedMemberId !== "self") {
        const stillExists = (familyMembersProp || []).some(m => m.id === selectedMemberId);
        if (!stillExists) setSelectedMemberId("self");
      }
    }
  }, [familyMembersProp]);

  const handleAddMember = async (newMember) => {
    const tempId = newMember.id || `dep_${Date.now()}`;
    const initialMember = { ...newMember, id: tempId };

    // 1. Instantly update local state so the member shows up immediately with 0 delay
    const currentDependents = familyMembers.filter((m) => m && m.id !== "self" && m.id !== tempId);
    const updatedDependents = [...currentDependents, initialMember];
    setFamilyMembers([selfObj, ...updatedDependents]);
    handleSelectMember(initialMember);

    // 2. Persist to backend database
    if (currentUser && currentUser.email) {
      try {
        const token = currentUser.token || localStorage.getItem("ai_queue_token");
        const res = await fetch(`${API_BASE}/api/v1/family-members`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": currentUser.email,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(newMember),
        });
        const data = await res.json();
        if (data.status === "success" && data.member) {
          const savedMember = data.member;
          const reconciled = updatedDependents.map((m) => (m.id === tempId ? savedMember : m));
          setFamilyMembers([selfObj, ...reconciled]);
          window.dispatchEvent(new CustomEvent("family_members_updated", { detail: reconciled }));
          if (onFamilyMembersChange) onFamilyMembersChange(reconciled);
          handleSelectMember(savedMember);
          return;
        }
      } catch (err) {
        console.log("Error saving family member:", err);
      }
    }

    window.dispatchEvent(new CustomEvent("family_members_updated", { detail: updatedDependents }));
    if (onFamilyMembersChange) onFamilyMembersChange(updatedDependents);
    showToast(
      language === "hi"
        ? `${initialMember.name} को पारिवारिक प्रोफ़ाइल में जोड़ा गया।`
        : `Added ${initialMember.name} to family profiles.`,
      "success"
    );
  };

  const handleEditMember = async (updatedMember) => {
    // 1. Immediately update UI state
    const currentDependents = familyMembers.filter((m) => m && m.id !== "self");
    const updatedDependents = currentDependents.map((m) => (m.id === updatedMember.id ? { ...m, ...updatedMember } : m));
    setFamilyMembers([selfObj, ...updatedDependents]);
    setEditingMember(null);
    showToast(
      language === "hi" ? "प्रोफ़ाइल सफलतापूर्वक अपडेट की गई।" : "Profile updated successfully.",
      "success"
    );

    // 2. Persist to backend database
    if (currentUser && currentUser.email) {
      try {
        const token = currentUser.token || localStorage.getItem("ai_queue_token");
        await fetch(`${API_BASE}/api/v1/family-members/${encodeURIComponent(updatedMember.id)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": currentUser.email,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(updatedMember),
        });
        window.dispatchEvent(new CustomEvent("family_members_updated", { detail: updatedDependents }));
        if (onFamilyMembersChange) onFamilyMembersChange(updatedDependents);
      } catch (err) {
        console.log("Error updating family member:", err);
      }
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (memberId === "self") return;

    // 1. Immediately update UI state
    const updatedDependents = familyMembers.filter((m) => m && m.id !== "self" && m.id !== memberId);
    setFamilyMembers([selfObj, ...updatedDependents]);

    if (familyTickets[memberId]) {
      const updatedTickets = { ...familyTickets };
      delete updatedTickets[memberId];
      setFamilyTickets(updatedTickets);
    }

    if (selectedMemberId === memberId) {
      setSelectedMemberId("self");
      setName(selfObj.name);
    }

    showToast(
      language === "hi" ? "पारिवारिक प्रोफ़ाइल हटा दी गई।" : "Family member profile removed.",
      "info"
    );

    // 2. Persist delete to backend database
    if (currentUser && currentUser.email) {
      try {
        const token = currentUser.token || localStorage.getItem("ai_queue_token");
        await fetch(`${API_BASE}/api/v1/family-members/${encodeURIComponent(memberId)}`, {
          method: "DELETE",
          headers: {
            "X-User-Email": currentUser.email,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        window.dispatchEvent(new CustomEvent("family_members_updated", { detail: updatedDependents }));
        if (onFamilyMembersChange) onFamilyMembersChange(updatedDependents);
      } catch (err) {
        console.log("Error deleting family member:", err);
      }
    }
  };

  // Sync when patient profile is switched via Header dropdown
  useEffect(() => {
    const handleSwitchEvent = (e) => {
      if (e && e.detail) {
        handleSelectMember(e.detail);
      }
    };
    const handleFamilySync = (e) => {
      if (e && e.detail) {
        setFamilyMembers(e.detail);
      } else {
        setFamilyMembers(getInitialFamilyMembers());
      }
    };
    window.addEventListener("switch_patient_profile", handleSwitchEvent);
    window.addEventListener("family_members_updated", handleFamilySync);
    return () => {
      window.removeEventListener("switch_patient_profile", handleSwitchEvent);
      window.removeEventListener("family_members_updated", handleFamilySync);
    };
  }, [familyMembers, familyTickets]);

  // 1. Instant Walk-In Ticket Checkin
  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // 1 Ticket Per Profile Policy guard
    if (isLiveTicket) {
      const activeT = activeTicket;
      const memName = selectedMember ? selectedMember.name : (name || "Patient");
      const warnMsg = language === "hi"
        ? `आपके पास पहले से ही ${memName} के लिए सक्रिय टोकन #${activeT.ticket_id} मौजूद है। अस्पताल नीति के अनुसार 1 मरीज़ के लिए 1 समय पर केवल 1 सक्रिय टोकन मान्य है। नया टोकन लेने के लिए कृपया मौजूदा टोकन पूरा होने की प्रतीक्षा करें या इसे रद्द करें।`
        : `Active ticket #${activeT.ticket_id} is already in progress for ${memName}. Hospital policy permits only 1 active ticket per patient profile at a time. Please wait for your turn or cancel your current ticket to switch departments.`;
      setStatusMsg(warnMsg);
      showToast(warnMsg, "warn");
      return;
    }

    // OPD status gate: Walk-in registration only allowed when OPD is open (Emergency priority can bypass 24/7)
    const isEmergency = Number(priority) === 1;
    if (registrationStatus.isClosed && !isEmergency) {
      const closedMsg = registrationStatus.reason ||
        (language === "hi"
          ? "ओपीडी वर्तमान में बंद है। कतार प्रणाली केवल ओपीडी खुलने के समय काम करती है।"
          : "OPD is currently closed. The walk-in queue system only operates when the OPD is open.");
      setStatusMsg(closedMsg);
      showToast(closedMsg, "warn");
      return;
    }

    setStatusMsg("Calculating AI clinical complexity & predicting wait time...");

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          consumer_type: "hospital",
          service_category: category,
          name: name,
          urgency: Number(priority) === 1 ? "emergency" : "routine",
          priority_level: Number(priority),
          user_email: currentUser ? currentUser.email : "",
          age: Number(age) || 30,
          gender: gender,
          medical_condition: medicalCondition === "other_custom" ? (customSymptom.trim() || "Other Symptom") : medicalCondition,
          pre_existing_condition: preExistingCondition,
          // Include family_member_id when booking for a dependent
          ...(selectedMemberId && selectedMemberId !== "self" ? { family_member_id: selectedMemberId } : {}),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const t = data.ticket;
        setActiveTicket(t);

        try {
          localStorage.setItem("last_patient_name", name);
          if (selectedMemberId === "self") {
            localStorage.setItem("ai_queue_active_ticket", JSON.stringify(t));
          }
        } catch (e) { }

        // Record ticket in family tickets map under active member
        setFamilyTickets((prev) => {
          const updated = { ...prev, [selectedMemberId]: t };
          if (name) {
            updated[`name_${name.toLowerCase().trim()}`] = t;
            updated[name.toLowerCase().trim()] = t;
          }
          if (selectedMemberId !== "self" && updated["self"]?.ticket_id === t.ticket_id) {
            delete updated["self"];
          }
          try {
            const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
            localStorage.setItem(ticketStorageKey, JSON.stringify(updated));
          } catch (e) { }
          window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: updated }));
          return updated;
        });

        const successText = `Ticket #${t.ticket_id} Issued for ${name}. AI Service Estimate: ${t.predicted_service_minutes} min.`;
        setStatusMsg(successText);
        showToast(successText, "success");

        fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${t.ticket_id}`)
          .then((r) => r.json())
          .then((qr) => setTicketQrData(qr))
          .catch((e) => console.log("QR error:", e));

        try {
          window.dispatchEvent(new CustomEvent("ticket_created", { detail: { ticket: t, tenant_id: tenantId } }));
          window.dispatchEvent(new CustomEvent("active_ticket_updated", { detail: t }));
          if (typeof BroadcastChannel !== "undefined") {
            const bc = new BroadcastChannel("hospital_live_queue_sync");
            bc.postMessage({ type: "TICKET_CREATED", ticket: t, tenant_id: tenantId });
            bc.close();
          }
        } catch (e) { }
      } else {
        const err = await res.json();
        if (res.status === 409 && (err.ticket || err.existing_ticket)) {
          const exist = err.ticket || err.existing_ticket;
          setActiveTicket(exist);
          setFamilyTickets((prev) => {
            const updated = { ...prev, [selectedMemberId]: exist };
            try {
              const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
              localStorage.setItem(ticketStorageKey, JSON.stringify(updated));
            } catch (e) { }
            window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: updated }));
            return updated;
          });
          if (setTicketQrData) {
            fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${exist.ticket_id}`)
              .then((rqr) => rqr.json())
              .then((qr) => setTicketQrData(qr))
              .catch(() => { });
          }
        }
        const msg = typeof err.detail === "string" ? err.detail : Array.isArray(err.detail) ? err.detail.map((d) => d.msg || JSON.stringify(d)).join(", ") : (err.message || "Failed to issue ticket.");
        setStatusMsg(res.status === 409 ? `Notice: ${msg}` : `Error: ${msg}`);
        showToast(msg, res.status === 409 ? "warn" : "error");
      }
    } catch (err) {
      setStatusMsg(`Join failed: ${err.message}`);
      showToast(language === "hi" ? `टोकन जारी करने में विफलता: ${err.message}` : `Join queue failed: ${err.message}`, "error");
    }
  };

  // 2. Book Pre-scheduled Slot
  const handleBookSlot = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // 1 Ticket Per Profile Policy guard
    if (isLiveTicket) {
      const activeT = activeTicket;
      const memName = selectedMember ? selectedMember.name : (name || "Patient");
      const warnMsg = language === "hi"
        ? `आपके पास पहले से ही ${memName} के लिए सक्रिय टोकन #${activeT.ticket_id} मौजूद है। अस्पताल नीति के अनुसार 1 मरीज़ के लिए 1 समय पर केवल 1 सक्रिय टोकन मान्य है। नया टोकन लेने या अपॉइंटमेंट बुक करने के लिए कृपया मौजूदा टोकन पूरा होने की प्रतीक्षा करें या इसे रद्द करें।`
        : `Active ticket #${activeT.ticket_id} is already in progress for ${memName}. Hospital policy permits only 1 active ticket per patient profile at a time. Please wait for your turn or cancel your current ticket before booking a new appointment.`;
      setStatusMsg(warnMsg);
      showToast(warnMsg, "warn");
      return;
    }

    if (currentActiveScheduledApt) {
      const memName = selectedMember ? selectedMember.name : (name || "Patient");
      const warnMsg = language === "hi"
        ? `आपके पास पहले से ही ${memName} के लिए सक्रिय अपॉइंटमेंट (${currentActiveScheduledApt.appointment_id}) आरक्षित है। अस्पताल नीति के अनुसार 1 मरीज़ के लिए 1 समय पर केवल 1 अपॉइंटमेंट या टोकन मान्य है।`
        : `An active appointment (${currentActiveScheduledApt.appointment_id}) is already scheduled for ${memName}. Hospital policy permits only 1 active appointment per patient profile at a time. Please complete or cancel your existing appointment before reserving another slot.`;
      setStatusMsg(warnMsg);
      showToast(warnMsg, "warn");
      return;
    }

    if (!aptTimeSlot) {
      const warnMsg = language === "hi"
        ? "कृपया पहले उपलब्ध समय स्लॉट में से एक स्लॉट चुनें।"
        : "Please manually choose an available time slot before booking.";
      setStatusMsg(warnMsg);
      showToast(warnMsg, "warn");
      return;
    }
    setStatusMsg("Reserving hospital appointment slot...");

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          consumer_type: "hospital",
          service_category: category,
          patient_name: name,
          user_email: currentUser ? currentUser.email : name,
          appointment_date: aptDate,
          time_slot: aptTimeSlot,
          // Include family_member_id when booking for a dependent
          ...(selectedMemberId && selectedMemberId !== "self" ? { family_member_id: selectedMemberId } : {}),
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        const aptWithDept = {
          ...data.appointment,
          family_member_id: data.appointment?.family_member_id || (selectedMemberId && selectedMemberId !== "self" ? selectedMemberId : null),
          patient_name: data.appointment?.patient_name || name,
          department_name: data.appointment?.department_name || getDeptDisplayName(category),
          department: data.appointment?.department || getDeptDisplayName(category),
        };
        setBookedAppointment(aptWithDept);
        const successMsg = `Appointment Reserved. Code: ${data.appointment.appointment_id}`;
        setStatusMsg(successMsg);
        showToast(successMsg, "success");
        try {
          localStorage.setItem("last_patient_name", name);
        } catch (e) { }
        setUserAppointments((prev) => [
          aptWithDept,
          ...prev.filter((a) => a.appointment_id !== data.appointment.appointment_id),
        ]);
        fetchUserAppointments();
      } else {
        const msg = data.detail || data.message || "Failed to reserve appointment.";
        setStatusMsg(res.status === 409 ? `Notice: ${msg}` : `Booking failed: ${msg}`);
        showToast(msg, res.status === 409 ? "warn" : "error");
        if (data.appointment) {
          const aptWithDept = {
            ...data.appointment,
            family_member_id: data.appointment?.family_member_id || (selectedMemberId && selectedMemberId !== "self" ? selectedMemberId : null),
            patient_name: data.appointment?.patient_name || name,
            department_name: data.appointment?.department_name || getDeptDisplayName(data.appointment.service_category || category),
            department: data.appointment?.department || getDeptDisplayName(data.appointment.service_category || category),
          };
          setBookedAppointment(aptWithDept);
          setUserAppointments((prev) => [
            aptWithDept,
            ...prev.filter((a) => a.appointment_id !== data.appointment.appointment_id),
          ]);
        }
      }
    } catch (err) {
      setStatusMsg(`Booking failed: ${err.message}`);
      showToast(language === "hi" ? `अपॉइंटमेंट बुकिंग विफल: ${err.message}` : `Booking failed: ${err.message}`, "error");
    }
  };

  // 3. Hybrid Merge Check-In (Converts Scheduled Appointment -> Live Priority Queue Ticket)
  const handleAppointmentCheckIn = async (aptId) => {
    const targetId = aptId || "";
    if (!targetId.trim()) return;

    // Check-In Window and Ticket Expiration Validation
    const targetApt = (userAppointments || []).find((a) => a.appointment_id === targetId) ||
      (activeAppointments || []).find((a) => a.appointment_id === targetId);
    if (targetApt) {
      const timing = getAppointmentTiming(targetApt);
      if (timing) {
        if (timing.isExpired) {
          setStatusMsg(
            language === "hi"
              ? `चेक-इन संभव नहीं है: अपॉइंटमेंट टिकट समाप्त हो चुका है (${timing.formattedExpiresAt} पर)। चेक-इन केवल अपॉइंटमेंट समय के 1 घंटे बाद तक ही मान्य था।`
              : `Cannot check in: Appointment ticket expired at ${timing.formattedExpiresAt}. Check-in closed 1 hour after the scheduled appointment time.`
          );
          return;
        }

        const cleanAptDate = String(targetApt.appointment_date || "").slice(0, 10);
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        if (cleanAptDate > todayStr) {
          setStatusMsg(
            language === "hi"
              ? `चेक-इन अभी उपलब्ध नहीं है: यह अपॉइंटमेंट ${cleanAptDate} (${timing.formattedAppointmentTime}) के लिए निर्धारित है। चेक-इन ${cleanAptDate} को ${timing.formattedCheckInOpensAt} बजे खुलेगा।`
              : `Check-in not available yet: Your appointment is scheduled for ${cleanAptDate} at ${timing.formattedAppointmentTime}. Check-in opens on ${cleanAptDate} at ${timing.formattedCheckInOpensAt} (30 mins before appointment).`
          );
          return;
        }

        if (timing.isBooked && !timing.canCheckIn) {
          setStatusMsg(
            language === "hi"
              ? `चेक-इन अभी उपलब्ध नहीं है: चेक-इन ${timing.formattedCheckInOpensAt} बजे (अपॉइंटमेंट से 30 मिनट पहले) खुलेगा।`
              : `Check-in not available yet: Check-in opens at ${timing.formattedCheckInOpensAt} (30 minutes prior to your ${timing.formattedAppointmentTime} appointment).`
          );
          return;
        }
      }
    }

    // 1 Ticket Per Profile Policy guard for appointment check-in
    if (isLiveTicket && activeTicket.appointment_id !== targetId && activeTicket.ticket_id !== targetId) {
      const warnMsg = language === "hi"
        ? `आपके पास पहले से ही सक्रिय टोकन #${activeTicket.ticket_id} मौजूद है। कृपया इस अपॉइंटमेंट में चेक-इन करने से पहले पिछला टोकन पूरा होने की प्रतीक्षा करें या उसे रद्द करें।`
        : `You already have an active ticket (#${activeTicket.ticket_id}) in progress. Please complete or cancel your existing ticket before checking into another appointment.`;
      setStatusMsg(warnMsg);
      showToast(warnMsg, "warn");
      return;
    }

    // OPD status gate: Check-in only allowed when OPD is open
    if (registrationStatus.isClosed) {
      const closedMsg = registrationStatus.reason ||
        (language === "hi"
          ? "ओपीडी पंजीकरण वर्तमान में बंद है। लाइव कतार में चेक-इन केवल ओपीडी खुले होने पर ही संभव है।"
          : "OPD is currently closed. Checking in and joining the live line is only available when the OPD is open.");
      setStatusMsg(closedMsg);
      showToast(closedMsg, "warn");
      return;
    }

    setStatusMsg(`Checking in appointment ${targetId}...`);

    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: targetId }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        const t = data.ticket;
        const tkt = t;
        setActiveTicket(t);

        // Clear the booking confirmation card — Digital Ticket Pass takes over
        setBookedAppointment(null);

        if (selectedMemberId === "self") {
          try {
            localStorage.setItem("ai_queue_active_ticket", JSON.stringify(t));
          } catch (e) { }
        }

        // Record ticket in family tickets map under active member
        setFamilyTickets((prev) => {
          const updated = { ...prev, [selectedMemberId]: t };
          try {
            const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
            localStorage.setItem(ticketStorageKey, JSON.stringify(updated));
          } catch (e) { }
          window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: updated }));
          return updated;
        });

        const checkInMsg = `Appointment Checked In. Merged into Priority Line as Token #${t.ticket_id}`;
        setStatusMsg(checkInMsg);
        showToast(checkInMsg, "success");

        fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${t.ticket_id}`)
          .then((r) => r.json())
          .then((qr) => setTicketQrData(qr))
          .catch((e) => console.log("QR error:", e));

        try {
          window.dispatchEvent(new CustomEvent("ticket_created", { detail: { ticket: t, tenant_id: tenantId } }));
          window.dispatchEvent(new CustomEvent("active_ticket_updated", { detail: t }));
          if (typeof BroadcastChannel !== "undefined") {
            const bc = new BroadcastChannel("hospital_live_queue_sync");
            bc.postMessage({ type: "TICKET_CREATED", ticket: t, tenant_id: tenantId });
            bc.close();
          }
        } catch (e) { }

        setUserAppointments((prev) =>
          prev.map((a) =>
            a.appointment_id === targetId
              ? { ...a, status: "checked_in", ticket_id: t.ticket_id }
              : a
          )
        );
        fetchUserAppointments();
        refreshData();
      } else {
        const errorMsg = data.detail || data.message || "Failed to check in.";
        setStatusMsg(`Check-in error: ${errorMsg}`);
        showToast(`Check-in error: ${errorMsg}`, "error");
      }
    } catch (err) {
      setStatusMsg(`Check-in error: ${err.message}`);
      showToast(`Check-in error: ${err.message}`, "error");
    }
  };

  // 4. Cancel Ticket with Reason Validation
  const handleCancelTicket = async () => {
    if (!activeTicket) return;
    setCancelLoading(true);
    setCancelError("");
    const reasonText = cancelReason === "Other" && otherCancelReason.trim() ? otherCancelReason.trim() : cancelReason;

    try {
      const res = await fetch(`${API_BASE}/api/v1/tickets/${activeTicket.ticket_id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("token") || localStorage.getItem("ai_queue_token")
            ? { Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("ai_queue_token")}` }
            : {}),
          ...(currentUser?.email ? { "X-User-Email": currentUser.email } : {}),
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          ticket_id: activeTicket.ticket_id,
          reason: reasonText || "Patient requested cancellation",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Failed to cancel ticket.");
      }

      setActiveTicket(null);
      if (setTicketQrData) setTicketQrData(null);
      if (selectedMemberId === "self") {
        try {
          localStorage.removeItem("ai_queue_active_ticket");
        } catch (e) { }
      }

      // Clean from familyTickets map
      setFamilyTickets((prev) => {
        const updated = { ...prev };
        delete updated[selectedMemberId];
        Object.keys(updated).forEach((k) => {
          if (updated[k]?.ticket_id === activeTicket.ticket_id) delete updated[k];
        });
        try {
          const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
          localStorage.setItem(ticketStorageKey, JSON.stringify(updated));
        } catch (e) { }
        window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: updated }));
        return updated;
      });

      setShowCancelModal(false);
      const cancelNotice = `Ticket #${activeTicket.ticket_id} has been cancelled.`;
      setStatusMsg(cancelNotice);
      showToast(cancelNotice, "info");
      setUserAppointments((prev) =>
        prev.map((a) =>
          a.ticket_id === activeTicket.ticket_id || a.appointment_id === activeTicket.appointment_id
            ? { ...a, status: "cancelled" }
            : a
        )
      );
      fetchUserAppointments();
      fetchUserTicketHistory();
      if (refreshData) refreshData();
    } catch (err) {
      setCancelError(err.message || "Could not cancel ticket.");
      showToast(err.message || "Could not cancel ticket.", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  // 4b. Cancel an Appointment directly from My Appointments
  const handleCancelAppointment = (appointmentId, ticketId = null) => {
    if (!appointmentId) return;
    showConfirm({
      title: language === "hi" ? "अपॉइंटमेंट रद्द करें" : "Cancel Appointment",
      message: language === "hi"
        ? `क्या आप वाकई अपॉइंटमेंट #${appointmentId} रद्द करना चाहते हैं? यह कार्रवाई पूर्ववत नहीं की जा सकती।`
        : `Are you sure you want to cancel appointment #${appointmentId}? This action cannot be undone.`,
      confirmText: language === "hi" ? "हाँ, रद्द करें" : "Yes, Cancel Appointment",
      cancelText: language === "hi" ? "वापस जाएं" : "Keep Appointment",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(currentUser?.email ? { "X-User-Email": currentUser.email } : {}),
            },
            body: JSON.stringify({
              appointment_id: appointmentId,
              reason: "Patient cancelled from My Appointments",
            }),
          });
          const data = await res.json();
          if (res.ok) {
            showToast(
              language === "hi"
                ? `अपॉइंटमेंट #${appointmentId} सफलतापूर्वक रद्द कर दिया गया।`
                : `Appointment #${appointmentId} cancelled successfully.`,
              "success"
            );
            setStatusMsg(`Appointment ${appointmentId} cancelled.`);
            setUserAppointments((prev) =>
              prev.map((a) => (a.appointment_id === appointmentId ? {
                ...a,
                status: "cancelled",
                department_name: data.appointment?.department_name || a.department_name || getDeptDisplayName(a),
                department: data.appointment?.department || a.department || getDeptDisplayName(a),
              } : a))
            );
            setBookedAppointment((prev) => (prev?.appointment_id === appointmentId ? { ...prev, status: "cancelled" } : prev));
            if (ticketId) {
              removeTicketFromFamilyTickets(ticketId);
              if (activeTicket?.ticket_id === ticketId) {
                setActiveTicket(null);
                if (setTicketQrData) setTicketQrData(null);
                try {
                  localStorage.removeItem("ai_queue_active_ticket");
                } catch (e) { }
              }
            }
            fetchUserAppointments();
            fetchUserTicketHistory();
            if (refreshData) refreshData();
          } else {
            showToast(
              data.message || data.detail || (language === "hi" ? "अपॉइंटमेंट रद्द करने में विफल।" : "Failed to cancel appointment."),
              "error"
            );
          }
        } catch (e) {
          showToast(
            language === "hi" ? `त्रुटि: ${e.message}` : `Error cancelling appointment: ${e.message}`,
            "error"
          );
        }
      },
    });
  };

  // 5. Adjust Queue / Skip Positions Backward (Fairness: 1-3 positions back)
  const handleAdjustQueue = async (skipCount) => {
    if (!activeTicket) return;
    const positionsToSkip = Number(skipCount || selectedSkipCount || 1);
    setAdjustLoading(true);
    setAdjustError("");
    setAdjustSuccessMsg("");

    try {
      const res = await fetch(`${API_BASE}/api/v1/tickets/${activeTicket.ticket_id}/adjust`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentUser?.email ? { "X-User-Email": currentUser.email } : {}),
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          ticket_id: activeTicket.ticket_id,
          positions: positionsToSkip,
          skip_positions: positionsToSkip,
          reason: "Running late",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Failed to adjust queue.");
      }

      if (data.ticket) {
        setActiveTicket(data.ticket);
        setFamilyTickets((prev) => {
          const updated = { ...prev, [selectedMemberId]: data.ticket };
          try {
            const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
            localStorage.setItem(ticketStorageKey, JSON.stringify(updated));
          } catch (e) { }
          window.dispatchEvent(new CustomEvent("family_tickets_updated", { detail: updated }));
          return updated;
        });
      }
      const successText = data.message || `Postponed by ${positionsToSkip} position(s).`;
      setAdjustSuccessMsg(successText);
      setStatusMsg(successText);
      showToast(successText, "info");

      setTimeout(() => {
        setShowAdjustModal(false);
        setAdjustSuccessMsg("");
      }, 1200);

      fetchUserAppointments();
      if (refreshData) refreshData();
    } catch (err) {
      setAdjustError(err.message || "Could not adjust queue position.");
      showToast(err.message || "Could not adjust queue position.", "error");
    } finally {
      setAdjustLoading(false);
    }
  };

  // Switch active ticket pass between family members in real-time
  const handleSwitchTicketPass = (memId, tick) => {
    if (!tick) return;
    setActiveTicket(tick);
    setSelectedMemberId(memId);
    setName(tick.name || "");
    if (tick.age) setAge(tick.age);
    if (tick.gender) setGender(tick.gender.toLowerCase());
    const mem = familyMembers.find((m) => m.id === memId);
    if (mem && setActiveFamilyMemberProp) {
      setActiveFamilyMemberProp(mem.id === "self" ? null : mem);
    }
    fetch(`${API_BASE}/api/v1/plugin/ticket-qr/${tick.ticket_id}`)
      .then((r) => r.json())
      .then((qr) => setTicketQrData(qr))
      .catch((e) => console.log("QR error:", e));
  };
  return (
    <div className="patient-portal-root" style={{ width: "100%", paddingBottom: "4px" }}>
      <style>{`
        .patient-portal-root {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          color: var(--patient-text-main, #0F172A);
        }

        .patient-portal-root * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .patient-hero-accent {
          background: linear-gradient(135deg, #0284C7 0%, #06B6D4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
        }

        :root {
          --patient-card-bg: #FFFFFF;
          --patient-card-border: #E2E8F0;
          --patient-text-main: #0F172A;
          --patient-text-sub: #64748B;
          --patient-sub-card: #F8FAFC;
          --patient-tag-bg: #F0F9FF;
          --patient-tag-color: #0369A1;
          --patient-tag-border: #BAE6FD;
          --apt-active-bg: #F0F9FF;
          --apt-active-border: #BAE6FD;
          --emergency-card-bg: #FEF2F2;
          --emergency-card-border: #FECACA;
          --emergency-card-text: #DC2626;
        }

        body.theme-dark {
          --patient-card-bg: #0F172A;
          --patient-card-border: #1E293B;
          --patient-text-main: #F8FAFC;
          --patient-text-sub: #94A3B8;
          --patient-sub-card: #1E293B;
          --patient-tag-bg: rgba(2, 132, 199, 0.18);
          --patient-tag-color: #38BDF8;
          --patient-tag-border: rgba(56, 189, 248, 0.3);
          --apt-active-bg: rgba(2, 132, 199, 0.16);
          --apt-active-border: #0284C7;
          --emergency-card-bg: rgba(220, 38, 38, 0.14);
          --emergency-card-border: rgba(220, 38, 38, 0.35);
          --emergency-card-text: #F87171;
        }

        body.theme-dark .patient-tabs-bar {
          background: #0F172A;
          border-color: #1E293B;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        body.theme-dark .patient-nav-title {
          color: #F8FAFC;
        }

        body.theme-dark .tab-button-modern.inactive {
          background: #1E293B;
          color: #F1F5F9;
          border-color: #334155;
        }

        body.theme-dark .tab-button-modern.inactive:hover {
          background: #27354A;
          border-color: #475569;
        }

        body.theme-dark .tab-button-modern.inactive .tab-icon-wrapper {
          background: #0F172A;
          color: #38BDF8;
        }

        body.theme-dark .telemetry-sidebar-card {
          background: #0F172A;
          border-color: #1E293B;
          color: #F8FAFC;
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.4);
        }

        body.theme-dark .form-field-label {
          color: #CBD5E1;
        }

        body.theme-dark .modern-form-input {
          background: #1E293B;
          border-color: #334155;
          color: #F8FAFC;
        }

        body.theme-dark .modern-form-input:focus {
          border-color: #38BDF8;
          box-shadow: 0 0 0 3.5px rgba(56, 189, 248, 0.18);
          background: #1E293B;
        }

        body.theme-dark .modern-form-input::placeholder {
          color: #64748B;
        }

        body.theme-dark .modern-triage-card.inactive-triage {
          background: #1E293B;
          border-color: #334155;
        }

        body.theme-dark .modern-triage-card.inactive-triage .triage-title {
          color: #F1F5F9;
        }

        body.theme-dark .modern-triage-card.inactive-triage .triage-subtitle {
          color: #94A3B8;
        }

        body.theme-dark .modern-triage-card.inactive-triage:hover {
          background: #27354A;
          border-color: #475569;
        }

        body.theme-dark .modern-triage-card.active-routine {
          background: linear-gradient(135deg, rgba(2, 132, 199, 0.28) 0%, rgba(14, 165, 233, 0.18) 100%);
          border-color: #38BDF8;
          box-shadow: 0 4px 16px rgba(56, 189, 248, 0.2);
        }

        body.theme-dark .modern-triage-card.active-routine .triage-title {
          color: #38BDF8;
        }

        body.theme-dark .modern-triage-card.active-routine .triage-subtitle {
          color: #BAE6FD;
        }

        body.theme-dark .modern-triage-card.active-emergency {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(220, 38, 38, 0.18) 100%);
          border-color: #F87171;
          box-shadow: 0 4px 16px rgba(248, 113, 113, 0.2);
        }

        body.theme-dark .modern-triage-card.active-emergency .triage-title {
          color: #FCA5A5;
        }

        body.theme-dark .modern-triage-card.active-emergency .triage-subtitle {
          color: #FECACA;
        }

        body.theme-dark .patient-modal-box {
          background: #0F172A !important;
          border-color: #1E293B !important;
          color: #F8FAFC !important;
          box-shadow: 0 24px 48px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(56, 189, 248, 0.15) !important;
        }

        body.theme-dark .patient-secondary-btn {
          background: #1E293B !important;
          border-color: #334155 !important;
          color: #CBD5E1 !important;
        }

        body.theme-dark .patient-secondary-btn:hover {
          background: #27354A !important;
          border-color: #475569 !important;
          color: #F8FAFC !important;
        }

        .patient-nav-section {
          margin-bottom: 24px;
        }

        .patient-nav-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 8px 14px;
          background: var(--patient-card-bg, rgba(255, 255, 255, 0.98));
          border: 1px solid var(--patient-card-border, #E2E8F0);
          border-radius: 14px;
          box-shadow: 0 4px 18px -2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
          backdrop-filter: blur(12px);
          gap: 12px;
        }

        .patient-nav-title {
          font-size: 13.5px;
          font-weight: 800;
          color: var(--patient-text-main, #0F172A);
          letter-spacing: -0.2px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .patient-nav-title-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%);
          color: #0284C7;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(2, 132, 199, 0.15);
        }

        .patient-nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .hospital-switcher-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 10px;
          background: var(--patient-card-bg, #FFFFFF);
          border: 1px solid var(--patient-card-border, #CBD5E1);
          color: var(--patient-text-main, #0F172A);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hospital-switcher-btn:hover {
          border-color: #0284C7;
          background: var(--patient-tag-bg, #F0F9FF);
          box-shadow: 0 3px 10px rgba(2, 132, 199, 0.12);
          transform: translateY(-1px);
        }

        .hospital-switcher-badge {
          font-size: 11px;
          color: #0284C7;
          background: var(--patient-tag-bg, #EFF6FF);
          padding: 2px 7px;
          border-radius: 6px;
          font-weight: 700;
          border: 1px solid var(--patient-tag-border, #DBEAFE);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .patient-tabs-bar {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          background: var(--patient-card-bg, #FFFFFF);
          padding: 8px;
          border-radius: 18px;
          border: 1px solid var(--patient-card-border, #E2E8F0);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
          box-sizing: border-box;
          width: 100%;
        }

        .patient-tabs-bar .tab-button-modern {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          flex: 1 1 0 !important;
          box-sizing: border-box !important;
        }

        body.theme-dark .patient-nav-header {
          background: #0F172A;
          border-color: #1E293B;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        body.theme-dark .hospital-switcher-btn {
          background: #1E293B;
          border-color: #334155;
          color: #F1F5F9;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        body.theme-dark .hospital-switcher-btn:hover {
          background: #27354A;
          border-color: #0284C7;
          color: #F8FAFC;
        }

        body.theme-dark .hospital-switcher-badge {
          background: rgba(2, 132, 199, 0.18);
          border-color: rgba(56, 189, 248, 0.3);
          color: #38BDF8;
        }

        @media (max-width: 1100px) {
          .patient-tabs-bar {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 6px;
            padding: 6px;
          }
          .patient-tabs-bar .tab-button-modern {
            padding: 9px 8px;
            gap: 6px;
          }
          .patient-tabs-bar .tab-title-text {
            font-size: 12px;
          }
          .patient-tabs-bar .tab-sub-text {
            font-size: 10px;
          }
        }

        @media (max-width: 768px) {
          .patient-tabs-bar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            padding: 6px;
            border-radius: 14px;
          }
          .patient-tabs-bar > button:last-child {
            grid-column: span 2;
          }
        }

        @media (max-width: 480px) {
          .patient-tabs-bar {
            grid-template-columns: 1fr;
            gap: 6px;
          }
          .patient-tabs-bar > button:last-child {
            grid-column: span 1;
          }
        }

        .patient-portal-dashboard {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
          align-items: start;
          box-sizing: border-box;
          width: 100%;
        }

        @media (max-width: 1024px) {
          .patient-portal-dashboard {
            grid-template-columns: 1fr;
            gap: 18px;
          }
        }

        .telemetry-sidebar-card {
          background: #FFFFFF;
          border-radius: 18px;
          border: 1px solid #E2E8F0;
          padding: 18px 20px;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-sizing: border-box;
          width: 100%;
        }

        @media (max-width: 580px) {
          .telemetry-sidebar-card {
            padding: 14px 14px;
            border-radius: 14px;
          }
        }

        .tab-button-modern {
          padding: 11px 13px;
          border-radius: 13px;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
          outline: none;
          user-select: none;
          position: relative;
          box-sizing: border-box;
          min-width: 0;
          max-width: none;
          flex: 1;
        }

        @media (max-width: 680px) {
          .tab-button-modern {
            padding: 9px 10px;
            border-radius: 10px;
            gap: 8px;
          }
        }

        .tab-button-modern.active {
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
          color: #FFFFFF;
          border-color: #0284C7;
          box-shadow: 0 6px 18px rgba(2, 132, 199, 0.26);
        }

        .tab-button-modern.inactive {
          background: #F8FAFC;
          color: #0F172A;
          border-color: #E2E8F0;
        }

        .tab-button-modern.inactive:hover {
          background: #FFFFFF;
          border-color: #CBD5E1;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.04);
        }

        .tab-icon-wrapper {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        @media (max-width: 680px) {
          .tab-icon-wrapper {
            width: 28px;
            height: 28px;
            border-radius: 7px;
          }
          .tab-icon-wrapper svg {
            width: 16px;
            height: 16px;
          }
        }

        .tab-button-modern.active .tab-icon-wrapper {
          background: rgba(255, 255, 255, 0.18);
          color: #FFFFFF;
        }

        .tab-button-modern.inactive .tab-icon-wrapper {
          background: #F0F9FF;
          color: #0284C7;
        }

        .tab-title-text {
          font-size: 13.5px;
          font-weight: 700;
          line-height: 1.25;
          letter-spacing: -0.2px;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 680px) {
          .tab-title-text {
            font-size: 12px;
          }
        }

        .tab-sub-text {
          font-size: 11px;
          line-height: 1.35;
          display: block;
          margin-top: 2px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 680px) {
          .tab-sub-text {
            font-size: 9.5px;
          }
        }

        .tab-count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
          flex-shrink: 0;
          margin-left: 4px;
          transition: all 0.2s ease;
        }

        .form-grid-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }

        @media (max-width: 640px) {
          .form-grid-2col {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }

        .form-field-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #475569;
          margin-bottom: 7px;
        }

        .modern-form-input {
          width: 100%;
          height: 46px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          color: #0F172A;
          font-size: 14px;
          font-weight: 500;
          outline: none;
          transition: all 0.18s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
          font-family: inherit;
          box-sizing: border-box;
        }

        textarea.modern-form-input {
          height: auto;
          min-height: 80px;
          padding: 12px 14px;
        }

        .modern-form-input:focus {
          border-color: #0284C7;
          box-shadow: 0 0 0 3.5px rgba(2, 132, 199, 0.14);
          background: #FAFCFF;
        }

        .modern-form-input::placeholder {
          color: #94A3B8;
          font-weight: 400;
        }

        .modern-form-select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 14px center;
          background-size: 16px 16px;
          padding-right: 40px !important;
          cursor: pointer;
        }

        .modern-triage-card {
          padding: 13px 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.2s ease;
          outline: none;
          user-select: none;
          box-sizing: border-box;
        }

        @media (max-width: 480px) {
          .modern-triage-card {
            padding: 10px 12px;
            gap: 8px;
          }
        }

        .modern-triage-card.active-routine {
          background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%);
          border: 2px solid #0284C7;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.15);
        }

        .modern-triage-card.active-routine .triage-title {
          color: #0369A1;
          font-weight: 800;
          font-size: 13.5px;
          letter-spacing: -0.2px;
        }

        .modern-triage-card.active-routine .triage-subtitle {
          color: #0284C7;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.4;
        }

        .modern-triage-card.active-emergency {
          background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%);
          border: 2px solid #EF4444;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.18);
        }

        .modern-triage-card.active-emergency .triage-title {
          color: #DC2626;
          font-weight: 800;
          font-size: 13.5px;
          letter-spacing: -0.2px;
        }

        .modern-triage-card.active-emergency .triage-subtitle {
          color: #B91C1C;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.4;
        }

        .modern-triage-card.inactive-triage {
          background: #FFFFFF;
          border: 1.5px solid #CBD5E1;
        }

        .modern-triage-card.inactive-triage .triage-title {
          color: #0F172A;
          font-weight: 700;
          font-size: 13.5px;
          letter-spacing: -0.2px;
        }

        .modern-triage-card.inactive-triage .triage-subtitle {
          color: #64748B;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.4;
        }

        .modern-triage-card.inactive-triage:hover {
          background: #F8FAFC;
          border-color: #94A3B8;
        }

        .modern-submit-btn {
          width: 100%;
          height: 48px;
          padding: 0 20px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
          color: #FFFFFF;
          cursor: pointer;
          box-shadow: 0 8px 20px -4px rgba(2, 132, 199, 0.4);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
          box-sizing: border-box;
          font-size: 14.5px;
          font-weight: 700;
          letter-spacing: -0.1px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-family: inherit;
        }

        .modern-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #0369A1 0%, #0284C7 100%);
          box-shadow: 0 12px 28px -4px rgba(2, 132, 199, 0.5);
          transform: translateY(-1.5px);
        }

        .modern-submit-btn:active:not(:disabled) {
          transform: translateY(0px);
        }

        .patient-rx-header-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 580px) {
          .patient-rx-header-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* 1. HERO SECTION (100% Live Real-Time Telemetry) */}
      {(() => {
        const effectiveAnalytics = facilityAnalytics || analytics;
        const effectiveQueue = facilityQueue && facilityQueue.length > 0 ? facilityQueue : queueSnapshot;
        const waitingCount =
          effectiveAnalytics?.waiting_count !== undefined
            ? effectiveAnalytics.waiting_count
            : effectiveAnalytics?.currently_waiting !== undefined
              ? effectiveAnalytics.currently_waiting
              : (effectiveQueue?.length || 0);

        return (
          <HeroBanner
            language={language}
            hospitalName={currentHospitalDisplayName}
            branding={hospitalBranding}
            onOpenHospitalModal={() => setShowHospitalModal(true)}
            stats={{
              patientsServed: effectiveAnalytics ? `${(effectiveAnalytics.total_completed || 0) + (effectiveAnalytics.currently_serving || 0)}` : "0",
              avgWaitTime: language === "hi"
                ? `${effectiveAnalytics ? Math.round(effectiveAnalytics.avg_wait_minutes || 0) : 0} मिनट`
                : `${effectiveAnalytics ? Math.round(effectiveAnalytics.avg_wait_minutes || 0) : 0} min`,
              activeDesks: language === "hi"
                ? `${effectiveAnalytics ? effectiveAnalytics.active_counters || 1 : 1} डेस्क`
                : `${effectiveAnalytics ? effectiveAnalytics.active_counters || 1 : 1} ${(effectiveAnalytics?.active_counters || 1) === 1 ? "Desk" : "Desks"}`,
              currentlyWaiting: language === "hi"
                ? `${waitingCount} प्रतीक्षारत`
                : `${waitingCount} Waiting`,
            }}
          />
        );
      })()}

      {/* 2. Unified Patient Service Navigation Hub */}
      <section className="patient-nav-section">
        <div className="patient-nav-header">
          <div className="patient-nav-title">
            <div className="patient-nav-title-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M12 11h4" />
                <path d="M12 16h4" />
                <path d="M8 11h.01" />
                <path d="M8 16h.01" />
              </svg>
            </div>
            <span>
              {language === "hi" ? "अस्पताल मरीज़ सेवाएँ एवं कतार डेस्क" : "Hospital Patient Services & Queue Desk"}
            </span>
          </div>

          <div className="patient-nav-actions">
            <button
              type="button"
              onClick={() => setShowHospitalModal(true)}
              className="hospital-switcher-btn"
              title={language === "hi" ? "अस्पताल बदलें" : "Switch Hospital Facility"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
                <path d="M9 9h1" />
                <path d="M9 13h1" />
                <path d="M9 17h1" />
              </svg>
              <span style={{ maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {currentHospitalDisplayName}
              </span>
              <span className="hospital-switcher-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m16 3 4 4-4 4" />
                  <path d="M20 7H4" />
                  <path d="m8 21-4-4 4-4" />
                  <path d="M4 17h16" />
                </svg>
                {language === "hi" ? "बदलें" : "Change"}
              </span>
            </button>
          </div>
        </div>

        <div className="patient-tabs-bar">
          {/* Tab 1: Instant Walk-In Ticket */}
          <button
            type="button"
            id="patient-tab-walkin"
            onClick={() => handleTabChange("walkin")}
            className={`tab-button-modern ${activeTab === "walkin" ? "active" : "inactive"}`}
          >
            <div className="tab-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                <polygon points="12 8 13.2 11.4 16.8 11.4 13.9 13.5 15 16.9 12 14.8 9 16.9 10.1 13.5 7.2 11.4 10.8 11.4 12 8" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="tab-title-text">
                {t("instantWalkin", language)}
              </span>
              <span className="tab-sub-text" style={{ color: activeTab === "walkin" ? "#BAE6FD" : "#64748B" }}>
                {t("getTokenNow", language)}
              </span>
            </div>
          </button>

          {/* Tab 2: Book Time Slot */}
          <button
            type="button"
            id="patient-tab-book"
            onClick={() => handleTabChange("book")}
            className={`tab-button-modern ${activeTab === "book" ? "active" : "inactive"}`}
          >
            <div className="tab-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth="2.5" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="tab-title-text">
                {t("bookSlot", language)}
              </span>
              <span className="tab-sub-text" style={{ color: activeTab === "book" ? "#BAE6FD" : "#64748B" }}>
                {t("scheduleVisit", language)}
              </span>
            </div>
          </button>

          {/* Tab 3: My Appointments */}
          <button
            type="button"
            id="patient-tab-my-apts"
            onClick={() => handleTabChange("my_apts")}
            className={`tab-button-modern ${activeTab === "my_apts" ? "active" : "inactive"}`}
          >
            <div className="tab-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <line x1="9" y1="12" x2="15" y2="12" />
                <line x1="9" y1="16" x2="13" y2="16" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="tab-title-text">
                  {t("myAppointments", language)}
                </span>
                <span
                  className="tab-count-badge"
                  style={{
                    background: activeTab === "my_apts" ? "#38BDF8" : "#0284C7",
                    color: activeTab === "my_apts" ? "#0F172A" : "#FFFFFF",
                  }}
                >
                  {activeAppointments.length}
                </span>
              </div>
              <span className="tab-sub-text" style={{ color: activeTab === "my_apts" ? "#BAE6FD" : "#64748B" }}>
                {t("viewAndManage", language)}
              </span>
            </div>
          </button>

          {/* Tab 4: Appointment History */}
          <button
            type="button"
            id="patient-tab-history"
            onClick={() => handleTabChange("history")}
            className={`tab-button-modern ${activeTab === "history" ? "active" : "inactive"}`}
          >
            <div className="tab-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="tab-title-text">
                  {t("medicalVisitHistory", language)}
                </span>
                <span
                  className="tab-count-badge"
                  style={{
                    background: activeTab === "history" ? "#38BDF8" : "#0284C7",
                    color: activeTab === "history" ? "#0F172A" : "#FFFFFF",
                  }}
                >
                  {historyAppointments.length + historyTickets.length}
                </span>
              </div>
              <span className="tab-sub-text" style={{ color: activeTab === "history" ? "#BAE6FD" : "#64748B" }}>
                {t("medicalVisitHistorySubtitle", language)}
              </span>
            </div>
          </button>

          {/* Tab 5: Family Profiles */}
          <button
            type="button"
            id="patient-tab-family"
            onClick={() => handleTabChange("family")}
            className={`tab-button-modern ${activeTab === "family" ? "active" : "inactive"}`}
          >
            <div className="tab-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="tab-title-text">
                  {language === "hi" ? "परिवार" : "Family"}
                </span>
                <span
                  className="tab-count-badge"
                  style={{
                    background: activeTab === "family" ? "#38BDF8" : "#0284C7",
                    color: activeTab === "family" ? "#0F172A" : "#FFFFFF",
                  }}
                >
                  {familyMembers.length}
                </span>
              </div>
              <span className="tab-sub-text" style={{ color: activeTab === "family" ? "#BAE6FD" : "#64748B" }}>
                {language === "hi" ? "सदस्य प्रबंधित करें" : "Manage Profiles"}
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Main Content Area: Responsive Full-Page Layout */}
      {activeTab === "walkin" || activeTab === "book" ? (
        /* 2-COLUMN DASHBOARD FOR FAST CHECK-IN & BOOKING */
        <div className="patient-portal-dashboard">
          {/* Left Column: Form & Active Pass */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Quick Profile & Family Dependent Selector */}
            <FamilyMemberSwitcher
              members={familyMembers}
              selectedMemberId={selectedMemberId}
              onSelectMember={handleSelectMember}
              onAddMember={() => handleTabChange("family")}
              onDeleteMember={handleDeleteMember}
              showConfirm={showConfirm}
              language={language}
              familyTickets={familyTickets}
            />

            <div style={standaloneCardStyle}>
              {activeTab === "walkin" && (
                <WalkinTab
                  language={language}
                  hospitalBranding={hospitalBranding}
                  selectedMember={selectedMember}
                  selectedMemberId={selectedMemberId}
                  familyMembers={familyMembers}
                  handleSelectMember={handleSelectMember}
                  isLiveTicket={isLiveTicket}
                  activeTicket={activeTicket}
                  familyTickets={familyTickets}
                  isLiveTicketStatus={isLiveTicketStatus}
                  onOpenCancelModal={() => {
                    setCancelError("");
                    setShowCancelModal(true);
                  }}
                  registrationStatus={registrationStatus}
                  handleJoinQueue={handleJoinQueue}
                  name={name}
                  setName={setName}
                  age={age}
                  setAge={setAge}
                  gender={gender}
                  setGender={setGender}
                  category={category}
                  setCategory={setCategory}
                  availableDepartments={availableDepartments}
                  getDeptDisplayName={getDeptDisplayName}
                  medicalCondition={medicalCondition}
                  setMedicalCondition={setMedicalCondition}
                  customSymptom={customSymptom}
                  setCustomSymptom={setCustomSymptom}
                  preExistingCondition={preExistingCondition}
                  setPreExistingCondition={setPreExistingCondition}
                  priority={priority}
                  setPriority={setPriority}
                />
              )}

              {activeTab === "book" && (
                <BookSlotTab
                  language={language}
                  hospitalBranding={hospitalBranding}
                  selectedMember={selectedMember}
                  selectedMemberId={selectedMemberId}
                  familyMembers={familyMembers}
                  handleSelectMember={handleSelectMember}
                  isLiveTicket={isLiveTicket}
                  activeTicket={activeTicket}
                  familyTickets={familyTickets}
                  isLiveTicketStatus={isLiveTicketStatus}
                  onOpenCancelModal={() => {
                    setCancelError("");
                    setShowCancelModal(true);
                  }}
                  currentActiveScheduledApt={currentActiveScheduledApt}
                  handleAppointmentCheckIn={handleAppointmentCheckIn}
                  handleCancelAppointment={handleCancelAppointment}
                  registrationStatus={registrationStatus}
                  name={name}
                  setName={setName}
                  category={category}
                  setCategory={setCategory}
                  availableDepartments={availableDepartments}
                  getDeptDisplayName={getDeptDisplayName}
                  aptDate={aptDate}
                  setAptDate={setAptDate}
                  bookingDateBounds={bookingDateBounds}
                  aptTimeSlot={aptTimeSlot}
                  setAptTimeSlot={setAptTimeSlot}
                  timeSlotOptions={timeSlotOptions}
                  isSlotPast={isSlotPast}
                  handleBookSlot={handleBookSlot}
                  bookedAppointment={bookedAppointment}
                />
              )}


            </div>

            {/* Digital Ticket Pass (only if live: waiting, serving, on_hold) */}
            {isLiveTicket && (
              <div id="digital-ticket-pass">
                <DigitalTicketPassCard
                  activeTicket={activeTicket}
                  setActiveTicket={setActiveTicket}
                  familyTickets={familyTickets}
                  onSwitchTicketPass={handleSwitchTicketPass}
                  onTakeTicketForMember={(targetMember) => {
                    if (targetMember) {
                      handleSelectMember(targetMember);
                    } else {
                      handleTabChange("family");
                    }
                  }}
                  members={familyMembers}
                  ticketQrData={ticketQrData}
                  language={language}
                  onOpenPrescriptionSlip={handleOpenPrescriptionSlip}
                  parsePrescription={parsePrescription}
                  onPrint={() =>
                    printTokenPass(
                      activeTicket,
                      ticketQrData?.qr_code_base64 || ticketQrData?.qr_base64,
                      language,
                      hospitalBranding
                    )
                  }
                  onOpenAdjustModal={() => {
                    setAdjustError("");
                    setAdjustSuccessMsg("");
                    setSelectedSkipCount(1);
                    setShowAdjustModal(true);
                  }}
                  onOpenCancelModal={() => {
                    setCancelError("");
                    setShowCancelModal(true);
                  }}
                />
              </div>
            )}
          </div>

          {/* Right Column: Live Telemetry Sidebar */}
          <QueueTelemetrySidebar
            analytics={analytics}
            servingTickets={servingTickets}
            queueSnapshot={queueSnapshot}
            kioskQrData={kioskQrData}
            handleTabChange={handleTabChange}
            activeTicket={isLiveTicket ? activeTicket : null}
            language={language}
            branding={hospitalBranding}
          />
        </div>
      ) : activeTab === "my_apts" ? (
        <MyAppointmentsTab
          language={language}
          hospitalBranding={hospitalBranding}
          selectedMember={selectedMember}
          selectedMemberId={selectedMemberId}
          familyMembers={familyMembers}
          handleSelectMember={handleSelectMember}
          handleTabChange={handleTabChange}
          handleDeleteMember={handleDeleteMember}
          familyTickets={familyTickets}
          aptFilterQuery={aptFilterQuery}
          setAptFilterQuery={setAptFilterQuery}
          displayedActiveAppointments={displayedActiveAppointments}
          isLiveTicket={isLiveTicket}
          activeTicket={activeTicket}
          isLiveTicketStatus={isLiveTicketStatus}
          getHospitalNameForRecord={getHospitalNameForRecord}
          getDeptDisplayName={getDeptDisplayName}
          userTicketHistory={userTicketHistory}
          parsePrescription={parsePrescription}
          handleOpenPrescriptionSlip={handleOpenPrescriptionSlip}
          downloadPrescriptionPDF={downloadPrescriptionPDF}
          setStatusMsg={setStatusMsg}
          registrationStatus={registrationStatus}
          handleAppointmentCheckIn={handleAppointmentCheckIn}
          handleCancelAppointment={handleCancelAppointment}
          showConfirm={showConfirm}
          showToast={showToast}
        />
      ) : activeTab === "history" ? (
        <VisitHistoryTab
          language={language}
          hospitalBranding={hospitalBranding}
          selectedMember={selectedMember}
          selectedMemberId={selectedMemberId}
          familyMembers={familyMembers}
          handleSelectMember={handleSelectMember}
          handleTabChange={handleTabChange}
          handleDeleteMember={handleDeleteMember}
          familyTickets={familyTickets}
          displayedHistoryAppointments={displayedHistoryAppointments}
          displayedHistoryTickets={displayedHistoryTickets}
          selectedMemberHistoryStats={selectedMemberHistoryStats}
          historyFilterType={historyFilterType}
          setHistoryFilterType={setHistoryFilterType}
          historySearchQuery={historySearchQuery}
          setHistorySearchQuery={setHistorySearchQuery}
          showCancelledHistory={showCancelledHistory}
          setShowCancelledHistory={setShowCancelledHistory}
          historyAppointments={historyAppointments}
          historyTickets={historyTickets}
          userTicketHistory={userTicketHistory}
          getHospitalNameForRecord={getHospitalNameForRecord}
          getDeptDisplayName={getDeptDisplayName}
          parsePrescription={parsePrescription}
          handleOpenPrescriptionSlip={handleOpenPrescriptionSlip}
          downloadPrescriptionPDF={downloadPrescriptionPDF}
          setStatusMsg={setStatusMsg}
          handleBookFollowUp={handleBookFollowUp}
          showToast={showToast}
        />
      ) : activeTab === "family" ? (
        <FamilyManagementTab
          language={language}
          familyMembers={familyMembers}
          selectedMemberId={selectedMemberId}
          handleSelectMember={handleSelectMember}
          handleTabChange={handleTabChange}
          setShowAddMemberModal={setShowAddMemberModal}
          setEditingMember={setEditingMember}
          handleDeleteMember={handleDeleteMember}
          familyTickets={familyTickets}
          showConfirm={showConfirm}
          showToast={showToast}
        />
      ) : null}

      {/* Add Family Member Modal */}
      {showAddMemberModal && (
        <AddFamilyMemberModal
          isOpen={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          onAddMember={(newMem) => {
            handleAddMember(newMem);
            setShowAddMemberModal(false);
          }}
          language={language}
        />
      )}




      {/* Edit Family Member Modal */}
      {editingMember && (
        <EditFamilyMemberModal
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          onSaveMember={handleEditMember}
          member={editingMember}
          language={language}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && activeTicket && (
        <div style={modalBackdropStyle}>
          <div className="patient-modal-box" style={modalContentStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--emergency-card-bg, #FEF2F2)", color: "var(--emergency-card-text, #DC2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "var(--patient-text-main, #0F172A)", fontWeight: 800 }}>
                  Cancel Ticket?
                </h3>
                <span style={{ fontSize: "12px", color: "var(--patient-text-sub, #64748B)" }}>
                  Ticket #{activeTicket.ticket_id}
                </span>
              </div>
            </div>

            <p style={{ fontSize: "13.5px", color: "var(--patient-text-sub, #475569)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Are you sure you want to cancel ticket <strong>#{activeTicket.ticket_id}</strong>? This will remove you from the active queue.
            </p>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--patient-text-main, #334155)", marginBottom: "6px" }}>
                Reason (optional):
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--patient-card-border, #CBD5E1)", background: "var(--patient-card-bg, #FFFFFF)", color: "var(--patient-text-main, #0F172A)", fontSize: "13px", marginBottom: cancelReason === "Other" ? "8px" : "0" }}
              >
                <option value="Running late">Running late</option>
                <option value="Feeling better / no longer needed">Feeling better / no longer needed</option>
                <option value="Emergency elsewhere">Emergency elsewhere</option>
                <option value="Wait time too long">Wait time too long</option>
                <option value="Other">Other reason...</option>
              </select>

              {cancelReason === "Other" && (
                <input
                  type="text"
                  placeholder="Please specify reason..."
                  value={otherCancelReason}
                  onChange={(e) => setOtherCancelReason(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--patient-card-border, #CBD5E1)", background: "var(--patient-card-bg, #FFFFFF)", color: "var(--patient-text-main, #0F172A)", fontSize: "13px", boxSizing: "border-box" }}
                />
              )}
            </div>

            {cancelError && (
              <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--emergency-card-bg, #FEF2F2)", border: "1px solid var(--emergency-card-border, #FECACA)", color: "var(--emergency-card-text, #DC2626)", fontSize: "12.5px", marginBottom: "16px", fontWeight: 600 }}>
                {cancelError}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelLoading}
                className="patient-secondary-btn"
                style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--patient-card-border, #CBD5E1)", background: "var(--patient-sub-card, #F8FAFC)", color: "var(--patient-text-main, #334155)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              >
                Keep Ticket
              </button>
              <button
                id="confirm-cancel-btn"
                type="button"
                onClick={handleCancelTicket}
                disabled={cancelLoading}
                style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: "#DC2626", color: "#FFFFFF", fontSize: "13px", fontWeight: 700, cursor: cancelLoading ? "not-allowed" : "pointer" }}
              >
                {cancelLoading ? "Cancelling..." : "Cancel Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Queue Modal */}
      {showAdjustModal && activeTicket && (
        <div style={modalBackdropStyle}>
          <div className="patient-modal-box" style={modalContentStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--patient-tag-bg, #F0F9FF)", color: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                ⏱️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "var(--patient-text-main, #0F172A)", fontWeight: 800 }}>
                  Running late?
                </h3>
                <span style={{ fontSize: "12px", color: "var(--patient-text-sub, #64748B)" }}>
                  Move your position back in the queue.
                </span>
              </div>
            </div>

            <div style={{ background: "var(--patient-sub-card, #F8FAFC)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--patient-card-border, #E2E8F0)", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #64748B)" }}>Ticket:</span>
                <strong style={{ fontSize: "13px", color: "var(--patient-text-main, #0F172A)" }}>#{activeTicket.ticket_id}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #64748B)" }}>Current Position:</span>
                <strong style={{ fontSize: "15px", color: "#0284C7" }}>#{activeTicket.position}</strong>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--patient-text-main, #334155)", marginBottom: "8px" }}>
                Move back:
              </label>
              {(() => {
                const rem = Math.max(0, 3 - (activeTicket.adjustment_count || 0));
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                    {[1, 2, 3].map((num) => {
                      const isDisabled = num > rem;
                      const isSelected = selectedSkipCount === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setSelectedSkipCount(num)}
                          style={{
                            padding: "12px 6px",
                            borderRadius: "10px",
                            border: isSelected ? "2px solid #0284C7" : "1px solid var(--patient-card-border, #CBD5E1)",
                            background: isSelected ? "var(--patient-tag-bg, #F0F9FF)" : isDisabled ? "var(--patient-sub-card, #F1F5F9)" : "var(--patient-card-bg, #FFFFFF)",
                            color: isSelected ? "#0284C7" : isDisabled ? "#94A3B8" : "var(--patient-text-main, #0F172A)",
                            fontWeight: isSelected ? 800 : 600,
                            fontSize: "12.5px",
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {num} {num === 1 ? "person" : "people"}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", fontSize: "12px", color: "var(--patient-text-sub, #64748B)", background: "var(--patient-sub-card, #F8FAFC)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--patient-card-border, #E2E8F0)" }}>
              <span>Remaining adjustment:</span>
              <strong style={{ color: "#0369A1", fontSize: "13px" }}>
                {Math.max(0, 3 - (activeTicket.adjustment_count || 0))} of 3
              </strong>
            </div>

            {adjustError && (
              <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--emergency-card-bg, #FEF2F2)", border: "1px solid var(--emergency-card-border, #FECACA)", color: "var(--emergency-card-text, #DC2626)", fontSize: "12.5px", marginBottom: "16px", fontWeight: 600 }}>
                {adjustError}
              </div>
            )}

            {adjustSuccessMsg && (
              <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--patient-tag-bg, #F0F9FF)", border: "1px solid var(--patient-tag-border, #BAE6FD)", color: "#0284C7", fontSize: "12.5px", marginBottom: "16px", fontWeight: 700, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <span>{adjustSuccessMsg}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                disabled={adjustLoading}
                className="patient-secondary-btn"
                style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--patient-card-border, #CBD5E1)", background: "var(--patient-sub-card, #F8FAFC)", color: "var(--patient-text-main, #334155)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                id="confirm-adjust-btn"
                type="button"
                onClick={() => handleAdjustQueue(selectedSkipCount)}
                disabled={adjustLoading || (activeTicket.adjustment_count || 0) >= 3}
                style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)", color: "#FFFFFF", fontSize: "13px", fontWeight: 700, cursor: adjustLoading ? "not-allowed" : "pointer" }}
              >
                {adjustLoading ? "Adjusting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Hospital Facility Switcher Modal (Patient Portal) */}
      {showHospitalModal && (
        <div
          style={modalBackdropStyle}
          onClick={() => setShowHospitalModal(false)}
        >
          <div
            className="patient-modal-box"
            style={{
              ...modalContentStyle,
              maxWidth: "560px",
              padding: "26px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 10px rgba(2, 132, 199, 0.2)",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" /><line x1="10" y1="9" x2="14" y2="9" /><line x1="12" y1="7" x2="12" y2="11" /></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>
                    {language === "hi" ? "अस्पताल या स्वास्थ्य केंद्र बदलें" : "Switch Hospital Facility"}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--patient-text-sub, #64748B)", marginTop: "2px" }}>
                    {language === "hi"
                      ? "किसी भी पंजीकृत अस्पताल की लाइव कतार व सेवाओं तक पहुँचें।"
                      : "Connect to any registered hospital across our unified network."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHospitalModal(false)}
                style={{
                  background: "var(--patient-sub-card, #F1F5F9)",
                  border: "none",
                  borderRadius: "8px",
                  width: "30px",
                  height: "30px",
                  cursor: "pointer",
                  color: "var(--patient-text-sub, #64748B)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Search Filter Input */}
            <div style={{ position: "relative", marginBottom: "14px" }}>
              <input
                type="text"
                value={hospitalSearchQuery}
                onChange={(e) => setHospitalSearchQuery(e.target.value)}
                placeholder={language === "hi" ? "अस्पताल का नाम, शहर या कोड खोजें..." : "Search by hospital name, address, or code..."}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 38px",
                  borderRadius: "12px",
                  border: "1.5px solid var(--patient-card-border, #E2E8F0)",
                  fontSize: "13px",
                  outline: "none",
                  background: "var(--patient-sub-card, #F8FAFC)",
                  color: "var(--patient-text-main, #0F172A)",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#0284C7";
                  e.target.style.background = "var(--patient-card-bg, #FFFFFF)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--patient-card-border, #E2E8F0)";
                  e.target.style.background = "var(--patient-sub-card, #F8FAFC)";
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94A3B8",
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </span>
              {hospitalSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHospitalSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>

            {/* Hospitals List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "340px",
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {(() => {
                const currentCode = activeHospitalCode;
                const filtered = hospitalsList.filter((h) => {
                  if (!hospitalSearchQuery) return true;
                  const q = hospitalSearchQuery.toLowerCase();
                  return (
                    (h.name && h.name.toLowerCase().includes(q)) ||
                    (h.hospital_code && h.hospital_code.toLowerCase().includes(q)) ||
                    (h.address && h.address.toLowerCase().includes(q))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "30px 12px", color: "var(--patient-text-sub, #64748B)", fontSize: "13px" }}>
                      <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--patient-tag-bg, #F0F9FF)", color: "#0284C7", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" /><line x1="10" y1="9" x2="14" y2="9" /><line x1="12" y1="7" x2="12" y2="11" /></svg>
                      </div>
                      <div style={{ fontWeight: 600 }}>{language === "hi" ? "कोई अस्पताल नहीं मिला" : "No hospitals matching search"}</div>
                    </div>
                  );
                }

                return filtered.map((hosp) => {
                  const isCurrent = String(hosp.hospital_code) === String(currentCode);
                  return (
                    <div
                      key={hosp.hospital_code}
                      onClick={() => handleSelectHospital(hosp.hospital_code, hosp.name)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: isCurrent ? "2px solid #0284C7" : "1.5px solid var(--patient-card-border, #E2E8F0)",
                        background: isCurrent ? "var(--patient-tag-bg, #F0F9FF)" : "var(--patient-card-bg, #FFFFFF)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        transition: "all 0.16s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.borderColor = "#BAE6FD";
                          e.currentTarget.style.background = "var(--patient-sub-card, #F8FAFC)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.borderColor = "var(--patient-card-border, #E2E8F0)";
                          e.currentTarget.style.background = "var(--patient-card-bg, #FFFFFF)";
                        }
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--patient-text-main, #0F172A)" }}>
                            {hosp.name}
                          </span>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                background: "#0284C7",
                                color: "#FFFFFF",
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                textTransform: "uppercase",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              <span>{language === "hi" ? "सक्रिय" : "Active"}</span>
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 700,
                              color: "var(--patient-text-sub, #64748B)",
                              background: "var(--patient-sub-card, #F1F5F9)",
                              padding: "2px 7px",
                              borderRadius: "4px",
                            }}
                          >
                            {hosp.hospital_code}
                          </span>
                        </div>
                        {hosp.address && (
                          <div style={{ fontSize: "11.5px", color: "var(--patient-text-sub, #475569)", marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                            <span>{hosp.address}</span>
                          </div>
                        )}
                        {hosp.phone && (
                          <div style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", marginTop: "1px", display: "flex", alignItems: "center", gap: "5px" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            <span>{hosp.phone}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectHospital(hosp.hospital_code, hosp.name);
                        }}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: isCurrent ? "1px solid #0284C7" : "1px solid var(--patient-card-border, #CBD5E1)",
                          background: isCurrent ? "#0284C7" : "var(--patient-sub-card, #F8FAFC)",
                          color: isCurrent ? "#FFFFFF" : "var(--patient-text-main, #334155)",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isCurrent ? (language === "hi" ? "सक्रिय" : "Active") : (language === "hi" ? "चुनें" : "Select")}
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Official Digital Prescription (Rx) Slip Modal */}
      {showPrescriptionModal && viewingPrescriptionData && (
        <div style={modalBackdropStyle} onClick={() => setShowPrescriptionModal(false)}>
          <div
            id="printable-rx-slip"
            className="patient-modal-box"
            style={{
              ...modalContentStyle,
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px 30px",
              background: "var(--patient-card-bg, #FFFFFF)",
              borderRadius: "16px",
              border: "1.5px solid var(--patient-card-border, #CBD5E1)",
              boxShadow: "0 20px 40px rgba(15, 23, 42, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Hospital Letterhead */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0284C7", paddingBottom: "14px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {(viewingPrescriptionData?.logo_url || hospitalBranding?.logo_url) ? (
                  <img
                    src={viewingPrescriptionData?.logo_url || hospitalBranding?.logo_url}
                    alt="Hospital Logo"
                    style={{
                      maxHeight: "48px",
                      maxWidth: "130px",
                      objectFit: "contain",
                      borderRadius: "8px",
                    }}
                  />
                ) : (
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", fontWeight: 900 }}>
                    ℞
                  </div>
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: "20px", color: "var(--patient-text-main, #0F172A)", fontWeight: 900, letterSpacing: "-0.3px" }}>
                    {viewingPrescriptionData?.hospital_name || getHospitalNameForRecord(viewingPrescriptionData) || currentHospitalDisplayName || "City General Hospital"}
                  </h2>
                  <span style={{ fontSize: "11.5px", color: "#0284C7", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Outpatient Department (OPD) • Clinical E-Prescription Slip
                  </span>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "11px", color: "var(--patient-text-sub, #64748B)", display: "block" }}>Date & Time</span>
                <strong style={{ fontSize: "12px", color: "var(--patient-text-main, #0F172A)" }}>
                  {viewingPrescriptionData.prescribed_at ? new Date(viewingPrescriptionData.prescribed_at).toLocaleDateString() : new Date().toLocaleDateString()}
                </strong>
                <span style={{ fontSize: "10px", color: "var(--patient-text-sub, #64748B)", display: "block" }}>
                  {viewingPrescriptionData.prescribed_at ? new Date(viewingPrescriptionData.prescribed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            </div>

            {/* 2. Patient & Doctor Information Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "var(--patient-sub-card, #F8FAFC)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--patient-card-border, #E2E8F0)", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "10.5px", color: "var(--patient-text-sub, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Patient Details</span>
                <div style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)", marginTop: "2px" }}>
                  {viewingPrescriptionData.patient_name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--patient-text-sub, #475569)" }}>
                  {viewingPrescriptionData.age} yrs • {viewingPrescriptionData.gender} • Token #{viewingPrescriptionData.ticket_id}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "10.5px", color: "var(--patient-text-sub, #64748B)", fontWeight: 700, textTransform: "uppercase" }}>Attending Physician</span>
                <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#0284C7", marginTop: "2px" }}>
                  {viewingPrescriptionData.doctor_name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--patient-text-sub, #475569)" }}>
                  Department: {getCategoryLabel(viewingPrescriptionData.doctor_department, language)}
                  {viewingPrescriptionData.doctor_employee_id && ` (ID: ${viewingPrescriptionData.doctor_employee_id})`}
                </div>
              </div>
            </div>

            {/* Multi-Department Care Journey Timeline if multi-stage */}
            {viewingPrescriptionData.stages && viewingPrescriptionData.stages.length > 1 && (
              <div style={{
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(14, 165, 233, 0.02) 100%)",
                border: "1.5px solid #BAE6FD",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 900, color: "#0369A1", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🔄</span>
                    <span>{language === "hi" ? "स्थानांतरण परामर्श यात्रा (मल्टी-डिपार्टमेंट टाइमलाइन)" : "Transfer Journey (Multi-Department Clinical Timeline)"}</span>
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", background: "#E0F2FE", padding: "2px 8px", borderRadius: "8px" }}>
                    {viewingPrescriptionData.stages.length} Stages
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {viewingPrescriptionData.stages.map((stg, sIdx) => {
                    const isLast = sIdx === viewingPrescriptionData.stages.length - 1;
                    return (
                      <div key={sIdx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", fontSize: "12px", padding: "6px 10px", background: "var(--patient-card-bg, #FFFFFF)", borderRadius: "8px", border: "1px solid var(--patient-card-border, #E2E8F0)", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: isLast ? "#0284C7" : "#0369A1", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10.5px", fontWeight: 800 }}>
                            {stg.stage_number || sIdx + 1}
                          </span>
                          <strong style={{ color: "var(--patient-text-main, #0F172A)" }}>{stg.department}</strong>
                          {stg.doctor_name && <span style={{ color: "#0284C7" }}>• {stg.doctor_name}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "10.5px", color: "var(--patient-text-sub, #64748B)" }}>#{stg.ticket_id}</span>
                          <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: isLast ? "#DEF7EC" : "#EFF6FF", color: isLast ? "#03543F" : "#0284C7" }}>
                            {getStatusLabel(stg.status, language)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Provisional Diagnosis & Tests */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>
                  Clinical Diagnosis:
                </span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0284C7", background: "var(--patient-tag-bg, #F0F9FF)", padding: "2px 8px", borderRadius: "6px", border: "1px solid var(--patient-tag-border, #BAE6FD)" }}>
                  {formatCleanText(viewingPrescriptionData.diagnosis, language) || "General Consultation & Clinical Checkup"}
                </span>
              </div>
              {viewingPrescriptionData.lab_tests && viewingPrescriptionData.lab_tests !== "no" && (
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>
                    Tests Ordered:
                  </span>
                  <span style={{ fontSize: "12.5px", color: "var(--patient-text-sub, #475569)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" /><path d="M8.5 2h7" /><path d="M7 16h10" /></svg>
                    <span>{formatCleanText(viewingPrescriptionData.lab_tests, language)}</span>
                  </span>
                </div>
              )}
            </div>

            {/* 4. Prescribed Medications Table */}
            <div style={{ marginBottom: "18px" }}>
              <div style={{ fontSize: "12px", fontWeight: 900, color: "var(--patient-text-main, #0F172A)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "#0284C7", fontSize: "16px" }}>℞</span> Prescribed Medications
              </div>

              {viewingPrescriptionData.medicines && viewingPrescriptionData.medicines.length > 0 ? (
                <div style={{ overflowX: "auto", border: "1px solid var(--patient-card-border, #E2E8F0)", borderRadius: "8px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--patient-sub-card, #F1F5F9)", borderBottom: "1.5px solid var(--patient-card-border, #CBD5E1)", color: "var(--patient-text-sub, #475569)", fontWeight: 800 }}>
                        <th style={{ padding: "8px 10px" }}>#</th>
                        <th style={{ padding: "8px 10px" }}>Medicine Name</th>
                        <th style={{ padding: "8px 10px" }}>Dosage</th>
                        <th style={{ padding: "8px 10px" }}>Frequency / Timing</th>
                        <th style={{ padding: "8px 10px" }}>Duration</th>
                        <th style={{ padding: "8px 10px" }}>Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingPrescriptionData.medicines.map((med, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--patient-card-border, #F1F5F9)", background: idx % 2 === 0 ? "var(--patient-card-bg, #FFFFFF)" : "var(--patient-sub-card, #F8FAFC)" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--patient-text-sub, #64748B)" }}>{idx + 1}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>{med.name}</td>
                          <td style={{ padding: "8px 10px", color: "#0284C7", fontWeight: 700 }}>{med.dosage || "-"}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: "#0284C7" }}>{med.frequency || "-"}</td>
                          <td style={{ padding: "8px 10px", color: "var(--patient-text-sub, #334155)" }}>{med.duration || "-"}</td>
                          <td style={{ padding: "8px 10px", color: "var(--patient-text-sub, #64748B)", fontStyle: "italic" }}>{med.instructions || "After food"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "12px 14px", background: "var(--patient-sub-card, #F8FAFC)", borderRadius: "8px", border: "1px solid var(--patient-card-border, #E2E8F0)", fontSize: "13px", color: "var(--patient-text-main, #334155)", fontStyle: "italic" }}>
                  "{viewingPrescriptionData.advice || "No specific medications listed. Consultation completed."}"
                </div>
              )}
            </div>

            {/* 5. Doctor's Advice & Lifestyle Instructions */}
            {viewingPrescriptionData.advice && (
              <div style={{ marginBottom: "14px", padding: "10px 14px", background: "var(--patient-tag-bg, #F0F9FF)", borderRadius: "10px", border: "1px solid var(--patient-tag-border, #BAE6FD)" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#0369A1", display: "inline-flex", alignItems: "center", gap: "5px", marginBottom: "3px", textTransform: "uppercase" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                  <span>Doctor's Advice & Guidelines:</span>
                </span>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--patient-text-main, #0F172A)" }}>
                  {viewingPrescriptionData.advice}
                </p>
              </div>
            )}

            {/* 6. Follow-up consultation */}
            {viewingPrescriptionData.follow_up && (
              <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--patient-text-sub, #475569)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <strong>Follow-Up:</strong>
                <span>{viewingPrescriptionData.follow_up}</span>
              </div>
            )}

            {/* Department Referral Notes / Instructions */}
            {viewingPrescriptionData.transfer_notes && (
              <div style={{ marginBottom: "14px", padding: "10px 14px", background: "#FEF3C7", borderRadius: "10px", border: "1px solid #FCD34D" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#92400E", display: "inline-flex", alignItems: "center", gap: "5px", marginBottom: "3px", textTransform: "uppercase" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                  <span>{language === "hi" ? "विभाग रेफरल निर्देश:" : "Department Referral Instructions:"}</span>
                </span>
                <p style={{ margin: 0, fontSize: "12px", color: "#78350F", fontWeight: 600 }}>
                  {viewingPrescriptionData.transfer_notes}
                </p>
              </div>
            )}

            {/* 7. Electronic Validation Stamp */}
            <div style={{ borderTop: "1px dashed var(--patient-card-border, #CBD5E1)", paddingTop: "12px", marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#0284C7", fontWeight: 700 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Digitally Authenticated & Recorded in Hospital OPD System</span>
              </div>
              <span style={{ fontSize: "10.5px", color: "#94A3B8" }}>
                Valid across hospital pharmacy & lab desks
              </span>
            </div>

            {/* 8. Action Buttons (Download PDF, Print & Close) */}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="patient-secondary-btn"
                style={{ padding: "9px 18px", borderRadius: "10px", border: "1px solid var(--patient-card-border, #CBD5E1)", background: "var(--patient-sub-card, #F8FAFC)", color: "var(--patient-text-main, #334155)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => printPrescriptionSlip(viewingPrescriptionData, language, hospitalBranding)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "10px",
                  border: "1.5px solid #0284C7",
                  background: "var(--patient-card-bg, #FFFFFF)",
                  color: "#0284C7",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                <span>{language === "hi" ? "पर्ची प्रिंट करें" : "Print Rx Slip"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  downloadPrescriptionPDF(viewingPrescriptionData, language, hospitalBranding);
                  setStatusMsg(t("downloadRxPdfSuccess", language));
                  showToast(t("downloadRxPdfSuccess", language), "success");
                }}
                style={{
                  padding: "9px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  boxShadow: "0 2px 10px rgba(2, 132, 199, 0.25)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{t("downloadClinicalRxPdf", language)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. In-App Floating Toast & Modal Dialogs (replaces window.alert and window.confirm) */}
      <InAppToast toast={inAppToast} onClose={() => setInAppToast(null)} isDark={isDark} />
      <InAppConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} isDark={isDark} />

      {/* 7. Footer (Matching Image 2) */}
      <Footer
        language={language}
        hospitalName={hospitalBranding?.hospital_name || hospitalBranding?.name || (currentUser?.hospital_code === tenantId ? currentUser?.hospital_name : null) || HOSPITAL_CONFIG.name}
        currentUser={currentUser}
      />
    </div>
  );
}
