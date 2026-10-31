import React, { useState } from "react";

export default function BroadcastHistoryTable({
  historyData = [],
  totalCount = 0,
  currentPage = 1,
  pageSize = 10,
  totalPages = 1,
  onPageChange = () => {},
  onPageSizeChange = () => {},
  hospitals = [],
  filters = {},
  onFilterChange = () => {},
  onExtend = () => {},
  onDismiss = () => {},
  onDuplicate = () => {},
  isLoading = false,
  isHi = false,
}) {
  // Export CSV handler
  const handleExportCSV = () => {
    if (!historyData || historyData.length === 0) return;

    const headers = [
      "ID",
      "Timestamp",
      "Type",
      "Title",
      "Message",
      "Target Scope",
      "Status",
      "Duration (mins)",
      "Delivered Screens",
      "Created By",
    ];

    const rows = historyData.map((b) => [
      `"${b.id}"`,
      `"${new Date(b.created_at || b.timestamp).toLocaleString()}"`,
      `"${b.type}"`,
      `"${(b.title || "").replace(/"/g, '""')}"`,
      `"${(b.message || "").replace(/"/g, '""')}"`,
      `"${b.hospital_code === "all" ? "ALL HOSPITALS" : b.hospital_name || b.hospital_code}"`,
      `"${b.status || (b.is_active ? "active" : "expired")}"`,
      `"${b.duration_minutes || b.duration || 0}"`,
      `"${b.delivered_count || 0}"`,
      `"${b.created_by || "superadmin"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hospital_broadcast_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        borderRadius: "14px",
        background: "var(--card-bg, #ffffff)",
        border: "1px solid var(--border-color, #e2e8f0)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
      }}
    >
      {/* Table Toolbar & Filters */}
      <div
        style={{
          padding: "16px",
          background: "var(--bg-subtle, #f8fafc)",
          borderBottom: "1px solid var(--border-color, #e2e8f0)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: "relative", minWidth: "220px", flex: "1 1 220px" }}>
            <input
              type="text"
              value={filters.q || ""}
              onChange={(e) => onFilterChange({ ...filters, q: e.target.value })}
              placeholder={isHi ? "शीर्षक, संदेश या आईडी खोजें..." : "Search headline, message or ID..."}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: "8px",
                border: "1px solid var(--border-color, #cbd5e1)",
                background: "var(--card-bg, #ffffff)",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Type Filter */}
          <select
            value={filters.type || "all"}
            onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--card-bg, #ffffff)",
              fontSize: "12px",
              fontWeight: 500,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">{isHi ? "सभी प्रकार" : "All Alert Types"}</option>
            <option value="code_blue">Code Blue</option>
            <option value="code_red">Code Red</option>
            <option value="notice">{isHi ? "सिस्टम नोटिस" : "Notice"}</option>
            <option value="announcement">{isHi ? "सामान्य घोषणा" : "Announcement"}</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status || "all"}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--card-bg, #ffffff)",
              fontSize: "12px",
              fontWeight: 500,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">{isHi ? "सभी स्थिति" : "All Statuses"}</option>
            <option value="active">{isHi ? "सक्रिय" : "Active"}</option>
            <option value="expired">{isHi ? "समाप्त" : "Expired"}</option>
            <option value="dismissed">{isHi ? "बंद किया गया" : "Dismissed"}</option>
            <option value="scheduled">{isHi ? "शेड्यूल्ड" : "Scheduled"}</option>
          </select>

          {/* Hospital Scope Filter */}
          <select
            value={filters.hospital_code || "all"}
            onChange={(e) => onFilterChange({ ...filters, hospital_code: e.target.value })}
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #cbd5e1)",
              background: "var(--card-bg, #ffffff)",
              fontSize: "12px",
              fontWeight: 500,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">{isHi ? "सभी अस्पताल" : "All Facilities"}</option>
            {hospitals.map((h) => (
              <option key={h.hospital_code || h.code} value={h.hospital_code || h.code}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        {/* Export CSV Action */}
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={!historyData || historyData.length === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border-color, #cbd5e1)",
            color: "var(--text-secondary, #334155)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: !historyData || historyData.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {isHi ? "सीएसवी निर्यात" : "Export CSV"}
        </button>
      </div>

      {/* History Data Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--border-color, #e2e8f0)" }}>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary, #64748b)", fontSize: "11px", textTransform: "uppercase" }}>
                {isHi ? "समय / दिनांक" : "Timestamp"}
              </th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary, #64748b)", fontSize: "11px", textTransform: "uppercase" }}>
                {isHi ? "प्रकार" : "Type"}
              </th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary, #64748b)", fontSize: "11px", textTransform: "uppercase" }}>
                {isHi ? "हेडलाइन व विवरण" : "Headline & Message"}
              </th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary, #64748b)", fontSize: "11px", textTransform: "uppercase" }}>
                {isHi ? "लक्षित दायरा" : "Target Facility"}
              </th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary, #64748b)", fontSize: "11px", textTransform: "uppercase" }}>
                {isHi ? "स्क्रीन" : "Screens"}
              </th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary, #64748b)", fontSize: "11px", textTransform: "uppercase" }}>
                {isHi ? "स्थिति" : "Status"}
              </th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary, #64748b)", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>
                {isHi ? "कार्रवाई" : "Actions"}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary, #64748b)" }}>
                  {isHi ? "डेटा लोड हो रहा है..." : "Loading broadcast history..."}
                </td>
              </tr>
            ) : historyData.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary, #64748b)" }}>
                  {isHi ? "कोई प्रसारण रिकॉर्ड नहीं मिला।" : "No broadcast logs found matching the selected filters."}
                </td>
              </tr>
            ) : (
              historyData.map((item) => {
                const isItemActive = item.is_active || item.status === "active";
                const typeColor =
                  item.type === "code_blue"
                    ? "#1E3A8A"
                    : item.type === "code_red"
                    ? "#881337"
                    : item.type === "notice"
                    ? "#D97706"
                    : "#059669";

                const targetLabel =
                  item.hospital_code === "all"
                    ? (isHi ? "🚨 नेटवर्क-व्यापी" : "🚨 ALL HOSPITALS")
                    : item.hospital_name || item.hospital_code;

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid var(--border-color, #f1f5f9)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "var(--text-secondary, #64748b)", fontSize: "12px" }}>
                      <div>{new Date(item.created_at || item.timestamp).toLocaleDateString()}</div>
                      <div style={{ fontSize: "11px", opacity: 0.8 }}>
                        {new Date(item.created_at || item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "3px 8px",
                          borderRadius: "5px",
                          background: `${typeColor}15`,
                          color: typeColor,
                          border: `1px solid ${typeColor}40`,
                        }}
                      >
                        {item.type?.replace("_", " ")}
                      </span>
                    </td>

                    {/* Headline & Message */}
                    <td style={{ padding: "12px 16px", maxWidth: "280px" }}>
                      <div style={{ fontWeight: 700, color: "var(--text-primary, #0f172a)", marginBottom: "2px" }}>
                        {item.title}
                      </div>
                      {item.message && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--text-secondary, #64748b)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.message}
                        </div>
                      )}
                    </td>

                    {/* Target Scope */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: item.hospital_code === "all" ? "#DC2626" : "var(--text-primary, #334155)",
                        }}
                      >
                        {targetLabel}
                      </span>
                    </td>

                    {/* Delivered Screens Count */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontSize: "12px", color: "#2563EB", fontWeight: 600 }}>
                      {item.delivered_count ?? 0}
                    </td>

                    {/* Status Pill */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background:
                            item.status === "active" || isItemActive
                              ? "rgba(16, 185, 129, 0.12)"
                              : item.status === "scheduled"
                              ? "rgba(59, 130, 246, 0.12)"
                              : item.status === "dismissed"
                              ? "rgba(239, 68, 68, 0.12)"
                              : "rgba(100, 116, 139, 0.12)",
                          color:
                            item.status === "active" || isItemActive
                              ? "#059669"
                              : item.status === "scheduled"
                              ? "#2563EB"
                              : item.status === "dismissed"
                              ? "#DC2626"
                              : "#64748b",
                        }}
                      >
                        {item.status || (isItemActive ? "active" : "expired")}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => onDuplicate(item)}
                          title={isHi ? "फॉर्म में कॉपी करें" : "Duplicate to composer"}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "5px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: "var(--bg-subtle, #f1f5f9)",
                            border: "1px solid var(--border-color, #cbd5e1)",
                            color: "var(--text-secondary, #334155)",
                            cursor: "pointer",
                          }}
                        >
                          {isHi ? "कॉपी" : "Duplicate"}
                        </button>

                        {isItemActive && (
                          <>
                            <button
                              type="button"
                              onClick={() => onExtend(item.id)}
                              title={isHi ? "+15 मिनट बढ़ाएं" : "Extend duration +15m"}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "5px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "rgba(37, 99, 235, 0.08)",
                                border: "1px solid rgba(37, 99, 235, 0.25)",
                                color: "#1D4ED8",
                                cursor: "pointer",
                              }}
                            >
                              +15m
                            </button>
                            <button
                              type="button"
                              onClick={() => onDismiss(item.id)}
                              title={isHi ? "अलर्ट बंद करें" : "Dismiss broadcast"}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "5px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "rgba(239, 68, 68, 0.08)",
                                border: "1px solid rgba(239, 68, 68, 0.25)",
                                color: "#DC2626",
                                cursor: "pointer",
                              }}
                            >
                              {isHi ? "बंद" : "Dismiss"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          padding: "12px 16px",
          background: "var(--bg-subtle, #f8fafc)",
          borderTop: "1px solid var(--border-color, #e2e8f0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          fontSize: "12px",
          color: "var(--text-secondary, #64748b)",
        }}
      >
        <div>
          {isHi ? "कुल रिकॉर्ड्स: " : "Showing entries: "}
          <strong style={{ color: "var(--text-primary, #0f172a)" }}>
            {totalCount > 0 ? `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, totalCount)}` : "0"}
          </strong>{" "}
          {isHi ? `(कुल ${totalCount})` : `of ${totalCount}`}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Page Size Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{isHi ? "प्रति पृष्ठ:" : "Rows:"}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: "3px 6px",
                borderRadius: "6px",
                border: "1px solid var(--border-color, #cbd5e1)",
                background: "var(--card-bg, #ffffff)",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Prev / Next Pagination */}
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color, #cbd5e1)",
                background: "var(--card-bg, #ffffff)",
                color: "var(--text-secondary, #475569)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                opacity: currentPage <= 1 ? 0.5 : 1,
              }}
            >
              {isHi ? "पिछला" : "Previous"}
            </button>
            <span style={{ padding: "4px 8px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
              {currentPage} / {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color, #cbd5e1)",
                background: "var(--card-bg, #ffffff)",
                color: "var(--text-secondary, #475569)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                opacity: currentPage >= totalPages ? 0.5 : 1,
              }}
            >
              {isHi ? "अगला" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

