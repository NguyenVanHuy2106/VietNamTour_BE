const { InvoiceTourService, InvoiceServiceInvoice } = require("../models");

// ========================================
// THÊM HÓA ĐƠN CHO DỊCH VỤ
// ========================================
exports.createInvoice = async (req, res) => {
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
      invoice_number,
      invoice_date,
      invoice_amount,
      supplier_name,
      note,
    } = req.body;

    if (invoice_amount === undefined || invoice_amount === null) {
      return res.status(400).json({
        success: false,
        message: "Số tiền hóa đơn là bắt buộc",
      });
    }

    if (Number(invoice_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tiền hóa đơn phải lớn hơn 0",
      });
    }

    const invoice = await InvoiceServiceInvoice.create({
      service_id: serviceId,
      invoice_number,
      invoice_date,
      invoice_amount,
      supplier_name: supplier_name || service.supplier_name,
      note,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Thêm hóa đơn thành công",
      data: invoice,
    });
  } catch (error) {
    console.error("createInvoice error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi thêm hóa đơn",
      error: error.message,
    });
  }
};

// ========================================
// CẬP NHẬT HÓA ĐƠN
// ========================================
exports.updateInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await InvoiceServiceInvoice.findByPk(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    const {
      invoice_number,
      invoice_date,
      invoice_amount,
      supplier_name,
      note,
    } = req.body;

    if (invoice_amount !== undefined && Number(invoice_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tiền hóa đơn phải lớn hơn 0",
      });
    }

    await invoice.update({
      invoice_number: invoice_number ?? invoice.invoice_number,

      invoice_date: invoice_date ?? invoice.invoice_date,

      invoice_amount: invoice_amount ?? invoice.invoice_amount,

      supplier_name: supplier_name ?? invoice.supplier_name,

      note: note ?? invoice.note,

      updated_at: new Date(),
    });

    return res.json({
      success: true,
      message: "Cập nhật hóa đơn thành công",
      data: invoice,
    });
  } catch (error) {
    console.error("updateInvoice error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật hóa đơn",
      error: error.message,
    });
  }
};

// ========================================
// XÓA HÓA ĐƠN
// ========================================
exports.deleteInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await InvoiceServiceInvoice.findByPk(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn",
      });
    }

    await invoice.destroy();

    return res.json({
      success: true,
      message: "Xóa hóa đơn thành công",
    });
  } catch (error) {
    console.error("deleteInvoice error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa hóa đơn",
      error: error.message,
    });
  }
};
