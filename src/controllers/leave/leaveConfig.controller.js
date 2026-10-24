const { UserLeaveConfig } = require("../../models/leave");

const getCurrentUserId = (req) => {
  return req.user?.user_id || req.user?.id || null;
};

/**
 * Lấy cấu hình phép của một nhân viên
 */
exports.getLeaveConfig = async (req, res) => {
  try {
    const { userId } = req.params;

    const config = await UserLeaveConfig.findOne({
      where: {
        user_id: userId,
      },
    });

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("getLeaveConfig error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy cấu hình phép năm.",
    });
  }
};

/**
 * Tạo hoặc cập nhật cấu hình phép
 */
exports.saveLeaveConfig = async (req, res) => {
  try {
    const adminId = getCurrentUserId(req);

    const {
      user_id,
      official_date,
      is_leave_eligible = true,
      monthly_leave_days = 1,
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu nhân viên.",
      });
    }

    if (!official_date) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ngày nhân viên chính thức.",
      });
    }

    if (Number(monthly_leave_days) < 0) {
      return res.status(400).json({
        success: false,
        message: "Số ngày phép hàng tháng không hợp lệ.",
      });
    }

    const [config, created] = await UserLeaveConfig.findOrCreate({
      where: {
        user_id,
      },

      defaults: {
        user_id,
        official_date,
        is_leave_eligible,
        monthly_leave_days,
        created_by: adminId,
      },
    });

    if (!created) {
      await config.update({
        official_date,
        is_leave_eligible,
        monthly_leave_days,
        updated_at: new Date(),
      });
    }

    return res.json({
      success: true,
      message: created
        ? "Đã tạo cấu hình phép năm."
        : "Đã cập nhật cấu hình phép năm.",
      data: config,
    });
  } catch (error) {
    console.error("saveLeaveConfig error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật cấu hình phép năm.",
    });
  }
};
