const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const LeaveRequest = sequelize.define(
  "LeaveRequest",
  {
    leave_request_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    approver_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    total_days: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
    },

    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDING",
    },

    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    rejected_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    rejected_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    reject_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "leave_requests",
    schema: "vntour",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = LeaveRequest;
