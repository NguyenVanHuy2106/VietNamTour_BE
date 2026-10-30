const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TenderSearchLog = sequelize.define(
  "TenderSearchLog",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    query_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    query_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    time_filter: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    result_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    new_result_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    executed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tender_search_logs",
    schema: "lead_ai",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = TenderSearchLog;
