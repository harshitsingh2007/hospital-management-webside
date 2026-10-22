/**
 * Header.jsx
 * ----------
 * User Dashboard Header matching IMAGE 2.
 * Features:
 * - Hospital shield/logo with white medical cross
 * - City General Hospital & "Care you can trust"
 * - Navigation links: Home, My Appointments, History, About Us, Contact
 * - Language selector pill dropdown (EN / हिंदी)
 * - Patient profile dropdown (Patient: user / rahul, role badge, navigation, logout)
 * - Interactive About Us and Contact modals
 */

import React, { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { API_BASE, HOSPITAL_CONFIG } from "../../config/hospitalConfig";
import { t } from "../../utils/i18n";
import { generateOperatingHoursText } from "../../utils/operatingHoursHelper";
import { AddFamilyMemberModal, getRelationLabel } from "../patient/FamilyMemberSwitcher";

export default function Header({
  currentUser,
  activePage,
  navigateTo,
  handleLogout,
  setShowAuthModal,
  socketConnected = true,
  language = "en",
  setLanguage,
  currentTab = "walkin",
  familyMembers = [],
  activeFamilyMember = null,
  onSwitchProfile,
  onAddFamilyMember,
  onManageFamilyMembers,
  currentHospitalTenant = "city-hospital-01",
  onSwitchHospital,
  hospitalBranding = null,
  theme: themeProp = null,
  setTheme: setThemeProp = null,
  onToggleTheme = null,
}) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [familySwitcherExpanded, setFamilySwitcherExpanded] = useState(false);


  // Live Family Tickets dictionary for badge rendering
  const [familyTickets, setFamilyTickets] = useState(() => {
    try {
      const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
      const saved = localStorage.getItem(ticketStorageKey);
      const parsed = saved ? JSON.parse(saved) : {};
      const activeSaved = localStorage.getItem("ai_queue_active_ticket");
      if (activeSaved && !parsed["self"]) {
        try {
          const act = JSON.parse(activeSaved);
          if (act && act.ticket_id) parsed["self"] = act;
        } catch (e) {}
      }
      return parsed;
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    const handleSyncTickets = (e) => {
      if (e?.detail) setFamilyTickets(e.detail);
    };
    window.addEventListener("family_tickets_updated", handleSyncTickets);
    return () => window.removeEventListener("family_tickets_updated", handleSyncTickets);
  }, []);

  useEffect(() => {
    try {
      const ticketStorageKey = `family_tickets_${currentUser ? (currentUser.username || currentUser.email) : "guest"}`;
      const saved = localStorage.getItem(ticketStorageKey);
      if (saved) setFamilyTickets(JSON.parse(saved));
    } catch (e) {}
  }, [currentUser]);

  // Theme state synchronized with props and localStorage
  const [theme, setTheme] = useState(() => {
    if (themeProp) return themeProp;
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
    if (themeProp && themeProp !== theme) {
      setTheme(themeProp);
    }
  }, [themeProp]);

  useEffect(() => {
    const handleThemeEvent = (e) => {
      const t = typeof e?.detail === "string" ? e.detail : e?.detail?.theme;
      if (t && (t === "dark" || t === "light")) {
        setTheme(t);
      }
    };
    window.addEventListener("theme_changed", handleThemeEvent);
    return () => window.removeEventListener("theme_changed", handleThemeEvent);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("ai_queue_theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
      if (nextTheme === "dark") {
        document.body.classList.add("theme-dark");
      } else {
        document.body.classList.remove("theme-dark");
      }
      window.dispatchEvent(new CustomEvent("theme_changed", { detail: nextTheme }));
    } catch (e) {}
    if (setThemeProp) setThemeProp(nextTheme);
    if (onToggleTheme) onToggleTheme(nextTheme);
  };

  const isDarkHeader = theme === "dark" && (activePage === "patient" || activePage === "superadmin" || activePage === "staff" || activePage === "admin");

  // Multi-Hospital Facility Active Display
  const [hospitalsList, setHospitalsList] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/hospitals/public`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success" && Array.isArray(d.hospitals)) {
          setHospitalsList(d.hospitals);
        }
      })
      .catch((e) => console.log("Header hospitals fetch error:", e));
  }, []);

  const [activeHospitalCode, setActiveHospitalCode] = useState(
    currentHospitalTenant || currentUser?.hospital_code || "city-hospital-01"
  );

  useEffect(() => {
    if (currentHospitalTenant) {
      setActiveHospitalCode(currentHospitalTenant);
    }
  }, [currentHospitalTenant]);

  useEffect(() => {
    const handleHospEvent = (e) => {
      const code = typeof e?.detail === "string" ? e.detail : e?.detail?.hospital_code;
      if (code) setActiveHospitalCode(code);
    };
    window.addEventListener("hospital_changed", handleHospEvent);
    return () => window.removeEventListener("hospital_changed", handleHospEvent);
  }, []);

  const currentHospitalObj = hospitalsList.find(
    (h) => String(h.hospital_code) === String(activeHospitalCode)
  ) || {
    name: (String(activeHospitalCode) === String(currentUser?.hospital_code) && currentUser?.hospital_name) || HOSPITAL_CONFIG.name,
    hospital_code: activeHospitalCode,
    address: "742 Evergreen Healthcare Ave",
  };

  // Derived white-label branding variables
  const displayHospitalName =
    (language === "hi" && (hospitalBranding?.name_hi || hospitalBranding?.hospital_name_hi)) ||
    hospitalBranding?.hospital_name ||
    hospitalBranding?.name ||
    currentHospitalObj?.name ||
    HOSPITAL_CONFIG.name;

  const displayTagline =
    (language === "hi" && hospitalBranding?.tagline_hi) ||
    hospitalBranding?.tagline ||
    (language === "hi" ? "भरोसेमंद स्वास्थ्य सेवा • एनएबीएच मान्यता प्राप्त" : "Care you can trust • NABH Accredited");

  const displayLogoUrl = hospitalBranding?.logo_url || "";

  const displayEmergencyText =
    hospitalBranding?.emergency_helpline ||
    (language === "hi" ? "24/7 हेल्पलाइन: 108" : "24/7 Helpline: 108");

  const brandPrimary = hospitalBranding?.primary_color || "#0284C7";

  // Dynamic About Us Branding Variables
  const displayAboutTitle =
    (language === "hi" && hospitalBranding?.about_us_title_hi) ||
    hospitalBranding?.about_us_title ||
    (language === "hi" ? `${displayHospitalName} के बारे में` : `About ${displayHospitalName}`);

  const displayAboutSubtitle =
    (language === "hi" && (hospitalBranding?.about_us_subtitle_hi || hospitalBranding?.tagline_hi)) ||
    hospitalBranding?.about_us_subtitle ||
    displayTagline;

  const displayAboutBody =
    (language === "hi" && hospitalBranding?.about_us_hi) ||
    hospitalBranding?.about_us ||
    (language === "hi"
      ? `${displayHospitalName} मरीज़-प्रथम सेवा हेतु समर्पित एक अग्रणी चिकित्सा संस्थान है। हमारा एआई-संचालित बुद्धिमान कतार प्रबंधन प्रतीक्षा समय को कम करता है और गंभीर मामलों को प्राथमिकता देता है।`
      : `${displayHospitalName} is a premier medical institution dedicated to patient-first care. Our AI-driven intelligent queue orchestration minimizes waiting times and prioritizes critical medical needs dynamically.`);

  const displayService1 = (language === "hi" && hospitalBranding?.about_service_1_hi) || hospitalBranding?.about_service_1 || (language === "hi" ? "24/7 आपातकालीन ट्राइएज • प्राथमिकता एम्बुलेंस एवं आईसीयू" : "24/7 Emergency Triage • Priority ambulance & ICU care");
  const displayService2 = (language === "hi" && hospitalBranding?.about_service_2_hi) || hospitalBranding?.about_service_2 || (language === "hi" ? "AI प्रतीक्षा भविष्यवाणी • लाइव कतार सिंक्रोनाइज़ेशन" : "AI Wait Prediction • Live queue synchronization");
  const displayService3 = (language === "hi" && hospitalBranding?.about_service_3_hi) || hospitalBranding?.about_service_3 || (language === "hi" ? "बहु-विशेषज्ञता ओपीडी • सामान्य, हृदय, न्यूरो, ऑर्थो" : "Multi-Specialty OPD • General, Cardiac, Neuro, Ortho");
  const displayService4 = (language === "hi" && hospitalBranding?.about_service_4_hi) || hospitalBranding?.about_service_4 || (language === "hi" ? "डिजिटल ई-प्रिस्क्रिप्शन • सहज फार्मेसी रीफिल" : "Digital E-Prescriptions • Seamless pharmacy refills");

  // Dynamic Contact & Help Desk Info
  const displayAddress =
    (language === "hi" && hospitalBranding?.address_hi) ||
    hospitalBranding?.address ||
    currentHospitalObj?.address ||
    "742 Evergreen Healthcare Ave, Medical District, Suite 100";

  const displayHelpdeskPhone =
    hospitalBranding?.opd_helpdesk_phone ||
    currentHospitalObj?.phone ||
    "+1 (800) 456-7890 (Ext: 101)";

  const displayHelpdeskHours =
    (hospitalBranding?.opd_start_time && hospitalBranding?.opd_end_time)
      ? generateOperatingHoursText(
          hospitalBranding.operating_days,
          hospitalBranding.opd_start_time,
          hospitalBranding.opd_end_time,
          language === "hi"
        )
      : (
          (language === "hi" ? hospitalBranding?.opd_helpdesk_hours_hi : null) ||
          hospitalBranding?.opd_helpdesk_hours ||
          (language === "hi" ? "सोम – शनि: सुबह 8:00 – रात 8:00" : "Mon – Sat: 8:00 AM – 8:00 PM")
        );

  const displayEmail =
    hospitalBranding?.support_email ||
    hospitalBranding?.email ||
    currentHospitalObj?.email ||
    "support@citygeneralhospital.org";

  const profileRef = useRef(null);
  const langRef = useRef(null);

  const isPatientUser = currentUser && currentUser.role === "user";
  const isAdmin = currentUser && currentUser.role === "admin";
  const username = currentUser ? currentUser.username : "user";

  const userRole = (currentUser?.role || "").toLowerCase();
  const isSuperAdmin = Boolean(
    currentUser && (
      userRole === "super_admin" ||
      userRole === "superadmin" ||
      currentUser.role === "super_admin" ||
      currentUser.role === "superadmin" ||
      currentUser.email === "superadmin@hospital.com" ||
      currentUser.is_superadmin === true
    )
  );
  const userDept = (currentUser?.department || currentUser?.primary_department || "").toLowerCase().trim();
  const isPharmacist = ["pharmacist", "pharmacy"].includes(userRole) || userDept === "pharmacy";
  const isPharmacistAccess = Boolean(currentUser) && (isSuperAdmin || isPharmacist);
  const isDoctorAccess = Boolean(currentUser) && (["doctor", "physician", "admin"].includes(userRole) || isSuperAdmin);
  const isStaffAccess = Boolean(currentUser) && (["staff", "receptionist", "nurse", "admin"].includes(userRole) || isSuperAdmin);
  const isStaffOrDoctor = ["admin", "doctor", "staff", "receptionist", "pharmacist", "physician"].includes(userRole);
  const isPatientOrGuest = !currentUser || userRole === "user" || userRole === "patient";

  // Hospital switcher is enabled on the patient portal for all visitors and patients
  const canSwitchHospital = activePage === "patient" || isPatientOrGuest;

  // Determine active display name (family member or self)
  const activeDisplayName = activeFamilyMember ? activeFamilyMember.name : username;
  const activeDisplayRelation = activeFamilyMember
    ? getRelationLabel(activeFamilyMember.relation, language)
    : (language === "hi" ? "मेरी प्रोफ़ाइल" : "My Profile");

  // Derive tab from prop or URL query parameter
  const getEffectiveTab = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      if (urlTab) return urlTab.toLowerCase();
      const pageParam = (params.get("page") || params.get("view") || "").toLowerCase();
      if (["history", "appointment_history", "past_appointments"].includes(pageParam)) return "history";
      if (["my_apts", "appointments", "my_appointments"].includes(pageParam)) return "my_apts";
      if (["book", "booking", "schedule"].includes(pageParam)) return "book";
      if (["family", "dependents"].includes(pageParam)) return "family";
      const path = window.location.pathname.toLowerCase();
      if (path.includes("history")) return "history";
      if (path.includes("appointment")) return "my_apts";
    }
    return currentTab || "walkin";
  };



  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header style={headerContainerStyle} className={`user-dashboard-header ${isDarkHeader ? "dark-theme-header" : ""}`}>
        <style>{`
          .user-dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
            margin-bottom: 22px;
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(226, 232, 240, 0.95);
            border-radius: 20px;
            box-shadow: 0 10px 30px -5px rgba(2, 132, 199, 0.07), 0 2px 6px -1px rgba(0, 0, 0, 0.02);
            position: relative;
            z-index: 100;
            gap: 12px;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            box-sizing: border-box;
            width: 100%;
          }

          /* Dark Mode Header Overrides */
          .user-dashboard-header.dark-theme-header {
            background: rgba(15, 23, 42, 0.88) !important;
            border: 1px solid rgba(51, 65, 85, 0.75) !important;
            box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(56, 189, 248, 0.15) !important;
          }

          .header-brand-left {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            flex-shrink: 0;
            min-width: 0;
          }

          .header-center-nav {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: nowrap;
            flex-shrink: 1;
            min-width: 0;
          }

          .header-controls-right {
            display: flex;
            align-items: center;
            gap: 8px;
            position: relative;
            flex-shrink: 0;
          }

          @media (max-width: 900px) {
            .user-dashboard-header {
              flex-wrap: wrap;
              padding: 10px 14px;
              gap: 10px;
              margin-bottom: 16px;
            }
            .header-center-nav {
              order: 3;
              width: 100%;
              justify-content: flex-start;
              overflow-x: auto;
              padding-top: 8px;
              border-top: 1px solid rgba(226, 232, 240, 0.7);
              gap: 6px;
              scrollbar-width: none;
            }
            .header-center-nav::-webkit-scrollbar {
              display: none;
            }
            .user-dashboard-header.dark-theme-header .header-center-nav {
              border-top-color: rgba(51, 65, 85, 0.6);
            }
            .header-brand-left {
              order: 1;
            }
            .header-controls-right {
              order: 2;
            }
          }

          @media (max-width: 520px) {
            .user-dashboard-header {
              padding: 8px 10px;
              border-radius: 14px;
              gap: 6px;
            }
            .header-hospital-tagline {
              display: none !important;
            }
            .header-nabh-badge {
              display: none !important;
            }
            .header-emergency-pill {
              max-width: 145px !important;
              padding: 6px 10px !important;
              font-size: 11px !important;
            }
            .header-pill-btn {
              padding: 6px 9px !important;
              font-size: 11px !important;
              gap: 4px !important;
            }
          }

          /* Small Theme Toggle Button (User Portal Only) */
          .header-theme-toggle-btn {
            position: relative;
            width: 50px;
            height: 28px;
            border-radius: 9999px;
            background: #E2E8F0;
            border: 1.5px solid #CBD5E1;
            cursor: pointer;
            outline: none;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: space-between;
            box-sizing: border-box;
            flex-shrink: 0;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.08);
            user-select: none;
          }

          .header-theme-toggle-btn:hover {
            border-color: #0284C7;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.08), 0 0 10px rgba(2, 132, 199, 0.28);
          }

          .header-theme-toggle-btn.is-dark {
            background: #0B1120;
            border-color: #334155;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5), 0 0 10px rgba(56, 189, 248, 0.25);
          }

          .header-theme-toggle-btn.is-dark:hover {
            border-color: #38BDF8;
          }

          .theme-track-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            pointer-events: none;
            z-index: 1;
          }

          .theme-sun-track {
            margin-left: 4px;
            opacity: 0.9;
          }

          .theme-moon-track {
            margin-right: 4px;
            opacity: 0.85;
          }

          .theme-toggle-knob {
            position: absolute;
            top: 2.5px;
            left: 3px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.22);
            transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease;
            z-index: 2;
          }

          .header-theme-toggle-btn.is-dark .theme-toggle-knob {
            transform: translateX(21px);
            background: #1E293B;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(56, 189, 248, 0.3);
          }

          .user-dashboard-header.dark-theme-header .header-pill-btn {
            background: rgba(30, 41, 59, 0.8) !important;
            border-color: rgba(51, 65, 85, 0.8) !important;
            color: #F8FAFC !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
          }

          .user-dashboard-header.dark-theme-header .header-pill-btn:hover {
            background: rgba(40, 53, 72, 0.95) !important;
            border-color: #38BDF8 !important;
            box-shadow: 0 4px 16px rgba(56, 189, 248, 0.2) !important;
          }

          .user-dashboard-header.dark-theme-header .header-nav-btn {
            color: #94A3B8;
            background: rgba(30, 41, 59, 0.5);
            border-color: rgba(51, 65, 85, 0.6);
          }

          .user-dashboard-header.dark-theme-header .header-nav-btn:hover {
            color: #38BDF8;
            background: rgba(30, 41, 59, 0.95);
            border-color: rgba(56, 189, 248, 0.4);
            box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15);
          }

          .user-dashboard-header.dark-theme-header .header-nav-btn.active {
            color: #38BDF8;
            background: rgba(2, 132, 199, 0.25);
            border-color: #0284C7;
          }

          .user-dashboard-header.dark-theme-header .header-dropdown-menu {
            background: #0F172A !important;
            border-color: #334155 !important;
            color: #F8FAFC !important;
            box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          }

          body.theme-dark .header-modal-content,
          [data-theme="dark"] .header-modal-content,
          .user-dashboard-header.dark-theme-header .header-modal-content {
            background: #0F172A !important;
            border: 1px solid #334155 !important;
            color: #F8FAFC !important;
            box-shadow: 0 24px 48px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(56, 189, 248, 0.15) !important;
          }

          body.theme-dark .header-dropdown-menu,
          [data-theme="dark"] .header-dropdown-menu,
          .user-dashboard-header.dark-theme-header .header-dropdown-menu {
            background: #0F172A !important;
            border-color: #334155 !important;
            color: #F8FAFC !important;
            box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.65), 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          }

          body.theme-dark .header-dropdown-item,
          [data-theme="dark"] .header-dropdown-item,
          .user-dashboard-header.dark-theme-header .header-dropdown-item {
            color: #CBD5E1 !important;
          }

          body.theme-dark .header-dropdown-item:hover,
          [data-theme="dark"] .header-dropdown-item:hover,
          .user-dashboard-header.dark-theme-header .header-dropdown-item:hover {
            background: #1E293B !important;
            color: #38BDF8 !important;
          }

          body.theme-dark .header-dropdown-item.active,
          [data-theme="dark"] .header-dropdown-item.active,
          .user-dashboard-header.dark-theme-header .header-dropdown-item.active {
            background: #1E293B !important;
            color: #38BDF8 !important;
          }

          .header-nav-btn {
            padding: 7px 14px;
            border-radius: 12px;
            color: #334155;
            font-size: 12.5px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid rgba(226, 232, 240, 0.8);
            background: rgba(248, 250, 252, 0.85);
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            text-decoration: none;
            outline: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            user-select: none;
            white-space: nowrap;
            flex-shrink: 0;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
          }

          .header-nav-btn:hover {
            color: #0284C7;
            background: #F0F9FF;
            border-color: #BAE6FD;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.12);
          }

          .header-nav-btn.active {
            color: #0284C7;
            background: #E0F2FE;
            border-color: #BAE6FD;
            font-weight: 800;
          }

          @keyframes emergencyBeacon {
            0% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            }
            70% {
              box-shadow: 0 0 0 7px rgba(239, 68, 68, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            }
          }

          .emergency-beacon-ring {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(239, 68, 68, 0.15);
            flex-shrink: 0;
          }

          .emergency-beacon-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #EF4444;
            animation: emergencyBeacon 1.8s infinite cubic-bezier(0.4, 0, 0.6, 1);
            flex-shrink: 0;
          }

          .header-emergency-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 14px;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(254, 226, 226, 0.8) 100%);
            border: 1.5px solid rgba(239, 68, 68, 0.32);
            color: #DC2626;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            outline: none;
            white-space: nowrap;
            flex-shrink: 0;
            max-width: 250px;
            box-shadow: 0 2px 6px rgba(239, 68, 68, 0.1);
          }

          .header-emergency-pill:hover {
            background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
            border-color: #EF4444;
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25);
          }

          .user-dashboard-header.dark-theme-header .header-emergency-pill {
            background: linear-gradient(135deg, rgba(220, 38, 38, 0.2) 0%, rgba(185, 28, 28, 0.1) 100%) !important;
            border-color: rgba(239, 68, 68, 0.45) !important;
            color: #FCA5A5 !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
          }

          .user-dashboard-header.dark-theme-header .header-emergency-pill:hover {
            background: linear-gradient(135deg, rgba(220, 38, 38, 0.35) 0%, rgba(185, 28, 28, 0.2) 100%) !important;
            border-color: #EF4444 !important;
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.35) !important;
          }

          .header-pill-btn {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 6.5px 13px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(203, 213, 225, 0.85);
            color: #0F172A;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            outline: none;
            user-select: none;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .header-pill-btn:hover {
            border-color: #0284C7;
            background: #F0F9FF;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.12);
          }

          .header-dropdown-menu {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            background: #FFFFFF;
            border-radius: 16px;
            border: 1px solid #E2E8F0;
            box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06);
            min-width: 220px;
            max-width: 90vw;
            z-index: 9999;
            padding: 8px;
            animation: fadeInDown 0.18s cubic-bezier(0.16, 1, 0.3, 1);
            box-sizing: border-box;
          }

          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .header-dropdown-item {
            width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 12.5px;
            font-weight: 600;
            color: #334155;
            background: transparent;
            border: none;
            cursor: pointer;
            text-align: left;
            transition: all 0.15s ease;
            box-sizing: border-box;
          }

          .header-dropdown-item:hover {
            background: #F0F9FF;
            color: #0284C7;
          }

          .header-dropdown-item.active {
            background: #F0F9FF;
            color: #0284C7;
            font-weight: 700;
          }

          .header-dropdown-item.danger {
            color: #DC2626;
          }

          .header-dropdown-item.danger:hover {
            background: #FEF2F2;
            color: #B91C1C;
          }

          .header-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.5);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 16px;
            animation: fadeIn 0.15s ease;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .header-modal-content {
            background: #FFFFFF;
            border-radius: 24px;
            max-width: 480px;
            width: 100%;
            max-height: 85vh;
            overflow-y: auto;
            padding: 24px;
            box-shadow: 0 24px 48px -10px rgba(0, 0, 0, 0.22);
            border: 1px solid #E2E8F0;
            position: relative;
            animation: modalScaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-sizing: border-box;
          }

          @keyframes modalScaleUp {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>

        {/* 1. Left: Hospital Logo, Name, Tagline & Live AI Status */}
        <div
          className="header-brand-left"
          onClick={() => {
            const role = (currentUser?.role || "").toLowerCase();
            if (role === "super_admin" || role === "superadmin") {
              navigateTo("superadmin");
            } else if (isPharmacist) {
              navigateTo("pharmacy");
            } else if (role === "doctor" || role === "physician") {
              navigateTo("doctor");
            } else if (["staff", "receptionist", "nurse"].includes(role)) {
              navigateTo("staff");
            } else if (role === "admin") {
              navigateTo("doctor");
            } else {
              navigateTo("patient", "walkin");
            }
          }}
          title="Hospital System HQ"
        >
          <div style={{ ...shieldLogoContainerStyle, width: "36px", height: "36px", background: displayLogoUrl ? "#FFFFFF" : brandPrimary, border: displayLogoUrl ? `1.5px solid ${brandPrimary}` : "none", flexShrink: 0 }}>
            {displayLogoUrl ? (
              <img
                src={displayLogoUrl}
                alt="Hospital Logo"
                style={{ width: "24px", height: "24px", objectFit: "contain", borderRadius: "5px" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2.5L4.5 5.5v5.5c0 5.1 3.2 9.85 7.5 11 4.3-1.15 7.5-5.9 7.5-11V5.5L12 2.5z"
                  fill="#FFFFFF"
                />
                <path
                  d="M12 7.5v9M7.5 12h9"
                  stroke={brandPrimary}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "nowrap" }}>
              <span className="header-hospital-name-text" style={{ fontWeight: 900, fontSize: "15.5px", color: isDarkHeader ? "#F8FAFC" : "#0F172A", letterSpacing: "-0.3px", lineHeight: "1.2", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayHospitalName}
              </span>
              <span className="header-nabh-badge" style={{ padding: "1.5px 6px", borderRadius: "12px", background: isDarkHeader ? "rgba(2, 132, 199, 0.2)" : "#F0F9FF", color: brandPrimary, fontSize: "9px", fontWeight: 800, border: `1px solid ${brandPrimary}40`, whiteSpace: "nowrap" }}>
                NABH ACCREDITED
              </span>
            </div>
            <div style={{ fontSize: "11px", color: isDarkHeader ? "#94A3B8" : "#64748B", fontWeight: 600, marginTop: "2px", display: "flex", alignItems: "center", gap: "5px", flexWrap: "nowrap" }}>
              <span style={{ color: socketConnected ? brandPrimary : "#D97706", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700, whiteSpace: "nowrap" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: socketConnected ? "#0EA5E9" : "#F59E0B", display: "inline-block" }} />
                {socketConnected
                  ? (language === "hi" ? "AI सक्रिय" : "AI Active")
                  : (language === "hi" ? "कनेक्ट..." : "Connecting...")}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Center: Quick Hospital Support & Emergency Hotline or Staff Desk Switcher */}
        <nav className="header-center-nav">
          {/* Clinical & Staff Desk Switcher Bar (Doctor Desk, Pharmacy Station, Reception Desk) */}
          {!isPatientOrGuest && (
            <div
              className="header-desk-switcher-bar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: isDarkHeader ? "rgba(30, 41, 59, 0.75)" : "rgba(241, 245, 249, 0.88)",
                padding: "4px 6px",
                borderRadius: "14px",
                border: isDarkHeader ? "1px solid rgba(51, 65, 85, 0.8)" : "1px solid rgba(226, 232, 240, 0.95)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              }}
            >
              {/* Doctor Consultation Desk */}
              {(isDoctorAccess || isSuperAdmin) && (
                <button
                  type="button"
                  onClick={() => navigateTo("doctor")}
                  className={`header-nav-btn ${activePage === "doctor" ? "active" : ""}`}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: activePage === "doctor" ? 800 : 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    border: activePage === "doctor" ? "1.5px solid #0284C7" : undefined,
                    background: activePage === "doctor" ? (isDarkHeader ? "rgba(2, 132, 199, 0.3)" : "#E0F2FE") : undefined,
                    color: activePage === "doctor" ? (isDarkHeader ? "#38BDF8" : "#0284C7") : undefined,
                  }}
                  title={language === "hi" ? "डॉक्टर ओपीडी परामर्श डेस्क" : "Doctor OPD Consultation Desk"}
                >
                  <span style={{ fontSize: "14px" }}>🩺</span>
                  <span>{language === "hi" ? "डॉक्टर डेस्क" : "Doctor Desk"}</span>
                </button>
              )}

              {/* Pharmacy Dispensing Station */}
              {(isPharmacistAccess || isSuperAdmin) && (
                <button
                  type="button"
                  onClick={() => navigateTo("pharmacy")}
                  className={`header-nav-btn ${activePage === "pharmacy" ? "active" : ""}`}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: activePage === "pharmacy" ? 800 : 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    border: activePage === "pharmacy" ? "1.5px solid #059669" : undefined,
                    background: activePage === "pharmacy" ? (isDarkHeader ? "rgba(16, 185, 129, 0.25)" : "#D1FAE5") : undefined,
                    color: activePage === "pharmacy" ? (isDarkHeader ? "#34D399" : "#059669") : undefined,
                  }}
                  title={language === "hi" ? "अस्पताल फार्मेसी एवं दवा वितरण स्टेशन" : "Hospital Pharmacy & Medication Dispensing Station"}
                >
                  <span style={{ fontSize: "14px" }}>💊</span>
                  <span>{language === "hi" ? "फार्मेसी स्टेशन" : "Pharmacy Station"}</span>
                </button>
              )}

              {/* Reception Desk */}
              {(isStaffAccess || isSuperAdmin) && (
                <button
                  type="button"
                  onClick={() => navigateTo("staff")}
                  className={`header-nav-btn ${activePage === "staff" ? "active" : ""}`}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: activePage === "staff" ? 800 : 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    border: activePage === "staff" ? "1.5px solid #6366F1" : undefined,
                    background: activePage === "staff" ? (isDarkHeader ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF") : undefined,
                    color: activePage === "staff" ? (isDarkHeader ? "#A5B4FC" : "#4F46E5") : undefined,
                  }}
                  title={language === "hi" ? "मरीज़ पंजीकरण एवं फ्रंट डेस्क" : "Patient Registration & Front Desk Reception"}
                >
                  <span style={{ fontSize: "14px" }}>📋</span>
                  <span>{language === "hi" ? "रिसेप्शन डेस्क" : "Reception Desk"}</span>
                </button>
              )}
            </div>
          )}

          {/* Emergency 24/7 Hotline Button (Visible only on Patient Portal, hidden on Doctor/Staff & Admin Portals) */}
          {activePage === "patient" && (
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="header-emergency-pill"
              title="Emergency Care & 24/7 Helpline"
            >
              <div className="emergency-beacon-ring">
                <span className="emergency-beacon-dot" />
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span style={{ maxWidth: "190px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayEmergencyText}
              </span>
            </button>
          )}

          {/* About Us & Contact - displayed on patient portal to avoid crowding admin/staff header */}
          {activePage === "patient" && (
            <>
              <button
                type="button"
                onClick={() => setShowAboutModal(true)}
                className="header-nav-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>{language === "hi" ? "हमारे बारे में" : "About Us"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowContactModal(true)}
                className="header-nav-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{language === "hi" ? "संपर्क" : "Support"}</span>
              </button>
            </>
          )}
        </nav>

        {/* 3. Right: Theme Toggle (User Portal Only), Language Selector & Patient Profile Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative", flexShrink: 0 }}>
          {/* Theme Toggle Switch (Available for Patient, Super Admin & Doctor/Reception Portals) */}
          {(activePage === "patient" || activePage === "superadmin" || activePage === "staff" || activePage === "admin") && (
            <button
              type="button"
              onClick={handleToggleTheme}
              className={`header-theme-toggle-btn ${theme === "dark" ? "is-dark" : "is-light"}`}
              title={
                theme === "dark"
                  ? (language === "hi" ? "लाइट थीम (दिन)" : "Switch to Light Theme")
                  : (language === "hi" ? "डार्क थीम (रात)" : "Switch to Dark Theme")
              }
              aria-label="Toggle dark and light theme"
              role="switch"
              aria-checked={theme === "dark"}
            >
              <span className="theme-track-icon theme-sun-track" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4.5" fill="#FDE68A" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </span>
              <span className="theme-track-icon theme-moon-track" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </span>
              <span className="theme-toggle-knob">
                {theme === "dark" ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4.5" fill="#FBBF24" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                  </svg>
                )}
              </span>
            </button>
          )}

          {/* Language Selector Pill Button */}
          <div ref={langRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                setLangDropdownOpen((prev) => !prev);
                setProfileDropdownOpen(false);
              }}
              className="header-pill-btn"
              title="Change Language"
            >
              <Globe size={14} style={{ color: "#0284C7", flexShrink: 0 }} />
              <span>{language === "hi" ? "हिंदी" : "English"}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {langDropdownOpen && (
              <div className="header-dropdown-menu" style={{ minWidth: "150px" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (setLanguage) setLanguage("en");
                    setLangDropdownOpen(false);
                  }}
                  className={`header-dropdown-item ${language === "en" ? "active" : ""}`}
                >
                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 5px", borderRadius: "4px", background: language === "en" ? "#0284C7" : "#E2E8F0", color: language === "en" ? "#FFFFFF" : "#475569" }}>EN</span>
                  <span>English</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (setLanguage) setLanguage("hi");
                    setLangDropdownOpen(false);
                  }}
                  className={`header-dropdown-item ${language === "hi" ? "active" : ""}`}
                >
                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 5px", borderRadius: "4px", background: language === "hi" ? "#0284C7" : "#E2E8F0", color: language === "hi" ? "#FFFFFF" : "#475569" }}>HI</span>
                  <span>हिंदी</span>
                </button>
              </div>
            )}
          </div>

          {/* Patient Profile Dropdown Button */}
          {currentUser ? (
            <div ref={profileRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setProfileDropdownOpen((prev) => !prev);
                  setLangDropdownOpen(false);
                }}
                className="header-pill-btn"
                style={{
                  padding: "5px 12px 5px 6px",
                  borderColor: profileDropdownOpen ? "#0284C7" : "#CBD5E1",
                  background: profileDropdownOpen ? "#F0F9FF" : "#FFFFFF",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {/* User Avatar Circle */}
                <div style={{ ...dropdownAvatarStyle, width: "28px", height: "28px", fontSize: "12px" }}>
                  {activeDisplayName.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: "13px", fontWeight: 800, color: isDarkHeader ? "#F8FAFC" : "#0F172A", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeDisplayName}
                </span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "2px" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>


              {profileDropdownOpen && (
                <div className="header-dropdown-menu" style={{ width: "290px", padding: "10px" }}>
                  {/* Account Header */}
                  <div style={{ padding: "10px 12px 12px 12px", marginBottom: "8px", background: isDarkHeader ? "#0F172A" : "#F8FAFC", borderRadius: "12px", border: isDarkHeader ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ ...dropdownAvatarStyle, width: "36px", height: "36px", fontSize: "14px", background: "#0284C7", color: "#FFFFFF" }}>
                        {activeDisplayName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: "13.5px", color: isDarkHeader ? "#F8FAFC" : "#0F172A", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {activeDisplayName}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                          <span style={userRoleTagStyle(currentUser.role)}>
                            {(currentUser.role || "user").toUpperCase()}
                          </span>
                          {activeFamilyMember && (
                            <span style={{ fontSize: "10px", color: "#0369A1", fontWeight: 700, background: "#E0F2FE", padding: "1px 5px", borderRadius: "4px", border: "1px solid #BAE6FD" }}>
                              {activeDisplayRelation}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Prominent Hospital Affiliation Box for Staff/Doctor */}
                    {["admin", "doctor", "staff", "receptionist", "super_admin", "superadmin"].includes(currentUser.role) && (
                      <div style={{ padding: "8px 10px", marginTop: "8px", background: "#F0F9FF", borderRadius: "8px", border: "1px solid #BAE6FD", fontSize: "11px", color: "#0369A1" }}>
                        <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>🏥</span>
                          <span>{currentUser.hospital_name || HOSPITAL_CONFIG.name}</span>
                        </div>
                        {currentUser.department && currentUser.department !== "all" && (
                          <div style={{ fontSize: "10px", color: "#0284C7", marginTop: "2px", fontWeight: 600 }}>
                            Department: {currentUser.department.toUpperCase()} {currentUser.employee_id ? `• ID: ${currentUser.employee_id}` : ""}
                          </div>
                        )}
                      </div>
                    )}
                  </div>


                  {/* Profile Switcher — Only for patient/user role */}
                  {isPatientUser && (
                    <>
                      <div style={{ padding: "4px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {language === "hi" ? "प्रोफ़ाइल बदलें" : "Switch Profile"}
                        </span>
                        {familyMembers.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setFamilySwitcherExpanded(prev => !prev)}
                            style={{ fontSize: "10px", color: "#0369A1", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            {familySwitcherExpanded ? (language === "hi" ? "कम दिखाएं" : "Less") : (language === "hi" ? "सभी दिखाएं" : "All")}
                          </button>
                        )}
                      </div>

                      {/* Self */}
                      {(() => {
                        const depNames = (familyMembers || []).filter((m) => m && m.id !== "self").map((m) => String(m.name || "").toLowerCase().trim()).filter(Boolean);
                        const rawSelf = familyTickets["self"];
                        const isSelfTicketValid = rawSelf && !depNames.includes(String(rawSelf.name || "").toLowerCase().trim()) && (!rawSelf.family_member_id || rawSelf.family_member_id === "self");
                        const selfTicket = isSelfTicketValid ? rawSelf : null;
                        return (
                          <button
                            type="button"
                            className={`header-dropdown-item ${!activeFamilyMember ? "active" : ""}`}
                            onClick={() => {
                              const selfObj = { id: "self", name: username, relation: "self" };
                              if (onSwitchProfile) onSwitchProfile(selfObj);
                              setProfileDropdownOpen(false);
                            }}
                            style={{ justifyContent: "space-between" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: !activeFamilyMember ? "#0284C7" : "#F0F9FF", color: !activeFamilyMember ? "#fff" : "#0284C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, border: !activeFamilyMember ? "2px solid #0284C7" : "1px solid #BAE6FD", flexShrink: 0 }}>
                                {username.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: "12.5px", fontWeight: 700, lineHeight: 1.2 }}>{username}</div>
                                <div style={{ fontSize: "10px", color: !activeFamilyMember ? "#0284C7" : "#64748B", fontWeight: 600 }}>{language === "hi" ? "मेरी प्रोफ़ाइल" : "My Profile"}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {selfTicket && (
                                <span style={{ fontSize: "10.5px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: "12px", padding: "1px 6px", fontWeight: 800, whiteSpace: "nowrap" }}>
                                  🎟️ #{selfTicket.ticket_id}
                                </span>
                              )}
                              {!activeFamilyMember && (
                                <span style={{ color: "#0284C7", fontSize: "14px", fontWeight: 900 }}>✓</span>
                              )}
                            </div>
                          </button>
                        );
                      })()}

                      {/* Family Members */}
                      {(familySwitcherExpanded ? familyMembers : familyMembers.slice(0, 3)).map((member) => {
                        const isActive = activeFamilyMember && activeFamilyMember.id === member.id;
                        const memTicket = familyTickets[member.id] || familyTickets[String(member.id)];
                        return (
                          <button
                            key={member.id}
                            type="button"
                            className={`header-dropdown-item ${isActive ? "active" : ""}`}
                            onClick={() => {
                              if (onSwitchProfile) onSwitchProfile(member);
                              setProfileDropdownOpen(false);
                            }}
                            style={{ justifyContent: "space-between" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: isActive ? "#0369A1" : "#E0F2FE", color: isActive ? "#fff" : "#0369A1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, border: isActive ? "2px solid #0284C7" : "1px solid #BAE6FD", flexShrink: 0 }}>
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: "12.5px", fontWeight: 700, lineHeight: 1.2 }}>{member.name}</div>
                                <div style={{ fontSize: "10px", color: isActive ? "#0284C7" : "#64748B", fontWeight: 600 }}>{getRelationLabel(member.relation, language)}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {memTicket && (
                                <span style={{ fontSize: "10.5px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: "12px", padding: "1px 6px", fontWeight: 800, whiteSpace: "nowrap" }}>
                                  🎟️ #{memTicket.ticket_id}
                                </span>
                              )}
                              {isActive && (
                                <span style={{ color: "#0284C7", fontSize: "14px", fontWeight: 900 }}>✓</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Staff Workspace Direct Links */}
                  {isPharmacistAccess && (
                    <button
                      type="button"
                      className={`header-dropdown-item ${activePage === "pharmacy" ? "active" : ""}`}
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigateTo("pharmacy");
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>💊</span>
                      <span>{language === "hi" ? "फार्मेसी वितरण वर्कस्टेशन" : "Pharmacy Dispensing Portal"}</span>
                    </button>
                  )}
                  {(isSuperAdmin || ["doctor", "physician"].includes(userRole)) && (
                    <button
                      type="button"
                      className={`header-dropdown-item ${activePage === "doctor" ? "active" : ""}`}
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigateTo("doctor");
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>🩺</span>
                      <span>{language === "hi" ? "डॉक्टर परामर्श डेस्क" : "Doctor Consultation Desk"}</span>
                    </button>
                  )}
                  {(isSuperAdmin || (["staff", "receptionist", "nurse"].includes(userRole) && !isPharmacist)) && (
                    <button
                      type="button"
                      className={`header-dropdown-item ${activePage === "staff" ? "active" : ""}`}
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigateTo("staff");
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>📋</span>
                      <span>{language === "hi" ? "रिसेप्शन एवं टोकन डेस्क" : "OPD Reception Desk"}</span>
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      className={`header-dropdown-item ${activePage === "superadmin" ? "active" : ""}`}
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigateTo("superadmin");
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>⚡</span>
                      <span>{language === "hi" ? "सुपर एडमिन डैशबोर्ड" : "Super Admin Dashboard"}</span>
                    </button>
                  )}

                  <div style={{ height: "1px", background: isDarkHeader ? "#334155" : "#E2E8F0", margin: "6px 0" }} />

                  {/* Sign Out Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="header-dropdown-item danger"
                    style={{ padding: "9px 12px" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>{language === "hi" ? "साइन आउट" : "Sign Out"}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              style={{
                padding: "8px 16px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                color: "#FFFFFF",
                fontSize: "12.5px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{t("accountLogin", language)}</span>
            </button>
          )}
        </div>
      </header>

      {/* 4. ABOUT US MODAL */}
      {showAboutModal && (
        <div className="header-modal-overlay" onClick={() => setShowAboutModal(false)}>
          <div
            className="header-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDarkHeader ? "#0F172A" : "#FFFFFF",
              border: isDarkHeader ? "1px solid #334155" : "1px solid #E2E8F0",
              color: isDarkHeader ? "#F8FAFC" : "#0F172A",
              boxShadow: isDarkHeader ? "0 24px 48px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(56, 189, 248, 0.15)" : "0 20px 60px -10px rgba(15,23,42,0.12)",
              maxWidth: "580px",
              width: "100%",
              maxHeight: "88vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "20px",
            }}
          >
            {/* Header: Logo + Title + Close */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
              <div style={{ ...modalLogoShieldStyle, background: displayLogoUrl ? (isDarkHeader ? "#1E293B" : "#FFFFFF") : brandPrimary, border: displayLogoUrl ? `1.5px solid ${brandPrimary}` : "none", width: "52px", height: "52px", borderRadius: "14px" }}>
                {displayLogoUrl ? (
                  <img src={displayLogoUrl} alt="Logo" style={{ width: "32px", height: "32px", objectFit: "contain", borderRadius: "6px" }} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2.5L4.5 5.5v5.5c0 5.1 3.2 9.85 7.5 11 4.3-1.15 7.5-5.9 7.5-11V5.5L12 2.5z" fill={brandPrimary} />
                    <path d="M12 7.5v9M7.5 12h9" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "20px", color: isDarkHeader ? "#F8FAFC" : "#0F172A", fontWeight: 900, letterSpacing: "-0.3px" }}>
                  {displayAboutTitle}
                </h3>
                <span style={{ fontSize: "12px", color: isDarkHeader ? "#94A3B8" : "#64748B", fontWeight: 500 }}>
                  {displayAboutSubtitle}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: isDarkHeader ? "#64748B" : "#94A3B8", fontSize: "22px", lineHeight: 1, padding: "4px 8px", borderRadius: "6px" }}
              >✕</button>
            </div>

            {/* Live Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "18px" }}>
              {[
                { value: hospitalBranding?.about_stat_1_val || "15,000+", label: (language === "hi" && hospitalBranding?.about_stat_1_lbl_hi) || hospitalBranding?.about_stat_1_lbl || (language === "hi" ? "मासिक मरीज़" : "Monthly Patients"), icon: "👥" },
                { value: hospitalBranding?.about_stat_2_val || "98%", label: (language === "hi" && hospitalBranding?.about_stat_2_lbl_hi) || hospitalBranding?.about_stat_2_lbl || (language === "hi" ? "संतुष्टि दर" : "Satisfaction Rate"), icon: "⭐" },
                { value: hospitalBranding?.about_stat_3_val || "< 8 min", label: (language === "hi" && hospitalBranding?.about_stat_3_lbl_hi) || hospitalBranding?.about_stat_3_lbl || (language === "hi" ? "औसत प्रतीक्षा" : "Avg. Wait Time"), icon: "⚡" },
                { value: hospitalBranding?.about_stat_4_val || "24 / 7", label: (language === "hi" && hospitalBranding?.about_stat_4_lbl_hi) || hospitalBranding?.about_stat_4_lbl || (language === "hi" ? "हमेशा उपलब्ध" : "Always Available"), icon: "🕐" },
              ].map((stat, i) => (
                <div key={i} style={{
                  background: isDarkHeader ? "#1E293B" : "#F8FAFC",
                  border: `1px solid ${isDarkHeader ? "#334155" : "#E2E8F0"}`,
                  borderRadius: "12px",
                  padding: "12px 8px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "18px", marginBottom: "4px" }}>{stat.icon}</div>
                  <div style={{ fontSize: "15px", fontWeight: 900, color: brandPrimary, letterSpacing: "-0.5px" }}>{stat.value}</div>
                  <div style={{ fontSize: "10px", color: isDarkHeader ? "#94A3B8" : "#64748B", fontWeight: 600, marginTop: "2px" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Mission Statement */}
            <div style={{
              background: isDarkHeader ? "rgba(2,132,199,0.1)" : "#F0F9FF",
              border: `1px solid ${isDarkHeader ? "rgba(56,189,248,0.2)" : "#BAE6FD"}`,
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "18px",
              borderLeft: `4px solid ${brandPrimary}`,
            }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: brandPrimary, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>
                🎯 {language === "hi" ? "हमारा मिशन" : "Our Mission"}
              </div>
              <p style={{ fontSize: "13px", color: isDarkHeader ? "#CBD5E1" : "#334155", lineHeight: "1.65", margin: 0, whiteSpace: "pre-line" }}>
                {displayAboutBody}
              </p>
            </div>

            {/* Services Grid */}
            <div style={{ marginBottom: "18px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: isDarkHeader ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
                🏥 {language === "hi" ? "हमारी सेवाएँ" : "Our Services"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                {[
                  { text: displayService1, icon: "🚑" },
                  { text: displayService2, icon: "🤖" },
                  { text: displayService3, icon: "🏨" },
                  { text: displayService4, icon: "💊" },
                  { text: language === "hi" ? "डिजिटल टोकन सिस्टम • ज़ीरो प्रतीक्षा पर्ची" : "Smart Token System • Zero paper queue passes", icon: "🎫" },
                  { text: language === "hi" ? "पारिवारिक स्वास्थ्य प्रोफाइल • आश्रित बुकिंग" : "Family Health Profiles • Dependents booking", icon: "👨‍👩‍👧" },
                ].map((svc, i) => (
                  <div key={i} style={{
                    background: isDarkHeader ? "#1E293B" : "#FAFAFA",
                    border: `1px solid ${isDarkHeader ? "#334155" : "#E2E8F0"}`,
                    borderRadius: "10px",
                    padding: "10px 12px",
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{svc.icon}</span>
                    <div>
                      <strong style={{ color: brandPrimary, display: "block", marginBottom: "2px" }}>{svc.text.split("•")[0].trim()}</strong>
                      {svc.text.includes("•") && (
                        <span style={{ color: isDarkHeader ? "#94A3B8" : "#64748B", fontSize: "11px" }}>{svc.text.split("•").slice(1).join("•").trim()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technology Highlights */}
            <div style={{
              background: isDarkHeader ? "#1E293B" : "#F8FAFC",
              border: `1px solid ${isDarkHeader ? "#334155" : "#E2E8F0"}`,
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "18px",
            }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: isDarkHeader ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
                ⚙️ {language === "hi" ? "प्रौद्योगिकी एवं नवाचार" : "Technology & Innovation"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {(hospitalBranding?.about_tech_highlights
                  ? hospitalBranding.about_tech_highlights.split(",").map((s) => s.trim()).filter(Boolean)
                  : [
                      "AI Queue Orchestration", "Real-Time Socket Sync", "Digital Prescriptions",
                      "QR Check-In", "Priority Escalation", "Multi-Language", "Family Profiles", "Live Analytics",
                    ]
                ).map((tech, i) => (
                  <span key={i} style={{
                    background: isDarkHeader ? "rgba(2,132,199,0.15)" : "#EFF6FF",
                    color: brandPrimary,
                    border: `1px solid ${isDarkHeader ? "rgba(56,189,248,0.25)" : "#DBEAFE"}`,
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "20px",
                  }}>{tech}</span>
                ))}
              </div>
            </div>

            {/* Accreditations */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
              {[
                {
                  icon: "🏅",
                  label: (language === "hi" && hospitalBranding?.about_badge_1_hi) || hospitalBranding?.about_badge_1 || (language === "hi" ? "NABH मान्यता" : "NABH Accredited"),
                  sub: (language === "hi" && hospitalBranding?.about_badge_1_sub_hi) || hospitalBranding?.about_badge_1_sub || (language === "hi" ? "राष्ट्रीय मानक" : "National Standards"),
                },
                {
                  icon: "🛡️",
                  label: (language === "hi" && hospitalBranding?.about_badge_2_hi) || hospitalBranding?.about_badge_2 || (language === "hi" ? "ISO 27001" : "ISO 27001 Certified"),
                  sub: (language === "hi" && hospitalBranding?.about_badge_2_sub_hi) || hospitalBranding?.about_badge_2_sub || (language === "hi" ? "डेटा सुरक्षा" : "Data Security"),
                },
                {
                  icon: "🤝",
                  label: (language === "hi" && hospitalBranding?.about_badge_3_hi) || hospitalBranding?.about_badge_3 || (language === "hi" ? "आयुष्मान भारत" : "Ayushman Bharat"),
                  sub: (language === "hi" && hospitalBranding?.about_badge_3_sub_hi) || hospitalBranding?.about_badge_3_sub || (language === "hi" ? "सरकारी योजना" : "Govt. Empanelled"),
                },
              ].map((award, i) => (
                <div key={i} style={{
                  flex: "1 1 140px",
                  background: isDarkHeader ? "#1E293B" : "#FAFAFA",
                  border: `1px solid ${isDarkHeader ? "#334155" : "#E2E8F0"}`,
                  borderRadius: "12px",
                  padding: "12px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "22px", marginBottom: "4px" }}>{award.icon}</div>
                  <div style={{ fontSize: "11.5px", fontWeight: 800, color: isDarkHeader ? "#F1F5F9" : "#0F172A" }}>{award.label}</div>
                  <div style={{ fontSize: "10px", color: isDarkHeader ? "#94A3B8" : "#64748B", marginTop: "2px" }}>{award.sub}</div>
                </div>
              ))}
            </div>

            {/* Why Choose Us */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: isDarkHeader ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
                💡 {language === "hi" ? "हमें क्यों चुनें?" : "Why Choose Us?"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {(((language === "hi" && hospitalBranding?.about_why_choose_hi) || hospitalBranding?.about_why_choose)
                  ? ((language === "hi" && hospitalBranding?.about_why_choose_hi) || hospitalBranding?.about_why_choose).split("\n").map((s) => s.trim()).filter(Boolean)
                  : (language === "hi" ? [
                      "टोकन सिस्टम से लाइन में खड़े होने की ज़रूरत नहीं",
                      "AI द्वारा गंभीर मरीज़ों को स्वचालित प्राथमिकता",
                      "परिवार के सभी सदस्यों के लिए एक ही खाते से बुकिंग",
                      "मोबाइल पर लाइव कतार स्थिति, SMS अलर्ट",
                      "डिजिटल ई-पर्ची — कागज़ की ज़रूरत नहीं",
                    ] : [
                      "No physical queue — get your token digitally from anywhere",
                      "AI auto-escalates critical/emergency cases instantly",
                      "Book for all family members from a single account",
                      "Live queue status on mobile + real-time alerts",
                      "Digital e-prescriptions — zero paperwork needed",
                    ])
                ).map((reason, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: isDarkHeader ? "#CBD5E1" : "#334155" }}>
                    <span style={{ color: "#10B981", fontWeight: 800, flexShrink: 0 }}>✓</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Footer CTA */}
            <div style={{
              background: isDarkHeader ? "rgba(220,38,38,0.1)" : "#FEF2F2",
              border: `1px solid ${isDarkHeader ? "rgba(220,38,38,0.3)" : "#FECACA"}`,
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "22px" }}>🚨</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#DC2626" }}>
                    {language === "hi" ? "आपातकालीन हेल्पलाइन" : "Emergency Helpline"}
                  </div>
                  <div style={{ fontSize: "11px", color: isDarkHeader ? "#94A3B8" : "#64748B" }}>
                    {language === "hi" ? "24/7 उपलब्ध — तुरंत सहायता" : "24/7 Available — Immediate Assistance"}
                  </div>
                </div>
              </div>
              <a
                href={`tel:${(hospitalBranding?.emergency_helpline || "108").replace(/[^0-9+]/g, "") || "108"}`}
                style={{
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 800,
                  padding: "7px 18px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  letterSpacing: "0.3px",
                  boxShadow: "0 2px 8px rgba(220,38,38,0.35)",
                }}
              >
                📞 {(hospitalBranding?.emergency_helpline || "108").replace(/^Emergency Helpline:\s*/i, "").split("/")[0].trim() || "108"}
              </a>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowAboutModal(false)}
              style={modalCloseBtnStyle}
            >
              {language === "hi" ? "बंद करें" : "Close"}
            </button>
          </div>
        </div>
      )}

            {/* 5. CONTACT US MODAL */}
      {showContactModal && (
        <div className="header-modal-overlay" onClick={() => setShowContactModal(false)}>
          <div
            className="header-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDarkHeader ? "#0F172A" : "#FFFFFF",
              border: isDarkHeader ? "1px solid #334155" : "1px solid #E2E8F0",
              color: isDarkHeader ? "#F8FAFC" : "#0F172A",
              boxShadow: isDarkHeader ? "0 24px 48px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(56, 189, 248, 0.15)" : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ ...modalLogoShieldStyle, background: displayLogoUrl ? (isDarkHeader ? "#1E293B" : "#FFFFFF") : brandPrimary, border: displayLogoUrl ? `1.5px solid ${brandPrimary}` : "none" }}>
                {displayLogoUrl ? (
                  <img
                    src={displayLogoUrl}
                    alt="Logo"
                    style={{ width: "28px", height: "28px", objectFit: "contain", borderRadius: "6px" }}
                  />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2.5L4.5 5.5v5.5c0 5.1 3.2 9.85 7.5 11 4.3-1.15 7.5-5.9 7.5-11V5.5L12 2.5z"
                      fill={brandPrimary}
                    />
                    <path
                      d="M12 7.5v9M7.5 12h9"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: isDarkHeader ? "#F8FAFC" : "#0F172A", fontWeight: 800 }}>
                  {language === "hi" ? "संपर्क एवं सहायता डेस्क" : "Contact & Support"}
                </h3>
                <span style={{ fontSize: "12px", color: isDarkHeader ? "#94A3B8" : "#64748B" }}>
                  {displayHospitalName} • {displayTagline}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div style={{ ...contactInfoCardStyle, background: isDarkHeader ? "#1E293B" : "#F8FAFC", border: isDarkHeader ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#DC2626", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🚨</span> {language === "hi" ? "24/7 आपातकालीन एम्बुलेंस हेल्पलाइन" : "24/7 Emergency Ambulance Helpline"}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 800, color: isDarkHeader ? "#F8FAFC" : "#0F172A", marginTop: "3px" }}>
                  {displayEmergencyText}
                </div>
              </div>

              <div style={{ ...contactInfoCardStyle, background: isDarkHeader ? "#1E293B" : "#F8FAFC", border: isDarkHeader ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#38BDF8", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🏥</span> {language === "hi" ? "ओपीडी रिसेप्शन एवं कतार सहायता" : "OPD Reception & Queue Help Desk"}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: isDarkHeader ? "#F8FAFC" : "#0F172A", marginTop: "3px" }}>
                  {displayHelpdeskPhone}
                </div>
                <div style={{ fontSize: "11.5px", color: isDarkHeader ? "#94A3B8" : "#64748B", marginTop: "2px" }}>
                  {displayHelpdeskHours}
                </div>
              </div>

              <div style={{ ...contactInfoCardStyle, background: isDarkHeader ? "#1E293B" : "#F8FAFC", border: isDarkHeader ? "1px solid #334155" : "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#38BDF8", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📍</span> {language === "hi" ? "अस्पताल पता" : "Hospital Campus Address"}
                </div>
                <div style={{ fontSize: "12.5px", color: isDarkHeader ? "#CBD5E1" : "#334155", marginTop: "3px" }}>
                  {displayAddress}
                </div>
                {displayEmail && (
                  <div style={{ fontSize: "11.5px", color: isDarkHeader ? "#94A3B8" : "#64748B", marginTop: "2px" }}>
                    Email: {displayEmail}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowContactModal(false)}
              style={modalCloseBtnStyle}
            >
              {language === "hi" ? "बंद करें" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* Add Family Member Modal (triggered from profile dropdown) */}
      {isPatientUser && (
        <AddFamilyMemberModal
          isOpen={showAddFamilyModal}
          onClose={() => setShowAddFamilyModal(false)}
          onAddMember={async (member) => {
            if (onAddFamilyMember) {
              await onAddFamilyMember(member);
            }
            setShowAddFamilyModal(false);
          }}
          language={language}
        />
      )}

    </>
  );
}

const headerContainerStyle = {
  maxWidth: "100%",
  width: "100%",
  position: "relative",
  zIndex: 100,
};

const shieldLogoContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "38px",
  height: "38px",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
  flexShrink: 0,
};

const modalLogoShieldStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  flexShrink: 0,
};

const dropdownAvatarStyle = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  background: "#F0F9FF",
  color: "#0369A1",
  fontWeight: 800,
  fontSize: "13px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #BAE6FD",
  flexShrink: 0,
};

const userRoleTagStyle = (role) => {
  if (role === "super_admin" || role === "superadmin") return { display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A", marginTop: "2px" };
  if (role === "doctor") return { display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", background: "#F0F9FF", color: "#0369A1", border: "1px solid #BAE6FD", marginTop: "2px" };
  if (role === "admin") return { display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", marginTop: "2px" };
  return { display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", background: "#F1F5F9", color: "#475569", border: "1px solid #CBD5E1", marginTop: "2px" };
};

const contactInfoCardStyle = {
  padding: "12px 14px",
  borderRadius: "10px",
  background: "#F8FAFC",
  border: "1px solid #E2E8F0",
};

const modalCloseBtnStyle = {
  width: "100%",
  padding: "11px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#0284C7",
  color: "#FFFFFF",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(2, 132, 199, 0.2)",
};
