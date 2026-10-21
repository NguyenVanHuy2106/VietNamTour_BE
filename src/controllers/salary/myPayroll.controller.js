const {
  EmployeePayroll,
  PayrollPeriod,
  PayrollAdjustment,
  User,
} = require("../../models");

// ==========================================================
// GET /salary/my-payroll?user_id=1035
//
// DANH SÁCH BẢNG LƯƠNG ĐÃ CÔNG BỐ CỦA NHÂN VIÊN
// ==========================================================

exports.getMyPayrolls = async (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    // ======================================================
    // VALIDATE
    // ======================================================

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu user_id.",
      });
    }

    // ======================================================
    // USER
    // ======================================================

    const user = await User.findByPk(userId, {
      attributes: ["user_id", "name", "position", "email", "avatar"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân viên.",
      });
    }

    // ======================================================
    // PAYROLL PUBLISHED
    // ======================================================

    const payrolls = await EmployeePayroll.findAll({
      where: {
        user_id: userId,

        status: "PUBLISHED",
      },

      order: [["employee_payroll_id", "DESC"]],
    });

    if (payrolls.length === 0) {
      return res.json({
        success: true,

        data: {
          user,
          payrolls: [],
        },
      });
    }

    // ======================================================
    // PERIOD IDS
    // ======================================================

    const periodIds = [
      ...new Set(payrolls.map((item) => item.payroll_period_id)),
    ];

    // ======================================================
    // PERIODS
    // ======================================================

    const periods = await PayrollPeriod.findAll({
      where: {
        payroll_period_id: periodIds,
      },
    });

    const periodMap = new Map();

    periods.forEach((period) => {
      periodMap.set(
        Number(period.payroll_period_id),

        period.toJSON(),
      );
    });

    // ======================================================
    // RESPONSE
    // ======================================================

    const data = payrolls.map((payroll) => {
      const item = payroll.toJSON();

      const period = periodMap.get(Number(item.payroll_period_id));

      return {
        employee_payroll_id: item.employee_payroll_id,

        payroll_period_id: item.payroll_period_id,

        // ===============================================
        // PERIOD
        // ===============================================

        period_code: period?.period_code || null,

        period_name: period?.period_name || null,

        start_date: period?.start_date || null,

        end_date: period?.end_date || null,

        published_at: period?.published_at || null,

        // ===============================================
        // EMPLOYEE
        // ===============================================

        employee_name: item.employee_name || user.name,

        employee_position: item.employee_position || user.position,

        employee_type: item.employee_type,

        // ===============================================
        // ATTENDANCE
        // ===============================================

        standard_work_days: item.standard_work_days,

        actual_work_days: item.actual_work_days,

        // ===============================================
        // SALARY
        // ===============================================

        base_salary: item.base_salary,

        attendance_salary: item.attendance_salary,

        fixed_allowance: item.fixed_allowance,

        additional_allowance: item.additional_allowance,

        bonus_amount: item.bonus_amount,

        deduction_amount: item.deduction_amount,

        total_insurance_amount: item.total_insurance_amount,

        personal_income_tax: item.personal_income_tax,

        gross_salary: item.gross_salary,

        net_salary: item.net_salary,

        // ===============================================
        // STATUS
        // ===============================================

        payroll_version: item.payroll_version,

        status: item.status,
      };
    });

    return res.json({
      success: true,

      data: {
        user: user.toJSON(),

        payrolls: data,
      },
    });
  } catch (error) {
    console.error("getMyPayrolls:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy bảng lương.",

      error: error.message,
    });
  }
};

// ==========================================================
// GET /salary/my-payroll/:id?user_id=1035
//
// XEM CHI TIẾT 1 PHIẾU LƯƠNG
// ==========================================================

exports.getMyPayrollDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const userId = Number(req.query.user_id);

    // ======================================================
    // VALIDATE
    // ======================================================

    if (!userId) {
      return res.status(400).json({
        success: false,

        message: "Thiếu user_id.",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,

        message: "Thiếu employee_payroll_id.",
      });
    }

    // ======================================================
    // PAYROLL
    //
    // QUAN TRỌNG:
    // phải match cả payroll id + user id
    // để user không xem bảng lương người khác
    // ======================================================

    const payroll = await EmployeePayroll.findOne({
      where: {
        employee_payroll_id: id,

        user_id: userId,

        status: "PUBLISHED",
      },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,

        message:
          "Không tìm thấy phiếu lương hoặc phiếu lương không thuộc nhân viên này.",
      });
    }

    // ======================================================
    // PERIOD
    // ======================================================

    const period = await PayrollPeriod.findByPk(payroll.payroll_period_id);

    if (!period) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy kỳ lương.",
      });
    }

    // ======================================================
    // KỲ PHẢI ĐÃ CÔNG BỐ
    // ======================================================

    if (!["PUBLISHED", "CLOSED"].includes(period.status)) {
      return res.status(403).json({
        success: false,

        message: "Bảng lương chưa được công bố.",
      });
    }

    // ======================================================
    // USER
    // ======================================================

    const user = await User.findByPk(userId, {
      attributes: ["user_id", "name", "position", "email", "avatar"],
    });

    // ======================================================
    // ADJUSTMENTS
    // ======================================================

    const adjustments = await PayrollAdjustment.findAll({
      where: {
        employee_payroll_id: payroll.employee_payroll_id,

        status: 1,
      },

      order: [["payroll_adjustment_id", "ASC"]],
    });

    const item = payroll.toJSON();

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.json({
      success: true,

      data: {
        employee_payroll_id: item.employee_payroll_id,

        payroll_period_id: item.payroll_period_id,

        // ==================================================
        // KỲ LƯƠNG
        // ==================================================

        period: {
          period_code: period.period_code,

          period_name: period.period_name,

          start_date: period.start_date,

          end_date: period.end_date,

          status: period.status,

          published_at: period.published_at || null,
        },

        // ==================================================
        // NHÂN VIÊN
        // ==================================================

        employee: {
          user_id: userId,

          name: item.employee_name || user?.name || null,

          position: item.employee_position || user?.position || null,

          employee_type: item.employee_type,

          email: user?.email || null,

          avatar: user?.avatar || null,
        },

        // ==================================================
        // CÔNG
        // ==================================================

        attendance: {
          standard_work_days: item.standard_work_days,

          actual_work_days: item.actual_work_days,
        },

        // ==================================================
        // LƯƠNG
        // ==================================================

        salary: {
          base_salary: item.base_salary,

          attendance_salary: item.attendance_salary,

          fixed_allowance: item.fixed_allowance,

          additional_allowance: item.additional_allowance,

          bonus_amount: item.bonus_amount,

          deduction_amount: item.deduction_amount,

          personal_income_tax: item.personal_income_tax,

          gross_salary: item.gross_salary,

          net_salary: item.net_salary,
        },

        // ==================================================
        // BẢO HIỂM
        // ==================================================

        insurance: {
          insurance_salary: item.insurance_salary,

          social_insurance_amount: item.social_insurance_amount,

          health_insurance_amount: item.health_insurance_amount,

          unemployment_insurance_amount: item.unemployment_insurance_amount,

          total_insurance_amount: item.total_insurance_amount,
        },

        // ==================================================
        // CÁC KHOẢN ĐIỀU CHỈNH
        // ==================================================

        adjustments: adjustments.map((adjustment) => ({
          payroll_adjustment_id: adjustment.payroll_adjustment_id,

          adjustment_type: adjustment.adjustment_type,

          adjustment_name: adjustment.adjustment_name,

          amount: adjustment.amount,

          note: adjustment.note,
        })),

        // ==================================================
        // STATUS
        // ==================================================

        payroll_version: item.payroll_version,

        status: item.status,
      },
    });
  } catch (error) {
    console.error("getMyPayrollDetail:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy chi tiết phiếu lương.",

      error: error.message,
    });
  }
};
