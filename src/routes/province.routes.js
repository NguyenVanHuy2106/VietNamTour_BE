const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const { getAllProvince } = require("../controllers/province.controller");

// Route thêm user

router.get("/api/province/get", getAllProvince);

// router.post("/api/services/add", verifyToken, createService);

module.exports = router;
