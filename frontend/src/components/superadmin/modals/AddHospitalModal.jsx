import React, { useState, useEffect, useRef } from "react";
import {
    IconHospital,
    IconX,
    IconChevronLeft,
    IconChevronRight,
    IconCheckCircle,
    IconBuilding,
    IconPhone,
    IconClock,
    IconUser,
    IconPalette,
    IconPlus,
    IconTrash,
    IconCopy,
    IconEye,
    IconEyeOff,
    IconRefresh,
    IconSave,
} from "../SuperAdminIcons";
import {
    modalOverlayStyle,
    modalCloseIconBtnStyle,
    modalCancelBtnStyle,
    modalSubmitBtnStyle,
    fieldLabelStyle,
    fieldInputStyle,
} from "../superAdminStyles";

const HOSPITAL_TYPES = [
    { value: "Private", label: "Private Hospital", labelHi: "निजी अस्पताल" },
    { value: "Government", label: "Government Hospital", labelHi: "सरकारी अस्पताल" },
    { value: "Trust / Charitable", label: "Trust / Charitable", labelHi: "ट्रस्ट / चैरिटेबल" },
    { value: "Corporate Chain", label: "Corporate Chain", labelHi: "कॉर्पोरेट चेन" },
    { value: "Clinic / Nursing Home", label: "Clinic / Nursing Home", labelHi: "क्लिनिक / नर्सिंग होम" },
    { value: "Super-Specialty", label: "Super-Specialty", labelHi: "सुपर-स्पेशियलिटी" },
];

const NABH_OPTIONS = [
    { value: "Not Accredited", label: "Not Accredited", labelHi: "गैर-मान्यता प्राप्त" },
    { value: "Applied", label: "Applied / In Process", labelHi: "आवेदन प्रक्रियाधीन" },
    { value: "Accredited", label: "NABH Accredited", labelHi: "एनएबीएच मान्यता प्राप्त" },
];

const WORKING_DAYS_LIST = [
    { id: "Monday", label: "Mon", labelHi: "सोम" },
    { id: "Tuesday", label: "Tue", labelHi: "मंगल" },
    { id: "Wednesday", label: "Wed", labelHi: "बुध" },
    { id: "Thursday", label: "Thu", labelHi: "गुरु" },
    { id: "Friday", label: "Fri", labelHi: "शुक्र" },
    { id: "Saturday", label: "Sat", labelHi: "शनि" },
    { id: "Sunday", label: "Sun", labelHi: "रवि" },
];

const AVAILABLE_LANGUAGES = [
    "English", "Hindi", "Bengali", "Marathi", "Telugu", "Tamil", "Gujarati", "Kannada", "Urdu", "Malayalam", "Punjabi"
];

const DEFAULT_DEPARTMENTS = [
    { dept_code: "consultation", name: "General Consultation (OPD)", description: "General outpatient doctor examinations", enabled: true, desk_count: 1 },
    { dept_code: "pharmacy", name: "Pharmacy & Medicine", description: "Prescription dispensing and clinical pharmacy", enabled: true, desk_count: 1 },
    { dept_code: "laboratory", name: "Pathology & Lab Test", description: "Diagnostic blood, urine and pathology assays", enabled: true, desk_count: 1 },
    { dept_code: "radiology", name: "Radiology & X-Ray", description: "X-Ray, CT Scan, MRI and ultrasound imaging", enabled: true, desk_count: 1 },
    { dept_code: "emergency", name: "Emergency Triage", description: "Critical emergency resuscitation and trauma", enabled: true, desk_count: 1 },
    { dept_code: "billing", name: "Central Billing & Cashier", description: "OPD billing and fee collection counters", enabled: true, desk_count: 1 },
    { dept_code: "reception", name: "OPD Reception", description: "Patient registration and inquiry desk", enabled: true, desk_count: 1 },
];

function generateSlug(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 40);
}

function generateRandomPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pwd = "Hosp@";
    for (let i = 0; i < 6; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
}

export default function AddHospitalModal({
    isOpen,
    onClose,
    onHospitalCreated,
    apiBase = "",
    getAuthHeaders = () => ({}),
    notify = () => {},
    isHi = false,
}) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdResult, setCreatedResult] = useState(null);
    const [copiedCreds, setCopiedCreds] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        // Step 1: Basic Identity
        name: "",
        hospital_code: "",
        type: "Private",
        registration_no: "",
        nabh_status: "Not Accredited",
        nabh_number: "",
        nabh_valid_until: "",
        established_year: "",
        total_beds: "",
        icu_beds: "",
        logo_url: "",
        tagline: "",

        // Step 2: Contact & Location
        phone: "",
        alt_phone: "",
        emergency_helpline: "",
        email: "",
        support_email: "",
        website: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        pincode: "",
        country: "India",
        maps_link: "",

        // Step 3: Operations
        opd_start_time: "08:00",
        opd_end_time: "20:00",
        registration_cutoff: "20:00",
        timezone: "Asia/Kolkata",
        working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        departments: DEFAULT_DEPARTMENTS,
        languages: ["English", "Hindi"],

        // Step 4: Hospital Admin Account
        create_admin: true,
        admin_name: "",
        admin_email: "",
        admin_phone: "",
        admin_password: generateRandomPassword(),

        // Step 5: Branding & Review
        primary_color: "#0284C7",
        secondary_color: "#0369A1",
        accent_color: "#F0F9FF",
        about_us: "",
        description: "",
    });

    const [isCodeManual, setIsCodeManual] = useState(false);
    const [codeCheckStatus, setCodeCheckStatus] = useState(null); // { checking, available, valid, message }
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);

    // Custom department inline inputs
    const [customDeptName, setCustomDeptName] = useState("");
    const [customDeptCode, setCustomDeptCode] = useState("");
    const [customDeptDesks, setCustomDeptDesks] = useState(1);

    const debounceTimerRef = useRef(null);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setIsSubmitting(false);
            setCreatedResult(null);
            setCopiedCreds(false);
            setErrors({});
            setIsCodeManual(false);
            setCodeCheckStatus(null);
            setFormData({
                name: "",
                hospital_code: "",
                type: "Private",
                registration_no: "",
                nabh_status: "Not Accredited",
                nabh_number: "",
                nabh_valid_until: "",
                established_year: "",
                total_beds: "",
                icu_beds: "",
                logo_url: "",
                tagline: "",
                phone: "",
                alt_phone: "",
                emergency_helpline: "",
                email: "",
                support_email: "",
                website: "",
                address_line1: "",
                address_line2: "",
                city: "",
                state: "",
                pincode: "",
                country: "India",
                maps_link: "",
                opd_start_time: "08:00",
                opd_end_time: "20:00",
                registration_cutoff: "20:00",
                timezone: "Asia/Kolkata",
                working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                departments: DEFAULT_DEPARTMENTS,
                languages: ["English", "Hindi"],
                create_admin: true,
                admin_name: "",
                admin_email: "",
                admin_phone: "",
                admin_password: generateRandomPassword(),
                primary_color: "#0284C7",
                secondary_color: "#0369A1",
                accent_color: "#F0F9FF",
                about_us: "",
                description: "",
            });
        }
    }, [isOpen]);

    // Live code check
    const checkHospitalCode = (code) => {
        if (!code || code.length < 3) {
            setCodeCheckStatus(null);
            return;
        }
        if (!/^[a-z0-9-]+$/.test(code)) {
            setCodeCheckStatus({ checking: false, available: false, valid: false, message: isHi ? "केवल छोटे अक्षर, संख्या और हाइफ़न मान्य हैं" : "Only lowercase letters, digits, and hyphens allowed" });
            return;
        }

        setCodeCheckStatus({ checking: true, available: false, valid: true, message: isHi ? "जांच हो रही है..." : "Checking availability..." });

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`${apiBase}/api/v1/superadmin/hospitals/check-code?code=${encodeURIComponent(code)}`, {
                    headers: getAuthHeaders(),
                });
                const data = await res.json();
                if (res.ok && data.status === "success") {
                    setCodeCheckStatus({
                        checking: false,
                        available: data.available,
                        valid: data.valid,
                        message: data.message,
                    });
                } else {
                    setCodeCheckStatus({ checking: false, available: false, valid: false, message: data.message || "Failed to check code" });
                }
            } catch (err) {
                setCodeCheckStatus({ checking: false, available: true, valid: true, message: "" });
            }
        }, 350);
    };

    // Auto-slugify code when name changes
    const handleNameChange = (e) => {
        const val = e.target.value;
        const updated = { ...formData, name: val };
        if (!isCodeManual) {
            const slug = generateSlug(val);
            updated.hospital_code = slug;
            checkHospitalCode(slug);
        }
        setFormData(updated);
        if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
    };

    const handleCodeChange = (e) => {
        setIsCodeManual(true);
        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
        setFormData((prev) => ({ ...prev, hospital_code: val }));
        checkHospitalCode(val);
        if (errors.hospital_code) setErrors((prev) => ({ ...prev, hospital_code: null }));
    };

    // Logo upload
    const handleLogoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setErrors((prev) => ({ ...prev, logo: isHi ? "कृपया केवल इमेज फाइल चुनें" : "Please select an image file" }));
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setErrors((prev) => ({ ...prev, logo: isHi ? "इमेज 2MB से कम होनी चाहिए" : "Image size must be under 2MB" }));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setFormData((prev) => ({ ...prev, logo_url: reader.result }));
            setErrors((prev) => ({ ...prev, logo: null }));
        };
        reader.readAsDataURL(file);
    };

    // Toggle day
    const toggleWorkingDay = (day) => {
        setFormData((prev) => {
            const exists = prev.working_days.includes(day);
            const updated = exists ? prev.working_days.filter((d) => d !== day) : [...prev.working_days, day];
            return { ...prev, working_days: updated };
        });
    };

    // Toggle language
    const toggleLanguage = (lang) => {
        setFormData((prev) => {
            const exists = prev.languages.includes(lang);
            const updated = exists ? prev.languages.filter((l) => l !== lang) : [...prev.languages, lang];
            return { ...prev, languages: updated };
        });
    };

    // Department toggles & desk count changes
    const toggleDepartment = (deptCode) => {
        setFormData((prev) => ({
            ...prev,
            departments: prev.departments.map((d) => (d.dept_code === deptCode ? { ...d, enabled: !d.enabled } : d)),
        }));
    };

    const updateDeptDesks = (deptCode, count) => {
        const safeCount = Math.max(1, Math.min(20, parseInt(count, 10) || 1));
        setFormData((prev) => ({
            ...prev,
            departments: prev.departments.map((d) => (d.dept_code === deptCode ? { ...d, desk_count: safeCount } : d)),
        }));
    };

    const handleAddCustomDept = () => {
        const name = customDeptName.trim();
        const code = customDeptCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || generateSlug(name);
        if (!name) return;
        if (formData.departments.some((d) => d.dept_code === code)) {
            setErrors((prev) => ({ ...prev, customDept: isHi ? "यह विभाग कोड पहले से मौजूद है" : "This department code already exists" }));
            return;
        }
        setFormData((prev) => ({
            ...prev,
            departments: [
                ...prev.departments,
                {
                    dept_code: code,
                    name,
                    description: `${name} clinical department`,
                    enabled: true,
                    desk_count: Math.max(1, Math.min(20, parseInt(customDeptDesks, 10) || 1)),
                },
            ],
        }));
        setCustomDeptName("");
        setCustomDeptCode("");
        setCustomDeptDesks(1);
        setErrors((prev) => ({ ...prev, customDept: null }));
    };

    const handleRemoveCustomDept = (deptCode) => {
        setFormData((prev) => ({
            ...prev,
            departments: prev.departments.filter((d) => d.dept_code !== deptCode),
        }));
    };

    // Step Validation
    const validateStep = (s) => {
        const newErr = {};
        if (s === 1) {
            if (!formData.name.trim()) newErr.name = isHi ? "अस्पताल का नाम अनिवार्य है" : "Hospital Name is required";
            if (!formData.hospital_code.trim()) newErr.hospital_code = isHi ? "अस्पताल कोड अनिवार्य है" : "Hospital Code is required";
            else if (!/^[a-z0-9-]+$/.test(formData.hospital_code) || formData.hospital_code.length < 3 || formData.hospital_code.length > 40) {
                newErr.hospital_code = isHi ? "3-40 छोटे अक्षर, संख्या और हाइफ़न का उपयोग करें" : "Code must be 3-40 lowercase letters, digits, or hyphens";
            } else if (codeCheckStatus && codeCheckStatus.available === false) {
                newErr.hospital_code = isHi ? "यह कोड पहले से उपयोग में है" : "This hospital code is already taken";
            }
            if (formData.nabh_status === "Accredited" && !formData.nabh_number.trim()) {
                newErr.nabh_number = isHi ? "एनएबीएच संख्या अनिवार्य है" : "Accreditation Number is required for Accredited status";
            }
            if (formData.total_beds && parseInt(formData.total_beds, 10) < 0) {
                newErr.total_beds = isHi ? "बेड की संख्या शून्य या अधिक होनी चाहिए" : "Beds count cannot be negative";
            }
            if (formData.icu_beds && parseInt(formData.icu_beds, 10) < 0) {
                newErr.icu_beds = isHi ? "आईसीयू बेड शून्य या अधिक होने चाहिए" : "ICU beds count cannot be negative";
            }
        } else if (s === 2) {
            if (!formData.phone.trim()) newErr.phone = isHi ? "फोन नंबर अनिवार्य है" : "Phone number is required";
            if (!formData.email.trim()) newErr.email = isHi ? "आधिकारिक ईमेल अनिवार्य है" : "Official Email is required";
            else if (!/\S+@\S+\.\S+/.test(formData.email.trim())) newErr.email = isHi ? "मान्य ईमेल दर्ज करें" : "Enter a valid email address";
            if (!formData.address_line1.trim()) newErr.address_line1 = isHi ? "पता पंक्ति 1 अनिवार्य है" : "Address Line 1 is required";
            if (!formData.city.trim()) newErr.city = isHi ? "शहर अनिवार्य है" : "City is required";
            if (!formData.state.trim()) newErr.state = isHi ? "राज्य अनिवार्य है" : "State is required";
            if (!formData.pincode.trim()) newErr.pincode = isHi ? "पिन कोड अनिवार्य है" : "PIN code is required";
            else if (!/^\d{6}$/.test(formData.pincode.trim())) newErr.pincode = isHi ? "6 अंकों का पिन कोड दर्ज करें" : "Enter a valid 6-digit PIN code";
        } else if (s === 3) {
            const enabledDepts = formData.departments.filter((d) => d.enabled);
            if (enabledDepts.length === 0) {
                newErr.departments = isHi ? "कम से कम 1 विभाग सक्षम होना चाहिए" : "At least one department must be enabled";
            }
            if (formData.opd_start_time && formData.opd_end_time && formData.opd_start_time >= formData.opd_end_time) {
                newErr.opd_time = isHi ? "ओपीडी प्रारंभ समय समाप्ति समय से पहले होना चाहिए" : "OPD start time must be earlier than end time";
            }
        } else if (s === 4) {
            if (formData.create_admin) {
                if (!formData.admin_name.trim()) newErr.admin_name = isHi ? "व्यवस्थापक का नाम अनिवार्य है" : "Admin Full Name is required";
                if (!formData.admin_email.trim()) newErr.admin_email = isHi ? "व्यवस्थापक ईमेल अनिवार्य है" : "Admin Email is required";
                else if (!/\S+@\S+\.\S+/.test(formData.admin_email.trim())) newErr.admin_email = isHi ? "मान्य ईमेल दर्ज करें" : "Enter a valid email address";
                if (!formData.admin_password || formData.admin_password.length < 6) {
                    newErr.admin_password = isHi ? "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए" : "Password must be at least 6 characters";
                }
            }
        }

        setErrors(newErr);
        return Object.keys(newErr).length === 0;
    };

    const handleNext = () => {
        if (validateStep(step)) {
            setStep((prev) => Math.min(5, prev + 1));
        }
    };

    const handleBack = () => {
        setStep((prev) => Math.max(1, prev - 1));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
            notify(isHi ? "कृपया सभी चरणों में अनिवार्य विवरण पूरा करें" : "Please complete required fields across all steps", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const enabledDepartments = formData.departments
                .filter((d) => d.enabled)
                .map((d) => ({
                    dept_code: d.dept_code,
                    name: d.name,
                    description: d.description,
                    desk_count: d.desk_count,
                }));

            const payload = {
                hospital_code: formData.hospital_code.trim().toLowerCase(),
                name: formData.name.trim(),
                type: formData.type,
                registration_no: formData.registration_no.trim(),
                nabh_status: formData.nabh_status,
                nabh_number: formData.nabh_number.trim(),
                nabh_valid_until: formData.nabh_valid_until || null,
                established_year: formData.established_year ? parseInt(formData.established_year, 10) : null,
                total_beds: formData.total_beds ? parseInt(formData.total_beds, 10) : null,
                icu_beds: formData.icu_beds ? parseInt(formData.icu_beds, 10) : null,
                logo_url: formData.logo_url || "",
                tagline: formData.tagline.trim(),
                phone: formData.phone.trim(),
                alt_phone: formData.alt_phone.trim(),
                emergency_helpline: formData.emergency_helpline.trim(),
                email: formData.email.trim().toLowerCase(),
                support_email: formData.support_email.trim(),
                website: formData.website.trim(),
                address_line1: formData.address_line1.trim(),
                address_line2: formData.address_line2.trim(),
                city: formData.city.trim(),
                state: formData.state.trim(),
                pincode: formData.pincode.trim(),
                country: formData.country.trim(),
                maps_link: formData.maps_link.trim(),
                opd_start_time: formData.opd_start_time,
                opd_end_time: formData.opd_end_time,
                registration_cutoff: formData.registration_cutoff,
                timezone: formData.timezone,
                working_days: formData.working_days,
                departments: enabledDepartments,
                languages: formData.languages,
                admin: formData.create_admin
                    ? {
                          create_admin: true,
                          name: formData.admin_name.trim(),
                          email: formData.admin_email.trim().toLowerCase(),
                          phone: formData.admin_phone.trim(),
                          password: formData.admin_password,
                      }
                    : { create_admin: false },
                primary_color: formData.primary_color,
                secondary_color: formData.secondary_color,
                accent_color: formData.accent_color,
                about_us: formData.about_us.trim(),
                description: formData.description.trim(),
                status: "active",
            };

            const res = await fetch(`${apiBase}/api/v1/superadmin/hospitals`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders(),
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok && data.status === "success") {
                notify(isHi ? `अस्पताल '${data.hospital.name}' सफलतापूर्वक स्थापित!` : `Hospital '${data.hospital.name}' registered & initialized successfully!`);
                setCreatedResult(data);
                setStep(6); // Show post-creation checklist view
            } else {
                notify(data.message || data.detail || "Failed to create hospital.", "error");
            }
        } catch (err) {
            notify(`Error creating hospital: ${err.message}`, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyAdminCredentials = () => {
        if (!createdResult?.admin_user) return;
        const text = `Hospital: ${createdResult.hospital.name} (${createdResult.hospital.hospital_code})\nPortal Admin Email: ${createdResult.admin_user.email}\nTemporary Password: ${createdResult.admin_user.temporary_password}\nEmployee ID: ${createdResult.admin_user.employee_code}`;
        navigator.clipboard.writeText(text);
        setCopiedCreds(true);
        setTimeout(() => setCopiedCreds(false), 2500);
    };

    if (!isOpen) return null;

    const modalWideStyle = {
        background: "var(--superadmin-card-bg, #FFFFFF)",
        borderRadius: "22px",
        maxWidth: "780px",
        width: "100%",
        padding: "24px 28px",
        boxShadow: "0 24px 50px -10px rgba(0, 0, 0, 0.45)",
        border: "1px solid var(--superadmin-card-border, #E2E8F0)",
        color: "var(--superadmin-text-main, #0F172A)",
        maxHeight: "90vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
    };

    const stepNames = [
        { num: 1, title: isHi ? "पहचान" : "Identity", sub: isHi ? "बुनियादी विवरण" : "Basic Info" },
        { num: 2, title: isHi ? "संपर्क" : "Contact", sub: isHi ? "स्थान व संचार" : "Location" },
        { num: 3, title: isHi ? "संचालन" : "Operations", sub: isHi ? "विभाग व काउंटर" : "Depts & Desks" },
        { num: 4, title: isHi ? "व्यवस्थापक" : "Admin", sub: isHi ? "खाता निर्माण" : "Credentials" },
        { num: 5, title: isHi ? "समीक्षा" : "Review", sub: isHi ? "ब्रांडिंग व पुष्टि" : "Branding" },
    ];

    const inlineError = (msg) => (
        <span style={{ display: "block", color: "#EF4444", fontSize: "11px", fontWeight: 700, marginTop: "4px" }}>
            {msg}
        </span>
    );

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalWideStyle} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--superadmin-card-border, #E2E8F0)", paddingBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(2, 132, 199, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <IconHospital size={20} color="#0284C7" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: "18px", color: "var(--superadmin-text-main, #0F172A)", fontWeight: 800 }}>
                                {isHi ? "नया अस्पताल जोड़ें (सेटअप विज़ार्ड)" : "Add New Hospital (Guided Setup)"}
                            </h3>
                            <span style={{ fontSize: "12px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                {step <= 5 ? (isHi ? `चरण ${step} का 5` : `Step ${step} of 5`) : (isHi ? "सफलतापूर्वक स्थापित" : "Setup Complete")}
                            </span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} style={modalCloseIconBtnStyle} title="Close">
                        <IconX size={18} />
                    </button>
                </div>

                {/* Progress Bar (visible for steps 1-5) */}
                {step <= 5 && (
                    <div style={{ marginBottom: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                            {stepNames.map((s) => {
                                const isActive = s.num === step;
                                const isDone = s.num < step;
                                return (
                                    <div
                                        key={s.num}
                                        onClick={() => {
                                            if (s.num < step) setStep(s.num);
                                        }}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            cursor: s.num < step ? "pointer" : "default",
                                            flex: 1,
                                            textAlign: "center",
                                            zIndex: 2,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "28px",
                                                height: "28px",
                                                borderRadius: "50%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "12px",
                                                fontWeight: 800,
                                                background: isDone ? "#10B981" : isActive ? "#0284C7" : "var(--superadmin-sub-card, #F1F5F9)",
                                                color: isDone || isActive ? "#FFFFFF" : "var(--superadmin-text-muted, #94A3B8)",
                                                border: isActive ? "2px solid #0284C7" : "1.5px solid var(--superadmin-input-border, #CBD5E1)",
                                                marginBottom: "4px",
                                                transition: "all 0.2s ease",
                                            }}
                                        >
                                            {isDone ? "✓" : s.num}
                                        </div>
                                        <span style={{ fontSize: "11px", fontWeight: isActive ? 800 : 600, color: isActive ? "#0284C7" : "var(--superadmin-text-main, #334155)" }}>
                                            {s.title}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Connecting track line */}
                        <div style={{ height: "3px", background: "var(--superadmin-input-border, #E2E8F0)", borderRadius: "2px", margin: "-20px 20px 20px 20px", zIndex: 1 }}>
                            <div
                                style={{
                                    height: "100%",
                                    background: "#0284C7",
                                    borderRadius: "2px",
                                    width: `${((step - 1) / 4) * 100}%`,
                                    transition: "width 0.3s ease",
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* STEP 1: Basic Identity */}
                {step === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "अस्पताल का नाम" : "Hospital Name"} *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Metro Super Hospital"
                                    value={formData.name}
                                    onChange={handleNameChange}
                                    style={{ ...fieldInputStyle, borderColor: errors.name ? "#EF4444" : undefined }}
                                />
                                {errors.name && inlineError(errors.name)}
                            </div>

                            <div>
                                <label style={fieldLabelStyle}>
                                    {isHi ? "अस्पताल कोड" : "Hospital Code"} *{" "}
                                    <span style={{ fontSize: "10.5px", fontWeight: 500, color: "#64748B" }}>
                                        ({isHi ? "केवल lowercase, digits, -" : "slug format"})
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. metro-super-hospital"
                                    value={formData.hospital_code}
                                    onChange={handleCodeChange}
                                    style={{ ...fieldInputStyle, borderColor: errors.hospital_code ? "#EF4444" : undefined }}
                                />
                                {codeCheckStatus && (
                                    <div style={{ marginTop: "4px", fontSize: "11px", fontWeight: 700 }}>
                                        {codeCheckStatus.checking && <span style={{ color: "#0284C7" }}>Checking availability...</span>}
                                        {!codeCheckStatus.checking && codeCheckStatus.available && (
                                            <span style={{ color: "#10B981" }}>✓ {isHi ? "कोड उपलब्ध है" : "Code is available"}</span>
                                        )}
                                        {!codeCheckStatus.checking && !codeCheckStatus.available && (
                                            <span style={{ color: "#EF4444" }}>✕ {codeCheckStatus.message || (isHi ? "कोड उपलब्ध नहीं है" : "Code is already taken")}</span>
                                        )}
                                    </div>
                                )}
                                {errors.hospital_code && inlineError(errors.hospital_code)}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "अस्पताल प्रकार" : "Hospital Type"}</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    style={fieldInputStyle}
                                >
                                    {HOSPITAL_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {isHi ? t.labelHi : t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "पंजीकरण / लाइसेंस संख्या" : "Registration / License No."}</label>
                                <input
                                    type="text"
                                    placeholder="e.g. REG-DL-2024-8891"
                                    value={formData.registration_no}
                                    onChange={(e) => setFormData({ ...formData, registration_no: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "एनएबीएच स्थिति" : "NABH Status"}</label>
                                <select
                                    value={formData.nabh_status}
                                    onChange={(e) => setFormData({ ...formData, nabh_status: e.target.value })}
                                    style={fieldInputStyle}
                                >
                                    {NABH_OPTIONS.map((n) => (
                                        <option key={n.value} value={n.value}>
                                            {isHi ? n.labelHi : n.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {formData.nabh_status === "Accredited" ? (
                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "एनएबीएच संख्या व वैधता" : "Accreditation No. & Valid Until"} *</label>
                                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "6px" }}>
                                        <input
                                            type="text"
                                            placeholder="NABH-ACC-2026-09"
                                            value={formData.nabh_number}
                                            onChange={(e) => setFormData({ ...formData, nabh_number: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                        <input
                                            type="date"
                                            value={formData.nabh_valid_until}
                                            onChange={(e) => setFormData({ ...formData, nabh_valid_until: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                    {errors.nabh_number && inlineError(errors.nabh_number)}
                                </div>
                            ) : (
                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "स्थापना वर्ष" : "Established Year"}</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 2012"
                                        value={formData.established_year}
                                        onChange={(e) => setFormData({ ...formData, established_year: e.target.value })}
                                        style={fieldInputStyle}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "कुल बेड संख्या" : "Total Beds"}</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="e.g. 250"
                                    value={formData.total_beds}
                                    onChange={(e) => setFormData({ ...formData, total_beds: e.target.value })}
                                    style={fieldInputStyle}
                                />
                                {errors.total_beds && inlineError(errors.total_beds)}
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "आईसीयू बेड संख्या" : "ICU Beds"}</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="e.g. 40"
                                    value={formData.icu_beds}
                                    onChange={(e) => setFormData({ ...formData, icu_beds: e.target.value })}
                                    style={fieldInputStyle}
                                />
                                {errors.icu_beds && inlineError(errors.icu_beds)}
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "टैगलाइन" : "Hospital Tagline"}</label>
                                <input
                                    type="text"
                                    placeholder="Care you can trust"
                                    value={formData.tagline}
                                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                        </div>

                        {/* Logo Upload & Preview */}
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "लोगो अपलोड (अधिकतम 2MB)" : "Hospital Logo (Max 2MB, Image Only)"}</label>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                {formData.logo_url ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <img
                                            src={formData.logo_url}
                                            alt="Logo Preview"
                                            style={{ width: "48px", height: "48px", objectFit: "contain", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", padding: "4px" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, logo_url: "" })}
                                            style={{ background: "rgba(239, 68, 68, 0.12)", color: "#EF4444", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "6px 12px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                                        >
                                            {isHi ? "लोगो हटाएं" : "Remove"}
                                        </button>
                                    </div>
                                ) : (
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        style={{ fontSize: "12px", color: "var(--superadmin-text-sub, #475569)" }}
                                    />
                                )}
                            </div>
                            {errors.logo && inlineError(errors.logo)}
                        </div>
                    </div>
                )}

                {/* STEP 2: Contact and Location */}
                {step === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "प्राथमिक फोन" : "Phone Number"} *</label>
                                <input
                                    type="text"
                                    placeholder="+91 98765 43210"
                                    value={formData.phone}
                                    onChange={(e) => {
                                        setFormData({ ...formData, phone: e.target.value });
                                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
                                    }}
                                    style={{ ...fieldInputStyle, borderColor: errors.phone ? "#EF4444" : undefined }}
                                />
                                {errors.phone && inlineError(errors.phone)}
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "वैकल्पिक फोन" : "Alternate Phone"}</label>
                                <input
                                    type="text"
                                    placeholder="+91 11 2345 6789"
                                    value={formData.alt_phone}
                                    onChange={(e) => setFormData({ ...formData, alt_phone: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "आपातकालीन हेल्पलाइन" : "Emergency Helpline"}</label>
                                <input
                                    type="text"
                                    placeholder="108 / +91 98765 00000"
                                    value={formData.emergency_helpline}
                                    onChange={(e) => setFormData({ ...formData, emergency_helpline: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "आधिकारिक ईमेल" : "Official Email"} *</label>
                                <input
                                    type="email"
                                    placeholder="info@hospital.org"
                                    value={formData.email}
                                    onChange={(e) => {
                                        setFormData({ ...formData, email: e.target.value });
                                        if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                                    }}
                                    style={{ ...fieldInputStyle, borderColor: errors.email ? "#EF4444" : undefined }}
                                />
                                {errors.email && inlineError(errors.email)}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "सहायता ईमेल" : "Support Email"}</label>
                                <input
                                    type="email"
                                    placeholder="support@hospital.org"
                                    value={formData.support_email}
                                    onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "वेबसाइट" : "Website"}</label>
                                <input
                                    type="url"
                                    placeholder="https://hospital.org"
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "पता पंक्ति 1" : "Address Line 1"} *</label>
                            <input
                                type="text"
                                placeholder="Plot 42, Health City Sector 9"
                                value={formData.address_line1}
                                onChange={(e) => {
                                    setFormData({ ...formData, address_line1: e.target.value });
                                    if (errors.address_line1) setErrors((prev) => ({ ...prev, address_line1: null }));
                                }}
                                style={{ ...fieldInputStyle, borderColor: errors.address_line1 ? "#EF4444" : undefined }}
                            />
                            {errors.address_line1 && inlineError(errors.address_line1)}
                        </div>

                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "पता पंक्ति 2 (वैकल्पिक)" : "Address Line 2 (Optional)"}</label>
                            <input
                                type="text"
                                placeholder="Near Central Metro Station"
                                value={formData.address_line2}
                                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "शहर" : "City"} *</label>
                                <input
                                    type="text"
                                    placeholder="New Delhi"
                                    value={formData.city}
                                    onChange={(e) => {
                                        setFormData({ ...formData, city: e.target.value });
                                        if (errors.city) setErrors((prev) => ({ ...prev, city: null }));
                                    }}
                                    style={{ ...fieldInputStyle, borderColor: errors.city ? "#EF4444" : undefined }}
                                />
                                {errors.city && inlineError(errors.city)}
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "राज्य" : "State"} *</label>
                                <input
                                    type="text"
                                    placeholder="Delhi"
                                    value={formData.state}
                                    onChange={(e) => {
                                        setFormData({ ...formData, state: e.target.value });
                                        if (errors.state) setErrors((prev) => ({ ...prev, state: null }));
                                    }}
                                    style={{ ...fieldInputStyle, borderColor: errors.state ? "#EF4444" : undefined }}
                                />
                                {errors.state && inlineError(errors.state)}
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "पिन कोड" : "PIN Code"} *</label>
                                <input
                                    type="text"
                                    maxLength="6"
                                    placeholder="110001"
                                    value={formData.pincode}
                                    onChange={(e) => {
                                        setFormData({ ...formData, pincode: e.target.value });
                                        if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: null }));
                                    }}
                                    style={{ ...fieldInputStyle, borderColor: errors.pincode ? "#EF4444" : undefined }}
                                />
                                {errors.pincode && inlineError(errors.pincode)}
                            </div>
                        </div>

                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "गूगल मैप्स लिंक (वैकल्पिक)" : "Google Maps Link (Optional)"}</label>
                            <input
                                type="url"
                                placeholder="https://maps.google.com/?q=..."
                                value={formData.maps_link}
                                onChange={(e) => setFormData({ ...formData, maps_link: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>
                    </div>
                )}

                {/* STEP 3: Operations & Departments */}
                {step === 3 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "ओपीडी प्रारंभ समय" : "OPD Start Time"}</label>
                                <input
                                    type="time"
                                    value={formData.opd_start_time}
                                    onChange={(e) => setFormData({ ...formData, opd_start_time: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "ओपीडी समाप्ति समय" : "OPD End Time"}</label>
                                <input
                                    type="time"
                                    value={formData.opd_end_time}
                                    onChange={(e) => setFormData({ ...formData, opd_end_time: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                            <div>
                                <label style={fieldLabelStyle}>{isHi ? "पंजीकरण कटऑफ समय" : "Reg. Cutoff Time"}</label>
                                <input
                                    type="time"
                                    value={formData.registration_cutoff}
                                    onChange={(e) => setFormData({ ...formData, registration_cutoff: e.target.value })}
                                    style={fieldInputStyle}
                                />
                            </div>
                        </div>
                        {errors.opd_time && inlineError(errors.opd_time)}

                        {/* Working Days */}
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "कार्य दिवस (Working Days)" : "Working Days"}</label>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {WORKING_DAYS_LIST.map((d) => {
                                    const checked = formData.working_days.includes(d.id);
                                    return (
                                        <button
                                            type="button"
                                            key={d.id}
                                            onClick={() => toggleWorkingDay(d.id)}
                                            style={{
                                                padding: "6px 14px",
                                                borderRadius: "8px",
                                                border: checked ? "1px solid #0284C7" : "1px solid var(--superadmin-input-border, #CBD5E1)",
                                                background: checked ? "rgba(2, 132, 199, 0.15)" : "var(--superadmin-sub-card, #F8FAFC)",
                                                color: checked ? "#0284C7" : "var(--superadmin-text-sub, #475569)",
                                                fontSize: "12px",
                                                fontWeight: checked ? 800 : 600,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isHi ? d.labelHi : d.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Departments & Desks */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>
                                    {isHi ? "सक्षम विभाग एवं काउंटर / डेस्क संख्या" : "Departments to Enable & Desks Count"} *
                                </label>
                                <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                    {formData.departments.filter((d) => d.enabled).length} {isHi ? "विभाग चयनित" : "departments enabled"}
                                </span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto", paddingRight: "4px" }}>
                                {formData.departments.map((dept) => (
                                    <div
                                        key={dept.dept_code}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "8px 12px",
                                            borderRadius: "10px",
                                            background: dept.enabled ? "var(--superadmin-sub-card, #F8FAFC)" : "transparent",
                                            border: dept.enabled ? "1px solid var(--superadmin-card-border, #E2E8F0)" : "1px dashed var(--superadmin-input-border, #CBD5E1)",
                                            opacity: dept.enabled ? 1 : 0.6,
                                        }}
                                    >
                                        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", flex: 1, margin: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={dept.enabled}
                                                onChange={() => toggleDepartment(dept.dept_code)}
                                                style={{ width: "16px", height: "16px", accentColor: "#0284C7" }}
                                            />
                                            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--superadmin-text-main, #0F172A)" }}>
                                                {dept.name}
                                            </span>
                                            <span style={{ fontSize: "10.5px", padding: "2px 6px", borderRadius: "4px", background: "rgba(2, 132, 199, 0.1)", color: "#0284C7", fontWeight: 700 }}>
                                                {dept.dept_code}
                                            </span>
                                        </label>

                                        {dept.enabled && (
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                                    {dept.dept_code === "billing" ? (isHi ? "काउंटर:" : "Counters:") : (isHi ? "डेस्क:" : "Desks:")}
                                                </span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={dept.desk_count}
                                                    onChange={(e) => updateDeptDesks(dept.dept_code, e.target.value)}
                                                    style={{ width: "60px", padding: "5px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px", fontWeight: 700, textAlign: "center" }}
                                                />
                                                {/* Remove custom dept button */}
                                                {!DEFAULT_DEPARTMENTS.some((d) => d.dept_code === dept.dept_code) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCustomDept(dept.dept_code)}
                                                        style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: "4px" }}
                                                        title="Delete custom department"
                                                    >
                                                        <IconTrash size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {errors.departments && inlineError(errors.departments)}

                            {/* Add Custom Department Row */}
                            <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "10px", background: "var(--superadmin-sub-card, #F8FAFC)", border: "1px solid var(--superadmin-card-border, #E2E8F0)", display: "flex", gap: "8px", alignItems: "center" }}>
                                <input
                                    type="text"
                                    placeholder={isHi ? "कस्टम विभाग नाम (उदा. कार्डियोलॉजी)" : "Custom dept name (e.g. Cardiology)"}
                                    value={customDeptName}
                                    onChange={(e) => setCustomDeptName(e.target.value)}
                                    style={{ ...fieldInputStyle, flex: 2, padding: "6px 10px", fontSize: "12px" }}
                                />
                                <input
                                    type="text"
                                    placeholder="code (cardiology)"
                                    value={customDeptCode}
                                    onChange={(e) => setCustomDeptCode(e.target.value)}
                                    style={{ ...fieldInputStyle, flex: 1, padding: "6px 10px", fontSize: "12px" }}
                                />
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={customDeptDesks}
                                    onChange={(e) => setCustomDeptDesks(e.target.value)}
                                    style={{ width: "60px", padding: "6px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "12px", textAlign: "center" }}
                                    title="Desks count"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddCustomDept}
                                    style={{ padding: "6px 12px", borderRadius: "8px", background: "#0284C7", color: "#FFFFFF", border: "none", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                                >
                                    <IconPlus size={13} />
                                    <span>{isHi ? "जोड़ें" : "Add"}</span>
                                </button>
                            </div>
                            {errors.customDept && inlineError(errors.customDept)}
                        </div>

                        {/* Supported Languages */}
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "समर्थित भाषाएं" : "Supported Languages"}</label>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {AVAILABLE_LANGUAGES.map((lang) => {
                                    const checked = formData.languages.includes(lang);
                                    return (
                                        <button
                                            type="button"
                                            key={lang}
                                            onClick={() => toggleLanguage(lang)}
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: "6px",
                                                border: checked ? "1px solid #0284C7" : "1px solid var(--superadmin-input-border, #CBD5E1)",
                                                background: checked ? "rgba(2, 132, 199, 0.12)" : "var(--superadmin-sub-card, #F8FAFC)",
                                                color: checked ? "#0284C7" : "var(--superadmin-text-sub, #475569)",
                                                fontSize: "11px",
                                                fontWeight: checked ? 700 : 500,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {lang}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: Hospital Admin Account */}
                {step === 4 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "12px", background: formData.create_admin ? "rgba(2, 132, 199, 0.08)" : "var(--superadmin-sub-card, #F8FAFC)", border: "1px solid var(--superadmin-card-border, #E2E8F0)" }}>
                            <div>
                                <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)", display: "block" }}>
                                    {isHi ? "अस्पताल व्यवस्थापक (Admin) खाता बनाएं" : "Create Hospital Admin Account"}
                                </span>
                                <span style={{ fontSize: "12px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                    {isHi ? "इस अस्पताल के कर्मचारियों और विभागों को प्रबंधित करने के लिए प्राथमिक एडमिन" : "Primary administrator to manage employees, desks, and duty roster"}
                                </span>
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>
                                <input
                                    type="checkbox"
                                    checked={formData.create_admin}
                                    onChange={(e) => setFormData({ ...formData, create_admin: e.target.checked })}
                                    style={{ width: "18px", height: "18px", accentColor: "#0284C7" }}
                                />
                                <span>{formData.create_admin ? (isHi ? "सक्रिय" : "Enabled") : (isHi ? "छोड़ें (बाद में जोड़ें)" : "Skip (Add Later)")}</span>
                            </label>
                        </div>

                        {formData.create_admin ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div>
                                    <label style={fieldLabelStyle}>{isHi ? "व्यवस्थापक का पूरा नाम" : "Admin Full Name"} *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Dr. Rajesh Sharma / Operations Lead"
                                        value={formData.admin_name}
                                        onChange={(e) => {
                                            setFormData({ ...formData, admin_name: e.target.value });
                                            if (errors.admin_name) setErrors((prev) => ({ ...prev, admin_name: null }));
                                        }}
                                        style={{ ...fieldInputStyle, borderColor: errors.admin_name ? "#EF4444" : undefined }}
                                    />
                                    {errors.admin_name && inlineError(errors.admin_name)}
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "व्यवस्थापक ईमेल" : "Admin Official Email"} *</label>
                                        <input
                                            type="email"
                                            placeholder="admin@metrohospital.org"
                                            value={formData.admin_email}
                                            onChange={(e) => {
                                                setFormData({ ...formData, admin_email: e.target.value });
                                                if (errors.admin_email) setErrors((prev) => ({ ...prev, admin_email: null }));
                                            }}
                                            style={{ ...fieldInputStyle, borderColor: errors.admin_email ? "#EF4444" : undefined }}
                                        />
                                        {errors.admin_email && inlineError(errors.admin_email)}
                                    </div>
                                    <div>
                                        <label style={fieldLabelStyle}>{isHi ? "व्यवस्थापक फोन" : "Admin Phone"}</label>
                                        <input
                                            type="text"
                                            placeholder="+91 98765 11111"
                                            value={formData.admin_phone}
                                            onChange={(e) => setFormData({ ...formData, admin_phone: e.target.value })}
                                            style={fieldInputStyle}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <label style={fieldLabelStyle}>{isHi ? "अस्थायी पासवर्ड" : "Temporary Password"} *</label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, admin_password: generateRandomPassword() })}
                                            style={{ background: "none", border: "none", color: "#0284C7", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                                        >
                                            <IconRefresh size={12} />
                                            <span>{isHi ? "पुनः उत्पन्न करें" : "Regenerate"}</span>
                                        </button>
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <div style={{ position: "relative", flex: 1 }}>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={formData.admin_password}
                                                onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                                                style={{ ...fieldInputStyle, paddingRight: "36px", borderColor: errors.admin_password ? "#EF4444" : undefined }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748B", cursor: "pointer" }}
                                            >
                                                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(formData.admin_password);
                                                notify(isHi ? "पासवर्ड कॉपी किया गया!" : "Password copied to clipboard!");
                                            }}
                                            style={{ padding: "0 14px", borderRadius: "10px", border: "1px solid #CBD5E1", background: "var(--superadmin-sub-card, #F8FAFC)", color: "var(--superadmin-text-sub, #475569)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 700 }}
                                        >
                                            <IconCopy size={13} />
                                            <span>{isHi ? "कॉपी" : "Copy"}</span>
                                        </button>
                                    </div>
                                    {errors.admin_password && inlineError(errors.admin_password)}
                                    <span style={{ fontSize: "11.5px", color: "var(--superadmin-text-muted, #64748B)", marginTop: "4px", display: "block" }}>
                                        {isHi ? "💡 पहली बार लॉगिन करने पर व्यवस्थापक को पासवर्ड बदलने के लिए कहा जाएगा।" : "💡 Administrator will be prompted to set a new password on first login."}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: "30px", textAlign: "center", borderRadius: "12px", background: "var(--superadmin-sub-card, #F8FAFC)", border: "1px dashed #CBD5E1", color: "var(--superadmin-text-muted, #64748B)" }}>
                                <IconUser size={32} color="#94A3B8" />
                                <p style={{ margin: "8px 0 0 0", fontSize: "13px", fontWeight: 600 }}>
                                    {isHi ? "एडमिन खाता निर्माण छोड़ दिया गया है। आप अस्पताल बनने के बाद स्टाफ टैब से कभी भी एडमिन जोड़ सकते हैं।" : "Admin account creation skipped. You can assign administrators anytime from the Staff tab."}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 5: Branding & Review */}
                {step === 5 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {/* Theme Colors */}
                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "ब्रांडिंग रंग पैलेट" : "Branding Colors Palette"}</label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                                <div>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)", display: "block", marginBottom: "4px" }}>
                                        {isHi ? "प्राथमिक (Primary)" : "Primary Color"}
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <input
                                            type="color"
                                            value={formData.primary_color}
                                            onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                            style={{ width: "36px", height: "36px", padding: 0, borderRadius: "8px", border: "1px solid #CBD5E1", cursor: "pointer" }}
                                        />
                                        <input
                                            type="text"
                                            value={formData.primary_color}
                                            onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                            style={{ ...fieldInputStyle, padding: "6px 8px", fontSize: "12px" }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)", display: "block", marginBottom: "4px" }}>
                                        {isHi ? "माध्यमिक (Secondary)" : "Secondary Color"}
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <input
                                            type="color"
                                            value={formData.secondary_color}
                                            onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                            style={{ width: "36px", height: "36px", padding: 0, borderRadius: "8px", border: "1px solid #CBD5E1", cursor: "pointer" }}
                                        />
                                        <input
                                            type="text"
                                            value={formData.secondary_color}
                                            onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                            style={{ ...fieldInputStyle, padding: "6px 8px", fontSize: "12px" }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--superadmin-text-muted, #64748B)", display: "block", marginBottom: "4px" }}>
                                        {isHi ? "एक्सेंट (Accent)" : "Accent Color"}
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <input
                                            type="color"
                                            value={formData.accent_color}
                                            onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                                            style={{ width: "36px", height: "36px", padding: 0, borderRadius: "8px", border: "1px solid #CBD5E1", cursor: "pointer" }}
                                        />
                                        <input
                                            type="text"
                                            value={formData.accent_color}
                                            onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                                            style={{ ...fieldInputStyle, padding: "6px 8px", fontSize: "12px" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Color Preview Banner */}
                            <div
                                style={{
                                    marginTop: "10px",
                                    padding: "10px 14px",
                                    borderRadius: "10px",
                                    background: formData.accent_color,
                                    border: `1.5px solid ${formData.primary_color}`,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <span style={{ color: formData.primary_color, fontWeight: 800, fontSize: "13px" }}>
                                    {formData.name || "Hospital Name Preview"}
                                </span>
                                <span style={{ background: formData.secondary_color, color: "#FFFFFF", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                                    {formData.tagline || "Tagline Preview"}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "संक्षिप्त परिचय (About Hospital)" : "About Hospital (Short)"}</label>
                            <input
                                type="text"
                                placeholder="Premier multi-specialty healthcare institution dedicated to clinical excellence"
                                value={formData.about_us}
                                onChange={(e) => setFormData({ ...formData, about_us: e.target.value })}
                                style={fieldInputStyle}
                            />
                        </div>

                        <div>
                            <label style={fieldLabelStyle}>{isHi ? "विस्तृत विवरण (Description)" : "Description / Facilities Overview"}</label>
                            <textarea
                                rows="2"
                                placeholder="Specialization, emergency protocols, and medical technology..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                style={{ ...fieldInputStyle, resize: "none" }}
                            />
                        </div>

                        {/* Comprehensive Review Summary */}
                        <div style={{ borderRadius: "14px", border: "1px solid var(--superadmin-card-border, #E2E8F0)", background: "var(--superadmin-sub-card, #F8FAFC)", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px" }}>
                                <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                    {isHi ? "📋 सारांश समीक्षा" : "📋 Configuration Summary"}
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                    {isHi ? "सहेजने से पहले जांच लें" : "Verify before creating"}
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                                <div>
                                    <strong style={{ color: "var(--superadmin-text-muted, #64748B)" }}>{isHi ? "नाम:" : "Hospital:"}</strong>{" "}
                                    {formData.name} ({formData.hospital_code})
                                    <button type="button" onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#0284C7", marginLeft: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
                                        {isHi ? "संपादित करें" : "Edit"}
                                    </button>
                                </div>
                                <div>
                                    <strong style={{ color: "var(--superadmin-text-muted, #64748B)" }}>{isHi ? "प्रकार / बेड:" : "Type / Beds:"}</strong>{" "}
                                    {formData.type} • {formData.total_beds || "—"} {isHi ? "बेड" : "Beds"} ({formData.icu_beds || 0} ICU)
                                </div>
                                <div>
                                    <strong style={{ color: "var(--superadmin-text-muted, #64748B)" }}>{isHi ? "संपर्क:" : "Contact:"}</strong>{" "}
                                    {formData.phone} • {formData.city}, {formData.state}
                                    <button type="button" onClick={() => setStep(2)} style={{ background: "none", border: "none", color: "#0284C7", marginLeft: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
                                        {isHi ? "संपादित करें" : "Edit"}
                                    </button>
                                </div>
                                <div>
                                    <strong style={{ color: "var(--superadmin-text-muted, #64748B)" }}>{isHi ? "ओपीडी समय:" : "OPD Hours:"}</strong>{" "}
                                    {formData.opd_start_time} - {formData.opd_end_time}
                                </div>
                                <div>
                                    <strong style={{ color: "var(--superadmin-text-muted, #64748B)" }}>{isHi ? "सक्रिय विभाग:" : "Departments:"}</strong>{" "}
                                    {formData.departments.filter((d) => d.enabled).length} {isHi ? "विभाग" : "depts"} (
                                    {formData.departments.filter((d) => d.enabled).reduce((acc, d) => acc + (parseInt(d.desk_count, 10) || 1), 0)} {isHi ? "काउंटर/डेस्क" : "desks"})
                                    <button type="button" onClick={() => setStep(3)} style={{ background: "none", border: "none", color: "#0284C7", marginLeft: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
                                        {isHi ? "संपादित करें" : "Edit"}
                                    </button>
                                </div>
                                <div>
                                    <strong style={{ color: "var(--superadmin-text-muted, #64748B)" }}>{isHi ? "व्यवस्थापक:" : "Admin:"}</strong>{" "}
                                    {formData.create_admin ? `${formData.admin_name} (${formData.admin_email})` : (isHi ? "छोड़ दिया गया" : "Skipped")}
                                    <button type="button" onClick={() => setStep(4)} style={{ background: "none", border: "none", color: "#0284C7", marginLeft: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
                                        {isHi ? "संपादित करें" : "Edit"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 6: Post-Creation Checklist & Credentials Screen */}
                {step === 6 && createdResult && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "10px 0" }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto" }}>
                                <IconCheckCircle size={32} color="#10B981" />
                            </div>
                            <h3 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                {isHi ? "अस्पताल सफलतापूर्वक पंजीकृत एवं स्थापित!" : "Hospital Registered & Fully Configured!"}
                            </h3>
                            <p style={{ margin: 0, fontSize: "13px", color: "var(--superadmin-text-muted, #64748B)" }}>
                                {createdResult.hospital.name} ({createdResult.hospital.hospital_code})
                            </p>
                        </div>

                        {/* Checklist */}
                        <div style={{ borderRadius: "14px", border: "1px solid #BAE6FD", background: "#F0F9FF", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#0369A1", fontSize: "13px", fontWeight: 700 }}>
                                <span style={{ color: "#10B981", fontSize: "16px" }}>✓</span>
                                <span>{isHi ? "अस्पताल किरायेदार (Tenant) और ब्रांडिंग प्रोफाइल सक्रिय" : "Hospital tenant record & branding profile created"}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#0369A1", fontSize: "13px", fontWeight: 700 }}>
                                <span style={{ color: "#10B981", fontSize: "16px" }}>✓</span>
                                <span>
                                    {createdResult.departments_count} {isHi ? "विभाग और" : "Departments and"} {createdResult.desks_count} {isHi ? "काउंटर/डेस्क स्वचालित रूप से तैयार" : "Desks automatically provisioned"}
                                </span>
                            </div>
                            {createdResult.admin_user ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#0369A1", fontSize: "13px", fontWeight: 700 }}>
                                    <span style={{ color: "#10B981", fontSize: "16px" }}>✓</span>
                                    <span>{isHi ? "अस्पताल एडमिन खाता व कर्मचारी रिकॉर्ड बनाया गया" : "Hospital Administrator user and employee record provisioned"}</span>
                                </div>
                            ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#64748B", fontSize: "13px", fontWeight: 600 }}>
                                    <span>○</span>
                                    <span>{isHi ? "एडमिन खाता छोड़ दिया गया (बाद में जोड़ा जा सकता है)" : "Admin account skipped (can be created later)"}</span>
                                </div>
                            )}
                        </div>

                        {/* Credentials Card (if created) */}
                        {createdResult.admin_user && (
                            <div style={{ borderRadius: "14px", border: "1.5px solid #CBD5E1", background: "var(--superadmin-sub-card, #F8FAFC)", padding: "16px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>
                                        🔑 {isHi ? "व्यवस्थापक लॉगिन साख (Credentials)" : "Hospital Admin Credentials"}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCopyAdminCredentials}
                                        style={{ padding: "6px 12px", borderRadius: "8px", background: copiedCreds ? "#10B981" : "#0284C7", color: "#FFFFFF", border: "none", fontSize: "11.5px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s ease" }}
                                    >
                                        <IconCopy size={13} />
                                        <span>{copiedCreds ? (isHi ? "कॉपी हो गया!" : "Copied!") : (isHi ? "साख कॉपी करें" : "Copy Credentials")}</span>
                                    </button>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px" }}>
                                    <div>
                                        <span style={{ color: "var(--superadmin-text-muted, #64748B)", display: "block", fontSize: "11px" }}>{isHi ? "लॉगिन ईमेल:" : "Login Email:"}</span>
                                        <span style={{ fontWeight: 800, color: "var(--superadmin-text-main, #0F172A)" }}>{createdResult.admin_user.email}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--superadmin-text-muted, #64748B)", display: "block", fontSize: "11px" }}>{isHi ? "अस्थायी पासवर्ड:" : "Temporary Password:"}</span>
                                        <span style={{ fontWeight: 800, color: "#0284C7", fontFamily: "monospace", fontSize: "13px" }}>{createdResult.admin_user.temporary_password}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--superadmin-text-muted, #64748B)", display: "block", fontSize: "11px" }}>{isHi ? "कर्मचारी कोड:" : "Employee Code:"}</span>
                                        <span style={{ fontWeight: 700, color: "var(--superadmin-text-sub, #475569)" }}>{createdResult.admin_user.employee_code}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--superadmin-text-muted, #64748B)", display: "block", fontSize: "11px" }}>{isHi ? "भूमिका (Role):" : "System Role:"}</span>
                                        <span style={{ fontWeight: 700, color: "#10B981" }}>ADMIN</span>
                                    </div>
                                </div>

                                <div style={{ marginTop: "10px", padding: "8px 10px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", fontSize: "11.5px", color: "#B91C1C", fontWeight: 600 }}>
                                    ⚠️ {isHi ? "यह पासवर्ड केवल अभी एक बार दिखाया जा रहा है। कृपया इसे सहेजें और व्यवस्थापक को सुरक्षित रूप से साझा करें।" : "This temporary password is only displayed once. Please copy and deliver it securely to the administrator."}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", borderTop: "1px solid var(--superadmin-card-border, #E2E8F0)", paddingTop: "16px" }}>
                    {step <= 5 ? (
                        <>
                            <div>
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        style={{ ...modalCancelBtnStyle, display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px" }}
                                    >
                                        <IconChevronLeft size={16} />
                                        <span>{isHi ? "पीछे" : "Back"}</span>
                                    </button>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: "10px" }}>
                                <button type="button" onClick={onClose} style={modalCancelBtnStyle}>
                                    {isHi ? "रद्द करें" : "Cancel"}
                                </button>

                                {step < 5 ? (
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        style={{ ...modalSubmitBtnStyle, display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 22px" }}
                                    >
                                        <span>{isHi ? "आगे बढ़ें" : "Next"}</span>
                                        <IconChevronRight size={16} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={handleSubmit}
                                        style={{
                                            ...modalSubmitBtnStyle,
                                            opacity: isSubmitting ? 0.7 : 1,
                                            cursor: isSubmitting ? "not-allowed" : "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "10px 24px",
                                        }}
                                    >
                                        <IconSave size={16} />
                                        <span>
                                            {isSubmitting
                                                ? (isHi ? "अस्पताल बनाया जा रहा है..." : "Creating Hospital...")
                                                : (isHi ? "अस्पताल बनाएं" : "Create Hospital")}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (onHospitalCreated && createdResult) {
                                        onHospitalCreated(createdResult);
                                    }
                                    onClose();
                                }}
                                style={modalCancelBtnStyle}
                            >
                                {isHi ? "बंद करें" : "Close"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (onHospitalCreated && createdResult) {
                                        onHospitalCreated(createdResult);
                                    }
                                    onClose();
                                }}
                                style={{ ...modalSubmitBtnStyle, display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 24px" }}
                            >
                                <IconHospital size={16} />
                                <span>{isHi ? "अस्पताल 360 देखें" : "Open Hospital 360"}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
