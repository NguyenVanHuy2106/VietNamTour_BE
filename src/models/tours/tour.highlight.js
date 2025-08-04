const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const User = require("../user.model"); // Import model User

const TourHighlight = sequelize.define(
  "vn_tour_highlight",
  {
    // map với bảng users đã tạo
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tourid: {
      type: DataTypes.NUMBER,
    },
    highlight_key: {
      type: DataTypes.INTEGER,
    },

    highlight_value: {
      type: DataTypes.STRING,
    },
  },
  {
    timestamps: false, // Không tự động thêm createdAt, updatedAt
    schema: "vntour", // Map đúng schema "mdm"
  }
);

module.exports = TourHighlight;
