/**
 * kiosk.controller.js
 * -------------------
 * Dedicated controller for physical hospital Kiosks and public TV monitors.
 * Handles validation, heartbeat, queue retrieval, and kiosk management.
 */

const prisma = require("../config/prisma");
const engine = require("../services/queueEngine");
const { dtToEpoch } = require("../utils/timezone");

/**
 * Validates and retrieves full kiosk details including hospital and department.
 * GET /api/v1/kiosk/:hospital_code/:kiosk_code
 */
async function getKioskEndpoint(req, res, next) {
  try {
    const hospitalCode = String(req.params.hospital_code || "").trim();
    const kioskCode = String(req.params.kiosk_code || "").trim();

    if (!hospitalCode || !kioskCode) {
      return res.status(400).json({
        status: "error",
        error_code: "INVALID_PARAMETERS",
        message: "hospital_code and kiosk_code parameters are required.",
      });
    }

    // 1. Validate Hospital
    const hospital = await prisma.hospitals.findUnique({
      where: { hospital_code: hospitalCode },
      select: {
        id: true,
        hospital_code: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        description: true,
        logo_url: true,
        branding_json: true,
        status: true,
      },
    });

    if (!hospital) {
      return res.status(404).json({
        status: "error",
        error_code: "HOSPITAL_NOT_FOUND",
        message: `Hospital '${hospitalCode}' was not found. Please verify the hospital code.`,
      });
    }

    if (hospital.status && hospital.status.toLowerCase() !== "active") {
      return res.status(403).json({
        status: "error",
        error_code: "HOSPITAL_INACTIVE",
        message: `Hospital '${hospital.name}' is currently inactive or under maintenance.`,
      });
    }

    // 2. Validate Kiosk
    const kiosk = await prisma.kiosks.findFirst({
      where: {
        hospital_id: hospital.id,
        kiosk_code: { equals: kioskCode, mode: "insensitive" },
      },
      include: {
        departments: {
          select: {
            id: true,
            dept_code: true,
            name: true,
            description: true,
            status: true,
          },
        },
      },
    });

    if (!kiosk) {
      return res.status(404).json({
        status: "error",
        error_code: "KIOSK_NOT_FOUND",
        message: `Kiosk terminal '${kioskCode}' is not registered under hospital '${hospital.name}'.`,
      });
    }

    if (kiosk.is_active === false) {
      return res.status(403).json({
        status: "error",
        error_code: "KIOSK_INACTIVE",
        message: `Kiosk terminal '${kiosk.name}' (${kiosk.kiosk_code}) is currently disabled by hospital administration.`,
      });
    }

    // 3. Mark last_seen_at
    await prisma.kiosks.update({
      where: { id: kiosk.id },
      data: {
        last_seen_at: new Date(),
        status: "online",
      },
    }).catch(() => {});

    return res.status(200).json({
      status: "success",
      kiosk: {
        id: kiosk.id,
        kiosk_code: kiosk.kiosk_code,
        name: kiosk.name,
        location: kiosk.location,
        status: "online",
        last_seen_at: new Date().toISOString(),
        is_active: kiosk.is_active,
        department_id: kiosk.department_id,
      },
      hospital: {
        id: hospital.id,
        hospital_code: hospital.hospital_code,
        name: hospital.name,
        address: hospital.address,
        phone: hospital.phone,
        email: hospital.email,
        logo_url: hospital.logo_url,
        branding: hospital.branding_json || {},
        status: hospital.status,
      },
      department: kiosk.departments
        ? {
            id: kiosk.departments.id,
            dept_code: kiosk.departments.dept_code,
            name: kiosk.departments.name,
            description: kiosk.departments.description,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Minimal Heartbeat endpoint to report Kiosk terminal is active/online.
 * POST /api/v1/kiosk/:hospital_code/:kiosk_code/heartbeat
 */
async function kioskHeartbeatEndpoint(req, res, next) {
  try {
    const hospitalCode = String(req.params.hospital_code || "").trim();
    const kioskCode = String(req.params.kiosk_code || "").trim();

    const hospital = await prisma.hospitals.findUnique({
      where: { hospital_code: hospitalCode },
      select: { id: true },
    });

    if (!hospital) {
      return res.status(404).json({
        status: "error",
        error_code: "HOSPITAL_NOT_FOUND",
        message: "Hospital not found.",
      });
    }

    const kiosk = await prisma.kiosks.findFirst({
      where: {
        hospital_id: hospital.id,
        kiosk_code: { equals: kioskCode, mode: "insensitive" },
      },
    });

    if (!kiosk) {
      return res.status(404).json({
        status: "error",
        error_code: "KIOSK_NOT_FOUND",
        message: "Kiosk not found.",
      });
    }

    const updated = await prisma.kiosks.update({
      where: { id: kiosk.id },
      data: {
        last_seen_at: new Date(),
        status: "online",
      },
    });

    return res.status(200).json({
      status: "success",
      last_seen_at: updated.last_seen_at,
      kiosk_status: "online",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Queue-safe public endpoint for Kiosk displays.
 * Strips all patient PII (emails, phone numbers, conditions) for HIPAA/data privacy compliance.
 * GET /api/v1/kiosk/:hospital_code/:kiosk_code/queue
 */
async function getKioskQueueEndpoint(req, res, next) {
  try {
    const hospitalCode = String(req.params.hospital_code || "").trim();
    const kioskCode = String(req.params.kiosk_code || "").trim();

    // 1. Verify Hospital
    const hospital = await prisma.hospitals.findUnique({
      where: { hospital_code: hospitalCode },
      select: { id: true, hospital_code: true, name: true, status: true },
    });

    if (!hospital || (hospital.status && hospital.status.toLowerCase() !== "active")) {
      return res.status(404).json({
        status: "error",
        error_code: "HOSPITAL_UNAVAILABLE",
        message: "Hospital unavailable or inactive.",
      });
    }

    // 2. Verify Kiosk
    const kiosk = await prisma.kiosks.findFirst({
      where: {
        hospital_id: hospital.id,
        kiosk_code: { equals: kioskCode, mode: "insensitive" },
      },
      include: { departments: true },
    });

    if (!kiosk || kiosk.is_active === false) {
      return res.status(404).json({
        status: "error",
        error_code: "KIOSK_UNAVAILABLE",
        message: "Kiosk terminal unavailable or deactivated.",
      });
    }

    // Determine department scope: if kiosk is bound to a specific department, filter by it
    const deptScope = kiosk.departments?.dept_code || null;

    const rawSnapshot = await engine.getQueueSnapshot(hospitalCode, deptScope);
    const rawServing = await engine.getServingTickets(hospitalCode, deptScope);
    const analytics = await engine.getTenantAnalytics(hospitalCode);

    // Fetch desk names for serving tickets if available
    const deskIds = rawServing.map((t) => t.desk_id).filter(Boolean).map((id) => parseInt(id, 10));
    let deskMap = {};
    if (deskIds.length > 0) {
      const desks = await prisma.desks.findMany({
        where: { id: { in: deskIds }, hospital_id: hospital.id },
        select: { id: true, desk_name: true, desk_number: true },
      });
      for (const d of desks) {
        deskMap[d.id] = d.desk_name || `Desk ${d.desk_number}`;
      }
    }

    // Sanitize Snapshot (NO PII)
    const sanitizedSnapshot = (rawSnapshot || []).map((t) => ({
      ticket_id: t.ticket_id,
      position: t.position,
      service_category: t.service_category,
      estimated_wait_minutes: t.estimated_wait_minutes || 0,
      priority_level: t.priority_level,
      status: t.status,
    }));

    // Sanitize Serving (NO PII)
    const sanitizedServing = (rawServing || []).map((t) => ({
      ticket_id: t.ticket_id,
      service_category: t.service_category,
      status: t.status,
      desk_id: t.desk_id || null,
      desk_name: t.desk_id ? (deskMap[t.desk_id] || `Desk #${t.desk_id}`) : (t.counter_number ? `Counter ${t.counter_number}` : "Consultation Desk"),
      doctor_name: t.served_by_doctor_name || null,
      serve_start_time: t.serve_start_time || null,
    }));

    return res.status(200).json({
      status: "success",
      hospital_code: hospitalCode,
      kiosk_code: kiosk.kiosk_code,
      department: kiosk.departments?.name || "All Departments",
      snapshot: sanitizedSnapshot,
      serving: sanitizedServing,
      analytics: {
        total_waiting: analytics.waiting_patients || sanitizedSnapshot.length,
        avg_wait_minutes: analytics.avg_wait_minutes || 12,
        active_counters: analytics.active_counters || 2,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all Kiosks for a hospital (Admin / Operations).
 * GET /api/v1/hospitals/:hospital_code/kiosks
 */
async function getHospitalKiosksEndpoint(req, res, next) {
  try {
    const hospitalCode = String(req.params.hospital_code || "").trim();

    const hospital = await prisma.hospitals.findUnique({
      where: { hospital_code: hospitalCode },
      select: { id: true },
    });

    if (!hospital) {
      return res.status(404).json({
        status: "error",
        message: `Hospital '${hospitalCode}' not found.`,
      });
    }

    const kiosksList = await prisma.kiosks.findMany({
      where: { hospital_id: hospital.id },
      include: {
        departments: {
          select: { id: true, dept_code: true, name: true },
        },
      },
      orderBy: { kiosk_code: "asc" },
    });

    return res.status(200).json({
      status: "success",
      kiosks: kiosksList,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create or update a Kiosk definition in the database.
 * POST /api/v1/hospitals/:hospital_code/kiosks
 */
async function upsertKioskEndpoint(req, res, next) {
  try {
    const hospitalCode = String(req.params.hospital_code || "").trim();
    const { kiosk_code, name, location, department_id, is_active } = req.body;

    if (!kiosk_code || !name) {
      return res.status(400).json({
        status: "error",
        message: "kiosk_code and name are required fields.",
      });
    }

    const hospital = await prisma.hospitals.findUnique({
      where: { hospital_code: hospitalCode },
      select: { id: true },
    });

    if (!hospital) {
      return res.status(404).json({
        status: "error",
        message: `Hospital '${hospitalCode}' not found.`,
      });
    }

    const cleanKioskCode = String(kiosk_code).trim().toUpperCase();

    const saved = await prisma.kiosks.upsert({
      where: {
        hospital_id_kiosk_code: {
          hospital_id: hospital.id,
          kiosk_code: cleanKioskCode,
        },
      },
      create: {
        hospital_id: hospital.id,
        kiosk_code: cleanKioskCode,
        name: String(name).trim(),
        location: String(location || "Main Entrance").trim(),
        department_id: department_id ? parseInt(department_id, 10) : null,
        is_active: is_active !== false,
        status: "online",
        last_seen_at: new Date(),
      },
      update: {
        name: String(name).trim(),
        location: String(location || "Main Entrance").trim(),
        department_id: department_id !== undefined ? (department_id ? parseInt(department_id, 10) : null) : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined,
        updated_at: new Date(),
      },
      include: {
        departments: true,
      },
    });

    return res.status(200).json({
      status: "success",
      kiosk: saved,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a Kiosk definition.
 * DELETE /api/v1/hospitals/:hospital_code/kiosks/:kiosk_code
 */
async function deleteKioskEndpoint(req, res, next) {
  try {
    const hospitalCode = String(req.params.hospital_code || "").trim();
    const kioskCode = String(req.params.kiosk_code || "").trim();

    const hospital = await prisma.hospitals.findUnique({
      where: { hospital_code: hospitalCode },
      select: { id: true },
    });

    if (!hospital) {
      return res.status(404).json({
        status: "error",
        message: `Hospital '${hospitalCode}' not found.`,
      });
    }

    const kiosk = await prisma.kiosks.findFirst({
      where: {
        hospital_id: hospital.id,
        kiosk_code: { equals: kioskCode, mode: "insensitive" },
      },
    });

    if (!kiosk) {
      return res.status(404).json({
        status: "error",
        message: `Kiosk '${kioskCode}' not found.`,
      });
    }

    await prisma.kiosks.delete({
      where: { id: kiosk.id },
    });

    return res.status(200).json({
      status: "success",
      message: `Kiosk terminal '${kioskCode}' deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getKioskEndpoint,
  kioskHeartbeatEndpoint,
  getKioskQueueEndpoint,
  getHospitalKiosksEndpoint,
  upsertKioskEndpoint,
  deleteKioskEndpoint,
};

