const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user.model"); // Import model User
const ImgCat = require("./imgCategory.model");

const Image = sequelize.define(
  "md_image",
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
    img_url: {
      type: DataTypes.STRING,
    },
    category_id: {
      type: DataTypes.INTEGER,
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
Image.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

Image.belongsTo(ImgCat, {
  foreignKey: "category_id",
  as: "category",
});

module.exports = Image;
