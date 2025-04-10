const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllCustomer,
  createCustomer,
} = require("../controllers/customer.controller");

// Route thêm user

router.get("/api/customer/get", getAllCustomer);

router.post("/api/customer/add", verifyToken, createCustomer);

module.exports = router;
