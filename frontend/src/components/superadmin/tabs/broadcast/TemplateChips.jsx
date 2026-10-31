import React from "react";

export default function TemplateChips({ onSelectTemplate, isHi = false }) {
  const templates = [
    {
      id: "code_blue",
      label: isHi ? "कोड ब्लू (मेडिकल इमरजेंसी)" : "Code Blue",
      sub: isHi ? "कार्डियक अरेस्ट" : "Cardiac / CPR",
      accent: "#1E3A8A",
      bg: "rgba(30, 58, 138, 0.08)",
      border: "rgba(30, 58, 138, 0.25)",
      data: {
        type: "code_blue",
        title: isHi ? "कोड ब्लू: तत्काल रिससिटेशन टीम आवश्यक" : "CODE BLUE: Resuscitation Team Alert",
        message: isHi
          ? "आईसीयू ब्लॉक 2, कमरा 304 में तत्काल सीपीआर टीम की आवश्यकता है। इमरजेंसी कॉरिडोर तुरंत खाली करें।"
          : "Emergency resuscitation team needed immediately at ICU Block 2. Clear all transit corridors.",
        duration: "30",
        sound: true,
        priority: "critical",
      },
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    {
      id: "code_red",
      label: isHi ? "कोड रेड (आग / सुरक्षा)" : "Code Red",
      sub: isHi ? "आग / निकासी" : "Fire / Evacuation",
      accent: "#881337",
      bg: "rgba(136, 19, 55, 0.08)",
      border: "rgba(136, 19, 55, 0.25)",
      data: {
        type: "code_red",
        title: isHi ? "कोड रेड: अग्नि अलार्म सक्रिय" : "CODE RED: Fire Alarm Activated",
        message: isHi
          ? "अग्नि अलार्म सक्रिय हुआ है। कृपया आपातकालीन निकास मार्गों का पालन करें। लिफ्ट का उपयोग न करें।"
          : "Fire alarm triggered. Follow emergency evacuation routes immediately. Do not use elevators.",
        duration: "30",
        sound: true,
        priority: "critical",
      },
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      ),
    },
    {
      id: "opd_closing",
      label: isHi ? "ओपीडी काउंटर बंद" : "OPD Closing",
      sub: isHi ? "काउंटर समय" : "Token cutoff",
      accent: "#D97706",
      bg: "rgba(217, 119, 6, 0.08)",
      border: "rgba(217, 119, 6, 0.25)",
      data: {
        type: "notice",
        title: isHi ? "ओपीडी पंजीकरण काउंटर बंद होने का समय" : "OPD Registration Counter Closing Soon",
        message: isHi
          ? "ओपीडी टिकट काउंटर आज दोपहर 02:00 बजे बंद हो जाएंगे। वैध टोकन वाले मरीज कृपया अपने काउंटर पर जाएं।"
          : "OPD ticket booking counters will close at 02:00 PM today. Patients with valid tokens please proceed to assigned counters.",
        duration: "60",
        sound: false,
        priority: "high",
      },
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: "maintenance",
      label: isHi ? "सिस्टम मेंटेनेंस" : "Maintenance",
      sub: isHi ? "सर्वर डाउनटाइम" : "Server downtime",
      accent: "#4B5563",
      bg: "rgba(75, 85, 99, 0.08)",
      border: "rgba(75, 85, 99, 0.25)",
      data: {
        type: "notice",
        title: isHi ? "आज रात 11:00 बजे निर्धारित सिस्टम रखरखाव" : "Scheduled Network Maintenance at 11:00 PM",
        message: isHi
          ? "केंद्रीय ईएमआर एवं बिलिंग सर्वर आज रात 45 मिनट के लिए मेंटेनेंस पर रहेंगे। ऑफलाइन मोड सक्रिय रहेगा।"
          : "Central EMR and billing servers will undergo scheduled maintenance tonight for 45 minutes. Offline tokens supported.",
        duration: "120",
        sound: false,
        priority: "medium",
      },
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      id: "health_camp",
      label: isHi ? "स्वास्थ्य शिविर" : "Health Camp",
      sub: isHi ? "जन जागरूकता" : "Public outreach",
      accent: "#059669",
      bg: "rgba(5, 150, 105, 0.08)",
      border: "rgba(5, 150, 105, 0.25)",
      data: {
        type: "announcement",
        title: isHi ? "इस शनिवार निःशुल्क हृदय जांच शिविर" : "Free Cardiac Checkup Camp this Saturday",
        message: isHi
          ? "इस शनिवार सुबह 9 बजे से मुख्य परिसर में निःशुल्क हृदय एवं ब्लड प्रेशर जांच शिविर आयोजित किया जा रहा है।"
          : "Free cardiac screening & diagnostic camp organized this Saturday 9 AM to 3 PM in the Main Atrium. All are welcome.",
        duration: "240",
        sound: false,
        priority: "normal",
      },
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
    {
      id: "room_shift",
      label: isHi ? "कमरा स्थानांतरण" : "Room Relocation",
      sub: isHi ? "ओपीडी कक्ष बदलाव" : "Clinic room move",
      accent: "#0284C7",
      bg: "rgba(2, 132, 199, 0.08)",
      border: "rgba(2, 132, 199, 0.25)",
      data: {
        type: "notice",
        title: isHi ? "हड्डी रोग ओपीडी कमरा 204 में स्थानांतरित" : "Orthopedics OPD Shifted to Room 204",
        message: isHi
          ? "नवीनीकरण कार्य के कारण, डॉ. वर्मा (हड्डी रोग विशेषज्ञ) का परामर्श कक्ष दूसरी मंजिल पर कमरा 204 में बदल दिया गया है।"
          : "Due to ongoing renovation, Dr. Verma (Orthopedics) OPD consultation has been relocated to Room 204 on 2nd Floor.",
        duration: "180",
        sound: false,
        priority: "medium",
      },
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--text-secondary, #64748b)",
          }}
        >
          {isHi ? "त्वरित टेम्पलेट्स (1-क्लिक प्रीसेट)" : "Quick Templates (1-Click Presets)"}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-secondary, #94a3b8)" }}>
          {isHi ? "फॉर्म भरने के लिए क्लिक करें" : "Click to populate composer"}
        </span>
      </div>

      {/* Single scrollable row of chips */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "4px",
          scrollbarWidth: "none",
        }}
      >
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelectTemplate(tpl.data)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 12px",
              borderRadius: "999px",
              background: tpl.bg,
              border: `1.5px solid ${tpl.border}`,
              color: tpl.accent,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontSize: "12px",
              fontWeight: 600,
              transition: "all 0.15s ease",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.borderColor = tpl.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = tpl.border;
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>{tpl.icon}</span>
            <span>{tpl.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

