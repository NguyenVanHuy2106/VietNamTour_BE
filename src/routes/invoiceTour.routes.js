const express = require("express");
const router = express.Router();

const invoiceTourController = require("../controllers/invoiceTour.controller");
const invoiceTourServiceController = require("../controllers/invoiceTourService.controller");
const invoiceServiceInvoiceController = require("../controllers/invoiceServiceInvoice.controller");

// ========================================
// TOUR
// ========================================

// Lấy danh sách tour
router.get("/api/invoice-tours", invoiceTourController.getTours);

// Tạo tour mới
router.post("/api/invoice-tours/add", invoiceTourController.createTour);

// Lấy chi tiết tour
router.get("/api/invoice-tours/:tourId", invoiceTourController.getTourById);

// Cập nhật tour
router.put("/api/invoice-tours/:tourId", invoiceTourController.updateTour);

// Xóa tour
router.delete("/api/invoice-tours/:tourId", invoiceTourController.deleteTour);

// Tổng kết / đối soát tour
router.get(
  "/api/invoice-tours/:tourId/summary",
  invoiceTourController.getTourSummary,
);

// ========================================
// DỊCH VỤ TOUR
// ========================================

// Thêm dịch vụ vào tour
router.post(
  "/api/invoice-tours/:tourId/services/add",
  invoiceTourServiceController.createService,
);

// Lấy chi tiết dịch vụ
router.get(
  "/api/invoice-tour-services/:serviceId",
  invoiceTourServiceController.getServiceById,
);

// Cập nhật dịch vụ
router.put(
  "/api/invoice-tour-services/:serviceId",
  invoiceTourServiceController.updateService,
);

// Xóa dịch vụ
router.delete(
  "/api/invoice-tour-services/:serviceId",
  invoiceTourServiceController.deleteService,
);

// ========================================
// HÓA ĐƠN DỊCH VỤ
// ========================================

// Thêm hóa đơn cho dịch vụ
router.post(
  "/api/invoice-tour-services/:serviceId/invoices/add",
  invoiceServiceInvoiceController.createInvoice,
);

// Cập nhật hóa đơn
router.put(
  "/api/invoice-service-invoices/:invoiceId",
  invoiceServiceInvoiceController.updateInvoice,
);

// Xóa hóa đơn
router.delete(
  "/api/invoice-service-invoices/:invoiceId",
  invoiceServiceInvoiceController.deleteInvoice,
);

module.exports = router;
