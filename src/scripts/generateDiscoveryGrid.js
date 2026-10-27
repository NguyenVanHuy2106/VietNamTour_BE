require("dotenv").config();

const sequelize = require("../config/database");

const { DiscoveryTarget, DiscoveryGridCell } = require("../models/lead_ai");

const { generateGrid } = require("../services/lead_ai/gridGenerator.service");

// function getGridConfig(target) {
//   const district = (target.district || "").toLowerCase();

//   // Khu vực nhỏ
//   if (
//     district.includes("quận 1") ||
//     district.includes("quận 3") ||
//     district.includes("quận 4") ||
//     district.includes("quận 5")
//   ) {
//     return {
//       rows: 2,
//       cols: 2,
//       spacingKm: 2.5,
//       radius: 2000,
//     };
//   }

//   // Khu vực trung bình
//   if (
//     district.includes("quận 7") ||
//     district.includes("tân bình") ||
//     district.includes("gò vấp") ||
//     district.includes("phú nhuận") ||
//     district.includes("dĩ an") ||
//     district.includes("thuận an")
//   ) {
//     return {
//       rows: 3,
//       cols: 3,
//       spacingKm: 3,
//       radius: 2500,
//     };
//   }

//   // Khu vực lớn
//   if (district.includes("thủ đức") || district.includes("biên hòa")) {
//     return {
//       rows: 4,
//       cols: 4,
//       spacingKm: 3.5,
//       radius: 2500,
//     };
//   }

//   // Khu vực rất lớn
//   if (
//     district.includes("bình chánh") ||
//     district.includes("củ chi") ||
//     district.includes("hóc môn")
//   ) {
//     return {
//       rows: 5,
//       cols: 5,
//       spacingKm: 4,
//       radius: 3000,
//     };
//   }

//   // Default
//   return {
//     rows: 3,
//     cols: 3,
//     spacingKm: 3.5,
//     radius: 2500,
//   };
// }

function normalizeDistrict(value = "") {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getGridConfig(target) {
  const district = normalizeDistrict(target.district);

  const smallAreas = new Set(["quận 1", "quận 3", "quận 4", "quận 5"]);

  const mediumAreas = new Set([
    "quận 6",
    "quận 7",
    "quận 8",
    "quận 10",
    "quận 11",
    "quận 12",

    "quận bình thạnh",
    "bình thạnh",

    "quận bình tân",

    "quận tân bình",
    "tân bình",

    "quận tân phú",
    "quận gò vấp",
    "quận phú nhuận",

    "dĩ an",
    "thuận an",
    "thủ dầu một",
    "tân uyên",
    "bến cát",

    "bà rịa",
    "vũng tàu",

    "tân an",
    "bến lức",
    "cần giuộc",
    "đức hòa",

    "trảng bom",
  ]);

  const largeAreas = new Set([
    "thành phố thủ đức",
    "biên hòa",
    "long thành",
    "nhơn trạch",
    "phú mỹ",
    "huyện nhà bè",
  ]);

  const veryLargeAreas = new Set([
    "huyện bình chánh",
    "huyện củ chi",
    "huyện hóc môn",
  ]);

  if (smallAreas.has(district)) {
    return {
      rows: 2,
      cols: 2,
      spacingKm: 2.5,
      radius: 2000,
    };
  }

  if (mediumAreas.has(district)) {
    return {
      rows: 3,
      cols: 3,
      spacingKm: 3,
      radius: 2500,
    };
  }

  if (largeAreas.has(district)) {
    return {
      rows: 4,
      cols: 4,
      spacingKm: 3.5,
      radius: 2500,
    };
  }

  if (veryLargeAreas.has(district)) {
    return {
      rows: 5,
      cols: 5,
      spacingKm: 4,
      radius: 3000,
    };
  }

  return {
    rows: 3,
    cols: 3,
    spacingKm: 3.5,
    radius: 2500,
  };
}

async function run() {
  try {
    await sequelize.authenticate();

    console.log("[Grid Generator] Database connected.");

    // Chỉ cần lấy unique district/province,
    // vì 16 keyword cùng district dùng chung grid
    const targets = await DiscoveryTarget.findAll({
      where: {
        status: "READY",
      },

      attributes: ["province", "district", "latitude", "longitude"],

      group: ["province", "district", "latitude", "longitude"],

      raw: true,
    });

    console.log(`[Grid Generator] Có ${targets.length} khu vực.`);

    let created = 0;
    let skipped = 0;

    for (const target of targets) {
      if (target.latitude == null || target.longitude == null) {
        continue;
      }

      const config = getGridConfig(target);

      const cells = generateGrid({
        centerLat: Number(target.latitude),

        centerLng: Number(target.longitude),

        rows: config.rows,

        cols: config.cols,

        spacingKm: config.spacingKm,

        radius: config.radius,
      });

      console.log(
        `[Grid Generator] ${target.district} → ${cells.length} cells`,
      );

      for (const cell of cells) {
        const [, wasCreated] = await DiscoveryGridCell.findOrCreate({
          where: {
            province: target.province,

            district: target.district,

            latitude: Number(cell.latitude.toFixed(7)),

            longitude: Number(cell.longitude.toFixed(7)),
          },

          defaults: {
            province: target.province,

            district: target.district,

            latitude: Number(cell.latitude.toFixed(7)),

            longitude: Number(cell.longitude.toFixed(7)),

            radius: cell.radius,

            status: "READY",

            priority: 5,
          },
        });

        if (wasCreated) {
          created++;
        } else {
          skipped++;
        }
      }
    }

    console.log(
      `[Grid Generator] DONE | Created: ${created} | Skipped: ${skipped}`,
    );

    process.exit(0);
  } catch (error) {
    console.error("[Grid Generator] ERROR:", error);

    process.exit(1);
  }
}

run();
