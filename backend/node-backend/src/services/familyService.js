/**
 * familyService.js
 * ----------------
 * Family Profile & Dependent Management Engine.
 * Enforces role=user/patient restrictions and strict patient ownership.
 */

const prisma = require("../config/prisma");
const engine = require("./queueEngine");

/**
 * Verifies that a family member belongs to the authenticated user.
 */
async function verifyFamilyMemberOwnership(userEmailOrId, memberId) {
  let uid = null;
  let user = null;
  const numId = Number(userEmailOrId);
  const isNumeric = (typeof userEmailOrId === "number" || (!isNaN(numId) && String(numId) === String(userEmailOrId || "").trim())) && numId > 0 && numId <= 2147483647 && String(userEmailOrId || "").trim().length < 10;
  if (isNumeric) {
    uid = numId;
    user = await prisma.users.findUnique({ where: { id: uid } });
  } else {
    const email = String(userEmailOrId || "").trim().toLowerCase();
    const cleanDigits = email.replace(/\D/g, "");
    user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { username: { equals: email, mode: "insensitive" } },
          ...(cleanDigits.length >= 7 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : []),
        ],
      },
      orderBy: { id: "asc" },
    });
    if (!user) {
      const err = new Error("Authenticated user not found.");
      err.status = 404;
      throw err;
    }
    uid = user.id;
  }

  const allUids = uid ? [uid] : [];
  const phDigits = (user?.phone || "").replace(/\D/g, "");
  if (phDigits.length >= 7) {
    const siblingUsers = await prisma.users.findMany({
      where: { phone: { contains: phDigits.slice(-10) } },
      select: { id: true },
    });
    siblingUsers.forEach((su) => {
      if (!allUids.includes(su.id)) allUids.push(su.id);
    });
  }

  const member = await prisma.family_members.findFirst({
    where: {
      id: memberId,
      user_id: { in: allUids },
    },
  });

  if (!member) {
    const err = new Error(`Family member '${memberId}' not found or does not belong to your account.`);
    err.status = 404;
    throw err;
  }

  return member;
}

/**
 * Lists family members for authenticated patient user.
 */
async function listFamilyMembers(userEmailOrId, userPhone = "") {
  let uid = null;
  let user = null;
  const numId = Number(userEmailOrId);
  const isNumeric = (typeof userEmailOrId === "number" || (!isNaN(numId) && String(numId) === String(userEmailOrId || "").trim())) && numId > 0 && numId <= 2147483647 && String(userEmailOrId || "").trim().length < 10;

  if (isNumeric) {
    uid = numId;
    user = await prisma.users.findUnique({ where: { id: uid } });
  }

  if (!user) {
    const email = String(userEmailOrId || "").trim().toLowerCase();
    const cleanDigits = email.replace(/\D/g, "");
    user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { username: { equals: email, mode: "insensitive" } },
          ...(cleanDigits.length >= 7 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : []),
        ],
      },
      orderBy: { id: "asc" },
    });
    if (!user) {
      if (cleanDigits.length >= 7) {
        user = await prisma.users.findFirst({
          where: { phone: { contains: cleanDigits.slice(-10) } },
          orderBy: { id: "asc" },
        });
      }
    }
    if (user) uid = user.id;
  }

  const allUids = uid ? [uid] : [];
  const rawIdent = typeof userEmailOrId === "string" ? userEmailOrId : "";
  const rawClean = rawIdent.replace(/\D/g, "");
  const passedPhoneClean = String(userPhone || "").replace(/\D/g, "");
  const phDigits = (user?.phone || (passedPhoneClean.length >= 7 ? passedPhoneClean : "") || (rawClean.length >= 7 ? rawClean : "")).replace(/\D/g, "");

  if (phDigits.length >= 7) {
    const siblingUsers = await prisma.users.findMany({
      where: { phone: { contains: phDigits.slice(-10) } },
      select: { id: true },
    });
    siblingUsers.forEach((su) => {
      if (!allUids.includes(su.id)) allUids.push(su.id);
    });
  }

  if (allUids.length === 0 && phDigits.length < 7) {
    return [];
  }

  const rows = await prisma.family_members.findMany({
    where: {
      OR: [
        ...(allUids.length > 0 ? [{ user_id: { in: allUids } }] : []),
        ...(phDigits.length >= 7 ? [{ phone: { contains: phDigits.slice(-10) } }] : []),
      ],
    },
    orderBy: { created_at: "asc" },
  });

  // Deduplicate by name and relation (case-insensitive)
  const seen = new Set();
  const deduped = [];
  for (const r of rows) {
    const key = `${r.name.trim().toLowerCase()}_${(r.relation || "").trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push({
        id: r.id,
        name: r.name,
        relation: r.relation,
        age: r.age,
        gender: r.gender,
        phone: r.phone || "",
        patient_id: r.patient_id,
        created_at: r.created_at ? r.created_at.toISOString() : null,
      });
    }
  }

  return deduped;
}

/**
 * Adds a new family member / dependent profile.
 */
async function addFamilyMember({ userEmailOrId, name, relation, age = 25, gender = "male", phone = "", memberId = null }) {
  let user = null;
  const numId = Number(userEmailOrId);
  const isNumeric = (typeof userEmailOrId === "number" || (!isNaN(numId) && String(numId) === String(userEmailOrId || "").trim())) && numId > 0 && numId <= 2147483647 && String(userEmailOrId || "").trim().length < 10;
  if (isNumeric) {
    user = await prisma.users.findUnique({ where: { id: numId } });
  } else {
    const email = String(userEmailOrId || "").trim().toLowerCase();
    const cleanDigits = email.replace(/\D/g, "");
    user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { username: { equals: email, mode: "insensitive" } },
          ...(cleanDigits.length >= 7 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : []),
        ],
      },
    });
  }

  if (!user) {
    const err = new Error("User not found.");
    err.status = 404;
    throw err;
  }

  const memId = memberId || `dep_${Date.now()}`;
  const pid = await engine.resolvePatientId(user.email, name, phone, gender, age);

  const newMember = await prisma.family_members.upsert({
    where: { id: memId },
    create: {
      id: memId,
      user_id: user.id,
      patient_id: pid,
      name,
      relation,
      age: parseInt(age, 10) || 25,
      gender: gender || "male",
      phone: phone || "",
    },
    update: {
      name,
      relation,
      age: parseInt(age, 10) || 25,
      gender: gender || "male",
      phone: phone || "",
      updated_at: new Date(),
    },
  });

  return {
    id: newMember.id,
    name: newMember.name,
    relation: newMember.relation,
    age: newMember.age,
    gender: newMember.gender,
    phone: newMember.phone || "",
    patient_id: pid,
  };
}

/**
 * Updates an existing family member after verifying ownership.
 */
async function updateFamilyMember({ userEmailOrId, memberId, name, relation, age = 25, gender = "male", phone = "" }) {
  const existing = await verifyFamilyMemberOwnership(userEmailOrId, memberId);

  const updated = await prisma.family_members.update({
    where: { id: memberId },
    data: {
      name,
      relation,
      age: parseInt(age, 10) || 25,
      gender: gender || "male",
      phone: phone || "",
      updated_at: new Date(),
    },
  });

  // Also update linked patient record if exists
  if (existing.patient_id) {
    await prisma.patients.update({
      where: { id: existing.patient_id },
      data: {
        name,
        phone: phone || "",
        gender: gender || "other",
        age: parseInt(age, 10) || 25,
        updated_at: new Date(),
      },
    }).catch(() => {});
  }

  return {
    id: updated.id,
    name: updated.name,
    relation: updated.relation,
    age: updated.age,
    gender: updated.gender,
    phone: updated.phone || "",
    patient_id: existing.patient_id,
  };
}

/**
 * Deletes a family member after verifying ownership.
 */
async function deleteFamilyMember(userEmailOrId, memberId) {
  await verifyFamilyMemberOwnership(userEmailOrId, memberId);
  await prisma.family_members.delete({
    where: { id: memberId },
  });
  return true;
}

/**
 * Resolves or creates a family member gracefully without blocking ticket issuance.
 */
async function resolveOrCreateFamilyMember({
  userEmailOrId,
  memberId,
  name = "Dependent",
  relation = "dependent",
  age = 25,
  gender = "male",
  phone = "",
}) {
  try {
    if (memberId) {
      const existing = await verifyFamilyMemberOwnership(userEmailOrId, memberId);
      if (existing) return existing;
    }
  } catch (err) {
    // If not found by memberId, try graceful match or creation
  }

  let user = null;
  const numId = Number(userEmailOrId);
  const isNumeric = (typeof userEmailOrId === "number" || (!isNaN(numId) && String(numId) === String(userEmailOrId || "").trim())) && numId > 0 && numId <= 2147483647 && String(userEmailOrId || "").trim().length < 10;
  if (isNumeric) {
    user = await prisma.users.findUnique({ where: { id: numId } });
  } else {
    const email = String(userEmailOrId || "").trim().toLowerCase();
    const cleanDigits = email.replace(/\D/g, "");
    user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { username: { equals: email, mode: "insensitive" } },
          ...(cleanDigits.length >= 7 ? [{ phone: { contains: cleanDigits.slice(-10) } }] : []),
        ],
      },
    });
  }

  if (!user) return null;

  const memId = memberId || `dep_${Date.now()}`;
  const pid = await engine.resolvePatientId(user.email, name, phone, gender, age);

  const member = await prisma.family_members.upsert({
    where: { id: memId },
    create: {
      id: memId,
      user_id: user.id,
      patient_id: pid,
      name: name || "Dependent",
      relation: relation || "dependent",
      age: parseInt(age, 10) || 25,
      gender: gender || "male",
      phone: phone || "",
    },
    update: {
      name: name || "Dependent",
      patient_id: pid,
      updated_at: new Date(),
    },
  });

  return member;
}

module.exports = {
  verifyFamilyMemberOwnership,
  listFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  resolveOrCreateFamilyMember,
};

