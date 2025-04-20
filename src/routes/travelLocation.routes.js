const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllTravelLocation,
  deleteTravelLocation,
} = require("../controllers/travelLocation.controller");

// Route thêm user

router.get("/api/travelLocation/get", getAllTravelLocation);
router.delete(
  "/api/travelLocation/delete/:id",
  verifyToken,
  deleteTravelLocation
);

module.exports = router;
