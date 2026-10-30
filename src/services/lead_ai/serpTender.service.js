const axios = require("axios");
const crypto = require("crypto");

const {
  findTenderQueryByKey,
  buildTenderQueries,
} = require("./tenderQueryBuilder.service");

const TenderItem = require("../../models/lead_ai/tenderItem.model");

const TenderSource = require("../../models/lead_ai/tenderSource.model");

const TenderSearchLog = require("../../models/lead_ai/tenderSearchLog.model");

const TenderSetting = require("../../models/lead_ai/tenderSetting.model");

const serpApiConfig = require("../../config/serpApi.config");

// ======================================================
// CONFIG
// ======================================================

const SERP_TIMEOUT = 35000;

const DEFAULT_PAGES = 1;

const MAX_PAGES = 2;

// ======================================================
// BLOCKED DOMAINS
// ======================================================

const BLOCKED_DOMAINS = [
  "dauthau.asia",

  "muasamcong.vn",
  "muasamcong.mpi.gov.vn",

  "facebook.com",
  "m.facebook.com",

  "studocu.vn",
  "studocu.com",

  "scribd.com",
  "slideshare.net",
];

// ======================================================
// GOOGLE QUERY BLOCK
// ======================================================

const BLOCKED_GOOGLE_SITES = [
  "-site:dauthau.asia",

  "-site:muasamcong.vn",
  "-site:muasamcong.mpi.gov.vn",

  "-site:facebook.com",

  "-site:studocu.vn",
  "-site:studocu.com",

  "-site:scribd.com",
  "-site:slideshare.net",
].join(" ");

// ======================================================
// BAD CONTENT TITLE
// ======================================================

const BAD_TITLE_SIGNALS = [
  "kinh nghiệm du lịch",
  "cẩm nang du lịch",

  "review du lịch",
  "review tour",

  "địa điểm du lịch",
  "địa điểm tham quan",

  "top địa điểm",
  "top công ty du lịch",
  "top công ty lữ hành",

  "mẫu chương trình du lịch",
  "mẫu chương trình tour",

  "biểu mẫu báo giá",
  "mẫu báo giá",

  "hướng dẫn du lịch",

  "combo du lịch",

  "tour giá rẻ",

  "so sánh báo giá",
  "so sánh giá tour",

  "dịch vụ marketing du lịch",
  "marketing du lịch",

  "giá tổ chức team building",
  "bảng giá team building",

  "check in",
  "check-in",

  "du lịch tự túc",

  "tour ghép",
  "tour hàng ngày",
  "tour daily",

  "tuyển dụng",

  "khóa học",
  "giáo trình",
  "bài tập",

  "luận văn",
  "tiểu luận",
];

// ======================================================
// STRONG BUYER ACTIONS
// ======================================================

const STRONG_BUYER_ACTIONS = [
  "mời báo giá",
  "mời chào giá",

  "thư mời báo giá",
  "thư mời chào giá",

  "yêu cầu báo giá",
  "đề nghị báo giá",

  "mời cung cấp báo giá",

  "thông báo mời báo giá",
  "thông báo mời chào giá",

  "mời thầu",
  "thông báo mời thầu",

  "lựa chọn đơn vị",
  "lựa chọn nhà cung cấp",

  "lựa chọn đơn vị tổ chức",
  "lựa chọn đơn vị cung cấp",

  "lựa chọn đơn vị thực hiện",
];

// ======================================================
// PROCUREMENT URL SIGNALS
// ======================================================

const PROCUREMENT_URL_SIGNALS = [
  "bao-gia",
  "bao_gia",

  "chao-gia",
  "chao_gia",

  "moi-bao-gia",
  "moi-chao-gia",

  "thu-moi",
  "thu_moi",

  "moi-thau",
  "dau-thau",

  "thong-bao",
  "thong_bao",

  "procurement",

  "lua-chon-don-vi",
  "lua-chon-nha-cung-cap",

  "yeu-cau-bao-gia",
];

// ======================================================
// NORMALIZE TEXT
// ======================================================

const normalizeText = (value) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

// ======================================================
// CONTAINS ANY
// ======================================================

const containsAny = (text, keywords = []) => {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return false;
  }

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword);

    if (!normalizedKeyword) {
      return false;
    }

    return normalizedText.includes(normalizedKeyword);
  });
};

// ======================================================
// COUNT MATCHES
// ======================================================

const countMatches = (text, keywords = []) => {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return 0;
  }

  const matched = new Set();

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (!normalizedKeyword) {
      continue;
    }

    if (normalizedText.includes(normalizedKeyword)) {
      matched.add(normalizedKeyword);
    }
  }

  return matched.size;
};

// ======================================================
// BAD TITLE
// ======================================================

const isBadTitle = (title) => {
  return containsAny(title, BAD_TITLE_SIGNALS);
};

// ======================================================
// NORMALIZE URL
// ======================================================

const normalizeUrl = (rawUrl) => {
  if (!rawUrl) {
    return null;
  }

  let value = String(rawUrl).trim();

  if (!value) {
    return null;
  }

  // ==================================================
  // GOOGLE RELATIVE REDIRECT
  //
  // SerpAPI đôi lúc trả:
  //
  // /url?q=https://...
  // /goto?url=https://...
  //
  // Nếu bên trong là URL thật thì lấy URL thật.
  //
  // Nếu /goto?url=CAES...
  // thì đây chỉ là opaque token, không thể tự decode an toàn.
  // Khi đó trả null để thử redirect_link/cached_page_link.
  // ==================================================

  if (value.startsWith("/url?") || value.startsWith("/goto?")) {
    try {
      const googleUrl = new URL(`https://www.google.com${value}`);

      const targetUrl =
        googleUrl.searchParams.get("q") || googleUrl.searchParams.get("url");

      if (targetUrl && /^https?:\/\//i.test(String(targetUrl).trim())) {
        value = String(targetUrl).trim();
      } else {
        return null;
      }
    } catch (_) {
      return null;
    }
  }

  // ==================================================
  // GOOGLE ABSOLUTE REDIRECT
  // ==================================================

  if (/^https?:\/\/(www\.)?google\.[^/]+\/(url|goto)\?/i.test(value)) {
    try {
      const googleUrl = new URL(value);

      const targetUrl =
        googleUrl.searchParams.get("q") || googleUrl.searchParams.get("url");

      if (targetUrl && /^https?:\/\//i.test(String(targetUrl).trim())) {
        value = String(targetUrl).trim();
      } else {
        return null;
      }
    } catch (_) {
      return null;
    }
  }

  // ==================================================
  // MISSING PROTOCOL
  // ==================================================

  if (value.startsWith("www.")) {
    value = `https://${value}`;
  }

  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    // ==================================================
    // REMOVE TRACKING
    // ==================================================

    const trackingKeys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",

      "gclid",
      "fbclid",
    ];

    for (const key of trackingKeys) {
      url.searchParams.delete(key);
    }

    url.hash = "";

    return url.toString();
  } catch (_) {
    return null;
  }
};

// ======================================================
// GET RESULT CANONICAL URL
//
// Không chỉ tin result.link vì Google/SerpAPI đôi lúc
// trả link redirect tương đối.
//
// Thử lần lượt một số field có khả năng chứa URL thật.
//
// Không sử dụng displayed_link vì field này có thể chỉ là
// text hiển thị dạng:
// domain.vn › abc › xyz
// ======================================================

const getResultCanonicalUrl = (result = {}) => {
  const candidates = [
    result?.link,

    result?.redirect_link,

    result?.cached_page_link,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return null;
};

// ======================================================
// DOMAIN
// ======================================================

const getDomain = (rawUrl) => {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch (_) {
    return "";
  }
};

// ======================================================
// BLOCK DOMAIN
// ======================================================

const isBlockedDomain = (domain) => {
  const normalized = String(domain || "")
    .toLowerCase()
    .replace(/^www\./, "");

  return BLOCKED_DOMAINS.some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`),
  );
};

// ======================================================
// PROCUREMENT URL SIGNAL
// ======================================================

const hasProcurementUrlSignal = (url) => {
  return containsAny(url, PROCUREMENT_URL_SIGNALS);
};

// ======================================================
// HASH
// ======================================================

const hashText = (value) => {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
};

// ======================================================
// TITLE TOKENS
//
// Vẫn giữ helper này để tương thích code khác nếu có dùng,
// nhưng KHÔNG dùng để auto loại Tender nữa.
// ======================================================

const getTitleTokens = (title) => {
  return new Set(
    normalizeText(title)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
};

// ======================================================
// TITLE SIMILARITY
//
// Chỉ giữ helper.
// Không dùng similarity để quyết định DUPLICATE nữa.
// ======================================================

const getTitleSimilarity = (titleA, titleB) => {
  const setA = getTitleTokens(titleA);

  const setB = getTitleTokens(titleB);

  if (!setA.size || !setB.size) {
    return 0;
  }

  let intersection = 0;

  for (const item of setA) {
    if (setB.has(item)) {
      intersection += 1;
    }
  }

  const union = new Set([...setA, ...setB]).size;

  if (!union) {
    return 0;
  }

  return intersection / union;
};

// ======================================================
// VALIDATE TENDER RESULT
// ======================================================

const validateTenderResult = ({ result, queryConfig, normalizedUrl }) => {
  const title = String(result?.title || "").trim();

  const snippet = String(result?.snippet || "").trim();

  const fullText = `${title} ${snippet}`;

  const validation = queryConfig?.validation || {};

  const actions = validation.actionKeywords || [];

  const services = validation.serviceKeywords || [];

  const targets = validation.targetKeywords || [];

  // ==================================================
  // SIGNALS
  // ==================================================

  const actionTitle = containsAny(title, actions);

  const actionFull = containsAny(fullText, actions);

  const strongBuyerTitle = containsAny(title, STRONG_BUYER_ACTIONS);

  const serviceTitle = containsAny(title, services);

  const serviceFull = containsAny(fullText, services);

  const targetTitle = containsAny(title, targets);

  const targetFull = containsAny(fullText, targets);

  const procurementUrl = hasProcurementUrlSignal(normalizedUrl);

  const serviceTitleCount = countMatches(title, services);

  // ==================================================
  // BAD CONTENT
  // ==================================================

  if (isBadTitle(title)) {
    return {
      valid: false,

      decision: "SKIP",

      reason: "BAD_CONTENT_TITLE",

      score: 0,

      actionTitle,
      actionFull,
      strongBuyerTitle,

      serviceTitle,
      serviceFull,

      targetTitle,
      targetFull,

      procurementUrl,
    };
  }

  // ==================================================
  // 1. STRONG NEW
  //
  // Buyer action + service đều nằm trong TITLE.
  //
  // Ví dụ:
  //
  // THƯ MỜI BÁO GIÁ DỊCH VỤ DU LỊCH
  //
  // THÔNG BÁO MỜI THẦU THAM QUAN DU LỊCH
  // ==================================================

  if (strongBuyerTitle && serviceTitle) {
    let score = 80;

    if (targetTitle) {
      score += 5;
    }

    if (serviceTitleCount >= 2) {
      score += 5;
    }

    return {
      valid: true,

      decision: "NEW",

      reason: "STRONG_TITLE_MATCH",

      score: Math.min(score, 100),

      actionTitle,
      actionFull,
      strongBuyerTitle,

      serviceTitle,
      serviceFull,

      targetTitle,
      targetFull,

      procurementUrl,
    };
  }

  // ==================================================
  // 2. SERVICE TITLE + PROCUREMENT SIGNAL
  //
  // Service nằm rõ trong TITLE.
  //
  // Action có thể nằm trong title hoặc snippet.
  // URL procurement chỉ dùng làm signal phụ.
  // ==================================================

  if (serviceTitle && (actionFull || procurementUrl)) {
    let score = 55;

    if (actionFull) {
      score += 10;
    }

    if (procurementUrl) {
      score += 5;
    }

    if (targetFull) {
      score += 5;
    }

    return {
      valid: true,

      decision: "DISCOVERED",

      reason: "SERVICE_TITLE_PROCUREMENT_SIGNAL",

      score: Math.min(score, 100),

      actionTitle,
      actionFull,
      strongBuyerTitle,

      serviceTitle,
      serviceFull,

      targetTitle,
      targetFull,

      procurementUrl,
    };
  }

  // ==================================================
  // 3. PROCUREMENT TITLE + SERVICE EVIDENCE
  //
  // Không accept chỉ vì:
  //
  // actionTitle = true
  // serviceFull = true do snippet Google
  // procurementUrl = true
  //
  // Service phải nằm trong TITLE
  // hoặc có target CBNV/người lao động.
  // ==================================================

  if (actionTitle && serviceFull && (serviceTitle || targetFull)) {
    let score = 50;

    if (serviceTitle) {
      score += 10;
    }

    if (targetFull) {
      score += 5;
    }

    return {
      valid: true,

      decision: "DISCOVERED",

      reason: "PROCUREMENT_TITLE_SERVICE_SNIPPET",

      score: Math.min(score, 100),

      actionTitle,
      actionFull,
      strongBuyerTitle,

      serviceTitle,
      serviceFull,

      targetTitle,
      targetFull,

      procurementUrl,
    };
  }

  // ==================================================
  // 4. GENERAL SERP SIGNAL
  //
  // Không accept chỉ vì action nằm title +
  // keyword du lịch vô tình xuất hiện trong snippet.
  //
  // Phải có:
  // - service trong title
  // hoặc
  // - target rõ ràng.
  // ==================================================

  if (actionFull && serviceFull && (serviceTitle || targetFull)) {
    let score = 40;

    if (actionTitle) {
      score += 5;
    }

    if (serviceTitle) {
      score += 10;
    }

    if (targetFull) {
      score += 5;
    }

    return {
      valid: true,

      decision: "DISCOVERED",

      reason: "SERP_SIGNAL_MATCH",

      score: Math.min(score, 100),

      actionTitle,
      actionFull,
      strongBuyerTitle,

      serviceTitle,
      serviceFull,

      targetTitle,
      targetFull,

      procurementUrl,
    };
  }

  // ==================================================
  // 5. EMPLOYEE SIGNAL
  //
  // Dành cho:
  //
  // - người lao động
  // - cán bộ nhân viên
  // - cán bộ viên chức
  // - công đoàn
  //
  // và có service du lịch.
  // ==================================================

  if (targetFull && serviceFull && (actionFull || procurementUrl)) {
    let score = 45;

    if (actionFull) {
      score += 10;
    }

    if (serviceTitle) {
      score += 5;
    }

    if (procurementUrl) {
      score += 5;
    }

    return {
      valid: true,

      decision: "DISCOVERED",

      reason: "EMPLOYEE_SIGNAL",

      score: Math.min(score, 100),

      actionTitle,
      actionFull,
      strongBuyerTitle,

      serviceTitle,
      serviceFull,

      targetTitle,
      targetFull,

      procurementUrl,
    };
  }

  // ==================================================
  // SKIP
  // ==================================================

  return {
    valid: false,

    decision: "SKIP",

    reason: "NO_PURCHASE_SIGNAL",

    score: 0,

    actionTitle,
    actionFull,
    strongBuyerTitle,

    serviceTitle,
    serviceFull,

    targetTitle,
    targetFull,

    procurementUrl,
  };
};

// ======================================================
// GET SETTING
// ======================================================

const getSetting = async (key, defaultValue = null) => {
  const row = await TenderSetting.findOne({
    where: {
      setting_key: key,
    },

    raw: true,
  });

  return row ? row.setting_value : defaultValue;
};

// ======================================================
// SERP API KEY
// ======================================================

const getSerpApiKey = () => {
  return (
    serpApiConfig?.apiKey ||
    serpApiConfig?.SERPAPI_API_KEY ||
    serpApiConfig?.key ||
    null
  );
};

// ======================================================
// CHECK SERP QUOTA
//
// Không query TenderSearchLog.
// Lấy trực tiếp SerpAPI account.
// ======================================================

const checkSerpQuota = async () => {
  const apiKey = getSerpApiKey();

  if (!apiKey) {
    return {
      allowed: false,

      limited: true,

      reason: "SERPAPI_KEY_MISSING",

      used: 0,

      limit: 0,

      remaining: 0,

      thisMonthUsage: 0,

      planLimit: 0,

      planRemaining: 0,

      safeLimit: 0,

      safeRemaining: 0,
    };
  }

  const safeLimit =
    Number(await getSetting("SERPAPI_SAFE_MONTHLY_LIMIT", "200")) || 200;

  try {
    const response = await axios.get("https://serpapi.com/account.json", {
      params: {
        api_key: apiKey,
      },

      timeout: SERP_TIMEOUT,
    });

    const account = response?.data || {};

    const thisMonthUsage = Number(account?.this_month_usage || 0);

    const planLimit = Number(account?.searches_per_month || 0);

    const planRemaining = Number(
      account?.total_searches_left ??
        account?.plan_searches_left ??
        Math.max(planLimit - thisMonthUsage, 0),
    );

    const safeRemaining = Math.max(safeLimit - thisMonthUsage, 0);

    const remaining = Math.max(Math.min(planRemaining, safeRemaining), 0);

    const allowed = remaining > 0;

    return {
      allowed,

      limited: !allowed,

      used: thisMonthUsage,

      limit: safeLimit,

      remaining,

      thisMonthUsage,

      planLimit,

      planRemaining,

      safeLimit,

      safeRemaining,

      account,
    };
  } catch (error) {
    console.error("[Tender][SERP_QUOTA_ERROR]", {
      message: error?.message,

      response: error?.response?.data || null,
    });

    throw new Error(
      `Không kiểm tra được SerpAPI quota: ${
        error?.response?.data?.error || error?.message
      }`,
    );
  }
};

// ======================================================
// ALIAS
// ======================================================

const getQuotaStatus = async () => {
  return checkSerpQuota();
};

// ======================================================
// ENSURE SOURCE
//
// DOMAIN chỉ là nguồn.
//
// Ví dụ:
// benhvienabc.vn
//
// Có thể có:
// - bài năm 2026
// - bài năm 2027
// - bài năm 2028
//
// Tất cả cùng một TenderSource.
// TenderItem vẫn tạo riêng theo URL.
// ======================================================

const ensureTenderSource = async ({ domain, url }) => {
  try {
    const [source] = await TenderSource.findOrCreate({
      where: {
        domain,
      },

      defaults: {
        domain,

        source_url: url,

        source_type: "SERPAPI",

        is_active: true,
      },
    });

    return source;
  } catch (error) {
    // ==================================================
    // RACE CONDITION
    //
    // Batch chạy concurrency > 1.
    //
    // Hai worker có thể cùng:
    //
    // SELECT domain
    // -> chưa có
    //
    // rồi cùng INSERT.
    //
    // Worker thứ hai bị unique domain.
    //
    // Đây không phải lỗi dữ liệu.
    // Đọc lại source đã được worker kia tạo.
    // ==================================================

    if (error?.name === "SequelizeUniqueConstraintError") {
      const existing = await TenderSource.findOne({
        where: {
          domain,
        },
      });

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
};

// ======================================================
// FIND DUPLICATE
//
// QUAN TRỌNG:
//
// Chỉ AUTO DUPLICATE khi canonical_url giống hệt.
//
// Không còn loại theo title similarity.
//
// Vì:
// ------------------------------------------------------
// "Mời báo giá Tour 2026"
// "Mời báo giá Tour 2026 - lần 2"
//
// Hoặc:
// "Thông báo mời báo giá"
// "Thông báo điều chỉnh mời báo giá"
//
// có thể giống title > 90% nhưng là thông báo MỚI.
//
// Hệ thống HIGH RECALL:
// thà lưu dư còn hơn mất Tender.
// ======================================================

const findDuplicate = async ({ canonicalUrl }) => {
  const urlDuplicate = await TenderItem.findOne({
    where: {
      canonical_url: canonicalUrl,
    },

    raw: true,
  });

  if (urlDuplicate) {
    return {
      duplicate: true,

      reason: "URL",

      item: urlDuplicate,
    };
  }

  return {
    duplicate: false,

    reason: null,

    item: null,
  };
};

// ======================================================
// SAVE ORGANIC RESULT
// ======================================================

const saveOrganicResult = async ({ result, queryConfig, page }) => {
  const title = String(result?.title || "").trim();

  const rawUrl = result?.link;

  const canonicalUrl = getResultCanonicalUrl(result);

  // ==================================================
  // INVALID URL
  // ==================================================

  if (!canonicalUrl) {
    // console.warn("[Tender][INVALID_URL]", {
    //   title,

    //   link: rawUrl,

    //   redirectLink: result?.redirect_link || null,

    //   queryKey: queryConfig?.key,
    // });

    return {
      saved: false,

      skipped: true,

      reason: "INVALID_URL",
    };
  }

  const domain = getDomain(canonicalUrl);

  if (!domain) {
    return {
      saved: false,

      skipped: true,

      reason: "INVALID_URL",
    };
  }

  // ==================================================
  // BLOCK DOMAIN
  // ==================================================

  if (isBlockedDomain(domain)) {
    return {
      saved: false,

      skipped: true,

      reason: "BLOCKED_DOMAIN",
    };
  }

  // ==================================================
  // VALIDATE
  // ==================================================

  const validation = validateTenderResult({
    result,

    queryConfig,

    normalizedUrl: canonicalUrl,
  });

  if (!validation.valid) {
    return {
      saved: false,

      skipped: true,

      reason: validation.reason,
    };
  }

  // ==================================================
  // DUPLICATE URL
  // ==================================================

  const duplicate = await findDuplicate({
    canonicalUrl,
  });

  if (duplicate.duplicate) {
    return {
      saved: false,

      duplicate: true,

      duplicateReason: duplicate.reason,

      existingItem: duplicate.item,
    };
  }

  try {
    // ==================================================
    // SOURCE
    // ==================================================

    const source = await ensureTenderSource({
      domain,

      url: canonicalUrl,
    });

    const now = new Date();

    const snippet = String(result?.snippet || "").trim();

    const contentHash = hashText([title, snippet, canonicalUrl].join("|"));

    // ==================================================
    // CREATE ITEM
    //
    // Một domain có thể có nhiều item.
    //
    // Ví dụ:
    //
    // source:
    // benhvienabc.vn
    //
    // item 1:
    // /tour-2026
    //
    // item 2:
    // /tour-2027
    //
    // item 3:
    // /tour-2027-lan-2
    //
    // đều được lưu riêng.
    // ==================================================

    const item = await TenderItem.create({
      source_id: source.id,

      source_type: "SERPAPI",

      title,

      source_url: rawUrl,

      canonical_url: canonicalUrl,

      domain,

      snippet,

      organization_name: result?.source || null,

      published_at: null,

      deadline_at: null,

      first_seen_at: now,

      last_seen_at: now,

      serp_position: result?.position || null,

      serp_query_key: queryConfig.key,

      content_hash: contentHash,

      relevance_score: validation.score,

      category: queryConfig.category,

      status: validation.decision,

      assigned_user_id: null,

      raw_data: {
        ...result,

        _serpPage: page,

        _resolvedCanonicalUrl: canonicalUrl,

        tender_search: {
          queryKey: queryConfig.key,

          queryName: queryConfig.name,

          queryText: queryConfig.q,

          category: queryConfig.category,

          intent: queryConfig.intent,
        },

        validation: {
          valid: validation.valid,

          reason: validation.reason,

          decision: validation.decision,

          score: validation.score,

          actionTitle: validation.actionTitle,

          actionFull: validation.actionFull,

          strongBuyerTitle: validation.strongBuyerTitle,

          serviceTitle: validation.serviceTitle,

          serviceFull: validation.serviceFull,

          targetTitle: validation.targetTitle,

          targetFull: validation.targetFull,

          procurementUrl: validation.procurementUrl,
        },
      },
    });

    return {
      saved: true,

      item: {
        id: item.id,

        title: item.title,

        url: item.canonical_url,

        domain: item.domain,

        category: item.category,

        status: item.status,

        score: item.relevance_score,

        page,

        matchReason: validation.reason,
      },
    };
  } catch (error) {
    // ==================================================
    // RACE CONDITION - ITEM DUPLICATE
    //
    // Ví dụ:
    //
    // Query A check:
    // URL chưa có.
    //
    // Query B check:
    // URL chưa có.
    //
    // Query A insert trước.
    //
    // Query B insert sau:
    // unique canonical_url.
    //
    // Đây là DUPLICATE, không phải SAVE_ERROR.
    // ==================================================

    if (error?.name === "SequelizeUniqueConstraintError") {
      const constraint = error?.parent?.constraint || "";

      // ==================================================
      // ITEM URL ALREADY EXISTS
      // ==================================================

      if (constraint === "tender_items_canonical_url_key") {
        const existingItem = await TenderItem.findOne({
          where: {
            canonical_url: canonicalUrl,
          },

          raw: true,
        });

        return {
          saved: false,

          duplicate: true,

          duplicateReason: "URL",

          existingItem: existingItem || null,
        };
      }

      // ==================================================
      // SOURCE DOMAIN CREATED BY ANOTHER WORKER
      //
      // Bình thường ensureTenderSource() đã xử lý.
      // Giữ fallback này để an toàn.
      // ==================================================

      if (constraint === "tender_sources_domain_key") {
        const existingSource = await TenderSource.findOne({
          where: {
            domain,
          },
        });

        if (existingSource) {
          // Có thể worker kia chỉ vừa tạo source,
          // chưa tạo item.
          //
          // Thử lại item một lần với source đã tồn tại.

          try {
            const now = new Date();

            const snippet = String(result?.snippet || "").trim();

            const contentHash = hashText(
              [title, snippet, canonicalUrl].join("|"),
            );

            const retryItem = await TenderItem.create({
              source_id: existingSource.id,

              source_type: "SERPAPI",

              title,

              source_url: rawUrl,

              canonical_url: canonicalUrl,

              domain,

              snippet,

              organization_name: result?.source || null,

              published_at: null,

              deadline_at: null,

              first_seen_at: now,

              last_seen_at: now,

              serp_position: result?.position || null,

              serp_query_key: queryConfig.key,

              content_hash: contentHash,

              relevance_score: validation.score,

              category: queryConfig.category,

              status: validation.decision,

              assigned_user_id: null,

              raw_data: {
                ...result,

                _serpPage: page,

                _resolvedCanonicalUrl: canonicalUrl,

                tender_search: {
                  queryKey: queryConfig.key,

                  queryName: queryConfig.name,

                  queryText: queryConfig.q,

                  category: queryConfig.category,

                  intent: queryConfig.intent,
                },

                validation: {
                  valid: validation.valid,

                  reason: validation.reason,

                  decision: validation.decision,

                  score: validation.score,

                  actionTitle: validation.actionTitle,

                  actionFull: validation.actionFull,

                  strongBuyerTitle: validation.strongBuyerTitle,

                  serviceTitle: validation.serviceTitle,

                  serviceFull: validation.serviceFull,

                  targetTitle: validation.targetTitle,

                  targetFull: validation.targetFull,

                  procurementUrl: validation.procurementUrl,
                },
              },
            });

            return {
              saved: true,

              item: {
                id: retryItem.id,

                title: retryItem.title,

                url: retryItem.canonical_url,

                domain: retryItem.domain,

                category: retryItem.category,

                status: retryItem.status,

                score: retryItem.relevance_score,

                page,

                matchReason: validation.reason,
              },
            };
          } catch (retryError) {
            // Nếu retry lại gặp canonical_url unique
            // thì worker kia cũng đã insert item.

            if (retryError?.name === "SequelizeUniqueConstraintError") {
              const retryConstraint = retryError?.parent?.constraint || "";

              if (retryConstraint === "tender_items_canonical_url_key") {
                const existingItem = await TenderItem.findOne({
                  where: {
                    canonical_url: canonicalUrl,
                  },

                  raw: true,
                });

                return {
                  saved: false,

                  duplicate: true,

                  duplicateReason: "URL",

                  existingItem: existingItem || null,
                };
              }
            }

            throw retryError;
          }
        }
      }
    }

    // ==================================================
    // REAL SAVE ERROR
    // ==================================================

    // console.error("[Tender][SAVE_ERROR]", {
    //   title,

    //   url: canonicalUrl,

    //   domain,

    //   queryKey: queryConfig?.key,

    //   queryName: queryConfig?.name,

    //   category: queryConfig?.category,

    //   error: error?.message,

    //   name: error?.name,

    //   sql: error?.sql,

    //   detail: error?.parent?.detail,

    //   constraint: error?.parent?.constraint,
    // });

    return {
      saved: false,

      skipped: true,

      reason: "SAVE_ERROR",

      error: error?.message,
    };
  }
};

// ======================================================
// FETCH SERP PAGE
// ======================================================

const fetchSerpPage = async ({ query, timeFilter, page }) => {
  const apiKey = getSerpApiKey();

  if (!apiKey) {
    throw new Error("SERPAPI API key chưa được cấu hình");
  }

  const start = (page - 1) * 10;

  const finalQuery = [query, BLOCKED_GOOGLE_SITES].filter(Boolean).join(" ");

  const response = await axios.get("https://serpapi.com/search.json", {
    params: {
      engine: "google",

      google_domain: "google.com",

      gl: "vn",

      hl: "vi",

      q: finalQuery,

      tbs: timeFilter,

      num: 10,

      start,

      api_key: apiKey,
    },

    timeout: SERP_TIMEOUT,
  });

  const organicResults = response?.data?.organic_results;

  return Array.isArray(organicResults) ? organicResults : [];
};

// ======================================================
// CREATE SEARCH LOG
//
// MODEL:
// query_key
// query_text
// time_filter
// result_count
// new_result_count
// success
// error_message
// executed_at
// ======================================================

const createSearchLog = async ({
  queryConfig,

  timeFilter,

  rawCount,

  newCount,

  discoveredCount,

  success = true,

  errorMessage = null,
}) => {
  try {
    await TenderSearchLog.create({
      query_key: queryConfig?.key || null,

      query_text: queryConfig?.q || null,

      time_filter: timeFilter || null,

      result_count: Number(rawCount || 0),

      new_result_count: Number(newCount || 0) + Number(discoveredCount || 0),

      success: Boolean(success),

      error_message: errorMessage || null,

      executed_at: new Date(),
    });
  } catch (error) {
    console.error("[Tender][SEARCH_LOG_ERROR]", {
      message: error?.message,

      queryKey: queryConfig?.key,

      sql: error?.sql,

      detail: error?.parent?.detail,
    });
  }
};

// ======================================================
// EXECUTE SEARCH
// ======================================================

const executeTenderSearch = async ({
  queryKey,

  query: providedQuery = null,

  timeFilter = "qdr:d",

  pages = DEFAULT_PAGES,
}) => {
  let queryConfig = providedQuery;

  // ==================================================
  // COMPATIBILITY
  // ==================================================

  if (!queryConfig) {
    queryConfig = await findTenderQueryByKey(queryKey);
  }

  if (!queryConfig) {
    throw new Error(`Không tìm thấy Tender query: ${queryKey}`);
  }

  const requestedPages = Math.max(
    1,

    Math.min(
      Number(pages) || DEFAULT_PAGES,

      MAX_PAGES,
    ),
  );

  const allResults = [];

  let actualPages = 0;

  try {
    // ==================================================
    // FETCH
    // ==================================================

    for (let page = 1; page <= requestedPages; page += 1) {
      const pageResults = await fetchSerpPage({
        query: queryConfig.q,

        timeFilter,

        page,
      });

      actualPages += 1;

      for (const item of pageResults) {
        allResults.push({
          ...item,

          _serpPage: page,
        });
      }

      if (pageResults.length < 10) {
        break;
      }
    }

    // ==================================================
    // DEDUPE TRONG CÙNG MỘT SERP SEARCH
    //
    // QUAN TRỌNG:
    //
    // CHỈ dedupe canonical URL giống hệt.
    //
    // Không dedupe bằng TITLE nữa.
    //
    // Vì:
    //
    // "Mời báo giá Tour 2026"
    // "Mời báo giá Tour 2026 - lần 2"
    //
    // hoặc:
    //
    // "Thông báo mời báo giá..."
    // "Thông báo điều chỉnh mời báo giá..."
    //
    // có thể title similarity cực cao nhưng là Tender mới.
    // ==================================================

    const seenUrls = new Set();

    const uniqueResults = [];

    for (const result of allResults) {
      const url = getResultCanonicalUrl(result);

      if (url && seenUrls.has(url)) {
        continue;
      }

      if (url) {
        seenUrls.add(url);
      }

      // Nếu chưa resolve được URL thì vẫn giữ result lại
      // để saveOrganicResult() log INVALID_URL.
      //
      // Không dedupe theo title vì có thể làm mất gói.
      uniqueResults.push(result);
    }

    // ==================================================
    // COUNTERS
    // ==================================================

    let newCount = 0;

    let discoveredCount = 0;

    let duplicateCount = 0;

    let skippedCount = 0;

    const duplicateReasons = {};

    const skippedReasons = {};

    const newItems = [];

    // ==================================================
    // PROCESS
    // ==================================================

    for (const result of uniqueResults) {
      const saved = await saveOrganicResult({
        result,

        queryConfig,

        page: result?._serpPage || 1,
      });

      // ==================================================
      // SAVED
      // ==================================================

      if (saved.saved) {
        if (saved.item.status === "NEW") {
          newCount += 1;
        }

        if (saved.item.status === "DISCOVERED") {
          discoveredCount += 1;
        }

        newItems.push(saved.item);

        continue;
      }

      // ==================================================
      // DUPLICATE
      // ==================================================

      if (saved.duplicate) {
        duplicateCount += 1;

        const reason = saved.duplicateReason || "UNKNOWN";

        duplicateReasons[reason] = (duplicateReasons[reason] || 0) + 1;

        continue;
      }

      // ==================================================
      // SKIPPED
      // ==================================================

      if (saved.skipped) {
        skippedCount += 1;

        const reason = saved.reason || "UNKNOWN";

        skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
      }
    }

    // ==================================================
    // LOG SUCCESS
    // ==================================================

    await createSearchLog({
      queryConfig,

      timeFilter,

      rawCount: allResults.length,

      newCount,

      discoveredCount,

      success: true,

      errorMessage: null,
    });

    // ==================================================
    // RESULT
    // ==================================================

    return {
      success: true,

      queryKey: queryConfig.key,

      queryName: queryConfig.name,

      category: queryConfig.category,

      intent: queryConfig.intent,

      query: [queryConfig.q, BLOCKED_GOOGLE_SITES].filter(Boolean).join(" "),

      timeFilter,

      requestedPages,

      actualPages,

      rawResultCount: allResults.length,

      uniqueResultCount: uniqueResults.length,

      resultCount: uniqueResults.length,

      newCount,

      discoveredCount,

      acceptedCount: newCount + discoveredCount,

      duplicateCount,

      skippedCount,

      duplicateReasons,

      skippedReasons,

      newItems,
    };
  } catch (error) {
    // ==================================================
    // LOG FAILURE
    // ==================================================

    await createSearchLog({
      queryConfig,

      timeFilter,

      rawCount: allResults.length,

      newCount: 0,

      discoveredCount: 0,

      success: false,

      errorMessage: error?.message || "UNKNOWN_ERROR",
    });

    console.error("[Tender][SEARCH_ERROR]", {
      queryKey: queryConfig?.key,

      query: queryConfig?.q,

      message: error?.message,

      response: error?.response?.data || null,
    });

    return {
      success: false,

      queryKey: queryConfig.key,

      queryName: queryConfig.name,

      category: queryConfig.category,

      intent: queryConfig.intent,

      error: error?.message || "Tender search error",

      rawResultCount: allResults.length,

      uniqueResultCount: 0,

      resultCount: 0,

      newCount: 0,

      discoveredCount: 0,

      acceptedCount: 0,

      duplicateCount: 0,

      skippedCount: 0,

      duplicateReasons: {},

      skippedReasons: {},

      newItems: [],
    };
  }
};

// ======================================================
// GET QUERIES
// ======================================================

const getTenderQueries = async () => {
  return buildTenderQueries();
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  SERP_TIMEOUT,

  DEFAULT_PAGES,

  MAX_PAGES,

  BLOCKED_DOMAINS,

  BLOCKED_GOOGLE_SITES,

  BAD_TITLE_SIGNALS,

  STRONG_BUYER_ACTIONS,

  PROCUREMENT_URL_SIGNALS,

  normalizeText,

  containsAny,

  countMatches,

  isBadTitle,

  normalizeUrl,

  getResultCanonicalUrl,

  getDomain,

  isBlockedDomain,

  hasProcurementUrlSignal,

  hashText,

  getTitleTokens,

  getTitleSimilarity,

  validateTenderResult,

  getSetting,

  getSerpApiKey,

  checkSerpQuota,

  getQuotaStatus,

  ensureTenderSource,

  findDuplicate,

  saveOrganicResult,

  fetchSerpPage,

  createSearchLog,

  executeTenderSearch,

  getTenderQueries,
};
