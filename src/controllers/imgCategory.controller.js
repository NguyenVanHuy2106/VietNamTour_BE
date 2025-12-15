const ImgCategory = require("../models/imgCategory.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.createImgCategory = async (req, res) => {
  try {
    const { name, description, created_by } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!name || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Tạo dịch vụ mới
    const newImgCat = await ImgCategory.create({
      name,
      description,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
      created_at: new Date(),
    });

    res.status(201).json({
      message: "Thêm loại khách sạn vụ thành công!",
      data: newImgCat,
    });
  } catch (error) {
    console.error("Lỗi khi tạo dịch vụ:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};

exports.getAllImgCategory = async (req, res) => {
  try {
    const imgCategory = await ImgCategory.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });
    const formattedProvinces = imgCategory.map((imgCategory) => ({
      ...imgCategory.toJSON(),
      created_by: imgCategory.creator
        ? `${imgCategory.creator.user_id} - ${imgCategory.creator.name}`
        : "Không xác định", // Trường hợp không có người tạo
    }));
    res.status(200).json({
      message: "Lấy danh sách danh mục hình ảnh thành công",
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

exports.deleteImgCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có ID được truyền không
    if (!id) {
      return res.status(400).json({ message: "Thiếu id cần xoá." });
    }

    // Tìm và xoá loại tour
    const deleted = await ImgCategory.destroy({
      where: { id: id },
    });

    if (deleted === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy danh mục hình ảnh để xoá." });
    }

    res.status(200).json({ message: "Xoá danh mục hình ảnh thành công." });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
