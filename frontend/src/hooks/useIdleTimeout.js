import { useEffect, useRef } from "react";

const STORAGE_KEY = "ai_queue_last_active";
const THROTTLE_MS = 5000; // 5 seconds
const CHECK_INTERVAL_MS = 10000; // 10 seconds

/**
 * useIdleTimeout
 * --------------
 * Automatic inactivity logout hook with zero popups or countdown modals.
 * Monitors user interaction, syncs across tabs via localStorage, and logs out
 * immediately when the threshold is exceeded.
 */
export function useIdleTimeout({ timeoutMinutes = 15, onTimeout, isEnabled = true }) {
  const onTimeoutRef = useRef(onTimeout);
  const isTimedOutRef = useRef(false);
  const lastWriteRef = useRef(0);

  // Keep onTimeout in a ref so a changing callback never resets the timer
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!isEnabled) {
      isTimedOutRef.current = false;
      return;
    }

    const timeoutMs = timeoutMinutes * 60 * 1000;

    const checkTimeout = () => {
      if (isTimedOutRef.current) return;

      const stored = localStorage.getItem(STORAGE_KEY);
      const lastActive = stored ? parseInt(stored, 10) : Date.now();
      const elapsed = Date.now() - lastActive;

      if (elapsed >= timeoutMs) {
        isTimedOutRef.current = true;
        if (typeof onTimeoutRef.current === "function") {
          onTimeoutRef.current();
        }
      }
    };

    // 1. Immediate mount check: If stored last-active is already older than the limit, log out immediately
    const initialStored = localStorage.getItem(STORAGE_KEY);
    if (initialStored) {
      const initialLastActive = parseInt(initialStored, 10);
      if (!isNaN(initialLastActive) && Date.now() - initialLastActive >= timeoutMs) {
        isTimedOutRef.current = true;
        if (typeof onTimeoutRef.current === "function") {
          onTimeoutRef.current();
        }
        return;
      }
    } else {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }

    // 2. Activity listeners (throttled to once every 5 seconds)
    const handleActivity = () => {
      if (isTimedOutRef.current) return;
      const now = Date.now();
      if (now - lastWriteRef.current >= THROTTLE_MS) {
        lastWriteRef.current = now;
        try {
          localStorage.setItem(STORAGE_KEY, String(now));
        } catch (e) {}
      }
    };

    const events = ["pointerdown", "mousemove", "keydown", "touchstart", "wheel", "scroll"];
    const listenerOptions = { capture: true, passive: true };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, listenerOptions);
    });

    // 3. Periodic check every 10 seconds
    const intervalId = setInterval(checkTimeout, CHECK_INTERVAL_MS);

    // 4. Check on tab visibility change (e.g. waking from sleep or switching back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkTimeout();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 5. Cleanup all listeners and intervals
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity, listenerOptions);
      });
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isEnabled, timeoutMinutes]);
}
