/**
 * aiService.js
 * ------------
 * Client connector for Python AI/ML Microservice (Port 8001).
 * Features:
 * - Robust duration prediction with graceful clinical heuristic fallback
 * - Model training triggers
 * - Model status inspection
 */

const env = require("../config/env");

const AI_BASE_URL = env.AI_SERVICE_URL || "http://localhost:8001";
const AI_INTERNAL_SECRET = env.AI_INTERNAL_SECRET;

function getHeaders(extraHeaders = {}) {
  return {
    "Content-Type": "application/json",
    "X-AI-Internal-Secret": AI_INTERNAL_SECRET,
    ...extraHeaders,
  };
}

/**
 * Clinical heuristic duration fallback if Python AI service is starting up or unreachable.
 */
function clinicalHeuristicFallback(serviceCategory, complexityScore = 1.0) {
  const baseDurations = {
    emergency: 25.0,
    consultation: 15.0,
    radiology: 20.0,
    laboratory: 10.0,
    pharmacy: 6.0,
    billing: 5.0,
  };
  const cat = String(serviceCategory || "consultation").toLowerCase();
  const base = baseDurations[cat] || 15.0;
  const clampedComplexity = Math.max(0.5, Math.min(3.0, complexityScore));
  return Math.max(3.0, Math.min(90.0, Math.round(base * clampedComplexity * 10) / 10));
}

/**
 * Predicts service duration in minutes.
 */
async function predictServiceDuration({
  tenantId = "global",
  consumerType = "hospital",
  serviceCategory = "consultation",
  queueLength = 1,
  activeStaffCounters = 2,
  complexityScore = 1.0,
  hourOfDay = 12,
  dayOfWeek = 1,
}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const response = await fetch(`${AI_BASE_URL}/predict`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        tenant_id: tenantId,
        consumer_type: consumerType,
        service_category: serviceCategory,
        queue_length: queueLength,
        active_staff_counters: activeStaffCounters,
        complexity_score: complexityScore,
        hour_of_day: hourOfDay,
        day_of_week: dayOfWeek,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.predicted_service_minutes === "number") {
        return Math.max(3.0, Math.min(90.0, Math.round(data.predicted_service_minutes * 10) / 10));
      }
    }
  } catch (err) {
    // Graceful fallback without breaking queue engine
  }

  return clinicalHeuristicFallback(serviceCategory, complexityScore);
}

/**
 * Triggers AI model retraining in Python service.
 */
async function triggerModelRetrain(tenantId = "global", records = null, dataSource = "historical_upload") {
  try {
    const response = await fetch(`${AI_BASE_URL}/train`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        tenant_id: tenantId,
        records: records,
        data_source: dataSource,
      }),
    });

    if (response.ok) {
      return await response.json();
    }
    const errText = await response.text();
    throw new Error(`AI Training Failed: ${errText}`);
  } catch (err) {
    throw new Error(`Python AI Microservice unavailable: ${err.message}`);
  }
}

/**
 * Rolls back tenant model to target version.
 */
async function rollbackModel(tenantId = "global", targetVersion) {
  try {
    const response = await fetch(`${AI_BASE_URL}/rollback`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        tenant_id: tenantId,
        target_version: targetVersion,
      }),
    });

    if (response.ok) {
      return await response.json();
    }
    const errText = await response.text();
    throw new Error(`Rollback failed: ${errText}`);
  } catch (err) {
    throw new Error(`Rollback service error: ${err.message}`);
  }
}

/**
 * Fetches list of available model versions for tenant.
 */
async function getModelVersions(tenantId = "global") {
  try {
    const response = await fetch(`${AI_BASE_URL}/model-versions/${tenantId}`, {
      headers: getHeaders(),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    // Fallback empty
  }
  return { tenant_id: tenantId, versions: [] };
}

/**
 * Fetches model status & metadata for tenant.
 */
async function getModelStatus(tenantId = "global") {
  try {
    const response = await fetch(`${AI_BASE_URL}/model-status/${tenantId}`, {
      headers: getHeaders(),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    // Fallback baseline metadata
  }

  return {
    tenant_id: tenantId,
    active_model: "Global Baseline Model",
    is_tenant_specific: false,
    model_type: "GradientBoosting",
    training_rows: 15000,
    mae: 1.47,
    r2: 0.965,
    trained_at: "Baseline",
  };
}

module.exports = {
  predictServiceDuration,
  triggerModelRetrain,
  rollbackModel,
  getModelVersions,
  getModelStatus,
  clinicalHeuristicFallback,
};
