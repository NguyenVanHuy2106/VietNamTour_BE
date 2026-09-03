// File: src/models/contractSettlementItem.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractSettlementItem = sequelize.define(
  "vn_contract_settlement_item",
  {
    settlement_item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    settlement_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    contract_item_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    item_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    route_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    customer_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    unit: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    quantity_contract: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    quantity_actual: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    unit_price: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    contract_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    /*
     * Thành tiền trước VAT
     */
    actual_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    /*
     * INCLUDED = Đơn giá đã bao gồm VAT
     * EXCLUDED = Đơn giá chưa bao gồm VAT
     * NO_VAT   = Không tính VAT
     */
    vat_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "EXCLUDED",
    },

    /*
     * Thuế suất: 0 / 8 / 10 / ...
     */
    vat_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },

    /*
     * Tiền VAT của riêng dòng
     */
    vat_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    /*
     * Thành tiền sau VAT
     */
    amount_after_vat: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    is_extra: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    extra_note: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "vn_contract_settlement_items",
    schema: "vntour",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = ContractSettlementItem;
