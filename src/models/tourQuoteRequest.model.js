const { DataTypes } = require("sequelize");

const sequelize = require("../config/database");

/* ==========================================
   VIET NAM TOUR
   TOUR QUOTE REQUEST MODEL
========================================== */

const TourQuoteRequest = sequelize.define(
  "TourQuoteRequest",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    request_code: {
      type: DataTypes.STRING(40),
      allowNull: true,
      unique: true,
    },

    tour_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    tour_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    customer_type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "B2C",
    },

    customer_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    customer_phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    company_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    guest_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    departure_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    source_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "NEW",
    },

    submission_key: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    schema: "vntour",

    tableName: "vn_tour_quote_requests",

    timestamps: false,

    freezeTableName: true,
  },
);

module.exports = TourQuoteRequest;
