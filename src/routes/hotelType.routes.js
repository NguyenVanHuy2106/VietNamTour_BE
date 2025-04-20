const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllHotelTypes,
  createHotelType,
  deleteHotelType,
} = require("../controllers/hotelType.controller");

// Route thêm user

router.get("/api/hotelType/get", getAllHotelTypes);

router.post("/api/hotelType/add", verifyToken, createHotelType);

router.delete("/api/hotelType/delete/:id", verifyToken, deleteHotelType);

module.exports = router;
