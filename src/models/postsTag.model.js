const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Tag = require("./tags.model");
const PostsTag = sequelize.define(
  "vn_post_tags",
  {
    // map với bảng users đã tạo
    post_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    tag_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
  },
  {
    timestamps: false, // Không tự động thêm createdAt, updatedAt
    schema: "vntour", // Map đúng schema "mdm"
  }
);

module.exports = PostsTag;
