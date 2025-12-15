const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  createImages,
  getAllImage,
  deleteImage,
} = require("../controllers/image.controller");

// Route thêm user

router.get("/api/image/get", getAllImage);

router.post("/api/image/add", verifyToken, createImages);

router.delete("/api/image/delete/:id", verifyToken, deleteImage);

module.exports = router;
