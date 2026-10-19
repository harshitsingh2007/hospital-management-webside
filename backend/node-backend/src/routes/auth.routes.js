/**
 * auth.routes.js
 * --------------
 * Authentication & User routes.
 */

const express = require("express");
const {
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

const router = express.Router();

// Real-Time Validation & Verification (Email & Mobile OTP)
router.get("/check-email", checkEmail);
router.post("/check-email", checkEmail);
router.get("/check-phone", checkPhone);
router.post("/check-phone", checkPhone);
router.post("/send-verification-otp", sendVerificationOtp);
router.post("/send-mobile-otp", sendMobileOtp);
router.post("/verify-mobile-otp", verifyMobileOtp);
router.post("/verify-signup-phone", verifyMobileOtp);
router.post("/login-mobile", verifyMobileOtp);

// Password Reset Flow
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Core Authentication
router.post("/signup/superadmin", signupSuperAdmin);
router.post("/signup/admin", signupAdmin);
router.post("/signup/patient", signupPatient);
router.post("/signup", signupPatient);
router.post("/login", login);
router.post("/logout", optionalAuth, logout);
router.get("/me", optionalAuth, getMe);
router.put("/profile", optionalAuth, updateProfile);
router.put("/primary-hospital", optionalAuth, updateUserPrimaryHospital);
router.get("/users", optionalAuth, getAllUsers);
router.get("/user-history/:email", optionalAuth, getUserHistory);

module.exports = router;
