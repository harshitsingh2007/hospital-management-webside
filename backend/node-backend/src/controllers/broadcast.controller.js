/**
 * broadcast.controller.js
 * -----------------------
 * Controller endpoints for Network-Wide Emergency Broadcasts & Announcements.
 */

const {
  getActiveBroadcasts,
  getBroadcastHistory,
  getBroadcastStats,
  createBroadcast,
  extendBroadcast,
  dismissBroadcast,
} = require("../services/broadcastService");
const { getIo } = require("../socket");

async function getActiveBroadcastsEndpoint(req, res, next) {
  try {
    const hospitalCode = req.query.hospital_code || req.query.hospital || null;
    const broadcasts = getActiveBroadcasts(hospitalCode);
    return res.status(200).json({
      status: "success",
      count: broadcasts.length,
      broadcasts,
    });
  } catch (error) {
    next(error);
  }
}

async function getAllBroadcastsEndpoint(req, res, next) {
  try {
    const {
      page = 1,
      page_size = 10,
      q = "",
      type = "all",
      status = "all",
      hospital_code = "all",
      from = null,
      to = null,
    } = req.query;

    const result = await getBroadcastHistory({
      page,
      page_size,
      q,
      type,
      status,
      hospital_code,
      from,
      to,
    });

    return res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function getBroadcastStatsEndpoint(req, res, next) {
  try {
    const io = req.app?.get("io") || getIo();
    const stats = await getBroadcastStats(io);
    return res.status(200).json({
      status: "success",
      stats,
    });
  } catch (error) {
    next(error);
  }
}

async function createBroadcastEndpoint(req, res, next) {
  try {
    const io = req.app?.get("io") || getIo();
    const payload = req.body || {};

    if (!payload.title || !String(payload.title).trim()) {
      return res.status(400).json({
        status: "error",
        message: "Headline is required to broadcast an announcement.",
      });
    }

    if (!payload.hospital_code || !String(payload.hospital_code).trim()) {
      return res.status(400).json({
        status: "error",
        message: "Target facility (or 'all' for network-wide) must be selected.",
      });
    }

    const broadcast = await createBroadcast(payload, io, req.user);
    return res.status(201).json({
      status: "success",
      message: broadcast.status === "scheduled"
        ? "Broadcast scheduled successfully."
        : "Emergency broadcast pushed successfully via WebSockets.",
      broadcast,
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({
        status: "error",
        code: error.code || "RATE_LIMITED",
        wait_seconds: error.wait_seconds,
        message: error.message,
      });
    }
    next(error);
  }
}

async function extendBroadcastEndpoint(req, res, next) {
  try {
    const io = req.app?.get("io") || getIo();
    const id = req.params.id;
    const minutes = parseInt(req.body?.minutes, 10) || 15;

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Broadcast ID is required for extension.",
      });
    }

    const broadcast = await extendBroadcast(id, minutes, io, req.user);
    return res.status(200).json({
      status: "success",
      message: `Broadcast extended by ${minutes} minutes.`,
      broadcast,
    });
  } catch (error) {
    next(error);
  }
}

async function dismissBroadcastEndpoint(req, res, next) {
  try {
    const io = req.app?.get("io") || getIo();
    const id = req.params.id;

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Broadcast ID is required for dismissal.",
      });
    }

    const result = await dismissBroadcast(id, io, req.user);
    return res.status(200).json({
      status: "success",
      message: "Broadcast dismissed and removed from all connected screens.",
      result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getActiveBroadcastsEndpoint,
  getAllBroadcastsEndpoint,
  getBroadcastStatsEndpoint,
  createBroadcastEndpoint,
  extendBroadcastEndpoint,
  dismissBroadcastEndpoint,
};
