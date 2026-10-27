const { Op } = require("sequelize");

const { Company } = require("../../models/lead_ai");

async function cleanupCompanies() {
  const now = new Date();

  const rejectedBefore = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const errorBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const passedBefore = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  /**
   * ==========================================
   * DELETE REJECTED
   * ==========================================
   */

  const rejectedDeleted = await Company.destroy({
    where: {
      goong_status: "REJECTED",

      goong_checked_at: {
        [Op.lt]: rejectedBefore,
      },
    },
  });

  /**
   * ==========================================
   * DELETE ERROR
   * ==========================================
   */

  const errorDeleted = await Company.destroy({
    where: {
      goong_status: "ERROR",

      goong_checked_at: {
        [Op.lt]: errorBefore,
      },
    },
  });

  /**
   * ==========================================
   * DELETE PASSED
   * ==========================================
   */

  const passedDeleted = await Company.destroy({
    where: {
      goong_status: "PASSED",

      goong_checked_at: {
        [Op.lt]: passedBefore,
      },
    },
  });

  return {
    rejectedDeleted,
    errorDeleted,
    passedDeleted,

    totalDeleted: rejectedDeleted + errorDeleted + passedDeleted,
  };
}

module.exports = {
  cleanupCompanies,
};
