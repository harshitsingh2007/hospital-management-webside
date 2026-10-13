/**
 * env.js
 * ------
 * Typed environment config. Values come only from backend/.env
 * (loaded via loadEnv.js).
 */

require("../../loadEnv");

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "8000", 10),
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  HOSPITAL_TIMEZONE: process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:8001",
  AI_SERVICE_PORT: parseInt(process.env.AI_SERVICE_PORT || "8001", 10),
  ALLOW_LEGACY_EMAIL_AUTH: process.env.ALLOW_LEGACY_EMAIL_AUTH !== "false",
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "Hex Visionaries <noreply@hexvisionaries.com>",
  FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY || "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "",
  TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID || "",
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || "",
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID || "",
};
