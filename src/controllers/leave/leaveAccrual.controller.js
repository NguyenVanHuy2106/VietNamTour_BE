const { Op } = require("sequelize");
const sequelize = require("../../config/database");

const { UserLeaveConfig, LeaveAccrual } = require("../../models/leave");

const formatDate = (date) => {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getEndOfMonth = (year, month) => {
  return new Date(year, month, 0);
};

/**
 * Cộng phép theo tháng
 *
 * Rule:
 * - Phải là nhân viên chính thức
 * - is_leave_eligible = true
 * - Đã làm đủ ít nhất 1 tháng
 * - 1 tháng chỉ cộng 1 lần
 */
// exports.runMonthlyAccrual = async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     let { year, month } = req.body;

//     const now = new Date();

//     year = Number(year) || now.getFullYear();

//     month = Number(month) || now.getMonth() + 1;

//     if (month < 1 || month > 12) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,
//         message: "Tháng không hợp lệ.",
//       });
//     }

//     const periodEnd = getEndOfMonth(year, month);

//     /*
//      * Ví dụ:
//      *
//      * official_date = 11/08/2026
//      *
//      * đến 10/09/2026 mới đủ 1 tháng.
//      *
//      * Vì vậy khi xét tháng 09,
//      * người này đủ điều kiện +1 phép.
//      */
//     const oneMonthBefore = new Date(periodEnd);

//     oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);

//     const configs = await UserLeaveConfig.findAll({
//       where: {
//         is_leave_eligible: true,

//         official_date: {
//           [Op.lte]: formatDate(oneMonthBefore),
//         },
//       },

//       transaction,
//     });

//     let createdCount = 0;
//     let skippedCount = 0;

//     for (const config of configs) {
//       const existing = await LeaveAccrual.findOne({
//         where: {
//           user_id: config.user_id,

//           accrual_year: year,

//           accrual_month: month,
//         },

//         transaction,
//       });

//       if (existing) {
//         skippedCount++;
//         continue;
//       }

//       await LeaveAccrual.create(
//         {
//           user_id: config.user_id,

//           accrual_year: year,

//           accrual_month: month,

//           accrual_days: config.monthly_leave_days,

//           accrual_date: formatDate(periodEnd),

//           note: `Phép năm tháng ${String(month).padStart(2, "0")}/${year}`,
//         },

//         {
//           transaction,
//         },
//       );

//       createdCount++;
//     }

//     await transaction.commit();

//     return res.json({
//       success: true,

//       message: "Đã cập nhật phép năm hàng tháng.",

//       data: {
//         year,
//         month,
//         created: createdCount,
//         skipped: skippedCount,
//       },
//     });
//   } catch (error) {
//     await transaction.rollback();

//     console.error("runMonthlyAccrual error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Không thể cộng phép năm hàng tháng.",
//     });
//   }
// };

exports.runMonthlyAccrual = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    let { year, month } = req.body;

    const now = new Date();

    year = Number(year) || now.getFullYear();
    month = Number(month) || now.getMonth() + 1;

    if (month < 1 || month > 12) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Tháng không hợp lệ.",
      });
    }

    // Ngày cuối cùng của tháng đang xét
    const periodEnd = new Date(year, month, 0);

    const configs = await UserLeaveConfig.findAll({
      where: {
        is_leave_eligible: true,
      },
      transaction,
    });

    let createdCount = 0;
    let skippedCount = 0;
    let notEligibleCount = 0;

    for (const config of configs) {
      const officialDate = new Date(`${config.official_date}T00:00:00`);

      // =====================================================
      // TÍNH MỐC ĐỦ 1 THÁNG LÀM VIỆC
      // =====================================================

      const firstAccrualDate = new Date(officialDate);

      firstAccrualDate.setMonth(firstAccrualDate.getMonth() + 1);

      /*
       * Ví dụ:
       *
       * official_date = 11/08/2026
       *
       * JS sẽ ra:
       * 11/09/2026
       *
       * Nhưng rule công ty:
       * 11/08 -> 10/09 = đủ 1 tháng
       *
       * nên trừ lại 1 ngày.
       */

      firstAccrualDate.setDate(firstAccrualDate.getDate() - 1);

      // Chưa đủ 1 tháng tính đến cuối tháng đang xét
      if (firstAccrualDate > periodEnd) {
        notEligibleCount++;
        continue;
      }

      // =====================================================
      // TÍNH SỐ THÁNG ĐÃ ĐỦ ĐIỀU KIỆN
      // =====================================================

      const monthsCompleted =
        (periodEnd.getFullYear() - officialDate.getFullYear()) * 12 +
        (periodEnd.getMonth() - officialDate.getMonth());

      /*
       * Ví dụ:
       *
       * official: 11/08
       * xét 30/09
       *
       * monthsCompleted = 1
       *
       * => tháng 09 được +1
       */

      if (monthsCompleted < 1) {
        notEligibleCount++;
        continue;
      }

      // =====================================================
      // KIỂM TRA THÁNG NÀY ĐÃ CỘNG CHƯA
      // =====================================================

      const existing = await LeaveAccrual.findOne({
        where: {
          user_id: config.user_id,
          accrual_year: year,
          accrual_month: month,
        },
        transaction,
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      // =====================================================
      // CỘNG PHÉP
      // =====================================================

      await LeaveAccrual.create(
        {
          user_id: config.user_id,

          accrual_year: year,

          accrual_month: month,

          accrual_days: config.monthly_leave_days,

          accrual_date: formatDate(firstAccrualDate),

          note: `Phép năm tháng ${String(month).padStart(2, "0")}/${year}`,
        },
        {
          transaction,
        },
      );

      createdCount++;
    }

    await transaction.commit();

    return res.json({
      success: true,

      message: "Đã cập nhật phép năm hàng tháng.",

      data: {
        year,
        month,

        created: createdCount,
        skipped: skippedCount,
        not_eligible: notEligibleCount,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("runMonthlyAccrual error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cộng phép năm hàng tháng.",
    });
  }
};
/**
 * Xem lịch sử cộng phép của nhân viên
 */
exports.getUserLeaveAccruals = async (req, res) => {
  try {
    const { userId } = req.params;

    const { year } = req.query;

    const where = {
      user_id: userId,
    };

    if (year) {
      where.accrual_year = Number(year);
    }

    const data = await LeaveAccrual.findAll({
      where,

      order: [
        ["accrual_year", "DESC"],
        ["accrual_month", "DESC"],
      ],
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getUserLeaveAccruals error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy lịch sử cộng phép.",
    });
  }
};
