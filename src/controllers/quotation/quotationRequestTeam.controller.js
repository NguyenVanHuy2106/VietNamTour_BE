"use strict";

const { Op } = require("sequelize");

const {
  User,
  QuotationTeam,
  QuotationTeamMember,
  QuotationRequest,
  QuotationRequestAttachment,
  QuotationRequestLog,
} = require("../../models");

const sequelize = QuotationRequest.sequelize;

const STATUSES = [
  "RECEIVED",
  "PROCESSING",
  "SUBMITTED",
  "WON",
  "LOST",
  "CANCELLED",
];

// Cho phép tiếp nhận dữ liệu từ bộ trạng thái cũ.
const TRANSITIONS = {
  RECEIVED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SUBMITTED", "CANCELLED"],
  CONTACTED: ["PROCESSING", "SUBMITTED", "CANCELLED"],
  SUBMITTED: ["PROCESSING", "WON", "LOST", "CANCELLED"],
  COMPLETED: ["SUBMITTED", "WON", "LOST"],
  WON: [],
  LOST: [],
  CANCELLED: [],
};

const parseId = (value) => {
  if (
    value == null ||
    typeof value === "boolean" ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const httpError = (status, code, message) => {
  const error = new Error(message);
  error.statusCode = status;
  error.errorCode = code;
  return error;
};

const respondError = (res, error) => {
  console.error("[QUOTATION TEAM REQUEST]", error);

  return res.status(error.statusCode || 500).json({
    success: false,
    code: error.errorCode || "INTERNAL_ERROR",
    message: error.statusCode
      ? error.message
      : "Không thể xử lý yêu cầu báo giá.",
  });
};

const ok = (res, message, data, extra = {}) =>
  res.json({
    success: true,
    message,
    data,
    ...extra,
  });

// ----------------------------------------------------------
// ID phải được gắn bởi middleware verifyToken.
// Tuyệt đối không đọc user_id từ body hoặc query để cấp quyền.
//
// Cần đối chiếu tên field với src/middlewares/auth.js.
// Nếu middleware không gắn ID, API trả 401 (fail closed).
// ----------------------------------------------------------

const getAuthenticatedUserId = (req) => {
  const id =
    req.user?.user_id ??
    req.user?.userId ??
    req.user?.id ??
    req.auth?.user_id ??
    req.auth?.userId ??
    req.auth?.id ??
    req.userId ??
    req.decoded?.user_id ??
    req.decoded?.id;

  const parsed = parseId(id);

  if (!parsed) {
    throw httpError(
      401,
      "AUTH_USER_MISSING",
      "Không xác định được nhân viên từ JWT. Kiểm tra middleware verifyToken.",
    );
  }

  return parsed;
};

const requireMember = async (req, transaction = null) => {
  const userId = getAuthenticatedUserId(req);

  const member = await QuotationTeamMember.findOne({
    where: { user_id: userId },
    transaction,
  });

  if (!member) {
    throw httpError(
      403,
      "NOT_TEAM_MEMBER",
      "Nhân viên chưa được phân vào nhóm kinh doanh.",
    );
  }

  const team = await QuotationTeam.findByPk(member.team_id, { transaction });

  if (!team || Number(team.status) !== 1) {
    throw httpError(
      403,
      "TEAM_INACTIVE",
      "Nhóm kinh doanh không tồn tại hoặc đã ngừng hoạt động.",
    );
  }

  return { userId, member, team };
};

const requireRequestInTeam = async (
  requestId,
  member,
  transaction = null,
  lock = false,
) => {
  const request = await QuotationRequest.findOne({
    where: {
      request_id: requestId,
      deleted_at: null,
    },
    transaction,
    ...(transaction && lock ? { lock: transaction.LOCK.UPDATE } : {}),
  });

  if (!request) {
    throw httpError(
      404,
      "REQUEST_NOT_FOUND",
      "Không tìm thấy yêu cầu báo giá.",
    );
  }

  if (
    request.team_id == null ||
    String(request.team_id) !== String(member.team_id)
  ) {
    throw httpError(
      403,
      "REQUEST_OUTSIDE_TEAM",
      "Yêu cầu báo giá không thuộc nhóm kinh doanh của bạn.",
    );
  }

  return request;
};

const requireTeamAdmin = (member) => {
  if (member.role !== "ADMIN") {
    throw httpError(
      403,
      "ADMIN_REQUIRED",
      "Chỉ Admin nhóm kinh doanh mới được cập nhật trạng thái báo giá.",
    );
  }
};

const parsePagination = (query) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);

  if (
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    throw httpError(
      400,
      "INVALID_PAGINATION",
      "Thông số page hoặc limit không hợp lệ.",
    );
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

// ==========================================================
// 1. GET MY TEAM REQUESTS
//
// GET /api/quotationRequest/team/my-list
//
// Params: page, limit, search, status
// Không nhận team_id từ client để quyết định phạm vi.
// ==========================================================

exports.getMyTeamRequests = async (req, res) => {
  try {
    const { member, team } = await requireMember(req);
    const { page, limit, offset } = parsePagination(req.query);

    const where = {
      team_id: member.team_id,
      deleted_at: null,
    };

    if (req.query.status) {
      const status = String(req.query.status).toUpperCase();

      if (
        !STATUSES.includes(status) &&
        !["CONTACTED", "COMPLETED"].includes(status)
      ) {
        throw httpError(400, "INVALID_STATUS", "Trạng thái lọc không hợp lệ.");
      }

      where.status = status;
    }

    const search = String(req.query.search || "")
      .trim()
      .slice(0, 200);

    if (search) {
      where[Op.or] = [
        {
          request_name: {
            [Op.iLike]: `%${search}%`,
          },
        },
        {
          notification_code: {
            [Op.iLike]: `%${search}%`,
          },
        },
        {
          procuring_entity: {
            [Op.iLike]: `%${search}%`,
          },
        },
        {
          package_name: {
            [Op.iLike]: `%${search}%`,
          },
        },
      ];
    }

    const { count, rows } = await QuotationRequest.findAndCountAll({
      where,
      include: [
        {
          model: QuotationTeam,
          as: "team",
          attributes: ["team_id", "team_code", "team_name"],
          required: false,
        },
      ],
      order: [
        ["created_at", "DESC"],
        ["request_id", "DESC"],
      ],
      limit,
      offset,
      distinct: true,
    });

    return ok(res, "Lấy yêu cầu báo giá của nhóm thành công.", rows, {
      team: {
        team_id: team.team_id,
        team_code: team.team_code,
        team_name: team.team_name,
        my_role: member.role || "MEMBER",
        can_update_status: member.role === "ADMIN",
      },
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    return respondError(res, error);
  }
};

// ==========================================================
// 2. GET REQUEST DETAIL
//
// GET /api/quotationRequest/team/:id
// ==========================================================

exports.getMyTeamRequestDetail = async (req, res) => {
  try {
    const { member } = await requireMember(req);
    const requestId = parseId(req.params.id);

    if (!requestId) {
      throw httpError(400, "INVALID_ID", "request_id không hợp lệ.");
    }

    await requireRequestInTeam(requestId, member);

    const detail = await QuotationRequest.findOne({
      where: {
        request_id: requestId,
        team_id: member.team_id,
        deleted_at: null,
      },
      include: [
        {
          model: QuotationTeam,
          as: "team",
          required: false,
        },
        {
          model: QuotationRequestAttachment,
          as: "attachments",
          required: false,
        },
      ],
    });

    if (!detail) {
      throw httpError(
        404,
        "REQUEST_NOT_FOUND",
        "Không tìm thấy yêu cầu thuộc nhóm.",
      );
    }

    return ok(res, "Lấy chi tiết yêu cầu báo giá thành công.", {
      ...detail.toJSON(),
      my_role: member.role || "MEMBER",
      can_update_status: member.role === "ADMIN",
    });
  } catch (error) {
    return respondError(res, error);
  }
};

// ==========================================================
// 3. GET REQUEST HISTORY
//
// GET /api/quotationRequest/team/:id/history
// ==========================================================

exports.getMyTeamRequestHistory = async (req, res) => {
  try {
    const { member } = await requireMember(req);
    const requestId = parseId(req.params.id);

    if (!requestId) {
      throw httpError(400, "INVALID_ID", "request_id không hợp lệ.");
    }

    await requireRequestInTeam(requestId, member);

    const { page, limit, offset } = parsePagination(req.query);

    const { count, rows } = await QuotationRequestLog.findAndCountAll({
      where: {
        request_id: requestId,
      },
      order: [
        ["created_at", "DESC"],
        ["log_id", "DESC"],
      ],
      limit,
      offset,
    });

    return ok(res, "Lấy lịch sử yêu cầu báo giá thành công.", rows, {
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    return respondError(res, error);
  }
};

// ==========================================================
// 4. UPDATE REQUEST STATUS
//
// PUT /api/quotationRequest/team/:id/status
//
// Body:
// {
//   "status": "PROCESSING",
//   "reason": "Đang thiết kế chương trình tour"
// }
//
// Quyền:
// - MEMBER: 403
// - ADMIN nhóm khác: 403
// - ADMIN đúng nhóm: Được cập nhật
// ==========================================================

exports.updateMyTeamRequestStatus = async (req, res) => {
  try {
    const requestId = parseId(req.params.id);

    if (!requestId) {
      throw httpError(400, "INVALID_ID", "request_id không hợp lệ.");
    }

    const newStatus = String(req.body?.status || "")
      .trim()
      .toUpperCase();

    if (!STATUSES.includes(newStatus)) {
      throw httpError(
        400,
        "INVALID_STATUS",
        "Trạng thái yêu cầu báo giá không hợp lệ.",
      );
    }

    const reason = String(req.body?.reason || "").trim();

    if (reason.length > 2000) {
      throw httpError(400, "INVALID_REASON", "Ghi chú tối đa 2.000 ký tự.");
    }

    const result = await sequelize.transaction(async (transaction) => {
      // Lấy người thực hiện từ JWT, không lấy từ body.
      const { userId, member } = await requireMember(req, transaction);

      requireTeamAdmin(member);

      const request = await requireRequestInTeam(
        requestId,
        member,
        transaction,
        true,
      );

      const oldStatus = request.status;

      if (oldStatus === newStatus) {
        throw httpError(409, "SAME_STATUS", "Yêu cầu đã ở trạng thái này.");
      }

      const allowed = TRANSITIONS[oldStatus] || [];

      if (!allowed.includes(newStatus)) {
        throw httpError(
          409,
          "INVALID_TRANSITION",
          `Không thể chuyển trạng thái từ ${oldStatus} sang ${newStatus}.`,
        );
      }

      const now = new Date();

      await request.update(
        {
          status: newStatus,
          updated_by: userId,
          updated_at: now,
        },
        { transaction },
      );

      await QuotationRequestLog.create(
        {
          request_id: requestId,
          action: "STATUS_CHANGE",
          old_status: oldStatus,
          new_status: newStatus,
          reason: reason || null,
          performed_by: userId,
          created_at: now,
        },
        { transaction },
      );

      return {
        request_id: requestId,
        team_id: member.team_id,
        old_status: oldStatus,
        new_status: newStatus,
        performed_by: userId,
        updated_at: now,
      };
    });

    return ok(res, "Cập nhật trạng thái yêu cầu báo giá thành công.", result);
  } catch (error) {
    return respondError(res, error);
  }
};
