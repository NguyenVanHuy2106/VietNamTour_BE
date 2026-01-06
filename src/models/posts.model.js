const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user.model"); // Import model User
const Tag = require("./tags.model");
const PostTag = require("./postsTag.model");
const Category = require("./categories.model");

const Posts = sequelize.define(
  "vn_posts",
  {
    // map với bảng users đã tạo
    post_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
    },
    // Kiểm tra file models/Post.js
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    content: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.STRING,
    },
    thumbnail_url: {
      type: DataTypes.STRING,
    },
    category_id: {
      type: DataTypes.INTEGER,
    },
    created_by: {
      type: DataTypes.INTEGER,
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
    schema: "vntour", // Map đúng schema "mdm"
  }
);
Posts.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = Posts;
