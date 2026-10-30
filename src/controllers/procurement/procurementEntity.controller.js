const { Op } = require("sequelize");

const { procurementEntity } = require("../../models");

const {
  importProcurementData,
} = require("../../services/procurement/procurementImport.service");

// ==========================================================
// HELPER - GET CURRENT USER ID
// ==========================================================

const getCurrentUserId = (req) => {
  return req.user?.id || req.user?.user_id || req.userId || req.user_id || null;
};

// ==========================================================
// IMPORT DATA
//
// POST /api/procurement/import
// ==========================================================

const importData = async (req, res) => {
  try {
    const input = req.body?.raw_text ?? req.body?.data ?? req.body;

    const result = await importProcurementData(input);

    return res.status(200).json({
      success: true,

      message:
        `Đã xử lý ${result.total} đơn vị. ` +
        `${result.inserted} thêm mới, ` +
        `${result.duplicates} trùng, ` +
        `${result.skipped} bỏ qua, ` +
        `${result.errors} lỗi.`,

      data: result,
    });
  } catch (error) {
    console.error("[PROCUREMENT IMPORT]", error);

    return res.status(400).json({
      success: false,

      message: error?.message || "Không thể import dữ liệu.",
    });
  }
};

// ==========================================================
// GET ENTITIES - KHO DỮ LIỆU CHUNG
//
// GET /api/procurement/entities
// ==========================================================

const getEntities = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );

    const offset = (page - 1) * limit;

    const keyword = String(req.query.keyword || "").trim();

    const sourceRole = String(req.query.source_role || "").trim();

    const provinceCode = String(req.query.province_code || "").trim();

    const hasPhone = String(req.query.has_phone || "").trim();

    const unassignedOnly = String(req.query.unassigned_only || "").trim();

    const where = {};

    // ======================================================
    // ONLY UNASSIGNED
    // ======================================================

    if (unassignedOnly === "1") {
      where.assigned_to = null;
    }

    // ======================================================
    // SEARCH
    // ======================================================

    if (keyword) {
      where[Op.or] = [
        {
          org_code: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          organization_name: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          address: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          representative_name: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          representative_position: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          phone: {
            [Op.iLike]: `%${keyword}%`,
          },
        },
      ];
    }

    // ======================================================
    // SOURCE ROLE
    // ======================================================

    if (sourceRole) {
      where.source_role = sourceRole;
    }

    // ======================================================
    // PROVINCE CODE
    // ======================================================

    if (provinceCode) {
      where.province_code = provinceCode;
    }

    // ======================================================
    // HAS PHONE
    // ======================================================

    if (hasPhone === "1") {
      where.phone = {
        [Op.and]: [
          {
            [Op.ne]: null,
          },
          {
            [Op.ne]: "",
          },
        ],
      };
    }

    if (hasPhone === "0") {
      where.phone = {
        [Op.or]: [
          {
            [Op.eq]: null,
          },
          {
            [Op.eq]: "",
          },
        ],
      };
    }

    // ======================================================
    // QUERY
    // ======================================================

    const { count, rows } = await procurementEntity.findAndCountAll({
      where,

      limit,

      offset,

      order: [
        ["approved_at", "DESC"],

        ["id", "DESC"],
      ],

      attributes: [
        "id",

        "org_code",

        "organization_name",

        "address",

        "representative_name",

        "representative_position",

        "phone",

        "tax_code",

        "province_code",

        "district_code",

        "business_type",

        "source_role",

        "source_status",

        "approved_at",

        "source_type",

        "assigned_to",

        "assigned_at",

        "care_status",

        "staff_note",

        "next_follow_up_at",

        "created_at",

        "updated_at",
      ],
    });

    const totalPages = Math.max(Math.ceil(count / limit), 1);

    return res.json({
      success: true,

      data: rows,

      pagination: {
        page,

        limit,

        total: count,

        totalPages,

        hasNextPage: page < totalPages,

        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[PROCUREMENT LIST]", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy danh sách đơn vị.",
    });
  }
};

// ==========================================================
// GET MY ENTITIES
//
// GET /api/procurement/my-entities
// ==========================================================

const getMyEntities = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Không xác định được người dùng hiện tại.",
      });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100,
    );

    const offset = (page - 1) * limit;

    const keyword = String(req.query.keyword || "").trim();

    const careStatus = String(req.query.care_status || "").trim();

    const where = {
      assigned_to: userId,
    };

    // ======================================================
    // SEARCH
    // ======================================================

    if (keyword) {
      where[Op.or] = [
        {
          org_code: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          organization_name: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          address: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          representative_name: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          representative_position: {
            [Op.iLike]: `%${keyword}%`,
          },
        },

        {
          phone: {
            [Op.iLike]: `%${keyword}%`,
          },
        },
      ];
    }

    // ======================================================
    // CARE STATUS
    // ======================================================

    if (careStatus) {
      where.care_status = careStatus;
    }

    // ======================================================
    // QUERY
    // ======================================================

    const { count, rows } = await procurementEntity.findAndCountAll({
      where,

      limit,

      offset,

      order: [
        ["next_follow_up_at", "ASC"],

        ["assigned_at", "DESC"],

        ["id", "DESC"],
      ],
    });

    const totalPages = Math.max(Math.ceil(count / limit), 1);

    return res.json({
      success: true,

      data: rows,

      pagination: {
        page,

        limit,

        total: count,

        totalPages,

        hasNextPage: page < totalPages,

        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[PROCUREMENT MY ENTITIES]", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy danh sách đơn vị của bạn.",
    });
  }
};

// ==========================================================
// CLAIM ENTITY
//
// POST /api/procurement/entities/:id/claim
// ==========================================================

const claimEntity = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Không xác định được người dùng hiện tại.",
      });
    }

    const entity = await procurementEntity.findByPk(req.params.id);

    if (!entity) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy đơn vị.",
      });
    }

    // ======================================================
    // ALREADY ASSIGNED
    // ======================================================

    if (entity.assigned_to) {
      if (Number(entity.assigned_to) === Number(userId)) {
        return res.json({
          success: true,

          message: "Đơn vị này đã nằm trong danh sách của bạn.",

          data: entity,
        });
      }

      return res.status(409).json({
        success: false,

        message: "Đơn vị này vừa được nhân viên khác nhận.",
      });
    }

    // ======================================================
    // ATOMIC CLAIM
    // ======================================================

    const [updatedCount] = await procurementEntity.update(
      {
        assigned_to: userId,

        assigned_at: new Date(),

        care_status: "NEW",
      },
      {
        where: {
          id: entity.id,

          assigned_to: null,
        },
      },
    );

    // ======================================================
    // RACE CONDITION
    // ======================================================

    if (updatedCount === 0) {
      return res.status(409).json({
        success: false,

        message: "Đơn vị này vừa được nhân viên khác nhận.",
      });
    }

    const claimedEntity = await procurementEntity.findByPk(entity.id);

    return res.json({
      success: true,

      message: "Nhận thông tin thành công.",

      data: claimedEntity,
    });
  } catch (error) {
    console.error("[PROCUREMENT CLAIM]", error);

    return res.status(500).json({
      success: false,

      message: "Không thể nhận thông tin đơn vị.",
    });
  }
};

// ==========================================================
// UPDATE CARE
//
// PUT /api/procurement/entities/:id/care
// ==========================================================

const updateCare = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Không xác định được người dùng hiện tại.",
      });
    }

    // ======================================================
    // FIND ENTITY BELONGING TO CURRENT USER
    // ======================================================

    const entity = await procurementEntity.findOne({
      where: {
        id: req.params.id,

        assigned_to: userId,
      },
    });

    if (!entity) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy đơn vị hoặc đơn vị không thuộc bạn.",
      });
    }

    // ======================================================
    // BODY
    // ======================================================

    const {
      care_status,

      representative_name,

      representative_position,

      phone,

      staff_note,

      next_follow_up_at,
    } = req.body;

    // ======================================================
    // VALID STATUS
    // ======================================================

    const allowedStatus = [
      "NEW",
      "CONTACTING",
      "CONTACTED",
      "INTERESTED",
      "FOLLOW_UP",
      "SUCCESS",
      "NOT_INTERESTED",
    ];

    if (care_status && !allowedStatus.includes(care_status)) {
      return res.status(400).json({
        success: false,

        message: "Trạng thái chăm sóc không hợp lệ.",
      });
    }

    // ======================================================
    // UPDATE
    // ======================================================

    await entity.update({
      care_status: care_status !== undefined ? care_status : entity.care_status,

      representative_name:
        representative_name !== undefined
          ? normalizeNullableText(representative_name)
          : entity.representative_name,

      representative_position:
        representative_position !== undefined
          ? normalizeNullableText(representative_position)
          : entity.representative_position,

      phone: phone !== undefined ? normalizeNullableText(phone) : entity.phone,

      staff_note:
        staff_note !== undefined
          ? normalizeNullableText(staff_note)
          : entity.staff_note,

      next_follow_up_at:
        next_follow_up_at !== undefined
          ? normalizeDate(next_follow_up_at)
          : entity.next_follow_up_at,
    });

    await entity.reload();

    return res.json({
      success: true,

      message: "Đã cập nhật thông tin chăm sóc.",

      data: entity,
    });
  } catch (error) {
    console.error("[PROCUREMENT CARE]", error);

    return res.status(500).json({
      success: false,

      message: "Không thể cập nhật thông tin chăm sóc.",
    });
  }
};

// ==========================================================
// GET DETAIL
//
// GET /api/procurement/entities/:id
// ==========================================================

const getEntityById = async (req, res) => {
  try {
    const entity = await procurementEntity.findByPk(req.params.id);

    if (!entity) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy đơn vị.",
      });
    }

    return res.json({
      success: true,

      data: entity,
    });
  } catch (error) {
    console.error("[PROCUREMENT DETAIL]", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy thông tin chi tiết.",
    });
  }
};

// ==========================================================
// STATS
//
// GET /api/procurement/stats
// ==========================================================

const getStats = async (req, res) => {
  try {
    const total = await procurementEntity.count();

    // ======================================================
    // UNASSIGNED
    // ======================================================

    const unassigned = await procurementEntity.count({
      where: {
        assigned_to: null,
      },
    });

    // ======================================================
    // ASSIGNED
    // ======================================================

    const assigned = await procurementEntity.count({
      where: {
        assigned_to: {
          [Op.ne]: null,
        },
      },
    });

    // ======================================================
    // WITH PHONE
    // ======================================================

    const withPhone = await procurementEntity.count({
      where: {
        phone: {
          [Op.and]: [
            {
              [Op.ne]: null,
            },

            {
              [Op.ne]: "",
            },
          ],
        },
      },
    });

    // ======================================================
    // WITH REPRESENTATIVE
    // ======================================================

    const withRepresentative = await procurementEntity.count({
      where: {
        representative_name: {
          [Op.and]: [
            {
              [Op.ne]: null,
            },

            {
              [Op.ne]: "",
            },
          ],
        },
      },
    });

    // ======================================================
    // WITH POSITION
    // ======================================================

    const withPosition = await procurementEntity.count({
      where: {
        representative_position: {
          [Op.and]: [
            {
              [Op.ne]: null,
            },

            {
              [Op.ne]: "",
            },
          ],
        },
      },
    });

    // ======================================================
    // ADDED TODAY
    // ======================================================

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const addedToday = await procurementEntity.count({
      where: {
        created_at: {
          [Op.gte]: today,
        },
      },
    });

    // ======================================================
    // MY STATS
    // ======================================================

    const userId = getCurrentUserId(req);

    let myTotal = 0;

    let myFollowUp = 0;

    let mySuccess = 0;

    if (userId) {
      myTotal = await procurementEntity.count({
        where: {
          assigned_to: userId,
        },
      });

      myFollowUp = await procurementEntity.count({
        where: {
          assigned_to: userId,

          care_status: {
            [Op.in]: ["CONTACTING", "FOLLOW_UP"],
          },
        },
      });

      mySuccess = await procurementEntity.count({
        where: {
          assigned_to: userId,

          care_status: "SUCCESS",
        },
      });
    }

    return res.json({
      success: true,

      data: {
        total,

        unassigned,

        assigned,

        with_phone: withPhone,

        with_representative: withRepresentative,

        with_position: withPosition,

        added_today: addedToday,

        my_total: myTotal,

        my_follow_up: myFollowUp,

        my_success: mySuccess,
      },
    });
  } catch (error) {
    console.error("[PROCUREMENT STATS]", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy thống kê.",
    });
  }
};

// ==========================================================
// DELETE ENTITY
//
// DELETE /api/procurement/entities/:id
// ==========================================================

const deleteEntity = async (req, res) => {
  try {
    const entity = await procurementEntity.findByPk(req.params.id);

    if (!entity) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy đơn vị.",
      });
    }

    await entity.destroy();

    return res.json({
      success: true,

      message: "Đã xóa đơn vị.",
    });
  } catch (error) {
    console.error("[PROCUREMENT DELETE]", error);

    return res.status(500).json({
      success: false,

      message: "Không thể xóa đơn vị.",
    });
  }
};

// ==========================================================
// HELPER - NULLABLE TEXT
// ==========================================================

const normalizeNullableText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
};

// ==========================================================
// HELPER - DATE
// ==========================================================

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// ==========================================================
// UPDATE ENTITY DATA
//
// PUT /api/procurement/entities/:id
// ==========================================================

const updateEntity = async (req, res) => {
  try {
    const entity = await procurementEntity.findByPk(req.params.id);

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn vị.",
      });
    }

    const {
      organization_name,
      address,
      representative_name,
      representative_position,
      phone,
      tax_code,
    } = req.body;

    if (organization_name !== undefined && !String(organization_name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên đơn vị không được để trống.",
      });
    }

    await entity.update({
      organization_name:
        organization_name !== undefined
          ? String(organization_name).trim()
          : entity.organization_name,

      address:
        address !== undefined ? normalizeNullableText(address) : entity.address,

      representative_name:
        representative_name !== undefined
          ? normalizeNullableText(representative_name)
          : entity.representative_name,

      representative_position:
        representative_position !== undefined
          ? normalizeNullableText(representative_position)
          : entity.representative_position,

      phone: phone !== undefined ? normalizeNullableText(phone) : entity.phone,

      tax_code:
        tax_code !== undefined
          ? normalizeNullableText(tax_code)
          : entity.tax_code,
    });

    await entity.reload();

    return res.json({
      success: true,

      message: "Đã cập nhật dữ liệu đơn vị.",

      data: entity,
    });
  } catch (error) {
    console.error("[PROCUREMENT UPDATE ENTITY]", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật dữ liệu đơn vị.",
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  importData,

  getEntities,

  getMyEntities,

  claimEntity,

  updateCare,

  getEntityById,

  getStats,

  deleteEntity,
  updateEntity,
};
