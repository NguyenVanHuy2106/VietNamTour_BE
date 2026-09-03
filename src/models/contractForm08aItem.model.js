const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractForm08aItem = sequelize.define(
  "vn_contract_form_08a_item",
  {
    form_08a_item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    form_08a_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    settlement_item_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    item_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    unit: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    quantity: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
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

    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    created_at: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "vn_contract_form_08a_items",
    schema: "vntour",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = ContractForm08aItem;
