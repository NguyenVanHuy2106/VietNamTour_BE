const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllTimeType,
  createTimeType,
  deleteTimeType,
} = require("../controllers/timeType.controller");

// Route thêm user

router.get("/api/timeType/get", getAllTimeType);

router.post("/api/timeType/add", verifyToken, createTimeType);
router.delete("/api/timeType/delete/:id", verifyToken, deleteTimeType);

module.exports = router;
