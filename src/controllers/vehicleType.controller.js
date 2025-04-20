const VehicleType = require("../models/vehicleType.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.getAllVehicleType = async (req, res) => {
  try {
    const vehicleType = await VehicleType.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });
    const formattedProvinces = vehicleType.map((vehicleType) => ({
      ...vehicleType.toJSON(),
      created_by: vehicleType.creator
        ? `${vehicleType.creator.user_id} - ${vehicleType.creator.name}`
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

exports.createVehicleType = async (req, res) => {
  try {
    const { vehicletypename, vehicletypeicon, description, created_by } =
      req.body;

    if (!vehicletypename || !vehicletypeicon || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Tạo dịch vụ mới
    const newVehicleType = await VehicleType.create({
      vehicletypename,
      description,
      vehicletypeicon,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
    });

    res.status(201).json({
      message: "Thêm loại phương tiện thành công!",
      data: newVehicleType,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.deleteVehicleType = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có ID được truyền không
    if (!id) {
      return res
        .status(400)
        .json({ message: "Thiếu ID loại phương tiện cần xoá." });
    }

    // Tìm và xoá loại phương tiện
    const deleted = await VehicleType.destroy({
      where: { vehicletypeid: id },
    });

    if (deleted === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy loại phương tiện để xoá." });
    }

    res.status(200).json({ message: "Xoá loại phương tiện thành công." });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
