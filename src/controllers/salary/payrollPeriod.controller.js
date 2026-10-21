const sequelize = require("../../config/database");

const {
  PayrollPeriod,
  PayrollAttendance,
  PayrollAttendanceAdjustment,
  EmployeePayroll,
  PayrollAdjustment,
  EmployeePayrollVersion,
  PayrollLog,
  User,
} = require("../../models");

// ==========================================================
// HELPER: TÍNH CÔNG CHUẨN
// Công ty làm Thứ 2 -> Thứ 6
// ==========================================================

const calculateStandardWorkDays = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  if (end < start) {
    return 0;
  }

  let total = 0;

  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();

    // 0 = Chủ nhật
    // 1 = Thứ 2
    // 2 = Thứ 3
    // 3 = Thứ 4
    // 4 = Thứ 5
    // 5 = Thứ 6
    // 6 = Thứ 7

    if (day >= 1 && day <= 5) {
      total += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
};

// ==========================================================
// GET LIST
// ==========================================================

const getPayrollPeriods = async (req, res) => {
  try {
    const { status, year } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    const periods = await PayrollPeriod.findAll({
      where,

      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
          required: false,
        },

        {
          model: User,
          as: "publisher",
          attributes: ["user_id", "name"],
          required: false,
        },
      ],

      order: [
        ["start_date", "DESC"],
        ["payroll_period_id", "DESC"],
      ],
    });

    let data = periods;

    if (year) {
      data = periods.filter((item) => {
        const date = new Date(`${item.start_date}T00:00:00`);

        return date.getFullYear() === Number(year);
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getPayrollPeriods error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy danh sách kỳ lương.",

      error: error.message,
    });
  }
};

// ==========================================================
// GET BY ID
// ==========================================================

const getPayrollPeriodById = async (req, res) => {
  try {
    const { id } = req.params;

    const period = await PayrollPeriod.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
          required: false,
        },

        {
          model: User,
          as: "publisher",
          attributes: ["user_id", "name"],
          required: false,
        },
      ],
    });

    if (!period) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy kỳ lương.",
      });
    }

    return res.status(200).json({
      success: true,
      data: period,
    });
  } catch (error) {
    console.error("getPayrollPeriodById error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy thông tin kỳ lương.",

      error: error.message,
    });
  }
};

// ==========================================================
// CREATE
// ==========================================================

const createPayrollPeriod = async (req, res) => {
  try {
    const { period_code, period_name, start_date, end_date, note } = req.body;

    // ======================================================
    // VALIDATE
    // ======================================================

    if (!period_code?.trim()) {
      return res.status(400).json({
        success: false,

        message: "Vui lòng nhập mã kỳ lương.",
      });
    }

    if (!period_name?.trim()) {
      return res.status(400).json({
        success: false,

        message: "Vui lòng nhập tên kỳ lương.",
      });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,

        message: "Vui lòng nhập đầy đủ thời gian kỳ lương.",
      });
    }

    const start = new Date(`${start_date}T00:00:00`);

    const end = new Date(`${end_date}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,

        message: "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,

        message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.",
      });
    }

    // ======================================================
    // CHECK DUPLICATE CODE
    // ======================================================

    const existing = await PayrollPeriod.findOne({
      where: {
        period_code: period_code.trim(),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,

        message: "Mã kỳ lương đã tồn tại.",
      });
    }

    // ======================================================
    // AUTO CALCULATE STANDARD WORK DAYS
    // ======================================================

    const standardWorkDays = calculateStandardWorkDays(start_date, end_date);

    if (standardWorkDays <= 0) {
      return res.status(400).json({
        success: false,

        message: "Kỳ lương không có ngày làm việc hợp lệ từ Thứ 2 đến Thứ 6.",
      });
    }

    // ======================================================
    // CREATE
    // ======================================================

    const period = await PayrollPeriod.create({
      period_code: period_code.trim(),

      period_name: period_name.trim(),

      start_date,

      end_date,

      standard_work_days: standardWorkDays,

      status: "OPEN",

      note: note?.trim() || null,

      created_by: req.user?.user_id || null,

      created_at: new Date(),
    });

    return res.status(201).json({
      success: true,

      message: "Tạo kỳ lương thành công.",

      data: period,
    });
  } catch (error) {
    console.error("createPayrollPeriod error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể tạo kỳ lương.",

      error: error.message,
    });
  }
};

// ==========================================================
// UPDATE
// ==========================================================

const updatePayrollPeriod = async (req, res) => {
  try {
    const { id } = req.params;

    const { period_name, start_date, end_date, note } = req.body;

    // ======================================================
    // FIND
    // ======================================================

    const period = await PayrollPeriod.findByPk(id);

    if (!period) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy kỳ lương.",
      });
    }

    // ======================================================
    // BLOCK PUBLISHED / CLOSED
    // ======================================================

    if (["PUBLISHED", "CLOSED"].includes(period.status)) {
      return res.status(400).json({
        success: false,

        message: "Không thể chỉnh sửa kỳ lương đã công bố hoặc đã đóng.",
      });
    }

    // ======================================================
    // NEW VALUES
    // ======================================================

    const newStartDate = start_date || period.start_date;

    const newEndDate = end_date || period.end_date;

    const start = new Date(`${newStartDate}T00:00:00`);

    const end = new Date(`${newEndDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,

        message: "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,

        message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.",
      });
    }

    // ======================================================
    // AUTO RECALCULATE STANDARD WORK DAYS
    // ======================================================

    const standardWorkDays = calculateStandardWorkDays(
      newStartDate,
      newEndDate,
    );

    if (standardWorkDays <= 0) {
      return res.status(400).json({
        success: false,

        message: "Kỳ lương không có ngày làm việc hợp lệ.",
      });
    }

    // ======================================================
    // CHECK IF DATE CHANGED
    // ======================================================

    const dateChanged =
      String(period.start_date) !== String(newStartDate) ||
      String(period.end_date) !== String(newEndDate);

    // ======================================================
    // UPDATE PERIOD
    // ======================================================

    period.period_name = period_name?.trim() || period.period_name;

    period.start_date = newStartDate;

    period.end_date = newEndDate;

    period.standard_work_days = standardWorkDays;

    period.note = note !== undefined ? note?.trim() || null : period.note;

    /*
     * Nếu thay đổi khoảng thời gian
     * thì dữ liệu công cũ có thể không còn chính xác.
     *
     * Đưa kỳ về OPEN để user sync lại công.
     */

    if (dateChanged) {
      period.status = "OPEN";
    }

    await period.save();

    // ======================================================
    // UPDATE STANDARD DAYS IN EXISTING ATTENDANCE
    // ======================================================

    if (dateChanged) {
      await PayrollAttendance.update(
        {
          standard_work_days: standardWorkDays,

          status: "CHANGED",

          confirmed_by: null,

          confirmed_at: null,
        },
        {
          where: {
            payroll_period_id: period.payroll_period_id,
          },
        },
      );

      // ====================================================
      // PAYROLL ĐÃ TÍNH -> OUTDATED
      // ====================================================

      await EmployeePayroll.update(
        {
          standard_work_days: standardWorkDays,

          status: "OUTDATED",
        },
        {
          where: {
            payroll_period_id: period.payroll_period_id,
          },
        },
      );
    }

    return res.status(200).json({
      success: true,

      message: dateChanged
        ? "Cập nhật kỳ lương thành công. Do thời gian kỳ lương thay đổi, vui lòng cập nhật lại dữ liệu chấm công."
        : "Cập nhật kỳ lương thành công.",

      data: period,
    });
  } catch (error) {
    console.error("updatePayrollPeriod error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể cập nhật kỳ lương.",

      error: error.message,
    });
  }
};

const deletePayrollPeriod = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const payrollPeriodId = Number(req.params.id);

    // ======================================================
    // VALIDATE
    // ======================================================

    if (!payrollPeriodId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "payroll_period_id không hợp lệ.",
      });
    }

    // ======================================================
    // PERIOD
    // ======================================================

    const period = await PayrollPeriod.findByPk(payrollPeriodId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!period) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy kỳ lương.",
      });
    }

    // ======================================================
    // KHÔNG XÓA KỲ ĐÃ CÔNG BỐ / ĐÃ ĐÓNG
    // ======================================================

    if (["PUBLISHED", "CLOSED"].includes(period.status)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Không thể xóa kỳ lương đã công bố hoặc đã đóng.",
      });
    }

    // ======================================================
    // LẤY EMPLOYEE PAYROLL IDS
    // ======================================================

    const employeePayrolls = await EmployeePayroll.findAll({
      where: {
        payroll_period_id: payrollPeriodId,
      },

      attributes: ["employee_payroll_id"],

      transaction,
    });

    const employeePayrollIds = employeePayrolls.map(
      (item) => item.employee_payroll_id,
    );

    // ======================================================
    // LẤY ATTENDANCE IDS
    // ======================================================

    const attendances = await PayrollAttendance.findAll({
      where: {
        payroll_period_id: payrollPeriodId,
      },

      attributes: ["payroll_attendance_id"],

      transaction,
    });

    const attendanceIds = attendances.map((item) => item.payroll_attendance_id);

    // ======================================================
    // 1. DELETE LOGS
    // ======================================================

    await PayrollLog.destroy({
      where: {
        payroll_period_id: payrollPeriodId,
      },

      transaction,
    });

    // ======================================================
    // 2. DELETE EMPLOYEE PAYROLL VERSIONS
    // ======================================================

    if (employeePayrollIds.length > 0) {
      await EmployeePayrollVersion.destroy({
        where: {
          employee_payroll_id: employeePayrollIds,
        },

        transaction,
      });
    }

    // ======================================================
    // 3. DELETE PAYROLL ADJUSTMENTS
    // ======================================================

    if (employeePayrollIds.length > 0) {
      await PayrollAdjustment.destroy({
        where: {
          employee_payroll_id: employeePayrollIds,
        },

        transaction,
      });
    }

    // ======================================================
    // 4. DELETE EMPLOYEE PAYROLLS
    // ======================================================

    await EmployeePayroll.destroy({
      where: {
        payroll_period_id: payrollPeriodId,
      },

      transaction,
    });

    // ======================================================
    // 5. DELETE ATTENDANCE ADJUSTMENTS
    // ======================================================

    if (attendanceIds.length > 0) {
      await PayrollAttendanceAdjustment.destroy({
        where: {
          payroll_attendance_id: attendanceIds,
        },

        transaction,
      });
    }

    // ======================================================
    // 6. DELETE PAYROLL ATTENDANCES
    // ======================================================

    await PayrollAttendance.destroy({
      where: {
        payroll_period_id: payrollPeriodId,
      },

      transaction,
    });

    // ======================================================
    // 7. DELETE PERIOD
    // ======================================================

    await period.destroy({
      transaction,
    });

    // ======================================================
    // COMMIT
    // ======================================================

    await transaction.commit();

    return res.json({
      success: true,

      message: "Xóa kỳ lương và toàn bộ dữ liệu liên quan thành công.",

      data: {
        payroll_period_id: payrollPeriodId,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("deletePayrollPeriod:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể xóa kỳ lương.",

      error: error.message,
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  getPayrollPeriods,

  getPayrollPeriodById,

  createPayrollPeriod,

  updatePayrollPeriod,

  calculateStandardWorkDays,

  deletePayrollPeriod,
};
