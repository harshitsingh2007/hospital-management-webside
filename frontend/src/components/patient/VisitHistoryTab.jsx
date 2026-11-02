import React, { useState, useMemo } from "react";
import { t, getCategoryLabel } from "../../utils/i18n";
import { standaloneCardStyle } from "./patientStyles";

import VisitHistoryHeader from "./VisitHistoryHeader";
import VisitSummaryStats from "./VisitSummaryStats";
import VisitFilters from "./VisitFilters";
import VisitRecordRow from "./VisitRecordRow";
import VisitRecordDetails from "./VisitRecordDetails";

/**
 * VisitHistoryTab
 * ---------------
 * Simplified, calm, and professional Visit History for the Patient Portal:
 * - Clean header with total records & compact profile selector.
 * - Compact 3-stat summary row (Total Visits, Last Visit, Last Diagnosis).
 * - Segmented filter tabs with search and cancelled visibility toggle.
 * - Single unified timeline list (walk-ins + appointments) sorted newest-first and grouped by month.
 * - Collapsed by default cards (~70-72px high), with smooth accordion expansion.
 */
export default function VisitHistoryTab({
  language = "en",
  hospitalBranding = null,
  selectedMember = null,
  selectedMemberId = "self",
  familyMembers = [],
  handleSelectMember,
  handleTabChange,
  handleDeleteMember,
  familyTickets = {},
  displayedHistoryAppointments = [],
  displayedHistoryTickets = [],
  selectedMemberHistoryStats = { patient: null, summary: null, isReturningPatient: false, totalVisits: 0 },
  historyFilterType = "all",
  setHistoryFilterType,
  historySearchQuery = "",
  setHistorySearchQuery,
  showCancelledHistory = false,
  setShowCancelledHistory,
  historyAppointments = [],
  historyTickets = [],
  userTicketHistory = [],
  getHospitalNameForRecord = () => "",
  getDeptDisplayName = (id) => id,
  parsePrescription,
  handleOpenPrescriptionSlip,
  downloadPrescriptionPDF,
  setStatusMsg,
  handleBookFollowUp,
  showToast = null,
}) {
  // Visible records pagination limit (initial 10)
  const [visibleLimit, setVisibleLimit] = useState(10);

  // Accordion state: set of expanded record IDs
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Multi-hospital check: check if records span more than 1 distinct hospital
  const hasMultipleHospitals = useMemo(() => {
    const set = new Set();
    historyTickets.forEach((tk) => {
      const name = getHospitalNameForRecord(tk);
      if (name) set.add(name);
    });
    historyAppointments.forEach((apt) => {
      const name = getHospitalNameForRecord(apt);
      if (name) set.add(name);
    });
    return set.size > 1;
  }, [historyTickets, historyAppointments, getHospitalNameForRecord]);

  // Unified list of records from displayedTickets and displayedAppointments
  const unifiedTimeline = useMemo(() => {
    const list = [];

    // 1. Process Walk-in Tickets
    displayedHistoryTickets.forEach((tk) => {
      const rawDate = tk.created_at || tk.queue_date || "";
      const dateObj = rawDate ? new Date(rawDate) : new Date();
      const timestamp = !isNaN(dateObj.getTime()) ? dateObj.getTime() : 0;

      const dateStr = rawDate ? String(rawDate).slice(0, 10) : "";
      const formattedDate = dateObj && !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString(language === "hi" ? "hi-IN" : "en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : dateStr;

      const monthYear = dateObj && !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString(language === "hi" ? "hi-IN" : "en-US", {
            month: "long",
            year: "numeric",
          })
        : "";

      const deptName = tk.department_name || getCategoryLabel(tk.service_category, language);
      const docName = tk.all_doctors && tk.all_doctors.length > 1
        ? tk.all_doctors.join(" · ")
        : (tk.doctor_name || tk.served_by_doctor_name || "");

      const rx = parsePrescription ? parsePrescription(tk.prescription_notes, tk) : null;

      list.push({
        id: `walkin_${tk.ticket_id}`,
        recordType: "walkin",
        timestamp,
        dateStr,
        formattedDate,
        monthYear,
        deptName,
        docName,
        hospitalName: getHospitalNameForRecord(tk),
        rx,
        effectiveRxNotes: tk.prescription_notes || "",
        record: tk,
      });
    });

    // 2. Process Appointments
    displayedHistoryAppointments.forEach((apt) => {
      const rawDate = apt.appointment_date || apt.created_at || "";
      const dateObj = rawDate ? new Date(rawDate + (String(rawDate).length === 10 ? "T12:00:00Z" : "")) : new Date();
      const timestamp = !isNaN(dateObj.getTime()) ? dateObj.getTime() : 0;

      const formattedDate = dateObj && !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString(language === "hi" ? "hi-IN" : "en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : String(rawDate);

      const monthYear = dateObj && !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString(language === "hi" ? "hi-IN" : "en-US", {
            month: "long",
            year: "numeric",
          })
        : "";

      const deptName = getDeptDisplayName(apt);
      const docName = apt.doctor_name || apt.served_by_doctor_name || "";

      const effectiveRxNotes =
        apt.prescription_notes ||
        (apt.ticket_id && userTicketHistory.find((t) => t.ticket_id === apt.ticket_id)?.prescription_notes) ||
        "";
      const rx = parsePrescription ? parsePrescription(effectiveRxNotes, apt) : null;

      list.push({
        id: `apt_${apt.appointment_id}`,
        recordType: "appointment",
        timestamp,
        dateStr: String(rawDate),
        formattedDate,
        monthYear,
        deptName,
        docName,
        hospitalName: getHospitalNameForRecord(apt),
        rx,
        effectiveRxNotes,
        record: apt,
      });
    });

    // Sort descending (newest visit first)
    list.sort((a, b) => b.timestamp - a.timestamp);

    return list;
  }, [
    displayedHistoryTickets,
    displayedHistoryAppointments,
    language,
    getHospitalNameForRecord,
    getDeptDisplayName,
    parsePrescription,
    userTicketHistory,
  ]);

  // Group sorted records by Month Year for calm timeline headings
  const groupedTimeline = useMemo(() => {
    const groups = [];
    let currentMonth = null;
    let currentItems = [];

    // Slice to current visible pagination limit
    const visibleRecords = unifiedTimeline.slice(0, visibleLimit);

    visibleRecords.forEach((item) => {
      const groupKey = item.monthYear || (language === "hi" ? "अन्य" : "Earlier");
      if (groupKey !== currentMonth) {
        if (currentItems.length > 0) {
          groups.push({ month: currentMonth, items: currentItems });
        }
        currentMonth = groupKey;
        currentItems = [item];
      } else {
        currentItems.push(item);
      }
    });

    if (currentItems.length > 0) {
      groups.push({ month: currentMonth, items: currentItems });
    }

    return groups;
  }, [unifiedTimeline, visibleLimit, language]);

  // Counts for filter segmented control
  const filterCounts = useMemo(() => {
    const rxWalkinCount = historyTickets.filter((t) => !!t.prescription_notes).length;
    const rxAptCount = historyAppointments.filter(
      (a) => !!(a.prescription_notes || (a.ticket_id && userTicketHistory.find((t) => t.ticket_id === a.ticket_id)?.prescription_notes))
    ).length;

    return {
      all: historyAppointments.length + historyTickets.length,
      appointments: historyAppointments.length,
      walkin: historyTickets.length,
      rx: rxWalkinCount + rxAptCount,
    };
  }, [historyAppointments, historyTickets, userTicketHistory]);

  const totalFilteredRecords = unifiedTimeline.length;
  const remainingRecords = Math.max(0, totalFilteredRecords - visibleLimit);

  // Fallbacks for the summary stats from newest timeline record
  const newestRecord = unifiedTimeline[0];

  return (
    <div style={standaloneCardStyle}>
      {/* 1. Page Header (Title + muted count + compact profile switcher) */}
      <VisitHistoryHeader
        language={language}
        totalRecords={historyAppointments.length + historyTickets.length}
        familyMembers={familyMembers}
        selectedMemberId={selectedMemberId}
        onSelectMember={handleSelectMember}
      />

      {/* 2. Compact 3-Stat Summary */}
      <VisitSummaryStats
        summary={selectedMemberHistoryStats?.summary}
        totalVisits={selectedMemberHistoryStats?.totalVisits || (historyAppointments.length + historyTickets.length)}
        fallbackLastVisitDate={newestRecord?.formattedDate}
        fallbackLastDoctor={newestRecord?.docName}
        fallbackLastDiagnosis={newestRecord?.rx?.diagnosis}
        language={language}
      />

      {/* 3. Clean Segmented Filters (Tabs + Search + Cancelled toggle) */}
      <VisitFilters
        filterType={historyFilterType}
        setFilterType={(newFilter) => {
          setHistoryFilterType(newFilter);
          setVisibleLimit(10);
        }}
        counts={filterCounts}
        searchQuery={historySearchQuery}
        setSearchQuery={(q) => {
          setHistorySearchQuery(q);
          setVisibleLimit(10);
        }}
        showCancelled={showCancelledHistory}
        setShowCancelled={(val) => {
          setShowCancelledHistory(val);
          setVisibleLimit(10);
        }}
        language={language}
      />

      {/* 4. Timeline Content */}
      {totalFilteredRecords === 0 ? (
        <div
          style={{
            padding: "36px 20px",
            textAlign: "center",
            background: "var(--patient-sub-card, #F8FAFC)",
            borderRadius: "14px",
            border: "1px solid var(--patient-card-border, #E2E8F0)",
            color: "var(--patient-text-sub, #64748B)",
          }}
        >
          {historySearchQuery.trim() ? (
            <>
              <p style={{ margin: "0 0 10px 0", fontSize: "13.5px", fontWeight: 600, color: "var(--patient-text-main, #334155)" }}>
                {t("noMatchingRecordsMsg", language)}
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {language === "hi" ? "खोज साफ़ करें" : "Clear Search"}
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 14px 0", fontSize: "13.5px", fontWeight: 600, color: "var(--patient-text-main, #334155)" }}>
                {t("noPastVisitsMsg", language)}
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleTabChange("walkin")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(2, 132, 199, 0.2)",
                  }}
                >
                  {t("getInstantTokenBtn", language)}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("book")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--patient-card-border, #CBD5E1)",
                    background: "var(--patient-card-bg, #FFFFFF)",
                    color: "#0284C7",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  {t("bookAppointmentBtn", language)}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {groupedTimeline.map((group, gIdx) => (
            <div key={group.month || gIdx}>
              {/* Month Heading */}
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "var(--patient-text-sub, #64748B)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "8px",
                  marginTop: gIdx === 0 ? "0" : "6px",
                }}
              >
                {group.month}
              </div>

              {/* Records for this Month (12px gap between rows) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {group.items.map((item) => {
                  const isExpanded = expandedIds.has(item.id);

                  return (
                    <VisitRecordRow
                      key={item.id}
                      record={item.record}
                      recordType={item.recordType}
                      formattedDate={item.formattedDate}
                      deptName={item.deptName}
                      docName={item.docName}
                      hasMultipleHospitals={hasMultipleHospitals}
                      hospitalName={item.hospitalName}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpand(item.id)}
                      language={language}
                    >
                      <VisitRecordDetails
                        record={item.record}
                        recordType={item.recordType}
                        rx={item.rx}
                        effectiveRxNotes={item.effectiveRxNotes}
                        hospitalBranding={hospitalBranding}
                        language={language}
                        handleBookFollowUp={handleBookFollowUp}
                        handleOpenPrescriptionSlip={handleOpenPrescriptionSlip}
                        downloadPrescriptionPDF={downloadPrescriptionPDF}
                        setStatusMsg={setStatusMsg}
                        showToast={showToast}
                      />
                    </VisitRecordRow>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Show More Button if more records exist beyond pagination limit */}
          {remainingRecords > 0 && (
            <div style={{ textAlign: "center", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 10)}
                style={{
                  padding: "8px 20px",
                  borderRadius: "10px",
                  border: "1px solid var(--patient-card-border, #CBD5E1)",
                  background: "var(--patient-card-bg, #FFFFFF)",
                  color: "#0284C7",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{t("showMoreBtn", language)}</span>
                <span style={{ fontSize: "11px", opacity: 0.8 }}>
                  ({remainingRecords} {t("remainingRecords", language)})
                </span>
                <span style={{ fontSize: "11px" }}>▼</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
