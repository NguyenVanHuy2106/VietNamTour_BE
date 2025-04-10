const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllTimeType,
  createTimeType,
} = require("../controllers/timeType.controller");

// Route thêm user

router.get("/api/timeType/get", getAllTimeType);

router.post("/api/timeType/add", verifyToken, createTimeType);

module.exports = router;
