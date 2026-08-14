const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const InvoiceTourService = require("./invoiceTourService.model");

const InvoiceServiceInvoice = sequelize.define(
  "vn_invoice_service_invoices",
  {
    invoice_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    invoice_number: {
      type: DataTypes.STRING(100),
    },

    invoice_date: {
      type: DataTypes.DATEONLY,
    },

    invoice_amount: {
      type: DataTypes.DECIMAL(18, 2),
      defaultValue: 0,
    },

    supplier_name: {
      type: DataTypes.STRING(500),
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
    tableName: "vn_invoice_service_invoices",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = InvoiceServiceInvoice;
