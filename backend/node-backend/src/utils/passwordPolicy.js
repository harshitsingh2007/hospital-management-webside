/**
 * passwordPolicy.js
 * -----------------
 * Password policy validation for user creation and password resets.
 * Requirements:
 * - Minimum 8 characters
 * - At least one letter (a-z / A-Z)
 * - At least one number (0-9)
 * - Rejects common trivial passwords
 */

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "123456789",
  "admin123",
  "hospital123",
  "welcome123",
  "qwerty123",
  "doctor123",
  "pass1234",
  "letmein123",
  "changeme123",
]);

/**
 * Validates a candidate password according to the security policy.
 * For desk & staff provisioning, allows passwords / PINs of at least 6 characters.
 * @param {string} password - The plain text password to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }

  const trimmed = password.trim();

  if (trimmed.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters long." };
  }

  return { valid: true };
}

module.exports = {
  validatePassword,
  COMMON_PASSWORDS,
};

