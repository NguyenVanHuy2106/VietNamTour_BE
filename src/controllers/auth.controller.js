const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.checkToken = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: "Token không tồn tại" });
  }

  try {
    const decoded = jwt.verify(token, "huyhoang123");
    const currentTime = Math.floor(Date.now() / 1000);

    if (decoded.exp < currentTime) {
      return res
        .status(401)
        .json({ success: false, message: "Token đã hết hạn" });
    }

    res.json({ success: true, message: "Token hợp lệ", data: decoded });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
      error: error.message,
    });
  }
};
