const {
  saveQuotationPdf,
} = require("../../services/quotation/quotationPdfSave.service");

exports.saveImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: "PDF_REQUIRED",
        message: "Vui lòng gửi kèm file PDF gốc.",
      });
    }

    if (!req.body.data) {
      return res.status(400).json({
        success: false,
        code: "DATA_REQUIRED",
        message: "Vui lòng gửi dữ liệu đã xác nhận.",
      });
    }

    // Tùy middleware verifyToken hiện tại
    const userId = Number(
      req.user?.user_id ??
        req.user?.id ??
        req.user?.userId ??
        req.user?.user_id_number,
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Không xác định được người dùng đăng nhập.",
      });
    }

    const signature = req.file.buffer.subarray(0, 5).toString("ascii");

    if (signature !== "%PDF-") {
      return res.status(400).json({
        success: false,
        code: "INVALID_PDF",
        message: "File tải lên không phải PDF hợp lệ.",
      });
    }

    const result = await saveQuotationPdf({
      file: req.file,
      rawPayload: req.body.data,
      userId,

      // Phải lấy từ thông tin đã xác thực ở Backend.
      userRole: req.user?.role,
    });

    return res.status(201).json({
      success: true,
      message: "Đã lưu yêu cầu báo giá từ PDF thành công.",
      saved: true,
      data: result,
    });
  } catch (error) {
    console.error("[QUOTATION_PDF_SAVE]", error.message);

    const status = error.statusCode || 500;

    return res.status(status).json({
      success: false,
      code: error.code || "PDF_SAVE_FAILED",
      message:
        status >= 500
          ? "Không thể lưu yêu cầu báo giá. Vui lòng kiểm tra log Backend."
          : error.message,
    });
  }
};
