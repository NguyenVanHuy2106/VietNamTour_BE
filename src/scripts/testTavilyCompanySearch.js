require("dotenv").config();

const { searchCompanyWeb } = require("../services/lead_ai/webSearch.service");

async function run() {
  try {
    const company = {
      name: "Công Ty TNHH Một Thành Viên Sản Xuất Thương Mại Tân Đức Tài",

      district: "Thành phố Thủ Đức",

      province: "TP. Hồ Chí Minh",
    };

    const result = await searchCompanyWeb(company);

    console.dir(result, {
      depth: null,
    });

    process.exit(0);
  } catch (error) {
    console.error(error.response?.data || error.message);

    process.exit(1);
  }
}

run();
