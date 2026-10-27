const cron = require("node-cron");

const {
  runAutomaticCompanyDiscovery,
} = require("../services/lead_ai/companyDiscovery.service");

let isRunning = false;

cron.schedule(
  "*/5 * * * *",

  async () => {
    if (isRunning) {
      console.log("[Company Discovery] Job trước chưa xong, bỏ qua.");

      return;
    }

    isRunning = true;

    try {
      console.log("[Company Discovery] Bắt đầu...");

      await runAutomaticCompanyDiscovery();
    } catch (error) {
      console.error("[Company Discovery] Scheduler error:", error.message);
    } finally {
      isRunning = false;
    }
  },

  {
    timezone: "Asia/Ho_Chi_Minh",
  },
);

console.log("[Scheduler] Company Discovery scheduler initialized");
