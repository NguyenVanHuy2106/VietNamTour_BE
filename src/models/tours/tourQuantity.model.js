const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const User = require("../user.model"); // Import model User

const TourQuantity = sequelize.define(
  "vn_tour_quantity",
  {
    // map với bảng users đã tạo
    tourquantityid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tourid: {
      type: DataTypes.STRING,
    },
    adult: {
      type: DataTypes.STRING,
    },
    child: {
      type: DataTypes.TEXT,
    },
    free: {
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
TourQuantity.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = TourQuantity;
