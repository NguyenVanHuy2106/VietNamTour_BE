const {
  buildTenderQueries,
  findTenderQueryByKey,
} = require("../../services/lead_ai/tenderQueryBuilder.service");

const {
  executeTenderSearch,
  checkSerpQuota,
} = require("../../services/lead_ai/serpTender.service");

// ======================================================
// CONCURRENCY
// ======================================================

const DEFAULT_CONCURRENCY = 4;

const MAX_CONCURRENCY = 6;

const MAX_PAGES = 2;

// ======================================================
// RUN WITH CONCURRENCY
// ======================================================

const runWithConcurrency = async (items, limit, handler) => {
  const results = new Array(items.length);

  let cursor = 0;

  const workerCount = Math.min(
    Math.max(1, Number(limit) || 1),

    items.length,
  );

  const workers = Array.from(
    {
      length: workerCount,
    },

    async () => {
      while (true) {
        const index = cursor++;

        if (index >= items.length) {
          break;
        }

        try {
          results[index] = await handler(
            items[index],

            index,
          );
        } catch (error) {
          results[index] = {
            success: false,

            queryKey: items[index]?.key || null,

            queryName: items[index]?.name || null,

            category: items[index]?.category || null,

            intent: items[index]?.intent || null,

            error: error?.message || "UNKNOWN_ERROR",

            rawResultCount: 0,

            resultCount: 0,

            newCount: 0,

            discoveredCount: 0,

            candidateCount: 0,

            potentialCount: 0,

            acceptedCount: 0,

            duplicateCount: 0,

            skippedCount: 0,

            duplicateReasons: {},

            skippedReasons: {},

            newItems: [],
          };
        }
      }
    },
  );

  await Promise.all(workers);

  return results;
};

// ======================================================
// NORMALIZE PAGES
// ======================================================

const normalizePages = (pages) => {
  return Math.min(
    MAX_PAGES,

    Math.max(
      1,

      Number(pages || 1) || 1,
    ),
  );
};

// ======================================================
// NORMALIZE CONCURRENCY
// ======================================================

const normalizeConcurrency = (concurrency) => {
  return Math.min(
    MAX_CONCURRENCY,

    Math.max(
      1,

      Number(concurrency || DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY,
    ),
  );
};

// ======================================================
// GET AVAILABLE QUOTA
//
// Hỗ trợ cả format quota cũ và mới.
//
// QUAN TRỌNG:
// Controller cũ dùng quota.remainingSafe,
// nhưng service hiện tại trả:
// - remaining
// - safeRemaining
// - planRemaining
// ======================================================

const getAvailableQuota = (quota) => {
  const values = [
    quota?.remaining,

    quota?.safeRemaining,

    quota?.remainingSafe,

    quota?.planRemaining,

    quota?.totalSearchesLeft,
  ];

  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return Math.max(0, number);
    }
  }

  return 0;
};

// ======================================================
// GET QUOTA LIMIT FOR DISPLAY
// ======================================================

const getQuotaLimit = (quota) => {
  const values = [
    quota?.limit,

    quota?.safeLimit,

    quota?.effectiveLimit,

    quota?.planLimit,
  ];

  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return 0;
};

// ======================================================
// GET QUOTA USED FOR DISPLAY
// ======================================================

const getQuotaUsed = (quota) => {
  return Math.max(
    0,

    Number(quota?.used ?? quota?.thisMonthUsage ?? 0) || 0,
  );
};

// ======================================================
// GET QUERIES
// ======================================================

const getQueries = async (req, res) => {
  try {
    const queries = await buildTenderQueries();

    return res.json({
      success: true,

      count: queries.length,

      data: queries,
    });
  } catch (error) {
    console.error("[Tender Watcher] getQueries:", error);

    return res.status(500).json({
      success: false,

      message: error?.message || "Không tải được Tender queries",
    });
  }
};

// ======================================================
// QUOTA
// ======================================================

const getQuota = async (req, res) => {
  try {
    const quota = await checkSerpQuota();

    const availableQuota = getAvailableQuota(quota);

    return res.json({
      success: true,

      data: {
        ...quota,

        // chuẩn hóa để FE dễ dùng
        availableQuota,
      },
    });
  } catch (error) {
    console.error("[Tender Watcher] getQuota:", error);

    return res.status(500).json({
      success: false,

      message: error?.message || "Không kiểm tra được quota SerpAPI",
    });
  }
};

// ======================================================
// SEARCH ALL
//
// DEFAULT:
//
// {
//   "timeFilter": "qdr:m3",
//   "pages": 1,
//   "concurrency": 4
// }
// ======================================================

const search = async (req, res) => {
  try {
    const {
      timeFilter = "qdr:d",

      pages = 1,

      concurrency = DEFAULT_CONCURRENCY,
    } = req.body || {};

    // ==================================================
    // NORMALIZE INPUT
    // ==================================================

    const safePages = normalizePages(pages);

    const safeConcurrency = normalizeConcurrency(concurrency);

    // ==================================================
    // QUOTA - CHECK 1 LẦN
    // ==================================================

    const quota = await checkSerpQuota();

    const availableQuota = getAvailableQuota(quota);

    const quotaLimit = getQuotaLimit(quota);

    const quotaUsed = getQuotaUsed(quota);

    // ==================================================
    // CHỈ CHẶN KHI SERVICE XÁC NHẬN KHÔNG ĐƯỢC CHẠY
    // ==================================================

    if (quota?.allowed === false) {
      return res.status(429).json({
        success: false,

        message: `SerpAPI đã đạt ngưỡng an toàn ${quotaUsed}/${quotaLimit}`,

        quota,
      });
    }

    // ==================================================
    // BUILD QUERY 1 LẦN
    // ==================================================

    let queries = await buildTenderQueries();

    if (!queries.length) {
      return res.json({
        success: true,

        message: "Không có Tender query",

        timeFilter,

        pages: safePages,

        concurrency: safeConcurrency,

        quotaLimited: false,

        summary: {
          queryCount: 0,

          totalRawResultCount: 0,

          totalResultCount: 0,

          totalNewCount: 0,

          totalDiscoveredCount: 0,

          totalCandidateCount: 0,

          totalPotentialCount: 0,

          totalAcceptedCount: 0,

          totalDuplicateCount: 0,

          totalSkippedCount: 0,
        },

        data: [],
      });
    }

    // ==================================================
    // QUOTA NEEDED
    //
    // Ví dụ:
    //
    // 18 query × 1 page = 18 request
    // 18 query × 2 page = 36 request
    //
    // Controller cũ bị lỗi ở đây vì đọc:
    //
    // quota.remainingSafe
    //
    // trong khi service trả:
    //
    // quota.remaining / quota.safeRemaining
    // ==================================================

    const requiredRequests = queries.length * safePages;

    let quotaLimited = false;

    // ==================================================
    // CHỈ GIỚI HẠN QUERY NẾU CÓ QUOTA HỢP LỆ
    //
    // Nếu quota service nói allowed=true nhưng vì
    // format cũ/mới mà availableQuota không xác định,
    // không tự động block batch.
    // ==================================================

    if (availableQuota > 0) {
      const maxQueriesByQuota = Math.floor(availableQuota / safePages);

      if (maxQueriesByQuota <= 0) {
        return res.status(429).json({
          success: false,

          message: "Không đủ quota SerpAPI để chạy batch",

          requiredRequests,

          availableQuota,

          quota,
        });
      }

      if (queries.length > maxQueriesByQuota) {
        queries = queries.slice(0, maxQueriesByQuota);

        quotaLimited = true;
      }
    }

    // ==================================================
    // DEBUG QUOTA
    // ==================================================

    console.log("[Tender Watcher][BATCH]", {
      queryCount: queries.length,

      pages: safePages,

      requiredRequests: queries.length * safePages,

      availableQuota,

      quotaAllowed: quota?.allowed,

      quotaUsed,

      quotaLimit,
    });

    // ==================================================
    // RUN CONCURRENTLY
    //
    // Quan trọng:
    // truyền luôn query object.
    //
    // Như vậy executeTenderSearch không cần gọi
    // findTenderQueryByKey -> buildTenderQueries
    // lại cho từng query.
    // ==================================================

    const data = await runWithConcurrency(
      queries,

      safeConcurrency,

      async (query) => {
        return executeTenderSearch({
          queryKey: query.key,

          query,

          timeFilter,

          pages: safePages,
        });
      },
    );

    // ==================================================
    // SUMMARY
    // ==================================================

    let totalRawResultCount = 0;

    let totalResultCount = 0;

    let totalNewCount = 0;

    let totalDiscoveredCount = 0;

    // Giữ compatibility với response cũ
    let totalCandidateCount = 0;

    let totalPotentialCount = 0;

    let totalDuplicateCount = 0;

    let totalSkippedCount = 0;

    for (const item of data) {
      totalRawResultCount += Number(item?.rawResultCount || 0);

      totalResultCount += Number(item?.resultCount || 0);

      totalNewCount += Number(item?.newCount || 0);

      totalDiscoveredCount += Number(item?.discoveredCount || 0);

      totalCandidateCount += Number(item?.candidateCount || 0);

      totalPotentialCount += Number(item?.potentialCount || 0);

      totalDuplicateCount += Number(item?.duplicateCount || 0);

      totalSkippedCount += Number(item?.skippedCount || 0);
    }

    // ==================================================
    // ACCEPTED
    //
    // Trước đây controller không cộng DISCOVERED.
    // Vì vậy DB insert 13 nhưng summary có thể chỉ báo 7.
    // ==================================================

    const totalAcceptedCount =
      totalNewCount +
      totalDiscoveredCount +
      totalCandidateCount +
      totalPotentialCount;

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.json({
      success: true,

      message: "Đã hoàn tất tìm kiếm Tender",

      timeFilter,

      pages: safePages,

      concurrency: safeConcurrency,

      quotaLimited,

      quota: {
        allowed: quota?.allowed !== false,

        used: quotaUsed,

        limit: quotaLimit,

        remaining: availableQuota,

        requiredRequests: queries.length * safePages,
      },

      summary: {
        queryCount: data.length,

        totalRawResultCount,

        totalResultCount,

        totalNewCount,

        totalDiscoveredCount,

        // compatibility
        totalCandidateCount,

        totalPotentialCount,

        totalAcceptedCount,

        totalDuplicateCount,

        totalSkippedCount,
      },

      data,
    });
  } catch (error) {
    console.error("[Tender Watcher] search:", error);

    return res.status(500).json({
      success: false,

      message: error?.message || "Tender batch search error",
    });
  }
};

// ======================================================
// SEARCH SINGLE
// ======================================================

const searchSingle = async (req, res) => {
  try {
    const {
      queryKey,

      timeFilter = "qdr:d",

      pages = 1,
    } = req.body || {};

    if (!queryKey) {
      return res.status(400).json({
        success: false,

        message: "Thiếu queryKey",
      });
    }

    // ==================================================
    // FIND QUERY
    // ==================================================

    const query = await findTenderQueryByKey(queryKey);

    if (!query) {
      return res.status(404).json({
        success: false,

        message: `Không tìm thấy queryKey: ${queryKey}`,
      });
    }

    // ==================================================
    // QUOTA
    // ==================================================

    const quota = await checkSerpQuota();

    if (quota?.allowed === false) {
      return res.status(429).json({
        success: false,

        message: "SerpAPI đã đạt ngưỡng an toàn",

        quota,
      });
    }

    const safePages = normalizePages(pages);

    const availableQuota = getAvailableQuota(quota);

    if (availableQuota > 0 && availableQuota < safePages) {
      return res.status(429).json({
        success: false,

        message: "Không đủ quota SerpAPI để chạy query này",

        requiredRequests: safePages,

        availableQuota,

        quota,
      });
    }

    // ==================================================
    // EXECUTE
    // ==================================================

    const result = await executeTenderSearch({
      queryKey,

      query,

      timeFilter,

      pages: safePages,
    });

    return res.json({
      success: true,

      message: "Đã hoàn tất test Tender",

      quota: {
        remaining: availableQuota,
      },

      data: result,
    });
  } catch (error) {
    console.error("[Tender Watcher] searchSingle:", error);

    return res.status(500).json({
      success: false,

      message: error?.message || "Tender single search error",
    });
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  getQueries,

  getQuota,

  search,

  searchSingle,

  runWithConcurrency,

  normalizePages,

  normalizeConcurrency,

  getAvailableQuota,

  getQuotaLimit,

  getQuotaUsed,
};
