const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const procurementEntity = sequelize.define(
  "ProcurementEntity",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    org_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    organization_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    representative_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    representative_position: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    phone: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    tax_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    province_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    district_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    business_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    source_role: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    source_status: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    source_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "MUASAMCONG",
    },

    raw_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    assigned_to: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    assigned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    care_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "NEW",
    },

    staff_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    next_follow_up_at: {
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
    tableName: "procurement_entities",
    schema: "lead_ai",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

module.exports = procurementEntity;
