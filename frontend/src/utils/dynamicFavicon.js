/**
 * dynamicFavicon.js
 * -----------------
 * Manages the browser tab icon (favicon) and title dynamically based on
 * the active portal (Super Admin vs Hospital White-Labeling Tenant).
 *
 * Scoping Rule:
 * 1. Super Admin Portal: Always displays the exclusive Super Admin Cyber Shield Favicon (never individual hospital tenant logos).
 * 2. Hospital Tenant (Patients & Staff): Displays the custom hospital logo uploaded by Super Admin.
 * 3. Default: Standard clinical AI Queue Favicon.
 */

export const DEFAULT_FAVICON_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230284C7'%3E%3Cpath d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z'/%3E%3C/svg%3E";

export const SUPER_ADMIN_FAVICON_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230EA5E9'/%3E%3Cstop offset='100%25' stop-color='%230369A1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z' fill='%230F172A' stroke='%2338BDF8' stroke-width='1.5'/%3E%3Cpath d='M12 7v10M7 12h10' stroke='url(%23g)' stroke-width='2.5' stroke-linecap='round'/%3E%3Ccircle cx='12' cy='12' r='2' fill='%2338BDF8'/%3E%3C/svg%3E";

/**
 * Updates the browser tab favicon and document title.
 *
 * @param {Object} options
 * @param {string|null} options.logoUrl - The hospital logo URL or base64 data URI uploaded by Super Admin.
 * @param {string|null} options.hospitalName - The hospital name.
 * @param {boolean} options.isAffiliate - True if the visitor is an affiliate patient or staff member of this hospital.
 * @param {boolean} options.isSuperAdmin - True if current user is in the Super Admin portal.
 * @param {string} [options.role] - Current user role (e.g., "doctor", "nurse", "staff", "patient", "super_admin").
 */
export function updateBrowserTabBrand({
  logoUrl = null,
  hospitalName = null,
  isAffiliate = false,
  isSuperAdmin = false,
  role = "",
} = {}) {
  if (typeof document === "undefined") return;

  // 1. Determine target icon URL
  const hasCustomLogo = Boolean(logoUrl && typeof logoUrl === "string" && logoUrl.trim().length > 0);
  let targetIcon = DEFAULT_FAVICON_SVG;

  if (isSuperAdmin) {
    // Super Admin portal always receives the distinctive Super Admin Shield favicon
    targetIcon = SUPER_ADMIN_FAVICON_SVG;
  } else if (isAffiliate && hasCustomLogo) {
    // Tenant patients & hospital staff get the tenant hospital logo
    targetIcon = logoUrl.trim();
  }

  // 2. Update favicon in browser head (robust replace pattern for Chromium & Firefox)
  try {
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    const link = document.createElement("link");
    link.id = "app-dynamic-favicon";
    link.rel = "shortcut icon";

    if (targetIcon.startsWith("data:image/svg") || targetIcon.includes(".svg")) {
      link.type = "image/svg+xml";
    } else if (targetIcon.startsWith("data:image/png") || targetIcon.includes(".png")) {
      link.type = "image/png";
    } else if (targetIcon.startsWith("data:image/jpeg") || targetIcon.includes(".jpg") || targetIcon.includes(".jpeg")) {
      link.type = "image/jpeg";
    } else if (targetIcon.startsWith("data:image/webp") || targetIcon.includes(".webp")) {
      link.type = "image/webp";
    } else if (targetIcon.includes(".ico")) {
      link.type = "image/x-icon";
    }

    link.href = targetIcon;
    document.head.appendChild(link);
  } catch (err) {
    console.log("Favicon update error:", err);
  }

  // 3. Update document title
  try {
    if (isSuperAdmin) {
      document.title = "AI-Queue | Super Admin Portal";
    } else if (isAffiliate && hospitalName && hospitalName.trim().length > 0 && role) {
      const cleanName = hospitalName.trim();
      const roleStr = String(role || "").toLowerCase();
      let portalSuffix = "Patient Portal";

      if (["doctor", "staff", "receptionist", "admin"].includes(roleStr)) {
        portalSuffix = roleStr === "doctor"
          ? "Doctor Portal"
          : "Reception Portal";
      }

      document.title = `${cleanName} | ${portalSuffix}`;
    } else {
      const isSignup = typeof window !== "undefined" && (
        window.location.search.toLowerCase().includes("reg") ||
        window.location.search.toLowerCase().includes("signup") ||
        window.location.hash.toLowerCase().includes("reg") ||
        window.location.hash.toLowerCase().includes("signup") ||
        window.location.pathname.toLowerCase().includes("reg") ||
        window.location.pathname.toLowerCase().includes("signup")
      );
      document.title = isSignup ? "Signup" : "Login";
    }
  } catch (err) {
    console.log("Document title update error:", err);
  }
}

