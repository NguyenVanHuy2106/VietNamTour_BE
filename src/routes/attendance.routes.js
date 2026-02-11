const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  submitAttendance,
  getUserAttendance,
} = require("../controllers/atendance.controller");

// Route thêm user

router.post("/api/submitAtendance", verifyToken, submitAttendance);
router.post("/api/getUserAtendance", verifyToken, getUserAttendance);

module.exports = router;
