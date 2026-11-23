/**
 * rateLimiter.js
 * --------------
 * Production-ready rate limiting using express-rate-limit.
 * Features:
 * - General API rate limiter
 * - Dedicated login rate limiter with per-IP + per-account tracking and lockout headers
 * - Strict limits for Signup, OTP, Password Reset, and Public Ticket creation
 * - Bypasses/higher limits during test runs (unless explicitly testing rate limits)
 */

const { rateLimit } = require("express-rate-limit");
const env = require("../config/env");

const isTest = env.NODE_ENV === "test";

function createRateLimiter(options) {
  const { skipTest, handler: customHandler, message, ...restOptions } = options;

  const handler = customHandler || ((req, res) => {
    const retryAfter = Math.ceil((options.windowMs || 900000) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      status: "error",
      code: "RATE_LIMIT_EXCEEDED",
      message: message || "Too many requests. Please try again later.",
      retry_after_seconds: retryAfter,
    });
  });

  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    ...restOptions,
    handler,
    skip: (req) => {
      if (skipTest && isTest && !req.headers["x-test-rate-limit"]) {
        return true;
      }
      return false;
    },
  });
}

// 1. General API traffic limiter (300 requests per 15 mins)
const globalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Global rate limit exceeded. Please throttle requests.",
  skipTest: true,
});

// 2. Login rate limiter with per-IP + per-account keying and lockout
// 5 attempts per 15 minutes
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many failed login attempts. Your account/IP is temporarily locked. Please try again in 15 minutes.",
  keyGenerator: (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const account = String(req.body?.email || req.body?.username || req.body?.phone || "generic").trim().toLowerCase();
    return `${ip}:${account}`;
  },
  skipSuccessfulRequests: true,
  skipTest: true,
});

// 3. Signup rate limiter (5 registrations per hour per IP)
const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many account registrations from this IP address. Please try again later.",
  skipTest: true,
});

// 4. OTP request & verify rate limiter (5 attempts per 10 minutes)
const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Please wait 10 minutes before requesting again.",
  keyGenerator: (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const target = String(req.body?.email || req.body?.phone || "").trim().toLowerCase();
    return `otp:${ip}:${target}`;
  },
  skipTest: true,
});

// 5. Password Reset limiter (3 attempts per 15 minutes)
const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many password reset requests. Please wait 15 minutes.",
  skipTest: true,
});

// 6. Public Ticket creation limiter (10 tickets per 15 mins per IP)
const publicTicketLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Public queue ticket generation rate limit exceeded. Please wait before taking more tickets.",
  skipTest: true,
});

// Legacy backward compatibility export
const authRateLimiter = ({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) => {
  return loginLimiter;
};

module.exports = {
  globalLimiter,
  loginLimiter,
  signupLimiter,
  otpLimiter,
  passwordResetLimiter,
  publicTicketLimiter,
  authRateLimiter,
};
