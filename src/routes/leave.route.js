const express = require("express");

const router = express.Router();

const {
  getLeaveConfig,
  saveLeaveConfig,
} = require("../controllers/leave/leaveConfig.controller");

const {
  getUserLeaveAccruals,
} = require("../controllers/leave/leaveAccrual.controller");

const {
  getMyLeaveBalance,
  getMyLeaveRequests,
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveRequests,
  getLeaveBalances,
  processLeaveRequest,
} = require("../controllers/leave/leaveRequest.controller");

const { verifyToken } = require("../middlewares/auth");

// =====================================================
// NHÂN VIÊN
// =====================================================

// Lấy quỹ phép của bản thân
router.get("/api/my-balance", verifyToken, getMyLeaveBalance);

// Lấy danh sách phiếu nghỉ phép của bản thân
router.get("/api/my-requests", verifyToken, getMyLeaveRequests);

// Tạo phiếu đăng ký nghỉ phép
router.post("/api/request", verifyToken, createLeaveRequest);

// Hủy phiếu đang chờ duyệt
router.put(
  "/api/request/:leaveRequestId/cancel",
  verifyToken,
  cancelLeaveRequest,
);

// =====================================================
// ADMIN - QUẢN LÝ PHÉP
// =====================================================

// Danh sách phiếu nghỉ phép
router.get("/api/requests", verifyToken, getLeaveRequests);

// Danh sách quỹ phép nhân viên
router.get("/api/balances", verifyToken, getLeaveBalances);

router.put(
  "/api/request/:leaveRequestId/decision",
  verifyToken,
  processLeaveRequest,
);

// =====================================================
// CẤU HÌNH PHÉP
// =====================================================

// Lấy cấu hình phép của nhân viên
router.get("/api/config/:userId", verifyToken, getLeaveConfig);

// Tạo / cập nhật cấu hình phép
router.post("/api/config", verifyToken, saveLeaveConfig);

// =====================================================
// CỘNG PHÉP
// =====================================================

// Lấy lịch sử cộng phép của nhân viên
router.get("/api/accrual/:userId", verifyToken, getUserLeaveAccruals);

module.exports = router;
