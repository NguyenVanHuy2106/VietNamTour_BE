const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllImgCategory,
  createImgCategory,
  deleteImgCategory,
} = require("../controllers/imgCategory.controller");

// Route thêm user

router.get("/api/imgCat/get", getAllImgCategory);

router.post("/api/imgCat/add", verifyToken, createImgCategory);

router.delete("/api/imgCat/delete/:id", verifyToken, deleteImgCategory);

module.exports = router;
