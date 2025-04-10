const TimeType = require("../models/timeType.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.getAllTimeType = async (req, res) => {
  try {
    const timeType = await TimeType.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });
    const formattedProvinces = timeType.map((timeType) => ({
      ...timeType.toJSON(),
      created_by: timeType.creator
        ? `${timeType.creator.user_id} - ${timeType.creator.name}`
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

exports.createTimeType = async (req, res) => {
  try {
    const { timetypename, description, created_by } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!timetypename || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Tạo dịch vụ mới
    const newTimeType = await TimeType.create({
      timetypename,
      description,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
    });

    res.status(201).json({
      message: "Thêm loại thời gian thành công!",
      data: newTimeType,
    });
  } catch (error) {
    console.error("Lỗi khi tạo dịch vụ:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};
