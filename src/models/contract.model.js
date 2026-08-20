// File: src/models/contract.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Contract = sequelize.define(
  "vn_contracts",
  {
    contract_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    contract_name: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },

    // 1. Dịch vụ du lịch
    // 2. Sự kiện
    // 3. Vận chuyển
    contract_type: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    customer_id: {
      type: DataTypes.INTEGER,
    },

    template_id: {
      type: DataTypes.INTEGER,
    },

    signed_date: {
      type: DataTypes.DATEONLY,
    },

    signed_place: {
      type: DataTypes.STRING(1000),
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

    contract_value: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    vat_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    total_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    amount_in_words: {
      type: DataTypes.STRING(2000),
    },

    // 0. Nháp
    // 1. Đã ký
    // 2. Đang thực hiện
    // 3. Đã thanh lý
    // 4. Đã hủy
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    note: {
      type: DataTypes.STRING(2000),
    },

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    created_at: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },

    updated_by: {
      type: DataTypes.INTEGER,
    },

    updated_at: {
      type: DataTypes.DATEONLY,
    },
  },
  {
    tableName: "vn_contracts",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = Contract;
