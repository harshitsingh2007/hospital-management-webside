/**
 * apiFetch.js
 * ------------
 * Resilient fetch wrapper with automated JWT session handling.
 * - Injects Authorization: Bearer <token> from localStorage.
 * - Captures and persists X-Refreshed-Token when issued by backend.
 * - Intercepts HTTP 401: Clears stored credentials and broadcasts
 *   an "auth_session_expired" event for the UI to show an auth modal / redirect.
 */

export async function apiFetch(url, options = {}) {
  const { skipAuthRedirect = false, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});

  // 1. Attach Bearer token from localStorage if not already provided
  if (!headers.has("Authorization")) {
    try {
      const token =
        localStorage.getItem("ai_queue_token") ||
        localStorage.getItem("token") ||
        "";
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch (_) {}
  }

  // 2. Default Content-Type to application/json when sending standard plain object body
  let body = fetchOptions.body;
  if (
    body &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof URLSearchParams)
  ) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(body);
  }

  const mergedOptions = {
    ...fetchOptions,
    headers,
    ...(body !== undefined ? { body } : {}),
  };

  try {
    const response = await fetch(url, mergedOptions);

    // 3. Capture refreshed token if backend returned X-Refreshed-Token
    const refreshedToken =
      response.headers.get("x-refreshed-token") ||
      response.headers.get("X-Refreshed-Token");

    if (refreshedToken) {
      try {
        const currentToken =
          localStorage.getItem("ai_queue_token") ||
          localStorage.getItem("token") ||
          "";
        if (refreshedToken !== currentToken) {
          localStorage.setItem("ai_queue_token", refreshedToken);
          localStorage.setItem("token", refreshedToken);
          window.dispatchEvent(
            new CustomEvent("ai_token_refreshed", {
              detail: { token: refreshedToken },
            })
          );
        }
      } catch (_) {}
    }

    // 4. Handle 401 Unauthorized Session Expired
    // Only dispatch session expired and clear credentials on core auth validation endpoints (/auth/me)
    // or when explicitly requested via requireAuthRedirect: true.
    const isCoreAuthEndpoint = url.includes("/api/v1/auth/me") || url.includes("/api/v1/auth/session");
    if (response.status === 401 && !skipAuthRedirect && (options.requireAuthRedirect === true || isCoreAuthEndpoint)) {
      try {
        localStorage.removeItem("ai_queue_token");
        localStorage.removeItem("token");
        localStorage.removeItem("ai_queue_user");
      } catch (_) {}

      window.dispatchEvent(
        new CustomEvent("auth_session_expired", {
          detail: {
            url,
            status: 401,
            statusText: response.statusText,
          },
        })
      );
    }

    return response;
  } catch (error) {
    throw error;
  }
}

export default apiFetch;

