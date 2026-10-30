const { Op, fn, col } = require("sequelize");

const TenderItem = require("../../models/lead_ai/tenderItem.model");

// ======================================================
// HELPERS
// ======================================================

const toPositiveInt = (value, defaultValue) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return defaultValue;
  }

  return Math.floor(number);
};

const buildWhere = (query = {}) => {
  const where = {};

  const keyword = String(query.keyword || "").trim();

  const category = String(query.category || "").trim();

  const status = String(query.status || "").trim();

  const sourceType = String(query.source_type || "").trim();

  const domain = String(query.domain || "").trim();

  const dateFrom = String(query.date_from || "").trim();

  const dateTo = String(query.date_to || "").trim();

  // ==================================================
  // KEYWORD
  // ==================================================

  if (keyword) {
    where[Op.or] = [
      {
        title: {
          [Op.iLike]: `%${keyword}%`,
        },
      },

      {
        organization_name: {
          [Op.iLike]: `%${keyword}%`,
        },
      },

      {
        domain: {
          [Op.iLike]: `%${keyword}%`,
        },
      },

      {
        snippet: {
          [Op.iLike]: `%${keyword}%`,
        },
      },
    ];
  }

  // ==================================================
  // CATEGORY
  // ==================================================

  if (category && category !== "ALL") {
    where.category = category;
  }

  // ==================================================
  // STATUS
  // ==================================================

  if (status && status !== "ALL") {
    where.status = status;
  }

  // ==================================================
  // SOURCE TYPE
  // ==================================================

  if (sourceType && sourceType !== "ALL") {
    where.source_type = sourceType;
  }

  // ==================================================
  // DOMAIN
  // ==================================================

  if (domain) {
    where.domain = {
      [Op.iLike]: `%${domain}%`,
    };
  }

  // ==================================================
  // DATE
  //
  // Lọc theo ngày hệ thống phát hiện Tender.
  // ==================================================

  if (dateFrom || dateTo) {
    where.first_seen_at = {};

    if (dateFrom) {
      const fromDate = new Date(`${dateFrom}T00:00:00`);

      if (!Number.isNaN(fromDate.getTime())) {
        where.first_seen_at[Op.gte] = fromDate;
      }
    }

    if (dateTo) {
      const toDate = new Date(`${dateTo}T23:59:59.999`);

      if (!Number.isNaN(toDate.getTime())) {
        where.first_seen_at[Op.lte] = toDate;
      }
    }

    if (Object.keys(where.first_seen_at).length === 0) {
      delete where.first_seen_at;
    }
  }

  return where;
};

// ======================================================
// GET TENDER ITEMS
//
// GET /api/tender/items
//
// Query:
//
// page
// limit
// keyword
// category
// status
// source_type
// domain
// date_from
// date_to
// sort_by
// sort_order
// ======================================================

const getTenderItems = async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1);

    const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);

    const offset = (page - 1) * limit;

    const where = buildWhere(req.query);

    // ==================================================
    // SORT
    // ==================================================

    const allowedSortFields = [
      "id",
      "first_seen_at",
      "last_seen_at",
      "published_at",
      "deadline_at",
      "relevance_score",
      "created_at",
      "updated_at",
    ];

    const requestedSortBy = String(req.query.sort_by || "first_seen_at").trim();

    const sortBy = allowedSortFields.includes(requestedSortBy)
      ? requestedSortBy
      : "first_seen_at";

    const requestedSortOrder = String(
      req.query.sort_order || "DESC",
    ).toUpperCase();

    const sortOrder = requestedSortOrder === "ASC" ? "ASC" : "DESC";

    // ==================================================
    // QUERY
    // ==================================================

    const result = await TenderItem.findAndCountAll({
      where,

      attributes: [
        "id",

        "source_id",

        "source_type",

        "title",

        "source_url",

        "canonical_url",

        "domain",

        "snippet",

        "organization_name",

        "published_at",

        "deadline_at",

        "first_seen_at",

        "last_seen_at",

        "serp_position",

        "serp_query_key",

        "relevance_score",

        "category",

        "status",

        "assigned_user_id",

        "created_at",

        "updated_at",
      ],

      order: [
        [sortBy, sortOrder],
        ["id", "DESC"],
      ],

      limit,

      offset,

      distinct: true,
    });

    const total = Number(result.count || 0);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.status(200).json({
      success: true,

      message: "Lấy danh sách Tender thành công",

      pagination: {
        page,

        limit,

        total,

        totalPages,

        hasNextPage: page < totalPages,

        hasPreviousPage: page > 1,
      },

      filters: {
        keyword: req.query.keyword || "",

        category: req.query.category || "ALL",

        status: req.query.status || "ALL",

        source_type: req.query.source_type || "ALL",

        domain: req.query.domain || "",

        date_from: req.query.date_from || null,

        date_to: req.query.date_to || null,

        sort_by: sortBy,

        sort_order: sortOrder,
      },

      data: result.rows,
    });
  } catch (error) {
    console.error("[Tender API][GET_ITEMS_ERROR]", {
      message: error?.message,

      sql: error?.sql,

      detail: error?.parent?.detail,
    });

    return res.status(500).json({
      success: false,

      message: "Không thể lấy danh sách Tender",

      error: error?.message,
    });
  }
};

// ======================================================
// GET TENDER DETAIL
//
// GET /api/tender/items/:id
// ======================================================

const getTenderItemDetail = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,

        message: "Tender ID không hợp lệ",
      });
    }

    const item = await TenderItem.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy Tender",
      });
    }

    return res.status(200).json({
      success: true,

      data: item,
    });
  } catch (error) {
    console.error("[Tender API][GET_DETAIL_ERROR]", {
      message: error?.message,

      id: req.params.id,
    });

    return res.status(500).json({
      success: false,

      message: "Không thể lấy chi tiết Tender",

      error: error?.message,
    });
  }
};

// ======================================================
// GET TENDER STATS
//
// GET /api/tender/stats
//
// Dùng cho card dashboard:
// - Tổng
// - NEW
// - DISCOVERED
// - chưa nhận
// - đã nhận
//
// Đồng thời trả thống kê category.
// ======================================================

const getTenderStats = async (req, res) => {
  try {
    const [
      total,

      totalNew,

      totalDiscovered,

      totalUnassigned,

      totalAssigned,

      categoryRows,

      sourceTypeRows,
    ] = await Promise.all([
      TenderItem.count(),

      TenderItem.count({
        where: {
          status: "NEW",
        },
      }),

      TenderItem.count({
        where: {
          status: "DISCOVERED",
        },
      }),

      TenderItem.count({
        where: {
          assigned_user_id: null,
        },
      }),

      TenderItem.count({
        where: {
          assigned_user_id: {
            [Op.ne]: null,
          },
        },
      }),

      TenderItem.findAll({
        attributes: ["category", [fn("COUNT", col("id")), "count"]],

        group: ["category"],

        raw: true,
      }),

      TenderItem.findAll({
        attributes: ["source_type", [fn("COUNT", col("id")), "count"]],

        group: ["source_type"],

        raw: true,
      }),
    ]);

    const categories = {};

    for (const row of categoryRows) {
      const key = row.category || "UNKNOWN";

      categories[key] = Number(row.count || 0);
    }

    const sourceTypes = {};

    for (const row of sourceTypeRows) {
      const key = row.source_type || "UNKNOWN";

      sourceTypes[key] = Number(row.count || 0);
    }

    return res.status(200).json({
      success: true,

      data: {
        total,

        new: totalNew,

        discovered: totalDiscovered,

        unassigned: totalUnassigned,

        assigned: totalAssigned,

        categories,

        sourceTypes,
      },
    });
  } catch (error) {
    console.error("[Tender API][GET_STATS_ERROR]", {
      message: error?.message,

      sql: error?.sql,

      detail: error?.parent?.detail,
    });

    return res.status(500).json({
      success: false,

      message: "Không thể lấy thống kê Tender",

      error: error?.message,
    });
  }
};

// ======================================================
// GET FILTER OPTIONS
//
// GET /api/tender/filter-options
//
// FE dùng cho dropdown.
// ======================================================

const getTenderFilterOptions = async (req, res) => {
  try {
    const [categoryRows, statusRows, sourceTypeRows] = await Promise.all([
      TenderItem.findAll({
        attributes: ["category"],

        where: {
          category: {
            [Op.ne]: null,
          },
        },

        group: ["category"],

        order: [["category", "ASC"]],

        raw: true,
      }),

      TenderItem.findAll({
        attributes: ["status"],

        where: {
          status: {
            [Op.ne]: null,
          },
        },

        group: ["status"],

        order: [["status", "ASC"]],

        raw: true,
      }),

      TenderItem.findAll({
        attributes: ["source_type"],

        where: {
          source_type: {
            [Op.ne]: null,
          },
        },

        group: ["source_type"],

        order: [["source_type", "ASC"]],

        raw: true,
      }),
    ]);

    return res.status(200).json({
      success: true,

      data: {
        categories: categoryRows.map((item) => item.category).filter(Boolean),

        statuses: statusRows.map((item) => item.status).filter(Boolean),

        sourceTypes: sourceTypeRows
          .map((item) => item.source_type)
          .filter(Boolean),
      },
    });
  } catch (error) {
    console.error("[Tender API][GET_FILTER_OPTIONS_ERROR]", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy bộ lọc Tender",

      error: error?.message,
    });
  }
};

module.exports = {
  getTenderItems,

  getTenderItemDetail,

  getTenderStats,

  getTenderFilterOptions,
};
