import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './src/App'

// Intercept window.fetch to automatically capture sliding session refreshed tokens
if (typeof window !== "undefined" && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const refreshedToken = response.headers?.get?.("x-refreshed-token") || response.headers?.get?.("X-Refreshed-Token");
      if (refreshedToken) {
        localStorage.setItem("ai_queue_token", refreshedToken);
        const savedUserStr = localStorage.getItem("ai_queue_user");
        if (savedUserStr) {
          try {
            const userObj = JSON.parse(savedUserStr);
            userObj.token = refreshedToken;
            localStorage.setItem("ai_queue_user", JSON.stringify(userObj));
          } catch (e) {}
        }
      }
    } catch (e) {}
    return response;
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
