const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllTourType,
  createTourType,
  deleteTourType,
} = require("../controllers/tourType.controller");

// Route thêm user

router.get("/api/tourType/get", getAllTourType);
router.post("/api/tourType/add", verifyToken, createTourType);
router.delete("/api/tourType/delete/:id", verifyToken, deleteTourType);

//router.post("/api/services/add", verifyToken, createService);

module.exports = router;
