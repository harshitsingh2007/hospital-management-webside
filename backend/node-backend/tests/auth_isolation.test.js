/**
 * tests/auth_isolation.test.js
 * ----------------------------
 * Tests Authentication, JWT issuance, Dual Login, Legacy SHA-256, and Multi-Hospital Isolation.
 */

const assert = require("assert");
const prisma = require("../src/config/prisma");
const { hashSha256 } = require("../src/utils/password");
const { generateToken, verifyToken } = require("../src/utils/jwt");
const {
  signupSuperAdmin,
  signupAdmin,
  signupPatient,
  login,
  getMe,
} = require("../src/controllers/auth.controller");
const { verifyHospitalAccess } = require("../src/middleware/hospitalIsolation");
const { addHospitalEmployee, approveHospitalRequest } = require("../src/services/hospitalService");

async function runAuthIsolationTests() {
  console.log("\n==================================================");
  console.log(" 🧪 RUNNING AUTHENTICATION & TENANT ISOLATION TESTS");
  console.log("==================================================");

  const ts = Date.now();

  // Test 1: Super Admin Registration & Dedicated Hospital Provisioning
  const saEmail = `owner_node_${ts}@hospital.com`;
  const hCode1 = `apex-care-${ts}-${Math.floor(Math.random() * 100000)}`;
  let resData = null;
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        resData = { statusCode: code, ...data };
      },
    }),
  };

  await signupSuperAdmin(
    {
      body: {
        email: saEmail,
        username: "Dr. Node Owner",
        password: "SuperPassword123!",
        phone: "+1 555-111-2222",
        hospital_name: "Apex Care Center",
        hospital_code: hCode1,
      },
    },
    mockRes,
    (err) => {
      if (err) throw err;
    }
  );

  assert.strictEqual(resData.statusCode, 201, "SuperAdmin signup should return 201 created");
  assert.strictEqual(resData.request.status, "PENDING", "Hospital request should be PENDING");

  // Verify that pending user cannot log in before approval
  let preLoginData = null;
  const mockPreLoginRes = {
    status: (code) => ({
      json: (data) => {
        preLoginData = { statusCode: code, ...data };
      },
    }),
  };
  await login(
    { body: { email: saEmail, password: "SuperPassword123!" } },
    mockPreLoginRes,
    (err) => { if (err) throw err; }
  );
  assert.strictEqual(preLoginData.statusCode, 403, "Pending owner should be blocked from logging in with 403");

  // Platform SuperAdmin approves the hospital request
  const platformAdmin = { email: "platform@superadmin.com", role: "superadmin" };
  const approved = await approveHospitalRequest(resData.request.id, platformAdmin);
  assert.strictEqual(approved.hospital.hospital_code, hCode1, "Approved hospital code mismatch");
  assert.strictEqual(approved.request.status, "APPROVED", "Request status should be APPROVED after approval");

  // Login as approved owner
  let postLoginData = null;
  const mockPostLoginRes = {
    status: (code) => ({
      json: (data) => {
        postLoginData = { statusCode: code, ...data };
      },
    }),
  };
  await login(
    { body: { email: saEmail, password: "SuperPassword123!" } },
    mockPostLoginRes,
    (err) => { if (err) throw err; }
  );
  assert.strictEqual(postLoginData.statusCode, 200, "Approved owner should successfully log in with 200");
  assert(postLoginData.token, "Missing JWT token in login response");
  console.log(`[PASS] Test 1: Hospital registration requested (201), approved by platform admin, and activated with valid JWT.`);

  // Test 2: Provision Employee with Employee ID
  const docEmail = `priya.node_${ts}@apexcare.com`;
  const docEmpId = `DOC-${ts % 10000}`;
  const docEmp = await addHospitalEmployee({
    hospitalCode: hCode1,
    name: "Dr. Priya Node",
    email: docEmail,
    role: "doctor",
    department: "consultation",
    employeeId: docEmpId,
    phone: "+1 555-333-4444",
    password: "DoctorPass123!",
  });

  assert.strictEqual(docEmp.employee_id, docEmpId, "Employee ID mismatch");
  console.log(`[PASS] Test 2: Doctor created under Super Admin hospital with ID '${docEmpId}'.`);

  // Test 3: Dual Login with Email OR Assigned Employee ID
  let loginRes1 = null;
  await login(
    { body: { email: docEmail, password: "DoctorPass123!" } },
    {
      status: (code) => ({
        json: (data) => {
          loginRes1 = { statusCode: code, ...data };
        },
      }),
    },
    (err) => {
      if (err) throw err;
    }
  );
  assert.strictEqual(loginRes1.statusCode, 200, "Login by email failed");
  assert.strictEqual(loginRes1.user.email, docEmail, "User email mismatch");
  assert.strictEqual(loginRes1.user.employee_id, docEmpId, "User employee_id mismatch");

  let loginRes2 = null;
  await login(
    { body: { email: docEmpId, password: "DoctorPass123!" } },
    {
      status: (code) => ({
        json: (data) => {
          loginRes2 = { statusCode: code, ...data };
        },
      }),
    },
    (err) => {
      if (err) throw err;
    }
  );
  assert.strictEqual(loginRes2.statusCode, 200, "Login by employee ID failed");
  assert.strictEqual(loginRes2.user.email, docEmail, "User email mismatch on employee ID login");
  console.log("[PASS] Test 3: Dual Login verified (Email AND Assigned ID authenticate successfully).");

  // Test 4: Legacy SHA-256 Password Hash Verification
  const legacyEmail = `legacy_${ts}@hospital.com`;
  const legacyPass = "LegacyPassword123!";
  const legacySha = hashSha256(legacyPass);

  const legacyUser = await prisma.users.create({
    data: {
      email: legacyEmail,
      username: "Legacy User",
      password_hash: legacySha,
      role: "user",
      status: "active",
    },
  });

  let legacyLoginRes = null;
  await login(
    { body: { email: legacyEmail, password: legacyPass } },
    {
      status: (code) => ({
        json: (data) => {
          legacyLoginRes = { statusCode: code, ...data };
        },
      }),
    },
    (err) => {
      if (err) throw err;
    }
  );
  assert.strictEqual(legacyLoginRes.statusCode, 200, "Legacy SHA-256 login failed");
  assert.strictEqual(legacyLoginRes.user.email, legacyEmail, "Legacy user email mismatch");
  console.log("[PASS] Test 4: Legacy SHA-256 password hash validated successfully.");

  // Test 5: Tenant Isolation & Forbidden Check across SuperAdmins
  const saEmail2 = `owner_node_2_${ts}@hospital.com`;
  const hCode2 = `metro-health-${ts % 1000}`;
  let saRes2 = null;
  await signupSuperAdmin(
    {
      body: {
        email: saEmail2,
        username: "Dr. Node Owner Two",
        password: "SuperPassword456!",
        hospital_name: "Metro Health",
        hospital_code: hCode2,
      },
    },
    {
      status: (code) => ({
        json: (data) => {
          saRes2 = { statusCode: code, ...data };
        },
      }),
    },
    (err) => {
      if (err) throw err;
    }
  );

  if (saRes2?.request?.id) {
    await approveHospitalRequest(saRes2.request.id, platformAdmin);
  }

  const owner1 = await prisma.users.findUnique({ where: { email: saEmail } });
  const owner2 = await prisma.users.findUnique({ where: { email: saEmail2 } });

  const access1to1 = await verifyHospitalAccess(hCode1, owner1);
  const access1to2 = await verifyHospitalAccess(hCode2, owner1);
  const access2to1 = await verifyHospitalAccess(hCode1, owner2);
  const access2to2 = await verifyHospitalAccess(hCode2, owner2);

  assert.strictEqual(access1to1, true, "Owner 1 should access Hospital 1");
  assert.strictEqual(access1to2, false, "Owner 1 MUST NOT access Hospital 2");
  assert.strictEqual(access2to1, false, "Owner 2 MUST NOT access Hospital 1");
  assert.strictEqual(access2to2, true, "Owner 2 should access Hospital 2");
  console.log("[PASS] Test 5: Multi-Hospital Isolation verified (Zero cross-tenant authorization leakage).");

  // Test 6: Patient Registration
  const patientEmail = `patient_node_${ts}@gmail.com`;
  let patientRes = null;
  await signupPatient(
    {
      body: {
        email: patientEmail,
        username: "John Node Patient",
        password: "PatientPass123!",
      },
    },
    {
      status: (code) => ({
        json: (data) => {
          patientRes = { statusCode: code, ...data };
        },
      }),
    },
    (err) => {
      if (err) throw err;
    }
  );
  assert.strictEqual(patientRes.statusCode, 200, "Patient signup failed");
  assert.strictEqual(patientRes.user.role, "user", "Role must be 'user'");
  console.log("[PASS] Test 6: Patient registration verified with role 'user'.");

  console.log("✅ ALL AUTHENTICATION & TENANT ISOLATION TESTS PASSED!\n");
}

module.exports = { runAuthIsolationTests };

if (require.main === module) {
  runAuthIsolationTests().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
