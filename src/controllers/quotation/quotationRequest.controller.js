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

// ============================================================
// CONFIG
// ============================================================

const STATUSES = [
  "RECEIVED", // Đã tiếp nhận
  "PROCESSING", // Đang thực hiện
  "SUBMITTED", // Đã nộp báo giá
  "WON", // Trúng báo giá
  "LOST", // Không trúng báo giá
  "CANCELLED", // Đã hủy

  // Giữ tương thích dữ liệu cũ
  "CONTACTED",
  "COMPLETED",
];

const SOURCE_TYPES = ["MANUAL", "PROCUREMENT"];

const MAX_ATTACHMENTS = 100;
const MAX_PAGE_SIZE = 100;

const REQUEST_FIELDS = [
  "notification_code",
  "notification_id",
  "notification_type",
  "request_name",
  "package_name",
  "procuring_entity",
  "publish_date",
  "closing_date",
  "location",
  "quantity",
  "unit",
  "package_price",
  "source_type",
  "source_url",
  "extraction_status",
  "raw_extraction_data",
  "notes",
  "quotation_validity",
];

// ============================================================
// HELPERS - RESPONSE
// ============================================================

const success = (res, message, data = null, status = 200, extra = {}) => {
  return res.status(status).json({
    success: true,
    message,
    data,
    ...extra,
  });
};

const failure = (res, status, message, code = null) => {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
};

const createError = (message, status = 400, code = "BAD_REQUEST") => {
  const error = new Error(message);
  error.statusCode = status;
  error.errorCode = code;
  return error;
};

const handleError = (res, error) => {
  console.error("[QUOTATION REQUEST]", error);

  if (error.statusCode) {
    return failure(res, error.statusCode, error.message, error.errorCode);
  }

  const pgCode = error?.original?.code || error?.parent?.code;

  if (pgCode === "23505") {
    return failure(
      res,
      409,
      "Mã yêu cầu báo giá đã tồn tại trong hệ thống.",
      "DUPLICATE_REQUEST",
    );
  }

  if (pgCode === "23503") {
    return failure(
      res,
      409,
      "Dữ liệu tham chiếu không hợp lệ.",
      "FOREIGN_KEY_ERROR",
    );
  }

  if (
    error.name === "SequelizeValidationError" ||
    error.name === "SequelizeUniqueConstraintError"
  ) {
    return failure(
      res,
      400,
      error.errors?.[0]?.message || "Dữ liệu không hợp lệ.",
      "VALIDATION_ERROR",
    );
  }

  return failure(
    res,
    500,
    "Đã xảy ra lỗi trong quá trình xử lý yêu cầu báo giá.",
    "INTERNAL_ERROR",
  );
};

// ============================================================
// HELPERS - NORMALIZE
// ============================================================

const stringValue = (value) => String(value ?? "").trim();

const nullableString = (value) => {
  const normalized = stringValue(value);
  return normalized || null;
};

const validId = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const requireId = (value, fieldName) => {
  const id = validId(value);

  if (!id) {
    throw createError(`${fieldName} không hợp lệ.`, 400, "INVALID_ID");
  }

  return id;
};

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);

const getField = (object, snakeCase, camelCase = snakeCase) => {
  if (hasOwn(object, snakeCase)) {
    return object[snakeCase];
  }

  if (hasOwn(object, camelCase)) {
    return object[camelCase];
  }

  return undefined;
};

const parseNonnegativeNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw createError(
      `${fieldName} phải là số không âm.`,
      400,
      "INVALID_NUMBER",
    );
  }

  return number;
};

const normalizeStatus = (value) => {
  const status = stringValue(value).toUpperCase();

  if (!STATUSES.includes(status)) {
    throw createError(
      "Trạng thái yêu cầu báo giá không hợp lệ.",
      400,
      "INVALID_STATUS",
    );
  }

  return status;
};

const normalizeSource = (value) => {
  const source = stringValue(value).toUpperCase();

  if (!SOURCE_TYPES.includes(source)) {
    throw createError(
      "Nguồn yêu cầu báo giá không hợp lệ.",
      400,
      "INVALID_SOURCE",
    );
  }

  return source;
};

// ============================================================
// HELPERS - DATES
//
// Hỗ trợ:
//   17/11/2026
//   20/11/2026 23:59
//   2026-11-17
//   2026-11-20T16:59:00.000Z
//
// closing_date lưu theo timestamptz.
// Chuỗi giờ Việt Nam được chuyển với UTC+07:00.
// ============================================================

const checkCalendarDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const parseDateValue = (value, fieldName, withTime = false) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw createError(`${fieldName} không hợp lệ.`);
    }

    return withTime ? value : value.toISOString().slice(0, 10);
  }

  const input = stringValue(value);

  // DD/MM/YYYY hoặc DD/MM/YYYY HH:mm
  const vietnamese = input.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/,
  );

  if (vietnamese) {
    const day = Number(vietnamese[1]);
    const month = Number(vietnamese[2]);
    const year = Number(vietnamese[3]);

    const hour = vietnamese[4] === undefined ? 0 : Number(vietnamese[4]);

    const minute = vietnamese[5] === undefined ? 0 : Number(vietnamese[5]);

    if (!checkCalendarDate(year, month, day) || hour > 23 || minute > 59) {
      throw createError(`${fieldName} không hợp lệ.`, 400, "INVALID_DATE");
    }

    const yyyy = String(year).padStart(4, "0");
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");

    if (!withTime) {
      return `${yyyy}-${mm}-${dd}`;
    }

    if (vietnamese[4] === undefined) {
      throw createError(
        `${fieldName} cần có giờ, định dạng DD/MM/YYYY HH:mm.`,
        400,
        "TIME_REQUIRED",
      );
    }

    const hh = String(hour).padStart(2, "0");
    const mi = String(minute).padStart(2, "0");

    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00+07:00`);
  }

  // YYYY-MM-DD
  const isoDate = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoDate && !withTime) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);

    if (!checkCalendarDate(year, month, day)) {
      throw createError(`${fieldName} không hợp lệ.`, 400, "INVALID_DATE");
    }

    return input;
  }

  // ISO datetime phải có timezone để tránh lệch giờ.
  if (
    withTime &&
    /^\d{4}-\d{2}-\d{2}T/.test(input) &&
    /(Z|[+-]\d{2}:\d{2})$/i.test(input)
  ) {
    const parsed = new Date(input);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  throw createError(`${fieldName} không đúng định dạng.`, 400, "INVALID_DATE");
};

// ============================================================
// HELPERS - ACTOR
//
// V1: ID người thực hiện do FE gửi.
// Sau này có thể đối chiếu với req.user từ JWT.
// ============================================================

const ensureUser = async (userId, fieldName = "userId", transaction = null) => {
  const id = requireId(userId, fieldName);

  const user = await User.findByPk(id, {
    transaction,
  });

  if (!user) {
    throw createError(
      `Không tìm thấy nhân viên #${id}.`,
      404,
      "USER_NOT_FOUND",
    );
  }

  return id;
};

const getActor = async (req, fieldName, transaction = null) => {
  return ensureUser(req.body?.[fieldName], fieldName, transaction);
};

// ============================================================
// HELPERS - TEAM
// ============================================================

const ensureTeam = async (teamId, transaction = null) => {
  const id = requireId(teamId, "team_id");

  const team = await QuotationTeam.findByPk(id, {
    transaction,
  });

  if (!team) {
    throw createError("Nhóm kinh doanh không tồn tại.", 404, "TEAM_NOT_FOUND");
  }

  if (Number(team.status) !== 1) {
    throw createError(
      "Nhóm kinh doanh đã ngừng hoạt động.",
      400,
      "TEAM_INACTIVE",
    );
  }

  return team;
};

// ============================================================
// HELPERS - ATTACHMENTS
// ============================================================

const normalizeAttachments = (attachments) => {
  if (attachments === undefined) {
    return undefined;
  }

  if (!Array.isArray(attachments)) {
    throw createError(
      "attachments phải là một mảng.",
      400,
      "INVALID_ATTACHMENTS",
    );
  }

  if (attachments.length > MAX_ATTACHMENTS) {
    throw createError(
      `Chỉ được lưu tối đa ${MAX_ATTACHMENTS} tài liệu.`,
      400,
      "TOO_MANY_ATTACHMENTS",
    );
  }

  return attachments.map((item, index) => {
    const fileName = nullableString(getField(item, "file_name", "fileName"));

    if (!fileName) {
      throw createError(
        `Tài liệu thứ ${index + 1} thiếu tên file.`,
        400,
        "FILE_NAME_REQUIRED",
      );
    }

    const fileSize = getField(item, "file_size", "fileSize");

    return {
      file_name: fileName,
      download_url: nullableString(
        getField(item, "download_url", "downloadUrl"),
      ),
      storage_url: nullableString(getField(item, "storage_url", "storageUrl")),
      file_type: nullableString(getField(item, "file_type", "fileType")),
      file_size:
        fileSize === undefined || fileSize === null || fileSize === ""
          ? null
          : parseNonnegativeNumber(fileSize, "Kích thước file"),
    };
  });
};

const replaceAttachments = async (requestId, attachments, transaction) => {
  if (attachments === undefined) return;

  await QuotationRequestAttachment.destroy({
    where: {
      request_id: requestId,
    },
    transaction,
  });

  if (!attachments.length) return;

  await QuotationRequestAttachment.bulkCreate(
    attachments.map((file) => ({
      ...file,
      request_id: requestId,
      created_at: new Date(),
    })),
    { transaction },
  );
};

// ============================================================
// HELPERS - PAYLOAD
//
// Chỉ nhận các trường được phép.
// Hỗ trợ snake_case lẫn camelCase.
// ============================================================

const FIELD_ALIASES = {
  notification_code: "notificationCode",
  notification_id: "notificationId",
  notification_type: "notificationType",
  request_name: "requestName",
  package_name: "packageName",
  procuring_entity: "procuringEntity",
  publish_date: "publishDate",
  closing_date: "closingDate",
  location: "location",
  quantity: "quantity",
  unit: "unit",
  package_price: "packagePrice",
  source_type: "sourceType",
  source_url: "sourceUrl",
  extraction_status: "extractionStatus",
  raw_extraction_data: "rawExtractionData",
  notes: "notes",
  quotation_validity: "quotationValidity",
};

const normalizeRequestPayload = (body, isCreate = false) => {
  const payload = {};

  for (const field of REQUEST_FIELDS) {
    const camelCase = FIELD_ALIASES[field];

    const value = getField(body, field, camelCase);

    if (value !== undefined) {
      payload[field] = value;
    }
  }

  if (isCreate && payload.request_name === undefined) {
    throw createError(
      "Vui lòng nhập tên yêu cầu báo giá.",
      400,
      "REQUEST_NAME_REQUIRED",
    );
  }

  if (hasOwn(payload, "request_name")) {
    payload.request_name = stringValue(payload.request_name);

    if (!payload.request_name) {
      throw createError(
        "Tên yêu cầu báo giá không được để trống.",
        400,
        "REQUEST_NAME_REQUIRED",
      );
    }
  }

  const nullableFields = [
    "notification_code",
    "notification_id",
    "notification_type",
    "package_name",
    "procuring_entity",
    "location",
    "unit",
    "source_url",
    "extraction_status",
    "notes",
    "quotation_validity",
  ];

  for (const field of nullableFields) {
    if (hasOwn(payload, field)) {
      payload[field] = nullableString(payload[field]);
    }
  }

  if (hasOwn(payload, "notification_code")) {
    payload.notification_code =
      payload.notification_code?.toUpperCase() || null;
  }

  if (hasOwn(payload, "publish_date")) {
    payload.publish_date = parseDateValue(
      payload.publish_date,
      "Ngày đăng tải",
    );
  }

  if (hasOwn(payload, "closing_date")) {
    payload.closing_date = parseDateValue(
      payload.closing_date,
      "Hạn nhận báo giá",
      true,
    );
  }

  if (hasOwn(payload, "quantity")) {
    payload.quantity = parseNonnegativeNumber(payload.quantity, "Khối lượng");
  }

  if (hasOwn(payload, "package_price")) {
    payload.package_price = parseNonnegativeNumber(
      payload.package_price,
      "Giá gói thầu",
    );
  }

  if (hasOwn(payload, "source_type")) {
    payload.source_type = normalizeSource(payload.source_type);
  } else if (isCreate) {
    const url = String(payload.source_url || "");

    payload.source_type = url.includes("muasamcong.mof.gov.vn")
      ? "PROCUREMENT"
      : "MANUAL";
  }

  if (hasOwn(payload, "raw_extraction_data")) {
    const raw = payload.raw_extraction_data;

    if (raw !== null && (typeof raw !== "object" || Array.isArray(raw))) {
      throw createError(
        "raw_extraction_data phải là JSON object.",
        400,
        "INVALID_RAW_DATA",
      );
    }
  }

  return payload;
};

// ============================================================
// HELPERS - LOG
// ============================================================

const createLog = async (
  {
    request_id,
    action,
    performed_by,
    reason = null,
    old_status = null,
    new_status = null,
    old_team_id = null,
    new_team_id = null,
    old_data = null,
    new_data = null,
  },
  transaction,
) => {
  return QuotationRequestLog.create(
    {
      request_id,
      action,
      performed_by,
      reason,
      old_status,
      new_status,
      old_team_id,
      new_team_id,
      old_data,
      new_data,
      created_at: new Date(),
    },
    { transaction },
  );
};

// ============================================================
// HELPERS - REQUEST LOOKUP
// ============================================================

const findActiveRequest = async (
  requestId,
  transaction = null,
  lock = false,
) => {
  return QuotationRequest.findOne({
    where: {
      request_id: requestId,
      deleted_at: null,
    },
    transaction,
    ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
};

const getRequestIncludes = () => [
  {
    model: QuotationTeam,
    as: "team",
    required: false,
    attributes: ["team_id", "team_code", "team_name", "status"],
  },
  {
    model: QuotationRequestAttachment,
    as: "attachments",
    required: false,
  },
];

const loadRequestDetail = async (requestId) => {
  return QuotationRequest.findOne({
    where: {
      request_id: requestId,
      deleted_at: null,
    },
    include: getRequestIncludes(),
  });
};

// ============================================================
// HELPERS - PAGINATION / FILTERS
// ============================================================

const parsePagination = (query) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);

  if (!Number.isSafeInteger(page) || page < 1) {
    throw createError("page không hợp lệ.", 400, "INVALID_PAGE");
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw createError(
      `limit phải nằm trong khoảng 1–${MAX_PAGE_SIZE}.`,
      400,
      "INVALID_LIMIT",
    );
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

const buildFilters = (query) => {
  const where = {
    deleted_at: null,
  };

  if (query.status) {
    where.status = normalizeStatus(query.status);
  }

  if (query.team_id !== undefined && query.team_id !== "") {
    where.team_id = requireId(query.team_id, "team_id");
  }

  if (query.source_type) {
    where.source_type = normalizeSource(query.source_type);
  }

  const search = stringValue(query.search).slice(0, 200);

  if (search) {
    where[Op.or] = [
      {
        notification_code: {
          [Op.iLike]: `%${search}%`,
        },
      },
      {
        request_name: {
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
      {
        location: {
          [Op.iLike]: `%${search}%`,
        },
      },
    ];
  }

  return where;
};

const listRequests = async (where, pagination) => {
  const result = await QuotationRequest.findAndCountAll({
    where,
    include: [
      {
        model: QuotationTeam,
        as: "team",
        required: false,
        attributes: ["team_id", "team_code", "team_name"],
      },
    ],
    order: [
      ["created_at", "DESC"],
      ["request_id", "DESC"],
    ],
    limit: pagination.limit,
    offset: pagination.offset,
    distinct: true,
  });

  return {
    rows: result.rows,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: result.count,
      total_pages: Math.ceil(result.count / pagination.limit),
    },
  };
};

// ============================================================
// 1. CREATE REQUEST
//
// POST /api/quotationRequest
//
// created_by: ID người đăng nhập
// team_id: Nhóm tiếp nhận (có thể null)
// attachments: Danh sách file
// ============================================================

exports.createRequest = async (req, res) => {
  try {
    const payload = normalizeRequestPayload(req.body, true);

    const actorId = requireId(req.body.created_by, "created_by");

    const teamId =
      req.body.team_id === null ||
      req.body.team_id === undefined ||
      req.body.team_id === ""
        ? null
        : requireId(req.body.team_id, "team_id");

    const attachments = normalizeAttachments(req.body.attachments) || [];

    const result = await sequelize.transaction(async (transaction) => {
      await ensureUser(actorId, "created_by", transaction);

      if (teamId) {
        await ensureTeam(teamId, transaction);
      }

      const now = new Date();

      const created = await QuotationRequest.create(
        {
          ...payload,
          team_id: teamId,
          // Yêu cầu mới luôn ở trạng thái Đã tiếp nhận.
          status: "RECEIVED",
          created_by: actorId,
          updated_by: actorId,
          assigned_by: teamId ? actorId : null,
          assigned_at: teamId ? now : null,
          created_at: now,
          updated_at: now,
        },
        { transaction },
      );

      await replaceAttachments(created.request_id, attachments, transaction);

      await createLog(
        {
          request_id: created.request_id,
          action: "CREATE",
          new_status: created.status,
          new_team_id: teamId,
          performed_by: actorId,
          new_data: created.toJSON(),
        },
        transaction,
      );

      return created;
    });

    const detail = await loadRequestDetail(result.request_id);

    return success(res, "Thêm yêu cầu báo giá thành công.", detail, 201);
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 2. GET ALL REQUESTS
//
// GET /api/quotationRequest
//
// Query:
// page, limit, search, status, team_id, source_type
// ============================================================

exports.getRequests = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const where = buildFilters(req.query);

    const result = await listRequests(where, pagination);

    return success(
      res,
      "Lấy danh sách yêu cầu báo giá thành công.",
      result.rows,
      200,
      {
        pagination: result.pagination,
      },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 3. GET DETAIL
//
// GET /api/quotationRequest/:id
// ============================================================

exports.getRequestDetail = async (req, res) => {
  try {
    const requestId = requireId(req.params.id, "request_id");

    const request = await loadRequestDetail(requestId);

    if (!request) {
      return failure(
        res,
        404,
        "Không tìm thấy yêu cầu báo giá.",
        "REQUEST_NOT_FOUND",
      );
    }

    return success(res, "Lấy chi tiết yêu cầu báo giá thành công.", request);
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 4. UPDATE REQUEST
//
// PUT /api/quotationRequest/:id
//
// updated_by: ID người thực hiện
//
// Không đổi team_id và status ở API này.
// Dùng /assign và /status riêng.
// ============================================================

exports.updateRequest = async (req, res) => {
  try {
    const requestId = requireId(req.params.id, "request_id");

    const actorId = requireId(req.body.updated_by, "updated_by");

    const payload = normalizeRequestPayload(req.body, false);

    const attachments = normalizeAttachments(req.body.attachments);

    await sequelize.transaction(async (transaction) => {
      await ensureUser(actorId, "updated_by", transaction);

      const request = await findActiveRequest(requestId, transaction, true);

      if (!request) {
        throw createError(
          "Không tìm thấy yêu cầu báo giá.",
          404,
          "REQUEST_NOT_FOUND",
        );
      }

      // Chặn việc thay đổi nhóm bằng API cập nhật thường.
      if (hasOwn(req.body, "team_id") || hasOwn(req.body, "teamId")) {
        const incoming = getField(req.body, "team_id", "teamId");

        if (String(incoming ?? "") !== String(request.team_id ?? "")) {
          throw createError(
            "Vui lòng sử dụng API /assign để chuyển nhóm.",
            400,
            "USE_ASSIGN_API",
          );
        }
      }

      // Chặn thay đổi trạng thái bằng API cập nhật thường.
      if (hasOwn(req.body, "status") && req.body.status !== request.status) {
        throw createError(
          "Vui lòng sử dụng API /status để thay đổi trạng thái.",
          400,
          "USE_STATUS_API",
        );
      }

      const oldData = request.toJSON();

      await request.update(
        {
          ...payload,
          updated_by: actorId,
          updated_at: new Date(),
        },
        { transaction },
      );

      await replaceAttachments(requestId, attachments, transaction);

      await createLog(
        {
          request_id: requestId,
          action: "UPDATE",
          performed_by: actorId,
          old_data: oldData,
          new_data: request.toJSON(),
        },
        transaction,
      );
    });

    const detail = await loadRequestDetail(requestId);

    return success(res, "Cập nhật yêu cầu báo giá thành công.", detail);
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 5. ASSIGN / TRANSFER TEAM
//
// PUT /api/quotationRequest/:id/assign
//
// Body:
// {
//   team_id: 1,
//   performed_by: 1001,
//   reason: "Phân công xử lý"
// }
// ============================================================

exports.assignRequest = async (req, res) => {
  try {
    const requestId = requireId(req.params.id, "request_id");

    const actorId = requireId(req.body.performed_by, "performed_by");

    if (!hasOwn(req.body, "team_id")) {
      throw createError("Vui lòng truyền team_id.", 400, "TEAM_ID_REQUIRED");
    }

    const rawTeamId = req.body.team_id;

    // null, "", 0: xóa nhóm phụ trách.
    const isUnassigned =
      rawTeamId === null ||
      rawTeamId === "" ||
      rawTeamId === 0 ||
      rawTeamId === "0";

    const teamId = isUnassigned ? null : requireId(rawTeamId, "team_id");

    const reason = nullableString(req.body.reason);

    await sequelize.transaction(async (transaction) => {
      await ensureUser(actorId, "performed_by", transaction);

      const request = await findActiveRequest(requestId, transaction, true);

      if (!request) {
        throw createError(
          "Không tìm thấy yêu cầu báo giá.",
          404,
          "REQUEST_NOT_FOUND",
        );
      }

      // Kiểm tra nhóm kinh doanh còn hoạt động.
      if (teamId !== null) {
        await ensureTeam(teamId, transaction);
      }

      const oldTeamId = request.team_id;
      const oldStatus = request.status;

      // Không thay đổi nếu vẫn là nhóm hiện tại.
      if (String(oldTeamId ?? "") === String(teamId ?? "")) {
        throw createError(
          teamId === null
            ? "Yêu cầu báo giá hiện chưa được phân công."
            : "Yêu cầu báo giá đã thuộc nhóm này.",
          409,
          "SAME_TEAM",
        );
      }

      // ==============================================
      // XÁC ĐỊNH HÀNH ĐỘNG
      // ==============================================

      let action = "ASSIGN";

      if (teamId === null) {
        action = "UNASSIGN";
      } else if (oldTeamId !== null) {
        action = "TRANSFER";
      }

      // ==============================================
      // TỰ ĐỘNG ĐỔI TRẠNG THÁI THEO NHÓM
      // ==============================================
      //
      // Có nhóm    -> PROCESSING
      // Không nhóm -> RECEIVED
      //
      // Áp dụng cả khi chuyển từ nhóm A sang nhóm B.
      // ==============================================

      const newStatus = teamId === null ? "RECEIVED" : "PROCESSING";

      const oldData = request.toJSON();
      const now = new Date();

      await request.update(
        {
          team_id: teamId,
          status: newStatus,

          assigned_by: teamId === null ? null : actorId,

          assigned_at: teamId === null ? null : now,

          updated_by: actorId,
          updated_at: now,
        },
        { transaction },
      );

      // ==============================================
      // GHI LỊCH SỬ
      // Ghi cả thay đổi nhóm và trạng thái.
      // ==============================================

      await createLog(
        {
          request_id: requestId,
          action,

          old_team_id: oldTeamId,
          new_team_id: teamId,

          old_status: oldStatus,
          new_status: newStatus,

          reason,

          old_data: oldData,
          new_data: request.toJSON(),

          performed_by: actorId,
        },
        transaction,
      );
    });

    const detail = await loadRequestDetail(requestId);

    return success(
      res,
      teamId === null
        ? "Đã xóa nhóm phụ trách và chuyển về trạng thái Đã tiếp nhận."
        : "Đã phân công nhóm và chuyển sang trạng thái Đang thực hiện.",
      detail,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 6. UPDATE STATUS
//
// PUT /api/quotationRequest/:id/status
//
// Body:
// {
//   status: "PROCESSING",
//   performed_by: 1001,
//   reason: "Đang lập báo giá"
// }
// ============================================================

exports.updateRequestStatus = async (req, res) => {
  try {
    const requestId = requireId(req.params.id, "request_id");

    const actorId = requireId(req.body.performed_by, "performed_by");

    const newStatus = normalizeStatus(req.body.status);

    if (["RECEIVED", "PROCESSING"].includes(newStatus)) {
      throw createError(
        "Trạng thái Đã tiếp nhận và Đang thực hiện được cập nhật tự động theo nhóm phụ trách.",
        400,
        "AUTO_STATUS_ONLY",
      );
    }
    await sequelize.transaction(async (transaction) => {
      await ensureUser(actorId, "performed_by", transaction);

      const request = await findActiveRequest(requestId, transaction, true);

      if (request.team_id === null) {
        throw createError(
          "Yêu cầu chưa được phân công nhóm kinh doanh.",
          409,
          "TEAM_REQUIRED",
        );
      }
      if (!request) {
        throw createError(
          "Không tìm thấy yêu cầu báo giá.",
          404,
          "REQUEST_NOT_FOUND",
        );
      }

      const oldStatus = request.status;

      if (oldStatus === newStatus) {
        throw createError(
          "Yêu cầu báo giá đã ở trạng thái này.",
          409,
          "SAME_STATUS",
        );
      }

      await request.update(
        {
          status: newStatus,
          updated_by: actorId,
          updated_at: new Date(),
        },
        { transaction },
      );

      await createLog(
        {
          request_id: requestId,
          action: "STATUS_CHANGE",
          old_status: oldStatus,
          new_status: newStatus,
          reason: nullableString(req.body.reason),
          performed_by: actorId,
        },
        transaction,
      );
    });

    const detail = await loadRequestDetail(requestId);

    return success(
      res,
      "Cập nhật trạng thái yêu cầu báo giá thành công.",
      detail,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 7. DELETE REQUEST - SOFT DELETE
//
// DELETE /api/quotationRequest/:id
//
// Body:
// {
//   performed_by: 1001,
//   reason: "Yêu cầu không còn phù hợp"
// }
// ============================================================

exports.deleteRequest = async (req, res) => {
  try {
    const requestId = requireId(req.params.id, "request_id");

    const actorId = requireId(req.body?.performed_by, "performed_by");

    await sequelize.transaction(async (transaction) => {
      await ensureUser(actorId, "performed_by", transaction);

      const request = await findActiveRequest(requestId, transaction, true);

      if (!request) {
        throw createError(
          "Không tìm thấy yêu cầu báo giá.",
          404,
          "REQUEST_NOT_FOUND",
        );
      }

      const oldData = request.toJSON();
      const now = new Date();

      await request.update(
        {
          deleted_at: now,
          deleted_by: actorId,
          updated_by: actorId,
          updated_at: now,
        },
        { transaction },
      );

      await createLog(
        {
          request_id: requestId,
          action: "DELETE",
          reason: nullableString(req.body.reason),
          old_data: oldData,
          performed_by: actorId,
        },
        transaction,
      );
    });

    return success(res, "Đã xóa yêu cầu báo giá.", {
      request_id: requestId,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 8. GET REQUEST HISTORY
//
// GET /api/quotationRequest/:id/history
// ============================================================

exports.getRequestHistory = async (req, res) => {
  try {
    const requestId = requireId(req.params.id, "request_id");

    const request = await findActiveRequest(requestId);

    if (!request) {
      return failure(
        res,
        404,
        "Không tìm thấy yêu cầu báo giá.",
        "REQUEST_NOT_FOUND",
      );
    }

    const { page, limit, offset } = parsePagination(req.query);

    const result = await QuotationRequestLog.findAndCountAll({
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

    return success(
      res,
      "Lấy lịch sử yêu cầu báo giá thành công.",
      result.rows,
      200,
      {
        pagination: {
          page,
          limit,
          total: result.count,
          total_pages: Math.ceil(result.count / limit),
        },
      },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 9. GET MY TEAM REQUESTS
//
// GET /api/quotationRequest/my-list?user_id=1001
//
// Quy tắc:
// - Tìm nhóm hiện tại của nhân viên từ
//   QuotationTeamMember.
// - Chỉ lấy yêu cầu đang phân công cho nhóm đó.
//
// V1 chưa xử lý quyền Admin xem mọi nhóm.
// ============================================================

exports.getMyRequests = async (req, res) => {
  try {
    const userId = requireId(req.query.user_id, "user_id");

    await ensureUser(userId, "user_id");

    const member = await QuotationTeamMember.findOne({
      where: {
        user_id: userId,
      },
    });

    if (!member) {
      return success(
        res,
        "Nhân viên chưa được phân vào nhóm kinh doanh.",
        [],
        200,
        {
          team: null,
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            total_pages: 0,
          },
        },
      );
    }

    const team = await QuotationTeam.findByPk(member.team_id);

    if (!team) {
      return failure(
        res,
        404,
        "Không tìm thấy nhóm kinh doanh của nhân viên.",
        "TEAM_NOT_FOUND",
      );
    }

    const pagination = parsePagination(req.query);

    const where = buildFilters({
      ...req.query,
      team_id: member.team_id,
    });

    const result = await listRequests(where, pagination);

    return success(
      res,
      "Lấy yêu cầu báo giá của nhóm thành công.",
      result.rows,
      200,
      {
        team: {
          team_id: team.team_id,
          team_code: team.team_code,
          team_name: team.team_name,
        },
        pagination: result.pagination,
      },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

// ============================================================
// 10. GET STATISTICS
//
// GET /api/quotationRequest/stats
//
// Query optional:
// team_id
// ============================================================

exports.getRequestStats = async (req, res) => {
  try {
    const where = {
      deleted_at: null,
    };

    if (req.query.team_id !== undefined && req.query.team_id !== "") {
      where.team_id = requireId(req.query.team_id, "team_id");
    }

    const now = new Date();

    const [total, received, processing, contacted, completed, overdue] =
      await Promise.all([
        QuotationRequest.count({ where }),

        QuotationRequest.count({
          where: {
            ...where,
            status: "RECEIVED",
          },
        }),

        QuotationRequest.count({
          where: {
            ...where,
            status: "PROCESSING",
          },
        }),

        QuotationRequest.count({
          where: {
            ...where,
            status: "CONTACTED",
          },
        }),

        QuotationRequest.count({
          where: {
            ...where,
            status: "COMPLETED",
          },
        }),

        QuotationRequest.count({
          where: {
            ...where,
            status: {
              [Op.ne]: "COMPLETED",
            },
            closing_date: {
              [Op.lt]: now,
            },
          },
        }),
      ]);

    return success(res, "Lấy thống kê yêu cầu báo giá thành công.", {
      total,
      received,
      processing,
      contacted,
      completed,
      overdue,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
