const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

// ======================================================
// QUOTATION MODULE ADMIN MODEL
// Schema: mdm
// Table: md_quotation_module_admins
//
// Quyền quản trị riêng cho phân hệ báo giá.
// ======================================================

const QuotationModuleAdmin = sequelize.define(
  "QuotationModuleAdmin",
  {
    user_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
    },

    granted_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    granted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "mdm",
    tableName: "md_quotation_module_admins",
    freezeTableName: true,

    timestamps: false,
  },
);

module.exports = QuotationModuleAdmin;
