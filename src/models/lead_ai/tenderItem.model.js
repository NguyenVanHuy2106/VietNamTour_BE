const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TenderItem = sequelize.define(
  "TenderItem",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    source_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    source_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "SERPAPI",
    },

    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    source_url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    canonical_url: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },

    domain: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    snippet: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    organization_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    deadline_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    first_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    serp_position: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    serp_query_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    content_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },

    relevance_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "NEW",
    },

    assigned_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    raw_data: {
      type: DataTypes.JSONB,
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
    tableName: "tender_items",
    schema: "lead_ai",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = TenderItem;
