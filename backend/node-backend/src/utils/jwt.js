/**
 * jwt.js
 * ------
 * JWT Token Generation & Verification utilities.
 */

const jwt = require("jsonwebtoken");
const env = require("../config/env");

function generateToken(payload, expiresIn = env.JWT_EXPIRES_IN || "30d") {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
};
