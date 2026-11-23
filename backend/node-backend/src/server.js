/**
 * server.js
 * ---------
 * Node.js & Socket.IO HTTP Server Entrypoint.
 * Features:
 * - Bootstraps Express & Socket.IO
 * - Hydrates in-memory priority queue from PostgreSQL
 * - Starts distributed daily expiration scheduler
 * - Handles Graceful Shutdown (SIGINT, SIGTERM)
 */

const http = require("http");
const app = require("./app");
const env = require("./config/env");
const prisma = require("./config/prisma");
const { initSocket } = require("./socket");
const engine = require("./services/queueEngine");
const { startDailyClosureJob, stopDailyClosureJob } = require("./jobs/dailyClosureJob");
const { startAutoRetrainJob, stopAutoRetrainJob } = require("./jobs/autoRetrainJob");
const { seedDefaultKiosks } = require("./utils/seedKiosks");

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server, env.FRONTEND_URL || "*");

function validateProductionConfig() {
  if (env.NODE_ENV === "production") {
    const missing = [];
    if (!env.JWT_SECRET || String(env.JWT_SECRET).length < 32) {
      missing.push("JWT_SECRET (must be at least 32 characters long)");
    }
    if (!env.AI_INTERNAL_SECRET || String(env.AI_INTERNAL_SECRET).length < 16) {
      missing.push("AI_INTERNAL_SECRET (must be at least 16 characters long)");
    }
    if (!env.DATABASE_URL) missing.push("DATABASE_URL");
    if (!env.FRONTEND_URL) missing.push("FRONTEND_URL");

    if (missing.length > 0) {
      const errMsg = `[FATAL STARTUP ERROR] Missing or insecure production environment variables:\n${missing.map((m) => `  - ${m}`).join("\n")}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
  }
}

async function startServer() {
  try {
    // 0. Validate production secrets
    validateProductionConfig();

    // 1. Verify Database Connection
    await prisma.$connect();
    console.log("[PostgreSQL] Connected successfully via Prisma ORM.");

    // 2. Hydrate today's active queues into in-memory heaps
    await engine.hydrateFromDb();

    // 3. Seed default kiosks if not already present
    await seedDefaultKiosks();

    // 4. Start background distributed daily closure worker
    startDailyClosureJob(60000);

    // 5. Start background continuous learning retrain worker
    startAutoRetrainJob(3600000);

    // 6. Start HTTP & WebSocket server
    server.listen(env.PORT, () => {
      console.log(`[Node.js Backend] Server running on http://localhost:${env.PORT} (Mode: ${env.NODE_ENV})`);
      console.log(`[Socket.IO] Real-time engine attached and ready.`);
    });
  } catch (error) {
    console.error("[Fatal Startup Error]", error);
    process.exit(1);
  }
}

// Graceful Shutdown
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  // Stop background jobs
  stopDailyClosureJob();
  stopAutoRetrainJob();

  // Close HTTP server
  server.close(async () => {
    console.log("[Server] HTTP and Socket.IO connections closed.");

    try {
      await prisma.$disconnect();
      console.log("[PostgreSQL] Prisma client disconnected.");
    } catch (e) {
      console.error("[PostgreSQL] Disconnect error:", e);
    }

    process.exit(0);
  });

  // Force exit if hanging
  setTimeout(() => {
    console.error("[Server] Forcefully shutting down after timeout.");
    process.exit(1);
  }, 5000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

if (require.main === module) {
  startServer();
}

module.exports = { server, startServer, validateProductionConfig };
