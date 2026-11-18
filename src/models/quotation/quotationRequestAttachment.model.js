const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const QuotationRequestAttachment = sequelize.define(
  "QuotationRequestAttachment",
  {
    attachment_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    request_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    file_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    download_url: DataTypes.TEXT,
    storage_url: DataTypes.TEXT,
    file_type: DataTypes.STRING(100),
    file_size: DataTypes.BIGINT,

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "vntour",
    tableName: "vn_quotation_request_attachments",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = QuotationRequestAttachment;
