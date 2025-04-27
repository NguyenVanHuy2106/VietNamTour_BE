const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const User = require("../user.model"); // Import model User

const TourPrice = sequelize.define(
  "vn_tour_price",
  {
    // map với bảng users đã tạo
    tourpriceid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tourid: {
      type: DataTypes.STRING,
    },
    adultprice: {
      type: DataTypes.FLOAT,
    },
    childprice: {
      type: DataTypes.FLOAT,
    },
    freeprice: {
      type: DataTypes.FLOAT,
    },
    promotion: {
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
TourPrice.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = TourPrice;
