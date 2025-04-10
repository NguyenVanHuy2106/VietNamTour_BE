const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllTravelLocation,
} = require("../controllers/travelLocation.controller");

// Route thêm user

router.get("/api/travelLocation/get", verifyToken, getAllTravelLocation);

module.exports = router;
