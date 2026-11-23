/**
 * tests/run_all_tests.js
 * ----------------------
 * Master Test Suite Runner for Node.js Backend Migration.
 */

const { runAuthIsolationTests } = require("./auth_isolation.test");
const { runFamilyProfileTests } = require("./family_profiles.test");
const { runQueueLifecycleTests } = require("./queue_lifecycle.test");
const { runCancellationAdjustmentTests } = require("./cancellation_adjustment.test");
const { runDailyClosureTests } = require("./daily_closure.test");
const { runAppointmentTests } = require("./appointments.test");
const { runSocketTests } = require("./socket.test");
const { runDoctorAvailabilityTests } = require("./doctor_availability.test");
const { runDoctorDutyStatusTests } = require("./doctor_duty_status.test");
const { runKioskTests } = require("./kiosk.test");
const { runContinuousLearningTests } = require("./continuous_learning.test");
const prisma = require("../src/config/prisma");
const engine = require("../src/services/queueEngine");

async function runMasterTestSuite() {
  process.env.NODE_ENV = "test";
  console.log("================================================================================");
  console.log(" 🚀 STARTING FULL END-TO-END BACKEND TEST SUITE (NODE.JS + PRISMA + POSTGRESQL)");
  console.log("================================================================================");

  const startTime = Date.now();

  try {
    await prisma.$connect();
    await engine.hydrateFromDb();

    await runAuthIsolationTests();
    await runFamilyProfileTests();
    await runQueueLifecycleTests();
    await runCancellationAdjustmentTests();
    await runDailyClosureTests();
    await runAppointmentTests();
    await runDoctorAvailabilityTests();
    await runDoctorDutyStatusTests();
    await runSocketTests();
    await runKioskTests();
    await runContinuousLearningTests();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("================================================================================");
    console.log(` 🎉 ALL 11 TEST SUITES COMPLETED SUCCESSFULLY IN ${elapsed}s!`);
    console.log(" 💯 100% OF MIGRATION CONTRACTS & BUSINESS LOGIC VERIFIED AGAINST POSTGRESQL.");
    console.log("================================================================================");
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED WITH ERROR:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runMasterTestSuite();
}
