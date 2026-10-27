const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Company = sequelize.define(
  "LeadAICompany",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    google_place_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },

    name: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    formatted_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    province: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    district: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    primary_type: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    types: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    website: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },

    phone: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    review_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    business_status: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "GOOGLE_PLACES",
    },

    discovery_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "DISCOVERED",
    },
    goong_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "PENDING",
    },

    goong_checked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    goong_last_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    first_discovered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
    tableName: "companies",
    schema: "lead_ai",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,

    indexes: [
      {
        unique: true,
        fields: ["google_place_id"],
      },
      {
        fields: ["name"],
      },
      {
        fields: ["province"],
      },
      {
        fields: ["district"],
      },
      {
        fields: ["discovery_status"],
      },
    ],
  },
);

module.exports = Company;
