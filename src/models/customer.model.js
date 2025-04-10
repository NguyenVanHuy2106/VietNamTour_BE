const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user.model"); // Import model User

const Customers = sequelize.define(
  "customer",
  {
    // map với bảng users đã tạo
    customerid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customername: {
      type: DataTypes.STRING,
    },
    customerfieldtypeid: {
      type: DataTypes.INTEGER,
    },
    customerlogo: {
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
    schema: "vntour", // Map đúng schema "mdm"
  }
);
Customers.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

module.exports = Customers;
