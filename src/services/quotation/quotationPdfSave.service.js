const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { Op } = require("sequelize");

const sequelize = require("../../config/database");
const models = require("../../models");

const {
  QuotationRequest,
  QuotationRequestItem,
  QuotationRequestAttachment,
  QuotationRequestLog,
  QuotationTeamMember,
} = models;

const { extractProcurementPdf } = require("./quotationPdf.service");

// ==========================================================
// CONFIG
// ==========================================================

const STORAGE_ROOT = path.resolve(
  process.env.QUOTATION_PDF_STORAGE_DIR ||
    path.join(process.cwd(), "private_uploads", "quotation"),
);

// ==========================================================
// HELPERS
// ==========================================================

const errorWithStatus = (message, status = 400, code = "INVALID_DATA") => {
  const error = new Error(message);
  error.statusCode = status;
  error.code = code;
  return error;
};

const str = (value, max = 10000) => {
  if (value === null || value === undefined) {
    return null;
  }

  const result = String(value).trim();
  return result ? result.slice(0, max) : null;
};

const dateOnly = (value, field) => {
  if (!value) return null;

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw errorWithStatus(`${field} phải có định dạng YYYY-MM-DD.`);
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw errorWithStatus(`${field} không hợp lệ.`);
  }

  return value;
};

const dateTime = (value, field) => {
  if (!value) return null;

  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw errorWithStatus(`${field} phải có timezone, ví dụ +07:00.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw errorWithStatus(`${field} không hợp lệ.`);
  }

  return date;
};

const decimal = (value, field) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw errorWithStatus(`${field} phải là số không âm.`);
  }

  return number;
};

function parsePayload(input) {
  let payload;

  try {
    payload = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    throw errorWithStatus("Trường data không phải JSON hợp lệ.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw errorWithStatus("Dữ liệu yêu cầu báo giá không hợp lệ.");
  }

  const data =
    payload.data && typeof payload.data === "object" ? payload.data : payload;

  if (Array.isArray(data)) {
    throw errorWithStatus("Dữ liệu yêu cầu báo giá không hợp lệ.");
  }

  return data;
}

// ==========================================================
// ITEMS
// ==========================================================

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    throw errorWithStatus("Danh mục dịch vụ phải là một mảng.");
  }

  if (items.length > 500) {
    throw errorWithStatus("Tối đa 500 hạng mục dịch vụ.");
  }

  return items.map((item, index) => {
    const itemNo = index + 1;

    if (!item || typeof item !== "object") {
      throw errorWithStatus(`Hạng mục ${itemNo} không hợp lệ.`);
    }

    const name = str(item.item_name || item.itemName, 50000);

    if (!name) {
      throw errorWithStatus(`Hạng mục ${itemNo} chưa có tên dịch vụ.`);
    }

    const from = item.source_page_from ?? null;
    const to = item.source_page_to ?? null;

    const validPage = (value) =>
      value === null || (Number.isInteger(Number(value)) && Number(value) > 0);

    if (!validPage(from) || !validPage(to)) {
      throw errorWithStatus(`Hạng mục ${itemNo} có số trang không hợp lệ.`);
    }

    if (from !== null && to !== null && Number(to) < Number(from)) {
      throw errorWithStatus(
        `Hạng mục ${itemNo}: trang kết thúc nhỏ hơn trang bắt đầu.`,
      );
    }

    return {
      item_no: itemNo,
      item_name: name,
      description: str(item.description, 100000),
      location: str(item.location, 10000),

      quantity: decimal(item.quantity, `Số lượng hạng mục ${itemNo}`),

      unit: str(item.unit, 100),

      source_page_from: from === null ? null : Number(from),

      source_page_to: to === null ? null : Number(to),

      raw_item_data: item.raw_item_data || null,
    };
  });
}

// ==========================================================
// REQUEST NORMALIZATION
//
// KHÔNG xử lý quyền ở đây.
// Quyền và phân nhóm được xác định riêng.
// ==========================================================

function normalizeRequest(data) {
  const requestName = str(data.request_name || data.package_name, 10000);

  const procuringEntity = str(data.procuring_entity, 10000);

  if (!requestName) {
    throw errorWithStatus("Vui lòng nhập tên yêu cầu báo giá.");
  }

  if (!procuringEntity) {
    throw errorWithStatus("Vui lòng nhập đơn vị yêu cầu báo giá.");
  }

  const notificationCode =
    str(data.notification_code, 100)?.toUpperCase() || null;

  if (notificationCode && !/^RQ\d{6,30}$/.test(notificationCode)) {
    throw errorWithStatus("Mã yêu cầu báo giá không hợp lệ.");
  }

  const receptionStart = dateOnly(
    data.reception_start_date,
    "Ngày bắt đầu tiếp nhận",
  );

  const receptionEnd = dateOnly(
    data.reception_end_date,
    "Ngày kết thúc tiếp nhận",
  );

  if (receptionStart && receptionEnd && receptionEnd < receptionStart) {
    throw errorWithStatus("Ngày kết thúc không được nhỏ hơn ngày bắt đầu.");
  }

  const closingDate = dateTime(data.closing_date, "Thời hạn đóng báo giá");

  const method = str(data.reception_method, 30)?.toUpperCase();

  if (method && !["ONLINE", "OFFLINE", "OTHER"].includes(method)) {
    throw errorWithStatus("Hình thức nhận báo giá không hợp lệ.");
  }

  return {
    notification_code: notificationCode,

    notification_id: str(data.notification_id, 150),

    notification_type: str(data.notification_type, 50) || "es-ycbg",

    request_name: requestName,

    package_name: str(data.package_name, 10000) || requestName,

    procuring_entity: procuringEntity,

    publish_date: dateOnly(data.publish_date, "Ngày đăng tải"),

    closing_date: closingDate,

    contact_name: str(data.contact_name, 255),
    contact_position: str(data.contact_position, 255),
    contact_phone: str(data.contact_phone, 30),
    contact_email: str(data.contact_email, 255),
    contact_address: str(data.contact_address, 10000),

    reception_method: method || null,

    reception_start_date: receptionStart,
    reception_end_date: receptionEnd,

    execution_date: dateOnly(data.execution_date, "Ngày thực hiện"),

    quotation_validity: str(data.quotation_validity, 255),

    location: str(data.location, 10000),

    quantity: decimal(data.quantity, "Số lượng"),

    unit: str(data.unit, 100),

    package_price: decimal(data.package_price, "Giá gói thầu"),

    source_type: "PROCUREMENT",

    source_url: str(data.source_url, 10000),

    extraction_method: "PDF_TEXT",
    extraction_status: "EXTRACTED",

    // Import tự động không có bước kiểm duyệt
    extraction_reviewed_at: null,

    notes: str(data.notes, 20000),
  };
}

// ==========================================================
// ROLE & TEAM RESOLUTION
//
// ADMIN WEB:
//   RECEIVED, team_id = null
//
// ADMIN NHÓM:
//   PROCESSING, team_id = nhóm quản lý
//
// THÀNH VIÊN:
//   403
//
// Không tin team_id từ FE.
// ==========================================================

async function resolveAssignment({ userId, userRole, transaction }) {
  const role = String(userRole || "")
    .trim()
    .toLowerCase();

  // ADMIN WEB
  if (role === "admin") {
    return {
      status: "RECEIVED",
      team_id: null,
      assigned_at: null,
      assigned_by: null,
    };
  }

  // Tài khoản thường phải có quyền ADMIN nhóm.
  if (!QuotationTeamMember) {
    throw errorWithStatus(
      "Backend chưa export model QuotationTeamMember. " +
        "Cần cấu hình model thành viên nhóm trước khi import.",
      500,
      "TEAM_MODEL_NOT_CONFIGURED",
    );
  }

  // Lấy membership theo tài khoản đã xác thực.
  const memberships = await QuotationTeamMember.findAll({
    where: {
      user_id: userId,
    },
    transaction,
  });

  const activeMemberships = memberships.filter((membership) => {
    const row =
      typeof membership.get === "function"
        ? membership.get({ plain: true })
        : membership;

    const membershipRole = String(
      row.role ?? row.member_role ?? row.team_role ?? "",
    )
      .trim()
      .toUpperCase();

    const isAdmin =
      ["ADMIN", "TEAM_ADMIN"].includes(membershipRole) || row.is_admin === true;

    // Hỗ trợ một số cách lưu trạng thái phổ biến.
    // Cần khớp lại với model thực tế.
    const active =
      row.is_active !== false &&
      row.status !== 0 &&
      row.status !== "0" &&
      String(row.status || "").toUpperCase() !== "INACTIVE";

    return isAdmin && active;
  });

  if (!activeMemberships.length) {
    throw errorWithStatus(
      "Bạn không có quyền tạo yêu cầu báo giá.",
      403,
      "FORBIDDEN",
    );
  }

  if (activeMemberships.length > 1) {
    throw errorWithStatus(
      "Tài khoản đang quản lý nhiều nhóm. " +
        "Cần xác định nhóm tạo yêu cầu theo quy tắc phân quyền hiện tại.",
      409,
      "MULTIPLE_ADMIN_TEAMS",
    );
  }

  const membership = activeMemberships[0];

  const teamId = Number(membership.team_id);

  if (!Number.isSafeInteger(teamId) || teamId <= 0) {
    throw errorWithStatus(
      "Không xác định được nhóm quản lý hợp lệ.",
      403,
      "TEAM_NOT_FOUND",
    );
  }

  return {
    status: "PROCESSING",
    team_id: teamId,
    assigned_at: new Date(),
    assigned_by: userId,
  };
}

// ==========================================================
// SAVE PDF
// ==========================================================

async function saveQuotationPdf({ file, rawPayload, userId, userRole }) {
  if (!file?.buffer) {
    throw errorWithStatus("Chưa có file PDF.");
  }

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw errorWithStatus(
      "Không xác định được tài khoản người tạo.",
      401,
      "UNAUTHORIZED",
    );
  }

  const data = parsePayload(rawPayload);
  const normalized = normalizeRequest(data);
  const items = normalizeItems(data.items || []);

  if (!items.length) {
    throw errorWithStatus(
      "Chưa có danh mục dịch vụ. " + "Vui lòng bổ sung trước khi lưu.",
    );
  }

  // Đọc lại PDF để đối chiếu với file gốc.
  const original = await extractProcurementPdf(file.buffer, file.originalname);

  const filenameCode = original.notification_code;

  if (
    filenameCode &&
    normalized.notification_code &&
    filenameCode !== normalized.notification_code
  ) {
    throw errorWithStatus(
      "Mã RQ trong dữ liệu không trùng với " + "mã trên tên file PDF.",
    );
  }

  if (!normalized.notification_code && filenameCode) {
    normalized.notification_code = filenameCode;
  }

  const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

  if (data.file_sha256 && data.file_sha256 !== hash) {
    throw errorWithStatus(
      "File PDF khác với file đã phân tích.",
      409,
      "PDF_CHANGED",
    );
  }

  // ========================================================
  // CHECK DUPLICATE
  // ========================================================

  if (normalized.notification_code) {
    const existed = await QuotationRequest.findOne({
      where: {
        notification_code: {
          [Op.iLike]: normalized.notification_code,
        },

        deleted_at: null,
      },

      attributes: ["request_id", "notification_code"],
    });

    if (existed) {
      throw errorWithStatus(
        `Yêu cầu ${normalized.notification_code} ` +
          `đã tồn tại (ID ${existed.request_id}).`,
        409,
        "DUPLICATE_NOTIFICATION_CODE",
      );
    }
  }

  const fileName = `${crypto.randomUUID()}.pdf`;

  const relativeKey = path.posix.join("source-pdfs", fileName);

  const directory = path.join(STORAGE_ROOT, "source-pdfs");

  const absolutePath = path.join(directory, fileName);

  let fileWritten = false;

  try {
    // ======================================================
    // TRANSACTION: XÁC MINH QUYỀN + LƯU DB
    // ======================================================

    const result = await sequelize.transaction(async (transaction) => {
      const assignment = await resolveAssignment({
        userId,
        userRole,
        transaction,
      });

      // Lưu PDF trên filesystem riêng.
      await fs.mkdir(directory, {
        recursive: true,
        mode: 0o700,
      });

      await fs.writeFile(absolutePath, file.buffer, {
        flag: "wx",
        mode: 0o600,
      });

      fileWritten = true;

      // ==================================================
      // CREATE REQUEST
      // ==================================================

      const request = await QuotationRequest.create(
        {
          ...normalized,

          // Quyền thực tế lấy từ Backend
          status: assignment.status,
          team_id: assignment.team_id,

          assigned_at: assignment.assigned_at,
          assigned_by: assignment.assigned_by,

          created_by: userId,

          raw_extraction_data: {
            ...(data.raw_extraction_data &&
            typeof data.raw_extraction_data === "object" &&
            !Array.isArray(data.raw_extraction_data)
              ? data.raw_extraction_data
              : {}),

            filename: file.originalname,
            page_count: original.page_count,
            file_sha256: hash,

            auto_imported: true,
          },
        },
        { transaction },
      );

      const requestId = request.request_id;

      // ==================================================
      // CREATE ITEMS
      // ==================================================

      await QuotationRequestItem.bulkCreate(
        items.map((item) => ({
          ...item,
          request_id: requestId,
        })),
        {
          transaction,
          validate: true,
        },
      );

      // ==================================================
      // CREATE ATTACHMENT
      // ==================================================

      const attachment = await QuotationRequestAttachment.create(
        {
          request_id: requestId,

          file_name: file.originalname,
          file_type: "application/pdf",
          file_size: file.size,

          document_role: "SOURCE_PDF",

          file_sha256: hash,
          page_count: original.page_count,
          storage_key: relativeKey,

          storage_url: null,
          download_url: null,

          uploaded_by: userId,
        },
        { transaction },
      );

      // ==================================================
      // CREATE LOG
      // ==================================================

      await QuotationRequestLog.create(
        {
          request_id: requestId,

          action: "CREATE",

          old_status: null,
          new_status: assignment.status,

          old_team_id: null,
          new_team_id: assignment.team_id,

          reason:
            assignment.team_id === null
              ? "Admin web import PDF, chưa phân nhóm."
              : "Admin nhóm import PDF, tự phân về nhóm quản lý.",

          new_data: {
            notification_code: normalized.notification_code,

            request_name: normalized.request_name,

            procuring_entity: normalized.procuring_entity,

            extraction_method: "PDF_TEXT",

            item_count: items.length,

            attachment_id: attachment.attachment_id,

            auto_imported: true,
          },

          performed_by: userId,
        },
        { transaction },
      );

      return {
        request_id: requestId,

        notification_code: normalized.notification_code,

        request_name: normalized.request_name,

        status: assignment.status,

        team_id: assignment.team_id,

        assigned_at: assignment.assigned_at,
        assigned_by: assignment.assigned_by,

        item_count: items.length,

        attachment_id: attachment.attachment_id,
      };
    });

    return result;
  } catch (error) {
    if (fileWritten) {
      try {
        await fs.unlink(absolutePath);
      } catch (cleanupError) {
        console.error("[QUOTATION_PDF_CLEANUP]", cleanupError.message);
      }
    }

    if (error.parent?.code === "23505" || error.original?.code === "23505") {
      throw errorWithStatus(
        "Yêu cầu báo giá đã tồn tại.",
        409,
        "DUPLICATE_REQUEST",
      );
    }

    throw error;
  }
}

module.exports = {
  saveQuotationPdf,
};
