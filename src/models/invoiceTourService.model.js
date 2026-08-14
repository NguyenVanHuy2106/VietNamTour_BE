const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const InvoiceTour = require("./invoiceTour.model");

const InvoiceTourService = sequelize.define(
  "vn_invoice_tour_services",
  {
    service_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    tour_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    service_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    supplier_name: {
      type: DataTypes.STRING(500),
    },

    service_name: {
      type: DataTypes.STRING(500),
    },

    description: {
      type: DataTypes.STRING(1000),
    },

    // Chi phí dịch vụ thực tế / dự kiến
    service_amount: {
      type: DataTypes.DECIMAL(18, 2),
      defaultValue: 0,
    },

    // Số tiền cần lấy hóa đơn
    required_invoice_amount: {
      type: DataTypes.DECIMAL(18, 2),
      defaultValue: 0,
    },

    note: {
      type: DataTypes.STRING(1000),
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "vn_invoice_tour_services",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = InvoiceTourService;
