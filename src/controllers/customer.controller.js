const Customers = require("../models/customer.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.getAllCustomer = async (req, res) => {
  try {
    const customer = await Customers.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });
    const formattedProvinces = customer.map((customer) => ({
      ...customer.toJSON(),
      created_by: customer.creator
        ? `${customer.creator.user_id} - ${customer.creator.name}`
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

exports.createCustomer = async (req, res) => {
  try {
    const {
      customername,
      customerfieldtypeid,
      customerlogo,
      description,
      created_by,
    } = req.body;

    if (!customername || !customerlogo || !customerfieldtypeid || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    //
    const newCustomer = await Customers.create({
      customername,
      customerfieldtypeid,
      customerlogo,
      description,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
    });

    res.status(201).json({
      message: "Thêm khách hàng thành công!",
      data: newCustomer,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra xem có ID được truyền không
    if (!id) {
      return res.status(400).json({ message: "Thiếu ID khách hàng cần xoá." });
    }

    // Tìm và xoá loại tour
    const deleted = await Customers.destroy({
      where: { customerid: id },
    });

    if (deleted === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy khách hàng để xoá." });
    }

    res.status(200).json({ message: "Xoá khách hàng thành công." });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
