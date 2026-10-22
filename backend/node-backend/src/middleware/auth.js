/**
 * auth.js
 * -------
 * Authentication Middleware: Validates JWT Tokens and attaches req.user.
 * Supports temporary legacy header fallback during frontend migration when configured.
 */

const { verifyToken, generateToken } = require("../utils/jwt");
const prisma = require("../config/prisma");
const env = require("../config/env");

async function authenticate(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const candidate = authHeader.split(" ")[1]?.trim();
      if (candidate && candidate !== "undefined" && candidate !== "null") {
        token = candidate;
      }
    }

    const legacyEmail = req.headers["x-user-email"] || req.headers["X-User-Email"];
    const legacyPhone = req.headers["x-user-phone"] || req.headers["X-User-Phone"];

    if (token) {
      const decoded = verifyToken(token);
      if (!decoded) {
        if (env.ALLOW_LEGACY_EMAIL_AUTH && (legacyEmail || legacyPhone)) {
          token = null; // fallback to legacy
        } else {
          return res.status(401).json({
            status: "error",
            success: false,
            message: "Unauthorized: Invalid or expired authentication token.",
          });
        }
      }

      const user = await prisma.users.findUnique({
        where: { id: decoded.id || decoded.userId },
        include: {
          patients: true,
          employees: {
            include: {
              departments: true,
              hospitals: true,
            },
          },
          hospitals: true,
        },
      });

      const DEACTIVATED_STATUSES = ["deactivated", "suspended", "blocked"];
      if (!user || DEACTIVATED_STATUSES.includes(user.status)) {
        return res.status(401).json({
          status: "error",
          success: false,
          message: "Unauthorized: User account not found or deactivated.",
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        phone: user.phone || "",
        patient: user.patients[0] || null,
        employee: user.employees[0] || null,
        ownedHospital: user.hospitals[0] || null,
        primary_hospital_code: user.primary_hospital_code || null,
        hospital_code:
          user.primary_hospital_code ||
          user.employees[0]?.hospitals?.hospital_code ||
          user.hospitals[0]?.hospital_code ||
          (user.role !== "user" ? "city-hospital-01" : null),
        department: user.employees[0]?.departments?.dept_code || "all",
      };

      // Sliding session activity: refresh 15-minute token and attach to response header
      try {
        const refreshedToken = generateToken({
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        }, "15m");
        res.setHeader("X-Refreshed-Token", refreshedToken);
      } catch (e) {}

      return next();
    }

    // Optional legacy header fallback (controlled strictly via environment flag)
    if (env.ALLOW_LEGACY_EMAIL_AUTH && legacyEmail) {
      const cleanEmail = String(legacyEmail).trim().toLowerCase();
      const user = await prisma.users.findFirst({
        where: {
          OR: [{ email: { equals: cleanEmail, mode: "insensitive" } }, { username: { equals: cleanEmail, mode: "insensitive" } }],
        },
        include: {
          patients: true,
          employees: {
            include: {
              departments: true,
              hospitals: true,
            },
          },
          hospitals: true,
        },
      });

      const DEACTIVATED_STATUSES = ["deactivated", "suspended", "blocked"];
      if (user && !DEACTIVATED_STATUSES.includes(user.status)) {
        req.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          phone: user.phone || "",
          patient: user.patients[0] || null,
          employee: user.employees[0] || null,
          ownedHospital: user.hospitals[0] || null,
          primary_hospital_code: user.primary_hospital_code || null,
          hospital_code:
            user.primary_hospital_code ||
            user.employees[0]?.hospitals?.hospital_code ||
            user.hospitals[0]?.hospital_code ||
            (user.role !== "user" ? "city-hospital-01" : null),
          department: user.employees[0]?.departments?.dept_code || "all",
        };
        return next();
      }
    }

    // If neither token nor allowed legacy header present
    return res.status(401).json({
      status: "error",
      success: false,
      message: "Unauthorized: Authentication required.",
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Optional authentication: Populates req.user if token is present, otherwise proceeds as guest.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const legacyEmail = req.headers["x-user-email"] || req.headers["X-User-Email"];
    const legacyPhone = req.headers["x-user-phone"] || req.headers["X-User-Phone"];

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const candidate = authHeader.split(" ")[1]?.trim();
      if (candidate && candidate !== "undefined" && candidate !== "null") {
        token = candidate;
      }
    }

    const DEACTIVATED_STATUSES = ["deactivated", "suspended", "blocked"];

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await prisma.users.findUnique({
          where: { id: decoded.id || decoded.userId },
          include: {
            patients: true,
            employees: {
              include: {
                departments: true,
                hospitals: true,
              },
            },
            hospitals: true,
          },
        });
        if (user && !DEACTIVATED_STATUSES.includes(user.status)) {
          req.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status,
            phone: user.phone || "",
            patient: user.patients[0] || null,
            employee: user.employees[0] || null,
            ownedHospital: user.hospitals[0] || null,
            primary_hospital_code: user.primary_hospital_code || null,
            hospital_code:
              user.primary_hospital_code ||
              user.employees[0]?.hospitals?.hospital_code ||
              user.hospitals[0]?.hospital_code ||
              (user.role !== "user" ? "city-hospital-01" : null),
            department: user.employees[0]?.departments?.dept_code || "all",
          };
        }
      }
    } else if (legacyEmail) {
      const cleanEmail = String(legacyEmail).trim().toLowerCase();
      const user = await prisma.users.findFirst({
        where: {
          OR: [{ email: { equals: cleanEmail, mode: "insensitive" } }, { username: { equals: cleanEmail, mode: "insensitive" } }],
        },
        include: {
          patients: true,
          employees: {
            include: {
              departments: true,
              hospitals: true,
            },
          },
          hospitals: true,
        },
      });
      if (user && !DEACTIVATED_STATUSES.includes(user.status)) {
        req.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          phone: user.phone || "",
          patient: user.patients[0] || null,
          employee: user.employees[0] || null,
          ownedHospital: user.hospitals[0] || null,
          primary_hospital_code: user.primary_hospital_code || null,
          hospital_code:
            user.primary_hospital_code ||
            user.employees[0]?.hospitals?.hospital_code ||
            user.hospitals[0]?.hospital_code ||
            (user.role !== "user" ? "city-hospital-01" : null),
          department: user.employees[0]?.departments?.dept_code || "all",
        };
      }
    }

    return next();
  } catch (error) {
    return next();
  }
}

module.exports = {
  authenticate,
  optionalAuth,
};
