const Services = require("../models/services.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.getAllServices = async (req, res) => {
  try {
    const service = await Services.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });
    const formattedProvinces = service.map((service) => ({
      ...service.toJSON(),
      created_by: service.creator
        ? `${service.creator.user_id} - ${service.creator.name}`
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

exports.createService = async (req, res) => {
  try {
    const { servicename, description, created_by } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!servicename || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Tạo dịch vụ mới
    const newService = await Services.create({
      servicename,
      description,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
    });

    res.status(201).json({
      message: "Tạo dịch vụ thành công!",
      data: newService,
    });
  } catch (error) {
    console.error("Lỗi khi tạo dịch vụ:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};
