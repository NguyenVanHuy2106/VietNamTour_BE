// File: src/routes/contract.routes.js

const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middlewares/auth");

const {
  createContract,
  getContracts,
  getContractById,
  updateContract,
  updateContractStatus,
  deleteContract,
  getContractStatistics,
  getNextContractCode,
  exportContractWord,
  exportContractPdf,
} = require("../controllers/contract.controller");

// ========================================
// LẤY DANH SÁCH HỢP ĐỒNG
// ========================================

router.get("/api/contracts/get", getContracts);

// ========================================
// LẤY THỐNG KÊ HỢP ĐỒNG
// ========================================

router.get("/api/contracts/statistics", getContractStatistics);

// ========================================
// LẤY CHI TIẾT HỢP ĐỒNG
// ========================================

router.get("/api/contracts/get/:contractId", getContractById);

// ========================================
// TẠO HỢP ĐỒNG
// ========================================

router.post("/api/contracts/add", verifyToken, createContract);

// ========================================
// CẬP NHẬT HỢP ĐỒNG
// ========================================

router.put("/api/contracts/update/:contractId", verifyToken, updateContract);

// ========================================
// CẬP NHẬT TRẠNG THÁI HỢP ĐỒNG
// ========================================

router.put(
  "/api/contracts/update-status/:contractId",
  verifyToken,
  updateContractStatus,
);

// ========================================
// XÓA HỢP ĐỒNG
// ========================================

router.delete("/api/contracts/delete/:contractId", verifyToken, deleteContract);

// ============================================================
// LẤY SỐ HỢP ĐỒNG TIẾP THEO
// ============================================================

router.get("/api/contracts/next-code", verifyToken, getNextContractCode);

// ============================================================
// EXPORT PDF
// ============================================================

router.get("/api/contracts/export-pdf/:id", verifyToken, exportContractPdf);

// ============================================================
// EXPORT WORD
// ============================================================

router.get("/api/contracts/export-word/:id", verifyToken, exportContractWord);

module.exports = router;
