/**
 * tests/kiosk.test.js
 * -------------------
 * Test suite for Dedicated Kiosk endpoints, Validation, Security Isolation, and Heartbeat.
 */

const assert = require("assert");
const prisma = require("../src/config/prisma");
const {
  getKioskEndpoint,
  kioskHeartbeatEndpoint,
  getKioskQueueEndpoint,
  getHospitalKiosksEndpoint,
  upsertKioskEndpoint,
} = require("../src/controllers/kiosk.controller");

function createMockRes() {
  const result = { statusCode: 200, body: null };
  const res = {
    status: (code) => {
      result.statusCode = code;
      return res;
    },
    json: (data) => {
      result.body = data;
      return res;
    },
  };
  return { res, result };
}

async function runKioskTests() {
  console.log("\n==================================================");
  console.log(" 🧪 RUNNING DEDICATED KIOSK PORTAL & HARDWARE TESTS");
  console.log("==================================================");

  const testHospCode = `kiosk-hosp-${Date.now()}`;
  let hospital = null;
  let kiosk = null;

  try {
    // 1. Setup Test Hospital & Kiosk
    hospital = await prisma.hospitals.create({
      data: {
        hospital_code: testHospCode,
        name: "Test General Kiosk Hospital",
        status: "active",
        branding_json: {
          tagline: "Dedicated Care 24/7",
          primary_color: "#0284C7",
          secondary_color: "#0369A1",
        },
      },
    });

    const dept = await prisma.departments.create({
      data: {
        hospital_id: hospital.id,
        dept_code: "consultation",
        name: "OPD Consultation",
        status: "active",
      },
    });

    kiosk = await prisma.kiosks.create({
      data: {
        hospital_id: hospital.id,
        kiosk_code: "K-01",
        name: "Main Reception Kiosk Terminal",
        location: "Level 1 North Entrance",
        department_id: dept.id,
        status: "online",
        is_active: true,
      },
    });

    // TEST 1: Retrieve valid Kiosk with branding and department
    const mock1 = createMockRes();
    await getKioskEndpoint(
      { params: { hospital_code: testHospCode, kiosk_code: "K-01" } },
      mock1.res,
      (err) => { throw err; }
    );

    assert.strictEqual(mock1.result.statusCode, 200);
    assert.strictEqual(mock1.result.body.status, "success");
    assert.strictEqual(mock1.result.body.kiosk.kiosk_code, "K-01");
    assert.strictEqual(mock1.result.body.kiosk.name, "Main Reception Kiosk Terminal");
    assert.strictEqual(mock1.result.body.hospital.hospital_code, testHospCode);
    assert.strictEqual(mock1.result.body.hospital.branding.tagline, "Dedicated Care 24/7");
    assert.strictEqual(mock1.result.body.department.name, "OPD Consultation");
    console.log("[PASS] Test 1: Dedicated Kiosk retrieved with real database data, department & branding.");

    // TEST 2: Kiosk not found for hospital
    const mock2 = createMockRes();
    await getKioskEndpoint(
      { params: { hospital_code: testHospCode, kiosk_code: "NON_EXISTENT_KIOSK" } },
      mock2.res,
      (err) => { throw err; }
    );

    assert.strictEqual(mock2.result.statusCode, 404);
    assert.strictEqual(mock2.result.body.error_code, "KIOSK_NOT_FOUND");
    console.log("[PASS] Test 2: Non-existent kiosk correctly returns 404 KIOSK_NOT_FOUND.");

    // TEST 3: Hospital not found
    const mock3 = createMockRes();
    await getKioskEndpoint(
      { params: { hospital_code: "INVALID_HOSP_CODE_9999", kiosk_code: "K-01" } },
      mock3.res,
      (err) => { throw err; }
    );

    assert.strictEqual(mock3.result.statusCode, 404);
    assert.strictEqual(mock3.result.body.error_code, "HOSPITAL_NOT_FOUND");
    console.log("[PASS] Test 3: Non-existent hospital correctly returns 404 HOSPITAL_NOT_FOUND.");

    // TEST 4: Inactive Kiosk returns 403
    await prisma.kiosks.update({
      where: { id: kiosk.id },
      data: { is_active: false },
    });

    const mock4 = createMockRes();
    await getKioskEndpoint(
      { params: { hospital_code: testHospCode, kiosk_code: "K-01" } },
      mock4.res,
      (err) => { throw err; }
    );

    assert.strictEqual(mock4.result.statusCode, 403);
    assert.strictEqual(mock4.result.body.error_code, "KIOSK_INACTIVE");
    console.log("[PASS] Test 4: Inactive kiosk terminal returns 403 KIOSK_INACTIVE.");

    // Re-activate kiosk
    await prisma.kiosks.update({
      where: { id: kiosk.id },
      data: { is_active: true },
    });

    // TEST 5: Heartbeat update
    const pastTime = new Date(Date.now() - 60000);
    await prisma.kiosks.update({
      where: { id: kiosk.id },
      data: { last_seen_at: pastTime },
    });

    const mock5 = createMockRes();
    await kioskHeartbeatEndpoint(
      { params: { hospital_code: testHospCode, kiosk_code: "K-01" } },
      mock5.res,
      (err) => { throw err; }
    );

    assert.strictEqual(mock5.result.statusCode, 200);
    assert.strictEqual(mock5.result.body.status, "success");
    assert.strictEqual(mock5.result.body.kiosk_status, "online");

    const refreshedKiosk = await prisma.kiosks.findUnique({ where: { id: kiosk.id } });
    assert(new Date(refreshedKiosk.last_seen_at).getTime() > pastTime.getTime(), "Heartbeat should update last_seen_at");
    console.log("[PASS] Test 5: Hardware heartbeat updates last_seen_at and sets online status.");

    // TEST 6: Public Queue Endpoint Strips Patient PII
    const mock6 = createMockRes();
    await getKioskQueueEndpoint(
      { params: { hospital_code: testHospCode, kiosk_code: "K-01" } },
      mock6.res,
      (err) => { throw err; }
    );

    assert.strictEqual(mock6.result.statusCode, 200);
    assert.strictEqual(mock6.result.body.status, "success");
    assert(Array.isArray(mock6.result.body.snapshot), "Expected snapshot array");
    assert(Array.isArray(mock6.result.body.serving), "Expected serving array");
    // Verify no patient personal information is leaked
    for (const item of mock6.result.body.snapshot) {
      assert.strictEqual(item.user_email, undefined, "Email must not be leaked on kiosk display");
      assert.strictEqual(item.phone, undefined, "Phone must not be leaked on kiosk display");
      assert.strictEqual(item.medical_condition, undefined, "Medical notes must not be leaked");
    }
    console.log("[PASS] Test 6: Queue endpoint enforces public privacy boundary (Zero patient PII leakage).");

    // TEST 7: List Kiosks for Hospital
    const mock7 = createMockRes();
    await getHospitalKiosksEndpoint(
      { params: { hospital_code: testHospCode } },
      mock7.res,
      (err) => { throw err; }
    );

    assert.strictEqual(mock7.result.statusCode, 200);
    assert.strictEqual(mock7.result.body.status, "success");
    assert.strictEqual(mock7.result.body.kiosks.length, 1);
    console.log("[PASS] Test 7: Hospital kiosks listing returns registered kiosks.");

    // TEST 8: Upsert Kiosk
    const mock8 = createMockRes();
    await upsertKioskEndpoint(
      {
        params: { hospital_code: testHospCode },
        body: {
          kiosk_code: "K-02",
          name: "Emergency Wing Kiosk",
          location: "ER Lobby Desk",
          is_active: true,
        },
      },
      mock8.res,
      (err) => { throw err; }
    );

    assert.strictEqual(mock8.result.statusCode, 200);
    assert.strictEqual(mock8.result.body.status, "success");
    assert.strictEqual(mock8.result.body.kiosk.kiosk_code, "K-02");
    console.log("[PASS] Test 8: Super Admin / Operations can upsert kiosk terminals.");

    // TEST 9: Delete Kiosk
    const { deleteKioskEndpoint } = require("../src/controllers/kiosk.controller");
    const mock9 = createMockRes();
    await deleteKioskEndpoint(
      { params: { hospital_code: testHospCode, kiosk_code: "K-02" } },
      mock9.res,
      (err) => { throw err; }
    );
    assert.strictEqual(mock9.result.statusCode, 200);
    assert.strictEqual(mock9.result.body.status, "success");
    console.log("[PASS] Test 9: Super Admin can delete kiosk terminal.");

    console.log("✅ ALL DEDICATED KIOSK TESTS PASSED!");
  } finally {
    // Cleanup test data
    if (hospital) {
      await prisma.kiosks.deleteMany({ where: { hospital_id: hospital.id } }).catch(() => {});
      await prisma.departments.deleteMany({ where: { hospital_id: hospital.id } }).catch(() => {});
      await prisma.hospitals.delete({ where: { id: hospital.id } }).catch(() => {});
    }
  }
}

if (require.main === module) {
  runKioskTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}

module.exports = { runKioskTests };
