const sequelize = require("../../config/database");

const {
  EmployeePayroll,
  PayrollAdjustment,
  PayrollLog,
} = require("../../models");

exports.createPayrollAdjustment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      employee_payroll_id,

      adjustment_type,

      adjustment_name,

      amount,

      note,
    } = req.body;

    if (!["ALLOWANCE", "BONUS", "DEDUCTION"].includes(adjustment_type)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Loại điều chỉnh không hợp lệ",
      });
    }

    if (Number(amount) <= 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Số tiền phải lớn hơn 0",
      });
    }

    const payroll = await EmployeePayroll.findByPk(employee_payroll_id, {
      transaction,
    });

    if (!payroll) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bảng lương",
      });
    }

    const data = await PayrollAdjustment.create(
      {
        employee_payroll_id,

        adjustment_type,

        adjustment_name,

        amount,

        note,

        created_by: req.user?.user_id || null,

        created_at: new Date(),

        status: 1,
      },
      {
        transaction,
      },
    );

    /**
     * Thêm thưởng/phạt sau khi tính
     * => cần tính lại.
     */
    await payroll.update(
      {
        status: "OUTDATED",

        updated_at: new Date(),
      },
      {
        transaction,
      },
    );

    await PayrollLog.create(
      {
        payroll_period_id: payroll.payroll_period_id,

        employee_payroll_id: payroll.employee_payroll_id,

        user_id: payroll.user_id,

        action:
          adjustment_type === "BONUS"
            ? "ADD_BONUS"
            : adjustment_type === "ALLOWANCE"
              ? "ADD_ALLOWANCE"
              : "ADD_DEDUCTION",

        new_data: data.toJSON(),

        created_by: req.user?.user_id || null,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,

      message: "Thêm điều chỉnh lương thành công",

      data,
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: "Không thể thêm điều chỉnh lương",
      error: error.message,
    });
  }
};

exports.deletePayrollAdjustment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const adjustment = await PayrollAdjustment.findByPk(id, {
      transaction,
    });

    if (!adjustment) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khoản điều chỉnh",
      });
    }

    const payroll = await EmployeePayroll.findByPk(
      adjustment.employee_payroll_id,

      {
        transaction,
      },
    );

    await adjustment.update(
      {
        status: 0,
      },
      {
        transaction,
      },
    );

    if (payroll) {
      await payroll.update(
        {
          status: "OUTDATED",

          updated_at: new Date(),
        },
        {
          transaction,
        },
      );
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: "Đã hủy khoản điều chỉnh. Bảng lương cần tính lại.",
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: "Không thể xóa khoản điều chỉnh",
      error: error.message,
    });
  }
};
