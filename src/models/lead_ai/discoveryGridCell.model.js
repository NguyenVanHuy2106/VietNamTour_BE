const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const DiscoveryGridCell = sequelize.define(
  "LeadAIDiscoveryGridCell",
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
      allowNull: false,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },

    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },

    radius: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2500,
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

    last_scanned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    next_scan_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "discovery_grid_cells",
    schema: "lead_ai",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

module.exports = DiscoveryGridCell;
