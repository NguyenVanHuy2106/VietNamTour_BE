const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user.model"); // Import model User

const Banners = sequelize.define(
  "banner",
  {
    // map với bảng users đã tạo
    bannerid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    bannername: {
      type: DataTypes.STRING,
    },
    bannerurl: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.TEXT,
    },
    created_by: {
      type: DataTypes.STRING,
    },
    created_at: {
      type: DataTypes.DATE,
    },
    status: {
      type: DataTypes.INTEGER,
    },
  },
  {
    timestamps: false, // Không tự động thêm createdAt, updatedAt
    schema: "mdm", // Map đúng schema "mdm"
  }
);
Banners.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = Banners;
