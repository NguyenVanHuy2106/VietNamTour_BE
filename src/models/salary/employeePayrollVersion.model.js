const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const EmployeePayrollVersion = sequelize.define(
  "employee_payroll_versions",
  {
    payroll_version_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    employee_payroll_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    version_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    attendance_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    payroll_data: {
      type: DataTypes.JSONB,
      allowNull: false,
    },

    reason: {
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
    tableName: "employee_payroll_versions",
    schema: "vntour",
    timestamps: false,

    indexes: [
      {
        unique: true,
        fields: ["employee_payroll_id", "version_no"],
      },
    ],
  },
);

module.exports = EmployeePayrollVersion;
