const Categories = require("../models/categories.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Categories.findAll({
      where: {
        status: {
          [require("sequelize").Op.ne]: 3, // status != 3
        },
      },
      order: [["category_id", "DESC"]], // sắp xếp giảm dần theo
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });

    const formattedProvinces = categories.map((categories) => ({
      ...categories.toJSON(),
      created_by: categories.creator
        ? `${categories.creator.user_id} - ${categories.creator.name}`
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

exports.createCategories = async (req, res) => {
  try {
    const { category_name, created_by } = req.body;

    if (!category_name || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    //
    const newCategories = await Categories.create({
      category_name,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
      created_at: new Date(),
    });

    res.status(201).json({
      message: "Thêm danh mục bài viết thành công!",
      data: newCategories,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
