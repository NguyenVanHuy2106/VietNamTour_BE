// File: src/models/contractLegalBasis.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractLegalBasis = sequelize.define(
  "vn_contracts_legal_bases",
  {
    legal_basis_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
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
    tableName: "vn_contracts_legal_bases",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = ContractLegalBasis;
