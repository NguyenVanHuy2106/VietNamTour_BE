const { Op } = require("sequelize");

const { GoongCompany } = require("../../models/lead_ai");

/**
 * =========================================================
 * GET CURRENT USER ID
 * =========================================================
 *
 * Hỗ trợ vài kiểu middleware auth phổ biến.
 *
 * Sau này nếu verifyToken của ông chắc chắn là req.user.id
 * thì có thể rút gọn lại.
 */

function getCurrentUserId(req) {
  return req.user?.id || req.user?.user_id || req.userId || req.user_id || null;
}

/**
 * =========================================================
 * GET WORKSPACE
 * =========================================================
 *
 * GET /api/lead-ai/workspace
 *
 * Chỉ lấy công ty CHƯA có nhân viên nhận.
 */

async function getWorkspaceCompanies(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );

    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim();

    const province = String(req.query.province || "").trim();

    const district = String(req.query.district || "").trim();

    const andConditions = [
      {
        assigned_to: null,
      },
    ];

    /**
     * ==========================================
     * SEARCH
     * ==========================================
     */

    if (search) {
      andConditions.push({
        [Op.or]: [
          {
            name: {
              [Op.iLike]: `%${search}%`,
            },
          },

          {
            formatted_address: {
              [Op.iLike]: `%${search}%`,
            },
          },

          {
            phone: {
              [Op.iLike]: `%${search}%`,
            },
          },

          {
            website: {
              [Op.iLike]: `%${search}%`,
            },
          },
        ],
      });
    }

    /**
     * ==========================================
     * PROVINCE
     * ==========================================
     */

    if (province) {
      andConditions.push({
        province: {
          [Op.iLike]: `%${province}%`,
        },
      });
    }

    /**
     * ==========================================
     * DISTRICT
     * ==========================================
     */

    if (district) {
      andConditions.push({
        district: {
          [Op.iLike]: `%${district}%`,
        },
      });
    }

    /**
     * ==========================================
     * QUERY
     * ==========================================
     */

    const { count, rows } = await GoongCompany.findAndCountAll({
      where: {
        [Op.and]: andConditions,
      },

      limit,

      offset,

      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,

      data: rows,

      pagination: {
        page,

        limit,

        total: count,

        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("[LeadAI Workspace]", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Không thể lấy Workspace",
    });
  }
}

/**
 * =========================================================
 * CLAIM COMPANY
 * =========================================================
 *
 * POST /api/lead-ai/workspace/:id/claim
 *
 * Atomic update:
 *
 * chỉ update khi assigned_to IS NULL.
 *
 * → chống 2 nhân viên nhận cùng 1 company.
 */

async function claimCompany(req, res) {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Không xác định được người dùng.",
      });
    }

    const companyId = req.params.id;

    /**
     * ==========================================
     * ATOMIC UPDATE
     * ==========================================
     */

    const [affectedCount, updatedRows] = await GoongCompany.update(
      {
        assigned_to: userId,

        assigned_at: new Date(),

        lead_status: "ASSIGNED",
      },

      {
        where: {
          id: companyId,

          assigned_to: null,
        },

        returning: true,
      },
    );

    /**
     * Không update được:
     * - ID không tồn tại
     * hoặc
     * - đã có người nhận.
     */

    if (!affectedCount || !updatedRows?.length) {
      const existing = await GoongCompany.findByPk(companyId);

      if (!existing) {
        return res.status(404).json({
          success: false,

          message: "Không tìm thấy công ty.",
        });
      }

      return res.status(409).json({
        success: false,

        message: "Công ty này đã được nhân viên khác nhận.",
      });
    }

    const company = updatedRows[0];

    return res.json({
      success: true,

      message: "Nhận công ty thành công.",

      data: company,
    });
  } catch (error) {
    console.error("[LeadAI Claim Company]", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Không thể nhận công ty.",
    });
  }
}

/**
 * =========================================================
 * GET MY COMPANIES
 * =========================================================
 *
 * GET /api/lead-ai/my-companies
 */

async function getMyCompanies(req, res) {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Không xác định được người dùng.",
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );

    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim();

    const status = String(req.query.status || "").trim();

    const andConditions = [
      {
        assigned_to: userId,
      },
    ];

    /**
     * ==========================================
     * STATUS
     * ==========================================
     */

    if (status) {
      andConditions.push({
        lead_status: status,
      });
    }

    /**
     * ==========================================
     * SEARCH
     * ==========================================
     */

    if (search) {
      andConditions.push({
        [Op.or]: [
          {
            name: {
              [Op.iLike]: `%${search}%`,
            },
          },

          {
            formatted_address: {
              [Op.iLike]: `%${search}%`,
            },
          },

          {
            phone: {
              [Op.iLike]: `%${search}%`,
            },
          },

          {
            contact_person: {
              [Op.iLike]: `%${search}%`,
            },
          },

          {
            contact_phone: {
              [Op.iLike]: `%${search}%`,
            },
          },
        ],
      });
    }

    const { count, rows } = await GoongCompany.findAndCountAll({
      where: {
        [Op.and]: andConditions,
      },

      limit,

      offset,

      order: [
        ["assigned_at", "DESC"],

        ["created_at", "DESC"],
      ],
    });

    return res.json({
      success: true,

      data: rows,

      pagination: {
        page,

        limit,

        total: count,

        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("[LeadAI My Companies]", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Không thể lấy danh sách công ty.",
    });
  }
}

/**
 * =========================================================
 * GET MY COMPANY DETAIL
 * =========================================================
 *
 * GET /api/lead-ai/my-companies/:id
 *
 * User chỉ được xem company mình đã nhận.
 */

async function getMyCompanyDetail(req, res) {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Không xác định được người dùng.",
      });
    }

    const company = await GoongCompany.findOne({
      where: {
        id: req.params.id,

        assigned_to: userId,
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy công ty hoặc công ty không thuộc bạn.",
      });
    }

    return res.json({
      success: true,

      data: company,
    });
  } catch (error) {
    console.error("[LeadAI Company Detail]", error);

    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
}

/**
 * =========================================================
 * UPDATE COMPANY CARE
 * =========================================================
 *
 * PUT /api/lead-ai/my-companies/:id
 */

async function updateMyCompany(req, res) {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Không xác định được người dùng.",
      });
    }

    const company = await GoongCompany.findOne({
      where: {
        id: req.params.id,

        assigned_to: userId,
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy công ty hoặc công ty không thuộc bạn.",
      });
    }

    const allowedStatuses = [
      "ASSIGNED",
      "CONTACTING",
      "INTERESTED",
      "FOLLOW_UP",
      "NOT_INTERESTED",
      "CONVERTED",
    ];

    const {
      lead_status,

      staff_note,

      contact_person,

      contact_position,

      contact_phone,

      contact_email,

      next_follow_up_at,
    } = req.body;

    /**
     * Validate status
     */
    if (lead_status && !allowedStatuses.includes(lead_status)) {
      return res.status(400).json({
        success: false,

        message: "Trạng thái chăm sóc không hợp lệ.",
      });
    }

    await company.update({
      lead_status: lead_status || company.lead_status,

      staff_note: staff_note !== undefined ? staff_note : company.staff_note,

      contact_person:
        contact_person !== undefined ? contact_person : company.contact_person,

      contact_position:
        contact_position !== undefined
          ? contact_position
          : company.contact_position,

      contact_phone:
        contact_phone !== undefined ? contact_phone : company.contact_phone,

      contact_email:
        contact_email !== undefined ? contact_email : company.contact_email,

      next_follow_up_at:
        next_follow_up_at !== undefined
          ? next_follow_up_at
          : company.next_follow_up_at,
    });

    return res.json({
      success: true,

      message: "Cập nhật chăm sóc thành công.",

      data: company,
    });
  } catch (error) {
    console.error("[LeadAI Update Company]", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Không thể cập nhật công ty.",
    });
  }
}

// ==========================================================
// MY REPORT
// ==========================================================

const getMyReport = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Không xác định được người dùng.",
      });
    }

    // ======================================================
    // DATE
    // ======================================================

    const now = new Date();

    const next7Days = new Date();

    next7Days.setDate(next7Days.getDate() + 7);

    // ======================================================
    // BASE WHERE
    // ======================================================

    const baseWhere = {
      assigned_to: userId,
    };

    // ======================================================
    // COUNTS
    // ======================================================

    const [
      total,

      assigned,

      contacting,

      interested,

      followUp,

      notInterested,

      converted,

      overdueFollowUp,

      upcomingFollowUp,
    ] = await Promise.all([
      // TOTAL
      GoongCompany.count({
        where: baseWhere,
      }),

      // ASSIGNED
      GoongCompany.count({
        where: {
          ...baseWhere,

          lead_status: "ASSIGNED",
        },
      }),

      // CONTACTING
      GoongCompany.count({
        where: {
          ...baseWhere,

          lead_status: "CONTACTING",
        },
      }),

      // INTERESTED
      GoongCompany.count({
        where: {
          ...baseWhere,

          lead_status: "INTERESTED",
        },
      }),

      // FOLLOW UP
      GoongCompany.count({
        where: {
          ...baseWhere,

          lead_status: "FOLLOW_UP",
        },
      }),

      // NOT INTERESTED
      GoongCompany.count({
        where: {
          ...baseWhere,

          lead_status: "NOT_INTERESTED",
        },
      }),

      // CONVERTED
      GoongCompany.count({
        where: {
          ...baseWhere,

          lead_status: "CONVERTED",
        },
      }),

      // OVERDUE
      GoongCompany.count({
        where: {
          ...baseWhere,

          next_follow_up_at: {
            [Op.lt]: now,

            [Op.ne]: null,
          },

          lead_status: {
            [Op.notIn]: ["CONVERTED", "NOT_INTERESTED"],
          },
        },
      }),

      // UPCOMING 7 DAYS
      GoongCompany.count({
        where: {
          ...baseWhere,

          next_follow_up_at: {
            [Op.gte]: now,

            [Op.lte]: next7Days,
          },

          lead_status: {
            [Op.notIn]: ["CONVERTED", "NOT_INTERESTED"],
          },
        },
      }),
    ]);

    // ======================================================
    // UPCOMING LIST
    // ======================================================

    const upcomingCompanies = await GoongCompany.findAll({
      where: {
        ...baseWhere,

        next_follow_up_at: {
          [Op.ne]: null,
        },

        lead_status: {
          [Op.notIn]: ["CONVERTED", "NOT_INTERESTED"],
        },
      },

      attributes: [
        "id",

        "name",

        "formatted_address",

        "phone",

        "contact_person",

        "contact_phone",

        "lead_status",

        "next_follow_up_at",
      ],

      order: [["next_follow_up_at", "ASC"]],

      limit: 10,
    });

    // ======================================================
    // CONVERSION RATE
    // ======================================================

    const conversionRate =
      total > 0 ? Number(((converted / total) * 100).toFixed(1)) : 0;

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.json({
      success: true,

      data: {
        summary: {
          total,

          assigned,

          contacting,

          interested,

          follow_up: followUp,

          not_interested: notInterested,

          converted,
        },

        performance: {
          conversion_rate: conversionRate,

          overdue_follow_up: overdueFollowUp,

          upcoming_follow_up: upcomingFollowUp,
        },

        upcoming: upcomingCompanies,
      },
    });
  } catch (error) {
    console.error("getMyReport error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể tải báo cáo Lead AI.",

      error: error.message,
    });
  }
};
/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

module.exports = {
  getWorkspaceCompanies,

  claimCompany,

  getMyCompanies,

  getMyCompanyDetail,

  updateMyCompany,

  getMyReport,
};
