const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user.model"); // Import model User

const HotelTypes = sequelize.define(
  "hoteltype",
  {
    // map với bảng users đã tạo
    hoteltypeid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    hoteltypename: {
      type: DataTypes.STRING,
    },
    description: {
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
    schema: "mdm", // Map đúng schema "mdm"
  }
);
HotelTypes.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = HotelTypes;
