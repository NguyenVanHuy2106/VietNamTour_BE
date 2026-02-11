const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Không có token, truy cập bị từ chối!" });
  }

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), "huyhoang123");
    //console.log("RUỘT TOKEN GIẢI MÃ ĐƯỢC:", decoded); // <--- THÊM DÒNG NÀY
    req.user = decoded; // Lưu thông tin user vào request
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token không hợp lệ!" });
  }
};
