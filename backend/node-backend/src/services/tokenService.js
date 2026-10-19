/**
 * tokenService.js
 * ----------------
 * Manages secure OTP codes and verification tokens for Email Verification,
 * Mobile Verification, and Password Reset.
 * Includes 5-minute expiry, rate limiting, and maximum 3 attempts per OTP.
 */

const crypto = require("crypto");
const prisma = require("../config/prisma");

/**
 * Generates a cryptographically strong 6-digit numeric OTP.
 */
function generateNumericOtp() {
  const buf = crypto.randomBytes(4);
  const num = (buf.readUInt32BE(0) % 900000) + 100000;
  return String(num);
}

/**
 * Checks rate limiting for OTP generation.
 * - Minimum 30-second cooldown between consecutive requests
 * - Maximum 5 requests per 15-minute rolling window
 *
 * @param {string} identifier - Email or clean phone number
 * @param {string} type - Token type (e.g. "mobile_verification")
 * @param {number} minCooldownSeconds - Default 30 seconds
 * @param {number} maxPerWindow - Default 5 requests
 * @returns {Promise<{ allowed: boolean, retryAfterSeconds?: number, message?: string }>}
 */
async function checkRateLimit(identifier, type, minCooldownSeconds = 30, maxPerWindow = 5) {
  const cleanId = String(identifier || "").trim().toLowerCase();
  if (!cleanId) return { allowed: true };

  try {
    // 1. Check last request cooldown (min 30 seconds)
    const recentRows = await prisma.$queryRawUnsafe(
      `SELECT EXTRACT(EPOCH FROM (NOW() - "created_at"))::int AS elapsed_seconds
       FROM "verification_tokens"
       WHERE "email" = $1 AND "type" = $2
       ORDER BY "created_at" DESC
       LIMIT 1`,
      cleanId,
      type
    );

    if (Array.isArray(recentRows) && recentRows.length > 0) {
      const elapsed = recentRows[0].elapsed_seconds;
      if (elapsed !== null && elapsed < minCooldownSeconds) {
        const remaining = Math.max(1, minCooldownSeconds - elapsed);
        return {
          allowed: false,
          retryAfterSeconds: remaining,
          message: `Please wait ${remaining}s before requesting a new OTP.`,
        };
      }
    }

    // 2. Check rolling window limit (max 5 requests per 15 mins)
    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count
       FROM "verification_tokens"
       WHERE "email" = $1 AND "type" = $2
         AND "created_at" > (NOW() - INTERVAL '15 minutes')`,
      cleanId,
      type
    );

    const count = Array.isArray(countRows) && countRows.length > 0 ? countRows[0].count : 0;
    if (count >= maxPerWindow) {
      return {
        allowed: false,
        retryAfterSeconds: 300,
        message: "Too many OTP requests for this number/account. Please wait a few minutes before trying again.",
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[TokenService] Rate limit check error:", err);
    return { allowed: true }; // Fail-open on DB query error to not block legitimate users
  }
}

/**
 * Creates and stores a new OTP token for an email or mobile phone.
 * Invalidates any existing unused tokens of the same type for this identifier.
 * Default expiry: 5 minutes.
 *
 * @param {string} identifier - Email or clean phone number
 * @param {"email_verification" | "password_reset" | "mobile_verification"} type
 * @param {number} expiresInMinutes - Default 5 minutes
 */
async function createVerificationOtp(identifier, type, expiresInMinutes = 5) {
  const cleanId = String(identifier || "").trim().toLowerCase();
  const otp = generateNumericOtp();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  try {
    // 1. Invalidate previous unused tokens for this identifier and type
    await prisma.$executeRawUnsafe(
      `UPDATE "verification_tokens" SET "used" = true WHERE "email" = $1 AND "type" = $2 AND "used" = false`,
      cleanId,
      type
    ).catch(() => {});

    // 2. Insert new token with 0 attempts
    await prisma.$executeRawUnsafe(
      `INSERT INTO "verification_tokens" ("email", "token", "type", "expires_at", "used", "created_at", "attempts") VALUES ($1, $2, $3, $4, false, NOW(), 0)`,
      cleanId,
      otp,
      type,
      expiresAt
    );

    return { otp, expiresAt, expiresInMinutes };
  } catch (err) {
    console.error("[TokenService] Error saving verification token:", err);
    throw err;
  }
}

/**
 * Verifies an OTP code with detailed status, tracking up to 3 maximum attempts.
 *
 * @param {string} identifier - Email or clean phone number
 * @param {string} token - User-entered OTP code
 * @param {"email_verification" | "password_reset" | "mobile_verification"} type
 * @param {boolean} markUsed - Whether to mark used on success
 * @returns {Promise<{ valid: boolean, message?: string, remainingAttempts?: number, maxAttemptsExceeded?: boolean }>}
 */
async function verifyOtpDetailed(identifier, token, type, markUsed = true) {
  const cleanId = String(identifier || "").trim().toLowerCase();
  const cleanToken = String(token || "").trim();

  if (!cleanId || !cleanToken) {
    return { valid: false, message: "Verification code and destination identifier are required." };
  }

  try {
    // 1. Check for active, unused, non-expired token
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "verification_tokens" 
       WHERE "email" = $1 
         AND "type" = $2 
         AND "used" = false 
         AND "expires_at" > NOW() 
       ORDER BY "created_at" DESC 
       LIMIT 1`,
      cleanId,
      type
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      // Check if token exists but expired or locked out
      const recentRows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "verification_tokens"
         WHERE "email" = $1 AND "type" = $2
         ORDER BY "created_at" DESC
         LIMIT 1`,
        cleanId,
        type
      );

      if (Array.isArray(recentRows) && recentRows.length > 0) {
        const lastRec = recentRows[0];
        if ((lastRec.attempts || 0) >= 3) {
          return {
            valid: false,
            maxAttemptsExceeded: true,
            remainingAttempts: 0,
            message: "Maximum verification attempts exceeded (3/3). Please request a new OTP.",
          };
        }
        if (new Date(lastRec.expires_at) <= new Date()) {
          return {
            valid: false,
            message: "Verification code has expired (valid for 5 minutes). Please request a new OTP.",
          };
        }
      }

      return {
        valid: false,
        message: "Invalid or expired verification code. Please request a new OTP.",
      };
    }

    const matchedRecord = rows[0];
    const currentAttempts = matchedRecord.attempts || 0;

    // Check if already reached max attempts
    if (currentAttempts >= 3) {
      await prisma.$executeRawUnsafe(
        `UPDATE "verification_tokens" SET "used" = true WHERE "id" = $1`,
        matchedRecord.id
      ).catch(() => {});

      return {
        valid: false,
        maxAttemptsExceeded: true,
        remainingAttempts: 0,
        message: "Maximum verification attempts exceeded (3/3). Please request a new OTP.",
      };
    }

    // Check match
    if (matchedRecord.token === cleanToken) {
      if (markUsed) {
        await prisma.$executeRawUnsafe(
          `UPDATE "verification_tokens" SET "used" = true WHERE "id" = $1`,
          matchedRecord.id
        ).catch(() => {});
      }
      return { valid: true };
    }

    // Mismatch -> increment attempts
    const newAttempts = currentAttempts + 1;
    if (newAttempts >= 3) {
      await prisma.$executeRawUnsafe(
        `UPDATE "verification_tokens" SET "attempts" = 3, "used" = true WHERE "id" = $1`,
        matchedRecord.id
      ).catch(() => {});

      return {
        valid: false,
        maxAttemptsExceeded: true,
        remainingAttempts: 0,
        message: "Incorrect OTP. Maximum attempts exceeded (3/3). Please request a new OTP.",
      };
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "verification_tokens" SET "attempts" = $1 WHERE "id" = $2`,
      newAttempts,
      matchedRecord.id
    ).catch(() => {});

    const remaining = 3 - newAttempts;
    return {
      valid: false,
      maxAttemptsExceeded: false,
      attempts: newAttempts,
      remainingAttempts: remaining,
      message: `Incorrect OTP code. ${remaining} attempt(s) remaining.`,
    };
  } catch (err) {
    console.error("[TokenService] Error verifying token:", err);
    return { valid: false, message: "Error verifying OTP code. Please try again." };
  }
}

/**
 * Standard boolean verification for backwards compatibility.
 */
async function verifyOtp(identifier, token, type, markUsed = true) {
  const result = await verifyOtpDetailed(identifier, token, type, markUsed);
  return Boolean(result.valid);
}

module.exports = {
  createVerificationOtp,
  verifyOtpDetailed,
  verifyOtp,
  checkRateLimit,
  generateNumericOtp,
};
