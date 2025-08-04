const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user.model"); // Import model User
const Posts = require("./posts.model");

const Categories = sequelize.define(
  "md_categories",
  {
    // map với bảng users đã tạo
    category_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category_name: {
      type: DataTypes.STRING,
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
Categories.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = Categories;
