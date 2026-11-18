const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

// ======================================================
// QUOTATION TEAM MODEL
// Schema: mdm
// Table: md_quotation_teams
// ======================================================

const QuotationTeam = sequelize.define(
  "QuotationTeam",
  {
    team_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    team_code: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: "uq_md_quotation_team_code",

      validate: {
        notEmpty: {
          msg: "Vui lòng nhập mã nhóm kinh doanh.",
        },
        is: {
          args: /^[A-Z0-9_-]{2,30}$/,
          msg: "Mã nhóm phải từ 2–30 ký tự, chỉ gồm chữ in hoa, số, _ hoặc -.",
        },
      },

      set(value) {
        this.setDataValue(
          "team_code",
          String(value ?? "")
            .trim()
            .toUpperCase(),
        );
      },
    },

    team_name: {
      type: DataTypes.STRING(150),
      allowNull: false,

      validate: {
        notEmpty: {
          msg: "Vui lòng nhập tên nhóm kinh doanh.",
        },
        len: {
          args: [1, 150],
          msg: "Tên nhóm không được vượt quá 150 ký tự.",
        },
      },

      set(value) {
        this.setDataValue("team_name", String(value ?? "").trim());
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 1,

      validate: {
        isIn: {
          args: [[0, 1]],
          msg: "Trạng thái nhóm không hợp lệ.",
        },
      },
    },

    created_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    updated_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "mdm",
    tableName: "md_quotation_teams",
    freezeTableName: true,

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = QuotationTeam;
