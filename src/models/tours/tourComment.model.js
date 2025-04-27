const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const User = require("../user.model"); // Import model User

const TourComment = sequelize.define(
  "vn_tour_comment",
  {
    // map với bảng users đã tạo
    commentid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tourid: {
      type: DataTypes.NUMBER,
    },
    parentid: {
      type: DataTypes.NUMBER,
    },
    content: {
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
    schema: "vntour", // Map đúng schema "mdm"
  }
);
TourComment.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = TourComment;
