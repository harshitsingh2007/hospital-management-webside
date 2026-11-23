/**
 * tests/appointments.test.js
 * --------------------------
 * Unit & Integration verification for Appointment Booking, Validation & Daily Check-in.
 */

const assert = require("assert");
const {
  bookAppointment,
  checkInAppointment,
  getUserAppointments,
  getTenantAppointments,
} = require("../src/services/appointmentService");
const { signupPatient } = require("../src/controllers/auth.controller");
const { getCurrentQueueDate, formatQueueDate, parseQueueDate } = require("../src/utils/timezone");
const prisma = require("../src/config/prisma");

async function runAppointmentTests() {
  console.log("\n==================================================");
  console.log(" 🧪 RUNNING APPOINTMENTS & CHECK-IN TESTS");
  console.log("==================================================");

  const testTenant = `apt-hosp-${Date.now() % 10000}`;
  const patientEmail = `apt_patient_${Date.now()}@example.com`;
  const todayStr = getCurrentQueueDate();

  // Register patient account first
  let signupRes = null;
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        signupRes = { statusCode: code, ...data };
      },
    }),
  };

  await signupPatient(
    {
      body: {
        email: patientEmail,
        username: "Test Appointment Patient",
        password: "Password123!",
        phone: "+1 555-999-0000",
      },
    },
    mockRes,
    () => { }
  );

  // 1. Book a Future Appointment (safe offset regardless of UTC midnight boundary)
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 2);
  const futureDateStr = futureDate.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

  const futureApt = await bookAppointment({
    tenantId: testTenant,
    consumerType: "hospital",
    serviceCategory: "consultation",
    patientName: "Future Patient",
    userEmail: patientEmail,
    appointmentDate: futureDateStr,
    timeSlot: "10:30 AM",
  });

  assert.strictEqual(futureApt.status, "BOOKED", "Future appointment status must be BOOKED");
  assert.ok(futureApt.appointment_time, "Must include appointment_time");
  assert.ok(futureApt.check_in_opens_at, "Must include check_in_opens_at");
  assert.ok(futureApt.expires_at, "Must include expires_at");
  assert.strictEqual(futureApt.can_check_in, false, "can_check_in must be false for future appointment");
  console.log(`[PASS] Test 1: Future appointment '${futureApt.appointment_id}' booked with status 'BOOKED' (opens at ${futureApt.formatted_check_in_opens_at}).`);

  // 2. Attempt Early Check-In for Future Appointment (Must Reject)
  let earlyCheckInRejected = false;
  try {
    await checkInAppointment(futureApt.appointment_id);
  } catch (err) {
    earlyCheckInRejected = true;
    assert.ok(err.message.includes("not available yet"), "Should reject early check-in");
  }
  assert.strictEqual(earlyCheckInRejected, true, "Early check-in for future appointment must be rejected");
  console.log("[PASS] Test 2: Early check-in for future appointment strictly rejected.");

  // 3. Book a Slot within Active Check-In Window (e.g. within 30m window on today's queue date)
  const currentSlotDate = new Date(Date.now() - 2 * 60 * 1000);
  let slotH = currentSlotDate.getHours();
  const slotM = currentSlotDate.getMinutes();
  const slotMeridian = slotH >= 12 ? "PM" : "AM";
  const displayH = slotH % 12 === 0 ? 12 : slotH % 12;
  const activeSlotStr = `${String(displayH).padStart(2, "0")}:${String(slotM).padStart(2, "0")} ${slotMeridian}`;
  const slotDateStr = parseQueueDate(currentSlotDate);

  const availableApt = await bookAppointment({
    tenantId: testTenant,
    consumerType: "hospital",
    serviceCategory: "consultation",
    patientName: "Active Window Patient",
    userEmail: patientEmail,
    appointmentDate: slotDateStr,
    timeSlot: activeSlotStr,
  });

  assert.strictEqual(availableApt.status, "CHECK_IN_AVAILABLE", "Status must be CHECK_IN_AVAILABLE when within 30-min window");
  assert.strictEqual(availableApt.can_check_in, true, "can_check_in must be true within window");
  console.log(`[PASS] Test 3: Slot booked for ${activeSlotStr} (within 30m window) has status 'CHECK_IN_AVAILABLE'.`);

  // 4. Check-in within Active Window (Transitions to CHECKED_IN and issues live queue ticket)
  const checkInResult = await checkInAppointment(availableApt.appointment_id);
  assert.strictEqual(checkInResult.appointment.status, "CHECKED_IN", "Status must transition to CHECKED_IN");
  assert.ok(checkInResult.ticket.ticket_id, "Check-in must generate a valid ticket ID");
  assert.strictEqual(checkInResult.ticket.status, "waiting", "Generated ticket must be waiting");
  console.log(`[PASS] Test 4: Checked in appointment '${availableApt.appointment_id}' -> Status 'CHECKED_IN' & Ticket #${checkInResult.ticket.ticket_id}.`);

  // 5. Expiration Test: An appointment scheduled in the past (> 1 hour ago) must expire and reject check-in
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayStr = parseQueueDate(yesterday);
  const pastApt = await prisma.appointments.create({
    data: {
      appointment_id: `APT-EXPIRED-${Date.now() % 10000}`,
      hospital_id: (await prisma.hospitals.findFirst({ where: { hospital_code: testTenant } })).id,
      patient_id: availableApt.patient_id || null,
      service_category: "consultation",
      appointment_date: new Date(`${yesterdayStr}T00:00:00.000Z`),
      time_slot: "10:00 AM", // 10 AM yesterday is expired
      status: "BOOKED",
      ticket_id: "",
    },
  });

  let expiredCheckInRejected = false;
  try {
    await checkInAppointment(pastApt.appointment_id);
  } catch (err) {
    expiredCheckInRejected = true;
    assert.ok(err.message.includes("expired") || err.code === "TICKET_EXPIRED", "Must reject expired ticket check-in");
  }
  assert.strictEqual(expiredCheckInRejected, true, "Check-in for expired appointment must be rejected");

  const updatedPastApt = await prisma.appointments.findUnique({ where: { appointment_id: pastApt.appointment_id } });
  assert.strictEqual(updatedPastApt.status, "EXPIRED", "Database record must be marked as EXPIRED");
  console.log(`[PASS] Test 5: Overdue ticket '${pastApt.appointment_id}' automatically marked EXPIRED and rejected check-in.`);

  // 6. Query User Appointments & Tenant Appointments
  const userApts = await getUserAppointments(patientEmail);
  assert.ok(userApts.length >= 2, "User should have at least 2 booked appointments");
  const tenantApts = await getTenantAppointments(testTenant);
  assert.ok(tenantApts.length >= 2, "Tenant should have at least 2 booked appointments");
  console.log(`[PASS] Test 6: Appointments retrieval verified for user '${patientEmail}' and tenant '${testTenant}'.`);

  console.log("✅ ALL APPOINTMENT TESTS PASSED!\n");
}

module.exports = { runAppointmentTests };

if (require.main === module) {
  runAppointmentTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Appointment Test Failed:", err);
      process.exit(1);
    });
}
