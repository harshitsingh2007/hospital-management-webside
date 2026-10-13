/**
 * family.controller.js
 * --------------------
 * Family Profile & Dependents Controller.
 * Restricts access to role=user/patient and enforces patient identity.
 */

const {
  listFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
} = require("../services/familyService");

async function listFamilyMembersEndpoint(req, res, next) {
  try {
    const userIdentifier =
      req.user?.id ||
      req.user?.email ||
      req.user?.username ||
      req.params.email ||
      req.query.email ||
      req.query.user_id ||
      req.headers["x-user-email"] ||
      req.headers["x-user-phone"] ||
      req.query.phone;

    const userPhone =
      req.query.phone ||
      req.headers["x-user-phone"] ||
      req.user?.phone ||
      (typeof userIdentifier === "string" && userIdentifier.replace(/\D/g, "").length >= 7 ? userIdentifier.replace(/\D/g, "") : "");

    if (!userIdentifier && !userPhone) {
      return res.status(200).json({ status: "success", members: [] });
    }

    const members = await listFamilyMembers(userIdentifier || userPhone, userPhone);
    return res.status(200).json({
      status: "success",
      members,
    });
  } catch (error) {
    next(error);
  }
}

async function createFamilyMemberEndpoint(req, res, next) {
  try {
    const userIdentifier = req.user?.id || req.params.email || req.headers["x-user-email"];
    if (!userIdentifier) {
      return res.status(401).json({ status: "error", message: "Authentication required." });
    }

    const { name, relation, age = 25, gender = "male", phone = "", id = null } = req.body;

    const member = await addFamilyMember({
      userEmailOrId: userIdentifier,
      name,
      relation,
      age,
      gender,
      phone,
      memberId: id,
    });

    return res.status(200).json({
      status: "success",
      member,
    });
  } catch (error) {
    next(error);
  }
}

async function updateFamilyMemberEndpoint(req, res, next) {
  try {
    const userIdentifier = req.user?.id || req.headers["x-user-email"];
    if (!userIdentifier) {
      return res.status(401).json({ status: "error", message: "Authentication required." });
    }

    const memberId = req.params.member_id;
    const { name, relation, age = 25, gender = "male", phone = "" } = req.body;

    const member = await updateFamilyMember({
      userEmailOrId: userIdentifier,
      memberId,
      name,
      relation,
      age,
      gender,
      phone,
    });

    return res.status(200).json({
      status: "success",
      member,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteFamilyMemberEndpoint(req, res, next) {
  try {
    const userIdentifier = req.user?.id || req.params.email || req.headers["x-user-email"];
    if (!userIdentifier) {
      return res.status(401).json({ status: "error", message: "Authentication required." });
    }

    const memberId = req.params.member_id;
    await deleteFamilyMember(userIdentifier, memberId);

    return res.status(200).json({
      status: "success",
      deleted_id: memberId,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listFamilyMembersEndpoint,
  createFamilyMemberEndpoint,
  updateFamilyMemberEndpoint,
  deleteFamilyMemberEndpoint,
};
