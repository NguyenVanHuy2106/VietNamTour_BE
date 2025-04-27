const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const User = require("../user.model"); // Import model User

const TourFeedBack = sequelize.define(
  "vn_tour_feedback",
  {
    // map với bảng users đã tạo
    feedbackid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    feedbacktypeid: {
      type: DataTypes.NUMBER,
    },
    tourid: {
      type: DataTypes.NUMBER,
    },
    fullname: {
      type: DataTypes.TEXT,
    },
    ratingnumber: {
      type: DataTypes.NUMBER,
    },
    email: {
      type: DataTypes.TEXT,
    },
  },
  {
    timestamps: false, // Không tự động thêm createdAt, updatedAt
    schema: "vntour", // Map đúng schema "mdm"
  }
);
TourFeedBack.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = TourFeedBack;
