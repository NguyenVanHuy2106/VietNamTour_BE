const { Op } = require("sequelize");

const { Company, GoongCompany } = require("../../models/lead_ai");

const { autocomplete, placeDetail } = require("./goong.service");

const {
  findBestPrediction,
  getDistanceMeters,
} = require("./goongMatcher.service");

const DEFAULT_LIMIT = 30;

const MATCH_THRESHOLD = 70;

const MAX_DISTANCE_METERS = 3000;

/**
 * Verify 1 candidate HERE.
 */
async function processCompany(company) {
  try {
    /**
     * =====================================================
     * 0. ĐÃ CÓ TRONG BẢNG GOONG THÌ SKIP
     * =====================================================
     */

    const existing = await GoongCompany.findOne({
      where: {
        source_company_id: company.id,
      },
    });

    if (existing) {
      await company.update({
        goong_status: "PASSED",

        goong_checked_at: new Date(),

        goong_last_error: null,
      });

      return {
        status: "SKIPPED",

        reason: "ALREADY_EXISTS",
      };
    }

    /**
     * =====================================================
     * 1. GOONG AUTOCOMPLETE
     * =====================================================
     */

    const predictions = await autocomplete({
      input: company.name,

      latitude: company.latitude,

      longitude: company.longitude,
    });

    /**
     * Không có kết quả Goong
     */
    if (!predictions || !predictions.length) {
      await company.update({
        goong_status: "REJECTED",

        goong_checked_at: new Date(),

        goong_last_error: null,
      });

      return {
        status: "REJECTED",

        reason: "NO_GOONG_RESULT",
      };
    }

    /**
     * =====================================================
     * 2. TÌM RESULT MATCH TỐT NHẤT
     * =====================================================
     */

    const best = findBestPrediction(company, predictions);

    if (!best || best.matchScore < MATCH_THRESHOLD) {
      await company.update({
        goong_status: "REJECTED",

        goong_checked_at: new Date(),

        goong_last_error: null,
      });

      return {
        status: "REJECTED",

        reason: "LOW_MATCH_SCORE",

        matchScore: best?.matchScore || 0,
      };
    }

    /**
     * =====================================================
     * 3. CHECK PLACE ID
     * =====================================================
     */

    const placeId = best.prediction?.place_id;

    if (!placeId) {
      await company.update({
        goong_status: "REJECTED",

        goong_checked_at: new Date(),

        goong_last_error: null,
      });

      return {
        status: "REJECTED",

        reason: "NO_PLACE_ID",

        matchScore: best.matchScore,
      };
    }

    /**
     * =====================================================
     * 4. GOONG PLACE DETAIL
     * =====================================================
     */

    const detail = await placeDetail(placeId);

    if (!detail) {
      await company.update({
        goong_status: "REJECTED",

        goong_checked_at: new Date(),

        goong_last_error: null,
      });

      return {
        status: "REJECTED",

        reason: "NO_PLACE_DETAIL",

        matchScore: best.matchScore,
      };
    }

    /**
     * =====================================================
     * 5. TỌA ĐỘ GOONG
     * =====================================================
     */

    const goongLat = detail?.geometry?.location?.lat ?? null;

    const goongLng = detail?.geometry?.location?.lng ?? null;

    /**
     * =====================================================
     * 6. TÍNH KHOẢNG CÁCH HERE ↔ GOONG
     * =====================================================
     */

    const distanceMeters = getDistanceMeters(
      company.latitude,
      company.longitude,
      goongLat,
      goongLng,
    );

    /**
     * Xa quá thì reject
     */
    if (distanceMeters !== null && distanceMeters > MAX_DISTANCE_METERS) {
      await company.update({
        goong_status: "REJECTED",

        goong_checked_at: new Date(),

        goong_last_error: null,
      });

      return {
        status: "REJECTED",

        reason: "TOO_FAR",

        matchScore: best.matchScore,

        distanceMeters,
      };
    }

    /**
     * =====================================================
     * 7. CHECK TRÙNG GOONG PLACE ID
     * =====================================================
     */

    const duplicateGoong = await GoongCompany.findOne({
      where: {
        goong_place_id: placeId,
      },
    });

    if (duplicateGoong) {
      /**
       * Candidate này match với một Goong place
       * đã tồn tại rồi.
       */
      await company.update({
        goong_status: "PASSED",

        goong_checked_at: new Date(),

        goong_last_error: null,
      });

      return {
        status: "DUPLICATE",

        reason: "GOONG_PLACE_EXISTS",

        goongCompanyId: duplicateGoong.id,

        matchScore: best.matchScore,

        distanceMeters,
      };
    }

    /**
     * =====================================================
     * 8. THÔNG TIN HÀNH CHÍNH
     * =====================================================
     */

    const province =
      detail?.compound?.province ||
      detail?.deprecated_compound?.province ||
      company.province ||
      null;

    const district =
      detail?.deprecated_compound?.district || company.district || null;

    const commune =
      detail?.compound?.commune || detail?.deprecated_compound?.commune || null;

    /**
     * =====================================================
     * 9. PHONE / WEBSITE
     * =====================================================
     *
     * Ưu tiên Goong nếu có,
     * không có thì lấy HERE.
     */

    const goongPhone =
      detail.phone ||
      detail.formatted_phone_number ||
      detail.international_phone_number ||
      detail?.contact?.phone ||
      null;

    const goongWebsite = detail.website || detail.url_website || null;

    /**
     * =====================================================
     * 10. INSERT VÀO goong_companies
     * =====================================================
     */

    const created = await GoongCompany.create({
      source_company_id: company.id,

      here_place_id: company.google_place_id,

      goong_place_id: placeId,

      name:
        detail.name ||
        best.prediction?.structured_formatting?.main_text ||
        best.prediction?.main_text ||
        company.name,

      formatted_address:
        detail.formatted_address ||
        best.prediction?.description ||
        company.formatted_address,

      province,

      district,

      commune,

      latitude: goongLat,

      longitude: goongLng,

      primary_type: Array.isArray(detail.types)
        ? detail.types[0] || company.primary_type
        : company.primary_type,

      types: detail.types || company.types || [],

      phone: goongPhone || company.phone || null,

      website: goongWebsite || company.website || null,

      goong_url: detail.url || null,

      goong_score: best.prediction?.score ?? null,

      match_score: best.matchScore,

      distance_meters: distanceMeters,

      source: "HERE_GOONG",

      lead_status: "NEW",

      goong_checked_at: new Date(),
    });

    /**
     * =====================================================
     * 11. MARK SOURCE COMPANY PASSED
     * =====================================================
     */

    await company.update({
      goong_status: "PASSED",

      goong_checked_at: new Date(),

      goong_last_error: null,
    });

    /**
     * =====================================================
     * DONE
     * =====================================================
     */

    return {
      status: "INSERTED",

      id: created.id,

      sourceCompanyId: company.id,

      matchScore: best.matchScore,

      distanceMeters,
    };
  } catch (error) {
    /**
     * =====================================================
     * ERROR
     * =====================================================
     */

    try {
      await company.update({
        goong_status: "ERROR",

        goong_checked_at: new Date(),

        goong_last_error: error.message,
      });
    } catch (updateError) {
      console.error(
        `[GoongAgent] Không thể cập nhật ERROR cho company ${company.id}:`,
        updateError.message,
      );
    }

    throw error;
  }
}

/**
 * Process nhiều HERE companies.
 */
async function runGoongAgent(options = {}) {
  const limit = Math.max(
    1,
    Math.min(Number(options.limit || DEFAULT_LIMIT), 30),
  );

  const onProgress =
    typeof options.onProgress === "function" ? options.onProgress : null;

  /**
   * =====================================================
   * CONFIG CONCURRENCY
   * =====================================================
   */

  const BATCH_SIZE = 5;

  /**
   * =====================================================
   * EXISTING GOONG COMPANIES
   * =====================================================
   */

  const existingRows = await GoongCompany.findAll({
    attributes: ["source_company_id"],

    raw: true,
  });

  const processedIds = existingRows.map((row) => row.source_company_id);

  const where = {};

  if (processedIds.length) {
    where.id = {
      [Op.notIn]: processedIds,
    };
  }

  /**
   * =====================================================
   * LOAD HERE CANDIDATES
   * =====================================================
   *
   * Lấy dư vì có thể reject.
   */

  const companies = await Company.findAll({
    where: {
      goong_status: "PENDING",
    },

    order: [["created_at", "DESC"]],

    limit: Math.max(limit * 4, 100),
  });

  /**
   * =====================================================
   * RESULT
   * =====================================================
   */

  const result = {
    requested: limit,

    checked: 0,

    inserted: 0,

    rejected: 0,

    duplicates: 0,

    skipped: 0,

    errors: [],
  };

  /**
   * =====================================================
   * PROGRESS CALLBACK
   * =====================================================
   */

  function reportProgress() {
    if (!onProgress) {
      return;
    }

    onProgress({
      requested: result.requested,

      checked: result.checked,

      inserted: result.inserted,

      rejected: result.rejected,

      duplicates: result.duplicates,

      skipped: result.skipped,

      errors: result.errors.length,
    });
  }

  /**
   * =====================================================
   * BATCH LOOP
   * =====================================================
   */

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    /**
     * Đủ lead sạch rồi.
     */
    if (result.inserted >= limit) {
      break;
    }

    const batch = companies.slice(i, i + BATCH_SIZE);

    /**
     * Chạy 5 company song song.
     */
    const batchResults = await Promise.allSettled(
      batch.map((company) => processCompany(company)),
    );

    /**
     * =================================================
     * PROCESS BATCH RESULT
     * =================================================
     */

    for (let index = 0; index < batchResults.length; index++) {
      const company = batch[index];

      const response = batchResults[index];

      result.checked++;

      /**
       * Promise lỗi.
       */
      if (response.status === "rejected") {
        result.errors.push({
          companyId: company.id,

          name: company.name,

          message: response.reason?.message || String(response.reason),
        });

        // console.error(
        //   `[GoongAgent] ${company.id} | ${company.name} ERROR:`,
        //   response.reason?.message || response.reason,
        // );

        continue;
      }

      const processed = response.value;

      switch (processed.status) {
        case "INSERTED":
          result.inserted++;
          break;

        case "REJECTED":
          result.rejected++;
          break;

        case "DUPLICATE":
          result.duplicates++;
          break;

        case "SKIPPED":
          result.skipped++;
          break;

        default:
          break;
      }

      //   console.log(
      //     `[GoongAgent] ${company.id} | ${company.name} => ${processed.status}`,
      //   );
    }

    /**
     * Cập nhật status cho frontend.
     */
    reportProgress();

    // console.log(
    //   `[GoongAgent] Progress: checked=${result.checked}, inserted=${result.inserted}/${limit}`,
    // );
  }

  /**
   * Final progress
   */
  reportProgress();

  return result;
}

module.exports = {
  processCompany,
  runGoongAgent,
};
