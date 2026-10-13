/**
 * app.js
 * ------
 * Express Application Setup: Security, CORS, Body Parsers, Routes, Error Handler.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Security headers (allowing cross-origin images/resources where required)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
const allowedOrigins = [
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-User-Email",
      "x-user-email",
      "X-User-Phone",
      "x-user-phone",
      "X-Hospital-Code",
      "x-hospital-code",
      "x-requested-with",
    ],
  })
);

// Body Parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// HTTP Request Logging
if (env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// API Routes
app.use("/", routes);

// 404 Fallback - Always return JSON for API requests
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    detail: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
