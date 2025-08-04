const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  createCategories,
  getAllCategories,
} = require("../controllers/categories.comtroller");

// Route thêm user

router.get("/api/categories/get", getAllCategories);

router.post("/api/categories/add", verifyToken, createCategories);

module.exports = router;
