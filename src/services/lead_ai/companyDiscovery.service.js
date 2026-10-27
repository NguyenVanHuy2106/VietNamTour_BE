const { Op } = require("sequelize");

const {
  Company,
  DiscoveryTarget,
  DiscoveryRun,
  CompanySource,
  DiscoveryGridCell,
} = require("../../models/lead_ai");

const { searchGooglePlaces } = require("./googlePlaces.service");

// ======================================================
// CONFIG
// ======================================================

// Sau khi quét xong 1 grid cell thì bao lâu quét lại
const RESCAN_DAYS = 30;

// Nghỉ nhẹ giữa các keyword để không gọi HERE dồn dập
const DELAY_BETWEEN_KEYWORDS_MS = 300;

// ======================================================
// UTILS
// ======================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ======================================================
// NORMALIZE PLACE
// ======================================================

function normalizePlace(place) {
  return {
    google_place_id: place.id || null,

    name: place.displayName?.text?.trim() || "Không xác định",

    formatted_address: place.formattedAddress || null,

    latitude: place.location?.latitude ?? null,

    longitude: place.location?.longitude ?? null,

    primary_type: place.primaryType || null,

    types: Array.isArray(place.types) ? place.types : [],

    // HERE service hiện tại đang map về
    // place.website / place.phone
    website: place.website || place.websiteUri || null,

    phone: place.phone || place.nationalPhoneNumber || null,

    rating: place.rating ?? null,

    review_count: place.userRatingCount || 0,

    business_status: place.businessStatus || null,

    source: "HERE",

    discovery_status: "DISCOVERED",

    last_seen_at: new Date(),
  };
}

// ======================================================
// SAVE COMPANY SOURCE
// ======================================================

async function saveCompanySource({ company, place }) {
  if (!company || !place?.id) {
    return null;
  }

  const existingSource = await CompanySource.findOne({
    where: {
      company_id: company.id,

      source_type: "HERE",

      source_reference: place.id,
    },
  });

  if (existingSource) {
    return existingSource;
  }

  return CompanySource.create({
    company_id: company.id,

    source_type: "HERE",

    source_url: place.website || null,

    source_reference: place.id,

    discovered_at: new Date(),

    raw_data: place.rawHereData || place,
  });
}

// ======================================================
// SAVE / UPDATE COMPANY
// ======================================================

async function saveCompany({ place, gridCell }) {
  if (!place?.id) {
    return {
      type: "SKIPPED",
      company: null,
    };
  }

  const normalized = normalizePlace(place);

  const existing = await Company.findOne({
    where: {
      google_place_id: normalized.google_place_id,
    },
  });

  // ==================================================
  // EXISTING COMPANY
  // ==================================================

  if (existing) {
    await existing.update({
      name: normalized.name || existing.name,

      formatted_address:
        normalized.formatted_address || existing.formatted_address,

      latitude: normalized.latitude ?? existing.latitude,

      longitude: normalized.longitude ?? existing.longitude,

      primary_type: normalized.primary_type || existing.primary_type,

      types: normalized.types?.length ? normalized.types : existing.types,

      website: normalized.website || existing.website,

      phone: normalized.phone || existing.phone,

      rating: normalized.rating ?? existing.rating,

      review_count: normalized.review_count ?? existing.review_count,

      business_status: normalized.business_status || existing.business_status,

      last_seen_at: new Date(),
    });

    await saveCompanySource({
      company: existing,
      place,
    });

    return {
      type: "UPDATED",
      company: existing,
    };
  }

  // ==================================================
  // NEW COMPANY
  // ==================================================

  const company = await Company.create({
    ...normalized,

    province: gridCell.province,

    district: gridCell.district,

    first_discovered_at: new Date(),
  });

  await saveCompanySource({
    company,
    place,
  });

  return {
    type: "INSERTED",
    company,
  };
}

// ======================================================
// GET NEXT GRID CELL
// ======================================================

async function getNextGridCell() {
  return DiscoveryGridCell.findOne({
    where: {
      status: "READY",

      [Op.or]: [
        {
          next_scan_at: null,
        },
        {
          next_scan_at: {
            [Op.lte]: new Date(),
          },
        },
      ],
    },

    order: [
      ["priority", "ASC"],

      // cell chưa từng quét lên trước
      ["last_scanned_at", "ASC"],

      ["id", "ASC"],
    ],
  });
}

// ======================================================
// GET KEYWORDS FOR GRID CELL
// ======================================================

async function getKeywordsForGridCell(gridCell) {
  const targets = await DiscoveryTarget.findAll({
    where: {
      status: "READY",

      province: gridCell.province,

      district: gridCell.district,
    },

    order: [
      ["priority", "ASC"],
      ["id", "ASC"],
    ],
  });

  return targets;
}

// ======================================================
// RUN ONE KEYWORD
// ======================================================

async function runKeywordDiscovery({ gridCell, target }) {
  let run = null;

  try {
    run = await DiscoveryRun.create({
      target_id: target.id,

      started_at: new Date(),

      status: "RUNNING",
    });

    // console.log(
    //   [
    //     "[Company Discovery]",
    //     `Grid #${gridCell.id}`,
    //     `${gridCell.district}`,
    //     `Keyword: ${target.keyword}`,
    //     `Lat: ${gridCell.latitude}`,
    //     `Lng: ${gridCell.longitude}`,
    //     `Radius: ${gridCell.radius}m`,
    //   ].join(" | "),
    // );

    // ==================================================
    // CALL HERE
    // ==================================================

    const result = await searchGooglePlaces({
      textQuery: target.keyword,

      latitude: Number(gridCell.latitude),

      longitude: Number(gridCell.longitude),

      radius: Number(gridCell.radius),

      offset: 0,
    });

    const places = result.places || [];

    let insertedCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;

    // ==================================================
    // SAVE RESULTS
    // ==================================================

    for (const place of places) {
      try {
        const saved = await saveCompany({
          place,
          gridCell,
        });

        switch (saved.type) {
          case "INSERTED":
            insertedCount++;
            break;

          case "UPDATED":
            updatedCount++;
            duplicateCount++;
            break;

          default:
            skippedCount++;
            break;
        }
      } catch (error) {
        console.error(
          `[Company Discovery] Lỗi lưu place ${place?.id}:`,
          error.message,
        );
      }
    }

    // ==================================================
    // DISCOVERY RUN SUCCESS
    // ==================================================

    run.status = "SUCCESS";

    run.found_count = places.length;

    run.inserted_count = insertedCount;

    run.updated_count = updatedCount;

    run.duplicate_count = duplicateCount;

    run.completed_at = new Date();

    run.error_message = null;

    await run.save();

    // console.log(
    //   [
    //     "[Company Discovery] Keyword DONE",
    //     `Grid: ${gridCell.id}`,
    //     `Keyword: ${target.keyword}`,
    //     `Found: ${places.length}`,
    //     `New: ${insertedCount}`,
    //     `Duplicate: ${duplicateCount}`,
    //     `Skipped: ${skippedCount}`,
    //   ].join(" | "),
    // );

    return {
      success: true,

      found: places.length,

      inserted: insertedCount,

      updated: updatedCount,

      duplicate: duplicateCount,

      skipped: skippedCount,
    };
  } catch (error) {
    const errorMessage = error.response?.data || error.message;

    console.error(
      `[Company Discovery] Keyword ERROR | ${target.keyword}:`,
      errorMessage,
    );

    if (run) {
      run.status = "FAILED";

      run.completed_at = new Date();

      run.error_message =
        typeof errorMessage === "string"
          ? errorMessage
          : JSON.stringify(errorMessage);

      await run.save();
    }

    return {
      success: false,

      found: 0,
      inserted: 0,
      updated: 0,
      duplicate: 0,
      skipped: 0,

      error: errorMessage,
    };
  }
}

// ======================================================
// MAIN AGENT
// ======================================================

async function runAutomaticCompanyDiscovery() {
  const gridCell = await getNextGridCell();

  if (!gridCell) {
    //console.log("[Company Discovery] Không có grid cell cần chạy.");

    return null;
  }

  try {
    // ==================================================
    // LOCK GRID CELL
    // ==================================================

    gridCell.status = "PROCESSING";

    await gridCell.save();

    // ==================================================
    // GET KEYWORDS
    // ==================================================

    const targets = await getKeywordsForGridCell(gridCell);

    if (!targets.length) {
      //console.log(`[Company Discovery] Grid #${gridCell.id} không có keyword.`);

      gridCell.status = "READY";

      gridCell.last_scanned_at = new Date();

      gridCell.next_scan_at = new Date(
        Date.now() + RESCAN_DAYS * 24 * 60 * 60 * 1000,
      );

      await gridCell.save();

      return null;
    }

    // console.log(
    //   [
    //     "[Company Discovery] START GRID",
    //     `#${gridCell.id}`,
    //     `${gridCell.district}`,
    //     `${gridCell.province}`,
    //     `Keywords: ${targets.length}`,
    //   ].join(" | "),
    // );

    // ==================================================
    // TOTAL STATS
    // ==================================================

    let totalFound = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalDuplicate = 0;
    let successKeywords = 0;
    let failedKeywords = 0;

    // ==================================================
    // RUN ALL KEYWORDS IN THIS CELL
    // ==================================================

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];

      const result = await runKeywordDiscovery({
        gridCell,
        target,
      });

      if (result.success) {
        successKeywords++;

        totalFound += result.found;

        totalInserted += result.inserted;

        totalUpdated += result.updated;

        totalDuplicate += result.duplicate;
      } else {
        failedKeywords++;
      }

      // Không delay sau keyword cuối
      if (i < targets.length - 1) {
        await sleep(DELAY_BETWEEN_KEYWORDS_MS);
      }
    }

    // ==================================================
    // GRID COMPLETE
    // ==================================================

    gridCell.status = "READY";

    gridCell.last_scanned_at = new Date();

    gridCell.next_scan_at = new Date(
      Date.now() + RESCAN_DAYS * 24 * 60 * 60 * 1000,
    );

    await gridCell.save();

    // console.log(
    //   [
    //     "[Company Discovery] GRID DONE",
    //     `Grid: ${gridCell.id}`,
    //     `District: ${gridCell.district}`,
    //     `Keywords OK: ${successKeywords}`,
    //     `Keywords Failed: ${failedKeywords}`,
    //     `Found: ${totalFound}`,
    //     `Inserted: ${totalInserted}`,
    //     `Updated: ${totalUpdated}`,
    //     `Duplicate: ${totalDuplicate}`,
    //   ].join(" | "),
    // );

    return {
      grid_cell_id: gridCell.id,

      province: gridCell.province,

      district: gridCell.district,

      keyword_count: targets.length,

      success_keywords: successKeywords,

      failed_keywords: failedKeywords,

      found: totalFound,

      inserted: totalInserted,

      updated: totalUpdated,

      duplicate: totalDuplicate,
    };
  } catch (error) {
    console.error(
      "[Company Discovery] GRID ERROR:",
      error.response?.data || error.message,
    );

    // Có lỗi tổng thì mở lại cell
    // để scheduler thử lại sau 1 giờ
    gridCell.status = "READY";

    gridCell.next_scan_at = new Date(Date.now() + 60 * 60 * 1000);

    await gridCell.save();

    throw error;
  }
}

module.exports = {
  runAutomaticCompanyDiscovery,
};
