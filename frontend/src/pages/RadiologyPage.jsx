/**
 * RadiologyPage.jsx
 * -----------------
 * Enterprise Clinical Radiology & Diagnostic Imaging Workstation.
 * Matches Pathology & Diagnostic Laboratory Workstation Design System:
 * - Real-Time Radiology Queue & Scan Stream
 * - Active Study Execution Station with Doctor Referral Audit
 * - AERB & ACR Radiation Safety Verification (Pregnancy protocol for females 12-55)
 * - Structured Imaging Report Entry (Clinical Indication, Technique, Findings, Impression)
 * - Quick Normal Diagnostic Templates (Chest X-Ray, Brain CT, Abdomen USG, L-S Spine X-Ray)
 * - Multi-image / DICOM Scan Uploader & Full-Screen Image Viewer Modal (Zoom, Rotate, Invert, Contrast, Brightness)
 * - Printable Hospital-Branded Radiology Report Slips
 * - Ticket Routing (Discharge or Route back to Referring OPD Doctor with Imaging Findings)
 * - Historical Radiology Archives & Date-Filtered Reports with Excel Export
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE, HOSPITAL_CONFIG } from "../config/hospitalConfig";
import { announceTicketVoice } from "../utils/voiceSynthesizer";
import { printRadiologyReportSlip } from "../utils/printPassHelper";
import Footer from "../components/common/Footer";
import {
  Scan,
  Activity,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  Search,
  RefreshCw,
  Clock,
  User,
  Stethoscope,
  Building2,
  Sparkles,
  Coffee,
  History,
  Calendar,
  Eye,
  Phone,
  Plus,
  Trash2,
  Shield,
  ArrowRight,
  ChevronDown,
  Check,
  FileCheck,
  Sliders,
  Volume2,
  AlertCircle,
  Send,
  Camera,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as XLSX from "xlsx";

const MODALITY_OPTIONS = [
  { id: "X-Ray", label: "Digital X-Ray (CR / DR)" },
  { id: "CT Scan", label: "Computed Tomography (CT)" },
  { id: "MRI", label: "Magnetic Resonance Imaging (MRI)" },
  { id: "Ultrasound", label: "Ultrasonography (USG)" },
  { id: "Mammography", label: "Digital Mammography" },
  { id: "Fluoroscopy", label: "Fluoroscopy / C-Arm" },
];

const BODY_PARTS = [
  "Chest",
  "Brain / Head",
  "Abdomen",
  "Pelvis",
  "C-Spine (Cervical)",
  "L-Spine (Lumbosacral)",
  "D-Spine (Thoracic)",
  "Knee (Joint)",
  "Shoulder (Joint)",
  "Hip (Joint)",
  "Ankle / Foot",
  "Wrist / Hand",
  "Paranasal Sinuses (PNS)",
  "Whole Abdomen & Pelvis",
  "Neck / Soft Tissues",
];

const VIEWS_PROJECTIONS = [
  "PA View (Posteroanterior)",
  "AP View (Anteroposterior)",
  "Lateral View",
  "Oblique View",
  "AP & Lateral",
  "Axial Sections",
  "Axial + Coronal + Sagittal",
  "Open Mouth (Odontoid)",
  "Decubitus View",
];

const CONTRAST_OPTIONS = [
  "None (Non-Contrast / Plain)",
  "Oral Contrast Only",
  "IV Contrast Only (Iodinated / Gadolinium)",
  "Oral + IV Contrast",
];

const LATERALITY_OPTIONS = ["N/A (Midline / Bilateral)", "Left", "Right", "Bilateral"];
const PRIORITY_OPTIONS = ["Routine", "Urgent", "STAT (Emergency)"];

const NORMAL_TEMPLATES = {
  chest_xray: {
    title: "Normal Chest X-Ray (PA)",
    modality: "X-Ray",
    body_part: "Chest",
    view: "PA View (Posteroanterior)",
    indication: "Routine medical evaluation / pre-operative clearance / respiratory screening.",
    technique: "Standard high-kV digital posteroanterior erect chest radiograph obtained at full inspiration.",
    findings:
      "• Heart size and cardiothoracic ratio (CTR) are within normal physiological limits (< 50%).\n• Bilateral lung fields are clear and normally expanded. No focal parenchymal consolidation, airspace opacity, mass lesion, or cavitation identified.\n• Costophrenic and cardiophrenic angles are sharp and clear bilaterally. No pleural thickening or effusion noted.\n• Trachea is central. Mediastinal contours, aortic knob, and hilar vascular markings appear normal.\n• Visualized bony thoracic cage, clavicles, ribs, and soft tissues are unremarkable.",
    impression: "Normal posteroanterior chest radiograph. No evidence of active cardiopulmonary parenchymal disease.",
  },
  brain_ct: {
    title: "Normal Non-Contrast Brain CT",
    modality: "CT Scan",
    body_part: "Brain / Head",
    view: "Axial Sections",
    indication: "Evaluation of headache / altered sensorium / ruling out acute intracranial event.",
    technique: "Axial contiguous non-contrast CT sections of the brain obtained from skull base to vertex with 5mm reconstruction.",
    findings:
      "• No evidence of acute intracranial hemorrhage, extra-axial fluid collection, or mass lesion.\n• Grey-white matter differentiation is preserved across both cerebral hemispheres.\n• Ventricular system (lateral, third, and fourth ventricles), basal cisterns, and cerebral sulci appear normal in caliber and configuration for age.\n• Midline structures are central with no evidence of subfalcine or transtentorial herniation.\n• Posterior fossa structures including cerebellum and brainstem demonstrate normal attenuation.\n• Calvarium, skull base, and visualized paranasal sinuses appear unremarkable.",
    impression: "Normal non-contrast CT study of the brain. No acute intracranial hemorrhage, ischemic infarction, or mass effect demonstrated.",
  },
  abdomen_usg: {
    title: "Normal Whole Abdomen USG",
    modality: "Ultrasound",
    body_part: "Whole Abdomen & Pelvis",
    view: "Axial + Coronal + Sagittal",
    indication: "Abdominal discomfort / routine visceral evaluation.",
    technique: "Real-time B-mode and color Doppler transabdominal sonography of the whole abdomen and pelvis utilizing curvilinear 3.5-5.0 MHz transducer.",
    findings:
      "• Liver is normal in size (13.8 cm), shows homogenous parenchymal echotexture with smooth hepatic margins. No focal space-occupying lesion (SOL) detected. Intrahepatic biliary radicles are not dilated.\n• Gallbladder is well-distended, thin-walled (2.1 mm), lumen is clear with no calculus or sludge. Common bile duct (CBD) measures 3.8 mm (normal).\n• Pancreas and spleen are normal in size, contour, and internal echogenicity. Splenic length is 9.8 cm.\n• Both kidneys are normal in size, shape, and cortical thickness. Corticomedullary differentiation is well maintained. No calculus, hydronephrosis, or perinephric collection bilaterally.\n• Urinary bladder is adequately distended with smooth walls. No intraluminal lesion or calculus.",
    impression: "Normal whole abdomen and pelvis sonographic study. No sonological evidence of organomegaly, focal lesion, calculus, or free fluid.",
  },
  spine_xray: {
    title: "Normal Lumbosacral (L-S) Spine X-Ray",
    modality: "X-Ray",
    body_part: "L-Spine (Lumbosacral)",
    view: "AP & Lateral",
    indication: "Low back pain / postural strain.",
    technique: "Digital anteroposterior and lateral radiographs of the lumbosacral spine performed in erect posture.",
    findings:
      "• Normal lumbar lordotic curvature is maintained.\n• Vertebral body heights, cortical margins, and trabecular patterns are well-preserved across L1 to S1.\n• Intervertebral disc spaces demonstrate preserved heights without significant anterior or posterior narrowing.\n• Posterior elements, pedicles, and spinous processes appear intact without lysis or spondylolisthesis.\n• Sacroiliac joints are symmetrical with normal articular margins. Psoas muscle shadows appear normal bilaterally.",
    impression: "Unremarkable lumbosacral spine radiographs. No evidence of acute fracture, spondylolisthesis, or significant disc degeneration.",
  },
};

export default function RadiologyPage({
  tenantId,
  currentUser,
  analytics,
  queueSnapshot = [],
  servingTickets = [],
  heldTickets = [],
  handleServeNext = null,
  refreshData,
  language = "en",
  setLanguage = null,
  socketRef,
  navigateTo,
  hospitalBranding = null,
  theme = "light",
  setTheme = null,
}) {
  const isHi = language === "hi";
  const effectiveHospitalCode =
    hospitalBranding?.hospital_code ||
    currentUser?.hospital_code ||
    HOSPITAL_CONFIG?.tenantId ||
    "city-hospital-01";

  // Match Pathology clinical primary brand color #0284C7
  const brandPrimary = hospitalBranding?.primary_color || "#0284C7";
  const brandName =
    hospitalBranding?.hospital_name ||
    hospitalBranding?.name ||
    currentUser?.hospital_name ||
    (isHi ? "सिटी जनरल अस्पताल" : "City General Hospital");

  // Theme Sync
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_queue_theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) { }
    return theme || "light";
  });

  useEffect(() => {
    if (theme && (theme === "dark" || theme === "light") && theme !== currentTheme) {
      setCurrentTheme(theme);
    }
  }, [theme, currentTheme]);

  const isDark = currentTheme === "dark";
  const pageBg = isDark ? "#090D16" : "#F8FAFC";
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const textColor = isDark ? "#F1F5F9" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";

  // Tab State: "workstation" | "archive" | "history"
  const [activeTab, setActiveTab] = useState("workstation");

  // Radiologist identity state
  const radiologistName =
    currentUser?.name ||
    currentUser?.username ||
    (isHi ? "डॉ. आर. के. शर्मा, एमडी (रेडियोलॉजी)" : "Dr. R. K. Sharma, MD, DMRD (Radiologist)");

  // Desks & Desk Assignment (Assigned by SuperAdmin Portal)
  const [hospitalDesks, setHospitalDesks] = useState([]);
  const [assignedDesk, setAssignedDesk] = useState(null);
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [activeDesk, setActiveDesk] = useState(() => {
    try {
      return localStorage.getItem("ai_queue_radiology_desk") || "";
    } catch (_) {
      return "";
    }
  });

  const fetchHospitalDesks = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    try {
      const headers = { "Content-Type": "application/json" };
      if (currentUser?.email) headers["X-User-Email"] = currentUser.email;
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      const res = await fetch(`${API_BASE}/api/v1/superadmin/hospitals/${effectiveHospitalCode}/desks`, { headers });
      const data = await res.json();
      if (data && data.status === "success" && Array.isArray(data.desks)) {
        setHospitalDesks(data.desks);
        const myId = Number(currentUser?.id || currentUser?.user_id);
        const myCode = String(currentUser?.employee_code || currentUser?.employee_id || "").toLowerCase().trim();
        const myName = String(currentUser?.name || currentUser?.username || "").toLowerCase().trim();

        const match = data.desks.find((d) => {
          const aId = Number(d.assigned_user_id || d.assigned_employee_id);
          const aCode = String(d.assigned_employee_code || "").toLowerCase().trim();
          const aName = String(d.assigned_user_name || d.assigned_name || "").toLowerCase().trim();
          return (
            (myId && aId && myId === aId) ||
            (myCode && aCode && myCode === aCode) ||
            (myName && aName && myName === aName)
          );
        });

        if (match) {
          setAssignedDesk(match);
          setSelectedDesk(match);
          setActiveDesk(match.desk_name || String(match.id));
          try {
            localStorage.setItem("ai_queue_radiology_desk", match.desk_name || String(match.id));
          } catch (_) { }
        }
      }
    } catch (e) {
      console.warn("Could not fetch hospital desks:", e);
    }
  }, [effectiveHospitalCode, currentUser]);

  useEffect(() => {
    fetchHospitalDesks();
  }, [fetchHospitalDesks]);

  // Duty Status: "ACTIVE" | "PROCESSING" | "BREAK" | "OFF_DUTY"
  const [dutyStatus, setDutyStatus] = useState(() => {
    try {
      return localStorage.getItem("ai_queue_radiology_duty") || "ACTIVE";
    } catch (_) {
      return "ACTIVE";
    }
  });

  const [showDutyDropdown, setShowDutyDropdown] = useState(false);
  const dutyDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dutyDropdownRef.current && !dutyDropdownRef.current.contains(e.target)) {
        setShowDutyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const dutyStatusOptions = useMemo(
    () => [
      {
        id: "ACTIVE",
        label: isHi ? "स्कैन हेतु तैयार" : "Ready to Scan",
        desc: isHi ? "मरीज़ बुलाने के लिए सक्रिय" : "Active & Accepting Patients",
        color: "#10B981",
        bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
        border: "#10B981",
        icon: "●",
      },
      {
        id: "PROCESSING",
        label: isHi ? "इमेजिंग जारी" : "Processing Scans",
        desc: isHi ? "स्कैनिंग या पुनर्निर्माण प्रगति पर है" : "Scanning / Reconstructing",
        color: "#0284C7",
        bg: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
        border: "#0284C7",
        icon: "⚙",
      },
      {
        id: "BREAK",
        label: isHi ? "अवकाश पर" : "On Break",
        desc: isHi ? "अल्पकालिक अवकाश" : "Short Break / Calling Paused",
        color: "#F59E0B",
        bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB",
        border: "#F59E0B",
        icon: "☕",
      },
      {
        id: "OFF_DUTY",
        label: isHi ? "ड्यूटी समाप्त" : "Off Duty / Closed",
        desc: isHi ? "स्टेशन आज के लिए बंद है" : "Shift Ended / Counter Offline",
        color: "#EF4444",
        bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
        border: "#EF4444",
        icon: "■",
      },
    ],
    [isHi, isDark]
  );

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleUpdateDutyStatus = useCallback(
    (newDutyId) => {
      setDutyStatus(newDutyId);
      setShowDutyDropdown(false);
      try {
        localStorage.setItem("ai_queue_radiology_duty", newDutyId);
      } catch (_) { }

      const backendStatus =
        newDutyId === "BREAK"
          ? "ON_BREAK"
          : newDutyId === "OFF_DUTY"
            ? "OFF_DUTY"
            : newDutyId === "PROCESSING"
              ? "PROCESSING"
              : "ACTIVE";

      const targetUserId = currentUser?.id || currentUser?.user_id;
      const targetEmail = currentUser?.email;
      const targetName = currentUser?.name || currentUser?.username || radiologistName;
      const targetEmpCode = currentUser?.employee_code || currentUser?.employee_id;

      const payload = {
        tenant_id: effectiveHospitalCode,
        doctor_id: targetUserId,
        staff_id: targetUserId,
        user_id: targetUserId,
        employee_id: targetUserId,
        employee_code: targetEmpCode,
        doctor_email: targetEmail,
        staff_email: targetEmail,
        email: targetEmail,
        doctor_name: targetName,
        staff_name: targetName,
        name: targetName,
        role: currentUser?.role || "radiologist",
        status: backendStatus,
        break_type: newDutyId === "BREAK" ? "tea" : null,
        note: newDutyId === "PROCESSING" ? "Processing Medical Scans" : "",
      };

      if (socketRef && socketRef.current) {
        socketRef.current.emit("update_doctor_duty_status", payload);
        socketRef.current.emit("update_staff_duty_status", payload);
      }

      const headers = { "Content-Type": "application/json" };
      if (currentUser?.email) headers["X-User-Email"] = currentUser.email;
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      fetch(`${API_BASE}/api/v1/doctor/duty-status`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.warn("Failed to persist duty status via REST:", err);
      });

      const opt = dutyStatusOptions.find((o) => o.id === newDutyId);
      showToast(
        isHi
          ? `ड्यूटी स्थिति बदलकर '${opt?.label || newDutyId}' कर दी गई`
          : `Duty status updated to '${opt?.label || newDutyId}'`,
        newDutyId === "ACTIVE" ? "success" : newDutyId === "BREAK" ? "warn" : "info"
      );
    },
    [currentUser, effectiveHospitalCode, radiologistName, socketRef, dutyStatusOptions, isHi, showToast]
  );

  // Filter Radiology & Diagnostic Imaging Queue
  const radiologyQueue = useMemo(() => {
    if (!Array.isArray(queueSnapshot)) return [];
    return queueSnapshot.filter((t) => {
      const dept = (t.department || t.department_name || "").toLowerCase();
      const cat = (t.service_category || "").toLowerCase();
      const med = (t.medical_condition || "").toLowerCase();
      const transFrom = (t.transferred_from_dept || "").toLowerCase();

      return (
        dept.includes("rad") ||
        dept.includes("xray") ||
        dept.includes("x-ray") ||
        dept.includes("imag") ||
        dept.includes("scan") ||
        dept.includes("mri") ||
        dept.includes("ct") ||
        dept.includes("usg") ||
        dept.includes("ultrasound") ||
        cat.includes("rad") ||
        cat.includes("xray") ||
        cat.includes("imag") ||
        cat.includes("scan") ||
        med.includes("rad") ||
        med.includes("xray") ||
        med.includes("scan") ||
        med.includes("mri") ||
        med.includes("ct") ||
        med.includes("usg") ||
        med.includes("ultrasound") ||
        transFrom.includes("rad") ||
        transFrom.includes("xray") ||
        transFrom.includes("imag") ||
        (t.prescription_notes &&
          typeof t.prescription_notes === "string" &&
          (t.prescription_notes.includes("radiology_report") ||
            t.prescription_notes.includes("xray") ||
            t.prescription_notes.includes("imaging")))
      );
    });
  }, [queueSnapshot]);

  // Selected serving ticket
  const [selectedServingTicket, setSelectedServingTicket] = useState(null);

  // Active Serving Radiology Ticket
  const radiologyServing = useMemo(() => {
    if (Array.isArray(servingTickets) && servingTickets.length > 0) {
      const myId = currentUser?.id || currentUser?.user_id;
      const myEmail = String(currentUser?.email || "").toLowerCase().trim();
      const myName = String(currentUser?.name || currentUser?.username || "").toLowerCase().trim();

      // Priority 1: Ticket specifically served by current user or desk
      const myDirectServing = servingTickets.find((t) => {
        const servedById = t.served_by_doctor_id;
        const servedByEmail = String(t.served_by_doctor_email || "").toLowerCase().trim();
        const servedByName = String(t.served_by_doctor_name || "").toLowerCase().trim();
        const servedDesk = t.desk_id ? String(t.desk_id) : null;
        const myDeskId = selectedDesk?.id || assignedDesk?.id ? String(selectedDesk?.id || assignedDesk?.id) : null;

        return (
          (myId && servedById && String(servedById) === String(myId)) ||
          (myEmail && servedByEmail && servedByEmail === myEmail) ||
          (myName && servedByName && servedByName === myName) ||
          (myDeskId && servedDesk && servedDesk === myDeskId)
        );
      });
      if (myDirectServing) return myDirectServing;

      // Priority 2: Ticket for radiology / imaging / xray
      const radMatch = servingTickets.find((t) => {
        const dept = (t.department || t.department_name || "").toLowerCase();
        const cat = (t.service_category || "").toLowerCase();
        return (
          dept.includes("rad") ||
          dept.includes("xray") ||
          dept.includes("x-ray") ||
          dept.includes("imag") ||
          cat.includes("rad") ||
          cat.includes("xray") ||
          cat.includes("imag")
        );
      });
      if (radMatch) return radMatch;
    }
    return null;
  }, [servingTickets, currentUser, selectedDesk, assignedDesk]);

  useEffect(() => {
    if (radiologyServing) {
      setSelectedServingTicket(radiologyServing);
    }
  }, [radiologyServing]);

  const activeServingTicket = selectedServingTicket || radiologyServing || null;

  // Study Form State
  const [modality, setModality] = useState("X-Ray");
  const [bodyPart, setBodyPart] = useState("Chest");
  const [viewProjection, setViewProjection] = useState("PA View (Posteroanterior)");
  const [contrast, setContrast] = useState("None (Non-Contrast / Plain)");
  const [laterality, setLaterality] = useState("N/A (Midline / Bilateral)");
  const [priority, setPriority] = useState("Routine");
  const [technologist, setTechnologist] = useState("");
  const [equipment, setEquipment] = useState("Siemens Multix Impact Digital Radiography Suite");
  const [radiationDose, setRadiationDose] = useState("");
  const [examTime, setExamTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [clinicalIndication, setClinicalIndication] = useState("");
  const [technique, setTechnique] = useState("");
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [reportStatus, setReportStatus] = useState("Final"); // "Draft" | "Preliminary" | "Final"
  const [images, setImages] = useState([]); // [{ name, url, type, size }]
  const [isUploading, setIsUploading] = useState(false);
  const [radiologyAccessionNo, setRadiologyAccessionNo] = useState(() => `RAD-${Date.now().toString().slice(-6)}`);

  // Pregnancy Safety Protocol for females 12-55 undergoing X-Ray / CT
  const [pregnancyConfirmed, setPregnancyConfirmed] = useState(false);

  const showPregnancyWarning = useMemo(() => {
    if (!activeServingTicket) return false;
    const g = String(activeServingTicket.gender || "").toLowerCase();
    const isFemale = g.startsWith("f") || g === "female";
    const age = Number(activeServingTicket.age || 0);
    const isReproductiveAge = age >= 12 && age <= 55;
    const isIonizing = modality === "X-Ray" || modality === "CT Scan" || modality === "Fluoroscopy";
    return isFemale && isReproductiveAge && isIonizing;
  }, [activeServingTicket, modality]);

  // Parse referring doctor prescription if present
  const parsedDoctorRx = useMemo(() => {
    if (!activeServingTicket || !activeServingTicket.prescription_notes) return null;
    try {
      if (typeof activeServingTicket.prescription_notes === "object") {
        return activeServingTicket.prescription_notes;
      }
      return JSON.parse(activeServingTicket.prescription_notes);
    } catch (_) {
      return null;
    }
  }, [activeServingTicket]);

  // Sync state when activeServingTicket changes or has existing report
  useEffect(() => {
    if (activeServingTicket) {
      setRadiologyAccessionNo(`RAD-${activeServingTicket.ticket_id || Date.now().toString().slice(-6)}`);
      setExamTime(new Date().toISOString().slice(0, 16));
      setPregnancyConfirmed(false);

      if (parsedDoctorRx?.radiology_report) {
        const rr = parsedDoctorRx.radiology_report;
        if (rr.modality) setModality(rr.modality);
        if (rr.body_part) setBodyPart(rr.body_part);
        if (rr.view) setViewProjection(rr.view);
        if (rr.contrast) setContrast(rr.contrast);
        if (rr.laterality) setLaterality(rr.laterality);
        if (rr.priority) setPriority(rr.priority);
        if (rr.technologist) setTechnologist(rr.technologist);
        if (rr.equipment) setEquipment(rr.equipment);
        if (rr.dose) setRadiationDose(rr.dose);
        if (rr.exam_time) setExamTime(rr.exam_time);
        if (rr.clinical_indication) setClinicalIndication(rr.clinical_indication);
        if (rr.technique) setTechnique(rr.technique);
        if (rr.findings) setFindings(rr.findings);
        if (rr.impression) setImpression(rr.impression);
        if (rr.status) setReportStatus(rr.status);
        if (Array.isArray(rr.images)) setImages(rr.images);
      } else {
        // Default prefill from doctor diagnosis/lab_tests
        const rxTests = String(parsedDoctorRx?.lab_tests || activeServingTicket.medical_condition || "").toLowerCase();
        if (rxTests.includes("ct") || rxTests.includes("brain")) {
          applyNormalTemplate("brain_ct");
        } else if (rxTests.includes("usg") || rxTests.includes("ultrasound") || rxTests.includes("abdomen")) {
          applyNormalTemplate("abdomen_usg");
        } else if (rxTests.includes("spine") || rxTests.includes("back")) {
          applyNormalTemplate("spine_xray");
        } else {
          applyNormalTemplate("chest_xray");
        }
      }
    }
  }, [activeServingTicket, parsedDoctorRx]);

  // Apply Normal Diagnostic Template
  const applyNormalTemplate = (key) => {
    const t = NORMAL_TEMPLATES[key];
    if (!t) return;
    setModality(t.modality);
    setBodyPart(t.body_part);
    setViewProjection(t.view);
    setClinicalIndication(t.indication);
    setTechnique(t.technique);
    setFindings(t.findings);
    setImpression(t.impression);
    showToast(isHi ? `'${t.title}' टेम्पलेट लागू किया गया ✓` : `Applied '${t.title}' template ✓`, "info");
  };

  // Image Upload Handler
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!activeServingTicket) {
      showToast(isHi ? "फ़ाइल अपलोड करने से पहले मरीज़ चुनें" : "Select patient before uploading scans", "warn");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("tenant_id", effectiveHospitalCode);
      formData.append("ticket_id", String(activeServingTicket.ticket_id));
      files.forEach((file) => {
        formData.append("images", file);
      });

      const headers = {};
      if (currentUser?.email) headers["X-User-Email"] = currentUser.email;
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      const res = await fetch(`${API_BASE}/api/v1/plugin/radiology/upload`, {
        method: "POST",
        headers,
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.status === "success" && Array.isArray(data.files)) {
        setImages((prev) => [...prev, ...data.files]);
        showToast(isHi ? `${data.files.length} इमेज सफलतापूर्वक अपलोड हुईं ✓` : `${data.files.length} scan(s) uploaded successfully ✓`, "success");
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err) {
      console.warn("Upload failed, storing client object URL fallback:", err);
      const fallbackList = files.map((f) => ({
        name: f.name,
        url: URL.createObjectURL(f),
        size: f.size,
        type: f.name.endsWith(".dcm") ? "dicom" : "image",
      }));
      setImages((prev) => [...prev, ...fallbackList]);
      showToast(isHi ? "इमेज प्रीव्यू के लिए संलग्न की गई (लोकल)" : "Images attached locally for review", "info");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Image Viewer Modal State
  const [viewerImage, setViewerImage] = useState(null);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);
  const [viewerInvert, setViewerInvert] = useState(false);
  const [viewerContrast, setViewerContrast] = useState(100);
  const [viewerBrightness, setViewerBrightness] = useState(100);

  const openViewer = (img) => {
    setViewerImage(img);
    setViewerZoom(1);
    setViewerRotation(0);
    setViewerInvert(false);
    setViewerContrast(100);
    setViewerBrightness(100);
  };

  const resetViewerControls = () => {
    setViewerZoom(1);
    setViewerRotation(0);
    setViewerInvert(false);
    setViewerContrast(100);
    setViewerBrightness(100);
  };

  // Build Payload
  const buildReportPayload = () => ({
    modality,
    body_part: bodyPart,
    view: viewProjection,
    contrast,
    laterality,
    priority,
    technologist: technologist || "Radiology Technologist, AERB Certified",
    equipment,
    dose: radiationDose || "Routine diagnostic reference level",
    exam_time: examTime,
    clinical_indication: clinicalIndication,
    technique,
    findings,
    impression,
    status: reportStatus,
    images,
    radiologist_name: radiologistName,
    accession_no: radiologyAccessionNo,
    verified_at: new Date().toISOString(),
  });

  // Call Next Patient
  const [callingNext, setCallingNext] = useState(false);
  const handleCallNext = async () => {
    if (dutyStatus === "OFF_DUTY") {
      showToast(isHi ? "स्टेशन बंद है। पहले ड्यूटी सक्रिय करें।" : "Station is offline. Set duty to Active first.", "warn");
      return;
    }
    if (dutyStatus === "BREAK") {
      showToast(isHi ? "आप अवकाश पर हैं। पहले ड्यूटी पुनः शुरू करें।" : "You are on break. Resume active duty to call patients.", "warn");
      return;
    }
    if (radiologyQueue.length === 0) {
      showToast(isHi ? "रेडियोलॉजी कतार में कोई प्रतीक्षारत मरीज़ नहीं है" : "No patients waiting in radiology stream", "info");
      return;
    }

    setCallingNext(true);
    try {
      const nextTicket = radiologyQueue[0];
      if (handleServeNext) {
        await handleServeNext(nextTicket);
      }

      setSelectedServingTicket(nextTicket);

      const radTicket = {
        ...nextTicket,
        department: "radiology",
        doctor_name: radiologistName,
        counter_name: assignedDesk?.desk_name || activeDesk || "Imaging Workstation",
        room_number: assignedDesk?.desk_name || "Radiology Scan Room",
      };

      if (socketRef && socketRef.current) {
        socketRef.current.emit("call_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: nextTicket.ticket_id,
          desk_name: assignedDesk?.desk_name || activeDesk || "Imaging Workstation",
          department: "radiology",
          doctor_name: radiologistName,
        });
        socketRef.current.emit("voice_call_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket: radTicket,
          language,
        });
      }

      // Broadcast across browser tabs
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("hospital_live_queue_sync");
          bc.postMessage({
            type: "now_serving",
            ticket: radTicket,
            tenant_id: effectiveHospitalCode,
          });
          bc.close();
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("now_serving", { detail: { ticket: radTicket } }));
          window.dispatchEvent(new CustomEvent("ticket_called", { detail: { ticket: radTicket } }));
        }
      } catch (_) { }

      announceTicketVoice(radTicket, language);

      showToast(
        isHi
          ? `टोकन #${nextTicket.ticket_id} (${nextTicket.name}) को बुलाया गया!`
          : `Called Token #${nextTicket.ticket_id} (${nextTicket.name}) to Imaging Desk!`,
        "success"
      );
      if (refreshData) refreshData();
    } catch (e) {
      console.error("Call next error:", e);
      showToast(isHi ? "मरीज़ बुलाने में त्रुटि" : "Error calling next patient", "error");
    } finally {
      setCallingNext(false);
    }
  };

  // Call Specific Patient from Live Queue
  const handleCallSpecificPatient = async (ticket) => {
    if (dutyStatus === "OFF_DUTY" || dutyStatus === "BREAK") {
      showToast(isHi ? "पहले ड्यूटी सक्रिय करें" : "Set duty to Active first", "warn");
      return;
    }
    try {
      if (handleServeNext) {
        await handleServeNext(ticket);
      }
      setSelectedServingTicket(ticket);

      const radTicket = {
        ...ticket,
        department: "radiology",
        doctor_name: radiologistName,
        counter_name: assignedDesk?.desk_name || activeDesk || "Imaging Workstation",
        room_number: assignedDesk?.desk_name || "Radiology Scan Room",
      };

      if (socketRef && socketRef.current) {
        socketRef.current.emit("call_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          desk_name: assignedDesk?.desk_name || activeDesk || "Imaging Workstation",
          department: "radiology",
          doctor_name: radiologistName,
        });
        socketRef.current.emit("voice_call_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket: radTicket,
          language,
        });
      }

      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("hospital_live_queue_sync");
          bc.postMessage({
            type: "now_serving",
            ticket: radTicket,
            tenant_id: effectiveHospitalCode,
          });
          bc.close();
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("now_serving", { detail: { ticket: radTicket } }));
          window.dispatchEvent(new CustomEvent("ticket_called", { detail: { ticket: radTicket } }));
        }
      } catch (_) { }

      announceTicketVoice(radTicket, language);
      showToast(
        isHi
          ? `टोकन #${ticket.ticket_id} (${ticket.name}) को बुलाया गया!`
          : `Called Token #${ticket.ticket_id} (${ticket.name}) to station!`,
        "success"
      );
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? "कॉल करने में त्रुटि" : "Error calling ticket", "error");
    }
  };

  // Re-announce (Recall)
  const handleRecall = () => {
    if (!activeServingTicket) return;
    const radTicket = {
      ...activeServingTicket,
      department: "radiology",
      doctor_name: radiologistName,
      counter_name: assignedDesk?.desk_name || activeDesk || "Imaging Workstation",
      room_number: assignedDesk?.desk_name || "Radiology Scan Room",
    };

    if (socketRef && socketRef.current) {
      socketRef.current.emit("voice_call_ticket", {
        tenant_id: effectiveHospitalCode,
        ticket: radTicket,
        language,
      });
    }

    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("hospital_live_queue_sync");
        bc.postMessage({
          type: "now_serving",
          ticket: radTicket,
          tenant_id: effectiveHospitalCode,
        });
        bc.close();
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("now_serving", { detail: { ticket: radTicket } }));
        window.dispatchEvent(new CustomEvent("ticket_called", { detail: { ticket: radTicket } }));
      }
    } catch (_) { }

    announceTicketVoice(radTicket, language);
    showToast(
      isHi
        ? `टोकन #${activeServingTicket.ticket_id} (${activeServingTicket.name}) की उद्घोषणा पुनः प्रसारित की गई!`
        : `Token #${activeServingTicket.ticket_id} (${activeServingTicket.name}) re-announced on loudspeaker!`,
      "info"
    );
  };

  // Hold Ticket
  const handleHold = async () => {
    if (!activeServingTicket) return;
    try {
      await fetch(`${API_BASE}/api/v1/plugin/hold-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          grace_minutes: 10,
        }),
      });
      if (socketRef && socketRef.current) {
        socketRef.current.emit("hold_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          grace_minutes: 10,
        });
      }
      setSelectedServingTicket(null);
      showToast(isHi ? `टोकन #${activeServingTicket.ticket_id} को होल्ड पर रखा गया` : `Token #${activeServingTicket.ticket_id} placed on 10-minute hold`, "warn");
      if (refreshData) refreshData();
    } catch (_) { }
  };

  // Mark No-Show
  const handleNoShow = async () => {
    if (!activeServingTicket) return;
    try {
      await fetch(`${API_BASE}/api/v1/plugin/no-show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          reason: "Patient did not appear for scan",
        }),
      });
      if (socketRef && socketRef.current) {
        socketRef.current.emit("mark_noshow", {
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          reason: "Patient did not appear for imaging exam",
        });
      }
      setSelectedServingTicket(null);
      showToast(isHi ? `टोकन #${activeServingTicket.ticket_id} को अनुपस्थित चिह्नित किया गया` : `Token #${activeServingTicket.ticket_id} marked as no-show`, "error");
      if (refreshData) refreshData();
    } catch (_) { }
  };

  // Save Report Draft
  const handleSaveReportDraft = async () => {
    if (!activeServingTicket) {
      showToast(isHi ? "सहेजने के लिए कोई सक्रिय मरीज़ नहीं है" : "No active patient to save report for", "warn");
      return;
    }

    try {
      const reportPayload = buildReportPayload();
      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        radiology_report: reportPayload,
      };

      const res = await fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          prescription: mergedNotes,
        }),
      });

      if (res.ok) {
        showToast(isHi ? "रेडियोलॉजी रिपोर्ट ड्राफ्ट सहेजा गया ✓" : "Radiology report draft saved successfully ✓", "success");
        if (refreshData) refreshData();
      } else {
        throw new Error("Failed to save draft");
      }
    } catch (e) {
      showToast(isHi ? "ड्राफ्ट सहेजने में त्रुटि" : "Error saving radiology report draft", "error");
    }
  };

  // Print Official Slip
  const handlePrintReport = () => {
    if (!activeServingTicket) {
      showToast(isHi ? "प्रिंट करने के लिए कोई सक्रिय मरीज़ नहीं है" : "No active patient selected for printing", "warn");
      return;
    }

    printRadiologyReportSlip(
      {
        patient_name: activeServingTicket.name,
        age: activeServingTicket.age || 30,
        gender: activeServingTicket.gender || "M",
        phone: activeServingTicket.phone || "N/A",
        ticket_id: activeServingTicket.ticket_id,
        referring_doctor: parsedDoctorRx?.doctor_name || "Attending Physician",
        modality,
        body_part: bodyPart,
        view_projection: viewProjection,
        contrast,
        laterality,
        priority,
        technologist: technologist || "Radiology Technologist, AERB Certified",
        equipment,
        dose: radiationDose,
        clinical_indication: clinicalIndication,
        technique,
        findings,
        impression,
        radiologist_name: radiologistName,
        verified_at: new Date().toISOString(),
        images,
        hospital_name: brandName,
      },
      language,
      hospitalBranding
    );
  };

  // Complete & Route Back to Referring Doctor
  const handleCompleteAndRouteToDoctor = async () => {
    if (!activeServingTicket) return;
    if (!findings.trim() || !impression.trim()) {
      showToast(isHi ? "कृपया पहले निष्कर्ष (Findings) और इंप्रेशन दर्ज करें" : "Please provide diagnostic findings and impression first", "warn");
      return;
    }

    try {
      const reportPayload = buildReportPayload();
      reportPayload.status = "Final";

      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        radiology_report: reportPayload,
      };

      await fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          prescription: mergedNotes,
        }),
      });

      const targetDept = parsedDoctorRx?.doctor_department || activeServingTicket.transferred_from_dept || "general";
      const targetDoctorId = parsedDoctorRx?.doctor_id || activeServingTicket.transferred_from_doctor_id || null;

      const res = await fetch(`${API_BASE}/api/v1/plugin/transfer-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          target_department: targetDept,
          target_doctor_id: targetDoctorId,
          transfer_reason: `Radiology study completed (${modality} - ${bodyPart}). Routing back to doctor with findings.`,
        }),
      });

      if (res.ok) {
        if (socketRef && socketRef.current) {
          socketRef.current.emit("ticket_transferred", {
            tenant_id: effectiveHospitalCode,
            ticket_id: activeServingTicket.ticket_id,
            target_department: targetDept,
          });
        }

        showToast(
          isHi
            ? `जांच पूर्ण! टोकन #${activeServingTicket.ticket_id} को डॉ. ${parsedDoctorRx?.doctor_name || "OPD"} को भेजा गया ✓`
            : `Scan completed! Token #${activeServingTicket.ticket_id} routed back to ${parsedDoctorRx?.doctor_name || "Referring Doctor"} ✓`,
          "success"
        );
        setSelectedServingTicket(null);
        if (refreshData) refreshData();
      } else {
        throw new Error("Transfer failed");
      }
    } catch (e) {
      showToast(isHi ? "ट्रांसफर में त्रुटि" : "Error routing report to doctor", "error");
    }
  };

  // Complete & Discharge
  const handleCompleteAndDischarge = async () => {
    if (!activeServingTicket) return;
    if (!findings.trim() || !impression.trim()) {
      showToast(isHi ? "कृपया पहले निष्कर्ष और इंप्रेशन दर्ज करें" : "Please provide diagnostic findings and impression first", "warn");
      return;
    }

    try {
      const reportPayload = buildReportPayload();
      reportPayload.status = "Final";

      const mergedNotes = {
        ...(parsedDoctorRx || {}),
        radiology_report: reportPayload,
      };

      await fetch(`${API_BASE}/api/v1/plugin/save-prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          prescription: mergedNotes,
        }),
      });

      if (socketRef && socketRef.current) {
        socketRef.current.emit("complete_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: activeServingTicket.ticket_id,
          doctor_name: radiologistName,
        });
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            ticket_id: activeServingTicket.ticket_id,
          }),
        });
      }

      showToast(
        isHi
          ? `इमेजिंग पूर्ण एवं टोकन #${activeServingTicket.ticket_id} डिस्चार्ज किया गया ✓`
          : `Imaging study verified & Token #${activeServingTicket.ticket_id} discharged ✓`,
        "success"
      );
      setSelectedServingTicket(null);
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? "डिस्चार्ज में त्रुटि" : "Error completing ticket", "error");
    }
  };

  // Historical Records & Date Filtering
  const [historyFilter, setHistoryFilter] = useState("today"); // "today" | "yesterday" | "date" | "all"
  const [customFilterDate, setCustomFilterDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchRadiologyHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      // First try patient-history endpoint
      const res = await fetch(`${API_BASE}/api/v1/patient-history?hospital_id=${effectiveHospitalCode}`);
      const data = await res.json();
      if (data && Array.isArray(data.visits)) {
        setHistoryList(data.visits);
      } else {
        // Fallback to queue history
        const qRes = await fetch(`${API_BASE}/api/v1/plugin/queue/${effectiveHospitalCode}/history`);
        const qData = await qRes.json();
        const raw = qData?.history || qData?.data || [];
        setHistoryList(raw);
      }
    } catch (e) {
      console.warn("History fetch error:", e);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [effectiveHospitalCode]);

  useEffect(() => {
    if (activeTab === "history" || activeTab === "archive") {
      fetchRadiologyHistory();
    }
  }, [activeTab, fetchRadiologyHistory]);

  const filteredHistory = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = yestDate.toISOString().split("T")[0];

    return historyList.filter((item) => {
      const itemDate = item.queue_date || (item.created_at ? item.created_at.split("T")[0] : "");
      if (historyFilter === "today" && itemDate && itemDate !== todayStr) return false;
      if (historyFilter === "yesterday" && itemDate && itemDate !== yestStr) return false;
      if (historyFilter === "date" && itemDate && itemDate !== customFilterDate) return false;

      if (archiveSearch.trim()) {
        const q = archiveSearch.toLowerCase();
        const nameMatch = String(item.patient_name || item.name || "").toLowerCase().includes(q);
        const tIdMatch = String(item.ticket_id || "").toLowerCase().includes(q);
        const condMatch = String(item.medical_condition || item.service_category || "").toLowerCase().includes(q);
        const phoneMatch = String(item.phone || "").toLowerCase().includes(q);
        if (!nameMatch && !tIdMatch && !condMatch && !phoneMatch) return false;
      }
      return true;
    });
  }, [historyList, historyFilter, customFilterDate, archiveSearch]);

  // Excel Export using XLSX
  const handleExportExcel = () => {
    if (filteredHistory.length === 0) {
      showToast(isHi ? "निर्यात करने हेतु कोई डेटा उपलब्ध नहीं" : "No records to export", "warn");
      return;
    }

    const rows = filteredHistory.map((item, idx) => {
      let imp = "";
      let mod = "Radiology";
      try {
        const p = typeof item.prescription_notes === "object" ? item.prescription_notes : JSON.parse(item.prescription_notes);
        if (p?.radiology_report) {
          imp = (p.radiology_report.impression || "").replace(/[\r\n]+/g, " ");
          mod = p.radiology_report.modality || "Radiology";
        }
      } catch (_) { }

      return {
        "S.No": idx + 1,
        "Date": item.queue_date || (item.created_at ? new Date(item.created_at).toLocaleDateString() : ""),
        "Token ID": item.ticket_id || "",
        "Patient Name": item.patient_name || item.name || "",
        "Age / Gender": `${item.age || 30} / ${item.gender || "M"}`,
        "Modality": mod,
        "Impression": imp || item.medical_condition || item.service_category || "Completed",
        "Status": item.status || "Completed",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Radiology_Records");
    XLSX.writeFile(wb, `Radiology_Records_${historyFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(isHi ? "एक्सेल स्प्रेडशीट डाउनलोड हो गई ✓" : "Excel spreadsheet exported successfully ✓", "success");
  };

  return (
    <div
      className="radiology-portal-wrapper"
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "0 0 12px 0",
        background: pageBg,
        color: textColor,
        transition: "all 0.25s ease",
        "--rad-card-bg": cardBg,
        "--rad-card-border": isDark ? "#1E293B" : "#E2E8F0",
        "--rad-card-text": textColor,
      }}
    >
      {/* Embedded CSS Style Rules matching Pathology & Doctor Portals */}
      <style>{`
        .radiology-portal-wrapper * {
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .radiology-portal-wrapper .user-dashboard-footer {
          margin-top: 16px !important;
          margin-bottom: 0px !important;
          padding-top: 16px !important;
          padding-bottom: 16px !important;
        }

        /* Executive Dark-Navy Clinical Hero Container */
        .radiology-hero-container {
          background: radial-gradient(circle at 10% 15%, rgba(2, 132, 199, 0.28) 0%, transparent 45%),
                      radial-gradient(circle at 90% 85%, rgba(56, 189, 248, 0.18) 0%, transparent 50%),
                      linear-gradient(135deg, #090F1E 0%, #0F172A 60%, #162447 100%);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 20px;
          padding: 20px 24px;
          color: #FFFFFF;
          box-shadow: 0 16px 36px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(56, 189, 248, 0.18);
          margin-bottom: 16px;
          position: relative;
          overflow: hidden;
        }

        .radiology-hero-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding-top: 12px;
        }

        @media (max-width: 960px) {
          .radiology-hero-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }

        @media (max-width: 540px) {
          .radiology-hero-kpi-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }

        .radiology-kpi-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          padding: 10px 14px;
        }

        .radiology-tabs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        @media (max-width: 920px) {
          .radiology-tabs-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }

        .tab-button-modern {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          min-height: 58px;
          box-sizing: border-box;
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          user-select: none;
          outline: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tab-button-modern.active {
          background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
          border: 1px solid #0284C7;
          color: #FFFFFF;
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.28);
        }

        .tab-button-modern.inactive {
          background: var(--rad-card-bg, #FFFFFF);
          border: 1px solid var(--rad-card-border, #E2E8F0);
          color: var(--rad-card-text, #0F172A);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        .tab-button-modern.inactive:hover {
          border-color: #38BDF8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.1);
        }

        .tab-icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tab-button-modern.active .tab-icon-wrapper {
          background: rgba(255, 255, 255, 0.2);
          color: #BAE6FD;
        }

        .tab-button-modern.inactive .tab-icon-wrapper {
          background: #F0F9FF;
          color: #0284C7;
        }

        body.theme-dark .tab-button-modern.inactive,
        [data-theme="dark"] .tab-button-modern.inactive {
          background: #0F172A !important;
          border-color: #1E293B !important;
          color: #F8FAFC !important;
        }

        body.theme-dark .tab-button-modern.inactive .tab-icon-wrapper,
        [data-theme="dark"] .tab-button-modern.inactive .tab-icon-wrapper {
          background: rgba(2, 132, 199, 0.2) !important;
          color: #38BDF8 !important;
        }

        .tab-title-text {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -0.2px;
          line-height: 1.2;
        }

        .tab-sub-text {
          font-size: 10.5px;
          font-weight: 600;
          display: block;
          margin-top: 1px;
          opacity: 0.85;
        }

        .tab-count-badge {
          font-size: 10.5px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        /* Responsive Workstation 2-Column Grid */
        .radiology-workstation-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 16px;
          width: 100%;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .radiology-workstation-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spinSlow 0.9s linear infinite;
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 20px",
            borderRadius: "14px",
            background:
              toast.type === "error"
                ? "#EF4444"
                : toast.type === "warn"
                  ? "#F59E0B"
                  : toast.type === "info"
                    ? brandPrimary
                    : "#10B981",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "13px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: "8px", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Full-Screen Image / DICOM Viewer Modal */}
      {viewerImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.88)",
            zIndex: 999999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1100px",
              background: "#090D16",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.15)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              height: "90vh",
            }}
          >
            {/* Viewer Header */}
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#0F172A",
              }}
            >
              <div>
                <strong style={{ color: "#F8FAFC", fontSize: "14px" }}>{viewerImage.name}</strong>
                <span style={{ fontSize: "11px", color: "#94A3B8", marginLeft: "10px" }}>
                  {viewerImage.type === "dicom" ? "DICOM Radiograph" : "Acquired Medical Scan"} • Zoom: {Math.round(viewerZoom * 100)}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewerImage(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  fontSize: "20px",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Viewer Toolbar */}
            <div
              style={{
                padding: "8px 18px",
                background: "#1E293B",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                fontSize: "12px",
                flexWrap: "wrap",
                color: "#E2E8F0",
              }}
            >
              <button
                type="button"
                onClick={() => setViewerZoom((z) => Math.min(z + 0.25, 4))}
                style={{ padding: "4px 10px", borderRadius: "6px", background: "#334155", color: "#fff", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <ZoomIn size={13} /> Zoom In
              </button>
              <button
                type="button"
                onClick={() => setViewerZoom((z) => Math.max(z - 0.25, 0.5))}
                style={{ padding: "4px 10px", borderRadius: "6px", background: "#334155", color: "#fff", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <ZoomOut size={13} /> Zoom Out
              </button>
              <button
                type="button"
                onClick={() => setViewerRotation((r) => (r + 90) % 360)}
                style={{ padding: "4px 10px", borderRadius: "6px", background: "#334155", color: "#fff", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <RotateCw size={13} /> Rotate 90°
              </button>
              <button
                type="button"
                onClick={() => setViewerInvert((v) => !v)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: viewerInvert ? "#0284C7" : "#334155",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ◑ Invert (Negative)
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>Contrast:</span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={viewerContrast}
                  onChange={(e) => setViewerContrast(Number(e.target.value))}
                  style={{ width: "80px", cursor: "pointer" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>Brightness:</span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={viewerBrightness}
                  onChange={(e) => setViewerBrightness(Number(e.target.value))}
                  style={{ width: "80px", cursor: "pointer" }}
                />
              </div>

              <button
                type="button"
                onClick={resetViewerControls}
                style={{ padding: "4px 10px", borderRadius: "6px", background: "#475569", color: "#fff", border: "none", cursor: "pointer", marginLeft: "auto" }}
              >
                Reset Controls
              </button>
            </div>

            {/* Viewer Display Surface */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#000000",
                padding: "20px",
              }}
            >
              <img
                src={viewerImage.url}
                alt={viewerImage.name}
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  transform: `scale(${viewerZoom}) rotate(${viewerRotation}deg)`,
                  filter: `${viewerInvert ? "invert(1) " : ""}contrast(${viewerContrast}%) brightness(${viewerBrightness}%)`,
                  transition: "transform 0.15s ease",
                  userSelect: "none",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 1. EXECUTIVE CLINICAL HERO CONTAINER */}
      <div className="radiology-hero-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,0.14)", padding: "3px 8px", borderRadius: "6px", fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Building2 size={12} />
                <span>{brandName.toUpperCase()}</span>
              </span>
              <span style={{ background: "rgba(56, 189, 248, 0.2)", border: "1px solid rgba(56, 189, 248, 0.4)", color: "#BAE6FD", padding: "3px 8px", borderRadius: "6px", fontSize: "10.5px", fontWeight: 800 }}>
                {isHi ? "AERB एवं NABH मान्यता प्राप्त डिजिटल रेडियोलॉजी व इमेजिंग सेंटर" : "AERB & NABH ACCREDITED DIGITAL RADIOLOGY & IMAGING CENTER"}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 900, letterSpacing: "-0.4px", lineHeight: "1.2" }}>
              {isHi ? "रेडियोलॉजी एवं एक्स-रे इमेजिंग पोर्टल" : "Radiology & Diagnostic Imaging Portal"}
            </h1>

            {/* Highlighted Staff & Department One-Liner Glass Capsule */}
            <div
              style={{
                marginTop: "8px",
                display: "inline-flex",
                alignItems: "center",
                flexWrap: "nowrap",
                gap: "8px",
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.6) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.45)",
                borderRadius: "30px",
                padding: "3px 10px 3px 5px",
                backdropFilter: "blur(12px)",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.25)",
                maxWidth: "100%",
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.4)",
                  flexShrink: 0,
                }}
              >
                <Scan size={12} />
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "रेडियोलॉजिस्ट:" : "Radiologist:"}
                </span>
                <span style={{ fontSize: "12.5px", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.2px" }}>
                  {currentUser?.name || currentUser?.username || radiologistName}
                </span>
              </div>

              <span style={{ width: "1px", height: "12px", background: "rgba(255, 255, 255, 0.2)", margin: "0 1px" }} />

              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#34D399",
                    boxShadow: "0 0 6px #10B981",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "विभाग:" : "Dept:"}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#34D399", letterSpacing: "0.3px" }}>
                  {(currentUser?.department || "RADIOLOGY & IMAGING").toUpperCase()}
                </span>
              </div>

              {(currentUser?.employee_code || currentUser?.employee_id || currentUser?.id) && (
                <>
                  <span style={{ width: "1px", height: "12px", background: "rgba(255, 255, 255, 0.2)", margin: "0 1px" }} />
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "rgba(255, 255, 255, 0.75)",
                      fontFamily: "monospace",
                      background: "rgba(255, 255, 255, 0.08)",
                      padding: "1px 5px",
                      borderRadius: "4px",
                    }}
                  >
                    ID: {currentUser?.employee_code || currentUser?.employee_id || currentUser?.id}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Assigned Counter & Duty Status Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* Assigned Desk Display */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: assignedDesk
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(245, 158, 11, 0.14)",
                border: assignedDesk
                  ? "1px solid rgba(255, 255, 255, 0.25)"
                  : "1px solid rgba(245, 158, 11, 0.4)",
                borderRadius: "10px",
                padding: "6px 12px",
                backdropFilter: "blur(8px)",
                color: "#FFFFFF",
                userSelect: "none",
              }}
              title={
                assignedDesk
                  ? (isHi ? `सुपरएडमिन द्वारा आवंटित डेस्क: ${assignedDesk.desk_name}` : `Assigned Desk: ${assignedDesk.desk_name}`)
                  : (isHi ? "सुपरएडमिन पोर्टल द्वारा कोई डेस्क आवंटित नहीं है" : "No desk assigned in SuperAdmin portal")
              }
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: assignedDesk ? "#38BDF8" : "#FBBF24",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                <Building2 size={11} />
                {isHi ? "डेस्क:" : "DESK:"}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 900,
                  color: assignedDesk ? "#FFFFFF" : "#FDE68A",
                  letterSpacing: "0.3px",
                }}
              >
                {assignedDesk?.desk_name || (isHi ? "अनअसाइंड" : "Unassigned")}
              </span>
            </div>

            {/* Interactive Duty Status Dropdown */}
            <div style={{ position: "relative" }} ref={dutyDropdownRef}>
              <button
                type="button"
                onClick={() => setShowDutyDropdown((prev) => !prev)}
                style={{
                  background:
                    dutyStatus === "ACTIVE"
                      ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                      : dutyStatus === "PROCESSING"
                        ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                        : dutyStatus === "BREAK"
                          ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                          : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow:
                    dutyStatus === "ACTIVE"
                      ? "0 4px 14px rgba(16, 185, 129, 0.35)"
                      : dutyStatus === "PROCESSING"
                        ? "0 4px 14px rgba(2, 132, 199, 0.35)"
                        : dutyStatus === "BREAK"
                          ? "0 4px 14px rgba(245, 158, 11, 0.35)"
                          : "0 4px 14px rgba(239, 68, 68, 0.35)",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FFFFFF", display: "inline-block" }} />
                <span>
                  {dutyStatus === "ACTIVE"
                    ? (isHi ? "स्कैन हेतु तैयार" : "Ready to Scan")
                    : dutyStatus === "PROCESSING"
                      ? (isHi ? "इमेज प्रोसेसिंग" : "Processing")
                      : dutyStatus === "BREAK"
                        ? (isHi ? "अवकाश पर" : "On Break")
                        : (isHi ? "ड्यूटी समाप्त" : "Off Duty")}
                </span>
                <span style={{ fontSize: "9px", opacity: 0.85, marginLeft: "2px" }}>▼</span>
              </button>

              {showDutyDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.18)" : "1px solid #CBD5E1",
                    borderRadius: "12px",
                    padding: "4px",
                    boxShadow: isDark
                      ? "0 16px 36px -4px rgba(0, 0, 0, 0.7), 0 8px 16px rgba(2, 132, 199, 0.2)"
                      : "0 16px 36px -4px rgba(0, 0, 0, 0.2), 0 8px 16px rgba(2, 132, 199, 0.12)",
                    minWidth: "230px",
                    zIndex: 9999,
                  }}
                >
                  {dutyStatusOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleUpdateDutyStatus(opt.id)}
                      style={{
                        background: dutyStatus === opt.id ? opt.bg : "transparent",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                    >
                      <span style={{ fontSize: "13px" }}>{opt.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11.5px", fontWeight: 800, color: opt.color }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: "9.5px", color: isDark ? "#94A3B8" : "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {opt.desc}
                        </div>
                      </div>
                      {dutyStatus === opt.id && (
                        <span style={{ color: opt.color, fontSize: "11px", fontWeight: 900 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Metrics Grid (Glassmorphic Telemetry Cards) */}
        <div className="radiology-hero-kpi-grid">
          <div className="radiology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "कतार में प्रतीक्षारत" : "Waiting in Imaging Queue"}
              </div>
              <Clock size={15} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              {radiologyQueue.length}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {isHi ? "स्कैन हेतु प्रतीक्षारत मरीज़" : "Patients waiting for imaging"}
            </div>
          </div>

          <div className="radiology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "सक्रिय स्कैन जारी" : "Active Scan / In-Exam"}
              </div>
              <Activity size={15} color="#38BDF8" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              {activeServingTicket
                ? `#${activeServingTicket.ticket_id}`
                : dutyStatus === "OFF_DUTY"
                  ? (isHi ? "ड्यूटी समाप्त" : "Off Duty")
                  : dutyStatus === "BREAK"
                    ? (isHi ? "अवकाश" : "On Break")
                    : (isHi ? "तैयार" : "Ready")}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeServingTicket
                ? activeServingTicket.name
                : dutyStatus === "OFF_DUTY"
                  ? (isHi ? "काउंटर सेवा बंद है" : "Station offline")
                  : dutyStatus === "BREAK"
                    ? (isHi ? "अवकाश पर" : "Testing paused")
                    : assignedDesk?.desk_name
                      ? (isHi ? `${assignedDesk.desk_name} उपलब्ध` : `${assignedDesk.desk_name} ready`)
                      : (isHi ? "अनअसाइंड" : "Unassigned")}
            </div>
          </div>

          <div className="radiology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "आज सत्यापित रिपोर्ट" : "Reported Today"}
              </div>
              <CheckCircle2 size={15} color="#34D399" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              {historyList.length || 0}
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {isHi ? "सत्यापित इमेजिंग अध्ययन" : "Verified Diagnostic Studies"}
            </div>
          </div>

          <div className="radiology-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", color: "#BAE6FD" }}>
                {isHi ? "औसत टर्नअराउंड समय" : "Avg. Turnaround"}
              </div>
              <Sliders size={15} color="#FBBF24" />
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, marginTop: "2px", lineHeight: "1.2" }}>
              ~14.5 min
            </div>
            <div style={{ fontSize: "10.5px", opacity: 0.8, marginTop: "1px" }}>
              {isHi ? "स्कैन से रिपोर्ट सत्यापन" : "Scan to report sign-off"}
            </div>
          </div>
        </div>
      </div>

      {/* Duty Status Alert Banner when On Break or Shift Ended */}
      {dutyStatus !== "ACTIVE" && (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            borderRadius: "12px",
            background:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2")
                : (isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB"),
            border:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA")
                : (isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #FDE68A"),
            color:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "#FCA5A5" : "#B91C1C")
                : (isDark ? "#FDE68A" : "#B45309"),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              {dutyStatus === "OFF_DUTY" ? <Clock size={14} /> : <Coffee size={14} />}
            </span>
            <span>
              {dutyStatus === "OFF_DUTY"
                ? (isHi ? "ड्यूटी समाप्त: रेडियोलॉजी काउंटर आज के लिए बंद है। मरीज़ कॉलिंग रुकी है।" : "Shift Ended: Radiology workstation is closed. Patient calling is paused.")
                : dutyStatus === "PROCESSING"
                  ? (isHi ? "इमेजिंग जारी: स्कैनर और इमेज प्रोसेसिंग प्रगति पर हैं।" : "Processing: Scanner runs and DICOM reconstructions are in progress.")
                  : (isHi ? "अवकाश पर: काउंटर कॉलिंग अस्थायी रूप से रुकी है।" : "On Break: Examination & calling is temporarily paused.")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleUpdateDutyStatus("ACTIVE")}
            style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "5px 12px",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.35)",
            }}
          >
            <span>✓</span>
            <span>{isHi ? "ड्यूटी पुनः शुरू करें" : "Resume Active Duty"}</span>
          </button>
        </div>
      )}

      {/* Modern 3-Tab Segmented Switcher matching Pathology & Doctor Portals */}
      <div className="radiology-tabs-grid">
        <button
          type="button"
          onClick={() => setActiveTab("workstation")}
          className={`tab-button-modern ${activeTab === "workstation" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <Scan size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "इमेजिंग वर्कस्टेशन" : "Imaging Workstation"}</div>
            <span className="tab-sub-text">{isHi ? "सक्रिय स्कैन व लाइव कतार" : "Active Scan & Live Queue"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "workstation" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
              color: activeTab === "workstation" ? "#FFFFFF" : "#0284C7",
            }}
          >
            {radiologyQueue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("archive")}
          className={`tab-button-modern ${activeTab === "archive" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <FileText size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "रेडियोलॉजी रिपोर्ट संग्रह" : "Radiology Reports Archive"}</div>
            <span className="tab-sub-text">{isHi ? "सत्यापित रिपोर्ट खोज व प्रिंट" : "Search & Reprint Reports"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "archive" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"),
              color: activeTab === "archive" ? "#FFFFFF" : "#0284C7",
            }}
          >
            {historyList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`tab-button-modern ${activeTab === "history" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <History size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "मरीज़ इमेजिंग इतिहास" : "Patient Imaging History"}</div>
            <span className="tab-sub-text">{isHi ? "दिनांक वार ऑडिट व एक्सेल" : "Date Filtering & Excel Export"}</span>
          </div>
          <span
            className="tab-count-badge"
            style={{
              background: activeTab === "history" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(16, 185, 129, 0.25)" : "#ECFDF5"),
              color: activeTab === "history" ? "#FFFFFF" : "#059669",
            }}
          >
            {filteredHistory.length}
          </span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: IMAGING WORKSTATION (ACTIVE SCAN & REPORTING)
         ======================================================== */}
      {activeTab === "workstation" && (
        <div className="radiology-workstation-grid">
          {/* Main Left Execution Workspace */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0, width: "100%" }}>
            {activeServingTicket ? (
              <div
                style={{
                  background: "var(--rad-card-bg, #FFFFFF)",
                  border: isDark ? "1.5px solid rgba(56, 189, 248, 0.45)" : "1.5px solid #BAE6FD",
                  borderRadius: "16px",
                  padding: "16px 18px",
                  boxShadow: isDark ? "0 10px 30px rgba(0, 0, 0, 0.4)" : "0 8px 24px rgba(2, 132, 199, 0.06)",
                }}
              >
                {/* Active Patient Demographics Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "19px", fontWeight: 900, color: textColor, letterSpacing: "-0.3px" }}>
                        {activeServingTicket.name}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE",
                          color: "#0284C7",
                          fontFamily: "monospace",
                        }}
                      >
                        #{activeServingTicket.ticket_id}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          background: activeServingTicket.priority_level === 1 ? "#FEE2E2" : "#ECFDF5",
                          color: activeServingTicket.priority_level === 1 ? "#DC2626" : "#059669",
                          border: `1px solid ${activeServingTicket.priority_level === 1 ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                        }}
                      >
                        {activeServingTicket.priority_level === 1 ? "EMERGENCY PRIORITY" : "STANDARD"}
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                      {activeServingTicket.age || 30} {isHi ? "वर्ष" : "Yrs"} • {String(activeServingTicket.gender || "M").toUpperCase()} •{" "}
                      {activeServingTicket.phone || "N/A"}
                    </div>
                  </div>

                  {/* Desk Serving Action Controls */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={handleRecall}
                      style={{
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: isDark ? "#CBD5E1" : "#475569",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s ease",
                      }}
                      title="Re-broadcast announcement over loudspeaker"
                    >
                      <Volume2 size={13} color="#0284C7" />
                      <span>{isHi ? "पुनः उद्घोषणा (Recall)" : "Re-announce"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleHold}
                      style={{
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: "#D97706",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s ease",
                      }}
                      title="Hold patient for 10 minutes"
                    >
                      <Clock size={13} />
                      <span>{isHi ? "होल्ड (10 मिनट)" : "Hold (10m)"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNoShow}
                      style={{
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: "#DC2626",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        transition: "all 0.15s ease",
                      }}
                      title="Mark patient as No-Show"
                    >
                      <span>{isHi ? "अनुपस्थित" : "No-Show"}</span>
                    </button>
                  </div>
                </div>

                {/* Doctor Referral Context Box */}
                {parsedDoctorRx && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      background: isDark ? "#131D31" : "#F8FAFC",
                      border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                      <div>
                        <strong style={{ color: "#0284C7" }}>{isHi ? "परामर्शदाता डॉक्टर:" : "Referring Doctor:"}</strong>{" "}
                        {parsedDoctorRx.doctor_name || "OPD Doctor"} (
                        {parsedDoctorRx.doctor_department || activeServingTicket.transferred_from_dept || "General Medicine"})
                      </div>
                      <div>
                        <strong>{isHi ? "क्लिनिकल निदान:" : "Diagnosis:"}</strong> {parsedDoctorRx.diagnosis || "Clinical Assessment"}
                      </div>
                    </div>
                    {parsedDoctorRx.lab_tests && (
                      <div style={{ marginTop: "6px", color: isDark ? "#38BDF8" : "#0284C7", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                        <Scan size={14} />
                        <span>{isHi ? "डॉक्टर द्वारा निर्धारित इमेजिंग:" : "Prescribed Imaging Orders:"} {parsedDoctorRx.lab_tests}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Empty State */
              <div
                style={{
                  background: isDark ? "#0F172A" : "#FFFFFF",
                  border: isDark ? "1.5px dashed #334155" : "1.5px dashed #CBD5E1",
                  borderRadius: "16px",
                  padding: "26px 16px",
                  textAlign: "center",
                }}
              >
                <Scan size={36} style={{ color: "#0284C7", opacity: 0.6, margin: "0 auto 8px auto" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                  {isHi ? "वर्तमान में कोई सक्रिय इमेजिंग जांच चयनित नहीं है" : "No Active Imaging Patient Serving"}
                </h3>
                <p style={{ margin: "4px 0 14px 0", fontSize: "12.5px", color: mutedText }}>
                  {isHi
                    ? "कतार से अगले मरीज़ को बुलाने के लिए नीचे दिए गए बटन पर क्लिक करें।"
                    : "Click below to call the next patient from the radiology waiting stream."}
                </p>
                <button
                  type="button"
                  onClick={handleCallNext}
                  disabled={callingNext || radiologyQueue.length === 0}
                  style={{
                    background: radiologyQueue.length === 0 ? (isDark ? "#334155" : "#E2E8F0") : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    color: radiologyQueue.length === 0 ? (isDark ? "#94A3B8" : "#64748B") : "#FFFFFF",
                    border: "none",
                    padding: "9px 20px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: radiologyQueue.length === 0 || callingNext ? "not-allowed" : "pointer",
                    boxShadow: radiologyQueue.length === 0 ? "none" : "0 4px 14px rgba(2, 132, 199, 0.35)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Volume2 size={15} />
                  <span>
                    {callingNext
                      ? (isHi ? "बुलाया जा रहा है..." : "Calling...")
                      : (isHi ? "अगला मरीज़ बुलाएं (Call Next)" : "Call Next Patient to Station")}
                  </span>
                </button>
              </div>
            )}

            {/* Active Examination & Report Entry Card */}
            {activeServingTicket && (
              <div
                style={{
                  background: "var(--rad-card-bg, #FFFFFF)",
                  border: "var(--rad-card-border, #E2E8F0)",
                  borderRadius: "16px",
                  padding: "16px 18px",
                  boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                {/* Pregnancy Safety Warning for Females of Reproductive Age */}
                {showPregnancyWarning && (
                  <div
                    style={{
                      background: pregnancyConfirmed ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                      border: pregnancyConfirmed ? "1px solid #10B981" : "1.5px solid #EF4444",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>{pregnancyConfirmed ? "✅" : "⚠️"}</span>
                    <div style={{ flex: 1, fontSize: "11.5px" }}>
                      <strong style={{ color: pregnancyConfirmed ? "#059669" : "#DC2626" }}>
                        {isHi ? "AERB / ACR विकिरण सुरक्षा सत्यापन (Radiation Safety Check)" : "AERB & ACR Radiation Safety Verification Required"}
                      </strong>
                      <div style={{ color: mutedText, marginTop: "2px" }}>
                        {isHi
                          ? "रोगी 12-55 वर्ष की महिला हैं और यह एक आयनकारी विकिरण जांच (X-Ray/CT) है। गैर-गर्भावस्था की पुष्टि अनिवार्य है।"
                          : "Female patient of reproductive age undergoing ionizing radiation exam. Verify patient is non-pregnant before proceeding."}
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={pregnancyConfirmed}
                        onChange={(e) => setPregnancyConfirmed(e.target.checked)}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />
                      <span>Confirmed Non-Pregnant</span>
                    </label>
                  </div>
                )}

                {/* Normal Template Fillers Strip */}
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: mutedText, marginBottom: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <Sparkles size={13} color="#0284C7" />
                    <span>{isHi ? "त्वरित सामान्य टेम्पलेट्स (Quick Normal Templates):" : "Quick Normal Templates:"}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {Object.keys(NORMAL_TEMPLATES).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyNormalTemplate(key)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: isDark ? "#1E293B" : "#F8FAFC",
                          border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                          color: textColor,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span>⚡</span>
                        <span>{NORMAL_TEMPLATES[key].title}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Study & Exposure Parameters Grid */}
                <div
                  style={{
                    background: isDark ? "#111827" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #E2E8F0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    marginBottom: "14px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Modality *
                    </label>
                    <select
                      value={modality}
                      onChange={(e) => setModality(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    >
                      {MODALITY_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Body Part / Region *
                    </label>
                    <select
                      value={bodyPart}
                      onChange={(e) => setBodyPart(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    >
                      {BODY_PARTS.map((bp) => (
                        <option key={bp} value={bp}>{bp}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      View / Projection
                    </label>
                    <select
                      value={viewProjection}
                      onChange={(e) => setViewProjection(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    >
                      {VIEWS_PROJECTIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Contrast Protocol
                    </label>
                    <select
                      value={contrast}
                      onChange={(e) => setContrast(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    >
                      {CONTRAST_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Laterality
                    </label>
                    <select
                      value={laterality}
                      onChange={(e) => setLaterality(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    >
                      {LATERALITY_OPTIONS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Study Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Technologist & Suite Audit */}
                <div
                  style={{
                    background: isDark ? "#111827" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #E2E8F0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    marginBottom: "14px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Radiology Technologist
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Anil Kumar, R.T. (R)"
                      value={technologist}
                      onChange={(e) => setTechnologist(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Equipment / Imaging Suite
                    </label>
                    <input
                      type="text"
                      value={equipment}
                      onChange={(e) => setEquipment(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Radiation Dose (mGy / DAP / DLP)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0.08 mGy (Optional)"
                      value={radiationDose}
                      onChange={(e) => setRadiationDose(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "10.5px", fontWeight: 700, color: mutedText, display: "block", marginBottom: "4px" }}>
                      Exam Timestamp
                    </label>
                    <input
                      type="datetime-local"
                      value={examTime}
                      onChange={(e) => setExamTime(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: "8px", fontSize: "11.5px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    />
                  </div>
                </div>

                {/* Digital Scans & DICOM Multi-Image Upload Zone */}
                <div
                  style={{
                    background: isDark ? "#111827" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #E2E8F0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    marginBottom: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "12px", color: textColor, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Camera size={14} color="#0284C7" />
                        <span>{isHi ? "प्राप्त स्कैन एवं डिजिटल इमेज (JPG, PNG, DICOM)" : "Acquired Scans & Digital Images (JPG, PNG, DICOM)"}</span>
                      </strong>
                      <span style={{ fontSize: "10.5px", color: mutedText, marginLeft: "8px" }}>
                        Max 10 MB per image, 50 MB per DICOM. Stored per patient ticket.
                      </span>
                    </div>
                    <label
                      style={{
                        padding: "5px 12px",
                        borderRadius: "8px",
                        background: isUploading ? "#94A3B8" : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                        color: "#fff",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: isUploading ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
                      }}
                    >
                      <Plus size={13} />
                      <span>{isUploading ? "Uploading..." : "+ Upload Scans"}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,.dcm,.dicom"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>

                  {images.length === 0 ? (
                    <div style={{ fontSize: "11px", color: mutedText, textAlign: "center", padding: "8px" }}>
                      No scan images attached yet. Click "+ Upload Scans" to attach DICOM / Radiograph files.
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: "relative",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            overflow: "hidden",
                            width: "90px",
                            height: "90px",
                            background: "#000",
                            cursor: "pointer",
                          }}
                          onClick={() => openViewer(img)}
                          title="Click to view full screen"
                        >
                          <img
                            src={img.url}
                            alt={img.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              background: "rgba(0,0,0,0.75)",
                              color: "#fff",
                              fontSize: "9px",
                              padding: "2px 4px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {img.name}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(idx);
                            }}
                            style={{
                              position: "absolute",
                              top: "2px",
                              right: "2px",
                              background: "rgba(239, 68, 68, 0.9)",
                              color: "#fff",
                              border: "none",
                              borderRadius: "50%",
                              width: "16px",
                              height: "16px",
                              fontSize: "10px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4 Structured Diagnostic Textareas */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      1. Clinical Indication (Reason for Examination)
                    </label>
                    <textarea
                      rows={2}
                      value={clinicalIndication}
                      onChange={(e) => setClinicalIndication(e.target.value)}
                      placeholder="e.g. Chronic cough, evaluation of trauma / acute pain / ruling out consolidation..."
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", fontSize: "12px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      2. Technique & Protocol
                    </label>
                    <textarea
                      rows={2}
                      value={technique}
                      onChange={(e) => setTechnique(e.target.value)}
                      placeholder="e.g. Standard high-kV digital posteroanterior erect chest radiograph obtained at full inspiration..."
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", fontSize: "12px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      3. Findings (Observations) *
                    </label>
                    <textarea
                      rows={5}
                      value={findings}
                      onChange={(e) => setFindings(e.target.value)}
                      placeholder="Detailed anatomical observations, lung fields, cardiac silhouette, viscera, bones..."
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", fontSize: "12px", border: isDark ? "1px solid #334155" : "1px solid #CBD5E1", background: isDark ? "#1E293B" : "#FFFFFF", color: textColor }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      4. Impression (Final Diagnostic Conclusion) *
                    </label>
                    <textarea
                      rows={2}
                      value={impression}
                      onChange={(e) => setImpression(e.target.value)}
                      placeholder="e.g. Normal chest radiograph. No evidence of active cardiopulmonary disease."
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, border: "1.5px solid #0284C7", background: isDark ? "#1E293B" : "#F0F9FF", color: textColor }}
                    />
                  </div>
                </div>

                {/* Report Status Selector */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", padding: "10px 14px", background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC", borderRadius: "10px", border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: mutedText }}>
                    Report Status:
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["Draft", "Preliminary", "Final"].map((st) => (
                      <label key={st} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="radReportStatus"
                          value={st}
                          checked={reportStatus === st}
                          onChange={(e) => setReportStatus(e.target.value)}
                        />
                        <span>{st === "Final" ? "Final (Verified)" : st}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    paddingTop: "16px",
                    borderTop: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleSaveReportDraft}
                      style={{
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: textColor,
                        padding: "8px 14px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <FileCheck size={14} style={{ color: "#0284C7" }} />
                      <span>{isHi ? "ड्राफ्ट सहेजें" : "Save Draft"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintReport}
                      style={{
                        background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                        border: "1.5px solid #0284C7",
                        color: "#0284C7",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Printer size={14} />
                      <span>{isHi ? "आधिकारिक रिपोर्ट प्रिंट करें" : "Print Official Report"}</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleCompleteAndRouteToDoctor}
                      style={{
                        background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Send size={14} />
                      <span>{isHi ? "पूर्ण करें एवं डॉक्टर को भेजें" : "Complete & Route to Doctor"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCompleteAndDischarge}
                      style={{
                        background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>{isHi ? "जांच पूर्ण एवं डिस्चार्ज" : "Complete & Discharge"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Imaging Queue */}
          <div>
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "16px",
                padding: "16px",
                position: "sticky",
                top: "16px",
                boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, display: "flex", alignItems: "center", gap: "7px" }}>
                  <Clock size={15} style={{ color: "#0284C7" }} />
                  <span>{isHi ? "लाइव इमेजिंग कतार" : "Live Imaging Queue"}</span>
                </h3>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                    color: "#0284C7",
                  }}
                >
                  {radiologyQueue.length} {isHi ? "मरीज़" : "Patients"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCallNext}
                disabled={callingNext || radiologyQueue.length === 0}
                style={{
                  width: "100%",
                  marginBottom: "10px",
                  background: radiologyQueue.length === 0 ? (isDark ? "#1E293B" : "#F1F5F9") : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  color: radiologyQueue.length === 0 ? (isDark ? "#64748B" : "#94A3B8") : "#FFFFFF",
                  border: radiologyQueue.length === 0 ? (isDark ? "1px solid #334155" : "1px solid #CBD5E1") : "none",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  fontWeight: 800,
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  cursor: radiologyQueue.length === 0 || callingNext ? "not-allowed" : "pointer",
                  opacity: callingNext ? 0.7 : 1,
                  boxShadow: radiologyQueue.length === 0 ? "none" : "0 3px 12px rgba(2, 132, 199, 0.25)",
                  transition: "all 0.15s ease",
                }}
              >
                <Volume2 size={14} />
                <span>
                  {callingNext
                    ? (isHi ? "पुकारा जा रहा है..." : "Calling...")
                    : (isHi ? "अगला मरीज़ बुलाएं" : "Call Next Patient")}
                </span>
              </button>

              {radiologyQueue.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 10px", color: mutedText }}>
                  <CheckCircle2 size={26} style={{ opacity: 0.5, margin: "0 auto 6px auto" }} />
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>
                    {isHi ? "कतार में कोई मरीज़ प्रतीक्षारत नहीं है" : "No patients waiting in imaging queue"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "560px", overflowY: "auto" }}>
                  {radiologyQueue.map((ticket) => {
                    const isServing = activeServingTicket && activeServingTicket.ticket_id === ticket.ticket_id;
                    return (
                      <div
                        key={ticket.ticket_id}
                        style={{
                          background: isServing
                            ? isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"
                            : isDark ? "#131D31" : "#F8FAFC",
                          border: isServing
                            ? "1.5px solid #0284C7"
                            : isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                          borderRadius: "12px",
                          padding: "10px 12px",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 800, color: textColor }}>
                                {ticket.name}
                              </span>
                              {ticket.priority_level === 1 && (
                                <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "4px", background: "#FEE2E2", color: "#DC2626" }}>
                                  EMERGENCY
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "11px", color: mutedText, marginTop: "2px" }}>
                              #{ticket.ticket_id} • {ticket.age || 30}y / {ticket.gender || "M"}
                            </div>
                            <div style={{ fontSize: "10.5px", color: isDark ? "#38BDF8" : "#0284C7", fontWeight: 700, marginTop: "2px" }}>
                              {ticket.medical_condition || ticket.service_category || "Radiology Exam"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCallSpecificPatient(ticket)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: isServing
                                ? (isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5")
                                : (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"),
                              border: isServing
                                ? "1px solid #10B981"
                                : "1px solid #0284C7",
                              color: isServing ? "#10B981" : "#0284C7",
                              fontSize: "10.5px",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            title={isServing ? "Re-announce active ticket" : "Call this patient to station"}
                          >
                            <Volume2 size={11} />
                            <span>{isServing ? (isHi ? "उद्घोषणा" : "Announce") : (isHi ? "बुलाएं" : "Call")}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: RADIOLOGY REPORTS ARCHIVE
         ======================================================== */}
      {activeTab === "archive" && (
        <div
          style={{
            background: "var(--rad-card-bg, #FFFFFF)",
            border: "var(--rad-card-border, #E2E8F0)",
            borderRadius: "16px",
            padding: "16px 18px",
            boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: textColor }}>
                {isHi ? "रेडियोलॉजी रिपोर्ट संग्रह" : "Radiology & Imaging Reports Archive"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: mutedText }}>
                {isHi ? "मरीज़ के नाम, टोकन नंबर या फ़ोन से रिपोर्ट खोजें एवं पुनः प्रिंट करें।" : "Lookup, verify and re-print historical patient radiology reports."}
              </p>
            </div>

            <div style={{ position: "relative", width: "260px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "9px", color: mutedText }} />
              <input
                type="text"
                placeholder={isHi ? "नाम, टोकन या फ़ोन खोजें..." : "Search name, token or phone..."}
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 12px 6px 32px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: isDark ? "#0F172A" : "#F8FAFC",
                  color: textColor,
                  fontSize: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#0284C7" }}>
              <RefreshCw size={22} className="spin-icon" style={{ margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "12.5px", fontWeight: 700 }}>{isHi ? "रिपोर्ट्स लोड हो रही हैं..." : "Loading reports..."}</div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: mutedText }}>
              <FileText size={36} style={{ opacity: 0.35, margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "कोई रिपोर्ट नहीं मिली" : "No radiology reports match your search criteria"}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "12px", border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F1F5F9", borderBottom: isDark ? "1.5px solid #1E293B" : "1.5px solid #E2E8F0" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "दिनांक" : "Date"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "टोकन #" : "Token #"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "मरीज़ का नाम" : "Patient Name"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "आयु/लिंग" : "Age/Sex"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "जांच / मोडैलिटी" : "Modality / Study"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "स्थिति" : "Status"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "कार्रवाई" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => {
                    let parsedRx = null;
                    try {
                      parsedRx = typeof item.prescription_notes === "object" ? item.prescription_notes : JSON.parse(item.prescription_notes);
                    } catch (_) { }
                    const radRep = parsedRx?.radiology_report;

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                        }}
                      >
                        <td style={{ padding: "6px 10px", color: mutedText }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recent"}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 800, color: "#0284C7", fontFamily: "monospace" }}>
                          #{item.ticket_id || "-"}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 700, color: textColor }}>
                          {item.patient_name || item.name || "Patient"}
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          {item.age || 30}y / {item.gender || "M"}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>
                          {radRep?.modality ? `${radRep.modality} - ${radRep.body_part}` : item.medical_condition || item.service_category || "Radiology"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              background: "#ECFDF5",
                              color: "#059669",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                            }}
                          >
                            VERIFIED
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              printRadiologyReportSlip(
                                {
                                  patient_name: item.patient_name || item.name,
                                  age: item.age || 30,
                                  gender: item.gender || "M",
                                  phone: item.phone || "",
                                  ticket_id: item.ticket_id,
                                  referring_doctor: parsedRx?.doctor_name || "Attending Physician",
                                  modality: radRep?.modality || "X-Ray",
                                  body_part: radRep?.body_part || "Chest",
                                  view_projection: radRep?.view || "PA View",
                                  contrast: radRep?.contrast || "None",
                                  laterality: radRep?.laterality || "N/A",
                                  priority: radRep?.priority || "Routine",
                                  technologist: radRep?.technologist || "Radiology Technologist",
                                  equipment: radRep?.equipment || "Diagnostic Imaging Unit",
                                  dose: radRep?.dose || "",
                                  clinical_indication: radRep?.clinical_indication || item.medical_condition || "Imaging investigation",
                                  technique: radRep?.technique || "Standard protocol",
                                  findings: radRep?.findings || "Normal study. No significant abnormality.",
                                  impression: radRep?.impression || "Unremarkable imaging examination.",
                                  radiologist_name: radRep?.radiologist_name || radiologistName,
                                  verified_at: radRep?.verified_at || new Date().toISOString(),
                                  images: radRep?.images || [],
                                  hospital_name: brandName,
                                },
                                language,
                                hospitalBranding
                              );
                            }}
                            style={{
                              background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                              border: "1px solid #0284C7",
                              color: "#0284C7",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <Printer size={12} />
                            <span>{isHi ? "प्रिंट" : "Print"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 3: PATIENT IMAGING HISTORY
         ======================================================== */}
      {activeTab === "history" && (
        <div
          style={{
            background: "var(--rad-card-bg, #FFFFFF)",
            border: "var(--rad-card-border, #E2E8F0)",
            borderRadius: "16px",
            padding: "16px 18px",
            boxShadow: isDark ? "0 8px 24px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: textColor }}>
                {isHi ? "मरीज़ इमेजिंग परीक्षण इतिहास" : "Patient Imaging Examination History"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: mutedText }}>
                {isHi ? "दिनांक अनुसार फ़िल्टर करें और इमेजिंग रिकॉर्ड्स एक्सेल में डाउनलोड करें।" : "Filter clinical records by date range and export to Excel spreadsheet."}
              </p>
            </div>

            {/* Date Filtering Pill Group */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setHistoryFilter("today")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyFilter === "today" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyFilter === "today" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyFilter === "today" ? "#0284C7" : mutedText,
                  transition: "all 0.15s ease",
                }}
              >
                {isHi ? "आज (Today)" : "Today"}
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter("yesterday")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyFilter === "yesterday" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyFilter === "yesterday" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyFilter === "yesterday" ? "#0284C7" : mutedText,
                  transition: "all 0.15s ease",
                }}
              >
                {isHi ? "कल (Yesterday)" : "Yesterday"}
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter("date")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyFilter === "date" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyFilter === "date" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyFilter === "date" ? "#0284C7" : mutedText,
                  transition: "all 0.15s ease",
                }}
              >
                {isHi ? "दिनांक चुनें" : "Select Date"}
              </button>

              {historyFilter === "date" && (
                <input
                  type="date"
                  value={customFilterDate}
                  onChange={(e) => setCustomFilterDate(e.target.value)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    color: textColor,
                    fontSize: "11.5px",
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => setHistoryFilter("all")}
                style={{
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  border: historyFilter === "all" ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                  background: historyFilter === "all" ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE") : "transparent",
                  color: historyFilter === "all" ? "#0284C7" : mutedText,
                  transition: "all 0.15s ease",
                }}
              >
                {isHi ? "सभी दिनांक" : "All Dates"}
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "10px",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  marginLeft: "4px",
                  boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)",
                  transition: "all 0.15s ease",
                }}
              >
                <Download size={14} />
                <span>{isHi ? "Excel निर्यात" : "Export Excel"}</span>
              </button>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: mutedText }}>
              <History size={36} style={{ opacity: 0.35, margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "इस तिथि का कोई रिकॉर्ड नहीं मिला" : "No imaging records found for the selected filter"}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "12px", border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F1F5F9", borderBottom: isDark ? "1.5px solid #1E293B" : "1.5px solid #E2E8F0" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>#</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "दिनांक व समय" : "Date & Time"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "टोकन #" : "Token #"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "मरीज़ का नाम" : "Patient Name"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "आयु/लिंग" : "Age/Sex"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "परीक्षण" : "Investigation"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "स्थिति" : "Status"}</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isDark ? "#94A3B8" : "#475569" }}>{isHi ? "कार्रवाई" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => {
                    let parsedRx = null;
                    try {
                      parsedRx = typeof item.prescription_notes === "object" ? item.prescription_notes : JSON.parse(item.prescription_notes);
                    } catch (_) { }
                    const radRep = parsedRx?.radiology_report;

                    return (
                      <tr key={idx} style={{ borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
                        <td style={{ padding: "6px 10px", color: mutedText }}>{idx + 1}</td>
                        <td style={{ padding: "6px 10px", color: mutedText }}>
                          {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 800, color: "#0284C7", fontFamily: "monospace" }}>
                          #{item.ticket_id || "-"}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 700, color: textColor }}>
                          {item.patient_name || item.name || "Patient"}
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          {item.age || 30}y / {item.gender || "M"}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>
                          {radRep?.modality ? `${radRep.modality} - ${radRep.body_part}` : item.medical_condition || item.service_category || "Radiology"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              background: "#ECFDF5",
                              color: "#059669",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                            }}
                          >
                            COMPLETED
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              printRadiologyReportSlip(
                                {
                                  patient_name: item.patient_name || item.name,
                                  age: item.age || 30,
                                  gender: item.gender || "M",
                                  phone: item.phone || "",
                                  ticket_id: item.ticket_id,
                                  referring_doctor: parsedRx?.doctor_name || "Attending Physician",
                                  modality: radRep?.modality || "X-Ray",
                                  body_part: radRep?.body_part || "Chest",
                                  view_projection: radRep?.view || "PA View",
                                  contrast: radRep?.contrast || "None",
                                  laterality: radRep?.laterality || "N/A",
                                  priority: radRep?.priority || "Routine",
                                  technologist: radRep?.technologist || "Radiology Technologist",
                                  equipment: radRep?.equipment || "Diagnostic Imaging Unit",
                                  dose: radRep?.dose || "",
                                  clinical_indication: radRep?.clinical_indication || item.medical_condition || "Imaging investigation",
                                  technique: radRep?.technique || "Standard protocol",
                                  findings: radRep?.findings || "Normal study. No significant abnormality.",
                                  impression: radRep?.impression || "Unremarkable imaging examination.",
                                  radiologist_name: radRep?.radiologist_name || radiologistName,
                                  verified_at: radRep?.verified_at || new Date().toISOString(),
                                  images: radRep?.images || [],
                                  hospital_name: brandName,
                                },
                                language,
                                hospitalBranding
                              );
                            }}
                            style={{
                              background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
                              border: "1px solid #0284C7",
                              color: "#0284C7",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <Printer size={12} />
                            <span>{isHi ? "प्रिंट" : "Print"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer matching standard portal layout */}
      <Footer language={language} hospitalBranding={hospitalBranding} theme={currentTheme} />
    </div>
  );
}
