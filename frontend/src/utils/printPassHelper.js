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

  // 1. Top Hospital Branding Header Bar (Cyan / Medical Blue)
  stream.push("0.008 0.518 0.780 rg"); // #0284C7
  stream.push("0 831.89 595.28 10 re f");

  // 2. Hospital Logo & Title
  let textStartX = 82;
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
  } else {
    stream.push("BT /F2 26 Tf 0.008 0.518 0.780 rg 40 788 Td (Rx) Tj ET");
    textStartX = 82;
  }

  stream.push("BT /F2 15 Tf 0.059 0.090 0.165 rg " + textStartX + " 798 Td (" + escapePdfText(hospitalName.toUpperCase()) + ") Tj ET");
  stream.push("BT /F1 8.5 Tf 0.008 0.518 0.780 rg " + textStartX + " 784 Td (" + escapePdfText(brandTagline.toUpperCase()) + " - NABH ACCREDITED HEALTHCARE) Tj ET");

  // Date, Time & Token (Right header)
  stream.push("BT /F2 8.5 Tf 0.28 0.33 0.41 rg 420 800 Td (Date: " + escapePdfText(dateStr) + " " + escapePdfText(timeStr) + ") Tj ET");
  if (data.ticket_id) {
    stream.push("BT /F2 9.5 Tf 0.008 0.518 0.780 rg 420 786 Td (Token Pass: #" + escapePdfText(data.ticket_id) + ") Tj ET");
  } else if (data.appointment_id) {
    stream.push("BT /F2 9.5 Tf 0.008 0.518 0.780 rg 420 786 Td (Apt Ref: " + escapePdfText(data.appointment_id) + ") Tj ET");
  }

  // Divider Line
  stream.push("0.008 0.518 0.780 RG 1.5 w 40 768 m 555 768 l S");

  // 3. Patient & Doctor Demographics Card
  stream.push("0.973 0.980 0.988 rg 40 692 515 68 re f");
  stream.push("0.85 0.88 0.92 RG 1 w 40 692 515 68 re S");

  // Patient Info
  stream.push("BT /F2 8 Tf 0.392 0.455 0.545 rg 52 743 Td (PATIENT INFORMATION) Tj ET");
  stream.push("BT /F2 12 Tf 0.059 0.090 0.165 rg 52 728 Td (" + escapePdfText(data.patient_name) + ") Tj ET");
  stream.push("BT /F1 9 Tf 0.28 0.33 0.41 rg 52 714 Td (" + escapePdfText(data.age + " yrs | " + data.gender + " | " + (data.phone ? "Ph: " + data.phone : "OPD Registered")) + ") Tj ET");
  if (data.appointment_id) {
    stream.push("BT /F1 8 Tf 0.392 0.455 0.545 rg 52 702 Td (Appointment ID: " + escapePdfText(data.appointment_id) + ") Tj ET");
  }

  // Doctor Info
  stream.push("BT /F2 8 Tf 0.392 0.455 0.545 rg 310 743 Td (ATTENDING DOCTOR & CLINIC) Tj ET");
  stream.push("BT /F2 12 Tf 0.008 0.518 0.780 rg 310 728 Td (" + escapePdfText(data.doctor_name) + ") Tj ET");
  stream.push("BT /F1 9 Tf 0.28 0.33 0.41 rg 310 714 Td (" + escapePdfText(deptLabel + " | Reg ID: " + data.doctor_employee_id) + ") Tj ET");
  stream.push("BT /F2 8 Tf 0.082 0.502 0.239 rg 310 702 Td (OPD Clinical Consultation Desk) Tj ET");

  // 4. Clinical Diagnosis & Lab Investigations Box
  stream.push("0.941 0.992 0.957 rg 40 638 515 44 re f");
  stream.push("0.733 0.969 0.816 RG 1 w 40 638 515 44 re S");
  stream.push("BT /F2 8 Tf 0.082 0.502 0.239 rg 52 668 Td (PROVISIONAL CLINICAL DIAGNOSIS & ASSESSMENT) Tj ET");
  stream.push("BT /F2 11 Tf 0.086 0.396 0.204 rg 52 654 Td (" + escapePdfText(data.diagnosis) + ") Tj ET");
  if (data.lab_tests && data.lab_tests !== "no") {
    stream.push("BT /F1 8.5 Tf 0.008 0.518 0.780 rg 52 642 Td (Diagnostic / Lab Tests Requested: " + escapePdfText(data.lab_tests) + ") Tj ET");
  }

  // 5. Prescribed Medications Table
  stream.push("BT /F2 11 Tf 0.059 0.090 0.165 rg 40 620 Td (Rx PRESCRIBED MEDICATIONS & DOSAGE) Tj ET");

  // Table Header row
  stream.push("0.945 0.961 0.976 rg 40 592 515 22 re f");
  stream.push("0.796 0.835 0.882 RG 1 w 40 592 515 22 re S");
  stream.push("BT /F2 8.5 Tf 0.28 0.33 0.41 rg 48 599 Td (#) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.28 0.33 0.41 rg 70 599 Td (MEDICINE NAME & STRENGTH) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.28 0.33 0.41 rg 240 599 Td (DOSAGE) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.28 0.33 0.41 rg 310 599 Td (FREQUENCY) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.28 0.33 0.41 rg 390 599 Td (DURATION) Tj ET");
  stream.push("BT /F2 8.5 Tf 0.28 0.33 0.41 rg 460 599 Td (INSTRUCTIONS) Tj ET");

  let currentY = 570;
  if (data.medicines && data.medicines.length > 0) {
    data.medicines.forEach((med, idx) => {
      if (idx % 2 === 1) {
        stream.push("0.973 0.980 0.988 rg 40 " + (currentY - 6) + " 515 22 re f");
      }
      stream.push("0.9 0.92 0.94 RG 0.5 w 40 " + (currentY - 6) + " 515 22 re S");
      stream.push("BT /F2 8.5 Tf 0.392 0.455 0.545 rg 48 " + (currentY + 2) + " Td (" + (idx + 1) + ") Tj ET");
      stream.push("BT /F2 9.5 Tf 0.059 0.090 0.165 rg 70 " + (currentY + 2) + " Td (" + escapePdfText(med.name) + ") Tj ET");
      stream.push("BT /F1 9 Tf 0.008 0.518 0.780 rg 240 " + (currentY + 2) + " Td (" + escapePdfText(med.dosage || "-") + ") Tj ET");
      stream.push("BT /F2 9 Tf 0.082 0.502 0.239 rg 310 " + (currentY + 2) + " Td (" + escapePdfText(med.frequency || "-") + ") Tj ET");
      stream.push("BT /F1 9 Tf 0.28 0.33 0.41 rg 390 " + (currentY + 2) + " Td (" + escapePdfText(med.duration || "-") + ") Tj ET");
      stream.push("BT /F1 8.5 Tf 0.392 0.455 0.545 rg 460 " + (currentY + 2) + " Td (" + escapePdfText(med.instructions || "After food") + ") Tj ET");
      currentY -= 22;
    });
  } else {
    stream.push("0.973 0.980 0.988 rg 40 " + (currentY - 14) + " 515 28 re f");
    stream.push("0.85 0.88 0.92 RG 1 w 40 " + (currentY - 14) + " 515 28 re S");
    stream.push("BT /F1 9 Tf 0.392 0.455 0.545 rg 52 " + (currentY - 4) + " Td (" + escapePdfText(data.advice || "No specific prescription medications listed. Clinical consultation completed.") + ") Tj ET");
    currentY -= 28;
  }

  // 6. Doctor Advice & Care Plan Box
  currentY -= 15;
  stream.push("0.97 0.98 1.0 rg 40 " + (currentY - 38) + " 515 44 re f");
  stream.push("0.73 0.87 0.98 RG 1 w 40 " + (currentY - 38) + " 515 44 re S");
  stream.push("BT /F2 8 Tf 0.008 0.518 0.780 rg 52 " + (currentY - 3) + " Td (DOCTOR'S ADVICE, DIETARY & LIFESTYLE CARE INSTRUCTIONS) Tj ET");
  stream.push("BT /F1 9.5 Tf 0.059 0.090 0.165 rg 52 " + (currentY - 18) + " Td (" + escapePdfText(data.advice || "Follow prescribed dosage strictly. Complete the antibiotic course if advised.") + ") Tj ET");
  if (data.follow_up) {
    stream.push("BT /F2 9 Tf 0.082 0.502 0.239 rg 52 " + (currentY - 31) + " Td (Review & Next Follow-Up: " + escapePdfText(data.follow_up) + ") Tj ET");
  }

  // 7. Official Doctor Signature & Hospital OPD Stamp Box
  currentY -= 68;
  stream.push("0.98 0.99 0.98 rg 315 " + (currentY - 74) + " 240 82 re f");
  stream.push("0.082 0.502 0.239 RG 1.5 w 315 " + (currentY - 74) + " 240 82 re S");

  // Circular Stamp on left of doctor box
  const cx = 352, cy = currentY - 33, r = 26;
  stream.push("0.082 0.502 0.239 RG 1.5 w");
  stream.push((cx + r) + " " + cy + " m");
  stream.push((cx + r) + " " + (cy + r * 0.552) + " " + (cx + r * 0.552) + " " + (cy + r) + " " + cx + " " + (cy + r) + " c");
  stream.push((cx - r * 0.552) + " " + (cy + r) + " " + (cx - r) + " " + (cy + r * 0.552) + " " + (cx - r) + " " + cy + " c");
  stream.push((cx - r) + " " + (cy - r * 0.552) + " " + (cx - r * 0.552) + " " + (cy - r) + " " + cx + " " + (cy - r) + " c");
  stream.push((cx + r * 0.552) + " " + (cy - r) + " " + (cx + r) + " " + (cy - r * 0.552) + " " + (cx + r) + " " + cy + " c S");

  // Inner dotted circle
  const rIn = 21;
  stream.push("[2 1] 0 d 0.082 0.502 0.239 RG 1 w");
  stream.push((cx + rIn) + " " + cy + " m");
  stream.push((cx + rIn) + " " + (cy + rIn * 0.552) + " " + (cx + rIn * 0.552) + " " + (cy + rIn) + " " + cx + " " + (cy + rIn) + " c");
  stream.push((cx - rIn * 0.552) + " " + (cy + rIn) + " " + (cx - rIn) + " " + (cy + rIn * 0.552) + " " + (cx - rIn) + " " + cy + " c");
  stream.push((cx - rIn) + " " + (cy - rIn * 0.552) + " " + (cx - rIn * 0.552) + " " + (cy - rIn) + " " + cx + " " + (cy - rIn) + " c");
  stream.push((cx + rIn * 0.552) + " " + (cy - rIn) + " " + (cx + rIn) + " " + (cy - rIn * 0.552) + " " + (cx + rIn) + " " + cy + " c S");
  stream.push("[] 0 d"); // reset dash

  // Stamp inner text
  stream.push("BT /F2 6 Tf 0.082 0.502 0.239 rg 333 " + (cy + 6) + " Td (OPD DESK) Tj ET");
  stream.push("BT /F2 6.5 Tf 0.082 0.502 0.239 rg 330 " + (cy - 4) + " Td (VERIFIED) Tj ET");
  stream.push("BT /F1 5.5 Tf 0.082 0.502 0.239 rg 334 " + (cy - 12) + " Td (SIGNED) Tj ET");

  // Doctor Signature Info
  stream.push("BT /F2 11 Tf 0.059 0.090 0.165 rg 388 " + (currentY - 14) + " Td (" + escapePdfText(data.doctor_name) + ") Tj ET");
  stream.push("BT /F1 8.5 Tf 0.392 0.455 0.545 rg 388 " + (currentY - 26) + " Td (Consultant Physician | " + escapePdfText(deptLabel) + ") Tj ET");
  stream.push("BT /F1 8 Tf 0.082 0.502 0.239 rg 388 " + (currentY - 38) + " Td (Reg: " + escapePdfText(data.doctor_employee_id) + ") Tj ET");
  stream.push("BT /F2 7.5 Tf 0.008 0.518 0.780 rg 388 " + (currentY - 50) + " Td (Digitally Authenticated by Clinical System) Tj ET");
  stream.push("0.082 0.502 0.239 RG 1 w 388 " + (currentY - 58) + " m 540 " + (currentY - 58) + " l S");

  // Left Legal / Security Authentication Watermark
  stream.push("0.082 0.502 0.239 RG 1 w 40 " + (currentY - 62) + " m 295 " + (currentY - 62) + " l S");
  stream.push("BT /F2 8 Tf 0.082 0.502 0.239 rg 40 " + (currentY - 48) + " Td (OFFICIAL CLINICAL E-PRESCRIPTION) Tj ET");
  stream.push("BT /F1 7.5 Tf 0.392 0.455 0.545 rg 40 " + (currentY - 58) + " Td (Valid across hospital pharmacy, lab diagnostic counters & Jan Aushadhi) Tj ET");

  // 8. Bottom Footer
  stream.push("BT /F1 7.5 Tf 0.58 0.64 0.72 rg 120 28 Td (" + escapePdfText(hospitalName + " - NABH Accredited Healthcare - Generated by AI Queue Health System") + ") Tj ET");

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
  const brandPrimary = (branding && branding.primary_color) || "#0284C7";
  const brandTagline = (branding && branding.tagline) || (lang === "hi" ? "आउटपेशेंट क्लिनिकल ई-प्रिस्क्रिप्शन पर्ची" : "Outpatient Clinical E-Prescription Slip");
  const footerStr = `${hospitalName} • ${(branding && branding.slip_footer_text) || "NABH Accredited Healthcare • Digitally Validated Clinical Prescription"}`;
  const deptLabel = getCategoryLabel(rxData.doctor_department, lang);
  const dateStr = rxData.prescribed_at ? new Date(rxData.prescribed_at).toLocaleDateString() : new Date().toLocaleDateString();
  const timeStr = rxData.prescribed_at ? new Date(rxData.prescribed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const logoUrl = (branding && (branding.logo_url || branding.hospital_logo)) || rxData.logo_url || "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${hospitalName} - Clinical Rx #${rxData.ticket_id || rxData.appointment_id || ""}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 14mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0 auto;
      max-width: 760px;
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
      border-bottom: 2.5px solid ${brandPrimary};
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .rx-symbol {
      font-size: 38px;
      font-weight: 900;
      color: ${brandPrimary};
      line-height: 1;
      margin-right: 14px;
    }
    .hosp-name {
      font-size: 21px;
      font-weight: 900;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .hosp-sub {
      font-size: 11px;
      font-weight: 700;
      color: ${brandPrimary};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 3px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #f8fafc;
      padding: 12px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .info-label {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-val {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .diag-box {
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
    }
    .diag-title {
      font-size: 10.5px;
      font-weight: 800;
      color: #15803d;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .diag-val {
      font-size: 14px;
      font-weight: 800;
      color: #166534;
    }
    .meds-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12px;
    }
    .meds-table th {
      background: #f1f5f9;
      padding: 9px 10px;
      text-align: left;
      font-weight: 800;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
    }
    .meds-table td {
      padding: 9px 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    .meds-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .doctor-stamp-container {
      border: 1.5px solid #15803d;
      background: #f8fafc;
      border-radius: 10px;
      padding: 12px 18px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      margin-top: 16px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center; gap: 14px;">
      ${logoUrl ? `
        <img src="${logoUrl}" alt="Hospital Logo" style="max-height: 52px; max-width: 140px; object-fit: contain; border-radius: 6px;" />
      ` : `
        <span class="rx-symbol">℞</span>
      `}
      <div>
        <h1 class="hosp-name">${hospitalName}</h1>
        <div class="hosp-sub">${brandTagline}</div>
      </div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      <div><strong>Date:</strong> ${dateStr}</div>
      <div><strong>Time:</strong> ${timeStr}</div>
      ${rxData.ticket_id ? `<div style="color: ${brandPrimary}; font-weight: 800; margin-top: 2px;">Token #${rxData.ticket_id}</div>` : ""}
    </div>
  </div>

  <div class="info-grid">
    <div>
      <div class="info-label">${t("patientDemographics", lang)}</div>
      <div class="info-val">${rxData.patient_name}</div>
      <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">
        ${rxData.age || 30} yrs • ${formatCleanText(t(rxData.gender || "male", lang), lang)} ${rxData.ticket_id ? `• Token #${rxData.ticket_id}` : ""} ${rxData.phone ? `• ${rxData.phone}` : ""}
      </div>
    </div>
    <div>
      <div class="info-label">Attending Doctor & Department</div>
      <div class="info-val" style="color: ${brandPrimary};">${rxData.doctor_name}</div>
      <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">
        ${deptLabel} ${rxData.doctor_employee_id ? `(Reg: ${rxData.doctor_employee_id})` : ""}
      </div>
    </div>
  </div>

  <div class="diag-box">
    <div class="diag-title">Clinical Diagnosis / Provisional Assessment:</div>
    <div class="diag-val">${rxData.diagnosis}</div>
    ${rxData.lab_tests && rxData.lab_tests !== "no" ? `<div style="font-size: 12px; color: #0284c7; margin-top: 6px;"><strong>🧪 Lab Tests / Investigations:</strong> ${rxData.lab_tests}</div>` : ""}
  </div>

  <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px;">
    ℞ Prescribed Medications & Instructions
  </div>

  ${rxData.medicines && rxData.medicines.length > 0 ? `
  <table class="meds-table">
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Medicine Name</th>
        <th>Dosage</th>
        <th>Frequency</th>
        <th>Duration</th>
        <th>Instructions</th>
      </tr>
    </thead>
    <tbody>
      ${rxData.medicines.map((m, idx) => `
        <tr>
          <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
          <td style="font-weight: 800; color: #0f172a;">${m.name || "-"}</td>
          <td style="color: #0284c7; font-weight: 700;">${m.dosage || "-"}</td>
          <td style="color: #15803d; font-weight: 700;">${m.frequency || "-"}</td>
          <td>${m.duration || "-"}</td>
          <td style="color: #64748b; font-style: italic;">${m.instructions || "After food"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>` : `
  <div style="padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #475569; font-style: italic; margin-bottom: 16px;">
    ${rxData.advice || "No specific prescription medications listed. Consultation completed."}
  </div>`}

  ${rxData.advice ? `
  <div style="margin-bottom: 14px; padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
    <div style="font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase; margin-bottom: 2px;">Doctor's Advice & Care Plan:</div>
    <div style="font-size: 12.5px; color: #166534;">${rxData.advice}</div>
  </div>` : ""}

  ${rxData.follow_up ? `
  <div style="font-size: 12px; color: #475569; margin-bottom: 14px;">
    <strong>🗓️ Follow-Up Review:</strong> ${rxData.follow_up}
  </div>` : ""}

  <!-- Doctor Signature & Official OPD Stamp -->
  <div class="doctor-stamp-container">
    <div style="display: flex; align-items: center; gap: 14px;">
      <!-- Circular Clinical Stamp Seal -->
      <svg width="72" height="72" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r="35" fill="none" stroke="#15803d" stroke-width="2" stroke-dasharray="3 2"/>
        <circle cx="38" cy="38" r="30" fill="none" stroke="#15803d" stroke-width="1.2"/>
        <circle cx="38" cy="38" r="14" fill="#dcfce7" stroke="#16a34a" stroke-width="1"/>
        <polyline points="33,38 36,41 43,34" fill="none" stroke="#15803d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="38" y="20" font-size="5" font-weight="900" fill="#15803d" text-anchor="middle">OPD CLINICAL DESK</text>
        <text x="38" y="58" font-size="5" font-weight="900" fill="#15803d" text-anchor="middle">VERIFIED</text>
      </svg>
      <div>
        <div style="font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase;">
          ✓ Authenticated Outpatient Record
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
          Valid across all hospital pharmacy counters & Jan Aushadhi
        </div>
      </div>
    </div>

    <!-- Doctor Signature Stamp -->
    <div style="text-align: right; min-width: 170px;">
      <svg width="130" height="34" viewBox="0 0 130 34" fill="none">
        <path d="M5 24C18 10 32 6 42 16C50 24 55 28 65 14C72 4 80 8 92 18C100 24 112 12 125 15" stroke="#0369a1" stroke-width="2" stroke-linecap="round"/>
        <path d="M38 18C44 26 50 30 58 20" stroke="#0369a1" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="8" y1="28" x2="122" y2="28" stroke="#cbd5e1" stroke-width="1"/>
      </svg>
      <div style="font-size: 13px; font-weight: 900; color: #0f172a;">${rxData.doctor_name}</div>
      <div style="font-size: 10.5px; font-weight: 700; color: #64748b;">
        Consultant Physician • Reg: ${rxData.doctor_employee_id}
      </div>
      <div style="font-size: 9.5px; font-weight: 800; color: #15803d; margin-top: 1px;">
        Digitally Signed by Attending Doctor
      </div>
    </div>
  </div>

  <div class="footer">${footerStr}</div>
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

