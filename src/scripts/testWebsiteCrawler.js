require("dotenv").config();

const {
  crawlCompanyWebsite,
} = require("../services/lead_ai/websiteCrawler.service");

async function run() {
  try {
    const result = await crawlCompanyWebsite("https://www.tdt-tanduc.com");

    console.dir(result, {
      depth: null,
    });

    process.exit(0);
  } catch (error) {
    console.error(error.message);

    process.exit(1);
  }
}

run();
