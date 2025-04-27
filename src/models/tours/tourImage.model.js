const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const User = require("../user.model"); // Import model User

const TourImage = sequelize.define(
  "vn_tour_img",
  {
    // map với bảng users đã tạo
    tourimgid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tourid: {
      type: DataTypes.NUMBER,
    },
    imagename: {
      type: DataTypes.STRING,
    },
    imageurl: {
      type: DataTypes.STRING,
    },
    imagetype: {
      type: DataTypes.NUMBER,
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
TourImage.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = TourImage;
