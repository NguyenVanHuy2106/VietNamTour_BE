const TravelLocation = require("../models/travelLocation.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.getAllTravelLocation = async (req, res) => {
  try {
    const travelLocation = await TravelLocation.findAll(); // Lấy tất cả user
    res.status(200).json({
      message: "Lấy danh sách địa điểm tham quan thành công",
      data: travelLocation,
    });
  } catch (error) {
    //console.error("Lỗi khi lấy danh sách user:", error);
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
