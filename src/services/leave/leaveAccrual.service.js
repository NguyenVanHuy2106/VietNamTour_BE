const sequelize = require("../../config/database");

const { UserLeaveConfig, LeaveAccrual } = require("../../models/leave");

const formatDate = (date) => {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Tính ngày đủ N tháng làm việc.
 *
 * VD:
 *
 * official_date = 11/08/2026
 *
 * tháng 1:
 * 10/09/2026
 *
 * tháng 2:
 * 10/10/2026
 */
const calculateAccrualDate = (officialDate, monthNumber) => {
  const date = new Date(`${officialDate}T00:00:00`);

  date.setMonth(date.getMonth() + monthNumber);

  date.setDate(date.getDate() - 1);

  return date;
};

const runAutomaticLeaveAccrual = async () => {
  const transaction = await sequelize.transaction();

  try {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const configs = await UserLeaveConfig.findAll({
      where: {
        is_leave_eligible: true,
      },

      transaction,
    });

    let createdCount = 0;

    for (const config of configs) {
      let monthNumber = 1;

      while (true) {
        const accrualDate = calculateAccrualDate(
          config.official_date,
          monthNumber,
        );

        accrualDate.setHours(0, 0, 0, 0);

        // Chưa đủ tháng tiếp theo
        if (accrualDate > today) {
          break;
        }

        const year = accrualDate.getFullYear();

        const month = accrualDate.getMonth() + 1;

        const existing = await LeaveAccrual.findOne({
          where: {
            user_id: config.user_id,
            accrual_year: year,
            accrual_month: month,
          },

          transaction,
        });

        if (!existing) {
          await LeaveAccrual.create(
            {
              user_id: config.user_id,

              accrual_year: year,
              accrual_month: month,

              accrual_days: config.monthly_leave_days,

              accrual_date: formatDate(accrualDate),

              note: `Tự động cộng phép tháng ${String(month).padStart(
                2,
                "0",
              )}/${year}`,
            },
            {
              transaction,
            },
          );

          createdCount++;
        }

        monthNumber++;
      }
    }

    await transaction.commit();

    console.log(`[Leave Accrual] Đã cộng mới ${createdCount} bản ghi.`);

    return {
      created: createdCount,
    };
  } catch (error) {
    await transaction.rollback();

    console.error("[Leave Accrual] Error:", error);

    throw error;
  }
};

module.exports = {
  runAutomaticLeaveAccrual,
};
