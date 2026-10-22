const { DataTypes } = require("sequelize");

const sequelize = require("../../config/database");

const UserBankAccount = sequelize.define(
  "UserBankAccount",
  {
    user_bank_account_id: {
      type: DataTypes.BIGINT,

      primaryKey: true,

      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.INTEGER,

      allowNull: false,

      unique: true,
    },

    bank_bin: {
      type: DataTypes.STRING(10),

      allowNull: false,
    },

    bank_code: {
      type: DataTypes.STRING(30),

      allowNull: true,
    },

    bank_name: {
      type: DataTypes.STRING(200),

      allowNull: false,
    },

    bank_short_name: {
      type: DataTypes.STRING(100),

      allowNull: true,
    },

    account_number: {
      type: DataTypes.STRING(30),

      allowNull: false,
    },

    account_name: {
      type: DataTypes.STRING(150),

      allowNull: false,
    },

    status: {
      type: DataTypes.SMALLINT,

      allowNull: false,

      defaultValue: 1,
    },

    created_at: {
      type: DataTypes.DATE,

      allowNull: false,

      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,

      allowNull: true,
    },
  },
  {
    schema: "mdm",

    tableName: "user_bank_accounts",

    timestamps: false,
  },
);

module.exports = UserBankAccount;
