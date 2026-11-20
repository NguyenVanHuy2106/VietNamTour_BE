const {
  QuotationRequest,
  QuotationRequestItem,
  QuotationRequestAttachment,
  QuotationTeam,
  QuotationTeamMember,
} = require("../../models");

// ==========================================================
// VIET NAM TOUR ERP
// QUOTATION REQUEST - FULL DETAIL API
//
// GET /api/quotationRequest/detail/:requestId
//
// ADMIN WEB:
//   Xem toàn bộ yêu cầu báo giá.
//
// ADMIN NHÓM / THÀNH VIÊN:
//   Chỉ xem yêu cầu thuộc nhóm mình.
//
// RESPONSE:
//   data: {
//     ...quotationRequest,
//     team: {...} | null,
//     items: [],
//     attachments: []
//   }
// ==========================================================

const toPlain = (instance) => {
  if (!instance) return null;

  return typeof instance.get === "function"
    ? instance.get({ plain: true })
    : instance;
};

const getUserId = (req) => {
  const value = req.user?.user_id ?? req.user?.userId ?? req.user?.id;

  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const isWebAdminUser = (req) => {
  // Role phải được verifyToken xác thực,
  // không lấy từ body, query hoặc localStorage.
  const role = String(req.user?.role || "")
    .trim()
    .toLowerCase();

  return role === "admin";
};

const isActiveMembership = (row) => {
  if (!row) return false;

  // Kiểm tra theo các kiểu trạng thái phổ biến.
  // Nếu model thực tế dùng trạng thái khác,
  // cần sửa cho đúng với schema.
  if (row.is_active === false) return false;

  if (row.status !== undefined && row.status !== null) {
    const status = String(row.status).trim().toUpperCase();

    if (["0", "INACTIVE", "DISABLED", "REMOVED"].includes(status)) {
      return false;
    }
  }

  return true;
};

// ==========================================================
// CHECK GROUP ACCESS
// ==========================================================

async function checkTeamAccess(userId, teamId) {
  if (!QuotationTeamMember) {
    const error = new Error("Chưa cấu hình model QuotationTeamMember.");
    error.statusCode = 500;
    throw error;
  }

  const member = await QuotationTeamMember.findOne({
    where: {
      user_id: userId,
      team_id: teamId,
    },
  });

  if (!member) return false;

  return isActiveMembership(toPlain(member));
}

// ==========================================================
// FETCH TEAM (OPTIONAL)
// ==========================================================

async function getTeamInfo(teamId) {
  if (!teamId || !QuotationTeam) {
    return null;
  }

  const team = await QuotationTeam.findOne({
    where: {
      team_id: teamId,
    },
  });

  if (!team) return null;

  const data = toPlain(team);

  return {
    team_id: data.team_id,
    team_name: data.team_name,
  };
}

// ==========================================================
// GET FULL DETAIL
// ==========================================================

exports.getFullDetail = async (req, res) => {
  try {
    // ------------------------------------------------------
    // 1. VALIDATE ID
    // ------------------------------------------------------

    const requestId = Number(req.params.requestId);

    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_REQUEST_ID",
        message: "ID yêu cầu báo giá không hợp lệ.",
      });
    }

    // ------------------------------------------------------
    // 2. AUTHENTICATION
    // ------------------------------------------------------

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Không xác định được người dùng đăng nhập.",
      });
    }

    const isWebAdmin = isWebAdminUser(req);

    // ------------------------------------------------------
    // 3. GET REQUEST
    // ------------------------------------------------------

    const request = await QuotationRequest.findOne({
      where: {
        request_id: requestId,
        deleted_at: null,
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        code: "REQUEST_NOT_FOUND",
        message: "Không tìm thấy yêu cầu báo giá.",
      });
    }

    const requestData = toPlain(request);

    // ------------------------------------------------------
    // 4. CHECK PERMISSION
    //
    // Admin web: xem tất cả
    // Người dùng nhóm: yêu cầu phải thuộc nhóm mình.
    // ------------------------------------------------------

    if (!isWebAdmin) {
      if (!requestData.team_id) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN",
          message: "Yêu cầu báo giá này chưa được phân cho nhóm của bạn.",
        });
      }

      const hasAccess = await checkTeamAccess(userId, requestData.team_id);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN",
          message: "Bạn không có quyền xem yêu cầu báo giá này.",
        });
      }
    }

    // ------------------------------------------------------
    // 5. GET ITEMS + ATTACHMENTS + TEAM
    //
    // Lấy đồng thời sau khi kiểm tra quyền.
    // ------------------------------------------------------

    const [items, attachments, team] = await Promise.all([
      QuotationRequestItem.findAll({
        where: {
          request_id: requestId,
        },

        order: [
          ["item_no", "ASC"],
          ["item_id", "ASC"],
        ],
      }),

      QuotationRequestAttachment.findAll({
        where: {
          request_id: requestId,
        },

        order: [["created_at", "DESC"]],
      }),

      getTeamInfo(requestData.team_id),
    ]);

    // ------------------------------------------------------
    // 6. NORMALIZE ITEMS
    // ------------------------------------------------------

    const itemData = items.map((item) => {
      const row = toPlain(item);

      return {
        item_id: row.item_id,
        request_id: row.request_id,
        item_no: row.item_no,
        item_name: row.item_name,
        description: row.description,
        location: row.location,
        quantity: row.quantity,
        unit: row.unit,
        source_page_from: row.source_page_from,
        source_page_to: row.source_page_to,
      };
    });

    // ------------------------------------------------------
    // 7. NORMALIZE ATTACHMENTS
    //
    // Không trả storage_key nội bộ ra Frontend.
    // ------------------------------------------------------

    const attachmentData = attachments.map((item) => {
      const row = toPlain(item);

      return {
        attachment_id: row.attachment_id,
        request_id: row.request_id,
        file_name: row.file_name,
        file_type: row.file_type,
        file_size: row.file_size,
        document_role: row.document_role,
        page_count: row.page_count,

        // Chỉ dùng URL nếu đã có cơ chế
        // cấp quyền xem/tải tài liệu phù hợp.
        download_url: row.download_url || null,

        created_at: row.created_at,
      };
    });

    // ------------------------------------------------------
    // 8. RETURN RESPONSE
    // ------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Lấy chi tiết yêu cầu báo giá thành công.",

      data: {
        ...requestData,

        // Không đưa dữ liệu trích xuất thô
        // ra trang chi tiết nếu không cần.
        raw_extraction_data: undefined,

        team,

        items: itemData,

        attachments: attachmentData,
      },

      meta: {
        item_count: itemData.length,
        attachment_count: attachmentData.length,
      },
    });
  } catch (error) {
    console.error("[QUOTATION_REQUEST_FULL_DETAIL]", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      success: false,
      code: error.code || "GET_QUOTATION_DETAIL_FAILED",

      message:
        status >= 500
          ? "Không thể lấy chi tiết yêu cầu báo giá."
          : error.message,
    });
  }
};
