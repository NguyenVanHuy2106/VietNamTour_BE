const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user.model"); // Import model User
const Post = require("./posts.model");
const PostTag = require("./postsTag.model");

const Tags = sequelize.define(
  "md_tags",
  {
    // map với bảng users đã tạo
    tag_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tag_name: {
      type: DataTypes.STRING,
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
    schema: "mdm", // Map đúng schema "mdm"
  }
);
Tags.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = Tags;
