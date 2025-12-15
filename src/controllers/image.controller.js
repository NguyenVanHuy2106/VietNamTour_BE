const Image = require("../models/image.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const ImgCat = require("../models/imgCategory.model");

exports.createImages = async (req, res) => {
  try {
    const images = req.body; // Nhận mảng hình ảnh [{ name, img_url, category_id, created_by }, ...]

    if (!Array.isArray(images) || images.length === 0) {
      return res
        .status(400)
        .json({ message: "Vui lòng gửi danh sách hình ảnh hợp lệ." });
    }

    // Kiểm tra dữ liệu từng ảnh
    for (const img of images) {
      if (!img.name || !img.img_url || !img.category_id || !img.created_by) {
        return res.status(400).json({
          message:
            "Mỗi hình ảnh phải có đủ name, img_url, category_id, created_by.",
        });
      }

      // Thêm các trường mặc định
      img.status = 1;
      img.created_at = new Date();
    }

    // Tạo nhiều hình ảnh
    const createdImages = await Image.bulkCreate(images);

    res.status(201).json({
      message: "Thêm nhiều hình ảnh thành công!",
      data: createdImages,
    });
  } catch (error) {
    console.error("Lỗi khi tạo nhiều hình ảnh:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};

exports.getAllImage = async (req, res) => {
  try {
    const image = await Image.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
        {
          model: ImgCat,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
    });
    const formattedProvinces = image.map((image) => ({
      ...image.toJSON(),
      created_by: image.creator
        ? `${image.creator.user_id} - ${image.creator.name}`
        : "Không xác định", // Trường hợp không có người tạo,
      category_name: image.category
        ? `${image.category.id} - ${image.category.name}`
        : "Không xác định", // Trường hợp không có người tạo,
      creator: undefined,
      category: undefined,
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

exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có ID được truyền không
    if (!id) {
      return res.status(400).json({ message: "Thiếu id cần xoá." });
    }

    // Tìm và xoá loại tour
    const deleted = await Image.destroy({
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
