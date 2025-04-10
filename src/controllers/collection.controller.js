const Collections = require("../models/collection.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.getAllCollections = async (req, res) => {
  try {
    const collection = await Collections.findAll(); // Lấy tất cả user
    res.status(200).json({
      message: "Lấy danh sách bộ sưu tập thành công",
      data: collection,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.createCollection = async (req, res) => {
  try {
    const { collectionname, collectionurl, description, created_by } = req.body;

    if (!collectionname || !collectionurl || !created_by) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    //
    const newCollection = await Collections.create({
      collectionname,
      collectionurl,
      description,
      created_by,
      status: 1, // Mặc định là 1 (hoạt động)
    });

    res.status(201).json({
      message: "Thêm bộ sưu tập thành công!",
      data: newCollection,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
