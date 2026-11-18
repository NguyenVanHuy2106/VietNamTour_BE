const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middlewares/auth");

const {
  createRequest,
  getRequests,
  getRequestDetail,
  updateRequest,
  assignRequest,
  updateRequestStatus,
  deleteRequest,
  getRequestHistory,
  getMyRequests,
  getRequestStats,
} = require("../controllers/quotation/quotationRequest.controller");

const {
  getMyTeamRequests,
  getMyTeamRequestDetail,
  getMyTeamRequestHistory,
  updateMyTeamRequestStatus,
} = require("../controllers/quotation/quotationRequestTeam.controller");

// ============================================================
// QUOTATION REQUEST ROUTES - VIET NAM TOUR ERP
//
// Các endpoint đều có prefix /api/quotationRequest
// Tất cả API sử dụng middleware verifyToken
// ============================================================

router.get(
  "/api/quotationRequest/team/my-list",
  verifyToken,
  getMyTeamRequests,
);

router.get(
  "/api/quotationRequest/team/:id/history",
  verifyToken,
  getMyTeamRequestHistory,
);

router.get(
  "/api/quotationRequest/team/:id",
  verifyToken,
  getMyTeamRequestDetail,
);

router.put(
  "/api/quotationRequest/team/:id/status",
  verifyToken,
  updateMyTeamRequestStatus,
);
// ============================================================
// 1. DANH SÁCH YÊU CẦU CỦA NHÂN VIÊN / NHÓM
//
// GET /api/quotationRequest/my-list?user_id=1001
// ============================================================

router.get("/api/quotationRequest/my-list", verifyToken, getMyRequests);

// ============================================================
// 2. THỐNG KÊ YÊU CẦU BÁO GIÁ
//
// GET /api/quotationRequest/stats
// ============================================================

router.get("/api/quotationRequest/stats", verifyToken, getRequestStats);

// ============================================================
// 3. DANH SÁCH TẤT CẢ YÊU CẦU BÁO GIÁ
//
// GET /api/quotationRequest
// ============================================================

router.get("/api/quotationRequest", verifyToken, getRequests);

// ============================================================
// 4. TẠO YÊU CẦU BÁO GIÁ
//
// POST /api/quotationRequest
//
// Body: created_by, team_id, requestName,
// notificationCode, attachments...
// ============================================================

router.post("/api/quotationRequest", verifyToken, createRequest);

// ============================================================
// 5. LỊCH SỬ XỬ LÝ YÊU CẦU
//
// GET /api/quotationRequest/:id/history
// ============================================================

router.get("/api/quotationRequest/:id/history", verifyToken, getRequestHistory);

// ============================================================
// 6. PHÂN CÔNG / CHUYỂN NHÓM KINH DOANH
//
// PUT /api/quotationRequest/:id/assign
//
// Body:
// {
//   "team_id": 2,
//   "performed_by": 1001,
//   "reason": "Chuyển nhóm phụ trách"
// }
// ============================================================

router.put("/api/quotationRequest/:id/assign", verifyToken, assignRequest);

// ============================================================
// 7. CẬP NHẬT TRẠNG THÁI YÊU CẦU
//
// PUT /api/quotationRequest/:id/status
//
// Body:
// {
//   "status": "PROCESSING",
//   "performed_by": 1001,
//   "reason": "Đang xử lý báo giá"
// }
// ============================================================

router.put(
  "/api/quotationRequest/:id/status",
  verifyToken,
  updateRequestStatus,
);

// ============================================================
// 8. XEM CHI TIẾT YÊU CẦU
//
// GET /api/quotationRequest/:id
// ============================================================

router.get("/api/quotationRequest/:id", verifyToken, getRequestDetail);

// ============================================================
// 9. CẬP NHẬT THÔNG TIN YÊU CẦU
//
// PUT /api/quotationRequest/:id
//
// Body: updated_by và các trường cần chỉnh sửa
// ============================================================

router.put("/api/quotationRequest/:id", verifyToken, updateRequest);

// ============================================================
// 10. XÓA MỀM YÊU CẦU
//
// DELETE /api/quotationRequest/:id
//
// Body:
// {
//   "performed_by": 1001,
//   "reason": "Không tiếp tục xử lý"
// }
// ============================================================

router.delete("/api/quotationRequest/:id", verifyToken, deleteRequest);

module.exports = router;
