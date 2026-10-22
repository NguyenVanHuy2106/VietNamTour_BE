const {
  User,
  UserBankAccount,
  EmployeePayroll,
  PayrollPeriod,
} = require("../../models");

const vietqrConfig = require("../../config/vietqr.config");

// ==========================================================
// HELPERS
// ==========================================================

const removeVietnamese = (value = "") => {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

const normalizeAccountName = (value) => {
  return removeVietnamese(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
};

const normalizeTransferContent = (value) => {
  return removeVietnamese(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
};

const normalizeAccountNumber = (value) => {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
};

// ==========================================================
// GET BANKS
//
// GET /api/salary/banks
// ==========================================================

exports.getBanks = async (req, res) => {
  try {
    const response = await fetch(
      `${vietqrConfig.baseUrl}${vietqrConfig.endpoints.banks}`,
      {
        method: "GET",

        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await response.json();

    if (!response.ok || data?.code !== "00") {
      return res.status(502).json({
        success: false,

        message: data?.desc || "Không thể lấy danh sách ngân hàng.",
      });
    }

    const banks = Array.isArray(data?.data)
      ? data.data.map((bank) => ({
          id: bank.id,

          name: bank.name,

          code: bank.code,

          bin: String(bank.bin || ""),

          shortName: bank.shortName,

          logo: bank.logo,

          transferSupported: bank.transferSupported,

          lookupSupported: bank.lookupSupported,
        }))
      : [];

    return res.json({
      success: true,

      data: banks,
    });
  } catch (error) {
    console.error("getBanks error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy danh sách ngân hàng.",

      error: error.message,
    });
  }
};

// ==========================================================
// GET ALL BANK ACCOUNTS
//
// GET /api/salary/bank-accounts
// ==========================================================

exports.getAllBankAccounts = async (req, res) => {
  try {
    const accounts = await UserBankAccount.findAll({
      where: {
        status: 1,
      },

      order: [["user_id", "ASC"]],
    });

    return res.json({
      success: true,

      data: accounts,
    });
  } catch (error) {
    console.error("getAllBankAccounts error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy danh sách tài khoản ngân hàng.",

      error: error.message,
    });
  }
};

// ==========================================================
// GET BANK ACCOUNT BY USER
//
// GET /api/salary/bank-account/:userId
// ==========================================================

exports.getBankAccountByUser = async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,

        message: "user_id không hợp lệ.",
      });
    }

    const account = await UserBankAccount.findOne({
      where: {
        user_id: userId,

        status: 1,
      },
    });

    return res.json({
      success: true,

      data: account,
    });
  } catch (error) {
    console.error("getBankAccountByUser error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy tài khoản ngân hàng.",

      error: error.message,
    });
  }
};

// ==========================================================
// SAVE / UPDATE BANK ACCOUNT
//
// POST /api/salary/bank-account/save
//
// Nếu user chưa có tài khoản:
// => CREATE
//
// Nếu user đã có:
// => UPDATE
// ==========================================================

exports.saveBankAccount = async (req, res) => {
  try {
    const {
      user_id,

      bank_bin,
      bank_code,
      bank_name,
      bank_short_name,

      account_number,

      account_name,
    } = req.body;

    // ======================================================
    // USER
    // ======================================================

    const userId = Number(user_id);

    if (!userId) {
      return res.status(400).json({
        success: false,

        message: "Vui lòng chọn nhân viên.",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy nhân viên.",
      });
    }

    // ======================================================
    // NORMALIZE
    // ======================================================

    const bankBin = String(bank_bin || "").trim();

    const bankName = String(bank_name || "").trim();

    const accountNumber = normalizeAccountNumber(account_number);

    const accountName = String(account_name || "")
      .trim()
      .toUpperCase();

    // ======================================================
    // VALIDATE BANK
    // ======================================================

    if (!/^\d{6}$/.test(bankBin)) {
      return res.status(400).json({
        success: false,

        message: "BIN ngân hàng không hợp lệ.",
      });
    }

    if (!bankName) {
      return res.status(400).json({
        success: false,

        message: "Vui lòng chọn ngân hàng.",
      });
    }

    // ======================================================
    // VALIDATE ACCOUNT NUMBER
    // ======================================================

    if (!/^\d{6,19}$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,

        message: "Số tài khoản phải từ 6 đến 19 chữ số.",
      });
    }

    // ======================================================
    // VALIDATE ACCOUNT NAME
    // ======================================================

    if (!accountName) {
      return res.status(400).json({
        success: false,

        message: "Vui lòng nhập tên chủ tài khoản.",
      });
    }

    // ======================================================
    // FIND EXISTING ACCOUNT
    // ======================================================

    let account = await UserBankAccount.findOne({
      where: {
        user_id: userId,
      },
    });

    // ======================================================
    // PAYLOAD
    // ======================================================

    const payload = {
      user_id: userId,

      bank_bin: bankBin,

      bank_code: bank_code || null,

      bank_name: bankName,

      bank_short_name: bank_short_name || null,

      account_number: accountNumber,

      account_name: accountName,

      status: 1,

      updated_at: new Date(),
    };

    // ======================================================
    // UPDATE
    // ======================================================

    if (account) {
      await account.update(payload);

      return res.json({
        success: true,

        message: "Cập nhật tài khoản nhận lương thành công.",

        data: account,
      });
    }

    // ======================================================
    // CREATE
    // ======================================================

    account = await UserBankAccount.create({
      ...payload,

      created_at: new Date(),
    });

    return res.json({
      success: true,

      message: "Lưu tài khoản nhận lương thành công.",

      data: account,
    });
  } catch (error) {
    console.error("saveBankAccount error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lưu tài khoản ngân hàng.",

      error: error.message,
    });
  }
};

// ==========================================================
// DELETE BANK ACCOUNT
//
// DELETE
// /api/salary/bank-account/delete/:id
// ==========================================================

exports.deleteBankAccount = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,

        message: "ID tài khoản ngân hàng không hợp lệ.",
      });
    }

    // ======================================================
    // FIND ACCOUNT
    // ======================================================

    const account = await UserBankAccount.findByPk(id);

    if (!account) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy tài khoản ngân hàng.",
      });
    }

    // ======================================================
    // DELETE
    // ======================================================

    await account.destroy();

    return res.json({
      success: true,

      message: "Đã xoá tài khoản nhận lương thành công.",

      data: {
        user_bank_account_id: id,

        user_id: account.user_id,
      },
    });
  } catch (error) {
    console.error("deleteBankAccount error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể xoá tài khoản ngân hàng.",

      error: error.message,
    });
  }
};

// ==========================================================
// GENERATE PAYROLL QR
//
// POST
// /api/salary/payroll/generate-qr/:employeePayrollId
//
// Amount lấy trực tiếp từ net_salary.
//
// Generate QR KHÔNG đồng nghĩa với đã chi lương.
// ==========================================================

exports.generatePayrollQR = async (req, res) => {
  try {
    // ======================================================
    // VIETQR CONFIG
    // ======================================================

    if (!vietqrConfig.isConfigured()) {
      return res.status(500).json({
        success: false,

        message: "Server chưa cấu hình VietQR Client ID/API Key.",
      });
    }

    // ======================================================
    // PAYROLL ID
    // ======================================================

    const employeePayrollId = Number(req.params.employeePayrollId);

    if (!employeePayrollId) {
      return res.status(400).json({
        success: false,

        message: "employee_payroll_id không hợp lệ.",
      });
    }

    // ======================================================
    // GET PAYROLL
    // ======================================================

    const payroll = await EmployeePayroll.findByPk(employeePayrollId);

    if (!payroll) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy bảng lương.",
      });
    }

    // ======================================================
    // PHẢI PUBLISHED
    // ======================================================

    if (payroll.status !== "PUBLISHED") {
      return res.status(200).json({
        success: false,

        code: "PAYROLL_NOT_PUBLISHED",

        message: "Chỉ có thể tạo QR cho bảng lương đã công bố.",

        data: null,
      });
    }

    // ======================================================
    // KHÔNG TẠO QR NẾU ĐÃ CHI
    // ======================================================

    if (payroll.payment_status === "PAID") {
      return res.status(200).json({
        success: false,

        code: "PAYROLL_ALREADY_PAID",

        message: "Bảng lương này đã được chi. Không thể tạo lại QR thanh toán.",

        data: null,
      });
    }

    // ======================================================
    // AMOUNT
    // ======================================================

    const amount = Math.round(Number(payroll.net_salary || 0));

    if (amount <= 0) {
      return res.status(200).json({
        success: false,

        code: "INVALID_NET_SALARY",

        message: "Số tiền thực nhận không hợp lệ.",

        data: null,
      });
    }

    // ======================================================
    // GET BANK ACCOUNT
    // ======================================================

    const bankAccount = await UserBankAccount.findOne({
      where: {
        user_id: payroll.user_id,

        status: 1,
      },
    });

    // ======================================================
    // CHƯA KHAI BÁO TÀI KHOẢN
    //
    // Trạng thái nghiệp vụ bình thường.
    // Trả HTTP 200 để browser không báo 400 đỏ.
    // ======================================================

    if (!bankAccount) {
      return res.status(200).json({
        success: false,

        code: "BANK_ACCOUNT_NOT_FOUND",

        message: "Nhân viên chưa khai báo tài khoản nhận lương.",

        data: null,
      });
    }

    // ======================================================
    // THIẾU SỐ TÀI KHOẢN
    // ======================================================

    if (!bankAccount.account_number) {
      return res.status(200).json({
        success: false,

        code: "BANK_ACCOUNT_NUMBER_MISSING",

        message: "Tài khoản nhận lương của nhân viên chưa có số tài khoản.",

        data: null,
      });
    }

    // ======================================================
    // THIẾU BIN NGÂN HÀNG
    // ======================================================

    if (!bankAccount.bank_bin) {
      return res.status(200).json({
        success: false,

        code: "BANK_BIN_MISSING",

        message: "Tài khoản nhận lương chưa có thông tin ngân hàng.",

        data: null,
      });
    }

    // ======================================================
    // PERIOD
    // ======================================================

    const period = await PayrollPeriod.findByPk(payroll.payroll_period_id);

    // ======================================================
    // TRANSFER CONTENT
    // ======================================================

    const employeeName = payroll.employee_name || `NV${payroll.user_id}`;

    const periodCode = period?.period_code || "";

    const transferContent = normalizeTransferContent(
      `CONG TY TNHH TM DL VA SU KIEN VIET NAM CHI LUONG ${periodCode} ${employeeName}`,
    );

    // ======================================================
    // ACCOUNT NAME
    // ======================================================

    const accountName = normalizeAccountName(bankAccount.account_name);

    if (!accountName) {
      return res.status(200).json({
        success: false,

        code: "INVALID_ACCOUNT_NAME",

        message: "Tên chủ tài khoản không hợp lệ.",

        data: null,
      });
    }

    // ======================================================
    // GENERATE VIETQR
    // ======================================================

    const response = await fetch(
      `${vietqrConfig.baseUrl}${vietqrConfig.endpoints.generate}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "x-client-id": vietqrConfig.clientId,

          "x-api-key": vietqrConfig.apiKey,
        },

        body: JSON.stringify({
          accountNo: bankAccount.account_number,

          accountName: accountName,

          acqId: Number(bankAccount.bank_bin),

          amount: amount,

          addInfo: transferContent,

          template: "compact2",
        }),
      },
    );

    const data = await response.json();

    // ======================================================
    // VIETQR ERROR
    //
    // Đây là lỗi kỹ thuật/API thật sự
    // nên vẫn giữ 502.
    // ======================================================

    if (!response.ok || data?.code !== "00" || !data?.data?.qrDataURL) {
      return res.status(502).json({
        success: false,

        code: "VIETQR_GENERATE_FAILED",

        message: data?.desc || "Không thể tạo mã VietQR.",

        vietqr_code: data?.code || null,
      });
    }

    // ======================================================
    // SUCCESS
    // ======================================================

    return res.json({
      success: true,

      message: "Tạo VietQR thành công.",

      data: {
        employee_payroll_id: payroll.employee_payroll_id,

        payroll_period_id: payroll.payroll_period_id,

        user_id: payroll.user_id,

        employee_name: employeeName,

        amount: amount,

        payment_status: payroll.payment_status || "UNPAID",

        transfer_content: transferContent,

        bank: {
          bin: bankAccount.bank_bin,

          code: bankAccount.bank_code,

          name: bankAccount.bank_name,

          short_name: bankAccount.bank_short_name,

          account_number: bankAccount.account_number,

          account_name: bankAccount.account_name,
        },

        qr_code: data.data.qrCode,

        qr_data_url: data.data.qrDataURL,
      },
    });
  } catch (error) {
    console.error("generatePayrollQR error:", error);

    return res.status(500).json({
      success: false,

      code: "INTERNAL_SERVER_ERROR",

      message: "Không thể tạo mã QR thanh toán lương.",

      error: error.message,
    });
  }
};
