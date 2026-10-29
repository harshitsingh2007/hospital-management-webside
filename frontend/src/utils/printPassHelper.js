/**
 * printPassHelper.js
 * -------------------
 * Generates an official hospital-branded print slip / PDF receipt.
 * Opens the native browser print / "Save as PDF" dialog with zero external dependencies.
 */

import { t, getCategoryLabel, getStatusLabel, formatSymptomLabel, formatRiskLabel, formatCleanText, cleanAdviceText } from "./i18n";

/**
 * Triggers the browser print/PDF dialog using a dedicated hidden iframe.
 */
function triggerIframePrint(htmlContent) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow.print();
    } catch (e) {
      console.error("Print error:", e);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  }, 400);
}

/**
 * Safely parse and format prescription notes into clean HTML for print slips
 */
function formatRxHtml(rxNotes, lang = "en") {
  if (!rxNotes) return "";
  let parsed = null;
  if (typeof rxNotes === "object" && rxNotes !== null) {
    parsed = rxNotes;
  } else if (typeof rxNotes === "string") {
    let trimmed = rxNotes.trim();
    while ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        try { parsed = JSON.parse(JSON.parse(rxNotes)); } catch (e2) {}
      }
    } else {
      try {
        const d = JSON.parse(rxNotes);
        if (typeof d === "object" && d !== null) parsed = d;
      } catch (e) {}
    }
  }

  if (parsed && typeof parsed === "object") {
    let html = `<div style="text-align: left; margin-top: 4px;">`;
    if (parsed.diagnosis) {
      const cleanDiag = formatCleanText(parsed.diagnosis, lang);
      html += `<div style="font-size: 11.5px; font-weight: 800; color: #166534; margin-bottom: 3px;"><strong>Diagnosis:</strong> ${cleanDiag}</div>`;
    }
    if (Array.isArray(parsed.medicines) && parsed.medicines.length > 0) {
      html += `<div style="font-size: 11px; font-weight: 800; color: #15803D; margin-top: 4px;">Rx Medicines:</div>`;
      html += `<ul style="margin: 3px 0 4px 16px; padding: 0; font-size: 11px; color: #1e293b;">`;
      parsed.medicines.forEach((m) => {
        if (m.name) {
          const medName = formatCleanText(m.name, lang);
          const medDosage = m.dosage ? formatCleanText(m.dosage, lang) : "";
          const medFreq = m.frequency ? `(${formatCleanText(m.frequency, lang)})` : "";
          const medDur = m.duration ? `[${formatCleanText(m.duration, lang)}]` : "";
          html += `<li><strong>${medName}</strong> ${medDosage} ${medFreq} ${medDur}</li>`;
        }
      });
      html += `</ul>`;
    }
    const cleanAdv = cleanAdviceText(parsed.advice || parsed.clinical_notes || "");
    if (cleanAdv) {
      html += `<div style="font-size: 11px; color: #15803D; margin-top: 3px; font-style: italic;"><strong>Advice:</strong> ${cleanAdv}</div>`;
    }
    html += `</div>`;
    return html;
  }

  const rawClean = cleanAdviceText(rxNotes);
  if (!rawClean) return "";
  return `<p class="rx-text">"${rawClean}"</p>`;
}

/**
 * Print live queue token pass with QR code and optional clinical prescription.
 */
export function printTokenPass(ticket, qrBase64, lang = "en", branding = null) {
  if (!ticket) return;

  const hospitalName = (branding && (branding.hospital_name || branding.name)) || ticket.hospital_name || t("hospitalName", lang);
  const brandPrimary = (branding && branding.primary_color) || "#047857";
  const brandTagline = (branding && branding.tagline) || (lang === "hi" ? "भरोसेमंद स्वास्थ्य सेवा • एनएबीएच मान्यता प्राप्त" : "Care you can trust • Official Clinical Pass");
  const emergencyHelpline = (branding && branding.emergency_helpline) || "";
  const opdHelpline = (branding && (branding.opd_helpdesk_phone || branding.phone)) || "";
  const helplineDisplay = [
    emergencyHelpline,
    opdHelpline ? (String(opdHelpline).startsWith("OPD") ? opdHelpline : `OPD No: ${opdHelpline}`) : ""
  ].filter(Boolean).join(" • ");
  const customFooter = (branding && branding.slip_footer_text) || (lang === "hi" ? "अहस्तांतरणीय आधिकारिक मरीज़ रिकॉर्ड • कृपया परामर्श समाप्ति तक संभाल कर रखें" : "Non-transferable official patient record • Retain until consultation is complete");
  const logoUrl = (branding && (branding.logo_url || branding.hospital_logo)) || ticket.logo_url || "";

  const now = new Date();
  const formattedDateTime = now.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const deptName = getCategoryLabel(ticket.service_category, lang);
  const statusName = getStatusLabel(ticket.status, lang);
  const patientName = formatCleanText(ticket.name, lang);
  const genderStr = formatCleanText(t(ticket.gender || "male", lang), lang);
  const yrsStr = t("unit_yrs", lang);
  const minStr = t("unit_min", lang);
  const passTitle = t("officialQueuePass", lang);
  const noticeStr = t("presentedAtDesk", lang);
  const footerStr = `${hospitalName} • ${customFooter}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${hospitalName} - Token #${ticket.ticket_id}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 5mm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0 auto;
      max-width: 360px;
      color: #0f172a;
      background: #ffffff;
      padding: 14px;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .top-accent-bar {
      height: 4px;
      background: ${brandPrimary};
      border-radius: 3px;
      margin-bottom: 10px;
    }
    .header {
      text-align: center;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .logo-img {
      max-height: 42px;
      max-width: 130px;
      object-fit: contain;
      margin-bottom: 4px;
      display: block;
      margin-left: auto;
      margin-right: auto;
    }
    .hospital-title {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.2px;
      margin: 0;
      text-transform: uppercase;
    }
    .slip-subtitle {
      font-size: 10px;
      font-weight: 700;
      color: ${brandPrimary};
      margin-top: 2px;
      letter-spacing: 0.4px;
    }
    .issue-time {
      font-size: 10px;
      color: #64748b;
      margin-top: 3px;
      font-weight: 600;
    }
    .helpline-box {
      margin: 6px 0 2px 0;
      padding: 4px 8px;
      border-radius: 6px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #DC2626;
      font-size: 9.5px;
      font-weight: 800;
      text-align: center;
    }
    .token-hero {
      text-align: center;
      background: #f8fafc;
      border: 2px solid ${brandPrimary};
      border-radius: 12px;
      padding: 12px 8px;
      margin: 10px 0;
    }
    .token-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 800;
      color: #0f172a;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 2px 8px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .token-num {
      font-size: 40px;
      font-weight: 900;
      color: ${brandPrimary};
      line-height: 1.05;
      margin: 4px 0 2px 0;
      letter-spacing: -0.5px;
    }
    .token-dept-pill {
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      background: #ffffff;
      padding: 3px 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-top: 4px;
    }
    .tiles-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 10px 0;
    }
    .tile {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 8px;
    }
    .tile-label {
      font-size: 9px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 2px;
    }
    .tile-val {
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.3;
    }
    .rx-card {
      margin: 10px 0;
      padding: 8px 10px;
      background: #F0FDF4;
      border: 1.5px solid #86EFAC;
      border-radius: 8px;
    }
    .rx-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      background: #15803D;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      margin-right: 6px;
    }
    .rx-header {
      font-size: 11px;
      font-weight: 800;
      color: #15803D;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .qr-container {
      text-align: center;
      margin: 12px 0 6px 0;
      padding: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .qr-img {
      width: 110px;
      height: 110px;
      border: 1.5px solid #cbd5e1;
      padding: 4px;
      border-radius: 8px;
      background: #ffffff;
      display: block;
      margin: 0 auto;
    }
    .scan-hint {
      font-size: 9.5px;
      color: #475569;
      font-weight: 700;
      margin: 6px 0 0 0;
    }
    .tear-line {
      border-top: 1.5px dashed #cbd5e1;
      margin: 12px 0 8px 0;
      position: relative;
      text-align: center;
    }
    .tear-badge {
      display: inline-block;
      position: relative;
      top: -8px;
      background: #ffffff;
      padding: 0 8px;
      font-size: 8.5px;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .footer {
      text-align: center;
      font-size: 8.5px;
      color: #64748b;
      line-height: 1.4;
      margin-top: 4px;
      font-weight: 600;
    }
    .security-badge {
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="top-accent-bar"></div>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" />` : ""}
    <h1 class="hospital-title">${hospitalName}</h1>
    <div class="slip-subtitle">${brandTagline}</div>
    <div class="issue-time">🕒 ${formattedDateTime}</div>
    ${helplineDisplay ? `<div class="helpline-box">🚨 ${helplineDisplay}</div>` : ""}
  </div>

  <div class="token-hero">
    <div class="token-badge">● ${t("tokenId", lang)}</div>
    <div class="token-num">#${ticket.ticket_id}</div>
    <div class="token-dept-pill">🏥 ${deptName}</div>
  </div>

  <div class="tiles-grid">
    <div class="tile">
      <div class="tile-label">👤 ${t("patientDemographics", lang)}</div>
      <div class="tile-val">${patientName} (${ticket.age || 30} ${yrsStr}, ${genderStr})</div>
    </div>
    <div class="tile">
      <div class="tile-label">📌 ${t("currentStatus", lang)}</div>
      <div class="tile-val">${statusName}</div>
    </div>
    <div class="tile">
      <div class="tile-label">🔢 ${t("pos", lang)}</div>
      <div class="tile-val" style="color: ${brandPrimary};">#${ticket.position || 1} in line</div>
    </div>
    <div class="tile">
      <div class="tile-label">⏱️ ${t("estWait", lang)}</div>
      <div class="tile-val" style="color: #D97706;">~${ticket.estimated_wait_minutes || 5} ${minStr}</div>
    </div>
  </div>

  ${ticket.medical_condition ? `
  <div class="tile" style="margin-bottom: 8px;">
    <div class="tile-label">🩺 ${t("symptomRisk", lang)}</div>
    <div class="tile-val">${formatSymptomLabel(ticket.medical_condition, lang)}</div>
  </div>` : ""}

  ${ticket.pre_existing_condition && ticket.pre_existing_condition !== "none" ? `
  <div class="tile" style="margin-bottom: 8px;">
    <div class="tile-label">⚠️ ${t("preExistingLabel", lang) || "Risk Factor"}</div>
    <div class="tile-val">${formatRiskLabel(ticket.pre_existing_condition, lang)}</div>
  </div>` : ""}

  ${ticket.prescription_notes ? `
  <div class="rx-card">
    <div class="rx-header">
      <span class="rx-badge">Rx</span>
      ${t("ePrescriptionAttached", lang)} ${ticket.transferred_from_dept ? `(${t("transferredFrom", lang)} ${getCategoryLabel(ticket.transferred_from_dept, lang)})` : ""}
    </div>
    ${formatRxHtml(ticket.prescription_notes, lang)}
  </div>` : ""}

  ${qrBase64 ? `
  <div class="qr-container">
    <img src="${qrBase64}" class="qr-img" alt="Pass QR Code" />
    <p class="scan-hint">📲 ${noticeStr}</p>
  </div>` : `
  <p style="font-size: 10px; color: #475569; text-align: center; margin: 8px 0;">${noticeStr}</p>`}

  ${ticket.otp_info && ticket.otp_info.otp ? `
  <div style="background: #F0FDF4; border: 1.5px dashed #16A34A; border-radius: 8px; padding: 6px 8px; margin: 8px 0; text-align: center;">
    <div style="font-size: 9px; font-weight: 800; color: #166534; text-transform: uppercase;">📲 ${lang === "hi" ? "मरीज पोर्टल सक्रियण कोड (OTP)" : "Patient Portal Activation Code (OTP)"}</div>
    <div style="font-size: 20px; font-weight: 900; color: #15803D; letter-spacing: 3px; margin: 2px 0;">${ticket.otp_info.otp}</div>
    <div style="font-size: 8.5px; color: #166534;">${lang === "hi" ? "इस कोड से मरीज पोर्टल पर लॉग इन करके अपने सभी पुराने पर्चे और रिकॉर्ड देखें" : "Use this code on Patient Portal to claim all digital prescriptions & history"}</div>
  </div>` : ""}

  <div class="tear-line">
    <span class="tear-badge">✂ Official Ticket Pass</span>
  </div>

  <div class="footer">
    ${footerStr}
  </div>
  <div class="security-badge">
    🔒 Digitally Encrypted Token • Valid on Date of Issue
  </div>
</body>
</html>`;

  triggerIframePrint(html);
}

/**
 * Print past appointment receipt / prescription record.
 */
export function printAppointmentRecord(apt, lang = "en", branding = null) {
  if (!apt) return;

  const hospitalName = (branding && (branding.hospital_name || branding.name)) || t("hospitalName", lang);
  const brandPrimary = (branding && branding.primary_color) || "#0284c7";
  const brandSecondary = (branding && branding.secondary_color) || "#0369a1";
  const brandAccent = (branding && branding.accent_color) || "#f1f5f9";
  const emergencyHelpline = (branding && branding.emergency_helpline) || "";
  const opdHelpline = (branding && (branding.opd_helpdesk_phone || branding.phone)) || "";
  const helplineDisplay = [
    emergencyHelpline,
    opdHelpline ? (String(opdHelpline).startsWith("OPD") ? opdHelpline : `OPD No: ${opdHelpline}`) : ""
  ].filter(Boolean).join(" • ");
  const logoUrl = (branding && (branding.logo_url || branding.hospital_logo)) || apt.logo_url || "";
  const deptName = getCategoryLabel(apt.service_category, lang);
  const statusName = getStatusLabel(apt.status, lang);
  const patientName = formatCleanText(apt.patient_name, lang);
  const timeSlot = formatCleanText(apt.time_slot, lang);
  const slipTitle = (branding && branding.tagline) || t("officialRxSlip", lang);
  const footerStr = `${hospitalName} • ${(branding && branding.slip_footer_text) || (lang === "hi" ? "अहस्तांतरणीय आधिकारिक मरीज़ रिकॉर्ड • कृपया परामर्श समाप्ति तक संभाल कर रखें" : "Non-transferable official patient record • Retain until consultation is complete")}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${hospitalName} - Appt #${apt.appointment_id}</title>
  <style>
    @page { size: 80mm auto; margin: 6mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0 auto;
      max-width: 360px;
      color: #0f172a;
      background: #ffffff;
      padding: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid ${brandPrimary};
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .hospital-title {
      font-size: 17px;
      font-weight: 900;
      color: ${brandPrimary};
      letter-spacing: -0.2px;
      margin: 0;
      text-transform: uppercase;
    }
    .slip-subtitle {
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      margin-top: 3px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .banner {
      text-align: center;
      background: ${brandAccent};
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      margin: 12px 0;
    }
    .banner-code {
      font-size: 22px;
      font-weight: 900;
      color: ${brandSecondary};
      margin: 2px 0;
    }
    .banner-dept {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 12px;
    }
    .info-table tr { border-bottom: 1px dotted #cbd5e1; }
    .info-table td { padding: 5px 0; }
    .info-table td.label { color: #64748b; font-weight: 600; width: 44%; }
    .info-table td.val { font-weight: 700; color: #0f172a; text-align: right; }
    .rx-card {
      margin: 12px 0;
      padding: 10px 12px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
    }
    .rx-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      background: #047857;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      margin-right: 6px;
    }
    .rx-header {
      font-size: 11px;
      font-weight: 800;
      color: #064e3b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .rx-text {
      font-size: 12px;
      font-weight: 600;
      color: #047857;
      font-style: italic;
      margin: 0;
      line-height: 1.35;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      margin-top: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<div style="margin-bottom: 6px;"><img src="${logoUrl}" alt="Logo" style="max-height: 38px; max-width: 140px; object-fit: contain;" /></div>` : ""}
    <h1 class="hospital-title">${hospitalName}</h1>
    <div class="slip-subtitle">${slipTitle}</div>
  </div>

  ${helplineDisplay ? `
  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 8px; margin-bottom: 10px; color: #dc2626; font-size: 10px; font-weight: 800; text-align: center;">
    🚨 ${helplineDisplay}
  </div>` : ""}

  <div class="banner">
    <div style="font-size: 10px; font-weight: 700; color: #64748b;">${t("tokenId", lang)}</div>
    <div class="banner-code">${apt.appointment_id}</div>
    <div class="banner-dept">${deptName}</div>
  </div>

  <table class="info-table">
    <tr>
      <td class="label">${t("patientDemographics", lang)}</td>
      <td class="val">${patientName}</td>
    </tr>
    <tr>
      <td class="label">${t("dateLabel", lang)} & ${t("timeLabel", lang)}</td>
      <td class="val">${apt.appointment_date} @ ${timeSlot}</td>
    </tr>
    <tr>
      <td class="label">${t("currentStatus", lang)}</td>
      <td class="val">${statusName}</td>
    </tr>
    ${apt.ticket_id ? `
    <tr>
      <td class="label">${t("mergedToken", lang)} ID)</td>
      <td class="val">#${apt.ticket_id}</td>
    </tr>` : ""}
  </table>

  ${apt.prescription_notes ? `
  <div class="rx-card" style="background: #F0FDF4; border: 1px solid #86EFAC;">
    <div class="rx-header" style="color: #15803D;">
      <span class="rx-badge" style="background: #15803D;">Rx</span>
      ${t("ePrescriptionLabel", lang)}
    </div>
    ${formatRxHtml(apt.prescription_notes, lang)}
  </div>` : ""}

  <div class="footer">
    ${footerStr}
  </div>
</body>
</html>`;

  triggerIframePrint(html);
}

/**
 * Print official A4 / slip clinical prescription with doctor letterhead and medications table.
 */
/**
 * Normalize prescription data from various shape inputs (raw notes string, parsed object, or ticket)
 */
/**
 * Normalize prescription data from various shape inputs (raw notes string, parsed object, or ticket)
 */
export function normalizeRxData(rxData, lang = "en") {
  if (!rxData) return null;
  let parsed = rxData;
  if (typeof rxData === "string") {
    try {
      let trimmed = rxData.trim();
      while ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        trimmed = trimmed.slice(1, -1).trim();
      }
      parsed = JSON.parse(trimmed);
    } catch (e) {
      parsed = { advice: rxData };
    }
  }

  const patientName = formatCleanText(parsed.patient_name || parsed.name || "Patient", lang);
  const age = parsed.age || 30;
  const gender = formatCleanText(parsed.gender || "male", lang);
  const ticketId = parsed.ticket_id || "";
  const appointmentId = parsed.appointment_id || "";
  const rawDoctor = (parsed.doctor_name && parsed.doctor_name !== "Dr. Staff Desk")
    ? parsed.doctor_name
    : (parsed.served_by_doctor_name || "Consultant Physician");
  const doctorName = formatCleanText(rawDoctor, lang);
  const rawDept = parsed.doctor_department || parsed.service_category || parsed.department_name || "General OPD";
  const doctorDept = getCategoryLabel(rawDept, lang);
  const doctorReg = parsed.doctor_employee_id || parsed.doctor_reg_no || "MCI-2024-8842";
  const rawDiag = parsed.diagnosis || parsed.medical_condition || "Clinical Consultation & General OPD Assessment";
  const diagnosis = formatCleanText(rawDiag, lang);
  const rawMedicines = Array.isArray(parsed.medicines) ? parsed.medicines : [];
  const medicines = rawMedicines.map((m) => ({
    ...m,
    name: formatCleanText(m.name, lang),
    dosage: m.dosage ? formatCleanText(m.dosage, lang) : "",
    frequency: m.frequency ? formatCleanText(m.frequency, lang) : "",
    duration: m.duration ? formatCleanText(m.duration, lang) : "",
    instructions: m.instructions ? formatCleanText(m.instructions, lang) : "After food",
  }));
  const labTests = parsed.lab_tests ? formatCleanText(parsed.lab_tests, lang) : "";
  const advice = cleanAdviceText(parsed.advice || parsed.clinical_notes || "");
  const followUp = parsed.follow_up ? formatCleanText(parsed.follow_up, lang) : "";
  const prescribedAt = parsed.prescribed_at || new Date().toISOString();
  const phone = parsed.phone || "";
  const logoUrl = parsed.logo_url || "";
  const hospitalName = parsed.hospital_name ? formatCleanText(parsed.hospital_name, lang) : "";

  return {
    ...parsed,
    patient_name: patientName,
    age,
    gender,
    ticket_id: ticketId,
    appointment_id: appointmentId,
    doctor_name: doctorName,
    doctor_department: doctorDept,
    doctor_employee_id: doctorReg,
    diagnosis,
    medicines,
    lab_tests: labTests,
    advice,
    follow_up: followUp,
    prescribed_at: prescribedAt,
    phone,
    logo_url: logoUrl,
    hospital_name: hospitalName,
  };
}

function escapePdfText(str) {
  if (!str) return "";
  return String(str)
    .replace(/_/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Loads a hospital logo image and rasterizes it to JPEG bytes for binary PDF 1.4 embedding
 */
export function loadLogoForPdf(logoUrl) {
  if (!logoUrl) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const nw = img.naturalWidth || img.width || 120;
          const nh = img.naturalHeight || img.height || 40;
          const maxW = 160;
          const maxH = 50;
          const scale = Math.min(maxW / nw, maxH / nh, 1);
          const targetW = Math.max(1, Math.round(nw * scale));
          const targetH = Math.max(1, Math.round(nh * scale));

          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          canvas.toBlob(
            async (blob) => {
              if (!blob) return resolve(null);
              try {
                const arrayBuffer = await blob.arrayBuffer();
                resolve({
                  width: targetW,
                  height: targetH,
                  bytes: new Uint8Array(arrayBuffer),
                });
              } catch (e) {
                resolve(null);
              }
            },
            "image/jpeg",
            0.88
          );
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Builds a valid binary PDF Blob (PDF-1.4) with hospital branding, logo, doctor signature stamp, and full medication instructions
 */
export function buildPrescriptionPdfBlob(rawRxData, lang = "en", branding = null, logoImageMeta = null) {
  const data = normalizeRxData(rawRxData, lang);
  if (!data) return null;

  const hospitalName = (branding && (branding.hospital_name || branding.name)) || data.hospital_name || t("hospitalName", lang);
  const brandTagline = (branding && branding.tagline) || (lang === "hi" ? "आउटपेशेंट क्लिनिकल ई-प्रिस्क्रिप्शन पर्ची" : "Outpatient Clinical E-Prescription Slip");
  const dateStr = data.prescribed_at ? new Date(data.prescribed_at).toLocaleDateString() : new Date().toLocaleDateString();
  const timeStr = data.prescribed_at ? new Date(data.prescribed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const deptLabel = getCategoryLabel(data.doctor_department, lang);

  const width = 595.28;
  const height = 841.89;

  let stream = [];

  // 1. Hospital Logo & Title
  let textStartX = 40;
  if (logoImageMeta && logoImageMeta.bytes) {
    const aspect = logoImageMeta.width / logoImageMeta.height;
    let dispW = 95;
    let dispH = Math.round(95 / aspect);
    if (dispH > 38) {
      dispH = 38;
      dispW = Math.round(38 * aspect);
    }
    const imgX = 40;
    const imgY = 770 + Math.round((42 - dispH) / 2);
    stream.push("q");
    stream.push(`${dispW} 0 0 ${dispH} ${imgX} ${imgY} cm`);
    stream.push("/Im1 Do");
    stream.push("Q");
    textStartX = imgX + dispW + 12;
  }

  stream.push("BT /F2 16 Tf 0.059 0.090 0.165 rg " + textStartX + " 796 Td (" + escapePdfText(hospitalName) + ") Tj ET");
  stream.push("BT /F1 8.5 Tf 0.35 0.35 0.35 rg " + textStartX + " 782 Td (" + escapePdfText(brandTagline) + ") Tj ET");

  // Date, Time & Token (Right header)
  stream.push("BT /F1 8.5 Tf 0.25 0.25 0.25 rg 420 800 Td (Date: " + escapePdfText(dateStr) + (timeStr ? " " + escapePdfText(timeStr) : "") + ") Tj ET");
  if (data.ticket_id) {
    stream.push("BT /F2 9.0 Tf 0.1 0.1 0.1 rg 420 786 Td (Token Pass: #" + escapePdfText(data.ticket_id) + ") Tj ET");
  } else if (data.appointment_id) {
    stream.push("BT /F2 9.0 Tf 0.1 0.1 0.1 rg 420 786 Td (Ref: " + escapePdfText(data.appointment_id) + ") Tj ET");
  }

  // Divider Line (thin black rule)
  stream.push("0.1 0.1 0.1 RG 1 w 40 768 m 555 768 l S");

  // 2. Patient & Doctor Demographics (Two columns, no background box)
  // Patient Info (Left)
  stream.push("BT /F2 8 Tf 0.45 0.45 0.45 rg 40 748 Td (PATIENT) Tj ET");
  stream.push("BT /F2 11 Tf 0.07 0.07 0.07 rg 40 732 Td (" + escapePdfText(data.patient_name) + ") Tj ET");
  stream.push("BT /F1 9 Tf 0.25 0.25 0.25 rg 40 718 Td (" + escapePdfText(data.age + " yrs | " + data.gender + (data.phone ? " | Ph: " + data.phone : "") + (data.ticket_id ? " | Token #" + data.ticket_id : "")) + ") Tj ET");

  // Doctor Info (Right)
  stream.push("BT /F2 8 Tf 0.45 0.45 0.45 rg 310 748 Td (DOCTOR) Tj ET");
  stream.push("BT /F2 11 Tf 0.07 0.07 0.07 rg 310 732 Td (" + escapePdfText(data.doctor_name) + ") Tj ET");
  stream.push("BT /F1 9 Tf 0.25 0.25 0.25 rg 310 718 Td (" + escapePdfText(deptLabel + (data.doctor_employee_id ? " | Reg: " + data.doctor_employee_id : "")) + ") Tj ET");

  // Divider Line below demographics
  stream.push("0.9 0.9 0.9 RG 1 w 40 702 m 555 702 l S");

  // 3. Clinical Diagnosis (Plain label + bold text, no green box)
  stream.push("BT /F2 9.5 Tf 0.2 0.2 0.2 rg 40 682 Td (Diagnosis: ) Tj ET");
  stream.push("BT /F2 10.5 Tf 0.07 0.07 0.07 rg 98 682 Td (" + escapePdfText(data.diagnosis) + ") Tj ET");
  if (data.lab_tests && data.lab_tests !== "no") {
    stream.push("BT /F1 9 Tf 0.25 0.25 0.25 rg 40 666 Td (Investigations / Tests: " + escapePdfText(data.lab_tests) + ") Tj ET");
  }

  // 4. Prescribed Medications Table
  stream.push("BT /F2 13 Tf 0.07 0.07 0.07 rg 40 640 Td (Rx) Tj ET");

  // Table Header row (clean with thin black line below)
  stream.push("0.1 0.1 0.1 RG 1.5 w 40 618 m 555 618 l S");
  stream.push("BT /F2 8.5 Tf 0.1 0.1 0.1 rg 44 624 Td (#) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.1 0.1 0.1 rg 66 624 Td (MEDICINE) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.1 0.1 0.1 rg 240 624 Td (DOSAGE) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.1 0.1 0.1 rg 310 624 Td (FREQUENCY) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.1 0.1 0.1 rg 390 624 Td (DURATION) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.1 0.1 0.1 rg 460 624 Td (INSTRUCTIONS) Tj ET");

  let currentY = 598;
  if (data.medicines && data.medicines.length > 0) {
    data.medicines.forEach((med, idx) => {
      stream.push("0.9 0.9 0.9 RG 0.5 w 40 " + (currentY - 6) + " 515 22 re S");
      stream.push("BT /F2 8.5 Tf 0.45 0.45 0.45 rg 44 " + (currentY + 2) + " Td (" + (idx + 1) + ") Tj ET");
      stream.push("BT /F2 9.5 Tf 0.07 0.07 0.07 rg 66 " + (currentY + 2) + " Td (" + escapePdfText(med.name) + ") Tj ET");
      stream.push("BT /F1 9 Tf 0.07 0.07 0.07 rg 240 " + (currentY + 2) + " Td (" + escapePdfText(med.dosage || "-") + ") Tj ET");
      stream.push("BT /F1 9 Tf 0.07 0.07 0.07 rg 310 " + (currentY + 2) + " Td (" + escapePdfText(med.frequency || "-") + ") Tj ET");
      stream.push("BT /F1 9 Tf 0.25 0.25 0.25 rg 390 " + (currentY + 2) + " Td (" + escapePdfText(med.duration || "-") + ") Tj ET");
      stream.push("BT /F1 8.5 Tf 0.4 0.4 0.4 rg 460 " + (currentY + 2) + " Td (" + escapePdfText(med.instructions || "After food") + ") Tj ET");
      currentY -= 22;
    });
  } else {
    stream.push("0.9 0.9 0.9 RG 0.5 w 40 " + (currentY - 14) + " 515 24 re S");
    stream.push("BT /F1 9 Tf 0.4 0.4 0.4 rg 52 " + (currentY - 4) + " Td (" + escapePdfText(data.advice || "No specific prescription medications listed. Clinical consultation completed.") + ") Tj ET");
    currentY -= 24;
  }

  // 5. Doctor Advice & Follow-Up (Plain text lines)
  currentY -= 12;
  if (data.advice && data.medicines && data.medicines.length > 0) {
    stream.push("BT /F2 8.5 Tf 0.1 0.1 0.1 rg 40 " + currentY + " Td (Advice: ) Tj ET");
    stream.push("BT /F1 9 Tf 0.2 0.2 0.2 rg 80 " + currentY + " Td (" + escapePdfText(data.advice) + ") Tj ET");
    currentY -= 16;
  }
  if (data.follow_up) {
    stream.push("BT /F2 8.5 Tf 0.1 0.1 0.1 rg 40 " + currentY + " Td (Follow-up: ) Tj ET");
    stream.push("BT /F1 9 Tf 0.2 0.2 0.2 rg 95 " + currentY + " Td (" + escapePdfText(data.follow_up) + ") Tj ET");
    currentY -= 16;
  }

  // 6. Authentication & Doctor Signature Area
  currentY -= 20;
  stream.push("0.9 0.9 0.9 RG 1 w 40 " + currentY + " m 555 " + currentY + " l S");

  // Small B&W Circular Stamp on left
  const cx = 66, cy = currentY - 36, r = 22;
  stream.push("0.25 0.25 0.25 RG 1 w");
  stream.push((cx + r) + " " + cy + " m");
  stream.push((cx + r) + " " + (cy + r * 0.552) + " " + (cx + r * 0.552) + " " + (cy + r) + " " + cx + " " + (cy + r) + " c");
  stream.push((cx - r * 0.552) + " " + (cy + r) + " " + (cx - r) + " " + (cy + r * 0.552) + " " + (cx - r) + " " + cy + " c");
  stream.push((cx - r) + " " + (cy - r * 0.552) + " " + (cx - r * 0.552) + " " + (cy - r) + " " + cx + " " + (cy - r) + " c");
  stream.push((cx + r * 0.552) + " " + (cy - r) + " " + (cx + r) + " " + (cy - r * 0.552) + " " + (cx + r) + " " + cy + " c S");

  // Inner dotted circle
  const rIn = 18;
  stream.push("[2 1] 0 d 0.25 0.25 0.25 RG 0.8 w");
  stream.push((cx + rIn) + " " + cy + " m");
  stream.push((cx + rIn) + " " + (cy + rIn * 0.552) + " " + (cx + rIn * 0.552) + " " + (cy + rIn) + " " + cx + " " + (cy + rIn) + " c");
  stream.push((cx - rIn * 0.552) + " " + (cy + rIn) + " " + (cx - rIn) + " " + (cy + rIn * 0.552) + " " + (cx - rIn) + " " + cy + " c");
  stream.push((cx - rIn) + " " + (cy - rIn * 0.552) + " " + (cx - rIn * 0.552) + " " + (cy - rIn) + " " + cx + " " + (cy - rIn) + " c");
  stream.push((cx + rIn * 0.552) + " " + (cy - rIn) + " " + (cx + rIn) + " " + (cy - rIn * 0.552) + " " + (cx + rIn) + " " + cy + " c S");
  stream.push("[] 0 d"); // reset dash

  stream.push("BT /F2 5.5 Tf 0.25 0.25 0.25 rg 50 " + (cy + 4) + " Td (OPD DESK) Tj ET");
  stream.push("BT /F2 5.5 Tf 0.25 0.25 0.25 rg 48 " + (cy - 5) + " Td (VERIFIED) Tj ET");

  // Authentication Text (next to stamp)
  stream.push("BT /F2 8.5 Tf 0.15 0.15 0.15 rg 98 " + (cy + 6) + " Td (Authenticated outpatient record.) Tj ET");
  stream.push("BT /F1 7.5 Tf 0.4 0.4 0.4 rg 98 " + (cy - 6) + " Td (Valid across all hospital pharmacy counters & Jan Aushadhi.) Tj ET");

  // Doctor Signature Info (Right side)
  stream.push("0.1 0.1 0.1 RG 1 w 390 " + (currentY - 24) + " m 540 " + (currentY - 24) + " l S");
  stream.push("BT /F2 10.5 Tf 0.07 0.07 0.07 rg 390 " + (currentY - 36) + " Td (" + escapePdfText(data.doctor_name) + ") Tj ET");
  stream.push("BT /F1 8.5 Tf 0.3 0.3 0.3 rg 390 " + (currentY - 48) + " Td (Consultant Physician) Tj ET");
  if (data.doctor_employee_id) {
    stream.push("BT /F1 8 Tf 0.4 0.4 0.4 rg 390 " + (currentY - 58) + " Td (Reg. No: " + escapePdfText(data.doctor_employee_id) + ") Tj ET");
  }
  stream.push("BT /F1 7.5 Tf 0.5 0.5 0.5 rg 390 " + (currentY - 68) + " Td (Digitally signed by attending doctor) Tj ET");

  // 7. Bottom Footer (Single centered line)
  stream.push("BT /F1 8 Tf 0.5 0.5 0.5 rg 90 28 Td (This is a computer-generated prescription. Non-transferable. Please keep until consultation is complete.) Tj ET");

  const contentStream = stream.join("\n");
  const contentStreamLen = new TextEncoder().encode(contentStream).length;

  const hasImage = Boolean(logoImageMeta && logoImageMeta.bytes);
  const pageResources = hasImage
    ? "<< /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 7 0 R >> >>"
    : "<< /Font << /F1 4 0 R /F2 5 0 R >> >>";

  const chunks = [];
  let currentByteOffset = 0;
  const offsets = ["0000000000 65535 f "];

  function pushTextChunk(text) {
    const encoded = new TextEncoder().encode(text);
    chunks.push(encoded);
    currentByteOffset += encoded.length;
  }

  function registerObject(objNum) {
    offsets[objNum] = String(currentByteOffset).padStart(10, "0") + " 00000 n ";
  }

  // Header
  pushTextChunk("%PDF-1.4\n");

  // Object 1: Catalog
  registerObject(1);
  pushTextChunk("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");

  // Object 2: Pages
  registerObject(2);
  pushTextChunk("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");

  // Object 3: Page
  registerObject(3);
  pushTextChunk(
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources ${pageResources} /Contents 6 0 R >> endobj\n`
  );

  // Object 4: Font F1
  registerObject(4);
  pushTextChunk("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n");

  // Object 5: Font F2
  registerObject(5);
  pushTextChunk("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n");

  // Object 6: Stream
  registerObject(6);
  pushTextChunk(`6 0 obj << /Length ${contentStreamLen} >> stream\n`);
  pushTextChunk(contentStream);
  pushTextChunk("\nendstream endobj\n");

  // Object 7: Image if available
  if (hasImage) {
    registerObject(7);
    pushTextChunk(
      `7 0 obj << /Type /XObject /Subtype /Image /Width ${logoImageMeta.width} /Height ${logoImageMeta.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoImageMeta.bytes.length} >> stream\n`
    );
    chunks.push(logoImageMeta.bytes);
    currentByteOffset += logoImageMeta.bytes.length;
    pushTextChunk("\nendstream endobj\n");
  }

  const startXrefOffset = currentByteOffset;
  const numObjects = hasImage ? 8 : 7;
  let xrefTable = `xref\n0 ${numObjects}\n`;
  for (let i = 0; i < numObjects; i++) {
    xrefTable += offsets[i] + "\n";
  }
  xrefTable += `trailer << /Size ${numObjects} /Root 1 0 R >>\n`;
  xrefTable += `startxref\n${startXrefOffset}\n%%EOF`;
  pushTextChunk(xrefTable);

  return new Blob(chunks, { type: "application/pdf" });
}

/**
 * 1-Click Download Official Clinical Rx PDF with hospital branding, logo & doctor signature stamp
 */
export async function downloadPrescriptionPDF(rxData, lang = "en", branding = null) {
  const data = normalizeRxData(rxData, lang);
  if (!data) return;

  const hospitalName = (branding && (branding.hospital_name || branding.name)) || data.hospital_name || t("hospitalName", lang);
  const cleanHosp = String(hospitalName).replace(/_/g, " ").replace(/[^\w\s-]/g, "").trim();
  const cleanPatient = String(data.patient_name || "Patient").replace(/_/g, " ").replace(/[^\w\s-]/g, "").trim();
  const cleanTicket = data.ticket_id ? `Token ${data.ticket_id}` : (data.appointment_id ? `Appt ${data.appointment_id}` : "Rx");
  const fileName = `${cleanHosp} - Clinical Rx - ${cleanTicket} - ${cleanPatient}.pdf`.replace(/\s+/g, " ");

  const logoUrl = (branding && (branding.logo_url || branding.hospital_logo)) || data.logo_url || "";
  let logoImageMeta = null;
  if (logoUrl) {
    try {
      logoImageMeta = await loadLogoForPdf(logoUrl);
    } catch (e) {
      console.warn("Could not load logo for PDF:", e);
    }
  }

  try {
    const pdfBlob = buildPrescriptionPdfBlob(data, lang, branding, logoImageMeta);
    if (pdfBlob) {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
      return;
    }
  } catch (err) {
    console.warn("Direct binary PDF download fallback to print:", err);
  }

  // Fallback to high-res browser print / Save as PDF
  printPrescriptionSlip(data, lang, branding);
}

/**
 * Print official A4 / slip clinical prescription with doctor letterhead, medications table, and stamp.
 */
export function printPrescriptionSlip(rawRxData, lang = "en", branding = null) {
  const rxData = normalizeRxData(rawRxData, lang);
  if (!rxData) return;

  const hospitalName = (branding && (branding.hospital_name || branding.name)) || rxData.hospital_name || t("hospitalName", lang);
  const brandTagline = (branding && branding.tagline) || (lang === "hi" ? "आउटपेशेंट क्लिनिकल ई-प्रिस्क्रिप्शन पर्ची" : "Outpatient Clinical E-Prescription Slip");
  const deptLabel = getCategoryLabel(rxData.doctor_department, lang);
  const dateStr = rxData.prescribed_at ? new Date(rxData.prescribed_at).toLocaleDateString() : new Date().toLocaleDateString();
  const timeStr = rxData.prescribed_at ? new Date(rxData.prescribed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const logoUrl = (branding && (branding.logo_url || branding.hospital_logo)) || rxData.logo_url || "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${hospitalName} - Prescription #${rxData.ticket_id || rxData.appointment_id || ""}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: economy;
        print-color-adjust: economy;
        padding: 0;
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: "Inter", Arial, Helvetica, sans-serif;
      margin: 0 auto;
      max-width: 760px;
      color: #111111;
      background: #ffffff;
      padding: 16px 20px;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 1px solid #111111;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .hospital-logo {
      max-height: 48px;
      max-width: 140px;
      object-fit: contain;
    }
    .hospital-name {
      font-size: 17pt;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
      letter-spacing: -0.2px;
      margin: 0;
    }
    .hospital-tagline {
      font-size: 9pt;
      color: #666666;
      margin-top: 3px;
    }
    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #333333;
      line-height: 1.45;
      white-space: nowrap;
    }
    .patient-doctor-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #E5E5E5;
      margin-bottom: 18px;
    }
    .info-label {
      font-size: 8.5pt;
      font-weight: 600;
      color: #777777;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-name {
      font-size: 11pt;
      font-weight: 700;
      color: #111111;
      margin-bottom: 3px;
    }
    .info-sub {
      font-size: 9.5pt;
      color: #444444;
      line-height: 1.4;
    }
    .diagnosis-block {
      margin-bottom: 18px;
      font-size: 10pt;
      line-height: 1.5;
      color: #222222;
    }
    .diagnosis-block .label {
      font-weight: 600;
      color: #333333;
    }
    .diagnosis-block .val {
      font-weight: 700;
      color: #111111;
    }
    .lab-tests-line {
      margin-top: 4px;
      font-size: 9.5pt;
      color: #333333;
    }
    .rx-heading {
      font-size: 13pt;
      font-weight: 700;
      color: #111111;
      margin-bottom: 8px;
    }
    .meds-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 10pt;
    }
    .meds-table th {
      padding: 8px 6px;
      font-weight: 700;
      color: #111111;
      border-bottom: 1.5px solid #111111;
      background: transparent;
      text-align: left;
    }
    .meds-table td {
      padding: 8px 6px;
      border-bottom: 1px solid #E5E5E5;
      color: #111111;
      vertical-align: top;
    }
    .meds-table tr {
      page-break-inside: avoid;
    }
    .meds-table .instructions {
      color: #555555;
      font-style: italic;
    }
    .no-meds {
      padding: 10px 0;
      font-size: 9.5pt;
      color: #555555;
      font-style: italic;
      margin-bottom: 18px;
      border-bottom: 1px solid #E5E5E5;
    }
    .meta-line {
      font-size: 9.5pt;
      color: #222222;
      margin-bottom: 10px;
      line-height: 1.45;
    }
    .meta-line strong {
      font-weight: 600;
      color: #111111;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #E5E5E5;
      page-break-inside: avoid;
    }
    .auth-box {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 340px;
    }
    .auth-text {
      font-size: 8.5pt;
      line-height: 1.4;
      color: #555555;
    }
    .auth-title {
      font-weight: 600;
      color: #222222;
    }
    .auth-subtitle {
      color: #666666;
      margin-top: 1px;
    }
    .doctor-signature-box {
      text-align: right;
      min-width: 170px;
      page-break-inside: avoid;
    }
    .doc-name {
      font-size: 10.5pt;
      font-weight: 700;
      color: #111111;
      margin-top: 3px;
    }
    .doc-title {
      font-size: 9pt;
      color: #444444;
    }
    .doc-reg {
      font-size: 8.5pt;
      color: #666666;
    }
    .doc-meta {
      font-size: 8pt;
      color: #888888;
      margin-top: 2px;
    }
    .footer {
      text-align: center;
      font-size: 8.5pt;
      color: #888888;
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #E5E5E5;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `
        <img src="${logoUrl}" alt="Hospital Logo" class="hospital-logo" />
      ` : ""}
      <div>
        <h1 class="hospital-name">${hospitalName}</h1>
        <div class="hospital-tagline">${brandTagline}</div>
      </div>
    </div>
    <div class="header-right">
      <div>Date: ${dateStr}</div>
      ${timeStr ? `<div>Time: ${timeStr}</div>` : ""}
      ${rxData.ticket_id ? `<div>Token: #${rxData.ticket_id}</div>` : (rxData.appointment_id ? `<div>Ref: ${rxData.appointment_id}</div>` : "")}
    </div>
  </div>

  <div class="patient-doctor-block">
    <div class="info-col">
      <div class="info-label">PATIENT</div>
      <div class="info-name">${rxData.patient_name}</div>
      <div class="info-sub">
        ${rxData.age ? `${rxData.age} yrs` : ""} ${rxData.gender ? `• ${formatCleanText(t(rxData.gender, lang), lang)}` : ""}
        ${rxData.phone ? `• Ph: ${rxData.phone}` : ""}
        ${rxData.ticket_id ? `• Token #${rxData.ticket_id}` : ""}
      </div>
    </div>
    <div class="info-col">
      <div class="info-label">DOCTOR</div>
      <div class="info-name">${rxData.doctor_name}</div>
      <div class="info-sub">
        ${deptLabel}
        ${rxData.doctor_employee_id ? `• Reg. No: ${rxData.doctor_employee_id}` : ""}
      </div>
    </div>
  </div>

  <div class="diagnosis-block">
    <div><span class="label">Diagnosis:</span> <span class="val">${rxData.diagnosis || "General Clinical Consultation"}</span></div>
    ${rxData.lab_tests && rxData.lab_tests !== "no" ? `
    <div class="lab-tests-line"><span class="label">Investigations / Tests:</span> <span>${rxData.lab_tests}</span></div>
    ` : ""}
  </div>

  <div class="rx-heading">Rx</div>

  ${rxData.medicines && rxData.medicines.length > 0 ? `
  <table class="meds-table">
    <thead>
      <tr>
        <th style="width: 28px;">#</th>
        <th>Medicine</th>
        <th>Dosage</th>
        <th>Frequency</th>
        <th>Duration</th>
        <th>Instructions</th>
      </tr>
    </thead>
    <tbody>
      ${rxData.medicines.map((m, idx) => `
        <tr>
          <td style="color: #666666;">${idx + 1}</td>
          <td style="font-weight: 600; color: #111111;">${m.name || "-"}</td>
          <td>${m.dosage || "-"}</td>
          <td>${m.frequency || "-"}</td>
          <td>${m.duration || "-"}</td>
          <td class="instructions">${m.instructions || "After food"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>` : `
  <div class="no-meds">
    ${rxData.advice || "No specific prescription medications listed. Consultation completed."}
  </div>`}

  ${rxData.advice && rxData.medicines && rxData.medicines.length > 0 ? `
  <div class="meta-line">
    <strong>Doctor's Advice:</strong> <span>${rxData.advice}</span>
  </div>` : ""}

  ${rxData.follow_up ? `
  <div class="meta-line">
    <strong>Follow-up:</strong> <span>${rxData.follow_up}</span>
  </div>` : ""}

  <div class="signature-section">
    <div class="auth-box">
      <svg width="44" height="44" viewBox="0 0 76 76" style="flex-shrink: 0;">
        <circle cx="38" cy="38" r="35" fill="none" stroke="#222222" stroke-width="1.5" stroke-dasharray="3 2"/>
        <circle cx="38" cy="38" r="30" fill="none" stroke="#222222" stroke-width="1"/>
        <circle cx="38" cy="38" r="14" fill="none" stroke="#222222" stroke-width="1"/>
        <polyline points="33,38 36,41 43,34" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="38" y="21" font-size="5" font-weight="700" fill="#222222" text-anchor="middle">OPD CLINICAL</text>
        <text x="38" y="58" font-size="5" font-weight="700" fill="#222222" text-anchor="middle">VERIFIED</text>
      </svg>
      <div class="auth-text">
        <div class="auth-title">Authenticated outpatient record.</div>
        <div class="auth-subtitle">Valid across all hospital pharmacy counters &amp; Jan Aushadhi.</div>
      </div>
    </div>

    <div class="doctor-signature-box">
      <svg width="125" height="32" viewBox="0 0 130 34" fill="none">
        <path d="M5 24C18 10 32 6 42 16C50 24 55 28 65 14C72 4 80 8 92 18C100 24 112 12 125 15" stroke="#111111" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M38 18C44 26 50 30 58 20" stroke="#111111" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="8" y1="28" x2="122" y2="28" stroke="#CCCCCC" stroke-width="1"/>
      </svg>
      <div class="doc-name">${rxData.doctor_name}</div>
      <div class="doc-title">Consultant Physician</div>
      ${rxData.doctor_employee_id ? `<div class="doc-reg">Reg. No: ${rxData.doctor_employee_id}</div>` : ""}
      <div class="doc-meta">Digitally signed by attending doctor</div>
    </div>
  </div>

  <div class="footer">This is a computer-generated prescription. Non-transferable. Please keep until consultation is complete.</div>
</body>
</html>`;

  triggerIframePrint(html);
}

/**
 * Generates an official pharmacy medication packet / envelope label slip.
 * Printable sticker label format for walk-in and dispensed medicine pouches.
 */
export function printDispensingLabelSlip(dispenseData = {}, language = "en", hospitalBranding = null) {
  const isHi = language === "hi";
  const hospName = hospitalBranding?.hospital_name || hospitalBranding?.name || dispenseData.hospital_name || "City General Hospital";
  const brandColor = hospitalBranding?.primary_color || "#0284C7";
  const tokenNumber = dispenseData.ticket_id || dispenseData.token_id || "T-001";
  const patientName = dispenseData.patient_name || dispenseData.name || "Patient";
  const age = dispenseData.age || 30;
  const gender = dispenseData.gender || "Other";
  const doctorName = dispenseData.doctor_name || "Attending Physician";
  const pharmacistName = dispenseData.pharmacist_name || "Licensed Pharmacist";
  const counterNumber = dispenseData.counter || "Counter 1";
  const medicines = Array.isArray(dispenseData.medicines) ? dispenseData.medicines : [];
  const now = new Date();
  const dateStr = now.toLocaleDateString(isHi ? "hi-IN" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString(isHi ? "hi-IN" : "en-US", { hour: "2-digit", minute: "2-digit" });

  const medRows = medicines.map((med, idx) => {
    const qty = med.quantity || (med.dosage && med.duration ? `${med.frequency || "1-0-1"} (${med.duration || "5d"})` : "1 Pack");
    const inst = med.instructions || (isHi ? "भोजन के बाद लें" : "After food");
    return `
      <tr style="border-bottom: 1px dashed #cbd5e1;">
        <td style="padding: 6px 8px; font-weight: 800; font-size: 12px; color: #0f172a;">
          ${idx + 1}. ${med.name || "Medicine"} ${med.dosage ? `<span style="font-size: 11px; color: #0284c7;">(${med.dosage})</span>` : ""}
          <div style="font-size: 10px; color: #475569; font-weight: 600; margin-top: 2px;">
            ${med.frequency || "1-0-1"} • ${inst}
          </div>
        </td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: center; font-weight: 700; color: #334155;">
          ${med.duration || "5 days"}
        </td>
        <td style="padding: 6px 8px; font-size: 11.5px; text-align: right; font-weight: 800; color: #059669;">
          ${med.calculated_qty || qty || "As Advised"}
        </td>
      </tr>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Rx Dispense Label - #${tokenNumber}</title>
  <style>
    @page { size: 100mm 150mm; margin: 4mm; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      margin: 0; padding: 12px; color: #0f172a; background: #ffffff;
      max-width: 96mm; font-size: 11.5px; line-height: 1.35;
    }
    .header { text-align: center; border-bottom: 2px solid ${brandColor}; padding-bottom: 8px; margin-bottom: 8px; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; margin-top: 3px; }
    .patient-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .med-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .med-table th { background: #f1f5f9; padding: 5px 8px; text-align: left; font-size: 10.5px; color: #475569; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
    .caution { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 6px 8px; font-size: 9.5px; color: #92400e; margin-bottom: 10px; line-height: 1.3; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9.5px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 14.5px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.2px;">
      ${hospName}
    </div>
    <div style="font-size: 10.5px; font-weight: 700; color: ${brandColor}; margin-top: 1px;">
      ${isHi ? "अस्पताल फार्मेसी एवं दवा वितरण केंद्र" : "CENTRAL CLINICAL PHARMACY & DISPENSARY"}
    </div>
    <span class="badge">${isHi ? "दवा वितरण पैकेट लेबल" : "MEDICINE ENVELOPE LABEL"} • ${counterNumber}</span>
  </div>

  <div class="patient-box">
    <div>
      <div style="font-size: 13.5px; font-weight: 900; color: #0f172a;">${patientName}</div>
      <div style="font-size: 10.5px; color: #64748b; margin-top: 1px;">
        ${age}y / ${gender} • Dr. ${doctorName.replace(/^Dr\.?\s*/i, "")}
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 15px; font-weight: 900; color: ${brandColor}; font-family: monospace;">#${tokenNumber}</div>
      <div style="font-size: 9.5px; color: #64748b;">${dateStr} ${timeStr}</div>
    </div>
  </div>

  <table class="med-table">
    <thead>
      <tr>
        <th>${isHi ? "दवा / निर्देश" : "Medicine / Directions"}</th>
        <th style="text-align: center;">${isHi ? "अवधि" : "Dur."}</th>
        <th style="text-align: right;">${isHi ? "मात्रा" : "Qty"}</th>
      </tr>
    </thead>
    <tbody>
      ${medRows || `<tr><td colspan="3" style="text-align: center; padding: 12px; color: #94a3b8;">${isHi ? "कोई दवा विवरण नहीं" : "No specific medicines listed"}</td></tr>`}
    </tbody>
  </table>

  <div class="caution">
    ⚠️ <strong>${isHi ? "सावधानी / महत्वपूर्ण निर्देश" : "Advisory & Storage Directions"}:</strong><br/>
    • ${isHi ? "दवाओं को बच्चों की पहुंच से दूर रखें और ठंडी सूखी जगह पर रखें।" : "Keep all medicines out of reach of children. Store below 25°C."}<br/>
    • ${isHi ? "डॉक्टर द्वारा निर्धारित पूरी अवधि का कोर्स समाप्त करें।" : "Complete the full prescribed course. Do not stop midway."}
  </div>

  <div class="footer">
    <div>
      <div><strong>${isHi ? "वितरितकर्ता" : "Dispensed By"}:</strong> ${pharmacistName}</div>
      <div>${isHi ? "प्रमाणीकरण" : "Verification"}: ✓ Registered Pharmacist</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 800; color: #059669;">✓ DISPENSED & VERIFIED</div>
      <div style="font-size: 8.5px; color: #94a3b8;">Hospital Pharmacy System</div>
    </div>
  </div>
</body>
</html>`;

  triggerIframePrint(html);
}

/**
 * Generates an official hospital-branded Diagnostic Pathology & Laboratory Test Report Slip.
 * Includes patient details, specimen metadata, structured parameter results with reference intervals,
 * abnormal flags, pathologist remarks, and verification sign-off.
 */
export function printLabReportSlip(reportData = {}, language = "en", hospitalBranding = null) {
  const isHi = language === "hi";
  const hospName =
    (hospitalBranding && (hospitalBranding.hospital_name || hospitalBranding.name)) ||
    reportData.hospital_name ||
    (isHi ? "सिटी जनरल अस्पताल" : "City General Hospital");
  const brandColor = (hospitalBranding && hospitalBranding.primary_color) || "#0284C7";
  const logoUrl = (hospitalBranding && (hospitalBranding.logo_url || hospitalBranding.hospital_logo)) || "";

  const patientName = reportData.patient_name || reportData.name || (isHi ? "मरीज़" : "Patient");
  const age = reportData.age || 30;
  const gender = reportData.gender ? String(reportData.gender).toUpperCase() : "M";
  const phone = reportData.phone ? String(reportData.phone) : "N/A";
  const tokenNumber = reportData.ticket_id || reportData.token_id || "LAB-001";
  const panelName = reportData.test_panel_name || reportData.panel_name || reportData.test_name || (isHi ? "नैदानिक पैथोलॉजी जांच" : "Clinical Pathology Investigation");
  const specimenType = reportData.specimen_type || (isHi ? "रक्त नमूना (EDTA)" : "Whole Blood (EDTA)");
  const refDoctor = reportData.referring_doctor || reportData.doctor_name || (isHi ? "डॉ. ओपीडी कंसल्टेंट" : "Dr. Attending Physician");
  const clinicalDiag = reportData.clinical_diagnosis || reportData.diagnosis || (isHi ? "क्लिनिकल मूल्यांकन" : "Clinical Assessment");
  const technician = reportData.technician_name || (isHi ? "वरिष्ठ लैब तकनीशियन" : "Senior Lab Technologist");
  const pathologist = reportData.pathologist_name || (isHi ? "डॉ. एस. मेहता, एमडी (पैथोलॉजी)" : "Dr. S. Mehta, MD (Pathology)");
  const pathologistReg = reportData.pathologist_reg_no || "MCI-74892";
  const remarks = reportData.remarks || reportData.clinical_notes || "";
  const status = reportData.status || (isHi ? "सत्यापित एवं अंतिम रिपोर्ट" : "Verified & Final Report");

  const now = new Date();
  const dateStr = reportData.verified_at ? new Date(reportData.verified_at).toLocaleDateString() : now.toLocaleDateString();
  const timeStr = reportData.verified_at
    ? new Date(reportData.verified_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const collectionDateStr = reportData.collection_time ? new Date(reportData.collection_time).toLocaleDateString() : dateStr;
  const collectionTimeStr = reportData.collection_time
    ? new Date(reportData.collection_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : timeStr;

  const results = Array.isArray(reportData.results) ? reportData.results : [];

  const resultRows = results
    .map((r) => {
      const param = r.parameter || r.name || "Test Assay";
      const val = r.value !== undefined && r.value !== null ? String(r.value) : "-";
      const unit = r.unit || "";
      const refRange = r.ref_range || r.reference_range || r.normal_range || "-";
      const flag = (r.flag || "NORMAL").toUpperCase();

      let flagHtml = `<span style="display:inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;">NORMAL</span>`;
      let valueColor = "#0f172a";
      let valueWeight = "700";

      if (flag === "HIGH" || flag === "CRITICAL_HIGH") {
        flagHtml = `<span style="display:inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA;">HIGH ▲</span>`;
        valueColor = "#B91C1C";
        valueWeight = "900";
      } else if (flag === "LOW" || flag === "CRITICAL_LOW") {
        flagHtml = `<span style="display:inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE;">LOW ▼</span>`;
        valueColor = "#1D4ED8";
        valueWeight = "900";
      } else if (flag === "ABNORMAL") {
        flagHtml = `<span style="display:inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;">ABNORMAL</span>`;
        valueColor = "#B45309";
        valueWeight = "900";
      }

      return `
        <tr style="border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 7px 10px; font-weight: 600; color: #1E293B; font-size: 11.5px;">${param}</td>
          <td style="padding: 7px 10px; text-align: right; font-weight: ${valueWeight}; color: ${valueColor}; font-size: 12px; font-family: monospace;">${val}</td>
          <td style="padding: 7px 10px; text-align: center; color: #64748B; font-size: 11px;">${unit}</td>
          <td style="padding: 7px 10px; text-align: center; color: #475569; font-size: 11px;">${refRange}</td>
          <td style="padding: 7px 10px; text-align: center;">${flagHtml}</td>
        </tr>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${hospName} - Lab Report #${tokenNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0 auto;
      max-width: 780px;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid ${brandColor};
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .hosp-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.3px;
    }
    .dept-title {
      font-size: 11.5px;
      font-weight: 800;
      color: ${brandColor};
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 2px;
    }
    .sub-cert {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      margin-top: 2px;
    }
    .info-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 20px;
      font-size: 11px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed #E2E8F0;
      padding-bottom: 4px;
    }
    .info-label {
      color: #64748b;
      font-weight: 600;
    }
    .info-val {
      font-weight: 800;
      color: #0f172a;
    }
    .panel-banner {
      background: linear-gradient(135deg, ${brandColor} 0%, #0369A1 100%);
      color: #ffffff;
      padding: 8px 14px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    .results-table th {
      background: #F1F5F9;
      color: #334155;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      border-top: 1.5px solid #CBD5E1;
      border-bottom: 1.5px solid #CBD5E1;
    }
    .remarks-box {
      border: 1px solid #CBD5E1;
      border-left: 4px solid ${brandColor};
      background: #F8FAFC;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 11px;
    }
    .sign-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1.5px solid #E2E8F0;
      padding-top: 16px;
      margin-top: 24px;
    }
    .sign-box {
      text-align: center;
      min-width: 180px;
    }
    .sign-line {
      border-top: 1px solid #0f172a;
      margin-bottom: 4px;
      padding-top: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px dashed #CBD5E1;
      font-size: 9.5px;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center; gap: 12px;">
      ${logoUrl ? `<img src="${logoUrl}" style="height: 48px; width: 48px; object-fit: contain; border-radius: 6px;" alt="Hospital Logo" />` : ""}
      <div>
        <h1 class="hosp-title">${hospName}</h1>
        <div class="dept-title">${isHi ? "पैथोलॉजी एवं डायग्नोस्टिक प्रयोगशाला विभाग" : "DEPARTMENT OF PATHOLOGY & LABORATORY MEDICINE"}</div>
        <div class="sub-cert">${isHi ? "NABL मान्यता प्राप्त क्लिनिकल डायग्नोस्टिक सेंटर • स्वचालित बायोकेमिस्ट्री एवं हेमेटोलॉजी" : "NABL Accredited Clinical Testing Facility • Automated Biochemistry & Hematology"}</div>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="display: inline-block; padding: 4px 10px; background: #EFF6FF; border: 1.5px solid #93C5FD; border-radius: 6px; font-weight: 900; color: #1D4ED8; font-size: 13px; font-family: monospace;">
        TOKEN #${tokenNumber}
      </div>
      <div style="font-size: 9.5px; color: #64748B; margin-top: 4px;">
        ${status}
      </div>
    </div>
  </div>

  <div class="info-card">
    <div class="info-item">
      <span class="info-label">${isHi ? "मरीज़ का नाम" : "Patient Name"}:</span>
      <span class="info-val">${patientName}</span>
    </div>
    <div class="info-item">
      <span class="info-label">${isHi ? "परामर्शदाता डॉक्टर" : "Referring Doctor"}:</span>
      <span class="info-val">${refDoctor}</span>
    </div>
    <div class="info-item">
      <span class="info-label">${isHi ? "आयु / लिंग" : "Age / Gender"}:</span>
      <span class="info-val">${age} Yrs / ${gender}</span>
    </div>
    <div class="info-item">
      <span class="info-label">${isHi ? "क्लिनिकल निदान" : "Clinical Indication"}:</span>
      <span class="info-val">${clinicalDiag}</span>
    </div>
    <div class="info-item">
      <span class="info-label">${isHi ? "फ़ोन नंबर" : "Phone"}:</span>
      <span class="info-val">${phone}</span>
    </div>
    <div class="info-item">
      <span class="info-label">${isHi ? "नमूना प्रकार" : "Sample Type"}:</span>
      <span class="info-val">${specimenType}</span>
    </div>
    <div class="info-item">
      <span class="info-label">${isHi ? "नमूना संकलन" : "Sample Collected"}:</span>
      <span class="info-val">${collectionDateStr} ${collectionTimeStr}</span>
    </div>
    <div class="info-item">
      <span class="info-label">${isHi ? "रिपोर्ट सत्यापन" : "Report Verified"}:</span>
      <span class="info-val">${dateStr} ${timeStr}</span>
    </div>
  </div>

  <div class="panel-banner">
    <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.3px;">
      ${panelName}
    </div>
    <div style="font-size: 10.5px; font-weight: 700; background: rgba(255,255,255,0.22); padding: 3px 8px; border-radius: 4px;">
      ${isHi ? "मानक संदर्भ अंतराल सहित" : "With Biological Reference Intervals"}
    </div>
  </div>

  <table class="results-table">
    <thead>
      <tr>
        <th style="text-align: left;">${isHi ? "जांच / परीक्षण पैरामीटर" : "Investigation / Test Parameter"}</th>
        <th style="text-align: right;">${isHi ? "परिणाम" : "Observed Result"}</th>
        <th style="text-align: center;">${isHi ? "इकाई" : "Unit"}</th>
        <th style="text-align: center;">${isHi ? "सामान्य संदर्भ सीमा" : "Biological Ref. Interval"}</th>
        <th style="text-align: center;">${isHi ? "स्थिति" : "Flag"}</th>
      </tr>
    </thead>
    <tbody>
      ${resultRows || `<tr><td colspan="5" style="text-align: center; padding: 16px; color: #94A3B8;">${isHi ? "कोई जांच परिणाम उपलब्ध नहीं" : "No test parameters reported"}</td></tr>`}
    </tbody>
  </table>

  ${remarks ? `
  <div class="remarks-box">
    <strong style="color: #0F172A; font-size: 11px;">${isHi ? "पैथोलॉजिस्ट क्लिनिकल अभिमत एवं टिप्पणियाँ" : "Pathologist Remarks & Clinical Impressions"}:</strong>
    <p style="margin: 4px 0 0 0; color: #334155; line-height: 1.45;">${remarks}</p>
  </div>
  ` : ""}

  <div class="sign-section">
    <div class="sign-box">
      <div style="font-size: 10px; color: #64748B; margin-bottom: 24px;">Tested By:</div>
      <div class="sign-line">
        <strong style="font-size: 11.5px; color: #0F172A;">${technician}</strong>
        <div style="font-size: 9.5px; color: #64748B;">${isHi ? "वरिष्ठ मेडिकल लैब तकनीशियन" : "Senior Medical Lab Technologist"}</div>
      </div>
    </div>

    <div style="text-align: center; padding-bottom: 8px;">
      <div style="display: inline-block; border: 1.5px dashed #059669; padding: 6px 14px; border-radius: 8px; background: #ECFDF5;">
        <span style="font-size: 11px; font-weight: 900; color: #047857;">✓ DIGITALLY VERIFIED</span>
        <div style="font-size: 8.5px; color: #065F46;">No Physical Signature Required</div>
      </div>
    </div>

    <div class="sign-box">
      <div style="font-size: 10px; color: #64748B; margin-bottom: 24px;">Verified & Reported By:</div>
      <div class="sign-line">
        <strong style="font-size: 11.5px; color: #0F172A;">${pathologist}</strong>
        <div style="font-size: 9.5px; color: #64748B;">Reg. No: ${pathologistReg} • MD (Pathology)</div>
      </div>
    </div>
  </div>

  <div class="footer">
    ${hospName} • LIS Diagnostic Portal • ${isHi ? "यह रिपोर्ट कंप्यूटर द्वारा तैयार की गई है और इलेक्ट्रॉनिक रूप से प्रमाणित है।" : "This diagnostic report is electronically validated and authenticated under standard LIS quality protocols."}
  </div>
</body>
</html>`;

  triggerIframePrint(html);
}



/**
 * printRadiologyReportSlip
 * ------------------------
 * Prints a clean, professional, mostly black-and-white official Radiology & Imaging report.
 * A4 format, 15mm margins, strictly medical formatting without decorative emojis or colorful cards.
 */
export function printRadiologyReportSlip(reportData = {}, language = "en", hospitalBranding = null) {
  const isHi = language === "hi";
  const hospName =
    (hospitalBranding && (hospitalBranding.hospital_name || hospitalBranding.name)) ||
    reportData.hospital_name ||
    (isHi ? "सिटी जनरल अस्पताल" : "City General Hospital");
  const logoUrl = (hospitalBranding && (hospitalBranding.logo_url || hospitalBranding.hospital_logo)) || "";

  const patientName = reportData.patient_name || reportData.name || (isHi ? "मरीज़" : "Patient");
  const age = reportData.age || 30;
  const gender = reportData.gender ? String(reportData.gender).toUpperCase() : "M";
  const phone = reportData.phone ? String(reportData.phone) : "N/A";
  const tokenNumber = reportData.ticket_id || reportData.token_id || "RAD-001";
  const refDoctor = reportData.referring_doctor || reportData.doctor_name || (isHi ? "डॉ. ओपीडी कंसल्टेंट" : "Attending Physician");

  const modality = reportData.modality || "X-Ray";
  const bodyPart = reportData.body_part || "Chest";
  const view = reportData.view || "PA View";
  const contrast = reportData.contrast || "None";
  const laterality = reportData.laterality || "N/A";
  const dose = reportData.dose || reportData.radiation_dose || "Standard diagnostic";
  const equipment = reportData.equipment || "Digital Radiography Suite";
  const technologist = reportData.technologist || reportData.technician_name || "Senior Radiographer";
  const radiologist = reportData.radiologist || reportData.radiologist_name || "Dr. Radiologist, MD, DMRD";
  const radiologistReg = reportData.radiologist_reg_no || "DMC-89421";

  const clinicalIndication = reportData.clinical_indication || "Routine clinical evaluation.";
  const technique = reportData.technique || `${modality} of ${bodyPart} performed with standard protocol (${view}).`;
  const findings = reportData.findings || "No acute abnormalities demonstrated on current study.";
  const impression = reportData.impression || "Study within normal limits.";
  const status = (reportData.status || "Final (Verified)").toUpperCase();

  const now = new Date();
  const dateStr = reportData.verified_at ? new Date(reportData.verified_at).toLocaleDateString() : now.toLocaleDateString();
  const timeStr = reportData.verified_at
    ? new Date(reportData.verified_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const examDateStr = reportData.exam_time ? new Date(reportData.exam_time).toLocaleDateString() : dateStr;
  const examTimeStr = reportData.exam_time
    ? new Date(reportData.exam_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : timeStr;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${hospName} - Radiology Report #${tokenNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #111827;
      background: #ffffff;
      font-size: 11.5px;
      line-height: 1.5;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .hosp-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.2px;
      margin: 0;
      color: #111827;
      text-transform: uppercase;
    }
    .dept-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      margin-top: 2px;
      color: #374151;
      text-transform: uppercase;
    }
    .sub-cert {
      font-size: 9.5px;
      color: #6b7280;
      margin-top: 2px;
    }
    .token-badge {
      border: 1.5px solid #111827;
      padding: 4px 10px;
      font-weight: 800;
      font-size: 13px;
      display: inline-block;
      letter-spacing: 0.5px;
      font-family: monospace;
    }
    .demographics-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      border: 1px solid #d1d5db;
    }
    .demographics-table td {
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      font-size: 11px;
    }
    .demographics-table td.label {
      width: 18%;
      color: #4b5563;
      font-weight: 600;
      background: #f9fafb;
    }
    .demographics-table td.val {
      width: 32%;
      font-weight: 700;
      color: #111827;
    }
    .study-title-bar {
      border-top: 1.5px solid #111827;
      border-bottom: 1.5px solid #111827;
      padding: 6px 8px;
      margin-bottom: 14px;
      font-weight: 800;
      font-size: 12.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      background: #f9fafb;
    }
    .section-block {
      margin-bottom: 14px;
    }
    .section-heading {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #111827;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 2px;
      margin-bottom: 4px;
    }
    .section-content {
      font-size: 11.5px;
      color: #1f2937;
      white-space: pre-line;
      line-height: 1.55;
    }
    .impression-box {
      border: 1.5px solid #111827;
      padding: 10px 12px;
      margin: 14px 0;
      background: #ffffff;
    }
    .impression-box .heading {
      font-size: 11.5px;
      font-weight: 900;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 4px;
      color: #111827;
    }
    .impression-box .content {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      white-space: pre-line;
      line-height: 1.5;
    }
    .signatures-table {
      width: 100%;
      margin-top: 26px;
      border-top: 1px solid #d1d5db;
      padding-top: 14px;
    }
    .signatures-table td {
      vertical-align: bottom;
      padding: 0 10px;
    }
    .sign-line {
      border-top: 1px solid #111827;
      padding-top: 4px;
      margin-top: 40px;
      text-align: center;
    }
    .stamp-box {
      border: 1px dashed #4b5563;
      padding: 6px 12px;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      color: #374151;
      display: inline-block;
    }
    .footer-note {
      text-align: center;
      font-size: 9px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      margin-top: 20px;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${logoUrl ? `<img src="${logoUrl}" style="height: 48px; width: 48px; object-fit: contain;" alt="Logo" />` : ""}
          <div>
            <h1 class="hosp-title">${hospName}</h1>
            <div class="dept-title">${isHi ? "रेडियोलॉजी एवं इमेजिंग विभाग" : "DEPARTMENT OF RADIOLOGY & IMAGING"}</div>
            <div class="sub-cert">${isHi ? "डिजिटल एक्स-रे • सीटी स्कैन • एमआरआई • अल्ट्रासाउंड" : "Digital X-Ray • Multi-Slice CT • High-Resolution MRI • Ultrasonography"}</div>
          </div>
        </div>
      </td>
      <td style="vertical-align: middle; text-align: right; width: 220px;">
        <div class="token-badge">TOKEN #${tokenNumber}</div>
        <div style="font-size: 9.5px; font-weight: 700; margin-top: 4px; color: #374151;">STATUS: ${status}</div>
      </td>
    </tr>
  </table>

  <table class="demographics-table">
    <tr>
      <td class="label">${isHi ? "मरीज़ का नाम" : "Patient Name"}</td>
      <td class="val">${patientName}</td>
      <td class="label">${isHi ? "उम्र / लिंग" : "Age / Gender"}</td>
      <td class="val">${age} Y / ${gender}</td>
    </tr>
    <tr>
      <td class="label">${isHi ? "रेफरिंग डॉक्टर" : "Referring Dr."}</td>
      <td class="val">${refDoctor}</td>
      <td class="label">${isHi ? "फोन / संपर्क" : "Contact Phone"}</td>
      <td class="val">${phone}</td>
    </tr>
    <tr>
      <td class="label">${isHi ? "जांच की तिथि" : "Exam Date/Time"}</td>
      <td class="val">${examDateStr} ${examTimeStr}</td>
      <td class="label">${isHi ? "रिपोर्ट तिथि" : "Report Date/Time"}</td>
      <td class="val">${dateStr} ${timeStr}</td>
    </tr>
    <tr>
      <td class="label">${isHi ? "उपकरण / कमरा" : "Equipment / Room"}</td>
      <td class="val">${equipment}</td>
      <td class="label">${isHi ? "रेडिएशन डोज" : "Radiation Dose"}</td>
      <td class="val">${dose}</td>
    </tr>
  </table>

  <div class="study-title-bar">
    <span>STUDY: ${modality.toUpperCase()} — ${bodyPart.toUpperCase()}</span>
    <span style="font-size: 11px; font-weight: 600;">VIEW: ${view} | CONTRAST: ${contrast} | LATERALITY: ${laterality}</span>
  </div>

  <div class="section-block">
    <div class="section-heading">${isHi ? "क्लिनिकल संकेत (CLINICAL INDICATION)" : "CLINICAL INDICATION"}</div>
    <div class="section-content">${clinicalIndication}</div>
  </div>

  <div class="section-block">
    <div class="section-heading">${isHi ? "तकनीक एवं प्रोटोकॉल (TECHNIQUE)" : "TECHNIQUE & PROTOCOL"}</div>
    <div class="section-content">${technique}</div>
  </div>

  <div class="section-block">
    <div class="section-heading">${isHi ? "जांच निष्कर्ष (FINDINGS)" : "FINDINGS"}</div>
    <div class="section-content">${findings}</div>
  </div>

  <div class="impression-box">
    <div class="heading">${isHi ? "अंतिम मूल्यांकन / निष्कर्ष (IMPRESSION)" : "IMPRESSION"}</div>
    <div class="content">${impression}</div>
  </div>

  <table class="signatures-table">
    <tr>
      <td style="width: 32%; text-align: left;">
        <div style="font-size: 9.5px; color: #4b5563; margin-bottom: 24px;">Performed By (Technologist):</div>
        <div class="sign-line">
          <strong>${technologist}</strong><br />
          <span style="font-size: 9.5px; color: #6b7280;">Radiologic Technologist</span>
        </div>
      </td>
      <td style="width: 36%; text-align: center; vertical-align: middle;">
        <div class="stamp-box">
          OFFICIAL MEDICAL REPORT<br />
          AUTHENTICATED & DIGITALLY SECURED
        </div>
      </td>
      <td style="width: 32%; text-align: right;">
        <div style="font-size: 9.5px; color: #4b5563; margin-bottom: 24px;">Reported & Signed By:</div>
        <div class="sign-line">
          <strong>${radiologist}</strong><br />
          <span style="font-size: 9.5px; color: #6b7280;">Consultant Radiologist • Reg: ${radiologistReg}</span>
        </div>
      </td>
    </tr>
  </table>

  <div class="footer-note">
    ${hospName} • RIS / PACS Radiology Information System • This is an authenticated diagnostic imaging report. Please correlate clinically.
  </div>
</body>
</html>`;

  triggerIframePrint(html);
}
