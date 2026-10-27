const {
  runManualDiscovery,
} = require("../../services/lead_ai/manualDiscovery.service");

const {
  runGoongAgent,
} = require("../../services/lead_ai/goongVerification.service");

/**
 * =========================================================
 * PIPELINE STATE
 * =========================================================
 *
 * V1: lưu state trong RAM.
 *
 * Nếu sau này chạy nhiều process PM2 cluster thì nên chuyển
 * state này vào DB hoặc Redis.
 */

let pipelineState = {
  running: false,

  stage: "IDLE",

  startedAt: null,

  finishedAt: null,

  here: {
    requested: 0,
    found: 0,
    inserted: 0,
    filtered: 0,
    duplicates: 0,
  },

  goong: {
    requested: 0,
    checked: 0,
    inserted: 0,
    rejected: 0,
    duplicates: 0,
    skipped: 0,
    errors: 0,
  },

  error: null,
};

/**
 * =========================================================
 * RESET STATE
 * =========================================================
 */

function resetPipelineState() {
  pipelineState = {
    running: true,

    stage: "HERE",

    startedAt: new Date(),

    finishedAt: null,

    here: {
      requested: 100,
      found: 0,
      inserted: 0,
      filtered: 0,
      duplicates: 0,
    },

    goong: {
      requested: 100,
      checked: 0,
      inserted: 0,
      rejected: 0,
      duplicates: 0,
      skipped: 0,
      errors: 0,
    },

    error: null,
  };
}

/**
 * =========================================================
 * RUN PIPELINE
 * =========================================================
 */

async function runLeadPipeline() {
  try {
    /**
     * ===============================================
     * STEP 1: HERE
     * ===============================================
     */

    pipelineState.stage = "HERE";

    //console.log("[LeadAI Pipeline] Bắt đầu HERE...");

    const hereResult = await runManualDiscovery({
      limit: 100,
    });

    pipelineState.here = {
      requested: hereResult.requested || 100,

      found: hereResult.found || 0,

      inserted: hereResult.inserted || 0,

      filtered: hereResult.filtered || 0,

      duplicates: hereResult.duplicates || 0,
    };

    // console.log(
    //   `[LeadAI Pipeline] HERE xong: ${hereResult.inserted} công ty mới`,
    // );

    /**
     * ===============================================
     * STEP 2: GOONG
     * ===============================================
     */

    pipelineState.stage = "GOONG";

    //console.log("[LeadAI Pipeline] Bắt đầu Goong...");

    const goongResult = await runGoongAgent({
      limit: 100,

      /**
       * callback để cập nhật progress
       */
      onProgress: (progress) => {
        pipelineState.goong = {
          ...pipelineState.goong,
          ...progress,
        };
      },
    });

    pipelineState.goong = {
      requested: goongResult.requested || 100,

      checked: goongResult.checked || 0,

      inserted: goongResult.inserted || 0,

      rejected: goongResult.rejected || 0,

      duplicates: goongResult.duplicates || 0,

      skipped: goongResult.skipped || 0,

      errors: Array.isArray(goongResult.errors) ? goongResult.errors.length : 0,
    };

    // console.log(
    //   `[LeadAI Pipeline] Goong xong: ${goongResult.inserted} lead sạch`,
    // );

    pipelineState.stage = "COMPLETED";

    pipelineState.finishedAt = new Date();
  } catch (error) {
    console.error("[LeadAI Pipeline]", error);

    pipelineState.stage = "ERROR";

    pipelineState.error = error.message;

    pipelineState.finishedAt = new Date();
  } finally {
    pipelineState.running = false;
  }
}

/**
 * =========================================================
 * POST /api/lead-ai/discovery/manual
 * =========================================================
 *
 * Trả response ngay.
 * Pipeline chạy tiếp trong background của Node process.
 */

async function manualDiscovery(req, res) {
  if (pipelineState.running) {
    return res.status(409).json({
      success: false,

      message: "Hệ thống đang kéo dữ liệu.",

      data: pipelineState,
    });
  }

  resetPipelineState();

  /**
   * Không await.
   *
   * API trả response trước,
   * rồi pipeline mới chạy.
   */
  setImmediate(() => {
    runLeadPipeline();
  });

  return res.json({
    success: true,

    message: "Đã bắt đầu kéo dữ liệu HERE và xử lý Goong.",

    data: {
      running: true,

      stage: "HERE",

      startedAt: pipelineState.startedAt,
    },
  });
}

/**
 * =========================================================
 * GET /api/lead-ai/discovery/status
 * =========================================================
 */

async function getDiscoveryStatus(req, res) {
  return res.json({
    success: true,

    data: pipelineState,
  });
}

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

module.exports = {
  manualDiscovery,
  getDiscoveryStatus,
};
