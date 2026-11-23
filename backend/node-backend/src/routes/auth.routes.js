/**
 * auth.routes.js
 * --------------
 * Authentication & User routes with rate-limiting protection against brute force.
 */

const express = require("express");
const {
  getGuestToken,
  signupSuperAdmin,
  signupAdmin,
  signupPatient,
  login,
  logout,
  getMe,
  updateProfile,
  updateUserPrimaryHospital,
  getAllUsers,
  getUserHistory,
  checkEmail,
  checkPhone,
  sendVerificationOtp,
  sendMobileOtp,
  verifyMobileOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  changePassword,
} = require("../controllers/auth.controller");
const { authenticate, optionalAuth } = require("../middleware/auth");
const {
  loginLimiter,
  signupLimiter,
  otpLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimiter");

const router = express.Router();

// Guest anonymous patient token
router.get("/guest-token", getGuestToken);

// Real-Time Validation & Verification (Email & Mobile OTP)
router.get("/check-email", checkEmail);
router.post("/check-email", checkEmail);
router.get("/check-phone", checkPhone);
router.post("/check-phone", checkPhone);
router.post("/send-verification-otp", otpLimiter, sendVerificationOtp);
router.post("/send-mobile-otp", otpLimiter, sendMobileOtp);
router.post("/verify-mobile-otp", loginLimiter, verifyMobileOtp);
router.post("/verify-signup-phone", otpLimiter, verifyMobileOtp);
router.post("/login-mobile", loginLimiter, verifyMobileOtp);

// Password Reset Flow (Protected by rate limiter)
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/verify-reset-otp", passwordResetLimiter, verifyResetOtp);
router.post("/reset-password", passwordResetLimiter, resetPassword);
router.post("/change-password", authenticate, changePassword);

// Core Authentication
router.post("/signup/superadmin", signupLimiter, signupSuperAdmin);
router.post("/signup/admin", signupLimiter, signupAdmin);
router.post("/signup/patient", signupLimiter, signupPatient);
router.post("/signup", signupLimiter, signupPatient);
router.post("/login", loginLimiter, login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getMe);
router.put("/profile", authenticate, updateProfile);
router.put("/primary-hospital", authenticate, updateUserPrimaryHospital);
router.get("/users", authenticate, getAllUsers);
router.get("/user-history/:email", optionalAuth, getUserHistory);

module.exports = router;
