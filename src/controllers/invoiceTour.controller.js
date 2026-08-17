const {
  InvoiceTour,
  InvoiceTourService,
  InvoiceServiceInvoice,
} = require("../models");

// ========================================
// TẠO TOUR
// ========================================
exports.createTour = async (req, res) => {
  try {
    const {
      tour_code,
      tour_name,
      customer_name,
      departure_date,
      return_date,
      output_amount,
      note,
    } = req.body;

    if (!tour_code || !tour_name) {
      return res.status(400).json({
        success: false,
        message: "Mã tour và tên tour là bắt buộc",
      });
    }

    const tour = await InvoiceTour.create({
      tour_code,
      tour_name,
      customer_name,
      departure_date,
      return_date,
      output_amount: output_amount || 0,
      note,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Tạo tour thành công",
      data: tour,
    });
  } catch (error) {
    console.error("createTour error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo tour",
      error: error.message,
    });
  }
};

// ========================================
// LẤY DANH SÁCH TOUR
// ========================================
exports.getTours = async (req, res) => {
  try {
    const tours = await InvoiceTour.findAll({
      order: [["tour_id", "DESC"]],
    });

    return res.json({
      success: true,
      data: tours,
    });
  } catch (error) {
    console.error("getTours error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách tour",
      error: error.message,
    });
  }
};

// ========================================
// LẤY CHI TIẾT TOUR
// Bao gồm services + invoices
// ========================================
exports.getTourById = async (req, res) => {
  try {
    const { tourId } = req.params;

    const tour = await InvoiceTour.findByPk(tourId, {
      include: [
        {
          model: InvoiceTourService,
          as: "services",
          separate: true,
          order: [["service_id", "ASC"]],
          include: [
            {
              model: InvoiceServiceInvoice,
              as: "invoices",
            },
          ],
        },
      ],
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    return res.json({
      success: true,
      data: tour,
    });
  } catch (error) {
    console.error("getTourById error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin tour",
      error: error.message,
    });
  }
};

// ========================================
// CẬP NHẬT TOUR
// ========================================
exports.updateTour = async (req, res) => {
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
      tour_code,
      tour_name,
      customer_name,
      departure_date,
      return_date,
      output_amount,
      note,
    } = req.body;

    await tour.update({
      tour_code: tour_code ?? tour.tour_code,
      tour_name: tour_name ?? tour.tour_name,
      customer_name: customer_name ?? tour.customer_name,
      departure_date: departure_date ?? tour.departure_date,
      return_date: return_date ?? tour.return_date,
      output_amount: output_amount ?? tour.output_amount,
      note: note ?? tour.note,
      updated_at: new Date(),
    });

    return res.json({
      success: true,
      message: "Cập nhật tour thành công",
      data: tour,
    });
  } catch (error) {
    console.error("updateTour error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật tour",
      error: error.message,
    });
  }
};

// ========================================
// XÓA TOUR
// ========================================
exports.deleteTour = async (req, res) => {
  try {
    const { tourId } = req.params;

    const tour = await InvoiceTour.findByPk(tourId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    await tour.destroy();

    return res.json({
      success: true,
      message: "Xóa tour thành công",
    });
  } catch (error) {
    console.error("deleteTour error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa tour",
      error: error.message,
    });
  }
};

// ========================================
// TỔNG KẾT TOUR
// ========================================
exports.getTourSummary = async (req, res) => {
  try {
    const { tourId } = req.params;

    const tour = await InvoiceTour.findByPk(tourId, {
      include: [
        {
          model: InvoiceTourService,
          as: "services",
          include: [
            {
              model: InvoiceServiceInvoice,
              as: "invoices",
            },
          ],
        },
      ],
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour",
      });
    }

    let totalServiceAmount = 0;

    // Không cộng required_invoice_amount của service
    // để tính tổng cần lấy của tour nữa
    let totalInvoiceReceived = 0;

    const services = (tour.services || []).map((service) => {
      const serviceAmount = Number(service.service_amount) || 0;

      const requiredInvoiceAmount =
        Number(service.required_invoice_amount) || 0;

      // Tổng hóa đơn đã lấy của riêng dịch vụ này
      const invoicedAmount = (service.invoices || []).reduce(
        (sum, invoice) => sum + (Number(invoice.invoice_amount) || 0),
        0,
      );

      // Còn thiếu của RIÊNG DỊCH VỤ
      const missingAmount = Math.max(requiredInvoiceAmount - invoicedAmount, 0);

      // ========================================
      // TRẠNG THÁI RIÊNG TỪNG DỊCH VỤ
      // ========================================

      let status = "NOT_INVOICED";

      if (invoicedAmount > 0 && invoicedAmount < requiredInvoiceAmount) {
        status = "PARTIAL";
      }

      if (
        requiredInvoiceAmount === 0 ||
        invoicedAmount >= requiredInvoiceAmount
      ) {
        status = "COMPLETED";
      }

      // ========================================
      // TỔNG TOUR
      // ========================================

      totalServiceAmount += serviceAmount;

      // Chỉ cộng số hóa đơn thực tế đã lấy
      totalInvoiceReceived += invoicedAmount;

      return {
        service_id: service.service_id,
        service_type: service.service_type,
        service_name: service.service_name,
        supplier_name: service.supplier_name,

        service_amount: serviceAmount,

        // Vẫn giữ số cần lấy riêng của service
        required_invoice_amount: requiredInvoiceAmount,

        invoiced_amount: invoicedAmount,

        missing_amount: missingAmount,

        status,

        invoices: service.invoices,
      };
    });

    // ========================================
    // RULE MỚI:
    // CẦN LẤY HÓA ĐƠN TOÀN TOUR
    // = SỐ TIỀN XUẤT CHO KHÁCH
    // ========================================

    const outputAmount = Number(tour.output_amount) || 0;

    const totalRequiredInvoice = outputAmount;

    // ========================================
    // CÒN THIẾU TOÀN TOUR
    // ========================================

    const totalMissingInvoice = Math.max(
      totalRequiredInvoice - totalInvoiceReceived,
      0,
    );

    return res.json({
      success: true,

      data: {
        tour_id: tour.tour_id,
        tour_code: tour.tour_code,
        tour_name: tour.tour_name,
        customer_name: tour.customer_name,
        departure_date: tour.departure_date,
        return_date: tour.return_date,

        // Số xuất khách
        output_amount: outputAmount,

        // Tổng chi phí dịch vụ
        total_service_amount: totalServiceAmount,

        // ==================================
        // RULE MỚI
        // = output_amount
        // ==================================
        total_required_invoice: totalRequiredInvoice,

        // Tổng hóa đơn đã lấy
        total_invoice_received: totalInvoiceReceived,

        // Còn thiếu
        total_missing_invoice: totalMissingInvoice,

        services,
      },
    });
  } catch (error) {
    console.error("getTourSummary error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi tổng kết tour",
      error: error.message,
    });
  }
};
