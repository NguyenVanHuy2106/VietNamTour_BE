const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractPayment = sequelize.define(
  "vn_contract_payment",
  {
    payment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    payment_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    reference_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "vn_contract_payments",
    schema: "vntour",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = ContractPayment;
