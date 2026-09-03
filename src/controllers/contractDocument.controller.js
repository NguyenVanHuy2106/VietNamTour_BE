// src/controllers/contractDocument.controller.js

const {
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
} = require("../models");

const sequelize = require("../config/database");
const { QueryTypes } = require("sequelize");
const {
  generateSettlementPdf,
  generateSettlementWord,
} = require("../utils/settlementExport");

// ============================================================
// VAT HELPERS
// ============================================================

const normalizeVatType = (value, fallback = "NO_VAT") => {
  const raw = String(value || "").toUpperCase();

  if (raw === "INCLUDED" || raw === "EXCLUDED" || raw === "NO_VAT") {
    return raw;
  }

  const numericValue = Number(value);

  if (numericValue === 1) {
    return "INCLUDED";
  }

  if (numericValue === 2) {
    return "EXCLUDED";
  }

  if (numericValue === 3) {
    return "NO_VAT";
  }

  return fallback;
};

// ============================================================
// TÍNH GIÁ TRỊ 1 ITEM
// ============================================================

const calculateSettlementItem = (item = {}) => {
  const quantityActual = Number(item.quantity_actual ?? item.quantity ?? 0);

  const unitPrice = Number(item.unit_price || 0);

  const vatType = normalizeVatType(item.vat_type, "NO_VAT");

  const vatRate =
    vatType === "NO_VAT" ? 0 : Math.max(0, Number(item.vat_rate || 0));

  const lineTotal = quantityActual * unitPrice;

  let actualAmount = lineTotal;

  let vatAmount = 0;

  let amountAfterVat = lineTotal;

  // ==========================================================
  // ĐƠN GIÁ CHƯA VAT
  // ==========================================================

  if (vatType === "EXCLUDED") {
    actualAmount = lineTotal;

    vatAmount = actualAmount * (vatRate / 100);

    amountAfterVat = actualAmount + vatAmount;
  }

  // ==========================================================
  // ĐƠN GIÁ ĐÃ BAO GỒM VAT
  // ==========================================================

  if (vatType === "INCLUDED") {
    amountAfterVat = lineTotal;

    if (vatRate > 0) {
      actualAmount = amountAfterVat / (1 + vatRate / 100);

      vatAmount = amountAfterVat - actualAmount;
    } else {
      actualAmount = amountAfterVat;

      vatAmount = 0;
    }
  }

  // ==========================================================
  // KHÔNG VAT
  // ==========================================================

  if (vatType === "NO_VAT") {
    actualAmount = lineTotal;

    vatAmount = 0;

    amountAfterVat = lineTotal;
  }

  return {
    quantityActual,

    unitPrice,

    vatType,

    vatRate,

    actualAmount: Math.round(actualAmount),

    vatAmount: Math.round(vatAmount),

    amountAfterVat: Math.round(amountAfterVat),
  };
};

// ============================================================
// NORMALIZE ITEM NGHIỆM THU / THANH LÝ
// ============================================================

const normalizeSettlementItem = (item, index, settlementId = null) => {
  const quantityContract = Number(item.quantity_contract || 0);

  const contractUnitPrice = Number(item.unit_price || 0);

  const contractAmount =
    Number(item.contract_amount || 0) || quantityContract * contractUnitPrice;

  const calculated = calculateSettlementItem(item);

  return {
    ...(settlementId
      ? {
          settlement_id: settlementId,
        }
      : {}),

    contract_item_id: item.contract_item_id || null,

    item_name: String(item.item_name || "").trim(),

    route_name: item.route_name || null,

    customer_type: item.customer_type || null,

    unit: item.unit || null,

    quantity_contract: quantityContract,

    quantity_actual: calculated.quantityActual,

    unit_price: calculated.unitPrice,

    contract_amount: contractAmount,

    // ========================================================
    // VAT
    // ========================================================

    actual_amount: calculated.actualAmount,

    vat_type: calculated.vatType,

    vat_rate: calculated.vatRate,

    vat_amount: calculated.vatAmount,

    amount_after_vat: calculated.amountAfterVat,

    is_extra: Boolean(item.is_extra),

    extra_note: item.extra_note || null,

    sort_order: item.sort_order || index + 1,
  };
};

// ============================================================
// TÍNH TỔNG SETTLEMENT
// ============================================================

const calculateSettlementTotals = (normalizedItems = []) => {
  return normalizedItems.reduce(
    (result, item) => {
      result.subtotal += Number(item.actual_amount || 0);

      result.vatAmount += Number(item.vat_amount || 0);

      result.actualValue += Number(item.amount_after_vat || 0);

      return result;
    },
    {
      subtotal: 0,

      vatAmount: 0,

      actualValue: 0,
    },
  );
};

exports.getContractDocuments = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);

    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: "contractId không hợp lệ",
      });
    }

    const settlements = await ContractSettlement.findAll({
      where: {
        contract_id: contractId,
      },
      include: [
        {
          model: ContractSettlementItem,
          as: "items",
          required: false,
        },
      ],
      order: [
        ["document_date", "DESC"],
        ["settlement_id", "DESC"],
      ],
    });

    const form08as = await ContractForm08a.findAll({
      where: {
        contract_id: contractId,
      },
      include: [
        {
          model: ContractForm08aItem,
          as: "items",
          required: false,
        },
      ],
      order: [
        ["document_date", "DESC"],
        ["form_08a_id", "DESC"],
      ],
    });

    const payments = await ContractPayment.findAll({
      where: {
        contract_id: contractId,
      },
      order: [
        ["payment_date", "DESC"],
        ["payment_id", "DESC"],
      ],
    });

    return res.json({
      success: true,
      data: {
        contract_id: contractId,
        settlements,
        form_08a: form08as,
        payments,
      },
    });
  } catch (error) {
    console.error("getContractDocuments error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy hồ sơ hợp đồng",
      error: error.message,
    });
  }
};

exports.createAcceptance = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const contractId = parseInt(req.params.contractId);

    const {
      document_no,

      document_date,

      batch_no,

      service_from_date,

      service_to_date,

      contract_value = 0,

      quality_rating = "Tốt",

      other_comment = "Không",

      note,

      created_by,

      items = [],
    } = req.body;

    // ========================================================
    // VALIDATE
    // ========================================================

    if (!contractId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "contractId không hợp lệ",
      });
    }

    if (!document_no) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Số biên bản là bắt buộc",
      });
    }

    if (!document_date) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Ngày nghiệm thu là bắt buộc",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Biên bản nghiệm thu chưa có hạng mục",
      });
    }

    // ========================================================
    // CHECK DOCUMENT NO
    // ========================================================

    const existed = await ContractSettlement.findOne({
      where: {
        document_no,
      },

      transaction,
    });

    if (existed) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,

        message: "Số biên bản đã được sử dụng. Vui lòng lấy số mới.",
      });
    }

    // ========================================================
    // NORMALIZE ITEMS
    // ========================================================

    const normalizedItems = items.map((item, index) =>
      normalizeSettlementItem(item, index),
    );

    // ========================================================
    // VALIDATE EXTRA ITEM
    // ========================================================

    const invalidExtraIndex = normalizedItems.findIndex(
      (item) =>
        item.is_extra &&
        (!item.item_name ||
          !item.unit ||
          Number(item.quantity_actual || 0) <= 0 ||
          Number(item.unit_price || 0) < 0),
    );

    if (invalidExtraIndex >= 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: `Hạng mục phát sinh dòng ${
          invalidExtraIndex + 1
        } không hợp lệ`,
      });
    }

    // ========================================================
    // TOTAL
    // ========================================================

    const totals = calculateSettlementTotals(normalizedItems);

    // ========================================================
    // CREATE SETTLEMENT
    // ========================================================

    const settlement = await ContractSettlement.create(
      {
        contract_id: contractId,

        document_type: "ACCEPTANCE",

        document_no,

        document_date,

        batch_no: batch_no || null,

        service_from_date: service_from_date || null,

        service_to_date: service_to_date || null,

        contract_value: Number(contract_value || 0),

        // ======================================
        // TỔNG GIÁ TRỊ
        // ======================================

        subtotal: totals.subtotal,

        vat_amount: totals.vatAmount,

        actual_value: totals.actualValue,

        paid_amount: 0,

        remaining_amount: totals.actualValue,

        quality_rating,

        other_comment,

        note: note || null,

        status: 1,

        created_by: created_by || null,
      },

      {
        transaction,
      },
    );

    // ========================================================
    // SAVE ITEMS
    // ========================================================

    await ContractSettlementItem.bulkCreate(
      normalizedItems.map((item) => ({
        ...item,

        settlement_id: settlement.settlement_id,
      })),

      {
        transaction,
      },
    );

    await transaction.commit();

    // ========================================================
    // RETURN DETAIL
    // ========================================================

    const result = await ContractSettlement.findByPk(
      settlement.settlement_id,

      {
        include: [
          {
            model: ContractSettlementItem,

            as: "items",
          },
        ],
      },
    );

    return res.status(201).json({
      success: true,

      message: "Tạo biên bản nghiệm thu thành công",

      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("createAcceptance error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể tạo biên bản nghiệm thu",

      error: error.message,
    });
  }
};

exports.createLiquidation = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const contractId = parseInt(req.params.contractId);

    const {
      document_no,

      document_date,

      contract_value = 0,

      paid_amount = 0,

      note,

      created_by,

      items = [],
    } = req.body;

    // ========================================================
    // VALIDATE
    // ========================================================

    if (!contractId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "contractId không hợp lệ",
      });
    }

    if (!document_no) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Số biên bản thanh lý là bắt buộc",
      });
    }

    if (!document_date) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Ngày thanh lý là bắt buộc",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Biên bản thanh lý chưa có dữ liệu tổng hợp nghiệm thu",
      });
    }

    // ========================================================
    // DUPLICATE DOCUMENT NO
    // ========================================================

    const existed = await ContractSettlement.findOne({
      where: {
        document_no,
      },

      transaction,
    });

    if (existed) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,

        message: "Số biên bản đã được sử dụng. Vui lòng lấy số mới.",
      });
    }

    // ========================================================
    // NORMALIZE
    // ========================================================

    const normalizedItems = items.map((item, index) =>
      normalizeSettlementItem(
        {
          ...item,

          quantity_actual: item.quantity_actual ?? item.quantity ?? 0,
        },

        index,
      ),
    );

    // ========================================================
    // TOTAL
    // ========================================================

    const totals = calculateSettlementTotals(normalizedItems);

    const paidAmount = Number(paid_amount || 0);

    const remainingAmount = totals.actualValue - paidAmount;

    // ========================================================
    // CREATE
    // ========================================================

    const settlement = await ContractSettlement.create(
      {
        contract_id: contractId,

        document_type: "LIQUIDATION",

        document_no,

        document_date,

        contract_value: Number(contract_value || 0),

        subtotal: totals.subtotal,

        vat_amount: totals.vatAmount,

        actual_value: totals.actualValue,

        paid_amount: paidAmount,

        remaining_amount: remainingAmount,

        note: note || "",

        status: 1,

        created_by: created_by || null,
      },

      {
        transaction,
      },
    );

    // ========================================================
    // SAVE ITEMS
    // ========================================================

    await ContractSettlementItem.bulkCreate(
      normalizedItems.map((item) => ({
        ...item,

        settlement_id: settlement.settlement_id,
      })),

      {
        transaction,
      },
    );

    await transaction.commit();

    const result = await ContractSettlement.findByPk(
      settlement.settlement_id,

      {
        include: [
          {
            model: ContractSettlementItem,

            as: "items",
          },
        ],
      },
    );

    return res.status(201).json({
      success: true,

      message: "Tạo biên bản thanh lý thành công",

      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("createLiquidation error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể tạo biên bản thanh lý",

      error: error.message,
    });
  }
};

exports.createAcceptanceLiquidation = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const contractId = parseInt(req.params.contractId);

    const {
      document_no,
      document_date,

      service_from_date,
      service_to_date,

      contract_value = 0,

      quality_rating = "Tốt",
      other_comment = "Không",

      note,
      created_by,

      items = [],
    } = req.body;

    if (!contractId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "contractId không hợp lệ",
      });
    }

    const normalizedItems = items.map((item, index) =>
      normalizeSettlementItem(item, index),
    );

    const totals = calculateSettlementTotals(normalizedItems);

    const actualValue = totals.actualValue;

    const payments = await ContractPayment.findAll({
      where: {
        contract_id: contractId,
        status: 1,
      },
      transaction,
    });

    let paidAmount = 0;

    payments.forEach((payment) => {
      const amount = Number(payment.amount || 0);

      if (
        payment.payment_type === "ADVANCE" ||
        payment.payment_type === "PAYMENT"
      ) {
        paidAmount += amount;
      }

      if (payment.payment_type === "REFUND") {
        paidAmount -= amount;
      }
    });

    const remainingAmount = actualValue - paidAmount;

    const settlement = await ContractSettlement.create(
      {
        contract_id: contractId,

        document_type: "ACCEPTANCE_LIQUIDATION",

        document_no,
        document_date,

        service_from_date: service_from_date || null,
        service_to_date: service_to_date || null,

        contract_value: Number(contract_value || 0),

        subtotal: totals.subtotal,

        vat_amount: totals.vatAmount,

        actual_value: totals.actualValue,

        paid_amount: paidAmount,

        remaining_amount: remainingAmount,

        quality_rating,
        other_comment,

        note,

        status: 1,

        created_by: created_by || null,
      },
      {
        transaction,
      },
    );

    if (normalizedItems.length > 0) {
      await ContractSettlementItem.bulkCreate(
        normalizedItems.map((item) => ({
          ...item,
          settlement_id: settlement.settlement_id,
        })),
        {
          transaction,
        },
      );
    }

    await transaction.commit();

    const result = await ContractSettlement.findByPk(settlement.settlement_id, {
      include: [
        {
          model: ContractSettlementItem,
          as: "items",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Tạo biên bản nghiệm thu và thanh lý thành công",
      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("createAcceptanceLiquidation error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tạo biên bản nghiệm thu và thanh lý",
      error: error.message,
    });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);

    const {
      payment_type,
      payment_date,
      amount,
      payment_method,
      reference_no,
      note,
      created_by,
    } = req.body;

    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: "contractId không hợp lệ",
      });
    }

    if (!payment_type) {
      return res.status(400).json({
        success: false,
        message: "payment_type là bắt buộc",
      });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số tiền thanh toán không hợp lệ",
      });
    }

    const payment = await ContractPayment.create({
      contract_id: contractId,

      payment_type,
      payment_date: payment_date || null,

      amount: Number(amount),

      payment_method: payment_method || null,

      reference_no: reference_no || null,

      note,

      status: 1,

      created_by: created_by || null,
    });

    return res.status(201).json({
      success: true,
      message: "Thêm thanh toán thành công",
      data: payment,
    });
  } catch (error) {
    console.error("createPayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể thêm thanh toán",
      error: error.message,
    });
  }
};

exports.getSettlementById = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const settlementId = parseInt(req.params.settlementId);

    const settlement = await ContractSettlement.findOne({
      where: {
        settlement_id: settlementId,
        contract_id: contractId,
      },

      include: [
        {
          model: ContractSettlementItem,
          as: "items",
        },
      ],
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ",
      });
    }

    return res.json({
      success: true,
      data: settlement,
    });
  } catch (error) {
    console.error("getSettlementById error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy hồ sơ",
      error: error.message,
    });
  }
};

exports.deleteSettlement = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const settlementId = parseInt(req.params.settlementId);

    const settlement = await ContractSettlement.findOne({
      where: {
        settlement_id: settlementId,
        contract_id: contractId,
      },
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ",
      });
    }

    await settlement.destroy();

    return res.json({
      success: true,
      message: "Xóa hồ sơ thành công",
    });
  } catch (error) {
    console.error("deleteSettlement error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể xóa hồ sơ",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE SETTLEMENT
// Dùng cho ACCEPTANCE / LIQUIDATION / ACCEPTANCE_LIQUIDATION
// =====================================================

exports.updateSettlement = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const contractId = parseInt(req.params.contractId);

    const settlementId = parseInt(req.params.settlementId);

    const settlement = await ContractSettlement.findOne({
      where: {
        settlement_id: settlementId,

        contract_id: contractId,
      },

      transaction,
    });

    if (!settlement) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,

        message: "Không tìm thấy hồ sơ",
      });
    }

    const {
      document_no,

      document_date,

      batch_no,

      service_from_date,

      service_to_date,

      contract_value,

      quality_rating,

      other_comment,

      note,

      status,

      paid_amount,

      items,
    } = req.body;

    let subtotal = Number(settlement.subtotal || 0);

    let vatAmount = Number(settlement.vat_amount || 0);

    let actualValue = Number(settlement.actual_value || 0);

    // ========================================================
    // UPDATE ITEMS
    // ========================================================

    if (Array.isArray(items)) {
      await ContractSettlementItem.destroy({
        where: {
          settlement_id: settlementId,
        },

        transaction,
      });

      const normalizedItems = items.map((item, index) =>
        normalizeSettlementItem(item, index, settlementId),
      );

      const totals = calculateSettlementTotals(normalizedItems);

      subtotal = totals.subtotal;

      vatAmount = totals.vatAmount;

      actualValue = totals.actualValue;

      if (normalizedItems.length > 0) {
        await ContractSettlementItem.bulkCreate(
          normalizedItems,

          {
            transaction,
          },
        );
      }
    }

    // ========================================================
    // PAID AMOUNT
    // ========================================================

    let paidAmount = Number(settlement.paid_amount || 0);

    /*
     * Nếu FE gửi paid_amount
     * thì ưu tiên giá trị người dùng nhập.
     */
    if (paid_amount !== undefined) {
      paidAmount = Number(paid_amount || 0);
    }

    /*
     * Với nghiệm thu thông thường:
     * paid_amount = 0.
     *
     * Với thanh lý:
     * giữ số đã lưu / FE gửi.
     *
     * Không tự động ghi đè lại bằng bảng payment
     * vì trước đó ông đã cho phép nhập tay
     * số tiền đã thanh toán khi lập thanh lý.
     */

    const remainingAmount = actualValue - paidAmount;

    // ========================================================
    // UPDATE SETTLEMENT
    // ========================================================

    await settlement.update(
      {
        document_no:
          document_no !== undefined ? document_no : settlement.document_no,

        document_date:
          document_date !== undefined
            ? document_date
            : settlement.document_date,

        batch_no: batch_no !== undefined ? batch_no : settlement.batch_no,

        service_from_date:
          service_from_date !== undefined
            ? service_from_date
            : settlement.service_from_date,

        service_to_date:
          service_to_date !== undefined
            ? service_to_date
            : settlement.service_to_date,

        contract_value:
          contract_value !== undefined
            ? Number(contract_value)
            : settlement.contract_value,

        subtotal,

        vat_amount: vatAmount,

        actual_value: actualValue,

        paid_amount: paidAmount,

        remaining_amount: remainingAmount,

        quality_rating:
          quality_rating !== undefined
            ? quality_rating
            : settlement.quality_rating,

        other_comment:
          other_comment !== undefined
            ? other_comment
            : settlement.other_comment,

        note: note !== undefined ? note : settlement.note,

        status: status !== undefined ? Number(status) : settlement.status,

        updated_at: new Date(),
      },

      {
        transaction,
      },
    );

    await transaction.commit();

    const result = await ContractSettlement.findByPk(
      settlementId,

      {
        include: [
          {
            model: ContractSettlementItem,

            as: "items",
          },
        ],
      },
    );

    return res.json({
      success: true,

      message: "Cập nhật hồ sơ thành công",

      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("updateSettlement error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể cập nhật hồ sơ",

      error: error.message,
    });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);

    const payments = await ContractPayment.findAll({
      where: {
        contract_id: contractId,
      },
      order: [
        ["payment_date", "ASC"],
        ["payment_id", "ASC"],
      ],
    });

    let totalPaid = 0;

    payments.forEach((payment) => {
      if (Number(payment.status) !== 1) return;

      const amount = Number(payment.amount || 0);

      if (
        payment.payment_type === "ADVANCE" ||
        payment.payment_type === "PAYMENT"
      ) {
        totalPaid += amount;
      }

      if (payment.payment_type === "REFUND") {
        totalPaid -= amount;
      }
    });

    return res.json({
      success: true,
      data: {
        payments,
        total_paid: totalPaid,
      },
    });
  } catch (error) {
    console.error("getPayments error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy lịch sử thanh toán",
      error: error.message,
    });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const paymentId = parseInt(req.params.paymentId);

    const payment = await ContractPayment.findOne({
      where: {
        payment_id: paymentId,
        contract_id: contractId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thanh toán",
      });
    }

    const {
      payment_type,
      payment_date,
      amount,
      payment_method,
      reference_no,
      note,
      status,
    } = req.body;

    await payment.update({
      payment_type:
        payment_type !== undefined ? payment_type : payment.payment_type,

      payment_date:
        payment_date !== undefined ? payment_date : payment.payment_date,

      amount: amount !== undefined ? Number(amount) : payment.amount,

      payment_method:
        payment_method !== undefined ? payment_method : payment.payment_method,

      reference_no:
        reference_no !== undefined ? reference_no : payment.reference_no,

      note: note !== undefined ? note : payment.note,

      status: status !== undefined ? Number(status) : payment.status,
    });

    return res.json({
      success: true,
      message: "Cập nhật thanh toán thành công",
      data: payment,
    });
  } catch (error) {
    console.error("updatePayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật thanh toán",
      error: error.message,
    });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const paymentId = parseInt(req.params.paymentId);

    const payment = await ContractPayment.findOne({
      where: {
        payment_id: paymentId,
        contract_id: contractId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thanh toán",
      });
    }

    await payment.destroy();

    return res.json({
      success: true,
      message: "Xóa thanh toán thành công",
    });
  } catch (error) {
    console.error("deletePayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể xóa thanh toán",
      error: error.message,
    });
  }
};

exports.createForm08a = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const contractId = parseInt(req.params.contractId);

    const {
      acceptance_settlement_id,

      document_no,
      document_date,

      budget_unit_name,
      budget_unit_code,
      funding_source_code,
      national_program_code,

      contract_value = 0,

      previous_accumulated_payment = 0,
      previous_advance_payment = 0,
      previous_direct_payment = 0,

      previous_advance_balance = 0,

      current_requested_payment = 0,
      current_advance_payment = 0,
      current_direct_payment = 0,

      amount_in_words,
      note,

      created_by,

      items = [],
    } = req.body;

    if (!contractId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "contractId không hợp lệ",
      });
    }

    if (!document_date) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Ngày lập mẫu 08a là bắt buộc",
      });
    }

    // Nếu có chọn biên bản nghiệm thu thì kiểm tra có thuộc hợp đồng này không
    if (acceptance_settlement_id) {
      const acceptance = await ContractSettlement.findOne({
        where: {
          settlement_id: acceptance_settlement_id,
          contract_id: contractId,
          document_type: "ACCEPTANCE",
        },
        transaction,
      });

      if (!acceptance) {
        await transaction.rollback();

        return res.status(400).json({
          success: false,
          message:
            "Biên bản nghiệm thu không tồn tại hoặc không thuộc hợp đồng này",
        });
      }
    }

    const form08a = await ContractForm08a.create(
      {
        contract_id: contractId,

        acceptance_settlement_id: acceptance_settlement_id || null,

        document_no,
        document_date,

        budget_unit_name,
        budget_unit_code,
        funding_source_code,
        national_program_code,

        contract_value: Number(contract_value || 0),

        previous_accumulated_payment: Number(previous_accumulated_payment || 0),

        previous_advance_payment: Number(previous_advance_payment || 0),

        previous_direct_payment: Number(previous_direct_payment || 0),

        previous_advance_balance: Number(previous_advance_balance || 0),

        current_requested_payment: Number(current_requested_payment || 0),

        current_advance_payment: Number(current_advance_payment || 0),

        current_direct_payment: Number(current_direct_payment || 0),

        amount_in_words,
        note,

        status: 1,
        created_by: created_by || null,
      },
      { transaction },
    );

    if (Array.isArray(items) && items.length > 0) {
      await ContractForm08aItem.bulkCreate(
        items.map((item, index) => ({
          form_08a_id: form08a.form_08a_id,

          settlement_item_id: item.settlement_item_id || null,

          item_name: item.item_name,

          unit: item.unit || null,

          quantity: Number(item.quantity || 0),

          unit_price: Number(item.unit_price || 0),

          amount:
            Number(item.amount) ||
            Number(item.quantity || 0) * Number(item.unit_price || 0),

          sort_order: item.sort_order || index + 1,
        })),
        {
          transaction,
        },
      );
    }

    await transaction.commit();

    const result = await ContractForm08a.findByPk(form08a.form_08a_id, {
      include: [
        {
          model: ContractForm08aItem,
          as: "items",
        },
        {
          model: ContractSettlement,
          as: "acceptanceSettlement",
          required: false,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Tạo mẫu 08a thành công",
      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("createForm08a error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tạo mẫu 08a",
      error: error.message,
    });
  }
};

exports.getForm08aById = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const form08aId = parseInt(req.params.form08aId);

    const form08a = await ContractForm08a.findOne({
      where: {
        form_08a_id: form08aId,
        contract_id: contractId,
      },

      include: [
        {
          model: ContractForm08aItem,
          as: "items",
        },
        {
          model: ContractSettlement,
          as: "acceptanceSettlement",
          required: false,
        },
      ],
    });

    if (!form08a) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mẫu 08a",
      });
    }

    return res.json({
      success: true,
      data: form08a,
    });
  } catch (error) {
    console.error("getForm08aById error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy mẫu 08a",
      error: error.message,
    });
  }
};

exports.updateForm08a = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const contractId = parseInt(req.params.contractId);
    const form08aId = parseInt(req.params.form08aId);

    const form08a = await ContractForm08a.findOne({
      where: {
        form_08a_id: form08aId,
        contract_id: contractId,
      },
      transaction,
    });

    if (!form08a) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mẫu 08a",
      });
    }

    const {
      acceptance_settlement_id,

      document_no,
      document_date,

      budget_unit_name,
      budget_unit_code,
      funding_source_code,
      national_program_code,

      contract_value,

      previous_accumulated_payment,
      previous_advance_payment,
      previous_direct_payment,

      previous_advance_balance,

      current_requested_payment,
      current_advance_payment,
      current_direct_payment,

      amount_in_words,
      note,
      status,

      items,
    } = req.body;

    await form08a.update(
      {
        acceptance_settlement_id:
          acceptance_settlement_id !== undefined
            ? acceptance_settlement_id
            : form08a.acceptance_settlement_id,

        document_no:
          document_no !== undefined ? document_no : form08a.document_no,

        document_date:
          document_date !== undefined ? document_date : form08a.document_date,

        budget_unit_name:
          budget_unit_name !== undefined
            ? budget_unit_name
            : form08a.budget_unit_name,

        budget_unit_code:
          budget_unit_code !== undefined
            ? budget_unit_code
            : form08a.budget_unit_code,

        funding_source_code:
          funding_source_code !== undefined
            ? funding_source_code
            : form08a.funding_source_code,

        national_program_code:
          national_program_code !== undefined
            ? national_program_code
            : form08a.national_program_code,

        contract_value:
          contract_value !== undefined
            ? Number(contract_value)
            : form08a.contract_value,

        previous_accumulated_payment:
          previous_accumulated_payment !== undefined
            ? Number(previous_accumulated_payment)
            : form08a.previous_accumulated_payment,

        previous_advance_payment:
          previous_advance_payment !== undefined
            ? Number(previous_advance_payment)
            : form08a.previous_advance_payment,

        previous_direct_payment:
          previous_direct_payment !== undefined
            ? Number(previous_direct_payment)
            : form08a.previous_direct_payment,

        previous_advance_balance:
          previous_advance_balance !== undefined
            ? Number(previous_advance_balance)
            : form08a.previous_advance_balance,

        current_requested_payment:
          current_requested_payment !== undefined
            ? Number(current_requested_payment)
            : form08a.current_requested_payment,

        current_advance_payment:
          current_advance_payment !== undefined
            ? Number(current_advance_payment)
            : form08a.current_advance_payment,

        current_direct_payment:
          current_direct_payment !== undefined
            ? Number(current_direct_payment)
            : form08a.current_direct_payment,

        amount_in_words:
          amount_in_words !== undefined
            ? amount_in_words
            : form08a.amount_in_words,

        note: note !== undefined ? note : form08a.note,

        status: status !== undefined ? Number(status) : form08a.status,
      },
      { transaction },
    );

    if (Array.isArray(items)) {
      await ContractForm08aItem.destroy({
        where: {
          form_08a_id: form08aId,
        },
        transaction,
      });

      if (items.length > 0) {
        await ContractForm08aItem.bulkCreate(
          items.map((item, index) => ({
            form_08a_id: form08aId,

            settlement_item_id: item.settlement_item_id || null,

            item_name: item.item_name,

            unit: item.unit || null,

            quantity: Number(item.quantity || 0),

            unit_price: Number(item.unit_price || 0),

            amount:
              Number(item.amount) ||
              Number(item.quantity || 0) * Number(item.unit_price || 0),

            sort_order: item.sort_order || index + 1,
          })),
          {
            transaction,
          },
        );
      }
    }

    await transaction.commit();

    const result = await ContractForm08a.findByPk(form08aId, {
      include: [
        {
          model: ContractForm08aItem,
          as: "items",
        },
        {
          model: ContractSettlement,
          as: "acceptanceSettlement",
          required: false,
        },
      ],
    });

    return res.json({
      success: true,
      message: "Cập nhật mẫu 08a thành công",
      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("updateForm08a error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật mẫu 08a",
      error: error.message,
    });
  }
};

exports.deleteForm08a = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const form08aId = parseInt(req.params.form08aId);

    const form08a = await ContractForm08a.findOne({
      where: {
        form_08a_id: form08aId,
        contract_id: contractId,
      },
    });

    if (!form08a) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mẫu 08a",
      });
    }

    await form08a.destroy();

    return res.json({
      success: true,
      message: "Xóa mẫu 08a thành công",
    });
  } catch (error) {
    console.error("deleteForm08a error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể xóa mẫu 08a",
      error: error.message,
    });
  }
};

exports.getAcceptancesForContract = async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);

    const acceptances = await ContractSettlement.findAll({
      where: {
        contract_id: contractId,
        document_type: "ACCEPTANCE",
        status: 1,
      },

      include: [
        {
          model: ContractSettlementItem,
          as: "items",
        },
      ],

      order: [
        ["batch_no", "ASC"],
        ["document_date", "ASC"],
      ],
    });

    return res.json({
      success: true,
      data: acceptances,
    });
  } catch (error) {
    console.error("getAcceptancesForContract error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách biên bản nghiệm thu",
      error: error.message,
    });
  }
};

const DOCUMENT_NUMBER_CONFIG = {
  ACCEPTANCE: "BBNT",
  LIQUIDATION: "BBTL",
  ACCEPTANCE_LIQUIDATION: "BBNTTL",
};

exports.getNextDocumentNumber = async (req, res) => {
  try {
    const { type, year } = req.query;

    const code = DOCUMENT_NUMBER_CONFIG[type];

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Loại biên bản không hợp lệ",
      });
    }

    const documentYear = Number(year) || new Date().getFullYear();

    const rows = await sequelize.query(
      `
      SELECT
        COALESCE(
          MAX(
            CASE
              WHEN document_no ~ :pattern
              THEN split_part(document_no, '/', 1)::int
              ELSE 0
            END
          ),
          0
        ) AS max_no
      FROM vntour.vn_contract_settlements
      WHERE document_type = :documentType
        AND document_no LIKE :documentPattern
      `,
      {
        replacements: {
          documentType: type,

          pattern: `^[0-9]+/${code}/VNT-TSA${documentYear}$`,

          documentPattern: `%/${code}/VNT-TSA${documentYear}`,
        },

        type: QueryTypes.SELECT,
      },
    );

    const maxNo = Number(rows?.[0]?.max_no || 0);

    const nextNo = maxNo + 1;

    const sequence = String(nextNo).padStart(2, "0");

    const documentNo = `${sequence}/${code}/VNT-TSA${documentYear}`;

    return res.json({
      success: true,

      data: {
        sequence: nextNo,
        document_no: documentNo,
      },
    });
  } catch (error) {
    console.error("getNextDocumentNumber error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy số biên bản tiếp theo",
      error: error.message,
    });
  }
};

exports.exportSettlementPdf = async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);

    const settlementId = Number(req.params.settlementId);

    if (!contractId || !settlementId) {
      return res.status(400).json({
        success: false,
        message: "contractId hoặc settlementId không hợp lệ",
      });
    }

    // ========================================================
    // CONTRACT
    // ========================================================

    /*
     * CHỖ NÀY:
     * dùng chính query lấy FULL CONTRACT
     * mà export hợp đồng hiện tại của ông đang dùng.
     */

    const contract = await Contract.findByPk(contractId, {
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

    // ========================================================
    // SETTLEMENT
    // ========================================================

    const settlement = await ContractSettlement.findOne({
      where: {
        settlement_id: settlementId,

        contract_id: contractId,
      },

      include: [
        {
          model: ContractSettlementItem,

          as: "items",
        },
      ],
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy biên bản",
      });
    }

    // ========================================================
    // ACCEPTANCE BASES CHO THANH LÝ
    // ========================================================

    const acceptances =
      settlement.document_type === "LIQUIDATION"
        ? await ContractSettlement.findAll({
            where: {
              contract_id: contractId,

              document_type: "ACCEPTANCE",

              status: 1,
            },

            order: [
              ["batch_no", "ASC"],

              ["document_date", "ASC"],
            ],
          })
        : [];

    // ========================================================
    // PDF
    // ========================================================

    const buffer = await generateSettlementPdf({
      contract,

      settlement,

      acceptances,
    });

    const filePrefix =
      settlement.document_type === "ACCEPTANCE"
        ? "Bien-ban-nghiem-thu"
        : "Bien-ban-thanh-ly";

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filePrefix}-${settlementId}.pdf"`,
    );

    return res.send(buffer);
  } catch (error) {
    console.error("exportSettlementPdf error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể xuất PDF biên bản",

      error: error.message,
    });
  }
};

exports.exportSettlementWord = async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);

    const settlementId = Number(req.params.settlementId);

    if (!contractId || !settlementId) {
      return res.status(400).json({
        success: false,

        message: "contractId hoặc settlementId không hợp lệ",
      });
    }

    const contract = await Contract.findByPk(contractId, {
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

    const settlement = await ContractSettlement.findOne({
      where: {
        settlement_id: settlementId,

        contract_id: contractId,
      },

      include: [
        {
          model: ContractSettlementItem,

          as: "items",
        },
      ],
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy biên bản",
      });
    }

    const acceptances =
      settlement.document_type === "LIQUIDATION"
        ? await ContractSettlement.findAll({
            where: {
              contract_id: contractId,

              document_type: "ACCEPTANCE",

              status: 1,
            },

            order: [
              ["batch_no", "ASC"],

              ["document_date", "ASC"],
            ],
          })
        : [];

    const buffer = await generateSettlementWord({
      contract,

      settlement,

      acceptances,
    });

    const filePrefix =
      settlement.document_type === "ACCEPTANCE"
        ? "Bien-ban-nghiem-thu"
        : "Bien-ban-thanh-ly";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filePrefix}-${settlementId}.docx"`,
    );

    return res.send(buffer);
  } catch (error) {
    console.error("exportSettlementWord error:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể xuất Word biên bản",

      error: error.message,
    });
  }
};
