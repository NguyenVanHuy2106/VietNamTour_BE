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

exports.deleteTravelLocation = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có ID được truyền không
    if (!id) {
      return res
        .status(400)
        .json({ message: "Thiếu ID địa điểm tham quan cần xoá." });
    }

    // Tìm và xoá loại tour
    const deleted = await TravelLocation.destroy({
      where: { travellocationid: id },
    });

    if (deleted === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy địa điểm tham quan để xoá." });
    }

    res.status(200).json({ message: "Xoá địa điểm tham quan thành công." });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
