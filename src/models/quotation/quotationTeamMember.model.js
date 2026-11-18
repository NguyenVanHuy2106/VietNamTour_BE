const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

// ======================================================
// QUOTATION TEAM MEMBER MODEL
// Schema: mdm
// Table: md_quotation_team_members
//
// Mỗi user chỉ thuộc một nhóm kinh doanh.
// ======================================================

const QuotationTeamMember = sequelize.define(
  "QuotationTeamMember",
  {
    user_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
    },

    team_id: {
      type: DataTypes.BIGINT,
      allowNull: false,

      references: {
        model: {
          schema: "mdm",
          tableName: "md_quotation_teams",
        },
        key: "team_id",
      },

      onUpdate: "RESTRICT",
      onDelete: "RESTRICT",
    },

    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    assigned_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    // ============================================================
    // PHÂN QUYỀN THÀNH VIÊN NHÓM KINH DOANH
    // ============================================================

    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "MEMBER",
      validate: {
        isIn: {
          args: [["MEMBER", "ADMIN"]],
          msg: "Vai trò chỉ được là MEMBER hoặc ADMIN.",
        },
      },
    },
  },
  {
    schema: "mdm",
    tableName: "md_quotation_team_members",
    freezeTableName: true,

    timestamps: false,

    indexes: [
      {
        name: "idx_md_quotation_members_team",
        fields: ["team_id"],
      },
    ],
  },
);

module.exports = QuotationTeamMember;
