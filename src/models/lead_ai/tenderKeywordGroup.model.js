const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TenderKeywordGroup = sequelize.define(
  "TenderKeywordGroup",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    group_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    group_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    group_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    keywords: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    priority: {
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
    tableName: "tender_keyword_groups",
    schema: "lead_ai",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = TenderKeywordGroup;
