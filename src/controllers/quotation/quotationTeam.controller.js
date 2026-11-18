"use strict";

const { Op, QueryTypes } = require("sequelize");

const {
  User,
  QuotationTeam,
  QuotationTeamMember,
  QuotationTeamTransferLog,
} = require("../../models");

// ============================================================
// VIET NAM TOUR ERP
// QUẢN LÝ NHÓM KINH DOANH
//
// PREFIX: /api/quotationTeam
//
// Chức năng:
// - Danh sách nhóm
// - Chi tiết nhóm
// - Tạo / cập nhật nhóm
// - Danh sách thành viên
// - Thêm / chuyển / xóa thành viên
// - Lịch sử điều chuyển
// - Nhóm kinh doanh của nhân viên
// - Bổ nhiệm / chuyển / thu hồi Admin nhóm
//
// Giữ nguyên tên các hàm exports hiện tại.
// ============================================================

const sequelize = QuotationTeam.sequelize;

// ============================================================
// 1. HELPERS
// ============================================================

const parseId = (value) => {
  if (
    value === undefined ||
    value === null ||
    typeof value === "boolean" ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const normalizeText = (value) => String(value ?? "").trim();

const normalizeTeamCode = (value) => normalizeText(value).toUpperCase();

const getErrorCode = (error) =>
  error?.original?.code || error?.parent?.code || null;

const sendSuccess = (res, message, data = null, status = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

const sendError = (res, status, message, code = null) => {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
};

const createAppError = (
  message,
  statusCode = 400,
  errorCode = "VALIDATION_ERROR",
) => {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errorCode = errorCode;

  return error;
};

const handleError = (res, error, fallback = "Đã xảy ra lỗi hệ thống.") => {
  console.error("[QUOTATION TEAM ERROR]", error);

  if (error?.statusCode) {
    return sendError(
      res,
      error.statusCode,
      error.message,
      error.errorCode || null,
    );
  }

  const code = getErrorCode(error);

  if (code === "23505") {
    return sendError(
      res,
      409,
      "Dữ liệu đã tồn tại hoặc bị trùng.",
      "DUPLICATE_DATA",
    );
  }

  if (code === "23503") {
    return sendError(
      res,
      409,
      "Dữ liệu đang được sử dụng.",
      "FOREIGN_KEY_CONFLICT",
    );
  }

  if (error?.name === "SequelizeValidationError") {
    return sendError(
      res,
      400,
      error.errors?.[0]?.message || "Dữ liệu không hợp lệ.",
      "VALIDATION_ERROR",
    );
  }

  return sendError(res, 500, fallback, "INTERNAL_SERVER_ERROR");
};

// ============================================================
// 2. KIỂM TRA MODEL LỊCH SỬ CHUYỂN NHÓM
//
// Tránh dùng nhầm QuotationRequestLog.
// ============================================================

const validateTransferLogModel = () => {
  if (!QuotationTeamTransferLog) {
    throw createAppError(
      "Chưa đăng ký QuotationTeamTransferLog trong models/index.js.",
      500,
      "TRANSFER_LOG_MODEL_MISSING",
    );
  }

  const attributes = QuotationTeamTransferLog.rawAttributes || {};

  const requiredFields = [
    "transfer_id",
    "user_id",
    "from_team_id",
    "to_team_id",
    "action",
    "performed_by",
  ];

  const missingFields = requiredFields.filter((field) => !attributes[field]);

  if (
    QuotationTeamTransferLog.name === "QuotationRequestLog" ||
    attributes.request_id ||
    missingFields.length > 0
  ) {
    throw createAppError(
      "Model QuotationTeamTransferLog đang ánh xạ sai. " +
        "Kiểm tra quotationTeamTransferLog.model.js " +
        "và models/index.js. " +
        (missingFields.length
          ? `Thiếu trường: ${missingFields.join(", ")}.`
          : ""),
      500,
      "TRANSFER_LOG_MODEL_INVALID",
    );
  }

  const tableInfo = QuotationTeamTransferLog.getTableName();

  const tableName =
    typeof tableInfo === "string" ? tableInfo : tableInfo.tableName;

  if (String(tableName).toLowerCase().includes("quotation_request_log")) {
    throw createAppError(
      "QuotationTeamTransferLog đang trỏ nhầm bảng lịch sử yêu cầu báo giá.",
      500,
      "TRANSFER_LOG_TABLE_INVALID",
    );
  }
};

const createTransferHistory = async (
  { userId, fromTeamId, toTeamId, action, reason, actorId, now },
  transaction,
) => {
  validateTransferLogModel();

  const history = await QuotationTeamTransferLog.create(
    {
      user_id: userId,
      from_team_id: fromTeamId,
      to_team_id: toTeamId,
      action,
      reason: reason || null,
      performed_by: actorId,
      created_at: now || new Date(),
    },
    { transaction },
  );

  return history;
};

// ============================================================
// 3. NGƯỜI THỰC HIỆN
//
// Giữ payload cũ từ Frontend.
// Việc xác thực quyền phải thực hiện bằng JWT.
// ============================================================

const getActorId = (req, field) => parseId(req.body?.[field]);

const requireActorField = (req, res, field) => {
  const actorId = getActorId(req, field);

  if (!actorId) {
    sendError(
      res,
      400,
      `Vui lòng truyền ${field} là ID người thực hiện.`,
      "ACTOR_ID_REQUIRED",
    );

    return null;
  }

  return actorId;
};

// Giữ middleware cũ để tương thích Router.
exports.requireQuotationActor = (req, res, next) => {
  return next();
};

// Middleware hiện tại chưa có quy tắc role ERP
// nên giữ để tương thích Router cũ.
// Không được coi đây là kiểm tra quyền thực sự.
exports.requireQuotationAdmin = (req, res, next) => {
  return next();
};

// ============================================================
// 4. VALIDATE TEAM
// ============================================================

const validateTeam = (body, isUpdate = false) => {
  const team_code = normalizeTeamCode(body?.team_code);

  const team_name = normalizeText(body?.team_name);

  const description = normalizeText(body?.description);

  const status = isUpdate ? Number(body?.status) : 1;

  if (!/^[A-Z0-9_-]{2,30}$/.test(team_code)) {
    return {
      error:
        "Mã nhóm phải từ 2–30 ký tự, " + "chỉ gồm chữ in hoa, số, _ hoặc -.",
    };
  }

  if (!team_name || team_name.length > 150) {
    return {
      error: "Tên nhóm phải từ 1–150 ký tự.",
    };
  }

  if (description.length > 2000) {
    return {
      error: "Mô tả tối đa 2.000 ký tự.",
    };
  }

  if (![0, 1].includes(status)) {
    return {
      error: "Trạng thái phải là 0 hoặc 1.",
    };
  }

  return {
    data: {
      team_code,
      team_name,
      description: description || null,
      status,
    },
  };
};

// ============================================================
// 5. PAGINATION
// ============================================================

const parsePagination = (query) => {
  const page = Number(query?.page ?? 1);
  const limit = Number(query?.limit ?? 50);

  if (
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 200
  ) {
    return null;
  }

  const offset = (page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    return null;
  }

  return {
    page,
    limit,
    offset,
  };
};

// ============================================================
// 6. KIỂM TRA USER ERP
// ============================================================

const userExists = async (userId, transaction = null) => {
  if (!userId) return false;

  const user = await User.findByPk(userId, {
    attributes: [User.primaryKeyAttribute],
    ...(transaction ? { transaction } : {}),
  });

  return Boolean(user);
};

// ============================================================
// 7. DANH SÁCH NHÓM KINH DOANH
//
// GET /api/quotationTeam
// ============================================================

exports.getTeams = async (req, res) => {
  try {
    const where = {};

    const rawStatus = req.query.status;

    if (rawStatus !== undefined && rawStatus !== "") {
      const status = Number(rawStatus);

      if (![0, 1].includes(status)) {
        return sendError(res, 400, "Trạng thái không hợp lệ.");
      }

      where.status = status;
    }

    const keyword = normalizeText(req.query.search).slice(0, 150);

    if (keyword) {
      where[Op.or] = [
        {
          team_code: {
            [Op.iLike]: `%${keyword}%`,
          },
        },
        {
          team_name: {
            [Op.iLike]: `%${keyword}%`,
          },
        },
      ];
    }

    const teams = await QuotationTeam.findAll({
      where,
      order: [
        ["status", "DESC"],
        ["team_name", "ASC"],
      ],
    });

    const teamIds = teams.map((team) => team.team_id);

    let counts = [];

    if (teamIds.length > 0) {
      counts = await QuotationTeamMember.findAll({
        attributes: [
          "team_id",
          [sequelize.fn("COUNT", sequelize.col("user_id")), "member_count"],
        ],
        where: {
          team_id: {
            [Op.in]: teamIds,
          },
        },
        group: ["team_id"],
        raw: true,
      });
    }

    const countMap = new Map(
      counts.map((row) => [String(row.team_id), Number(row.member_count)]),
    );

    const data = teams.map((team) => ({
      ...team.toJSON(),

      member_count: countMap.get(String(team.team_id)) || 0,
    }));

    return sendSuccess(res, "Lấy danh sách nhóm kinh doanh thành công.", data);
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách nhóm kinh doanh.");
  }
};

// ============================================================
// 8. CHI TIẾT NHÓM
//
// GET /api/quotationTeam/:teamId
// ============================================================

exports.getTeamDetail = async (req, res) => {
  try {
    const teamId = parseId(req.params.teamId);

    if (!teamId) {
      return sendError(res, 400, "ID nhóm không hợp lệ.");
    }

    const team = await QuotationTeam.findByPk(teamId);

    if (!team) {
      return sendError(res, 404, "Không tìm thấy nhóm kinh doanh.");
    }

    const members = await QuotationTeamMember.findAll({
      where: {
        team_id: teamId,
      },
      order: [
        ["joined_at", "ASC"],
        ["user_id", "ASC"],
      ],
    });

    return sendSuccess(res, "Lấy chi tiết nhóm kinh doanh thành công.", {
      ...team.toJSON(),
      member_count: members.length,
      members: members.map((member) => member.toJSON()),
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy chi tiết nhóm.");
  }
};

// ============================================================
// 9. TẠO NHÓM
//
// POST /api/quotationTeam
// ============================================================

exports.createTeam = async (req, res) => {
  try {
    const actorId = requireActorField(req, res, "created_by");

    if (!actorId) return;

    if (!(await userExists(actorId))) {
      return sendError(
        res,
        404,
        "Không tìm thấy người tạo trong ERP.",
        "ACTOR_NOT_FOUND",
      );
    }

    const validation = validateTeam(req.body, false);

    if (validation.error) {
      return sendError(res, 400, validation.error);
    }

    const payload = validation.data;

    const existing = await QuotationTeam.findOne({
      where: {
        team_code: payload.team_code,
      },
    });

    if (existing) {
      return sendError(
        res,
        409,
        "Mã nhóm kinh doanh đã tồn tại.",
        "TEAM_CODE_EXISTS",
      );
    }

    const team = await QuotationTeam.create({
      team_code: payload.team_code,
      team_name: payload.team_name,
      description: payload.description,
      status: 1,

      created_by: actorId,
      updated_by: actorId,
    });

    return sendSuccess(
      res,
      "Tạo nhóm kinh doanh thành công.",
      team.toJSON(),
      201,
    );
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      return sendError(
        res,
        409,
        "Mã nhóm kinh doanh đã tồn tại.",
        "TEAM_CODE_EXISTS",
      );
    }

    return handleError(res, error, "Không thể tạo nhóm kinh doanh.");
  }
};

// ============================================================
// 10. CẬP NHẬT NHÓM
//
// PUT /api/quotationTeam/:teamId
// ============================================================

exports.updateTeam = async (req, res) => {
  try {
    const actorId = requireActorField(req, res, "updated_by");

    if (!actorId) return;

    if (!(await userExists(actorId))) {
      return sendError(
        res,
        404,
        "Không tìm thấy người cập nhật trong ERP.",
        "ACTOR_NOT_FOUND",
      );
    }

    const teamId = parseId(req.params.teamId);

    if (!teamId) {
      return sendError(res, 400, "ID nhóm không hợp lệ.");
    }

    const validation = validateTeam(req.body, true);

    if (validation.error) {
      return sendError(res, 400, validation.error);
    }

    const payload = validation.data;

    const result = await sequelize.transaction(async (transaction) => {
      const team = await QuotationTeam.findByPk(teamId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!team) {
        return {
          error: "Không tìm thấy nhóm kinh doanh.",
          status: 404,
        };
      }

      if (payload.status === 0) {
        const memberCount = await QuotationTeamMember.count({
          where: {
            team_id: teamId,
          },
          transaction,
        });

        if (memberCount > 0) {
          return {
            error:
              "Nhóm đang có thành viên. " +
              "Vui lòng điều chuyển hoặc xóa " +
              "thành viên trước khi ngừng hoạt động.",
            status: 409,
          };
        }
      }

      const duplicate = await QuotationTeam.findOne({
        where: {
          team_code: payload.team_code,
          team_id: {
            [Op.ne]: teamId,
          },
        },
        transaction,
      });

      if (duplicate) {
        return {
          error: "Mã nhóm kinh doanh đã tồn tại.",
          status: 409,
        };
      }

      await team.update(
        {
          ...payload,
          updated_by: actorId,
        },
        { transaction },
      );

      return {
        data: team.toJSON(),
      };
    });

    if (result.error) {
      return sendError(res, result.status, result.error);
    }

    return sendSuccess(
      res,
      "Cập nhật nhóm kinh doanh thành công.",
      result.data,
    );
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      return sendError(
        res,
        409,
        "Mã nhóm kinh doanh đã tồn tại.",
        "TEAM_CODE_EXISTS",
      );
    }

    return handleError(res, error, "Không thể cập nhật nhóm kinh doanh.");
  }
};

// ============================================================
// 11. DANH SÁCH THÀNH VIÊN
//
// GET /api/quotationTeam/members
//
// BỔ SUNG: role
// ============================================================

exports.getMembers = async (req, res) => {
  try {
    const rawTeamId = req.query.team_id;

    const teamId =
      rawTeamId == null || rawTeamId === "" ? null : parseId(rawTeamId);

    if (rawTeamId != null && rawTeamId !== "" && !teamId) {
      return sendError(res, 400, "ID nhóm không hợp lệ.");
    }

    const where = {};

    if (teamId) {
      where.team_id = teamId;
    }

    const members = await QuotationTeamMember.findAll({
      where,
      include: [
        {
          model: QuotationTeam,
          as: "team",
          attributes: ["team_id", "team_code", "team_name", "status"],
          required: true,
        },
      ],
      order: [
        [
          {
            model: QuotationTeam,
            as: "team",
          },
          "team_name",
          "ASC",
        ],
        ["user_id", "ASC"],
      ],
    });

    const data = members.map((member) => {
      const item = member.toJSON();

      return {
        user_id: item.user_id,
        team_id: item.team_id,

        // Quyền Admin / Member
        role: item.role || "MEMBER",

        joined_at: item.joined_at,
        assigned_by: item.assigned_by,
        updated_at: item.updated_at,

        team_code: item.team?.team_code || null,

        team_name: item.team?.team_name || null,

        team_status: item.team?.status ?? null,
      };
    });

    return sendSuccess(res, "Lấy danh sách thành viên thành công.", data);
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách thành viên.");
  }
};

// ============================================================
// 12. ADVISORY LOCK THÀNH VIÊN
// ============================================================

const lockMember = async (userId, transaction) => {
  await sequelize.query(
    `
      SELECT pg_advisory_xact_lock(
        7319,
        :userId
      )
    `,
    {
      replacements: {
        userId,
      },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
};

// ============================================================
// 13. THÊM NHÂN VIÊN / CHUYỂN NHÓM
//
// POST /api/quotationTeam/assign
//
// BỔ SUNG:
// - role mặc định MEMBER
// - Khi chuyển nhóm, reset ADMIN cũ
// - Giữ lịch sử phân nhóm cũ
// ============================================================

exports.assignMember = async (req, res) => {
  try {
    const actorId = getActorId(req, "performed_by");

    if (!actorId) {
      return sendError(
        res,
        400,
        "Vui lòng truyền performed_by.",
        "ACTOR_ID_REQUIRED",
      );
    }

    if (!(await userExists(actorId))) {
      return sendError(
        res,
        404,
        "Không tìm thấy người thực hiện trong ERP.",
        "ACTOR_NOT_FOUND",
      );
    }

    const userId = parseId(req.body?.user_id);

    const teamId = parseId(req.body?.team_id);

    const reason = normalizeText(req.body?.reason);

    if (!userId || userId > 2147483647) {
      return sendError(res, 400, "ID nhân viên không hợp lệ.");
    }

    if (!teamId) {
      return sendError(res, 400, "Vui lòng chọn nhóm kinh doanh.");
    }

    if (reason.length > 2000) {
      return sendError(res, 400, "Lý do tối đa 2.000 ký tự.");
    }

    if (!(await userExists(userId))) {
      return sendError(
        res,
        404,
        "Không tìm thấy nhân viên ERP.",
        "USER_NOT_FOUND",
      );
    }

    // Kiểm tra Model trước khi bắt đầu giao dịch.
    // Nếu models/index.js đang export sai,
    // trả lỗi rõ ràng và không ghi dữ liệu dở dang.
    validateTransferLogModel();

    const result = await sequelize.transaction(async (transaction) => {
      await lockMember(userId, transaction);

      const destinations = await sequelize.query(
        `
                SELECT
                  team_id,
                  team_name,
                  status
                FROM mdm.md_quotation_teams
                WHERE team_id = :teamId
                FOR SHARE
              `,
        {
          replacements: {
            teamId,
          },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      const destination = destinations[0];

      if (!destination) {
        return {
          error: "Không tìm thấy nhóm kinh doanh.",
          status: 404,
        };
      }

      if (Number(destination.status) !== 1) {
        return {
          error: "Nhóm đã ngừng hoạt động, " + "không thể thêm nhân viên.",
          status: 409,
        };
      }

      const existing = await QuotationTeamMember.findByPk(userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existing && String(existing.team_id) === String(teamId)) {
        return {
          error: "Nhân viên đã thuộc nhóm kinh doanh này.",
          status: 409,
        };
      }

      const fromTeamId = existing ? existing.team_id : null;

      const action = existing ? "TRANSFER" : "ADD";

      const now = new Date();

      if (existing) {
        // Chuyển nhóm:
        // Admin nhóm cũ không được giữ
        // quyền Admin khi sang nhóm mới.
        await existing.update(
          {
            team_id: teamId,
            role: "MEMBER",
            joined_at: now,
            assigned_by: actorId,
            updated_at: now,
          },
          { transaction },
        );
      } else {
        // Thêm thành viên mới.
        await QuotationTeamMember.create(
          {
            user_id: userId,
            team_id: teamId,
            role: "MEMBER",
            joined_at: now,
            assigned_by: actorId,
            updated_at: now,
          },
          { transaction },
        );
      }

      // Ghi lịch sử phân nhóm bằng Model đúng.
      const history = await createTransferHistory(
        {
          userId,
          fromTeamId,
          toTeamId: teamId,
          action,
          reason,
          actorId,
          now,
        },
        transaction,
      );

      return {
        data: {
          user_id: userId,
          previous_team_id: fromTeamId,
          team_id: teamId,
          team_name: destination.team_name,

          role: "MEMBER",

          action,
          performed_by: actorId,
          transfer_id: history.transfer_id,
        },
      };
    });

    if (result.error) {
      return sendError(res, result.status, result.error);
    }

    const message =
      result.data.action === "TRANSFER"
        ? "Chuyển nhóm nhân viên thành công."
        : "Thêm nhân viên vào nhóm thành công.";

    return sendSuccess(res, message, result.data);
  } catch (error) {
    if (getErrorCode(error) === "23505") {
      return sendError(
        res,
        409,
        "Nhân viên đã được phân nhóm.",
        "MEMBER_ALREADY_ASSIGNED",
      );
    }

    return handleError(res, error, "Không thể phân nhóm nhân viên.");
  }
};

// ============================================================
// 14. XÓA NHÂN VIÊN KHỎI NHÓM
//
// DELETE /api/quotationTeam/members/:userId
//
// Nếu xóa ADMIN, nhóm không còn ADMIN.
// ============================================================

exports.removeMember = async (req, res) => {
  try {
    const actorId = getActorId(req, "performed_by");

    if (!actorId) {
      return sendError(
        res,
        400,
        "Vui lòng truyền performed_by.",
        "ACTOR_ID_REQUIRED",
      );
    }

    if (!(await userExists(actorId))) {
      return sendError(
        res,
        404,
        "Không tìm thấy người thực hiện trong ERP.",
        "ACTOR_NOT_FOUND",
      );
    }

    const userId = parseId(req.params.userId);

    const reason = normalizeText(req.body?.reason);

    if (!userId || userId > 2147483647) {
      return sendError(res, 400, "ID nhân viên không hợp lệ.");
    }

    if (reason.length > 2000) {
      return sendError(res, 400, "Lý do tối đa 2.000 ký tự.");
    }

    validateTransferLogModel();

    const result = await sequelize.transaction(async (transaction) => {
      await lockMember(userId, transaction);

      const member = await QuotationTeamMember.findByPk(userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!member) {
        return {
          error: "Nhân viên chưa thuộc nhóm kinh doanh nào.",
          status: 404,
        };
      }

      const fromTeamId = member.team_id;

      const previousRole = member.role || "MEMBER";

      await member.destroy({
        transaction,
      });

      const history = await createTransferHistory(
        {
          userId,
          fromTeamId,
          toTeamId: null,
          action: "REMOVE",
          reason,
          actorId,
          now: new Date(),
        },
        transaction,
      );

      return {
        data: {
          user_id: userId,
          previous_team_id: fromTeamId,
          previous_role: previousRole,
          action: "REMOVE",
          performed_by: actorId,
          transfer_id: history.transfer_id,
        },
      };
    });

    if (result.error) {
      return sendError(res, result.status, result.error);
    }

    return sendSuccess(
      res,
      "Xóa nhân viên khỏi nhóm kinh doanh thành công.",
      result.data,
    );
  } catch (error) {
    return handleError(res, error, "Không thể xóa nhân viên khỏi nhóm.");
  }
};

// ============================================================
// 15. LỊCH SỬ PHÂN NHÓM
//
// GET /api/quotationTeam/history
// ============================================================

exports.getHistory = async (req, res) => {
  try {
    validateTransferLogModel();

    const rawUserId = req.query.user_id;

    const userId =
      rawUserId == null || rawUserId === "" ? null : parseId(rawUserId);

    if (rawUserId != null && rawUserId !== "" && !userId) {
      return sendError(res, 400, "ID nhân viên không hợp lệ.");
    }

    const pagination = parsePagination(req.query);

    if (!pagination) {
      return sendError(res, 400, "Thông số phân trang không hợp lệ.");
    }

    const { page, limit, offset } = pagination;

    const where = {};

    if (userId) {
      where.user_id = userId;
    }

    const { count, rows } = await QuotationTeamTransferLog.findAndCountAll({
      where,
      include: [
        {
          model: QuotationTeam,
          as: "fromTeam",
          attributes: ["team_id", "team_code", "team_name"],
          required: false,
        },
        {
          model: QuotationTeam,
          as: "toTeam",
          attributes: ["team_id", "team_code", "team_name"],
          required: false,
        },
      ],
      order: [
        ["created_at", "DESC"],
        ["transfer_id", "DESC"],
      ],
      limit,
      offset,
    });

    const data = rows.map((row) => {
      const item = row.toJSON();

      return {
        transfer_id: item.transfer_id,

        user_id: item.user_id,

        from_team_id: item.from_team_id,

        from_team_code: item.fromTeam?.team_code || null,

        from_team_name: item.fromTeam?.team_name || null,

        to_team_id: item.to_team_id,

        to_team_code: item.toTeam?.team_code || null,

        to_team_name: item.toTeam?.team_name || null,

        action: item.action,

        reason: item.reason,

        performed_by: item.performed_by,

        created_at: item.created_at,
      };
    });

    return res.json({
      success: true,
      message: "Lấy lịch sử phân nhóm thành công.",
      data,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy lịch sử phân nhóm.");
  }
};

// ============================================================
// 16. NHÓM KINH DOANH CỦA USER
//
// GET /api/quotationTeam/my-team?user_id=1023
//
// BỔ SUNG: role
// ============================================================

exports.getMyTeam = async (req, res) => {
  try {
    const userId = parseId(req.query.user_id);

    if (!userId) {
      return sendError(
        res,
        400,
        "Vui lòng truyền user_id.",
        "USER_ID_REQUIRED",
      );
    }

    if (!(await userExists(userId))) {
      return sendError(
        res,
        404,
        "Không tìm thấy nhân viên ERP.",
        "USER_NOT_FOUND",
      );
    }

    const member = await QuotationTeamMember.findByPk(userId, {
      include: [
        {
          model: QuotationTeam,
          as: "team",
          attributes: [
            "team_id",
            "team_code",
            "team_name",
            "description",
            "status",
          ],
          required: true,
        },
      ],
    });

    if (!member) {
      return sendSuccess(
        res,
        "Nhân viên chưa được phân vào nhóm kinh doanh.",
        null,
      );
    }

    const item = member.toJSON();

    return sendSuccess(res, "Lấy nhóm kinh doanh thành công.", {
      user_id: item.user_id,

      team_id: item.team_id,

      role: item.role || "MEMBER",

      joined_at: item.joined_at,

      team_code: item.team?.team_code || null,

      team_name: item.team?.team_name || null,

      description: item.team?.description || null,

      status: item.team?.status ?? null,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể lấy nhóm kinh doanh của nhân viên.",
    );
  }
};

// ============================================================
// 17. LẤY ADMIN CỦA NHÓM
//
// GET /api/quotationTeam/:teamId/admin
// ============================================================

exports.getTeamAdmin = async (req, res) => {
  try {
    const teamId = parseId(req.params.teamId);

    if (!teamId) {
      return sendError(res, 400, "team_id không hợp lệ.");
    }

    const team = await QuotationTeam.findByPk(teamId);

    if (!team) {
      return sendError(res, 404, "Không tìm thấy nhóm kinh doanh.");
    }

    const admin = await QuotationTeamMember.findOne({
      where: {
        team_id: teamId,
        role: "ADMIN",
      },
    });

    return sendSuccess(
      res,
      admin ? "Lấy Admin nhóm thành công." : "Nhóm hiện chưa có Admin.",
      {
        team_id: teamId,

        has_admin: Boolean(admin),

        admin: admin
          ? {
              user_id: admin.user_id,

              team_id: admin.team_id,

              role: admin.role,
            }
          : null,
      },
    );
  } catch (error) {
    return handleError(res, error, "Không thể lấy Admin nhóm.");
  }
};

// ============================================================
// 18. BỔ NHIỆM / CHUYỂN / THU HỒI ADMIN
//
// PUT /api/quotationTeam/:teamId/admin
//
// Body:
// {
//   "user_id": 1002,
//   "performed_by": 1001
// }
//
// Thu hồi:
// {
//   "user_id": null,
//   "performed_by": 1001
// }
//
// Mỗi nhóm tối đa 1 ADMIN.
// Cho phép nhóm không có ADMIN.
// ============================================================

exports.setTeamAdmin = async (req, res) => {
  try {
    const teamId = parseId(req.params.teamId);

    if (!teamId) {
      return sendError(res, 400, "team_id không hợp lệ.");
    }

    const hasUserId = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "user_id",
    );

    if (!hasUserId) {
      return sendError(
        res,
        400,
        "Vui lòng truyền user_id. Dùng null để thu hồi Admin.",
      );
    }

    const rawUserId = req.body.user_id;

    const newAdminId = rawUserId === null ? null : parseId(rawUserId);

    if (rawUserId !== null && !newAdminId) {
      return sendError(res, 400, "user_id không hợp lệ.");
    }

    const actorId = getActorId(req, "performed_by");

    // Giữ tương thích Frontend hiện tại.
    // performed_by dùng để ghi nhận người thực hiện,
    // không được dùng thay thế kiểm tra quyền JWT.
    if (actorId && !(await userExists(actorId))) {
      return sendError(
        res,
        404,
        "Không tìm thấy người thực hiện trong ERP.",
        "ACTOR_NOT_FOUND",
      );
    }

    const result = await sequelize.transaction(async (transaction) => {
      // Khóa bản ghi nhóm:
      // Hai thao tác thay Admin cùng một nhóm
      // sẽ không chạy đồng thời.
      const team = await QuotationTeam.findByPk(teamId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!team) {
        throw createAppError(
          "Không tìm thấy nhóm kinh doanh.",
          404,
          "TEAM_NOT_FOUND",
        );
      }

      const currentAdmin = await QuotationTeamMember.findOne({
        where: {
          team_id: teamId,
          role: "ADMIN",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const oldAdminId = currentAdmin?.user_id ?? null;

      if (String(oldAdminId ?? "") === String(newAdminId ?? "")) {
        throw createAppError(
          newAdminId === null
            ? "Nhóm hiện chưa có Admin."
            : "Nhân viên này đã là Admin của nhóm.",
          409,
          "SAME_ADMIN",
        );
      }

      let newAdminMember = null;

      if (newAdminId !== null) {
        newAdminMember = await QuotationTeamMember.findOne({
          where: {
            team_id: teamId,
            user_id: newAdminId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!newAdminMember) {
          throw createAppError(
            "Nhân viên chưa thuộc nhóm kinh doanh này. " +
              "Vui lòng thêm nhân viên vào nhóm trước.",
            400,
            "MEMBER_NOT_IN_TEAM",
          );
        }
      }

      // Thu hồi quyền của Admin cũ.
      if (currentAdmin) {
        await currentAdmin.update(
          {
            role: "MEMBER",
          },
          { transaction },
        );
      }

      // Bổ nhiệm Admin mới.
      if (newAdminMember) {
        await newAdminMember.update(
          {
            role: "ADMIN",
          },
          { transaction },
        );
      }

      let action = "GRANT";

      if (newAdminId === null) {
        action = "REVOKE";
      } else if (oldAdminId !== null) {
        action = "TRANSFER";
      }

      return {
        team_id: teamId,
        action,

        old_admin_user_id: oldAdminId,

        new_admin_user_id: newAdminId,

        has_admin: newAdminId !== null,

        performed_by: actorId || null,
      };
    });

    const messages = {
      GRANT: "Đã bổ nhiệm Admin nhóm kinh doanh.",

      TRANSFER: "Đã chuyển quyền Admin nhóm kinh doanh.",

      REVOKE: "Đã thu hồi quyền Admin nhóm kinh doanh.",
    };

    return sendSuccess(res, messages[result.action], result);
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể cập nhật quyền Admin nhóm kinh doanh.",
    );
  }
};
