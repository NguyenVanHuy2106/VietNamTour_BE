const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllBanner,
  createBanner,
  deleteBanner,
} = require("../controllers/banner.controller");

// Route thêm user

router.get("/api/banner/get", getAllBanner);

router.post("/api/banner/add", verifyToken, createBanner);

router.delete("/api/banner/delete/:id", verifyToken, deleteBanner);

module.exports = router;
