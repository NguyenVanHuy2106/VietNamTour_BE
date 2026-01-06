const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  createTour,
  getTourById,
  getAllTours,
  updateTour,
  deleteTour,
  get8NewTours,
  getDOANTours,
  searchTour,
  getRelationTours,
  getTourBySlug,
} = require("../controllers/tour.controller");

// Route thêm user

// router.get("/api/timeType/get", getAllTimeType);

router.post("/api/tour/add", verifyToken, createTour);

router.post("/api/tour/update", verifyToken, updateTour);

router.get("/api/tour/get/:tourid", getTourById);

router.get("/api/tour/slug/:slug", getTourBySlug);

router.get("/api/tour/get", getAllTours);

router.delete("/api/tour/delete/:tourid", verifyToken, deleteTour);

router.get("/api/tour/get8new", get8NewTours);

router.get("/api/tour/getDOANTour", getDOANTours);

router.post("/api/tour/search", searchTour);

router.post("/api/tour/relation", getRelationTours);

// router.delete("/api/timeType/delete/:id", verifyToken, deleteTimeType);

module.exports = router;
