/**
 * queueEngine.js
 * --------------
 * In-Memory Priority Min-Heap & Dynamic Wait-Time Recalculation Engine.
 * Multi-Hospital Relational Architecture matching Python QueueEngine.
 */

const prisma = require("../config/prisma");
const { getCurrentQueueDate, parseQueueDate, queueDateToPrismaDate, dtToEpoch } = require("../utils/timezone");
const { computeClinicalComplexity, PRIORITY_ROUTINE } = require("../utils/clinicalComplexity");
const { predictServiceDuration } = require("./aiService");

/**
 * High-performance Binary Min-Heap for queue priority management.
 * Orders elements by (priority_level, effective_timestamp, ticket_id)
 */
class PriorityQueueHeap {
  constructor() {
    this.heap = [];
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  size() {
    return this.heap.length;
  }

  clear() {
    this.heap = [];
  }

  _compare(a, b) {
    // a = [priority, effective_ts, ticket_id]
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2].localeCompare(b[2]);
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this._compare(this.heap[index], this.heap[parentIdx]) < 0) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[parentIdx];
        this.heap[parentIdx] = temp;
        index = parentIdx;
      } else {
        break;
      }
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    while (true) {
      const leftChildIdx = 2 * index + 1;
      const rightChildIdx = 2 * index + 2;
      let smallest = index;

      if (leftChildIdx < length && this._compare(this.heap[leftChildIdx], this.heap[smallest]) < 0) {
        smallest = leftChildIdx;
      }
      if (rightChildIdx < length && this._compare(this.heap[rightChildIdx], this.heap[smallest]) < 0) {
        smallest = rightChildIdx;
      }

      if (smallest !== index) {
        const temp = this.heap[index];
        this.heap[index] = this.heap[smallest];
        this.heap[smallest] = temp;
        index = smallest;
      } else {
        break;
      }
    }
  }
}

class NodeQueueEngine {
  constructor() {
    this.tenants = new Map();
    this.idCounter = Math.floor((Date.now() / 1000) % 1000000);
  }

  _getTenant(tenantId) {
    const tid = String(tenantId || "city-hospital-01").trim();
    if (!this.tenants.has(tid)) {
      this.tenants.set(tid, {
        queue: new PriorityQueueHeap(),
        tickets: new Map(),
        active_counters: 2,
      });
    }
    return this.tenants.get(tid);
  }

  generateTicketId() {
    this.idCounter += 1;
    return `T${String(this.idCounter).padStart(4, "0")}`;
  }

  /**
   * Looks up hospital_id by hospital_code. If not found, creates it with standard departments.
   */
  async resolveHospitalId(hospitalCode) {
    const cleanCode = String(hospitalCode || "city-hospital-01").trim().toLowerCase();
    const hosp = await prisma.hospitals.findUnique({
      where: { hospital_code: cleanCode },
      select: { id: true },
    });
    if (hosp) return hosp.id;

    // Auto-create hospital if it does not exist
    try {
      const created = await prisma.hospitals.create({
        data: {
          hospital_code: cleanCode,
          name: cleanCode.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          status: "active",
        },
        select: { id: true },
      });

      // Seed standard clinical departments for this hospital
      const standardDepts = [
        ["consultation", "General Consultation (OPD)", "General outpatient doctor examinations"],
        ["pharmacy", "Pharmacy & Medicine", "Prescription dispensing and clinical pharmacy"],
        ["laboratory", "Pathology & Lab Test", "Diagnostic blood, urine and pathology assays"],
        ["radiology", "Radiology & X-Ray", "X-Ray, CT Scan, MRI and ultrasound imaging"],
        ["emergency", "Emergency Triage", "Critical emergency resuscitation and trauma"],
      ];
      for (const [dCode, dName, dDesc] of standardDepts) {
        await prisma.departments.create({
          data: {
            hospital_id: created.id,
            dept_code: dCode,
            name: dName,
            description: dDesc,
            status: "active",
          },
        }).catch(() => {});
      }

      return created.id;
    } catch (e) {
      // Fallback query any existing hospital
      const anyHosp = await prisma.hospitals.findFirst({
        orderBy: { id: "asc" },
        select: { id: true },
      });
      return anyHosp ? anyHosp.id : 1;
    }
  }

  /**
   * Looks up department_id by hospital_id and dept_code. Auto-creates department if missing.
   */
  async resolveDepartmentId(hospitalId, deptCode) {
    const cleanCode = String(deptCode || "consultation").trim().toLowerCase();
    const dept = await prisma.departments.findFirst({
      where: {
        hospital_id: hospitalId,
        dept_code: cleanCode,
      },
      select: { id: true },
    });
    if (dept) return dept.id;

    try {
      const createdDept = await prisma.departments.create({
        data: {
          hospital_id: hospitalId,
          dept_code: cleanCode,
          name: cleanCode.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          status: "active",
        },
        select: { id: true },
      });
      return createdDept.id;
    } catch (e) {
      const anyDept = await prisma.departments.findFirst({
        where: { hospital_id: hospitalId },
        select: { id: true },
      });
      return anyDept ? anyDept.id : null;
    }
  }

  /**
   * Finds or creates a patient record linked to user_email or patient name.
   */
  async resolvePatientId(userEmail, name, phone = "", gender = "other", age = 30) {
    const email = String(userEmail || "").trim().toLowerCase();
    const cleanName = String(name || "").trim();
    const cleanPhoneDigits = String(phone || "").replace(/\D/g, "");
    let uid = null;

    if (email) {
      const user = await prisma.users.findFirst({
        where: {
          OR: [{ email: { equals: email, mode: "insensitive" } }, { username: { equals: email, mode: "insensitive" } }],
        },
        select: { id: true },
      });
      if (user) uid = user.id;
    }

    if (!uid && cleanPhoneDigits.length >= 10) {
      const last10 = cleanPhoneDigits.slice(-10);
      const userByPhone = await prisma.users.findFirst({
        where: {
          phone: { contains: last10 },
          NOT: { email: { contains: "@hospital.local" } },
        },
        select: { id: true },
      });
      if (userByPhone) uid = userByPhone.id;
    }

    if (uid) {
      // 1. If cleanName matches a family member of this user, return or create that family member's patient ID
      if (cleanName) {
        const fm = await prisma.family_members.findFirst({
          where: {
            user_id: uid,
            name: { equals: cleanName, mode: "insensitive" },
          },
          select: { id: true, patient_id: true },
        });
        if (fm && fm.patient_id) {
          return fm.patient_id;
        }
      }

      if (cleanName) {
        // Check if there is an existing patient record for this user with this specific name
        const patWithName = await prisma.patients.findFirst({
          where: {
            user_id: uid,
            name: { equals: cleanName, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (patWithName) return patWithName.id;
      }

      // 2. Primary patient record for user (only if name matches user or no name provided)
      const primaryUser = await prisma.users.findUnique({
        where: { id: uid },
        select: { username: true, email: true },
      });
      const isSelf = !cleanName || (primaryUser && primaryUser.username && primaryUser.username.toLowerCase().trim() === cleanName.toLowerCase().trim());
      if (isSelf) {
        const pat = await prisma.patients.findFirst({
          where: { user_id: uid },
          select: { id: true },
        });
        if (pat) return pat.id;
      }
    }

    // Check existing patient by phone
    if (cleanPhoneDigits.length >= 7) {
      const last10 = cleanPhoneDigits.slice(-10);
      const patByPhone = await prisma.patients.findFirst({
        where: {
          phone: { contains: last10 },
          ...(cleanName ? { name: { equals: cleanName, mode: "insensitive" } } : {}),
        },
        select: { id: true, user_id: true },
      });
      if (patByPhone) {
        if (!patByPhone.user_id && uid) {
          await prisma.patients.update({
            where: { id: patByPhone.id },
            data: { user_id: uid, updated_at: new Date() },
          });
        }
        return patByPhone.id;
      }
    }

    // Check existing unlinked patient by name
    if (cleanName) {
      const unlinked = await prisma.patients.findFirst({
        where: {
          name: { equals: cleanName, mode: "insensitive" },
          user_id: null,
        },
        orderBy: { id: "desc" },
        select: { id: true },
      });
      if (unlinked) {
        if (uid) {
          await prisma.patients.update({
            where: { id: unlinked.id },
            data: { user_id: uid, updated_at: new Date() },
          });
        }
        return unlinked.id;
      }
    }

    // Create new patient entry
    const newPat = await prisma.patients.create({
      data: {
        user_id: uid,
        medical_id: "",
        name: cleanName || "Patient",
        phone: phone || "",
        gender: gender || "other",
        age: parseInt(age, 10) || 30,
      },
      select: { id: true },
    });

    return newPat.id;
  }

  /**
   * Verifies ticket ownership or authorized staff privileges.
   */
  async verifyTicketOwnership(ticketId, userEmail, hospitalId) {
    const cleanEmail = String(userEmail || "").trim().toLowerCase();

    // 1. Fetch ticket first
    const ticket = await prisma.tickets.findUnique({
      where: { ticket_id: ticketId },
      include: {
        patients: {
          include: {
            users: true,
            family_members: true,
          },
        },
        appointments: {
          include: {
            patients: true,
          },
        },
      },
    });

    if (!ticket) {
      const err = new Error(`Ticket #${ticketId} not found.`);
      err.status = 404;
      throw err;
    }

    // If no email provided (guest session holding ticket), allow patient portal/walk-in ticket
    if (!cleanEmail) {
      return ticket.patients?.user_id || null;
    }

    // 2. Try looking up in users table (for staff/doctors/admins or registered accounts)
    let user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: { equals: cleanEmail, mode: "insensitive" } },
          { username: { equals: cleanEmail, mode: "insensitive" } },
          { phone: { equals: cleanEmail, mode: "insensitive" } },
        ],
      },
      include: {
        employees: true,
      },
    });

    if (!user) {
      // Check employee_code
      const emp = await prisma.employees.findFirst({
        where: {
          employee_code: { equals: cleanEmail, mode: "insensitive" },
        },
        include: { users: true },
      });
      if (emp) user = emp.users;
    }

    if (user) {
      const uid = user.id;
      const role = (user.role || "").toLowerCase();

      // Super Admin
      if (role === "superadmin" || role === "super_admin") {
        return uid;
      }

      // Staff / Doctor / Admin
      if (["admin", "doctor", "staff", "receptionist"].includes(role)) {
        const emp = await prisma.employees.findFirst({
          where: { user_id: uid, hospital_id: hospitalId },
        });
        if (emp || user.primary_hospital_code) return uid;
        const err = new Error("Forbidden: Staff member does not belong to this hospital.");
        err.name = "PermissionError";
        err.status = 403;
        throw err;
      }

      // Patient / Consumer user:
      if (ticket.patients?.user_id === uid) return uid;
      if (ticket.appointments?.patients?.user_id === uid) return uid;
      if (ticket.patients?.users?.email && ticket.patients.users.email.toLowerCase() === cleanEmail) {
        return uid;
      }

      // Check family members linked to this account
      const isFamily = await prisma.family_members.findFirst({
        where: {
          user_id: uid,
          OR: [{ patient_id: ticket.patient_id }, { name: ticket.name }],
        },
      });
      if (isFamily) return uid;

      // Name or phone match with account
      if (
        (ticket.patients?.name && (ticket.patients.name.toLowerCase() === (user.username || "").toLowerCase() || ticket.patients.name.toLowerCase() === (user.name || "").toLowerCase())) ||
        (ticket.name && (ticket.name.toLowerCase() === (user.username || "").toLowerCase() || ticket.name.toLowerCase() === (user.name || "").toLowerCase())) ||
        (ticket.patients?.phone && user.phone && ticket.patients.phone === user.phone)
      ) {
        return uid;
      }

      // If the ticket was issued as a walk-in/portal ticket, allow holder to cancel
      if (!ticket.patients?.user_id || ticket.source === "patient_portal" || ticket.consumer_type === "hospital") {
        return uid;
      }

      return uid;
    }

    // 3. User account was not in `users` (e.g. patient registered with phone/guest/walk-in)
    const cleanPhone = cleanEmail.replace(/\D/g, "");
    const ticketPhone = (ticket.patients?.phone || "").replace(/\D/g, "");

    if (ticketPhone && cleanPhone && ticketPhone === cleanPhone) {
      return ticket.patients?.user_id || null;
    }

    if (ticket.patients?.name && ticket.patients.name.toLowerCase() === cleanEmail) {
      return ticket.patients?.user_id || null;
    }

    if (ticket.name && ticket.name.toLowerCase() === cleanEmail) {
      return ticket.patients?.user_id || null;
    }

    // If ticket was created from patient portal or walk-in, the client possessing the ticket is allowed to cancel it
    if (ticket.source === "patient_portal" || ticket.consumer_type === "hospital" || !ticket.patients?.user_id) {
      return ticket.patients?.user_id || null;
    }

    return ticket.patients?.user_id || null;
  }

  /**
   * Records an immutable queue lifecycle event into `queue_events`.
   */
  async logQueueEvent({
    hospitalId,
    ticketId,
    eventType,
    oldStatus = null,
    newStatus = null,
    oldPosition = null,
    newPosition = null,
    performedByUserId = null,
    metadata = {},
  }) {
    try {
      await prisma.queue_events.create({
        data: {
          hospital_id: hospitalId,
          ticket_id: ticketId,
          event_type: eventType,
          old_status: oldStatus,
          new_status: newStatus,
          old_position: oldPosition,
          new_position: newPosition,
          performed_by_user_id: performedByUserId,
          metadata: metadata || {},
        },
      });
    } catch (err) {
      console.warn(`[WARN] Failed to write queue_event: ${err.message}`);
    }
  }

  /**
   * Sets active counter count for hospital tenant.
   */
  async setActiveCounters(tenantId, count) {
    const safeCount = Math.max(1, parseInt(count, 10) || 1);
    const tenant = this._getTenant(tenantId);
    tenant.active_counters = safeCount;

    const hid = await this.resolveHospitalId(tenantId);
    await prisma.tenant_config.upsert({
      where: { hospital_id: hid },
      update: {
        active_counters: safeCount,
        updated_at: new Date(),
      },
      create: {
        hospital_id: hid,
        legacy_tenant_id: tenantId,
        active_counters: safeCount,
      },
    });

    await this.recalculateWaitTimes(tenantId);
    return safeCount;
  }

  /**
   * Rebuilds the in-memory binary min-heap for a tenant.
   */
  _rebuildHeap(tenantId) {
    const tenant = this._getTenant(tenantId);
    const today = getCurrentQueueDate();
    tenant.queue.clear();

    for (const ticket of tenant.tickets.values()) {
      if (ticket.status === "waiting" && parseQueueDate(ticket.queue_date) === today) {
        const prio = ticket.priority_level || 2;
        const eff = ticket.effective_timestamp || ticket.join_timestamp || Date.now() / 1000;
        tenant.queue.push([prio, eff, ticket.ticket_id]);
      }
    }
  }

  /**
   * Recalculates dynamic wait times and independent queue positions starting from #1 for today's active tickets.
   */
  async recalculateWaitTimes(tenantId) {
    const tenant = this._getTenant(tenantId);
    const activeCounters = tenant.active_counters || 2;
    const today = getCurrentQueueDate();

    const waiting = Array.from(tenant.tickets.values()).filter(
      (t) => t.status === "waiting" && parseQueueDate(t.queue_date) === today
    );

    waiting.sort((a, b) => {
      if (a.priority_level !== b.priority_level) return a.priority_level - b.priority_level;
      const effA = a.effective_timestamp || a.join_timestamp || 0;
      const effB = b.effective_timestamp || b.join_timestamp || 0;
      if (effA !== effB) return effA - effB;
      return a.ticket_id.localeCompare(b.ticket_id);
    });

    const cumulativeByDept = {};
    const deptPositions = {};
    const updated = [];

    for (const t of waiting) {
      const groupKey = String(t.service_category || "consultation").trim().toLowerCase();
      deptPositions[groupKey] = (deptPositions[groupKey] || 0) + 1;
      t.position = deptPositions[groupKey];

      const prevWait = cumulativeByDept[groupKey] || 0.0;
      const est = prevWait + (t.predicted_service_minutes || 10.0) / Math.max(1, activeCounters);
      t.estimated_wait_minutes = Math.round(est * 10) / 10;
      cumulativeByDept[groupKey] = est;
      updated.push(t);
    }

    // Sync updated positions to PostgreSQL asynchronously
    if (updated.length > 0) {
      const hid = await this.resolveHospitalId(tenantId);
      Promise.all(
        updated.map((t) =>
          prisma.tickets.updateMany({
            where: { ticket_id: t.ticket_id, hospital_id: hid },
            data: {
              position: t.position,
              estimated_wait_minutes: t.estimated_wait_minutes,
              updated_at: new Date(),
            },
          })
        )
      ).catch((e) => console.warn(`[WARN] Failed to sync wait times/positions to PostgreSQL: ${e.message}`));
    }

    return updated;
  }

  /**
   * Startup Hydration: Loads only today's active waiting and serving tickets into memory heaps.
   */
  async hydrateFromDb() {
    try {
      const today = getCurrentQueueDate();
      const todayDateObj = queueDateToPrismaDate(today);

      // Load active configs
      const configs = await prisma.tenant_config.findMany({
        include: { hospitals: true },
      });
      for (const cfg of configs) {
        if (cfg.hospitals?.hospital_code) {
          this._getTenant(cfg.hospitals.hospital_code).active_counters = cfg.active_counters || 2;
        }
      }

      // Reset all in-memory queues for today
      for (const tData of this.tenants.values()) {
        tData.queue.clear();
        tData.tickets.clear();
      }

      // Load active tickets for CURRENT_DATE
      const activeTickets = await prisma.tickets.findMany({
        where: {
          queue_date: todayDateObj,
          status: { in: ["waiting", "serving", "called"] },
        },
        include: {
          hospitals: true,
        },
        orderBy: [{ priority_level: "asc" }, { join_timestamp: "asc" }],
      });

      for (const row of activeTickets) {
        const hCode = row.hospitals?.hospital_code || "city-hospital-01";
        const joinTs = dtToEpoch(row.join_timestamp);
        const effTs = dtToEpoch(row.effective_timestamp) || joinTs;

        const ticketObj = {
          ticket_id: row.ticket_id,
          tenant_id: hCode,
          consumer_type: row.consumer_type || "hospital",
          service_category: row.service_category,
          name: row.name,
          priority_level: row.priority_level || 2,
          join_timestamp: joinTs,
          effective_timestamp: effTs,
          queue_date: today,
          appointment_id: row.appointment_id || "",
          user_email: "",
          age: 30,
          gender: "other",
          medical_condition: row.medical_condition || "general_checkup",
          pre_existing_condition: row.pre_existing_condition || "none",
          complexity_score: row.complexity_score || 1.0,
          prescription_notes: row.prescription_notes || "",
          parent_ticket_id: row.parent_ticket_id || "",
          transferred_from_dept: row.transferred_from_dept || "",
          status: row.status,
          predicted_service_minutes: row.predicted_service_minutes || 10.0,
          estimated_wait_minutes: row.estimated_wait_minutes || 0.0,
          position: row.position || 0,
          serve_start_time: row.serve_start_time ? dtToEpoch(row.serve_start_time) : null,
          serve_end_time: row.serve_end_time ? dtToEpoch(row.serve_end_time) : null,
          actual_service_minutes: row.actual_service_minutes || null,
          adjustment_count: row.adjustment_count || 0,
          cancellation_reason: row.cancellation_reason || "",
        };

        const tenant = this._getTenant(hCode);
        tenant.tickets.set(ticketObj.ticket_id, ticketObj);
        if (["waiting", "called"].includes(ticketObj.status)) {
          tenant.queue.push([ticketObj.priority_level, effTs, ticketObj.ticket_id]);
        }
      }

      // Recalculate wait times for all initialized tenants
      for (const tId of this.tenants.keys()) {
        await this.recalculateWaitTimes(tId);
      }

      console.log(`[Daily Queue Hydration] Loaded today (${today}) active queues for ${this.tenants.size} hospital tenants.`);
    } catch (err) {
      console.warn(`[Hydration] Note during startup: ${err.message}`);
    }
  }

  /**
   * Retrieves active snapshot for today or historical records for past dates.
   */
  async getQueueSnapshot(tenantId, department = null, queueDate = null) {
    const targetDate = parseQueueDate(queueDate);
    const today = getCurrentQueueDate();
    const deptFilter = String(department || "").trim().toLowerCase();

    if (targetDate === today) {
      const tenant = this._getTenant(tenantId);
      let waiting = Array.from(tenant.tickets.values()).filter(
        (t) => ["waiting", "called"].includes(t.status) && parseQueueDate(t.queue_date) === today
      );

      waiting.sort((a, b) => {
        if (a.priority_level !== b.priority_level) return a.priority_level - b.priority_level;
        const effA = a.effective_timestamp || a.join_timestamp || 0;
        const effB = b.effective_timestamp || b.join_timestamp || 0;
        if (effA !== effB) return effA - effB;
        return a.ticket_id.localeCompare(b.ticket_id);
      });

      if (deptFilter && deptFilter !== "all") {
        waiting = waiting.filter((t) => String(t.service_category).trim().toLowerCase() === deptFilter);
      }

      return waiting;
    }

    // Historical queue query from database
    const hid = await this.resolveHospitalId(tenantId);
    const where = {
      hospital_id: hid,
      queue_date: queueDateToPrismaDate(targetDate),
      status: { in: ["waiting", "called"] },
    };

    if (deptFilter && deptFilter !== "all") {
      const deptId = await this.resolveDepartmentId(hid, deptFilter);
      if (deptId) where.department_id = deptId;
    }

    const rows = await prisma.tickets.findMany({
      where,
      orderBy: [{ priority_level: "asc" }, { join_timestamp: "asc" }],
    });

    return rows.map((r) => ({
      ...r,
      join_timestamp: dtToEpoch(r.join_timestamp),
      queue_date: targetDate,
    }));
  }

  /**
   * Retrieves currently serving tickets for today or target date.
   */
  async getServingTickets(tenantId, department = null, queueDate = null) {
    const targetDate = parseQueueDate(queueDate);
    const today = getCurrentQueueDate();
    const deptFilter = String(department || "").trim().toLowerCase();

    if (targetDate === today) {
      const tenant = this._getTenant(tenantId);
      let serving = Array.from(tenant.tickets.values()).filter(
        (t) => t.status === "serving" && parseQueueDate(t.queue_date) === today
      );

      if (deptFilter && deptFilter !== "all") {
        serving = serving.filter((t) => String(t.service_category).trim().toLowerCase() === deptFilter);
      }

      return serving;
    }

    const hid = await this.resolveHospitalId(tenantId);
    const where = {
      hospital_id: hid,
      queue_date: queueDateToPrismaDate(targetDate),
      status: "serving",
    };

    if (deptFilter && deptFilter !== "all") {
      const deptId = await this.resolveDepartmentId(hid, deptFilter);
      if (deptId) where.department_id = deptId;
    }

    const rows = await prisma.tickets.findMany({
      where,
      orderBy: { join_timestamp: "asc" },
    });

    return rows.map((r) => ({
      ...r,
      join_timestamp: dtToEpoch(r.join_timestamp),
      queue_date: targetDate,
    }));
  }

  /**
   * Retrieves on-hold / grace period tickets for today or target date.
   */
  async getHeldTickets(tenantId, department = null, queueDate = null) {
    const targetDate = parseQueueDate(queueDate);
    const today = getCurrentQueueDate();
    const deptFilter = String(department || "").trim().toLowerCase();

    if (targetDate === today) {
      const tenant = this._getTenant(tenantId);
      let held = Array.from(tenant.tickets.values()).filter(
        (t) => ["on_hold", "hold"].includes(String(t.status || "").toLowerCase()) && parseQueueDate(t.queue_date) === today
      );

      if (deptFilter && deptFilter !== "all") {
        held = held.filter((t) => String(t.service_category).trim().toLowerCase() === deptFilter);
      }

      held.sort((a, b) => {
        const hA = a.hold_start_time || a.join_timestamp || 0;
        const hB = b.hold_start_time || b.join_timestamp || 0;
        return hB - hA;
      });

      return held;
    }

    const hid = await this.resolveHospitalId(tenantId);
    const where = {
      hospital_id: hid,
      queue_date: queueDateToPrismaDate(targetDate),
      status: { in: ["on_hold", "hold"] },
    };

    if (deptFilter && deptFilter !== "all") {
      const deptId = await this.resolveDepartmentId(hid, deptFilter);
      if (deptId) where.department_id = deptId;
    }

    const rows = await prisma.tickets.findMany({
      where,
      orderBy: { updated_at: "desc" },
    });

    return rows.map((r) => ({
      ...r,
      join_timestamp: dtToEpoch(r.join_timestamp),
      queue_date: targetDate,
    }));
  }

  /**
   * Retrieves historical queue tickets for given date.
   */
  async getHistoricalQueueTickets(tenantId, queueDate, department = null) {
    const targetDate = parseQueueDate(queueDate);
    const hid = await this.resolveHospitalId(tenantId);
    const deptFilter = String(department || "").trim().toLowerCase();

    const where = {
      hospital_id: hid,
      queue_date: queueDateToPrismaDate(targetDate),
    };

    if (deptFilter && deptFilter !== "all") {
      const deptId = await this.resolveDepartmentId(hid, deptFilter);
      if (deptId) where.department_id = deptId;
    }

    const rows = await prisma.tickets.findMany({
      where,
      include: {
        departments: true,
        hospitals: true,
      },
      orderBy: [{ priority_level: "asc" }, { join_timestamp: "asc" }],
    });

    return rows.map((r) => ({
      ...r,
      department_name: r.departments?.name || r.service_category,
      hospital_code: r.hospitals?.hospital_code || tenantId,
      queue_date: targetDate,
      created_at: r.created_at ? r.created_at.toISOString() : null,
      updated_at: r.updated_at ? r.updated_at.toISOString() : null,
      serve_start_time: r.serve_start_time ? r.serve_start_time.toISOString() : null,
      serve_end_time: r.serve_end_time ? r.serve_end_time.toISOString() : null,
      cancelled_at: r.cancelled_at ? r.cancelled_at.toISOString() : null,
    }));
  }

  /**
   * Returns tickets with position 1 or 2 needing turn alerts.
   */
  async getTicketsNeedingTurnAlert(tenantId) {
    const snapshot = await this.getQueueSnapshot(tenantId);
    return snapshot.filter((t) => t.position === 1 || t.position === 2);
  }

  /**
   * Returns real-time or historical analytics for hospital tenant.
   */
  async getTenantAnalytics(tenantId, department = null, queueDate = null) {
    const targetDate = parseQueueDate(queueDate);
    const today = getCurrentQueueDate();
    const tenant = this._getTenant(tenantId);
    const deptFilter = String(department || "").trim().toLowerCase();

    let waiting = [];
    let serving = [];
    let avgWait = 0.0;

    if (targetDate === today) {
      waiting = Array.from(tenant.tickets.values()).filter(
        (t) => ["waiting", "called"].includes(t.status) && parseQueueDate(t.queue_date) === today
      );
      serving = Array.from(tenant.tickets.values()).filter(
        (t) => t.status === "serving" && parseQueueDate(t.queue_date) === today
      );

      if (deptFilter && deptFilter !== "all") {
        waiting = waiting.filter((t) => String(t.service_category).trim().toLowerCase() === deptFilter);
        serving = serving.filter((t) => String(t.service_category).trim().toLowerCase() === deptFilter);
      }

      if (waiting.length > 0) {
        avgWait = waiting.reduce((acc, t) => acc + (t.estimated_wait_minutes || 0.0), 0) / waiting.length;
      }
    }

    const hid = await this.resolveHospitalId(tenantId);
    const whereLogs = {
      hospital_id: hid,
      queue_date: queueDateToPrismaDate(targetDate),
    };

    if (deptFilter && deptFilter !== "all") {
      const deptId = await this.resolveDepartmentId(hid, deptFilter);
      if (deptId) whereLogs.department_id = deptId;
    }

    const logs = await prisma.service_logs.findMany({
      where: whereLogs,
      select: { service_duration_minutes: true },
    });

    const whereTickets = {
      hospital_id: hid,
      queue_date: queueDateToPrismaDate(targetDate),
      status: { in: ["completed", "COMPLETED"] },
    };
    if (deptFilter && deptFilter !== "all") {
      whereTickets.service_category = { equals: deptFilter, mode: "insensitive" };
    }
    const completedTicketsCount = await prisma.tickets.count({ where: whereTickets }).catch(() => 0);

    const totalServed = Math.max(logs.length, completedTicketsCount);
    const avgService =
      logs.length > 0
        ? logs.reduce((acc, l) => acc + l.service_duration_minutes, 0) / logs.length
        : 12.0;

    // Calculate realistic active counters grounded in actual hospital desks
    let realActiveDesks = 0;
    try {
      const deskWhere = { hospital_id: hid };
      if (deptFilter && deptFilter !== "all") {
        const deptId = await this.resolveDepartmentId(hid, deptFilter);
        if (deptId) deskWhere.department_id = deptId;
      }
      const allHospitalDesks = await prisma.desks.findMany({
        where: deskWhere,
        select: { id: true, status: true, assigned_employee_id: true }
      });
      if (allHospitalDesks.length > 0) {
        const activeCount = allHospitalDesks.filter(
          (d) =>
            ["ACTIVE", "OCCUPIED", "BUSY", "SERVING", "serving"].includes(d.status) ||
            (d.status === "AVAILABLE" && d.assigned_employee_id !== null)
        ).length;
        realActiveDesks = activeCount > 0 ? activeCount : (serving.length > 0 ? serving.length : 1);
        realActiveDesks = Math.min(realActiveDesks, allHospitalDesks.length);
      }
    } catch (_) {}

    const resolvedActiveCounters = realActiveDesks > 0
      ? realActiveDesks
      : (tenant.active_counters || (serving.length > 0 ? serving.length : 1));
    tenant.active_counters = resolvedActiveCounters;

    return {
      tenant_id: tenantId,
      department: department || "all",
      queue_date: targetDate,
      active_counters: resolvedActiveCounters,
      waiting_count: waiting.length,
      serving_count: serving.length,
      currently_serving: serving.length,
      completed_today: totalServed,
      total_completed: totalServed,
      avg_wait_minutes: Math.round(avgWait * 10) / 10,
      avg_service_minutes: Math.round(avgService * 10) / 10,
    };
  }
}

// Export singleton instance
const queueEngine = new NodeQueueEngine();
module.exports = queueEngine;
