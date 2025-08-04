const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllCollections,
  createCollection,
  deleteCollection,
} = require("../controllers/collection.controller");

// Route thêm user

router.get("/api/collection/get", getAllCollections);

router.post("/api/collection/add", verifyToken, createCollection);
router.delete("/api/collection/delete/:id", verifyToken, deleteCollection);

module.exports = router;
