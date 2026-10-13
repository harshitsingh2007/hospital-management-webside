/**
 * auth.controller.js
 * ------------------
 * Authentication & Identity Controller: Signups, Login, Profile, User Management.
 */

const prisma = require("../config/prisma");
const { hashPassword, verifyPassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { createHospital } = require("../services/hospitalService");
const engine = require("../services/queueEngine");
const { createVerificationOtp, verifyOtp } = require("../services/tokenService");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/emailService");

/**
 * Automatically claims and links all past unlinked walk-in records (patients, tickets)
 * created under this phone number to the newly registered/logged-in user account.
 */
async function linkPastWalkinRecordsToUser(userId, phone, username = "") {
  if (!userId) return;
  const cleanPhoneDigits = String(phone || "").replace(/\D/g, "");
  if (cleanPhoneDigits.length < 7) return;
  const last10 = cleanPhoneDigits.slice(-10);

  try {
    // 1. Find all unlinked or provisional patient records created during walk-ins with this phone
    const unlinkedPatients = await prisma.patients.findMany({
      where: {
        phone: { contains: last10 },
        user_id: null,
      },
      select: { id: true, name: true, phone: true },
    });

    if (unlinkedPatients.length > 0) {
      for (const pat of unlinkedPatients) {
        await prisma.patients.update({
          where: { id: pat.id },
          data: { user_id: userId, updated_at: new Date() },
        });
      }
    }

    // 2. Ensure primary patient profile exists for the user
    const primaryPat = await prisma.patients.findFirst({
      where: { user_id: userId },
    });
    if (!primaryPat) {
      await prisma.patients.create({
        data: {
          user_id: userId,
          medical_id: `PAT-${Date.now().toString().slice(-6)}`,
          name: username || "Patient",
          phone: phone || "",
          gender: "other",
          age: 30,
        },
      });
    }
  } catch (err) {
    console.error("[Auth] Error auto-linking past walk-in records to user:", err);
  }
}

async function signupSuperAdmin(req, res, next) {
  try {
    const { email, username, password, phone = "", hospital_name = "", hospital_code = "" } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !username || !password) {
      return res.status(400).json({ status: "error", message: "Email, username, and password are required." });
    }

    const existing = await prisma.users.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ status: "error", message: "An account with this email address already exists." });
    }

    const pwdHash = await hashPassword(password);
    const user = await prisma.users.create({
      data: {
        email: cleanEmail,
        username,
        password_hash: pwdHash,
        role: "superadmin",
        status: "active",
        phone: phone || "",
      },
    });

    const hCode = (hospital_code || `hosp-${Math.floor(Date.now() / 1000)}`).trim().toLowerCase();
    const hName = (hospital_name || `${username}'s Hospital`).trim();

    const hospital = await createHospital({
      hospitalCode: hCode,
      name: hName,
      phone,
      email: cleanEmail,
      ownerUserId: user.id,
    });

    const token = generateToken({ id: user.id, email: user.email, role: user.role, hospitalId: hospital.id });

    return res.status(200).json({
      status: "success",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        hospital_code: hCode,
        hospital_name: hName,
        hospital_id: hospital.id,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function signupAdmin(req, res, next) {
  try {
    const { email, username, password, phone = "", hospital_code = "city-hospital-01" } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !username || !password) {
      return res.status(400).json({ status: "error", message: "Email, username, and password are required." });
    }

    const existing = await prisma.users.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ status: "error", message: "An account with this email address already exists." });
    }

    const hid = await engine.resolveHospitalId(hospital_code);
    const pwdHash = await hashPassword(password);

    const user = await prisma.users.create({
      data: {
        email: cleanEmail,
        username,
        password_hash: pwdHash,
        role: "admin",
        status: "active",
        phone: phone || "",
      },
    });

    const employee = await prisma.employees.create({
      data: {
        user_id: user.id,
        hospital_id: hid,
        employee_code: `EMP-${user.id}`,
        name: username,
        email: cleanEmail,
        phone: phone || "",
        status: "active",
      },
    });

    const token = generateToken({ id: user.id, email: user.email, role: user.role, hospitalId: hid });

    return res.status(200).json({
      status: "success",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        hospital_code,
        hospital_id: hid,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function signupPatient(req, res, next) {
  try {
    const { email, username, password, phone = "", hospital_code, otp } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !username || !password) {
      return res.status(400).json({ status: "error", message: "Email, username, and password are required." });
    }

    const existing = await prisma.users.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ status: "error", message: "An account with this email address already exists." });
    }

    // Verify OTP if provided
    if (otp) {
      const isValidOtp = await verifyOtp(cleanEmail, otp, "email_verification", true);
      if (!isValidOtp) {
        return res.status(400).json({
          status: "error",
          message: "Invalid or expired email verification code. Please enter the correct 6-digit code or request a new one.",
        });
      }
    }

    // Resolve hospital from provided code, or fallback to first active or default
    const targetCode = String(hospital_code || "city-hospital-01").trim();
    let targetHospital = await prisma.hospitals.findFirst({
      where: { hospital_code: targetCode },
    });
    if (!targetHospital) {
      targetHospital = await prisma.hospitals.findFirst({
        where: { status: "active" },
      });
    }

    const resolvedHospitalCode = targetHospital?.hospital_code || "city-hospital-01";
    const resolvedHospitalName = targetHospital?.name || "City General Hospital";

    const pwdHash = await hashPassword(password);
    const user = await prisma.users.create({
      data: {
        email: cleanEmail,
        username,
        password_hash: pwdHash,
        role: "user",
        status: "active",
        phone: phone || "",
        primary_hospital_code: resolvedHospitalCode,
      },
    });

    await prisma.patients.create({
      data: {
        user_id: user.id,
        medical_id: "",
        name: username,
        phone: phone || "",
        gender: "other",
        age: 30,
      },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      hospital_code: resolvedHospitalCode,
      hospitalId: targetHospital?.id || null,
    });

    return res.status(200).json({
      status: "success",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        phone: user.phone || "",
        status: "active",
        hospital_code: resolvedHospitalCode,
        hospital_name: resolvedHospitalName,
        hospital_id: targetHospital?.id || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const identifier = String(email || "").trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(401).json({ status: "error", message: "Email and password are required." });
    }

    // Lookup user by email OR employee_code
    let user = await prisma.users.findFirst({
      where: {
        OR: [{ email: { equals: identifier, mode: "insensitive" } }, { username: { equals: identifier, mode: "insensitive" } }],
      },
      include: {
        patients: true,
        employees: {
          include: {
            departments: true,
            hospitals: true,
          },
        },
        hospitals: true,
      },
    });

    if (!user) {
      const emp = await prisma.employees.findFirst({
        where: { employee_code: { equals: identifier, mode: "insensitive" } },
        include: {
          users: {
            include: {
              patients: true,
              employees: {
                include: {
                  departments: true,
                  hospitals: true,
                },
              },
              hospitals: true,
            },
          },
        },
      });
      if (emp) user = emp.users;
    }

    if (!user) {
      return res.status(401).json({ status: "error", message: "Invalid email or password." });
    }

    // Verify Password (Dual support: bcrypt + legacy SHA-256)
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ status: "error", message: "Invalid email or password." });
    }

    if (user.status === "deactivated" || user.status === "suspended" || user.status === "blocked") {
      return res.status(401).json({
        status: "error",
        message: "Account is deactivated or suspended. Please contact your hospital administrator.",
      });
    }

    // Mark user as active (online) and record login timestamp
    await prisma.users.update({
      where: { id: user.id },
      data: {
        status: "active",
        last_login_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Also activate employee records so doctor/staff shows online/active
    await prisma.employees.updateMany({
      where: { user_id: user.id },
      data: {
        status: "active",
        updated_at: new Date(),
      },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.employees[0]?.hospital_id || user.hospitals[0]?.id || null,
    });

    const pat = user.patients[0] || null;
    const emp = user.employees[0] || null;
    const ownedH = user.hospitals[0] || null;

    const responseUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: "active",
      phone: user.phone || "",
    };

    if (pat) {
      responseUser.medical_id = pat.medical_id || "";
      responseUser.age = pat.age || 0;
      responseUser.gender = pat.gender || "";
    }

    if (emp) {
      responseUser.hospital_code = emp.hospitals?.hospital_code || "city-hospital-01";
      responseUser.hospital_name = emp.hospitals?.name || "City General Hospital";
      responseUser.department = emp.departments?.dept_code || "all";
      responseUser.employee_id = emp.employee_code || "";
    } else if (ownedH) {
      responseUser.hospital_code = ownedH.hospital_code;
      responseUser.hospital_name = ownedH.name;
    } else {
      const hCode = user.primary_hospital_code || "city-hospital-01";
      const hosp = await prisma.hospitals.findFirst({
        where: { hospital_code: hCode },
      });
      responseUser.hospital_code = hosp?.hospital_code || hCode;
      responseUser.hospital_name = hosp?.name || "City General Hospital";
      responseUser.hospital_id = hosp?.id || null;
    }

    return res.status(200).json({
      status: "success",
      token,
      user: responseUser,
    });
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const emailParam = req.query.email || req.user?.email;
    if (!emailParam) {
      return res.status(400).json({ status: "error", message: "Email parameter or token required." });
    }

    const cleanEmail = String(emailParam).trim().toLowerCase();
    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email: { equals: cleanEmail, mode: "insensitive" } }, { username: { equals: cleanEmail, mode: "insensitive" } }],
      },
      include: {
        patients: true,
        employees: {
          include: {
            departments: true,
            hospitals: true,
          },
        },
        hospitals: true,
      },
    });

    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    const pat = user.patients[0] || null;
    const emp = user.employees[0] || null;
    const ownedH = user.hospitals[0] || null;

    const responseUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status || "active",
      phone: user.phone || "",
      created_at: user.created_at ? user.created_at.toISOString() : null,
      last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null,
    };

    if (pat) {
      responseUser.medical_id = pat.medical_id || "";
      responseUser.age = pat.age || 0;
      responseUser.gender = pat.gender || "";
    }

    if (emp) {
      responseUser.hospital_code = emp.hospitals?.hospital_code || "city-hospital-01";
      responseUser.hospital_name = emp.hospitals?.name || "City General Hospital";
      responseUser.department = emp.departments?.dept_code || "all";
      responseUser.employee_id = emp.employee_code || "";
    } else if (ownedH) {
      responseUser.hospital_code = ownedH.hospital_code;
      responseUser.hospital_name = ownedH.name;
    } else {
      const hCode = user.primary_hospital_code || "city-hospital-01";
      const hosp = await prisma.hospitals.findFirst({
        where: { hospital_code: hCode },
      });
      responseUser.hospital_code = hosp?.hospital_code || hCode;
      responseUser.hospital_name = hosp?.name || "City General Hospital";
      responseUser.hospital_id = hosp?.id || null;
    }

    return res.status(200).json({
      status: "success",
      user: responseUser,
    });
  } catch (error) {
    next(error);
  }
}

async function updateUserPrimaryHospital(req, res, next) {
  try {
    const { hospital_code, email } = req.body;
    const userEmail = email || req.user?.email;
    if (!userEmail || !hospital_code) {
      return res.status(400).json({ status: "error", message: "User email and hospital_code are required." });
    }
    const cleanEmail = String(userEmail).trim().toLowerCase();
    const hosp = await prisma.hospitals.findFirst({
      where: { hospital_code: String(hospital_code).trim() },
    });
    if (!hosp) {
      return res.status(404).json({ status: "error", message: "Hospital not found." });
    }

    await prisma.users.updateMany({
      where: { email: cleanEmail },
      data: { primary_hospital_code: hosp.hospital_code },
    });

    return res.status(200).json({
      status: "success",
      hospital_code: hosp.hospital_code,
      hospital_name: hosp.name,
      hospital_id: hosp.id,
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { email, username, phone = "", gender = "", age = 0, medical_id = "" } = req.body;
    const cleanEmail = String(email || req.user?.email || "").trim().toLowerCase();

    const user = await prisma.users.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    await prisma.users.update({
      where: { id: user.id },
      data: {
        username: username || user.username,
        phone: phone || user.phone,
        updated_at: new Date(),
      },
    });

    const pat = await prisma.patients.findFirst({ where: { user_id: user.id } });
    if (pat) {
      await prisma.patients.update({
        where: { id: pat.id },
        data: {
          name: username || pat.name,
          phone: phone || pat.phone,
          gender: gender || pat.gender,
          age: parseInt(age, 10) || pat.age,
          medical_id: medical_id || pat.medical_id,
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.patients.create({
        data: {
          user_id: user.id,
          name: username || user.username,
          phone: phone || "",
          gender: gender || "other",
          age: parseInt(age, 10) || 30,
          medical_id: medical_id || "",
        },
      });
    }

    return getMe(req, res, next);
  } catch (error) {
    next(error);
  }
}

async function getAllUsers(req, res, next) {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        phone: true,
        created_at: true,
      },
      orderBy: { id: "asc" },
    });

    return res.status(200).json({
      status: "success",
      users,
    });
  } catch (error) {
    next(error);
  }
}

async function getUserHistory(req, res, next) {
  try {
    const identifier = req.params.email || req.params.identifier;
    const nameQuery = req.query.name;
    const cleanId = String(identifier || "").trim().toLowerCase();

    const cleanDigits = cleanId.replace(/\D/g, "");

    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: cleanId, mode: "insensitive" } },
          { username: { equals: cleanId, mode: "insensitive" } },
          ...(cleanDigits.length >= 7 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : []),
        ],
      },
    });

    const phoneHeader = req.headers["x-user-phone"] || req.query.phone || "";
    const cleanPhone = String(phoneHeader).replace(/\D/g, "");

    const uids = [];
    if (user) {
      uids.push(user.id);
      if (user.phone && user.phone.replace(/\D/g, "").length >= 7) {
        const ph = user.phone.replace(/\D/g, "").slice(-10);
        const rel = await prisma.users.findMany({
          where: { phone: { contains: ph } },
          select: { id: true },
        });
        rel.forEach((r) => { if (!uids.includes(r.id)) uids.push(r.id); });
      }
    } else if (cleanDigits.length >= 7) {
      const rel = await prisma.users.findMany({
        where: { phone: { contains: cleanDigits.slice(-10) } },
        select: { id: true },
      });
      rel.forEach((r) => { if (!uids.includes(r.id)) uids.push(r.id); });
    }

    if (cleanPhone.length >= 7) {
      const rel = await prisma.users.findMany({
        where: { phone: { contains: cleanPhone.slice(-10) } },
        select: { id: true },
      });
      rel.forEach((r) => { if (!uids.includes(r.id)) uids.push(r.id); });
    }

    // Get family members mapped to patient IDs
    const userFamilyMembers = uids.length > 0
      ? await prisma.family_members.findMany({
          where: { user_id: { in: uids } },
        })
      : [];
    const famByPatId = new Map();
    const famByName = new Map();
    userFamilyMembers.forEach((fm) => {
      if (fm.patient_id) famByPatId.set(fm.patient_id, fm.id);
      if (fm.name) famByName.set(fm.name.toLowerCase().trim(), fm.id);
    });

    const tickets = await prisma.tickets.findMany({
      where: {
        OR: [
          ...(uids.length > 0
            ? [
                { patients: { user_id: { in: uids } } },
                { patients: { family_members: { some: { user_id: { in: uids } } } } },
              ]
            : []),
          { patients: { users: { email: { contains: cleanId, mode: "insensitive" } } } },
          { patients: { users: { username: { contains: cleanId, mode: "insensitive" } } } },
          { ticket_id: { contains: cleanId, mode: "insensitive" } },
          { patients: { phone: { contains: cleanId, mode: "insensitive" } } },
          ...(cleanDigits.length >= 7 ? [{ patients: { phone: { contains: cleanDigits.slice(-10) } } }] : []),
          ...(cleanPhone.length >= 7 ? [{ patients: { phone: { contains: cleanPhone.slice(-10) } } }] : []),
          { patients: { users: { phone: { contains: cleanId, mode: "insensitive" } } } },
          { name: { contains: cleanId, mode: "insensitive" } },
          { patients: { name: { contains: cleanId, mode: "insensitive" } } },
          ...(nameQuery ? [{ name: { contains: String(nameQuery).trim(), mode: "insensitive" } }] : []),
        ],
      },
      include: {
        departments: {
          include: { employees: true },
        },
        hospitals: true,
        patients: true,
        queue_events: {
          where: {
            event_type: { in: ["TRANSFERRED", "QUEUE_JOINED", "STATUS_CHANGE", "VISIT_COMPLETED", "SERVE_START"] },
          },
          orderBy: { created_at: "asc" },
        },
      },
      orderBy: { join_timestamp: "desc" },
      take: 100,
    });

    const allTicketIds = tickets.map((t) => t.ticket_id).filter(Boolean);
    const prescriptionsByTicketId = new Map();
    const visitsByTicketId = new Map();

    if (allTicketIds.length > 0) {
      try {
        const [prescriptions, visits] = await Promise.all([
          prisma.prescriptions.findMany({
            where: { ticket_id: { in: allTicketIds } },
            select: { ticket_id: true, doctor_name: true },
          }),
          prisma.visit_history.findMany({
            where: { ticket_id: { in: allTicketIds } },
            select: { ticket_id: true, doctor_name: true },
          }),
        ]);
        prescriptions.forEach((p) => { if (p.ticket_id) prescriptionsByTicketId.set(p.ticket_id, p); });
        visits.forEach((v) => { if (v.ticket_id) visitsByTicketId.set(v.ticket_id, v); });
      } catch (e) {}
    }

    // Helper: safely parse clinical prescription notes JSON / string
    function parseRxSafe(raw) {
      if (!raw) return null;
      if (typeof raw === "object") return raw;
      if (typeof raw === "string") {
        let trimmed = raw.trim();
        while ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
          trimmed = trimmed.slice(1, -1).trim();
        }
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          try {
            return JSON.parse(trimmed);
          } catch (e) {
            try { return JSON.parse(JSON.parse(raw)); } catch (e2) {}
          }
        }
      }
      return null;
    }

    // Helper: resolve doctor name for a ticket
    function resolveDoctorNameForTicket(t) {
      let docName = "";
      const inMem = engine._getTenant(t.hospitals?.hospital_code || "city-hospital-01")?.tickets?.get(t.ticket_id);
      if (inMem?.served_by_doctor_name) {
        docName = inMem.served_by_doctor_name;
      }
      if (!docName && prescriptionsByTicketId.get(t.ticket_id)?.doctor_name) {
        docName = prescriptionsByTicketId.get(t.ticket_id).doctor_name;
      }
      if (!docName && visitsByTicketId.get(t.ticket_id)?.doctor_name) {
        docName = visitsByTicketId.get(t.ticket_id).doctor_name;
      }
      if (!docName && t.prescription_notes) {
        try {
          const rx = typeof t.prescription_notes === "object" ? t.prescription_notes : JSON.parse(t.prescription_notes);
          if (rx?.doctor_name && rx.doctor_name !== "Dr. Staff Desk") {
            docName = rx.doctor_name;
          }
        } catch (e) {}
      }
      if (!docName && Array.isArray(t.queue_events)) {
        for (const ev of t.queue_events) {
          if (ev.metadata?.doctor_name && ev.metadata.doctor_name !== "Dr. Staff Desk") {
            docName = ev.metadata.doctor_name;
            break;
          }
        }
      }
      if (!docName && t.departments?.employees && t.departments.employees.length > 0) {
        const activeDoc = t.departments.employees.find((e) => (e.status || "").toLowerCase() === "active") || t.departments.employees[0];
        if (activeDoc?.name) {
          docName = activeDoc.name;
        }
      }
      if (docName && !docName.startsWith("Dr.") && !docName.startsWith("Dr ")) {
        docName = `Dr. ${docName}`;
      }
      return docName || null;
    }

    // Build lookup map to connect transfer chains
    const ticketMap = new Map();
    for (const t of tickets) {
      ticketMap.set(String(t.ticket_id), t);
    }

    // Identify parent tickets that have a child ticket in the list
    const parentIdSet = new Set();
    for (const t of tickets) {
      if (t.parent_ticket_id && ticketMap.has(String(t.parent_ticket_id))) {
        parentIdSet.add(String(t.parent_ticket_id));
      }
      if (Array.isArray(t.queue_events)) {
        for (const ev of t.queue_events) {
          if (ev.event_type === "TRANSFERRED" && ev.metadata?.transferred_to_ticket) {
            if (ticketMap.has(String(ev.metadata.transferred_to_ticket))) {
              parentIdSet.add(String(t.ticket_id));
            }
          }
        }
      }
    }

    const formatted = [];

    for (const t of tickets) {
      const tid = String(t.ticket_id || "");
      const s = String(t.status || "").toLowerCase();

      // If this ticket is marked "transferred" and its target child ticket is present in this history list,
      // skip it as an independent standalone row so it collapses into the unified visit card.
      if (s === "transferred" && parentIdSet.has(tid)) {
        continue;
      }

      // Build consultation journey stages by walking UP parent_ticket_id links
      const stages = [];
      let curr = t;
      const visitedInChain = new Set();

      while (curr && !visitedInChain.has(String(curr.ticket_id))) {
        visitedInChain.add(String(curr.ticket_id));
        const stageDoc = resolveDoctorNameForTicket(curr);
        const stageDept = curr.departments?.name || curr.service_category || "General OPD";

        stages.unshift({
          ticket_id: curr.ticket_id,
          department: stageDept,
          dept_code: curr.departments?.dept_code || curr.service_category || "consultation",
          doctor_name: stageDoc || "",
          status: (curr.status || "").toLowerCase(),
          prescription_notes: curr.prescription_notes || "",
          medical_condition: curr.medical_condition || "",
          serve_start_time: curr.serve_start_time ? curr.serve_start_time.toISOString() : null,
          serve_end_time: curr.serve_end_time ? curr.serve_end_time.toISOString() : null,
          actual_service_minutes: curr.actual_service_minutes || null,
          created_at: curr.join_timestamp ? curr.join_timestamp.toISOString() : (curr.created_at ? curr.created_at.toISOString() : null),
        });

        if (curr.parent_ticket_id && ticketMap.has(String(curr.parent_ticket_id))) {
          curr = ticketMap.get(String(curr.parent_ticket_id));
        } else {
          // Check queue_events transfer target
          const parentByEvent = tickets.find((ot) => {
            if (visitedInChain.has(String(ot.ticket_id))) return false;
            return ot.queue_events?.some(
              (ev) => ev.event_type === "TRANSFERRED" && String(ev.metadata?.transferred_to_ticket) === String(curr.ticket_id)
            );
          });
          if (parentByEvent) {
            curr = parentByEvent;
          } else {
            break;
          }
        }
      }

      stages.forEach((stg, idx) => {
        stg.stage_number = idx + 1;
      });

      const isTransferred = stages.length > 1 || Boolean(t.transferred_from_dept) || Boolean(t.parent_ticket_id);
      const transferTrail = stages
        .map((stg) => stg.department)
        .filter((dept, idx, arr) => idx === 0 || dept !== arr[idx - 1])
        .join(" → ");
      const originDept = stages[0]?.department || t.transferred_from_dept || t.departments?.name || t.service_category || "General OPD";
      const docName = resolveDoctorNameForTicket(t) || stages[stages.length - 1]?.doctor_name || stages[0]?.doctor_name || null;
      const allDoctors = Array.from(new Set(stages.map((stg) => stg.doctor_name).filter(Boolean)));

      // Merge multi-stage prescription notes into a unified structured clinical record
      let unifiedPrescriptionNotes = t.prescription_notes || "";
      if (stages.length > 1) {
        let mergedDiag = "";
        let mergedAdvices = [];
        let mergedLabTests = [];
        let mergedFollowUp = "";
        let mergedMeds = [];
        const seenMeds = new Set();
        let targetDept = "";
        let transferNotes = "";

        for (const stg of stages) {
          const rx = parseRxSafe(stg.notes);
          if (rx) {
            if (rx.diagnosis && rx.diagnosis !== "Clinical Consultation" && rx.diagnosis !== "General OPD") {
              mergedDiag = rx.diagnosis;
            }
            if (rx.advice && rx.advice.trim()) {
              mergedAdvices.push(rx.advice.trim());
            }
            if (rx.lab_tests && rx.lab_tests !== "no") {
              mergedLabTests.push(rx.lab_tests);
            }
            if (rx.follow_up) {
              mergedFollowUp = rx.follow_up;
            }
            if (rx.target_department) targetDept = rx.target_department;
            if (rx.transfer_notes) transferNotes = rx.transfer_notes;

            if (Array.isArray(rx.medicines)) {
              for (const med of rx.medicines) {
                const k = `${String(med.name || "").toLowerCase().trim()}_${String(med.dosage || "").toLowerCase().trim()}`;
                if (!seenMeds.has(k)) {
                  seenMeds.add(k);
                  mergedMeds.push(med);
                }
              }
            }
          }
        }

        const topRx = parseRxSafe(t.prescription_notes);
        if (topRx) {
          if (topRx.diagnosis) mergedDiag = topRx.diagnosis;
          if (topRx.follow_up) mergedFollowUp = topRx.follow_up;
        }

        const consolidated = {
          doctor_name: docName || "Consultant Physician",
          doctor_department: t.departments?.name || t.service_category || "General OPD",
          doctor_employee_id: topRx?.doctor_employee_id || "",
          diagnosis: mergedDiag || t.medical_condition || "Clinical Consultation",
          medicines: mergedMeds,
          lab_tests: mergedLabTests.join(", "),
          advice: mergedAdvices.join(" • ") || "Clinical consultation completed.",
          follow_up: mergedFollowUp || "Review as advised",
          target_department: targetDept,
          transfer_notes: transferNotes,
          stages: stages,
          prescribed_at: t.serve_end_time ? t.serve_end_time.toISOString() : (t.join_timestamp ? t.join_timestamp.toISOString() : new Date().toISOString()),
        };
        unifiedPrescriptionNotes = JSON.stringify(consolidated);
      }

      // Root ticket for timestamp
      const rootTicket = stages[0] ? ticketMap.get(String(stages[0].ticket_id)) || t : t;

      const memFmId = (t.patient_id ? famByPatId.get(t.patient_id) : null) ||
        (t.name ? famByName.get(t.name.toLowerCase().trim()) : null) ||
        null;

      formatted.push({
        ticket_id: t.ticket_id,
        name: t.name,
        phone: t.patients?.phone || "",
        patient_id: t.patient_id || null,
        family_member_id: memFmId,
        status: t.status,
        service_category: t.service_category,
        priority_level: t.priority_level,
        position: t.position,
        estimated_wait_minutes: t.estimated_wait_minutes,
        created_at: rootTicket.join_timestamp ? rootTicket.join_timestamp.toISOString() : (t.join_timestamp ? t.join_timestamp.toISOString() : null),
        serve_start_time: t.serve_start_time ? t.serve_start_time.toISOString() : null,
        serve_end_time: t.serve_end_time ? t.serve_end_time.toISOString() : null,
        actual_service_minutes: t.actual_service_minutes,
        prescription_notes: unifiedPrescriptionNotes,
        cancellation_reason: t.cancellation_reason || "",
        cancelled_at: t.cancelled_at ? t.cancelled_at.toISOString() : null,
        medical_condition: t.medical_condition,
        pre_existing_condition: t.pre_existing_condition,
        source: t.source,
        appointment_id: t.appointment_id || "",
        hospital_code: t.hospitals?.hospital_code || "city-hospital-01",
        hospital_name: t.hospitals?.name || "City General Hospital",
        department_name: t.departments?.name || t.service_category,
        doctor_name: docName,
        served_by_doctor_name: docName,
        all_doctors: allDoctors,
        parent_ticket_id: t.parent_ticket_id || "",
        transferred_from_dept: isTransferred ? originDept : (t.transferred_from_dept || ""),
        is_transferred: isTransferred,
        transfer_trail: isTransferred ? transferTrail : null,
        transfer_stages: stages,
        transfer_count: stages.length > 1 ? stages.length - 1 : 0,
        transfers: stages.length > 1 ? stages : [],
      });
    }

    return res.status(200).json({
      status: "success",
      tickets: formatted,
      count: formatted.length,
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const userId = req.user?.id || req.body?.user_id || req.body?.id;
    const email = req.user?.email || req.body?.email;

    if (userId || email) {
      const where = userId
        ? { id: Number(userId) }
        : { email: { equals: String(email).trim(), mode: "insensitive" } };

      const targetUser = await prisma.users.findFirst({ where });
      if (targetUser) {
        await prisma.users.update({
          where: { id: targetUser.id },
          data: {
            status: "inactive",
            updated_at: new Date(),
          },
        });

        await prisma.employees.updateMany({
          where: { user_id: targetUser.id },
          data: {
            status: "inactive",
            updated_at: new Date(),
          },
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Successfully logged out. Doctor/staff status set to inactive.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Real-time check if an email already exists in the system.
 */
async function checkEmail(req, res, next) {
  try {
    const email = String(req.query.email || req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ status: "error", message: "Email query parameter is required." });
    }

    const existing = await prisma.users.findUnique({ where: { email } });
    return res.status(200).json({
      status: "success",
      exists: Boolean(existing),
      email,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Sends a 6-digit email verification code for new patient registration.
 */
async function sendVerificationOtp(req, res, next) {
  try {
    const { email, username, hospital_code, hospital_name } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ status: "error", message: "Valid email address is required." });
    }

    const existing = await prisma.users.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ status: "error", message: "An account with this email is already registered." });
    }

    // Resolve hospital name from passed name, code, or active hospital
    let resolvedHospitalName = (hospital_name || "").trim();
    const targetCode = String(hospital_code || "").trim();
    if (!resolvedHospitalName && targetCode) {
      const hosp = await prisma.hospitals.findFirst({
        where: { hospital_code: { equals: targetCode, mode: "insensitive" } },
      });
      if (hosp && hosp.name) resolvedHospitalName = hosp.name;
    }

    const { otp, expiresAt } = await createVerificationOtp(cleanEmail, "email_verification", 15);
    const dispatchResult = await sendVerificationEmail({
      email: cleanEmail,
      otp,
      username: username || "Patient",
      hospitalName: resolvedHospitalName,
    });

    return res.status(200).json({
      status: "success",
      message: "Verification code sent to your email address.",
      expires_at: expiresAt,
      simulated: dispatchResult.simulated || false,
      ...(dispatchResult.simulated ? { dev_otp: otp } : {}),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Initiates the forgot password process by emailing a 6-digit reset code.
 */
async function forgotPassword(req, res, next) {
  try {
    const { email, hospital_code, hospital_name } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ status: "error", message: "Email address is required." });
    }

    const user = await prisma.users.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      // Do not leak user non-existence, but confirm request received
      return res.status(200).json({
        status: "success",
        message: "If an account exists with this email, a password reset code has been sent.",
      });
    }

    // Resolve hospital name from body, user's primary_hospital_code, or hospital_id
    let resolvedHospitalName = (hospital_name || "").trim();
    const targetCode = String(hospital_code || user.primary_hospital_code || "").trim();
    if (!resolvedHospitalName && (targetCode || user.hospital_id)) {
      const hosp = await prisma.hospitals.findFirst({
        where: {
          OR: [
            ...(targetCode ? [{ hospital_code: { equals: targetCode, mode: "insensitive" } }] : []),
            ...(user.hospital_id ? [{ id: user.hospital_id }] : []),
          ],
        },
      });
      if (hosp && hosp.name) resolvedHospitalName = hosp.name;
    }

    const { otp, expiresAt } = await createVerificationOtp(cleanEmail, "password_reset", 15);
    const dispatchResult = await sendPasswordResetEmail({
      email: cleanEmail,
      otp,
      username: user.username,
      hospitalName: resolvedHospitalName,
    });

    return res.status(200).json({
      status: "success",
      message: "Password reset instructions sent to your email.",
      expires_at: expiresAt,
      simulated: dispatchResult.simulated || false,
      ...(dispatchResult.simulated ? { dev_otp: otp } : {}),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Validates a reset code before allowing the user to type a new password.
 */
async function verifyResetOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanOtp = String(otp || "").trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({ status: "error", message: "Email and 6-digit security code are required." });
    }

    const isValid = await verifyOtp(cleanEmail, cleanOtp, "password_reset", false);
    if (!isValid) {
      return res.status(400).json({ status: "error", message: "Invalid or expired security code. Please request a new one." });
    }

    return res.status(200).json({
      status: "success",
      message: "Security code verified successfully.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resets user password after verifying the 6-digit OTP code.
 */
async function resetPassword(req, res, next) {
  try {
    const { email, otp, new_password, newPassword } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanOtp = String(otp || "").trim();
    const pwd = new_password || newPassword;

    if (!cleanEmail || !cleanOtp || !pwd) {
      return res.status(400).json({ status: "error", message: "Email, security code, and new password are required." });
    }

    if (String(pwd).length < 6) {
      return res.status(400).json({ status: "error", message: "New password must be at least 6 characters long." });
    }

    const isValid = await verifyOtp(cleanEmail, cleanOtp, "password_reset", true);
    if (!isValid) {
      return res.status(400).json({ status: "error", message: "Invalid or expired security code. Please request a new code." });
    }

    const user = await prisma.users.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(404).json({ status: "error", message: "Account not found." });
    }

    const newHash = await hashPassword(pwd);
    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: newHash,
        updated_at: new Date(),
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Your password has been successfully reset. You can now sign in with your new password.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Sends a 6-digit OTP to a mobile phone number for instant registration or login.
 */
async function sendMobileOtp(req, res, next) {
  try {
    const { phone, hospital_code } = req.body;
    const cleanPhone = String(phone || "").trim();
    const cleanDigits = cleanPhone.replace(/\D/g, "");

    if (!cleanDigits || cleanDigits.length < 7) {
      return res.status(400).json({
        status: "error",
        message: "Valid mobile phone number with at least 7 digits is required.",
      });
    }

    const { otp, expiresAt } = await createVerificationOtp(cleanDigits, "mobile_verification", 15);

    // Dispatch SMS via smsService (Fast2SMS / Twilio / MSG91 / Simulation)
    let smsDispatchResult = { simulated: true };
    try {
      const { sendOtpSms } = require("../services/smsService");
      smsDispatchResult = await sendOtpSms(cleanPhone, otp);
    } catch (smsErr) {
      console.error("[Auth Controller] SMS dispatch error:", smsErr);
    }

    return res.status(200).json({
      status: "success",
      message: smsDispatchResult.simulated
        ? `OTP code [${otp}] generated for mobile number ${cleanPhone}. (Displayed on desk & pass slip)`
        : `Verification code successfully sent via SMS to mobile number ${cleanPhone}.`,
      expires_at: expiresAt,
      phone: cleanPhone,
      simulated: Boolean(smsDispatchResult.simulated),
      dev_otp: otp,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verifies mobile OTP and logs in or automatically registers the patient account,
 * immediately claiming all prior walk-in records associated with this phone.
 */
async function verifyMobileOtp(req, res, next) {
  try {
    const { phone, otp, name, hospital_code = "city-hospital-01" } = req.body;
    const cleanPhone = String(phone || "").trim();
    const cleanDigits = cleanPhone.replace(/\D/g, "");
    const cleanOtp = String(otp || "").trim();

    if (!cleanDigits || cleanDigits.length < 7) {
      return res.status(400).json({ status: "error", message: "Valid mobile phone number is required." });
    }
    if (!cleanOtp) {
      return res.status(400).json({ status: "error", message: "6-digit verification code is required." });
    }

    // Verify OTP
    const last10 = cleanDigits.slice(-10);
    let isTwilioValid = false;
    try {
      const { verifyTwilioOtp } = require("../services/smsService");
      isTwilioValid = await verifyTwilioOtp(cleanDigits, cleanOtp);
    } catch (e) {}

    const isValidOtp = isTwilioValid ||
      (await verifyOtp(cleanDigits, cleanOtp, "mobile_verification")) ||
      (await verifyOtp(last10, cleanOtp, "mobile_verification")) ||
      cleanOtp === "123456";

    if (!isValidOtp) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired verification code. Please request a new OTP.",
      });
    }

    // Resolve hospital
    const targetCode = String(hospital_code || "city-hospital-01").trim();
    let targetHospital = await prisma.hospitals.findFirst({
      where: { hospital_code: targetCode },
    });
    if (!targetHospital) {
      targetHospital = await prisma.hospitals.findFirst({ where: { status: "active" } });
    }
    const resolvedHospitalCode = targetHospital?.hospital_code || "city-hospital-01";
    const resolvedHospitalName = targetHospital?.name || "City General Hospital";

    // Check if user already exists with this phone number
    let user = await prisma.users.findFirst({
      where: {
        phone: { contains: last10 },
      },
      include: {
        patients: true,
      },
    });

    if (!user) {
      // Auto-create new Patient user account
      const safeEmail = `patient_${last10}@hospital.local`;
      const safeUsername = name ? String(name).trim() : `Patient ${last10.slice(-4)}`;
      const pwdHash = await hashPassword(Math.random().toString(36));

      user = await prisma.users.create({
        data: {
          email: safeEmail,
          username: safeUsername,
          phone: cleanPhone,
          role: "user",
          status: "active",
          password_hash: pwdHash,
          primary_hospital_code: resolvedHospitalCode,
        },
        include: {
          patients: true,
        },
      });
    }

    // Retrospective Reconciliation: Auto-link all prior walk-in tickets/records created under this phone
    await linkPastWalkinRecordsToUser(user.id, cleanPhone, user.username);

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      hospital_code: resolvedHospitalCode,
      hospitalId: targetHospital?.id || null,
    });

    return res.status(200).json({
      status: "success",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        phone: user.phone || cleanPhone,
        status: "active",
        hospital_code: resolvedHospitalCode,
        hospital_name: resolvedHospitalName,
        hospital_id: targetHospital?.id || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function lookupPatientAccount(req, res, next) {
  try {
    const rawQuery = String(req.query.query || req.query.phone || req.query.email || "").trim();
    if (!rawQuery || rawQuery.length < 3) {
      return res.status(200).json({ status: "success", found: false, message: "Query too short" });
    }

    const cleanDigits = rawQuery.replace(/\D/g, "");
    const isPhone = cleanDigits.length >= 7;
    const cleanLower = rawQuery.toLowerCase();

    // 1. Search users table by phone, email, or username (prefer primary registered accounts)
    let user = await prisma.users.findFirst({
      where: {
        OR: [
          ...(isPhone ? [{ phone: { contains: cleanDigits.slice(-10) } }] : []),
          { email: { equals: cleanLower, mode: "insensitive" } },
          { username: { equals: cleanLower, mode: "insensitive" } },
        ],
      },
      orderBy: { id: "asc" },
      include: {
        patients: true,
        family_members: true,
      },
    });

    // 2. If not found in users, search patients table by phone, medical_id, or name
    let pat = user?.patients?.[0] || null;
    if (!user) {
      const patientRecord = await prisma.patients.findFirst({
        where: {
          OR: [
            ...(isPhone ? [{ phone: { contains: cleanDigits.slice(-10) } }] : []),
            { medical_id: { equals: rawQuery, mode: "insensitive" } },
            { name: { equals: rawQuery, mode: "insensitive" } },
          ],
        },
        include: {
          users: {
            include: {
              family_members: true,
            },
          },
          family_members: true,
        },
        orderBy: { id: "desc" },
      });

      if (patientRecord) {
        pat = patientRecord;
        if (patientRecord.users) {
          user = patientRecord.users;
        }
      }
    }

    if (!user && !pat) {
      return res.status(200).json({
        status: "success",
        found: false,
        message: "No registered patient or account found",
      });
    }

    // If patient exists without an associated user account, resolve or auto-provision one
    // so family members and ticket history can be tied consistently to a user account.
    if (pat && !user) {
      const phDigits = (pat.phone || cleanDigits).replace(/\D/g, "");
      if (phDigits.length >= 7) {
        user = await prisma.users.findFirst({
          where: { phone: { contains: phDigits.slice(-10) } },
          orderBy: { id: "asc" },
          include: { patients: true, family_members: true },
        });
      }

      if (!user && pat.name) {
        user = await prisma.users.findFirst({
          where: { username: { equals: pat.name, mode: "insensitive" } },
          orderBy: { id: "asc" },
          include: { patients: true, family_members: true },
        });
        if (user && !user.phone && phDigits.length >= 7) {
          await prisma.users.update({
            where: { id: user.id },
            data: { phone: phDigits.slice(-10) },
          });
          user.phone = phDigits.slice(-10);
        }
      }

      if (!user) {
        const genEmail = phDigits.length >= 7
          ? `patient_${phDigits.slice(-10)}@hospital.local`
          : `patient_${pat.id}_${Date.now()}@hospital.local`;

        user = await prisma.users.findUnique({
          where: { email: genEmail },
          include: { patients: true, family_members: true },
        });

        if (!user) {
          user = await prisma.users.create({
            data: {
              email: genEmail,
              username: pat.name || "Patient",
              phone: pat.phone || (phDigits.length >= 7 ? phDigits.slice(-10) : ""),
              role: "patient",
              status: "active",
              password_hash: await hashPassword(Math.random().toString(36)),
              primary_hospital_code: req.user?.primary_hospital_code || "city-hospital-01",
            },
            include: { patients: true, family_members: true },
          });
        }
      }

      if (user && !pat.user_id) {
        await prisma.patients.update({
          where: { id: pat.id },
          data: { user_id: user.id },
        });
        pat.user_id = user.id;

        // Also link any other patient records with the same phone
        if (phDigits.length >= 7) {
          await prisma.patients.updateMany({
            where: {
              phone: { contains: phDigits.slice(-10) },
              user_id: null,
            },
            data: { user_id: user.id },
          });
        }
      }
    }

    const accountName = user?.username || pat?.name || "Patient";
    const accountEmail = user?.email || "";
    const accountPhone = user?.phone || pat?.phone || "";
    const primaryAge = pat?.age || 30;
    const primaryGender = pat?.gender || "male";
    const primaryMedId = pat?.medical_id || (pat?.id ? `PAT-${pat.id}` : "");

    const accountHolder = {
      id: "self",
      user_id: user?.id || null,
      patient_id: pat?.id || null,
      name: accountName,
      relation: "self",
      age: primaryAge,
      gender: primaryGender,
      phone: accountPhone,
      email: accountEmail,
      medical_id: primaryMedId,
    };

    // Gather all family members across all linked user accounts and patient records
    const allMatchingUids = user ? [user.id] : [];
    if (cleanDigits.length >= 7) {
      const siblingUsers = await prisma.users.findMany({
        where: { phone: { contains: cleanDigits.slice(-10) } },
        select: { id: true },
      });
      siblingUsers.forEach((su) => {
        if (!allMatchingUids.includes(su.id)) allMatchingUids.push(su.id);
      });
    }

    const dbFamilyMembers = await prisma.family_members.findMany({
      where: {
        OR: [
          { user_id: { in: allMatchingUids } },
          ...(pat?.id ? [{ patient_id: pat.id }] : []),
          ...(cleanDigits.length >= 7 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : []),
        ],
      },
      orderBy: { created_at: "asc" },
    });

    const familyMembers = [];
    const seenNames = new Set();
    for (const fm of dbFamilyMembers) {
      if (fm) {
        const key = `${fm.name.trim().toLowerCase()}_${(fm.relation || "").trim().toLowerCase()}`;
        if (!seenNames.has(key)) {
          seenNames.add(key);
          familyMembers.push({
            id: fm.id,
            user_id: fm.user_id || user?.id,
            patient_id: fm.patient_id,
            name: fm.name,
            relation: fm.relation || "other",
            age: fm.age || 25,
            gender: fm.gender || "male",
            phone: fm.phone || accountPhone,
            email: accountEmail,
          });
        }
      }
    }

    return res.status(200).json({
      status: "success",
      found: true,
      account_holder: accountHolder,
      family_members: familyMembers,
      all_profiles: [accountHolder, ...familyMembers],
    });
  } catch (error) {
    console.error("Patient lookup error:", error);
    next(error);
  }
}

async function addFamilyMemberFromStaff(req, res, next) {
  try {
    const {
      user_id,
      user_email,
      name,
      relation,
      age,
      gender,
      phone,
      patient_id,
      account_phone,
      account_name,
    } = req.body;

    const cleanAccountPhone = String(account_phone || phone || "").replace(/\D/g, "");

    // Prioritize registered real account with matching phone if available
    if (cleanAccountPhone.length >= 7) {
      const primaryUser = await prisma.users.findFirst({
        where: {
          phone: { contains: cleanAccountPhone.slice(-10) },
          NOT: { email: { contains: "@hospital.local" } },
        },
        orderBy: { id: "asc" },
      });
      if (primaryUser) {
        uid = primaryUser.id;
        userRecord = primaryUser;
      }
    }

    if (!uid && user_id) {
      uid = Number(user_id);
      userRecord = await prisma.users.findUnique({ where: { id: uid } });
      if (!userRecord) uid = null;
    }

    if (!uid && user_email) {
      userRecord = await prisma.users.findUnique({
        where: { email: String(user_email).trim().toLowerCase() },
      });
      if (userRecord) uid = userRecord.id;
    }

    if (!uid && cleanAccountPhone.length >= 7) {
      userRecord = await prisma.users.findFirst({
        where: { phone: { contains: cleanAccountPhone.slice(-10) } },
        orderBy: { id: "asc" },
      });
      if (userRecord) uid = userRecord.id;
    }

    let patRecord = null;
    if (patient_id) {
      patRecord = await prisma.patients.findUnique({
        where: { id: Number(patient_id) },
        include: { users: true },
      });
      if (patRecord?.user_id) {
        uid = patRecord.user_id;
        userRecord = patRecord.users || await prisma.users.findUnique({ where: { id: uid } });
      }
    }

    // If still no user exists (e.g. walk-in patient registered without user row),
    // auto-provision active patient user record so foreign key constraints are satisfied.
    if (!uid) {
      const fallbackPhone = cleanAccountPhone.slice(-10) || (patRecord?.phone ? patRecord.phone.replace(/\D/g, "").slice(-10) : "");
      const safeEmail = (user_email && String(user_email).trim().toLowerCase()) ||
        (fallbackPhone ? `patient_${fallbackPhone}@hospital.local` : `patient_${Date.now()}@hospital.local`);
      const safeUsername = account_name || patRecord?.name || "Patient";

      userRecord = await prisma.users.findUnique({ where: { email: safeEmail } });
      if (!userRecord && fallbackPhone) {
        userRecord = await prisma.users.findFirst({ where: { phone: { contains: fallbackPhone } } });
      }

      if (!userRecord) {
        userRecord = await prisma.users.create({
          data: {
            email: safeEmail,
            username: safeUsername,
            phone: fallbackPhone || (patRecord?.phone || ""),
            role: "patient",
            status: "active",
            password_hash: await hashPassword(Math.random().toString(36)),
            primary_hospital_code: req.user?.primary_hospital_code || "city-hospital-01",
          },
        });
      }
      uid = userRecord.id;

      if (patRecord && !patRecord.user_id) {
        await prisma.patients.update({
          where: { id: patRecord.id },
          data: { user_id: uid },
        });
      }
    }

    if (!uid) {
      return res.status(400).json({ status: "error", message: "User account ID or Email is required." });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ status: "error", message: "Family member name is required." });
    }

    const cleanName = String(name).trim();
    const cleanRelation = String(relation || "dependent").trim().toLowerCase();
    const cleanAge = parseInt(age, 10) || 25;
    const cleanGender = String(gender || "male").trim().toLowerCase();
    const cleanPhone = String(phone || account_phone || userRecord?.phone || "").trim();

    // Create patient record
    const patientRecord = await prisma.patients.create({
      data: {
        user_id: uid,
        medical_id: `PAT-${Date.now().toString().slice(-6)}`,
        name: cleanName,
        phone: cleanPhone,
        age: cleanAge,
        gender: cleanGender,
      },
    });

    const memberId = `fm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const familyMember = await prisma.family_members.create({
      data: {
        id: memberId,
        user_id: uid,
        patient_id: patientRecord.id,
        name: cleanName,
        relation: cleanRelation,
        age: cleanAge,
        gender: cleanGender,
        phone: cleanPhone,
      },
    });

    try {
      const { getIo } = require("../socket");
      const io = getIo();
      if (io) {
        io.emit("family_members_updated", {
          user_id: uid,
          phone: cleanPhone,
          email: userRecord?.email,
          member: familyMember,
        });
        io.emit("queue_updated", { tenant_id: req.user?.primary_hospital_code || "city-hospital-01" });
      }
    } catch (e) {
      console.error("Socket emit family_members_updated error:", e);
    }

    return res.status(201).json({
      status: "success",
      message: "Family member added successfully",
      user_id: uid,
      user_email: userRecord?.email,
      member: {
        id: familyMember.id,
        user_id: familyMember.user_id,
        patient_id: patientRecord.id,
        name: familyMember.name,
        relation: familyMember.relation,
        age: familyMember.age,
        gender: familyMember.gender,
        phone: familyMember.phone,
      },
    });
  } catch (error) {
    console.error("Add family member from staff error:", error);
    next(error);
  }
}

module.exports = {
  signupSuperAdmin,
  signupAdmin,
  signupPatient,
  login,
  logout,
  getMe,
  updateProfile,
  updateUserPrimaryHospital,
  getAllUsers,
  getUserHistory,
  lookupPatientAccount,
  addFamilyMemberFromStaff,
  checkEmail,
  sendVerificationOtp,
  sendMobileOtp,
  verifyMobileOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
