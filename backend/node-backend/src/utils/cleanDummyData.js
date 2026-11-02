/**
 * src/utils/cleanDummyData.js
 * ----------------------------
 * Safely purges dummy / test data created during automated testing and test suites,
 * while strictly preserving all genuine hospitals, user accounts, and patient profiles.
 */

const prisma = require("../config/prisma");

async function cleanDummyData() {
  console.log("\n=======================================================");
  console.log("🧹 STARTING DATABASE DUMMY DATA PURGE");
  console.log("=======================================================\n");

  const results = await prisma.$transaction(
    async (tx) => {
      // 1. Identify real hospital IDs to preserve
      const realHospitals = await tx.hospitals.findMany({
        where: {
          hospital_code: {
            in: ["110040", "max-hospital-949", "hosp-1788628440", "city-hospital-01"],
          },
        },
        select: { id: true, hospital_code: true, name: true },
      });
      const realHospIds = realHospitals.map((h) => h.id);
      console.log(`[Preserved] ${realHospitals.length} Real Hospitals:`);
      realHospitals.forEach((h) => console.log(`   • ${h.name} (${h.hospital_code}) [ID: ${h.id}]`));

      const testHospitals = await tx.hospitals.findMany({
        where: { id: { notIn: realHospIds } },
        select: { id: true, hospital_code: true },
      });
      const testHospIds = testHospitals.map((h) => h.id);
      console.log(`\n[Target] Found ${testHospIds.length} Test Hospitals to purge.`);

      // 2. Identify real user accounts to preserve
      const realEmails = [
        "harish123@gmail.com",
        "user@gmail.com",
        "user@gmial.com",
        "pharma@gmail.com",
        "superadmin2@hospital.com",
        "aman@gmail.com",
        "superadmin33@hospital.com",
        "admin@gmial.com",
        "superadmin22@hospital.com",
        "harshit2006@gmaill.com",
        "harsh22@gmail.com",
        "rajaharsih@gmail.com",
        "raj@gmail.com",
        "raja@gmail.com",
        "rahul@gmail.com",
        "hariom@gmail.com",
      ];
      const realUsers = await tx.users.findMany({
        where: {
          OR: [
            { email: { in: realEmails } },
            { role: { in: ["superadmin", "super_admin"] } },
            { is_superadmin: true },
          ],
        },
        select: { id: true, email: true, username: true },
      });
      const realUserIds = realUsers.map((u) => u.id);
      console.log(`\n[Preserved] ${realUsers.length} Genuine User Accounts.`);

      const testUsers = await tx.users.findMany({
        where: { id: { notIn: realUserIds } },
        select: { id: true, email: true },
      });
      const testUserIds = testUsers.map((u) => u.id);
      console.log(`[Target] Found ${testUserIds.length} Test Users to purge.`);

      // 3. Identify real patients to preserve
      const realPatients = await tx.patients.findMany({
        where: {
          OR: [
            { user_id: { in: realUserIds } },
            { phone: { in: ["8595024295", "8750164205"] } },
          ],
        },
        select: { id: true, name: true, phone: true, user_id: true },
      });
      const realPatientIds = realPatients.map((p => p.id));
      console.log(`\n[Preserved] ${realPatients.length} Genuine Patient Profiles.`);

      const testPatients = await tx.patients.findMany({
        where: { id: { notIn: realPatientIds } },
        select: { id: true },
      });
      const testPatientIds = testPatients.map((p) => p.id);
      console.log(`[Target] Found ${testPatientIds.length} Test Patient profiles to purge.`);

      // 4. Delete dummy tickets in real hospitals
      const dummyTicketNames = [
        "Test Patient",
        "Cancel Test Patient",
        "Future Patient",
        "Walkin Patient",
        "Emergency Cardiac Patient",
        "Cross Hosp Patient",
      ];
      const dummyTickets = await tx.tickets.findMany({
        where: {
          hospital_id: { in: realHospIds },
          name: { in: dummyTicketNames },
        },
        select: { ticket_id: true },
      });
      const dummyTicketIds = dummyTickets.map((t) => t.ticket_id);
      let delDummyTicketsCount = 0;
      if (dummyTicketIds.length > 0) {
        await tx.queue_events.deleteMany({
          where: { ticket_id: { in: dummyTicketIds } },
        });
        const resTickets = await tx.tickets.deleteMany({
          where: { ticket_id: { in: dummyTicketIds } },
        });
        delDummyTicketsCount = resTickets.count;
      }
      console.log(`[Cleaned] Purged ${delDummyTicketsCount} dummy tickets in real hospitals.`);

      // 5. Delete dummy appointments in real hospitals
      const delDummyAppts = await tx.appointments.deleteMany({
        where: {
          hospital_id: { in: realHospIds },
          patient_id: { in: testPatientIds },
        },
      });
      console.log(`[Cleaned] Purged ${delDummyAppts.count} dummy appointments in real hospitals.`);

      // 6. Clean audit_logs referencing test hospitals or test users
      const delAuditLogs = await tx.audit_logs.deleteMany({
        where: {
          OR: [
            { hospital_id: { in: testHospIds } },
            { user_id: { in: testUserIds } },
          ],
        },
      });
      console.log(`[Cleaned] Purged ${delAuditLogs.count} test audit logs.`);

      // 7. Nullify references to test users in queue_events and appointment_status_history
      await tx.queue_events.updateMany({
        where: { performed_by_user_id: { in: testUserIds } },
        data: { performed_by_user_id: null },
      });
      await tx.appointment_status_history.updateMany({
        where: { changed_by_user_id: { in: testUserIds } },
        data: { changed_by_user_id: null },
      });

      // 8. Delete test patients' remaining tickets, appointments, family_members, then patients
      await tx.tickets.deleteMany({
        where: { patient_id: { in: testPatientIds } },
      });
      await tx.appointments.deleteMany({
        where: { patient_id: { in: testPatientIds } },
      });
      await tx.family_members.deleteMany({
        where: { patient_id: { in: testPatientIds } },
      });
      const delPatients = await tx.patients.deleteMany({
        where: { id: { in: testPatientIds } },
      });
      console.log(`[Cleaned] Purged ${delPatients.count} dummy patient records.`);

      // 9. Delete test hospitals (Cascades departments, desks, employees, kiosks, queue_events, etc.)
      const delHosps = await tx.hospitals.deleteMany({
        where: { id: { in: testHospIds } },
      });
      console.log(`[Cleaned] Purged ${delHosps.count} test hospitals and their cascaded records.`);

      // 10. Delete test users (Cascades user-linked records)
      const delUsers = await tx.users.deleteMany({
        where: { id: { in: testUserIds } },
      });
      console.log(`[Cleaned] Purged ${delUsers.count} test user accounts.`);

      // 11. Truncate test_table
      const delTestTable = await tx.test_table.deleteMany({});
      console.log(`[Cleaned] Purged ${delTestTable.count} records from test_table.`);

      return {
        hospitalsDeleted: delHosps.count,
        usersDeleted: delUsers.count,
        patientsDeleted: delPatients.count,
        dummyTicketsInRealHosps: delDummyTicketsCount,
        dummyApptsInRealHosps: delDummyAppts.count,
        auditLogsDeleted: delAuditLogs.count,
        testTableDeleted: delTestTable.count,
      };
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );

  console.log("\n=======================================================");
  console.log("✅ DATABASE CLEANUP COMPLETED SUCCESSFULLY");
  console.log("=======================================================\n");

  return results;
}

if (require.main === module) {
  cleanDummyData()
    .catch((err) => {
      console.error("\n❌ Error during database cleanup:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { cleanDummyData };
