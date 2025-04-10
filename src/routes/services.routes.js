const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllServices,
  createService,
} = require("../controllers/services.controller");

// Route thêm user

router.get("/api/services/get", getAllServices);

router.post("/api/services/add", verifyToken, createService);

module.exports = router;
