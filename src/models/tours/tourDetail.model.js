const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const User = require("../user.model"); // Import model User

const TourDetail = sequelize.define(
  "vn_tour_detail",
  {
    // map với bảng users đã tạo
    tourdetailid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tourid: {
      type: DataTypes.STRING,
    },
    content: {
      type: DataTypes.TEXT,
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
TourDetail.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = TourDetail;
