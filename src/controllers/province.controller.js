const Province = require("../models/province.model");
const User = require("../models/user.model");

exports.getAllProvince = async (req, res) => {
  try {
    const provinces = await Province.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });

    // Format lại dữ liệu trước khi trả về
    const formattedProvinces = provinces.map((province) => ({
      ...province.toJSON(),
      created_by: province.creator
        ? `${province.creator.user_id} - ${province.creator.name}`
        : "Không xác định", // Trường hợp không có người tạo
    }));

    res.status(200).json({
      message: "Lấy danh sách tỉnh/TP thành công",
      data: formattedProvinces,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
