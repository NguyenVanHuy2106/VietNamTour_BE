const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  requireQuotationAdmin,
  getTeams,
  getTeamDetail,
  createTeam,
  updateTeam,
  getMembers,
  assignMember,
  removeMember,
  getHistory,
  getMyTeam,
  getTeamAdmin,
  setTeamAdmin,
} = require("../controllers/quotation/quotationTeam.controller");

// Middleware JWT: import đúng từ hệ thống hiện tại.
// Ví dụ: const { verifyToken } = require("../middlewares/auth.middleware");

// Nhân viên xem nhóm của mình
router.get("/api/quotationTeam/my-team", verifyToken, getMyTeam);

// Các API quản trị
router.get(
  "/api/quotationTeam/members",
  verifyToken,

  getMembers,
);

router.post(
  "/api/quotationTeam/assign",
  verifyToken,

  assignMember,
);

router.delete(
  "/api/quotationTeam/members/:userId",
  verifyToken,

  removeMember,
);

router.get(
  "/api/quotationTeam/history",
  verifyToken,

  getHistory,
);

router.get("/api/quotationTeam", verifyToken, getTeams);

router.post("/api/quotationTeam", verifyToken, createTeam);

router.get(
  "/api/quotationTeam/:teamId",
  verifyToken,

  getTeamDetail,
);

router.put(
  "/api/quotationTeam/:teamId",
  verifyToken,

  updateTeam,
);

// ============================================================
// QUOTATION TEAM - ADMIN ROLE
// ============================================================

// Xem Admin hiện tại của nhóm
router.get("/api/quotationTeam/:teamId/admin", verifyToken, getTeamAdmin);

// Bổ nhiệm, chuyển quyền hoặc thu hồi Admin
// Chỉ quản trị phân hệ được phép thực hiện
router.put(
  "/api/quotationTeam/:teamId/admin",
  verifyToken,
  requireQuotationAdmin,
  setTeamAdmin,
);

module.exports = router;
