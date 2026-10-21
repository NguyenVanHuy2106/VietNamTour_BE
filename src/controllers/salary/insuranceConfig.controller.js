const { Op } = require("sequelize");

const { User, PayrollInsuranceConfig } = require("../../models");

exports.getInsuranceConfigs = async (req, res) => {
  try {
    const data = await PayrollInsuranceConfig.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],

      order: [["effective_from", "DESC"]],
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getInsuranceConfigs:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy cấu hình bảo hiểm",
      error: error.message,
    });
  }
};

exports.createInsuranceConfig = async (req, res) => {
  try {
    const {
      effective_from,
      effective_to = null,

      employee_social_rate = 0,
      employee_health_rate = 0,
      employee_unemployment_rate = 0,

      employer_social_rate = 0,
      employer_health_rate = 0,
      employer_unemployment_rate = 0,

      note,
    } = req.body;

    if (!effective_from) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ngày bắt đầu áp dụng",
      });
    }

    const data = await PayrollInsuranceConfig.create({
      effective_from,
      effective_to,

      employee_social_rate,
      employee_health_rate,
      employee_unemployment_rate,

      employer_social_rate,
      employer_health_rate,
      employer_unemployment_rate,

      note,

      status: 1,

      created_by: req.user?.user_id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo cấu hình bảo hiểm thành công",
      data,
    });
  } catch (error) {
    console.error("createInsuranceConfig:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tạo cấu hình bảo hiểm",
      error: error.message,
    });
  }
};

/**
 * Lấy cấu hình BH đang có hiệu lực tại ngày bất kỳ
 */
exports.getActiveInsuranceConfig = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const data = await PayrollInsuranceConfig.findOne({
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
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không thể lấy cấu hình bảo hiểm",
      error: error.message,
    });
  }
};
