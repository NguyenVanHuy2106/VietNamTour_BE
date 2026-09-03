const puppeteer = require("puppeteer");

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  BorderStyle,
  ShadingType,
  HeightRule,
  PageBreak,
} = require("docx");

const { normalizeContractData } = require("./contractExport");

// ============================================================
// CONSTANT
// ============================================================

const CM = 567;

const FONT_12 = 24;
const FONT_13 = 26;
const FONT_14 = 28;
const FONT_16 = 32;

const WORD_FONT = "Times New Roman";

// ============================================================
// BASIC HELPERS
// ============================================================

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN").format(Number(value || 0));

const formatDate = (value) => {
  if (!value) {
    return "...../...../..........";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const hasValue = (value) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const escapeHtml = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const cleanRepresentativeName = (value) => {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/^\((Ông|Bà)\)\s*/i, "")
    .replace(/^(Ông|Bà)[\s.:]*/i, "")
    .trim();
};

const normalizeBoolean = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

// ============================================================
// NUMBER TO VIETNAMESE
// ============================================================

const numberToVietnamese = (input) => {
  let number = Math.round(Number(input || 0));

  if (!Number.isFinite(number)) {
    return "";
  }

  if (number === 0) {
    return "Không đồng";
  }

  const digits = [
    "không",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
  ];

  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

  const readThree = (value, full = false) => {
    const hundred = Math.floor(value / 100);

    const ten = Math.floor((value % 100) / 10);

    const one = value % 10;

    const parts = [];

    if (hundred > 0 || full) {
      parts.push(`${digits[hundred]} trăm`);
    }

    if (ten > 1) {
      parts.push(`${digits[ten]} mươi`);

      if (one === 1) {
        parts.push("mốt");
      } else if (one === 5) {
        parts.push("lăm");
      } else if (one > 0) {
        parts.push(digits[one]);
      }
    } else if (ten === 1) {
      parts.push("mười");

      if (one === 5) {
        parts.push("lăm");
      } else if (one > 0) {
        parts.push(digits[one]);
      }
    } else if (one > 0) {
      if (hundred > 0 || full) {
        parts.push("lẻ");
      }

      parts.push(digits[one]);
    }

    return parts.join(" ");
  };

  const groups = [];

  while (number > 0) {
    groups.push(number % 1000);

    number = Math.floor(number / 1000);
  }

  const result = [];

  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];

    if (group === 0) {
      continue;
    }

    const full = i !== groups.length - 1 && group < 100;

    result.push(readThree(group, full));

    if (units[i]) {
      result.push(units[i]);
    }
  }

  const text = result.join(" ").replace(/\s+/g, " ").trim();

  return text.charAt(0).toUpperCase() + text.slice(1) + " đồng";
};

// ============================================================
// VAT
// ============================================================

const normalizeVatType = (value, fallback = "NO_VAT") => {
  const raw = String(value || "").toUpperCase();

  if (raw === "NO_VAT" || raw === "EXCLUDED" || raw === "INCLUDED") {
    return raw;
  }

  const numeric = Number(value);

  if (numeric === 1) {
    return "INCLUDED";
  }

  if (numeric === 2) {
    return "EXCLUDED";
  }

  if (numeric === 3) {
    return "NO_VAT";
  }

  return fallback;
};

const calculateItem = (
  item = {},
  contractVatType = "NO_VAT",
  contractVatRate = 0,
) => {
  const quantity = Number(item.quantity_actual || 0);

  const unitPrice = Number(item.unit_price || 0);

  const vatType = normalizeVatType(
    item.vat_type,
    normalizeVatType(contractVatType, "NO_VAT"),
  );

  const vatRate =
    vatType === "NO_VAT"
      ? 0
      : Number(item.vat_rate ?? contractVatRate ?? 0) || 0;

  const linePrice = quantity * unitPrice;

  let amountBeforeVat = linePrice;

  let vatAmount = 0;

  let amountAfterVat = linePrice;

  if (vatType === "EXCLUDED") {
    amountBeforeVat =
      item.actual_amount !== undefined && item.actual_amount !== null
        ? Number(item.actual_amount || 0)
        : linePrice;

    vatAmount =
      item.vat_amount !== undefined &&
      item.vat_amount !== null &&
      Number(item.vat_amount) !== 0
        ? Number(item.vat_amount)
        : amountBeforeVat * (vatRate / 100);

    amountAfterVat =
      item.amount_after_vat !== undefined &&
      item.amount_after_vat !== null &&
      Number(item.amount_after_vat) !== 0
        ? Number(item.amount_after_vat)
        : amountBeforeVat + vatAmount;
  }

  if (vatType === "INCLUDED") {
    amountAfterVat =
      item.amount_after_vat !== undefined &&
      item.amount_after_vat !== null &&
      Number(item.amount_after_vat) !== 0
        ? Number(item.amount_after_vat)
        : linePrice;

    if (vatRate > 0) {
      amountBeforeVat = amountAfterVat / (1 + vatRate / 100);

      vatAmount = amountAfterVat - amountBeforeVat;
    } else {
      amountBeforeVat = amountAfterVat;

      vatAmount = 0;
    }
  }

  if (vatType === "NO_VAT") {
    amountBeforeVat = linePrice;

    vatAmount = 0;

    amountAfterVat = linePrice;
  }

  return {
    quantity,

    unitPrice,

    vatType,

    vatRate,

    amountBeforeVat: Math.round(amountBeforeVat),

    vatAmount: Math.round(vatAmount),

    amountAfterVat: Math.round(amountAfterVat),
  };
};

// ============================================================
// NORMALIZE SETTLEMENT EXPORT DATA
// ============================================================

const normalizeSettlementExportData = ({
  contract,
  settlement,
  acceptances = [],
}) => {
  const contractData = normalizeContractData(contract);

  const items = settlement?.items || [];

  const contractItems = items.filter(
    (item) => !normalizeBoolean(item.is_extra),
  );

  const extraItems = items.filter((item) => normalizeBoolean(item.is_extra));

  const hasExtra = extraItems.length > 0;

  const showVatColumn = hasExtra && contractData.vatType !== "NO_VAT";

  let subtotal = 0;

  let vatAmount = 0;

  let total = 0;

  const vatMap = new Map();

  items.forEach((item) => {
    const calc = calculateItem(
      item,

      contractData.vatType,

      contractData.vat_rate,
    );

    subtotal += calc.amountBeforeVat;

    vatAmount += calc.vatAmount;

    total += calc.amountAfterVat;

    const key = `${calc.vatType}_${calc.vatRate}`;

    if (!vatMap.has(key)) {
      vatMap.set(key, {
        vat_type: calc.vatType,

        vat_rate: calc.vatRate,

        subtotal: 0,

        vat_amount: 0,

        total: 0,
      });
    }

    const group = vatMap.get(key);

    group.subtotal += calc.amountBeforeVat;

    group.vat_amount += calc.vatAmount;

    group.total += calc.amountAfterVat;
  });

  if (total <= 0 && Number(settlement?.actual_value || 0) > 0) {
    total = Number(settlement.actual_value || 0);
  }

  return {
    contract: contractData,

    settlement,

    items,

    contractItems,

    extraItems,

    hasExtra,

    showVatColumn,

    subtotal: Number(settlement?.subtotal || 0) || subtotal,

    vatAmount: Number(settlement?.vat_amount || 0) || vatAmount,

    total,

    vatGroups: Array.from(vatMap.values()),

    acceptances: (acceptances || [])
      .filter(
        (item) =>
          item.document_type === "ACCEPTANCE" && Number(item.status) === 1,
      )
      .sort((a, b) => Number(a.batch_no || 0) - Number(b.batch_no || 0)),
  };
};

// ============================================================
// PDF PARTY
// ============================================================

const buildInfoRow = (label, value) => {
  if (!hasValue(value)) {
    return "";
  }

  return `
    <div class="info-row">
      <div class="info-label">
        ${escapeHtml(label)}
      </div>

      <div>:</div>

      <div>
        ${escapeHtml(value)}
      </div>
    </div>
  `;
};

const buildRepresentativeRow = (name, title) => {
  if (!hasValue(name) && !hasValue(title)) {
    return "";
  }

  return `
    <div class="info-row">

      <div class="info-label">
        Đại diện
      </div>

      <div>:</div>

      <div>
        ${escapeHtml(name || "")}

        ${hasValue(title) ? ` - Chức vụ: ${escapeHtml(title)}` : ""}
      </div>

    </div>
  `;
};

const buildPartiesHtml = (data) => {
  const { customer, company, customerRep, companyRep } = data.contract;

  return `
    <section class="party">

      <div class="party-title">
        BÊN A:
        ${escapeHtml(customer.company_name || "")}
      </div>

      ${buildInfoRow("Địa chỉ", customer.address)}

      ${buildInfoRow("Điện thoại", customer.phone)}

      ${buildInfoRow("Mã số thuế", customer.tax_code)}

      ${buildInfoRow("Mã QHNS", customer.budget_code)}

      ${buildInfoRow("Tài khoản", customer.bank_account)}

      ${buildRepresentativeRow(
        customerRep.rep_name,

        customerRep.rep_title,
      )}

      ${
        hasValue(customerRep.note)
          ? `
            <div class="rep-note">
              ${escapeHtml(customerRep.note)}
            </div>
          `
          : ""
      }

    </section>

    <section class="party">

      <div class="party-title">
        BÊN B:
        ${escapeHtml(company.company_name || "")}
      </div>

      ${buildInfoRow("Địa chỉ", company.address)}

      ${buildInfoRow("Liên hệ", company.company_contact_address)}

      ${buildInfoRow("Điện thoại", company.phone)}

      ${buildInfoRow("Mã số thuế", company.tax_code)}

      ${buildInfoRow("Tài khoản", company.bank_account)}

      ${buildRepresentativeRow(
        companyRep.rep_name,

        companyRep.rep_title,
      )}

      ${
        hasValue(companyRep.note)
          ? `
            <div class="rep-note">
              ${escapeHtml(companyRep.note)}
            </div>
          `
          : ""
      }

    </section>
  `;
};

// ============================================================
// PDF ITEM ROW
// ============================================================

const buildItemRow = (item, index, data) => {
  const calc = calculateItem(
    item,

    data.contract.vatType,

    data.contract.vat_rate,
  );

  const displayAmount =
    calc.vatType === "INCLUDED" ? calc.amountAfterVat : calc.amountBeforeVat;

  return `
    <tr>

      <td class="center">
        ${index}
      </td>

      <td>
        ${escapeHtml(item.item_name || "")}

        ${
          hasValue(item.extra_note)
            ? `
              <div class="item-note">
                ${escapeHtml(item.extra_note)}
              </div>
            `
            : ""
        }
      </td>

      <td class="center">
        ${escapeHtml(item.unit || "")}
      </td>

      <td class="center">
        ${formatMoney(calc.quantity)}
      </td>

      <td class="money normal-money">
        ${formatMoney(calc.unitPrice)}
      </td>

      ${
        data.showVatColumn
          ? `
            <td class="center normal-money">
              ${
                calc.vatType === "NO_VAT"
                  ? "—"
                  : `${Number(calc.vatRate || 0)}%`
              }
            </td>
          `
          : ""
      }

      <td class="money normal-money">
        ${formatMoney(displayAmount)}
      </td>

    </tr>
  `;
};

// ============================================================
// PDF SETTLEMENT TABLE
// ============================================================

const buildSettlementTableHtml = (data) => {
  const columnCount = data.showVatColumn ? 7 : 6;

  const summaryColspan = columnCount - 1;

  let rows = "";

  if (data.hasExtra) {
    rows += `
      <tr class="group-row">
        <td colspan="${columnCount}">
          I. NỘI DUNG THEO HỢP ĐỒNG
        </td>
      </tr>
    `;
  }

  data.contractItems.forEach((item, index) => {
    rows += buildItemRow(item, index + 1, data);
  });

  if (data.hasExtra) {
    rows += `
      <tr class="group-row">
        <td colspan="${columnCount}">
          II. HẠNG MỤC PHÁT SINH
        </td>
      </tr>
    `;

    data.extraItems.forEach((item, index) => {
      rows += buildItemRow(
        item,

        data.contractItems.length + index + 1,

        data,
      );
    });
  }

  if (data.contract.vatType === "NO_VAT") {
    rows += `
      <tr class="grand-total">

        <td
          colspan="${summaryColspan}"
          class="total-label"
        >
          TỔNG CỘNG THANH TOÁN:
        </td>

        <td class="money">
          ${formatMoney(data.total)}
        </td>

      </tr>
    `;
  }

  if (data.contract.vatType === "EXCLUDED") {
    rows += `
      <tr class="summary-row">

        <td
          colspan="${summaryColspan}"
          class="total-label"
        >
          Tổng tiền trước VAT:
        </td>

        <td class="money">
          ${formatMoney(data.subtotal)}
        </td>

      </tr>
    `;

    data.vatGroups
      .filter(
        (group) =>
          group.vat_type === "EXCLUDED" &&
          Number(group.vat_rate || 0) > 0 &&
          Number(group.vat_amount || 0) > 0,
      )
      .sort((a, b) => Number(a.vat_rate || 0) - Number(b.vat_rate || 0))
      .forEach((group) => {
        rows += `
            <tr class="summary-row">

              <td
                colspan="${summaryColspan}"
                class="total-label"
              >
                Thuế GTGT
                (${Number(group.vat_rate || 0)}%):
              </td>

              <td class="money">
                ${formatMoney(group.vat_amount)}
              </td>

            </tr>
          `;
      });

    rows += `
      <tr class="grand-total">

        <td
          colspan="${summaryColspan}"
          class="total-label"
        >
          TỔNG CỘNG THANH TOÁN:
        </td>

        <td class="money">
          ${formatMoney(data.total)}
        </td>

      </tr>
    `;
  }

  if (data.contract.vatType === "INCLUDED") {
    rows += `
      <tr class="grand-total">

        <td
          colspan="${summaryColspan}"
          class="total-label"
        >
          TỔNG CỘNG THANH TOÁN:

          <div class="included-note">
            (Đơn giá đã bao gồm VAT)
          </div>
        </td>

        <td class="money">
          ${formatMoney(data.total)}
        </td>

      </tr>
    `;
  }

  return `
    <table class="settlement-table">

      <thead>

        <tr>

          <th style="width:7%">
            STT
          </th>

          <th>
            Nội dung công việc
          </th>

          <th style="width:9%">
            ĐVT
          </th>

          <th style="width:10%">
            Số lượng
          </th>

          <th style="width:16%">
            Đơn giá

            <div class="th-note">
              ${
                data.contract.vatType === "INCLUDED"
                  ? "(đã gồm VAT)"
                  : data.contract.vatType === "EXCLUDED"
                    ? "(chưa VAT)"
                    : "(không VAT)"
              }
            </div>

          </th>

          ${
            data.showVatColumn
              ? `
                <th style="width:7%">
                  VAT
                </th>
              `
              : ""
          }

          <th style="width:18%">
            Thành tiền

            <div class="th-note">
              ${
                data.contract.vatType === "INCLUDED"
                  ? "(đã gồm VAT)"
                  : data.contract.vatType === "EXCLUDED"
                    ? "(chưa VAT)"
                    : "(không VAT)"
              }
            </div>

          </th>

        </tr>

      </thead>

      <tbody>
        ${rows}
      </tbody>

    </table>

    <p class="paragraph">
      <strong>
        Bằng chữ:
      </strong>

      ${escapeHtml(numberToVietnamese(data.total))}
    </p>
  `;
};

// ============================================================
// PDF CONTRACT VALUE TABLE
// ============================================================

const buildContractValueTableHtml = (data) => {
  const items = data.contract.priceItems || [];

  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0,
  );

  let vat = 0;

  let total = subtotal;

  if (data.contract.vatType === "EXCLUDED") {
    vat = subtotal * (Number(data.contract.vat_rate || 0) / 100);

    total = subtotal + vat;
  }

  return `
    <table class="settlement-table">

      <thead>

        <tr>

          <th style="width:7%">
            STT
          </th>

          <th>
            Nội dung
          </th>

          <th style="width:9%">
            ĐVT
          </th>

          <th style="width:10%">
            Số lượng
          </th>

          <th style="width:16%">
            Đơn giá

            <div class="th-note">
              ${
                data.contract.vatType === "INCLUDED"
                  ? "(đã gồm VAT)"
                  : data.contract.vatType === "EXCLUDED"
                    ? "(chưa VAT)"
                    : "(không VAT)"
              }
            </div>

          </th>

          <th style="width:18%">
            Thành tiền
          </th>

        </tr>

      </thead>

      <tbody>

        ${items
          .map((item, index) => {
            const quantity = Number(item.quantity || 0);

            const unitPrice = Number(item.unit_price || 0);

            return `
                <tr>

                  <td class="center">
                    ${index + 1}
                  </td>

                  <td>
                    ${escapeHtml(item.item_name || "")}
                  </td>

                  <td class="center">
                    ${escapeHtml(item.unit || "")}
                  </td>

                  <td class="center">
                    ${formatMoney(quantity)}
                  </td>

                  <td class="money normal-money">
                    ${formatMoney(unitPrice)}
                  </td>

                  <td class="money normal-money">
                    ${formatMoney(quantity * unitPrice)}
                  </td>

                </tr>
              `;
          })
          .join("")}

        ${
          data.contract.vatType === "EXCLUDED"
            ? `
              <tr class="summary-row">

                <td
                  colspan="5"
                  class="total-label"
                >
                  Tổng tiền trước VAT:
                </td>

                <td class="money">
                  ${formatMoney(subtotal)}
                </td>

              </tr>

              <tr class="summary-row">

                <td
                  colspan="5"
                  class="total-label"
                >
                  Thuế GTGT
                  (${Number(data.contract.vat_rate || 0)}%):
                </td>

                <td class="money">
                  ${formatMoney(vat)}
                </td>

              </tr>
            `
            : ""
        }

        <tr class="grand-total">

          <td
            colspan="5"
            class="total-label"
          >
            Tổng giá trị hợp đồng:
          </td>

          <td class="money">
            ${formatMoney(total)}
          </td>

        </tr>

      </tbody>

    </table>

    <p class="paragraph">

      <strong>
        Bằng chữ:
      </strong>

      ${escapeHtml(numberToVietnamese(total))}

    </p>
  `;
};

// ============================================================
// BUILD PDF HTML
// ============================================================

const buildSettlementHtml = ({ contract, settlement, acceptances = [] }) => {
  const data = normalizeSettlementExportData({
    contract,

    settlement,

    acceptances,
  });

  const isAcceptance = settlement.document_type === "ACCEPTANCE";

  const isLiquidation = settlement.document_type === "LIQUIDATION";

  const contractName = data.contract.contract_name || "";

  const contractCode = data.contract.contract_code || "";

  let bodyHtml = "";

  if (isAcceptance) {
    bodyHtml = `
      <p class="paragraph basis">

        Căn cứ Hợp đồng số

        <strong>
          ${escapeHtml(contractCode)}
        </strong>

        giữa

        ${escapeHtml(toNormalCompanyName(data.contract.customer.company_name))}

và

${escapeHtml(toNormalCompanyName(data.contract.company.company_name))}

        về việc

        ${escapeHtml(contractName)};

      </p>

      <p class="paragraph basis">

        Căn cứ tình hình thực hiện
        Hợp đồng và kết quả cung cấp
        dịch vụ

        ${
          settlement.batch_no
            ? `Đợt ${String(settlement.batch_no).padStart(2, "0")}`
            : ""
        };

      </p>

      <p class="paragraph">

        Hôm nay, ngày

        <strong>
          ${formatDate(settlement.document_date)}
        </strong>,

        đại diện hai bên gồm có:

      </p>

      ${buildPartiesHtml(data)}

      <p class="paragraph">

        Hai bên cùng tiến hành nghiệm thu
        việc thực hiện Hợp đồng số

        <strong>
          ${escapeHtml(contractCode)}
        </strong>

        ${
          settlement.batch_no
            ? ` - Đợt ${String(settlement.batch_no).padStart(2, "0")}`
            : ""
        },

        với nội dung như sau:

      </p>

      <h2 class="section-title">
        1. Giá trị theo hợp đồng
      </h2>

      ${buildContractValueTableHtml(data)}

      <!--
        PHẦN NÀY LUÔN BẮT ĐẦU TRANG MỚI
      -->

      <section class="new-table-page">

        <h2 class="section-title">
          2. Giá trị thực tế nghiệm thu
        </h2>

        ${buildSettlementTableHtml(data)}

      </section>

      <p class="paragraph">

        <strong>
          3. Đánh giá chất lượng công việc:
        </strong>

        ${escapeHtml(settlement.quality_rating || "Tốt")}

      </p>

      <p class="paragraph">

        <strong>
          4. Ý kiến đánh giá khác:
        </strong>

        ${escapeHtml(settlement.other_comment || "Không")}

      </p>

      <p class="paragraph">

        Biên bản được lập thành 04 bản,
        Bên A giữ 02 bản,
        Bên B giữ 02 bản
        và có giá trị pháp lý như nhau./.

      </p>
    `;
  }

  if (isLiquidation) {
    const bases = data.acceptances
      .map((item, index) => {
        const multiple = data.acceptances.length > 1;

        return `
              <p class="paragraph basis">

                Căn cứ Biên bản nghiệm thu

                ${
                  multiple
                    ? `đợt ${String(item.batch_no || index + 1).padStart(
                        2,
                        "0",
                      )}`
                    : ""
                }

                số

                <strong>
                  ${escapeHtml(item.document_no || "")}
                </strong>

                giữa

                ${escapeHtml(
                  toNormalCompanyName(data.contract.customer.company_name),
                )}

và

${escapeHtml(toNormalCompanyName(data.contract.company.company_name))}

              </p>
            `;
      })
      .join("");

    bodyHtml = `
      <p class="paragraph basis">

        Căn cứ Hợp đồng số

        <strong>
          ${escapeHtml(contractCode)}
        </strong>

        giữa

        ${escapeHtml(toNormalCompanyName(data.contract.customer.company_name))}

và

${escapeHtml(toNormalCompanyName(data.contract.company.company_name))}

        về việc
        “${escapeHtml(contractName)}”.

      </p>

      ${bases}

      <p class="paragraph">

        Hôm nay, ngày

        <strong>
          ${formatDate(settlement.document_date)}
        </strong>,

        chúng tôi gồm:

      </p>

      ${buildPartiesHtml(data)}

      <p class="paragraph">

        Sau khi đối chiếu khối lượng dịch vụ
        đã thực hiện và nghiệm thu,
        hai bên thống nhất thanh lý
        Hợp đồng số

        <strong>
          ${escapeHtml(contractCode)}
        </strong>

        với các nội dung sau:

      </p>

      <!--
        ĐIỀU 1 + BẢNG LUÔN BẮT ĐẦU Ở TRANG MỚI
      -->

      <section class="new-table-page">

        <h2 class="section-title">
          ĐIỀU 1: HÀNG HÓA/DỊCH VỤ
        </h2>

        <p class="paragraph">

          Bên B đã thực hiện
          “${escapeHtml(contractName)}”
          cho Bên A đúng yêu cầu,
          thời gian và tiến độ
          như trong Hợp đồng số:

          <strong>
            ${escapeHtml(contractCode)}
          </strong>,

          chi tiết như sau:

        </p>

        ${buildSettlementTableHtml(data)}

      </section>

      <h2 class="section-title">

        ĐIỀU 2:
        GIÁ TRỊ THANH TOÁN THEO THỰC TẾ
        VÀ CÁC ĐIỀU KHOẢN KHÁC:

      </h2>

      <p class="paragraph">

        - Tổng trị giá hợp đồng:

        <strong>
          ${formatMoney(
            settlement.contract_value || data.contract.total_amount || 0,
          )}
          VNĐ./.
        </strong>

        (Số tiền bằng chữ:

        ${escapeHtml(
          numberToVietnamese(
            settlement.contract_value || data.contract.total_amount || 0,
          ),
        )})

      </p>

      <p class="paragraph">

        - Tổng trị quyết toán:

        <strong>
          ${formatMoney(data.total)}
          VNĐ./.
        </strong>

        (Số tiền bằng chữ:

        ${escapeHtml(numberToVietnamese(data.total))})

      </p>

      <p class="paragraph">

        - Bên A đã thanh toán cho Bên B
        số tiền theo hợp đồng là:

        <strong>
          ${formatMoney(settlement.paid_amount || 0)}
          VNĐ./.
        </strong>

        (Số tiền bằng chữ:

        ${escapeHtml(numberToVietnamese(settlement.paid_amount || 0))})

      </p>

      <p class="paragraph">

        - Số tiền Bên A còn phải thanh toán:

        <strong>
          ${formatMoney(settlement.remaining_amount || 0)}
          VNĐ./.
        </strong>

        (Số tiền bằng chữ:

        ${escapeHtml(numberToVietnamese(settlement.remaining_amount || 0))})

      </p>

      <p class="paragraph">

        - Hai bên xác nhận hoàn thành đầy đủ
        các quyền và nghĩa vụ
        theo Hợp đồng số:

        <strong>
          ${escapeHtml(contractCode)}
        </strong>

        và thống nhất thanh lý hợp đồng
        kể từ ngày ký biên bản này.

      </p>

      <p class="paragraph">

        - Biên bản này được lập thành 04
        (bốn) bản,
        Bên A giữ 02 (hai) bản,
        Bên B giữ 02 (hai) bản
        và có giá trị pháp lý ngang nhau./.

      </p>
    `;
  }

  return `
<!DOCTYPE html>

<html lang="vi">

<head>

<meta charset="UTF-8" />

<style>

* {
  box-sizing: border-box;
}

@page {
  size: A4;

  margin:
    15mm
    15mm
    15mm
    25mm;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  font-family:
    "Times New Roman",
    Times,
    serif;

  font-size: 15px;

  line-height: 1.5;

  color: #000;

  text-align: justify;
}

.header {
  text-align: center;
}

.national-title {
  margin: 0;

  font-size: 16px;

  font-weight: 700;
}

.national-subtitle {
  margin: 3px 0 0;

  font-weight: 700;
}

.national-line {
  width: 190px;

  border-bottom:
    1px solid #000;

  margin:
    4px auto 25px;
}

.document-title {
  margin: 0;

  text-align: center;

  font-size: 20px;

  font-weight: 700;
}

.document-no {
  text-align: center;

  margin:
    3px 0 18px;
}

.paragraph {
  margin:
    5px 0;

  text-indent:
    28px;

  text-align:
    justify;
}

.basis {
  font-style:
    italic;
}

.party {
  margin-top:
    12px;
}

.party-title {
  font-weight:
    700;

  margin-bottom:
    5px;
}

.info-row {
  display: grid;

  grid-template-columns:
    100px
    12px
    minmax(0, 1fr);

  margin:
    2px 0;
}

.info-label {
  white-space:
    nowrap;
}

.rep-note {
  margin-left:
    114px;

  font-style:
    italic;
}

.section-title {
  font-size:
    15px;

  margin:
    12px
    0
    5px;

  font-weight:
    700;
}

/*
 * QUAN TRỌNG:
 * phần có bảng chính sẽ bắt đầu hẳn trang mới.
 */
.new-table-page {
  page-break-before:
    always;

  break-before:
    page;
}

/*
 * Không cắt một dòng table làm đôi.
 */
.settlement-table tr,
.settlement-table th,
.settlement-table td {
  page-break-inside:
    avoid;

  break-inside:
    avoid;
}

.settlement-table {
  width: 100%;

  border-collapse:
    collapse;

  table-layout:
    fixed;

  margin:
    8px 0;

  font-size:
    12px;
}

.settlement-table thead {
  display:
    table-header-group;
}

.settlement-table th,
.settlement-table td {
  border:
    1px solid #000;

  padding:
    5px 4px;

  vertical-align:
    middle;
}

.settlement-table th {
  text-align:
    center;

  font-weight:
    700;
}

.center {
  text-align:
    center;
}

.money {
  text-align:
    right;

  white-space:
    nowrap;
}

.normal-money {
  font-weight:
    400;
}

.group-row td {
  font-weight:
    700;

  text-align:
    left;

  background:
    #f3f3f3;
}

.item-note {
  margin-top:
    2px;

  font-size:
    11px;

  font-style:
    italic;
}

.total-label {
  text-align:
    right;

  font-weight:
    700;
}

.summary-row td {
  font-weight:
    600;
}

.grand-total td {
  font-weight:
    700;
}

.included-note,
.th-note {
  font-size:
    10px;

  font-weight:
    400;

  font-style:
    italic;
}

.signature {
  display:
    grid;

  grid-template-columns:
    1fr
    1fr;

  gap:
    60px;

  margin-top:
    25px;

  page-break-inside:
    avoid;

  break-inside:
    avoid;
}

.signature-box {
  text-align:
    center;

  font-weight:
    700;
}

.signature-space {
  height:
    100px;
}

</style>

</head>

<body>

  <section class="header">

    <p class="national-title">
      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
    </p>

    <p class="national-subtitle">
      Độc lập – Tự do – Hạnh phúc
    </p>

    <div class="national-line"></div>

    <h1 class="document-title">

      ${
        isAcceptance
          ? settlement.batch_no
            ? `BIÊN BẢN NGHIỆM THU HỢP ĐỒNG ĐỢT ${String(
                settlement.batch_no,
              ).padStart(2, "0")}`
            : "BIÊN BẢN NGHIỆM THU HỢP ĐỒNG"
          : "BIÊN BẢN THANH LÝ HỢP ĐỒNG"
      }

    </h1>

    <p class="document-no">

      Số:

      ${escapeHtml(settlement.document_no || "")}

    </p>

  </section>

  ${bodyHtml}

  <section class="signature">

    <div class="signature-box">

      ĐẠI DIỆN BÊN A

      <div>
        ${escapeHtml(data.contract.customerRep.rep_title || "")}
      </div>

      <div class="signature-space"></div>

      <div>
        ${escapeHtml(
          cleanRepresentativeName(data.contract.customerRep.rep_name),
        )}
      </div>

    </div>

    <div class="signature-box">

      ĐẠI DIỆN BÊN B

      <div>
        ${escapeHtml(data.contract.companyRep.rep_title || "")}
      </div>

      <div class="signature-space"></div>

      <div>
        ${escapeHtml(
          cleanRepresentativeName(data.contract.companyRep.rep_name),
        )}
      </div>

    </div>

  </section>

</body>

</html>
  `;
};

// ============================================================
// PDF
// ============================================================

const generateSettlementPdf = async (payload) => {
  let browser;

  try {
    const html = buildSettlementHtml(payload);

    browser = await puppeteer.launch({
      headless: true,

      args: [
        "--no-sandbox",

        "--disable-setuid-sandbox",

        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 794,

      height: 1123,

      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",

      printBackground: true,

      preferCSSPageSize: true,

      margin: {
        top: "0mm",

        right: "0mm",

        bottom: "0mm",

        left: "0mm",
      },

      displayHeaderFooter: false,
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// ============================================================
// WORD HELPERS
// ============================================================

const WORD_BORDER = {
  style: BorderStyle.SINGLE,

  size: 4,

  color: "000000",
};

const WORD_NO_BORDER = {
  style: BorderStyle.NONE,

  size: 0,

  color: "FFFFFF",
};

const wordRun = (text, options = {}) =>
  new TextRun({
    text: text === null || text === undefined ? "" : String(text),

    font: WORD_FONT,

    size: options.size || FONT_13,

    bold: Boolean(options.bold),

    italics: Boolean(options.italics),
  });

const toNormalCompanyName = (value) => {
  if (!value) return "";

  return String(value)
    .toLocaleLowerCase("vi-VN")
    .replace(/(^|[\s–\-])\p{L}/gu, (char) => char.toLocaleUpperCase("vi-VN"))
    .trim();
};

const wordParagraph = (text = "", options = {}) =>
  new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,

    spacing: {
      before: options.before ?? 60,

      after: options.after ?? 60,

      line: options.line ?? 360,
    },

    indent:
      options.firstLine === null
        ? undefined
        : {
            firstLine:
              options.firstLine === undefined
                ? Math.round(0.75 * CM)
                : options.firstLine,
          },

    keepNext: Boolean(options.keepNext),

    keepLines: Boolean(options.keepLines),

    children: options.children || [
      wordRun(text, {
        size: options.size || FONT_13,

        bold: options.bold,

        italics: options.italics,
      }),
    ],
  });

const wordCenter = (text, options = {}) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,

    spacing: {
      before: options.before ?? 0,

      after: options.after ?? 0,

      line: 276,
    },

    keepNext: Boolean(options.keepNext),

    children: [
      wordRun(text, {
        size: options.size || FONT_13,

        bold: options.bold,

        italics: options.italics,
      }),
    ],
  });

const wordCell = (text, options = {}) =>
  new TableCell({
    columnSpan: options.columnSpan,

    verticalAlign: VerticalAlign.CENTER,

    width: options.width
      ? {
          size: options.width,

          type: WidthType.PERCENTAGE,
        }
      : undefined,

    borders: options.noBorder
      ? {
          top: WORD_NO_BORDER,

          bottom: WORD_NO_BORDER,

          left: WORD_NO_BORDER,

          right: WORD_NO_BORDER,
        }
      : {
          top: WORD_BORDER,

          bottom: WORD_BORDER,

          left: WORD_BORDER,

          right: WORD_BORDER,
        },

    shading: options.shading
      ? {
          fill: options.shading,

          type: ShadingType.CLEAR,
        }
      : undefined,

    margins: {
      top: options.padding ?? 90,

      bottom: options.padding ?? 90,

      left: options.padding ?? 70,

      right: options.padding ?? 70,
    },

    children: [
      new Paragraph({
        alignment: options.alignment || AlignmentType.CENTER,

        spacing: {
          before: 20,

          after: 20,

          line: 240,
        },

        children: [
          wordRun(text, {
            size: options.size || FONT_12,

            bold: options.bold,

            italics: options.italics,
          }),
        ],
      }),
    ],
  });

// ============================================================
// WORD HEADER
// ============================================================

const buildWordHeader = (data) => {
  const settlement = data.settlement;

  const title =
    settlement.document_type === "ACCEPTANCE"
      ? settlement.batch_no
        ? `BIÊN BẢN NGHIỆM THU HỢP ĐỒNG ĐỢT ${String(
            settlement.batch_no,
          ).padStart(2, "0")}`
        : "BIÊN BẢN NGHIỆM THU HỢP ĐỒNG"
      : "BIÊN BẢN THANH LÝ HỢP ĐỒNG";

  return [
    wordCenter("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", {
      bold: true,

      size: FONT_14,

      after: 20,

      keepNext: true,
    }),

    wordCenter("Độc lập – Tự do – Hạnh phúc", {
      bold: true,

      size: FONT_13,

      keepNext: true,
    }),

    wordCenter("________________________", {
      size: FONT_12,

      after: 280,

      keepNext: true,
    }),

    wordCenter(title, {
      bold: true,

      size: FONT_16,

      after: 20,

      keepNext: true,
    }),

    wordCenter(`Số: ${settlement.document_no || ""}`, {
      size: FONT_13,

      after: 200,
    }),
  ];
};

// ============================================================
// WORD PARTY
// ============================================================

const buildWordPartyInfo = (rows) =>
  new Table({
    width: {
      size: 100,

      type: WidthType.PERCENTAGE,
    },

    borders: {
      top: WORD_NO_BORDER,

      bottom: WORD_NO_BORDER,

      left: WORD_NO_BORDER,

      right: WORD_NO_BORDER,

      insideHorizontal: WORD_NO_BORDER,

      insideVertical: WORD_NO_BORDER,
    },

    rows: rows
      .filter((item) => hasValue(item.value))
      .map(
        (item) =>
          new TableRow({
            cantSplit: true,

            children: [
              wordCell(item.label, {
                width: 16,

                noBorder: true,

                alignment: AlignmentType.LEFT,

                size: FONT_13,

                padding: 10,
              }),

              wordCell(":", {
                width: 3,

                noBorder: true,

                size: FONT_13,

                padding: 10,
              }),

              wordCell(item.value, {
                width: 81,

                noBorder: true,

                alignment: AlignmentType.LEFT,

                size: FONT_13,

                padding: 10,
              }),
            ],
          }),
      ),
  });

const buildWordParty = (
  label,
  party,
  representative,
  includeContact = false,
) => {
  const blocks = [];

  blocks.push(
    new Paragraph({
      spacing: {
        before: 120,

        after: 40,

        line: 276,
      },

      keepNext: true,

      children: [
        wordRun(`${label}: `, {
          bold: true,
        }),

        wordRun(party.company_name || "", {
          bold: true,
        }),
      ],
    }),
  );

  const representativeText = `${representative.rep_name || ""}${
    representative.rep_title ? ` - Chức vụ: ${representative.rep_title}` : ""
  }`;

  blocks.push(
    buildWordPartyInfo([
      {
        label: "Địa chỉ",

        value: party.address,
      },

      ...(includeContact
        ? [
            {
              label: "Liên hệ",

              value: party.company_contact_address,
            },
          ]
        : []),

      {
        label: "Điện thoại",

        value: party.phone,
      },

      {
        label: "Mã số thuế",

        value: party.tax_code,
      },

      {
        label: "Mã QHNS",

        value: party.budget_code,
      },

      {
        label: "Tài khoản",

        value: party.bank_account,
      },

      {
        label: "Đại diện",

        value: representativeText,
      },
    ]),
  );

  return blocks;
};

// ============================================================
// WORD CONTRACT VALUE
// ============================================================

const getContractWordTotal = (data) => {
  const subtotal = (data.contract.priceItems || []).reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0,
  );

  const vat =
    data.contract.vatType === "EXCLUDED"
      ? subtotal * (Number(data.contract.vat_rate || 0) / 100)
      : 0;

  return {
    subtotal,

    vat,

    total: subtotal + vat,
  };
};

const buildWordContractValueTable = (data) => {
  const rows = [];

  rows.push(
    new TableRow({
      cantSplit: true,

      tableHeader: true,

      height: {
        value: 650,

        rule: HeightRule.ATLEAST,
      },

      children: [
        wordCell("STT", {
          width: 7,

          bold: true,
        }),

        wordCell("Nội dung", {
          width: 40,

          bold: true,
        }),

        wordCell("ĐVT", {
          width: 9,

          bold: true,
        }),

        wordCell("Số lượng", {
          width: 10,

          bold: true,
        }),

        wordCell(
          data.contract.vatType === "INCLUDED"
            ? "Đơn giá\n(đã gồm VAT)"
            : data.contract.vatType === "EXCLUDED"
              ? "Đơn giá\n(chưa VAT)"
              : "Đơn giá\n(không VAT)",
          {
            width: 16,

            bold: true,
          },
        ),

        wordCell("Thành tiền", {
          width: 18,

          bold: true,
        }),
      ],
    }),
  );

  (data.contract.priceItems || []).forEach((item, index) => {
    const quantity = Number(item.quantity || 0);

    const unitPrice = Number(item.unit_price || 0);

    rows.push(
      new TableRow({
        cantSplit: true,

        children: [
          wordCell(index + 1, {
            width: 7,
          }),

          wordCell(item.item_name || "", {
            width: 40,

            alignment: AlignmentType.LEFT,
          }),

          wordCell(item.unit || "", {
            width: 9,
          }),

          wordCell(formatMoney(quantity), {
            width: 10,
          }),

          wordCell(formatMoney(unitPrice), {
            width: 16,

            alignment: AlignmentType.RIGHT,
          }),

          wordCell(formatMoney(quantity * unitPrice), {
            width: 18,

            alignment: AlignmentType.RIGHT,
          }),
        ],
      }),
    );
  });

  const totals = getContractWordTotal(data);

  if (data.contract.vatType === "EXCLUDED") {
    rows.push(
      new TableRow({
        cantSplit: true,

        children: [
          wordCell("Tổng tiền trước VAT:", {
            columnSpan: 5,

            bold: true,

            alignment: AlignmentType.RIGHT,
          }),

          wordCell(formatMoney(totals.subtotal), {
            bold: true,

            alignment: AlignmentType.RIGHT,
          }),
        ],
      }),

      new TableRow({
        cantSplit: true,

        children: [
          wordCell(`Thuế GTGT (${Number(data.contract.vat_rate || 0)}%):`, {
            columnSpan: 5,

            bold: true,

            alignment: AlignmentType.RIGHT,
          }),

          wordCell(formatMoney(totals.vat), {
            bold: true,

            alignment: AlignmentType.RIGHT,
          }),
        ],
      }),
    );
  }

  rows.push(
    new TableRow({
      cantSplit: true,

      children: [
        wordCell("Tổng giá trị hợp đồng:", {
          columnSpan: 5,

          bold: true,

          alignment: AlignmentType.RIGHT,
        }),

        wordCell(formatMoney(totals.total), {
          bold: true,

          alignment: AlignmentType.RIGHT,
        }),
      ],
    }),
  );

  return {
    total: totals.total,

    table: new Table({
      width: {
        size: 100,

        type: WidthType.PERCENTAGE,
      },

      rows,
    }),
  };
};

// ============================================================
// WORD SETTLEMENT TABLE
// ============================================================

const buildWordSettlementTable = (data) => {
  const rows = [];

  const columnCount = data.showVatColumn ? 7 : 6;

  const summarySpan = columnCount - 1;

  const header = [
    wordCell("STT", {
      width: 7,

      bold: true,
    }),

    wordCell("Nội dung công việc", {
      width: data.showVatColumn ? 33 : 40,

      bold: true,
    }),

    wordCell("ĐVT", {
      width: 9,

      bold: true,
    }),

    wordCell("Số lượng", {
      width: 10,

      bold: true,
    }),

    wordCell(
      data.contract.vatType === "INCLUDED"
        ? "Đơn giá\n(đã gồm VAT)"
        : data.contract.vatType === "EXCLUDED"
          ? "Đơn giá\n(chưa VAT)"
          : "Đơn giá\n(không VAT)",
      {
        width: 16,

        bold: true,
      },
    ),
  ];

  if (data.showVatColumn) {
    header.push(
      wordCell("VAT", {
        width: 7,

        bold: true,
      }),
    );
  }

  header.push(
    wordCell(
      data.contract.vatType === "INCLUDED"
        ? "Thành tiền\n(đã gồm VAT)"
        : data.contract.vatType === "EXCLUDED"
          ? "Thành tiền\n(chưa VAT)"
          : "Thành tiền\n(không VAT)",
      {
        width: 18,

        bold: true,
      },
    ),
  );

  rows.push(
    new TableRow({
      cantSplit: true,

      tableHeader: true,

      height: {
        value: 650,

        rule: HeightRule.ATLEAST,
      },

      children: header,
    }),
  );

  const groupRow = (title) =>
    new TableRow({
      cantSplit: true,

      children: [
        wordCell(title, {
          columnSpan: columnCount,

          bold: true,

          shading: "F3F3F3",

          alignment: AlignmentType.LEFT,
        }),
      ],
    });

  if (data.hasExtra) {
    rows.push(groupRow("I. NỘI DUNG THEO HỢP ĐỒNG"));
  }

  const pushItem = (item, stt) => {
    const calc = calculateItem(
      item,

      data.contract.vatType,

      data.contract.vat_rate,
    );

    const displayAmount =
      calc.vatType === "INCLUDED" ? calc.amountAfterVat : calc.amountBeforeVat;

    const cells = [
      wordCell(stt, {
        width: 7,
      }),

      wordCell(
        `${item.item_name || ""}${
          item.extra_note ? `\n${item.extra_note}` : ""
        }`,
        {
          width: data.showVatColumn ? 33 : 40,

          alignment: AlignmentType.LEFT,
        },
      ),

      wordCell(item.unit || "", {
        width: 9,
      }),

      wordCell(formatMoney(calc.quantity), {
        width: 10,
      }),

      wordCell(formatMoney(calc.unitPrice), {
        width: 16,

        alignment: AlignmentType.RIGHT,
      }),
    ];

    if (data.showVatColumn) {
      cells.push(
        wordCell(
          calc.vatType === "NO_VAT" ? "—" : `${Number(calc.vatRate || 0)}%`,
          {
            width: 7,
          },
        ),
      );
    }

    cells.push(
      wordCell(formatMoney(displayAmount), {
        width: 18,

        alignment: AlignmentType.RIGHT,
      }),
    );

    rows.push(
      new TableRow({
        cantSplit: true,

        children: cells,
      }),
    );
  };

  data.contractItems.forEach((item, index) => pushItem(item, index + 1));

  if (data.hasExtra) {
    rows.push(groupRow("II. HẠNG MỤC PHÁT SINH"));

    data.extraItems.forEach((item, index) =>
      pushItem(
        item,

        data.contractItems.length + index + 1,
      ),
    );
  }

  if (data.contract.vatType === "EXCLUDED") {
    rows.push(
      new TableRow({
        cantSplit: true,

        children: [
          wordCell("Tổng tiền trước VAT:", {
            columnSpan: summarySpan,

            bold: true,

            alignment: AlignmentType.RIGHT,
          }),

          wordCell(formatMoney(data.subtotal), {
            bold: true,

            alignment: AlignmentType.RIGHT,
          }),
        ],
      }),
    );

    data.vatGroups
      .filter(
        (group) =>
          group.vat_type === "EXCLUDED" &&
          Number(group.vat_rate || 0) > 0 &&
          Number(group.vat_amount || 0) > 0,
      )
      .sort((a, b) => Number(a.vat_rate || 0) - Number(b.vat_rate || 0))
      .forEach((group) => {
        rows.push(
          new TableRow({
            cantSplit: true,

            children: [
              wordCell(`Thuế GTGT (${Number(group.vat_rate || 0)}%):`, {
                columnSpan: summarySpan,

                bold: true,

                alignment: AlignmentType.RIGHT,
              }),

              wordCell(formatMoney(group.vat_amount), {
                bold: true,

                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        );
      });
  }

  const totalLabel =
    data.contract.vatType === "INCLUDED"
      ? "TỔNG CỘNG THANH TOÁN:\n(Đơn giá đã bao gồm VAT)"
      : "TỔNG CỘNG THANH TOÁN:";

  rows.push(
    new TableRow({
      cantSplit: true,

      children: [
        wordCell(totalLabel, {
          columnSpan: summarySpan,

          bold: true,

          alignment: AlignmentType.RIGHT,
        }),

        wordCell(formatMoney(data.total), {
          bold: true,

          alignment: AlignmentType.RIGHT,
        }),
      ],
    }),
  );

  return new Table({
    width: {
      size: 100,

      type: WidthType.PERCENTAGE,
    },

    rows,
  });
};

// ============================================================
// WORD SIGNATURE
// ============================================================

const buildWordSignatures = (data) => {
  const signatureCell = (label, representative) =>
    new TableCell({
      width: {
        size: 50,

        type: WidthType.PERCENTAGE,
      },

      borders: {
        top: WORD_NO_BORDER,

        bottom: WORD_NO_BORDER,

        left: WORD_NO_BORDER,

        right: WORD_NO_BORDER,
      },

      children: [
        wordCenter(label, {
          bold: true,
        }),

        wordCenter(representative.rep_title || "", {
          bold: true,
        }),

        new Paragraph({
          spacing: {
            before: 1100,

            after: 0,
          },
        }),

        wordCenter(cleanRepresentativeName(representative.rep_name), {
          bold: true,
        }),
      ],
    });

  return new Table({
    width: {
      size: 100,

      type: WidthType.PERCENTAGE,
    },

    borders: {
      top: WORD_NO_BORDER,

      bottom: WORD_NO_BORDER,

      left: WORD_NO_BORDER,

      right: WORD_NO_BORDER,

      insideHorizontal: WORD_NO_BORDER,

      insideVertical: WORD_NO_BORDER,
    },

    rows: [
      new TableRow({
        cantSplit: true,

        children: [
          signatureCell(
            "ĐẠI DIỆN BÊN A",

            data.contract.customerRep,
          ),

          signatureCell(
            "ĐẠI DIỆN BÊN B",

            data.contract.companyRep,
          ),
        ],
      }),
    ],
  });
};

// ============================================================
// WORD
// ============================================================

const generateSettlementWord = async (payload) => {
  const data = normalizeSettlementExportData(payload);

  const { contract, settlement } = data;

  const children = [...buildWordHeader(data)];

  const isAcceptance = settlement.document_type === "ACCEPTANCE";

  const isLiquidation = settlement.document_type === "LIQUIDATION";

  // ==========================================================
  // LEGAL BASIS
  // ==========================================================

  children.push(
    wordParagraph("", {
      italics: true,

      children: [
        wordRun("Căn cứ Hợp đồng số ", {
          italics: true,
        }),

        wordRun(contract.contract_code || "", {
          italics: true,

          bold: true,
        }),

        wordRun(
          ` giữa ${toNormalCompanyName(
            contract.customer.company_name,
          )} và ${toNormalCompanyName(contract.company.company_name)} về việc ${
            isLiquidation
              ? `“${contract.contract_name || ""}”`
              : contract.contract_name || ""
          };`,
          {
            italics: true,
          },
        ),
      ],
    }),
  );

  if (isAcceptance) {
    children.push(
      wordParagraph(
        `Căn cứ tình hình thực hiện Hợp đồng và kết quả cung cấp dịch vụ${
          settlement.batch_no
            ? ` Đợt ${String(settlement.batch_no).padStart(2, "0")}`
            : ""
        };`,
        {
          italics: true,
        },
      ),
    );
  }

  if (isLiquidation) {
    data.acceptances.forEach((acceptance, index) => {
      const multiple = data.acceptances.length > 1;

      children.push(
        wordParagraph(
          `Căn cứ Biên bản nghiệm thu ${
            multiple
              ? `đợt ${String(acceptance.batch_no || index + 1).padStart(
                  2,
                  "0",
                )} `
              : ""
          }số ${acceptance.document_no || ""} giữa ${toNormalCompanyName(
            contract.customer.company_name,
          )} và ${toNormalCompanyName(contract.company.company_name)}.`,
          {
            italics: true,
          },
        ),
      );
    });
  }

  // ==========================================================
  // DATE
  // ==========================================================

  children.push(
    wordParagraph("", {
      children: [
        wordRun("Hôm nay, ngày "),

        wordRun(formatDate(settlement.document_date), {
          bold: true,
        }),

        wordRun(
          isAcceptance ? ", đại diện hai bên gồm có:" : ", chúng tôi gồm:",
        ),
      ],
    }),
  );

  // ==========================================================
  // PARTY A
  // ==========================================================

  children.push(
    ...buildWordParty(
      "BÊN A",

      contract.customer,

      contract.customerRep,

      false,
    ),
  );

  // ==========================================================
  // PARTY B
  // ==========================================================

  children.push(
    ...buildWordParty(
      "BÊN B",

      contract.company,

      contract.companyRep,

      true,
    ),
  );

  // ==========================================================
  // ACCEPTANCE
  // ==========================================================

  if (isAcceptance) {
    children.push(
      wordParagraph("", {
        children: [
          wordRun(
            "Hai bên cùng tiến hành nghiệm thu việc thực hiện Hợp đồng số ",
          ),

          wordRun(contract.contract_code || "", {
            bold: true,
          }),

          wordRun(
            `${
              settlement.batch_no
                ? ` - Đợt ${String(settlement.batch_no).padStart(2, "0")}`
                : ""
            }, với nội dung như sau:`,
          ),
        ],
      }),
    );

    // ========================================================
    // 1. CONTRACT VALUE
    // ========================================================

    children.push(
      wordParagraph("1. Giá trị theo hợp đồng", {
        bold: true,

        firstLine: 0,

        before: 130,

        after: 60,

        keepNext: true,
      }),
    );

    const contractValue = buildWordContractValueTable(data);

    children.push(contractValue.table);

    children.push(
      wordParagraph("", {
        before: 80,

        children: [
          wordRun("Bằng chữ: ", {
            bold: true,
          }),

          wordRun(numberToVietnamese(contractValue.total)),
        ],
      }),
    );

    // ========================================================
    // QUAN TRỌNG:
    // SECTION 2 + TABLE BẮT ĐẦU HẲN TRANG MỚI
    // ========================================================

    children.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
    );

    children.push(
      wordParagraph("2. Giá trị thực tế nghiệm thu", {
        bold: true,

        firstLine: 0,

        before: 0,

        after: 60,

        keepNext: true,
      }),
    );

    children.push(buildWordSettlementTable(data));

    children.push(
      wordParagraph("", {
        before: 80,

        children: [
          wordRun("Bằng chữ: ", {
            bold: true,
          }),

          wordRun(numberToVietnamese(data.total)),
        ],
      }),
    );

    children.push(
      wordParagraph("", {
        firstLine: 0,

        children: [
          wordRun("3. Đánh giá chất lượng công việc: ", {
            bold: true,
          }),

          wordRun(settlement.quality_rating || "Tốt"),
        ],
      }),
    );

    children.push(
      wordParagraph("", {
        firstLine: 0,

        children: [
          wordRun("4. Ý kiến đánh giá khác: ", {
            bold: true,
          }),

          wordRun(settlement.other_comment || "Không"),
        ],
      }),
    );

    children.push(
      wordParagraph(
        "Biên bản được lập thành 04 bản, Bên A giữ 02 bản, Bên B giữ 02 bản và có giá trị pháp lý như nhau./.",
        {
          after: 200,
        },
      ),
    );
  }

  // ==========================================================
  // LIQUIDATION
  // ==========================================================

  if (isLiquidation) {
    children.push(
      wordParagraph("", {
        children: [
          wordRun(
            "Sau khi đối chiếu khối lượng dịch vụ đã thực hiện và nghiệm thu, hai bên thống nhất thanh lý Hợp đồng số ",
          ),

          wordRun(contract.contract_code || "", {
            bold: true,
          }),

          wordRun(" với các nội dung sau:"),
        ],
      }),
    );

    // ========================================================
    // ĐIỀU 1 + TABLE BẮT ĐẦU HẲN TRANG MỚI
    // ========================================================

    children.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
    );

    children.push(
      wordParagraph("ĐIỀU 1: HÀNG HÓA/DỊCH VỤ", {
        bold: true,

        firstLine: 0,

        before: 0,

        after: 60,

        keepNext: true,
      }),
    );

    children.push(
      wordParagraph("", {
        children: [
          wordRun(
            `Bên B đã thực hiện “${
              contract.contract_name || ""
            }” cho Bên A đúng yêu cầu, thời gian và tiến độ như trong Hợp đồng số: `,
          ),

          wordRun(contract.contract_code || "", {
            bold: true,
          }),

          wordRun(", chi tiết như sau:"),
        ],
      }),
    );

    children.push(buildWordSettlementTable(data));

    children.push(
      wordParagraph("", {
        before: 80,

        children: [
          wordRun("Bằng chữ: ", {
            bold: true,
          }),

          wordRun(numberToVietnamese(data.total)),
        ],
      }),
    );

    children.push(
      wordParagraph(
        "ĐIỀU 2: GIÁ TRỊ THANH TOÁN THEO THỰC TẾ VÀ CÁC ĐIỀU KHOẢN KHÁC:",
        {
          bold: true,

          firstLine: 0,

          before: 130,

          after: 60,

          keepNext: true,
        },
      ),
    );

    const contractTotal = Number(
      settlement.contract_value || contract.total_amount || 0,
    );

    const paid = Number(settlement.paid_amount || 0);

    const remaining = Number(settlement.remaining_amount || 0);

    const addMoneyLine = (label, value) => {
      children.push(
        wordParagraph("", {
          children: [
            wordRun(`${label}: `),

            wordRun(`${formatMoney(value)} VNĐ./.`, {
              bold: true,
            }),

            wordRun(` (Số tiền bằng chữ: ${numberToVietnamese(value)})`),
          ],
        }),
      );
    };

    addMoneyLine(
      "- Tổng trị giá hợp đồng",

      contractTotal,
    );

    addMoneyLine(
      "- Tổng trị quyết toán",

      data.total,
    );

    addMoneyLine(
      "- Bên A đã thanh toán cho Bên B số tiền theo hợp đồng là",

      paid,
    );

    addMoneyLine(
      "- Số tiền Bên A còn phải thanh toán",

      remaining,
    );

    children.push(
      wordParagraph("", {
        children: [
          wordRun(
            "- Hai bên xác nhận hoàn thành đầy đủ các quyền và nghĩa vụ theo Hợp đồng số: ",
          ),

          wordRun(contract.contract_code || "", {
            bold: true,
          }),

          wordRun(
            " và thống nhất thanh lý hợp đồng kể từ ngày ký biên bản này.",
          ),
        ],
      }),
    );

    children.push(
      wordParagraph(
        "- Biên bản này được lập thành 04 (bốn) bản, Bên A giữ 02 (hai) bản, Bên B giữ 02 (hai) bản và có giá trị pháp lý ngang nhau./.",
        {
          after: 200,
        },
      ),
    );
  }

  // ==========================================================
  // SIGNATURE
  // ==========================================================

  children.push(buildWordSignatures(data));

  // ==========================================================
  // DOCUMENT
  // ==========================================================

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: WORD_FONT,

            size: FONT_13,
          },

          paragraph: {
            spacing: {
              line: 276,
            },
          },
        },
      },
    },

    sections: [
      {
        properties: {
          page: {
            margin: {
              top: Math.round(1.5 * CM),

              right: Math.round(1.5 * CM),

              bottom: Math.round(1.5 * CM),

              left: Math.round(2.5 * CM),
            },
          },
        },

        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  normalizeSettlementExportData,

  buildSettlementHtml,

  generateSettlementPdf,

  generateSettlementWord,
};
