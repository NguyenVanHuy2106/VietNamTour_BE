const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const InvoiceTour = sequelize.define(
  "vn_invoice_tours",
  {
    tour_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    tour_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    tour_name: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    customer_name: {
      type: DataTypes.STRING(500),
    },

    departure_date: {
      type: DataTypes.DATEONLY,
    },

    return_date: {
      type: DataTypes.DATEONLY,
    },

    // Tổng số tiền xuất hóa đơn cho khách
    output_amount: {
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
    tableName: "vn_invoice_tours",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = InvoiceTour;
