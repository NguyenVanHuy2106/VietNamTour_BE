const express = require("express");
const multer = require("multer");

const router = express.Router();

const { verifyToken } = require("../middlewares/auth");

const {
  importFromPdf,
} = require("../controllers/quotation/quotationPdf.controller");

const {
  saveImport,
} = require("../controllers/quotation/quotationPdfSave.controller");

// ==========================================================
// MULTER CONFIG - PDF UPLOAD
// ==========================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 15 * 1024 * 1024, // Tối đa 15MB
    files: 1,
  },

  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" &&
      file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return cb(new Error("Chỉ chấp nhận file PDF."), false);
    }

    cb(null, true);
  },
});

// ==========================================================
// MULTER MIDDLEWARE
// ==========================================================

const uploadPdf = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        success: false,
        code: error.code || "UPLOAD_ERROR",
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Dung lượng file PDF tối đa là 15MB."
            : error.message,
      });
    }

    next();
  });
};

// ==========================================================
// IMPORT PDF - PREVIEW ONLY (KHÔNG LƯU DATABASE)
// ==========================================================

// ==========================================================
// IMPORT PDF - PREVIEW ONLY
// ==========================================================

router.post(
  "/api/quotationRequest/import-from-pdf",
  verifyToken,
  uploadPdf,
  importFromPdf,
);

// ==========================================================
// SAVE IMPORT - LƯU DATABASE
// ==========================================================

router.post(
  "/api/quotationRequest/save-import",
  verifyToken,
  uploadPdf,
  saveImport,
);
module.exports = router;
