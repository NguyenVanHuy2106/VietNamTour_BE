const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllVehicleType,
  createVehicleType,
  deleteVehicleType,
} = require("../controllers/vehicleType.controller");

// Route thêm user

router.get("/api/vehicleType/get", getAllVehicleType);

router.post("/api/vehicleType/add", verifyToken, createVehicleType);

router.delete("/api/vehicleType/delete/:id", verifyToken, deleteVehicleType);

module.exports = router;
