const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const CompanySource = sequelize.define(
  "LeadAICompanySource",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    company_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: {
          tableName: "companies",
          schema: "lead_ai",
        },
        key: "id",
      },
    },

    source_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    source_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    source_reference: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    discovered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
  },
  {
    tableName: "company_sources",
    schema: "lead_ai",

    timestamps: false,

    indexes: [
      {
        fields: ["company_id"],
      },
      {
        fields: ["source_type"],
      },
      {
        fields: ["source_reference"],
      },
    ],
  },
);

module.exports = CompanySource;
