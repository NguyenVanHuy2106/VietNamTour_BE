const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Collections = sequelize.define(
  "collection",
  {
    // map với bảng users đã tạo
    collectionid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    collectionname: {
      type: DataTypes.STRING,
    },
    collectionurl: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.TEXT,
    },
    created_by: {
      type: DataTypes.STRING,
    },
    created_at: {
      type: DataTypes.DATE,
    },
    status: {
      type: DataTypes.INTEGER,
    },
  },
  {
    timestamps: false, // Không tự động thêm createdAt, updatedAt
    schema: "mdm", // Map đúng schema "mdm"
  }
);

module.exports = Collections;
