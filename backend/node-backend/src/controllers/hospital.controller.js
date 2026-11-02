/**
 * hospital.controller.js
 * ----------------------
 * Hospital & SuperAdmin Operations Controllers.
 */

const prisma = require("../config/prisma");
const {
  checkHospitalCodeAvailable,
  getSuperAdminOverview,
  getAllHospitals,
  getHospitalByCode,
  createHospital,
  updateHospital,
  getHospitalBranding,
  updateHospitalBranding,
  deleteHospital,
  archiveHospital,
  restoreHospital,
  purgeHospital,
  getHospitalPurgeSummary,
  exportHospitalData,
  getHospitalEmployees,
  addHospitalEmployee,
  updateHospitalEmployee,
  updateEmployeePassword,
  deleteHospitalEmployee,
  getHospitalDepartments,
  addHospitalDepartment,
  updateHospitalDepartment,
  deleteHospitalDepartment,
  getHospitalDesks,
  addHospitalDesk,
  updateHospitalDesk,
  assignHospitalDesk,
  deleteHospitalDesk,
  updateDeskStatus,
  bulkUpdateDeskStatus,
  getDatabaseOverview,
  getHospitalVisitHistory,
  getHospitalLiveSummary,
  bulkAddHospitalEmployees,
  bulkAddHospitalVisits,
} = require("../services/hospitalService");
const { verifyHospitalAccess } = require("../middleware/hospitalIsolation");
const { SUPER_ROLES } = require("../middleware/role");
const { getIo } = require("../socket");
const { writeAudit } = require("../utils/auditLogger");
const { validatePassword } = require("../utils/passwordPolicy");

function notifyHospitalChange(req, hospitalCode, eventType = "hospital_data_changed") {
  try {
    const io = req?.app?.get("io") || getIo();
    if (io && hospitalCode) {
      io.to(hospitalCode).emit(eventType, { hospital_code: hospitalCode, timestamp: new Date().toISOString() });
      io.to(`${hospitalCode}:public`).emit(eventType, { hospital_code: hospitalCode, timestamp: new Date().toISOString() });
    }
  } catch (e) {
    // Ignore socket error
  }
}

function notifyDeskChange(req, hospitalCode, deskData = null) {
  try {
    const io = req?.app?.get("io") || getIo();
    if (io && hospitalCode) {
      io.to(hospitalCode).emit("desk_update", {
        hospital_code: hospitalCode,
        desk: deskData,
        timestamp: new Date().toISOString(),
      });

      const publicDesk = deskData && typeof deskData === "object" ? {
        id: deskData.id,
        desk_name: deskData.desk_name,
        desk_number: deskData.desk_number,
        dept_code: deskData.dept_code,
        status: deskData.status,
        is_active: deskData.is_active,
        counter_name: deskData.counter_name,
        deleted: deskData.deleted,
        assigned_employee: deskData.assigned_employee ? {
          id: deskData.assigned_employee.id,
          name: deskData.assigned_employee.name,
          role: deskData.assigned_employee.role,
          designation: deskData.assigned_employee.designation,
          status: deskData.assigned_employee.status,
        } : null,
      } : null;

      io.to(`${hospitalCode}:public`).emit("desk_update", {
        hospital_code: hospitalCode,
        desk: publicDesk,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    // Ignore socket error
  }
}

async function getHospitalInfoEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const hospital = await getHospitalByCode(hospitalCode);
    return res.status(200).json({
      status: "success",
      hospital: hospital || { hospital_code: hospitalCode, name: "Hospital" },
    });
  } catch (error) {
    next(error);
  }
}

async function getSuperadminOverviewEndpoint(req, res, next) {
  try {
    const overview = await getSuperAdminOverview(req.user);
    return res.status(200).json({
      status: "success",
      overview,
    });
  } catch (error) {
    next(error);
  }
}

async function getSuperadminHospitalsEndpoint(req, res, next) {
  try {
    const hospitals = await getAllHospitals(req.user);
    return res.status(200).json({
      status: "success",
      hospitals,
    });
  } catch (error) {
    next(error);
  }
}

async function getPublicHospitalsEndpoint(req, res, next) {
  try {
    const list = await prisma.hospitals.findMany({
      where: { status: "active" },
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
      orderBy: { name: "asc" },
    });
    return res.status(200).json({
      status: "success",
      hospitals: list,
    });
  } catch (error) {
    next(error);
  }
}

async function checkHospitalCodeEndpoint(req, res, next) {
  try {
    const rawCode = req.query.code || "";
    const cleanCode = String(rawCode).trim().toLowerCase();
    if (!cleanCode) {
      return res.status(400).json({ status: "error", message: "Code parameter is required." });
    }
    const isValidFormat = /^[a-z0-9-]+$/.test(cleanCode) && cleanCode.length >= 3 && cleanCode.length <= 40;
    if (!isValidFormat) {
      return res.status(200).json({
        status: "success",
        code: cleanCode,
        available: false,
        valid: false,
        message: "Code must be 3-40 characters and contain only lowercase letters, digits, and hyphens.",
      });
    }

    const available = await checkHospitalCodeAvailable(cleanCode);
    return res.status(200).json({
      status: "success",
      code: cleanCode,
      available,
      valid: true,
      message: available ? "Hospital code is available." : "Hospital code is already in use.",
    });
  } catch (error) {
    next(error);
  }
}

async function createHospitalEndpoint(req, res, next) {
  try {
    const {
      hospital_code,
      name,
      type,
      registration_no,
      nabh_status,
      nabh_number,
      nabh_valid_until,
      established_year,
      total_beds,
      icu_beds,
      logo_url,
      tagline,
      phone,
      alt_phone,
      emergency_helpline,
      email,
      support_email,
      website,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      country,
      maps_link,
      address = "",
      opd_start_time,
      opd_end_time,
      registration_cutoff,
      timezone,
      working_days,
      departments,
      languages,
      admin,
      primary_color,
      secondary_color,
      accent_color,
      about_us,
      description = "",
      status = "active",
    } = req.body;

    // Step 1 Validation
    if (!name || !String(name).trim()) {
      return res.status(400).json({ status: "error", message: "Hospital name is required." });
    }
    const cleanCode = String(hospital_code || "").trim().toLowerCase();
    if (!cleanCode) {
      return res.status(400).json({ status: "error", message: "Hospital code is required." });
    }
    if (!/^[a-z0-9-]+$/.test(cleanCode) || cleanCode.length < 3 || cleanCode.length > 40) {
      return res.status(400).json({
        status: "error",
        message: "Hospital code must be 3-40 characters and contain only lowercase letters, digits, and hyphens.",
      });
    }

    // Step 2 Validation
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ status: "error", message: "Phone number is required." });
    }
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
      return res.status(400).json({ status: "error", message: "A valid official email is required." });
    }
    if (!address_line1 && !address) {
      return res.status(400).json({ status: "error", message: "Address Line 1 is required." });
    }
    if (!city || !String(city).trim()) {
      return res.status(400).json({ status: "error", message: "City is required." });
    }
    if (!state || !String(state).trim()) {
      return res.status(400).json({ status: "error", message: "State is required." });
    }
    const cleanPincode = String(pincode || "").trim();
    if (cleanPincode && !/^\d{6}$/.test(cleanPincode)) {
      return res.status(400).json({ status: "error", message: "PIN code must be a 6-digit number." });
    }

    // Beds validation
    if (total_beds !== undefined && total_beds !== null && total_beds !== "") {
      if (parseInt(total_beds, 10) < 0) {
        return res.status(400).json({ status: "error", message: "Total beds cannot be negative." });
      }
    }
    if (icu_beds !== undefined && icu_beds !== null && icu_beds !== "") {
      if (parseInt(icu_beds, 10) < 0) {
        return res.status(400).json({ status: "error", message: "ICU beds cannot be negative." });
      }
    }

    // Time validation
    if (opd_start_time && opd_end_time && opd_start_time >= opd_end_time) {
      return res.status(400).json({ status: "error", message: "OPD start time must be earlier than OPD end time." });
    }

    // Step 4: Admin validation if requested
    if (admin && admin.create_admin !== false && admin.email) {
      if (!admin.name || !String(admin.name).trim()) {
        return res.status(400).json({ status: "error", message: "Admin full name is required when creating an admin account." });
      }
      if (!/\S+@\S+\.\S+/.test(String(admin.email).trim())) {
        return res.status(400).json({ status: "error", message: "A valid email is required for the admin account." });
      }
      if (admin.password && String(admin.password).length < 6) {
        return res.status(400).json({ status: "error", message: "Admin password must be at least 6 characters." });
      }
    }

    const result = await createHospital({
      hospitalCode: cleanCode,
      name: String(name).trim(),
      type,
      registrationNo: registration_no,
      nabhStatus: nabh_status,
      nabhNumber: nabh_number,
      nabhValidUntil: nabh_valid_until,
      establishedYear: established_year,
      totalBeds: total_beds,
      icuBeds: icu_beds,
      logoUrl: logo_url,
      tagline,
      phone: String(phone).trim(),
      altPhone: alt_phone,
      emergencyHelpline: emergency_helpline,
      email: cleanEmail,
      supportEmail: support_email,
      website,
      addressLine1: address_line1,
      addressLine2: address_line2,
      city: String(city).trim(),
      state: String(state).trim(),
      pincode: cleanPincode,
      country,
      mapsLink: maps_link,
      address,
      opdStartTime: opd_start_time,
      opdEndTime: opd_end_time,
      registrationCutoff: registration_cutoff,
      timezone,
      workingDays: working_days,
      departments,
      languages,
      admin,
      primaryColor: primary_color,
      secondaryColor: secondary_color,
      accentColor: accent_color,
      aboutUs: about_us,
      description,
      status,
      ownerUserId: req.user?.id || null,
    });

    writeAudit(req, {
      action: "hospital_created",
      hospital_id: result.hospital?.id,
      target: result.hospital?.hospital_code,
      meta: { name: result.hospital?.name },
    });

    return res.status(200).json({
      status: "success",
      hospital: result.hospital,
      departments_count: result.departments_count,
      desks_count: result.desks_count,
      admin_user: result.admin_user,
    });
  } catch (error) {
    if (error.status === 409 || error.statusCode === 409) {
      return res.status(409).json({ status: "error", message: error.message });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ status: "error", message: "Hospital code or unique email already exists." });
    }
    next(error);
  }
}

async function getHospitalDetailEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const hospital = await getHospitalByCode(hospitalCode);
    if (!hospital) {
      return res.status(404).json({ status: "error", message: "Hospital not found" });
    }

    return res.status(200).json({
      status: "success",
      hospital,
    });
  } catch (error) {
    next(error);
  }
}

async function updateHospitalEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const updated = await updateHospital(hospitalCode, req.body);
    writeAudit(req, {
      action: "hospital_updated",
      hospital_id: updated?.id,
      target: hospitalCode,
      meta: { name: updated?.name },
    });
    return res.status(200).json({
      status: "success",
      hospital: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function getHospitalBrandingEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const branding = await getHospitalBranding(hospitalCode);
    return res.status(200).json({
      status: "success",
      hospital_code: hospitalCode,
      branding,
    });
  } catch (error) {
    next(error);
  }
}

async function updateHospitalBrandingEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const result = await updateHospitalBranding(hospitalCode, req.body);

    const io = req.app.get("io");
    if (io) {
      io.to(hospitalCode).emit("hospital_branding_updated", {
        hospital_code: hospitalCode,
        branding: result.branding,
      });
      io.emit("hospital_branding_updated", {
        hospital_code: hospitalCode,
        branding: result.branding,
      });
    }

    writeAudit(req, {
      action: "branding_updated",
      target: hospitalCode,
      meta: { hospital_code: hospitalCode },
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function deleteHospitalEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const result = await archiveHospital(hospitalCode);

    writeAudit(req, {
      action: "hospital_archived",
      target: hospitalCode,
      meta: { hospital_code: hospitalCode },
    });

    notifyHospitalChange(req, hospitalCode, "hospital_archived");
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function restoreHospitalEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const result = await restoreHospital(hospitalCode);

    writeAudit(req, {
      action: "hospital_restored",
      target: hospitalCode,
      meta: { hospital_code: hospitalCode },
    });

    notifyHospitalChange(req, hospitalCode, "hospital_restored");
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getHospitalPurgeSummaryEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const result = await getHospitalPurgeSummary(hospitalCode);
    return res.status(200).json({ status: "success", summary: result });
  } catch (error) {
    next(error);
  }
}

async function purgeHospitalEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const { confirm_code } = req.body || {};

    if (!confirm_code || String(confirm_code).trim() !== hospitalCode) {
      return res.status(400).json({
        status: "error",
        message: `Confirmation code mismatch. You must provide confirm_code="${hospitalCode}" to permanently purge.`,
      });
    }

    const result = await purgeHospital(hospitalCode, confirm_code);

    writeAudit(req, {
      action: "hospital_purged",
      target: hospitalCode,
      meta: { hospital_code: hospitalCode, summary: result.summary },
    });

    notifyHospitalChange(req, hospitalCode, "hospital_purged");
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function exportHospitalDataEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const csvContent = await exportHospitalData(hospitalCode);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${hospitalCode}_backup_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
}

async function getHospitalEmployeesEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const employees = await getHospitalEmployees(hospitalCode);
    return res.status(200).json({
      status: "success",
      employees,
    });
  } catch (error) {
    next(error);
  }
}

async function addHospitalEmployeeEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const {
      name,
      email,
      role,
      department,
      employee_id = "",
      phone = "",
      password = "pass123",
      qualification = "",
      specialization = "",
      license_number = "",
      gender = "other",
      experience_years = 0,
      room_number = "",
    } = req.body;

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        status: "error",
        message: pwdCheck.error,
      });
    }

    const employee = await addHospitalEmployee({
      hospitalCode,
      name,
      email,
      role,
      department,
      employeeId: employee_id,
      phone,
      password,
      qualification,
      specialization,
      license_number,
      gender,
      experience_years,
      room_number,
    });

    notifyHospitalChange(req, hospitalCode);

    writeAudit(req, {
      action: "employee_added",
      hospital_id: employee?.hospital_id,
      target: String(employee?.id || email),
      meta: { name, email, role, department },
    });

    return res.status(200).json({
      status: "success",
      employee,
    });
  } catch (error) {
    next(error);
  }
}

async function updateHospitalEmployeeEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const userId = req.params.user_id;

    const updated = await updateHospitalEmployee(userId, req.body);
    notifyHospitalChange(req, hospitalCode);

    writeAudit(req, {
      action: "employee_updated",
      target: String(userId),
      meta: { hospital_code: hospitalCode, updated_fields: Object.keys(req.body || {}) },
    });

    return res.status(200).json({
      status: "success",
      employee: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function updateEmployeePasswordEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const userId = req.params.user_id;
    const { new_password, password } = req.body;
    const targetPassword = new_password || password;

    const pwdCheck = validatePassword(targetPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        status: "error",
        detail: pwdCheck.error,
        message: pwdCheck.error,
      });
    }

    const result = await updateEmployeePassword(userId, targetPassword, hospitalCode, req.user);

    writeAudit(req, {
      action: "employee_password_reset",
      target: String(userId),
      meta: { hospital_code: hospitalCode, target_email: result.email },
    });

    return res.status(200).json({
      status: "success",
      result,
      message: "Password updated successfully",
    });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return res.status(error.status).json({
        status: "error",
        detail: error.message,
        message: error.message,
      });
    }
    next(error);
  }
}

async function deleteHospitalEmployeeEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const userId = req.params.user_id;

    const result = await deleteHospitalEmployee(userId);

    writeAudit(req, {
      action: "employee_deleted",
      target: String(userId),
      meta: { hospital_code: hospitalCode },
    });

    return res.status(200).json({
      status: "success",
      result,
    });
  } catch (error) {
    next(error);
  }
}

async function getHospitalDepartmentsEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const departments = await getHospitalDepartments(hospitalCode);
    return res.status(200).json({
      status: "success",
      departments,
    });
  } catch (error) {
    next(error);
  }
}

async function addHospitalDepartmentEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const { dept_code, name, description = "" } = req.body;
    const department = await addHospitalDepartment(hospitalCode, dept_code, name, description);

    writeAudit(req, {
      action: "department_added",
      target: dept_code,
      meta: { hospital_code: hospitalCode, name },
    });

    return res.status(200).json({
      status: "success",
      department,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteHospitalDepartmentEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const deptCode = req.params.dept_code;

    const result = await deleteHospitalDepartment(hospitalCode, deptCode);

    writeAudit(req, {
      action: "department_deleted",
      target: deptCode,
      meta: { hospital_code: hospitalCode },
    });

    return res.status(200).json({
      status: "success",
      result,
    });
  } catch (error) {
    next(error);
  }
}

async function getHospitalDesksEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const desks = await getHospitalDesks(hospitalCode);
    return res.status(200).json({
      status: "success",
      desks,
    });
  } catch (error) {
    next(error);
  }
}

async function addHospitalDeskEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const { dept_code, desk_name, status = "AVAILABLE", assigned_employee_id } = req.body;

    const desk = await addHospitalDesk(hospitalCode, dept_code, desk_name, status, assigned_employee_id);
    notifyHospitalChange(req, hospitalCode);
    notifyDeskChange(req, hospitalCode, desk);

    writeAudit(req, {
      action: "desk_added",
      target: String(desk?.id || desk_name),
      meta: { hospital_code: hospitalCode, dept_code, desk_name },
    });

    return res.status(200).json({
      status: "success",
      desk,
    });
  } catch (error) {
    next(error);
  }
}

async function assignHospitalDeskEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const deskId = req.params.desk_id;
    const { assigned_employee_id } = req.body;

    const desk = await assignHospitalDesk(hospitalCode, deskId, assigned_employee_id);
    notifyHospitalChange(req, hospitalCode);
    notifyDeskChange(req, hospitalCode, desk);

    writeAudit(req, {
      action: "desk_assigned",
      target: String(deskId),
      meta: { hospital_code: hospitalCode, assigned_employee_id },
    });

    return res.status(200).json({
      status: "success",
      desk,
    });
  } catch (error) {
    next(error);
  }
}

async function updateHospitalDeskEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const deskId = req.params.desk_id;
    const { desk_name, dept_code, assigned_employee_id } = req.body;

    const desk = await updateHospitalDesk(
      hospitalCode,
      deskId,
      desk_name,
      dept_code,
      assigned_employee_id !== undefined ? assigned_employee_id : -1
    );
    notifyHospitalChange(req, hospitalCode);
    notifyDeskChange(req, hospitalCode, desk);

    writeAudit(req, {
      action: "desk_updated",
      target: String(deskId),
      meta: { hospital_code: hospitalCode, desk_name, dept_code },
    });

    return res.status(200).json({
      status: "success",
      desk,
    });
  } catch (error) {
    next(error);
  }
}

async function updateHospitalDepartmentEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const deptCode = req.params.dept_code;
    const { name, description } = req.body;

    const department = await updateHospitalDepartment(hospitalCode, deptCode, name, description);
    notifyHospitalChange(req, hospitalCode);

    writeAudit(req, {
      action: "department_updated",
      target: deptCode,
      meta: { hospital_code: hospitalCode, name },
    });

    return res.status(200).json({
      status: "success",
      department,
    });
  } catch (error) {
    next(error);
  }
}

async function bulkUpdateDeskStatusEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const { dept_code, status } = req.body;

    const result = await bulkUpdateDeskStatus(hospitalCode, dept_code, status);
    notifyHospitalChange(req, hospitalCode);
    notifyDeskChange(req, hospitalCode, result);

    writeAudit(req, {
      action: "desk_bulk_status_updated",
      target: dept_code || "all",
      meta: { hospital_code: hospitalCode, status },
    });

    return res.status(200).json({
      status: "success",
      result,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteHospitalDeskEndpoint(req, res, next) {
  try {
    const deskId = req.params.desk_id;
    const hospitalCode = req.params.hospital_code;
    const result = await deleteHospitalDesk(deskId);
    notifyHospitalChange(req, hospitalCode);
    notifyDeskChange(req, hospitalCode, { id: deskId, deleted: true });

    writeAudit(req, {
      action: "desk_deleted",
      target: String(deskId),
      meta: { hospital_code: hospitalCode },
    });

    return res.status(200).json({
      status: "success",
      result,
    });
  } catch (error) {
    next(error);
  }
}

async function updateDeskStatusEndpoint(req, res, next) {
  try {
    const deskId = req.params.desk_id;
    const hospitalCode = req.params.hospital_code;
    const { status } = req.body;

    const desk = await updateDeskStatus(deskId, status);
    notifyHospitalChange(req, hospitalCode);
    notifyDeskChange(req, hospitalCode, desk);

    writeAudit(req, {
      action: "desk_status_updated",
      target: String(deskId),
      meta: { hospital_code: hospitalCode, status },
    });

    return res.status(200).json({
      status: "success",
      desk,
    });
  } catch (error) {
    next(error);
  }
}

async function getDbOverviewEndpoint(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: Verified authentication required.",
      });
    }

    const userRole = (req.user?.role || "").toLowerCase();
    const isSuper = SUPER_ROLES.includes(userRole) || Boolean(req.user?.is_superadmin);
    if (!isSuper) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden: Database Inspector is strictly restricted to Super Administrators.",
      });
    }

    const hospitalCode = req.query.hospital_code || req.query.tenant_id || null;

    // Audit log access to Database Inspector
    writeAudit(req, {
      action: "db_inspector_accessed",
      target: hospitalCode || "all",
      meta: { requested_hospital: hospitalCode },
    });

    const { tables, hospital, all_hospitals } = await getDatabaseOverview(hospitalCode);
    return res.status(200).json({
      status: "success",
      db_info: {
        engine: "PostgreSQL",
        database: "ai_queue",
        status: "Connected",
        hospital_code: hospital?.hospital_code || "",
        hospital_name: hospital?.name || "",
      },
      hospital_info: hospital,
      all_hospitals: all_hospitals,
      database: tables,
    });
  } catch (error) {
    next(error);
  }
}

async function getHospitalVisitsEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const limit = parseInt(req.query.limit, 10) || 500;
    const period = req.query.period || null;
    const history = await getHospitalVisitHistory(hospitalCode, limit, period);
    if (!history) {
      return res.status(404).json({
        status: "error",
        message: "Hospital not found",
      });
    }
    return res.status(200).json({
      status: "success",
      ...history,
    });
  } catch (error) {
    next(error);
  }
}

async function getHospitalLiveSummaryEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const summary = await getHospitalLiveSummary(hospitalCode);
    if (!summary) {
      return res.status(404).json({
        status: "error",
        message: "Hospital not found",
      });
    }
    return res.status(200).json({
      status: "success",
      ...summary,
    });
  } catch (error) {
    next(error);
  }
}

async function bulkAddHospitalEmployeesEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const { employees } = req.body;
    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No employee records provided.",
      });
    }
    const result = await bulkAddHospitalEmployees(hospitalCode, employees);
    return res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

async function bulkAddHospitalVisitsEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const { visits } = req.body;
    if (!Array.isArray(visits) || visits.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No patient visit records provided.",
      });
    }
    const result = await bulkAddHospitalVisits(hospitalCode, visits);
    return res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkHospitalCodeEndpoint,
  getHospitalInfoEndpoint,
  getPublicHospitalsEndpoint,
  getSuperadminOverviewEndpoint,
  getSuperadminHospitalsEndpoint,
  createHospitalEndpoint,
  getHospitalDetailEndpoint,
  updateHospitalEndpoint,
  getHospitalBrandingEndpoint,
  updateHospitalBrandingEndpoint,
  deleteHospitalEndpoint,
  restoreHospitalEndpoint,
  getHospitalPurgeSummaryEndpoint,
  purgeHospitalEndpoint,
  exportHospitalDataEndpoint,
  getHospitalEmployeesEndpoint,
  addHospitalEmployeeEndpoint,
  updateHospitalEmployeeEndpoint,
  updateEmployeePasswordEndpoint,
  deleteHospitalEmployeeEndpoint,
  getHospitalDepartmentsEndpoint,
  addHospitalDepartmentEndpoint,
  updateHospitalDepartmentEndpoint,
  deleteHospitalDepartmentEndpoint,
  getHospitalDesksEndpoint,
  addHospitalDeskEndpoint,
  updateHospitalDeskEndpoint,
  assignHospitalDeskEndpoint,
  deleteHospitalDeskEndpoint,
  updateDeskStatusEndpoint,
  bulkUpdateDeskStatusEndpoint,
  getDbOverviewEndpoint,
  getHospitalVisitsEndpoint,
  getHospitalLiveSummaryEndpoint,
  bulkAddHospitalEmployeesEndpoint,
  bulkAddHospitalVisitsEndpoint,
};
