const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const LeaveAccrual = sequelize.define(
  "LeaveAccrual",
  {
    leave_accrual_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    accrual_year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    accrual_month: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    accrual_days: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 1,
    },

    accrual_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "leave_accruals",
    schema: "vntour",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = LeaveAccrual;
