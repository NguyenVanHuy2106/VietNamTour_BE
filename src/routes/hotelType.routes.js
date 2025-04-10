const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllHotelTypes,
  createHotelType,
} = require("../controllers/hotelType.controller");

// Route thêm user

router.get("/api/hotelType/get", getAllHotelTypes);

router.post("/api/hotelType/add", verifyToken, createHotelType);

module.exports = router;
