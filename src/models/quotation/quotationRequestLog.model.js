const { DataTypes } = require("sequelize");

// QUAN TRỌNG:
// Dùng đúng Sequelize instance giống quotationTeam.model.js.
// Đường dẫn bên dưới chỉ là ví dụ.
const sequelize = require("../../config/database");

const QuotationRequestLog = sequelize.define(
  "QuotationRequestLog",
  {
    log_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    request_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    old_status: DataTypes.STRING(30),
    new_status: DataTypes.STRING(30),

    old_team_id: DataTypes.INTEGER,
    new_team_id: DataTypes.INTEGER,

    reason: DataTypes.TEXT,
    old_data: DataTypes.JSONB,
    new_data: DataTypes.JSONB,

    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "vntour",
    tableName: "vn_quotation_request_logs",
    timestamps: false,
    freezeTableName: true,
  },
);

module.exports = QuotationRequestLog;
