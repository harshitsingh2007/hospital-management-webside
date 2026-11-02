/**
 * rateLimiter.js
 * --------------
 * In-memory sliding window rate limiter for login and password reset endpoints.
 * Limit: 5 failed attempts per 15 minutes per IP + account.
 * When limit exceeded, responds with HTTP 429.
 */

// Key: `${ip}:${account}` -> { count: number, resetAt: number }
const attemptsStore = new Map();

// Periodic cleanup of expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of attemptsStore.entries()) {
    if (now >= data.resetAt) {
      attemptsStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Middleware factory for rate limiting failed authentication attempts.
 * @param {Object} options
 * @param {number} options.maxAttempts - Maximum failed attempts allowed (default: 5)
 * @param {number} options.windowMs - Sliding window in ms (default: 15 mins)
 */
function authRateLimiter({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"] || "unknown_ip";
    const account = (
      req.body?.email ||
      req.body?.username ||
      req.body?.phone ||
      req.params?.user_id ||
      "generic"
    ).trim().toLowerCase();

    const key = `${ip}:${account}`;
    const now = Date.now();
    const record = attemptsStore.get(key);

    if (record) {
      if (now < record.resetAt) {
        if (record.count >= maxAttempts) {
          const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
          res.setHeader("Retry-After", String(retryAfterSeconds));
          return res.status(429).json({
            status: "error",
            message: `Too many failed attempts. Please try again in ${retryAfterSeconds} seconds.`,
            retry_after_seconds: retryAfterSeconds,
          });
        }
      } else {
        // Window expired, reset
        attemptsStore.delete(key);
      }
    }

    // Intercept response to count failures (status 400, 401, 403)
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const statusCode = res.statusCode;
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 404 && statusCode !== 429) {
        const cur = attemptsStore.get(key);
        if (!cur || Date.now() >= cur.resetAt) {
          attemptsStore.set(key, { count: 1, resetAt: Date.now() + windowMs });
        } else {
          cur.count += 1;
        }
      } else if (statusCode >= 200 && statusCode < 300) {
        // Success clears the failed attempts
        attemptsStore.delete(key);
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  authRateLimiter,
  attemptsStore, // exported for unit testing
};

