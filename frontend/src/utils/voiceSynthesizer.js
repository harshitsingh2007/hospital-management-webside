/**
 * voiceSynthesizer.js
 * -------------------
 * Web Speech Audio Engine for Automated Hospital Voice Announcements.
 * Multi-Lingual Text-to-Speech (English & Hindi).
 * 
 * Hindi Announcement Formats:
 * - Devanagari Hindi Script (for native Hindi speech engine):
 *   "कृपया ध्यान दें: टोकन नंबर T 5 0 1 6 1 2, मरीज राहुल वर्मा, ओपीडी विभाग में पधारें।"
 * - Phonetic Hindi Script (for fallback speech engine):
 *   "Kripya dhyan dein: Token number T 5 0 1 6 1 2, Mareez Rahul Verma, OPD Department mein padharein."
 */

let lastSpokenTicketKey = "";
let lastSpokenTimestamp = 0;

export const announceTicketVoice = (ticket, language = "en") => {
  if (!ticket || !("speechSynthesis" in window)) {
    console.warn("Web Speech API is not supported in this browser or ticket is empty.");
    return;
  }

  const ticketId = ticket.ticket_id || ticket.id || "T-101";
  const now = Date.now();
  const currentKey = `${ticketId}_${language}`;

  // Prevent duplicate concurrent speech invocation within 1200ms
  if (currentKey === lastSpokenTicketKey && now - lastSpokenTimestamp < 1200) {
    return;
  }
  lastSpokenTicketKey = currentKey;
  lastSpokenTimestamp = now;

  try {
    // Cancel any active speech to avoid overlaps
    window.speechSynthesis.cancel();

    const ticketId = ticket.ticket_id || ticket.id || "T-101";
    const patientName = ticket.name || "Patient";
    const dept = ticket.service_category ? ticket.service_category.toUpperCase() : "GENERAL";

    // Split token characters for clear, distinct phonetic output (e.g. "T 5 0 1 6 1 2")
    const formattedTokenId = ticketId.replace(/[^a-zA-Z0-9]/g, "").split("").join(" ");

    const speakNow = () => {
      const voices = window.speechSynthesis.getVoices();

      let targetVoice = null;
      if (language === "hi") {
        targetVoice = voices.find(
          (v) =>
            v.lang.includes("hi-IN") ||
            v.lang.startsWith("hi") ||
            v.name.toLowerCase().includes("hindi") ||
            v.name.toLowerCase().includes("hi-in") ||
            v.name.includes("Kalpana") ||
            v.name.includes("Hemant")
        );
      }

      if (!targetVoice) {
        targetVoice = voices.find(
          (v) => v.lang.includes("en-US") || v.lang.includes("en-IN") || v.lang.startsWith("en")
        );
      }

      let textToSpeak = "";
      if (language === "hi") {
        // Hindi Department Mapping
        const hindiDeptMap = {
          CONSULTATION: "ओपीडी",
          PHARMACY: "दवा",
          EMERGENCY: "आपातकालीन",
          LABORATORY: "पैथोलॉजी लैब",
          PATHOLOGY: "पैथोलॉजी लैब",
          LAB: "पैथोलॉजी लैब",
          DIAGNOSTIC: "पैथोलॉजी लैब",
          RADIOLOGY: "रेडियोलॉजी",
          BILLING: "बिलिंग",
        };
        const deptHindi = hindiDeptMap[dept] || dept;

        if (targetVoice && (targetVoice.lang.startsWith("hi") || targetVoice.name.toLowerCase().includes("hindi"))) {
          // Native Hindi Speech Engine Available -> Speak Devanagari Hindi Text
          textToSpeak = `कृपया ध्यान दें। टोकन नंबर ${formattedTokenId}, मरीज ${patientName}, ${deptHindi} विभाग में पधारें।`;
        } else {
          // Fallback Engine -> Speak Romanized Hindi Phonetics
          textToSpeak = `Kripya dhyan dein: Token number ${formattedTokenId}, Mareez ${patientName}, ${dept} Department mein padharein.`;
        }
      } else {
        // Standard English Announcement
        textToSpeak = `Attention please: Token Number ${formattedTokenId}, Patient ${patientName}, please proceed to ${dept} Department.`;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = language === "hi" ? "hi-IN" : "en-US";
      utterance.rate = language === "hi" ? 0.82 : 0.88;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (targetVoice) {
        utterance.voice = targetVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speakNow();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      speakNow();
    }
  } catch (e) {
    console.error("Voice announcement error:", e);
  }
};
