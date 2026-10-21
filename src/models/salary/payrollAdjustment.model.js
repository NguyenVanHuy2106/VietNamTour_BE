const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const PayrollAdjustment = sequelize.define(
  "payroll_adjustments",
  {
    payroll_adjustment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    employee_payroll_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    adjustment_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        isIn: [["ALLOWANCE", "BONUS", "DEDUCTION"]],
      },
    },

    adjustment_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
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

    status: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    tableName: "payroll_adjustments",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = PayrollAdjustment;
