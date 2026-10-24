const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../../config/database");

const {
  UserLeaveConfig,
  LeaveAccrual,
  LeaveRequest,
} = require("../../models/leave");

const getCurrentUserId = (req) => {
  return req.user?.user_id || req.user?.id || null;
};

/**
 * Công ty làm từ Thứ 2 -> Thứ 6
 *
 * Version hiện tại chưa loại ngày lễ.
 * Phần ngày lễ mình nối sau.
 */
const countWorkingDays = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);

  const end = new Date(`${endDate}T00:00:00`);

  if (start > end) {
    return 0;
  }

  let total = 0;

  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();

    if (day !== 0 && day !== 6) {
      total++;
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
};

/**
 * Tính số dư phép
 */
const getLeaveBalance = async (userId, year, transaction = null) => {
  const accruedDays =
    Number(
      await LeaveAccrual.sum("accrual_days", {
        where: {
          user_id: userId,
          accrual_year: year,
        },

        transaction,
      }),
    ) || 0;

  const approvedDays =
    Number(
      await LeaveRequest.sum("total_days", {
        where: {
          user_id: userId,

          status: "APPROVED",

          start_date: {
            [Op.gte]: `${year}-01-01`,

            [Op.lte]: `${year}-12-31`,
          },
        },

        transaction,
      }),
    ) || 0;

  const pendingDays =
    Number(
      await LeaveRequest.sum("total_days", {
        where: {
          user_id: userId,

          status: "PENDING",

          start_date: {
            [Op.gte]: `${year}-01-01`,

            [Op.lte]: `${year}-12-31`,
          },
        },

        transaction,
      }),
    ) || 0;

  return {
    accrued_days: accruedDays,

    used_days: approvedDays,

    pending_days: pendingDays,

    remaining_days: accruedDays - approvedDays,

    requestable_days: accruedDays - approvedDays - pendingDays,
  };
};

// =====================================================
// NHÂN VIÊN - QUỸ PHÉP CỦA TÔI
// =====================================================

exports.getMyLeaveBalance = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    const year = Number(req.query.year) || new Date().getFullYear();

    const balance = await getLeaveBalance(userId, year);

    return res.json({
      success: true,

      data: {
        user_id: userId,

        year,

        ...balance,
      },
    });
  } catch (error) {
    console.error("getMyLeaveBalance error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy quỹ phép.",
    });
  }
};

// =====================================================
// NHÂN VIÊN - DANH SÁCH PHIẾU
// =====================================================

exports.getMyLeaveRequests = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    const data = await sequelize.query(
      `
      SELECT
        lr.*,

        approver.name AS approver_name,
        approver.position AS approver_position

      FROM vntour.leave_requests lr

      LEFT JOIN mdm.users approver
        ON approver.user_id = lr.approver_user_id

      WHERE
        lr.user_id = :userId

      ORDER BY
        lr.created_at DESC,
        lr.leave_request_id DESC
      `,
      {
        replacements: {
          userId,
        },

        type: QueryTypes.SELECT,
      },
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getMyLeaveRequests error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách nghỉ phép.",
    });
  }
};

// =====================================================
// NHÂN VIÊN - TẠO PHIẾU
// =====================================================

// exports.createLeaveRequest = async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const userId = getCurrentUserId(req);

//     const { start_date, end_date, reason } = req.body;

//     if (!start_date || !end_date) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,
//         message: "Vui lòng chọn thời gian nghỉ phép.",
//       });
//     }

//     const start = new Date(start_date);

//     const end = new Date(end_date);

//     if (start > end) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,
//         message: "Ngày kết thúc không hợp lệ.",
//       });
//     }

//     const startYear = start.getFullYear();

//     const endYear = end.getFullYear();

//     if (startYear !== endYear) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,
//         message: "Phiếu nghỉ không được kéo dài qua hai năm.",
//       });
//     }

//     // =============================================
//     // Check nhân viên chính thức
//     // =============================================

//     const config = await UserLeaveConfig.findOne({
//       where: {
//         user_id: userId,

//         is_leave_eligible: true,
//       },

//       transaction,
//     });

//     if (!config) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,
//         message: "Bạn chưa thuộc đối tượng được hưởng phép năm.",
//       });
//     }

//     // =============================================
//     // Backend tự tính ngày nghỉ
//     // =============================================

//     const totalDays = countWorkingDays(start_date, end_date);

//     if (totalDays <= 0) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,
//         message: "Khoảng thời gian đăng ký không có ngày làm việc.",
//       });
//     }

//     // =============================================
//     // Check phiếu trùng
//     // =============================================

//     const overlap = await LeaveRequest.findOne({
//       where: {
//         user_id: userId,

//         status: {
//           [Op.in]: ["PENDING", "APPROVED"],
//         },

//         start_date: {
//           [Op.lte]: end_date,
//         },

//         end_date: {
//           [Op.gte]: start_date,
//         },
//       },

//       transaction,
//     });

//     if (overlap) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,
//         message: "Khoảng thời gian này đã có phiếu nghỉ khác.",
//       });
//     }

//     // =============================================
//     // Check quỹ phép
//     // =============================================

//     const balance = await getLeaveBalance(userId, startYear, transaction);

//     if (totalDays > balance.requestable_days) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,

//         message: `Bạn chỉ còn ${balance.requestable_days} ngày phép có thể đăng ký.`,

//         data: balance,
//       });
//     }

//     // =============================================
//     // Tạo phiếu
//     // =============================================

//     const request = await LeaveRequest.create(
//       {
//         user_id: userId,

//         start_date,

//         end_date,

//         total_days: totalDays,

//         reason: reason?.trim() || null,

//         status: "PENDING",
//       },

//       {
//         transaction,
//       },
//     );

//     await transaction.commit();

//     return res.status(201).json({
//       success: true,

//       message: "Đã gửi phiếu đăng ký nghỉ phép.",

//       data: request,
//     });
//   } catch (error) {
//     await transaction.rollback();

//     console.error("createLeaveRequest error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Không thể tạo phiếu nghỉ phép.",
//     });
//   }
// };

exports.createLeaveRequest = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = getCurrentUserId(req);

    const { start_date, end_date, reason, approver_user_id } = req.body;

    // =====================================================
    // VALIDATE
    // =====================================================

    if (!start_date || !end_date) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn thời gian nghỉ phép.",
      });
    }

    if (!approver_user_id) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn người duyệt.",
      });
    }

    const start = new Date(`${start_date}T00:00:00`);
    const end = new Date(`${end_date}T00:00:00`);

    if (start > end) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Ngày kết thúc không hợp lệ.",
      });
    }

    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear !== endYear) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Phiếu nghỉ không được kéo dài qua hai năm.",
      });
    }

    // =====================================================
    // KIỂM TRA NHÂN VIÊN CÓ ĐƯỢC HƯỞNG PHÉP
    // =====================================================

    const config = await UserLeaveConfig.findOne({
      where: {
        user_id: userId,
        is_leave_eligible: true,
      },
      transaction,
    });

    if (!config) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Bạn chưa thuộc đối tượng được hưởng phép năm.",
      });
    }

    // =====================================================
    // TÍNH SỐ NGÀY NGHỈ
    // =====================================================

    const totalDays = countWorkingDays(start_date, end_date);

    if (totalDays <= 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Khoảng thời gian đăng ký không có ngày làm việc.",
      });
    }

    // =====================================================
    // KIỂM TRA TRÙNG PHIẾU
    // =====================================================

    const overlap = await LeaveRequest.findOne({
      where: {
        user_id: userId,

        status: {
          [Op.in]: ["PENDING", "APPROVED"],
        },

        start_date: {
          [Op.lte]: end_date,
        },

        end_date: {
          [Op.gte]: start_date,
        },
      },
      transaction,
    });

    if (overlap) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Khoảng thời gian này đã có phiếu nghỉ khác.",
      });
    }

    // =====================================================
    // KIỂM TRA QUỸ PHÉP
    // =====================================================

    const balance = await getLeaveBalance(userId, startYear, transaction);

    if (totalDays > balance.requestable_days) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: `Bạn chỉ còn ${balance.requestable_days} ngày phép có thể đăng ký.`,
        data: balance,
      });
    }

    // =====================================================
    // TẠO PHIẾU
    // =====================================================

    const request = await LeaveRequest.create(
      {
        user_id: userId,

        approver_user_id: Number(approver_user_id),

        start_date,
        end_date,

        total_days: totalDays,

        reason: reason?.trim() || null,

        status: "PENDING",
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Đã gửi phiếu đăng ký nghỉ phép.",
      data: request,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("createLeaveRequest error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tạo phiếu nghỉ phép.",
    });
  }
};
// =====================================================
// NHÂN VIÊN - HỦY PHIẾU PENDING
// =====================================================

exports.cancelLeaveRequest = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    const { leaveRequestId } = req.params;

    const request = await LeaveRequest.findOne({
      where: {
        leave_request_id: leaveRequestId,

        user_id: userId,
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu nghỉ phép.",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Chỉ được hủy phiếu đang chờ duyệt.",
      });
    }

    await request.update({
      status: "CANCELLED",

      cancelled_at: new Date(),

      updated_at: new Date(),
    });

    return res.json({
      success: true,
      message: "Đã hủy phiếu nghỉ phép.",
    });
  } catch (error) {
    console.error("cancelLeaveRequest error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể hủy phiếu nghỉ phép.",
    });
  }
};

// =====================================================
// ADMIN - DANH SÁCH PHIẾU
// =====================================================

exports.getLeaveRequests = async (req, res) => {
  try {
    const { status, year, user_id } = req.query;

    const conditions = [];
    const replacements = {};

    if (status) {
      conditions.push("lr.status = :status");

      replacements.status = status;
    }

    if (user_id) {
      conditions.push("lr.user_id = :user_id");

      replacements.user_id = user_id;
    }

    if (year) {
      conditions.push(`EXTRACT(YEAR FROM lr.start_date) = :year`);

      replacements.year = Number(year);
    }

    const whereSQL = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const data = await sequelize.query(
      `
  SELECT
    lr.*,

    u.name,
    u.position,
    u.email,

    approver.name AS approver_name,
    approver.position AS approver_position

  FROM vntour.leave_requests lr

  LEFT JOIN mdm.users u
    ON u.user_id = lr.user_id

  LEFT JOIN mdm.users approver
    ON approver.user_id = lr.approver_user_id

  ${whereSQL}

  ORDER BY
    lr.created_at DESC,
    lr.leave_request_id DESC
  `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getLeaveRequests error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách phiếu nghỉ.",
    });
  }
};

exports.processLeaveRequest = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const currentUserId = getCurrentUserId(req);

    const { leaveRequestId } = req.params;

    const { decision, reject_reason } = req.body;

    // =====================================================
    // VALIDATE DECISION
    // =====================================================

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Trạng thái xử lý không hợp lệ.",
      });
    }

    // =====================================================
    // LOCK PHIẾU
    // =====================================================

    const request = await LeaveRequest.findOne({
      where: {
        leave_request_id: leaveRequestId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!request) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu nghỉ phép.",
      });
    }

    // =====================================================
    // CHỈ PENDING MỚI ĐƯỢC XỬ LÝ
    // =====================================================

    if (request.status !== "PENDING") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Phiếu nghỉ phép này đã được xử lý.",
      });
    }

    // =====================================================
    // CHECK ĐÚNG NGƯỜI DUYỆT
    // =====================================================

    if (Number(request.approver_user_id) !== Number(currentUserId)) {
      await transaction.rollback();

      return res.status(403).json({
        success: false,
        message: "Bạn không phải người được chỉ định duyệt phiếu này.",
      });
    }

    // =====================================================
    // APPROVED
    // =====================================================

    if (decision === "APPROVED") {
      const year = new Date(`${request.start_date}T00:00:00`).getFullYear();

      const balance = await getLeaveBalance(request.user_id, year, transaction);

      /*
       * remaining_days:
       * accrued - approved
       *
       * Không trừ PENDING ở đây vì phiếu hiện tại
       * chính là phiếu đang được duyệt.
       */
      if (Number(request.total_days) > Number(balance.remaining_days)) {
        await transaction.rollback();

        return res.status(400).json({
          success: false,
          message: "Nhân viên không còn đủ ngày phép để duyệt.",
          data: balance,
        });
      }

      await request.update(
        {
          status: "APPROVED",

          approved_by: currentUserId,
          approved_at: new Date(),

          rejected_by: null,
          rejected_at: null,
          reject_reason: null,

          updated_at: new Date(),
        },
        {
          transaction,
        },
      );

      await transaction.commit();

      return res.json({
        success: true,
        message: "Đã đồng ý phiếu nghỉ phép.",
        data: request,
      });
    }

    // =====================================================
    // REJECTED
    // =====================================================

    if (!reject_reason || !reject_reason.trim()) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập lý do từ chối.",
      });
    }

    await request.update(
      {
        status: "REJECTED",

        rejected_by: currentUserId,
        rejected_at: new Date(),

        reject_reason: reject_reason.trim(),

        approved_by: null,
        approved_at: null,

        updated_at: new Date(),
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: "Đã từ chối phiếu nghỉ phép.",
      data: request,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("processLeaveRequest error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể xử lý phiếu nghỉ phép.",
    });
  }
};

// =====================================================
// ADMIN - QUỸ PHÉP TẤT CẢ NHÂN VIÊN
// =====================================================

exports.getLeaveBalances = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const data = await sequelize.query(
      `
        SELECT
          u.user_id,
          u.name,
          u.position,

          ulc.official_date,
          ulc.is_leave_eligible,
          ulc.monthly_leave_days,

          COALESCE(
            a.accrued_days,
            0
          ) AS accrued_days,

          COALESCE(
            r.used_days,
            0
          ) AS used_days,

          COALESCE(
            r.pending_days,
            0
          ) AS pending_days,

          COALESCE(
            a.accrued_days,
            0
          )
          -
          COALESCE(
            r.used_days,
            0
          ) AS remaining_days,

          COALESCE(
            a.accrued_days,
            0
          )
          -
          COALESCE(
            r.used_days,
            0
          )
          -
          COALESCE(
            r.pending_days,
            0
          ) AS requestable_days

        FROM mdm.user_leave_configs ulc

        INNER JOIN mdm.users u
          ON u.user_id =
             ulc.user_id

        LEFT JOIN (
          SELECT
            user_id,

            SUM(
              accrual_days
            ) AS accrued_days

          FROM vntour.leave_accruals

          WHERE accrual_year =
                :year

          GROUP BY
            user_id
        ) a
          ON a.user_id =
             u.user_id

        LEFT JOIN (
          SELECT
            user_id,

            SUM(
              CASE
                WHEN status = 'APPROVED'
                THEN total_days
                ELSE 0
              END
            ) AS used_days,

            SUM(
              CASE
                WHEN status = 'PENDING'
                THEN total_days
                ELSE 0
              END
            ) AS pending_days

          FROM vntour.leave_requests

          WHERE
            EXTRACT(
              YEAR FROM start_date
            ) = :year

          GROUP BY
            user_id
        ) r
          ON r.user_id =
             u.user_id

        WHERE
          ulc.is_leave_eligible = TRUE

        ORDER BY
          u.name ASC
        `,
      {
        replacements: {
          year,
        },

        type: QueryTypes.SELECT,
      },
    );

    return res.json({
      success: true,

      data: {
        year,
        employees: data,
      },
    });
  } catch (error) {
    console.error("getLeaveBalances error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy quỹ phép nhân viên.",
    });
  }
};
