// File: src/models/contractContent.model.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ContractContent = sequelize.define(
  "vn_contracts_contents",
  {
    content_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    contract_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    work_content: {
      type: DataTypes.TEXT,
    },

    service_content: {
      type: DataTypes.TEXT,
    },

    tour_program: {
      type: DataTypes.TEXT,
    },

    priority_documents: {
      type: DataTypes.TEXT,
    },

    extra_volume: {
      type: DataTypes.TEXT,
    },

    payment_content: {
      type: DataTypes.TEXT,
    },

    payment_schedule_content: {
      type: DataTypes.TEXT,
    },

    article_4: {
      type: DataTypes.TEXT,
    },

    article_5: {
      type: DataTypes.TEXT,
    },

    article_6: {
      type: DataTypes.TEXT,
    },

    article_7: {
      type: DataTypes.TEXT,
    },

    article_8: {
      type: DataTypes.TEXT,
    },

    article_9: {
      type: DataTypes.TEXT,
    },

    article_10: {
      type: DataTypes.TEXT,
    },

    article_11: {
      type: DataTypes.TEXT,
    },

    created_by: {
      type: DataTypes.INTEGER,
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
    included_services: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    excluded_services: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    late_payment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },

  {
    tableName: "vn_contracts_contents",
    schema: "vntour",
    timestamps: false,
  },
);

module.exports = ContractContent;
