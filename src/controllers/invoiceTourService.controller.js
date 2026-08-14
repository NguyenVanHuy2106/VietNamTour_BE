const {
  InvoiceTour,
  InvoiceTourService,
  InvoiceServiceInvoice,
} = require("../models");

// ========================================
// THÊM DỊCH VỤ VÀO TOUR
// ========================================
exports.createService = async (req, res) => {
  try {
    const { tourId } = req.params;

    const tour = await InvoiceTour.findByPk(tourId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    const {
      service_type,
      supplier_name,
      service_name,
      description,
      service_amount,
      required_invoice_amount,
      note,
    } = req.body;

    if (!service_type) {
      return res.status(400).json({
        success: false,
        message: "Loại dịch vụ là bắt buộc",
      });
    }

    const service = await InvoiceTourService.create({
      tour_id: tourId,
      service_type,
      supplier_name,
      service_name,
      description,

      service_amount: service_amount || 0,

      required_invoice_amount: required_invoice_amount || 0,

      note,

      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Thêm dịch vụ thành công",
      data: service,
    });
  } catch (error) {
    console.error("createService error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi thêm dịch vụ",
      error: error.message,
    });
  }
};

// ========================================
// LẤY CHI TIẾT DỊCH VỤ
// ========================================
exports.getServiceById = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const service = await InvoiceTourService.findByPk(serviceId, {
      include: [
        {
          model: InvoiceServiceInvoice,
          as: "invoices",
        },
      ],
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ",
      });
    }

    return res.json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error("getServiceById error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin dịch vụ",
      error: error.message,
    });
  }
};

// ========================================
// CẬP NHẬT DỊCH VỤ
// ========================================
exports.updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const service = await InvoiceTourService.findByPk(serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ",
      });
    }

    const {
      service_type,
      supplier_name,
      service_name,
      description,
      service_amount,
      required_invoice_amount,
      note,
    } = req.body;

    await service.update({
      service_type: service_type ?? service.service_type,

      supplier_name: supplier_name ?? service.supplier_name,

      service_name: service_name ?? service.service_name,

      description: description ?? service.description,

      service_amount: service_amount ?? service.service_amount,

      required_invoice_amount:
        required_invoice_amount ?? service.required_invoice_amount,

      note: note ?? service.note,

      updated_at: new Date(),
    });

    return res.json({
      success: true,
      message: "Cập nhật dịch vụ thành công",
      data: service,
    });
  } catch (error) {
    console.error("updateService error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật dịch vụ",
      error: error.message,
    });
  }
};

// ========================================
// XÓA DỊCH VỤ
// ========================================
exports.deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const service = await InvoiceTourService.findByPk(serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ",
      });
    }

    await service.destroy();

    return res.json({
      success: true,
      message: "Xóa dịch vụ thành công",
    });
  } catch (error) {
    console.error("deleteService error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa dịch vụ",
      error: error.message,
    });
  }
};
