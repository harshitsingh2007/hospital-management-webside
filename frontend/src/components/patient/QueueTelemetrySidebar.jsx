import React, { useState } from "react";
import { t, getCategoryLabel } from "../../utils/i18n";
import { HOSPITAL_CONFIG } from "../../config/hospitalConfig";
import {
  Activity,
  Clock,
  Users,
  CheckCircle2,
  Sparkles,
  Stethoscope,
  ArrowRight,
  Radio,
  MapPin,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

/**
 * QueueTelemetrySidebar
 * ---------------------
 * Redesigned Real-time Queue & Department Telemetry Monitor.
 * Ultra-premium, clean, high-contrast aesthetics for desktop and responsive side panels.
 */
export default function QueueTelemetrySidebar({
  analytics,
  servingTickets = [],
  queueSnapshot = [],
  kioskQrData,
  handleTabChange,
  activeTicket,
  language = "en",
  branding = null,
}) {
  const isHi = language === "hi";
  const userDept = activeTicket?.service_category ? String(activeTicket.service_category).toLowerCase() : null;
  const isTransferred = Boolean(activeTicket?.transferred_from_dept || activeTicket?.parent_ticket_id);
  const transferredFrom = activeTicket?.transferred_from_dept ? String(activeTicket.transferred_from_dept).toLowerCase() : null;

  // View toggle: 'auto' (scoped to patient's active department) vs 'all' (all hospital departments)
  const [scopeMode, setScopeMode] = useState("auto");

  // Determine active department filter
  const activeDept = (scopeMode === "auto" && userDept) ? userDept : null;

  // Filter serving tickets by department if scoped
  const scopedServing = activeDept
    ? servingTickets.filter((t) => (t.service_category || "").toLowerCase() === activeDept)
    : servingTickets;
  const primaryServing = scopedServing.length > 0 ? scopedServing[0] : null;

  // Filter queue snapshot by department if scoped
  const scopedQueue = activeDept
    ? queueSnapshot.filter((t) => (t.service_category || "").toLowerCase() === activeDept)
    : queueSnapshot;
  const inLineCount = scopedQueue.length;

  // Estimated wait calculation
  let displayAvgWait = analytics ? analytics.avg_wait_minutes : 12;
  if (activeDept && activeTicket?.estimated_wait_minutes !== undefined && activeTicket.estimated_wait_minutes !== null) {
    displayAvgWait = activeTicket.estimated_wait_minutes;
  } else if (scopedQueue.length > 0 && scopedQueue[0].estimated_wait_minutes !== undefined) {
    displayAvgWait = scopedQueue[0].estimated_wait_minutes;
  }

  const deptLabel = activeDept ? getCategoryLabel(activeDept, language) : (isHi ? "सामान्य ओपीडी" : "General OPD");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 1. Transfer Care Journey Banner (shown when ticket is transferred to another dept) */}
      {isTransferred && (
        <div
          className="telemetry-sidebar-card"
          style={{
            background: "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)",
            border: "1.5px solid rgba(14, 165, 233, 0.35)",
            borderRadius: "16px",
            padding: "16px",
            boxShadow: "0 4px 20px rgba(14, 165, 233, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "15px", display: "inline-flex", padding: "4px", borderRadius: "8px", background: "#E0F2FE", color: "#0284C7" }}>
                🔄
              </span>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#0369A1", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {isHi ? "विभाग स्थानांतरण" : "Department Transfer"}
              </span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", background: "rgba(14,165,233,0.12)", padding: "3px 8px", borderRadius: "6px" }}>
              #{activeTicket.ticket_id}
            </span>
          </div>

          {/* 2-Step Care Stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ flex: 1, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "8px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ fontSize: "9px", fontWeight: 800, color: "#059669", display: "block", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                ✓ {isHi ? "परामर्श पूर्ण" : "CONSULTATION DONE"}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>
                {getCategoryLabel(transferredFrom || "consultation", language)}
              </span>
            </div>
            <ArrowRight size={16} color="#0EA5E9" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, background: "rgba(14, 165, 233, 0.12)", border: "1.5px solid #0EA5E9", padding: "8px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ fontSize: "9px", fontWeight: 800, color: "#0284C7", display: "block", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                ● {isHi ? "वर्तमान कतार" : "IN QUEUE"}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)" }}>
                {getCategoryLabel(userDept || "pharmacy", language)}
              </span>
            </div>
          </div>

          {/* Guidance Note */}
          <div style={{ fontSize: "11.5px", color: "var(--patient-text-main, #334155)", lineHeight: 1.45, background: "rgba(255, 255, 255, 0.8)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(14, 165, 233, 0.2)" }}>
            {isHi
              ? `डॉक्टर द्वारा आपकी पर्ची ${getCategoryLabel(userDept || "pharmacy", language)} को भेज दी गई है। कृपया संबंधित काउंटर की ओर जाएं।`
              : `Doctor has transferred your ticket to ${getCategoryLabel(userDept || "pharmacy", language)}. Please proceed to the assigned service counter.`}
          </div>
        </div>
      )}

      {/* 2. Main Telemetry Card */}
      <div
        className="telemetry-sidebar-card"
        style={{
          background: "var(--patient-card-bg, #FFFFFF)",
          borderRadius: "18px",
          border: "1px solid var(--patient-card-border, #E2E8F0)",
          padding: "20px",
          boxShadow: "0 6px 24px rgba(15, 23, 42, 0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Header Title with Live Pulse Beacon */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ position: "relative", display: "flex", width: "10px", height: "10px" }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10B981", opacity: 0.75, animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }} />
              <span style={{ position: "relative", display: "inline-flex", borderRadius: "50%", width: "10px", height: "10px", background: "#10B981" }} />
            </span>
            <span style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)", letterSpacing: "-0.2px" }}>
              {isHi ? "लाइव ओपीडी मॉनिटर" : "Live Queue Telemetry"}
            </span>
          </div>

          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#0284C7", background: "#E0F2FE", padding: "2px 8px", borderRadius: "9999px" }}>
            {isHi ? "लाइव सिंक" : "Real-Time"}
          </span>
        </div>

        {/* Department Scope Selector (My Department vs All Hospital Desks) */}
        {userDept && (
          <div style={{ display: "flex", gap: "4px", background: "var(--patient-sub-card, #F1F5F9)", padding: "3px", borderRadius: "10px", border: "1px solid var(--patient-card-border, #E2E8F0)" }}>
            <button
              type="button"
              onClick={() => setScopeMode("auto")}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "8px",
                border: "none",
                background: scopeMode === "auto" ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : "transparent",
                color: scopeMode === "auto" ? "#FFFFFF" : "var(--patient-text-sub, #64748B)",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                transition: "all 0.15s ease",
                boxShadow: scopeMode === "auto" ? "0 2px 8px rgba(2, 132, 199, 0.25)" : "none",
              }}
            >
              <MapPin size={12} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {getCategoryLabel(userDept, language)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setScopeMode("all")}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "8px",
                border: "none",
                background: scopeMode === "all" ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : "transparent",
                color: scopeMode === "all" ? "#FFFFFF" : "var(--patient-text-sub, #64748B)",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                transition: "all 0.15s ease",
                boxShadow: scopeMode === "all" ? "0 2px 8px rgba(2, 132, 199, 0.25)" : "none",
              }}
            >
              <Layers size={12} />
              <span style={{ whiteSpace: "nowrap" }}>
                {isHi ? "सभी विभाग" : "All Desks"}
              </span>
            </button>
          </div>
        )}

        {/* 🌟 REDESIGNED PREMIUM "NOW SERVING AT DESKS" HERO BANNER 🌟 */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(145deg, #091322 0%, #0F172A 50%, #032B44 100%)",
            borderRadius: "16px",
            padding: "18px",
            color: "#FFFFFF",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            boxShadow: "0 8px 24px rgba(2, 43, 68, 0.25)",
          }}
        >
          {/* Subtle Ambient Glow Background Element */}
          <div
            style={{
              position: "absolute",
              top: "-40px",
              right: "-40px",
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, rgba(14, 165, 233, 0) 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Top Label & Department Tag */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#38BDF8", boxShadow: "0 0 8px #38BDF8" }} />
              <span style={{ fontSize: "11px", color: "#38BDF8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                {isHi ? "काउंटर पर वर्तमान टोकन" : "Now Serving at Desks"}
              </span>
            </div>

            {activeDept && (
              <span
                style={{
                  fontSize: "10.5px",
                  color: "#BAE6FD",
                  background: "rgba(14, 165, 233, 0.2)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  padding: "3px 9px",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  maxWidth: "140px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {getCategoryLabel(activeDept, language)}
              </span>
            )}
          </div>

          {/* Body: Active Serving Ticket vs Desks Ready Standby State */}
          {primaryServing ? (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: 900,
                    letterSpacing: "-0.5px",
                    background: "linear-gradient(135deg, #FFFFFF 0%, #38BDF8 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    lineHeight: 1,
                  }}
                >
                  #{primaryServing.ticket_id}
                </div>
                {primaryServing.priority_level === 1 && (
                  <span style={{ fontSize: "10.5px", fontWeight: 800, background: "#EF4444", color: "#FFFFFF", padding: "2px 7px", borderRadius: "6px" }}>
                    🚨 Emergency
                  </span>
                )}
              </div>

              <div style={{ fontSize: "12px", color: "rgba(226, 232, 240, 0.9)", marginTop: "8px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span>
                  {isHi ? "विभाग:" : "Dept:"} <strong style={{ color: "#FFFFFF" }}>{getCategoryLabel(primaryServing.service_category || "consultation", language)}</strong>
                </span>
                {(primaryServing.assigned_counter || primaryServing.counter || primaryServing.desk_id) && (
                  <span style={{ background: "rgba(255, 255, 255, 0.15)", border: "1px solid rgba(255, 255, 255, 0.2)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                    {isHi ? "डेस्क #" : "Desk #"}{primaryServing.assigned_counter || primaryServing.counter || primaryServing.desk_id}
                  </span>
                )}
                {primaryServing.served_by_doctor_name && (
                  <span style={{ color: "#38BDF8", fontSize: "11px", fontWeight: 600 }}>
                    • Dr. {String(primaryServing.served_by_doctor_name).replace(/^Dr\.?\s*/i, "")}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* 🌿 Redesigned Elegant "Desks Ready" State */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#34D399",
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#F8FAFC", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{isHi ? "डेस्क सक्रिय एवं तैयार हैं" : "Desks Ready for Next Patient"}</span>
                </div>
                <div style={{ fontSize: "11.5px", color: "rgba(186, 230, 253, 0.8)", marginTop: "2px" }}>
                  {activeDept
                    ? (isHi ? `${deptLabel} में अगला टोकन शीघ्र बुलाया जाएगा` : `Standing by to call next in ${deptLabel}`)
                    : (isHi ? "अगला टोकन कॉल किया जा रहा है" : "Ready to call next token in queue")}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Wait Stats Tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {/* Tile 1: Est. Wait Time */}
          <div
            style={{
              background: "var(--patient-sub-card, #F8FAFC)",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid var(--patient-card-border, #E2E8F0)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--patient-text-sub, #64748B)" }}>
              <Clock size={13} color="#0284C7" />
              <span style={{ fontSize: "11px", fontWeight: 700 }}>
                {isHi ? "औसत प्रतीक्षा" : "Est. Wait Time"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
              <span style={{ fontSize: "20px", fontWeight: 900, color: "#0284C7" }}>
                ~{displayAvgWait}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--patient-text-sub, #64748B)" }}>
                {isHi ? "मिनट" : "mins"}
              </span>
            </div>
          </div>

          {/* Tile 2: In Queue Count */}
          <div
            style={{
              background: "var(--patient-sub-card, #F8FAFC)",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid var(--patient-card-border, #E2E8F0)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--patient-text-sub, #64748B)" }}>
              <Users size={13} color="#0F172A" />
              <span style={{ fontSize: "11px", fontWeight: 700 }}>
                {activeDept ? (isHi ? `${deptLabel}` : `In ${deptLabel}`) : (isHi ? "कतार में मरीज" : "In Line")}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
              <span style={{ fontSize: "20px", fontWeight: 900, color: "var(--patient-text-main, #0F172A)" }}>
                {inLineCount}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--patient-text-sub, #64748B)" }}>
                {isHi ? "मरीज़" : "patients"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Next Up in Queue List */}
      {scopedQueue.length > 0 && (
        <div
          className="telemetry-sidebar-card"
          style={{
            background: "var(--patient-card-bg, #FFFFFF)",
            borderRadius: "18px",
            border: "1px solid var(--patient-card-border, #E2E8F0)",
            padding: "18px",
            boxShadow: "0 4px 18px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--patient-text-main, #0F172A)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Activity size={15} color="#0284C7" />
              <span>{isHi ? "कतार में अगले टोकन" : "Next Up in Queue"}</span>
            </span>
            {activeDept && (
              <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#0284C7", background: "rgba(2,132,199,0.1)", padding: "2px 7px", borderRadius: "6px" }}>
                {getCategoryLabel(activeDept, language)}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {scopedQueue.slice(0, 4).map((item, idx) => {
              const isSelf = activeTicket && String(item.ticket_id) === String(activeTicket.ticket_id);
              const isEmergency = Number(item.priority_level || item.priority) === 1;

              return (
                <div
                  key={item.ticket_id || idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    background: isSelf ? "rgba(14, 165, 233, 0.1)" : "var(--patient-sub-card, #F8FAFC)",
                    border: isSelf ? "1.5px solid #0EA5E9" : "1px solid var(--patient-card-border, #E2E8F0)",
                    boxShadow: isSelf ? "0 2px 10px rgba(14, 165, 233, 0.18)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "6px",
                        background: isSelf ? "#0284C7" : "rgba(100, 116, 139, 0.12)",
                        color: isSelf ? "#FFFFFF" : "#64748B",
                        fontSize: "11px",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.position || (idx + 1)}
                    </span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ fontSize: "13px", fontWeight: 800, color: isSelf ? "#0284C7" : "var(--patient-text-main, #0F172A)" }}>
                          #{item.ticket_id}
                        </strong>
                        {isEmergency && (
                          <span style={{ fontSize: "9px", fontWeight: 800, background: "#EF4444", color: "#FFFFFF", padding: "1px 5px", borderRadius: "4px" }}>
                            🚨 P1
                          </span>
                        )}
                        {isSelf && (
                          <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#FFFFFF", background: "#0284C7", padding: "1px 6px", borderRadius: "4px" }}>
                            {isHi ? "आप" : "YOU"}
                          </span>
                        )}
                      </div>
                      {item.service_category && (
                        <span style={{ fontSize: "10.5px", color: "var(--patient-text-sub, #64748B)", display: "block", marginTop: "1px" }}>
                          {getCategoryLabel(item.service_category, language)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#0284C7" }}>
                    ~{item.estimated_wait_minutes || 5}{isHi ? "मि" : "m"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
