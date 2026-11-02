/**
 * hospitalService.js
 * -------------------
 * SuperAdmin & Multi-Hospital Operations Engine.
 * Manages Hospitals, Employees, Departments, Desks, Kiosks, and Database Overview.
 */

const prisma = require("../config/prisma");
const { hashPassword } = require("../utils/password");
const { getCurrentQueueDate, queueDateToPrismaDate } = require("../utils/timezone");
const { getDoctorDutyStatus, setDoctorDutyStatus } = require("./ticketService");

const STANDARD_DEPARTMENTS = [
  ["consultation", "General Consultation (OPD)", "General outpatient doctor examinations"],
  ["pharmacy", "Pharmacy & Medicine", "Prescription dispensing and clinical pharmacy"],
  ["laboratory", "Pathology & Lab Test", "Diagnostic blood, urine and pathology assays"],
  ["radiology", "Radiology & X-Ray", "X-Ray, CT Scan, MRI and ultrasound imaging"],
  ["emergency", "Emergency Triage", "Critical emergency resuscitation and trauma"],
];

/**
 * Normalizes a department name string by:
 * 1. Lowercasing and replacing punctuation/brackets/hyphens/slashes with spaces.
 * 2. Stripping common hospital department suffixes and prefixes:
 *    department, dept, departments, opd, ipd, unit, section, division, of, the
 * 3. Collapsing multiple spaces and trimming.
 */
function normalizeDeptString(str) {
  if (!str) return "";
  let s = String(str).toLowerCase();
  s = s.replace(/[\(\)\[\]\{\}\-_/\\.,:;]/g, " ");
  s = s.replace(/\b(department|dept|departments|opd|ipd|unit|section|division|of|the)\b/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

function cleanAlphanumeric(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[\(\)\[\]\{\}\-_/\\.,:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds the best matching department from an array of existing department objects.
 * Supports flexible normalization, ignoring brackets, hyphens, and noise words (OPD, Dept, Unit, etc.).
 * Returns the matched department object, or null if no valid match.
 */
function findMatchingDepartment(rawInput, departments = []) {
  if (!rawInput || !Array.isArray(departments) || departments.length === 0) {
    return null;
  }

  const raw = String(rawInput).trim();
  if (!raw) return null;
  const rawLower = raw.toLowerCase();

  // Tier 1: Exact case-insensitive match on dept_code or name
  for (const dept of departments) {
    const code = String(dept.dept_code || "").toLowerCase().trim();
    const name = String(dept.name || "").toLowerCase().trim();
    if (code === rawLower || name === rawLower) {
      return dept;
    }
  }

  // Tier 2: Cleaned alphanumeric match (ignoring brackets, hyphens, extra whitespace)
  const cleanRaw = cleanAlphanumeric(raw);
  if (cleanRaw) {
    for (const dept of departments) {
      const cleanCode = cleanAlphanumeric(dept.dept_code);
      const cleanName = cleanAlphanumeric(dept.name);
      if (cleanCode && cleanCode === cleanRaw) return dept;
      if (cleanName && cleanName === cleanRaw) return dept;
    }
  }

  // Tier 3: Core normalized match (stripping 'Department', 'OPD', 'Unit', 'Section', 'of', etc.)
  const normRaw = normalizeDeptString(raw);
  if (normRaw) {
    for (const dept of departments) {
      const normCode = normalizeDeptString(dept.dept_code);
      const normName = normalizeDeptString(dept.name);
      if (normCode && normCode === normRaw) return dept;
      if (normName && normName === normRaw) return dept;
    }
  }

  // Tier 4: Singular/Plural variations & Word-boundary phrase matching
  if (normRaw && normRaw.length >= 3) {
    // 4a. Check simple plural/singular variations (e.g. pediatric vs pediatrics)
    for (const dept of departments) {
      const normName = normalizeDeptString(dept.name);
      const normCode = normalizeDeptString(dept.dept_code);
      for (const target of [normName, normCode]) {
        if (!target) continue;
        if (normRaw + "s" === target || normRaw === target + "s") return dept;
        if (normRaw + "es" === target || normRaw === target + "es") return dept;
        if (normRaw.replace(/ic$/, "ics") === target || normRaw === target.replace(/ic$/, "ics")) return dept;
      }
    }

    // 4b. Whole word-boundary subphrase match
    let bestMatch = null;
    let bestMatchScore = 0;

    for (const dept of departments) {
      const normName = normalizeDeptString(dept.name);
      const normCode = normalizeDeptString(dept.dept_code);

      for (const target of [normName, normCode]) {
        if (!target || target.length < 3) continue;

        const targetRegex = new RegExp(`(^|\\s)${escapeRegex(target)}(\\s|$)`, "i");
        const rawRegex = new RegExp(`(^|\\s)${escapeRegex(normRaw)}(\\s|$)`, "i");

        if (targetRegex.test(normRaw)) {
          if (target.length > bestMatchScore) {
            bestMatchScore = target.length;
            bestMatch = dept;
          }
        } else if (normRaw.length >= 4 && rawRegex.test(target)) {
          if (normRaw.length > bestMatchScore) {
            bestMatchScore = normRaw.length;
            bestMatch = dept;
          }
        }
      }
    }

    if (bestMatch) {
      return bestMatch;
    }
  }

  return null;
}


const DEFAULT_BRANDING = {
  logo_url: "",
  primary_color: "#0284C7",
  secondary_color: "#0369A1",
  accent_color: "#F0F9FF",
  tagline: "Care you can trust • NABH Accredited",
  emergency_helpline: "Emergency Helpline: 108 / +91 98765 43210",
  slip_footer_text: "Non-transferable official patient record. Please keep until consultation is complete.",
  opd_start_time: "08:00",
  opd_end_time: "20:00",
  registration_open_time: "08:00",
  registration_close_time: "20:00",
  registration_cutoff_time: "20:00",
  about_us_title: "About City General Hospital",
  about_us_subtitle: "Care you can trust • NABH Accredited",
  about_us: "City General Hospital is a premier medical institution dedicated to patient-first care. Our AI-driven intelligent queue orchestration minimizes waiting times and prioritizes critical medical needs dynamically.",
  about_us_hi: "सिटी जनरल अस्पताल मरीज़-प्रथम सेवा हेतु समर्पित एक अग्रणी चिकित्सा संस्थान है। हमारा एआई-संचालित बुद्धिमान कतार प्रबंधन प्रतीक्षा समय को कम करता है और गंभीर मामलों को प्राथमिकता देता है।",
  about_service_1: "24/7 Emergency Triage • Priority ambulance & ICU care",
  about_service_2: "AI Wait Prediction • Live queue synchronization",
  about_service_3: "Multi-Specialty OPD • General, Cardiac, Neuro, Ortho",
  about_service_4: "Digital E-Prescriptions • Seamless pharmacy refills",
  address: "742 Evergreen Healthcare Ave, Medical District, Suite 100",
  opd_helpdesk_phone: "+1 (800) 456-7890 (Ext: 101)",
  opd_helpdesk_hours: "Mon – Sat: 8:00 AM – 8:00 PM",
  opd_helpdesk_hours_hi: "सोम – शनि: सुबह 8:00 – रात 8:00",
  support_email: "support@citygeneralhospital.org",
  operating_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  available_time_slots: [
    "09:00 AM", "09:45 AM", "10:30 AM", "11:15 AM", "12:00 PM",
    "02:00 PM", "02:45 PM", "03:30 PM", "04:15 PM", "05:00 PM"
  ],
  closed_notice: "Registrations are closed for today. Please visit during OPD hours or book an appointment for tomorrow.",
};

/**
 * Super Admin Overview: aggregates platform or owner-scoped statistics.
 */
async function getSuperAdminOverview(requesterUser = null) {
  let ownerUid = null;
  const primaryCode = requesterUser?.primary_hospital_code || requesterUser?.hospital_code || null;
  const role = requesterUser ? (requesterUser.role || "").toLowerCase() : "";
  const isGlobalSuperAdmin = role === "superadmin" || role === "super_admin" || !!requesterUser?.is_superadmin;
  if (!isGlobalSuperAdmin && (role === "hospital_owner" || ["admin", "doctor", "staff"].includes(role))) {
    ownerUid = requesterUser.id;
  }

  const todayStr = getCurrentQueueDate();
  const todayDateObj = queueDateToPrismaDate(todayStr);

  const filterConditions = [];
  if (!isGlobalSuperAdmin) {
    if (ownerUid) {
      filterConditions.push({ owner_user_id: ownerUid });
      filterConditions.push({ employees: { some: { user_id: ownerUid } } });
    }
    if (primaryCode && primaryCode !== "all") {
      filterConditions.push({ hospital_code: primaryCode });
    }
    if (requesterUser?.email) {
      filterConditions.push({ email: { equals: requesterUser.email, mode: "insensitive" } });
    }
  }

  let hospitals = [];
  if (filterConditions.length > 0) {
    hospitals = await prisma.hospitals.findMany({
      where: { OR: filterConditions },
      select: { id: true, hospital_code: true, status: true },
    });
  }

  if (hospitals.length === 0) {
    hospitals = await prisma.hospitals.findMany({
      where: { status: "active" },
      select: { id: true, hospital_code: true, status: true },
    });
  }

  if (hospitals.length > 0) {

    const totalH = hospitals.length;
    const activeH = hospitals.filter((h) => h.status === "active").length;
    const hIds = hospitals.map((h) => h.id);
    if (hIds.length > 0) {
      const totalEmp = await prisma.employees.count({
        where: {
          hospital_id: { in: hIds },
          status: { in: ["active", "ACTIVE"] },
        },
      });

      let activeDocs = await prisma.employees.count({
        where: {
          hospital_id: { in: hIds },
          status: { in: ["active", "ACTIVE"] },
          users: {
            role: { in: ["doctor", "admin", "physician"] },
          },
        },
      });
      if (activeDocs === 0) {
        activeDocs = await prisma.users.count({
          where: {
            role: { in: ["doctor", "admin"] },
            status: { in: ["active", "ACTIVE"] },
          },
        });
      }

      const totalDesks = await prisma.desks.count({
        where: { hospital_id: { in: hIds } },
      });

      const activeDesks = await prisma.desks.count({
        where: {
          hospital_id: { in: hIds },
          OR: [
            { status: { in: ["OCCUPIED", "BUSY", "SERVING", "serving", "ACTIVE", "active", "AVAILABLE"] } },
            { assigned_employee_id: { not: null } },
          ],
        },
      });

      const todayTickets = await prisma.tickets.count({
        where: {
          hospital_id: { in: hIds },
          status: { in: ["completed", "COMPLETED"] },
          OR: [
            { queue_date: todayDateObj },
            { created_at: { gte: todayDateObj } },
          ],
        },
      });

      const activeQueues = await prisma.tickets.count({
        where: {
          hospital_id: { in: hIds },
          status: { in: ["waiting", "called", "serving", "WAITING", "CALLED", "SERVING"] },
        },
      });

      const totalTickets = await prisma.tickets.count({
        where: {
          hospital_id: { in: hIds },
          status: { notIn: ["transferred", "TRANSFERRED"] },
        },
      });


      const usersOrConditions = [{ employees: { some: { hospital_id: { in: hIds } } } }];
      if (ownerUid != null) {
        usersOrConditions.push({ id: ownerUid });
      }
      const totalUsers = await prisma.users.count({
        where: { OR: usersOrConditions },
      });


      return {
        total_hospitals: totalH,
        active_hospitals: activeH,
        total_employees: totalEmp,
        active_doctors: activeDocs,
        total_desks: totalDesks,
        active_desks: activeDesks,
        patients_today: todayTickets,
        active_queues: activeQueues,
        total_users: totalUsers,
        total_tickets: totalTickets,
      };
    }

    return {
      total_hospitals: 0,
      active_hospitals: 0,
      total_employees: 0,
      active_doctors: 0,
      total_desks: 0,
      active_desks: 0,
      patients_today: 0,
      active_queues: 0,
      total_users: 1,
      total_tickets: 0,
    };
  }

  // Global aggregate
  const totalH = await prisma.hospitals.count();
  const activeH = await prisma.hospitals.count({ where: { status: "active" } });
  let activeDocs = await prisma.employees.count({
    where: {
      status: "active",
      users: {
        role: { in: ["doctor", "admin", "physician"] },
      },
    },
  });
  if (activeDocs === 0) {
    activeDocs = await prisma.users.count({
      where: {
        role: { in: ["doctor", "admin"] },
        status: "active",
      },
    });
  }
  const totalDesks = await prisma.desks.count();
  const activeDesks = await prisma.desks.count({
    where: {
      OR: [
        { status: { in: ["OCCUPIED", "BUSY", "SERVING", "serving", "ACTIVE"] } },
        { AND: [{ status: "AVAILABLE" }, { assigned_employee_id: { not: null } }] },
      ],
    },
  });
  const todayTickets = await prisma.tickets.count({
    where: {
      status: { notIn: ["transferred", "TRANSFERRED"] },
      OR: [
        { queue_date: todayDateObj },
        { created_at: { gte: todayDateObj } },
      ],
    },
  });
  const activeQueues = await prisma.tickets.count({
    where: { status: { in: ["waiting", "called", "serving", "WAITING", "CALLED", "SERVING"] } },
  });
  const totalTickets = await prisma.tickets.count({
    where: {
      status: { notIn: ["transferred", "TRANSFERRED"] },
    },
  });
  const totalUsers = await prisma.users.count();

  return {
    total_hospitals: totalH,
    active_hospitals: activeH,
    total_employees: totalEmp,
    active_doctors: activeDocs,
    total_desks: totalDesks,
    active_desks: activeDesks,
    patients_today: todayTickets,
    active_queues: activeQueues,
    total_users: totalUsers,
    total_tickets: totalTickets,
  };
}

/**
 * Lists hospitals scoped to user ownership or all hospitals for global admin.
 */
async function getAllHospitals(requesterUser = null) {
  let list = [];
  const role = requesterUser ? (requesterUser.role || "").toLowerCase() : "";
  const isGlobalSuperAdmin = role === "superadmin" || role === "super_admin" || !!requesterUser?.is_superadmin;

  if (isGlobalSuperAdmin) {
    list = await prisma.hospitals.findMany({
      orderBy: { id: "asc" },
    });
  } else if (requesterUser) {
    const primaryCode = requesterUser.primary_hospital_code || requesterUser.hospital_code || null;

    const conditions = [];
    if (requesterUser.id) {
      conditions.push({ owner_user_id: requesterUser.id });
      conditions.push({ employees: { some: { user_id: requesterUser.id } } });
    }
    if (primaryCode && primaryCode !== "all") {
      conditions.push({ hospital_code: primaryCode });
    }
    if (requesterUser.email) {
      conditions.push({ email: { equals: requesterUser.email, mode: "insensitive" } });
    }

    if (conditions.length > 0) {
      const owned = await prisma.hospitals.findMany({
        where: {
          AND: [
            { status: "active" },
            { OR: conditions },
          ],
        },
        orderBy: { id: "asc" },
      });
      if (owned && owned.length > 0) {
        list = owned;
      }
    }
  }

  if (!list || list.length === 0) {
    list = await prisma.hospitals.findMany({
      where: { status: "active" },
      orderBy: { id: "asc" },
    });
  }

  if (!list || list.length === 0) return [];

  const hIds = list.map((h) => h.id);
  const todayStr = getCurrentQueueDate();
  const todayDateObj = queueDateToPrismaDate(todayStr);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [empCounts, docCounts, deskCounts, activeDeskCounts, todayTicketCounts, todayCompletedCounts, allTicketCounts] = await Promise.all([
    prisma.employees.groupBy({
      by: ["hospital_id"],
      _count: { id: true },
      where: { hospital_id: { in: hIds } },
    }),
    prisma.employees.groupBy({
      by: ["hospital_id"],
      _count: { id: true },
      where: {
        hospital_id: { in: hIds },
        users: { role: { in: ["doctor", "admin", "physician"] } },
      },
    }),
    prisma.desks.groupBy({
      by: ["hospital_id"],
      _count: { id: true },
      where: { hospital_id: { in: hIds } },
    }),
    prisma.desks.groupBy({
      by: ["hospital_id"],
      _count: { id: true },
      where: {
        hospital_id: { in: hIds },
        OR: [
          { status: { in: ["AVAILABLE", "OCCUPIED", "BUSY", "CALLING", "ACTIVE", "active", "SERVING", "serving"] } },
          { assigned_employee_id: { not: null } },
        ],
      },
    }),
    prisma.tickets.groupBy({
      by: ["hospital_id"],
      _count: { id: true },
      where: {
        hospital_id: { in: hIds },
        status: { in: ["completed", "COMPLETED"] },
        OR: [
          { queue_date: todayDateObj },
          { created_at: { gte: startOfDay } },
          { join_timestamp: { gte: startOfDay } },
        ],
      },
    }),
    prisma.tickets.groupBy({
      by: ["hospital_id"],
      _count: { id: true },
      where: {
        hospital_id: { in: hIds },
        status: { in: ["completed", "COMPLETED"] },
        OR: [
          { queue_date: todayDateObj },
          { created_at: { gte: startOfDay } },
          { join_timestamp: { gte: startOfDay } },
        ],
      },
    }),
    prisma.tickets.groupBy({
      by: ["hospital_id"],
      _count: { id: true },
      where: {
        hospital_id: { in: hIds },
        status: { notIn: ["transferred", "TRANSFERRED"] },
      },
    }),
  ]);

  const empMap = new Map(empCounts.map((e) => [e.hospital_id, e._count.id]));
  const docMap = new Map(docCounts.map((d) => [d.hospital_id, d._count.id]));
  const deskMap = new Map(deskCounts.map((k) => [k.hospital_id, k._count.id]));
  const activeDeskMap = new Map(activeDeskCounts.map((a) => [a.hospital_id, a._count.id]));
  const todayTicketMap = new Map(todayTicketCounts.map((t) => [t.hospital_id, t._count.id]));
  const todayCompletedMap = new Map(todayCompletedCounts.map((t) => [t.hospital_id, t._count.id]));
  const allTicketMap = new Map(allTicketCounts.map((t) => [t.hospital_id, t._count.id]));

  return list.map((h) => {
    let parsedBranding = {};
    if (h.branding_json) {
      parsedBranding = typeof h.branding_json === "string" ? (() => { try { return JSON.parse(h.branding_json); } catch (e) { return {}; } })() : (h.branding_json || {});
    }
    return {
      ...h,
      branding: parsedBranding,
      about_us_hi: parsedBranding.about_us_hi || null,
      description_hi: parsedBranding.about_us_hi || null,
      employee_count: empMap.get(h.id) ?? 0,
      doctor_count: docMap.get(h.id) ?? 0,
      total_desks: deskMap.get(h.id) ?? 0,
      active_desks: Math.min(deskMap.get(h.id) ?? 0, activeDeskMap.get(h.id) ?? 0),
      patients_today: todayCompletedMap.get(h.id) ?? 0,
      completed_today: todayCompletedMap.get(h.id) ?? 0,
      total_visits: allTicketMap.get(h.id) ?? 0,
    };
  });
}

/**
 * Fetches hospital details by hospital_code.
 */
async function getHospitalByCode(hospitalCode) {
  return prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
    include: {
      departments: true,
      desks: true,
      kiosks: true,
    },
  });
}

/**
 * Checks whether a hospital code is available for registration.
 */
async function checkHospitalCodeAvailable(code) {
  const hCode = String(code || "").trim().toLowerCase();
  if (!hCode) return false;
  const existing = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
    select: { id: true },
  });
  return !existing;
}

/**
 * Creates a new hospital tenant, seeds selected departments and desks,
 * optionally creates a hospital administrator user + employee, and records audit log,
 * all within an atomic Prisma transaction.
 */
async function createHospital({
  hospitalCode,
  name,
  type = "Private",
  registrationNo = "",
  nabhStatus = "Not Accredited",
  nabhNumber = "",
  nabhValidUntil = null,
  establishedYear = null,
  totalBeds = null,
  icuBeds = null,
  tagline = "",
  phone = "",
  altPhone = "",
  emergencyHelpline = "",
  email = "",
  supportEmail = "",
  website = "",
  addressLine1 = "",
  addressLine2 = "",
  city = "",
  state = "",
  pincode = "",
  country = "India",
  mapsLink = "",
  address = "",
  opdStartTime = "08:00",
  opdEndTime = "20:00",
  registrationCutoff = "20:00",
  timezone = "Asia/Kolkata",
  workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  departments = [],
  languages = ["English", "Hindi"],
  admin = null,
  primaryColor = "#0284C7",
  secondaryColor = "#0369A1",
  accentColor = "#F0F9FF",
  aboutUs = "",
  description = "",
  logoUrl = "",
  status = "active",
  ownerUserId = null,
}) {
  const hCode = String(hospitalCode).trim().toLowerCase();

  return await prisma.$transaction(async (tx) => {
    // 1. Uniqueness check for hospital code
    const existingHosp = await tx.hospitals.findUnique({
      where: { hospital_code: hCode },
      select: { id: true },
    });
    if (existingHosp) {
      const err = new Error("Hospital code already exists");
      err.status = 409;
      throw err;
    }

    // 2. Uniqueness check for admin email if provided
    let cleanAdminEmail = null;
    const shouldCreateAdmin = admin && admin.create_admin !== false && admin.email;
    if (shouldCreateAdmin) {
      cleanAdminEmail = String(admin.email).trim().toLowerCase();
      const existingUser = await tx.users.findUnique({
        where: { email: cleanAdminEmail },
        select: { id: true },
      });
      if (existingUser) {
        const err = new Error(`Admin email '${cleanAdminEmail}' is already registered.`);
        err.status = 409;
        throw err;
      }
    }

    // 3. Assemble full address & branding_json
    const addressParts = [
      addressLine1 || address,
      addressLine2,
      city,
      state,
      pincode ? (pincode.startsWith("PIN") ? pincode : `PIN ${pincode}`) : "",
      country,
    ].filter(Boolean);
    const resolvedAddress = addressParts.join(", ") || address || "";

    const brandingJson = {
      logo_url: logoUrl || "",
      primary_color: primaryColor || "#0284C7",
      secondary_color: secondaryColor || "#0369A1",
      accent_color: accentColor || "#F0F9FF",
      tagline: tagline || "Care you can trust • NABH Accredited",
      emergency_helpline: emergencyHelpline || phone || "108",
      support_email: supportEmail || email || "",
      opd_start_time: opdStartTime || "08:00",
      opd_end_time: opdEndTime || "20:00",
      registration_cutoff_time: registrationCutoff || opdEndTime || "20:00",
      about_us: aboutUs || description || "",
      profile: {
        type: type || "Private",
        registration_no: registrationNo || "",
        nabh: {
          status: nabhStatus || "Not Accredited",
          number: nabhNumber || "",
          valid_until: nabhValidUntil || null,
        },
        established_year: establishedYear ? parseInt(establishedYear, 10) : null,
        total_beds: totalBeds !== null && totalBeds !== undefined && totalBeds !== "" ? parseInt(totalBeds, 10) : null,
        icu_beds: icuBeds !== null && icuBeds !== undefined && icuBeds !== "" ? parseInt(icuBeds, 10) : null,
        alt_phone: altPhone || "",
        website: website || "",
        address_line1: addressLine1 || "",
        address_line2: addressLine2 || "",
        city: city || "",
        state: state || "",
        pincode: pincode || "",
        country: country || "India",
        maps_link: mapsLink || "",
        working_days: Array.isArray(workingDays) && workingDays.length > 0 ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        registration_cutoff: registrationCutoff || "20:00",
        timezone: timezone || "Asia/Kolkata",
        languages: Array.isArray(languages) && languages.length > 0 ? languages : ["English", "Hindi"],
      },
    };

    // 4. Create hospital record
    const hospital = await tx.hospitals.create({
      data: {
        hospital_code: hCode,
        name,
        address: resolvedAddress,
        phone,
        email,
        description: description || aboutUs || "",
        logo_url: logoUrl || "",
        status,
        owner_user_id: ownerUserId,
        branding_json: brandingJson,
      },
    });

    // 5. Create selected departments and their desks
    let deptsList = departments;
    if (!Array.isArray(deptsList) || deptsList.length === 0) {
      deptsList = [
        { dept_code: "consultation", name: "General Consultation (OPD)", description: "General outpatient doctor examinations", desk_count: 1 },
        { dept_code: "pharmacy", name: "Pharmacy & Medicine", description: "Prescription dispensing and clinical pharmacy", desk_count: 1 },
        { dept_code: "laboratory", name: "Pathology & Lab Test", description: "Diagnostic blood, urine and pathology assays", desk_count: 1 },
        { dept_code: "radiology", name: "Radiology & X-Ray", description: "X-Ray, CT Scan, MRI and ultrasound imaging", desk_count: 1 },
        { dept_code: "emergency", name: "Emergency Triage", description: "Critical emergency resuscitation and trauma", desk_count: 1 },
        { dept_code: "billing", name: "Central Billing & Cashier", description: "OPD billing and fee collection counters", desk_count: 1 },
        { dept_code: "reception", name: "OPD Reception", description: "Patient registration and inquiry desk", desk_count: 1 },
      ];
    }

    let totalDesksCreated = 0;
    const createdDepartments = [];

    for (const d of deptsList) {
      const dCode = String(d.dept_code || "").trim().toLowerCase();
      if (!dCode) continue;
      const dName = String(d.name || dCode).trim();
      const dDesc = String(d.description || "").trim();
      const deskCount = Math.max(1, Math.min(20, parseInt(d.desk_count, 10) || 1));

      const dept = await tx.departments.create({
        data: {
          hospital_id: hospital.id,
          dept_code: dCode,
          name: dName,
          description: dDesc,
          status: "active",
        },
      });
      createdDepartments.push(dept);

      for (let i = 1; i <= deskCount; i++) {
        const deskPrefix = dCode === "billing" ? "Counter" : "Desk";
        await tx.desks.create({
          data: {
            hospital_id: hospital.id,
            department_id: dept.id,
            desk_number: i,
            desk_name: `${deskPrefix} ${i}`,
            status: "AVAILABLE",
          },
        });
        totalDesksCreated++;
      }
    }

    // 6. Optional Admin user & employee creation
    let createdAdminUser = null;
    if (shouldCreateAdmin) {
      const adminPassword = admin.password || `Admin@${Math.floor(1000 + Math.random() * 9000)}`;
      const pwdHash = await hashPassword(adminPassword);
      const adminName = String(admin.name || "Hospital Admin").trim();
      const adminPhone = String(admin.phone || "").trim();

      const user = await tx.users.create({
        data: {
          email: cleanAdminEmail,
          username: adminName,
          password_hash: pwdHash,
          role: "admin",
          status: "active",
          phone: adminPhone,
          primary_hospital_code: hCode,
        },
      });

      const employee = await tx.employees.create({
        data: {
          user_id: user.id,
          hospital_id: hospital.id,
          department_id: null,
          employee_code: `ADM-${hospital.id}-01`,
          name: adminName,
          email: cleanAdminEmail,
          phone: adminPhone,
          status: "active",
          profile_json: {
            role: "admin",
            must_change_password: true,
            hospital_code: hCode,
          },
        },
      });

      createdAdminUser = {
        id: user.id,
        email: user.email,
        name: user.username,
        employee_code: employee.employee_code,
        temporary_password: adminPassword,
      };
    }

    // 7. Audit log
    await tx.audit_logs.create({
      data: {
        hospital_id: hospital.id,
        user_id: ownerUserId,
        action: "CREATE_HOSPITAL_WIZARD",
        entity_type: "hospital",
        entity_id: String(hospital.id),
        new_values: {
          code: hCode,
          name,
          departments_count: createdDepartments.length,
          desks_count: totalDesksCreated,
          admin_created: !!createdAdminUser,
        },
      },
    });

    return {
      hospital,
      departments_count: createdDepartments.length,
      desks_count: totalDesksCreated,
      admin_user: createdAdminUser,
    };
  });
}

/**
 * Updates hospital profile information.
 */
async function updateHospital(hospitalCode, data) {
  const hCode = String(hospitalCode).trim();
  const existing = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
    select: { branding_json: true },
  });

  const updateData = {
    name: data.name,
    address: data.address || "",
    phone: data.phone || "",
    email: data.email || "",
    description: data.description || "",
    logo_url: data.logo_url || "",
    status: data.status || "active",
    updated_at: new Date(),
  };

  const existingBranding = existing?.branding_json || {};
  let newBranding = { ...existingBranding };

  if (data.branding_json !== undefined) {
    newBranding = { ...newBranding, ...data.branding_json };
  }
  if (data.profile !== undefined) {
    newBranding.profile = { ...(newBranding.profile || {}), ...data.profile };
  }
  updateData.branding_json = newBranding;

  return prisma.hospitals.update({
    where: { hospital_code: hCode },
    data: updateData,
  });
}

/**
 * Gets tenant branding, custom slip settings, and operating hours.
 */
async function getHospitalBranding(hospitalCode) {
  const hCode = String(hospitalCode).trim();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
    select: {
      id: true,
      hospital_code: true,
      name: true,
      logo_url: true,
      phone: true,
      email: true,
      address: true,
      description: true,
      branding_json: true,
      status: true,
    },
  });

  if (!hosp) {
    const err = new Error(`Hospital '${hCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const raw = hosp.branding_json || {};
  return {
    ...DEFAULT_BRANDING,
    ...raw,
    hospital_name: hosp.name,
    hospital_code: hosp.hospital_code,
    logo_url: raw.logo_url || hosp.logo_url || "",
    phone: hosp.phone || raw.opd_helpdesk_phone || raw.emergency_helpline || DEFAULT_BRANDING.opd_helpdesk_phone,
    opd_helpdesk_phone: raw.opd_helpdesk_phone || hosp.phone || DEFAULT_BRANDING.opd_helpdesk_phone,
    opd_helpdesk_hours: raw.opd_helpdesk_hours || DEFAULT_BRANDING.opd_helpdesk_hours,
    opd_helpdesk_hours_hi: raw.opd_helpdesk_hours_hi || DEFAULT_BRANDING.opd_helpdesk_hours_hi,
    email: hosp.email || raw.support_email || raw.email || DEFAULT_BRANDING.support_email,
    support_email: raw.support_email || raw.email || hosp.email || DEFAULT_BRANDING.support_email,
    address: hosp.address || raw.address || DEFAULT_BRANDING.address,
    status: hosp.status || "active",
  };
}

/**
 * Updates tenant branding, token slip settings, and operating hours.
 */
async function updateHospitalBranding(hospitalCode, brandingData) {
  const hCode = String(hospitalCode).trim();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
  });

  if (!hosp) {
    const err = new Error(`Hospital '${hCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const existing = hosp.branding_json || {};
  const merged = {
    ...DEFAULT_BRANDING,
    ...existing,
    ...brandingData,
  };

  if (brandingData.opd_start_time) {
    merged.registration_open_time = brandingData.opd_start_time;
  }
  if (brandingData.opd_end_time) {
    merged.registration_close_time = brandingData.opd_end_time;
  }
  if (brandingData.registration_open_time) {
    merged.opd_start_time = brandingData.registration_open_time;
  }
  if (brandingData.registration_close_time) {
    merged.opd_end_time = brandingData.registration_close_time;
  }
  if (brandingData.available_time_slots !== undefined) {
    if (Array.isArray(brandingData.available_time_slots)) {
      merged.available_time_slots = brandingData.available_time_slots
        .map((s) => String(s || "").trim())
        .filter(Boolean);
    } else {
      merged.available_time_slots = [];
    }
  }

  const updatePayload = {
    branding_json: merged,
    updated_at: new Date(),
  };

  if (brandingData.logo_url !== undefined) {
    updatePayload.logo_url = brandingData.logo_url;
  }
  if (brandingData.hospital_name && brandingData.hospital_name.trim()) {
    updatePayload.name = brandingData.hospital_name.trim();
  } else if (brandingData.name && brandingData.name.trim()) {
    updatePayload.name = brandingData.name.trim();
  }
  if (brandingData.address !== undefined) {
    updatePayload.address = brandingData.address.trim();
  }
  if (brandingData.support_email !== undefined) {
    updatePayload.email = brandingData.support_email.trim();
  } else if (brandingData.email !== undefined) {
    updatePayload.email = brandingData.email.trim();
  }
  if (brandingData.opd_helpdesk_phone !== undefined) {
    updatePayload.phone = brandingData.opd_helpdesk_phone.trim();
  } else if (brandingData.emergency_helpline && brandingData.emergency_helpline.trim()) {
    updatePayload.phone = brandingData.emergency_helpline.trim();
  } else if (brandingData.phone && brandingData.phone.trim()) {
    updatePayload.phone = brandingData.phone.trim();
  }
  if (brandingData.about_us && brandingData.about_us.trim()) {
    updatePayload.description = brandingData.about_us.trim();
  }

  const updatedHosp = await prisma.hospitals.update({
    where: { hospital_code: hCode },
    data: updatePayload,
  });

  return {
    status: "success",
    hospital_code: hCode,
    branding: {
      ...merged,
      hospital_name: updatedHosp.name,
      logo_url: updatedHosp.logo_url || merged.logo_url,
      phone: updatedHosp.phone || merged.opd_helpdesk_phone || merged.emergency_helpline,
      address: updatedHosp.address || merged.address,
      email: updatedHosp.email || merged.support_email,
    },
  };
}

/**
 * Archives a hospital (soft delete).
 * Archived hospitals are hidden from patient and staff portals, cannot create tickets,
 * and can be restored by a super admin.
 */
async function archiveHospital(hospitalCode) {
  const hCode = String(hospitalCode).trim();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
  });

  if (!hosp) {
    const err = new Error(`Hospital '${hCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const updated = await prisma.hospitals.update({
    where: { hospital_code: hCode },
    data: {
      status: "archived",
      updated_at: new Date(),
    },
  });

  return {
    status: "success",
    message: `Hospital '${hosp.name}' (${hCode}) has been archived.`,
    hospital: updated,
  };
}

/**
 * Restores an archived hospital to active status.
 */
async function restoreHospital(hospitalCode) {
  const hCode = String(hospitalCode).trim();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
  });

  if (!hosp) {
    const err = new Error(`Hospital '${hCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const updated = await prisma.hospitals.update({
    where: { hospital_code: hCode },
    data: {
      status: "active",
      updated_at: new Date(),
    },
  });

  return {
    status: "success",
    message: `Hospital '${hosp.name}' (${hCode}) has been restored to active status.`,
    hospital: updated,
  };
}

/**
 * Backward-compatible delete alias: safely archives the hospital.
 */
async function deleteHospital(hospitalCode) {
  return archiveHospital(hospitalCode);
}

/**
 * Summarizes all records connected to a hospital before permanent purge.
 */
async function getHospitalPurgeSummary(hospitalCode) {
  const hCode = String(hospitalCode).trim();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
  });

  if (!hosp) {
    const err = new Error(`Hospital '${hCode}' not found.`);
    err.status = 404;
    throw err;
  }
  const hId = hosp.id;

  const [
    ticketsCount,
    appointmentsCount,
    employeesCount,
    departmentsCount,
    desksCount,
    kiosksCount,
    billsCount,
    paymentsCount,
    broadcastsCount,
    visitHistoryCount,
    serviceLogsCount,
  ] = await Promise.all([
    prisma.tickets.count({ where: { hospital_id: hId } }),
    prisma.appointments.count({ where: { hospital_id: hId } }),
    prisma.employees.count({ where: { hospital_id: hId } }),
    prisma.departments.count({ where: { hospital_id: hId } }),
    prisma.desks.count({ where: { hospital_id: hId } }),
    prisma.kiosks.count({ where: { hospital_id: hId } }),
    prisma.bills.count({ where: { hospital_id: hId } }),
    prisma.payments.count({ where: { bills: { hospital_id: hId } } }),
    prisma.broadcasts.count({ where: { hospital_code: hCode } }),
    prisma.visit_history.count({ where: { hospital_id: hId } }),
    prisma.service_logs.count({ where: { hospital_id: hId } }),
  ]);

  return {
    hospital_code: hCode,
    name: hosp.name,
    status: hosp.status,
    counts: {
      tickets: ticketsCount,
      appointments: appointmentsCount,
      employees: employeesCount,
      departments: departmentsCount,
      desks: desksCount,
      kiosks: kiosksCount,
      bills: billsCount,
      payments: paymentsCount,
      broadcasts: broadcastsCount,
      visit_history: visitHistoryCount,
      service_logs: serviceLogsCount,
    },
  };
}

/**
 * Permanently purges an archived hospital and all its related records in ONE single transaction.
 * Requires confirm_code to match hospital_code exactly.
 */
async function purgeHospital(hospitalCode, confirmCode) {
  const hCode = String(hospitalCode || "").trim();
  if (!confirmCode || String(confirmCode).trim() !== hCode) {
    const err = new Error(`Confirmation code mismatch. You must provide confirm_code="${hCode}" to permanently purge.`);
    err.status = 400;
    throw err;
  }

  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hCode}' not found.`);
    err.status = 404;
    throw err;
  }

  if (hosp.status !== "archived") {
    const err = new Error(`Hospital '${hCode}' must be archived before it can be permanently purged.`);
    err.status = 400;
    throw err;
  }

  const hId = hosp.id;

  // Execute all entity deletions inside ONE transaction
  const purgeSummary = await prisma.$transaction(async (tx) => {
    // 1. service_logs
    const sl = await tx.service_logs.deleteMany({ where: { hospital_id: hId } });

    // 2. queue_events
    const qe = await tx.queue_events.deleteMany({ where: { hospital_id: hId } });

    // 3. tickets
    const tk = await tx.tickets.deleteMany({ where: { hospital_id: hId } });

    // 4. appointment_status_history & 5. appointments
    const appts = await tx.appointments.findMany({
      where: { hospital_id: hId },
      select: { id: true },
    });
    const apptIds = appts.map((a) => a.id);
    let ashCount = 0;
    if (apptIds.length > 0) {
      const ash = await tx.appointment_status_history.deleteMany({
        where: { appointment_id: { in: apptIds } },
      });
      ashCount = ash.count;
    }
    const ap = await tx.appointments.deleteMany({ where: { hospital_id: hId } });

    // 6. visit_history
    const vh = await tx.visit_history.deleteMany({ where: { hospital_id: hId } });

    // 7. prescriptions
    const pr = await tx.prescriptions.deleteMany({ where: { hospital_id: hId } });

    // 8. medical_reports
    const mr = await tx.medical_reports.deleteMany({ where: { hospital_id: hId } });

    // 9. refunds, 10. payments, 11. bill_items, 12. bills
    const bills = await tx.bills.findMany({
      where: { hospital_id: hId },
      select: { id: true },
    });
    const billIds = bills.map((b) => b.id);
    let refCount = 0;
    let payCount = 0;
    let biCount = 0;
    if (billIds.length > 0) {
      const rf = await tx.refunds.deleteMany({ where: { bill_id: { in: billIds } } });
      refCount = rf.count;
      const pm = await tx.payments.deleteMany({ where: { bill_id: { in: billIds } } });
      payCount = pm.count;
      const bi = await tx.bill_items.deleteMany({ where: { bill_id: { in: billIds } } });
      biCount = bi.count;
    }
    const bl = await tx.bills.deleteMany({ where: { hospital_id: hId } });

    // 13. cash_shifts
    const cs = await tx.cash_shifts.deleteMany({ where: { hospital_id: hId } });

    // 14. service_tariffs
    const st = await tx.service_tariffs.deleteMany({ where: { hospital_id: hId } });

    // 15. hospital_billing_counters
    const hbc = await tx.hospital_billing_counters.deleteMany({ where: { hospital_id: hId } });

    // 16. broadcasts
    const bc = await tx.broadcasts.deleteMany({ where: { hospital_code: hCode } });

    // 17. desks
    const dk = await tx.desks.deleteMany({ where: { hospital_id: hId } });

    // 18. kiosks
    const kk = await tx.kiosks.deleteMany({ where: { hospital_id: hId } });

    // Find users belonging ONLY to this hospital
    const empUsers = await tx.employees.findMany({
      where: { hospital_id: hId },
      select: { user_id: true },
    });
    const empUserIds = empUsers.map((e) => e.user_id).filter(Boolean);

    const primaryUsers = await tx.users.findMany({
      where: { primary_hospital_code: hCode },
      select: { id: true, role: true },
    });

    const candidateUserIds = Array.from(new Set([...empUserIds, ...primaryUsers.map((u) => u.id)]));
    const safeToDeleteUserIds = [];

    for (const uid of candidateUserIds) {
      const user = await tx.users.findUnique({
        where: { id: uid },
        select: { id: true, role: true },
      });
      if (!user) continue;
      const r = (user.role || "").toLowerCase();
      if (r === "superadmin" || r === "super_admin" || r === "hospital_owner") {
        continue; // Never delete superadmin or owner accounts
      }
      // Check if user is employed in any other hospital
      const otherEmploys = await tx.employees.count({
        where: { user_id: uid, hospital_id: { not: hId } },
      });
      if (otherEmploys === 0) {
        safeToDeleteUserIds.push(uid);
      }
    }

    // 19. employees
    const ep = await tx.employees.deleteMany({ where: { hospital_id: hId } });

    // 20. departments
    const dp = await tx.departments.deleteMany({ where: { hospital_id: hId } });

    // 21. tenant_mapping
    const tm = await tx.tenant_mapping.deleteMany({ where: { hospital_id: hId } });

    // 22. tenant_config
    const tc = await tx.tenant_config.deleteMany({ where: { hospital_id: hId } });

    // 23. tenant_historical_data
    const th = await tx.tenant_historical_data.deleteMany({
      where: {
        OR: [{ hospital_id: hId }, { legacy_tenant_id: hCode }],
      },
    });

    // 24. users that belong ONLY to that hospital
    let usersCount = 0;
    if (safeToDeleteUserIds.length > 0) {
      const uRes = await tx.users.deleteMany({
        where: { id: { in: safeToDeleteUserIds } },
      });
      usersCount = uRes.count;
    }

    // 25. audit_logs for that hospital
    const al = await tx.audit_logs.deleteMany({ where: { hospital_id: hId } });

    // 26. hospital
    await tx.hospitals.delete({ where: { id: hId } });

    return {
      service_logs: sl.count,
      queue_events: qe.count,
      tickets: tk.count,
      appointments: ap.count,
      appointment_status_history: ashCount,
      visit_history: vh.count,
      prescriptions: pr.count,
      medical_reports: mr.count,
      bills: bl.count,
      bill_items: biCount,
      payments: payCount,
      refunds: refCount,
      cash_shifts: cs.count,
      service_tariffs: st.count,
      hospital_billing_counters: hbc.count,
      broadcasts: bc.count,
      desks: dk.count,
      kiosks: kk.count,
      employees: ep.count,
      departments: dp.count,
      tenant_mapping: tm.count,
      tenant_config: tc.count,
      tenant_historical_data: th.count,
      users: usersCount,
      audit_logs: al.count,
    };
  });

  return {
    status: "success",
    message: `Hospital '${hosp.name}' (${hCode}) and all related records permanently purged.`,
    summary: purgeSummary,
  };
}

/**
 * Exports all core hospital data in CSV format for archival before purge.
 */
async function exportHospitalData(hospitalCode) {
  const hCode = String(hospitalCode).trim();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
  });

  if (!hosp) {
    const err = new Error(`Hospital '${hCode}' not found.`);
    err.status = 404;
    throw err;
  }
  const hId = hosp.id;

  const [departments, employees, desks, appointments, tickets] = await Promise.all([
    prisma.departments.findMany({ where: { hospital_id: hId } }),
    prisma.employees.findMany({ where: { hospital_id: hId }, include: { users: true } }),
    prisma.desks.findMany({ where: { hospital_id: hId } }),
    prisma.appointments.findMany({ where: { hospital_id: hId }, take: 1000 }),
    prisma.tickets.findMany({ where: { hospital_id: hId }, take: 1000 }),
  ]);

  const lines = [];
  lines.push(`HOSPITAL EXPORT BACKUP - ${hosp.name} (${hCode}) - Exported at ${new Date().toISOString()}`);
  lines.push("");

  lines.push("--- HOSPITAL DETAILS ---");
  lines.push("Name,Code,Phone,Email,Status,Address");
  lines.push(`"${hosp.name}","${hosp.hospital_code}","${hosp.phone || ''}","${hosp.email || ''}","${hosp.status}","${(hosp.address || '').replace(/"/g, '""')}"`);
  lines.push("");

  lines.push("--- DEPARTMENTS ---");
  lines.push("ID,Dept Code,Name,Status");
  for (const d of departments) {
    lines.push(`${d.id},"${d.dept_code}","${d.name}","${d.status}"`);
  }
  lines.push("");

  lines.push("--- EMPLOYEES ---");
  lines.push("ID,Emp Code,Name,Role,Email,Phone,Status");
  for (const e of employees) {
    lines.push(`${e.id},"${e.employee_code}","${e.name}","${e.role || e.users?.role || ''}","${e.email}","${e.phone || ''}","${e.status}"`);
  }
  lines.push("");

  lines.push("--- DESKS ---");
  lines.push("ID,Desk Number,Name,Status,Dept ID");
  for (const dk of desks) {
    lines.push(`${dk.id},"${dk.desk_number}","${dk.desk_name}","${dk.status}",${dk.department_id}`);
  }
  lines.push("");

  lines.push("--- TICKETS (Latest up to 1000) ---");
  lines.push("ID,Ticket Number,Token,Status,Priority,Category,Created At");
  for (const t of tickets) {
    lines.push(`"${t.id}","${t.ticket_number || ''}","${t.token_number || ''}","${t.status}","${t.priority}","${t.service_category || ''}","${t.created_at?.toISOString() || ''}"`);
  }
  lines.push("");

  lines.push("--- APPOINTMENTS (Latest up to 1000) ---");
  lines.push("ID,Date,Slot,Status,Reason");
  for (const a of appointments) {
    lines.push(`${a.id},"${a.appointment_date?.toISOString() || ''}","${a.appointment_time || ''}","${a.status}","${(a.reason || '').replace(/"/g, '""')}"`);
  }

  return lines.join("\n");
}

/**
 * Lists employees for a given hospital.
 */
async function getHospitalEmployees(hospitalCode) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) return [];

  const employees = await prisma.employees.findMany({
    where: { hospital_id: hosp.id },
    include: {
      users: true,
      departments: true,
    },
    orderBy: { id: "asc" },
  });

  const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours max session window
  const now = Date.now();

  return employees.map((e) => {
    let dutyInfo = null;
    try {
      dutyInfo = getDoctorDutyStatus(e.user_id, e.email, e.employee_code, e.name);
    } catch (_) {}

    // Check last login timestamp
    const lastLogin = e.users?.last_login_at ? new Date(e.users.last_login_at).getTime() : null;
    const isSessionFresh = !!lastLogin && (now - lastLogin <= SESSION_MAX_AGE_MS);

    // Prioritize real-time duty status from memory store if present
    const memoryStatus = dutyInfo?.status ? String(dutyInfo.status).toUpperCase() : null;
    const isDutyActive = memoryStatus === "ACTIVE";
    const isDutyProcessing = memoryStatus === "PROCESSING" || e.status === "processing";
    const isDutyBreak = memoryStatus === "ON_BREAK" || e.status === "on_break";
    const isDutyEmergency = memoryStatus === "EMERGENCY_ROUND" || e.status === "emergency_round";
    const isDutyOff = memoryStatus === "OFF_DUTY" || memoryStatus === "SHIFT_ENDED" || e.status === "off_duty" || e.status === "shift_ended";
    const isAccountInactive = (e.status && e.status.toLowerCase() === "inactive") || (e.users?.status && e.users.status.toLowerCase() === "inactive");

    let effectiveStatus = isAccountInactive ? "inactive" : (e.status || "active");
    let dutyStatusLabel = "OFF_DUTY";

    if (isAccountInactive) {
      effectiveStatus = "inactive";
      dutyStatusLabel = "OFF_DUTY";
    } else if (isDutyOff) {
      effectiveStatus = (memoryStatus === "SHIFT_ENDED" || e.status === "shift_ended") ? "shift_ended" : "off_duty";
      dutyStatusLabel = (memoryStatus === "SHIFT_ENDED" || e.status === "shift_ended") ? "SHIFT_ENDED" : "OFF_DUTY";
    } else if (isDutyBreak && isSessionFresh) {
      effectiveStatus = "on_break";
      dutyStatusLabel = "ON_BREAK";
    } else if (isDutyEmergency && isSessionFresh) {
      effectiveStatus = "emergency_round";
      dutyStatusLabel = "EMERGENCY_ROUND";
    } else if (isDutyProcessing && isSessionFresh) {
      effectiveStatus = "processing";
      dutyStatusLabel = "PROCESSING";
    } else if (isDutyActive) {
      effectiveStatus = "active";
      dutyStatusLabel = "ACTIVE";
    } else if (isSessionFresh && !memoryStatus && e.status === "active") {
      effectiveStatus = "active";
      dutyStatusLabel = "ACTIVE";
    } else {
      dutyStatusLabel = "OFF_DUTY";
    }

    return {
      id: e.user_id,
      employee_id_num: e.id,
      employee_id: e.employee_code || `EMP-${e.id}`,
      name: e.name,
      username: e.name || e.users?.username || "",
      email: e.email || e.users?.email || "",
      phone: e.phone || "",
      role: e.users?.role || "staff",
      department: e.departments?.dept_code || "all",
      department_name: e.departments?.name || "All Departments",
      qualification: e.qualification || "",
      specialization: e.specialization || "",
      license_number: e.license_number || "",
      gender: e.gender || "other",
      experience_years: e.experience_years || 0,
      room_number: e.room_number || "",
      status: effectiveStatus,
      duty_status: dutyStatusLabel,
      last_login_at: e.users?.last_login_at ? e.users.last_login_at.toISOString() : null,
      user_id: e.user_id,
    };
  });
}

/**
 * Provisions a new hospital employee with dual login capability (email + employee_code).
 */
async function addHospitalEmployee({
  hospitalCode,
  name,
  email,
  role,
  department,
  employeeId = "",
  phone = "",
  password = "pass123",
  qualification = "",
  specialization = "",
  license_number = "",
  gender = "other",
  experience_years = 0,
  room_number = "",
}) {
  const cleanEmail = String(email).trim().toLowerCase();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });

  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const cleanDeptStr = String(department || "consultation").trim();
  const allDepts = await prisma.departments.findMany({ where: { hospital_id: hosp.id } });
  const dept = findMatchingDepartment(cleanDeptStr, allDepts);

  const pwdHash = await hashPassword(password);

  // 1. Create or resolve user
  let user = await prisma.users.findUnique({ where: { email: cleanEmail } });
  if (user) {
    user = await prisma.users.update({
      where: { id: user.id },
      data: { role, phone, updated_at: new Date() },
    });
  } else {
    user = await prisma.users.create({
      data: {
        email: cleanEmail,
        username: name,
        password_hash: pwdHash,
        role,
        status: "active",
        phone,
      },
    });
  }

  const empCode = employeeId || `EMP-${user.id}`;
  const parsedExp = parseInt(experience_years, 10) || 0;
  const cleanGender = String(gender || "other").toLowerCase().trim();

  // 2. Upsert employee
  const employee = await prisma.employees.upsert({
    where: {
      hospital_id_user_id: {
        hospital_id: hosp.id,
        user_id: user.id,
      },
    },
    create: {
      user_id: user.id,
      hospital_id: hosp.id,
      department_id: dept?.id || null,
      employee_code: empCode,
      name,
      email: cleanEmail,
      phone,
      qualification: String(qualification || "").trim(),
      specialization: String(specialization || "").trim(),
      license_number: String(license_number || "").trim(),
      gender: cleanGender,
      experience_years: parsedExp,
      room_number: String(room_number || "").trim(),
      status: "active",
    },
    update: {
      department_id: dept?.id || null,
      name,
      email: cleanEmail,
      phone,
      employee_code: empCode,
      qualification: String(qualification || "").trim(),
      specialization: String(specialization || "").trim(),
      license_number: String(license_number || "").trim(),
      gender: cleanGender,
      experience_years: parsedExp,
      room_number: String(room_number || "").trim(),
      updated_at: new Date(),
    },
  });

  return {
    user_id: user.id,
    name,
    email: cleanEmail,
    role,
    department: department || "consultation",
    employee_id: empCode,
    qualification: String(qualification || "").trim(),
    specialization: String(specialization || "").trim(),
    license_number: String(license_number || "").trim(),
    gender: cleanGender,
    experience_years: parsedExp,
    room_number: String(room_number || "").trim(),
    status: employee.status || "inactive",
  };
}

/**
 * Updates an employee's details, including optional password.
 */
async function updateHospitalEmployee(userId, updateData = {}) {
  let uid = parseInt(userId, 10);
  let emp = await prisma.employees.findFirst({
    where: { OR: [{ id: uid }, { user_id: uid }] },
    include: { users: true },
  });
  let user = emp?.users || null;

  if (!user && uid) {
    user = await prisma.users.findUnique({ where: { id: uid } });
    if (user && !emp) {
      emp = await prisma.employees.findFirst({ where: { user_id: user.id } });
    }
  }

  const {
    name,
    email,
    phone,
    role,
    department,
    employeeId,
    employee_id,
    status,
    duty_status,
    password,
    qualification,
    specialization,
    license_number,
    gender,
    experience_years,
    room_number,
  } = updateData;

  const cleanEmail = email !== undefined && email !== null ? String(email).trim().toLowerCase() : undefined;
  const targetName = name !== undefined ? String(name).trim() : (emp?.name || user?.username || "");
  const targetRole = role !== undefined ? String(role).toLowerCase().trim() : (user?.role || "staff");
  const targetStatus = status !== undefined ? String(status).toLowerCase().trim() : (emp?.status || user?.status || "active");
  const targetPhone = phone !== undefined ? String(phone).trim() : (emp?.phone || user?.phone || "");
  const targetEmployeeCode = (employee_id !== undefined && employee_id !== null)
    ? String(employee_id).trim()
    : (employeeId !== undefined && employeeId !== null ? String(employeeId).trim() : emp?.employee_code);

  const userData = {
    username: targetName,
    role: targetRole,
    phone: targetPhone,
    status: targetStatus,
    updated_at: new Date(),
  };
  if (cleanEmail) {
    userData.email = cleanEmail;
  }
  if (password && String(password).trim().length > 0) {
    userData.password_hash = await hashPassword(String(password).trim());
  }

  const effectiveDutyStatus = duty_status
    ? String(duty_status).toUpperCase()
    : (targetStatus === "inactive" ? "OFF_DUTY" : (targetStatus === "active" ? "ACTIVE" : null));

  if (targetStatus === "inactive" || effectiveDutyStatus === "OFF_DUTY") {
    try {
      const ident = emp?.user_id || user?.id || emp?.id || cleanEmail || emp?.email;
      if (ident) {
        await setDoctorDutyStatus(ident, {
          status: "OFF_DUTY",
          doctor_name: targetName,
          email: cleanEmail || emp?.email,
          employeeCode: targetEmployeeCode || emp?.employee_code,
          userId: user?.id || emp?.user_id,
          employeeId: emp?.id,
        });
      }
    } catch (_) {}
  } else if (targetStatus === "active" || effectiveDutyStatus === "ACTIVE") {
    userData.last_login_at = new Date();
    try {
      const ident = emp?.user_id || user?.id || emp?.id || cleanEmail || emp?.email;
      if (ident) {
        await setDoctorDutyStatus(ident, {
          status: "ACTIVE",
          doctor_name: targetName,
          email: cleanEmail || emp?.email,
          employeeCode: targetEmployeeCode || emp?.employee_code,
          userId: user?.id || emp?.user_id,
          employeeId: emp?.id,
        });
      }
    } catch (_) {}
  }

  if (user) {
    await prisma.users.update({
      where: { id: user.id },
      data: userData,
    });
  }

  if (emp) {
    let deptId = emp.department_id;
    if (department !== undefined) {
      const cleanDept = String(department).trim();
      if (cleanDept.toLowerCase() === "all" || cleanDept === "") {
        deptId = null;
      } else {
        const allDepts = await prisma.departments.findMany({ where: { hospital_id: emp.hospital_id } });
        const matched = findMatchingDepartment(cleanDept, allDepts) || allDepts.find(d => d.dept_code.toLowerCase() === cleanDept.toLowerCase() || d.name.toLowerCase() === cleanDept.toLowerCase());
        deptId = matched ? matched.id : emp.department_id;
      }
    }

    const empData = {
      name: targetName,
      phone: targetPhone,
      department_id: deptId,
      employee_code: targetEmployeeCode || emp.employee_code,
      status: targetStatus,
      updated_at: new Date(),
    };
    if (cleanEmail) {
      empData.email = cleanEmail;
    }
    if (qualification !== undefined) {
      empData.qualification = String(qualification).trim();
    }
    if (specialization !== undefined) {
      empData.specialization = String(specialization).trim();
    }
    if (license_number !== undefined) {
      empData.license_number = String(license_number).trim();
    }
    if (gender !== undefined) {
      empData.gender = String(gender).toLowerCase().trim();
    }
    if (experience_years !== undefined) {
      empData.experience_years = parseInt(experience_years, 10) || 0;
    }
    if (room_number !== undefined) {
      empData.room_number = String(room_number).trim();
    }

    let profileObj = {};
    try {
      profileObj = typeof emp.profile_json === "string" ? JSON.parse(emp.profile_json) : (emp.profile_json || {});
    } catch (_) {}
    profileObj.role = targetRole;
    empData.profile_json = profileObj;

    const updatedEmp = await prisma.employees.update({
      where: { id: emp.id },
      data: empData,
      include: {
        users: true,
        departments: true,
      },
    });

    return {
      id: user?.id || emp.user_id,
      user_id: user?.id || emp.user_id,
      employee_id_num: updatedEmp.id,
      employee_id: updatedEmp.employee_code,
      name: updatedEmp.name,
      username: updatedEmp.users?.username || updatedEmp.name,
      email: updatedEmp.email || updatedEmp.users?.email || "",
      phone: updatedEmp.phone || "",
      role: updatedEmp.users?.role || targetRole,
      department: updatedEmp.departments?.dept_code || "all",
      department_name: updatedEmp.departments?.name || "All Departments",
      qualification: updatedEmp.qualification || "",
      specialization: updatedEmp.specialization || "",
      license_number: updatedEmp.license_number || "",
      gender: updatedEmp.gender || "other",
      experience_years: updatedEmp.experience_years || 0,
      room_number: updatedEmp.room_number || "",
      status: updatedEmp.status,
      duty_status: effectiveDutyStatus || (updatedEmp.status === "active" ? "ACTIVE" : "OFF_DUTY"),
    };
  }

  return {
    user_id: uid,
    name: targetName,
    email: cleanEmail || user?.email || "",
    role: targetRole,
    status: targetStatus,
    duty_status: effectiveDutyStatus || (targetStatus === "active" ? "ACTIVE" : "OFF_DUTY"),
  };
}

/**
 * Updates an employee or doctor's password directly.
 * Validates hospital containment and privilege boundaries:
 * - Only SUPER_ROLES may reset another superadmin or hospital_owner.
 * - Targets must belong to the hospital matching the endpoint.
 * - Enforces must_change_password in profile_json.
 */
async function updateEmployeePassword(userId, newPassword, hospitalCode = null, requesterUser = null) {
  let uid = parseInt(userId, 10);
  const empLookup = await prisma.employees.findFirst({
    where: {
      OR: [{ id: uid }, { user_id: uid }],
      ...(hospitalCode ? { hospitals: { hospital_code: String(hospitalCode).trim() } } : {}),
    },
    include: { hospitals: true },
  });

  let user = null;
  if (empLookup && empLookup.user_id) {
    uid = empLookup.user_id;
    user = await prisma.users.findUnique({ where: { id: uid } });
  } else {
    user = await prisma.users.findUnique({ where: { id: uid } });
  }

  if (!user) {
    const err = new Error(`User or Employee #${userId} not found.`);
    err.status = 404;
    throw err;
  }

  // Confirm target user or employee belongs to the hospital in the URL (if provided)
  if (hospitalCode) {
    const hCode = String(hospitalCode).trim();
    const belongsToHospital =
      empLookup?.hospitals?.hospital_code === hCode ||
      user.primary_hospital_code === hCode;

    if (!belongsToHospital) {
      const err = new Error(`User #${userId} does not belong to hospital '${hospitalCode}'.`);
      err.status = 403;
      throw err;
    }
  }

  // Privilege check: Only SUPER_ROLES may reset a super admin or owner
  const targetRole = String(user.role || "").toLowerCase();
  const requesterRole = String(requesterUser?.role || "").toLowerCase();
  const isSuperRequester =
    ["superadmin", "super_admin", "hospital_owner"].includes(requesterRole) ||
    !!requesterUser?.is_superadmin;

  if (["superadmin", "super_admin", "hospital_owner"].includes(targetRole) && !isSuperRequester) {
    const err = new Error("Forbidden: Only a Super Administrator or Owner may reset credentials for this account.");
    err.status = 403;
    throw err;
  }

  const pwdHash = await hashPassword(String(newPassword).trim());
  await prisma.users.update({
    where: { id: uid },
    data: { password_hash: pwdHash, updated_at: new Date() },
  });

  // Set must_change_password flag on employee record if exists
  if (empLookup) {
    let profileObj = {};
    if (empLookup.profile_json) {
      profileObj =
        typeof empLookup.profile_json === "string"
          ? JSON.parse(empLookup.profile_json)
          : empLookup.profile_json;
    }
    profileObj.must_change_password = true;

    await prisma.employees.update({
      where: { id: empLookup.id },
      data: { profile_json: profileObj },
    });
  }

  return {
    user_id: uid,
    email: user.email,
    name: user.username,
    role: user.role,
    must_change_password: true,
    status: "success",
  };
}

/**
 * Deactivates an employee account.
 */
async function deleteHospitalEmployee(userId) {
  let uid = parseInt(userId, 10);
  const emp = await prisma.employees.findUnique({ where: { id: uid } });
  if (emp && emp.user_id) {
    uid = emp.user_id;
  }
  await prisma.employees.deleteMany({ where: { user_id: uid } });
  await prisma.users.update({
    where: { id: uid },
    data: { status: "deactivated", updated_at: new Date() },
  });
  return { success: true, deleted_user_id: uid };
}

/**
 * Departments Management
 */
async function getHospitalDepartments(hospitalCode) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) return [];

  return prisma.departments.findMany({
    where: { hospital_id: hosp.id },
    orderBy: { id: "asc" },
  });
}

async function addHospitalDepartment(hospitalCode, deptCode, name, description = "") {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const dCode = String(deptCode).trim().toLowerCase();
  return prisma.departments.upsert({
    where: {
      hospital_id_dept_code: {
        hospital_id: hosp.id,
        dept_code: dCode,
      },
    },
    create: {
      hospital_id: hosp.id,
      dept_code: dCode,
      name,
      description,
      status: "active",
    },
    update: {
      name,
      description,
      updated_at: new Date(),
    },
  });
}

async function updateHospitalDepartment(hospitalCode, deptCode, name, description) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const dept = await prisma.departments.findFirst({
    where: { hospital_id: hosp.id, dept_code: String(deptCode).trim().toLowerCase() },
  });
  if (!dept) {
    const err = new Error(`Department '${deptCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const updated = await prisma.departments.update({
    where: { id: dept.id },
    data: {
      name: name || dept.name,
      description: description !== undefined ? description : dept.description,
      updated_at: new Date(),
    },
  });

  return updated;
}

async function deleteHospitalDepartment(hospitalCode, deptCode) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) return { success: false };

  await prisma.departments.deleteMany({
    where: {
      hospital_id: hosp.id,
      dept_code: String(deptCode).trim().toLowerCase(),
    },
  });

  return { success: true, deleted_dept: deptCode };
}

/**
 * Desks Management
 */
async function getHospitalDesks(hospitalCode) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) return [];

  const rows = await prisma.desks.findMany({
    where: { hospital_id: hosp.id },
    include: {
      departments: true,
      employees: {
        include: {
          users: true,
        },
      },
    },
    orderBy: { desk_number: "asc" },
  });

  const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  const now = Date.now();

  return rows.map((d) => {
    const empStatus = (d.employees?.status === "active" && (d.employees?.users ? d.employees.users.status === "active" : true)) ? "active" : "inactive";

    return {
      id: d.id,
      desk_number: d.desk_number,
      desk_name: d.desk_name,
      status: d.status,
      current_ticket_id: d.current_ticket_id,
      last_active_at: d.last_active_at ? d.last_active_at.toISOString() : null,
      dept_code: d.departments?.dept_code || "",
      department_name: d.departments?.name || "",
      assigned_employee_id: d.assigned_employee_id,
      assigned_user_id: d.employees?.user_id || null,
      assigned_employee_name: d.employees?.name || null,
      assigned_employee_code: d.employees?.employee_code || null,
      assigned_employee_role: d.employees?.users?.role || null,
      assigned_employee_status: empStatus,
      assigned_employee_last_login: d.employees?.users?.last_login_at ? d.employees.users.last_login_at.toISOString() : null,
    };
  });
}

async function addHospitalDesk(hospitalCode, deptCode, deskName, status = "AVAILABLE", assignedEmployeeId = null) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const dept = await prisma.departments.findFirst({
    where: {
      hospital_id: hosp.id,
      dept_code: String(deptCode).trim().toLowerCase(),
    },
  });

  let empId = assignedEmployeeId ? parseInt(assignedEmployeeId, 10) : null;
  if (empId) {
    const empRec = await prisma.employees.findFirst({
      where: { hospital_id: hosp.id, OR: [{ id: empId }, { user_id: empId }] },
      include: { users: true },
    });
    if (!empRec) {
      const crossEmp = await prisma.employees.findFirst({
        where: { OR: [{ id: empId }, { user_id: empId }] },
        include: { hospitals: true },
      });
      if (crossEmp) {
        const err = new Error(
          `Hospital Isolation Violation: Employee '${crossEmp.name}' belongs to hospital '${crossEmp.hospitals?.name || crossEmp.hospital_id}', not '${hospitalCode}'. Cross-hospital desk assignment is strictly prohibited.`
        );
        err.status = 403;
        err.code = "HOSPITAL_ISOLATION_VIOLATION";
        throw err;
      }
      const err = new Error(`Employee #${empId} not found in hospital '${hospitalCode}'.`);
      err.status = 404;
      err.code = "EMPLOYEE_NOT_FOUND";
      throw err;
    }

    // Availability enforcement: only block explicitly inactive employees
    const isExplicitlyInactive =
      (empRec.status && empRec.status.toLowerCase() === "inactive") ||
      (empRec.users && empRec.users.status && empRec.users.status.toLowerCase() === "inactive");

    if (isExplicitlyInactive) {
      const err = new Error(
        `Cannot assign desk: Doctor/Staff '${empRec.name}' is currently INACTIVE. Please ensure the employee account is active before assigning to a desk.`
      );
      err.status = 409;
      err.code = "EMPLOYEE_INACTIVE";
      throw err;
    }

    empId = empRec.id;

    await prisma.desks.updateMany({
      where: { hospital_id: hosp.id, assigned_employee_id: empId },
      data: { assigned_employee_id: null },
    });
  }

  const maxDesk = await prisma.desks.aggregate({
    where: { hospital_id: hosp.id, department_id: dept?.id },
    _max: { desk_number: true },
  });
  const deskNum = (maxDesk._max.desk_number || 0) + 1;

  return prisma.desks.create({
    data: {
      hospital_id: hosp.id,
      department_id: dept?.id || 1,
      desk_number: deskNum,
      desk_name: deskName,
      assigned_employee_id: empId,
      status: status || "AVAILABLE",
    },
  });
}

async function assignHospitalDesk(hospitalCode, deskId, employeeId) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const dId = parseInt(deskId, 10);
  let empId = employeeId ? parseInt(employeeId, 10) : null;

  if (empId) {
    const empRec = await prisma.employees.findFirst({
      where: { hospital_id: hosp.id, OR: [{ id: empId }, { user_id: empId }] },
      include: { users: true },
    });
    if (!empRec) {
      const crossEmp = await prisma.employees.findFirst({
        where: { OR: [{ id: empId }, { user_id: empId }] },
        include: { hospitals: true },
      });
      if (crossEmp) {
        const err = new Error(
          `Hospital Isolation Violation: Employee '${crossEmp.name}' belongs to hospital '${crossEmp.hospitals?.name || crossEmp.hospital_id}', not '${hospitalCode}'. Cross-hospital desk assignment is strictly prohibited.`
        );
        err.status = 403;
        err.code = "HOSPITAL_ISOLATION_VIOLATION";
        throw err;
      }
      const err = new Error(`Employee #${employeeId} not found in hospital '${hospitalCode}'.`);
      err.status = 404;
      err.code = "EMPLOYEE_NOT_FOUND";
      throw err;
    }

    // Reject assigning inactive employee to desk
    const isExplicitlyInactive =
      (empRec.status && empRec.status.toLowerCase() === "inactive") ||
      (empRec.users && empRec.users.status && empRec.users.status.toLowerCase() === "inactive");

    if (isExplicitlyInactive) {
      const err = new Error(`Cannot assign desk: Employee '${empRec.name}' is currently INACTIVE. Please activate the employee account first.`);
      err.status = 409;
      err.code = "EMPLOYEE_INACTIVE";
      throw err;
    }

    empId = empRec.id;

    // Clear any previous desk assigned to this employee
    await prisma.desks.updateMany({
      where: { hospital_id: hosp.id, assigned_employee_id: empId, NOT: { id: dId } },
      data: { assigned_employee_id: null },
    });
  }

  const updated = await prisma.desks.update({
    where: { id: dId },
    data: {
      assigned_employee_id: empId,
      updated_at: new Date(),
    },
    include: {
      departments: true,
      employees: {
        include: { users: true },
      },
    },
  });

  return {
    id: updated.id,
    desk_number: updated.desk_number,
    desk_name: updated.desk_name,
    status: updated.status,
    dept_code: updated.departments?.dept_code || "",
    department_name: updated.departments?.name || "",
    assigned_employee_id: updated.assigned_employee_id,
    assigned_employee_name: updated.employees?.name || null,
    assigned_employee_role: updated.employees?.users?.role || null,
  };
}

async function updateHospitalDesk(hospitalCode, deskId, deskName, deptCode, assignedEmployeeId = -1) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const dId = parseInt(deskId, 10);
  const oldDesk = await prisma.desks.findUnique({
    where: { id: dId },
    include: { departments: true },
  });
  if (!oldDesk || oldDesk.hospital_id !== hosp.id) {
    const err = new Error(`Desk #${deskId} not found in hospital '${hospitalCode}'.`);
    err.status = 404;
    throw err;
  }

  let targetDeptId = oldDesk.department_id;
  if (deptCode) {
    const dept = await prisma.departments.findFirst({
      where: { hospital_id: hosp.id, dept_code: String(deptCode).trim().toLowerCase() },
    });
    if (dept) {
      targetDeptId = dept.id;
    }
  }

  const targetName = deskName && deskName.trim() !== "" ? deskName.trim() : oldDesk.desk_name;

  let targetEmpId = oldDesk.assigned_employee_id;
  if (assignedEmployeeId !== -1) {
    if (assignedEmployeeId && parseInt(assignedEmployeeId, 10) > 0) {
      const parsedId = parseInt(assignedEmployeeId, 10);
      const empRec = await prisma.employees.findFirst({
        where: { hospital_id: hosp.id, OR: [{ id: parsedId }, { user_id: parsedId }] },
        include: { users: true },
      });
      if (!empRec) {
        const crossEmp = await prisma.employees.findFirst({
          where: { OR: [{ id: parsedId }, { user_id: parsedId }] },
          include: { hospitals: true },
        });
        if (crossEmp) {
          const err = new Error(
            `Hospital Isolation Violation: Employee '${crossEmp.name}' belongs to hospital '${crossEmp.hospitals?.name || crossEmp.hospital_id}', not '${hospitalCode}'. Cross-hospital desk assignment is strictly prohibited.`
          );
          err.status = 403;
          err.code = "HOSPITAL_ISOLATION_VIOLATION";
          throw err;
        }
        const err = new Error(`Employee #${parsedId} not found in hospital '${hospitalCode}'.`);
        err.status = 404;
        err.code = "EMPLOYEE_NOT_FOUND";
        throw err;
      }

      // Availability enforcement: only block explicitly inactive employees
      const isExplicitlyInactive =
        (empRec.status && empRec.status.toLowerCase() === "inactive") ||
        (empRec.users && empRec.users.status && empRec.users.status.toLowerCase() === "inactive");

      if (isExplicitlyInactive) {
        const err = new Error(
          `Cannot assign desk: Doctor/Staff '${empRec.name}' is currently INACTIVE. Please ensure the employee account is active before assigning to a desk.`
        );
        err.status = 409;
        err.code = "EMPLOYEE_INACTIVE";
        throw err;
      }

      targetEmpId = empRec.id;

      // Clear previous desk assignment for this employee
      await prisma.desks.updateMany({
        where: { hospital_id: hosp.id, assigned_employee_id: targetEmpId, NOT: { id: dId } },
        data: { assigned_employee_id: null },
      });
    } else {
      targetEmpId = null;
    }
  }

  const updated = await prisma.desks.update({
    where: { id: dId },
    data: {
      desk_name: targetName,
      department_id: targetDeptId,
      assigned_employee_id: targetEmpId,
      updated_at: new Date(),
    },
    include: {
      departments: true,
      employees: {
        include: { users: true },
      },
    },
  });

  return {
    id: updated.id,
    desk_number: updated.desk_number,
    desk_name: updated.desk_name,
    department_id: updated.department_id,
    status: updated.status,
    dept_code: updated.departments?.dept_code || "",
    department_name: updated.departments?.name || "",
    assigned_employee_id: updated.assigned_employee_id,
    assigned_employee_name: updated.employees?.name || null,
    assigned_employee_role: updated.employees?.users?.role || null,
  };
}

async function bulkUpdateDeskStatus(hospitalCode, deptCode, status) {
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: String(hospitalCode).trim() },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const dept = await prisma.departments.findFirst({
    where: { hospital_id: hosp.id, dept_code: String(deptCode).trim().toLowerCase() },
  });
  if (!dept) {
    const err = new Error(`Department '${deptCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const result = await prisma.desks.updateMany({
    where: { hospital_id: hosp.id, department_id: dept.id },
    data: { status, updated_at: new Date(), last_active_at: new Date() },
  });

  return { success: true, updated_count: result.count, status };
}

async function deleteHospitalDesk(deskId) {
  await prisma.desks.delete({ where: { id: parseInt(deskId, 10) } });
  return { success: true, deleted_desk_id: deskId };
}

async function updateDeskStatus(deskId, status) {
  return prisma.desks.update({
    where: { id: parseInt(deskId, 10) },
    data: {
      status,
      last_active_at: new Date(),
      updated_at: new Date(),
    },
  });
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return email;
  const parts = email.split("@");
  if (parts.length !== 2) return "••••@••••";
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || ""}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function maskPhone(phone) {
  if (!phone || typeof phone !== "string") return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "******";
  return `******${digits.slice(-4)}`;
}

function maskSensitiveDbRow(row) {
  if (!row || typeof row !== "object") return row;
  const copy = { ...row };

  const phoneKeys = new Set(["phone", "phone_number", "contact", "emergency_phone", "mobile", "patient_phone"]);
  const emailKeys = new Set(["email", "support_email", "contact_email", "user_email"]);
  const clinicalKeys = new Set([
    "prescription_notes",
    "diagnosis",
    "symptoms",
    "vitals",
    "clinical_notes",
    "chief_complaint",
    "clinical_summary",
    "doctor_notes",
    "medical_history",
    "allergies",
    "investigation_advice",
  ]);
  const secretKeys = new Set([
    "password_hash",
    "password",
    "token",
    "otp",
    "otp_code",
    "reset_otp",
    "secret",
    "jwt",
    "refresh_token",
    "access_token",
  ]);

  for (const key of Object.keys(copy)) {
    const lowerKey = key.toLowerCase();
    const val = copy[key];

    if (secretKeys.has(lowerKey)) {
      copy[key] = "•••••••••••• [REDACTED]";
    } else if (clinicalKeys.has(lowerKey)) {
      if (val !== null && val !== undefined) {
        copy[key] = "[REDACTED CLINICAL DATA]";
      }
    } else if (phoneKeys.has(lowerKey)) {
      if (typeof val === "string") {
        copy[key] = maskPhone(val);
      }
    } else if (emailKeys.has(lowerKey)) {
      if (typeof val === "string") {
        copy[key] = maskEmail(val);
      }
    }
  }

  return copy;
}

/**
 * Dynamic Database Inspector for Admin Portal.
 * Strictly scopes table counts, schemas, and preview records to the active hospital.
 */
async function getDatabaseOverview(hospitalCode = null) {
  let hospital = null;
  if (hospitalCode && hospitalCode !== "all") {
    hospital = await prisma.hospitals.findUnique({
      where: { hospital_code: String(hospitalCode).trim() },
    });
  }

  // If not found or not specified, fall back to default or first hospital to guarantee isolation
  if (!hospital) {
    hospital = await prisma.hospitals.findUnique({
      where: { hospital_code: "city-hospital-01" },
    }) || await prisma.hospitals.findFirst();
  }

  const hid = hospital ? Number(hospital.id) : null;
  const hcode = hospital ? String(hospital.hospital_code) : "";
  const ownerId = hospital?.owner_user_id ? Number(hospital.owner_user_id) : -1;

  const tables = [
    "users", "hospitals", "departments", "patients", "family_members",
    "employees", "desks", "kiosks", "appointments", "appointment_status_history",
    "tickets", "queue_events", "service_logs", "tenant_historical_data",
    "tenant_config", "tenant_mapping", "audit_logs"
  ];

  const result = {};

  for (const tbl of tables) {
    try {
      const schemaRows = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${tbl}
        ORDER BY ordinal_position ASC;
      `;

      let countRes = [];
      let rows = [];

      if (!hid) {
        switch (tbl) {
          case "hospitals":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM hospitals;`;
            rows = await prisma.$queryRaw`SELECT * FROM hospitals ORDER BY id DESC LIMIT 10;`;
            break;
          case "departments":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM departments;`;
            rows = await prisma.$queryRaw`SELECT * FROM departments ORDER BY id DESC LIMIT 10;`;
            break;
          case "desks":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM desks;`;
            rows = await prisma.$queryRaw`SELECT * FROM desks ORDER BY id DESC LIMIT 10;`;
            break;
          case "kiosks":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM kiosks;`;
            rows = await prisma.$queryRaw`SELECT * FROM kiosks ORDER BY id DESC LIMIT 10;`;
            break;
          case "employees":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM employees;`;
            rows = await prisma.$queryRaw`SELECT * FROM employees ORDER BY id DESC LIMIT 10;`;
            break;
          case "appointments":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM appointments;`;
            rows = await prisma.$queryRaw`SELECT * FROM appointments ORDER BY id DESC LIMIT 10;`;
            break;
          case "appointment_status_history":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM appointment_status_history;`;
            rows = await prisma.$queryRaw`SELECT * FROM appointment_status_history ORDER BY id DESC LIMIT 10;`;
            break;
          case "tickets":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM tickets;`;
            rows = await prisma.$queryRaw`SELECT * FROM tickets ORDER BY id DESC LIMIT 10;`;
            break;
          case "queue_events":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM queue_events;`;
            rows = await prisma.$queryRaw`SELECT * FROM queue_events ORDER BY id DESC LIMIT 10;`;
            break;
          case "service_logs":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM service_logs;`;
            rows = await prisma.$queryRaw`SELECT * FROM service_logs ORDER BY id DESC LIMIT 10;`;
            break;
          case "tenant_historical_data":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM tenant_historical_data;`;
            rows = await prisma.$queryRaw`SELECT * FROM tenant_historical_data ORDER BY id DESC LIMIT 10;`;
            break;
          case "tenant_config":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM tenant_config;`;
            rows = await prisma.$queryRaw`SELECT * FROM tenant_config LIMIT 10;`;
            break;
          case "tenant_mapping":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM tenant_mapping;`;
            rows = await prisma.$queryRaw`SELECT * FROM tenant_mapping LIMIT 10;`;
            break;
          case "audit_logs":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM audit_logs;`;
            rows = await prisma.$queryRaw`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10;`;
            break;
          case "users":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM users;`;
            rows = await prisma.$queryRaw`SELECT * FROM users ORDER BY id DESC LIMIT 10;`;
            break;
          case "patients":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM patients;`;
            rows = await prisma.$queryRaw`SELECT * FROM patients ORDER BY id DESC LIMIT 10;`;
            break;
          case "family_members":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM family_members;`;
            rows = await prisma.$queryRaw`SELECT * FROM family_members LIMIT 10;`;
            break;
          default:
            countRes = [{ cnt: 0 }];
            rows = [];
        }
      } else {
        switch (tbl) {
          case "hospitals":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM hospitals WHERE id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM hospitals WHERE id = ${hid} LIMIT 10;`;
            break;
          case "departments":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM departments WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM departments WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "desks":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM desks WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM desks WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "kiosks":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM kiosks WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM kiosks WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "employees":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM employees WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM employees WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "appointments":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM appointments WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM appointments WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "appointment_status_history":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM appointment_status_history ash JOIN appointments a ON ash.appointment_id = a.appointment_id WHERE a.hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT ash.* FROM appointment_status_history ash JOIN appointments a ON ash.appointment_id = a.appointment_id WHERE a.hospital_id = ${hid} ORDER BY ash.id DESC LIMIT 10;`;
            break;
          case "tickets":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM tickets WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM tickets WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "queue_events":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM queue_events WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM queue_events WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "service_logs":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM service_logs WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM service_logs WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "tenant_historical_data":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM tenant_historical_data WHERE hospital_id = ${hid} OR legacy_tenant_id = ${hcode};`;
            rows = await prisma.$queryRaw`SELECT * FROM tenant_historical_data WHERE hospital_id = ${hid} OR legacy_tenant_id = ${hcode} ORDER BY id DESC LIMIT 10;`;
            break;
          case "tenant_config":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM tenant_config WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM tenant_config WHERE hospital_id = ${hid} LIMIT 10;`;
            break;
          case "tenant_mapping":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM tenant_mapping WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM tenant_mapping WHERE hospital_id = ${hid} LIMIT 10;`;
            break;
          case "audit_logs":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM audit_logs WHERE hospital_id = ${hid};`;
            rows = await prisma.$queryRaw`SELECT * FROM audit_logs WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "users":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM users WHERE primary_hospital_code = ${hcode} OR id IN (SELECT user_id FROM employees WHERE hospital_id = ${hid}) OR id = ${ownerId};`;
            rows = await prisma.$queryRaw`SELECT * FROM users WHERE primary_hospital_code = ${hcode} OR id IN (SELECT user_id FROM employees WHERE hospital_id = ${hid}) OR id = ${ownerId} ORDER BY id DESC LIMIT 10;`;
            break;
          case "patients":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM patients WHERE id IN (SELECT patient_id FROM tickets WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR id IN (SELECT patient_id FROM appointments WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = ${hcode});`;
            rows = await prisma.$queryRaw`SELECT * FROM patients WHERE id IN (SELECT patient_id FROM tickets WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR id IN (SELECT patient_id FROM appointments WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = ${hcode}) ORDER BY id DESC LIMIT 10;`;
            break;
          case "family_members":
            countRes = await prisma.$queryRaw`SELECT count(*)::int as cnt FROM family_members WHERE patient_id IN (SELECT id FROM patients WHERE id IN (SELECT patient_id FROM tickets WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR id IN (SELECT patient_id FROM appointments WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = ${hcode})) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = ${hcode} OR id IN (SELECT user_id FROM employees WHERE hospital_id = ${hid}));`;
            rows = await prisma.$queryRaw`SELECT * FROM family_members WHERE patient_id IN (SELECT id FROM patients WHERE id IN (SELECT patient_id FROM tickets WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR id IN (SELECT patient_id FROM appointments WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = ${hcode})) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = ${hcode} OR id IN (SELECT user_id FROM employees WHERE hospital_id = ${hid})) ORDER BY created_at DESC LIMIT 10;`;
            break;
          default:
            countRes = [{ cnt: 0 }];
            rows = [];
        }
      }

      const cnt = countRes[0]?.cnt || 0;
      const sanitizedRows = rows.map((r) => maskSensitiveDbRow(r));

      result[tbl] = {
        count: cnt,
        schema: schemaRows.map((s) => ({
          name: s.column_name,
          type: s.data_type,
          nullable: s.is_nullable,
        })),
        rows: sanitizedRows,
      };
    } catch (e) {
      result[tbl] = { count: 0, schema: [], rows: [], error: e.message };
    }
  }

  const allHospitals = await prisma.hospitals.findMany({
    select: { id: true, hospital_code: true, name: true },
    orderBy: { name: "asc" },
  }).catch(() => []);

  return {
    tables: result,
    hospital: hospital ? {
      id: hospital.id,
      hospital_code: hospital.hospital_code,
      name: hospital.name,
      address: hospital.address,
      status: hospital.status,
    } : null,
    all_hospitals: allHospitals,
  };
}

/**
 * Retrieves historical patient visit logs and footfall statistics for a specific hospital.
 */
async function getHospitalVisitHistory(hospitalCode, limit = 500, period = null) {
  const hCode = String(hospitalCode).trim();
  const hospital = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
    select: { id: true, name: true, hospital_code: true },
  });
  if (!hospital) return null;

  const todayStr = getCurrentQueueDate();
  const todayDateObj = queueDateToPrismaDate(todayStr);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const nonTransferredCondition = {
    status: { notIn: ["transferred", "TRANSFERRED"] },
  };

  let periodCondition = {};
  if (period === "today") {
    periodCondition = { queue_date: todayDateObj };
  } else if (period === "yesterday") {
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yStr = yDate.toISOString().split("T")[0];
    periodCondition = { queue_date: queueDateToPrismaDate(yStr) };
  } else if (period === "week") {
    periodCondition = { created_at: { gte: sevenDaysAgo } };
  } else if (period === "month") {
    const mDate = new Date();
    mDate.setDate(mDate.getDate() - 30);
    periodCondition = { created_at: { gte: mDate } };
  }

  const [
    totalAllTime,
    allTimeCompleted,
    todayTickets,
    todayCompleted,
    thisWeekVisits,
    thisMonthVisits,
    recentTickets,
  ] = await Promise.all([
    prisma.tickets.count({ where: { hospital_id: hospital.id, ...nonTransferredCondition } }).catch(() => 0),
    prisma.tickets.count({ where: { hospital_id: hospital.id, status: { in: ["completed", "COMPLETED"] } } }).catch(() => 0),
    prisma.tickets.count({ where: { hospital_id: hospital.id, queue_date: todayDateObj, ...nonTransferredCondition } }).catch(() => 0),
    prisma.tickets.count({ where: { hospital_id: hospital.id, queue_date: todayDateObj, status: { in: ["completed", "COMPLETED"] } } }).catch(() => 0),
    prisma.tickets.count({ where: { hospital_id: hospital.id, created_at: { gte: sevenDaysAgo }, ...nonTransferredCondition } }).catch(() => 0),
    prisma.tickets.count({ where: { hospital_id: hospital.id, created_at: { gte: startOfMonth }, ...nonTransferredCondition } }).catch(() => 0),
    prisma.tickets.findMany({
      where: { hospital_id: hospital.id, ...periodCondition },
      include: {
        departments: true,
        patients: true,
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: Math.max(limit * 3, 500),
    }).catch(() => []),
  ]);

  // 1. Map all tickets by ticket_id for rapid O(1) lookup
  const ticketMap = new Map();
  recentTickets.forEach((t) => ticketMap.set(t.ticket_id, t));

  // 2. Fetch any missing parents for complete multi-department transfer chains
  const missingParentIds = recentTickets
    .map((t) => t.parent_ticket_id)
    .filter((pid) => pid && !ticketMap.has(pid));

  if (missingParentIds.length > 0) {
    try {
      const parents = await prisma.tickets.findMany({
        where: { ticket_id: { in: missingParentIds } },
        include: { departments: true, patients: true },
      });
      parents.forEach((p) => ticketMap.set(p.ticket_id, p));
    } catch (e) {
      console.warn("Could not load missing parent tickets for transfer chain:", e.message);
    }
  }

  // 3. Set of ticket IDs that are parent of another ticket in the active hospital dataset
  const parentIdSet = new Set();
  ticketMap.forEach((t) => {
    if (t.parent_ticket_id) parentIdSet.add(t.parent_ticket_id);
  });

  // 4. Construct unified visits: collapse intermediate transferred parent rows into child rows
  const visits = [];

  for (const t of recentTickets) {
    // If this ticket is marked "transferred" and its target child ticket is present,
    // skip it as an independent top-level row so it doesn't duplicate the visit count.
    if ((t.status || "").toLowerCase() === "transferred" && parentIdSet.has(t.ticket_id)) {
      continue;
    }

    // Build the consultation stages by walking up parent_ticket_id links
    const stages = [];
    let curr = t;
    const visitedInChain = new Set();

    while (curr && !visitedInChain.has(curr.ticket_id)) {
      visitedInChain.add(curr.ticket_id);
      stages.unshift({
        ticket_id: curr.ticket_id,
        department: curr.departments?.name || curr.service_category || "General OPD",
        dept_code: curr.departments?.dept_code || curr.service_category || "consultation",
        status: (curr.status || "").toLowerCase(),
        notes: curr.prescription_notes || "",
        medical_condition: curr.medical_condition || "",
        served_by: curr.served_by_doctor_name || null,
        counter: curr.counter_number || null,
        desk_name: curr.desk_name || null,
        serve_start_time: curr.serve_start_time ? curr.serve_start_time.toISOString() : null,
        serve_end_time: curr.serve_end_time ? curr.serve_end_time.toISOString() : null,
        duration_minutes: (() => {
          const dur = curr.actual_service_minutes != null
            ? curr.actual_service_minutes
            : (curr.predicted_service_minutes != null ? curr.predicted_service_minutes : null);
          return dur != null ? Math.round(dur * 10) / 10 : null;
        })(),
        created_at: curr.created_at ? curr.created_at.toISOString() : null,
      });

      if (curr.parent_ticket_id && ticketMap.has(curr.parent_ticket_id)) {
        curr = ticketMap.get(curr.parent_ticket_id);
      } else {
        break;
      }
    }

    stages.forEach((s, idx) => {
      s.stage_number = idx + 1;
    });

    const isTransferred = stages.length > 1 || Boolean(t.transferred_from_dept);
    const transferTrail = stages.map((s) => s.department).join(" → ");
    const originDept = stages[0]?.department || t.transferred_from_dept || t.departments?.name || "General OPD";
    const totalDuration = stages.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

    const combinedNotes = stages
      .filter((s) => s.notes && s.notes.trim())
      .map((s) => `[${s.department}]: ${s.notes.trim()}`)
      .join("\n\n");

    const rootTicket = stages[0] ? ticketMap.get(stages[0].ticket_id) || t : t;

    const resolvedServiceDuration = (() => {
      if (totalDuration > 0) return Math.round(totalDuration * 10) / 10;
      if (t.actual_service_minutes != null) return Math.round(t.actual_service_minutes * 10) / 10;
      if (t.predicted_service_minutes != null) return Math.round(t.predicted_service_minutes * 10) / 10;
      return null;
    })();

    visits.push({
      id: t.id,
      ticket_id: t.ticket_id,
      root_ticket_id: stages[0]?.ticket_id || t.ticket_id,
      token_number: t.ticket_id,
      patient_name: t.name || t.patients?.name || rootTicket.name || "Patient",
      phone: t.patients?.phone || rootTicket.patients?.phone || "",
      gender: t.patients?.gender || rootTicket.patients?.gender || "",
      age: t.patients?.age || rootTicket.patients?.age || null,
      department: t.departments?.name || t.service_category || "General OPD",
      dept_code: t.departments?.dept_code || t.service_category || "consultation",
      origin_department: originDept,
      status: (t.status || "").toLowerCase(),
      priority_level: t.priority_level,
      medical_condition: t.medical_condition,
      join_time: (rootTicket.join_timestamp || t.join_timestamp) ? (rootTicket.join_timestamp || t.join_timestamp).toISOString() : null,
      serve_start_time: t.serve_start_time ? t.serve_start_time.toISOString() : null,
      serve_end_time: t.serve_end_time ? t.serve_end_time.toISOString() : null,
      service_duration_minutes: resolvedServiceDuration,
      created_at: (rootTicket.created_at || t.created_at) ? (rootTicket.created_at || t.created_at).toISOString() : null,
      queue_date: t.queue_date ? t.queue_date.toISOString().split("T")[0] : todayStr,
      is_transferred: isTransferred,
      transfer_trail: isTransferred ? transferTrail : null,
      transferred_from_dept: isTransferred ? originDept : null,
      transfer_stages: stages,
      prescription_notes: combinedNotes || t.prescription_notes || "",
    });

    if (visits.length >= limit) break;
  }

  // Server-side Aggregations for telemetry charts (avoiding fake values)
  const hourlyCounts = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    hour_num: h,
    count: 0,
    total_wait_min: 0,
    wait_count: 0,
    total_service_min: 0,
    service_count: 0,
    department_counts: {},
  }));

  const deptMap = new Map();

  visits.forEach((v) => {
    const d = v.created_at || v.join_time ? new Date(v.created_at || v.join_time) : null;
    if (d && !isNaN(d.getTime())) {
      const h = d.getHours();
      if (h >= 0 && h < 24) {
        hourlyCounts[h].count++;
        if (v.join_time && v.serve_start_time) {
          const w = (new Date(v.serve_start_time).getTime() - new Date(v.join_time).getTime()) / 60000;
          if (w >= 0) {
            hourlyCounts[h].total_wait_min += w;
            hourlyCounts[h].wait_count++;
          }
        }
        if (v.service_duration_minutes != null) {
          hourlyCounts[h].total_service_min += v.service_duration_minutes;
          hourlyCounts[h].service_count++;
        }
        const dName = v.department || "General OPD";
        hourlyCounts[h].department_counts[dName] = (hourlyCounts[h].department_counts[dName] || 0) + 1;
      }
    }

    const dCode = v.dept_code || "consultation";
    const dName = v.department || "General OPD";
    if (!deptMap.has(dCode)) {
      deptMap.set(dCode, { code: dCode, name: dName, total: 0, completed: 0, waiting: 0, total_duration: 0, duration_count: 0 });
    }
    const dm = deptMap.get(dCode);
    dm.total++;
    if (v.status === "completed") dm.completed++;
    if (v.status === "waiting" || v.status === "called") dm.waiting++;
    if (v.service_duration_minutes != null) {
      dm.total_duration += v.service_duration_minutes;
      dm.duration_count++;
    }
  });

  const hourly_aggregations = hourlyCounts.map((h) => ({
    hour: h.hour,
    hour_num: h.hour_num,
    count: h.count,
    avg_wait: h.wait_count > 0 ? Math.round((h.total_wait_min / h.wait_count) * 10) / 10 : null,
    avg_service: h.service_count > 0 ? Math.round((h.total_service_min / h.service_count) * 10) / 10 : null,
    department_counts: h.department_counts,
  }));

  const department_aggregations = Array.from(deptMap.values()).map((d) => ({
    code: d.code,
    name: d.name,
    total_volume: d.total,
    completed_count: d.completed,
    waiting_count: d.waiting,
    avg_tat: d.duration_count > 0 ? Math.round((d.total_duration / d.duration_count) * 10) / 10 : null,
  }));

  return {
    hospital_id: hospital.id,
    hospital_code: hospital.hospital_code,
    hospital_name: hospital.name,
    summary: {
      total_patients_visited_all_time: Math.max(totalAllTime, allTimeCompleted),
      all_time_completed: allTimeCompleted,
      today_patients_visited: todayTickets,
      today_completed: todayCompleted,
      this_week_visits: thisWeekVisits,
      this_month_visits: thisMonthVisits,
    },
    visits,
    hourly_aggregations,
    department_aggregations,
  };
}

/**
 * Lightweight real-time summary for SuperAdmin Hospital 360 top stat cards.
 */
async function getHospitalLiveSummary(hospitalCode) {
  const hCode = String(hospitalCode).trim();
  const hospital = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
    select: { id: true, name: true, hospital_code: true },
  });
  if (!hospital) return null;

  // 1. Get real-time engine analytics
  const engine = require("./queueEngine");
  const analytics = await engine.getTenantAnalytics(hCode);
  const queueSnapshot = await engine.getQueueSnapshot(hCode);
  const servingTickets = await engine.getServingTickets(hCode);

  // 2. Real active desks (0 if none, never forced to 1)
  const allDesks = await prisma.desks.findMany({
    where: { hospital_id: hospital.id },
    select: { id: true, status: true, assigned_employee_id: true, department_id: true },
  });
  const activeDesks = allDesks.filter(
    (d) =>
      ["ACTIVE", "OCCUPIED", "BUSY", "SERVING", "serving"].includes(d.status) ||
      (d.status === "AVAILABLE" && d.assigned_employee_id !== null)
  ).length;

  // 3. Departments
  const departments = await prisma.departments.findMany({
    where: { hospital_id: hospital.id },
    select: { id: true, dept_code: true, name: true },
  });

  const deptCounts = {};
  departments.forEach((d) => {
    deptCounts[d.dept_code] = {
      name: d.name,
      code: d.dept_code,
      waiting: 0,
      serving: 0,
      completed: 0,
    };
  });

  queueSnapshot.forEach((t) => {
    const code = String(t.service_category || t.department || "").toLowerCase();
    if (!deptCounts[code]) {
      deptCounts[code] = { name: t.service_category || code, code, waiting: 0, serving: 0, completed: 0 };
    }
    if (t.status === "waiting" || t.status === "called") {
      deptCounts[code].waiting++;
    }
  });

  servingTickets.forEach((t) => {
    const code = String(t.service_category || t.department || "").toLowerCase();
    if (!deptCounts[code]) {
      deptCounts[code] = { name: t.service_category || code, code, waiting: 0, serving: 0, completed: 0 };
    }
    deptCounts[code].serving++;
  });

  const todayPrismaDate = queueDateToPrismaDate(getCurrentQueueDate());
  const completedByDept = await prisma.tickets.groupBy({
    by: ["service_category"],
    where: {
      hospital_id: hospital.id,
      queue_date: todayPrismaDate,
      status: { in: ["completed", "COMPLETED"] },
    },
    _count: { id: true },
  }).catch(() => []);

  completedByDept.forEach((c) => {
    const code = String(c.service_category || "").toLowerCase();
    if (!deptCounts[code]) {
      deptCounts[code] = { name: c.service_category || code, code, waiting: 0, serving: 0, completed: 0 };
    }
    deptCounts[code].completed = c._count.id;
  });

  return {
    hospital_id: hospital.id,
    hospital_code: hospital.hospital_code,
    hospital_name: hospital.name,
    waiting: queueSnapshot.length,
    serving: servingTickets.length,
    completed: analytics.completed_today || 0,
    active_desks: activeDesks,
    total_desks: allDesks.length,
    avg_actual_wait_minutes: analytics.avg_actual_wait_minutes,
    estimated_wait_minutes_waiting: analytics.estimated_wait_minutes_waiting,
    avg_wait_minutes: analytics.avg_wait_minutes,
    avg_service_minutes: analytics.avg_service_minutes,
    department_counts: deptCounts,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Bulk provisions hospital employees from CSV/Excel imported list.
 */
async function bulkAddHospitalEmployees(hospitalCode, employeesList = []) {
  const hCode = String(hospitalCode).trim();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
    include: { departments: true },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const results = {
    imported_count: 0,
    skipped_count: 0,
    errors: [],
    skipped_departments: [],
    message: "",
  };

  const skippedDeptsSet = new Set();

  for (let i = 0; i < employeesList.length; i++) {
    const item = employeesList[i];
    const name = item.name || item.username || item.full_name || item.staff_name;
    const email = item.email || item.email_id || item.email_address;
    if (!name || !email) {
      results.skipped_count++;
      results.errors.push(`Row ${i + 1}: Name or email missing`);
      continue;
    }

    const deptStr = String(item.department || item.dept || "").trim();
    if (!deptStr) {
      results.skipped_count++;
      results.errors.push(`Row ${i + 1} (${name}): Department is missing`);
      continue;
    }

    // Flexible/normalized department matching against registered departments
    const matchedDept = findMatchingDepartment(deptStr, hosp.departments);

    if (!matchedDept) {
      results.skipped_count++;
      skippedDeptsSet.add(deptStr);
      results.errors.push(`Row ${i + 1} (${name}): Department '${deptStr}' does not exist in this hospital.`);
      continue; // Skip and don't add
    }

    const role = (item.role || "doctor").toLowerCase();
    const department = matchedDept.dept_code;
    const employeeId = item.employee_id || item.employee_code || item.id || `EMP-${Date.now().toString().slice(-4)}${i}`;
    const phone = item.phone || item.mobile || item.contact || "";
    const password = item.password || ("pass" + Math.floor(1000 + Math.random() * 9000));
    const qualification = item.qualification || item.qualifications || item.degree || "";
    const specialization = item.specialization || item.specialty || item.designation || "";
    const licenseNumber = item.license_number || item.license_no || item.medical_license || item.registration_number || item.reg_no || "";
    const gender = (item.gender || item.sex || "other").toLowerCase();
    const experienceYears = parseInt(item.experience_years || item.experience || item.years_of_experience || 0, 10) || 0;
    const roomNumber = item.room_number || item.room || item.cabin || item.cabin_number || item.room_no || "";

    try {
      await addHospitalEmployee({
        hospitalCode: hCode,
        name,
        email,
        role,
        department,
        employeeId,
        phone,
        password,
        qualification,
        specialization,
        license_number: licenseNumber,
        gender,
        experience_years: experienceYears,
        room_number: roomNumber,
      });
      results.imported_count++;
    } catch (err) {
      results.skipped_count++;
      results.errors.push(`Row ${i + 1} (${email}): ${err.message}`);
    }
  }

  const skippedDepts = Array.from(skippedDeptsSet);
  results.skipped_departments = skippedDepts;

  if (results.skipped_count > 0 && skippedDepts.length > 0) {
    const deptsFormatted = skippedDepts.map((d) => `'${d}'`).join(", ");
    results.message = `Imported ${results.imported_count} staff members. Skipped ${results.skipped_count} staff members because their departments (${deptsFormatted}) are not registered in this hospital.`;
  } else if (results.skipped_count > 0) {
    results.message = `Imported ${results.imported_count} staff members. Skipped ${results.skipped_count} staff members.`;
  } else {
    results.message = `Successfully imported all ${results.imported_count} staff members.`;
  }

  return results;
}

/**
 * Bulk imports past patient visits from CSV/Excel for a hospital.
 */
async function bulkAddHospitalVisits(hospitalCode, visitsList = []) {
  const hCode = String(hospitalCode).trim();
  const hosp = await prisma.hospitals.findUnique({
    where: { hospital_code: hCode },
    include: { departments: true },
  });
  if (!hosp) {
    const err = new Error(`Hospital '${hospitalCode}' not found.`);
    err.status = 404;
    throw err;
  }

  const results = {
    imported_count: 0,
    skipped_count: 0,
    errors: [],
  };

  for (let i = 0; i < visitsList.length; i++) {
    const item = visitsList[i];
    const patientName = item.patient_name || item.name || item.patient || "";
    if (!patientName.trim()) {
      results.skipped_count++;
      results.errors.push(`Row ${i + 1}: Patient name missing`);
      continue;
    }

    const phone = String(item.phone || item.mobile || item.contact || "").trim();
    const age = parseInt(item.age, 10) || 30;
    const gender = String(item.gender || "other").toLowerCase();
    const deptStr = String(item.department || item.dept || "consultation").toLowerCase();
    const doctorName = item.doctor || item.doctor_name || "Attending Consultant";
    const duration = parseFloat(item.service_duration_minutes || item.duration || item.consult_duration) || 12.0;
    const status = String(item.status || "completed").toLowerCase();
    const symptoms = item.symptoms || item.medical_condition || item.condition || "Routine Consultation";
    const prescription = item.prescription || item.advice || item.notes || "";

    let visitDateObj = new Date();
    if (item.visit_date || item.date || item.queue_date) {
      const d = new Date(item.visit_date || item.date || item.queue_date);
      if (!isNaN(d.getTime())) {
        visitDateObj = d;
      }
    }
    const queueDateOnly = new Date(visitDateObj.getFullYear(), visitDateObj.getMonth(), visitDateObj.getDate());

    const dept = hosp.departments.find(
      (d) =>
        d.dept_code.toLowerCase() === deptStr ||
        d.name.toLowerCase().includes(deptStr) ||
        deptStr.includes(d.name.toLowerCase())
    ) || hosp.departments[0] || null;

    try {
      let patient = null;
      if (phone) {
        patient = await prisma.patients.findFirst({ where: { phone } });
      }
      if (!patient) {
        patient = await prisma.patients.create({
          data: {
            name: patientName.trim(),
            phone,
            age,
            gender: gender.startsWith("m") ? "male" : gender.startsWith("f") ? "female" : "other",
          },
        });
      }

      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const ticketId = item.ticket_id || `H-${visitDateObj.toISOString().slice(2, 10).replace(/-/g, "")}-${randSuffix}-${i + 1}`;

      const ticket = await prisma.tickets.create({
        data: {
          ticket_id: ticketId,
          hospital_id: hosp.id,
          department_id: dept?.id || null,
          patient_id: patient.id,
          name: patientName.trim(),
          service_category: dept?.dept_code || "consultation",
          status,
          actual_service_minutes: duration,
          predicted_service_minutes: duration,
          medical_condition: symptoms,
          prescription_notes: prescription,
          queue_date: queueDateOnly,
          created_at: visitDateObj,
          join_timestamp: visitDateObj,
          serve_start_time: visitDateObj,
          serve_end_time: new Date(visitDateObj.getTime() + duration * 60000),
        },
      });

      await prisma.visit_history.create({
        data: {
          patient_id: patient.id,
          hospital_id: hosp.id,
          ticket_id: ticket.ticket_id,
          doctor_name: doctorName,
          department_name: dept?.name || "General OPD",
          visit_date: queueDateOnly,
          diagnosis: symptoms,
          clinical_notes: symptoms,
          advice: prescription,
          created_at: visitDateObj,
        },
      });

      results.imported_count++;
    } catch (err) {
      results.skipped_count++;
      results.errors.push(`Row ${i + 1} (${patientName}): ${err.message}`);
    }
  }

  return results;
}

module.exports = {
  checkHospitalCodeAvailable,
  getSuperAdminOverview,
  getAllHospitals,
  getHospitalByCode,
  createHospital,
  updateHospital,
  getHospitalBranding,
  updateHospitalBranding,
  deleteHospital,
  archiveHospital,
  restoreHospital,
  purgeHospital,
  getHospitalPurgeSummary,
  exportHospitalData,
  getHospitalEmployees,
  addHospitalEmployee,
  updateHospitalEmployee,
  updateEmployeePassword,
  deleteHospitalEmployee,
  getHospitalDepartments,
  addHospitalDepartment,
  updateHospitalDepartment,
  deleteHospitalDepartment,
  getHospitalDesks,
  addHospitalDesk,
  updateHospitalDesk,
  assignHospitalDesk,
  deleteHospitalDesk,
  updateDeskStatus,
  bulkUpdateDeskStatus,
  getDatabaseOverview,
  getHospitalVisitHistory,
  getHospitalLiveSummary,
  bulkAddHospitalEmployees,
  bulkAddHospitalVisits,
  findMatchingDepartment,
  normalizeDeptString,
};
