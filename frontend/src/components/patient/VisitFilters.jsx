import React, { useState, useRef, useEffect } from "react";
import { t } from "../../utils/i18n";

/**
 * VisitFilters
 * ------------
 * Clean, borderless filter bar:
 * - Segmented control: All | Appointments | Walk-ins | Prescriptions (with counts).
 * - Right side: Expandable search input + 'Show cancelled' checkbox.
 * - Mobile responsive: Horizontal scrolling tabs, search row below.
 */
export default function VisitFilters({
  filterType = "all",
  setFilterType,
  counts = { all: 0, appointments: 0, walkin: 0, rx: 0 },
  searchQuery = "",
  setSearchQuery,
  showCancelled = false,
  setShowCancelled,
  language = "en",
}) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(Boolean(searchQuery));
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchQuery && !isSearchExpanded) {
      setIsSearchExpanded(true);
    }
  }, [searchQuery, isSearchExpanded]);

  const tabs = [
    { id: "all", label: t("allRecords", language), count: counts.all },
    { id: "appointments", label: t("prescheduledApts", language), count: counts.appointments },
    { id: "walkin", label: t("walkinVisits", language), count: counts.walkin },
    { id: "rx", label: t("ePrescriptions", language), count: counts.rx },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
        marginBottom: "16px",
      }}
    >
      {/* Segmented Control Tabs */}
      <div
        role="tablist"
        style={{
          display: "inline-flex",
          background: "var(--patient-sub-card, #F1F5F9)",
          padding: "3px",
          borderRadius: "10px",
          gap: "2px",
          overflowX: "auto",
          maxWidth: "100%",
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((tab) => {
          const isActive = filterType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilterType(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "7px",
                border: "none",
                background: isActive ? "#0284C7" : "transparent",
                color: isActive ? "#FFFFFF" : "var(--patient-text-sub, #475569)",
                fontSize: "12px",
                fontWeight: isActive ? 700 : 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: isActive ? "rgba(255,255,255,0.85)" : "var(--patient-text-sub, #94A3B8)",
                  marginLeft: "1px",
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right Side: Search + Show Cancelled Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginLeft: "auto",
        }}
      >
        {/* Search Input / Icon */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          {isSearchExpanded ? (
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchHistoryPlaceholderShort", language)}
                aria-label={t("searchHistoryPlaceholderShort", language)}
                style={{
                  width: "180px",
                  maxWidth: "240px",
                  padding: "6px 28px 6px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--patient-card-border, #CBD5E1)",
                  background: "var(--patient-card-bg, #FFFFFF)",
                  color: "var(--patient-text-main, #0F172A)",
                  fontSize: "12px",
                  outline: "none",
                  transition: "width 0.2s ease, border-color 0.2s ease",
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchExpanded(false);
                }}
                aria-label={language === "hi" ? "खोज बंद करें" : "Close search"}
                style={{
                  position: "absolute",
                  right: "6px",
                  background: "none",
                  border: "none",
                  color: "var(--patient-text-sub, #94A3B8)",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: "2px",
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSearchExpanded(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              aria-label={language === "hi" ? "खोजें" : "Search records"}
              style={{
                background: "var(--patient-card-bg, #FFFFFF)",
                border: "1px solid var(--patient-card-border, #E2E8F0)",
                borderRadius: "8px",
                padding: "6px 9px",
                color: "var(--patient-text-sub, #64748B)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          )}
        </div>

        {/* Show Cancelled Toggle */}
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--patient-text-sub, #64748B)",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
            style={{
              accentColor: "#0284C7",
              width: "14px",
              height: "14px",
              cursor: "pointer",
              margin: 0,
            }}
          />
          <span>{t("showCancelledToggle", language)}</span>
        </label>
      </div>
    </div>
  );
}

