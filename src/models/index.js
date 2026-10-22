// File: models/index.js (hoặc file bạn dùng để thiết lập associations)

const Post = require("./posts.model");
const Tag = require("./tags.model");
const PostTag = require("./postsTag.model");
const Attendance = require("./attendance.model");
const Category = require("./categories.model");
const User = require("./user.model"); // Giả sử model User của bạn ở đây
const Config = require("./configs.model");
const InvoiceTour = require("./invoiceTour.model");
const InvoiceTourService = require("./invoiceTourService.model");
const InvoiceServiceInvoice = require("./invoiceServiceInvoice.model");

const Contract = require("./contract.model");
const ContractParty = require("./contractParty.model");
const ContractRepresentative = require("./contractRepresentative.model");
const ContractContent = require("./contractContent.model");
const ContractDeparture = require("./contractDeparture.model");
const ContractPrice = require("./contractPrice.model");
const ContractAdvance = require("./contractAdvance.model");
const ContractLegalBasis = require("./contractLegalBasis.model");

const ContractSettlement = require("./contractSettlement.model");
const ContractSettlementItem = require("./contractSettlementItem.model");
const ContractPayment = require("./contractPayment.model");
const ContractForm08a = require("./contractForm08a.model");
const ContractForm08aItem = require("./contractForm08aItem.model");

// =========================
// MODEL SALARY - MDM
// =========================
const UserSalaryConfig = require("./salary/userSalaryConfig.model");
const PayrollInsuranceConfig = require("./salary/payrollInsuranceConfig.model");
// MODEL SALARY - VNTOUR
// =========================
const PayrollPeriod = require("./salary/payrollPeriod.model");
const PayrollAttendance = require("./salary/payrollAttendance.model");
const PayrollAttendanceAdjustment = require("./salary/payrollAttendanceAdjustment.model");

const EmployeePayroll = require("./salary/employeePayroll.model");
const PayrollAdjustment = require("./salary/payrollAdjustment.model");
const EmployeePayrollVersion = require("./salary/employeePayrollVersion.model");

const PayrollLog = require("./salary/payrollLog.model");

const UserBankAccount = require("./salary/userBankAccount.model");

// Một bài viết có nhiều tags, thông qua bảng trung gian PostTag
Post.belongsToMany(Tag, {
  through: PostTag,
  foreignKey: "post_id",
  otherKey: "tag_id",
  as: "tags", // Alias bạn sẽ dùng trong include
});

// Một tag cũng có nhiều bài viết, thông qua bảng trung gian PostTag
Tag.belongsToMany(Post, {
  through: PostTag,
  foreignKey: "tag_id",
  otherKey: "post_id",
  as: "posts",
});

Category.hasMany(Post, { foreignKey: "category_id", as: "posts" });
Post.belongsTo(Category, {
  foreignKey: "category_id",
  as: "category",
});

// Quan hệ 1 nhân viên - nhiều lần chấm công
User.hasMany(Attendance, { foreignKey: "user_id", as: "attendances" });
Attendance.belongsTo(User, { foreignKey: "user_id", as: "user" });

// ================================
// ĐỐI SOÁT HÓA ĐƠN TOUR
// ================================

// 1 tour có nhiều dịch vụ
InvoiceTour.hasMany(InvoiceTourService, {
  foreignKey: "tour_id",
  as: "services",
});

InvoiceTourService.belongsTo(InvoiceTour, {
  foreignKey: "tour_id",
  as: "tour",
});

// 1 dịch vụ có nhiều hóa đơn
InvoiceTourService.hasMany(InvoiceServiceInvoice, {
  foreignKey: "service_id",
  as: "invoices",
});

InvoiceServiceInvoice.belongsTo(InvoiceTourService, {
  foreignKey: "service_id",
  as: "service",
});

// 1. CONTRACT - PARTIES
// Một hợp đồng có nhiều bên tham gia
// Thông thường:
// party_type = 1: Bên A - Khách hàng
// party_type = 2: Bên B - Công ty
// -----------------------------------------------------

Contract.hasMany(ContractParty, {
  foreignKey: "contract_id",
  as: "parties",
  onDelete: "CASCADE",
});

ContractParty.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

Contract.hasMany(ContractRepresentative, {
  foreignKey: "contract_id",
  as: "representatives",
  onDelete: "CASCADE",
});

ContractRepresentative.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

Contract.hasOne(ContractContent, {
  foreignKey: "contract_id",
  as: "contract_content",
  onDelete: "CASCADE",
});

ContractContent.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

Contract.hasMany(ContractDeparture, {
  foreignKey: "contract_id",
  as: "departures",
  onDelete: "CASCADE",
});

ContractDeparture.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

Contract.hasMany(ContractPrice, {
  foreignKey: "contract_id",
  as: "price_items",
  onDelete: "CASCADE",
});

ContractPrice.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

Contract.hasOne(ContractAdvance, {
  foreignKey: "contract_id",
  as: "advance",
  onDelete: "CASCADE",
});

ContractAdvance.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

Contract.hasMany(ContractLegalBasis, {
  foreignKey: "contract_id",
  as: "legal_bases",
  onDelete: "CASCADE",
});

ContractLegalBasis.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

// =====================================================
// CONTRACT -> SETTLEMENT
// =====================================================

Contract.hasMany(ContractSettlement, {
  foreignKey: "contract_id",
  as: "settlements",
});

ContractSettlement.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

// =====================================================
// SETTLEMENT -> ITEMS
// =====================================================

ContractSettlement.hasMany(ContractSettlementItem, {
  foreignKey: "settlement_id",
  as: "items",
});

ContractSettlementItem.belongsTo(ContractSettlement, {
  foreignKey: "settlement_id",
  as: "settlement",
});

// =====================================================
// CONTRACT -> PAYMENTS
// =====================================================

Contract.hasMany(ContractPayment, {
  foreignKey: "contract_id",
  as: "payments",
});

ContractPayment.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

// =====================================================
// CONTRACT -> FORM 08A
// =====================================================

Contract.hasMany(ContractForm08a, {
  foreignKey: "contract_id",
  as: "form08as",
});

ContractForm08a.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

// =====================================================
// FORM 08A -> ACCEPTANCE SETTLEMENT
// =====================================================

ContractSettlement.hasMany(ContractForm08a, {
  foreignKey: "acceptance_settlement_id",
  as: "form08as",
});

ContractForm08a.belongsTo(ContractSettlement, {
  foreignKey: "acceptance_settlement_id",
  as: "acceptanceSettlement",
});

// =====================================================
// FORM 08A -> ITEMS
// =====================================================

ContractForm08a.hasMany(ContractForm08aItem, {
  foreignKey: "form_08a_id",
  as: "items",
});

ContractForm08aItem.belongsTo(ContractForm08a, {
  foreignKey: "form_08a_id",
  as: "form08a",
});

// =====================================================
// SETTLEMENT ITEM -> FORM 08A ITEM
// =====================================================

ContractSettlementItem.hasMany(ContractForm08aItem, {
  foreignKey: "settlement_item_id",
  as: "form08aItems",
});

ContractForm08aItem.belongsTo(ContractSettlementItem, {
  foreignKey: "settlement_item_id",
  as: "settlementItem",
});

// ASSOCIATION: USER SALARY CONFIG
// ========================================================

User.hasMany(UserSalaryConfig, {
  foreignKey: "user_id",
  as: "salaryConfigs",
});

UserSalaryConfig.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

UserSalaryConfig.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

UserSalaryConfig.belongsTo(User, {
  foreignKey: "updated_by",
  as: "updater",
});

// ========================================================
// ASSOCIATION: INSURANCE CONFIG
// ========================================================

PayrollInsuranceConfig.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// ========================================================
// ASSOCIATION: PAYROLL PERIOD
// ========================================================

PayrollPeriod.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

PayrollPeriod.belongsTo(User, {
  foreignKey: "published_by",
  as: "publisher",
});

// ========================================================
// ASSOCIATION: PAYROLL ATTENDANCE
// ========================================================

PayrollPeriod.hasMany(PayrollAttendance, {
  foreignKey: "payroll_period_id",
  as: "attendances",
});

PayrollAttendance.belongsTo(PayrollPeriod, {
  foreignKey: "payroll_period_id",
  as: "payrollPeriod",
});

User.hasMany(PayrollAttendance, {
  foreignKey: "user_id",
  as: "payrollAttendances",
});

PayrollAttendance.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

PayrollAttendance.belongsTo(User, {
  foreignKey: "confirmed_by",
  as: "confirmer",
});

// ========================================================
// ASSOCIATION: ATTENDANCE ADJUSTMENT
// ========================================================

PayrollAttendance.hasMany(PayrollAttendanceAdjustment, {
  foreignKey: "payroll_attendance_id",
  as: "adjustments",
});

PayrollAttendanceAdjustment.belongsTo(PayrollAttendance, {
  foreignKey: "payroll_attendance_id",
  as: "payrollAttendance",
});

User.hasMany(PayrollAttendanceAdjustment, {
  foreignKey: "user_id",
  as: "payrollAttendanceAdjustments",
});

PayrollAttendanceAdjustment.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

PayrollAttendanceAdjustment.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// ========================================================
// ASSOCIATION: EMPLOYEE PAYROLL
// ========================================================

PayrollPeriod.hasMany(EmployeePayroll, {
  foreignKey: "payroll_period_id",
  as: "employeePayrolls",
});

EmployeePayroll.belongsTo(PayrollPeriod, {
  foreignKey: "payroll_period_id",
  as: "payrollPeriod",
});

User.hasMany(EmployeePayroll, {
  foreignKey: "user_id",
  as: "payrolls",
});

EmployeePayroll.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

UserSalaryConfig.hasMany(EmployeePayroll, {
  foreignKey: "salary_config_id",
  as: "payrolls",
});

EmployeePayroll.belongsTo(UserSalaryConfig, {
  foreignKey: "salary_config_id",
  as: "salaryConfig",
});

EmployeePayroll.belongsTo(User, {
  foreignKey: "calculated_by",
  as: "calculator",
});

EmployeePayroll.belongsTo(User, {
  foreignKey: "published_by",
  as: "publisher",
});

// ========================================================
// ASSOCIATION: PAYROLL ADJUSTMENT
// ========================================================

EmployeePayroll.hasMany(PayrollAdjustment, {
  foreignKey: "employee_payroll_id",
  as: "adjustments",
});

PayrollAdjustment.belongsTo(EmployeePayroll, {
  foreignKey: "employee_payroll_id",
  as: "employeePayroll",
});

PayrollAdjustment.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// ========================================================
// ASSOCIATION: PAYROLL VERSION
// ========================================================

EmployeePayroll.hasMany(EmployeePayrollVersion, {
  foreignKey: "employee_payroll_id",
  as: "versions",
});

EmployeePayrollVersion.belongsTo(EmployeePayroll, {
  foreignKey: "employee_payroll_id",
  as: "employeePayroll",
});

EmployeePayrollVersion.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// ========================================================
// ASSOCIATION: PAYROLL LOG
// ========================================================

PayrollPeriod.hasMany(PayrollLog, {
  foreignKey: "payroll_period_id",
  as: "logs",
});

PayrollLog.belongsTo(PayrollPeriod, {
  foreignKey: "payroll_period_id",
  as: "payrollPeriod",
});

EmployeePayroll.hasMany(PayrollLog, {
  foreignKey: "employee_payroll_id",
  as: "logs",
});

PayrollLog.belongsTo(EmployeePayroll, {
  foreignKey: "employee_payroll_id",
  as: "employeePayroll",
});

User.hasMany(PayrollLog, {
  foreignKey: "user_id",
  as: "payrollLogs",
});

PayrollLog.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

PayrollLog.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

// Xuất các model đã được định nghĩa mối quan hệ
module.exports = {
  Post,
  Tag,
  PostTag,
  Category,
  User,
  Attendance,
  Config,
  InvoiceTour,
  InvoiceTourService,
  InvoiceServiceInvoice,
  Contract,
  ContractParty,
  ContractRepresentative,
  ContractContent,
  ContractDeparture,
  ContractPrice,
  ContractAdvance,
  ContractLegalBasis,
  ContractSettlement,
  ContractSettlementItem,
  ContractPayment,
  ContractForm08a,
  ContractForm08aItem,
  UserSalaryConfig,
  PayrollInsuranceConfig,

  // Payroll - vntour
  PayrollPeriod,
  PayrollAttendance,
  PayrollAttendanceAdjustment,
  EmployeePayroll,
  PayrollAdjustment,
  EmployeePayrollVersion,
  PayrollLog,
  UserBankAccount,
};
