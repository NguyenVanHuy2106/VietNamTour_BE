const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const UserSalaryConfig = sequelize.define(
  "user_salary_configs",
  {
    salary_config_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    employee_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        isIn: [
          ["OFFICIAL", "PROBATION", "INTERN", "PART_TIME", "COLLABORATOR"],
        ],
      },
    },

    salary_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
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

    salary_by_attendance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

    has_personal_income_tax: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    effective_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
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

    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "user_salary_configs",
    schema: "mdm",
    timestamps: false,
  },
);

module.exports = UserSalaryConfig;
