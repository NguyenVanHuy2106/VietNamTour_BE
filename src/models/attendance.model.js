const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Attendance = sequelize.define(
  "tk_attendance",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    workDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    checkIn: {
      type: DataTypes.DATE,
    },
    checkOut: {
      type: DataTypes.DATE,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
    },
    deviceIdUsed: {
      type: DataTypes.STRING(255),
    },
    status: {
      type: DataTypes.STRING(50),
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "timekeeping",
    tableName: "tk_attendance",
    timestamps: false, // Vì bạn đã tự định nghĩa created_at
    underscored: true,
  },
);

module.exports = Attendance;
