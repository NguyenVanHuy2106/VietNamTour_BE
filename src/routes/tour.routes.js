const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  createTour,
  getTourById,
  getAllTours,
  updateTour,
} = require("../controllers/tour.controller");

// Route thêm user

// router.get("/api/timeType/get", getAllTimeType);

router.post("/api/tour/add", verifyToken, createTour);

router.post("/api/tour/update", verifyToken, updateTour);

router.get("/api/tour/get/:tourid", getTourById);

router.get("/api/tour/get", getAllTours);

// router.delete("/api/timeType/delete/:id", verifyToken, deleteTimeType);

module.exports = router;
