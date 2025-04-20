const axios = require("axios");
const sequelize = require("./database"); // Đảm bảo đã có file cấu hình DB
const Province = require("../models/province.model"); // Model Sequelize cho bảng province

const fetchAndSaveProvinces = async () => {
  try {
    const response = await axios.get(
      "https://online-gateway.ghn.vn/shiip/public-api/master-data/province",
      {
        headers: {
          "Content-Type": "application/json",
          Token: "17fdb6e5-c950-11ed-b09a-9a2a48e971b0",
        },
      }
    );

    const provinces = response.data.data;

    if (!Array.isArray(provinces)) {
      console.error("Dữ liệu API không hợp lệ!");
      return;
    }

    await sequelize.sync(); // Đảm bảo bảng đã tồn tại

    for (const item of provinces) {
      await Province.create({
        provinceid: item.ProvinceID,
        provincename: item.ProvinceName,
        countryid: "VN",
        description: null, // API không có description
        created_by: 1, // Mặc định người tạo
        status: 1, // Mặc định status là 1
      });
    }

    console.log("Dữ liệu tỉnh/thành đã được lưu vào DB!");
  } catch (error) {
    console.error("Lỗi khi gọi API hoặc lưu dữ liệu:", error.message);
  }
};

module.exports = { fetchAndSaveProvinces };
