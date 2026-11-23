/**
 * hospitalConfig.js
 * -----------------
 * Global configuration constants for Hospital Queue System.
 */

const isProduction = import.meta.env.PROD;
const envApiUrl = import.meta.env.VITE_API_URL;
const envSocketUrl = import.meta.env.VITE_SOCKET_URL;

if (isProduction && (!envApiUrl || !envSocketUrl)) {
  const missing = [];
  if (!envApiUrl) missing.push("VITE_API_URL");
  if (!envSocketUrl) missing.push("VITE_SOCKET_URL");
  console.error(`[Config Error] Missing environment variable(s) in production: ${missing.join(", ")}`);
  throw new Error(`Production configuration error: Missing required environment variable(s): ${missing.join(", ")}`);
}

export const API_BASE = envApiUrl || "http://127.0.0.1:8000";
export const WS_URL = envSocketUrl || "http://127.0.0.1:8000";

export const HOSPITAL_CONFIG = {
  tenantId: "city-hospital-01",
  name: "Hex Visionaries",
  consumerType: "hospital",
  categories: [
    { id: "consultation", label: "General Consultation (OPD)" },
    { id: "pharmacy", label: "Pharmacy & Medicine" },
    { id: "laboratory", label: "Pathology & Lab Test" },
    { id: "radiology", label: "Radiology & X-Ray" },
    { id: "emergency", label: "Emergency Triage" },
  ],
};
