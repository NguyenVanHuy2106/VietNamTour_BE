const {
  runGoongAgent,
} = require("../../services/lead_ai/goongVerification.service");

let isRunning = false;

/**
 * POST /api/lead-ai/goong/process
 */
async function processGoong(req, res) {
  if (isRunning) {
    return res.status(409).json({
      success: false,

      message: "Goong Agent đang chạy.",
    });
  }

  isRunning = true;

  try {
    const limit = Math.min(Math.max(Number(req.body?.limit || 50), 1), 100);

    const result = await runGoongAgent({
      limit,
    });

    return res.json({
      success: true,

      message: `Goong đã thêm ${result.inserted} công ty đạt yêu cầu`,

      data: result,
    });
  } catch (error) {
    console.error("[Goong Agent]", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Goong Agent lỗi",
    });
  } finally {
    isRunning = false;
  }
}

module.exports = {
  processGoong,
};
