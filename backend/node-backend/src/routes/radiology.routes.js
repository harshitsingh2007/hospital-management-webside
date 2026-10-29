/**
 * radiology.routes.js
 * -------------------
 * Radiology & Imaging endpoints:
 * - Image & DICOM upload handling (stored in backend/uploads/radiology/<hospital>/<ticket>/)
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authenticate } = require("../middleware/auth");
const { hospitalIsolation } = require("../middleware/hospitalIsolation");
const { requireRole } = require("../middleware/role");

const router = express.Router();

const allowedExtensions = [".jpg", ".jpeg", ".png", ".dcm", ".dicom"];
const UPLOAD_ROOT = path.resolve(__dirname, "../../../uploads/radiology");

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const tenant = (
        req.body?.tenant_id ||
        req.query?.tenant_id ||
        req.headers["x-hospital-code"] ||
        req.user?.hospital_code ||
        "default"
      )
        .replace(/[^a-zA-Z0-9_-]/g, "_");

      const ticket = (
        req.body?.ticket_id ||
        req.query?.ticket_id ||
        "general"
      )
        .replace(/[^a-zA-Z0-9_-]/g, "_");

      const targetDir = path.join(UPLOAD_ROOT, tenant, ticket);
      fs.mkdirSync(targetDir, { recursive: true });
      cb(null, targetDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e5)}`;
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(
      new Error(`Unsupported file type: ${ext}. Allowed: JPG, PNG, DICOM (.dcm, .dicom)`)
    );
  }
  cb(null, true);
};

// Limit up to 50MB per file (DICOMs can be large; JPG/PNG checked in handler)
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB hard limit for multer
  },
});

const ALLOWED_RADIOLOGY_ROLES = [
  "radiologist",
  "radiology",
  "radiographer",
  "xray",
  "imaging",
  "radiology_technician",
  "doctor",
  "admin",
  "superadmin",
  "super_admin",
];

router.post(
  "/radiology/upload",
  authenticate,
  hospitalIsolation("tenant_id"),
  requireRole(ALLOWED_RADIOLOGY_ROLES),
  (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          status: "error",
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          status: "error",
          success: false,
          message: err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({
          status: "error",
          success: false,
          message: "No files provided for upload.",
        });
      }

      const tenant = (
        req.body?.tenant_id ||
        req.query?.tenant_id ||
        req.headers["x-hospital-code"] ||
        req.user?.hospital_code ||
        "default"
      ).replace(/[^a-zA-Z0-9_-]/g, "_");

      const ticket = (
        req.body?.ticket_id ||
        req.query?.ticket_id ||
        "general"
      ).replace(/[^a-zA-Z0-9_-]/g, "_");

      const uploadedResults = [];

      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isDicom = ext === ".dcm" || ext === ".dicom";

        // Validate max 10MB for JPG/PNG
        if (!isDicom && file.size > 10 * 1024 * 1024) {
          // Remove invalid file
          if (fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch (_) {}
          }
          return res.status(400).json({
            status: "error",
            success: false,
            message: `File ${file.originalname} exceeds the 10 MB limit for standard images.`,
          });
        }

        // Relative public URL
        const publicUrl = `/uploads/radiology/${tenant}/${ticket}/${file.filename}`;

        uploadedResults.push({
          name: file.originalname,
          filename: file.filename,
          url: publicUrl,
          size: file.size,
          type: isDicom ? "dicom" : "image",
          extension: ext,
        });
      }

      return res.status(200).json({
        status: "success",
        success: true,
        message: `${uploadedResults.length} file(s) uploaded successfully.`,
        data: uploadedResults,
        files: uploadedResults,
      });
    } catch (error) {
      console.error("[Radiology Upload Error]", error);
      return res.status(500).json({
        status: "error",
        success: false,
        message: "Failed to process image upload.",
      });
    }
  }
);

module.exports = router;

