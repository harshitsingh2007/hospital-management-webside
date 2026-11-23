/**
 * tests/queue_lifecycle.test.js
 * ------------------------------
 * Tests Priority Queue Min-Heap, Position Calculation, Serving, Completing, and Department Scoping.
 */

const assert = require("assert");
const prisma = require("../src/config/prisma");
const engine = require("../src/services/queueEngine");
const {
  joinQueue,
  serveNext,
  completeTicket,
  transferTicket,
} = require("../src/services/ticketService");
const { PRIORITY_EMERGENCY, PRIORITY_ROUTINE } = require("../src/utils/clinicalComplexity");

async function runQueueLifecycleTests() {
  console.log("\n==================================================");
  console.log(" 🧪 RUNNING QUEUE LIFECYCLE & PRIORITY HEAP TESTS");
  console.log("==================================================");

  const testTenant = `test-hospital-${Date.now() % 10000}`;

  // 1. Join Routine Patient #1
  const t1 = await joinQueue({
    tenantId: testTenant,
    consumerType: "hospital",
    serviceCategory: "consultation",
    name: "Patient Normal 1",
    priorityLevel: PRIORITY_ROUTINE,
    medicalCondition: "routine_followup",
  });
  assert.strictEqual(t1.position, 1, "First patient should be in position #1");
  console.log(`[PASS] Test 1: Routine Patient #1 enqueued at position #${t1.position}.`);

  // 2. Join Routine Patient #2
  const t2 = await joinQueue({
    tenantId: testTenant,
    consumerType: "hospital",
    serviceCategory: "consultation",
    name: "Patient Normal 2",
    priorityLevel: PRIORITY_ROUTINE,
    medicalCondition: "routine_followup",
  });
  assert.strictEqual(t2.position, 2, "Second patient should be in position #2");
  console.log(`[PASS] Test 2: Routine Patient #2 enqueued at position #${t2.position}.`);

  // 3. Join Emergency Patient #3 -> Must jump ahead of Routine #2 due to Priority 1 vs 2
  const t3 = await joinQueue({
    tenantId: testTenant,
    consumerType: "hospital",
    serviceCategory: "consultation",
    name: "Emergency Patient 3",
    priorityLevel: PRIORITY_EMERGENCY,
    medicalCondition: "cardiac_chest_pain",
  });

  const snapshot = await engine.getQueueSnapshot(testTenant, "consultation");
  assert.strictEqual(snapshot[0].ticket_id, t3.ticket_id, "Emergency patient must be first in queue line");
  console.log("[PASS] Test 3: Emergency patient prioritized ahead of routine tickets in Min-Heap.");

  // 4. Serve Next -> Must serve Emergency Patient #3 first
  const served = await serveNext(testTenant, "consultation");
  assert.strictEqual(served.ticket_id, t3.ticket_id, "Served ticket must be the emergency ticket");
  assert.strictEqual(served.status, "serving", "Status must be 'serving'");
  console.log(`[PASS] Test 4: Highest priority ticket #${served.ticket_id} served successfully.`);

  // 5. Complete Ticket -> Creates service_logs record
  served.serve_start_time = (Date.now() / 1000.0) - (15 * 60); // Simulated 15-minute consultation
  const completed = await completeTicket(testTenant, served.ticket_id);
  assert.strictEqual(completed.status, "completed", "Status must be 'completed'");
  assert(completed.actual_service_minutes !== null, "Actual service minutes must be recorded");

  const hid = await engine.resolveHospitalId(testTenant);
  const log = await prisma.service_logs.findFirst({
    where: { ticket_id: served.ticket_id, hospital_id: hid },
  });
  assert(log, "Service log was not persisted to PostgreSQL");
  console.log(`[PASS] Test 5: Ticket #${served.ticket_id} completed and logged to service_logs for ML training.`);

  // 6. Transfer Ticket to Pharmacy
  const served2 = await serveNext(testTenant, "consultation");
  const { originalTicket, newTicket } = await transferTicket(
    testTenant,
    served2.ticket_id,
    "pharmacy",
    "Prescribed Paracetamol 500mg"
  );
  assert.strictEqual(originalTicket.status, "transferred", "Original ticket status must be 'transferred'");
  assert.strictEqual(newTicket.service_category, "pharmacy", "New ticket category must be 'pharmacy'");
  assert.strictEqual(newTicket.parent_ticket_id, served2.ticket_id, "Parent ticket ID link mismatch");
  console.log(`[PASS] Test 6: Ticket #${served2.ticket_id} transferred to Pharmacy as #${newTicket.ticket_id}.`);

  // 7. Doctor Concurrency Guard: A doctor can ONLY serve 1 patient at a time
  const docA = { id: "doc_101", name: "Dr. Sharma", email: "dr.sharma@hospital.org" };
  const dPatient1 = await joinQueue({
    tenantId: testTenant,
    consumerType: "hospital",
    serviceCategory: "consultation",
    name: "Doctor Test Patient 1",
  });
  const dPatient2 = await joinQueue({
    tenantId: testTenant,
    consumerType: "hospital",
    serviceCategory: "consultation",
    name: "Doctor Test Patient 2",
  });

  const docServed1 = await serveNext(testTenant, "consultation", null, docA);
  assert(docServed1, "First ticket served to Doctor A");
  assert.strictEqual(docServed1.served_by_doctor_id, "doc_101", "Doctor ID assigned to ticket");

  // Attempting to serve a 2nd patient while docA is already serving must throw DOCTOR_ALREADY_SERVING
  let docErrorCaught = false;
  try {
    await serveNext(testTenant, "consultation", null, docA);
  } catch (err) {
    docErrorCaught = true;
    assert.strictEqual(err.code, "DOCTOR_ALREADY_SERVING", "Error code must be DOCTOR_ALREADY_SERVING");
  }
  assert.strictEqual(docErrorCaught, true, "Doctor cannot serve a second patient while already serving one");
  console.log("[PASS] Test 7a: Doctor cannot serve a second patient while already serving one.");

  // Complete consultation for patient 1 -> Doctor A is now free to serve patient 2
  await completeTicket(testTenant, docServed1.ticket_id);
  const docServed2 = await serveNext(testTenant, "consultation", null, docA);
  assert(docServed2, "Doctor A can serve next patient after completing previous consultation");
  assert.strictEqual(docServed2.served_by_doctor_id, "doc_101", "Doctor ID assigned to next ticket");
  await completeTicket(testTenant, docServed2.ticket_id);
  console.log("[PASS] Test 7b: Doctor can serve next patient after completing previous consultation.");

  console.log("✅ ALL QUEUE LIFECYCLE TESTS PASSED!\n");
}

module.exports = { runQueueLifecycleTests };

if (require.main === module) {
  runQueueLifecycleTests().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
