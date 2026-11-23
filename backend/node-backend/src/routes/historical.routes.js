/**
 * historical.routes.js
 * --------------------
 * Historical data preview, upload, validation, ML training, rollback, and continuous learning monitoring router.
 */

const express = require("express");
const {
  previewHistoricalDataEndpoint,
  uploadHistoricalDataEndpoint,
  trainModelEndpoint,
  rollbackModelEndpoint,
  getModelVersionsEndpoint,
  toggleAutoLearningEndpoint,
  getModelMonitoringEndpoint,
  getModelStatusEndpoint,
} = require("../controllers/historical.controller");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { requireMLAdminAccess } = require("../middleware/mlAuth");

const router = express.Router();

// Preview & Upload
router.post(
  "/plugin/historical-data/preview",
  authenticate,
  requireMLAdminAccess,
  previewHistoricalDataEndpoint
);
router.post(
  "/plugin/historical-data/upload",
  authenticate,
  requireMLAdminAccess,
  uploadHistoricalDataEndpoint
);

// Retraining endpoints (support both paths)
router.post(
  "/plugin/historical-data/train",
  authenticate,
  requireMLAdminAccess,
  trainModelEndpoint
);
router.post(
  "/plugin/train-model",
  authenticate,
  requireMLAdminAccess,
  trainModelEndpoint
);

// Rollback & Versioning
router.post(
  "/plugin/rollback-model",
  authenticate,
  requireMLAdminAccess,
  rollbackModelEndpoint
);
router.get(
  "/plugin/model-versions/:tenant_id",
  authenticate,
  requireMLAdminAccess,
  getModelVersionsEndpoint
);

// Auto-learning and Global pooling toggles
router.post(
  "/plugin/toggle-auto-learning",
  authenticate,
  requireMLAdminAccess,
  toggleAutoLearningEndpoint
);

// Model Drift Monitoring & Status
router.get(
  "/plugin/model-monitoring/:tenant_id",
  authenticate,
  requireMLAdminAccess,
  getModelMonitoringEndpoint
);
router.get(
  "/plugin/model-status/:tenant_id",
  optionalAuth,
  getModelStatusEndpoint
);

module.exports = router;
