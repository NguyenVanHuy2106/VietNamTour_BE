const HotelType = require("../models/hotelType.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.getAllHotelTypes = async (req, res) => {
  try {
    const hotelType = await HotelType.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });
    const formattedProvinces = hotelType.map((hotelType) => ({
      ...hotelType.toJSON(),
      created_by: hotelType.creator
        ? `${hotelType.creator.user_id} - ${hotelType.creator.name}`
        : "Không xác định", // Trường hợp không có người tạo
    }));
    res.status(200).json({
      message: "Lấy danh sách dịch vụ thành công",
      data: formattedProvinces,
    });
  } catch (error) {
    //console.error("Lỗi khi lấy danh sách user:", error);
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.createHotelType = async (req, res) => {
  try {
    const { hoteltypename, description, created_by } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!hoteltypename || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Tạo dịch vụ mới
    const newHotelType = await HotelType.create({
      hoteltypename,
      description,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
    });

    res.status(201).json({
      message: "Thêm loại khách sạn vụ thành công!",
      data: newHotelType,
    });
  } catch (error) {
    console.error("Lỗi khi tạo dịch vụ:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};
