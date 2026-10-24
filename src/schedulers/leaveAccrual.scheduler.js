const cron = require("node-cron");

const {
  runAutomaticLeaveAccrual,
} = require("../services/leave/leaveAccrual.service");

// Chạy 00:10 mỗi ngày
cron.schedule(
  "10 0 * * *",
  async () => {
    try {
      console.log("[Leave Accrual] Bắt đầu kiểm tra phép...");

      await runAutomaticLeaveAccrual();
    } catch (error) {
      console.error("[Leave Accrual] Scheduler error:", error);
    }
  },
  {
    timezone: "Asia/Ho_Chi_Minh",
  },
);

console.log("[Scheduler] Leave accrual scheduler initialized");
