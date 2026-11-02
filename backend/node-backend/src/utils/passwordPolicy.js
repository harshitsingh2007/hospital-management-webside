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
 * @param {string} password - The plain text password to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }

  const trimmed = password.trim();

  if (trimmed.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }

  if (!/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: "Password must contain at least one letter." };
  }

  if (!/[0-9]/.test(trimmed)) {
    return { valid: false, error: "Password must contain at least one number." };
  }

  if (COMMON_PASSWORDS.has(trimmed.toLowerCase())) {
    return { valid: false, error: "Password is too common. Please choose a more secure password." };
  }

  return { valid: true };
}

module.exports = {
  validatePassword,
  COMMON_PASSWORDS,
};

