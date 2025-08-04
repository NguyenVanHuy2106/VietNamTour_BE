const Tag = require("../models/tags.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.createTag = async (req, res) => {
  try {
    const { tag_name, created_by } = req.body;

    if (!tag_name || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    //
    const newTag = await Tag.create({
      tag_name,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
      created_at: new Date(),
    });

    res.status(201).json({
      message: "Thêm thẻ tag thành công!",
      data: newTag,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.getAllTag = async (req, res) => {
  try {
    const tag = await Tag.findAll({
      where: {
        status: {
          [require("sequelize").Op.ne]: 3, // status != 3
        },
      },
      order: [["tag_id", "DESC"]], // sắp xếp giảm dần theo
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });

    const formattedProvinces = tag.map((tag) => ({
      ...tag.toJSON(),
      created_by: tag.creator
        ? `${tag.creator.user_id} - ${tag.creator.name}`
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
