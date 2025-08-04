const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  createPost,
  getAllPost,
  getPostDetail,
  deletePost,
  getRelationPost,
} = require("../controllers/post.controller");

// Route thêm user

router.get("/api/post/get", getAllPost);

router.post("/api/post/add", verifyToken, createPost);

router.get("/api/post/:id", getPostDetail);

router.delete("/api/post/delete/:post_id", verifyToken, deletePost);

router.post("/api/post/getRelation", getRelationPost);

module.exports = router;
