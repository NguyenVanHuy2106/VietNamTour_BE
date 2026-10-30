const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TenderSource = sequelize.define(
  "TenderSource",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    organization_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    domain: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },

    source_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    source_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "UNKNOWN",
    },

    province: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    discovered_by: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "SERPAPI",
    },

    crawl_interval: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
    },

    last_crawled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    last_success_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    failure_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: "tender_sources",
    schema: "lead_ai",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = TenderSource;
