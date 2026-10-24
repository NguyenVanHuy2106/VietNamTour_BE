const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const UserLeaveConfig = sequelize.define(
  "UserLeaveConfig",
  {
    leave_config_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    official_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    is_leave_eligible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    monthly_leave_days: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 1,
    },

    created_by: {
      type: DataTypes.INTEGER,
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
    tableName: "user_leave_configs",
    schema: "mdm",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = UserLeaveConfig;
