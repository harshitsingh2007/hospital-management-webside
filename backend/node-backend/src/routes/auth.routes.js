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
} = require("../controllers/auth.controller");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Strict rate limiter: 5 attempts per 15 minutes per IP + account
const loginLimiter = authRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

// Guest anonymous patient token
router.get("/guest-token", getGuestToken);

// Real-Time Validation & Verification (Email & Mobile OTP)
router.get("/check-email", checkEmail);
router.post("/check-email", checkEmail);
router.get("/check-phone", checkPhone);
router.post("/check-phone", checkPhone);
router.post("/send-verification-otp", sendVerificationOtp);
router.post("/send-mobile-otp", sendMobileOtp);
router.post("/verify-mobile-otp", loginLimiter, verifyMobileOtp);
router.post("/verify-signup-phone", verifyMobileOtp);
router.post("/login-mobile", loginLimiter, verifyMobileOtp);

// Password Reset Flow (Protected by rate limiter)
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", loginLimiter, resetPassword);

// Core Authentication
router.post("/signup/superadmin", signupSuperAdmin);
router.post("/signup/admin", signupAdmin);
router.post("/signup/patient", signupPatient);
router.post("/signup", signupPatient);
router.post("/login", loginLimiter, login);
router.post("/logout", optionalAuth, logout);
router.get("/me", optionalAuth, getMe);
router.put("/profile", optionalAuth, updateProfile);
router.put("/primary-hospital", optionalAuth, updateUserPrimaryHospital);
router.get("/users", optionalAuth, getAllUsers);
router.get("/user-history/:email", optionalAuth, getUserHistory);

module.exports = router;
