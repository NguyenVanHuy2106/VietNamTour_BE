const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const QuotationRequestItem = sequelize.define(
  "QuotationRequestItem",
  {
    item_id: {
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

    // STT trong bảng dịch vụ PDF
    item_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },

    // Tên hàng hóa / dịch vụ
    item_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // Nội dung mô tả chi tiết
    description: DataTypes.TEXT,

    // Địa điểm thực hiện
    location: DataTypes.TEXT,

    // Khối lượng
    quantity: {
      type: DataTypes.DECIMAL(18, 3),
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    // Đơn vị tính
    unit: DataTypes.STRING(100),

    // Trang PDF chứa hạng mục
    source_page_from: DataTypes.INTEGER,
    source_page_to: DataTypes.INTEGER,

    // Dữ liệu thô sau trích xuất
    raw_item_data: DataTypes.JSONB,

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "vntour",
    tableName: "vn_quotation_request_items",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = QuotationRequestItem;
