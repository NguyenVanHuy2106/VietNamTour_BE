const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Config = sequelize.define(
  "tk_config",
  {
    configKey: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    configValue: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "timekeeping",
    tableName: "tk_config",
    timestamps: false,
    underscored: true,
  },
);

module.exports = Config;
