/**
 * AuthModal.jsx
 * -------------
 * Modern Healthcare UI/UX Authentication Component.
 * Theme: Unified Medical Blue & Clean White (Clinical Healthcare System)
 *
 * Rules:
 * - Admin, Doctor & Staff accounts are created exclusively by Super Admin (they can ONLY sign in with assigned ID & password).
 * - Public Registration is strictly restricted to:
 *     1. Super Admin (hospital owner provisioning dedicated tenant)
 *     2. Patient (self-service queue & appointment access)
 * - All input fields start completely empty with zero pre-written text.
 */

import React, { useState, useEffect } from "react";
import { API_BASE } from "../../config/hospitalConfig";

export default function AuthModal({ authMode = "login", setAuthMode, onClose, onLoginSuccess, isInline = false }) {
  // Views: "login" | "signup-superadmin" | "signup-patient"
  const [currentMode, setCurrentMode] = useState(() => {
    if (authMode === "signup" || authMode === "signup-patient") return "signup-patient";
    if (authMode === "signup-superadmin") return "signup-superadmin";
    return "login";
  });

  // Login Form States (Always empty by default)
  const [loginMethod, setLoginMethod] = useState("email"); // "email" | "mobile"
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginRemainingAttempts, setLoginRemainingAttempts] = useState(null);

  // Registration Form States (Always empty by default)
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [hospitalName, setHospitalName] = useState("");

  // Mobile OTP States (Login)
  const [mobilePhone, setMobilePhone] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileName, setMobileName] = useState("");
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileOtpLoading, setMobileOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Signup Mobile Verification States (+91 default country code)
  const [signupMobile, setSignupMobile] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [signupOtpLoading, setSignupOtpLoading] = useState(false);
  const [signupOtpCountdown, setSignupOtpCountdown] = useState(0);
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [signupVerifying, setSignupVerifying] = useState(false);
  const [signupRemainingAttempts, setSignupRemainingAttempts] = useState(null);
  const [signupPhoneStatus, setSignupPhoneStatus] = useState("idle"); // "idle" | "checking" | "taken" | "available"
  const [phoneCheckMessage, setPhoneCheckMessage] = useState("");

  useEffect(() => {
    let timer = null;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [otpCountdown]);

  useEffect(() => {
    let timer = null;
    if (signupOtpCountdown > 0) {
      timer = setTimeout(() => setSignupOtpCountdown(signupOtpCountdown - 1), 1000);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [signupOtpCountdown]);


  // Multi-Hospital Tenant Selection
  const [hospitalsList, setHospitalsList] = useState([]);
  const [selectedHospitalCode, setSelectedHospitalCode] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const urlHosp = p.get("hospital") || p.get("tenant") || p.get("facility");
      if (urlHosp) return urlHosp;
      try {
        const saved = localStorage.getItem("ai_queue_current_hospital");
        if (saved) return saved;
      } catch (e) {}
    }
    return "city-hospital-01";
  });
  const [isUrlPreselected, setIsUrlPreselected] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return Boolean(p.get("hospital") || p.get("tenant") || p.get("facility"));
    }
    return false;
  });
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadHospitals = (attempt = 1) => {
      setHospitalsLoading(true);
      fetch(`${API_BASE}/api/v1/hospitals/public`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d.status === "success" && Array.isArray(d.hospitals) && d.hospitals.length > 0) {
            setHospitalsList(d.hospitals);
            const currentIsValid = d.hospitals.some((h) => h.hospital_code === selectedHospitalCode);
            if (!currentIsValid) {
              setSelectedHospitalCode(d.hospitals[0].hospital_code);
            }
          } else if (attempt < 3) {
            setTimeout(() => loadHospitals(attempt + 1), 1000 * attempt);
            return;
          }
          if (!cancelled) setHospitalsLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          console.error("Hospitals fetch error in AuthModal:", e);
          if (attempt < 3) {
            setTimeout(() => loadHospitals(attempt + 1), 1000 * attempt);
          } else {
            setHospitalsLoading(false);
          }
        });
    };
    loadHospitals();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedHospitalObj = hospitalsList.find(
    (h) => h.hospital_code === selectedHospitalCode
  ) || hospitalsList[0] || { name: "City General Hospital", hospital_code: "city-hospital-01" };

  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Real-time check if signup mobile number is already taken
  useEffect(() => {
    const cleanDigits = signupMobile.replace(/\D/g, "");
    if (cleanDigits.length !== 10) {
      setSignupPhoneStatus("idle");
      setPhoneCheckMessage("");
      return;
    }

    setSignupPhoneStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/check-phone?phone=${cleanDigits}`);
        const data = await res.json();
        if (data.exists) {
          setSignupPhoneStatus("taken");
          setPhoneCheckMessage("This mobile number is already registered. Please sign in or use another number.");
          setErrorMsg("This mobile number is already registered. Please sign in or use a different number.");
        } else {
          setSignupPhoneStatus("available");
          setPhoneCheckMessage("");
          setErrorMsg((prev) => (prev && prev.includes("mobile number is already registered") ? null : prev));
        }
      } catch (e) {
        setSignupPhoneStatus("idle");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [signupMobile]);

  const switchMode = (mode) => {
    setCurrentMode(mode);
    setErrorMsg(null);
    if (setAuthMode) setAuthMode(mode);
  };

  // 0. Submit Mobile OTP Handlers (Login: +91, 5-minute expiry, max 3 attempts)
  const handleSendMobileOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanDigits = mobilePhone.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile phone number.");
      return;
    }
    setErrorMsg(null);
    setMobileOtpLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/send-mobile-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: `+91${cleanDigits}`,
          hospital_code: selectedHospitalCode || "city-hospital-01",
        }),
      });
      const data = await res.json();
      setMobileOtpLoading(false);
      if (res.ok && data.status === "success") {
        setMobileOtpSent(true);
        setOtpCountdown(30);
        setLoginRemainingAttempts(null);
      } else {
        setErrorMsg(data.message || "Failed to send OTP to mobile. Please try again.");
      }
    } catch (err) {
      setMobileOtpLoading(false);
      setErrorMsg(`Connection error: ${err.message}`);
    }
  };

  const handleVerifyMobileOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanDigits = mobilePhone.replace(/\D/g, "");
    const cleanOtp = mobileOtp.trim();
    if (!cleanDigits || cleanDigits.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile phone number.");
      return;
    }
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code.");
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-mobile-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: `+91${cleanDigits}`,
          otp: cleanOtp,
          name: mobileName.trim() || undefined,
          hospital_code: selectedHospitalCode || "city-hospital-01",
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok && data.status === "success") {
        if (data.token) {
          try {
            localStorage.setItem("ai_queue_token", data.token);
          } catch (e) {}
        }
        if (data.user?.hospital_code || selectedHospitalCode) {
          try {
            localStorage.setItem("ai_queue_current_hospital", data.user?.hospital_code || selectedHospitalCode || "city-hospital-01");
          } catch (e) {}
        }
        onLoginSuccess(data.user);
      } else {
        if (data.remaining_attempts !== undefined) {
          setLoginRemainingAttempts(data.remaining_attempts);
        }
        setErrorMsg(data.message || data.detail || "Invalid or expired OTP. Please try again.");
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(`Server connection error: ${err.message}`);
    }
  };

  // Signup: Send Mobile OTP (+91 default country code)
  const handleSendSignupOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanDigits = signupMobile.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile phone number.");
      return;
    }
    if (signupPhoneStatus === "taken") {
      setErrorMsg("This mobile number is already registered. Please sign in or use a different number.");
      return;
    }
    setErrorMsg(null);
    setSignupOtpLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/send-mobile-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: `+91${cleanDigits}`,
          purpose: "signup",
          hospital_code: selectedHospitalCode || "city-hospital-01",
        }),
      });
      const data = await res.json();
      setSignupOtpLoading(false);

      if (res.ok && data.status === "success") {
        setSignupOtpSent(true);
        setSignupOtpCountdown(30);
        setSignupRemainingAttempts(null);
      } else {
        if (data.code === "PHONE_ALREADY_EXISTS" || data.message?.includes("already registered")) {
          setSignupPhoneStatus("taken");
        }
        setErrorMsg(data.message || "Failed to send verification code. Please try again.");
      }
    } catch (err) {
      setSignupOtpLoading(false);
      setErrorMsg(`Connection error: ${err.message}`);
    }
  };

  // Signup: Verify Mobile OTP before account creation
  const handleVerifySignupOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanDigits = signupMobile.replace(/\D/g, "");
    const cleanOtp = signupOtp.trim();

    if (!cleanDigits || cleanDigits.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile phone number.");
      return;
    }
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code.");
      return;
    }

    setErrorMsg(null);
    setSignupVerifying(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-mobile-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: `+91${cleanDigits}`,
          otp: cleanOtp,
          action: "verify_only",
          purpose: "signup",
        }),
      });
      const data = await res.json();
      setSignupVerifying(false);

      if (res.ok && data.status === "success") {
        setIsMobileVerified(true);
        setRegPhone(`+91${cleanDigits}`);
        setSignupRemainingAttempts(null);
      } else {
        if (data.code === "PHONE_ALREADY_EXISTS" || data.message?.includes("already registered")) {
          setSignupPhoneStatus("taken");
        }
        if (data.remaining_attempts !== undefined) {
          setSignupRemainingAttempts(data.remaining_attempts);
        }
        setErrorMsg(data.message || "Invalid or expired OTP. Please try again.");
      }
    } catch (err) {
      setSignupVerifying(false);
      setErrorMsg(`Connection error: ${err.message}`);
    }
  };

  // 1. Submit Unified Login (Supports Email OR Assigned ID: DOC-1024, STF-201, ADM-001, etc.)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginIdentifier.trim(), password: loginPassword }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.status === "success") {
        if (data.token) {
          try {
            localStorage.setItem("ai_queue_token", data.token);
          } catch (e) {}
        }
        if (data.user?.hospital_code) {
          try {
            localStorage.setItem("ai_queue_current_hospital", data.user.hospital_code);
          } catch (e) {}
        }
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.detail || "Authentication failed. Please check your credentials.");
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(`Server connection error: ${err.message}`);
    }
  };

  // 2. Submit Registration (Super Admin OR Patient Only)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (currentMode === "signup-patient" && !isMobileVerified) {
      setErrorMsg("Please verify your mobile number via OTP before creating your account.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    let endpoint = "/api/v1/auth/signup/patient";
    const cleanPhoneDigits = (signupMobile || regPhone).replace(/\D/g, "").slice(-10);
    let payload = {
      username: fullName.trim(),
      email: regEmail.trim(),
      password: regPassword,
      phone: cleanPhoneDigits ? `+91${cleanPhoneDigits}` : regPhone.trim(),
    };

    if (currentMode === "signup-superadmin") {
      endpoint = "/api/v1/auth/signup/superadmin";
      payload.hospital_name = hospitalName.trim() || `${fullName.trim()}'s Medical Center`;
    } else {
      payload.hospital_code = selectedHospitalCode || "city-hospital-01";
      if (signupOtp) {
        payload.mobile_otp = signupOtp.trim();
      }
      payload.mobile_verified = isMobileVerified;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.status === "success") {
        if (data.token) {
          try {
            localStorage.setItem("ai_queue_token", data.token);
          } catch (e) {}
        }
        if (payload.hospital_code) {
          try {
            localStorage.setItem("ai_queue_current_hospital", payload.hospital_code);
          } catch (e) {}
        }
      } else {
        if (data.code === "PHONE_ALREADY_EXISTS" || data.message?.includes("already exists") || data.message?.includes("already registered")) {
          setSignupPhoneStatus("taken");
        }
        setErrorMsg(data.message || data.detail || "Registration failed. Please try again.");
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(`Server connection error: ${err.message}`);
    }
  };

  const modalBody = (
    <div className="auth-modal-card" style={isInline ? { width: "100%", textAlign: "left" } : modalCardStyle}>
      <style>{`
        .auth-modal-row-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 520px) {
          .auth-modal-row-2col {
            grid-template-columns: 1fr !important;
          }
        }
        body.theme-dark .auth-modal-card {
          background: #0F172A !important;
          border-color: #1E293B !important;
          color: #F8FAFC !important;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8) !important;
        }
        body.theme-dark .auth-modal-card h2 {
          color: #F8FAFC !important;
        }
        body.theme-dark .auth-modal-card label {
          color: #CBD5E1 !important;
        }
        body.theme-dark .auth-modal-card input,
        body.theme-dark .auth-modal-card select {
          background: #1E293B !important;
          border-color: #334155 !important;
          color: #F8FAFC !important;
        }
      `}</style>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={authIconShieldStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", color: "#064E3B", fontWeight: 800, letterSpacing: "-0.3px" }}>
              {currentMode === "login" || currentMode === "login-mobile"
                ? "Sign In"
                : currentMode === "signup-superadmin"
                ? "Register as Super Admin"
                : "Register as Patient"}
            </h2>
            <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500 }}>
              {currentMode === "login" || currentMode === "login-mobile"
                ? (loginMethod === "mobile" ? "Sign in with Mobile OTP & retrospective walk-in sync" : "Sign in with your Email or Assigned ID")
                : currentMode === "signup-superadmin"
                ? "Hospital Owner & Network Administrator Account"
                : "Patient Self-Service Account"}
            </span>
          </div>
        </div>

        {!isInline && onClose && (
          <button onClick={onClose} style={modalCloseBtnStyle} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* VIEW 1: UNIFIED LOGIN (Email + Password OR Mobile + OTP) */}
      {(currentMode === "login" || currentMode === "login-mobile") && (
        <>
          {/* Login Method Tab Selector: Email vs Mobile OTP */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            padding: "4px",
            background: "#F1F5F9",
            borderRadius: "12px",
            marginBottom: "16px",
          }}>
            <button
              type="button"
              onClick={() => { setLoginMethod("email"); setErrorMsg(null); }}
              style={{
                padding: "8px 12px",
                borderRadius: "9px",
                border: "none",
                background: loginMethod === "email" ? "#FFFFFF" : "transparent",
                color: loginMethod === "email" ? "#0369A1" : "#64748B",
                fontWeight: 700,
                fontSize: "12.5px",
                cursor: "pointer",
                boxShadow: loginMethod === "email" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.18s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
              }}
            >
              <span>✉️</span>
              <span>Email + Password</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("mobile"); setErrorMsg(null); }}
              style={{
                padding: "8px 12px",
                borderRadius: "9px",
                border: "none",
                background: loginMethod === "mobile" ? "#FFFFFF" : "transparent",
                color: loginMethod === "mobile" ? "#0369A1" : "#64748B",
                fontWeight: 700,
                fontSize: "12.5px",
                cursor: "pointer",
                boxShadow: loginMethod === "mobile" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.18s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
              }}
            >
              <span>📱</span>
              <span>Mobile + OTP</span>
            </button>
          </div>

          {/* Option A: Email + Password */}
          {loginMethod === "email" && (
            <form onSubmit={handleLoginSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={fieldLabelStyle}>Email / Assigned ID</label>
                <input
                  type="text"
                  placeholder="name@hospital.com or DOC-1024"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  required
                  style={fieldInputStyle}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={fieldLabelStyle}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    style={{ ...fieldInputStyle, paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={passwordToggleBtnStyle}
                    tabIndex={-1}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "👁️" : "🔒"}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} style={modalSubmitBtnStyle}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Option B: Mobile + OTP */}
          {loginMethod === "mobile" && (
            <form onSubmit={handleVerifyMobileOtp}>

              {/* Mobile Phone Input with +91 Country Code */}
              <div style={{ marginBottom: "12px" }}>
                <label style={fieldLabelStyle}>Mobile Phone Number *</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "0 10px",
                    background: "#F1F5F9",
                    border: "1.5px solid #CBD5E1",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#0F172A",
                    flexShrink: 0,
                  }}>
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobilePhone}
                    onChange={(e) => setMobilePhone(e.target.value.replace(/\D/g, ""))}
                    required
                    disabled={mobileOtpSent && otpCountdown > 0}
                    style={{ ...fieldInputStyle, flex: 1 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSendMobileOtp}
                    disabled={mobileOtpLoading || (mobileOtpSent && otpCountdown > 0) || mobilePhone.length !== 10}
                    style={{
                      padding: "0 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: (mobileOtpSent && otpCountdown > 0) ? "#94A3B8" : "#0284C7",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: (mobileOtpSent && otpCountdown > 0) ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mobileOtpLoading
                      ? "Sending..."
                      : mobileOtpSent
                      ? (otpCountdown > 0 ? `Resend (${otpCountdown}s)` : "Resend OTP")
                      : "Send OTP"}
                  </button>
                </div>
              </div>

              {/* 6-Digit OTP Code Input */}
              {mobileOtpSent && (
                <>
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={fieldLabelStyle}>Enter 6-Digit OTP Code *</label>
                      <span style={{ fontSize: "11px", color: "#64748B" }}>
                        Valid 5 mins (Max 3 attempts)
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="••••••"
                      maxLength={6}
                      value={mobileOtp}
                      onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, ""))}
                      required
                      style={{ ...fieldInputStyle, fontSize: "18px", letterSpacing: "5px", textAlign: "center", fontWeight: 800 }}
                      autoFocus
                    />
                    {loginRemainingAttempts !== null && loginRemainingAttempts < 3 && (
                      <div style={{ fontSize: "11px", color: "#DC2626", fontWeight: 700, marginTop: "4px" }}>
                        {loginRemainingAttempts} attempt(s) remaining before OTP locks
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={loading || mobileOtp.length !== 6} style={modalSubmitBtnStyle}>
                    {loading ? "Verifying & Signing In..." : "Sign in with Mobile OTP"}
                  </button>
                </>
              )}

            </form>
          )}

          {/* Admin, Doctor & Staff Policy Notice */}
          <div style={noticeBoxStyle}>
            <span style={{ fontSize: "15px", flexShrink: 0, marginTop: "1px" }}>ℹ️</span>
            <div>
              <strong style={{ color: "#0369A1", fontSize: "12px" }}>Admin, Doctor & Staff accounts are created by a Super Admin.</strong>
              <div style={{ marginTop: "2px", color: "#0284C7", fontSize: "11.5px" }}>
                Sign in with your assigned ID & password.
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "20px 0 16px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
            <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>New here?</span>
            <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
          </div>

          {/* Registration Options: Strictly Super Admin and Patient ONLY */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              onClick={() => switchMode("signup-superadmin")}
              style={regOptionBtnStyle("#D97706", "#FFFBEB", "#FDE68A")}
            >
              <span style={{ fontSize: "18px" }}>👑</span>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "12.5px", color: "#92400E" }}>Register as Super Admin</div>
                <span style={{ fontSize: "11px", color: "#B45309" }}>Own and setup your dedicated hospital network</span>
              </div>
              <span style={{ fontSize: "14px", color: "#B45309", fontWeight: 700 }}>→</span>
            </button>

            <button
              type="button"
              onClick={() => switchMode("signup-patient")}
              style={regOptionBtnStyle("#0284C7", "#F0F9FF", "#BAE6FD")}
            >
              <span style={{ fontSize: "18px" }}>👤</span>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "12.5px", color: "#0369A1" }}>Register as Patient</div>
                <span style={{ fontSize: "11px", color: "#0284C7" }}>Mobile OTP verified patient account</span>
              </div>
              <span style={{ fontSize: "14px", color: "#0284C7", fontWeight: 700 }}>→</span>
            </button>
          </div>
        </>
      )}

      {/* VIEW 2: SUPER ADMIN REGISTRATION */}
      {currentMode === "signup-superadmin" && (
        <form onSubmit={handleRegisterSubmit}>
          <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "10px", background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: "11.5px", color: "#92400E", lineHeight: "1.5" }}>
            👑 <strong>Super Admin Ownership:</strong> You will be the owner of your hospital tenant with dedicated access to its doctors, staff, desks, queues, and analytics.
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={fieldLabelStyle}>Full Name *</label>
            <input
              type="text"
              placeholder="Dr. Alexander Wright"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={fieldInputStyle}
            />
          </div>

          <div className="auth-modal-row-2col" style={{ marginBottom: "12px" }}>
            <div>
              <label style={fieldLabelStyle}>Email Address *</label>
              <input
                type="email"
                placeholder="owner@hospital.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>Phone Number</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                style={fieldInputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={fieldLabelStyle}>Hospital / Facility Name *</label>
            <input
              type="text"
              placeholder="e.g. Apex Health Medical Center"
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              required
              style={fieldInputStyle}
            />
          </div>

          <div className="auth-modal-row-2col" style={{ marginBottom: "18px" }}>
            <div>
              <label style={fieldLabelStyle}>Password *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>Confirm Password *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                required
                style={fieldInputStyle}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} style={modalSubmitBtnStyle}>
            {loading ? "Creating Super Admin Account..." : "Create Super Admin & Hospital"}
          </button>

          <button
            type="button"
            onClick={() => switchMode("login")}
            style={backLinkBtnStyle}
          >
            ← Back to Sign In
          </button>
        </form>
      )}

      {/* VIEW 3: PATIENT REGISTRATION */}
      {currentMode === "signup-patient" && (
        <form onSubmit={handleRegisterSubmit}>
          {/* Hospital Selection / Pre-selection */}
          <div style={{ marginBottom: "14px" }}>
            {isUrlPreselected && !showCustomPicker ? (
              <div
                style={{
                  background: "#F0F9FF",
                  border: "1.5px solid #BAE6FD",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span style={{ fontSize: "18px" }}>🏥</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "9.5px", fontWeight: 700, textTransform: "uppercase", color: "#0369A1" }}>
                      Direct Link / QR Facility
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0284C7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedHospitalObj?.name || "Selected Hospital"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomPicker(true)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #BAE6FD",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0369A1",
                    cursor: "pointer",
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={fieldLabelStyle}>Select Hospital / Facility *</label>
                  {isUrlPreselected && (
                    <button
                      type="button"
                      onClick={() => setShowCustomPicker(false)}
                      style={{ background: "none", border: "none", color: "#0284C7", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      Revert
                    </button>
                  )}
                </div>
                <select
                  value={selectedHospitalCode}
                  onChange={(e) => {
                    setSelectedHospitalCode(e.target.value);
                    try {
                      localStorage.setItem("ai_queue_current_hospital", e.target.value);
                    } catch (err) {}
                  }}
                  required
                  style={{
                    ...fieldInputStyle,
                    cursor: "pointer",
                    background: "#FFFFFF",
                    fontWeight: 600,
                    color: "#0F172A",
                  }}
                >
                  {hospitalsLoading && hospitalsList.length === 0 && (
                    <option value="" disabled>Loading hospitals…</option>
                  )}
                  {!hospitalsLoading && hospitalsList.length === 0 && (
                    <option value="city-hospital-01">City General Hospital (Default)</option>
                  )}
                  {hospitalsList.map((h) => (
                    <option key={h.hospital_code} value={h.hospital_code}>
                      {h.name} {h.address ? `• ${h.address}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={fieldLabelStyle}>Full Name *</label>
            <input
              type="text"
              placeholder="Rahul Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={fieldInputStyle}
            />
          </div>

          {/* Mobile Number with OTP Verification (+91 default country code) */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={fieldLabelStyle}>Mobile Phone Number (OTP Verification) *</label>
              {isMobileVerified && (
                <span style={{ fontSize: "11px", color: "#10B981", fontWeight: 700 }}>
                  ✓ Verified
                </span>
              )}
            </div>

            {isMobileVerified ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "#ECFDF5",
                border: "1.5px solid #10B981",
                borderRadius: "10px",
                color: "#065F46",
                fontWeight: 700,
                fontSize: "13px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>✓</span>
                  <span>+91 {signupMobile}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileVerified(false);
                    setSignupOtpSent(false);
                    setSignupOtp("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0284C7",
                    fontSize: "11px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontWeight: 600,
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "0 10px",
                    background: "#F1F5F9",
                    border: "1.5px solid #CBD5E1",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#0F172A",
                    flexShrink: 0,
                  }}>
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={signupMobile}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "");
                      setSignupMobile(d);
                      setRegPhone("+91" + d);
                    }}
                    disabled={signupOtpSent && signupOtpCountdown > 0 && !isMobileVerified}
                    style={{
                      ...fieldInputStyle,
                      flex: 1,
                      borderColor: signupPhoneStatus === "taken" ? "#EF4444" : fieldInputStyle.borderColor,
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSendSignupOtp}
                    disabled={signupOtpLoading || (signupOtpSent && signupOtpCountdown > 0) || signupMobile.length !== 10 || signupPhoneStatus === "taken"}
                    style={{
                      padding: "0 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: (signupOtpSent && signupOtpCountdown > 0) || signupPhoneStatus === "taken" ? "#94A3B8" : "#0284C7",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: (signupOtpSent && signupOtpCountdown > 0) || signupPhoneStatus === "taken" ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {signupOtpLoading
                      ? "Sending..."
                      : signupOtpSent
                      ? (signupOtpCountdown > 0 ? `Resend (${signupOtpCountdown}s)` : "Resend OTP")
                      : "Send OTP"}
                  </button>
                </div>

                {signupPhoneStatus === "taken" && (
                  <div style={{
                    marginTop: "8px",
                    padding: "8px 12px",
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    color: "#B91C1C",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                  }}>
                    <span style={{ fontWeight: 600 }}>⚠️ This mobile number is already registered.</span>
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#DC2626",
                        fontWeight: 800,
                        textDecoration: "underline",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "11.5px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Sign In →
                    </button>
                  </div>
                )}

                {signupOtpSent && !isMobileVerified && (
                  <div style={{
                    marginTop: "10px",
                    padding: "10px 12px",
                    background: "#F8FAFC",
                    border: "1.5px dashed #0284C7",
                    borderRadius: "10px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#0369A1" }}>
                        Enter 6-Digit SMS Code
                      </span>
                      <span style={{ fontSize: "10.5px", color: "#64748B" }}>
                        Valid 5 mins (Max 3 attempts)
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="••••••"
                        value={signupOtp}
                        onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, ""))}
                        style={{
                          ...fieldInputStyle,
                          flex: 1,
                          fontSize: "16px",
                          letterSpacing: "4px",
                          textAlign: "center",
                          fontWeight: 800,
                          background: "#FFFFFF",
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleVerifySignupOtp}
                        disabled={signupVerifying || signupOtp.length !== 6}
                        style={{
                          padding: "0 14px",
                          borderRadius: "10px",
                          border: "none",
                          background: signupOtp.length === 6 ? "#10B981" : "#94A3B8",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: signupOtp.length === 6 ? "pointer" : "not-allowed",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {signupVerifying ? "Verifying..." : "Verify Mobile"}
                      </button>
                    </div>
                    {signupRemainingAttempts !== null && signupRemainingAttempts < 3 && (
                      <div style={{ fontSize: "11px", color: "#DC2626", fontWeight: 700, marginTop: "4px" }}>
                        {signupRemainingAttempts} attempt(s) remaining before OTP locks
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={fieldLabelStyle}>Email Address *</label>
            <input
              type="email"
              placeholder="patient@example.com"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
              style={fieldInputStyle}
            />
          </div>

          <div className="auth-modal-row-2col" style={{ marginBottom: "18px" }}>
            <div>
              <label style={fieldLabelStyle}>Password *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>Confirm Password *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                required
                style={fieldInputStyle}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} style={modalSubmitBtnStyle}>
            {loading ? "Creating Patient Account..." : "Register Patient Account"}
          </button>

          <button
            type="button"
            onClick={() => switchMode("login")}
            style={backLinkBtnStyle}
          >
            ← Back to Sign In
          </button>
        </form>
      )}

      {/* Error Message Alert */}
      {errorMsg && (
        <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "10px", background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}
    </div>
  );

  if (isInline) {
    return modalBody;
  }

  return (
    <div style={modalBackdropStyle}>
      {modalBody}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLING CONSTANTS — Medical Blue & Pure White Clinical Theme
// ─────────────────────────────────────────────────────────────

const authIconShieldStyle = {
  width: "38px",
  height: "38px",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 3px 10px rgba(2, 132, 199, 0.3)",
  flexShrink: 0,
};

const modalBackdropStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
  padding: "16px",
  boxSizing: "border-box",
};

const modalCardStyle = {
  width: "100%",
  maxWidth: "460px",
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: "20px",
  padding: "26px 28px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.12)",
  maxHeight: "92vh",
  overflowY: "auto",
};

const modalCloseBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#64748B",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px",
};

const fieldLabelStyle = {
  display: "block",
  fontSize: "12.5px",
  color: "#334155",
  marginBottom: "6px",
  fontWeight: 700,
};

const fieldInputStyle = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: "10px",
  border: "1.5px solid #CBD5E1",
  background: "#F8FAFC",
  color: "#0F172A",
  fontSize: "13.5px",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

const passwordToggleBtnStyle = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
  padding: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalSubmitBtnStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
  color: "#ffffff",
  fontWeight: 800,
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.28)",
  transition: "all 0.15s ease",
};

const noticeBoxStyle = {
  marginTop: "16px",
  padding: "11px 14px",
  borderRadius: "10px",
  background: "#F0F9FF",
  border: "1px solid #BAE6FD",
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
};

const regOptionBtnStyle = (color, bg, border) => ({
  width: "100%",
  padding: "11px 14px",
  borderRadius: "12px",
  border: `1.5px solid ${border}`,
  background: bg,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  transition: "all 0.15s ease",
});

const backLinkBtnStyle = {
  width: "100%",
  marginTop: "12px",
  padding: "8px",
  background: "transparent",
  border: "none",
  color: "#0284C7",
  fontSize: "12.5px",
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "center",
};
