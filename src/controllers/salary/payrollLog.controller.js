const { PayrollLog, User } = require("../../models");

exports.getPayrollLogs = async (req, res) => {
  try {
    const { payroll_period_id, user_id } = req.query;

    const where = {};

    if (payroll_period_id) {
      where.payroll_period_id = payroll_period_id;
    }

    if (user_id) {
      where.user_id = user_id;
    }

    const data = await PayrollLog.findAll({
      where,

      include: [
        {
          model: User,
          as: "creator",

          attributes: ["user_id", "name"],
        },
      ],

      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không thể lấy lịch sử bảng lương",
      error: error.message,
    });
  }
};
