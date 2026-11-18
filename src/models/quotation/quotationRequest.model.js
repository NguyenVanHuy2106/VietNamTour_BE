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

    source_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "MANUAL",
    },

    source_url: DataTypes.TEXT,
    extraction_status: DataTypes.STRING(50),
    raw_extraction_data: DataTypes.JSONB,

    team_id: DataTypes.INTEGER,
    assigned_at: DataTypes.DATE,
    assigned_by: DataTypes.INTEGER,

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "RECEIVED",
    },

    notes: DataTypes.TEXT,

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    updated_by: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,

    deleted_at: DataTypes.DATE,
    deleted_by: DataTypes.INTEGER,
    quotation_validity: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    schema: "vntour",
    tableName: "vn_quotation_requests",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = QuotationRequest;
