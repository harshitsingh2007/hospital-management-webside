/**
 * ReceptionHistoryPage.jsx
 * -------------------------
 * Dedicated Reception History Page.
 * Can be navigated to directly via route (activePage === "reception-history")
 * or linked from the Reception Portal & Header.
 */

import React, { useState, useEffect } from "react";
import {
  History,
  Building2,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  User,
  Activity,
  Layers,
} from "lucide-react";
import ReceptionHistorySection from "../components/staff/ReceptionHistorySection";
import { API_BASE } from "../config/hospitalConfig";
import { apiFetch } from "../utils/apiFetch";

export default function ReceptionHistoryPage({
  tenantId,
  currentUser,
  language = "en",
  navigateTo,
  hospitalBranding,
  theme = "light",
  setTheme,
}) {
  const isDark = theme === "dark";
  const isHi = language === "hi";

  const effectiveHospitalCode =
    tenantId ||
    currentUser?.hospital_code ||
    currentUser?.primary_hospital_code ||
    "city-hospital-01";

  const [departments, setDepartments] = useState([]);

  // Load hospital departments for filtering
  useEffect(() => {
    async function loadDepts() {
      if (!effectiveHospitalCode) return;
      try {
        const res = await apiFetch(`${API_BASE}/api/v1/hospitals/${encodeURIComponent(effectiveHospitalCode)}/departments`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success" && Array.isArray(data.departments)) {
            setDepartments(data.departments);
          }
        }
      } catch (e) {
        console.warn("Failed to load departments:", e);
      }
    }
    loadDepts();
  }, [effectiveHospitalCode]);

  const hospitalName =
    hospitalBranding?.name ||
    currentUser?.hospital_name ||
    "District Civil Hospital";

  return (
    <div
      className={`reception-history-page-root ${isDark ? "dark-theme" : ""}`}
      style={{
        maxWidth: "100%",
        width: "100%",
        margin: "0",
        padding: "0 6px 20px 6px",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      {/* 1. TOP HERO BANNER */}
      <div
        style={{
          background: isDark
            ? "linear-gradient(135deg, #091E3A 0%, #0F284E 50%, #1A365D 100%)"
            : "linear-gradient(135deg, #0B2545 0%, #133E68 50%, #1D4E89 100%)",
          borderRadius: "20px",
          padding: "24px 28px",
          marginBottom: "20px",
          color: "#FFFFFF",
          boxShadow: "0 10px 30px rgba(11, 37, 69, 0.15)",
          position: "relative",
          overflow: "hidden",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Title & Metadata */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  color: "#FFFFFF",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Building2 size={12} />
                <span>{hospitalName}</span>
              </span>

              <span
                style={{
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34D399",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ShieldCheck size={12} />
                <span>NABL & NABH ACCREDITED DIGITAL RECORD VAULT</span>
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 900,
                letterSpacing: "-0.5px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <History size={26} color="#38BDF8" />
              <span>{isHi ? "रिसेप्शन मरीज़ विज़िट एवं परामर्श ऑडिट इतिहास" : "Reception Patient Visit & Consultation Audit History"}</span>
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginTop: "10px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.75)",
                flexWrap: "wrap",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <User size={13} color="#38BDF8" />
                <strong>{currentUser?.name || currentUser?.username || "Reception Officer"}</strong>
              </span>
              <span>•</span>
              <span>Dept: <strong>OPD Central Reception</strong></span>
              <span>•</span>
              <span>ID: <code style={{ color: "#38BDF8" }}>{currentUser?.employee_code || currentUser?.id || "REC-1"}</code></span>
            </div>
          </div>

          {/* Quick Back to Front-Desk Action Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                if (navigateTo) navigateTo("staff");
                else window.location.assign("/?page=staff");
              }}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                color: "#FFFFFF",
                padding: "10px 18px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backdropFilter: "blur(8px)",
                transition: "all 0.15s ease",
              }}
              title={isHi ? "रिसेप्शन डेस्क पर वापस जाएं" : "Return to Reception Desk"}
            >
              <ArrowLeft size={16} />
              <span>{isHi ? "रिसेप्शन डेस्क पर लौटें" : "Back to Reception Desk"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. RECEPTION HISTORY COMPONENT */}
      <ReceptionHistorySection
        hospitalCode={effectiveHospitalCode}
        currentUser={currentUser}
        theme={theme}
        language={language}
        departments={departments}
        hospitalBranding={hospitalBranding}
      />
    </div>
  );
}
