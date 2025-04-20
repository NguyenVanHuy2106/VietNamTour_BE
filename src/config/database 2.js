const { Sequelize } = require("sequelize");

const sequelize = new Sequelize("vietnamluxtour", "admin", "admin123", {
  host: "103.232.120.184", // hoặc IP, domain của DB server
  dialect: "postgres",
  logging: false, // ẩn log query (bật true nếu muốn xem log)
  define: {
    freezeTableName: true, // giữ nguyên tên bảng, không tự thêm 's'
  },
});

module.exports = sequelize;
