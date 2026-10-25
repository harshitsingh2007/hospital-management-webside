/**
 * hospitalService.js
 * -------------------
 * SuperAdmin & Multi-Hospital Operations Engine.
 * Manages Hospitals, Employees, Departments, Desks, Kiosks, and Database Overview.
 */

const prisma = require("../config/prisma");
const { hashPassword } = require("../utils/password");
const { getCurrentQueueDate, queueDateToPrismaDate } = require("../utils/timezone");
const { getDoctorDutyStatus } = require("./ticketService");

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
  const isGlobalSuperAdmin = role === "superadmin" || role === "super_admin";
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
    if (requesterUser?.email && requesterUser.email !== "superadmin@hospital.com") {
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
  if (requesterUser) {
    const role = (requesterUser.role || "").toLowerCase();
    const primaryCode = requesterUser.primary_hospital_code || requesterUser.hospital_code || null;

    const conditions = [];
    if (requesterUser.id) {
      conditions.push({ owner_user_id: requesterUser.id });
      conditions.push({ employees: { some: { user_id: requesterUser.id } } });
    }
    if (primaryCode && primaryCode !== "all") {
      conditions.push({ hospital_code: primaryCode });
    }
    if (requesterUser.email && requesterUser.email !== "superadmin@hospital.com") {
      conditions.push({ email: { equals: requesterUser.email, mode: "insensitive" } });
    }

    if (conditions.length > 0) {
      const owned = await prisma.hospitals.findMany({
        where: { OR: conditions },
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
      where: { hospital_id: { in: hIds }, status: { in: ["active", "ACTIVE"] } },
    }),
    prisma.employees.groupBy({
      by: ["hospital_id"],
      _count: { id: true },
      where: {
        hospital_id: { in: hIds },
        status: { in: ["active", "ACTIVE"] },
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
 * Creates a new hospital tenant and seeds standard departments.
 */
async function createHospital({
  hospitalCode,
  name,
  address = "",
  phone = "",
  email = "",
  description = "",
  logoUrl = "",
  status = "active",
  ownerUserId = null,
}) {
  const hCode = String(hospitalCode).trim();
  const hospital = await prisma.hospitals.create({
    data: {
      hospital_code: hCode,
      name,
      address,
      phone,
      email,
      description,
      logo_url: logoUrl,
      status,
      owner_user_id: ownerUserId,
    },
  });

  // Seed standard clinical departments
  for (const [dCode, dName, dDesc] of STANDARD_DEPARTMENTS) {
    await prisma.departments.upsert({
      where: {
        hospital_id_dept_code: {
          hospital_id: hospital.id,
          dept_code: dCode,
        },
      },
      create: {
        hospital_id: hospital.id,
        dept_code: dCode,
        name: dName,
        description: dDesc,
        status: "active",
      },
      update: {},
    });
  }

  // Log audit
  await prisma.audit_logs.create({
    data: {
      hospital_id: hospital.id,
      user_id: ownerUserId,
      action: "CREATE_HOSPITAL",
      entity_type: "hospital",
      entity_id: String(hospital.id),
      new_values: { code: hCode, name },
    },
  });

  return hospital;
}

/**
 * Updates hospital profile information.
 */
async function updateHospital(hospitalCode, data) {
  const hCode = String(hospitalCode).trim();
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
  if (data.branding_json !== undefined) {
    updateData.branding_json = data.branding_json;
  }
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
 * Deletes hospital and safely cleans child entities.
 */
async function deleteHospital(hospitalCode) {
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

  // Safe cascaded removal
  await prisma.service_logs.deleteMany({ where: { hospital_id: hId } });
  await prisma.tickets.deleteMany({ where: { hospital_id: hId } });
  await prisma.appointments.deleteMany({ where: { hospital_id: hId } });
  await prisma.desks.deleteMany({ where: { hospital_id: hId } });
  await prisma.employees.deleteMany({ where: { hospital_id: hId } });
  await prisma.departments.deleteMany({ where: { hospital_id: hId } });
  await prisma.kiosks.deleteMany({ where: { hospital_id: hId } });
  await prisma.tenant_mapping.deleteMany({ where: { hospital_id: hId } });
  await prisma.tenant_config.deleteMany({ where: { hospital_id: hId } });
  await prisma.hospitals.delete({ where: { id: hId } });

  return { status: "success", message: `Hospital '${hosp.name}' (${hCode}) successfully deleted.` };
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
      dutyInfo = getDoctorDutyStatus(e.user_id, e.email);
    } catch (_) {}

    // Prioritize real-time duty status from memory store if present
    const memoryStatus = dutyInfo?.status ? String(dutyInfo.status).toUpperCase() : null;
    const isDutyActive = memoryStatus === "ACTIVE";
    const isDutyBreak = memoryStatus === "ON_BREAK" || e.status === "on_break";
    const isDutyEmergency = memoryStatus === "EMERGENCY_ROUND" || e.status === "emergency_round";
    const isDutyOff = memoryStatus === "OFF_DUTY" || memoryStatus === "SHIFT_ENDED" || e.status === "off_duty" || e.status === "shift_ended";
    const isExplicitlyInactive = !memoryStatus && e.status === "inactive";

    let effectiveStatus = "active";
    let dutyStatusLabel = "ACTIVE";

    if (isDutyActive) {
      effectiveStatus = "active";
      dutyStatusLabel = "ACTIVE";
    } else if (isDutyBreak) {
      effectiveStatus = "on_break";
      dutyStatusLabel = "ON_BREAK";
    } else if (isDutyEmergency) {
      effectiveStatus = "emergency_round";
      dutyStatusLabel = "EMERGENCY_ROUND";
    } else if (isDutyOff) {
      effectiveStatus = "off_duty";
      dutyStatusLabel = (memoryStatus === "SHIFT_ENDED" || e.status === "shift_ended") ? "SHIFT_ENDED" : "OFF_DUTY";
    } else if (isExplicitlyInactive) {
      effectiveStatus = "inactive";
      dutyStatusLabel = "OFF_DUTY";
    } else {
      const lastLoginTime = e.users?.last_login_at ? new Date(e.users.last_login_at).getTime() : null;
      const isStale = !lastLoginTime || (now - lastLoginTime > SESSION_MAX_AGE_MS);
      effectiveStatus = (e.status === "active" && e.users?.status === "active" && !isStale) ? "active" : "inactive";
      dutyStatusLabel = effectiveStatus === "active" ? "ACTIVE" : "OFF_DUTY";
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
        status: "inactive",
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
      status: "inactive",
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
  let emp = await prisma.employees.findUnique({ where: { id: uid } });
  let user = null;

  if (emp) {
    uid = emp.user_id;
    user = await prisma.users.findUnique({ where: { id: uid } });
  } else {
    user = await prisma.users.findUnique({ where: { id: uid } });
    if (user) {
      emp = await prisma.employees.findFirst({ where: { user_id: uid } });
    }
  }

  const {
    name,
    email,
    phone,
    role,
    department,
    employeeId,
    status,
    password,
    qualification,
    specialization,
    license_number,
    gender,
    experience_years,
    room_number,
  } = updateData;

  const cleanEmail = email !== undefined && email !== null ? String(email).trim().toLowerCase() : undefined;
  const targetName = name !== undefined ? name : (emp?.name || user?.username || "");
  const targetRole = role !== undefined ? role : (user?.role || "staff");
  const targetStatus = status !== undefined ? status : (emp?.status || user?.status || "active");
  const targetPhone = phone !== undefined ? phone : (emp?.phone || user?.phone || "");

  const userData = {
    username: targetName,
    role: targetRole,
    phone: targetPhone,
    status: targetStatus,
    updated_at: new Date(),
  };
  if (targetStatus === "active") {
    userData.last_login_at = new Date();
  }
  if (cleanEmail) {
    userData.email = cleanEmail;
  }
  if (password && String(password).trim().length > 0) {
    userData.password_hash = await hashPassword(String(password).trim());
  }

  if (user) {
    await prisma.users.update({
      where: { id: uid },
      data: userData,
    });
  }

  if (emp) {
    let deptId = emp.department_id;
    if (department !== undefined) {
      const dept = await prisma.departments.findFirst({
        where: {
          hospital_id: emp.hospital_id,
          dept_code: String(department).trim().toLowerCase(),
        },
      });
      deptId = dept?.id || null;
    }

    const empData = {
      name: targetName,
      phone: targetPhone,
      department_id: deptId,
      employee_code: employeeId !== undefined ? employeeId : emp.employee_code,
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

    await prisma.employees.update({
      where: { id: emp.id },
      data: empData,
    });
  }

  return { user_id: uid, name: targetName, email: cleanEmail || user?.email || "", role: targetRole, status: targetStatus };
}

/**
 * Updates an employee or doctor's password directly.
 */
async function updateEmployeePassword(userId, newPassword) {
  let uid = parseInt(userId, 10);
  const empLookup = await prisma.employees.findUnique({ where: { id: uid } });
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

  const pwdHash = await hashPassword(String(newPassword).trim());
  await prisma.users.update({
    where: { id: uid },
    data: { password_hash: pwdHash, updated_at: new Date() },
  });

  return {
    user_id: uid,
    email: user.email,
    name: user.username,
    role: user.role,
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
    const lastLoginTime = d.employees?.users?.last_login_at ? new Date(d.employees.users.last_login_at).getTime() : null;
    const isStale = !lastLoginTime || (now - lastLoginTime > SESSION_MAX_AGE_MS);
    const empStatus = (d.employees?.status === "active" && d.employees?.users?.status === "active" && !isStale) ? "active" : "inactive";

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

    // Availability enforcement
    const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
    const lastLogin = empRec.users?.last_login_at ? new Date(empRec.users.last_login_at).getTime() : null;
    const isStale = !lastLogin || (Date.now() - lastLogin > SESSION_MAX_AGE_MS);
    const isOnline = empRec.status === "active" && empRec.users?.status === "active" && !isStale;

    if (!isOnline) {
      const err = new Error(
        `Cannot assign desk: Doctor/Staff '${empRec.name}' is currently INACTIVE / OFFLINE. An employee must be actively logged in before being assigned to an active desk.`
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

    // Availability enforcement
    const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
    const lastLogin = empRec.users?.last_login_at ? new Date(empRec.users.last_login_at).getTime() : null;
    const isStale = !lastLogin || (Date.now() - lastLogin > SESSION_MAX_AGE_MS);
    const isOnline = empRec.status === "active" && empRec.users?.status === "active" && !isStale;

    if (!isOnline) {
      const err = new Error(
        `Cannot assign desk: Doctor/Staff '${empRec.name}' is currently INACTIVE / OFFLINE. An employee must be actively logged in before being assigned to an active desk.`
      );
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

      // Availability enforcement
      const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
      const lastLogin = empRec.users?.last_login_at ? new Date(empRec.users.last_login_at).getTime() : null;
      const isStale = !lastLogin || (Date.now() - lastLogin > SESSION_MAX_AGE_MS);
      const isOnline = empRec.status === "active" && empRec.users?.status === "active" && !isStale;

      if (!isOnline) {
        const err = new Error(
          `Cannot assign desk: Doctor/Staff '${empRec.name}' is currently INACTIVE / OFFLINE. An employee must be actively logged in before being assigned to an active desk.`
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

  const hid = hospital ? hospital.id : null;
  const hcode = hospital ? hospital.hospital_code : "";

  const tables = [
    "users", "hospitals", "departments", "patients", "family_members",
    "employees", "desks", "kiosks", "appointments", "appointment_status_history",
    "tickets", "queue_events", "service_logs", "tenant_historical_data",
    "tenant_config", "tenant_mapping", "audit_logs"
  ];

  const result = {};

  for (const tbl of tables) {
    try {
      const schemaRows = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = '${tbl}'
        ORDER BY ordinal_position ASC;
      `);

      let countSql = "";
      let previewSql = "";

      if (!hid) {
        countSql = `SELECT count(*)::int as cnt FROM ${tbl};`;
        previewSql = tbl !== "tenant_config" && tbl !== "tenant_mapping" && tbl !== "family_members"
          ? `SELECT * FROM ${tbl} ORDER BY id DESC LIMIT 10;`
          : `SELECT * FROM ${tbl} LIMIT 10;`;
      } else {
        switch (tbl) {
          case "hospitals":
            countSql = `SELECT count(*)::int as cnt FROM hospitals WHERE id = ${hid};`;
            previewSql = `SELECT * FROM hospitals WHERE id = ${hid} LIMIT 10;`;
            break;
          case "departments":
            countSql = `SELECT count(*)::int as cnt FROM departments WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM departments WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "desks":
            countSql = `SELECT count(*)::int as cnt FROM desks WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM desks WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "kiosks":
            countSql = `SELECT count(*)::int as cnt FROM kiosks WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM kiosks WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "employees":
            countSql = `SELECT count(*)::int as cnt FROM employees WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM employees WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "appointments":
            countSql = `SELECT count(*)::int as cnt FROM appointments WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM appointments WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "appointment_status_history":
            countSql = `SELECT count(*)::int as cnt FROM appointment_status_history ash JOIN appointments a ON ash.appointment_id = a.appointment_id WHERE a.hospital_id = ${hid};`;
            previewSql = `SELECT ash.* FROM appointment_status_history ash JOIN appointments a ON ash.appointment_id = a.appointment_id WHERE a.hospital_id = ${hid} ORDER BY ash.id DESC LIMIT 10;`;
            break;
          case "tickets":
            countSql = `SELECT count(*)::int as cnt FROM tickets WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM tickets WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "queue_events":
            countSql = `SELECT count(*)::int as cnt FROM queue_events WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM queue_events WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "service_logs":
            countSql = `SELECT count(*)::int as cnt FROM service_logs WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM service_logs WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "tenant_historical_data":
            countSql = `SELECT count(*)::int as cnt FROM tenant_historical_data WHERE hospital_id = ${hid} OR legacy_tenant_id = '${hcode}';`;
            previewSql = `SELECT * FROM tenant_historical_data WHERE hospital_id = ${hid} OR legacy_tenant_id = '${hcode}' ORDER BY id DESC LIMIT 10;`;
            break;
          case "tenant_config":
            countSql = `SELECT count(*)::int as cnt FROM tenant_config WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM tenant_config WHERE hospital_id = ${hid} LIMIT 10;`;
            break;
          case "tenant_mapping":
            countSql = `SELECT count(*)::int as cnt FROM tenant_mapping WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM tenant_mapping WHERE hospital_id = ${hid} LIMIT 10;`;
            break;
          case "audit_logs":
            countSql = `SELECT count(*)::int as cnt FROM audit_logs WHERE hospital_id = ${hid};`;
            previewSql = `SELECT * FROM audit_logs WHERE hospital_id = ${hid} ORDER BY id DESC LIMIT 10;`;
            break;
          case "users":
            countSql = `SELECT count(*)::int as cnt FROM users WHERE primary_hospital_code = '${hcode}' OR id IN (SELECT user_id FROM employees WHERE hospital_id = ${hid}) OR id = ${hospital.owner_user_id || -1};`;
            previewSql = `SELECT * FROM users WHERE primary_hospital_code = '${hcode}' OR id IN (SELECT user_id FROM employees WHERE hospital_id = ${hid}) OR id = ${hospital.owner_user_id || -1} ORDER BY id DESC LIMIT 10;`;
            break;
          case "patients":
            countSql = `SELECT count(*)::int as cnt FROM patients WHERE id IN (SELECT patient_id FROM tickets WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR id IN (SELECT patient_id FROM appointments WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = '${hcode}');`;
            previewSql = `SELECT * FROM patients WHERE id IN (SELECT patient_id FROM tickets WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR id IN (SELECT patient_id FROM appointments WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = '${hcode}') ORDER BY id DESC LIMIT 10;`;
            break;
          case "family_members":
            countSql = `SELECT count(*)::int as cnt FROM family_members WHERE patient_id IN (SELECT id FROM patients WHERE id IN (SELECT patient_id FROM tickets WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR id IN (SELECT patient_id FROM appointments WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = '${hcode}')) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = '${hcode}' OR id IN (SELECT user_id FROM employees WHERE hospital_id = ${hid}));`;
            previewSql = `SELECT * FROM family_members WHERE patient_id IN (SELECT id FROM patients WHERE id IN (SELECT patient_id FROM tickets WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR id IN (SELECT patient_id FROM appointments WHERE hospital_id = ${hid} AND patient_id IS NOT NULL) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = '${hcode}')) OR user_id IN (SELECT id FROM users WHERE primary_hospital_code = '${hcode}' OR id IN (SELECT user_id FROM employees WHERE hospital_id = ${hid})) ORDER BY created_at DESC LIMIT 10;`;
            break;
          default:
            countSql = `SELECT count(*)::int as cnt FROM ${tbl};`;
            previewSql = `SELECT * FROM ${tbl} LIMIT 10;`;
        }
      }

      const countRes = await prisma.$queryRawUnsafe(countSql);
      const cnt = countRes[0]?.cnt || 0;
      const rows = await prisma.$queryRawUnsafe(previewSql);

      const sanitizedRows = rows.map((r) => {
        const copy = { ...r };
        if (copy.password_hash) {
          copy.password_hash = "•••••••••••• [ENCRYPTED]";
        }
        return copy;
      });

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
async function getHospitalVisitHistory(hospitalCode, limit = 500) {
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
      where: { hospital_id: hospital.id },
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
        serve_start_time: curr.serve_start_time ? curr.serve_start_time.toISOString() : null,
        serve_end_time: curr.serve_end_time ? curr.serve_end_time.toISOString() : null,
        duration_minutes: Math.round((curr.actual_service_minutes || curr.predicted_service_minutes || 10) * 10) / 10,
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
      service_duration_minutes: Math.round((totalDuration || t.actual_service_minutes || 10) * 10) / 10,
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
  getSuperAdminOverview,
  getAllHospitals,
  getHospitalByCode,
  createHospital,
  updateHospital,
  getHospitalBranding,
  updateHospitalBranding,
  deleteHospital,
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
  bulkAddHospitalEmployees,
  bulkAddHospitalVisits,
  findMatchingDepartment,
  normalizeDeptString,
};
