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
      references: {
        model: {
          schema: "vntour",
          tableName: "vn_quotation_requests",
        },
        key: "request_id",
      },
      onDelete: "CASCADE",
    },

    // ====================================
    // THÔNG TIN FILE
    // ====================================

    file_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    download_url: DataTypes.TEXT,
    storage_url: DataTypes.TEXT,

    file_type: DataTypes.STRING(100),
    file_size: DataTypes.BIGINT,

    // ====================================
    // THÔNG TIN BỔ SUNG CHO PDF
    // ====================================

    document_role: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "SUPPORTING",
    },

    // SHA256 của nội dung file
    file_sha256: DataTypes.STRING(64),

    // Tổng số trang PDF
    page_count: DataTypes.INTEGER,

    // Key lưu trên Cloudflare R2
    storage_key: DataTypes.TEXT,

    // Người tải file lên
    uploaded_by: DataTypes.INTEGER,

    created_at: {
      type: DataTypes.DATE,
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
