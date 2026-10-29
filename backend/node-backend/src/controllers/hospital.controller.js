/**
 * hospital.controller.js
 * ----------------------
 * Hospital & SuperAdmin Operations Controllers.
 */

const prisma = require("../config/prisma");
const {
  getSuperAdminOverview,
  getAllHospitals,
  getHospitalByCode,
  createHospital,
  updateHospital,
  getHospitalBranding,
  updateHospitalBranding,
  deleteHospital,
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
  bulkAddHospitalEmployees,
  bulkAddHospitalVisits,
} = require("../services/hospitalService");
const { verifyHospitalAccess } = require("../middleware/hospitalIsolation");
const { getIo } = require("../socket");

function notifyHospitalChange(req, hospitalCode, eventType = "hospital_data_changed") {
  try {
    const io = req?.app?.get("io") || getIo();
    if (io && hospitalCode) {
      io.to(hospitalCode).emit(eventType, { hospital_code: hospitalCode, timestamp: new Date().toISOString() });
      io.emit(eventType, { hospital_code: hospitalCode, timestamp: new Date().toISOString() });
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

async function createHospitalEndpoint(req, res, next) {
  try {
    const {
      hospital_code,
      name,
      address = "",
      phone = "",
      email = "",
      description = "",
      logo_url = "",
      status = "active",
    } = req.body;

    if (!hospital_code || !name) {
      return res.status(400).json({ status: "error", message: "Hospital code and name are required." });
    }

    const hospital = await createHospital({
      hospitalCode: hospital_code,
      name,
      address,
      phone,
      email,
      description,
      logoUrl: logo_url,
      status,
      ownerUserId: req.user?.id || null,
    });

    return res.status(200).json({
      status: "success",
      hospital,
    });
  } catch (error) {
    next(error);
  }
}

async function getHospitalDetailEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have access to this hospital's resources.",
        });
      }
    }

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
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have ownership of this hospital.",
        });
      }
    }

    const updated = await updateHospital(hospitalCode, req.body);
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
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have permission to customize this hospital's branding.",
        });
      }
    }

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

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function deleteHospitalEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have ownership of this hospital.",
        });
      }
    }

    const result = await deleteHospital(hospitalCode);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getHospitalEmployeesEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have access to this hospital's employees.",
        });
      }
    }

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
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You cannot provision employees for another hospital.",
        });
      }
    }

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

    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have access to manage this employee.",
        });
      }
    }

    const updated = await updateHospitalEmployee(userId, req.body);
    notifyHospitalChange(req, hospitalCode);
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

    if (!targetPassword || String(targetPassword).trim().length < 4) {
      return res.status(400).json({
        status: "error",
        detail: "Password must be at least 4 characters.",
      });
    }

    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          detail: "Forbidden: You do not have access to manage this employee's credentials.",
        });
      }
    }

    const result = await updateEmployeePassword(userId, targetPassword);
    return res.status(200).json({
      status: "success",
      result,
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

async function deleteHospitalEmployeeEndpoint(req, res, next) {
  try {
    const hospitalCode = req.params.hospital_code;
    const userId = req.params.user_id;

    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have access to delete this employee.",
        });
      }
    }

    const result = await deleteHospitalEmployee(userId);
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
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have access to this hospital's departments.",
        });
      }
    }

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
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You cannot modify departments for another hospital.",
        });
      }
    }

    const { dept_code, name, description = "" } = req.body;
    const department = await addHospitalDepartment(hospitalCode, dept_code, name, description);

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

    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You cannot delete departments from another hospital.",
        });
      }
    }

    const result = await deleteHospitalDepartment(hospitalCode, deptCode);
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
    if (req.user) {
      const allowed = await verifyHospitalAccess(hospitalCode, req.user);
      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden: You do not have access to this hospital's desks.",
        });
      }
    }

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
    let hospitalCode = req.query.hospital_code || req.query.tenant_id || null;

    // Enforce role authorization: Only Receptionist, Staff, and Super Admin can access Database Inspector
    const userRole = (req.user?.role || req.query?.role || "").toLowerCase();
    if (userRole === "doctor" || userRole === "user" || userRole === "patient") {
      return res.status(403).json({
        status: "error",
        message: "Forbidden: Database Inspector is restricted to Receptionists, Staff, and Super Admins only.",
      });
    }

    if (userRole !== "super_admin" && userRole !== "superadmin") {
      if (req.user?.hospital_code && req.user.hospital_code !== "all") {
        hospitalCode = req.user.hospital_code;
      }
    }

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
    const history = await getHospitalVisitHistory(hospitalCode, limit);
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
  bulkAddHospitalEmployeesEndpoint,
  bulkAddHospitalVisitsEndpoint,
};
