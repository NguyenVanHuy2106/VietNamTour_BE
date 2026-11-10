const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const r2Client = require("../config/r2Client");

const router = express.Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ==================================================
// 1. XÁC THỰC API KEY DÀNH CHO MAKE
// ==================================================

function verifyUploadKey(req, res, next) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Missing Bearer token",
    });
  }

  const suppliedKey = authorization.slice(7).trim();
  const expectedKey = process.env.MAKE_UPLOAD_API_KEY;

  if (!suppliedKey || !expectedKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const suppliedHash = crypto.createHash("sha256").update(suppliedKey).digest();

  const expectedHash = crypto.createHash("sha256").update(expectedKey).digest();

  if (!crypto.timingSafeEqual(suppliedHash, expectedHash)) {
    return res.status(401).json({
      success: false,
      message: "Invalid API key",
    });
  }

  next();
}

// ==================================================
// 2. NHẬN FILE UPLOAD VÀO MEMORY
// ==================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 5,
  },

  fileFilter(req, file, cb) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP");
      error.statusCode = 415;
      return cb(error);
    }

    cb(null, true);
  },
});

// ==================================================
// 3. POST /api/upload/image
// ==================================================

router.post(
  "/api/upload/image",

  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy file image",
        });
      }

      // Kiểm tra file ảnh thật, không chỉ MIME type
      let metadata;

      try {
        metadata = await sharp(req.file.buffer, {
          failOn: "error",
          limitInputPixels: 40000000,
        }).metadata();
      } catch {
        return res.status(415).json({
          success: false,
          message: "Dữ liệu ảnh không hợp lệ",
        });
      }

      if (!["jpeg", "png", "webp"].includes(metadata.format)) {
        return res.status(415).json({
          success: false,
          message: "Định dạng ảnh không được hỗ trợ",
        });
      }

      // Nén và tối ưu ảnh thành WebP
      const optimizedBuffer = await sharp(req.file.buffer, {
        failOn: "error",
        limitInputPixels: 40000000,
      })
        .rotate()
        .resize({
          width: 1920,
          withoutEnlargement: true,
        })
        .webp({
          quality: 82,
          effort: 4,
        })
        .toBuffer();

      // Tạo tên file không trùng
      const fileName = `${Date.now()}-${crypto.randomUUID()}.webp`;

      // Giữ cấu trúc CDN hiện tại
      const fileKey = `uploads/blog/${fileName}`;

      // Upload Cloudflare R2
      const command = new PutObjectCommand({
        Bucket: "uploads",
        Key: fileKey,
        Body: optimizedBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      });

      await r2Client.send(command);

      const publicUrl = `https://cdn.myvietnamtour.vn/${fileKey}`;

      return res.status(201).json({
        success: true,
        message: "Upload ảnh thành công",
        url: publicUrl,
        key: fileKey,
        fileName,
        mimeType: "image/webp",
        size: optimizedBuffer.length,
      });
    } catch (error) {
      console.error("R2 upload error:", {
        name: error.name,
        message: error.message,
      });

      return res.status(500).json({
        success: false,
        message: "Không thể upload ảnh lên Cloudflare R2",
      });
    }
  },
);

// ==================================================
// 4. XỬ LÝ LỖI MULTER
// ==================================================

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "Ảnh vượt quá dung lượng tối đa 10 MB"
          : "Dữ liệu upload không hợp lệ",
    });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
});

module.exports = router;
