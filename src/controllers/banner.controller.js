const Banners = require("../models/banner.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.getAllBanner = async (req, res) => {
  try {
    const banner = await Banners.findAll({
      where: {
        status: {
          [require("sequelize").Op.ne]: 3, // status != 3
        },
      },
      order: [["bannerid", "DESC"]], // sắp xếp giảm dần theo
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });

    const formattedProvinces = banner.map((banner) => ({
      ...banner.toJSON(),
      created_by: banner.creator
        ? `${banner.creator.user_id} - ${banner.creator.name}`
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

exports.createBanner = async (req, res) => {
  try {
    const { bannername, bannerurl, description, created_by } = req.body;

    if (!bannername || !bannerurl || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    //
    const newBanner = await Banners.create({
      bannername,
      bannerurl,
      description,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
    });

    res.status(201).json({
      message: "Thêm banner thành công!",
      data: newBanner,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có ID được truyền không
    if (!id) {
      return res.status(400).json({ message: "Vui lòng chọn banner cần xoá" });
    }

    // Tìm và xoá loại tour
    const deleted = await Banners.destroy({
      where: { bannerid: id },
    });

    if (deleted === 0) {
      return res.status(404).json({ message: "Không tìm thấy banner để xoá." });
    }

    res.status(200).json({ message: "Xoá banner thành công." });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
