const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const TenderSetting = sequelize.define(
  "TenderSetting",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    setting_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    setting_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tender_settings",
    schema: "lead_ai",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = TenderSetting;
