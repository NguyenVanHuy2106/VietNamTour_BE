const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const DiscoveryTarget = sequelize.define(
  "LeadAIDiscoveryTarget",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    province: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    district: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    keyword: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    radius: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    search_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "TEXT_SEARCH",
    },

    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "READY",
    },

    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },

    page_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    scan_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    last_scanned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    next_scan_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    last_error: {
      type: DataTypes.TEXT,
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
    tableName: "discovery_targets",
    schema: "lead_ai",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,

    indexes: [
      {
        fields: ["status"],
      },
      {
        fields: ["next_scan_at"],
      },
      {
        fields: ["priority"],
      },
      {
        fields: ["province"],
      },
      {
        fields: ["district"],
      },
      {
        fields: ["keyword"],
      },
    ],
  },
);

module.exports = DiscoveryTarget;
