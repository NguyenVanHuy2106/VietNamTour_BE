const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllVehicleType,
  createVehicleType,
} = require("../controllers/vehicleType.controller");

// Route thêm user

router.get("/api/vehicleType/get", getAllVehicleType);

router.post("/api/vehicleType/add", verifyToken, createVehicleType);

module.exports = router;
