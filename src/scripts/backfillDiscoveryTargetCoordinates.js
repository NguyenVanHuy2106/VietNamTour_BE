require("dotenv").config();

const axios = require("axios");
const { Op } = require("sequelize");

const sequelize = require("../config/database");

const { DiscoveryTarget } = require("../models/lead_ai");

const HERE_GEOCODE_URL = "https://geocode.search.hereapi.com/v1/geocode";

const HERE_API_KEY = "P1-zrqZTi19uR8LGBXPafL4HqZA7wn2JNNby5gVCU60";

function getDefaultRadius({ district, province }) {
  const suburbanKeywords = [
    "Huyện",
    "Củ Chi",
    "Hóc Môn",
    "Bình Chánh",
    "Nhà Bè",
    "Long Thành",
    "Nhơn Trạch",
    "Trảng Bom",
    "Đức Hòa",
    "Bến Lức",
  ];

  const isSuburban = suburbanKeywords.some((keyword) =>
    `${district} ${province}`.toLowerCase().includes(keyword.toLowerCase()),
  );

  return isSuburban ? 6000 : 4000;
}

async function geocodeArea({ district, province }) {
  const query = [district, province, "Việt Nam"].filter(Boolean).join(", ");

  const response = await axios.get(HERE_GEOCODE_URL, {
    params: {
      q: query,

      in: "countryCode:VNM",

      limit: 5,

      lang: "vi-VN",

      apiKey: HERE_API_KEY,
    },

    timeout: 30000,
  });

  const items = response.data?.items || [];

  if (!items.length) {
    return null;
  }

  // Ưu tiên locality / administrativeArea
  const best =
    items.find((item) =>
      ["locality", "administrativeArea"].includes(item.resultType),
    ) || items[0];

  if (!best?.position?.lat || !best?.position?.lng) {
    return null;
  }

  return {
    latitude: best.position.lat,

    longitude: best.position.lng,

    title: best.title,

    resultType: best.resultType,
  };
}

async function run() {
  try {
    if (!HERE_API_KEY) {
      throw new Error("HERE_API_KEY chưa cấu hình");
    }

    await sequelize.authenticate();

    console.log("[Backfill] Database connected.");

    // Chỉ lấy danh sách khu vực unique
    const targets = await DiscoveryTarget.findAll({
      where: {
        [Op.or]: [
          {
            latitude: null,
          },
          {
            longitude: null,
          },
        ],
      },

      attributes: ["province", "district"],

      group: ["province", "district"],

      raw: true,
    });

    console.log(`[Backfill] Có ${targets.length} khu vực cần geocode.`);

    let success = 0;
    let failed = 0;

    for (const area of targets) {
      try {
        console.log(`[Backfill] Geocode: ${area.district}, ${area.province}`);

        const geo = await geocodeArea(area);

        if (!geo) {
          console.log(
            `[Backfill] Không tìm thấy: ${area.district}, ${area.province}`,
          );

          failed++;

          continue;
        }

        const radius = getDefaultRadius(area);

        const [updatedCount] = await DiscoveryTarget.update(
          {
            latitude: geo.latitude,

            longitude: geo.longitude,

            radius,

            status: "READY",

            next_scan_at: null,

            last_error: null,
          },
          {
            where: {
              province: area.province,

              district: area.district,
            },
          },
        );

        console.log(
          [
            "[Backfill] OK",
            area.district,
            `lat=${geo.latitude}`,
            `lng=${geo.longitude}`,
            `radius=${radius}`,
            `targets=${updatedCount}`,
            `HERE=${geo.title}`,
          ].join(" | "),
        );

        success++;

        // delay nhẹ để tránh gọi dồn API
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (error) {
        console.error(
          `[Backfill] ERROR ${area.district}:`,
          error.response?.data || error.message,
        );

        failed++;
      }
    }

    console.log(
      `[Backfill] Hoàn tất | Success: ${success} | Failed: ${failed}`,
    );

    process.exit(0);
  } catch (error) {
    console.error("[Backfill] Fatal error:", error);

    process.exit(1);
  }
}

run();
