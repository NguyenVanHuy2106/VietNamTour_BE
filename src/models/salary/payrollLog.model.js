const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const PayrollLog = sequelize.define(
  "payroll_logs",
  {
    payroll_log_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    payroll_period_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    employee_payroll_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    old_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    new_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    description: {
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
  },
  {
    tableName: "payroll_logs",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = PayrollLog;
