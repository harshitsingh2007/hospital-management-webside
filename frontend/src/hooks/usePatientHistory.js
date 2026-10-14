

import { useState, useEffect, useCallback } from "react";
import { fetchPatientHistoryByTicket, fetchPatientHistory } from "../services/patientHistoryService";

export function usePatientHistory({
  ticketId = null,
  patientId = null,
  phone = null,
  hospitalId = null,
  socketRef = null,
  autoFetch = true,
}) {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all"); // all, visits, prescriptions, reports

  const refreshHistory = useCallback(async () => {
    if (!ticketId && !patientId && !phone) {
      setHistoryData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data = null;
      if (ticketId) {
        data = await fetchPatientHistoryByTicket(ticketId, hospitalId);
      } else {
        data = await fetchPatientHistory({ patientId, phone, hospitalId });
      }

      if (data && data.status === "success") {
        setHistoryData(data);
      } else {
        setHistoryData(null);
      }
    } catch (err) {
      setError(err.message || "Failed to load patient history");
    } finally {
      setLoading(false);
    }
  }, [ticketId, patientId, phone, hospitalId]);

  useEffect(() => {
    if (autoFetch) {
      refreshHistory();
    }
  }, [refreshHistory, autoFetch]);

  // Real-time socket updates
  useEffect(() => {
    if (!socketRef || !socketRef.current) return;
    const s = socketRef.current;

    const handleUpdate = (payload) => {
      if (!payload) return;
      if (
        (patientId && String(payload.patient_id) === String(patientId)) ||
        (ticketId && String(payload.ticket_id) === String(ticketId))
      ) {
        refreshHistory();
      }
    };

    s.on("patient_history_updated", handleUpdate);
    s.on("prescription_saved", handleUpdate);

    return () => {
      s.off("patient_history_updated", handleUpdate);
      s.off("prescription_saved", handleUpdate);
    };
  }, [socketRef, patientId, ticketId, refreshHistory]);

  return {
    historyData,
    patient: historyData?.patient || null,
    summary: historyData?.summary || null,
    visits: (historyData?.visits || []).filter(
      (v) => !["cancelled", "no_show", "expired"].includes((v.status || "").toLowerCase())
    ),
    prescriptions: historyData?.prescriptions || [],
    reports: historyData?.reports || [],
    isReturningPatient: !!historyData?.is_returning_patient,
    totalVisits: historyData?.patient?.total_visits || historyData?.summary?.total_visits || 0,
    loading,
    error,
    refreshHistory,
    activeFilter,
    setActiveFilter,
  };
}
