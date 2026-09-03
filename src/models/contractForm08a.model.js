const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractForm08a = sequelize.define(
  "vn_contract_form_08a",
  {
    form_08a_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    acceptance_settlement_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    document_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    document_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    budget_unit_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    budget_unit_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    funding_source_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    national_program_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    contract_value: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    previous_accumulated_payment: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    previous_advance_payment: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    previous_direct_payment: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    previous_advance_balance: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    current_requested_payment: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    current_advance_payment: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    current_direct_payment: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    amount_in_words: {
      type: DataTypes.TEXT,
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
    tableName: "vn_contract_form_08a",
    schema: "vntour",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = ContractForm08a;
