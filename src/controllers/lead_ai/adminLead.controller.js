const { Op } = require("sequelize");

const { GoongCompany } = require("../../models/lead_ai");

const User = require("../../models/user.model");

// ==========================================================
// GET CURRENT USER ID
// ==========================================================

function getCurrentUserId(req) {
  return req.user?.id || req.user?.user_id || req.userId || req.user_id || null;
}

// ==========================================================
// ADMIN CHECK
// ==========================================================

function checkAdmin(req, res) {
  const userId = Number(getCurrentUserId(req));

  if (userId !== 1001) {
    res.status(403).json({
      success: false,
      message: "Bạn không có quyền truy cập chức năng quản trị Lead AI.",
    });

    return false;
  }

  return true;
}

// ==========================================================
// CHECK HAS UPDATED
// ==========================================================

function hasCareUpdated(company) {
  return Boolean(
    company.contact_person ||
    company.contact_position ||
    company.contact_phone ||
    company.contact_email ||
    company.staff_note ||
    company.next_follow_up_at ||
    (company.lead_status && company.lead_status !== "ASSIGNED"),
  );
}

// ==========================================================
// CHECK OVERDUE
// ==========================================================

function isFollowUpOverdue(company) {
  if (!company.next_follow_up_at) {
    return false;
  }

  if (["CONVERTED", "NOT_INTERESTED"].includes(company.lead_status)) {
    return false;
  }

  const followUpDate = new Date(company.next_follow_up_at);

  if (Number.isNaN(followUpDate.getTime())) {
    return false;
  }

  return followUpDate.getTime() < Date.now();
}

// ==========================================================
// GET USER MAP
// ==========================================================

async function getUserMap(staffIds = []) {
  const userMap = new Map();

  if (!Array.isArray(staffIds) || staffIds.length === 0) {
    return userMap;
  }

  const normalizedIds = [
    ...new Set(staffIds.map((id) => Number(id)).filter(Boolean)),
  ];

  if (normalizedIds.length === 0) {
    return userMap;
  }

  const users = await User.findAll({
    where: {
      user_id: {
        [Op.in]: normalizedIds,
      },
    },

    attributes: ["user_id", "name", "email", "position"],
  });

  for (const row of users) {
    const user = row.toJSON();

    userMap.set(Number(user.user_id), user);
  }

  return userMap;
}

// ==========================================================
// GET STAFF INFO
// ==========================================================

function attachStaffInfo(company, userMap) {
  const user = userMap.get(Number(company.assigned_to));

  return {
    ...company,

    staff_name: user?.name || `Nhân viên #${company.assigned_to}`,

    staff_email: user?.email || null,

    staff_position: user?.position || null,
  };
}

// ==========================================================
// ADMIN DASHBOARD
//
// GET /api/lead-ai/admin/dashboard
// ==========================================================

const getAdminDashboard = async (req, res) => {
  if (!checkAdmin(req, res)) {
    return;
  }

  try {
    const now = new Date();

    const next7Days = new Date();

    next7Days.setDate(next7Days.getDate() + 7);

    const [
      totalAssigned,
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
        where: {
          assigned_to: {
            [Op.ne]: null,
          },
        },
      }),

      // ASSIGNED
      GoongCompany.count({
        where: {
          assigned_to: {
            [Op.ne]: null,
          },

          lead_status: "ASSIGNED",
        },
      }),

      // CONTACTING
      GoongCompany.count({
        where: {
          assigned_to: {
            [Op.ne]: null,
          },

          lead_status: "CONTACTING",
        },
      }),

      // INTERESTED
      GoongCompany.count({
        where: {
          assigned_to: {
            [Op.ne]: null,
          },

          lead_status: "INTERESTED",
        },
      }),

      // FOLLOW_UP
      GoongCompany.count({
        where: {
          assigned_to: {
            [Op.ne]: null,
          },

          lead_status: "FOLLOW_UP",
        },
      }),

      // NOT_INTERESTED
      GoongCompany.count({
        where: {
          assigned_to: {
            [Op.ne]: null,
          },

          lead_status: "NOT_INTERESTED",
        },
      }),

      // CONVERTED
      GoongCompany.count({
        where: {
          assigned_to: {
            [Op.ne]: null,
          },

          lead_status: "CONVERTED",
        },
      }),

      // OVERDUE
      GoongCompany.count({
        where: {
          assigned_to: {
            [Op.ne]: null,
          },

          next_follow_up_at: {
            [Op.ne]: null,

            [Op.lt]: now,
          },

          lead_status: {
            [Op.notIn]: ["CONVERTED", "NOT_INTERESTED"],
          },
        },
      }),

      // UPCOMING 7 DAYS
      GoongCompany.count({
        where: {
          assigned_to: {
            [Op.ne]: null,
          },

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

    // ====================================================
    // UPDATED / NOT UPDATED
    // ====================================================

    const assignedCompanies = await GoongCompany.findAll({
      where: {
        assigned_to: {
          [Op.ne]: null,
        },
      },

      attributes: [
        "id",
        "lead_status",
        "contact_person",
        "contact_position",
        "contact_phone",
        "contact_email",
        "staff_note",
        "next_follow_up_at",
      ],
    });

    let updatedCount = 0;

    let notUpdatedCount = 0;

    for (const row of assignedCompanies) {
      const company = row.get({
        plain: true,
      });

      if (hasCareUpdated(company)) {
        updatedCount += 1;
      } else {
        notUpdatedCount += 1;
      }
    }

    // ====================================================
    // RATE
    // ====================================================

    const conversionRate =
      totalAssigned > 0
        ? Number(((converted / totalAssigned) * 100).toFixed(1))
        : 0;

    const updateRate =
      totalAssigned > 0
        ? Number(((updatedCount / totalAssigned) * 100).toFixed(1))
        : 0;

    return res.json({
      success: true,

      data: {
        summary: {
          total_assigned: totalAssigned,

          updated: updatedCount,

          not_updated: notUpdatedCount,

          assigned,

          contacting,

          interested,

          follow_up: followUp,

          not_interested: notInterested,

          converted,
        },

        performance: {
          update_rate: updateRate,

          conversion_rate: conversionRate,

          overdue_follow_up: overdueFollowUp,

          upcoming_follow_up: upcomingFollowUp,
        },
      },
    });
  } catch (error) {
    console.error("getAdminDashboard error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể tải tổng quan quản trị Lead AI.",

      error: error.message,
    });
  }
};

// ==========================================================
// ADMIN COMPANY LIST
//
// GET /api/lead-ai/admin/companies
//
// QUERY:
// page
// limit
// search
// staff_id
// status
// updated = ALL | YES | NO
// overdue = ALL | YES | NO
// ==========================================================

const getAdminCompanies = async (req, res) => {
  if (!checkAdmin(req, res)) {
    return;
  }

  try {
    const page = Math.max(1, Number(req.query.page || 1));

    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim();

    const staffId = req.query.staff_id ? Number(req.query.staff_id) : null;

    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();

    const updated = String(req.query.updated || "ALL")
      .trim()
      .toUpperCase();

    const overdue = String(req.query.overdue || "ALL")
      .trim()
      .toUpperCase();

    // ====================================================
    // WHERE
    // ====================================================

    const where = {
      assigned_to: {
        [Op.ne]: null,
      },
    };

    // ====================================================
    // STAFF
    // ====================================================

    if (staffId && !Number.isNaN(staffId)) {
      where.assigned_to = staffId;
    }

    // ====================================================
    // STATUS
    // ====================================================

    if (status) {
      where.lead_status = status;
    }

    // ====================================================
    // SEARCH
    // ====================================================

    if (search) {
      where[Op.and] = [
        ...(where[Op.and] || []),

        {
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

            {
              contact_email: {
                [Op.iLike]: `%${search}%`,
              },
            },
          ],
        },
      ];
    }

    // ====================================================
    // OVERDUE YES
    // ====================================================

    if (overdue === "YES") {
      where[Op.and] = [
        ...(where[Op.and] || []),

        {
          next_follow_up_at: {
            [Op.ne]: null,

            [Op.lt]: new Date(),
          },

          lead_status: {
            [Op.notIn]: ["CONVERTED", "NOT_INTERESTED"],
          },
        },
      ];
    }

    // ====================================================
    // OVERDUE NO
    // ====================================================

    if (overdue === "NO") {
      where[Op.and] = [
        ...(where[Op.and] || []),

        {
          [Op.or]: [
            {
              next_follow_up_at: null,
            },

            {
              next_follow_up_at: {
                [Op.gte]: new Date(),
              },
            },

            {
              lead_status: {
                [Op.in]: ["CONVERTED", "NOT_INTERESTED"],
              },
            },
          ],
        },
      ];
    }

    // ====================================================
    // UPDATED YES
    // ====================================================

    if (updated === "YES") {
      where[Op.and] = [
        ...(where[Op.and] || []),

        {
          [Op.or]: [
            {
              contact_person: {
                [Op.ne]: null,
              },
            },

            {
              contact_position: {
                [Op.ne]: null,
              },
            },

            {
              contact_phone: {
                [Op.ne]: null,
              },
            },

            {
              contact_email: {
                [Op.ne]: null,
              },
            },

            {
              staff_note: {
                [Op.ne]: null,
              },
            },

            {
              next_follow_up_at: {
                [Op.ne]: null,
              },
            },

            {
              lead_status: {
                [Op.ne]: "ASSIGNED",
              },
            },
          ],
        },
      ];
    }

    // ====================================================
    // UPDATED NO
    // ====================================================

    if (updated === "NO") {
      where[Op.and] = [
        ...(where[Op.and] || []),

        {
          contact_person: null,

          contact_position: null,

          contact_phone: null,

          contact_email: null,

          staff_note: null,

          next_follow_up_at: null,

          lead_status: "ASSIGNED",
        },
      ];
    }

    // ====================================================
    // QUERY
    // ====================================================

    const { rows, count } = await GoongCompany.findAndCountAll({
      where,

      order: [
        ["updated_at", "DESC"],

        ["assigned_at", "DESC"],
      ],

      limit,

      offset,
    });

    // ====================================================
    // GET STAFF NAME
    // ====================================================

    const staffIds = rows.map((row) => Number(row.assigned_to)).filter(Boolean);

    const userMap = await getUserMap(staffIds);

    // ====================================================
    // MAP
    // ====================================================

    const data = rows.map((row) => {
      const company = row.get({
        plain: true,
      });

      const withStaff = attachStaffInfo(company, userMap);

      return {
        ...withStaff,

        has_updated: hasCareUpdated(company),

        is_overdue: isFollowUpOverdue(company),
      };
    });

    const totalPages = Math.max(1, Math.ceil(count / limit));

    return res.json({
      success: true,

      data,

      pagination: {
        page,

        limit,

        total: count,

        totalPages,
      },
    });
  } catch (error) {
    console.error("getAdminCompanies error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể tải danh sách quản trị Lead AI.",

      error: error.message,
    });
  }
};

// ==========================================================
// ADMIN COMPANY DETAIL
//
// GET /api/lead-ai/admin/companies/:id
// ==========================================================

const getAdminCompanyDetail = async (req, res) => {
  if (!checkAdmin(req, res)) {
    return;
  }

  try {
    const companyId = Number(req.params.id);

    if (!companyId || Number.isNaN(companyId)) {
      return res.status(400).json({
        success: false,

        message: "ID công ty không hợp lệ.",
      });
    }

    const company = await GoongCompany.findOne({
      where: {
        id: companyId,

        assigned_to: {
          [Op.ne]: null,
        },
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy công ty.",
      });
    }

    const data = company.get({
      plain: true,
    });

    // ====================================================
    // LOAD STAFF
    // ====================================================

    const userMap = await getUserMap([data.assigned_to]);

    const result = attachStaffInfo(data, userMap);

    return res.json({
      success: true,

      data: {
        ...result,

        has_updated: hasCareUpdated(data),

        is_overdue: isFollowUpOverdue(data),
      },
    });
  } catch (error) {
    console.error("getAdminCompanyDetail error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể tải chi tiết phiếu chăm sóc.",

      error: error.message,
    });
  }
};

// ==========================================================
// STAFF PERFORMANCE
//
// GET /api/lead-ai/admin/staff-performance
// ==========================================================

const getStaffPerformance = async (req, res) => {
  if (!checkAdmin(req, res)) {
    return;
  }

  try {
    // ====================================================
    // LOAD ALL ASSIGNED COMPANIES
    // ====================================================

    const companies = await GoongCompany.findAll({
      where: {
        assigned_to: {
          [Op.ne]: null,
        },
      },

      attributes: [
        "id",
        "assigned_to",
        "assigned_at",
        "lead_status",
        "contact_person",
        "contact_position",
        "contact_phone",
        "contact_email",
        "staff_note",
        "next_follow_up_at",
        "updated_at",
      ],

      order: [["assigned_to", "ASC"]],
    });

    // ====================================================
    // GROUP BY STAFF
    // ====================================================

    const staffMap = new Map();

    for (const row of companies) {
      const company = row.get({
        plain: true,
      });

      const staffId = Number(company.assigned_to);

      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staff_id: staffId,

          total: 0,

          updated: 0,

          not_updated: 0,

          assigned: 0,

          contacting: 0,

          interested: 0,

          follow_up: 0,

          not_interested: 0,

          converted: 0,

          overdue_follow_up: 0,

          update_rate: 0,

          conversion_rate: 0,
        });
      }

      const staff = staffMap.get(staffId);

      // TOTAL
      staff.total += 1;

      // UPDATED
      if (hasCareUpdated(company)) {
        staff.updated += 1;
      } else {
        staff.not_updated += 1;
      }

      // STATUS
      switch (company.lead_status) {
        case "ASSIGNED":
          staff.assigned += 1;

          break;

        case "CONTACTING":
          staff.contacting += 1;

          break;

        case "INTERESTED":
          staff.interested += 1;

          break;

        case "FOLLOW_UP":
          staff.follow_up += 1;

          break;

        case "NOT_INTERESTED":
          staff.not_interested += 1;

          break;

        case "CONVERTED":
          staff.converted += 1;

          break;

        default:
          break;
      }

      // OVERDUE
      if (isFollowUpOverdue(company)) {
        staff.overdue_follow_up += 1;
      }
    }

    // ====================================================
    // CALCULATE RATE
    // ====================================================

    let result = Array.from(staffMap.values()).map((staff) => ({
      ...staff,

      update_rate:
        staff.total > 0
          ? Number(((staff.updated / staff.total) * 100).toFixed(1))
          : 0,

      conversion_rate:
        staff.total > 0
          ? Number(((staff.converted / staff.total) * 100).toFixed(1))
          : 0,
    }));

    // ====================================================
    // LOAD USER INFO
    // ====================================================

    const staffIds = result
      .map((staff) => Number(staff.staff_id))
      .filter(Boolean);

    const userMap = await getUserMap(staffIds);

    // ====================================================
    // MERGE USER INFO
    // ====================================================

    result = result.map((staff) => {
      const user = userMap.get(Number(staff.staff_id));

      return {
        ...staff,

        staff_name: user?.name || `Nhân viên #${staff.staff_id}`,

        staff_email: user?.email || null,

        staff_position: user?.position || null,
      };
    });

    // ====================================================
    // SORT
    // ====================================================

    result.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));

    return res.json({
      success: true,

      data: result,
    });
  } catch (error) {
    console.error("getStaffPerformance error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể tải hiệu suất nhân viên.",

      error: error.message,
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  getAdminDashboard,

  getAdminCompanies,

  getAdminCompanyDetail,

  getStaffPerformance,
};
