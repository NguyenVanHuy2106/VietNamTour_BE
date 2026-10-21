const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const PayrollAttendance = sequelize.define(
  "payroll_attendances",
  {
    payroll_attendance_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    payroll_period_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    standard_work_days: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },

    attendance_work_days: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },

    adjustment_work_days: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },

    confirmed_work_days: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },

    attendance_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "DRAFT",
      validate: {
        isIn: [["DRAFT", "CONFIRMED", "CHANGED"]],
      },
    },

    confirmed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "payroll_attendances",
    schema: "vntour",
    timestamps: false,

    indexes: [
      {
        unique: true,
        fields: ["payroll_period_id", "user_id"],
      },
    ],
  },
);

module.exports = PayrollAttendance;
