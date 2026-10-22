const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middlewares/auth");

// =========================
// CONTROLLERS
// =========================

const {
  getSalaryConfigs,
  getSalaryConfigById,
  getSalaryHistoryByUser,
  createSalaryConfig,
  updateSalaryConfig,
  createNewSalaryVersion,
} = require("../controllers/salary/salaryConfig.controller");

const {
  getInsuranceConfigs,
  createInsuranceConfig,
  getActiveInsuranceConfig,
} = require("../controllers/salary/insuranceConfig.controller");

const {
  getPayrollPeriods,
  getPayrollPeriodById,
  createPayrollPeriod,
  updatePayrollPeriod,
  deletePayrollPeriod,
} = require("../controllers/salary/payrollPeriod.controller");

const {
  getPayrollAttendances,
  importPayrollAttendances,
  syncPayrollAttendance,
  adjustAttendance,
  confirmAttendance,
  confirmAllAttendance,
} = require("../controllers/salary/payrollAttendance.controller");

const {
  calculatePayrollPeriod,
  getPayrollByPeriod,
  getEmployeePayroll,
  publishPayrollPeriod,
  markPayrollPaid,
} = require("../controllers/salary/payroll.controller");

const {
  getPayrollLogs,
} = require("../controllers/salary/payrollLog.controller");

const {
  createPayrollAdjustment,
  deletePayrollAdjustment,
} = require("../controllers/salary/payrollAdjustment.controller");

const {
  getMyPayrolls,
  getMyPayrollDetail,
} = require("../controllers/salary/myPayroll.controller");

const {
  getBanks,
  getAllBankAccounts,
  getBankAccountByUser,
  saveBankAccount,
  deleteBankAccount,
  generatePayrollQR,
} = require("../controllers/salary/bankPayment.controller");

// ======================================================
// 1. KHAI BÁO LƯƠNG NHÂN VIÊN
// ======================================================

// Lấy danh sách cấu hình lương
router.get("/api/salary/config/get", verifyToken, getSalaryConfigs);

// Lấy cấu hình lương theo ID
router.get("/api/salary/config/get/:id", verifyToken, getSalaryConfigById);

// Lấy lịch sử lương của 1 nhân viên
router.get(
  "/api/salary/config/user/:userId",
  verifyToken,
  getSalaryHistoryByUser,
);

// Khai báo lương mới
router.post("/api/salary/config/add", verifyToken, createSalaryConfig);

// Cập nhật cấu hình lương
router.post("/api/salary/config/update/:id", verifyToken, updateSalaryConfig);

// Tạo phiên bản lương mới
// Ví dụ:
// thực tập -> chính thức
// 6.5tr -> 7tr
router.post(
  "/api/salary/config/new-version/:id",
  verifyToken,
  createNewSalaryVersion,
);

// ======================================================
// 2. CẤU HÌNH BẢO HIỂM
// ======================================================

// Danh sách cấu hình BH
router.get("/api/salary/insurance/get", verifyToken, getInsuranceConfigs);

// Lấy cấu hình BH đang có hiệu lực
// Ví dụ:
// /api/salary/insurance/active?date=2026-10-20
router.get(
  "/api/salary/insurance/active",
  verifyToken,
  getActiveInsuranceConfig,
);

// Tạo cấu hình BH mới
router.post("/api/salary/insurance/add", verifyToken, createInsuranceConfig);

// ======================================================
// 3. KỲ LƯƠNG
// ======================================================

// Danh sách kỳ lương
router.get("/api/salary/period/get", verifyToken, getPayrollPeriods);

// Chi tiết kỳ lương
router.get("/api/salary/period/get/:id", verifyToken, getPayrollPeriodById);

// Tạo kỳ lương
router.post("/api/salary/period/add", verifyToken, createPayrollPeriod);

// Cập nhật kỳ lương
router.post("/api/salary/period/update/:id", verifyToken, updatePayrollPeriod);

router.delete(
  "/api/salary/period/delete/:id",
  verifyToken,
  deletePayrollPeriod,
);
// ======================================================
// 4. CHẤM CÔNG / XÁC NHẬN CÔNG
// ======================================================

// Lấy danh sách công
// Ví dụ:
// /api/salary/attendance/get?payroll_period_id=1
router.get("/api/salary/attendance/get", verifyToken, getPayrollAttendances);

// Nạp công vào kỳ lương
router.post(
  "/api/salary/attendance/import",
  verifyToken,
  importPayrollAttendances,
);

// Điều chỉnh công
// ADD / DEDUCT
router.post("/api/salary/attendance/adjust/:id", verifyToken, adjustAttendance);

// Xác nhận công 1 nhân viên
router.post(
  "/api/salary/attendance/confirm/:id",
  verifyToken,
  confirmAttendance,
);

// Xác nhận toàn bộ công trong kỳ
router.post(
  "/api/salary/attendance/confirm-all",
  verifyToken,
  confirmAllAttendance,
);

router.post("/api/salary/attendance/sync", syncPayrollAttendance);
// ======================================================
// 5. TÍNH LƯƠNG
// ======================================================

// Tính toàn bộ lương trong kỳ
//
// Nếu đã từng tính rồi:
// => tự tính lại
// => tăng payroll_version
//
// Ví dụ:
// POST /api/salary/payroll/calculate/1
router.post(
  "/api/salary/payroll/calculate/:periodId",
  verifyToken,
  calculatePayrollPeriod,
);

// Lấy bảng lương theo kỳ
router.get(
  "/api/salary/payroll/period/:periodId",
  verifyToken,
  getPayrollByPeriod,
);

// Lấy phiếu lương 1 nhân viên
router.get("/api/salary/payroll/get/:id", verifyToken, getEmployeePayroll);

// ======================================================
// 6. THƯỞNG / PHỤ CẤP / KHẤU TRỪ
// ======================================================

// Thêm:
// ALLOWANCE
// BONUS
// DEDUCTION
router.post(
  "/api/salary/payroll/adjustment/add",
  verifyToken,
  createPayrollAdjustment,
);

// Hủy khoản điều chỉnh
router.delete(
  "/api/salary/payroll/adjustment/delete/:id",
  verifyToken,
  deletePayrollAdjustment,
);

// ======================================================
// 7. CÔNG BỐ BẢNG LƯƠNG
// ======================================================

// Công bố toàn bộ bảng lương
router.post(
  "/api/salary/payroll/publish/:periodId",
  verifyToken,
  publishPayrollPeriod,
);

// ======================================================
// 8. LỊCH SỬ / AUDIT LOG
// ======================================================

// Ví dụ:
//
// /api/salary/log/get?payroll_period_id=1
//
// hoặc:
//
// /api/salary/log/get?user_id=12
router.get("/api/salary/log/get", verifyToken, getPayrollLogs);

// ==========================================================
// LƯƠNG NHÂN VIÊN
// ==========================================================

router.get("/api/salary/my-payroll", verifyToken, getMyPayrolls);

router.get("/api/salary/my-payroll/:id", verifyToken, getMyPayrollDetail);

// ==========================================================
// VIETQR / BANK ACCOUNT
// ==========================================================
router.get("/api/salary/banks", verifyToken, getBanks);

router.get("/api/salary/bank-accounts", verifyToken, getAllBankAccounts);

router.get(
  "/api/salary/bank-account/:userId",
  verifyToken,
  getBankAccountByUser,
);

router.post("/api/salary/bank-account/save", verifyToken, saveBankAccount);

router.delete(
  "/api/salary/bank-account/delete/:id",
  verifyToken,
  deleteBankAccount,
);

router.post(
  "/api/salary/payroll/generate-qr/:employeePayrollId",
  verifyToken,
  generatePayrollQR,
);

module.exports = router;
