const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const EmployeePayroll = sequelize.define(
  "employee_payrolls",
  {
    employee_payroll_id: {
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

    salary_config_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    employee_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    employee_position: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    employee_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    base_salary: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    fixed_allowance: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    standard_work_days: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },

    actual_work_days: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },

    attendance_salary: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    has_social_insurance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    has_health_insurance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    has_unemployment_insurance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    insurance_salary: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },

    social_insurance_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    health_insurance_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    unemployment_insurance_rate: {
      type: DataTypes.DECIMAL(8, 5),
      allowNull: false,
      defaultValue: 0,
    },

    social_insurance_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    health_insurance_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    unemployment_insurance_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    total_insurance_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    additional_allowance: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    bonus_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    deduction_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    personal_income_tax: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    gross_salary: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    net_salary: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    attendance_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    payroll_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "DRAFT",
      validate: {
        isIn: [["DRAFT", "CALCULATED", "OUTDATED", "PUBLISHED"]],
      },
    },

    calculated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    calculated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    published_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    note: {
      type: DataTypes.TEXT,
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
    payment_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "UNPAID",
    },

    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    paid_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    payment_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: "employee_payrolls",
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

module.exports = EmployeePayroll;
