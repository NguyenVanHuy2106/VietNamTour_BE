const TourType = require("../models/tourType.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.getAllTourType = async (req, res) => {
  try {
    const tourType = await TourType.findAll({
      where: {
        status: {
          [require("sequelize").Op.ne]: 3, // status != 3
        },
      },
      order: [["tourtypeid", "DESC"]], // sắp xếp giảm dần theo tourtypeid
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });

    const formattedProvinces = tourType.map((tourType) => ({
      ...tourType.toJSON(),
      created_by: tourType.creator
        ? `${tourType.creator.user_id} - ${tourType.creator.name}`
        : "Không xác định",
    }));

    res.status(200).json({
      message: "Lấy danh sách dịch vụ thành công",
      data: formattedProvinces,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.createTourType = async (req, res) => {
  try {
    const { tourtypename, description, created_by } = req.body;

    if (!tourtypename || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Tạo dịch vụ mới
    const newTourType = await TourType.create({
      tourtypename,
      description,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
    });

    res.status(201).json({
      message: "Tạo loại tour thành công!",
      data: newTourType,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.deleteTourType = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có ID được truyền không
    if (!id) {
      return res.status(400).json({ message: "Thiếu ID loại tour cần xoá." });
    }

    // Tìm và xoá loại tour
    const deleted = await TourType.destroy({
      where: { tourtypeid: id },
    });

    if (deleted === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy loại tour để xoá." });
    }

    res.status(200).json({ message: "Xoá loại tour thành công." });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
