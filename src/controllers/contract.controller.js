// File: src/controllers/contract.controller.js

const { Op } = require("sequelize");
const sequelize = require("../config/database");

const {
  Contract,
  ContractParty,
  ContractRepresentative,
  ContractContent,
  ContractDeparture,
  ContractPrice,
  ContractAdvance,
  ContractLegalBasis,
} = require("../models");
const {
  generateContractPdf,
  generateContractWord,
} = require("../utils/contractExport");

// =====================================================
// CONSTANT
// =====================================================

// contract_type
// 1 = Dịch vụ du lịch
// 2 = Sự kiện
// 3 = Vận chuyển

const CONTRACT_TYPE = {
  TRAVEL: 1,
  EVENT: 2,
  TRANSPORT: 3,
};

// status
// 0 = Nháp
// 1 = Đã ký
// 2 = Đang thực hiện
// 3 = Đã thanh lý
// 4 = Đã hủy

const CONTRACT_STATUS = {
  DRAFT: 0,
  SIGNED: 1,
  PROCESSING: 2,
  LIQUIDATED: 3,
  CANCELLED: 4,
};

// vat_type
// 1 = Đã bao gồm VAT
// 2 = Chưa bao gồm VAT
// 3 = Không tính VAT

const VAT_TYPE = {
  INCLUDED: 1,
  EXCLUDED: 2,
  NO_VAT: 3,
};

// =====================================================
// HELPER
// =====================================================

// -----------------------------------------------------
// Convert contract type DB -> FE
// -----------------------------------------------------
const getContractTypeCode = (type) => {
  switch (Number(type)) {
    case CONTRACT_TYPE.TRAVEL:
      return "travel";

    case CONTRACT_TYPE.EVENT:
      return "event";

    case CONTRACT_TYPE.TRANSPORT:
      return "transport";

    default:
      return null;
  }
};

const getContractTypeName = (type) => {
  switch (Number(type)) {
    case CONTRACT_TYPE.TRAVEL:
      return "Hợp đồng dịch vụ du lịch";

    case CONTRACT_TYPE.EVENT:
      return "Hợp đồng dịch vụ sự kiện";

    case CONTRACT_TYPE.TRANSPORT:
      return "Hợp đồng vận chuyển";

    default:
      return "Không xác định";
  }
};

// -----------------------------------------------------
// Convert status DB -> FE
// -----------------------------------------------------
const getStatusCode = (status) => {
  switch (Number(status)) {
    case CONTRACT_STATUS.DRAFT:
      return "draft";

    case CONTRACT_STATUS.SIGNED:
      return "signed";

    case CONTRACT_STATUS.PROCESSING:
      return "processing";

    case CONTRACT_STATUS.LIQUIDATED:
      return "liquidated";

    case CONTRACT_STATUS.CANCELLED:
      return "cancelled";

    default:
      return "draft";
  }
};

const getStatusName = (status) => {
  switch (Number(status)) {
    case CONTRACT_STATUS.DRAFT:
      return "Nháp";

    case CONTRACT_STATUS.SIGNED:
      return "Đã ký kết";

    case CONTRACT_STATUS.PROCESSING:
      return "Đang thực hiện";

    case CONTRACT_STATUS.LIQUIDATED:
      return "Đã thanh lý";

    case CONTRACT_STATUS.CANCELLED:
      return "Đã hủy";

    default:
      return "Không xác định";
  }
};

// -----------------------------------------------------
// Convert giá trị FE -> DB
// FE có thể gửi:
// INCLUDED / EXCLUDED / NO_VAT
// hoặc 1 / 2 / 3
// -----------------------------------------------------
const normalizeVatType = (vatType) => {
  if (vatType === undefined || vatType === null || vatType === "") {
    return VAT_TYPE.INCLUDED;
  }

  if (!Number.isNaN(Number(vatType))) {
    return Number(vatType);
  }

  switch (String(vatType).toUpperCase()) {
    case "INCLUDED":
      return VAT_TYPE.INCLUDED;

    case "EXCLUDED":
      return VAT_TYPE.EXCLUDED;

    case "NO_VAT":
      return VAT_TYPE.NO_VAT;

    default:
      return VAT_TYPE.INCLUDED;
  }
};

// -----------------------------------------------------
// Convert contract_type FE -> DB
// FE có thể gửi:
// travel/event/transport
// hoặc 1/2/3
// -----------------------------------------------------
const normalizeContractType = (type) => {
  if (!Number.isNaN(Number(type))) {
    return Number(type);
  }

  switch (String(type).toLowerCase()) {
    case "travel":
      return CONTRACT_TYPE.TRAVEL;

    case "event":
      return CONTRACT_TYPE.EVENT;

    case "transport":
      return CONTRACT_TYPE.TRANSPORT;

    default:
      return null;
  }
};

// -----------------------------------------------------
// Convert status FE -> DB
// -----------------------------------------------------
const normalizeStatus = (status) => {
  if (status === undefined || status === null || status === "") {
    return CONTRACT_STATUS.DRAFT;
  }

  if (!Number.isNaN(Number(status))) {
    return Number(status);
  }

  switch (String(status).toUpperCase()) {
    case "DRAFT":
      return CONTRACT_STATUS.DRAFT;

    case "SIGNED":
      return CONTRACT_STATUS.SIGNED;

    case "ACTIVE":
    case "PROCESSING":
      return CONTRACT_STATUS.PROCESSING;

    case "LIQUIDATED":
      return CONTRACT_STATUS.LIQUIDATED;

    case "CANCELLED":
      return CONTRACT_STATUS.CANCELLED;

    default:
      return CONTRACT_STATUS.DRAFT;
  }
};

// -----------------------------------------------------
// Tính giá trị hợp đồng
// -----------------------------------------------------
const calculateContractAmount = (
  priceItems = [],
  vatTypeValue,
  vatRateValue,
) => {
  const vatType = normalizeVatType(vatTypeValue);

  const vatRate = Number(vatRateValue) || 0;

  let lineTotal = 0;

  const normalizedItems = priceItems.map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;

    const amount = quantity * unitPrice;

    lineTotal += amount;

    return {
      item_name: item.item_name,
      quantity,
      unit: item.unit || "",
      unit_price: unitPrice,
      amount,
      vat_type: vatType,
      vat_rate: vatRate,
      sort_order: index + 1,
    };
  });

  let contractValue = lineTotal;
  let vatAmount = 0;
  let totalAmount = lineTotal;

  // Chưa VAT => cộng thêm VAT
  if (vatType === VAT_TYPE.EXCLUDED) {
    vatAmount = lineTotal * (vatRate / 100);

    totalAmount = lineTotal + vatAmount;
  }

  // INCLUDED và NO_VAT
  // tổng giá trị = tổng bảng giá
  if (vatType === VAT_TYPE.INCLUDED || vatType === VAT_TYPE.NO_VAT) {
    vatAmount = 0;
    totalAmount = lineTotal;
  }

  return {
    priceItems: normalizedItems,

    contractValue: Math.round(contractValue),

    vatAmount: Math.round(vatAmount),

    totalAmount: Math.round(totalAmount),
  };
};

// -----------------------------------------------------
// Convert calc_type tạm ứng
// -----------------------------------------------------
const normalizeAdvanceCalcType = (calcType) => {
  if (!Number.isNaN(Number(calcType))) {
    return Number(calcType);
  }

  if (String(calcType).toUpperCase() === "PERCENT") {
    return 1;
  }

  if (String(calcType).toUpperCase() === "AMOUNT") {
    return 2;
  }

  return null;
};

// -----------------------------------------------------
// INCLUDE CHI TIẾT HỢP ĐỒNG
// -----------------------------------------------------
const contractDetailInclude = [
  {
    model: ContractParty,
    as: "parties",
  },

  {
    model: ContractRepresentative,
    as: "representatives",
  },

  {
    model: ContractContent,
    as: "contract_content",
  },

  {
    model: ContractDeparture,
    as: "departures",
    separate: true,
    order: [["sort_order", "ASC"]],
  },

  {
    model: ContractPrice,
    as: "price_items",
    separate: true,
    order: [["sort_order", "ASC"]],
  },

  {
    model: ContractAdvance,
    as: "advance",
  },

  {
    model: ContractLegalBasis,
    as: "legal_bases",
    separate: true,
    order: [["sort_order", "ASC"]],
  },
];

// =====================================================
// TẠO HỢP ĐỒNG
// =====================================================
exports.createContract = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      contract_code,
      contract_name,
      contract_type,

      customer_id,
      template_id,

      signed_date,
      signed_place,

      vat_type,
      vat_rate,

      status,
      note,

      created_by,

      customer_profile,
      company_profile,

      representatives = [],

      contract_content,

      departures = [],

      price_items = [],

      advance,

      legal_bases = [],
    } = req.body;

    // ========================================
    // VALIDATE
    // ========================================

    if (!contract_code || !contract_name) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Số hợp đồng và tên hợp đồng là bắt buộc",
      });
    }

    const normalizedContractType = normalizeContractType(contract_type);

    if (!normalizedContractType) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Loại hợp đồng không hợp lệ",
      });
    }

    if (!price_items || price_items.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Hợp đồng phải có ít nhất một hạng mục giá",
      });
    }

    // ========================================
    // KIỂM TRA SỐ HỢP ĐỒNG
    // ========================================

    const existedContract = await Contract.findOne({
      where: {
        contract_code,
      },
      transaction,
    });

    if (existedContract) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Số hợp đồng đã tồn tại",
      });
    }

    // ========================================
    // TÍNH GIÁ HỢP ĐỒNG
    // ========================================

    const normalizedVatType = normalizeVatType(vat_type);

    const calculated = calculateContractAmount(
      price_items,
      normalizedVatType,
      vat_rate,
    );

    // ========================================
    // TẠO CONTRACT
    // ========================================

    const contract = await Contract.create(
      {
        contract_code,
        contract_name,

        contract_type: normalizedContractType,

        customer_id: customer_id || null,
        template_id: template_id || null,

        signed_date: signed_date || null,
        signed_place,

        vat_type: normalizedVatType,
        vat_rate: Number(vat_rate) || 0,

        contract_value: calculated.contractValue,
        vat_amount: calculated.vatAmount,
        total_amount: calculated.totalAmount,

        amount_in_words: req.body.amount_in_words || null,

        status: normalizeStatus(status),

        note,

        created_by: created_by || null,
        created_at: new Date(),
      },
      {
        transaction,
      },
    );

    const contractId = contract.contract_id;

    // ========================================
    // BÊN A - KHÁCH HÀNG
    // ========================================

    if (customer_profile) {
      await ContractParty.create(
        {
          contract_id: contractId,

          party_type: 1,

          company_name: customer_profile.company_name || "",

          tax_code: customer_profile.tax_code || null,

          budget_code: customer_profile.budget_code || null,

          address: customer_profile.address || null,

          phone: customer_profile.phone || null,

          bank_account: customer_profile.bank_account || null,

          created_by: created_by || null,
          created_at: new Date(),
        },
        {
          transaction,
        },
      );
    }

    // ========================================
    // BÊN B - CÔNG TY
    // ========================================

    // ========================================
    // BÊN B - CÔNG TY
    // ========================================

    if (company_profile) {
      await ContractParty.create(
        {
          contract_id: contractId,

          party_type: 2,

          company_name: company_profile.company_name || "",

          tax_code: company_profile.tax_code || null,

          budget_code: company_profile.budget_code || null,

          address: company_profile.address || null,

          // ĐỊA CHỈ LIÊN HỆ
          company_contact_address:
            company_profile.company_contact_address || null,

          phone: company_profile.phone || null,

          bank_account: company_profile.bank_account || null,

          created_by: created_by || null,
          created_at: new Date(),
        },
        {
          transaction,
        },
      );
    }

    // ========================================
    // NGƯỜI ĐẠI DIỆN
    // ========================================

    if (representatives.length > 0) {
      const representativeRows = representatives.map((item) => ({
        contract_id: contractId,

        rep_type:
          String(item.rep_type).toUpperCase() === "CUSTOMER"
            ? 1
            : String(item.rep_type).toUpperCase() === "COMPANY"
              ? 2
              : Number(item.rep_type),

        rep_name: item.rep_name || null,

        rep_title: item.rep_title || null,

        note: item.note || null,

        created_by: created_by || null,
        created_at: new Date(),
      }));

      await ContractRepresentative.bulkCreate(representativeRows, {
        transaction,
      });
    }

    // ========================================
    // NỘI DUNG HỢP ĐỒNG
    // ========================================

    // ========================================
    // NỘI DUNG HỢP ĐỒNG
    // ========================================

    if (contract_content) {
      await ContractContent.create(
        {
          contract_id: contractId,

          // ========================================
          // ĐIỀU 1
          // ========================================

          work_content: contract_content?.work_content || null,

          service_content: contract_content?.service_content || null,

          tour_program: contract_content?.tour_program || null,

          priority_documents: contract_content?.priority_documents || null,

          extra_volume: contract_content?.extra_volume || null,

          // ========================================
          // ĐIỀU 2
          // ========================================

          // 2.3. Dịch vụ bao gồm
          included_services: contract_content?.included_services || null,

          // 2.4. Dịch vụ không bao gồm
          excluded_services: contract_content?.excluded_services || null,

          // ========================================
          // ĐIỀU 3
          // ========================================

          payment_content: contract_content?.payment_content || null,

          payment_schedule_content:
            contract_content?.payment_schedule_content || null,

          // 3.4 / 3.5 - Chậm thanh toán
          late_payment: contract_content?.late_payment || null,

          // ========================================
          // CÁC ĐIỀU CÒN LẠI
          // ========================================

          article_4: contract_content?.article_4 || null,

          article_5: contract_content?.article_5 || null,

          article_6: contract_content?.article_6 || null,

          article_7: contract_content?.article_7 || null,

          article_8: contract_content?.article_8 || null,

          article_9: contract_content?.article_9 || null,

          article_10: contract_content?.article_10 || null,

          article_11: contract_content?.article_11 || null,

          // ========================================
          // SYSTEM
          // ========================================

          created_by: created_by || null,

          created_at: new Date(),
        },
        {
          transaction,
        },
      );
    }

    // ========================================
    // ĐỢT THỰC HIỆN
    // ========================================

    if (departures.length > 0) {
      const departureRows = departures.map((item, index) => ({
        contract_id: contractId,

        departure_name:
          item.departure_name || `Đợt ${String(index + 1).padStart(2, "0")}`,

        start_date: item.start_date,

        end_date: item.end_date,

        sort_order: index + 1,

        created_by: created_by || null,
        created_at: new Date(),
      }));

      await ContractDeparture.bulkCreate(departureRows, {
        transaction,
      });
    }

    // ========================================
    // BẢNG GIÁ
    // ========================================

    const priceRows = calculated.priceItems.map((item) => ({
      contract_id: contractId,

      ...item,

      created_by: created_by || null,
      created_at: new Date(),
    }));

    await ContractPrice.bulkCreate(priceRows, {
      transaction,
    });

    // ========================================
    // TẠM ỨNG
    // ========================================

    if (advance) {
      const calcType = normalizeAdvanceCalcType(advance.calc_type);

      let advanceAmount = 0;

      if (advance.is_advance) {
        // Theo phần trăm
        if (calcType === 1) {
          advanceAmount =
            calculated.totalAmount *
            ((Number(advance.advance_percent) ||
              Number(advance.advance_rate) ||
              0) /
              100);
        }

        // Theo số tiền
        if (calcType === 2) {
          advanceAmount = Number(advance.advance_amount) || 0;
        }
      }

      await ContractAdvance.create(
        {
          contract_id: contractId,

          is_advance: Boolean(advance.is_advance),

          calc_type: calcType,

          advance_rate:
            calcType === 1
              ? Number(advance.advance_percent || advance.advance_rate || 0)
              : null,

          advance_amount: Math.round(advanceAmount),

          due_date: advance.due_date ?? advance.advance_date ?? null,

          payment_date: advance.payment_date || null,

          note: advance.note || null,

          created_by: created_by || null,
          created_at: new Date(),
        },
        {
          transaction,
        },
      );
    }

    // ========================================
    // CĂN CỨ PHÁP LÝ
    // ========================================

    if (legal_bases.length > 0) {
      const legalRows = legal_bases.map((item, index) => ({
        contract_id: contractId,

        content: typeof item === "string" ? item : item.content,

        sort_order: index + 1,

        created_by: created_by || null,
        created_at: new Date(),
      }));

      await ContractLegalBasis.bulkCreate(legalRows, {
        transaction,
      });
    }

    // ========================================
    // COMMIT
    // ========================================

    await transaction.commit();

    // ========================================
    // LẤY LẠI FULL CONTRACT
    // ========================================

    const fullContract = await Contract.findByPk(contractId, {
      include: contractDetailInclude,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo hợp đồng thành công",
      data: fullContract,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("createContract error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo hợp đồng",
      error: error.message,
    });
  }
};

// =====================================================
// LẤY DANH SÁCH HỢP ĐỒNG
// Có filter + pagination
// =====================================================
exports.getContracts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,

      search,
      contract_type,
      status,

      customer_id,

      from_date,
      to_date,
    } = req.query;

    const where = {};

    // ========================================
    // SEARCH
    // ========================================

    if (search) {
      where[Op.or] = [
        {
          contract_code: {
            [Op.iLike]: `%${search}%`,
          },
        },

        {
          contract_name: {
            [Op.iLike]: `%${search}%`,
          },
        },
      ];
    }

    // ========================================
    // LOẠI HỢP ĐỒNG
    // ========================================

    if (contract_type !== undefined && contract_type !== "") {
      const normalizedType = normalizeContractType(contract_type);

      if (normalizedType) {
        where.contract_type = normalizedType;
      }
    }

    // ========================================
    // TRẠNG THÁI
    // ========================================

    if (status !== undefined && status !== "") {
      where.status = normalizeStatus(status);
    }

    // ========================================
    // KHÁCH HÀNG
    // ========================================

    if (customer_id) {
      where.customer_id = customer_id;
    }

    // ========================================
    // NGÀY KÝ
    // ========================================

    if (from_date || to_date) {
      where.signed_date = {};

      if (from_date) {
        where.signed_date[Op.gte] = from_date;
      }

      if (to_date) {
        where.signed_date[Op.lte] = to_date;
      }
    }

    const pageNumber = Math.max(Number(page) || 1, 1);

    const limitNumber = Math.max(Number(limit) || 10, 1);

    const offset = (pageNumber - 1) * limitNumber;

    // ========================================
    // QUERY
    // ========================================

    const result = await Contract.findAndCountAll({
      where,

      include: [
        {
          model: ContractParty,
          as: "parties",

          attributes: ["party_id", "party_type", "company_name"],

          required: false,
        },
      ],

      order: [["contract_id", "DESC"]],

      limit: limitNumber,
      offset,

      distinct: true,
    });

    // ========================================
    // FORMAT CHO FE
    // ========================================

    const contracts = result.rows.map((item) => {
      const contract = item.toJSON();

      const customer = (contract.parties || []).find(
        (party) => Number(party.party_type) === 1,
      );

      return {
        ...contract,

        customer_name: customer?.company_name || null,

        contract_type_id: contract.contract_type,

        contract_type: getContractTypeCode(contract.contract_type),

        contract_type_name: getContractTypeName(contract.contract_type),

        status_id: contract.status,

        status: getStatusCode(contract.status),

        status_name: getStatusName(contract.status),
      };
    });

    const totalPages = Math.ceil(result.count / limitNumber);

    return res.json({
      success: true,

      data: contracts,

      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: result.count,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error("getContracts error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách hợp đồng",
      error: error.message,
    });
  }
};

// =====================================================
// LẤY CHI TIẾT HỢP ĐỒNG
// =====================================================
exports.getContractById = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findByPk(contractId, {
      include: contractDetailInclude,
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    const result = contract.toJSON();

    const customerParty = (result.parties || []).find(
      (item) => Number(item.party_type) === 1,
    );

    const companyParty = (result.parties || []).find(
      (item) => Number(item.party_type) === 2,
    );

    const customerRepresentative = (result.representatives || []).find(
      (item) => Number(item.rep_type) === 1,
    );

    const companyRepresentative = (result.representatives || []).find(
      (item) => Number(item.rep_type) === 2,
    );

    return res.json({
      success: true,

      data: {
        ...result,

        contract_type_id: result.contract_type,

        contract_type: getContractTypeCode(result.contract_type),

        contract_type_name: getContractTypeName(result.contract_type),

        status_id: result.status,

        status: getStatusCode(result.status),

        status_name: getStatusName(result.status),

        customer_profile: customerParty || null,

        company_profile: companyParty || null,

        customer_representative: customerRepresentative || null,

        company_representative: companyRepresentative || null,
      },
    });
  } catch (error) {
    console.error("getContractById error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin hợp đồng",
      error: error.message,
    });
  }
};

// =====================================================
// CẬP NHẬT HỢP ĐỒNG
// =====================================================
exports.updateContract = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { contractId } = req.params;

    const contract = await Contract.findByPk(contractId, {
      transaction,
    });

    if (!contract) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    const {
      contract_code,
      contract_name,
      contract_type,

      customer_id,
      template_id,

      signed_date,
      signed_place,

      vat_type,
      vat_rate,

      status,
      note,

      updated_by,

      customer_profile,
      company_profile,

      representatives,

      contract_content,

      departures,

      price_items,

      advance,

      legal_bases,
    } = req.body;

    // ========================================
    // TÍNH LẠI GIÁ
    // ========================================

    let calculated = null;

    if (price_items) {
      calculated = calculateContractAmount(
        price_items,

        vat_type !== undefined ? vat_type : contract.vat_type,

        vat_rate !== undefined ? vat_rate : contract.vat_rate,
      );
    }

    // ========================================
    // UPDATE CONTRACT
    // ========================================

    await contract.update(
      {
        contract_code: contract_code ?? contract.contract_code,

        contract_name: contract_name ?? contract.contract_name,

        contract_type:
          contract_type !== undefined
            ? normalizeContractType(contract_type)
            : contract.contract_type,

        customer_id: customer_id ?? contract.customer_id,

        template_id: template_id ?? contract.template_id,

        signed_date: signed_date ?? contract.signed_date,

        signed_place: signed_place ?? contract.signed_place,

        vat_type:
          vat_type !== undefined
            ? normalizeVatType(vat_type)
            : contract.vat_type,

        vat_rate:
          vat_rate !== undefined ? Number(vat_rate) || 0 : contract.vat_rate,

        contract_value: calculated
          ? calculated.contractValue
          : contract.contract_value,

        vat_amount: calculated ? calculated.vatAmount : contract.vat_amount,

        total_amount: calculated
          ? calculated.totalAmount
          : contract.total_amount,

        amount_in_words: req.body.amount_in_words ?? contract.amount_in_words,

        status:
          status !== undefined ? normalizeStatus(status) : contract.status,

        note: note ?? contract.note,

        updated_by: updated_by || contract.updated_by,

        updated_at: new Date(),
        included_services:
          contract_content?.included_services ?? content.included_services,

        excluded_services:
          contract_content?.excluded_services ?? content.excluded_services,

        late_payment: contract_content?.late_payment ?? content.late_payment,
      },
      {
        transaction,
      },
    );

    // ========================================
    // UPDATE PARTIES
    // ========================================

    if (customer_profile) {
      await ContractParty.destroy({
        where: {
          contract_id: contractId,
          party_type: 1,
        },
        transaction,
      });

      await ContractParty.create(
        {
          contract_id: contractId,

          party_type: 1,

          company_name: customer_profile.company_name,

          tax_code: customer_profile.tax_code,

          budget_code: customer_profile.budget_code,

          address: customer_profile.address,

          phone: customer_profile.phone,

          bank_account: customer_profile.bank_account,

          created_by: updated_by || null,

          created_at: new Date(),
        },
        {
          transaction,
        },
      );
    }

    if (company_profile) {
      await ContractParty.destroy({
        where: {
          contract_id: contractId,
          party_type: 2,
        },
        transaction,
      });

      await ContractParty.create(
        {
          contract_id: contractId,

          party_type: 2,

          company_name: company_profile.company_name,

          tax_code: company_profile.tax_code,

          budget_code: company_profile.budget_code,

          address: company_profile.address,

          // ĐỊA CHỈ LIÊN HỆ
          company_contact_address:
            company_profile.company_contact_address || null,

          phone: company_profile.phone,

          bank_account: company_profile.bank_account,

          created_by: updated_by || null,

          created_at: new Date(),
        },
        {
          transaction,
        },
      );
    }

    // ========================================
    // UPDATE REPRESENTATIVES
    // ========================================

    if (representatives) {
      await ContractRepresentative.destroy({
        where: {
          contract_id: contractId,
        },
        transaction,
      });

      if (representatives.length > 0) {
        await ContractRepresentative.bulkCreate(
          representatives.map((item) => ({
            contract_id: contractId,

            rep_type:
              String(item.rep_type).toUpperCase() === "CUSTOMER"
                ? 1
                : String(item.rep_type).toUpperCase() === "COMPANY"
                  ? 2
                  : Number(item.rep_type),

            rep_name: item.rep_name || null,

            rep_title: item.rep_title || null,

            note: item.note || null,

            created_by: updated_by || null,

            created_at: new Date(),
          })),
          {
            transaction,
          },
        );
      }
    }

    // ========================================
    // UPDATE CONTENT
    // ========================================

    if (contract_content) {
      const currentContent = await ContractContent.findOne({
        where: {
          contract_id: contractId,
        },
        transaction,
      });

      if (currentContent) {
        await currentContent.update(
          {
            ...contract_content,

            updated_by: updated_by || null,

            updated_at: new Date(),
          },
          {
            transaction,
          },
        );
      } else {
        await ContractContent.create(
          {
            contract_id: contractId,

            ...contract_content,

            created_by: updated_by || null,

            created_at: new Date(),
          },
          {
            transaction,
          },
        );
      }
    }

    // ========================================
    // UPDATE DEPARTURES
    // ========================================

    if (departures) {
      await ContractDeparture.destroy({
        where: {
          contract_id: contractId,
        },
        transaction,
      });

      if (departures.length > 0) {
        await ContractDeparture.bulkCreate(
          departures.map((item, index) => ({
            contract_id: contractId,

            departure_name:
              item.departure_name ||
              `Đợt ${String(index + 1).padStart(2, "0")}`,

            start_date: item.start_date,

            end_date: item.end_date,

            sort_order: index + 1,

            created_by: updated_by || null,

            created_at: new Date(),
          })),
          {
            transaction,
          },
        );
      }
    }

    // ========================================
    // UPDATE PRICE
    // ========================================

    if (price_items) {
      await ContractPrice.destroy({
        where: {
          contract_id: contractId,
        },
        transaction,
      });

      if (calculated && calculated.priceItems.length > 0) {
        await ContractPrice.bulkCreate(
          calculated.priceItems.map((item) => ({
            contract_id: contractId,

            ...item,

            created_by: updated_by || null,

            created_at: new Date(),
          })),
          {
            transaction,
          },
        );
      }
    }

    // ========================================
    // UPDATE ADVANCE
    // ========================================

    if (advance) {
      await ContractAdvance.destroy({
        where: {
          contract_id: contractId,
        },
        transaction,
      });

      const calcType = normalizeAdvanceCalcType(advance.calc_type);

      let advanceAmount = 0;

      const totalAmount = calculated
        ? calculated.totalAmount
        : Number(contract.total_amount) || 0;

      if (advance.is_advance) {
        if (calcType === 1) {
          const rate = Number(
            advance.advance_percent || advance.advance_rate || 0,
          );

          advanceAmount = totalAmount * (rate / 100);
        }

        if (calcType === 2) {
          advanceAmount = Number(advance.advance_amount) || 0;
        }
      }

      await ContractAdvance.create(
        {
          contract_id: contractId,

          is_advance: Boolean(advance.is_advance),

          calc_type: calcType,

          advance_rate:
            calcType === 1
              ? Number(advance.advance_percent || advance.advance_rate || 0)
              : null,

          advance_amount: Math.round(advanceAmount),

          due_date: advance.due_date ?? advance.advance_date ?? null,

          payment_date: advance.payment_date || null,

          note: advance.note || null,

          created_by: updated_by || null,

          created_at: new Date(),
        },
        {
          transaction,
        },
      );
    }

    // ========================================
    // UPDATE LEGAL BASES
    // ========================================

    if (legal_bases) {
      await ContractLegalBasis.destroy({
        where: {
          contract_id: contractId,
        },
        transaction,
      });

      if (legal_bases.length > 0) {
        await ContractLegalBasis.bulkCreate(
          legal_bases.map((item, index) => ({
            contract_id: contractId,

            content: typeof item === "string" ? item : item.content,

            sort_order: index + 1,

            created_by: updated_by || null,

            created_at: new Date(),
          })),
          {
            transaction,
          },
        );
      }
    }

    await transaction.commit();

    // ========================================
    // LOAD LẠI FULL
    // ========================================

    const updatedContract = await Contract.findByPk(contractId, {
      include: contractDetailInclude,
    });

    return res.json({
      success: true,
      message: "Cập nhật hợp đồng thành công",
      data: updatedContract,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("updateContract error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật hợp đồng",
      error: error.message,
    });
  }
};

// =====================================================
// CẬP NHẬT TRẠNG THÁI HỢP ĐỒNG
// =====================================================
exports.updateContractStatus = async (req, res) => {
  try {
    const { contractId } = req.params;

    const { status, updated_by } = req.body;

    if (status === undefined || status === null || status === "") {
      return res.status(400).json({
        success: false,
        message: "Trạng thái hợp đồng là bắt buộc",
      });
    }

    const contract = await Contract.findByPk(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    const normalizedStatus = normalizeStatus(status);

    if (
      ![
        CONTRACT_STATUS.DRAFT,
        CONTRACT_STATUS.SIGNED,
        CONTRACT_STATUS.PROCESSING,
        CONTRACT_STATUS.LIQUIDATED,
        CONTRACT_STATUS.CANCELLED,
      ].includes(normalizedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái hợp đồng không hợp lệ",
      });
    }

    await contract.update({
      status: normalizedStatus,

      updated_by: updated_by || contract.updated_by,

      updated_at: new Date(),
    });

    return res.json({
      success: true,
      message: "Cập nhật trạng thái hợp đồng thành công",

      data: {
        contract_id: contract.contract_id,

        status_id: contract.status,

        status: getStatusCode(contract.status),

        status_name: getStatusName(contract.status),
      },
    });
  } catch (error) {
    console.error("updateContractStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật trạng thái hợp đồng",
      error: error.message,
    });
  }
};

// =====================================================
// XÓA HỢP ĐỒNG
// Các bảng con tự xóa do ON DELETE CASCADE
// =====================================================
exports.deleteContract = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findByPk(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    await contract.destroy();

    return res.json({
      success: true,
      message: "Xóa hợp đồng thành công",
    });
  } catch (error) {
    console.error("deleteContract error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi xóa hợp đồng",
      error: error.message,
    });
  }
};

// =====================================================
// THỐNG KÊ HỢP ĐỒNG
// Dùng cho 4 card màn danh sách
// =====================================================
exports.getContractStatistics = async (req, res) => {
  try {
    const [total, draft, signed, processing, liquidated, cancelled] =
      await Promise.all([
        Contract.count(),

        Contract.count({
          where: {
            status: CONTRACT_STATUS.DRAFT,
          },
        }),

        Contract.count({
          where: {
            status: CONTRACT_STATUS.SIGNED,
          },
        }),

        Contract.count({
          where: {
            status: CONTRACT_STATUS.PROCESSING,
          },
        }),

        Contract.count({
          where: {
            status: CONTRACT_STATUS.LIQUIDATED,
          },
        }),

        Contract.count({
          where: {
            status: CONTRACT_STATUS.CANCELLED,
          },
        }),
      ]);

    return res.json({
      success: true,

      data: {
        total,
        draft,
        signed,
        processing,
        liquidated,
        cancelled,
      },
    });
  } catch (error) {
    console.error("getContractStatistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê hợp đồng",
      error: error.message,
    });
  }
};

// ============================================================
// LẤY SỐ HỢP ĐỒNG TIẾP THEO
// Chỉ kiểm tra dữ liệu đã tồn tại trong vn_contracts
// KHÔNG tăng số khi gọi API
// ============================================================

exports.getNextContractCode = async (req, res) => {
  try {
    const year = new Date().getFullYear();

    const suffix = `/VNT-TSA${year}`;

    // ========================================================
    // TÌM SỐ HỢP ĐỒNG LỚN NHẤT ĐÃ LƯU TRONG DATABASE
    //
    // Ví dụ:
    // 2653/VNT-TSA2026
    // 2654/VNT-TSA2026
    // 2655/VNT-TSA2026
    //
    // => MAX = 2655
    // => NEXT = 2656
    // ========================================================

    const [results] = await sequelize.query(
      `
        SELECT
          MAX(
            CAST(
              SPLIT_PART(contract_code, '/', 1)
              AS INTEGER
            )
          ) AS max_contract_number
        FROM vntour.vn_contracts
        WHERE contract_code LIKE :pattern
          AND SPLIT_PART(contract_code, '/', 1) ~ '^[0-9]+$'
      `,
      {
        replacements: {
          pattern: `%${suffix}`,
        },
      },
    );

    const maxContractNumber = Number(results?.[0]?.max_contract_number || 0);

    // ========================================================
    // RULE:
    //
    // Nếu chưa có hợp đồng nào:
    // có thể bắt đầu từ 2655 hoặc số bạn quy định.
    //
    // Nếu đã có:
    // MAX + 1
    // ========================================================

    const nextContractNumber =
      maxContractNumber > 0 ? maxContractNumber + 1 : 2655;

    const contractCode = `${nextContractNumber}/VNT-TSA${year}`;

    return res.status(200).json({
      success: true,

      message: "Lấy số hợp đồng tiếp theo thành công",

      data: {
        contract_number: nextContractNumber,

        contract_code: contractCode,
      },
    });
  } catch (error) {
    console.error("getNextContractCode error:", error);

    return res.status(500).json({
      success: false,

      message: "Lỗi khi lấy số hợp đồng tiếp theo",

      error: error.message,
    });
  }
};

// ============================================================
// EXPORT PDF
// ============================================================

exports.exportContractPdf = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: "ID hợp đồng không hợp lệ",
      });
    }

    const contract = await Contract.findByPk(id, {
      include: [
        {
          model: ContractParty,
          as: "parties",
        },

        {
          model: ContractRepresentative,
          as: "representatives",
        },

        {
          model: ContractContent,
          as: "contract_content",
        },

        {
          model: ContractDeparture,
          as: "departures",
        },

        {
          model: ContractPrice,
          as: "price_items",
        },

        {
          model: ContractAdvance,
          as: "advance",
        },

        {
          model: ContractLegalBasis,
          as: "legal_bases",
        },
      ],
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    const pdfBuffer = await generateContractPdf(contract);

    const fileName = `${contract.contract_code || `contract-${id}`}.pdf`
      .replace(/\//g, "-")
      .replace(/\\/g, "-");

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    res.setHeader("Content-Length", pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("exportContractPdf error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi xuất file PDF hợp đồng",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORT WORD
// ============================================================

exports.exportContractWord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        message: "ID hợp đồng không hợp lệ",
      });
    }

    const contract = await Contract.findByPk(id, {
      include: [
        {
          model: ContractParty,
          as: "parties",
        },

        {
          model: ContractRepresentative,
          as: "representatives",
        },

        {
          model: ContractContent,
          as: "contract_content",
        },

        {
          model: ContractDeparture,
          as: "departures",
        },

        {
          model: ContractPrice,
          as: "price_items",
        },

        {
          model: ContractAdvance,
          as: "advance",
        },

        {
          model: ContractLegalBasis,
          as: "legal_bases",
        },
      ],
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hợp đồng",
      });
    }

    const wordBuffer = await generateContractWord(contract);

    const fileName = `${contract.contract_code || `contract-${id}`}.docx`
      .replace(/\//g, "-")
      .replace(/\\/g, "-");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    res.setHeader("Content-Length", wordBuffer.length);

    return res.send(wordBuffer);
  } catch (error) {
    console.error("exportContractWord error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi khi xuất file Word hợp đồng",
      error: error.message,
    });
  }
};
