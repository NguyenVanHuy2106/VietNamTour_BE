const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const goongCompany = sequelize.define(
  "LeadAIGoongCompany",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    source_company_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    here_place_id: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    goong_place_id: {
      type: DataTypes.TEXT,
      allowNull: false,
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

    commune: {
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

    phone: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    website: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },

    goong_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    goong_score: {
      type: DataTypes.DECIMAL(12, 6),
      allowNull: true,
    },

    match_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    distance_meters: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "HERE_GOONG",
    },

    lead_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "NEW",
    },

    staff_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    goong_checked_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    assigned_to: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    assigned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    contact_person: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    contact_position: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    contact_phone: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    contact_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    next_follow_up_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "goong_companies",
    schema: "lead_ai",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

module.exports = goongCompany;
