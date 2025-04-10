const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TravelLocation = sequelize.define(
  "travellocation",
  {
    // map với bảng users đã tạo
    travellocationid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    travellocationname: {
      type: DataTypes.STRING,
    },
    provinceid: {
      type: DataTypes.INTEGER,
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

module.exports = TravelLocation;
