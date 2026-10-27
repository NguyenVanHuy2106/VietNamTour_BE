const cron = require("node-cron");

const {
  cleanupCompanies,
} = require("../services/lead_ai/companyCleanup.service");

cron.schedule(
  "30 2 * * *",
  async () => {
    try {
      console.log("[LeadAI Cleanup] Bắt đầu dọn dữ liệu staging...");

      const result = await cleanupCompanies();

      console.log("[LeadAI Cleanup] Hoàn tất:", result);
    } catch (error) {
      console.error("[LeadAI Cleanup] Scheduler error:", error);
    }
  },
  {
    timezone: "Asia/Ho_Chi_Minh",
  },
);

console.log("[Scheduler] Lead AI cleanup scheduler initialized");
