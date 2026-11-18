"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

// ==========================================================
// VIET NAM TOUR ERP
// MODEL: LỊCH SỬ PHÂN NHÓM KINH DOANH
// ==========================================================

const QuotationTeamTransferLog = sequelize.define(
  "QuotationTeamTransferLog",
  {
    transfer_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    from_team_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    to_team_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    action: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: {
          args: [["ADD", "TRANSFER", "REMOVE"]],
          msg: "Hành động phân nhóm không hợp lệ.",
        },
      },
    },

    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "mdm",
    tableName: "md_quotation_team_transfer_logs",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = QuotationTeamTransferLog;
