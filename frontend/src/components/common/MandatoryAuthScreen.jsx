
import React, { useState, useEffect } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../../config/hospitalConfig";

export default function MandatoryAuthScreen({
  onLoginSuccess,
  language = "en",
  setLanguage,
  navigateTo,
  initialMode,
}) {
  // Views: "login" | "signup-patient" | "signup-superadmin"
  const [authMode, setAuthMode] = useState(() => {
    if (initialMode) return initialMode;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const m = p.get("mode") || p.get("auth") || p.get("view") || p.get("page") || p.get("tab");
      if (m) {
        const ml = m.toLowerCase();
        if (ml.includes("super") || ml.includes("admin")) return "signup-superadmin";
        if (ml.includes("reg") || ml.includes("sign") || ml.includes("join") || ml.includes("create")) return "signup-patient";
      }
      const hash = (window.location.hash || "").toLowerCase();
      if (hash.includes("reg") || hash.includes("sign")) return "signup-patient";
      const path = (window.location.pathname || "").toLowerCase();
      if (path.includes("reg") || path.includes("sign")) return "signup-patient";
    }
    return "login";
  });

  // Login Form States
  const [loginMethod, setLoginMethod] = useState("email"); // "email" | "mobile"
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Mobile + OTP Login States
  const [loginPhone, setLoginPhone] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginOtpLoading, setLoginOtpLoading] = useState(false);
  const [loginOtpCountdown, setLoginOtpCountdown] = useState(0);
  const [loginRemainingAttempts, setLoginRemainingAttempts] = useState(null);

  // Registration Form States
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [hospitalName, setHospitalName] = useState("");

  const [signupMobile, setSignupMobile] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [signupOtpLoading, setSignupOtpLoading] = useState(false);
  const [signupOtpCountdown, setSignupOtpCountdown] = useState(0);
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [signupVerifying, setSignupVerifying] = useState(false);
  const [signupRemainingAttempts, setSignupRemainingAttempts] = useState(null);
  const [signupPhoneStatus, setSignupPhoneStatus] = useState("idle"); // "idle" | "checking" | "taken" | "available"

  // Multi-Hospital Tenant Selection & URL / QR Pre-selection States
  const [hospitalsList, setHospitalsList] = useState([]);
  const [selectedHospitalCode, setSelectedHospitalCode] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const urlHosp = p.get("hospital") || p.get("tenant") || p.get("facility");
      if (urlHosp) return urlHosp;
      try {
        const saved = localStorage.getItem("ai_queue_current_hospital");
        if (saved) return saved;
      } catch (e) { }
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
  const [showCustomHospitalPicker, setShowCustomHospitalPicker] = useState(false);
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
            // Always update the selected code to the first hospital if the current
            // selection isn't in the returned list (e.g. the default fallback code)
            const currentIsValid = d.hospitals.some((h) => h.hospital_code === selectedHospitalCode);
            if (!currentIsValid) {
              setSelectedHospitalCode(d.hospitals[0].hospital_code);
            }
          } else if (attempt < 3) {
            // Retry up to 3 times on empty/bad response
            setTimeout(() => loadHospitals(attempt + 1), 1000 * attempt);
            return;
          }
          if (!cancelled) setHospitalsLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          console.error("Hospitals fetch error:", e);
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
  ) || hospitalsList[0] || { name: "Hex Visionaries", hospital_code: "city-hospital-01" };

  useEffect(() => {
    document.title = authMode.startsWith("signup") ? "Signup" : "Login";
  }, [authMode]);

  // Modal Dialog States
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Forgot Password Multi-Step State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP & New Pwd, 3: Success
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);

  // Real-Time Registration States (Email check, OTP verification step, Password strength)
  const [regStep, setRegStep] = useState("form"); // "form" | "otp"
  const [regOtp, setRegOtp] = useState("");
  const [emailCheckStatus, setEmailCheckStatus] = useState("idle"); // "idle" | "checking" | "available" | "taken"
  const [resendCountdown, setResendCountdown] = useState(0);

  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const isHindi = language === "hi";

  // Real-time check if signup mobile number is already taken
  useEffect(() => {
    const cleanDigits = signupMobile.replace(/\D/g, "");
    if (cleanDigits.length !== 10) {
      setSignupPhoneStatus("idle");
      return;
    }

    setSignupPhoneStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/check-phone?phone=${cleanDigits}`);
        const data = await res.json();
        if (data.exists) {
          setSignupPhoneStatus("taken");
          setErrorMsg(isHindi ? "यह मोबाइल नंबर पहले से पंजीकृत है। कृपया लॉगिन करें या दूसरा नंबर दर्ज करें।" : "This mobile number is already registered. Please sign in or use a different number.");
        } else {
          setSignupPhoneStatus("available");
          setErrorMsg((prev) => (prev && (prev.includes("mobile number is already registered") || prev.includes("यह मोबाइल नंबर पहले से पंजीकृत है")) ? null : prev));
        }
      } catch (e) {
        setSignupPhoneStatus("idle");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [signupMobile, isHindi]);

  // Debounced real-time email availability checker
  useEffect(() => {
    const clean = regEmail.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setEmailCheckStatus("idle");
      return;
    }
    setEmailCheckStatus("checking");
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/v1/auth/check-email?email=${encodeURIComponent(clean)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status === "success") {
            setEmailCheckStatus(d.exists ? "taken" : "available");
          } else {
            setEmailCheckStatus("idle");
          }
        })
        .catch(() => setEmailCheckStatus("idle"));
    }, 400);

    return () => clearTimeout(timer);
  }, [regEmail]);

  // Resend Countdown Timer for OTP
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // 30-Second Countdown Timer for Login Mobile OTP
  useEffect(() => {
    if (loginOtpCountdown <= 0) return;
    const interval = setInterval(() => {
      setLoginOtpCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [loginOtpCountdown]);

  // 30-Second Countdown Timer for Signup Mobile OTP
  useEffect(() => {
    if (signupOtpCountdown <= 0) return;
    const interval = setInterval(() => {
      setSignupOtpCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [signupOtpCountdown]);


  // Calculate password strength
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "", color: "#E2E8F0" };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: isHindi ? "कमज़ोर" : "Weak", color: "#EF4444" };
    if (score <= 2) return { score: 2, label: isHindi ? "मध्यम" : "Fair", color: "#F59E0B" };
    if (score === 3) return { score: 3, label: isHindi ? "अच्छा" : "Good", color: "#3B82F6" };
    return { score: 4, label: isHindi ? "मजबूत" : "Strong", color: "#10B981" };
  };

  // Submit Unified Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginIdentifier.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.status === "success") {
        if (data.token) {
          try {
            localStorage.setItem("ai_queue_token", data.token);
          } catch (e) { }
        }
        if (data.user?.hospital_code) {
          try {
            localStorage.setItem("ai_queue_current_hospital", data.user.hospital_code);
          } catch (e) { }
        }
        if (onLoginSuccess) onLoginSuccess(data.user);
      } else {
        setErrorMsg(
          data.detail ||
          data.message ||
          (isHindi
            ? "प्रमाणीकरण विफल रहा। कृपया अपने क्रेडेंशियल्स जांचें।"
            : "Unable to sign in. The email or password you entered is incorrect.")
        );
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(
        isHindi
          ? `सर्वर कनेक्शन त्रुटि: ${err.message}`
          : `Server connection error: ${err.message}`
      );
    }
  };

  // Mobile + OTP Login: Send OTP
  const handleSendLoginOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanDigits = loginPhone.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length !== 10) {
      setErrorMsg(isHindi ? "कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।" : "Please enter a valid 10-digit mobile phone number.");
      return;
    }
    setErrorMsg(null);
    setLoginOtpLoading(true);

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
      setLoginOtpLoading(false);

      if (res.ok && data.status === "success") {
        setLoginOtpSent(true);
        setLoginOtpCountdown(30);
        setLoginRemainingAttempts(null);
      } else {
        setErrorMsg(data.message || (isHindi ? "OTP भेजने में विफल। कृपया पुनः प्रयास करें।" : "Failed to send OTP to mobile. Please try again."));
      }
    } catch (err) {
      setLoginOtpLoading(false);
      setErrorMsg(isHindi ? `कनेक्शन त्रुटि: ${err.message}` : `Connection error: ${err.message}`);
    }
  };

  // Mobile + OTP Login: Verify OTP & Sign In
  const handleVerifyLoginOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanDigits = loginPhone.replace(/\D/g, "");
    const cleanOtp = loginOtp.trim();

    if (!cleanDigits || cleanDigits.length !== 10) {
      setErrorMsg(isHindi ? "कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।" : "Please enter a valid 10-digit mobile phone number.");
      return;
    }
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMsg(isHindi ? "कृपया 6-अंकीय सत्यापन कोड दर्ज करें।" : "Please enter the 6-digit verification code.");
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
        if (onLoginSuccess) onLoginSuccess(data.user);
      } else {
        if (data.remaining_attempts !== undefined) {
          setLoginRemainingAttempts(data.remaining_attempts);
        }
        setErrorMsg(data.message || (isHindi ? "अमान्य या समाप्त OTP।" : "Invalid or expired verification code. Please request a new OTP."));
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(isHindi ? `सर्वर कनेक्शन त्रुटि: ${err.message}` : `Server connection error: ${err.message}`);
    }
  };

  // Signup: Send Mobile OTP (+91 default country code)
  const handleSendSignupOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanDigits = signupMobile.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length !== 10) {
      setErrorMsg(isHindi ? "कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।" : "Please enter a valid 10-digit mobile phone number.");
      return;
    }
    if (signupPhoneStatus === "taken") {
      setErrorMsg(isHindi ? "यह मोबाइल नंबर पहले से पंजीकृत है। कृपया लॉगिन करें या दूसरा नंबर दर्ज करें।" : "This mobile number is already registered. Please sign in or use a different number.");
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
        setErrorMsg(data.message || (isHindi ? "मोबाइल OTP भेजने में विफल।" : "Failed to send verification code. Please try again."));
      }
    } catch (err) {
      setSignupOtpLoading(false);
      setErrorMsg(err.message);
    }
  };

  // Signup: Verify Mobile OTP before account creation
  const handleVerifySignupOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanDigits = signupMobile.replace(/\D/g, "");
    const cleanOtp = signupOtp.trim();

    if (!cleanDigits || cleanDigits.length !== 10) {
      setErrorMsg(isHindi ? "कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।" : "Please enter a valid 10-digit mobile phone number.");
      return;
    }
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMsg(isHindi ? "कृपया 6-अंकीय सत्यापन कोड दर्ज करें।" : "Please enter the 6-digit verification code.");
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
        setErrorMsg(data.message || (isHindi ? "अमान्य या समाप्त OTP।" : "Invalid or expired OTP. Please try again."));
      }
    } catch (err) {
      setSignupVerifying(false);
      setErrorMsg(err.message);
    }
  };

  // Request Sign-Up Email OTP Verification
  const handleRequestSignupOtp = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg(isHindi ? "कृपया अपना पूरा नाम दर्ज करें।" : "Please enter your full name.");
      return;
    }

    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setErrorMsg(isHindi ? "कृपया एक मान्य ईमेल पता दर्ज करें।" : "Please enter a valid email address.");
      return;
    }

    if (emailCheckStatus === "taken") {
      setErrorMsg(isHindi ? "यह ईमेल पहले से पंजीकृत है।" : "This email address is already registered. Please sign in.");
      return;
    }

    // Require mobile verification before patient account creation
    if (authMode === "signup-patient" && !isMobileVerified) {
      setErrorMsg(
        isHindi
          ? "खाता बनाने से पहले कृपया अपने मोबाइल नंबर को OTP से सत्यापित करें।"
          : "Please verify your mobile number with the OTP code before creating your account."
      );
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg(isHindi ? "पासवर्ड मेल नहीं खाते। कृपया पुनः दर्ज करें।" : "Passwords do not match. Please re-enter.");
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg(isHindi ? "पासवर्ड कम से कम 6 वर्णों का होना चाहिए।" : "Password must be at least 6 characters long.");
      return;
    }

    // For SuperAdmin, proceed directly without email OTP
    if (authMode === "signup-superadmin") {
      handleFinalRegister();
      return;
    }

    // For Patient, dispatch email verification OTP
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/send-verification-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim(),
          username: fullName.trim(),
          hospital_code: selectedHospitalObj?.hospital_code || selectedHospitalCode,
          hospital_name: selectedHospitalObj?.name,
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok && data.status === "success") {
        setRegStep("otp");
        setResendCountdown(60);
      } else {
        setErrorMsg(data.message || (isHindi ? "सत्यापन कोड भेजने में विफल।" : "Failed to send verification code."));
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(isHindi ? `सर्वर त्रुटि: ${err.message}` : `Server error: ${err.message}`);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/send-verification-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim(),
          username: fullName.trim(),
          hospital_code: selectedHospitalObj?.hospital_code || selectedHospitalCode,
          hospital_name: selectedHospitalObj?.name,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.status === "success") {
        setResendCountdown(60);
      } else {
        setErrorMsg(data.message || "Failed to resend code.");
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message);
    }
  };

  // Submit Final Registration (With verified OTP)
  const handleFinalRegister = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    let endpoint = "/api/v1/auth/signup/patient";
    const cleanPhoneDigits = (signupMobile || regPhone).replace(/\D/g, "").slice(-10);
    let payload = {
      username: fullName.trim(),
      email: regEmail.trim(),
      password: regPassword,
      phone: cleanPhoneDigits ? `+91${cleanPhoneDigits}` : regPhone.trim(),
    };

    if (authMode === "signup-superadmin") {
      endpoint = "/api/v1/auth/signup/superadmin";
      payload.hospital_name = hospitalName.trim() || `${fullName.trim()}'s Medical Center`;
    } else {
      payload.hospital_code = selectedHospitalCode || "city-hospital-01";
      if (regOtp) {
        payload.otp = regOtp.trim();
      }
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
          } catch (e) { }
        }
        if (payload.hospital_code) {
          try {
            localStorage.setItem("ai_queue_current_hospital", payload.hospital_code);
          } catch (e) { }
        }
        if (onLoginSuccess) onLoginSuccess(data.user);
      } else {
        if (data.code === "PHONE_ALREADY_EXISTS" || data.message?.includes("already exists") || data.message?.includes("already registered")) {
          setSignupPhoneStatus("taken");
        }
        setErrorMsg(
          data.message ||
          data.detail ||
          (isHindi ? "पंजीकरण विफल रहा। कृपया पुनः प्रयास करें।" : "Registration failed. Please try again.")
        );
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(isHindi ? `सर्वर कनेक्शन त्रुटि: ${err.message}` : `Server connection error: ${err.message}`);
    }
  };

  // Form submission dispatcher for registration
  const handleRegisterSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (regStep === "otp") {
      handleFinalRegister(e);
    } else {
      handleRequestSignupOtp(e);
    }
  };

  // Forgot Password: Step 1 - Send Reset Code
  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          hospital_code: selectedHospitalObj?.hospital_code || selectedHospitalCode,
          hospital_name: selectedHospitalObj?.name,
        }),
      });
      const data = await res.json();
      setForgotLoading(false);

      if (res.ok && data.status === "success") {
        setForgotStep(2);
      } else {
        setForgotError(data.message || "Failed to send reset instructions.");
      }
    } catch (err) {
      setForgotLoading(false);
      setForgotError(err.message);
    }
  };

  // Forgot Password: Step 2 - Verify Code & Save New Password
  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    setForgotError(null);

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError(isHindi ? "पासवर्ड मेल नहीं खाते।" : "Passwords do not match.");
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError(isHindi ? "पासवर्ड कम से कम 6 वर्णों का होना चाहिए।" : "Password must be at least 6 characters.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: forgotOtp.trim(),
          new_password: forgotNewPassword,
        }),
      });
      const data = await res.json();
      setForgotLoading(false);

      if (res.ok && data.status === "success") {
        setForgotStep(3);
      } else {
        setForgotError(data.message || (isHindi ? "पासवर्ड रीसेट विफल रहा।" : "Password reset failed. Invalid or expired code."));
      }
    } catch (err) {
      setForgotLoading(false);
      setForgotError(err.message);
    }
  };

  return (
    <div className="patient-login-page">
      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes floatMedium {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes ambientPulse {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.6; }
          50% { transform: scale(1.1) translate(20px, -15px); opacity: 0.85; }
        }
        @keyframes pulseDotLive {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }

        .patient-login-page {
          min-height: 100vh;
          width: 100%;
          max-width: 100%;
          background: #F8FAFC;
          color: #0F172A;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        /* Subtle grid background texture */
        .patient-grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(2, 132, 199, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(2, 132, 199, 0.04) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 0;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 70%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 70%, transparent 100%);
        }

        /* Ambient Glow Circles */
        .ambient-glow-1 {
          position: absolute;
          top: -10%;
          left: -5%;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(186, 230, 253, 0.7) 0%, rgba(224, 242, 254, 0.2) 60%, transparent 80%);
          filter: blur(80px);
          animation: ambientPulse 12s infinite ease-in-out;
          pointer-events: none;
          z-index: 0;
        }
        .ambient-glow-2 {
          position: absolute;
          bottom: 5%;
          right: -5%;
          width: 700px;
          height: 700px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(165, 243, 252, 0.6) 0%, rgba(207, 250, 254, 0.2) 60%, transparent 80%);
          filter: blur(90px);
          animation: ambientPulse 15s infinite ease-in-out reverse;
          pointer-events: none;
          z-index: 0;
        }
        .ambient-glow-3 {
          position: absolute;
          top: 40%;
          left: 45%;
          width: 450px;
          height: 450px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(224, 231, 255, 0.5) 0%, transparent 75%);
          filter: blur(70px);
          pointer-events: none;
          z-index: 0;
        }

        /* Top Header */
        .pl-header {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 12px 48px 0 48px;
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .pl-header-brand {
          display: none;
        }
        .pl-brand-icon {
          display: none;
        }
        .pl-nav-links {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .pl-nav-link {
          background: none;
          border: none;
          padding: 6px 12px;
          color: #475569;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.18s ease;
        }
        .pl-nav-link:hover {
          color: #0284C7;
          background: rgba(2, 132, 199, 0.06);
        }

        /* Hero & Content Layout */
        .pl-main-container {
          position: relative;
          z-index: 10;
          flex: 1;
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 56px;
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
          padding: 12px 48px 36px 48px;
          box-sizing: border-box;
          align-items: center;
        }

        /* Left Side: Hero & Login Form Card */
        .pl-left-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 540px;
        }

        .pl-hero-headline {
          font-size: 44px;
          line-height: 1.14;
          font-weight: 800;
          color: #0F172A;
          letter-spacing: -1.2px;
          margin: 0;
        }
        .pl-hero-accent {
          background: linear-gradient(135deg, #0284C7 0%, #06B6D4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
        }
        .pl-hero-desc {
          font-size: 15px;
          line-height: 1.55;
          color: #64748B;
          margin: 10px 0 0 0;
          font-weight: 500;
        }

        /* Glass Login Card */
        .pl-login-card {
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 24px;
          padding: 32px 34px;
          box-shadow: 
            0 24px 48px -12px rgba(15, 23, 42, 0.08),
            0 4px 16px -2px rgba(2, 132, 199, 0.04);
          position: relative;
        }

        .pl-card-title {
          font-size: 22px;
          font-weight: 800;
          color: #0F172A;
          margin: 0 0 4px 0;
          letter-spacing: -0.4px;
        }
        .pl-card-subtitle {
          font-size: 13.5px;
          color: #64748B;
          margin: 0 0 22px 0;
          font-weight: 500;
        }

        /* Input Controls */
        .pl-input-group {
          margin-bottom: 18px;
        }
        .pl-input-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 7px;
        }
        .pl-input-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #475569;
        }
        .pl-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .pl-input-icon {
          position: absolute;
          left: 14px;
          color: #94A3B8;
          display: flex;
          align-items: center;
          pointer-events: none;
        }
        .pl-text-input {
          width: 100%;
          height: 46px;
          background: #FFFFFF;
          border: 1.5px solid #E2E8F0;
          border-radius: 12px;
          padding: 0 16px 0 42px;
          font-size: 14px;
          color: #0F172A;
          font-weight: 500;
          outline: none;
          transition: all 0.18s ease;
          box-sizing: border-box;
          font-family: inherit;
        }
        .pl-text-input:focus {
          border-color: #0284C7;
          box-shadow: 0 0 0 3.5px rgba(2, 132, 199, 0.14);
          background: #FAFCFF;
        }
        .pl-text-input::placeholder {
          color: #94A3B8;
          font-weight: 400;
        }

        .pl-eye-btn {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #94A3B8;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          border-radius: 6px;
          transition: color 0.15s ease;
        }
        .pl-eye-btn:hover {
          color: #0284C7;
        }

        .pl-forgot-link {
          font-size: 12px;
          color: #0284C7;
          background: none;
          border: none;
          padding: 0;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
        }
        .pl-forgot-link:hover {
          text-decoration: underline;
        }

        /* Primary Action Button */
        .pl-primary-btn {
          width: 100%;
          height: 48px;
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
          color: #FFFFFF;
          border: none;
          border-radius: 12px;
          font-size: 14.5px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 8px 20px -4px rgba(2, 132, 199, 0.4);
          margin-top: 6px;
          font-family: inherit;
        }
        .pl-primary-btn:hover:not(:disabled) {
          transform: translateY(-1.5px);
          box-shadow: 0 12px 28px -4px rgba(2, 132, 199, 0.5);
          background: linear-gradient(135deg, #0369A1 0%, #0284C7 100%);
        }
        .pl-primary-btn:active:not(:disabled) {
          transform: translateY(0px);
        }
        .pl-primary-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Registration & Security Footer */
        .pl-register-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 18px;
          font-size: 13px;
          color: #64748B;
        }
        .pl-register-link {
          color: #0284C7;
          font-weight: 700;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
        }
        .pl-register-link:hover {
          text-decoration: underline;
        }

        .pl-security-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 18px;
          font-size: 11.5px;
          color: #64748B;
          font-weight: 600;
        }
        .pl-security-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10B981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
        }

        /* Quick Demo Roles Bar */
        .pl-demo-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 16px;
          margin-top: 18px;
          border-top: 1px solid #F1F5F9;
          flex-wrap: wrap;
        }
        .pl-demo-pill {
          padding: 4px 10px;
          border-radius: 8px;
          background: #F1F5F9;
          border: 1px solid #E2E8F0;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pl-demo-pill:hover {
          background: #E0F2FE;
          border-color: #BAE6FD;
          color: #0369A1;
        }

        /* Right Side: Healthcare Dashboard Visual Showcase */
        .pl-right-visual {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 520px;
        }
        .pl-dashboard-backing {
          position: relative;
          width: 100%;
          max-width: 520px;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.85) 0%, rgba(240, 249, 255, 0.75) 100%);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1.5px solid rgba(255, 255, 255, 0.95);
          border-radius: 32px;
          padding: 32px;
          box-shadow: 
            0 32px 64px -16px rgba(15, 23, 42, 0.1),
            0 8px 24px -4px rgba(2, 132, 199, 0.08);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Floating UI Preview Cards */
        .pl-preview-card {
          background: #FFFFFF;
          border-radius: 18px;
          padding: 18px 20px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.05);
          transition: all 0.25s ease;
        }
        .pl-preview-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 32px -4px rgba(2, 132, 199, 0.12);
          border-color: #BAE6FD;
        }

        .pl-card-floating-1 {
          animation: floatSlow 6s ease-in-out infinite;
        }
        .pl-card-floating-2 {
          animation: floatMedium 7s ease-in-out infinite 1s;
        }

        /* Footer */
        .pl-footer {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 48px;
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
          font-size: 12.5px;
          color: #94A3B8;
          border-top: 1px solid rgba(226, 232, 240, 0.7);
          box-sizing: border-box;
          flex-wrap: wrap;
          gap: 12px;
        }
        .pl-footer-links {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .pl-footer-link {
          color: #64748B;
          text-decoration: none;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          font-size: 12.5px;
        }
        .pl-footer-link:hover {
          color: #0284C7;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1100px) {
          .pl-main-container {
            grid-template-columns: 1fr;
            gap: 40px;
            padding: 20px 28px 40px 28px;
          }
          .pl-left-column {
            max-width: 100%;
          }
          .pl-right-visual {
            min-height: auto;
          }
          .pl-header {
            padding: 16px 28px;
          }
          .pl-footer {
            padding: 20px 28px;
          }
        }
        @media (max-width: 640px) {
          .pl-header {
            padding: 16px 20px;
          }
          .pl-nav-links {
            display: none;
          }
          .pl-main-container {
            padding: 12px 20px 32px 20px;
          }
          .pl-hero-headline {
            font-size: 32px;
          }
          .pl-login-card {
            padding: 24px 20px;
          }
          .pl-footer {
            padding: 16px 20px;
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      {/* Grid Pattern & Ambient Lighting */}
      <div className="patient-grid-bg" />
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      <div className="ambient-glow-3" />

      {/* ================================================================= */}
      {/* 1. MINIMAL PROFESSIONAL HEADER                                    */}
      {/* ================================================================= */}
      <header className="pl-header">
        {/* Right Nav Links */}
        <div className="pl-nav-links">

          <button type="button" onClick={() => setShowHelpModal(true)} className="pl-nav-link">
            {isHindi ? "सहायता केंद्र" : "Help Center"}
          </button>

          <button type="button" onClick={() => setShowSupportModal(true)} className="pl-nav-link">
            {isHindi ? "सहायता" : "Support"}
          </button>

          {/* Language Toggle */}
          {setLanguage && (
            <button
              type="button"
              onClick={() => setLanguage(isHindi ? "en" : "hi")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "10px",
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                fontSize: "12px",
                fontWeight: 700,
                color: "#0F172A",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{isHindi ? "हिंदी (HI)" : "English (EN)"}</span>
            </button>
          )}


        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. MAIN TWO-COLUMN HERO + LOGIN INTERFACE                          */}
      {/* ================================================================= */}
      <main className="pl-main-container">

        {/* LEFT COLUMN: HERO HEADLINE + LOGIN CARD */}
        <div className="pl-left-column">
          <div>
            <h1 className="pl-hero-headline">
              {isHindi ? (
                <>
                  आपकी स्वास्थ्य सेवा, <br />
                  <span className="pl-hero-accent">एक सुरक्षित स्थान पर।</span>
                </>
              ) : (
                <>
                  Your healthcare, <br />
                  <span className="pl-hero-accent">in one secure place.</span>
                </>
              )}
            </h1>
            <p className="pl-hero-desc">
              {isHindi
                ? "अपॉइंटमेंट एक्सेस करें, अपनी कतार प्रबंधित करें, और अपनी देखभाल से जुड़े रहें — सब कुछ एक सुरक्षित रोगी पोर्टल में।"
                : "Access appointments, manage your queue, and stay connected with your care — all in one secure patient portal."}
            </p>
          </div>

          {/* LOGIN CARD */}
          <div className="pl-login-card">

            {/* Top Card Title & Mode Indicator */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 className="pl-card-title">
                  {authMode === "login"
                    ? (isHindi ? "पुनः स्वागत है" : "Welcome back")
                    : (authMode === "signup-patient" ? (isHindi ? "रोगी खाता बनाएं" : "Create Patient Account") : (isHindi ? "अस्पताल मालिक पंजीकरण" : "Hospital Owner Registration"))}
                </h2>
                <p className="pl-card-subtitle">
                  {authMode === "login"
                    ? (isHindi ? "अपने रोगी खाते में साइन इन करें।" : "Sign in to your patient account.")
                    : (isHindi ? "डिजिटल कतार और अपॉइंटमेंट के लिए निःशुल्क पंजीकरण करें।" : "Fill details below to access instant queues and bookings.")}
                </p>
              </div>

              {/* Primary Mode Switcher Control */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "#F1F5F9",
                  padding: "4px",
                  borderRadius: "12px",
                  border: "1.5px solid #E2E8F0",
                  gap: "4px",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                <button
                  type="button"
                  id="tab-signin-btn"
                  onClick={() => { setAuthMode("login"); setRegStep("form"); setErrorMsg(null); }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: authMode === "login" ? "#FFFFFF" : "transparent",
                    color: authMode === "login" ? "#0F172A" : "#64748B",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: authMode === "login" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    display: "inline-block",
                    lineHeight: "1.2",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isHindi ? "साइन इन" : "Sign In"}
                </button>
                <button
                  type="button"
                  id="tab-register-btn"
                  onClick={() => { setAuthMode("signup-patient"); setRegStep("form"); setErrorMsg(null); }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0284C7",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(2, 132, 199, 0.35)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    display: "inline-block",
                    lineHeight: "1.2",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isHindi ? "पंजीकरण" : "Register"}
                </button>
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "18px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#991B1B",
                fontSize: "13px",
                fontWeight: 600
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ flex: 1 }}>{errorMsg}</span>
              </div>
            )}

            {/* ================= LOGIN FORM ================= */}
            {authMode === "login" && (
              <div>
                {/* Method Switcher Tabs: Email + Password vs Mobile + OTP */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  background: "#F1F5F9",
                  padding: "4px",
                  borderRadius: "14px",
                  marginBottom: "20px",
                  gap: "4px",
                }}>
                  <button
                    type="button"
                    onClick={() => { setLoginMethod("email"); setErrorMsg(null); }}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "none",
                      background: loginMethod === "email" ? "#FFFFFF" : "transparent",
                      color: loginMethod === "email" ? "#0369A1" : "#64748B",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      boxShadow: loginMethod === "email" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                      transition: "all 0.18s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <span>{isHindi ? "ईमेल + पासवर्ड" : "Email + Password"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setLoginMethod("mobile"); setErrorMsg(null); }}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "none",
                      background: loginMethod === "mobile" ? "#FFFFFF" : "transparent",
                      color: loginMethod === "mobile" ? "#0369A1" : "#64748B",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      boxShadow: loginMethod === "mobile" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                      transition: "all 0.18s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                    <span>{isHindi ? "मोबाइल + OTP" : "Mobile + OTP"}</span>
                  </button>
                </div>

                {/* Option A: Email + Password Login Flow */}
                {loginMethod === "email" && (
                  <form onSubmit={handleLoginSubmit}>
                    {/* Email or Patient ID */}
                    <div className="pl-input-group">
                      <div className="pl-input-label-row">
                        <label className="pl-input-label">
                          {isHindi ? "ईमेल या रोगी आईडी" : "EMAIL OR PATIENT ID"}
                        </label>
                      </div>
                      <div className="pl-input-wrapper">
                        <span className="pl-input-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          className="pl-text-input"
                          placeholder={isHindi ? "अपना ईमेल या रोगी आईडी दर्ज करें" : "Enter your email or patient ID"}
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="pl-input-group">
                      <div className="pl-input-label-row">
                        <label className="pl-input-label">
                          {isHindi ? "पासवर्ड" : "PASSWORD"}
                        </label>
                        <button
                          type="button"
                          onClick={() => { setShowForgotModal(true); setForgotSuccess(false); setForgotEmail(loginIdentifier); }}
                          className="pl-forgot-link"
                        >
                          {isHindi ? "पासवर्ड भूल गए?" : "Forgot password?"}
                        </button>
                      </div>
                      <div className="pl-input-wrapper">
                        <span className="pl-input-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                        <input
                          type={showPassword ? "text" : "password"}
                          className="pl-text-input"
                          placeholder={isHindi ? "अपना पासवर्ड दर्ज करें" : "Enter your password"}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          style={{ paddingRight: "42px" }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="pl-eye-btn"
                          tabIndex={-1}
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Primary Button */}
                    <button type="submit" disabled={loading} className="pl-primary-btn">
                      {loading ? (
                        <span>{isHindi ? "साइन इन हो रहा है..." : "Signing in..."}</span>
                      ) : (
                        <>
                          <span>{isHindi ? "मेरे पोर्टल में साइन इन करें" : "Sign in to my portal"}</span>
                          <span>→</span>
                        </>
                      )}
                    </button>

                    {/* Registration Link */}
                    <div className="pl-register-row">
                      <span>{isHindi ? "रोगी पोर्टल पर नए हैं?" : "New to the patient portal?"}</span>
                      <button
                        type="button"
                        onClick={() => { setAuthMode("signup-patient"); setRegStep("form"); setErrorMsg(null); }}
                        className="pl-register-link"
                      >
                        {isHindi ? "खाता बनाएं" : "Create an account"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Option B: Mobile + OTP Login Flow */}
                {loginMethod === "mobile" && (
                  <form onSubmit={handleVerifyLoginOtp}>

                    {/* Mobile Number with +91 Country Code & Send OTP */}
                    <div className="pl-input-group">
                      <div className="pl-input-label-row">
                        <label className="pl-input-label">{isHindi ? "मोबाइल नंबर *" : "MOBILE NUMBER *"}</label>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "0 12px",
                          background: "#F1F5F9",
                          border: "1.5px solid #E2E8F0",
                          borderRadius: "12px",
                          fontSize: "13.5px",
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
                          className="pl-text-input"
                          placeholder="9876543210"
                          value={loginPhone}
                          onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, ""))}
                          disabled={loginOtpSent && loginOtpCountdown > 0}
                          required
                          style={{ flex: 1, paddingLeft: "14px" }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSendLoginOtp}
                          disabled={loginOtpLoading || (loginOtpSent && loginOtpCountdown > 0) || loginPhone.length !== 10}
                          style={{
                            padding: "0 16px",
                            borderRadius: "12px",
                            border: "none",
                            background: (loginOtpSent && loginOtpCountdown > 0) ? "#94A3B8" : "#0284C7",
                            color: "#FFFFFF",
                            fontSize: "12.5px",
                            fontWeight: 700,
                            cursor: (loginOtpSent && loginOtpCountdown > 0) ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {loginOtpLoading
                            ? (isHindi ? "भेज रहे हैं..." : "Sending...")
                            : loginOtpSent
                            ? (loginOtpCountdown > 0 ? `${isHindi ? "पुनः भेजें" : "Resend"} (${loginOtpCountdown}s)` : (isHindi ? "पुनः भेजें" : "Resend OTP"))
                            : (isHindi ? "OTP भेजें" : "Send OTP")}
                        </button>
                      </div>
                    </div>

                    {/* 6-Digit OTP Code Input */}
                    {loginOtpSent && (
                      <>
                        <div className="pl-input-group">
                          <div className="pl-input-label-row">
                            <label className="pl-input-label">{isHindi ? "6-अंकीय OTP कोड *" : "6-DIGIT OTP CODE *"}</label>
                            <span style={{ fontSize: "11px", color: "#64748B" }}>
                              {isHindi ? "वैधता: 5 मिनट (अधिकतम 3 प्रयास)" : "Valid 5 mins (Max 3 attempts)"}
                            </span>
                          </div>
                          <div className="pl-input-wrapper">
                            <input
                              type="text"
                              maxLength={6}
                              className="pl-text-input"
                              placeholder="••••••"
                              value={loginOtp}
                              onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, ""))}
                              required
                              style={{
                                fontSize: "20px",
                                letterSpacing: "6px",
                                textAlign: "center",
                                fontWeight: 800,
                                padding: "0 16px",
                                background: "#FAFCFF",
                              }}
                              autoFocus
                            />
                          </div>
                          {loginRemainingAttempts !== null && loginRemainingAttempts < 3 && (
                            <div style={{ fontSize: "11.5px", color: "#DC2626", fontWeight: 700, marginTop: "4px" }}>
                              {loginRemainingAttempts} {isHindi ? "प्रयास शेष" : "attempt(s) remaining before OTP locks"}
                            </div>
                          )}
                        </div>

                        <button type="submit" disabled={loading || loginOtp.length !== 6} className="pl-primary-btn">
                          {loading ? (
                            <span>{isHindi ? "सत्यापित और साइन इन हो रहा है..." : "Verifying & Signing In..."}</span>
                          ) : (
                            <>
                              <span>{isHindi ? "OTP से साइन इन करें" : "Sign in with Mobile OTP"}</span>
                              <span>→</span>
                            </>
                          )}
                        </button>
                      </>
                    )}


                    {/* Registration Link */}
                    <div className="pl-register-row" style={{ marginTop: "16px" }}>
                      <span>{isHindi ? "रोगी पोर्टल पर नए हैं?" : "New to the patient portal?"}</span>
                      <button
                        type="button"
                        onClick={() => { setAuthMode("signup-patient"); setRegStep("form"); setErrorMsg(null); }}
                        className="pl-register-link"
                      >
                        {isHindi ? "खाता बनाएं" : "Create an account"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ================= REGISTRATION FORM ================= */}
            {authMode.startsWith("signup") && (
              <form onSubmit={handleRegisterSubmit}>
                {/* Account Type Selection */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup-patient")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: authMode === "signup-patient" ? "2px solid #0284C7" : "1.5px solid #E2E8F0",
                      background: authMode === "signup-patient" ? "#F0F9FF" : "#FFFFFF",
                      color: authMode === "signup-patient" ? "#0369A1" : "#475569",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>{isHindi ? "रोगी खाता" : "Patient"}</span>
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 500, marginTop: "2px" }}>
                      {isHindi ? "अपॉइंटमेंट और कतार" : "Queue & Appointments"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("signup-superadmin")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: authMode === "signup-superadmin" ? "2px solid #0284C7" : "1.5px solid #E2E8F0",
                      background: authMode === "signup-superadmin" ? "#F0F9FF" : "#FFFFFF",
                      color: authMode === "signup-superadmin" ? "#0369A1" : "#475569",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" />
                      </svg>
                      <span>{isHindi ? "अस्पताल मालिक" : "Hospital Owner"}</span>
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 500, marginTop: "2px" }}>
                      {isHindi ? "सुपर एडमिन टेनेंट" : "Super Admin Tenant"}
                    </div>
                  </button>
                </div>

                {/* Patient Primary Hospital Selection & QR/Direct-Link Preselection Banner */}
                {authMode === "signup-patient" && (
                  <div style={{ marginBottom: "16px" }}>
                    {isUrlPreselected && !showCustomHospitalPicker ? (
                      <div
                        style={{
                          background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                          border: "1.5px solid #93C5FD",
                          borderRadius: "14px",
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          boxShadow: "0 2px 6px rgba(59, 130, 246, 0.08)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "10px",
                              background: "#2563EB",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" />
                            </svg>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  color: "#1D4ED8",
                                  background: "#DBEAFE",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                {isHindi ? "सीधा लिंक / QR द्वारा चयनित" : "Direct Link / QR Verified"}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "13.5px",
                                fontWeight: 700,
                                color: "#1E3A8A",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {selectedHospitalObj?.name || "Selected Hospital"}
                            </div>
                            {selectedHospitalObj?.address && (
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "#475569",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                </svg>
                                <span>{selectedHospitalObj.address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCustomHospitalPicker(true)}
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #BFDBFE",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#1D4ED8",
                            cursor: "pointer",
                            flexShrink: 0,
                            transition: "all 0.15s ease",
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = "#F0F7FF")}
                          onMouseOut={(e) => (e.currentTarget.style.background = "#FFFFFF")}
                        >
                          {isHindi ? "बदलें" : "Change"}
                        </button>
                      </div>
                    ) : (
                      <div className="pl-input-group" style={{ marginBottom: "0" }}>
                        <div className="pl-input-label-row">
                          <label className="pl-input-label">
                            {isHindi ? "अस्पताल / क्लिनिक चुनें *" : "SELECT HOSPITAL / CLINIC *"}
                          </label>
                          {isUrlPreselected && (
                            <button
                              type="button"
                              onClick={() => setShowCustomHospitalPicker(false)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#2563EB",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              {isHindi ? "वापस QR अस्पताल" : "Revert to QR Facility"}
                            </button>
                          )}
                        </div>
                        <div className="pl-input-wrapper" style={{ position: "relative" }}>
                          <select
                            className="pl-text-input"
                            value={selectedHospitalCode}
                            onChange={(e) => {
                              setSelectedHospitalCode(e.target.value);
                              try {
                                localStorage.setItem("ai_queue_current_hospital", e.target.value);
                              } catch (err) { }
                            }}
                            required
                            style={{
                              paddingLeft: "36px",
                              paddingRight: "28px",
                              cursor: "pointer",
                              background: "#FFFFFF",
                              appearance: "none",
                              WebkitAppearance: "none",
                              color: "#0F172A",
                              fontWeight: 600,
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
                          <span
                            style={{
                              position: "absolute",
                              left: "12px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              pointerEvents: "none",
                              display: "flex",
                              alignItems: "center",
                              color: "#0284C7",
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" />
                            </svg>
                          </span>
                          <span
                            style={{
                              position: "absolute",
                              right: "12px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: "11px",
                              color: "#64748B",
                              pointerEvents: "none",
                            }}
                          >
                            ▼
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px", paddingLeft: "2px" }}>
                          {isHindi
                            ? "आपकी कतार और अपॉइंटमेंट इस अस्पताल के सर्वर पर दर्ज होगी।"
                            : "Your queue tickets & tokens will sync with this hospital."}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Full Name */}
                <div className="pl-input-group">
                  <div className="pl-input-label-row">
                    <label className="pl-input-label">{isHindi ? "पूरा नाम *" : "FULL NAME *"}</label>
                  </div>
                  <div className="pl-input-wrapper">
                    <input
                      type="text"
                      className="pl-text-input"
                      placeholder={isHindi ? "उदा. राहुल शर्मा" : "e.g. John Doe"}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      style={{ paddingLeft: "16px" }}
                    />
                  </div>
                </div>

                {/* Hospital Name (if superadmin) */}
                {authMode === "signup-superadmin" && (
                  <div className="pl-input-group">
                    <div className="pl-input-label-row">
                      <label className="pl-input-label">{isHindi ? "अस्पताल का नाम *" : "HOSPITAL NAME *"}</label>
                    </div>
                    <div className="pl-input-wrapper">
                      <input
                        type="text"
                        className="pl-text-input"
                        placeholder="e.g. Apex Multi-Specialty Hospital"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        required
                        style={{ paddingLeft: "16px" }}
                      />
                    </div>
                  </div>
                )}

                {regStep === "otp" ? (
                  /* ================= EMAIL OTP VERIFICATION STEP ================= */
                  <div style={{ marginTop: "8px" }}>
                    <div style={{ textAlign: "center", marginBottom: "18px" }}>
                      <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#E0F2FE", color: "#0284C7", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                      </div>
                      <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                        {isHindi ? "ईमेल सत्यापन कोड दर्ज करें" : "Verify Your Email"}
                      </h3>
                      <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
                        {isHindi ? "हमने एक 6-अंकीय कोड भेजा है:" : "We've sent a 6-digit security code to:"}<br />
                        <strong style={{ color: "#0284C7" }}>{regEmail}</strong>
                        <button
                          type="button"
                          onClick={() => setRegStep("form")}
                          style={{ marginLeft: "6px", background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: "11.5px", textDecoration: "underline" }}
                        >
                          ({isHindi ? "बदलें" : "Change"})
                        </button>
                      </p>
                    </div>

                    <div className="pl-input-group">
                      <div className="pl-input-label-row">
                        <label className="pl-input-label">{isHindi ? "6-अंकीय सुरक्षा कोड *" : "6-DIGIT SECURITY CODE *"}</label>
                      </div>
                      <div className="pl-input-wrapper">
                        <input
                          type="text"
                          maxLength={6}
                          className="pl-text-input"
                          placeholder="123456"
                          value={regOtp}
                          onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ""))}
                          autoFocus
                          required
                          style={{
                            paddingLeft: "16px",
                            textAlign: "center",
                            fontSize: "22px",
                            fontWeight: 800,
                            letterSpacing: "6px",
                            fontFamily: "monospace",
                            background: "#FAFCFF",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0", fontSize: "12.5px" }}>
                      <span style={{ color: "#64748B" }}>
                        {isHindi ? "कोड नहीं मिला?" : "Didn't receive the code?"}
                      </span>
                      {resendCountdown > 0 ? (
                        <span style={{ color: "#94A3B8", fontWeight: 600 }}>
                          {isHindi ? `पुनः भेजें (${resendCountdown}s)` : `Resend in ${resendCountdown}s`}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={loading}
                          style={{ background: "none", border: "none", color: "#0284C7", fontWeight: 700, cursor: "pointer", padding: 0 }}
                        >
                          {isHindi ? "कोड पुनः भेजें" : "Resend Code"}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleFinalRegister}
                      disabled={loading || regOtp.length !== 6}
                      className="pl-primary-btn"
                    >
                      {loading ? (
                        <span>{isHindi ? "सत्यापित हो रहा है..." : "Verifying & Creating..."}</span>
                      ) : (
                        <>
                          <span>{isHindi ? "सत्यापित करें और खाता बनाएं" : "Verify & Complete Registration"}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegStep("form")}
                      style={{ width: "100%", marginTop: "10px", padding: "8px", background: "none", border: "none", color: "#64748B", fontSize: "12.5px", cursor: "pointer" }}
                    >
                      ← {isHindi ? "वापस जाएं" : "Back to details"}
                    </button>
                  </div>
                ) : (
                  /* ================= REGISTRATION FIELDS ================= */
                  <>
                    {/* Email Input Field */}
                    <div className="pl-input-group" style={{ marginBottom: "14px" }}>
                      <div className="pl-input-label-row">
                        <label className="pl-input-label">{isHindi ? "ईमेल पता *" : "EMAIL ADDRESS *"}</label>
                        {emailCheckStatus === "checking" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#64748B", fontWeight: 600 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            {isHindi ? "जांच..." : "Checking..."}
                          </span>
                        )}
                        {emailCheckStatus === "available" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "#10B981", fontWeight: 700 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981" }} />
                            {isHindi ? "उपलब्ध" : "Available"}
                          </span>
                        )}
                        {emailCheckStatus === "taken" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", color: "#EF4444", fontWeight: 700 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#EF4444" }} />
                            {isHindi ? "पंजीकृत" : "Taken"}
                          </span>
                        )}
                      </div>
                      <div className="pl-input-wrapper">
                        <input
                          type="email"
                          className="pl-text-input"
                          placeholder="name@example.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          required
                          style={{
                            paddingLeft: "16px",
                            borderColor: emailCheckStatus === "taken" ? "#FCA5A5" : (emailCheckStatus === "available" ? "#86EFAC" : "#E2E8F0"),
                          }}
                        />
                      </div>
                    </div>

                    {/* Patient Mobile Number Verification with +91 Country Code */}
                    {authMode === "signup-patient" ? (
                      <div className="pl-input-group" style={{ marginBottom: "16px" }}>
                        <div className="pl-input-label-row">
                          <label className="pl-input-label">
                            {isHindi ? "मोबाइल नंबर (OTP सत्यापन) *" : "MOBILE NUMBER (OTP VERIFICATION) *"}
                          </label>
                          {isMobileVerified && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#10B981", fontWeight: 700 }}>
                              ✓ {isHindi ? "सत्यापित" : "Verified"}
                            </span>
                          )}
                        </div>

                        {isMobileVerified ? (
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "#ECFDF5",
                            border: "1.5px solid #10B981",
                            borderRadius: "12px",
                            color: "#065F46",
                            fontWeight: 700,
                            fontSize: "13px",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "16px" }}>✓</span>
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
                                fontSize: "11.5px",
                                cursor: "pointer",
                                textDecoration: "underline",
                                fontWeight: 600,
                              }}
                            >
                              {isHindi ? "नंबर बदलें" : "Change Number"}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "0 12px",
                                background: "#F1F5F9",
                                border: "1.5px solid #E2E8F0",
                                borderRadius: "12px",
                                fontSize: "13.5px",
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
                                className="pl-text-input"
                                placeholder="9876543210"
                                value={signupMobile}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, "");
                                  setSignupMobile(digits);
                                  setRegPhone("+91" + digits);
                                }}
                                disabled={signupOtpSent && signupOtpCountdown > 0 && !isMobileVerified}
                                style={{
                                  flex: 1,
                                  paddingLeft: "14px",
                                  borderColor: signupPhoneStatus === "taken" ? "#EF4444" : undefined,
                                }}
                                required
                              />
                              <button
                                type="button"
                                onClick={handleSendSignupOtp}
                                disabled={signupOtpLoading || (signupOtpSent && signupOtpCountdown > 0) || signupMobile.length !== 10 || signupPhoneStatus === "taken"}
                                style={{
                                  padding: "0 16px",
                                  borderRadius: "12px",
                                  border: "none",
                                  background: (signupOtpSent && signupOtpCountdown > 0) || signupPhoneStatus === "taken" ? "#94A3B8" : "#0284C7",
                                  color: "#FFFFFF",
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  cursor: (signupOtpSent && signupOtpCountdown > 0) || signupPhoneStatus === "taken" ? "not-allowed" : "pointer",
                                  whiteSpace: "nowrap",
                                  boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {signupOtpLoading
                                  ? (isHindi ? "भेज रहे हैं..." : "Sending...")
                                  : signupOtpSent
                                  ? (signupOtpCountdown > 0 ? `${isHindi ? "पुनः भेजें" : "Resend"} (${signupOtpCountdown}s)` : (isHindi ? "पुनः भेजें" : "Resend OTP"))
                                  : (isHindi ? "OTP भेजें" : "Send OTP")}
                              </button>
                            </div>

                            {signupPhoneStatus === "taken" && (
                              <div style={{
                                marginTop: "8px",
                                padding: "8px 12px",
                                background: "#FEF2F2",
                                border: "1px solid #FCA5A5",
                                borderRadius: "10px",
                                fontSize: "12px",
                                color: "#B91C1C",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                              }}>
                                <span style={{ fontWeight: 600 }}>⚠️ {isHindi ? "यह मोबाइल नंबर पहले से पंजीकृत है।" : "This mobile number is already registered."}</span>
                                <button
                                  type="button"
                                  onClick={() => { setAuthMode("login"); setErrorMsg(null); }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#DC2626",
                                    fontWeight: 800,
                                    textDecoration: "underline",
                                    cursor: "pointer",
                                    padding: 0,
                                    fontSize: "12px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {isHindi ? "साइन इन करें →" : "Sign In →"}
                                </button>
                              </div>
                            )}

                            {/* 6-Digit OTP Input & Verification Action */}
                            {signupOtpSent && !isMobileVerified && (
                              <div style={{
                                marginTop: "10px",
                                padding: "12px 14px",
                                background: "#F8FAFC",
                                border: "1.5px dashed #0284C7",
                                borderRadius: "12px",
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369A1", textTransform: "uppercase" }}>
                                    {isHindi ? "6-अंकीय OTP कोड दर्ज करें" : "ENTER 6-DIGIT OTP"}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "#64748B" }}>
                                    {isHindi ? "वैधता: 5 मिनट" : "Valid for 5 mins"}
                                  </span>
                                </div>

                                <div style={{ display: "flex", gap: "8px" }}>
                                  <input
                                    type="text"
                                    maxLength={6}
                                    className="pl-text-input"
                                    placeholder="••••••"
                                    value={signupOtp}
                                    onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, ""))}
                                    style={{
                                      flex: 1,
                                      fontSize: "18px",
                                      letterSpacing: "6px",
                                      textAlign: "center",
                                      fontWeight: 800,
                                      padding: "0 10px",
                                      background: "#FFFFFF",
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={handleVerifySignupOtp}
                                    disabled={signupVerifying || signupOtp.length !== 6}
                                    style={{
                                      padding: "0 18px",
                                      borderRadius: "12px",
                                      border: "none",
                                      background: "#10B981",
                                      color: "#FFFFFF",
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      cursor: (signupVerifying || signupOtp.length !== 6) ? "not-allowed" : "pointer",
                                      whiteSpace: "nowrap",
                                      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                                    }}
                                  >
                                    {signupVerifying ? (isHindi ? "जांच..." : "Verifying...") : (isHindi ? "सत्यापित करें" : "Verify Code")}
                                  </button>
                                </div>

                                {signupRemainingAttempts !== null && signupRemainingAttempts < 3 && (
                                  <div style={{ fontSize: "11px", color: "#DC2626", fontWeight: 600, marginTop: "4px" }}>
                                    {signupRemainingAttempts} {isHindi ? "प्रयास शेष" : "attempt(s) remaining"}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Super Admin Phone Input */
                      <div className="pl-input-group" style={{ marginBottom: "14px" }}>
                        <div className="pl-input-label-row">
                          <label className="pl-input-label">{isHindi ? "फोन नंबर" : "PHONE NUMBER"}</label>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "0 12px",
                            background: "#F1F5F9",
                            border: "1.5px solid #E2E8F0",
                            borderRadius: "12px",
                            fontSize: "13.5px",
                            fontWeight: 700,
                            color: "#0F172A",
                            flexShrink: 0,
                          }}>
                            <span>🇮🇳</span>
                            <span>+91</span>
                          </div>
                          <input
                            type="tel"
                            className="pl-text-input"
                            placeholder="9876543210"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            style={{ flex: 1, paddingLeft: "14px" }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Password & Confirm Password */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="pl-input-group">
                        <div className="pl-input-label-row">
                          <label className="pl-input-label">{isHindi ? "पासवर्ड *" : "PASSWORD *"}</label>
                          {regPassword && (
                            <span style={{ fontSize: "10px", fontWeight: 700, color: getPasswordStrength(regPassword).color }}>
                              {getPasswordStrength(regPassword).label}
                            </span>
                          )}
                        </div>
                        <div className="pl-input-wrapper">
                          <input
                            type="password"
                            className="pl-text-input"
                            placeholder="••••••••"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            required
                            style={{ paddingLeft: "16px" }}
                          />
                        </div>
                        {/* Real-Time Password Strength Progress Bar */}
                        {regPassword && (
                          <div style={{ height: "3px", width: "100%", background: "#E2E8F0", borderRadius: "2px", marginTop: "5px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${(getPasswordStrength(regPassword).score / 4) * 100}%`,
                                background: getPasswordStrength(regPassword).color,
                                transition: "all 0.25s ease",
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="pl-input-group">
                        <div className="pl-input-label-row">
                          <label className="pl-input-label">{isHindi ? "पासवर्ड की पुष्टि *" : "CONFIRM *"}</label>
                          {regConfirmPassword && regPassword === regConfirmPassword && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#10B981", fontWeight: 700 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              {isHindi ? "मेल खाता है" : "Matches"}
                            </span>
                          )}
                        </div>
                        <div className="pl-input-wrapper">
                          <input
                            type="password"
                            className="pl-text-input"
                            placeholder="••••••••"
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            required
                            style={{
                              paddingLeft: "16px",
                              borderColor: regConfirmPassword && regPassword !== regConfirmPassword ? "#FCA5A5" : "#E2E8F0",
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Register Submit Button */}
                    <button
                      type="button"
                      onClick={handleRequestSignupOtp}
                      disabled={loading || emailCheckStatus === "taken"}
                      className="pl-primary-btn"
                    >
                      {loading ? (
                        <span>{isHindi ? "सत्यापन कोड भेजा जा रहा है..." : "Sending Verification Code..."}</span>
                      ) : (
                        <>
                          <span>{authMode === "signup-superadmin" ? (isHindi ? "सुपर एडमिन खाता बनाएं" : "Create Super Admin Account") : (isHindi ? "ईमेल सत्यापित करें और आगे बढ़ें" : "Verify Email & Continue")}</span>
                          <span>→</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <div className="pl-register-row">
                  <span>{isHindi ? "पहले से खाता है?" : "Already have an account?"}</span>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setRegStep("form"); setErrorMsg(null); }}
                    className="pl-register-link"
                  >
                    {isHindi ? "साइन इन करें" : "Sign in"}
                  </button>
                </div>
              </form>
            )}


            {/* Subtle Security Indicator */}
            <div className="pl-security-badge">
              <span className="pl-security-dot" />
              <span>{isHindi ? "सुरक्षित प्रमाणीकरण से संरक्षित" : "Protected with secure authentication"}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: HEALTHCARE DASHBOARD VISUAL SHOWCASE */}
        <div className="pl-right-visual">
          <div className="pl-dashboard-backing">

            {/* Top Backing Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#E0F2FE", color: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" /><path d="M5 12h14" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#0F172A" }}>Live Clinical Session</div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>Real-time Patient Queue & AI Sync</div>
                </div>
              </div>
              <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "3px 8px", background: "#DCFCE7", color: "#166534", borderRadius: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22C55E", animation: "pulseDotLive 2s infinite" }} />
                <span>ONLINE</span>
              </span>
            </div>

            {/* 1. Next Appointment Card */}
            <div className="pl-preview-card pl-card-floating-1">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.8px", color: "#0284C7", background: "#E0F2FE", padding: "2px 8px", borderRadius: "6px" }}>
                  NEXT APPOINTMENT
                </span>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#0F172A" }}>Tue · 9:40 AM</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "10px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#F0F9FF", border: "1.5px solid #BAE6FD", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284C7", fontWeight: 800, fontSize: "14px" }}>
                  SM
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#0F172A" }}>Dr. Sarah Mitchell</div>
                  <div style={{ fontSize: "11.5px", color: "#64748B" }}>Cardiology Consultation • Room 204</div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", background: "#ECFDF5", padding: "3px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Confirmed</span>
                </span>
              </div>
            </div>

            {/* 2-Column Floating Grid: Queue Status + AI Wait Estimate */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

              {/* Queue Status Card */}
              <div className="pl-preview-card pl-card-floating-2">
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.8px", color: "#475569", display: "block", marginBottom: "6px" }}>
                  QUEUE STATUS
                </span>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>
                  Position #6
                </div>
                <div style={{ fontSize: "11.5px", color: "#0284C7", fontWeight: 700, marginTop: "4px" }}>
                  Estimated wait ~24 min
                </div>
                <div style={{ fontSize: "10.5px", color: "#94A3B8", marginTop: "2px" }}>
                  Counter 3B (OPD Wing)
                </div>
              </div>

              {/* AI Wait Estimate Card */}
              <div className="pl-preview-card pl-card-floating-1" style={{ background: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)", borderColor: "#BAE6FD" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.8px", color: "#0369A1", display: "block", marginBottom: "6px" }}>
                  AI WAIT ESTIMATE
                </span>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#0369A1", letterSpacing: "-0.5px" }}>
                  24–30 min
                </div>
                <div style={{ fontSize: "11.5px", color: "#0284C7", fontWeight: 700, marginTop: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0284C7" }} />
                  <span>Confidence: High</span>
                </div>
                <div style={{ fontSize: "10.5px", color: "#64748B", marginTop: "2px" }}>
                  Clinical ML model v2.5
                </div>
              </div>
            </div>

            {/* 3. Live Message / Status Update Card */}
            <div className="pl-preview-card pl-card-floating-2">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.6px", color: "#059669" }}>
                    QUEUE UPDATE
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    You're getting closer. 4 patients ahead
                  </div>
                </div>
                <span style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 600 }}>Just now</span>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* ================================================================= */}
      {/* 3. MINIMAL PROFESSIONAL FOOTER                                    */}
      {/* ================================================================= */}
      <footer className="pl-footer">
        <div>
          © 2026 Hex Visionaries. {isHindi ? "सर्वाधिकार सुरक्षित।" : "All rights reserved."}
        </div>
        <div className="pl-footer-links">
          <button type="button" onClick={() => setShowHelpModal(true)} className="pl-footer-link">
            {isHindi ? "गोपनीयता नीति" : "Privacy Policy"}
          </button>
          <button type="button" onClick={() => setShowHelpModal(true)} className="pl-footer-link">
            {isHindi ? "सेवा की शर्तें" : "Terms of Service"}
          </button>
          <button type="button" onClick={() => setShowSupportModal(true)} className="pl-footer-link">
            {isHindi ? "पहुंच क्षमता" : "Accessibility"}
          </button>
        </div>
      </footer>

      {/* ================================================================= */}
      {/* 4. INTERACTIVE MODALS (HELP, PROVIDERS, SUPPORT, FORGOT PASSWORD) */}
      {/* ================================================================= */}

      {/* Help Center Modal */}
      {showHelpModal && (
        <div style={modalOverlayStyle} onClick={() => setShowHelpModal(false)}>
          <div style={{ ...modalBoxStyle, maxWidth: "560px", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                {isHindi ? "सहायता केंद्र एवं अक्सर पूछे जाने वाले प्रश्न" : "Patient Portal Help Center"}
              </h3>
              <button type="button" onClick={() => setShowHelpModal(false)} style={modalCloseBtnStyle}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px", color: "#475569", overflowY: "auto", paddingRight: "4px" }}>

              {/* Getting Started */}
              <div style={{ padding: "10px 14px", background: "#EFF6FF", borderRadius: "10px", border: "1px solid #BFDBFE" }}>
                <div style={{ fontWeight: 800, color: "#1E40AF", fontSize: "13px", marginBottom: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                  <span>{isHindi ? "शुरुआत कैसे करें" : "Getting Started"}</span>
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "मैं लाइव कतार में कैसे शामिल होऊं?" : "How do I join the live queue?"}</div>
                <div>{isHindi ? "अपने रोगी खाते में साइन इन करें और डैशबोर्ड पर 'तत्काल वॉक-इन टिकट' चुनें। अपना विभाग चुनें और लक्षण दर्ज करें।" : "Sign in to your patient account and select 'Instant Walk-In Ticket' on the dashboard. Choose your department and submit symptoms for triage."}</div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "क्या मैं परिवार के सदस्यों के लिए बुकिंग कर सकता हूं?" : "Can I book for my family members?"}</div>
                <div>{isHindi ? "हां। लॉगिन करने के बाद, ऊपर दाएं प्रोफाइल अवतार से परिवार के सदस्यों की प्रोफाइल जोड़ें या बदलें।" : "Yes. After logging in, switch or add family member profiles from the top-right profile avatar. Each member gets their own queue slot."}</div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "अपॉइंटमेंट कैसे शेड्यूल करें?" : "How do I schedule an appointment?"}</div>
                <div>{isHindi ? "डैशबोर्ड से 'अपॉइंटमेंट बुक करें' पर क्लिक करें, विभाग और डॉक्टर चुनें, उपलब्ध समय स्लॉट चुनें और पुष्टि करें।" : "Click 'Book Appointment' from your dashboard, select a department and doctor, pick an available time slot, and confirm. You'll receive a confirmation notification."}</div>
              </div>

              {/* AI & Queue */}
              <div style={{ padding: "10px 14px", background: "#F0FDF4", borderRadius: "10px", border: "1px solid #BBF7D0" }}>
                <div style={{ fontWeight: 800, color: "#166534", fontSize: "13px", marginBottom: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
                  </svg>
                  <span>{isHindi ? "एआई और कतार प्रणाली" : "AI & Queue System"}</span>
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "एआई प्रतीक्षा समय पूर्वानुमान कितना सटीक है?" : "How accurate is the AI wait-time prediction?"}</div>
                <div>{isHindi ? "हमारा एआई मॉडल ऐतिहासिक डेटा, वर्तमान कतार लंबाई और डॉक्टर की उपलब्धता का विश्लेषण करता है। सटीकता आमतौर पर ±5 मिनट के भीतर होती है।" : "Our AI model analyzes historical data, current queue length, and doctor availability patterns. Accuracy is typically within ±5 minutes for standard consultations."}</div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "क्या मैं कतार में अपनी स्थिति लाइव ट्रैक कर सकता हूं?" : "Can I track my position in the queue live?"}</div>
                <div>{isHindi ? "बिल्कुल! डैशबोर्ड पर लाइव कतार स्टेटस कार्ड रियल-टाइम में आपकी स्थिति, अनुमानित प्रतीक्षा समय और आपसे आगे के मरीज दिखाता है।" : "Absolutely! The live queue status card on your dashboard shows your real-time position, estimated wait time, and patients ahead of you — updated every few seconds."}</div>
              </div>

              {/* Medical Records */}
              <div style={{ padding: "10px 14px", background: "#FFF7ED", borderRadius: "10px", border: "1px solid #FED7AA" }}>
                <div style={{ fontWeight: 800, color: "#9A3412", fontSize: "13px", marginBottom: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span>{isHindi ? "मेडिकल रिकॉर्ड" : "Medical Records"}</span>
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "मैं अपने नुस्खे और रिपोर्ट कहां देख सकता हूं?" : "Where can I view my prescriptions and reports?"}</div>
                <div>{isHindi ? "'मेडिकल रिकॉर्ड' सेक्शन में जाएं जहां सभी पिछले नुस्खे, लैब रिपोर्ट और डॉक्टर के नोट्स तिथि के अनुसार व्यवस्थित हैं।" : "Navigate to the 'Medical Records' section where all past prescriptions, lab reports, and doctor notes are organized by date. You can download or share them as needed."}</div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "क्या मैं अपना विज़िट इतिहास देख सकता हूं?" : "Can I see my past visit history?"}</div>
                <div>{isHindi ? "हां, 'रोगी इतिहास' टैब सभी पिछली विज़िट दिखाता है जिसमें निदान, उपचार और फॉलो-अप विवरण शामिल हैं।" : "Yes, the 'Patient History' tab displays all previous visits including diagnosis, treatment details, and follow-up recommendations from your doctors."}</div>
              </div>

              {/* Account & Security */}
              <div style={{ padding: "10px 14px", background: "#FAF5FF", borderRadius: "10px", border: "1px solid #E9D5FF" }}>
                <div style={{ fontWeight: 800, color: "#6B21A8", fontSize: "13px", marginBottom: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>{isHindi ? "खाता और सुरक्षा" : "Account & Security"}</span>
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "क्या मेरा डेटा सुरक्षित है?" : "Is my data secure?"}</div>
                <div>{isHindi ? "बिल्कुल। सभी रोगी डेटा एंड-टू-एंड एन्क्रिप्टेड है और HIPAA-अनुरूप बुनियादी ढांचे पर संग्रहीत है। हम आपकी गोपनीयता को गंभीरता से लेते हैं।" : "Absolutely. All patient data is encrypted end-to-end and stored on HIPAA-compliant infrastructure. We use industry-standard security protocols to protect your privacy."}</div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "मैं अपना पासवर्ड कैसे रीसेट करूं?" : "How do I reset my password?"}</div>
                <div>{isHindi ? "लॉगिन स्क्रीन पर 'पासवर्ड भूल गए?' लिंक पर क्लिक करें। अपना पंजीकृत ईमेल दर्ज करें और हम आपको एक सुरक्षित रीसेट लिंक भेजेंगे।" : "Click the 'Forgot password?' link on the login screen. Enter your registered email and we'll send you a secure reset link within seconds."}</div>
              </div>

              {/* General */}
              <div style={{ padding: "10px 14px", background: "#FEF2F2", borderRadius: "10px", border: "1px solid #FECACA" }}>
                <div style={{ fontWeight: 800, color: "#991B1B", fontSize: "13px", marginBottom: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>{isHindi ? "सामान्य प्रश्न" : "General"}</span>
                </div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "पोर्टल किन भाषाओं का समर्थन करता है?" : "What languages does the portal support?"}</div>
                <div>{isHindi ? "वर्तमान में हम अंग्रेजी और हिंदी का समर्थन करते हैं। शीर्ष मेनू में भाषा टॉगल बटन से आप किसी भी समय भाषा बदल सकते हैं।" : "Currently we support English and Hindi. You can switch languages anytime using the language toggle button in the top navigation bar."}</div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "मुझे तकनीकी समस्या हो रही है। मैं क्या करूं?" : "I'm experiencing a technical issue. What should I do?"}</div>
                <div>{isHindi ? "ब्राउज़र कैश साफ करें और पेज रीलोड करें। यदि समस्या बनी रहती है, तो नेविगेशन बार में 'सहायता' बटन से हमारी सपोर्ट टीम से संपर्क करें।" : "Try clearing your browser cache and reloading the page. If the issue persists, contact our support team via the 'Support' button in the navigation bar with a description of the problem."}</div>
              </div>

              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{isHindi ? "क्या मैं मोबाइल पर पोर्टल का उपयोग कर सकता हूं?" : "Can I use the portal on my mobile phone?"}</div>
                <div>{isHindi ? "हां, पोर्टल पूरी तरह से मोबाइल-रेस्पॉन्सिव है। किसी भी ब्राउज़र से अपने फोन पर लॉगिन करें और सभी सुविधाओं का आनंद लें।" : "Yes! The portal is fully mobile-responsive. Simply log in from any browser on your phone and enjoy all features including queue tracking, appointments, and notifications."}</div>
              </div>

            </div>
          </div>
        </div>
      )}



      {/* Support Modal */}
      {showSupportModal && (
        <div style={modalOverlayStyle} onClick={() => setShowSupportModal(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                {isHindi ? "अस्पताल सहायता एवं आपातकालीन हेल्पलाइन" : "Hospital Help & Desk Support"}
              </h3>
              <button type="button" onClick={() => setShowSupportModal(false)} style={modalCloseBtnStyle}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px", color: "#475569" }}>
              <div style={{ padding: "14px", background: "#EFF6FF", borderRadius: "12px", border: "1px solid #BFDBFE" }}>
                <div style={{ fontWeight: 800, color: "#1E40AF", fontSize: "14px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "7px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>24/7 Patient Care Helpline</span>
                </div>
                <div style={{ fontSize: "13px", color: "#1E3A8A" }}>+91 (011) 2658-8500 / Toll Free: 1800-11-2345</div>
              </div>
              <div style={{ padding: "14px", background: "#FEF2F2", borderRadius: "12px", border: "1px solid #FECACA" }}>
                <div style={{ fontWeight: 800, color: "#991B1B", fontSize: "14px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "7px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Emergency & Trauma Hotline</span>
                </div>
                <div style={{ fontSize: "13px", color: "#7F1D1D" }}>Call 108 or direct line: +91 (011) 2659-6666</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal (3-Step Real-Time OTP Flow) */}
      {showForgotModal && (
        <div style={modalOverlayStyle} onClick={() => setShowForgotModal(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                {forgotStep === 3
                  ? (isHindi ? "पासवर्ड सफलतापूर्वक रीसेट हो गया" : "Password Reset Successfully")
                  : (isHindi ? "पासवर्ड रीसेट करें" : "Reset Portal Password")}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotStep(1);
                  setForgotError(null);
                }}
                style={modalCloseBtnStyle}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {forgotError && (
              <div style={{ marginTop: "14px", padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", color: "#DC2626", fontSize: "12.5px", fontWeight: 600, display: "flex", alignItems: "center", gap: "7px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>{forgotError}</span>
              </div>
            )}

            {/* STEP 1: Enter Email */}
            {forgotStep === 1 && (
              <form onSubmit={handleForgotRequestOtp} style={{ marginTop: "16px" }}>
                <p style={{ fontSize: "13.5px", color: "#64748B", margin: "0 0 16px 0", lineHeight: 1.5 }}>
                  {isHindi
                    ? "अपना पंजीकृत ईमेल पता दर्ज करें। हम आपको 6-अंकीय पासवर्ड रीसेट सुरक्षा कोड भेजेंगे।"
                    : "Enter your registered email address below. We'll send a 6-digit security code to verify your identity."}
                </p>
                <div className="pl-input-group">
                  <label className="pl-input-label">{isHindi ? "ईमेल पता *" : "EMAIL ADDRESS *"}</label>
                  <div className="pl-input-wrapper" style={{ marginTop: "6px" }}>
                    <input
                      type="email"
                      className="pl-text-input"
                      placeholder="name@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                      style={{ paddingLeft: "14px" }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className="pl-primary-btn"
                  style={{ marginTop: "14px" }}
                >
                  {forgotLoading ? (
                    <span>{isHindi ? "कोड भेजा जा रहा है..." : "Sending Security Code..."}</span>
                  ) : (
                    <span>{isHindi ? "सुरक्षा कोड भेजें →" : "Send 6-Digit Code →"}</span>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Enter 6-digit OTP & New Password */}
            {forgotStep === 2 && (
              <form onSubmit={handleForgotResetPassword} style={{ marginTop: "16px" }}>
                <div style={{ padding: "10px 12px", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "10px", fontSize: "12.5px", color: "#0369A1", marginBottom: "16px", display: "flex", alignItems: "center", gap: "7px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span>{isHindi ? "कोड भेजा गया:" : "Security code sent to:"} <strong>{forgotEmail}</strong></span>
                </div>

                <div className="pl-input-group">
                  <label className="pl-input-label">{isHindi ? "6-अंकीय सुरक्षा कोड *" : "6-DIGIT SECURITY CODE *"}</label>
                  <div className="pl-input-wrapper" style={{ marginTop: "6px" }}>
                    <input
                      type="text"
                      maxLength={6}
                      className="pl-text-input"
                      placeholder="123456"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                      style={{
                        paddingLeft: "14px",
                        textAlign: "center",
                        fontSize: "20px",
                        fontWeight: 800,
                        letterSpacing: "6px",
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                </div>

                <div className="pl-input-group" style={{ marginTop: "12px" }}>
                  <label className="pl-input-label">{isHindi ? "नया पासवर्ड *" : "NEW PASSWORD *"}</label>
                  <div className="pl-input-wrapper" style={{ marginTop: "6px", position: "relative" }}>
                    <input
                      type={showForgotPwd ? "text" : "password"}
                      className="pl-text-input"
                      placeholder="••••••••"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      required
                      style={{ paddingLeft: "14px", paddingRight: "38px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotPwd(!showForgotPwd)}
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
                        padding: "4px",
                      }}
                    >
                      {showForgotPwd ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pl-input-group" style={{ marginTop: "12px" }}>
                  <label className="pl-input-label">{isHindi ? "नए पासवर्ड की पुष्टि *" : "CONFIRM NEW PASSWORD *"}</label>
                  <div className="pl-input-wrapper" style={{ marginTop: "6px" }}>
                    <input
                      type={showForgotPwd ? "text" : "password"}
                      className="pl-text-input"
                      placeholder="••••••••"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      required
                      style={{ paddingLeft: "14px" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || forgotOtp.length !== 6 || !forgotNewPassword}
                  className="pl-primary-btn"
                  style={{ marginTop: "16px" }}
                >
                  {forgotLoading ? (
                    <span>{isHindi ? "सत्यापित हो रहा है..." : "Resetting Password..."}</span>
                  ) : (
                    <span>{isHindi ? "पासवर्ड रीसेट करें और सहेजें" : "Save New Password & Continue"}</span>
                  )}
                </button>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    style={{ background: "none", border: "none", color: "#64748B", fontSize: "12px", cursor: "pointer", padding: 0 }}
                  >
                    ← {isHindi ? "ईमेल बदलें" : "Change email"}
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotRequestOtp}
                    disabled={forgotLoading}
                    style={{ background: "none", border: "none", color: "#0284C7", fontSize: "12px", fontWeight: 700, cursor: "pointer", padding: 0 }}
                  >
                    {isHindi ? "कोड पुनः भेजें" : "Resend code"}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Success Confirmation */}
            {forgotStep === 3 && (
              <div style={{ marginTop: "16px", padding: "20px 16px", background: "#ECFDF5", borderRadius: "14px", border: "1px solid #A7F3D0", textAlign: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#10B981", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div style={{ fontWeight: 800, color: "#065F46", fontSize: "15px" }}>
                  {isHindi ? "पासवर्ड सफलतापूर्वक अपडेट हुआ!" : "Password Reset Complete!"}
                </div>
                <div style={{ fontSize: "13px", color: "#047857", marginTop: "6px", lineHeight: 1.5 }}>
                  {isHindi
                    ? "आपका पासवर्ड सफलतापूर्वक बदल दिया गया है। अब आप अपने नए क्रेडेंशियल्स के साथ साइन इन कर सकते हैं।"
                    : "Your password has been securely updated. You can now sign in to your Hex Visionaries account."}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginIdentifier(forgotEmail);
                    setShowForgotModal(false);
                    setForgotStep(1);
                    setForgotError(null);
                    setAuthMode("login");
                  }}
                  className="pl-primary-btn"
                  style={{ marginTop: "18px", height: "42px" }}
                >
                  {isHindi ? "साइन इन करें →" : "Sign In with New Password →"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "20px",
  boxSizing: "border-box"
};

const modalBoxStyle = {
  background: "#FFFFFF",
  borderRadius: "20px",
  padding: "24px 28px",
  maxWidth: "480px",
  width: "100%",
  boxShadow: "0 24px 48px -12px rgba(15, 23, 42, 0.25)",
  border: "1px solid #E2E8F0",
  boxSizing: "border-box"
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #F1F5F9",
  paddingBottom: "12px"
};

const modalCloseBtnStyle = {
  background: "#F1F5F9",
  border: "none",
  borderRadius: "8px",
  width: "28px",
  height: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#64748B",
  fontWeight: 700
};
