const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user.model"); // Import model User

const ImgCategory = sequelize.define(
  "md_image_category",
  {
    // map với bảng users đã tạo
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
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
  },
);
ImgCategory.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = ImgCategory;
