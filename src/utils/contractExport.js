// File: src/utils/contractExport.js

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
  BorderStyle,
  VerticalAlign,
  TabStopType,
  HeightRule,
} = require("docx");

// ============================================================
// CONSTANT
// ============================================================

const CM = 567;

const FONT_13 = 26;
const FONT_13_5 = 25;
const FONT_14 = 28;
const FONT_16 = 32;

// ============================================================
// FORMAT MONEY
// ============================================================

const formatMoney = (value) => {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
};

// ============================================================
// FORMAT DATE
// ============================================================

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

// ============================================================
// FORMAT SIGNED DATE
// ============================================================

const formatSignedDateText = (value) => {
  if (!value) {
    return "Hôm nay, ngày ..... tháng ..... năm ..........";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return `Hôm nay, ngày ${value}`;
  }

  const day = String(date.getDate()).padStart(2, "0");

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const year = date.getFullYear();

  return `Hôm nay, ngày ${day} tháng ${month} năm ${year}`;
};

// ============================================================
// HAS VALUE
// ============================================================

const hasValue = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  return String(value).trim() !== "";
};

// ============================================================
// CLEAN NAME
// ============================================================

const cleanRepresentativeName = (value) => {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/^\((Ông|Bà)\)\s*/i, "")
    .replace(/^(Ông|Bà)[\s.:]*/i, "")
    .trim();
};

// ============================================================
// ESCAPE HTML
// ============================================================

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

// ============================================================
// NORMALIZE
// ============================================================

const normalizeContractData = (contract) => {
  const raw =
    typeof contract?.toJSON === "function" ? contract.toJSON() : contract || {};

  const customer =
    raw.customer_profile ||
    (raw.parties || []).find(
      (item) => Number(item.party_type) === 1 || item.party_type === "CUSTOMER",
    ) ||
    {};

  const company =
    raw.company_profile ||
    (raw.parties || []).find(
      (item) => Number(item.party_type) === 2 || item.party_type === "COMPANY",
    ) ||
    {};

  const customerRep =
    raw.customer_representative ||
    (raw.representatives || []).find(
      (item) => Number(item.rep_type) === 1 || item.rep_type === "CUSTOMER",
    ) ||
    {};

  const companyRep =
    raw.company_representative ||
    (raw.representatives || []).find(
      (item) => Number(item.rep_type) === 2 || item.rep_type === "COMPANY",
    ) ||
    {};

  const content = raw.contract_content || {};

  const advance = raw.advance || {};

  const departures = raw.departures || [];

  const priceItems = raw.price_items || [];

  const legalBases = raw.legal_bases || [];

  let vatType = raw.vat_type;

  if (
    vatType !== "INCLUDED" &&
    vatType !== "EXCLUDED" &&
    vatType !== "NO_VAT"
  ) {
    const numeric = Number(vatType);

    if (numeric === 2) {
      vatType = "EXCLUDED";
    } else if (numeric === 3) {
      vatType = "NO_VAT";
    } else {
      vatType = "INCLUDED";
    }
  }

  return {
    ...raw,

    customer,
    company,

    customerRep,
    companyRep,

    content,
    advance,

    departures,
    priceItems,
    legalBases,

    vatType,
  };
};

// ============================================================
// ============================================================
// PDF HELPERS
// ============================================================
// ============================================================

// ============================================================
// INFO ROW
// ============================================================

const buildInfoRow = (label, value) => {
  if (!hasValue(value)) {
    return "";
  }

  return `
    <div class="preview-info-row">

      <span class="preview-info-label">
        ${escapeHtml(label)}
      </span>

      <span>
        :
      </span>

      <span>
        ${escapeHtml(value)}
      </span>

    </div>
  `;
};

// ============================================================
// REPRESENTATIVE
// ============================================================

const buildRepresentativeRow = (name, title) => {
  if (!hasValue(name) && !hasValue(title)) {
    return "";
  }

  if (hasValue(name) && hasValue(title)) {
    return `
      <div class="preview-info-row has-inline">

        <span class="preview-info-label">
          Đại diện
        </span>

        <span>
          :
        </span>

        <span>
          ${escapeHtml(name)}
        </span>

        <span class="preview-inline-title">
          Chức vụ:
        </span>

        <span>
          ${escapeHtml(title)}
        </span>

      </div>
    `;
  }

  if (hasValue(name)) {
    return buildInfoRow("Đại diện", name);
  }

  return buildInfoRow("Chức vụ", title);
};

// ============================================================
// BUILD HTML
// ============================================================

const buildContractHtml = (contract) => {
  const data = normalizeContractData(contract);

  // ==========================================================
  // NORMAL TEXT
  // ==========================================================

  const renderTextLines = (content) => {
    if (!hasValue(content)) {
      return "";
    }

    return String(content)
      .split("\n")
      .map((line) => {
        const value = line.trim();

        if (!value) {
          return `
            <div class="preview-empty-line"></div>
          `;
        }

        return `
          <p class="preview-contract-paragraph">
            ${escapeHtml(value)}
          </p>
        `;
      })
      .join("");
  };

  // ==========================================================
  // HANGING LIST
  // dùng cho:
  // – bullet
  // 1. 2. 3.
  // ==========================================================

  const renderHangingListItem = (marker, content, className) => {
    return `
      <div class="${className} preview-hanging-row">

        <div class="preview-hanging-marker">
          ${escapeHtml(marker)}
        </div>

        <div class="preview-hanging-content">
          ${escapeHtml(content)}
        </div>

      </div>
    `;
  };

  // ==========================================================
  // ARTICLE CONTENT
  // ==========================================================

  const renderArticleContent = (content) => {
    if (!hasValue(content)) {
      return "";
    }

    return String(content)
      .split("\n")
      .map((line) => {
        const value = line.trim();

        if (!value) {
          return `
            <div class="preview-empty-line"></div>
          `;
        }

        // ====================================================
        // 4.1. ...
        // ====================================================

        const clauseMatch = value.match(/^(\d+\.\d+\.)\s*(.*)$/);

        if (clauseMatch) {
          return `
            <h3 class="preview-clause-title">

              ${escapeHtml(clauseMatch[1])}

              ${clauseMatch[2] ? ` ${escapeHtml(clauseMatch[2])}` : ""}

            </h3>
          `;
        }

        // ====================================================
        // a) / b) / c) / đ)
        //
        // QUAN TRỌNG:
        //
        // CHỈ DÒNG ĐẦU THỤT.
        //
        // DÒNG THỨ 2 TRỞ ĐI QUAY VỀ LỀ TRÁI
        // CÙNG CẤP VỚI 4.2.
        // ====================================================

        const letterMatch = value.match(/^([a-zA-ZđĐ]\))\s*(.*)$/);

        if (letterMatch) {
          return `
            <p class="preview-letter-paragraph">

              ${escapeHtml(letterMatch[1])}

              ${escapeHtml(letterMatch[2])}

            </p>
          `;
        }

        // ====================================================
        // BULLET
        // ====================================================

        const bulletMatch = value.match(/^([-–•])\s*(.*)$/);

        if (bulletMatch) {
          return renderHangingListItem(
            "–",
            bulletMatch[2],
            "preview-bullet-paragraph",
          );
        }

        // ====================================================
        // 1. 2. 3.
        // ====================================================

        const numberMatch = value.match(/^(\d+\.)\s*(.*)$/);

        if (numberMatch) {
          return renderHangingListItem(
            numberMatch[1],
            numberMatch[2],
            "preview-number-paragraph",
          );
        }

        // ====================================================
        // NORMAL
        // ====================================================

        return `
          <p class="preview-contract-paragraph">
            ${escapeHtml(value)}
          </p>
        `;
      })
      .join("");
  };

  // ==========================================================
  // LEGAL BASE
  // ==========================================================

  const legalBasesHtml = data.legalBases
    .filter((item) => hasValue(item.content))
    .map(
      (item) => `
          <p class="preview-contract-paragraph preview-legal-paragraph">

            ${escapeHtml(item.content)}

          </p>
        `,
    )
    .join("");

  // ==========================================================
  // DEPARTURES
  // ==========================================================

  const departuresHtml = data.departures
    .map((item, index) => {
      const prefix =
        data.departures.length > 1
          ? `${
              item.departure_name || `Đợt ${String(index + 1).padStart(2, "0")}`
            }: `
          : "";

      return `
            <p class="preview-contract-paragraph">

              ${prefix ? `<strong>${escapeHtml(prefix)}</strong>` : ""}

              Từ ngày

              <strong>
                ${escapeHtml(formatDate(item.start_date))}
              </strong>

              đến ngày

              <strong>
                ${escapeHtml(formatDate(item.end_date))}
              </strong>

            </p>
          `;
    })
    .join("");

  // ==========================================================
  // PRICE ROWS
  // ==========================================================

  const priceRows = data.priceItems
    .map((item, index) => {
      const quantity = Number(item.quantity || 0);

      const unitPrice = Number(item.unit_price || 0);

      const amount = Number(item.amount || quantity * unitPrice);

      return `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td class="preview-table-text">

                ${escapeHtml(item.item_name || "")}

              </td>

              <td>
                ${formatMoney(quantity)}
              </td>

              <td>
                ${escapeHtml(item.unit || "")}
              </td>

              <td class="preview-money">

                ${formatMoney(unitPrice)}

              </td>

              <td class="preview-money">

                ${formatMoney(amount)}

              </td>

            </tr>
          `;
    })
    .join("");

  // ==========================================================
  // VAT
  // ==========================================================

  let vatRows = "";

  if (data.vatType === "EXCLUDED") {
    vatRows = `
      <tr>

        <td
          colspan="5"
          class="preview-total-label"
        >
          Cộng tiền dịch vụ chưa VAT
        </td>

        <td class="preview-money">
          ${formatMoney(data.contract_value)}
        </td>

      </tr>


      <tr>

        <td
          colspan="5"
          class="preview-total-label"
        >

          Thuế giá trị gia tăng
          (${Number(data.vat_rate || 0)}%)

        </td>

        <td class="preview-money">

          ${formatMoney(data.vat_amount)}

        </td>

      </tr>
    `;
  }

  // ==========================================================
  // PARTY A
  // ==========================================================

  const customerHtml = `
    <section class="preview-party-section">

      <h2 class="preview-party-title">

        BÊN A:

        ${escapeHtml(data.customer.company_name || "")}

      </h2>


      ${buildInfoRow("Địa chỉ", data.customer.address)}


      ${buildInfoRow("Điện thoại", data.customer.phone)}


      ${buildInfoRow("Mã số thuế", data.customer.tax_code)}


      ${buildInfoRow("Mã QHNS", data.customer.budget_code)}


      ${buildInfoRow("Tài khoản", data.customer.bank_account)}


      ${buildRepresentativeRow(
        data.customerRep.rep_name,

        data.customerRep.rep_title,
      )}


      ${
        hasValue(data.customerRep.note)
          ? `
            <p class="preview-note">

              ${escapeHtml(data.customerRep.note)}

            </p>
          `
          : ""
      }


      <p class="preview-party-closing">

        Sau đây gọi tắt là

        <strong>
          Bên A
        </strong>.

      </p>

    </section>
  `;

  // ==========================================================
  // PARTY B
  // ==========================================================

  const companyHtml = `
    <section class="preview-party-section">

      <h2 class="preview-party-title">

        BÊN B:

        ${escapeHtml(data.company.company_name || "")}

      </h2>


      ${buildInfoRow("Địa chỉ", data.company.address)}

      ${buildInfoRow("Liên hệ", data.company.company_contact_address)}



      ${buildInfoRow("Điện thoại", data.company.phone)}


      ${buildInfoRow("Mã số thuế", data.company.tax_code)}


      ${buildInfoRow("Mã QHNS", data.company.budget_code)}


      ${buildInfoRow("Tài khoản", data.company.bank_account)}


      ${buildRepresentativeRow(
        data.companyRep.rep_name,

        data.companyRep.rep_title,
      )}


      ${
        hasValue(data.companyRep.note)
          ? `
            <p class="preview-note">

              ${escapeHtml(data.companyRep.note)}

            </p>
          `
          : ""
      }


      <p class="preview-party-closing">

        Sau đây gọi tắt là

        <strong>
          Bên B
        </strong>.

      </p>

    </section>
  `;

  // ==========================================================
  // ACCOUNT
  // ==========================================================

  const accountName =
    data.vatType === "NO_VAT"
      ? cleanRepresentativeName(data.companyRep.rep_name)
      : "CTY TNHH TM DL VA SU KIEN VIET NAM";

  let accountHtml = "";

  if (hasValue(accountName)) {
    accountHtml += renderHangingListItem(
      "–",
      `Tên tài khoản: ${accountName};`,
      "preview-bullet-paragraph",
    );
  }

  if (hasValue(data.company.bank_account)) {
    accountHtml += renderHangingListItem(
      "–",
      `Tài khoản ngân hàng: ${data.company.bank_account}.`,
      "preview-bullet-paragraph",
    );
  }

  // ==========================================================
  // ADVANCE
  //
  // QUAN TRỌNG:
  // a) / b) dùng first-line indent
  // KHÔNG dùng grid
  // ==========================================================

  const advance = data.advance || {};

  const advanceAmount = Number(advance.advance_amount || 0);

  const remainingAmount = Math.max(
    Number(data.total_amount || 0) - advanceAmount,

    0,
  );

  let advanceHtml = "";

  if (advance.is_advance) {
    const rate = Number(advance.advance_rate || advance.advance_percent || 0);

    advanceHtml = `
      <p class="preview-letter-paragraph">

        <strong>
          a) Tạm ứng hợp đồng:
        </strong>

        Bên A tạm ứng cho Bên B

        ${
          Number(advance.calc_type) === 1 || advance.calc_type === "PERCENT"
            ? `${rate}% giá trị hợp đồng, `
            : ""
        }

        tương đương số tiền

        <strong>
          ${formatMoney(advanceAmount)} đồng
        </strong>

        ${
          hasValue(advance.payment_date)
            ? `, thời hạn tạm ứng đến ngày ${formatDate(advance.payment_date)}`
            : " sau khi ký kết hợp đồng theo thời hạn hai bên thống nhất"
        }.

      </p>


      <p class="preview-letter-paragraph">

        <strong>
          b) Thanh toán giá trị còn lại:
        </strong>

        Bên A thanh toán cho Bên B số tiền còn lại
        sau khi trừ giá trị đã tạm ứng, dự kiến là

        <strong>
          ${formatMoney(remainingAmount)} đồng
        </strong>

        và các khoản chi phí phát sinh (nếu có),
        trong vòng

        <strong>
          ${advance.due_date || 15} ngày
        </strong>

        sau khi Bên B hoàn thành dịch vụ và cung cấp
        đầy đủ hồ sơ thanh toán hợp lệ.

      </p>
    `;
  } else {
    advanceHtml = `
      <p class="preview-letter-paragraph">

        <strong>
          a) Thanh toán giá trị còn lại:
        </strong>

        Bên A thanh toán cho Bên B 100% giá trị
        thanh toán sau khi Bên B hoàn thành dịch vụ,
        hai bên nghiệm thu và Bên B cung cấp đầy đủ
        hồ sơ thanh toán hợp lệ.

      </p>
    `;
  }

  // ==========================================================
  // ARTICLE 4 - 11
  // ==========================================================

  const articles = [
    ["ĐIỀU 4. QUYỀN VÀ TRÁCH NHIỆM CỦA BÊN A", data.content.article_4],

    ["ĐIỀU 5. QUYỀN VÀ TRÁCH NHIỆM CỦA BÊN B", data.content.article_5],

    [
      "ĐIỀU 6. QUẢN LÝ, XÁC NHẬN VÀ THANH TOÁN CHI PHÍ PHÁT SINH",
      data.content.article_6,
    ],

    ["ĐIỀU 7. SỰ KIỆN BẤT KHẢ KHÁNG", data.content.article_7],

    [
      "ĐIỀU 8. PHẠT VI PHẠM HỢP ĐỒNG VÀ BỒI THƯỜNG THIỆT HẠI",
      data.content.article_8,
    ],

    ["ĐIỀU 9. LUẬT ÁP DỤNG VÀ GIẢI QUYẾT TRANH CHẤP", data.content.article_9],

    ["ĐIỀU 10. BẢO MẬT THÔNG TIN VÀ DỮ LIỆU CÁ NHÂN", data.content.article_10],

    ["ĐIỀU 11. ĐIỀU KHOẢN CHUNG", data.content.article_11],
  ];

  const articlesHtml = articles
    .map(
      ([title, content]) => `
          <section class="preview-article">

            <h2>
              ${escapeHtml(title)}
            </h2>

            ${renderArticleContent(content)}

          </section>
        `,
    )
    .join("");

  // ==========================================================
  // HTML
  // ==========================================================

  return `
<!DOCTYPE html>

<html lang="vi">

<head>

<meta charset="UTF-8" />

<style>

* {
  box-sizing: border-box;
}


html,
body {
  margin: 0;

  padding: 0;

  background: #ffffff;
}


body {
  font-family:
    "Times New Roman",
    Times,
    serif;

  color: #000000;

  -webkit-print-color-adjust:
    exact;

  print-color-adjust:
    exact;
}


/* ==========================================================
   PAGE
   TOP    1.5CM
   RIGHT  1.5CM
   BOTTOM 1.5CM
   LEFT   2.5CM
========================================================== */

@page {
  size: A4;

  margin:
    15mm
    15mm
    15mm
    25mm;
}


/* ==========================================================
   PAPER
========================================================== */

.contract-preview-wrapper {
  width: 100%;

  margin: 0;

  padding: 0;
}


.contract-preview-paper {
  width: 100%;

  margin: 0;

  padding: 0;

  font-family:
    "Times New Roman",
    Times,
    serif;

  font-size: 15px;

  line-height: 1.5;

  color: #000000;

  text-align: justify;
}


/* ==========================================================
   HEADER
========================================================== */

.preview-heading {
  text-align: center;
}


.preview-national-title {
  margin: 0;

  font-size: 16px;

  font-weight: 700;
}


.preview-national-subtitle {
  margin:
    3px
    0
    0;

  font-size: 15px;

  font-weight: 700;
}


.preview-national-line {
  width: 190px;

  margin:
    4px
    auto
    0;

  border-bottom:
    1px solid
    #000000;
}


.preview-contract-title {
  margin:
    36px
    0
    0;

  font-size: 22px;

  font-weight: 700;

  text-align: center;
}


.preview-contract-code {
  margin:
    3px
    0
    18px;

  text-align: center;
}


/* ==========================================================
   NORMAL PARAGRAPH
========================================================== */

.preview-contract-paragraph {
  margin:
    4px
    0;

  text-indent:
    28px;

  text-align:
    justify;

  orphans: 2;

  widows: 2;
}


.preview-legal-paragraph {
  font-style: italic;
}


.preview-empty-line {
  height: 7px;
}


/* ==========================================================
   a) / b) / c) / đ)

   CHỈ DÒNG ĐẦU THỤT 28PX.

   DÒNG 2 TRỞ ĐI QUAY VỀ LỀ TRÁI
   CÙNG CẤP VỚI 4.2.
========================================================== */

.preview-letter-paragraph {
  margin:
    4px
    0;

  padding: 0;

  text-indent:
    28px;

  font-size:
    15px;

  line-height:
    1.5;

  text-align:
    justify;

  orphans: 2;

  widows: 2;
}


/* ==========================================================
   PARTY
========================================================== */

.preview-party-section {
  margin-top: 14px;
}


.preview-party-title {
  margin:
    0
    0
    7px;

  font-size: 15px;

  font-weight: 700;

  text-transform: uppercase;

  text-align: left;
}


.preview-info-row {
  display: grid;

  grid-template-columns:
    100px
    12px
    minmax(0, 1fr);

  gap: 2px;

  align-items: baseline;

  margin:
    3px
    0;
}


.preview-info-row.has-inline {
  grid-template-columns:
    100px
    12px
    minmax(150px, 1fr)
    auto
    minmax(100px, 0.6fr);

  column-gap: 5px;
}


.preview-info-label {
  white-space: nowrap;
}


.preview-inline-title {
  margin-left: 8px;

  white-space: nowrap;
}


.preview-note {
  margin:
    3px
    0
    3px
    114px;

  font-style: italic;
}


.preview-party-closing {
  margin:
    5px
    0
    0;
}


.preview-introduction {
  margin:
    14px
    0;

  text-indent:
    28px;

  text-align: justify;
}


/* ==========================================================
   ARTICLE
========================================================== */

.preview-article {
  margin-top: 16px;

  break-inside: auto;
}


.preview-article h2 {
  margin:
    0
    0
    7px;

  font-size: 16px;

  font-weight: 700;

  text-align: left;

  break-after: avoid;

  page-break-after: avoid;
}


.preview-article h3,
.preview-clause-title {
  margin:
    8px
    0
    4px;

  font-size: 15px;

  font-weight: 700;

  text-align: left;

  break-after: avoid;

  page-break-after: avoid;
}


/* ==========================================================
   BULLET / NUMBER
   VẪN DÙNG HANGING
========================================================== */

.preview-hanging-row {
  display: grid;

  grid-template-columns:
    28px
    minmax(0, 1fr);

  column-gap: 4px;

  align-items: start;

  margin:
    4px
    0;

  padding: 0;

  font-size: 15px;

  line-height: 1.5;
}


.preview-hanging-marker {
  white-space: nowrap;

  text-align: left;
}


.preview-hanging-content {
  min-width: 0;

  text-align: justify;

  orphans: 2;

  widows: 2;
}


/* ==========================================================
   TABLE
========================================================== */

.preview-price-table {
  width: 100%;

  margin:
    10px
    0;

  border-collapse:
    collapse;

  table-layout:
    fixed;

  font-size: 13px;
}


.preview-price-table th,
.preview-price-table td {
  padding:
    5px
    4px;

  border:
    1px solid
    #000000;

  vertical-align:
    middle;

  word-break:
    break-word;
}


.preview-price-table th {
  text-align: center;

  font-weight: 700;
}


.preview-price-table th:nth-child(1) {
  width: 7%;
}


.preview-price-table th:nth-child(2) {
  width: 33%;
}


.preview-price-table th:nth-child(3) {
  width: 12%;
}


.preview-price-table th:nth-child(4) {
  width: 10%;
}


.preview-price-table th:nth-child(5),
.preview-price-table th:nth-child(6) {
  width: 19%;
}


.preview-price-table td {
  text-align: center;
}


.preview-table-text {
  text-align:
    left !important;
}


.preview-money {
  text-align:
    right !important;

  white-space:
    nowrap;
}


.preview-total-label {
  text-align:
    right !important;

  font-weight:
    700;
}


.preview-total-row td {
  font-weight:
    700;
}


.preview-amount-words {
  margin:
    6px
    0
    8px;
}


.preview-price-table tr {
  break-inside: avoid;

  page-break-inside: avoid;
}


/* ==========================================================
   SIGNATURE
========================================================== */

.preview-signature-section {
  display: grid;

  grid-template-columns:
    1fr
    1fr;

  gap: 60px;

  margin-top: 28px;

  break-inside: avoid;

  page-break-inside: avoid;
}


.preview-signature-box {
  text-align: center;
}


.preview-signature-title,
.preview-signature-position,
.preview-signature-name {
  margin: 0;

  font-weight: 700;

  text-align: center;

  text-transform: uppercase;
}


.preview-signature-position {
  margin-top: 2px;
}


.preview-signature-space {
  height: 100px;
}


/* ==========================================================
   PRINT
========================================================== */

@media print {

  html,
  body,
  .contract-preview-wrapper,
  .contract-preview-paper {
    width: 100%;

    margin: 0;

    padding: 0;
  }

}

</style>

</head>


<body>

<div class="contract-preview-wrapper">

<div class="contract-preview-paper">


<!-- ========================================================
     HEADER
========================================================= -->

<section class="preview-heading">

  <p class="preview-national-title">
    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
  </p>


  <p class="preview-national-subtitle">
    Độc lập – Tự do – Hạnh phúc
  </p>


  <div class="preview-national-line"></div>


  <h1 class="preview-contract-title">
    HỢP ĐỒNG DỊCH VỤ
  </h1>


  <p class="preview-contract-code">

    Số:

    ${escapeHtml(data.contract_code || "...../.....")}

  </p>

</section>


<!-- ========================================================
     LEGAL BASE
========================================================= -->

${legalBasesHtml}


<p class="preview-contract-paragraph">

  ${escapeHtml(formatSignedDateText(data.signed_date))}, chúng tôi gồm:

</p>


<!-- ========================================================
     PARTIES
========================================================= -->

${customerHtml}

${companyHtml}


<p class="preview-introduction">

  Các bên cùng nhau thỏa thuận ký kết Hợp đồng dịch vụ
  du lịch lữ hành (“Hợp đồng”) với các điều khoản và
  điều kiện sau:

</p>


<!-- ========================================================
     ARTICLE 1
========================================================= -->

<section class="preview-article">

  <h2>
    ĐIỀU 1. NỘI DUNG HỢP ĐỒNG
  </h2>


  <h3>
    1.1. Nội dung công việc
  </h3>


  ${renderTextLines(data.content.work_content)}


  ${renderTextLines(data.content.service_content)}


  <h3>
    1.2. Chương trình tham quan
  </h3>


  ${renderTextLines(data.content.tour_program)}


  <h3>
    1.3. Thời gian thực hiện
  </h3>


  ${departuresHtml}


  <h3>
    1.4. Thứ tự ưu tiên áp dụng hồ sơ hợp đồng
  </h3>


  ${renderArticleContent(data.content.priority_documents)}


  <h3>
    1.5. Khối lượng phát sinh ngoài hợp đồng
  </h3>


  ${renderArticleContent(data.content.extra_volume)}

</section>


<!-- ========================================================
     ARTICLE 2
========================================================= -->

<section class="preview-article">

  <h2>
    ĐIỀU 2. GIÁ HỢP ĐỒNG, GIÁ DỊCH VỤ VÀ GIÁ TRỊ THANH TOÁN
  </h2>


  <h3>
    2.1. Giá trị hợp đồng
  </h3>


  <table class="preview-price-table">

    <thead>

      <tr>

        <th>
          STT
        </th>

        <th>
          Hạng mục/Tuyến tour
        </th>

        <th>
          Số lượng
        </th>

        <th>
          ĐVT
        </th>

        <th>
          Đơn giá
        </th>

        <th>
          Thành tiền
        </th>

      </tr>

    </thead>


    <tbody>

      ${priceRows}

      ${vatRows}


      <tr class="preview-total-row">

        <td
          colspan="5"
          class="preview-total-label"
        >

          ${
            data.vatType === "INCLUDED"
              ? "Tổng cộng (Đã bao gồm VAT)"
              : data.vatType === "EXCLUDED"
                ? "Tổng giá trị sau VAT"
                : "Tổng giá trị hợp đồng"
          }

        </td>


        <td class="preview-money">

          ${formatMoney(data.total_amount)}

        </td>

      </tr>

    </tbody>

  </table>


  <p class="preview-amount-words">

    <strong>
      Bằng chữ:
    </strong>

    ${escapeHtml(data.amount_in_words || "")}.

  </p>


  <p class="preview-contract-paragraph">

    Giá hợp đồng

    ${data.vatType === "NO_VAT" ? "chưa bao gồm" : "đã bao gồm"}

    thuế giá trị gia tăng (VAT), các loại thuế,
    phí, lệ phí và toàn bộ chi phí cần thiết để
    thực hiện đầy đủ các nội dung công việc theo
    Hợp đồng.

  </p>


  <h3>
    2.2. Giá trị thanh toán
  </h3>


  <p class="preview-contract-paragraph">

    Giá trị thanh toán thực tế được xác định trên
    cơ sở khối lượng dịch vụ thực tế đã thực hiện,
    số lượng người tham gia thực tế, các khối lượng
    phát sinh được chấp thuận và các khoản giảm trừ
    theo thỏa thuận của các bên.

  </p>
  <h3>
  2.3. Dịch vụ bao gồm
</h3>

${
  hasValue(data.content.included_services)
    ? renderArticleContent(data.content.included_services)
    : ""
}


<h3>
  2.4. Dịch vụ không bao gồm
</h3>

${
  hasValue(data.content.excluded_services)
    ? renderArticleContent(data.content.excluded_services)
    : ""
}

</section>


<!-- ========================================================
     ARTICLE 3
========================================================= -->

<section class="preview-article">

  <h2>
    ĐIỀU 3. PHƯƠNG THỨC VÀ TIẾN ĐỘ THANH TOÁN
  </h2>


  <h3>
    3.1. Đồng tiền thanh toán
  </h3>


  <p class="preview-contract-paragraph">

    Đồng tiền sử dụng trong thanh toán là Việt Nam
    đồng (VNĐ).

  </p>


  <h3>
    3.2. Phương thức thanh toán
  </h3>


  ${
    hasValue(data.content.payment_content)
      ? renderTextLines(data.content.payment_content)
      : `
        <p class="preview-contract-paragraph">

          Bên A thực hiện thanh toán bằng hình thức
          chuyển khoản vào tài khoản của Bên B theo
          thông tin sau:

        </p>
      `
  }


  ${accountHtml}


  <h3>
    3.3. Tiến độ thanh toán
  </h3>


  ${advanceHtml}


  ${
    hasValue(data.content.payment_schedule_content)
      ? renderArticleContent(data.content.payment_schedule_content)
      : ""
  }


  <p class="preview-letter-paragraph">

    <strong>

      ${data.advance?.is_advance ? "c)" : "b)"}

      Hồ sơ thanh toán gồm:

    </strong>

  </p>


  ${renderHangingListItem(
    "–",
    "Văn bản đề nghị thanh toán của Bên B;",
    "preview-bullet-paragraph",
  )}


  ${renderHangingListItem(
    "–",
    "Hóa đơn giá trị gia tăng hợp pháp;",
    "preview-bullet-paragraph",
  )}


  ${renderHangingListItem(
    "–",
    "Biên bản nghiệm thu và thanh lý hợp đồng;",
    "preview-bullet-paragraph",
  )}


  ${renderHangingListItem(
    "–",
    "Biên bản xác nhận khối lượng phát sinh (nếu có);",
    "preview-bullet-paragraph",
  )}


  ${renderHangingListItem(
    "–",
    "Các tài liệu khác theo thỏa thuận của hai bên.",
    "preview-bullet-paragraph",
  )}
    <h3>
  3.4. Chậm thanh toán
</h3>

${
  hasValue(data.content.late_payment)
    ? renderArticleContent(data.content.late_payment)
    : ""
}

</section>


<!-- ========================================================
     ARTICLE 4 - 11
========================================================= -->

${articlesHtml}


<!-- ========================================================
     SIGNATURE
========================================================= -->

<section class="preview-signature-section">

  <div class="preview-signature-box">

    <p class="preview-signature-title">
      ĐẠI DIỆN BÊN A
    </p>


    ${
      hasValue(data.customerRep.rep_title)
        ? `
          <p class="preview-signature-position">

            ${escapeHtml(data.customerRep.rep_title)}

          </p>
        `
        : ""
    }


    <div class="preview-signature-space"></div>


    <p class="preview-signature-name">

      ${escapeHtml(cleanRepresentativeName(data.customerRep.rep_name))}

    </p>

  </div>


  <div class="preview-signature-box">

    <p class="preview-signature-title">
      ĐẠI DIỆN BÊN B
    </p>


    ${
      hasValue(data.companyRep.rep_title)
        ? `
          <p class="preview-signature-position">

            ${escapeHtml(data.companyRep.rep_title)}

          </p>
        `
        : ""
    }


    <div class="preview-signature-space"></div>


    <p class="preview-signature-name">

      ${escapeHtml(cleanRepresentativeName(data.companyRep.rep_name))}

    </p>

  </div>

</section>


</div>

</div>

</body>

</html>
  `;
};

// ============================================================
// GENERATE PDF
// ============================================================

const generateContractPdf = async (contract) => {
  let browser;

  try {
    const html = buildContractHtml(contract);

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

    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

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

      scale: 1,

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
// ============================================================
// WORD HELPERS
// ============================================================
// ============================================================

// ============================================================
// WORD RUN
// ============================================================

const wordRun = (text, options = {}) => {
  return new TextRun({
    text: text === null || text === undefined ? "" : String(text),

    font: "Times New Roman",

    size: options.size || FONT_13_5,

    bold: Boolean(options.bold),

    italics: Boolean(options.italics),
  });
};

// ============================================================
// NORMAL BODY
// ============================================================

const wordBodyParagraph = (text, options = {}) => {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,

    spacing: {
      before: options.before ?? 60,

      after: options.after ?? 0,

      line: options.line || 276,
    },

    indent: {
      firstLine:
        options.firstLine !== undefined
          ? options.firstLine
          : Math.round(0.75 * CM),
    },

    keepNext: Boolean(options.keepNext),

    children: [wordRun(text, options)],
  });
};

// ============================================================
// NO INDENT
// ============================================================

const wordNoIndent = (text, options = {}) => {
  return wordBodyParagraph(text, {
    ...options,

    firstLine: 0,
  });
};

// ============================================================
// ARTICLE TITLE
// ============================================================

const wordArticleTitle = (text) => {
  return new Paragraph({
    alignment: AlignmentType.LEFT,

    spacing: {
      before: 120,

      after: 60,

      line: 276,
    },

    keepNext: true,

    children: [
      wordRun(text, {
        bold: true,

        size: FONT_13_5,
      }),
    ],
  });
};

// ============================================================
// CLAUSE TITLE
// ============================================================

const wordClauseTitle = (text) => {
  return new Paragraph({
    alignment: AlignmentType.LEFT,

    spacing: {
      before: 80,

      after: 40,

      line: 276,
    },

    keepNext: true,

    children: [
      wordRun(text, {
        bold: true,

        size: FONT_13_5,
      }),
    ],
  });
};

// ============================================================
// LETTER PARAGRAPH
//
// a) Bên A..........................
// dòng thứ 2 quay về cùng lề 4.2.
//
// CHỈ FIRST LINE INDENT
// KHÔNG LEFT
// KHÔNG HANGING
// ============================================================

const wordLetterParagraph = (text, options = {}) => {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,

    spacing: {
      before: options.before ?? 60,

      after: options.after ?? 0,

      line: 276,
    },

    indent: {
      firstLine: Math.round(0.75 * CM),
    },

    children: options.children || [
      wordRun(text, {
        size: FONT_13_5,
      }),
    ],
  });
};

// ============================================================
// HANGING PARAGRAPH
//
// dành cho:
//
// – nội dung...
//   dòng 2...
//
// 1. nội dung...
//    dòng 2...
// ============================================================

const wordHangingParagraph = (marker, content, options = {}) => {
  const contentPosition = Math.round(0.75 * CM);

  const hanging = Math.round(0.45 * CM);

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,

    spacing: {
      before: options.before ?? 60,

      after: options.after ?? 0,

      line: 276,
    },

    indent: {
      left: contentPosition,

      hanging,
    },

    tabStops: [
      {
        type: TabStopType.LEFT,

        position: contentPosition,
      },
    ],

    children: [
      wordRun(marker, {
        size: FONT_13_5,
      }),

      wordRun("\t", {
        size: FONT_13_5,
      }),

      wordRun(content, {
        size: FONT_13_5,

        bold: options.contentBold,
      }),
    ],
  });
};

// ============================================================
// ARTICLE -> WORD
// ============================================================

const articleToWord = (content) => {
  if (!hasValue(content)) {
    return [];
  }

  const paragraphs = [];

  String(content)
    .split("\n")
    .forEach((line) => {
      const value = line.trim();

      if (!value) {
        return;
      }

      // ======================================================
      // 4.1.
      // ======================================================

      const clauseMatch = value.match(/^(\d+\.\d+\.)\s*(.*)$/);

      if (clauseMatch) {
        paragraphs.push(
          wordClauseTitle(
            `${clauseMatch[1]}${clauseMatch[2] ? ` ${clauseMatch[2]}` : ""}`,
          ),
        );

        return;
      }

      // ======================================================
      // a) b) c) đ)
      //
      // CHỈ FIRST LINE INDENT
      // ======================================================

      const letterMatch = value.match(/^([a-zA-ZđĐ]\))\s*(.*)$/);

      if (letterMatch) {
        paragraphs.push(
          wordLetterParagraph(`${letterMatch[1]} ${letterMatch[2]}`),
        );

        return;
      }

      // ======================================================
      // BULLET
      // ======================================================

      const bulletMatch = value.match(/^([-–•])\s*(.*)$/);

      if (bulletMatch) {
        paragraphs.push(wordHangingParagraph("–", bulletMatch[2]));

        return;
      }

      // ======================================================
      // 1. 2. 3.
      // ======================================================

      const numberMatch = value.match(/^(\d+\.)\s*(.*)$/);

      if (numberMatch) {
        paragraphs.push(wordHangingParagraph(numberMatch[1], numberMatch[2]));

        return;
      }

      // ======================================================
      // NORMAL
      // ======================================================

      paragraphs.push(wordBodyParagraph(value));
    });

  return paragraphs;
};

// ============================================================
// PARTY TITLE
// ============================================================

const wordPartyTitle = (label, value) => {
  return new Paragraph({
    spacing: {
      before: 160,

      after: 40,

      line: 276,
    },

    children: [
      wordRun(`${label}: `, {
        bold: true,

        size: FONT_13,
      }),

      wordRun(value || "", {
        bold: true,

        size: FONT_13,
      }),
    ],
  });
};

// ============================================================
// PARTY INFO
// ============================================================

const wordPartyInfo = (label, value) => {
  if (!hasValue(value)) {
    return null;
  }

  return new Paragraph({
    spacing: {
      before: 20,

      after: 0,

      line: 276,
    },

    tabStops: [
      {
        type: TabStopType.LEFT,

        position: Math.round(2.7 * CM),
      },
    ],

    children: [
      wordRun(label, {
        size: FONT_13,
      }),

      wordRun("\t: ", {
        size: FONT_13,
      }),

      wordRun(value, {
        size: FONT_13,
      }),
    ],
  });
};

// ============================================================
// REPRESENTATIVE
// ============================================================

const wordRepresentative = (name, title) => {
  if (!hasValue(name) && !hasValue(title)) {
    return null;
  }

  const children = [
    wordRun("Đại diện", {
      size: FONT_13,
    }),

    wordRun("\t: ", {
      size: FONT_13,
    }),
  ];

  if (hasValue(name)) {
    children.push(
      wordRun(name, {
        size: FONT_13,
      }),
    );
  }

  if (hasValue(title)) {
    children.push(
      wordRun("\tChức vụ: ", {
        size: FONT_13,
      }),

      wordRun(title, {
        size: FONT_13,
      }),
    );
  }

  return new Paragraph({
    spacing: {
      before: 20,

      after: 0,

      line: 276,
    },

    tabStops: [
      {
        type: TabStopType.LEFT,

        position: Math.round(2.7 * CM),
      },

      {
        type: TabStopType.LEFT,

        position: Math.round(10.5 * CM),
      },
    ],

    children,
  });
};

// ============================================================
// PRICE CELL
// ============================================================

const wordPriceCell = (text, options = {}) => {
  return new TableCell({
    columnSpan: options.columnSpan,

    verticalAlign: VerticalAlign.CENTER,

    width: options.width
      ? {
          size: options.width,

          type: WidthType.PERCENTAGE,
        }
      : undefined,

    margins: {
      top: options.marginTop ?? 100,
      bottom: options.marginBottom ?? 100,
      left: options.marginLeft ?? 100,
      right: options.marginRight ?? 100,
    },
    children: [
      new Paragraph({
        alignment: options.alignment || AlignmentType.CENTER,

        spacing: {
          before: 0,

          after: 0,

          line: 240,
        },

        children: [
          wordRun(text, {
            size: 22,

            bold: options.bold,
          }),
        ],
      }),
    ],
  });
};

// ============================================================
// GENERATE WORD
// ============================================================

const generateContractWord = async (contract) => {
  const data = normalizeContractData(contract);

  const children = [];

  // ========================================================
  // HEADER
  // ========================================================

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        after: 0,

        line: 276,
      },

      children: [
        wordRun("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", {
          bold: true,

          size: FONT_14,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        after: 20,

        line: 276,
      },

      children: [
        wordRun("Độc lập – Tự do – Hạnh phúc", {
          bold: true,

          size: FONT_13,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        after: 280,
      },

      children: [
        wordRun("________________________", {
          size: FONT_13,
        }),
      ],
    }),
  );

  // ========================================================
  // TITLE
  // ========================================================

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        after: 20,

        line: 276,
      },

      children: [
        wordRun("HỢP ĐỒNG DỊCH VỤ", {
          bold: true,

          size: FONT_16,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        after: 120,

        line: 276,
      },

      children: [
        wordRun(`Số: ${data.contract_code || ""}`, {
          size: FONT_13,
        }),
      ],
    }),
  );

  // ========================================================
  // LEGAL BASE
  // ========================================================

  data.legalBases
    .filter((item) => hasValue(item.content))
    .forEach((item) => {
      children.push(
        wordBodyParagraph(item.content, {
          italics: true,
        }),
      );
    });

  children.push(
    wordBodyParagraph(
      `${formatSignedDateText(data.signed_date)}, chúng tôi gồm:`,
    ),
  );

  // ========================================================
  // PARTY A
  // ========================================================

  children.push(wordPartyTitle("BÊN A", data.customer.company_name));

  [
    wordPartyInfo("Địa chỉ", data.customer.address),

    wordPartyInfo("Điện thoại", data.customer.phone),

    wordPartyInfo("Mã số thuế", data.customer.tax_code),

    wordPartyInfo("Mã QHNS", data.customer.budget_code),

    wordPartyInfo("Tài khoản", data.customer.bank_account),

    wordRepresentative(
      data.customerRep.rep_name,

      data.customerRep.rep_title,
    ),
  ]
    .filter(Boolean)
    .forEach((item) => children.push(item));

  if (hasValue(data.customerRep.note)) {
    children.push(
      wordNoIndent(data.customerRep.note, {
        italics: true,

        size: FONT_13,
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: {
        before: 30,

        after: 60,
      },

      children: [
        wordRun("Sau đây gọi tắt là Bên A.", {
          bold: true,

          italics: true,

          size: FONT_13,
        }),
      ],
    }),
  );

  // ========================================================
  // PARTY B
  // ========================================================

  children.push(wordPartyTitle("BÊN B", data.company.company_name));

  [
    wordPartyInfo("Địa chỉ", data.company.address),
    wordPartyInfo("Liên hệ", data.company.company_contact_address),

    wordPartyInfo("Điện thoại", data.company.phone),

    wordPartyInfo("Mã số thuế", data.company.tax_code),

    wordPartyInfo("Mã QHNS", data.company.budget_code),

    wordPartyInfo("Tài khoản", data.company.bank_account),

    wordRepresentative(
      data.companyRep.rep_name,

      data.companyRep.rep_title,
    ),
  ]
    .filter(Boolean)
    .forEach((item) => children.push(item));

  if (hasValue(data.companyRep.note)) {
    children.push(
      wordNoIndent(data.companyRep.note, {
        italics: true,

        size: FONT_13,
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: {
        before: 30,

        after: 60,
      },

      children: [
        wordRun("Sau đây gọi tắt là Bên B.", {
          bold: true,

          italics: true,

          size: FONT_13,
        }),
      ],
    }),
  );

  // ========================================================
  // INTRO
  // ========================================================

  children.push(
    wordBodyParagraph(
      "Các bên cùng nhau thỏa thuận ký kết Hợp đồng dịch vụ du lịch lữ hành (“Hợp đồng”) với các điều khoản và điều kiện sau:",
    ),
  );

  // ========================================================
  // ARTICLE 1
  // ========================================================

  children.push(wordArticleTitle("ĐIỀU 1. NỘI DUNG HỢP ĐỒNG"));

  children.push(wordClauseTitle("1.1. Nội dung công việc"));

  children.push(...articleToWord(data.content.work_content));

  children.push(...articleToWord(data.content.service_content));

  children.push(wordClauseTitle("1.2. Chương trình tham quan"));

  children.push(...articleToWord(data.content.tour_program));

  children.push(wordClauseTitle("1.3. Thời gian thực hiện"));

  data.departures.forEach((item, index) => {
    const prefix =
      data.departures.length > 1
        ? `${
            item.departure_name || `Đợt ${String(index + 1).padStart(2, "0")}`
          }: `
        : "";

    children.push(
      wordBodyParagraph(
        `${prefix}Từ ngày ${formatDate(item.start_date)} đến ngày ${formatDate(
          item.end_date,
        )}`,
      ),
    );
  });

  children.push(wordClauseTitle("1.4. Thứ tự ưu tiên áp dụng hồ sơ hợp đồng"));

  children.push(...articleToWord(data.content.priority_documents));

  children.push(wordClauseTitle("1.5. Khối lượng phát sinh ngoài hợp đồng"));

  children.push(...articleToWord(data.content.extra_volume));

  // ========================================================
  // ARTICLE 2
  // ========================================================

  children.push(
    wordArticleTitle("ĐIỀU 2. GIÁ HỢP ĐỒNG, GIÁ DỊCH VỤ VÀ GIÁ TRỊ THANH TOÁN"),
  );

  children.push(wordClauseTitle("2.1. Giá trị hợp đồng"));

  // ========================================================
  // PRICE TABLE
  // ========================================================

  const tableRows = [];

  tableRows.push(
    new TableRow({
      tableHeader: true,
      height: {
        value: 300,
        rule: HeightRule.ATLEAST,
      },

      children: [
        wordPriceCell("STT", {
          width: 7,

          bold: true,
        }),

        wordPriceCell("Hạng mục/Tuyến tour", {
          width: 33,

          bold: true,
        }),

        wordPriceCell("Số lượng", {
          width: 12,

          bold: true,
        }),

        wordPriceCell("ĐVT", {
          width: 10,

          bold: true,
        }),

        wordPriceCell("Đơn giá", {
          width: 19,

          bold: true,
        }),

        wordPriceCell("Thành tiền", {
          width: 19,

          bold: true,
        }),
      ],
    }),
  );

  data.priceItems.forEach((item, index) => {
    const quantity = Number(item.quantity || 0);

    const unitPrice = Number(item.unit_price || 0);

    const amount = Number(item.amount || quantity * unitPrice);

    tableRows.push(
      new TableRow({
        height: {
          value: 300,
          rule: HeightRule.ATLEAST,
        },
        children: [
          wordPriceCell(String(index + 1)),

          wordPriceCell(item.item_name || "", {
            alignment: AlignmentType.LEFT,
          }),

          wordPriceCell(formatMoney(quantity)),

          wordPriceCell(item.unit || ""),

          wordPriceCell(formatMoney(unitPrice), {
            alignment: AlignmentType.RIGHT,
            marginRight: 250,
          }),

          wordPriceCell(formatMoney(amount), {
            alignment: AlignmentType.RIGHT,
            marginRight: 250,
          }),
        ],
      }),
    );
  });

  if (data.vatType === "EXCLUDED") {
    tableRows.push(
      new TableRow({
        height: {
          value: 300,
          rule: HeightRule.ATLEAST,
        },
        children: [
          wordPriceCell("Cộng tiền dịch vụ chưa VAT", {
            columnSpan: 5,

            alignment: AlignmentType.RIGHT,

            bold: true,
          }),

          wordPriceCell(formatMoney(data.contract_value), {
            alignment: AlignmentType.RIGHT,
            marginRight: 250,
          }),
        ],
      }),
    );

    tableRows.push(
      new TableRow({
        height: {
          value: 300,
          rule: HeightRule.ATLEAST,
        },
        children: [
          wordPriceCell(
            `Thuế giá trị gia tăng (${Number(data.vat_rate || 0)}%)`,
            {
              columnSpan: 5,

              alignment: AlignmentType.RIGHT,

              bold: true,
            },
          ),

          wordPriceCell(formatMoney(data.vat_amount), {
            alignment: AlignmentType.RIGHT,
            marginRight: 250,
          }),
        ],
      }),
    );
  }

  tableRows.push(
    new TableRow({
      height: {
        value: 300,
        rule: HeightRule.ATLEAST,
      },
      children: [
        wordPriceCell(
          data.vatType === "INCLUDED"
            ? "Tổng cộng (Đã bao gồm VAT)"
            : data.vatType === "EXCLUDED"
              ? "Tổng giá trị sau VAT"
              : "Tổng giá trị hợp đồng",
          {
            columnSpan: 5,

            alignment: AlignmentType.RIGHT,

            bold: true,
          },
        ),

        wordPriceCell(formatMoney(data.total_amount), {
          alignment: AlignmentType.RIGHT,
          bold: true,
          marginRight: 250,
        }),
      ],
    }),
  );

  children.push(
    new Table({
      width: {
        size: 100,

        type: WidthType.PERCENTAGE,
      },

      rows: tableRows,
    }),
  );

  // ========================================================
  // AMOUNT WORDS
  // ========================================================

  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,

      spacing: {
        before: 60,

        after: 0,

        line: 276,
      },

      children: [
        wordRun("Bằng chữ: ", {
          bold: true,
        }),

        wordRun(`${data.amount_in_words || ""}.`),
      ],
    }),
  );

  children.push(
    wordBodyParagraph(
      `Giá hợp đồng ${
        data.vatType === "NO_VAT" ? "chưa bao gồm" : "đã bao gồm"
      } thuế giá trị gia tăng (VAT), các loại thuế, phí, lệ phí và toàn bộ chi phí cần thiết để thực hiện đầy đủ các nội dung công việc theo Hợp đồng.`,
    ),
  );

  children.push(wordClauseTitle("2.2. Giá trị thanh toán"));

  children.push(
    wordBodyParagraph(
      "Giá trị thanh toán thực tế được xác định trên cơ sở khối lượng dịch vụ thực tế đã thực hiện, số lượng người tham gia thực tế, các khối lượng phát sinh được chấp thuận và các khoản giảm trừ theo thỏa thuận của các bên.",
    ),
  );
  // ==========================================================
  // 2.3. DỊCH VỤ BAO GỒM
  // ==========================================================

  children.push(wordClauseTitle("2.3. Dịch vụ bao gồm"));

  if (hasValue(data.content.included_services)) {
    children.push(...articleToWord(data.content.included_services));
  }
  // ==========================================================
  // 2.4. DỊCH VỤ KHÔNG BAO GỒM
  // ==========================================================

  children.push(wordClauseTitle("2.4. Dịch vụ không bao gồm"));

  if (hasValue(data.content.excluded_services)) {
    children.push(...articleToWord(data.content.excluded_services));
  }
  // ========================================================
  // ARTICLE 3
  // ========================================================

  children.push(wordArticleTitle("ĐIỀU 3. PHƯƠNG THỨC VÀ TIẾN ĐỘ THANH TOÁN"));

  children.push(wordClauseTitle("3.1. Đồng tiền thanh toán"));

  children.push(
    wordBodyParagraph(
      "Đồng tiền sử dụng trong thanh toán là Việt Nam đồng (VNĐ).",
    ),
  );

  children.push(wordClauseTitle("3.2. Phương thức thanh toán"));

  if (hasValue(data.content.payment_content)) {
    children.push(...articleToWord(data.content.payment_content));
  } else {
    children.push(
      wordBodyParagraph(
        "Bên A thực hiện thanh toán bằng hình thức chuyển khoản vào tài khoản của Bên B theo thông tin sau:",
      ),
    );
  }

  const accountName =
    data.vatType === "NO_VAT"
      ? cleanRepresentativeName(data.companyRep.rep_name)
      : "CTY TNHH TM DL VA SU KIEN VIET NAM";

  if (hasValue(accountName)) {
    children.push(wordHangingParagraph("–", `Tên tài khoản: ${accountName};`));
  }

  if (hasValue(data.company.bank_account)) {
    children.push(
      wordHangingParagraph(
        "–",
        `Tài khoản ngân hàng: ${data.company.bank_account}.`,
      ),
    );
  }

  children.push(wordClauseTitle("3.3. Tiến độ thanh toán"));

  // ========================================================
  // ADVANCE WORD
  //
  // CHỈ DÒNG ĐẦU THỤT
  // ========================================================

  if (data.advance?.is_advance) {
    const advance = data.advance;

    const rate = Number(advance.advance_rate || advance.advance_percent || 0);

    const advanceAmount = Number(advance.advance_amount || 0);

    const remaining = Math.max(
      Number(data.total_amount || 0) - advanceAmount,

      0,
    );

    children.push(
      wordLetterParagraph("", {
        children: [
          wordRun("a) Tạm ứng hợp đồng: ", {
            bold: true,
          }),

          wordRun(
            `Bên A tạm ứng cho Bên B ${
              Number(advance.calc_type) === 1 || advance.calc_type === "PERCENT"
                ? `${rate}% giá trị hợp đồng, `
                : ""
            }tương đương số tiền `,
          ),

          wordRun(`${formatMoney(advanceAmount)} đồng`, {
            bold: true,
          }),

          wordRun(
            hasValue(advance.payment_date)
              ? `, thời hạn tạm ứng đến ngày ${formatDate(
                  advance.payment_date,
                )}.`
              : " sau khi ký kết hợp đồng theo thời hạn hai bên thống nhất.",
          ),
        ],
      }),
    );

    children.push(
      wordLetterParagraph("", {
        children: [
          wordRun("b) Thanh toán giá trị còn lại: ", {
            bold: true,
          }),

          wordRun(
            "Bên A thanh toán cho Bên B số tiền còn lại sau khi trừ giá trị đã tạm ứng, dự kiến là ",
          ),

          wordRun(`${formatMoney(remaining)} đồng`, {
            bold: true,
          }),

          wordRun(
            ` và các khoản chi phí phát sinh (nếu có), trong vòng ${
              advance.due_date || 15
            } ngày sau khi Bên B hoàn thành dịch vụ và cung cấp đầy đủ hồ sơ thanh toán hợp lệ.`,
          ),
        ],
      }),
    );
  } else {
    children.push(
      wordLetterParagraph("", {
        children: [
          wordRun("a) Thanh toán giá trị còn lại: ", {
            bold: true,
          }),

          wordRun(
            "Bên A thanh toán cho Bên B 100% giá trị thanh toán sau khi Bên B hoàn thành dịch vụ, hai bên nghiệm thu và Bên B cung cấp đầy đủ hồ sơ thanh toán hợp lệ.",
          ),
        ],
      }),
    );
  }

  // ========================================================
  // PAYMENT SCHEDULE EXTRA
  // ========================================================

  if (hasValue(data.content.payment_schedule_content)) {
    children.push(...articleToWord(data.content.payment_schedule_content));
  }

  // ========================================================
  // PAYMENT DOCUMENTS
  // ========================================================

  children.push(
    wordLetterParagraph(
      `${data.advance?.is_advance ? "c)" : "b)"} Hồ sơ thanh toán gồm:`,
      {
        children: [
          wordRun(
            `${data.advance?.is_advance ? "c)" : "b)"} Hồ sơ thanh toán gồm:`,
            {
              bold: true,
            },
          ),
        ],
      },
    ),
  );

  [
    "Văn bản đề nghị thanh toán của Bên B;",

    "Hóa đơn giá trị gia tăng hợp pháp;",

    "Biên bản nghiệm thu và thanh lý hợp đồng;",

    "Biên bản xác nhận khối lượng phát sinh (nếu có);",

    "Các tài liệu khác theo thỏa thuận của hai bên.",
  ].forEach((item) => {
    children.push(wordHangingParagraph("–", item));
  });

  // ==========================================================
  // 3.4. CHẬM THANH TOÁN
  // ==========================================================

  children.push(wordClauseTitle("3.4. Chậm thanh toán"));

  if (hasValue(data.content.late_payment)) {
    children.push(...articleToWord(data.content.late_payment));
  }

  // ========================================================
  // ARTICLES 4 - 11
  // ========================================================

  const articles = [
    ["ĐIỀU 4. QUYỀN VÀ TRÁCH NHIỆM CỦA BÊN A", data.content.article_4],

    ["ĐIỀU 5. QUYỀN VÀ TRÁCH NHIỆM CỦA BÊN B", data.content.article_5],

    [
      "ĐIỀU 6. QUẢN LÝ, XÁC NHẬN VÀ THANH TOÁN CHI PHÍ PHÁT SINH",
      data.content.article_6,
    ],

    ["ĐIỀU 7. SỰ KIỆN BẤT KHẢ KHÁNG", data.content.article_7],

    [
      "ĐIỀU 8. PHẠT VI PHẠM HỢP ĐỒNG VÀ BỒI THƯỜNG THIỆT HẠI",
      data.content.article_8,
    ],

    ["ĐIỀU 9. LUẬT ÁP DỤNG VÀ GIẢI QUYẾT TRANH CHẤP", data.content.article_9],

    ["ĐIỀU 10. BẢO MẬT THÔNG TIN VÀ DỮ LIỆU CÁ NHÂN", data.content.article_10],

    ["ĐIỀU 11. ĐIỀU KHOẢN CHUNG", data.content.article_11],
  ];

  articles.forEach(([title, content]) => {
    children.push(wordArticleTitle(title));

    children.push(...articleToWord(content));
  });

  // ========================================================
  // SIGNATURE
  // ========================================================

  const noBorders = {
    top: {
      style: BorderStyle.NONE,
    },

    bottom: {
      style: BorderStyle.NONE,
    },

    left: {
      style: BorderStyle.NONE,
    },

    right: {
      style: BorderStyle.NONE,
    },

    insideHorizontal: {
      style: BorderStyle.NONE,
    },

    insideVertical: {
      style: BorderStyle.NONE,
    },
  };

  children.push(
    new Paragraph({
      spacing: {
        before: 120,

        after: 40,
      },

      children: [],
    }),
  );

  children.push(
    new Table({
      width: {
        size: 100,

        type: WidthType.PERCENTAGE,
      },

      borders: noBorders,

      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: {
                size: 50,

                type: WidthType.PERCENTAGE,
              },

              borders: noBorders,

              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,

                  children: [
                    wordRun("ĐẠI DIỆN BÊN A", {
                      bold: true,

                      size: FONT_13,
                    }),
                  ],
                }),

                ...(hasValue(data.customerRep.rep_title)
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,

                        children: [
                          wordRun(data.customerRep.rep_title, {
                            bold: true,

                            size: FONT_13,
                          }),
                        ],
                      }),
                    ]
                  : []),

                new Paragraph({
                  spacing: {
                    after: 1300,
                  },

                  children: [],
                }),

                new Paragraph({
                  alignment: AlignmentType.CENTER,

                  children: [
                    wordRun(
                      cleanRepresentativeName(data.customerRep.rep_name),
                      {
                        bold: true,

                        size: FONT_13,
                      },
                    ),
                  ],
                }),
              ],
            }),

            new TableCell({
              width: {
                size: 50,

                type: WidthType.PERCENTAGE,
              },

              borders: noBorders,

              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,

                  children: [
                    wordRun("ĐẠI DIỆN BÊN B", {
                      bold: true,

                      size: FONT_13,
                    }),
                  ],
                }),

                ...(hasValue(data.companyRep.rep_title)
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,

                        children: [
                          wordRun(data.companyRep.rep_title, {
                            bold: true,

                            size: FONT_13,
                          }),
                        ],
                      }),
                    ]
                  : []),

                new Paragraph({
                  spacing: {
                    after: 1300,
                  },

                  children: [],
                }),

                new Paragraph({
                  alignment: AlignmentType.CENTER,

                  children: [
                    wordRun(cleanRepresentativeName(data.companyRep.rep_name), {
                      bold: true,

                      size: FONT_13,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  // ========================================================
  // DOCUMENT
  //
  // TOP    = 1.5CM
  // RIGHT  = 1.5CM
  // BOTTOM = 1.5CM
  // LEFT   = 2.5CM
  // ========================================================

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",

            size: FONT_13_5,
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
  normalizeContractData,

  buildContractHtml,

  generateContractPdf,

  generateContractWord,
};
