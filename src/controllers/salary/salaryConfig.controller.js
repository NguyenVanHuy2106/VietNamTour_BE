const { Op } = require("sequelize");
const sequelize = require("../../config/database");

const { User, UserSalaryConfig } = require("../../models");

/**
 * GET /salary/configs
 * Danh sách toàn bộ khai báo lương
 */
exports.getSalaryConfigs = async (req, res) => {
  try {
    const { user_id, employee_type, status = 1 } = req.query;

    const where = {};

    if (user_id) {
      where.user_id = user_id;
    }

    if (employee_type) {
      where.employee_type = employee_type;
    }

    if (status !== undefined && status !== "") {
      where.status = Number(status);
    }

    const data = await UserSalaryConfig.findAll({
      where,

      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "user_id",
            "name",
            "email",
            "phone",
            "position",
            "role",
            "avatar",
            "status",
          ],
        },
      ],

      order: [
        ["user_id", "ASC"],
        ["effective_from", "DESC"],
      ],
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getSalaryConfigs:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách cấu hình lương",
      error: error.message,
    });
  }
};

/**
 * GET /salary/configs/:id
 */
exports.getSalaryConfigById = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await UserSalaryConfig.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "name", "email", "phone", "position", "role"],
        },
      ],
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cấu hình lương",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getSalaryConfigById:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin cấu hình lương",
      error: error.message,
    });
  }
};

/**
 * GET /salary/configs/user/:userId
 *
 * Lịch sử cấu hình lương của 1 nhân viên
 */
exports.getSalaryHistoryByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Nhân viên không tồn tại",
      });
    }

    const configs = await UserSalaryConfig.findAll({
      where: {
        user_id: userId,
      },

      order: [
        ["effective_from", "DESC"],
        ["salary_config_id", "DESC"],
      ],
    });

    return res.status(200).json({
      success: true,

      data: {
        user,
        configs,
      },
    });
  } catch (error) {
    console.error("getSalaryHistoryByUser:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy lịch sử lương",
      error: error.message,
    });
  }
};

/**
 * POST /salary/configs
 *
 * Tạo cấu hình lương mới
 */
exports.createSalaryConfig = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      user_id,

      employee_type,

      salary_name,

      base_salary = 0,

      fixed_allowance = 0,

      salary_by_attendance = true,

      has_social_insurance = false,
      has_health_insurance = false,
      has_unemployment_insurance = false,

      insurance_salary = null,

      has_personal_income_tax = false,

      effective_from,
      effective_to = null,

      note = null,
    } = req.body;

    if (!user_id) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Thiếu user_id",
      });
    }

    if (!employee_type) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Thiếu loại nhân sự",
      });
    }

    if (!effective_from) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Thiếu ngày bắt đầu áp dụng",
      });
    }

    const user = await User.findByPk(user_id, {
      transaction,
    });

    if (!user) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Nhân viên không tồn tại",
      });
    }

    /**
     * Kiểm tra khoảng hiệu lực có bị trùng không.
     */
    const overlapping = await UserSalaryConfig.findOne({
      where: {
        user_id,

        status: 1,

        effective_from: {
          [Op.lte]: effective_to || "9999-12-31",
        },

        [Op.or]: [
          {
            effective_to: null,
          },
          {
            effective_to: {
              [Op.gte]: effective_from,
            },
          },
        ],
      },

      transaction,
    });

    if (overlapping) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Khoảng thời gian cấu hình lương bị trùng với cấu hình hiện tại",
        conflict: overlapping,
      });
    }

    const isInsuranceEmployee =
      employee_type === "OFFICIAL" ||
      has_social_insurance ||
      has_health_insurance ||
      has_unemployment_insurance;

    if (
      isInsuranceEmployee &&
      (has_social_insurance ||
        has_health_insurance ||
        has_unemployment_insurance) &&
      (!insurance_salary || Number(insurance_salary) <= 0)
    ) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Nhân viên tham gia bảo hiểm phải khai báo mức lương đóng bảo hiểm",
      });
    }

    const data = await UserSalaryConfig.create(
      {
        user_id,

        employee_type,

        salary_name,

        base_salary,

        fixed_allowance,

        salary_by_attendance,

        has_social_insurance,
        has_health_insurance,
        has_unemployment_insurance,

        insurance_salary:
          has_social_insurance ||
          has_health_insurance ||
          has_unemployment_insurance
            ? insurance_salary
            : null,

        has_personal_income_tax,

        effective_from,
        effective_to,

        note,

        status: 1,

        created_by: req.user?.user_id || null,
        created_at: new Date(),
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Khai báo lương thành công",
      data,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("createSalaryConfig:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể khai báo lương",
      error: error.message,
    });
  }
};

/**
 * PUT /salary/configs/:id
 *
 * Chỉ nên dùng sửa lỗi dữ liệu.
 * Nếu tăng/đổi lương => dùng createNewSalaryVersion.
 */
exports.updateSalaryConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const config = await UserSalaryConfig.findByPk(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cấu hình lương",
      });
    }

    const allowedFields = [
      "salary_name",

      "base_salary",
      "fixed_allowance",

      "salary_by_attendance",

      "has_social_insurance",
      "has_health_insurance",
      "has_unemployment_insurance",

      "insurance_salary",

      "has_personal_income_tax",

      "effective_from",
      "effective_to",

      "note",
      "status",
    ];

    const updateData = {};

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    updateData.updated_by = req.user?.user_id || null;

    updateData.updated_at = new Date();

    await config.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Cập nhật cấu hình lương thành công",
      data: config,
    });
  } catch (error) {
    console.error("updateSalaryConfig:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật cấu hình lương",
      error: error.message,
    });
  }
};

/**
 * POST /salary/configs/:id/new-version
 *
 * Ví dụ:
 *
 * Thực tập 3tr
 * =>
 * Chính thức 6.5tr
 *
 * Hoặc:
 * 6.5tr => 7tr
 *
 * Không sửa record cũ.
 */
exports.createNewSalaryVersion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const oldConfig = await UserSalaryConfig.findByPk(id, {
      transaction,
    });

    if (!oldConfig) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cấu hình lương hiện tại",
      });
    }

    const {
      effective_from,

      employee_type = oldConfig.employee_type,

      salary_name = oldConfig.salary_name,

      base_salary = oldConfig.base_salary,

      fixed_allowance = oldConfig.fixed_allowance,

      salary_by_attendance = oldConfig.salary_by_attendance,

      has_social_insurance = oldConfig.has_social_insurance,

      has_health_insurance = oldConfig.has_health_insurance,

      has_unemployment_insurance = oldConfig.has_unemployment_insurance,

      insurance_salary = oldConfig.insurance_salary,

      has_personal_income_tax = oldConfig.has_personal_income_tax,

      note,
    } = req.body;

    if (!effective_from) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Phải khai báo effective_from cho cấu hình mới",
      });
    }

    const newStart = new Date(`${effective_from}T00:00:00`);

    const oldStart = new Date(`${oldConfig.effective_from}T00:00:00`);

    if (newStart <= oldStart) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Ngày áp dụng mới phải sau ngày áp dụng của cấu hình cũ",
      });
    }

    const oldEnd = new Date(newStart);

    oldEnd.setDate(oldEnd.getDate() - 1);

    const oldEndString = oldEnd.toISOString().slice(0, 10);

    await oldConfig.update(
      {
        effective_to: oldEndString,

        updated_by: req.user?.user_id || null,

        updated_at: new Date(),
      },
      {
        transaction,
      },
    );

    const newConfig = await UserSalaryConfig.create(
      {
        user_id: oldConfig.user_id,

        employee_type,

        salary_name,

        base_salary,

        fixed_allowance,

        salary_by_attendance,

        has_social_insurance,
        has_health_insurance,
        has_unemployment_insurance,

        insurance_salary:
          has_social_insurance ||
          has_health_insurance ||
          has_unemployment_insurance
            ? insurance_salary
            : null,

        has_personal_income_tax,

        effective_from,

        effective_to: null,

        note,

        status: 1,

        created_by: req.user?.user_id || null,

        created_at: new Date(),
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Đã tạo phiên bản lương mới",
      data: {
        old_config: oldConfig,
        new_config: newConfig,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("createNewSalaryVersion:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tạo phiên bản lương mới",
      error: error.message,
    });
  }
};
