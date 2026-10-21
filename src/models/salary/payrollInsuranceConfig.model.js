const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const PayrollInsuranceConfig = sequelize.define(
  "payroll_insurance_configs",
  {
    insurance_config_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    effective_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    employee_social_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    employee_health_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    employee_unemployment_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    employer_social_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    employer_health_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    employer_unemployment_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 1,
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
    tableName: "payroll_insurance_configs",
    schema: "mdm",
    timestamps: false,
  },
);

module.exports = PayrollInsuranceConfig;
