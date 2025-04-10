const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  createUser,
  getAllUsers,
  getUserById,
  logIn,
} = require("../controllers/user.controller");

const { checkToken } = require("../controllers/auth.controller");

// Route thêm user
router.post("/api/user/add", verifyToken, createUser);
router.post("/api/user/login", logIn);

router.get("/api/user/get", verifyToken, getAllUsers);
router.get("/api/user/get/:user_id", verifyToken, getUserById);

//check token
router.get("/api/check-token", checkToken);

module.exports = router;
