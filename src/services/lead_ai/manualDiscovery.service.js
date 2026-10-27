const {
  Company,
  CompanySource,
  DiscoveryGridCell,
} = require("../../models/lead_ai");

const { searchGooglePlaces } = require("./googlePlaces.service");

/**
 * =========================================================
 * CONFIG
 * =========================================================
 */

const DEFAULT_LIMIT = 30;

/**
 * Chỉ search công ty.
 */
const KEYWORDS = [
  // =========================================================
  // DOANH NGHIỆP QUY MÔ LỚN / TẬP ĐOÀN
  // =========================================================
  "tập đoàn",
  "tổng công ty",
  "công ty cổ phần",
  "công ty TNHH",
  "công ty FDI",
  "công ty nước ngoài",

  // =========================================================
  // SẢN XUẤT - NHÀ MÁY
  // Nhóm rất tiềm năng vì thường đông nhân sự
  // =========================================================
  "công ty sản xuất",
  "doanh nghiệp sản xuất",
  "nhà máy",
  "xí nghiệp",
  "công ty công nghiệp",

  // =========================================================
  // KHU CÔNG NGHIỆP
  // =========================================================
  "công ty khu công nghiệp",
  "nhà máy khu công nghiệp",
  "doanh nghiệp khu công nghiệp",

  // =========================================================
  // XUẤT NHẬP KHẨU - LOGISTICS
  // =========================================================
  "công ty xuất nhập khẩu",
  "công ty logistics",
  "công ty kho vận",
  "công ty vận tải",
  "công ty giao nhận",

  // =========================================================
  // CƠ KHÍ - ĐIỆN - ĐIỆN TỬ
  // =========================================================
  "công ty cơ khí",
  "công ty cơ khí chính xác",
  "công ty điện tử",
  "công ty thiết bị điện",
  "công ty tự động hóa",
  "công ty thiết bị công nghiệp",

  // =========================================================
  // DỆT MAY - GIÀY DA
  // Rất phù hợp tour đoàn vì thường đông công nhân
  // =========================================================
  "công ty may mặc",
  "công ty dệt may",
  "công ty giày da",

  // =========================================================
  // THỰC PHẨM - NÔNG SẢN
  // =========================================================
  "công ty thực phẩm",
  "công ty chế biến thực phẩm",
  "công ty thủy sản",
  "công ty nông sản",

  // =========================================================
  // DƯỢC - Y TẾ
  // =========================================================
  "công ty dược phẩm",
  "công ty thiết bị y tế",

  // =========================================================
  // NHỰA - BAO BÌ
  // =========================================================
  "công ty nhựa",
  "công ty bao bì",

  // =========================================================
  // XÂY DỰNG
  // =========================================================
  "công ty xây dựng",
  "công ty cơ điện",
  "công ty kỹ thuật",

  // =========================================================
  // CÔNG NGHỆ
  // Nhân sự văn phòng, khá hợp team building / company trip
  // =========================================================
  "công ty công nghệ",
  "công ty phần mềm",
  "công ty công nghệ thông tin",

  // =========================================================
  // DOANH NGHIỆP NƯỚC NGOÀI
  // =========================================================
  "công ty Nhật Bản",
  "công ty Hàn Quốc",
  "công ty Đài Loan",
  "công ty Singapore",
];

/**
 * Các loại POI không muốn lưu vào DB.
 *
 * So sánh theo dạng includes nên ví dụ:
 * "Cửa hàng điện tử gia dụng"
 * sẽ match với "cửa hàng".
 */
const EXCLUDED_PRIMARY_TYPE_KEYWORDS = [
  "cửa hàng",
  "nhà hàng",
  "quán",
  "cafeteria",
  "tạp hóa",
  "siêu thị",
  "hiệu thuốc",
  "nhà thuốc",
  "cắt tóc",
  "tạo mẫu",
  "salon",
  "khách sạn",
  "nhà nghỉ",
  "trạm xăng",
  "điện máy",
  "điện thoại",
  "bar",
  "pub",
  "coffee",
  "cà phê",
  "tiệm bánh",
  "chợ",
  "Đại lý du lịch & Vé",
  "Nhà thờ",
  "Dịch vụ vận chuyển",
];

/**
 * Các từ thường cho thấy tên POI là cửa hàng/quán,
 * dùng làm lớp lọc phụ.
 *
 * Không nên lọc quá rộng để tránh bỏ nhầm công ty thật.
 */
const EXCLUDED_NAME_KEYWORDS = [
  "quán ",
  "quán",
  "cửa hàng",
  "tạp hóa",
  "tiệm ",
  "tiệm",
  "nhà thuốc",
  "hiệu thuốc",
  "spa ",
  "spa",
  "salon",
  "barber",
  "điện máy",
  "điện thoại",
  "đtdđ",
  "trà sữa",
  "coffee",
  "cà phê",
  "hủ tiếu",
  "bún ",
  "phở ",
  "cháo ",
  "cơm ",
];

/**
 * =========================================================
 * SHOULD SKIP COMPANY
 * =========================================================
 *
 * true  = bỏ
 * false = cho phép xử lý/lưu
 */

function shouldSkipCompany(item = {}) {
  const primaryType = String(
    item.primaryType || item.categories?.[0]?.name || "",
  )
    .toLowerCase()
    .trim();

  const name = String(item.displayName?.text || item.title || "")
    .toLowerCase()
    .trim();

  /**
   * ---------------------------------------------------------
   * FILTER TÊN QUÁ CHUNG CHUNG
   * ---------------------------------------------------------
   */
  const invalidExactNames = ["công ty", "cty", "company"];

  if (invalidExactNames.includes(name)) {
    return true;
  }

  /**
   * ---------------------------------------------------------
   * FILTER PRIMARY TYPE
   * ---------------------------------------------------------
   */
  if (primaryType) {
    const matchedPrimaryType = EXCLUDED_PRIMARY_TYPE_KEYWORDS.some((keyword) =>
      primaryType.includes(keyword.toLowerCase()),
    );

    if (matchedPrimaryType) {
      return true;
    }
  }

  /**
   * ---------------------------------------------------------
   * FILTER NAME
   * ---------------------------------------------------------
   */
  if (name) {
    const matchedName = EXCLUDED_NAME_KEYWORDS.some((keyword) =>
      name.includes(keyword.toLowerCase()),
    );

    if (matchedName) {
      return true;
    }
  }

  return false;
}

/**
 * =========================================================
 * NORMALIZE COMPANY
 * =========================================================
 */

function normalizeCompany(item = {}) {
  return {
    google_place_id: item.id || null,

    name: item.displayName?.text || item.title || "Không xác định",

    formatted_address: item.formattedAddress || item.address?.label || null,

    latitude: item.location?.latitude ?? item.position?.lat ?? null,

    longitude: item.location?.longitude ?? item.position?.lng ?? null,

    primary_type: item.primaryType || item.categories?.[0]?.name || null,

    types: Array.isArray(item.types)
      ? item.types
      : Array.isArray(item.categories)
        ? item.categories.map((category) => category.name)
        : [],

    website: item.website || null,

    phone: item.phone || null,

    rating: item.rating ?? null,

    review_count: item.userRatingCount ?? 0,

    business_status: item.businessStatus || null,

    source: item.sourceProvider || "HERE",

    discovery_status: "DISCOVERED",

    last_seen_at: new Date(),
  };
}

/**
 * =========================================================
 * EXTRACT SEARCH RESULTS
 * =========================================================
 */

function extractCompaniesFromSearchResult(searchResult) {
  if (Array.isArray(searchResult)) {
    return searchResult;
  }

  if (Array.isArray(searchResult?.places)) {
    return searchResult.places;
  }

  if (Array.isArray(searchResult?.results)) {
    return searchResult.results;
  }

  if (Array.isArray(searchResult?.items)) {
    return searchResult.items;
  }

  return [];
}

/**
 * =========================================================
 * SAVE COMPANY SOURCE
 * =========================================================
 */

async function saveCompanySource(companyId, item) {
  try {
    await CompanySource.create({
      company_id: companyId,

      source_type: item.sourceProvider || "HERE",

      source_url: item.googleMapsUri || null,

      source_reference: item.id || null,

      discovered_at: new Date(),

      raw_data: item.rawHereData || item,
    });
  } catch (error) {
    /**
     * Source lưu lỗi thì không làm fail company chính.
     */
    console.error("[ManualDiscovery] Save source error:", error.message);
  }
}

/**
 * =========================================================
 * PROCESS COMPANY
 * =========================================================
 */

async function processCompany(item, target, result) {
  /**
   * Không có HERE ID thì bỏ.
   */
  if (!item || !item.id) {
    return;
  }

  /**
   * ---------------------------------------------------------
   * FILTER RÁC TRƯỚC KHI ĐỘNG VÀO DATABASE
   * ---------------------------------------------------------
   */
  if (shouldSkipCompany(item)) {
    result.filtered++;

    return;
  }

  const payload = normalizeCompany(item);

  /**
   * ---------------------------------------------------------
   * CHECK DUPLICATE
   * ---------------------------------------------------------
   */

  const existing = await Company.findOne({
    where: {
      google_place_id: payload.google_place_id,
    },
  });

  /**
   * ---------------------------------------------------------
   * UPDATE EXISTING
   * ---------------------------------------------------------
   */

  if (existing) {
    result.duplicates++;

    await existing.update({
      name: payload.name || existing.name,

      formatted_address: payload.formatted_address,

      province: target.province || existing.province || null,

      district: target.district || existing.district || null,

      latitude: payload.latitude,

      longitude: payload.longitude,

      primary_type: payload.primary_type,

      types: payload.types,

      website: payload.website,

      phone: payload.phone,

      rating: payload.rating,

      review_count: payload.review_count,

      business_status: payload.business_status,

      source: payload.source,

      last_seen_at: new Date(),
    });

    result.updated++;

    return;
  }

  /**
   * ---------------------------------------------------------
   * CREATE NEW COMPANY
   * ---------------------------------------------------------
   */

  const created = await Company.create({
    ...payload,

    province: target.province || null,

    district: target.district || null,

    first_discovered_at: new Date(),

    last_seen_at: new Date(),
  });

  result.inserted++;

  /**
   * ---------------------------------------------------------
   * SAVE SOURCE
   * ---------------------------------------------------------
   */

  await saveCompanySource(created.id, item);
}

/**
 * =========================================================
 * RUN MANUAL DISCOVERY
 * =========================================================
 */

async function runManualDiscovery(options = {}) {
  /**
   * =====================================================
   * LIMIT
   * =====================================================
   */

  const limit = Math.max(
    1,
    Math.min(Number(options.limit || DEFAULT_LIMIT), 30),
  );

  /**
   * =====================================================
   * RESULT
   * =====================================================
   */

  const result = {
    requested: limit,

    found: 0,

    inserted: 0,

    updated: 0,

    duplicates: 0,

    /**
     * Số record bị loại vì primary_type/name rác.
     */
    filtered: 0,

    processedTargets: 0,

    processedSearches: 0,

    errors: [],

    completed: false,
  };

  /**
   * =====================================================
   * GET GRID CELLS
   * =====================================================
   *
   * Lấy nhiều grid để nếu:
   *
   * - HERE trả ít
   * - duplicate nhiều
   * - data rác bị filter nhiều
   *
   * thì vẫn tiếp tục quét đến khi đủ 100 company mới.
   */

  const targets = await DiscoveryGridCell.findAll({
    where: {
      status: "READY",
    },

    order: [
      ["last_scanned_at", "ASC NULLS FIRST"],

      ["priority", "DESC"],

      ["id", "ASC"],
    ],

    limit: 300,
  });

  if (!targets.length) {
    return {
      ...result,

      completed: true,

      message: "Không còn discovery grid READY",
    };
  }

  /**
   * =====================================================
   * LOOP GRID
   * =====================================================
   */

  for (const target of targets) {
    /**
     * Đã đủ company mới
     */
    if (result.inserted >= limit) {
      break;
    }

    result.processedTargets++;

    /**
     * =================================================
     * LOOP KEYWORDS
     * =================================================
     */

    for (const keyword of KEYWORDS) {
      if (result.inserted >= limit) {
        break;
      }

      result.processedSearches++;

      try {
        /**
         * -----------------------------------------------
         * HERE SEARCH
         * -----------------------------------------------
         */

        const searchResult = await searchGooglePlaces({
          textQuery: keyword,

          latitude: target.latitude,

          longitude: target.longitude,

          radius: target.radius || 2500,

          limit: 100,
        });

        /**
         * -----------------------------------------------
         * EXTRACT RESULTS
         * -----------------------------------------------
         */

        const companies = extractCompaniesFromSearchResult(searchResult);

        result.found += companies.length;

        /**
         * -----------------------------------------------
         * PROCESS RESULTS
         * -----------------------------------------------
         */

        for (const item of companies) {
          if (result.inserted >= limit) {
            break;
          }

          try {
            await processCompany(item, target, result);
          } catch (companyError) {
            result.errors.push({
              targetId: target.id,

              keyword,

              companyId: item?.id || null,

              type: "COMPANY_PROCESS",

              message: companyError.message,
            });
          }
        }
      } catch (searchError) {
        result.errors.push({
          targetId: target.id,

          keyword,

          type: "DISCOVERY",

          message: searchError.message,
        });
      }
    }

    /**
     * =================================================
     * UPDATE GRID
     * =================================================
     */

    try {
      await target.update({
        last_scanned_at: new Date(),

        next_scan_at: null,
      });
    } catch (updateError) {
      result.errors.push({
        targetId: target.id,

        type: "GRID_UPDATE",

        message: updateError.message,
      });
    }
  }

  /**
   * =====================================================
   * DONE
   * =====================================================
   */

  result.completed = true;

  if (result.inserted < limit) {
    result.message = `Chỉ tìm được ${result.inserted}/${limit} công ty mới sau khi lọc`;
  } else {
    result.message = `Đã kéo đủ ${result.inserted} công ty mới`;
  }

  return result;
}

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

module.exports = {
  runManualDiscovery,

  normalizeCompany,

  extractCompaniesFromSearchResult,

  shouldSkipCompany,

  KEYWORDS,

  EXCLUDED_PRIMARY_TYPE_KEYWORDS,

  EXCLUDED_NAME_KEYWORDS,
};
