// File: src/models/contractRepresentative.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractRepresentative = sequelize.define(
  "vn_contracts_representatives",
  {
    representative_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 1. Đại diện Bên A
    // 2. Đại diện Bên B
    rep_type: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    rep_name: {
      type: DataTypes.STRING(500),
    },

    rep_title: {
      type: DataTypes.STRING(500),
    },

    note: {
      type: DataTypes.STRING(2000),
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
    tableName: "vn_contracts_representatives",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = ContractRepresentative;
