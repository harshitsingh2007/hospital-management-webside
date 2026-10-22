/**
 * broadcast.controller.js
 * -----------------------
 * Controller endpoints for Network-Wide Emergency Broadcasts & Announcements.
 */

const {
  getActiveBroadcasts,
  getAllBroadcasts,
  createBroadcast,
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
    const broadcasts = getAllBroadcasts();
    return res.status(200).json({
      status: "success",
      count: broadcasts.length,
      broadcasts,
    });
  } catch (error) {
    next(error);
  }
}

async function createBroadcastEndpoint(req, res, next) {
  try {
    const io = req.app?.get("io") || getIo();
    const payload = req.body || {};

    if (!payload.title && !payload.message) {
      return res.status(400).json({
        status: "error",
        message: "Title or message content is required to broadcast an announcement.",
      });
    }

    const broadcast = await createBroadcast(payload, io, req.user);
    return res.status(201).json({
      status: "success",
      message: "Emergency broadcast pushed successfully via WebSockets.",
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
  createBroadcastEndpoint,
  dismissBroadcastEndpoint,
};
