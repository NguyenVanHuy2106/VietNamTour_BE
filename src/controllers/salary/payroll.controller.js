const { Op } = require("sequelize");

const sequelize = require("../../config/database");

const {
  User,
  UserSalaryConfig,
  PayrollInsuranceConfig,

  PayrollPeriod,
  PayrollAttendance,

  EmployeePayroll,
  EmployeePayrollVersion,

  PayrollAdjustment,
  PayrollLog,
} = require("../../models");

const toNumber = (value) => {
  const number = Number(value || 0);

  return Number.isFinite(number) ? number : 0;
};

const roundMoney = (value) => {
  return Math.round(toNumber(value));
};

/**
 * Lấy cấu hình lương đang hiệu lực.
 */
const getSalaryConfig = async (userId, date, transaction) => {
  return UserSalaryConfig.findOne({
    where: {
      user_id: userId,

      status: 1,

      effective_from: {
        [Op.lte]: date,
      },

      [Op.or]: [
        {
          effective_to: null,
        },

        {
          effective_to: {
            [Op.gte]: date,
          },
        },
      ],
    },

    order: [["effective_from", "DESC"]],

    transaction,
  });
};

/**
 * Lấy cấu hình bảo hiểm
 */
const getInsuranceConfig = async (date, transaction) => {
  return PayrollInsuranceConfig.findOne({
    where: {
      status: 1,

      effective_from: {
        [Op.lte]: date,
      },

      [Op.or]: [
        {
          effective_to: null,
        },

        {
          effective_to: {
            [Op.gte]: date,
          },
        },
      ],
    },

    order: [["effective_from", "DESC"]],

    transaction,
  });
};

/**
 * Tính một bảng lương.
 */
const calculateEmployeePayroll = async ({
  user,
  attendance,
  salaryConfig,
  insuranceConfig,
  payrollAdjustments = [],
}) => {
  const baseSalary = toNumber(salaryConfig.base_salary);

  const fixedAllowance = toNumber(salaryConfig.fixed_allowance);

  const standardDays = toNumber(attendance.standard_work_days);

  const actualDays = toNumber(attendance.confirmed_work_days);

  let attendanceSalary = baseSalary;

  if (salaryConfig.salary_by_attendance) {
    attendanceSalary =
      standardDays > 0
        ? roundMoney((baseSalary / standardDays) * actualDays)
        : 0;
  }

  const insuranceSalary = toNumber(salaryConfig.insurance_salary);

  const socialRate = salaryConfig.has_social_insurance
    ? toNumber(insuranceConfig?.employee_social_rate)
    : 0;

  const healthRate = salaryConfig.has_health_insurance
    ? toNumber(insuranceConfig?.employee_health_rate)
    : 0;

  const unemploymentRate = salaryConfig.has_unemployment_insurance
    ? toNumber(insuranceConfig?.employee_unemployment_rate)
    : 0;

  const socialAmount = roundMoney(insuranceSalary * socialRate);

  const healthAmount = roundMoney(insuranceSalary * healthRate);

  const unemploymentAmount = roundMoney(insuranceSalary * unemploymentRate);

  const totalInsurance = socialAmount + healthAmount + unemploymentAmount;

  let additionalAllowance = 0;
  let bonusAmount = 0;
  let deductionAmount = 0;

  for (const adjustment of payrollAdjustments) {
    if (Number(adjustment.status) !== 1) {
      continue;
    }

    const amount = toNumber(adjustment.amount);

    switch (adjustment.adjustment_type) {
      case "ALLOWANCE":
        additionalAllowance += amount;
        break;

      case "BONUS":
        bonusAmount += amount;
        break;

      case "DEDUCTION":
        deductionAmount += amount;
        break;
    }
  }

  /**
   * Thuế TNCN:
   *
   * Hiện chưa tự tính theo biểu thuế
   * vì còn phụ thuộc giảm trừ,
   * người phụ thuộc...
   *
   * Cho phép lưu amount riêng.
   */
  const personalIncomeTax = 0;

  const grossSalary = roundMoney(
    attendanceSalary + fixedAllowance + additionalAllowance + bonusAmount,
  );

  const netSalary = roundMoney(
    grossSalary - totalInsurance - deductionAmount - personalIncomeTax,
  );

  return {
    employee_name: user.name,

    employee_position: user.position,

    employee_type: salaryConfig.employee_type,

    base_salary: baseSalary,

    fixed_allowance: fixedAllowance,

    standard_work_days: standardDays,

    actual_work_days: actualDays,

    attendance_salary: attendanceSalary,

    has_social_insurance: salaryConfig.has_social_insurance,

    has_health_insurance: salaryConfig.has_health_insurance,

    has_unemployment_insurance: salaryConfig.has_unemployment_insurance,

    insurance_salary: insuranceSalary || null,

    social_insurance_rate: socialRate,

    health_insurance_rate: healthRate,

    unemployment_insurance_rate: unemploymentRate,

    social_insurance_amount: socialAmount,

    health_insurance_amount: healthAmount,

    unemployment_insurance_amount: unemploymentAmount,

    total_insurance_amount: totalInsurance,

    additional_allowance: additionalAllowance,

    bonus_amount: bonusAmount,

    deduction_amount: deductionAmount,

    personal_income_tax: personalIncomeTax,

    gross_salary: grossSalary,

    net_salary: netSalary,
  };
};

/**
 * POST
 * /salary/payroll/calculate/:periodId
 */
exports.calculatePayrollPeriod = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { periodId } = req.params;

    const period = await PayrollPeriod.findByPk(periodId, {
      transaction,
    });

    if (!period) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy kỳ lương",
      });
    }

    if (["PUBLISHED", "CLOSED"].includes(period.status)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Kỳ lương đã công bố hoặc đóng",
      });
    }

    const attendances = await PayrollAttendance.findAll({
      where: {
        payroll_period_id: periodId,
      },

      include: [
        {
          model: User,
          as: "user",
        },
      ],

      transaction,
    });

    if (attendances.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Kỳ lương chưa có dữ liệu công",
      });
    }

    const unconfirmed = attendances.filter(
      (item) => item.status !== "CONFIRMED",
    );

    if (unconfirmed.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Vẫn còn nhân viên chưa được xác nhận công",

        users: unconfirmed.map((item) => ({
          user_id: item.user_id,

          name: item.user?.name,

          status: item.status,
        })),
      });
    }

    const insuranceConfig = await getInsuranceConfig(
      period.end_date,
      transaction,
    );

    const result = [];

    for (const attendance of attendances) {
      const user = attendance.user;

      const salaryConfig = await getSalaryConfig(
        attendance.user_id,

        period.end_date,

        transaction,
      );

      if (!salaryConfig) {
        await transaction.rollback();

        return res.status(400).json({
          success: false,

          message: `Nhân viên ${user?.name || attendance.user_id} chưa được khai báo lương`,
        });
      }

      let payroll = await EmployeePayroll.findOne({
        where: {
          payroll_period_id: periodId,

          user_id: attendance.user_id,
        },

        transaction,
      });

      let adjustments = [];

      if (payroll) {
        adjustments = await PayrollAdjustment.findAll({
          where: {
            employee_payroll_id: payroll.employee_payroll_id,

            status: 1,
          },

          transaction,
        });
      }

      const calculated = await calculateEmployeePayroll({
        user,
        attendance,
        salaryConfig,
        insuranceConfig,
        payrollAdjustments: adjustments,
      });

      /**
       * Lần đầu tính.
       */
      if (!payroll) {
        payroll = await EmployeePayroll.create(
          {
            payroll_period_id: periodId,

            user_id: attendance.user_id,

            salary_config_id: salaryConfig.salary_config_id,

            ...calculated,

            attendance_version: attendance.attendance_version,

            payroll_version: 1,

            status: "CALCULATED",

            calculated_by: req.user?.user_id || null,

            calculated_at: new Date(),

            created_at: new Date(),
          },
          {
            transaction,
          },
        );
      } else {
        /**
         * Trước khi tính lại:
         * lưu bản cũ vào versions.
         */
        await EmployeePayrollVersion.create(
          {
            employee_payroll_id: payroll.employee_payroll_id,

            version_no: payroll.payroll_version,

            attendance_version: payroll.attendance_version,

            payroll_data: payroll.toJSON(),

            reason:
              payroll.status === "OUTDATED"
                ? "Tính lại do dữ liệu công hoặc lương thay đổi"
                : "Tính lại bảng lương",

            created_by: req.user?.user_id || null,
          },
          {
            transaction,
          },
        );

        const nextVersion = Number(payroll.payroll_version) + 1;

        await payroll.update(
          {
            salary_config_id: salaryConfig.salary_config_id,

            ...calculated,

            attendance_version: attendance.attendance_version,

            payroll_version: nextVersion,

            status: "CALCULATED",

            calculated_by: req.user?.user_id || null,

            calculated_at: new Date(),

            updated_at: new Date(),
          },
          {
            transaction,
          },
        );
      }

      await PayrollLog.create(
        {
          payroll_period_id: periodId,

          employee_payroll_id: payroll.employee_payroll_id,

          user_id: attendance.user_id,

          action:
            payroll.payroll_version > 1
              ? "RECALCULATE_PAYROLL"
              : "CALCULATE_PAYROLL",

          new_data: payroll.toJSON(),

          created_by: req.user?.user_id || null,
        },
        {
          transaction,
        },
      );

      result.push(payroll);
    }

    await period.update(
      {
        status: "CALCULATED",
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      success: true,

      message: "Tính lương thành công",

      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("calculatePayrollPeriod:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tính lương",
      error: error.message,
    });
  }
};

/**
 * GET bảng lương kỳ
 */
exports.getPayrollByPeriod = async (req, res) => {
  try {
    const { periodId } = req.params;

    const data = await EmployeePayroll.findAll({
      where: {
        payroll_period_id: periodId,
      },

      include: [
        {
          model: User,
          as: "user",

          attributes: ["user_id", "name", "position", "email", "avatar"],
        },

        {
          model: PayrollAdjustment,

          as: "adjustments",

          required: false,
        },

        {
          model: EmployeePayrollVersion,

          as: "versions",

          required: false,
        },
      ],

      order: [["employee_name", "ASC"]],
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không thể lấy bảng lương",
      error: error.message,
    });
  }
};

/**
 * GET phiếu lương 1 nhân viên
 */
exports.getEmployeePayroll = async (req, res) => {
  try {
    const { id } = req.params;

    const payroll = await EmployeePayroll.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
        },

        {
          model: PayrollAdjustment,

          as: "adjustments",
        },

        {
          model: EmployeePayrollVersion,

          as: "versions",
        },
      ],
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bảng lương",
      });
    }

    return res.json({
      success: true,
      data: payroll,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không thể lấy phiếu lương",
      error: error.message,
    });
  }
};

/**
 * POST /salary/payroll/:periodId/publish
 */
exports.publishPayrollPeriod = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { periodId } = req.params;

    const period = await PayrollPeriod.findByPk(periodId, {
      transaction,
    });

    if (!period) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy kỳ lương",
      });
    }

    const payrolls = await EmployeePayroll.findAll({
      where: {
        payroll_period_id: periodId,
      },

      transaction,
    });

    if (payrolls.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Chưa có bảng lương để công bố",
      });
    }

    const invalid = payrolls.filter((item) => item.status !== "CALCULATED");

    if (invalid.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Có bảng lương chưa hợp lệ hoặc cần tính lại",

        payrolls: invalid.map((item) => ({
          employee_payroll_id: item.employee_payroll_id,

          user_id: item.user_id,

          status: item.status,
        })),
      });
    }

    await EmployeePayroll.update(
      {
        status: "PUBLISHED",

        published_by: req.user?.user_id || null,

        published_at: new Date(),

        updated_at: new Date(),
      },
      {
        where: {
          payroll_period_id: periodId,
        },

        transaction,
      },
    );

    await period.update(
      {
        status: "PUBLISHED",

        published_by: req.user?.user_id || null,

        published_at: new Date(),
      },
      {
        transaction,
      },
    );

    await PayrollLog.create(
      {
        payroll_period_id: periodId,

        action: "PUBLISH_PAYROLL",

        description: `Công bố kỳ lương ${period.period_name}`,

        created_by: req.user?.user_id || null,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: "Công bố bảng lương thành công",
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: "Không thể công bố bảng lương",
      error: error.message,
    });
  }
};
