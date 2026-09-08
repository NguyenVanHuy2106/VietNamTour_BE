const express = require("express");
const router = express.Router();

const contractDocumentController = require("../controllers/contractDocument.controller");

// =====================================================
// HỒ SƠ HỢP ĐỒNG
// =====================================================

// Toàn bộ hồ sơ theo hợp đồng
router.get(
  "/api/contracts/:contractId/documents",
  contractDocumentController.getContractDocuments,
);

// Chi tiết settlement
router.get(
  "/api/contracts/:contractId/documents/:settlementId",
  contractDocumentController.getSettlementById,
);

// Sửa settlement
router.put(
  "/api/contracts/:contractId/documents/:settlementId",
  contractDocumentController.updateSettlement,
);

// Xóa settlement
router.delete(
  "/api/contracts/:contractId/documents/:settlementId",
  contractDocumentController.deleteSettlement,
);

// =====================================================
// NGHIỆM THU
// =====================================================

router.get(
  "/api/contracts/:contractId/acceptances",
  contractDocumentController.getAcceptancesForContract,
);

router.post(
  "/api/contracts/:contractId/acceptances",
  contractDocumentController.createAcceptance,
);

// =====================================================
// THANH LÝ
// =====================================================

router.post(
  "/api/contracts/:contractId/liquidations",
  contractDocumentController.createLiquidation,
);

// =====================================================
// NGHIỆM THU + THANH LÝ
// =====================================================

router.post(
  "/api/contracts/:contractId/acceptance-liquidations",
  contractDocumentController.createAcceptanceLiquidation,
);

// =====================================================
// THANH TOÁN
// =====================================================

router.get(
  "/api/contracts/:contractId/payments",
  contractDocumentController.getPayments,
);

router.post(
  "/api/contracts/:contractId/payments",
  contractDocumentController.createPayment,
);

router.put(
  "/api/contracts/:contractId/payments/:paymentId",
  contractDocumentController.updatePayment,
);

router.delete(
  "/api/contracts/:contractId/payments/:paymentId",
  contractDocumentController.deletePayment,
);

// =====================================================
// MẪU 08A
// =====================================================

router.post(
  "/api/contracts/:contractId/form-08a",
  contractDocumentController.createForm08a,
);

router.get(
  "/api/contracts/:contractId/form-08a/:form08aId",
  contractDocumentController.getForm08aById,
);

router.put(
  "/api/contracts/:contractId/form-08a/:form08aId",
  contractDocumentController.updateForm08a,
);

router.delete(
  "/api/contracts/:contractId/form-08a/:form08aId",
  contractDocumentController.deleteForm08a,
);

router.get(
  "/api/contracts/documents/next-number",
  contractDocumentController.getNextDocumentNumber,
);

router.get(
  "/api/contracts/:contractId/documents/:settlementId/export/pdf",
  contractDocumentController.exportSettlementPdf,
);

router.get(
  "/api/contracts/:contractId/documents/:settlementId/export/word",
  contractDocumentController.exportSettlementWord,
);

// ============================================================
// EXPORT MẪU 08A
// ============================================================

router.get(
  "/api/contracts/:contractId/form-08a/:form08aId/export/pdf",
  contractDocumentController.exportForm08aPdf,
);

router.get(
  "/api/contracts/:contractId/form-08a/:form08aId/export/word",
  contractDocumentController.exportForm08aWord,
);

module.exports = router;
