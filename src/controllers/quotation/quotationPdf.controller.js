const {
  extractProcurementPdf,
} = require("../../services/quotation/quotationPdf.service");

exports.importFromPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: "PDF_REQUIRED",
        message: "Vui lòng tải lên file PDF yêu cầu báo giá.",
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

    const data = await extractProcurementPdf(
      req.file.buffer,
      req.file.originalname,
    );

    const { warnings = [], ...previewData } = data;

    const hasRequiredData = Boolean(
      previewData.request_name && previewData.procuring_entity,
    );

    return res.status(200).json({
      success: true,
      message: "Đã phân tích PDF. Vui lòng kiểm tra thông tin trước khi lưu.",
      extractionStatus: !hasRequiredData
        ? "REVIEW_REQUIRED"
        : warnings.length
          ? "PARTIAL"
          : "EXTRACTED",
      file: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: "application/pdf",
        pageCount: data.page_count,
      },
      data: previewData,
      warnings,
      saved: false,
    });
  } catch (error) {
    console.error("[QUOTATION_PDF]", error);

    return res.status(error.statusCode || 422).json({
      success: false,
      code: error.code || "PDF_EXTRACTION_FAILED",
      message:
        error.statusCode === 422
          ? error.message
          : "Không thể phân tích file PDF.",
    });
  }
};
