/**
 * family.routes.js
 * ----------------
 * Family Profile routes with patient-only authorization.
 */

const express = require("express");
const {
  listFamilyMembersEndpoint,
  createFamilyMemberEndpoint,
  updateFamilyMemberEndpoint,
  deleteFamilyMemberEndpoint,
} = require("../controllers/family.controller");
const { authenticate } = require("../middleware/auth");
const { requirePatientRole } = require("../middleware/role");

const router = express.Router();

// Clean /api/v1/family-members routes (accessible for patient/user role or token)
router.get("/family-members", authenticate, requirePatientRole, listFamilyMembersEndpoint);
router.post("/family-members", authenticate, requirePatientRole, createFamilyMemberEndpoint);
router.put("/family-members/:member_id", authenticate, requirePatientRole, updateFamilyMemberEndpoint);
router.delete("/family-members/:member_id", authenticate, requirePatientRole, deleteFamilyMemberEndpoint);

// Backward compatibility routes
router.get("/users/:email/family-members", authenticate, requirePatientRole, listFamilyMembersEndpoint);
router.post("/users/:email/family-members", authenticate, requirePatientRole, createFamilyMemberEndpoint);
router.delete("/users/:email/family-members/:member_id", authenticate, requirePatientRole, deleteFamilyMemberEndpoint);

module.exports = router;
