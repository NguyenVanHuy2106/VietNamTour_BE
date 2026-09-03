// File: src/models/contractSettlement.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractSettlement = sequelize.define(
  "vn_contract_settlement",
  {
    settlement_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    document_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    document_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    document_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    batch_no: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    service_from_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    service_to_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    /*
     * Giá trị hợp đồng gốc
     */
    contract_value: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    /*
     * Tổng tiền trước VAT của biên bản
     */
    subtotal: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    /*
     * Tổng tiền VAT của biên bản
     */
    vat_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    /*
     * Tổng giá trị sau VAT / giá trị quyết toán
     */
    actual_value: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    paid_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    remaining_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    quality_rating: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    other_comment: {
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

    updated_at: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "vn_contract_settlements",
    schema: "vntour",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = ContractSettlement;
