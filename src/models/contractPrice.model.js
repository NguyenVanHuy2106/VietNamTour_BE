// File: src/models/contractPrice.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractPrice = sequelize.define(
  "vn_contracts_price",
  {
    price_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    item_name: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },

    quantity: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    unit: {
      type: DataTypes.STRING(100),
    },

    unit_price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    // 1. Đã bao gồm VAT
    // 2. Chưa bao gồm VAT
    // 3. Không tính VAT
    vat_type: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    vat_rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    created_by: {
      type: DataTypes.INTEGER,
    },

    created_at: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "vn_contracts_price",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = ContractPrice;
