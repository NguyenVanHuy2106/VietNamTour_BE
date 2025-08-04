const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const User = require("../user.model"); // Import model User

const Tour = sequelize.define(
  "vn_tour",
  {
    // map với bảng users đã tạo
    tourid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tourname: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.STRING,
    },
    destination: {
      type: DataTypes.NUMBER,
    },
    departure: {
      type: DataTypes.NUMBER,
    },
    timetypeid: {
      type: DataTypes.NUMBER,
    },
    hoteltypeid: {
      type: DataTypes.NUMBER,
    },
    startdate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    enddate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    vehicletypeid: {
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
    tourtype: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: false, // Không tự động thêm createdAt, updatedAt
    schema: "vntour", // Map đúng schema "mdm"
  }
);
Tour.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = Tour;
