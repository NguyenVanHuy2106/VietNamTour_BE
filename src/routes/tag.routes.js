const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const { createTag, getAllTag } = require("../controllers/tag.controller");

// Route thêm user

router.get("/api/tag/get", getAllTag);

router.post("/api/tag/add", verifyToken, createTag);

module.exports = router;
