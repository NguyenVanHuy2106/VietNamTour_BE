// File: src/models/contractParty.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractParty = sequelize.define(
  "vn_contracts_parties",
  {
    party_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 1. Bên A - Khách hàng
    // 2. Bên B - Công ty
    party_type: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    company_name: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },

    tax_code: {
      type: DataTypes.STRING(100),
    },

    budget_code: {
      type: DataTypes.STRING(100),
    },

    address: {
      type: DataTypes.STRING(2000),
    },

    phone: {
      type: DataTypes.STRING(100),
    },

    bank_account: {
      type: DataTypes.STRING(1000),
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
    tableName: "vn_contracts_parties",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = ContractParty;
