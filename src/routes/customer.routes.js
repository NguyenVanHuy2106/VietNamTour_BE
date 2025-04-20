const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");

const {
  getAllCustomer,
  createCustomer,
  deleteCustomer,
} = require("../controllers/customer.controller");

// Route thêm user

router.get("/api/customer/get", getAllCustomer);

router.post("/api/customer/add", verifyToken, createCustomer);

router.delete("/api/customer/delete/:id", verifyToken, deleteCustomer);

module.exports = router;
