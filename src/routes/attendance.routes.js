const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  submitAttendance,
  getUserAttendance,
  getAttendanceHistory,
} = require("../controllers/atendance.controller");

// Route thêm user

router.post("/api/submitAtendance", verifyToken, submitAttendance);
router.post("/api/getUserAtendance", verifyToken, getUserAttendance);
router.post("/api/getAttendanceHistory", verifyToken, getAttendanceHistory);

module.exports = router;
