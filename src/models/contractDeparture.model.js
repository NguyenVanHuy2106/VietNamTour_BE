// File: src/models/contractDeparture.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractDeparture = sequelize.define(
  "vn_contracts_departures",
  {
    departure_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    departure_name: {
      type: DataTypes.STRING(255),
    },

    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    end_date: {
      type: DataTypes.DATEONLY,
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
    tableName: "vn_contracts_departures",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = ContractDeparture;
