// File: src/models/contractAdvance.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractAdvance = sequelize.define(
  "vn_contracts_advances",
  {
    advance_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    is_advance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // 1. Theo tỷ lệ
    // 2. Theo số tiền
    calc_type: {
      type: DataTypes.INTEGER,
    },

    advance_rate: {
      type: DataTypes.FLOAT,
    },

    advance_amount: {
      type: DataTypes.FLOAT,
    },

    // Số ngày thanh toán phần còn lại
    due_date: {
      type: DataTypes.INTEGER,
    },

    payment_date: {
      type: DataTypes.DATEONLY,
    },

    note: {
      type: DataTypes.STRING(1000),
    },

    created_by: {
      type: DataTypes.INTEGER,
    },

    created_at: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },

    updated_by: {
      type: DataTypes.INTEGER,
    },

    updated_at: {
      type: DataTypes.DATEONLY,
    },
  },
  {
    tableName: "vn_contracts_advances",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = ContractAdvance;
