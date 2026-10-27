const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const DiscoveryRun = sequelize.define(
  "LeadAIDiscoveryRun",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    target_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: {
          tableName: "discovery_targets",
          schema: "lead_ai",
        },
        key: "id",
      },
    },

    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "RUNNING",
    },

    found_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    inserted_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    updated_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    duplicate_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "discovery_runs",
    schema: "lead_ai",

    timestamps: false,

    indexes: [
      {
        fields: ["target_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["started_at"],
      },
    ],
  },
);

module.exports = DiscoveryRun;
