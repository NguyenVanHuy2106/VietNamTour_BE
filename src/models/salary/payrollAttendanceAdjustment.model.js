const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const PayrollAttendanceAdjustment = sequelize.define(
  "payroll_attendance_adjustments",
  {
    adjustment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    payroll_attendance_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    adjustment_value: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },

    adjustment_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [["ADD", "DEDUCT"]],
      },
    },

    adjustment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    status: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    tableName: "payroll_attendance_adjustments",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = PayrollAttendanceAdjustment;
