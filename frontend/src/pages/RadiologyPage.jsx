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
import { printRadiologyReportSlip } from "../utils/printPassHelper";
import { getCategoryLabel } from "../utils/i18n";
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
  Play,
  UserX,
  Users,
  CalendarCheck,
  CheckSquare,
  Square,
  ArrowUpDown,
  Filter,
  Pause,
  XCircle,
  X,
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
  handleRecallTicket = null,
  handleMarkNoShow = null,
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
  const pageBg = isDark ? "#0F172A" : "#F8FAFC";
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const cardBorder = isDark ? "1px solid #1E293B" : "1px solid #E2E8F0";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const mutedText = isDark ? "#94A3B8" : "#64748B";

  // Tab State: "workstation" | "queue" | "history"
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
        color: "#0284C7",
        bg: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
        border: "#0284C7",
        icon: null,
      },
      {
        id: "PROCESSING",
        label: isHi ? "इमेजिंग जारी" : "Processing Scans",
        desc: isHi ? "स्कैनिंग या पुनर्निर्माण प्रगति पर है" : "Scanning / Reconstructing",
        color: "#0284C7",
        bg: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
        border: "#0284C7",
        icon: null,
      },
      {
        id: "BREAK",
        label: isHi ? "अवकाश पर" : "On Break",
        desc: isHi ? "अल्पकालिक अवकाश" : "Short Break / Calling Paused",
        color: "#64748B",
        bg: isDark ? "rgba(100, 116, 139, 0.15)" : "#F1F5F9",
        border: "#64748B",
        icon: null,
      },
      {
        id: "OFF_DUTY",
        label: isHi ? "ड्यूटी समाप्त" : "Off Duty / Closed",
        desc: isHi ? "स्टेशन आज के लिए बंद है" : "Shift Ended / Counter Offline",
        color: "#EF4444",
        bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
        border: "#EF4444",
        icon: null,
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
  // Live timer for 10-minute hold grace window countdown
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter Radiology & Diagnostic Imaging Queue (Waiting Patients)
  const radiologyQueue = useMemo(() => {
    if (!Array.isArray(queueSnapshot)) return [];
    return queueSnapshot.filter((t) => {
      const s = (t.status || "").toLowerCase();
      if (s === "on_hold" || s === "hold" || s === "serving" || s === "completed" || s === "cancelled" || s === "no_show") {
        return false;
      }

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

  // Combined Held Tickets List (from props and queue snapshot)
  const combinedHeldList = useMemo(() => {
    const list = Array.isArray(heldTickets) ? [...heldTickets] : [];
    if (Array.isArray(queueSnapshot)) {
      queueSnapshot.forEach((t) => {
        const s = (t.status || "").toLowerCase();
        if ((s === "on_hold" || s === "hold") && !list.some((h) => h.ticket_id === t.ticket_id)) {
          list.push(t);
        }
      });
    }
    return list;
  }, [heldTickets, queueSnapshot]);

  // Filter Radiology Held Tickets (10-minute grace period window)
  const radiologyHeldTickets = useMemo(() => {
    return combinedHeldList.filter((t) => {
      const dept = (t.department || t.department_name || "").toLowerCase();
      const cat = (t.service_category || "").toLowerCase();
      const med = (t.medical_condition || "").toLowerCase();
      const transFrom = (t.transferred_from_dept || "").toLowerCase();

      const isRad = (
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

      const isMyDesk = Boolean(
        (t.served_by_doctor_id && currentUser?.id && String(t.served_by_doctor_id) === String(currentUser?.id)) ||
        (t.previous_doctor_id && currentUser?.id && String(t.previous_doctor_id) === String(currentUser?.id)) ||
        (t.desk_id && (t.desk_id === selectedDesk?.id || t.desk_id === assignedDesk?.id)) ||
        (t.previous_desk_id && (t.previous_desk_id === selectedDesk?.id || t.previous_desk_id === assignedDesk?.id))
      );

      return isRad || isMyDesk;
    });
  }, [combinedHeldList, currentUser, selectedDesk, assignedDesk]);

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
  const [appliedTemplate, setAppliedTemplate] = useState(null); // tracks which quick template is applied

  // Route-to-Doctor department picker modal state
  const [showRouteDeptModal, setShowRouteDeptModal] = useState(false);
  const [routeTargetDept, setRouteTargetDept] = useState("");
  const [hospitalDepartments, setHospitalDepartments] = useState([]);

  // Fetch actual departments configured for this hospital
  const fetchHospitalDepartments = useCallback(async () => {
    if (!effectiveHospitalCode) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/hospitals/${encodeURIComponent(effectiveHospitalCode)}/departments`);
      const data = await res.json();
      if (res.ok && data.status === "success" && Array.isArray(data.departments)) {
        setHospitalDepartments(data.departments);
      }
    } catch (e) {
      console.error("Failed to load hospital departments in radiology:", e);
    }
  }, [effectiveHospitalCode]);

  useEffect(() => {
    fetchHospitalDepartments();
  }, [fetchHospitalDepartments]);

  // Actual available departments in the hospital for routing (excluding current Radiology dept)
  const availableRouteDepartments = useMemo(() => {
    const list = (hospitalDepartments || []).filter((d) => {
      const code = (d.dept_code || "").toLowerCase();
      const name = (d.name || "").toLowerCase();
      const isActive = d.status ? d.status === "active" : true;
      if (!isActive) return false;
      return code !== "radiology" && !name.includes("radiology") && !name.includes("x-ray");
    });

    if (list.length > 0) {
      return list.map((d) => {
        const code = d.dept_code || d.name;
        const labelEn = d.name || getCategoryLabel(code, "en") || code;
        const labelHi = getCategoryLabel(code, "hi") || d.name || code;
        return {
          id: code,
          code: code,
          label: labelEn,
          labelHi: labelHi,
        };
      });
    }

    return [
      { id: "consultation", code: "consultation", label: "General Consultation (OPD)", labelHi: "सामान्य परामर्श (OPD)" },
      { id: "emergency", code: "emergency", label: "Emergency Triage", labelHi: "आपातकालीन ट्राइएज" },
      { id: "laboratory", code: "laboratory", label: "Pathology & Lab Test", labelHi: "पैथोलॉजी व लैब टेस्ट" },
      { id: "pharmacy", code: "pharmacy", label: "Pharmacy & Medicine", labelHi: "फार्मेसी एवं दवा वितरण" },
      { id: "billing", code: "billing", label: "Central Billing & Cashier", labelHi: "सेंट्रल बिलिंग व कैशियर" },
    ];
  }, [hospitalDepartments]);

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
    setAppliedTemplate(key);
    setModality(t.modality);
    setBodyPart(t.body_part);
    setViewProjection(t.view);
    setClinicalIndication(t.indication);
    setTechnique(t.technique);
    setFindings(t.findings);
    setImpression(t.impression);
    showToast(isHi ? `'${t.title}' प्रारूप लागू किया गया।` : `Applied '${t.title}' template.`, "info");
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
        showToast(isHi ? `${data.files.length} इमेज अपलोड की गईं।` : `Uploaded ${data.files.length} scan files.`, "success");
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

      showToast(
        isHi
          ? `टोकन #${nextTicket.ticket_id} (${nextTicket.name || nextTicket.patient_name || "Patient"}) को बुलाया गया!`
          : `Called Token #${nextTicket.ticket_id} (${nextTicket.name || nextTicket.patient_name || "Patient"}) to Imaging Desk!`,
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

  const handleCallNextPatient = handleCallNext;

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
    showToast(
      isHi
        ? `टोकन #${activeServingTicket.ticket_id} (${activeServingTicket.name}) प्रतीक्षालय डिस्प्ले पर भेजा गया।`
        : `Sent Token #${activeServingTicket.ticket_id} (${activeServingTicket.name}) to waiting-room display.`,
      "info"
    );
  };

  // Hold Ticket (10-minute Grace Window)
  const handleHold = async (targetTicket) => {
    const target = targetTicket || activeServingTicket;
    if (!target) return;
    try {
      await fetch(`${API_BASE}/api/v1/plugin/hold-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: target.ticket_id,
          grace_minutes: 10,
        }),
      });
      if (socketRef && socketRef.current) {
        socketRef.current.emit("hold_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: target.ticket_id,
          grace_minutes: 10,
        });
      }
      if (selectedServingTicket && selectedServingTicket.ticket_id === target.ticket_id) {
        setSelectedServingTicket(null);
      }
      showToast(isHi ? `टोकन #${target.ticket_id} को होल्ड पर रखा गया (10 मिनट ग्रेस)` : `Token #${target.ticket_id} placed on 10-minute hold`, "warn");
      if (refreshData) refreshData();
    } catch (_) { }
  };

  // Recall Held Patient back into active station or queue
  const handleRecallHeld = async (ticket) => {
    if (!ticket) return;
    try {
      const mode = activeServingTicket ? "queue" : "serving";
      if (handleRecallTicket) {
        await handleRecallTicket(ticket.ticket_id, mode);
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/recall-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            ticket_id: ticket.ticket_id,
            doctor_id: currentUser?.id,
            doctor_name: currentUser?.name || currentUser?.username || radiologistName,
            doctor_email: currentUser?.email,
            target_mode: mode,
          }),
        });
      }
      if (socketRef && socketRef.current) {
        socketRef.current.emit("recall_ticket", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
          doctor_id: currentUser?.id,
          user_name: currentUser?.name || currentUser?.username || radiologistName,
          target_mode: mode,
        });
      }
      if (!activeServingTicket) {
        setSelectedServingTicket(ticket);
      }
      const radTicket = {
        ...ticket,
        counter_name: assignedDesk?.desk_name || activeDesk || "Imaging Workstation",
        room_number: assignedDesk?.desk_name || "Radiology Scan Room",
      };
      const msg = isHi
        ? `टोकन #${ticket.ticket_id} (${ticket.name}) को पुनः सक्रिय किया गया!`
        : `Recalled #${ticket.ticket_id} (${ticket.name}) back to active station!`;
      showToast(msg, "success");
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? `त्रुटि: ${e.message}` : `Error recalling ticket: ${e.message}`, "error");
    }
  };

  // Finalize No-Show for Held Patient
  const handleFinalizeNoShow = async (ticket) => {
    if (!ticket) return;
    try {
      if (handleMarkNoShow) {
        await handleMarkNoShow(ticket.ticket_id, "Patient absent after 10-min grace period");
      } else {
        await fetch(`${API_BASE}/api/v1/plugin/no-show`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: effectiveHospitalCode,
            ticket_id: ticket.ticket_id,
            reason: "Patient absent after 10-min grace period",
          }),
        });
      }
      if (socketRef && socketRef.current) {
        socketRef.current.emit("no_show", {
          tenant_id: effectiveHospitalCode,
          ticket_id: ticket.ticket_id,
        });
      }
      const msg = isHi
        ? `टोकन #${ticket.ticket_id} (${ticket.name}) को अनुपस्थित (No-Show) चिह्नित किया गया।`
        : `Token #${ticket.ticket_id} (${ticket.name}) marked as No-Show.`;
      showToast(msg, "warn");
      if (refreshData) refreshData();
    } catch (e) {
      showToast(isHi ? `त्रुटि: ${e.message}` : `Error: ${e.message}`, "error");
    }
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
        showToast(isHi ? "रेडियोलॉजी रिपोर्ट प्रारूप सहेजा गया।" : "Radiology report draft saved.", "success");
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
  const handleCompleteAndRouteToDoctor = async (overrideDept) => {
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

      const targetDept = overrideDept || parsedDoctorRx?.doctor_department || activeServingTicket.transferred_from_dept || "general";
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
            ? `जांच पूर्ण। टोकन #${activeServingTicket.ticket_id} को डॉ. ${parsedDoctorRx?.doctor_name || "OPD"} को भेजा गया।`
            : `Scan completed. Token #${activeServingTicket.ticket_id} routed back to ${parsedDoctorRx?.doctor_name || "Referring Doctor"}.`,
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
          ? `इमेजिंग पूर्ण एवं टोकन #${activeServingTicket.ticket_id} डिस्चार्ज किया गया।`
          : `Imaging study verified. Token #${activeServingTicket.ticket_id} discharged.`,
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
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all"); // "all" | "completed" | "cancelled" | "no_show"
  const [customFilterDate, setCustomFilterDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchRadiologyHistory = useCallback(async (dateParam) => {
    if (!effectiveHospitalCode) return;
    setLoadingHistory(true);
    try {
      // Build query: pass date=all to get all records, or specific date string
      const dateStr = dateParam || "all";
      const url = `${API_BASE}/api/v1/plugin/queue/${effectiveHospitalCode}/history?department=radiology&date=${encodeURIComponent(dateStr)}`;
      const res = await fetch(url, {
        headers: {
          ...(localStorage.getItem("token") || localStorage.getItem("ai_queue_token")
            ? { Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("ai_queue_token")}` }
            : {}),
        },
      });
      const qData = await res.json();
      // The endpoint returns { tickets: [...] }
      const raw = qData?.tickets || qData?.history || qData?.data || [];
      setHistoryList(Array.isArray(raw) ? raw : []);
    } catch (e) {
      console.warn("Radiology history fetch error:", e);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [effectiveHospitalCode]);

  useEffect(() => {
    if (activeTab === "history") {
      // Determine what date to request from the backend
      const todayStr = new Date().toISOString().split("T")[0];
      const yestDate = new Date();
      yestDate.setDate(yestDate.getDate() - 1);
      const yestStr = yestDate.toISOString().split("T")[0];

      let dateParam = "all";
      if (historyFilter === "today") dateParam = todayStr;
      else if (historyFilter === "yesterday") dateParam = yestStr;
      else if (historyFilter === "date") dateParam = customFilterDate || todayStr;
      // "all" stays as "all"

      fetchRadiologyHistory(dateParam);
    }
  }, [activeTab, historyFilter, customFilterDate, fetchRadiologyHistory]);

  // Real-time synchronization for history when tickets are cancelled or updated
  useEffect(() => {
    const sock = socketRef?.current;
    if (!sock) return;
    const handleHistorySocketUpdate = () => {
      if (activeTab === "history") {
        const todayStr = new Date().toISOString().split("T")[0];
        const yestDate = new Date();
        yestDate.setDate(yestDate.getDate() - 1);
        const yestStr = yestDate.toISOString().split("T")[0];

        let dateParam = "all";
        if (historyFilter === "today") dateParam = todayStr;
        else if (historyFilter === "yesterday") dateParam = yestStr;
        else if (historyFilter === "date") dateParam = customFilterDate || todayStr;
        fetchRadiologyHistory(dateParam);
      }
    };

    sock.on("ticket_cancelled", handleHistorySocketUpdate);
    sock.on("ticket_completed", handleHistorySocketUpdate);
    sock.on("queue_updated", handleHistorySocketUpdate);
    return () => {
      sock.off("ticket_cancelled", handleHistorySocketUpdate);
      sock.off("ticket_completed", handleHistorySocketUpdate);
      sock.off("queue_updated", handleHistorySocketUpdate);
    };
  }, [socketRef, activeTab, historyFilter, customFilterDate, fetchRadiologyHistory]);

  // Status Counts for History Filter Badges
  const historyCounts = useMemo(() => {
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    historyList.forEach((item) => {
      const st = String(item.status || "completed").toLowerCase();
      if (st === "cancelled" || st === "canceled") cancelled++;
      else if (st === "no_show" || st === "noshow" || st === "expired") noShow++;
      else completed++;
    });
    return {
      all: historyList.length,
      completed,
      cancelled,
      noShow,
    };
  }, [historyList]);

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

      const rawSt = String(item.status || "completed").toLowerCase();
      const isCancelled = rawSt === "cancelled" || rawSt === "canceled";
      const isNoShow = rawSt === "no_show" || rawSt === "noshow" || rawSt === "expired";
      const isCompleted = !isCancelled && !isNoShow;

      if (historyStatusFilter === "cancelled" && !isCancelled) return false;
      if (historyStatusFilter === "completed" && !isCompleted) return false;
      if (historyStatusFilter === "no_show" && !isNoShow) return false;

      if (archiveSearch.trim()) {
        const q = archiveSearch.toLowerCase();
        const nameMatch = String(item.patient_name || item.name || "").toLowerCase().includes(q);
        const tIdMatch = String(item.ticket_id || "").toLowerCase().includes(q);
        const condMatch = String(item.medical_condition || item.service_category || "").toLowerCase().includes(q);
        const phoneMatch = String(item.phone || "").toLowerCase().includes(q);
        const reasonMatch = String(item.cancellation_reason || "").toLowerCase().includes(q);
        const stMatch = rawSt.includes(q);
        if (!nameMatch && !tIdMatch && !condMatch && !phoneMatch && !reasonMatch && !stMatch) return false;
      }
      return true;
    });
  }, [historyList, historyFilter, customFilterDate, historyStatusFilter, archiveSearch]);

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

      const rawSt = String(item.status || "completed").toLowerCase();
      const isCancelled = rawSt === "cancelled" || rawSt === "canceled";
      const isNoShow = rawSt === "no_show" || rawSt === "noshow" || rawSt === "expired";

      let statusFormatted = "Completed";
      if (isCancelled) statusFormatted = "Cancelled";
      else if (isNoShow) statusFormatted = "No-Show";
      else if (rawSt === "serving" || rawSt === "in_progress") statusFormatted = "Serving";
      else if (rawSt === "waiting" || rawSt === "queued") statusFormatted = "Waiting";

      return {
        "S.No": idx + 1,
        "Date": item.queue_date || (item.created_at ? new Date(item.created_at).toLocaleDateString() : ""),
        "Token ID": item.ticket_id || "",
        "Patient Name": item.patient_name || item.name || "",
        "Age / Gender": `${item.age || 30} / ${item.gender || "M"}`,
        "Modality": mod,
        "Impression": isCancelled
          ? (item.cancellation_reason ? `Cancelled: ${item.cancellation_reason}` : "Ticket Cancelled - No Imaging Performed")
          : (imp || item.medical_condition || item.service_category || "Completed"),
        "Status": statusFormatted,
        "Cancellation Reason": item.cancellation_reason || "-",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Radiology_Records");
    XLSX.writeFile(wb, `Radiology_Records_${historyFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(isHi ? "एक्सेल स्प्रेडशीट डाउनलोड हो गई।" : "Excel spreadsheet exported successfully.", "success");
  };

  // =========================================================================
  // QUEUE & APPOINTMENTS TAB STATE & LOGIC
  // =========================================================================
  const [queueSubView, setQueueSubView] = useState("queue"); // "queue" | "appointments"
  const [queueModalityFilter, setQueueModalityFilter] = useState("all"); // "all" | "X-Ray" | "CT" | "MRI" | "USG"
  const [queueStatusFilter, setQueueStatusFilter] = useState("all");
  const [queuePriorityFilter, setQueuePriorityFilter] = useState("all");
  const [queueSearchQuery, setQueueSearchQuery] = useState("");

  // Appointments Data
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  const fetchRadiologyAppointments = useCallback(async (isInitial = false) => {
    if (!effectiveHospitalCode) return;
    if (isInitial) setAppointmentsLoading(true);
    try {
      const headers = { "Content-Type": "application/json" };
      if (currentUser?.email) headers["X-User-Email"] = currentUser.email;
      try {
        const token = localStorage.getItem("ai_queue_token") || localStorage.getItem("token") || currentUser?.token;
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (_) { }

      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/tenant/${encodeURIComponent(effectiveHospitalCode)}`, { headers });
      const data = await res.json();
      if (res.ok && (data.status === "success" || Array.isArray(data.appointments))) {
        setAppointmentsList(Array.isArray(data.appointments) ? data.appointments : []);
      }
    } catch (e) {
      console.error("Error fetching radiology appointments:", e);
    } finally {
      if (isInitial) setAppointmentsLoading(false);
    }
  }, [effectiveHospitalCode, currentUser]);

  useEffect(() => {
    fetchRadiologyAppointments(true);
  }, [fetchRadiologyAppointments]);

  // Handle Manual Check-In from Appointments
  const handleCheckInAppointment = async (aptId) => {
    if (!aptId) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: aptId }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast(
          isHi
            ? `टोकन #${data.ticket?.ticket_id || ""} चेक-इन सफल।`
            : `Checked in successfully. Token #${data.ticket?.ticket_id || ""} issued.`,
          "success"
        );
        fetchRadiologyAppointments();
        if (refreshData) refreshData();
        if (data.ticket) {
        }
      } else {
        showToast(data.message || data.detail || (isHi ? "चेक-इन विफल रहा" : "Check-in failed"), "error");
      }
    } catch (e) {
      showToast(isHi ? `चेक-इन त्रुटि: ${e.message}` : `Error during check-in: ${e.message}`, "error");
    }
  };

  // Handle Cancel Appointment
  const handleCancelAppointment = async (aptId) => {
    if (!aptId) return;
    if (!window.confirm(isHi ? `क्या आप वाकई अपॉइंटमेंट #${aptId} को रद्द करना चाहते हैं?` : `Are you sure you want to cancel appointment #${aptId}?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/appointments/${aptId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled by radiology department" }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        showToast(isHi ? "अपॉइंटमेंट रद्द किया गया।" : "Appointment cancelled.", "info");
        fetchRadiologyAppointments();
        if (refreshData) refreshData();
      } else {
        showToast(data.message || (isHi ? "रद्द करने में विफलता" : "Failed to cancel appointment"), "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  };

  // Dedicated Queue Ticket Transfer Modal State
  const [transferTicket, setTransferTicket] = useState(null);
  const [transferTargetDept, setTransferTargetDept] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [isTransferringQueueTicket, setIsTransferringQueueTicket] = useState(false);

  const handleExecuteQueueTransfer = async () => {
    if (!transferTicket || !transferTargetDept) return;
    setIsTransferringQueueTicket(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/transfer-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: effectiveHospitalCode,
          ticket_id: transferTicket.ticket_id,
          target_department: transferTargetDept,
          prescription_notes: transferNotes ? JSON.stringify({ transfer_notes: transferNotes, advised_by: "Radiology Department" }) : "",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          isHi
            ? `टोकन #${transferTicket.ticket_id} को स्थानांतरित किया गया।`
            : `Transferred #${transferTicket.ticket_id} to ${transferTargetDept}.`,
          "success"
        );
        setTransferTicket(null);
        setTransferTargetDept("");
        setTransferNotes("");
        if (refreshData) refreshData();
      } else {
        showToast(data.message || (isHi ? "स्थानांतरण विफल रहा" : "Failed to transfer ticket"), "error");
      }
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    } finally {
      setIsTransferringQueueTicket(false);
    }
  };

  // Persistent Prep Checklist State per Patient
  const [prepState, setPrepState] = useState(() => {
    try {
      const key = `ai_queue_radiology_prep_${effectiveHospitalCode}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  const updatePrepState = useCallback((patientKey, updater) => {
    setPrepState((prev) => {
      const curr = prev[patientKey] || { items: {}, prepDone: false };
      const updated = typeof updater === "function" ? updater(curr) : updater;
      const next = { ...prev, [patientKey]: updated };
      try {
        localStorage.setItem(`ai_queue_radiology_prep_${effectiveHospitalCode}`, JSON.stringify(next));
      } catch (_) { }
      return next;
    });
  }, [effectiveHospitalCode]);

  const togglePrepItem = (patientKey, itemId) => {
    updatePrepState(patientKey, (curr) => {
      const items = { ...(curr.items || {}) };
      items[itemId] = !items[itemId];
      return { ...curr, items };
    });
  };

  const setPatientPrepDone = (patientKey, isDone) => {
    updatePrepState(patientKey, (curr) => {
      return { ...curr, prepDone: isDone };
    });
    showToast(
      isDone
        ? (isHi ? "प्री-स्कैन तैयारी सत्यापित की गई।" : "Pre-scan preparation confirmed.")
        : (isHi ? "तैयारी लंबित चिह्नित की गई" : "Prep status marked incomplete"),
      isDone ? "success" : "info"
    );
  };

  // Helper to detect Modality & Body Part
  const detectItemModality = useCallback((item) => {
    if (!item) return "X-Ray";
    const pNotes = typeof item.prescription_notes === "object" ? JSON.stringify(item.prescription_notes || {}) : (item.prescription_notes || "");
    const text = `${item.service_category || ""} ${item.department || item.department_name || ""} ${item.medical_condition || ""} ${pNotes} ${item.notes || ""} ${item.reason || ""}`.toLowerCase();
    if (text.includes("mri") || text.includes("magnetic")) return "MRI";
    if (text.includes("ct") || text.includes("computed") || text.includes("tomography")) return "CT";
    if (text.includes("usg") || text.includes("ultrasound") || text.includes("sonography")) return "USG";
    if (text.includes("xray") || text.includes("x-ray") || text.includes("radiograph")) return "X-Ray";
    if (text.includes("mammo")) return "X-Ray";
    return "X-Ray";
  }, []);

  const detectItemBodyPart = useCallback((item) => {
    if (!item) return "Chest";
    const pNotes = typeof item.prescription_notes === "object" ? JSON.stringify(item.prescription_notes || {}) : (item.prescription_notes || "");
    const text = `${item.service_category || ""} ${item.medical_condition || ""} ${pNotes} ${item.notes || ""} ${item.reason || ""}`.toLowerCase();
    if (text.includes("chest") || text.includes("thorax") || text.includes("lung")) return "Chest";
    if (text.includes("brain") || text.includes("head") || text.includes("skull")) return "Brain / Head";
    if (text.includes("pelvis") || text.includes("pelvic") || text.includes("bladder") || text.includes("uterus")) return "Pelvis";
    if (text.includes("abdomen") || text.includes("belly") || text.includes("liver") || text.includes("kidney") || text.includes("stomach")) return "Abdomen";
    if (text.includes("spine") || text.includes("back") || text.includes("lumbar") || text.includes("cervical")) return "Spine (L-S / Cervical)";
    if (text.includes("knee") || text.includes("joint") || text.includes("leg") || text.includes("arm") || text.includes("shoulder") || text.includes("bone")) return "Extremity / Joint";
    return "Chest";
  }, []);

  // Helper to get tailored prep checklist items for a patient
  const getPrepChecklistItems = useCallback((item) => {
    if (!item) return [];
    const mod = detectItemModality(item);
    const part = detectItemBodyPart(item);
    const age = Number(item.age || 0);
    const gender = String(item.gender || "").toLowerCase();
    const isFemaleReproductive = (gender.startsWith("f") || gender === "female") && age >= 12 && age <= 55;
    const isIonizing = mod === "X-Ray" || mod === "CT";

    const items = [];

    // 1. Fasting for Abdomen USG
    if (mod === "USG" && (part === "Abdomen" || part.toLowerCase().includes("abdo"))) {
      items.push({
        id: "fasting_usg",
        label: isHi ? "पेट अल्ट्रासाउंड हेतु 6-8 घंटे उपवास (खाली पेट / NPO)" : "Fasting for Abdomen USG (6-8 hrs NPO, no solid food or milk)",
        hint: isHi ? "पित्ताशय व यकृत के स्पष्ट दृश्य हेतु आवश्यक" : "Ensures optimal gallbladder distension & minimal bowel gas",
        tag: "Fasting",
      });
    }

    // 2. Full Bladder for Pelvic USG
    if (mod === "USG" && (part === "Pelvis" || part.toLowerCase().includes("pelv") || part === "Abdomen")) {
      items.push({
        id: "full_bladder",
        label: isHi ? "पेल्विक अल्ट्रासाउंड हेतु भरा हुआ मूत्राशय (1L पानी पिएं, पेशाब न करें)" : "Full Bladder for Pelvic USG (Drink 1L water 1h prior, do not void)",
        hint: isHi ? "मूत्राशय व गर्भाशय/प्रोस्टेट के दृश्य हेतु अकॉस्टिक विंडो" : "Acoustic window essential for pelvic organs visualization",
        tag: "Full Bladder",
      });
    }

    // 3. Creatinine & Contrast Allergy for CT
    if (mod === "CT") {
      items.push({
        id: "creatinine_check",
        label: isHi ? "सीरम क्रिएटिनिन जांच (< 1.4 mg/dL सत्यापित) - रीनल सुरक्षा" : "Serum Creatinine Verified (< 1.4 mg/dL - Renal Safety)",
        hint: isHi ? "IV आयोडीन कंट्रास्ट डाई नेफ्रोपैथी से बचाव हेतु" : "Guards against contrast-induced nephropathy (CIN)",
        tag: "Creatinine",
      });
      items.push({
        id: "contrast_allergy",
        label: isHi ? "IV कंट्रास्ट एवं आयोडीन एलर्जी स्क्रीनिंग (कोई पूर्व एनाफिलेक्सिस नहीं)" : "IV Contrast & Iodine Allergy Screening (No prior severe reaction/asthma)",
        hint: isHi ? "गंभीर एलर्जी व ब्रोन्कोस्पाज्म से बचाव" : "Check for seafood/iodine allergy, pre-medication if indicated",
        tag: "Allergy",
      });
    }

    // 4. Implant & Metal Screening for MRI
    if (mod === "MRI") {
      items.push({
        id: "mri_metal_screening",
        label: isHi ? "एमआरआई धातु स्क्रीनिंग: पेसमेकर, न्यूरोस्टिम्युलेटर, धातु क्लिप्स मुक्त" : "MRI Safety: Pacemaker, Aneurysm Clips & Metal Implants Ruled Out",
        hint: isHi ? "Zone IV 1.5T/3.0T उच्च चुंबकीय क्षेत्र सुरक्षा" : "Zone IV safety check: Ferromagnetic items, cochlear implants, shrapnel",
        tag: "MRI Safety",
      });
      items.push({
        id: "mri_clothing_artifacts",
        label: isHi ? "सभी आभूषण, घड़ी, धातु के बटन व मोबाइल फोन हटा दिए गए हैं" : "All Jewelry, Watches, Hairpins & External Metal Removed",
        hint: isHi ? "आरएफ बर्न व विरूपण से बचाव" : "Hospital gown provided; zero metallic artifacts",
        tag: "Metal Check",
      });
    }

    // 5. Radiation Safety Pregnancy Rule-Out for Ionizing Modalities
    if (isIonizing && isFemaleReproductive) {
      items.push({
        id: "pregnancy_check",
        label: isHi ? "रेडिएशन सुरक्षा: गर्भावस्था की अनुपस्थिति सत्यापित (LMP / 10-दिन नियम)" : "Radiation Safety: Pregnancy Ruled Out (LMP Verified / Non-Pregnant)",
        hint: isHi ? "AERB / ACR दिशा-निर्देश: भ्रूण को एक्स-रे विकिरण से सुरक्षित रखने हेतु" : "AERB / ACR 10-day rule protocol for female patients aged 12-55",
        tag: "Pregnancy Safety",
        isWarning: true,
      });
    }

    // Default safety check for plain X-Ray
    if (items.length === 0) {
      items.push({
        id: "general_prep",
        label: isHi ? "धातु व कपड़े के आर्टिफैक्ट्स हटाए गए (गहने, बटन, जिपर)" : "Artifacts Removed: Jewelry, Buttons, Snaps & Zippers Removed",
        hint: isHi ? "स्पष्ट इमेजिंग एवं गुणवत्ता हेतु" : "Patient properly positioned in gown for diagnostic quality",
        tag: "Prep Verified",
      });
    }

    return items;
  }, [detectItemModality, detectItemBodyPart, isHi]);

  // Call patient with prep verification prompt
  const handleCallWithPrepCheck = useCallback((ticket) => {
    if (!ticket) return;
    const pKey = `ticket_${ticket.ticket_id}`;
    const isPrepDone = Boolean(prepState[pKey]?.prepDone);
    const pName = ticket.name || ticket.patient_name || "Patient";
    if (!isPrepDone) {
      const confirmCall = window.confirm(
        isHi
          ? `टोकन #${ticket.ticket_id} (${pName}) की प्री-स्कैन तैयारी अधूरी है। क्या आप तैयारी की पुष्टि करके मरीज़ को बुलाना चाहते हैं?`
          : `Pre-scan preparation incomplete for Token #${ticket.ticket_id} (${pName}). Click OK to confirm preparation and call patient, or Cancel to review checklist.`
      );
      if (confirmCall) {
        setPatientPrepDone(pKey, true);
        handleCallSpecificPatient(ticket);
      }
      return;
    }
    handleCallSpecificPatient(ticket);
  }, [prepState, isHi, handleCallSpecificPatient, setPatientPrepDone]);

  // Filtered Today's Appointments
  const todayDateStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const todayAppointments = useMemo(() => {
    return appointmentsList.filter((apt) => {
      const aptDate = apt.appointment_date || (apt.appointment_time ? apt.appointment_time.split("T")[0] : "");
      return !aptDate || aptDate === todayDateStr;
    });
  }, [appointmentsList, todayDateStr]);

  const todayAppointmentsFiltered = useMemo(() => {
    return todayAppointments.filter((apt) => {
      // Modality filter
      if (queueModalityFilter !== "all") {
        const m = detectItemModality(apt);
        if (m !== queueModalityFilter) return false;
      }

      // Status filter
      if (queueStatusFilter !== "all") {
        const s = (apt.status || "booked").toLowerCase();
        if (queueStatusFilter === "waiting" && s !== "booked" && s !== "check_in_available") return false;
        if (queueStatusFilter === "checked_in" && s !== "checked_in") return false;
        if (queueStatusFilter === "booked" && s !== "booked") return false;
        if (queueStatusFilter === "expired" && s !== "expired") return false;
        if (queueStatusFilter === "cancelled" && s !== "cancelled") return false;
      }

      // Priority filter
      if (queuePriorityFilter !== "all") {
        const p = Number(apt.priority_level || apt.priority || 3);
        if (queuePriorityFilter === "emergency" && p !== 1) return false;
        if (queuePriorityFilter === "urgent" && p !== 2) return false;
        if (queuePriorityFilter === "routine" && p !== 3 && p !== 2 && p !== 1) return false;
      }

      // Search query
      if (queueSearchQuery.trim()) {
        const q = queueSearchQuery.toLowerCase();
        const name = String(apt.patient_name || apt.name || "").toLowerCase();
        const phone = String(apt.phone || "").toLowerCase();
        const id = String(apt.appointment_id || apt.ticket_id || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }, [todayAppointments, queueModalityFilter, queueStatusFilter, queuePriorityFilter, queueSearchQuery, detectItemModality]);

  // Appointments grouped by time slot
  const appointmentsBySlot = useMemo(() => {
    const groups = {};
    todayAppointmentsFiltered.forEach((apt) => {
      const slot = apt.time_slot || apt.formatted_appointment_time || apt.appointment_time || "General OPD Slot";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(apt);
    });
    return groups;
  }, [todayAppointmentsFiltered]);

  // Late appointment checker
  const isAppointmentLate = useCallback((apt) => {
    const rawStatus = (apt.status || "booked").toLowerCase();
    if (rawStatus === "checked_in" || rawStatus === "cancelled" || rawStatus === "completed") return false;
    const slot = apt.time_slot || apt.appointment_time || "";
    const timeMatch = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeMatch) return false;
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3];
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
      if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
    }
    const now = new Date();
    const slotDate = new Date();
    slotDate.setHours(hours, minutes, 0, 0);
    return now > slotDate;
  }, []);

  // Filtered & Sorted Live Queue
  const combinedLiveQueue = useMemo(() => {
    const map = new Map();
    // 1. Currently Serving
    if (radiologyServing) {
      map.set(radiologyServing.ticket_id, { ...radiologyServing, _queueCategory: "serving" });
    }
    // 2. On Hold
    (radiologyHeldTickets || []).forEach((t) => {
      map.set(t.ticket_id, { ...t, _queueCategory: "on_hold" });
    });
    // 3. Waiting Queue
    (radiologyQueue || []).forEach((t) => {
      if (!map.has(t.ticket_id)) {
        map.set(t.ticket_id, { ...t, _queueCategory: "waiting" });
      }
    });

    const list = Array.from(map.values());

    return list.filter((ticket) => {
      // Modality filter
      if (queueModalityFilter !== "all") {
        const m = detectItemModality(ticket);
        if (m !== queueModalityFilter) return false;
      }

      // Status filter
      if (queueStatusFilter !== "all") {
        if (queueStatusFilter === "waiting" && ticket._queueCategory !== "waiting") return false;
        if (queueStatusFilter === "serving" && ticket._queueCategory !== "serving") return false;
        if (queueStatusFilter === "on_hold" && ticket._queueCategory !== "on_hold") return false;
      }

      // Priority filter
      if (queuePriorityFilter !== "all") {
        const p = Number(ticket.priority_level || ticket.priority || 3);
        if (queuePriorityFilter === "emergency" && p !== 1) return false;
        if (queuePriorityFilter === "urgent" && p !== 2) return false;
        if (queuePriorityFilter === "routine" && p !== 3 && p !== 2 && p !== 1) return false;
      }

      // Search query
      if (queueSearchQuery.trim()) {
        const q = queueSearchQuery.toLowerCase();
        const name = String(ticket.name || ticket.patient_name || "").toLowerCase();
        const phone = String(ticket.phone || "").toLowerCase();
        const tid = String(ticket.ticket_id || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !tid.includes(q)) return false;
      }

      return true;
    }).sort((a, b) => {
      // Priority 1: Serving ticket always top
      if (a._queueCategory === "serving" && b._queueCategory !== "serving") return -1;
      if (b._queueCategory === "serving" && a._queueCategory !== "serving") return 1;

      // Priority 2: Emergency (P1) first
      const pa = Number(a.priority_level || a.priority || 3);
      const pb = Number(b.priority_level || b.priority || 3);
      if (pa !== pb) return pa - pb; // 1 before 2 before 3

      // Priority 3: Longest wait time (earliest join_timestamp)
      const parseJoin = (t) => {
        if (!t) return 0;
        if (t.join_timestamp) {
          const num = Number(t.join_timestamp);
          if (!isNaN(num) && num > 0) return num > 1e11 ? num / 1000 : num;
        }
        if (t.created_at) {
          const time = new Date(t.created_at).getTime();
          if (!isNaN(time)) return time / 1000;
        }
        return 0;
      };
      const ja = parseJoin(a);
      const jb = parseJoin(b);
      return ja - jb;
    });
  }, [radiologyServing, radiologyHeldTickets, radiologyQueue, queueModalityFilter, queueStatusFilter, queuePriorityFilter, queueSearchQuery, detectItemModality]);

  // 8 Summary Strip Metrics Calculations
  const waitingMetric = Array.isArray(radiologyQueue) ? radiologyQueue.length : 0;
  const servingMetric = radiologyServing ? 1 : 0;
  const heldMetric = Array.isArray(radiologyHeldTickets) ? radiologyHeldTickets.length : 0;
  const bookedTodayMetric = useMemo(() => {
    return todayAppointments.filter((a) => {
      const s = (a.status || "booked").toLowerCase();
      return s === "booked" || s === "confirmed" || s === "scheduled" || s === "check_in_available";
    }).length;
  }, [todayAppointments]);
  const checkedInMetric = useMemo(() => {
    return todayAppointments.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s === "checked_in" || Boolean(a.ticket_id);
    }).length;
  }, [todayAppointments]);
  const noShowExpiredMetric = useMemo(() => {
    const aptNoShow = todayAppointments.filter((a) => {
      const s = (a.status || "").toLowerCase();
      return s === "no_show" || s === "expired" || s === "cancelled";
    }).length;
    return aptNoShow;
  }, [todayAppointments]);
  const avgWaitMinutes = useMemo(() => {
    if (!Array.isArray(radiologyQueue) || radiologyQueue.length === 0) return 12;
    let totalSec = 0;
    radiologyQueue.forEach((t) => {
      const rawJoin = t.join_timestamp
        ? (Number(t.join_timestamp) > 1e11 ? Number(t.join_timestamp) / 1000 : Number(t.join_timestamp))
        : (t.created_at ? new Date(t.created_at).getTime() / 1000 : nowSec - 600);
      const validJoin = isNaN(rawJoin) ? nowSec - 600 : rawJoin;
      const elapsed = Math.max(0, nowSec - validJoin);
      totalSec += elapsed;
    });
    const mins = Math.round((totalSec / radiologyQueue.length) / 60);
    return !isNaN(mins) && mins > 0 ? mins : 8;
  }, [radiologyQueue, nowSec]);
  const avgScanTimeMinutes = 14;

  return (
    <div
      className="radiology-portal-wrapper"
      style={{
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        boxSizing: "border-box",
        padding: "0 0 12px 0",
        background: pageBg,
        color: textColor,
        transition: "all 0.25s ease",
                "--rad-card-bg": cardBg,
        "--rad-card-border": isDark ? "#334155" : "#E2E8F0",
        "--rad-card-text": textColor,
        "--rad-primary": brandPrimary,
        "--rad-primary-hover": "#0369A1",
        "--rad-primary-light": isDark ? "rgba(2, 132, 199, 0.18)" : "#E0F2FE",
        "--rad-primary-border": isDark ? "rgba(2, 132, 199, 0.45)" : "#BAE6FD",
        "--rad-navy": "#0C2340",
        "--rad-bg": pageBg,
        "--rad-surface": cardBg,
        "--rad-surface-subtle": isDark ? "#0F172A" : "#F8FAFC",
        "--rad-border": isDark ? "#334155" : "#E2E8F0",
        "--rad-border-subtle": isDark ? "#1E293B" : "#F1F5F9",
        "--rad-text": textColor,
        "--rad-muted": mutedText,
        "--rad-destructive": "#DC2626",
        "--rad-destructive-light": isDark ? "rgba(220, 38, 38, 0.15)" : "#FEF2F2",
        "--rad-destructive-border": isDark ? "rgba(220, 38, 38, 0.35)" : "#FECACA",
      }}
    >
      {/* Embedded CSS Style Rules matching Pathology & Doctor Portals */}
      <style>{`
        .radiology-portal-wrapper {
          box-sizing: border-box;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        .radiology-portal-wrapper *,
        .radiology-portal-wrapper *::before,
        .radiology-portal-wrapper *::after {
          box-sizing: border-box;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Responsive Table Scroll Container matching Pharmacy & Reception Portals */
        .staff-table-scroll-wrapper {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          box-sizing: border-box;
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
                      linear-gradient(135deg, #0C2340 0%, #0F172A 60%, #1E293B 100%);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 20px;
          padding: 20px 24px;
          color: #FFFFFF;
          box-shadow: 0 16px 36px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(56, 189, 248, 0.18);
          margin-bottom: 16px;
          position: relative;
          overflow: visible;
          z-index: 50;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
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
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
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
          max-width: 100%;
          box-sizing: border-box;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .radiology-workstation-grid {
            grid-template-columns: minmax(0, 1fr);
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
            maxWidth: "min(480px, calc(100vw - 32px))",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 20px",
            borderRadius: "14px",
            background:
              toast.type === "error"
                ? "#EF4444"
                : toast.type === "warn"
                  ? "#64748B"
                  : toast.type === "info"
                    ? "#0284C7"
                    : "#0284C7",
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
            style={{ background: "none", border: "none", color: "#FFFFFF", cursor: "pointer", marginLeft: "8px", fontWeight: "bold" }}
          ><X size={15} /></button>
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
              maxWidth: "min(1100px, calc(100vw - 32px))",
              boxSizing: "border-box",
              background: "#0F172A",
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
              ><X size={15} /></button>
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
                style={{ padding: "4px 10px", borderRadius: "6px", background: "#334155", color: "#FFFFFF", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <ZoomIn size={13} /> Zoom In
              </button>
              <button
                type="button"
                onClick={() => setViewerZoom((z) => Math.max(z - 0.25, 0.5))}
                style={{ padding: "4px 10px", borderRadius: "6px", background: "#334155", color: "#FFFFFF", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <ZoomOut size={13} /> Zoom Out
              </button>
              <button
                type="button"
                onClick={() => setViewerRotation((r) => (r + 90) % 360)}
                style={{ padding: "4px 10px", borderRadius: "6px", background: "#334155", color: "#FFFFFF", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
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
                  color: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Invert (Negative)
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
                style={{ padding: "4px 10px", borderRadius: "6px", background: "#475569", color: "#FFFFFF", border: "none", cursor: "pointer", marginLeft: "auto" }}
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
                background: "#0F172A",
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
                    background: "#38BDF8",
                    boxShadow: "0 0 6px rgba(56, 189, 248, 0.5)",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {isHi ? "विभाग:" : "Dept:"}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#38BDF8", letterSpacing: "0.3px" }}>
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
                  : "rgba(100, 116, 139, 0.14)",
                border: assignedDesk
                  ? "1px solid rgba(255, 255, 255, 0.25)"
                  : "1px solid rgba(100, 116, 139, 0.4)",
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
                  color: assignedDesk ? "#38BDF8" : "#94A3B8",
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
                  color: assignedDesk ? "#FFFFFF" : "#CBD5E1",
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
                      ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                      : dutyStatus === "PROCESSING"
                        ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                        : dutyStatus === "BREAK"
                          ? "linear-gradient(135deg, #475569 0%, #334155 100%)"
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
                      ? "0 4px 14px rgba(2, 132, 199, 0.35)"
                      : dutyStatus === "PROCESSING"
                        ? "0 4px 14px rgba(2, 132, 199, 0.35)"
                        : dutyStatus === "BREAK"
                          ? "0 4px 14px rgba(100, 116, 139, 0.35)"
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
                <ChevronDown size={11} style={{ marginLeft: "2px" }} />
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
                    minWidth: "200px",
                    maxWidth: "min(280px, calc(100vw - 32px))",
                    boxSizing: "border-box",
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
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: opt.color, display: "inline-block" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11.5px", fontWeight: 800, color: opt.color }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: "9.5px", color: isDark ? "#94A3B8" : "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {opt.desc}
                        </div>
                      </div>
                      {dutyStatus === opt.id && (
                        <Check size={12} color={opt.color} />
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
              <CheckCircle2 size={15} color="#38BDF8" />
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
              <Sliders size={15} color="#38BDF8" />
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
                : (isDark ? "rgba(100, 116, 139, 0.15)" : "#F1F5F9"),
            border:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA")
                : (isDark ? "1px solid rgba(100, 116, 139, 0.35)" : "1px solid #CBD5E1"),
            color:
              dutyStatus === "OFF_DUTY"
                ? (isDark ? "#FCA5A5" : "#B91C1C")
                : (isDark ? "#BAE6FD" : "#0369A1"),
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
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
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
              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.35)",
            }}
          >
            <Check size={12} />
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
            <span className="tab-sub-text">{isHi ? "सक्रिय अध्ययन व रिपोर्टिंग" : "Active Study & Reporting"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              className="tab-count-badge"
              style={{
                background: activeTab === "workstation" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
                color: activeTab === "workstation" ? "#FFFFFF" : "#0284C7",
              }}
            >
              {radiologyServing ? 1 : 0} {isHi ? "सक्रिय" : "Active"}
            </span>
            {radiologyHeldTickets.length > 0 && (
              <span
                className="tab-count-badge"
                style={{
                  background: activeTab === "workstation" ? "#F1F5F9" : (isDark ? "rgba(100, 116, 139, 0.25)" : "#F1F5F9"),
                  color: "#334155",
                  border: "1px solid #CBD5E1",
                  fontWeight: 900,
                }}
                title={`${radiologyHeldTickets.length} ${isHi ? "मरीज़ होल्ड पर" : "Patients on Hold / Grace Window"}`}
              >
                {radiologyHeldTickets.length} {isHi ? "होल्ड" : "Held"}
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`tab-button-modern ${activeTab === "queue" ? "active" : "inactive"}`}
        >
          <div className="tab-icon-wrapper">
            <Users size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tab-title-text">{isHi ? "कतार एवं अपॉइंटमेंट्स" : "Queue & Appointments"}</div>
            <span className="tab-sub-text">{isHi ? "लाइव कतार व शेड्यूल्ड स्कैन" : "Live Queue & Scheduled Scans"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              className="tab-count-badge"
              style={{
                background: activeTab === "queue" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
                color: activeTab === "queue" ? "#FFFFFF" : "#0284C7",
              }}
              title={`${radiologyQueue.length} ${isHi ? "प्रतीक्षारत मरीज़" : "Waiting Patients"}`}
            >
              {radiologyQueue.length} {isHi ? "कतार" : "Queue"}
            </span>
            {todayAppointments.length > 0 && (
              <span
                className="tab-count-badge"
                style={{
                  background: activeTab === "queue" ? "rgba(255,255,255,0.2)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
                  color: activeTab === "queue" ? "#FFFFFF" : "#0369A1",
                  border: "1px solid rgba(2, 132, 199, 0.3)",
                }}
                title={`${todayAppointments.length} ${isHi ? "आज की अपॉइंटमेंट्स" : "Today's Appointments"}`}
              >
                {todayAppointments.length} {isHi ? "अपॉइंटमेंट" : "Apt"}
              </span>
            )}
          </div>
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
              background: activeTab === "history" ? "rgba(255,255,255,0.25)" : (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE"),
              color: activeTab === "history" ? "#FFFFFF" : "#0369A1",
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
                          background: activeServingTicket.priority_level === 1 ? "#FEE2E2" : "#E0F2FE",
                          color: activeServingTicket.priority_level === 1 ? "#DC2626" : "#0369A1",
                          border: `1px solid ${activeServingTicket.priority_level === 1 ? "rgba(239, 68, 68, 0.3)" : "rgba(2, 132, 199, 0.3)"}`,
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
                      title={isHi ? "प्रतीक्षालय डिस्प्ले पर भेजें" : "Call on waiting-room display"}
                    >
                      <Volume2 size={13} color="#0284C7" />
                      <span>{isHi ? "डिस्प्ले पर बुलाएं" : "Call on display"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleHold}
                      style={{
                        background: isDark ? "#1E293B" : "#F1F5F9",
                        border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                        color: "#475569",
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
                      background: isDark ? "#0F172A" : "#F8FAFC",
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
                      border: pregnancyConfirmed ? "1px solid #0284C7" : "1.5px solid #EF4444",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>{pregnancyConfirmed ? <CheckCircle2 size={18} color="var(--rad-primary, #0284C7)" /> : <AlertTriangle size={18} color="#DC2626" />}</span>
                    <div style={{ flex: 1, fontSize: "11.5px" }}>
                      <strong style={{ color: pregnancyConfirmed ? "#0369A1" : "#DC2626" }}>
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
                    {Object.keys(NORMAL_TEMPLATES).map((key) => {
                      const isApplied = appliedTemplate === key;
                      return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyNormalTemplate(key)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: isApplied
                            ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                            : isDark ? "#1E293B" : "#F8FAFC",
                          border: isApplied
                            ? "1.5px solid #38BDF8"
                            : isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                          color: isApplied ? "#FFFFFF" : textColor,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 0.2s ease",
                          boxShadow: isApplied ? "0 3px 10px rgba(2, 132, 199, 0.35)" : "none",
                          transform: isApplied ? "scale(1.03)" : "scale(1)",
                        }}
                      >
                        <span>{isApplied ? <CheckCircle2 size={13} /> : <Sparkles size={13} />}</span>
                        <span>{NORMAL_TEMPLATES[key].title}</span>
                      </button>
                      );
                    })}
                  </div>
                </div>

                {/* Study & Exposure Parameters Grid */}
                <div
                  style={{
                    background: isDark ? "#0F172A" : "#F8FAFC",
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
                    background: isDark ? "#0F172A" : "#F8FAFC",
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
                    background: isDark ? "#0F172A" : "#F8FAFC",
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
                        color: "#FFFFFF",
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
                            background: "#0F172A",
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
                          ><X size={15} /></button>
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
                      onClick={() => {
                        if (!activeServingTicket) return;
                        if (!findings.trim() || !impression.trim()) {
                          showToast(isHi ? "कृपया पहले निष्कर्ष (Findings) और इंप्रेशन दर्ज करें" : "Please provide diagnostic findings and impression first", "warn");
                          return;
                        }
                        // Pre-select referring doctor's department if available or default to first available
                        const initialDept = parsedDoctorRx?.doctor_department || activeServingTicket.transferred_from_dept;
                        const match = availableRouteDepartments.find((d) => d.id === initialDept || d.code === initialDept);
                        setRouteTargetDept(match ? match.id : (availableRouteDepartments[0]?.id || "consultation"));
                        setShowRouteDeptModal(true);
                      }}
                      style={{
                        background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
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
                        boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)",
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
                        background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
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
                        boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)",
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

            {/* 3. PATIENTS ON HOLD / 10-MIN GRACE WINDOW SECTION (Matching General OPD Doctor Portal) */}
            <div
              style={{
                padding: "16px 20px",
                background: isDark ? "#0F172A" : "var(--rad-card-bg, #FFFFFF)",
                borderRadius: "16px",
                border: isDark ? "1px solid #1E293B" : "1.5px solid var(--rad-card-border, #E2E8F0)",
                boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.3)" : "0 2px 10px rgba(0,0,0,0.03)",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "7px", borderRadius: "10px", background: isDark ? "rgba(100, 116, 139, 0.2)" : "#F1F5F9", color: "#475569" }}>
                    <Clock size={16} />
                  </span>
                  <div>
                    <strong style={{ fontSize: "14px", color: textColor, display: "block", letterSpacing: "-0.2px" }}>
                      {isHi ? "होल्ड पर मरीज़ (10 मिनट ग्रेस विंडो)" : "Patients on Hold (10-Min Grace Window)"}
                    </strong>
                    <span style={{ fontSize: "11px", color: mutedText }}>
                      {isHi
                        ? "अनुपस्थित मरीज़ों को 10 मिनट की छूट। आगमन पर पुनः बुलाएं (Recall) अथवा No-Show चिह्नित करें।"
                        : "Patients absent when called are held for 10-min grace window. Recall on arrival or finalize No-Show."}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    background: radiologyHeldTickets.length > 0 ? (isDark ? "rgba(100, 116, 139, 0.25)" : "#F1F5F9") : (isDark ? "#1E293B" : "#F1F5F9"),
                    color: radiologyHeldTickets.length > 0 ? "#475569" : mutedText,
                    border: `1px solid ${radiologyHeldTickets.length > 0 ? "rgba(100, 116, 139, 0.4)" : (isDark ? "#334155" : "#CBD5E1")}`,
                  }}
                >
                  {radiologyHeldTickets.length} {isHi ? "होल्ड पर" : "On Hold"}
                </span>
              </div>

              {radiologyHeldTickets.length === 0 ? (
                <div
                  style={{
                    padding: "16px 18px",
                    background: isDark ? "#0F172A" : "#F8FAFC",
                    borderRadius: "12px",
                    border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: mutedText,
                    fontSize: "12.5px",
                  }}
                >
                  <CheckCircle2 size={16} color="#0284C7" />
                  <span>
                    {isHi
                      ? "वर्तमान में कोई मरीज़ होल्ड पर नहीं है। सभी इमेजिंग जांच सुचारु रूप से चल रही हैं।"
                      : "No patients currently on hold. All imaging examinations running on schedule."}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {radiologyHeldTickets.map((ht) => {
                    const holdStart = ht.hold_start_time || ht.join_timestamp || nowSec;
                    const holdUntil = ht.hold_until || (holdStart + 600);
                    const remainingSecs = Math.max(0, Math.floor(holdUntil - nowSec));
                    const mins = Math.floor(remainingSecs / 60);
                    const secs = remainingSecs % 60;
                    const timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                    const isExpired = remainingSecs <= 0;

                    return (
                      <div
                        key={ht.ticket_id}
                        style={{
                          background: isExpired
                            ? (isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2")
                            : (isDark ? "rgba(100, 116, 139, 0.1)" : "#F1F5F9"),
                          borderRadius: "14px",
                          border: isExpired
                            ? (isDark ? "1.5px solid rgba(239, 68, 68, 0.4)" : "1.5px solid #FECACA")
                            : (isDark ? "1.5px solid rgba(100, 116, 139, 0.45)" : "1.5px solid #CBD5E1"),
                          padding: "12px 16px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "12px",
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              padding: "4px 10px",
                              minWidth: "54px",
                              height: "36px",
                              borderRadius: "10px",
                              background: isExpired ? "#DC2626" : "#475569",
                              color: "#FFFFFF",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "14px",
                              fontWeight: 900,
                              whiteSpace: "nowrap",
                              letterSpacing: "0.5px",
                              flexShrink: 0,
                            }}
                          >
                            {String(ht.ticket_id).startsWith("#") ? ht.ticket_id : `#${ht.ticket_id}`}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: "14.5px", color: textColor }}>{ht.name}</strong>
                              <span style={{ padding: "1px 7px", borderRadius: "5px", background: isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE", color: "#0284C7", fontSize: "10.5px", fontWeight: 700 }}>
                                {ht.service_category || ht.medical_condition || "Radiology"}
                              </span>
                              <span style={{ fontSize: "11px", color: mutedText }}>
                                {ht.age || 30} {isHi ? "वर्ष" : "yrs"} • {String(ht.gender || "M").toUpperCase()}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  background: isExpired
                                    ? (isDark ? "rgba(239, 68, 68, 0.25)" : "#FEE2E2")
                                    : (isDark ? "rgba(100, 116, 139, 0.25)" : "#F1F5F9"),
                                  color: isExpired ? "#DC2626" : "#475569",
                                }}
                              >
                                {isExpired ? <AlertTriangle size={12} /> : <Clock size={12} />}
                                <span>
                                  {isExpired
                                    ? (isHi ? "10 मिनट ग्रेस समाप्त (No-Show)" : "10-Min Grace Expired")
                                    : (isHi ? `ग्रेस समय शेष: ${timerStr}` : `Grace Remaining: ${timerStr}`)}
                                </span>
                              </span>
                              {ht.transferred_from_dept && (
                                <span style={{ fontSize: "10.5px", color: mutedText }}>
                                  Ref: {ht.transferred_from_dept}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          {/* Recall / Resume Button */}
                          <button
                            type="button"
                            onClick={() => handleRecallHeld(ht)}
                            style={{
                              padding: "7px 14px",
                              borderRadius: "10px",
                              border: "none",
                              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                              color: "#FFFFFF",
                              fontSize: "12px",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                            }}
                            title={isHi ? "मरीज़ आ गया है: स्टेशन पर पुनः बुलाएं और जांच शुरू करें" : "Patient has arrived: Recall to station and begin examination"}
                          >
                            <Play size={12} fill="#FFFFFF" color="#FFFFFF" />
                            <span>{isHi ? "मरीज़ पुनः बुलाएं (Recall)" : "Recall Patient"}</span>
                          </button>

                          {/* Mark No-Show Finalize Button */}
                          <button
                            type="button"
                            onClick={() => handleFinalizeNoShow(ht)}
                            style={{
                              padding: "7px 12px",
                              borderRadius: "10px",
                              border: isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #FECACA",
                              background: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                              color: "#DC2626",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                            title={isHi ? "मरीज़ नहीं आया: अनुपस्थित (No-Show) दर्ज करें" : "Finalize as No-Show if patient did not appear"}
                          >
                            <UserX size={12} />
                            <span>{isHi ? "अनुपस्थित (No-Show)" : "Mark No-Show"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Imaging Queue */}
          <div style={{ minWidth: 0, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
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
                            : isDark ? "#0F172A" : "#F8FAFC",
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
                                ? (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE")
                                : (isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE"),
                              border: isServing
                                ? "1px solid #0284C7"
                                : "1px solid #0284C7",
                              color: isServing ? "#0284C7" : "#0284C7",
                              fontSize: "10.5px",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            title={isServing ? (isHi ? "प्रतीक्षालय डिस्प्ले पर भेजें" : "Call on waiting-room display") : (isHi ? "स्टेशन पर बुलाएं" : "Call patient to station")}
                          >
                            <Volume2 size={11} />
                            <span>{isServing ? (isHi ? "डिस्प्ले" : "Call on display") : (isHi ? "बुलाएं" : "Call")}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sidebar Quick Held Section if held tickets exist */}
              {radiologyHeldTickets.length > 0 && (
                <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#475569", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Clock size={12} />
                      <span>{isHi ? "होल्ड पर मरीज़" : "Patients on Hold"}</span>
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: 800, padding: "1px 6px", borderRadius: "999px", background: isDark ? "rgba(100, 116, 139, 0.25)" : "#F1F5F9", color: "#334155" }}>
                      {radiologyHeldTickets.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {radiologyHeldTickets.map((ht) => (
                      <div
                        key={ht.ticket_id}
                        style={{
                          background: isDark ? "rgba(100, 116, 139, 0.1)" : "#F1F5F9",
                          border: isDark ? "1px solid rgba(100, 116, 139, 0.3)" : "1px solid #CBD5E1",
                          borderRadius: "8px",
                          padding: "6px 8px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: "11.5px", fontWeight: 800, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            #{ht.ticket_id} {ht.name}
                          </div>
                          <div style={{ fontSize: "10px", color: "#475569", fontWeight: 700 }}>
                            {ht.service_category || "Radiology"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRecallHeld(ht)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "none",
                            background: "#0369A1",
                            color: "#FFFFFF",
                            fontSize: "10.5px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            flexShrink: 0,
                          }}
                          title={isHi ? "पुनः बुलाएं" : "Recall"}
                        >
                          <Play size={10} fill="#FFF" color="#FFF" />
                          <span>{isHi ? "बुलाएं" : "Recall"}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: QUEUE & APPOINTMENTS WORKBENCH
         ======================================================== */}
      {activeTab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* 1. SUMMARY STRIP (8 METRICS) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "10px",
            }}
          >
            {/* 1. Waiting */}
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "प्रतीक्षारत" : "Waiting"}
                </span>
                <Clock size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "4px", lineHeight: "1" }}>
                {waitingMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "कतार में सक्रिय मरीज़" : "Active in live queue"}
              </div>
            </div>

            {/* 2. Serving */}
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "स्कैन जारी" : "Serving"}
                </span>
                <Scan size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0C2340", marginTop: "4px", lineHeight: "1" }}>
                {servingMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {radiologyServing ? `#${radiologyServing.ticket_id} (${radiologyServing.name})` : (isHi ? "स्टेशन तैयार है" : "Counter ready")}
              </div>
            </div>

            {/* 3. On Hold */}
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "होल्ड पर" : "On Hold"}
                </span>
                <Pause size={14} color="#64748B" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#64748B", marginTop: "4px", lineHeight: "1" }}>
                {heldMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "10 मिनट ग्रेस विंडो" : "10-min grace window"}
              </div>
            </div>

            {/* 4. Booked Today */}
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "आज बुक" : "Booked Today"}
                </span>
                <Calendar size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "4px", lineHeight: "1" }}>
                {bookedTodayMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "शेड्यूल्ड अपॉइंटमेंट्स" : "Scheduled bookings"}
              </div>
            </div>

            {/* 5. Checked In */}
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "चेक-इन पूर्ण" : "Checked In"}
                </span>
                <CheckCircle2 size={14} color="#0369A1" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0369A1", marginTop: "4px", lineHeight: "1" }}>
                {checkedInMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "टोकन जारी / कतार में" : "Issued token / in queue"}
              </div>
            </div>

            {/* 6. No-Show / Expired */}
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "अनुपस्थित/समाप्त" : "No-Show / Exp."}
                </span>
                <UserX size={14} color="#EF4444" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#EF4444", marginTop: "4px", lineHeight: "1" }}>
                {noShowExpiredMetric}
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "अनुपस्थित / समय समाप्त" : "Missed or expired slots"}
              </div>
            </div>

            {/* 7. Average Wait */}
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "औसत प्रतीक्षा" : "Avg. Wait"}
                </span>
                <Sliders size={14} color="#0284C7" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#0284C7", marginTop: "4px", lineHeight: "1" }}>
                ~{avgWaitMinutes}m
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "वर्तमान कतार विलंब" : "Live queue wait time"}
              </div>
            </div>

            {/* 8. Average Scan Time */}
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "14px",
                padding: "10px 14px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText, textTransform: "uppercase" }}>
                  {isHi ? "औसत स्कैन" : "Avg. Scan"}
                </span>
                <Activity size={14} color="#38BDF8" />
              </div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#38BDF8", marginTop: "4px", lineHeight: "1" }}>
                ~{avgScanTimeMinutes}m
              </div>
              <div style={{ fontSize: "10.5px", color: mutedText, marginTop: "4px" }}>
                {isHi ? "प्रोटोकॉल मानक समय" : "Standard scan protocol"}
              </div>
            </div>
          </div>

          {/* 2. SUB-VIEW CONTROLS & FILTERS BAR */}
          <div
            style={{
              background: "var(--rad-card-bg, #FFFFFF)",
              border: "var(--rad-card-border, #E2E8F0)",
              borderRadius: "16px",
              padding: "14px 16px",
              boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Top Row: Sub-view Switcher & Quick Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              {/* Segmented Sub-view Switcher */}
              <div
                style={{
                  display: "inline-flex",
                  background: isDark ? "#0F172A" : "#F1F5F9",
                  padding: "4px",
                  borderRadius: "12px",
                  border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                  gap: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setQueueSubView("queue")}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "9px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: queueSubView === "queue" ? 800 : 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    background: queueSubView === "queue" ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : "transparent",
                    color: queueSubView === "queue" ? "#FFFFFF" : mutedText,
                    boxShadow: queueSubView === "queue" ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: queueSubView === "queue" ? "#38BDF8" : "#94A3B8", display: "inline-block" }} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Activity size={13} /> {isHi ? "लाइव कतार" : "Live Queue"}</span>
                  <span
                    style={{
                      fontSize: "10.5px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: queueSubView === "queue" ? "rgba(255,255,255,0.25)" : (isDark ? "#1E293B" : "#E2E8F0"),
                      color: queueSubView === "queue" ? "#FFFFFF" : mutedText,
                      fontWeight: 800,
                    }}
                  >
                    {combinedLiveQueue.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQueueSubView("appointments")}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "9px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: queueSubView === "appointments" ? 800 : 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    background: queueSubView === "appointments" ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : "transparent",
                    color: queueSubView === "appointments" ? "#FFFFFF" : mutedText,
                    boxShadow: queueSubView === "appointments" ? "0 2px 8px rgba(2, 132, 199, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <CalendarCheck size={14} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><CalendarCheck size={13} /> {isHi ? "आज की अपॉइंटमेंट्स" : "Today's Appointments"}</span>
                  <span
                    style={{
                      fontSize: "10.5px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: queueSubView === "appointments" ? "rgba(255,255,255,0.25)" : (isDark ? "#1E293B" : "#E2E8F0"),
                      color: queueSubView === "appointments" ? "#FFFFFF" : mutedText,
                      fontWeight: 800,
                    }}
                  >
                    {todayAppointmentsFiltered.length}
                  </span>
                </button>
              </div>

              {/* Call Next & Refresh Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    fetchRadiologyAppointments();
                    if (refreshData) refreshData();
                    showToast(isHi ? "कतार डेटा रीफ्रेश हुआ" : "Queue refreshed", "info");
                  }}
                  style={{
                    background: isDark ? "#1E293B" : "#F1F5F9",
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    color: textColor,
                    padding: "7px 12px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                  title="Refresh Queue & Appointments"
                >
                  <RefreshCw size={13} />
                  <span>{isHi ? "रीफ्रेश" : "Refresh"}</span>
                </button>

                {Array.isArray(radiologyQueue) && radiologyQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCallNext}
                    disabled={callingNext}
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "7px 14px",
                      borderRadius: "10px",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      cursor: callingNext ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                      opacity: callingNext ? 0.7 : 1,
                    }}
                  >
                    <Volume2 size={14} className={callingNext ? "spin-icon" : ""} />
                    <span>{callingNext ? (isHi ? "कॉल जारी है..." : "Calling...") : (isHi ? "अगला मरीज़ बुलाएं" : "Call Next Patient")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Filters Strip (Modality Chips + Priority + Status + Search) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                borderTop: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9",
                paddingTop: "10px",
              }}
            >
              {/* Modality Chips */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, textTransform: "uppercase", marginRight: "2px" }}>
                  {isHi ? "मोडैलिटी:" : "Modality:"}
                </span>
                {[
                  { id: "all", label: isHi ? "सभी" : "All" },
                  { id: "X-Ray", label: "X-Ray" },
                  { id: "CT", label: "CT Scan" },
                  { id: "MRI", label: "MRI" },
                  { id: "USG", label: "USG" },
                ].map((m) => {
                  const isSelected = queueModalityFilter === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setQueueModalityFilter(m.id)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: isSelected ? 800 : 700,
                        cursor: "pointer",
                        border: isSelected ? "1.5px solid #0284C7" : isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                        background: isSelected
                          ? (isDark ? "rgba(2, 132, 199, 0.25)" : "#E0F2FE")
                          : (isDark ? "#0F172A" : "#F8FAFC"),
                        color: isSelected ? "#0284C7" : mutedText,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Status & Priority Selectors + Search Input */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {/* Priority Filter */}
                <select
                  value={queuePriorityFilter}
                  onChange={(e) => setQueuePriorityFilter(e.target.value)}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    color: textColor,
                    outline: "none",
                  }}
                >
                  <option value="all">{isHi ? "प्राथमिकता: सभी" : "Priority: All"}</option>
                  <option value="emergency">{isHi ? "आपातकालीन (Emergency)" : "Emergency (P1)"}</option>
                  <option value="urgent">{isHi ? "अत्यावश्यक (Urgent)" : "Urgent (P2)"}</option>
                  <option value="routine">{isHi ? "सामान्य (Routine)" : "Routine (P3)"}</option>
                </select>

                {/* Status Filter */}
                <select
                  value={queueStatusFilter}
                  onChange={(e) => setQueueStatusFilter(e.target.value)}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    color: textColor,
                    outline: "none",
                  }}
                >
                  <option value="all">{isHi ? "स्थिति: सभी" : "Status: All"}</option>
                  {queueSubView === "queue" ? (
                    <>
                      <option value="waiting">{isHi ? "प्रतीक्षारत (Waiting)" : "Waiting in Queue"}</option>
                      <option value="serving">{isHi ? "स्कैन जारी (Serving)" : "Currently Serving"}</option>
                      <option value="on_hold">{isHi ? "होल्ड पर (On Hold)" : "On 10-min Hold"}</option>
                    </>
                  ) : (
                    <>
                      <option value="booked">{isHi ? "आरक्षित (Booked)" : "Booked / Scheduled"}</option>
                      <option value="checked_in">{isHi ? "चेक-इन पूर्ण (Checked In)" : "Checked In"}</option>
                      <option value="expired">{isHi ? "समय समाप्त (Expired)" : "Expired Slots"}</option>
                      <option value="cancelled">{isHi ? "रद्द (Cancelled)" : "Cancelled"}</option>
                    </>
                  )}
                </select>

                {/* Search Box */}
                <div style={{ position: "relative", minWidth: "160px", maxWidth: "min(320px, 100%)", flex: "1 1 auto", boxSizing: "border-box" }}>
                  <Search size={13} style={{ position: "absolute", left: "9px", top: "8px", color: mutedText }} />
                  <input
                    type="text"
                    placeholder={isHi ? "नाम, टोकन, फ़ोन खोजें..." : "Search name, token or phone..."}
                    value={queueSearchQuery}
                    onChange={(e) => setQueueSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 10px 5px 28px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#F8FAFC",
                      color: textColor,
                      fontSize: "11.5px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {queueSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setQueueSearchQuery("")}
                      style={{
                        position: "absolute",
                        right: "6px",
                        top: "6px",
                        background: "none",
                        border: "none",
                        color: mutedText,
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    ><X size={15} /></button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. SUB-VIEW 1: LIVE QUEUE LIST */}
          {queueSubView === "queue" && (
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "16px",
                padding: "16px 18px",
                boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 900, color: textColor, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{isHi ? "लाइव रेडियोलॉजी कतार स्ट्रीम" : "Live Radiology & Diagnostic Stream"}</span>
                    <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE", color: "#0284C7" }}>
                      {combinedLiveQueue.length} {isHi ? "मरीज़" : "Patients"}
                    </span>
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: mutedText }}>
                    {isHi
                      ? "आपातकालीन ट्राइएज वरीयता क्रम में क्रमबद्ध • प्रत्येक मरीज़ हेतु प्री-स्कैन प्रोटोकॉल सत्यापन"
                      : "Sorted emergency first, then by wait time • Live wait timer & modality pre-scan safety checklist"}
                  </p>
                </div>

                <div style={{ fontSize: "11px", fontWeight: 700, color: mutedText, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444" }} /> {isHi ? "आपातकाल" : "Emergency (P1)"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748B" }} /> {isHi ? "अत्यावश्यक" : "Urgent (P2)"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0284C7" }} /> {isHi ? "सामान्य" : "Routine (P3)"}
                  </span>
                </div>
              </div>

              {combinedLiveQueue.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 10px", color: mutedText }}>
                  <Scan size={40} style={{ opacity: 0.3, margin: "0 auto 10px auto" }} />
                  <div style={{ fontSize: "14px", fontWeight: 800, color: textColor }}>
                    {isHi ? "कतार में कोई मरीज़ नहीं है" : "No patients in live radiology queue"}
                  </div>
                  <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                    {queueSearchQuery || queueModalityFilter !== "all" || queuePriorityFilter !== "all"
                      ? (isHi ? "फ़िल्टर बदलकर देखें" : "Try clearing filters to see waiting patients")
                      : (isHi ? "जब मरीज़ चेक-इन करेंगे तो यहाँ प्रदर्शित होंगे" : "Patients will appear here automatically when checked in")}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {combinedLiveQueue.map((ticket) => {
                    const patientKey = `ticket_${ticket.ticket_id}`;
                    const pState = prepState[patientKey] || { items: {}, prepDone: false };
                    const isPrepDone = Boolean(pState.prepDone);
                    const prepItems = getPrepChecklistItems(ticket);
                    const mod = detectItemModality(ticket);
                    const bodyP = detectItemBodyPart(ticket);
                    const isEmergency = Number(ticket.priority_level || ticket.priority) === 1 || String(ticket.priority || "").toLowerCase().includes("emerg");
                    const isUrgent = Number(ticket.priority_level || ticket.priority) === 2 || String(ticket.priority || "").toLowerCase().includes("urg");
                    const isServing = ticket._queueCategory === "serving";
                    const isHeld = ticket._queueCategory === "on_hold";

                    // Wait Time Calculation
                    const rawJoin = ticket.join_timestamp
                      ? (Number(ticket.join_timestamp) > 1e11 ? Number(ticket.join_timestamp) / 1000 : Number(ticket.join_timestamp))
                      : (ticket.created_at ? new Date(ticket.created_at).getTime() / 1000 : nowSec);
                    const joinSec = isNaN(rawJoin) ? nowSec : rawJoin;
                    const elapsedSec = Math.max(0, nowSec - joinSec);
                    const elapsedMin = Math.floor(elapsedSec / 60);
                    const elapsedRemSec = Math.floor(elapsedSec % 60);
                    const isOverdueWait = elapsedMin >= 30;
                    const isModerateWait = elapsedMin >= 15;

                    // Referring Doctor
                    let docRef = "General OPD";
                    try {
                      const p = typeof ticket.prescription_notes === "object" ? ticket.prescription_notes : JSON.parse(ticket.prescription_notes || "{}");
                      if (p?.doctor_name) docRef = `${p.doctor_name} (${p.doctor_department || "OPD"})`;
                    } catch (_) { }

                    return (
                      <div
                        key={ticket.ticket_id}
                        style={{
                          background: isServing
                            ? (isDark ? "rgba(2, 132, 199, 0.08)" : "#F0F9FF")
                            : isHeld
                              ? (isDark ? "rgba(100, 116, 139, 0.08)" : "#F1F5F9")
                              : isEmergency
                                ? (isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2")
                                : (isDark ? "#0F172A" : "#F8FAFC"),
                          border: isServing
                            ? "1.5px solid #0284C7"
                            : isHeld
                              ? "1.5px solid #64748B"
                              : isEmergency
                                ? "1.5px solid #EF4444"
                                : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                          borderRadius: "14px",
                          padding: "12px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Row 1: Patient Header, Badges, Timer & Actions */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          {/* Left: Token & Patient Info */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            {/* Token Badge */}
                            <div
                              style={{
                                padding: "6px 12px",
                                borderRadius: "10px",
                                background: isEmergency ? "#EF4444" : isUrgent ? "#64748B" : "#0284C7",
                                color: "#FFFFFF",
                                fontWeight: 900,
                                fontSize: "14px",
                                letterSpacing: "-0.2px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                boxShadow: isEmergency ? "0 2px 10px rgba(239, 68, 68, 0.4)" : "none",
                              }}
                            >
                              
                              <span>#{ticket.ticket_id}</span>
                            </div>

                            {/* Patient Demographics */}
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 800, fontSize: "14px", color: textColor }}>
                                  {ticket.name || ticket.patient_name || "Patient"}
                                </span>
                                <span style={{ fontSize: "12px", color: mutedText, fontWeight: 600 }}>
                                  {ticket.age || 30}y / {ticket.gender || "M"}
                                </span>
                                {ticket.phone && (
                                  <span style={{ fontSize: "11.5px", color: mutedText }}>
                                    • {ticket.phone}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px", flexWrap: "wrap" }}>
                                {/* Modality & Body Part Tag */}
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    background: isDark ? "rgba(56, 189, 248, 0.15)" : "#E0F2FE",
                                    color: isDark ? "#38BDF8" : "#0284C7",
                                    border: "1px solid rgba(56, 189, 248, 0.3)",
                                  }}
                                >
                                  {mod} • {bodyP}
                                </span>

                                {/* Referring Doctor */}
                                <span style={{ fontSize: "11px", color: mutedText, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <Stethoscope size={11} />
                                  <span>{isHi ? "रेफरल:" : "Ref:"} {docRef}</span>
                                </span>

                                {/* Priority Badge */}
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 900,
                                    padding: "2px 7px",
                                    borderRadius: "9999px",
                                    background: isEmergency ? "#FEE2E2" : isUrgent ? "#F1F5F9" : "#EFF6FF",
                                    color: isEmergency ? "#DC2626" : isUrgent ? "#475569" : "#2563EB",
                                    border: isEmergency ? "1px solid #FECACA" : isUrgent ? "1px solid #CBD5E1" : "1px solid #BFDBFE",
                                  }}
                                >
                                  {isEmergency ? (isHi ? "आपातकालीन" : "Emergency") : isUrgent ? (isHi ? "अत्यावश्यक" : "Urgent") : (isHi ? "सामान्य" : "Routine")}
                                </span>

                                {/* Status Badge */}
                                {isServing ? (
                                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", background: "#0284C7", color: "#FFFFFF" }}>
                                    {isHi ? "स्कैन जारी" : "Serving"}
                                  </span>
                                ) : isHeld ? (
                                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", background: "#64748B", color: "#FFFFFF" }}>
                                    {isHi ? "होल्ड (10 मिनट)" : "On Hold"}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", background: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE", color: "#0284C7", border: "1px solid rgba(2, 132, 199, 0.3)" }}>
                                    {isHi ? "प्रतीक्षारत" : "Waiting"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Wait Timer & Operational Action Buttons */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {/* Live Wait Timer */}
                            <div
                              style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: isOverdueWait
                                  ? (isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2")
                                  : isModerateWait
                                    ? (isDark ? "rgba(100, 116, 139, 0.2)" : "#F1F5F9")
                                    : (isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE"),
                                color: isOverdueWait ? "#DC2626" : isModerateWait ? "#475569" : "#0284C7",
                                border: isOverdueWait ? "1px solid #FECACA" : isModerateWait ? "1px solid #CBD5E1" : "1px solid #BAE6FD",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontVariantNumeric: "tabular-nums",
                              }}
                              title={isHi ? `प्रतीक्षा समय: ${elapsedMin} मिनट ${elapsedRemSec} सेकंड` : `Live Waiting Duration: ${elapsedMin}m ${elapsedRemSec}s`}
                            >
                              <Clock size={12} />
                              <span>{isHi ? "प्रतीक्षा:" : "Wait:"} {elapsedMin}m {elapsedRemSec}s</span>
                            </div>

                            {/* Call Patient Button */}
                            <button
                              type="button"
                              onClick={() => handleCallWithPrepCheck(ticket)}
                              style={{
                                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                color: "#FFFFFF",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                              }}
                              title="Call patient to radiology scanner"
                            >
                              <Volume2 size={13} />
                              <span>{isHi ? "कॉल" : "Call"}</span>
                            </button>

                            {/* Hold Button */}
                            <button
                              type="button"
                              onClick={() => handleHold(ticket)}
                              style={{
                                background: isDark ? "rgba(100, 116, 139, 0.15)" : "#F1F5F9",
                                border: "1px solid #64748B",
                                color: "#475569",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Place on 10-minute grace window hold"
                            >
                              <Coffee size={12} />
                              <span>{isHi ? "होल्ड" : "Hold"}</span>
                            </button>

                            {/* No-Show Button */}
                            <button
                              type="button"
                              onClick={() => handleFinalizeNoShow(ticket)}
                              style={{
                                background: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
                                border: "1px solid #EF4444",
                                color: "#DC2626",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Mark as absent / No-Show"
                            >
                              <UserX size={12} />
                              <span>{isHi ? "अनुपस्थित" : "No-Show"}</span>
                            </button>

                            {/* Transfer Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setTransferTicket(ticket);
                                setTransferTargetDept("");
                                setTransferNotes("");
                              }}
                              style={{
                                background: isDark ? "#1E293B" : "#F1F5F9",
                                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                                color: textColor,
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Transfer patient to another department"
                            >
                              <Send size={12} />
                              <span>{isHi ? "ट्रांसफर" : "Transfer"}</span>
                            </button>

                            {/* Load into Workstation */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedServingTicket(ticket);
                                setActiveTab("workstation");
                                showToast(isHi ? `टोकन #${ticket.ticket_id} को वर्कस्टेशन में लोड किया गया` : `Loaded #${ticket.ticket_id} into workstation`, "info");
                              }}
                              style={{
                                background: "transparent",
                                border: "1px dashed #0284C7",
                                color: "#0284C7",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Open in Imaging Workstation tab"
                            >
                              <Scan size={12} />
                              <span>{isHi ? "वर्कस्टेशन में खोलें" : "Workstation"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Clinical Prep Checklist Accordion / Capsule */}
                        <div
                          style={{
                            background: isDark ? "#0F172A" : "#FFFFFF",
                            border: isPrepDone ? "1px solid #0284C7" : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                            borderRadius: "10px",
                            padding: "8px 12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          {/* Checklist Items list */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 800, color: isPrepDone ? "#0284C7" : "#475569" }}>
                                {isPrepDone ? (isHi ? "तैयारी सत्यापित:" : "Prep verified:") : (isHi ? "तैयारी चेकलिस्ट:" : "Prep checklist:")}
                              </span>
                            </div>

                            {prepItems.map((item) => {
                              const isChecked = Boolean(pState.items?.[item.id] || isPrepDone);
                              return (
                                <label
                                  key={item.id}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    cursor: "pointer",
                                    fontSize: "11px",
                                    fontWeight: isChecked ? 700 : 600,
                                    color: isChecked ? (isDark ? "#38BDF8" : "#0369A1") : (item.isWarning ? "#EF4444" : textColor),
                                    background: isChecked ? (isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE") : (isDark ? "#1E293B" : "#F1F5F9"),
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    border: isChecked ? "1px solid #0284C7" : "1px solid transparent",
                                    userSelect: "none",
                                  }}
                                  title={item.hint}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePrepItem(patientKey, item.id)}
                                    style={{ cursor: "pointer", width: "12px", height: "12px", accentColor: "#0284C7" }}
                                  />
                                  <span>{item.tag || item.label}</span>
                                </label>
                              );
                            })}
                          </div>

                          {/* "Mark Prep Done" Toggle Button */}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {isPrepDone ? (
                              <button
                                type="button"
                                onClick={() => setPatientPrepDone(patientKey, false)}
                                style={{
                                  background: "#E0F2FE",
                                  border: "1px solid #0284C7",
                                  color: "#0369A1",
                                  padding: "3px 10px",
                                  borderRadius: "6px",
                                  fontSize: "10.5px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Click to edit or uncheck prep"
                              >
                                <Check size={12} />
                                <span>{isHi ? "तैयारी पूर्ण" : "Prep done"}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPatientPrepDone(patientKey, true)}
                                style={{
                                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                  color: "#FFFFFF",
                                  border: "none",
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  fontSize: "10.5px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  boxShadow: "0 1px 4px rgba(2, 132, 199, 0.3)",
                                }}
                                title="Verify all fasting, contrast, metal screening checks"
                              >
                                <Check size={12} />
                                <span>{isHi ? "तैयारी पूर्ण करें (Mark Prep Done)" : "Mark Prep Done"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. SUB-VIEW 2: TODAY'S APPOINTMENTS (GROUPED BY TIME SLOT) */}
          {queueSubView === "appointments" && (
            <div
              style={{
                background: "var(--rad-card-bg, #FFFFFF)",
                border: "var(--rad-card-border, #E2E8F0)",
                borderRadius: "16px",
                padding: "16px 18px",
                boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 900, color: textColor, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{isHi ? "आज की शेड्यूल्ड रेडियोलॉजी अपॉइंटमेंट्स" : "Today's Scheduled Imaging Appointments"}</span>
                    <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(99, 102, 241, 0.2)" : "#E0F2FE", color: "#0284C7" }}>
                      {todayAppointmentsFiltered.length} {isHi ? "अपॉइंटमेंट्स" : "Bookings"}
                    </span>
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: mutedText }}>
                    {isHi
                      ? "समय स्लॉट वार समूहीकृत • मैन्युअल चेक-इन, रद्दीकरण एवं विलंबित मरीज़ मार्कर"
                      : "Grouped by time slot • Manual check-in to live queue, cancellation & late arrival markers"}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => fetchRadiologyAppointments(true)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "8px",
                      background: isDark ? "#1E293B" : "#F1F5F9",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      color: textColor,
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <RefreshCw size={12} className={appointmentsLoading ? "spin-icon" : ""} />
                    <span>{isHi ? "रीलोड" : "Reload"}</span>
                  </button>
                </div>
              </div>

              {appointmentsLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#0284C7" }}>
                  <RefreshCw size={24} className="spin-icon" style={{ margin: "0 auto 8px auto" }} />
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "अपॉइंटमेंट्स लोड हो रही हैं..." : "Loading appointments..."}</div>
                </div>
              ) : Object.keys(appointmentsBySlot).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 10px", color: mutedText }}>
                  <Calendar size={40} style={{ opacity: 0.3, margin: "0 auto 10px auto" }} />
                  <div style={{ fontSize: "14px", fontWeight: 800, color: textColor }}>
                    {isHi ? "आज के लिए कोई अपॉइंटमेंट नहीं मिली" : "No appointments scheduled for today matching filters"}
                  </div>
                  <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
                    {queueSearchQuery || queueModalityFilter !== "all"
                      ? (isHi ? "फ़िल्टर साफ़ करके पुनः प्रयास करें" : "Try resetting your search query or modality filter")
                      : (isHi ? "नए अपॉइंटमेंट्स ऑनलाइन पोर्टल के माध्यम से बुक किए जा सकते हैं" : "New appointments booked via patient portal will appear here")}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {Object.entries(appointmentsBySlot).map(([slotKey, slotApts]) => (
                    <div
                      key={slotKey}
                      style={{
                        background: isDark ? "#0F172A" : "#F8FAFC",
                        border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                        borderRadius: "14px",
                        padding: "12px",
                      }}
                    >
                      {/* Slot Header Banner */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "10px",
                          paddingBottom: "8px",
                          borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 900, color: isDark ? "#38BDF8" : "#0284C7" }}>
                            {slotKey}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: mutedText }}>
                            ({slotApts.length} {slotApts.length === 1 ? (isHi ? "अपॉइंटमेंट" : "Appointment") : (isHi ? "अपॉइंटमेंट्स" : "Appointments")})
                          </span>
                        </div>
                      </div>

                      {/* Appointments Cards inside slot */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {slotApts.map((apt) => {
                          const rawStatus = (apt.status || "booked").toLowerCase();
                          const isCheckedIn = rawStatus === "checked_in" || Boolean(apt.ticket_id && rawStatus !== "cancelled" && rawStatus !== "expired");
                          const isCancelled = rawStatus === "cancelled";
                          const isExpired = rawStatus === "expired";
                          const isLate = isAppointmentLate(apt);
                          const isCheckinOpen = !isCheckedIn && !isCancelled && !isExpired;

                          const patientKey = `apt_${apt.appointment_id}`;
                          const pState = prepState[patientKey] || { items: {}, prepDone: false };
                          const isPrepDone = Boolean(pState.prepDone);
                          const prepItems = getPrepChecklistItems(apt);
                          const mod = detectItemModality(apt);
                          const bodyP = detectItemBodyPart(apt);

                          return (
                            <div
                              key={apt.appointment_id}
                              style={{
                                background: isCheckedIn
                                  ? (isDark ? "rgba(2, 132, 199, 0.08)" : "#F0F9FF")
                                  : isLate
                                    ? (isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2")
                                    : (isDark ? "#0F172A" : "#FFFFFF"),
                                border: isCheckedIn
                                  ? "1px solid #0284C7"
                                  : isLate
                                    ? "1.5px solid #EF4444"
                                    : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                                borderRadius: "12px",
                                padding: "10px 14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                }}
                              >
                                {/* Left: Info */}
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", fontFamily: "monospace" }}>
                                      #{apt.appointment_id}
                                    </span>
                                    <span style={{ fontWeight: 800, fontSize: "13.5px", color: textColor }}>
                                      {apt.patient_name || apt.name || "Patient"}
                                    </span>
                                    <span style={{ fontSize: "11.5px", color: mutedText }}>
                                      {apt.age ? `${apt.age}y / ` : ""}{apt.gender || "M"}
                                    </span>
                                    {apt.phone && (
                                      <span style={{ fontSize: "11.5px", color: mutedText }}>
                                        • {apt.phone}
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                                    <span
                                      style={{
                                        fontSize: "10.5px",
                                        fontWeight: 800,
                                        padding: "1px 6px",
                                        borderRadius: "5px",
                                        background: isDark ? "rgba(56, 189, 248, 0.15)" : "#E0F2FE",
                                        color: isDark ? "#38BDF8" : "#0284C7",
                                        border: "1px solid rgba(56, 189, 248, 0.3)",
                                      }}
                                    >
                                      {mod} • {bodyP}
                                    </span>

                                    {/* Status Chip */}
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        fontWeight: 800,
                                        padding: "2px 8px",
                                        borderRadius: "9999px",
                                        background: isCheckedIn
                                          ? "#E0F2FE"
                                          : isCancelled
                                            ? "#F1F5F9"
                                            : isExpired
                                              ? "#FEF2F2"
                                              : "#F1F5F9",
                                        color: isCheckedIn
                                          ? "#0369A1"
                                          : isCancelled
                                            ? "#64748B"
                                            : isExpired
                                              ? "#DC2626"
                                              : "#334155",
                                        border: isCheckedIn
                                          ? "1px solid #BAE6FD"
                                          : isCancelled
                                            ? "1px solid #CBD5E1"
                                            : isExpired
                                              ? "1px solid #FECACA"
                                              : "1px solid #CBD5E1",
                                      }}
                                    >
                                      {isCheckedIn
                                        ? `Checked in (#${apt.ticket_id || ""})`
                                        : isCancelled
                                          ? "Cancelled"
                                          : isExpired
                                            ? "Expired"
                                            : isCheckinOpen
                                              ? "Check-in Open"
                                              : "Booked"}
                                    </span>

                                    {/* Late Marker */}
                                    {isLate && (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 900,
                                          padding: "2px 7px",
                                          borderRadius: "9999px",
                                          background: "#EF4444",
                                          color: "#FFFFFF",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                          boxShadow: "0 1px 4px rgba(239, 68, 68, 0.3)",
                                        }}
                                      >
                                        <AlertTriangle size={11} color="#DC2626" />
                                        <span>{isHi ? "विलंबित मरीज़ (Late)" : "LATE / OVERDUE"}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Check-in & Cancel Actions */}
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  {!isCheckedIn && !isCancelled && !isExpired && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleCheckInAppointment(apt.appointment_id)}
                                        style={{
                                          background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                                          color: "#FFFFFF",
                                          border: "none",
                                          padding: "6px 12px",
                                          borderRadius: "8px",
                                          fontSize: "11.5px",
                                          fontWeight: 800,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                                        }}
                                        title="Issue queue token and check-in patient"
                                      >
                                        <CheckCircle2 size={13} />
                                        <span>{isHi ? "चेक-इन करें" : "Check-In"}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleCancelAppointment(apt.appointment_id)}
                                        style={{
                                          background: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
                                          border: "1px solid #EF4444",
                                          color: "#DC2626",
                                          padding: "6px 10px",
                                          borderRadius: "8px",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                        title="Cancel scheduled appointment"
                                      >
                                        {isHi ? "रद्द करें" : "Cancel"}
                                      </button>
                                    </>
                                  )}

                                  {isCheckedIn && (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#0284C7",
                                        fontWeight: 800,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      <CheckCircle2 size={14} />
                                      <span>{isHi ? `कतार में सक्रिय (#${apt.ticket_id || ""})` : `In Live Queue (#${apt.ticket_id || ""})`}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Prep Checklist Capsule on Appointment Card */}
                              <div
                                style={{
                                  background: isDark ? "#0F172A" : "#F8FAFC",
                                  border: isPrepDone ? "1px solid #0284C7" : (isDark ? "1px solid #1E293B" : "1px solid #E2E8F0"),
                                  borderRadius: "8px",
                                  padding: "6px 10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: 1 }}>
                                  <span style={{ fontSize: "10.5px", fontWeight: 800, color: isPrepDone ? "#0284C7" : "#475569" }}>
                                    {isPrepDone ? (isHi ? "तैयारी सत्यापित:" : "Prep verified:") : (isHi ? "तैयारी चेकलिस्ट:" : "Prep checklist:")}
                                  </span>
                                  {prepItems.map((item) => {
                                    const isChecked = Boolean(pState.items?.[item.id] || isPrepDone);
                                    return (
                                      <label
                                        key={item.id}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          cursor: "pointer",
                                          fontSize: "10.5px",
                                          fontWeight: isChecked ? 700 : 600,
                                          color: isChecked ? "#0284C7" : mutedText,
                                          background: isChecked ? (isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE") : "transparent",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          border: isChecked ? "1px solid #0284C7" : "none",
                                        }}
                                        title={item.hint}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => togglePrepItem(patientKey, item.id)}
                                          style={{ cursor: "pointer", width: "11px", height: "11px", accentColor: "#0284C7" }}
                                        />
                                        <span>{item.tag || item.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>

                                <div>
                                  {isPrepDone ? (
                                    <button
                                      type="button"
                                      onClick={() => setPatientPrepDone(patientKey, false)}
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#0284C7",
                                        fontSize: "10.5px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                      }}
                                    >
                                      {isHi ? "पूर्ण" : "Prep done"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setPatientPrepDone(patientKey, true)}
                                      style={{
                                        background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                                        border: "1px solid #0284C7",
                                        color: "#0369A1",
                                        padding: "2px 8px",
                                        borderRadius: "5px",
                                        fontSize: "10px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                      }}
                                    >
                                      {isHi ? "तैयारी सत्यापित करें" : "Mark prep done"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. MODAL: DEDICATED QUEUE TICKET TRANSFER */}
          {transferTicket && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "16px",
              }}
              onClick={() => setTransferTicket(null)}
            >
              <div
                style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: "16px",
                  padding: "20px 24px",
                  maxWidth: "min(460px, calc(100vw - 32px))",
                  width: "100%",
                  boxSizing: "border-box",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: textColor }}>
                    {isHi ? "मरीज़ को अन्य विभाग में स्थानांतरित करें" : "Transfer Queue Patient"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTransferTicket(null)}
                    style={{ background: "none", border: "none", color: mutedText, fontSize: "16px", cursor: "pointer" }}
                  ><X size={15} /></button>
                </div>

                <div style={{ padding: "10px 12px", borderRadius: "10px", background: isDark ? "#0F172A" : "#F0F9FF", border: "1px solid #BAE6FD", marginBottom: "14px" }}>
                  <div style={{ fontWeight: 800, fontSize: "13px", color: "#0284C7" }}>
                    #{transferTicket.ticket_id} • {transferTicket.name || transferTicket.patient_name}
                  </div>
                  <div style={{ fontSize: "11.5px", color: mutedText, marginTop: "2px" }}>
                    {isHi ? "वर्तमान विभाग: रेडियोलॉजी / इमेजिंग" : "Current: Radiology & Diagnostic Imaging"}
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 800, display: "block", marginBottom: "6px", color: textColor }}>
                    {isHi ? "गंतव्य विभाग चुनें:" : "Select Destination Department:"}
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                    {availableRouteDepartments.map((dept) => {
                      const isSel = transferTargetDept === dept.id;
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => setTransferTargetDept(dept.id)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            fontSize: "11.5px",
                            fontWeight: isSel ? 800 : 600,
                            background: isSel ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : (isDark ? "#1E293B" : "#F8FAFC"),
                            border: isSel ? "1.5px solid #38BDF8" : (isDark ? "1px solid #334155" : "1px solid #CBD5E1"),
                            color: isSel ? "#FFFFFF" : textColor,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          {isHi ? dept.labelHi : dept.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 800, display: "block", marginBottom: "6px", color: textColor }}>
                    {isHi ? "स्थानांतरण टिप्पणी (वैकल्पिक):" : "Transfer Notes (Optional):"}
                  </label>
                  <input
                    type="text"
                    placeholder={isHi ? "जैसे: स्कैन पूर्ण, परामर्श हेतु वापस भेजा जा रहा है" : "e.g. Scan done, routed back for clinical consultation"}
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      color: textColor,
                      fontSize: "12px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setTransferTicket(null)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                      background: "transparent",
                      color: mutedText,
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isHi ? "रद्द करें" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={!transferTargetDept || isTransferringQueueTicket}
                    onClick={handleExecuteQueueTransfer}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: transferTargetDept ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)" : (isDark ? "#334155" : "#E2E8F0"),
                      color: transferTargetDept ? "#FFFFFF" : "#94A3B8",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: transferTargetDept ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Send size={13} />
                    <span>{isTransferringQueueTicket ? (isHi ? "स्थानांतरण..." : "Transferring...") : (isHi ? "स्थानांतरित करें" : "Transfer Patient")}</span>
                  </button>
                </div>
              </div>
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
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
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
                  boxShadow: "0 2px 10px rgba(2, 132, 199, 0.3)",
                  transition: "all 0.15s ease",
                }}
              >
                <Download size={14} />
                <span>{isHi ? "Excel निर्यात" : "Export Excel"}</span>
              </button>
            </div>
          </div>

          {/* Secondary Controls Bar: Status Filter Pills + Search */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              padding: "8px 12px",
              background: isDark ? "rgba(15, 23, 42, 0.6)" : "#F8FAFC",
              borderRadius: "12px",
              border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {/* Status Filter Chips */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: mutedText, marginRight: "4px" }}>
                {isHi ? "स्थिति:" : "Status:"}
              </span>

              {[
                { id: "all", label: isHi ? "सभी" : "All", count: historyCounts.all, color: "#0284C7" },
                { id: "completed", label: isHi ? "पूर्ण" : "Completed", count: historyCounts.completed, color: "#0369A1" },
                { id: "cancelled", label: isHi ? "रद्द" : "Cancelled", count: historyCounts.cancelled, color: "#DC2626" },
                { id: "no_show", label: isHi ? "अनुपस्थित" : "No-Show", count: historyCounts.noShow, color: "#475569" },
              ].map((pill) => {
                const isActive = historyStatusFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setHistoryStatusFilter(pill.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 800,
                      cursor: "pointer",
                      border: isActive
                        ? `1.5px solid ${pill.color}`
                        : isDark
                        ? "1px solid #334155"
                        : "1px solid #CBD5E1",
                      background: isActive
                        ? (isDark ? "rgba(255, 255, 255, 0.08)" : "#FFFFFF")
                        : "transparent",
                      color: isActive ? pill.color : mutedText,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      transition: "all 0.15s ease",
                      boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    <span>{pill.label}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 900,
                        padding: "1px 5px",
                        borderRadius: "9999px",
                        background: isActive ? pill.color : (isDark ? "#334155" : "#E2E8F0"),
                        color: isActive ? "#FFFFFF" : mutedText,
                      }}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: isDark ? "#0F172A" : "#FFFFFF",
                border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "4px 10px",
                minWidth: "220px",
                maxWidth: "320px",
                flex: "1 1 auto",
              }}
            >
              <Search size={13} style={{ color: mutedText, marginRight: "6px", flexShrink: 0 }} />
              <input
                type="text"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder={isHi ? "नाम, टोकन, फोन या कारण..." : "Filter by name, token, phone, reason..."}
                style={{
                  border: "none",
                  background: "transparent",
                  color: textColor,
                  fontSize: "11.5px",
                  outline: "none",
                  width: "100%",
                }}
              />
              {archiveSearch && (
                <button
                  type="button"
                  onClick={() => setArchiveSearch("")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: mutedText,
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: mutedText }}>
              <History size={36} style={{ opacity: 0.35, margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{isHi ? "इस तिथि का कोई रिकॉर्ड नहीं मिला" : "No imaging records found for the selected filter"}</div>
            </div>
          ) : (
            <div className="staff-table-scroll-wrapper" style={{ overflowX: "auto", width: "100%", maxWidth: "100%", boxSizing: "border-box", borderRadius: "14px", border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0", background: cardBg, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <table style={{ width: "100%", minWidth: "980px", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: isDark ? "#0F172A" : "#F1F5F9", borderBottom: isDark ? "1.5px solid #1E293B" : "1.5px solid #E2E8F0" }}>
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
                    const rawSt = String(item.status || "completed").toLowerCase();
                    const isCancelled = rawSt === "cancelled" || rawSt === "canceled";
                    const isNoShow = rawSt === "no_show" || rawSt === "noshow" || rawSt === "expired";
                    const isServing = rawSt === "serving" || rawSt === "in_progress";
                    const isWaiting = rawSt === "waiting" || rawSt === "queued";

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
                          background: isCancelled
                            ? (isDark ? "rgba(239, 68, 68, 0.05)" : "rgba(254, 242, 242, 0.6)")
                            : isNoShow
                            ? (isDark ? "rgba(245, 158, 11, 0.04)" : "rgba(255, 251, 235, 0.5)")
                            : "transparent",
                          opacity: isCancelled ? 0.92 : 1,
                        }}
                      >
                        <td style={{ padding: "6px 10px", color: mutedText }}>{idx + 1}</td>
                        <td style={{ padding: "6px 10px", color: mutedText }}>
                          <div>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</div>
                          {isCancelled && item.cancelled_at && (
                            <div style={{ fontSize: "10px", color: "#DC2626", marginTop: "2px", fontWeight: 600 }}>
                              {isHi ? "रद्द: " : "Cancelled: "}{new Date(item.cancelled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 800, color: isCancelled ? "#94A3B8" : "#0284C7", fontFamily: "monospace" }}>
                          #{item.ticket_id || "-"}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 700, color: textColor }}>
                          <div style={{ textDecoration: isCancelled ? "line-through" : "none", color: isCancelled ? (isDark ? "#94A3B8" : "#64748B") : textColor }}>
                            {item.patient_name || item.name || "Patient"}
                          </div>
                          {item.phone && (
                            <div style={{ fontSize: "10.5px", color: mutedText, fontWeight: 500 }}>
                              {item.phone}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "6px 10px", color: mutedText }}>
                          {item.age || 30}y / {item.gender || "M"}
                        </td>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>
                          <span style={{ textDecoration: isCancelled ? "line-through" : "none", color: isCancelled ? mutedText : textColor }}>
                            {radRep?.modality ? `${radRep.modality} - ${radRep.body_part}` : item.medical_condition || item.service_category || "Radiology"}
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          {isCancelled ? (
                            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  padding: "2px 8px",
                                  borderRadius: "9999px",
                                  background: isDark ? "rgba(239, 68, 68, 0.18)" : "#FEE2E2",
                                  color: "#DC2626",
                                  border: "1px solid rgba(239, 68, 68, 0.4)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title={item.cancellation_reason ? `Reason: ${item.cancellation_reason}` : (isHi ? "रद्द किया गया टोकन" : "Cancelled Ticket")}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626" }} />
                                {isHi ? "रद्द (Cancelled)" : "Cancelled"}
                              </span>
                              {item.cancellation_reason && (
                                <span
                                  style={{
                                    fontSize: "9.5px",
                                    color: "#DC2626",
                                    marginTop: "2px",
                                    maxWidth: "140px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                  title={item.cancellation_reason}
                                >
                                  {item.cancellation_reason}
                                </span>
                              )}
                            </div>
                          ) : isNoShow ? (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background: isDark ? "rgba(100, 116, 139, 0.18)" : "#F1F5F9",
                                color: "#475569",
                                border: "1px solid rgba(100, 116, 139, 0.4)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#475569" }} />
                              {isHi ? "अनुपस्थित (No-Show)" : "No-Show"}
                            </span>
                          ) : isServing ? (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background: isDark ? "rgba(2, 132, 199, 0.18)" : "#E0F2FE",
                                color: "#2563EB",
                                border: "1px solid rgba(2, 132, 199, 0.4)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB" }} />
                              {isHi ? "प्रक्रियाधीन" : "Serving"}
                            </span>
                          ) : isWaiting ? (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background: isDark ? "rgba(2, 132, 199, 0.18)" : "#E0F2FE",
                                color: "#0369A1",
                                border: "1px solid rgba(2, 132, 199, 0.4)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0369A1" }} />
                              {isHi ? "प्रतीक्षारत" : "Waiting"}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background: "#E0F2FE",
                                color: "#0369A1",
                                border: "1px solid rgba(2, 132, 199, 0.3)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0369A1" }} />
                              {isHi ? "पूर्ण (Completed)" : "Completed"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          {isCancelled ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: isDark ? "#EF4444" : "#DC2626",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontStyle: "italic",
                              }}
                              title={item.cancellation_reason || (isHi ? "यह टिकट रद्द कर दिया गया था" : "Ticket was cancelled")}
                            >
                              <XCircle size={12} />
                              <span>{isHi ? "रद्द (रिपोर्ट नहीं)" : "Cancelled (No Report)"}</span>
                            </span>
                          ) : isNoShow ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: mutedText,
                                fontStyle: "italic",
                              }}
                            >
                              {isHi ? "अनुपस्थित" : "No-Show"}
                            </span>
                          ) : (
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
                          )}
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

      {/* Route to Doctor — Department Picker Modal */}
      {showRouteDeptModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000000,
            padding: "20px",
          }}
          onClick={() => setShowRouteDeptModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? "#0F172A" : "#FFFFFF",
              borderRadius: "20px",
              border: isDark ? "1px solid #334155" : "1.5px solid #E2E8F0",
              padding: "24px",
              maxWidth: "min(520px, calc(100vw - 32px))",
              width: "100%",
              boxSizing: "border-box",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 25px 60px -12px rgba(0,0,0,0.4)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                  color: "#0284C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Send size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {isHi ? "विभाग चुनें — रिपोर्ट भेजें" : "Select Department — Route Report"}
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748B" }}>
                  {isHi
                    ? `टोकन #${activeServingTicket?.ticket_id || ""} को किस विभाग / डॉक्टर के पास भेजना है?`
                    : `Where should Token #${activeServingTicket?.ticket_id || ""} be routed after this study?`}
                </p>
              </div>
            </div>

            {/* Referring Doctor Info (if available) */}
            {(parsedDoctorRx?.doctor_name || activeServingTicket?.transferred_from_dept) && (
              <div style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: isDark ? "rgba(2, 132, 199, 0.1)" : "#E0F2FE",
                border: isDark ? "1px solid rgba(2, 132, 199, 0.3)" : "1px solid #BAE6FD",
                marginBottom: "14px",
                fontSize: "12px",
                color: isDark ? "#38BDF8" : "#0369A1",
                fontWeight: 700,
              }}>
                {isHi ? "संदर्भ चिकित्सक: " : "Referring Doctor: "}
                {parsedDoctorRx?.doctor_name || "—"} ({parsedDoctorRx?.doctor_department || activeServingTicket?.transferred_from_dept || "General"})
              </div>
            )}

            {/* Department Grid — Showing only actual active departments in this hospital */}
            <div style={{
              display: "grid",
              gridTemplateColumns: availableRouteDepartments.length > 4 ? "repeat(2, 1fr)" : "1fr",
              gap: "8px",
              marginBottom: "18px",
            }}>
              {availableRouteDepartments.map((dept) => {
                const isSelected = routeTargetDept === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setRouteTargetDept(dept.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: isSelected ? 800 : 600,
                      background: isSelected
                        ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                        : isDark ? "#1E293B" : "#F8FAFC",
                      border: isSelected
                        ? "1.5px solid #38BDF8"
                        : isDark ? "1px solid #334155" : "1px solid #E2E8F0",
                      color: isSelected ? "#FFFFFF" : isDark ? "#CBD5E1" : "#334155",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 3px 10px rgba(2, 132, 199, 0.3)" : "none",
                    }}
                  >
                    {isHi ? dept.labelHi : dept.label}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowRouteDeptModal(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #475569" : "1px solid #CBD5E1",
                  background: "transparent",
                  color: isDark ? "#CBD5E1" : "#64748B",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isHi ? "वापस जाएं" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={!routeTargetDept}
                onClick={async () => {
                  setShowRouteDeptModal(false);
                  await handleCompleteAndRouteToDoctor(routeTargetDept);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: routeTargetDept
                    ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                    : isDark ? "#334155" : "#E2E8F0",
                  color: routeTargetDept ? "#FFFFFF" : "#94A3B8",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: routeTargetDept ? "pointer" : "not-allowed",
                  boxShadow: routeTargetDept ? "0 4px 14px rgba(2, 132, 199, 0.35)" : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Send size={14} />
                {isHi ? "पूर्ण करें एवं भेजें" : "Complete & Route"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer matching standard portal layout */}
      <Footer language={language} hospitalBranding={hospitalBranding} theme={currentTheme} />
    </div>
  );
}
