const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllCollections,
  createCollection,
} = require("../controllers/collection.controller");

// Route thêm user

router.get("/api/collection/get", getAllCollections);

router.post("/api/collection/add", verifyToken, createCollection);

module.exports = router;
