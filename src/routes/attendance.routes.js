const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  submitAttendance,
  getUserAttendance,
  getAttendanceHistory,
  submitCheckOut,
  adminAdjustAttendance,
} = require("../controllers/atendance.controller");

// Route thêm user

router.post("/api/submitAtendance", verifyToken, submitAttendance);
router.post("/api/getUserAtendance", verifyToken, getUserAttendance);
router.post("/api/getAttendanceHistory", verifyToken, getAttendanceHistory);
router.post("/api/submitCheckout", verifyToken, submitCheckOut);
router.post("/api/admin/adjustAttendance", verifyToken, adminAdjustAttendance);

module.exports = router;
