// const { fetchAndSaveProvinces } = require("./config/fetchProvince");
require("dotenv").config(); // <-- dòng đầu
const express = require("express");
const cors = require("cors"); // ✅ Thêm cors vào
const app = express();
//const sequelize = require("./config/database");
const routes = require("./routes");
// Mở cors cho tất cả domain (nếu muốn giới hạn thì cấu hình cụ thể)
app.use(cors()); // ✅ Kích hoạt CORS

app.use(express.json()); // Middleware để parse JSON body

// Kết nối DB
// sequelize
//   .authenticate()
//   .then(() => console.log("Kết nối DB thành công!"))
//   .catch((err) => console.error("Kết nối DB thất bại:", err));

// Route User
// fetchAndSaveProvinces();
routes.forEach((route) => {
  app.use(route);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy ở cổng ${PORT}`);
});
