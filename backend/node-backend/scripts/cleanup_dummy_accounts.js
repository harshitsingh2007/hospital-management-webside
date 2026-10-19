/**
 * scripts/cleanup_dummy_accounts.js
 * ---------------------------------
 * Deletes the 102 automated test accounts and 77 test hospitals generated
 * during testing, preserving all real users, demo doctors, real hospitals,
 * and the 3 patient phone accounts.
 */

const path = require("path");
require("../loadEnv");
const prisma = require("../src/config/prisma");

// Explicit list of all accounts to keep
const PRESERVED_USER_IDS = [
  23,  // superadmin@hospital.com
  30,  // superadmin33@hospital.com
  63,  // superadmin22@hospital.com
  204, // rajaharsih@gmail.com
  206, // raja@gmail.com
  906, // rahul@gmail.com
  955, // aarav.sharma@demohealth.com
  956, // priya.mehta@demohealth.com
  957, // rahul.verma@demohealth.com
  958, // ananya.kapoor@demohealth.com
  959, // vikram.singh@demohealth.com
  960, // neha.gupta@demohealth.com
  961, // rohan.malhotra@demohealth.com
  962, // ishita.rao@demohealth.com
  963, // karan.bhatia@demohealth.com
  964, // simran.kaur@demohealth.com
  990, // staff@gmail.com
  991, // harshit971897@gmail.com
  992, // patient_8750164205@hospital.local
  993, // patient_8697845434@hospital.local
  994, // patient_1111111111@hospital.local
  997, // harshit2313.2007@gmail.com
];

// Explicit list of real hospital IDs to keep
const PRESERVED_HOSPITAL_IDS = [
  2,   // 110040 - Raja HarishChandra
  16,  // max-hospital-949 - max hospital
  85,  // hosp-1788628440 - Raja harish chandra
  143, // city-hospital-01 - City Hospital 01
];

async function runCleanup() {
  console.log("==================================================");
  console.log("🧹 COMMENCING DATABASE DUMMY DATA CLEANUP");
  console.log("==================================================");

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. Identify dummy users
      const dummyUsers = await tx.users.findMany({
        where: { id: { notIn: PRESERVED_USER_IDS } },
        select: { id: true, email: true, username: true },
      });
      const dummyUserIds = dummyUsers.map((u) => u.id);
      const dummyEmails = dummyUsers.map((u) => u.email);

      console.log(`[1] Identified ${dummyUserIds.length} dummy user accounts.`);

      // 2. Identify test hospitals
      const testHospitals = await tx.hospitals.findMany({
        where: { id: { notIn: PRESERVED_HOSPITAL_IDS } },
        select: { id: true, hospital_code: true, name: true },
      });
      const testHospIds = testHospitals.map((h) => h.id);

      console.log(`[2] Identified ${testHospIds.length} test hospitals.`);

      // 3. Remove audit logs referencing dummy users
      const delAudit = await tx.audit_logs.deleteMany({
        where: { user_id: { in: dummyUserIds } },
      });
      console.log(`[3] Removed ${delAudit.count} test audit logs.`);

      // 4. Remove queue events referencing test hospitals
      const delQEvents = await tx.queue_events.deleteMany({
        where: { hospital_id: { in: testHospIds } },
      });
      console.log(`[4] Removed ${delQEvents.count} test queue events.`);

      // 5. Remove tickets referencing test hospitals
      const delTickets = await tx.tickets.deleteMany({
        where: { hospital_id: { in: testHospIds } },
      });
      console.log(`[5] Removed ${delTickets.count} test tickets.`);

      // 6. Remove appointment history referencing dummy users
      const delHistory = await tx.appointment_status_history.deleteMany({
        where: { changed_by_user_id: { in: dummyUserIds } },
      });
      console.log(`[6] Removed ${delHistory.count} test appointment history entries.`);

      // 7. Remove appointments referencing test hospitals
      const delAppointments = await tx.appointments.deleteMany({
        where: { hospital_id: { in: testHospIds } },
      });
      console.log(`[7] Removed ${delAppointments.count} test appointments.`);

      // 8. Remove employees referencing dummy users or test hospitals
      const delEmployees = await tx.employees.deleteMany({
        where: {
          OR: [
            { user_id: { in: dummyUserIds } },
            { hospital_id: { in: testHospIds } },
          ],
        },
      });
      console.log(`[8] Removed ${delEmployees.count} test employee records.`);

      // 9. Remove family members referencing dummy users
      const delFamily = await tx.family_members.deleteMany({
        where: { user_id: { in: dummyUserIds } },
      });
      console.log(`[9] Removed ${delFamily.count} test family member records.`);

      // 10. Remove patients referencing dummy users
      const delPatients = await tx.patients.deleteMany({
        where: { user_id: { in: dummyUserIds } },
      });
      console.log(`[10] Removed ${delPatients.count} test patient profiles.`);

      // 11. Remove test departments
      const delDept = await tx.departments.deleteMany({
        where: { hospital_id: { in: testHospIds } },
      });
      console.log(`[11] Removed ${delDept.count} test department records.`);

      // 12. Remove test desks and kiosks
      const delDesks = await tx.desks.deleteMany({
        where: { hospital_id: { in: testHospIds } },
      });
      console.log(`[12a] Removed ${delDesks.count} test desks.`);

      const delKiosks = await tx.kiosks.deleteMany({
        where: { hospital_id: { in: testHospIds } },
      });
      console.log(`[12b] Removed ${delKiosks.count} test kiosks.`);

      // 13. Remove test hospitals
      const delHosp = await tx.hospitals.deleteMany({
        where: { id: { in: testHospIds } },
      });
      console.log(`[13] Removed ${delHosp.count} test hospitals.`);

      // 14. Remove verification tokens for test emails
      const delTokens = await tx.verification_tokens.deleteMany({
        where: { email: { in: dummyEmails } },
      });
      console.log(`[14] Removed ${delTokens.count} verification tokens.`);

      // 15. Finally, delete the dummy users
      const delUsers = await tx.users.deleteMany({
        where: { id: { in: dummyUserIds } },
      });
      console.log(`[15] Successfully deleted ${delUsers.count} dummy user accounts!`);

      return {
        deletedUsersCount: delUsers.count,
        deletedHospitalsCount: delHosp.count,
      };
    },
    {
      timeout: 30000,
    }
  );

  console.log("==================================================");
  console.log("✅ CLEANUP SUCCESSFULLY COMMITTED TO DATABASE");
  console.log(`Summary: ${result.deletedUsersCount} dummy accounts & ${result.deletedHospitalsCount} test hospitals deleted.`);
  console.log("==================================================");
}

runCleanup()
  .then(async () => {
    // Print current users remaining in the database
    const remainingUsers = await prisma.users.findMany({
      orderBy: { id: "asc" },
      select: { id: true, email: true, username: true, role: true },
    });
    console.log("\n📋 REMAINING ACCOUNTS IN DATABASE:");
    remainingUsers.forEach((u) => {
      console.log(`  - [ID ${u.id}] ${u.email} (${u.username}, ${u.role})`);
    });

    const remainingHospitals = await prisma.hospitals.findMany({
      orderBy: { id: "asc" },
      select: { id: true, hospital_code: true, name: true },
    });
    console.log("\n🏥 REMAINING HOSPITALS IN DATABASE:");
    remainingHospitals.forEach((h) => {
      console.log(`  - [ID ${h.id}] ${h.hospital_code} (${h.name})`);
    });

    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ Cleanup failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
