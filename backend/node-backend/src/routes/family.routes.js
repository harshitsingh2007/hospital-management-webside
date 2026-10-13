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
const { authenticate, optionalAuth } = require("../middleware/auth");
const { requirePatientRole } = require("../middleware/role");

const router = express.Router();

// Clean /api/v1/family-members routes (accessible for patient/user role or token)
router.get("/family-members", optionalAuth, listFamilyMembersEndpoint);
router.post("/family-members", optionalAuth, createFamilyMemberEndpoint);
router.put("/family-members/:member_id", optionalAuth, updateFamilyMemberEndpoint);
router.delete("/family-members/:member_id", optionalAuth, deleteFamilyMemberEndpoint);

// Backward compatibility routes
router.get("/users/:email/family-members", optionalAuth, listFamilyMembersEndpoint);
router.post("/users/:email/family-members", optionalAuth, createFamilyMemberEndpoint);
router.delete("/users/:email/family-members/:member_id", optionalAuth, deleteFamilyMemberEndpoint);

module.exports = router;
