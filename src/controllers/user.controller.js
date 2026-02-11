const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Thêm user mới
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      role,
      email,
      phone,
      position,
      description,
      avatar,
      password,
      created_by,
      created_at,
      status,
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Kiểm tra email đã tồn tại hay chưa
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email đã tồn tại, vui lòng chọn email khác!" });
    }

    // Hash mật khẩu
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo user mới
    const newUser = await User.create({
      name,
      role,
      email,
      phone,
      position,
      description,
      avatar,
      password: hashedPassword,
      created_by,
      created_at,
      status,
    });

    res.status(201).json({
      message: "Tạo user thành công!",
      data: newUser,
    });
  } catch (error) {
    //console.error("Lỗi khi tạo user:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};
// Get All user
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll(); // Lấy tất cả user
    res.status(200).json({
      message: "Lấy danh sách user thành công",
      data: users,
    });
  } catch (error) {
    //console.error("Lỗi khi lấy danh sách user:", error);
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// Lấy thông tin user theo ID
exports.getUserById = async (req, res) => {
  try {
    const { user_id } = req.params;
    const user = await User.findByPk(user_id, {
      attributes: [
        "user_id",
        "name",
        "role",
        "email",
        "phone",
        "position",
        "description",
        "avatar",
        "created_by",
        "created_at",
        "status",
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User không tồn tại." });
    }

    res.status(200).json({
      message: "Lấy thông tin user thành công",
      data: user,
    });
  } catch (error) {
    //console.error("Lỗi khi lấy thông tin user:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};

exports.logIn = async (req, res) => {
  try {
    const { user_id, password } = req.body;
    if (!user_id || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập user_id và mật khẩu." });
    }

    const user = await User.findByPk(user_id);

    if (!user) {
      return res
        .status(404)
        .json({ message: "User ID hoặc mật khẩu không đúng." });
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "User ID hoặc mật khẩu không đúng." });
    }

    // Tạo token JWT (hết hạn sau 24 giờ)
    const token = jwt.sign(
      { user_id: user.user_id || user.id, role: user.role },
      "huyhoang123", //
      { expiresIn: "2h" },
    );

    res.status(200).json({
      message: "Đăng nhập thành công!",
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    //console.error("Lỗi khi đăng nhập:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};
