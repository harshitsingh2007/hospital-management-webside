/**
 * AccessDeniedGuard.jsx
 * ---------------------
 * Access Protection Shield for Restricted Role Pages.
 * Theme: Medical Ocean Blue & Slate (Clean Professional Palette)
 */

import React, { useState } from "react";
import { API_BASE } from "../../config/hospitalConfig";
import { t } from "../../utils/i18n";

export default function AccessDeniedGuard({ requiredRole, pageName, currentUser, onLoginSuccess, navigateTo, language = "en" }) {
  const isSuperAdminTarget = requiredRole === "super_admin" || requiredRole === "superadmin";
  const isDoctorTarget = requiredRole === "doctor" || requiredRole === "physician";
  const isStaffTarget = requiredRole === "admin" || requiredRole === "staff";
  const isTargetingAdmin = isSuperAdminTarget || isStaffTarget || isDoctorTarget;

  return (
    <div style={{ maxWidth: "550px", margin: "40px auto", textAlign: "center" }}>
      <div style={standaloneCardStyle}>
        <div style={shieldIconCircleStyle}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h2 style={{ margin: "0 0 10px 0", color: "#0F172A", fontSize: "22px", fontWeight: 800 }}>
          {isSuperAdminTarget
            ? (language === "hi" ? "सुपर एडमिन प्रमाणीकरण आवश्यक" : "Super Admin Access Required")
            : (isDoctorTarget
              ? (language === "hi" ? "डॉक्टर प्रमाणीकरण आवश्यक" : "Doctor Authentication Required")
              : (isStaffTarget
                ? (language === "hi" ? "स्टाफ रिसेप्शन डेस्क प्रमाणीकरण आवश्यक" : "Staff Reception Desk Required")
                : (language === "hi" ? "प्रतिबंधित पहुंच" : "Restricted Access")))}
        </h2>
        <p style={{ color: "#475569", fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
          {isTargetingAdmin ? (
            <>
              {language === "hi"
                ? <><strong>{pageName}</strong> तक पहुंचने के लिए कृपया अधिकृत क्रेडेंशियल्स से साइन इन करें।</>
                : <>The <strong>{pageName}</strong> requires verified administrative permissions. Please authenticate below.</>}
            </>
          ) : (
            <>
              {language === "hi"
                ? "आप वर्तमान में प्रशासनिक खाते से लॉगिन हैं। मरीज पोर्टल केवल मरीजों के लिए है।"
                : "You are currently logged in as Staff/Admin. Patient self-service is dedicated for patient profiles."}
            </>
          )}
        </p>

        {currentUser && (
          <div style={{ padding: "14px", borderRadius: "12px", background: "#F0F9FF", border: "1px solid #BAE6FD", marginBottom: "20px", textAlign: "left" }}>
            <p style={{ margin: 0, color: "#0369A1", fontSize: "12.5px", fontWeight: 600 }}>
              {language === "hi" ? "वर्तमान उपयोगकर्ता" : "Current Account"}: <strong style={{ color: "#0F172A" }}>{currentUser.username} ({currentUser.email})</strong>
            </p>
            <p style={{ margin: "4px 0 0 0", color: "#64748B", fontSize: "11.5px" }}>
              {language === "hi" ? "भूमिका" : "Active Role"}: <span style={{ color: "#0284C7", fontWeight: 800, textTransform: "uppercase" }}>{currentUser.role}</span>
            </p>
          </div>
        )}

        {isTargetingAdmin ? (
          <AuthModalInline onLoginSuccess={onLoginSuccess} defaultRole={requiredRole} language={language} />
        ) : (
          <button
            onClick={() => {
              const r = (currentUser?.role || "").toLowerCase();
              if (r === "super_admin" || r === "superadmin") {
                navigateTo("superadmin");
              } else if (r === "doctor" || r === "physician") {
                navigateTo("doctor");
              } else if (["staff", "receptionist", "nurse"].includes(r)) {
                navigateTo("staff");
              } else {
                navigateTo("patient", "walkin");
              }
            }}
            style={primaryBtnStyle}
          >
            {(() => {
              const r = (currentUser?.role || "").toLowerCase();
              if (r === "super_admin" || r === "superadmin") {
                return language === "hi" ? "सुपर एडमिन पोर्टल पर जाएं" : "Go to Super Admin Portal";
              }
              if (r === "doctor" || r === "physician") {
                return language === "hi" ? "डॉक्टर परामर्श डेस्क पर जाएं" : "Go to Doctor Consult Desk";
              }
              if (["staff", "receptionist", "nurse"].includes(r)) {
                return language === "hi" ? "स्टाफ रिसेप्शन डेस्क पर जाएं" : "Go to Staff Reception Desk";
              }
              return language === "hi" ? "रोगी पोर्टल पर वापस जाएं" : "Return to Patient Portal";
            })()}
          </button>
        )}
      </div>
    </div>
  );
}

function AuthModalInline({ onLoginSuccess, defaultRole, language = "en" }) {
  const [identifier, setIdentifier] = useState(defaultRole === "super_admin" || defaultRole === "superadmin" ? "superadmin@hospital.com" : "");
  const [password, setPassword] = useState(defaultRole === "super_admin" || defaultRole === "superadmin" ? "admin123" : "");
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier.trim(), password }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.status === "success") {
        if (!["admin", "doctor", "staff", "super_admin", "superadmin", "receptionist"].includes(data.user.role)) {
          setErrorMsg("Login failed: Account does not have administrative permissions.");
          return;
        }
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.detail || "Invalid credentials.");
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(`Server error: ${err.message}`);
    }
  };

  return (
    <div style={{ textAlign: "left", background: "#F8FAFC", padding: "20px", borderRadius: "14px", border: "1px solid #E2E8F0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <h4 style={{ margin: 0, color: "#0F172A", fontSize: "14px", fontWeight: 800 }}>
          {language === "hi" ? "एडमिन साइन इन" : "Administrative Sign In"}:
        </h4>
        <button
          type="button"
          onClick={() => {
            setIdentifier("superadmin@hospital.com");
            setPassword("admin123");
          }}
          style={{
            padding: "4px 8px",
            borderRadius: "6px",
            background: "#E0F2FE",
            border: "1px solid #BAE6FD",
            color: "#0369A1",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {language === "hi" ? "⚡ सुपर एडमिन ऑटो-फिल" : "⚡ Fill Super Admin"}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label style={fieldLabelStyle}>{language === "hi" ? "ईमेल / असाइन आईडी" : "Email / Assigned ID"}</label>
          <input
            type="text"
            placeholder="superadmin@hospital.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            style={fieldInputStyle}
          />
        </div>
        <div style={{ marginBottom: "14px" }}>
          <label style={fieldLabelStyle}>{language === "hi" ? "पासवर्ड" : "Password"}</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={fieldInputStyle}
          />
        </div>
        <button type="submit" disabled={loading} style={primaryBtnStyle}>
          {loading ? (language === "hi" ? "प्रमाणीकरण हो रहा है..." : "Authenticating...") : (language === "hi" ? "प्रवेश करें →" : "Sign In & Unlock →")}
        </button>
      </form>
      {errorMsg && <p style={{ color: "#DC2626", fontSize: "12px", marginTop: "10px", margin: 0, fontWeight: 600 }}>{errorMsg}</p>}
    </div>
  );
}

const standaloneCardStyle = {
  background: "#FFFFFF",
  borderRadius: "20px",
  border: "1.5px solid #E2E8F0",
  padding: "32px",
  boxShadow: "0 10px 30px -5px rgba(2, 132, 199, 0.08)",
};

const shieldIconCircleStyle = {
  width: "64px",
  height: "64px",
  borderRadius: "50%",
  background: "#F0F9FF",
  border: "1.5px solid #BAE6FD",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "18px",
};

const fieldLabelStyle = { display: "block", fontSize: "12px", color: "#475569", marginBottom: "6px", fontWeight: 700 };

const fieldInputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  color: "#0F172A",
  fontSize: "13px",
  boxSizing: "border-box",
  outline: "none",
};

const primaryBtnStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
  color: "#ffffff",
  fontWeight: 800,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)",
};
