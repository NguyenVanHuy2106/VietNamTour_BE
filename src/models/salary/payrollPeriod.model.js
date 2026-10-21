const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const PayrollPeriod = sequelize.define(
  "payroll_periods",
  {
    payroll_period_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    period_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    period_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    standard_work_days: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "OPEN",
      validate: {
        isIn: [
          ["OPEN", "ATTENDANCE_CONFIRMED", "CALCULATED", "PUBLISHED", "CLOSED"],
        ],
      },
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
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

    published_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "payroll_periods",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = PayrollPeriod;
