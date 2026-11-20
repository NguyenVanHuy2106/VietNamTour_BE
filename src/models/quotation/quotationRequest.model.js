const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const QuotationRequest = sequelize.define(
  "QuotationRequest",
  {
    request_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    // ====================================
    // THÔNG TIN YÊU CẦU BÁO GIÁ
    // ====================================

    notification_code: DataTypes.STRING(100),
    notification_id: DataTypes.STRING(150),
    notification_type: DataTypes.STRING(50),

    request_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    package_name: DataTypes.TEXT,
    procuring_entity: DataTypes.TEXT,

    publish_date: DataTypes.DATEONLY,
    closing_date: DataTypes.DATE,

    location: DataTypes.TEXT,
    quantity: DataTypes.DECIMAL(18, 3),
    unit: DataTypes.STRING(100),
    package_price: DataTypes.DECIMAL(20, 2),

    quotation_validity: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // ====================================
    // NGUỒN DỮ LIỆU
    // ====================================

    source_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "MANUAL",
      validate: {
        isIn: [["MANUAL", "PROCUREMENT"]],
      },
    },

    source_url: DataTypes.TEXT,
    extraction_status: DataTypes.STRING(50),
    raw_extraction_data: DataTypes.JSONB,

    // ====================================
    // THÔNG TIN LIÊN HỆ TỪ PDF
    // ====================================

    contact_name: DataTypes.STRING(255),
    contact_position: DataTypes.STRING(255),
    contact_phone: DataTypes.STRING(30),
    contact_email: DataTypes.STRING(255),
    contact_address: DataTypes.TEXT,

    // ====================================
    // THỜI HẠN YÊU CẦU BÁO GIÁ
    // ====================================

    reception_method: DataTypes.STRING(30),
    reception_start_date: DataTypes.DATEONLY,
    reception_end_date: DataTypes.DATEONLY,

    // Ngày thực hiện tour / sự kiện nếu có
    execution_date: DataTypes.DATEONLY,

    // ====================================
    // TRÍCH XUẤT PDF
    // ====================================

    extraction_method: DataTypes.STRING(30),

    extraction_reviewed_at: DataTypes.DATE,

    // ====================================
    // PHÂN CÔNG NHÓM
    // ====================================

    team_id: DataTypes.INTEGER,
    assigned_at: DataTypes.DATE,
    assigned_by: DataTypes.INTEGER,

    // ====================================
    // TRẠNG THÁI XỬ LÝ
    // ====================================

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "RECEIVED",
      validate: {
        isIn: [
          [
            "RECEIVED",
            "PROCESSING",
            "SUBMITTED",
            "WON",
            "LOST",
            "CANCELLED",
            "CONTACTED",
            "COMPLETED",
          ],
        ],
      },
    },

    notes: DataTypes.TEXT,

    // ====================================
    // NGƯỜI TẠO / CẬP NHẬT
    // ====================================

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    updated_by: DataTypes.INTEGER,

    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,

    deleted_at: DataTypes.DATE,
    deleted_by: DataTypes.INTEGER,
  },
  {
    schema: "vntour",
    tableName: "vn_quotation_requests",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = QuotationRequest;
