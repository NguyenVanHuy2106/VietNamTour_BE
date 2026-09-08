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
  TabStopType,
  LeaderType,
  HeightRule,
  TableLayoutType,
} = require("docx");

const { normalizeContractData } = require("./contractExport");

// ============================================================
// CONSTANT
// ============================================================

const CM = 567;

const FONT = "Times New Roman";

const FONT_12 = 24;
const FONT_13 = 26;
const FONT_14 = 28;
const FONT_16 = 32;

const BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "000000",
};

const NO_BORDER = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF",
};

// ============================================================
// BASIC HELPERS
// ============================================================

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN").format(Number(value || 0));

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

const formatVietnameseLongDate = (value) => {
  if (!value) {
    return "Ngày ..... tháng ..... năm ........";
  }

  const raw = String(value).substring(0, 10);

  const [year, month, day] = raw.split("-");

  if (!year || !month || !day) {
    return String(value);
  }

  return `Ngày ${day} tháng ${month} năm ${year}`;
};

const removePersonTitle = (value) =>
  String(value || "")
    .replace(/^\s*\(?\s*(ông|bà)\s*\)?\s*/i, "")
    .trim();

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

  const digit = [
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

  const scale = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

  const readThree = (value, full = false) => {
    const hundred = Math.floor(value / 100);

    const ten = Math.floor((value % 100) / 10);

    const one = value % 10;

    const result = [];

    if (hundred > 0 || full) {
      result.push(`${digit[hundred]} trăm`);
    }

    if (ten > 1) {
      result.push(`${digit[ten]} mươi`);

      if (one === 1) {
        result.push("mốt");
      } else if (one === 5) {
        result.push("lăm");
      } else if (one > 0) {
        result.push(digit[one]);
      }
    } else if (ten === 1) {
      result.push("mười");

      if (one === 5) {
        result.push("lăm");
      } else if (one > 0) {
        result.push(digit[one]);
      }
    } else if (one > 0) {
      if (hundred > 0 || full) {
        result.push("lẻ");
      }

      result.push(digit[one]);
    }

    return result.join(" ");
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

    if (scale[i]) {
      result.push(scale[i]);
    }
  }

  const text = result.join(" ").replace(/\s+/g, " ").trim();

  return text.charAt(0).toUpperCase() + text.slice(1) + " đồng";
};

// ============================================================
// NORMALIZE
// ============================================================

const normalizeForm08aData = ({ contract, form08a }) => {
  const contractData = normalizeContractData(contract);

  const raw =
    typeof form08a?.get === "function"
      ? form08a.get({
          plain: true,
        })
      : form08a || {};

  const items = (raw.items || [])
    .map((item, index) => ({
      ...item,

      quantity: Number(item.quantity || 0),

      unit_price: Number(item.unit_price || 0),

      amount: Number(item.amount || 0),

      sort_order: Number(item.sort_order || index + 1),
    }))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  // ==========================================================
  // TỔNG GIÁ TRỊ NGHIỆM THU CỦA KỲ NÀY
  // ==========================================================

  const completedValue = items.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  // ==========================================================
  // MỤC 7
  //
  // LŨY KẾ THANH TOÁN KHỐI LƯỢNG HOÀN THÀNH
  // ĐẾN CUỐI KỲ TRƯỚC
  //
  // = THANH TOÁN TẠM ỨNG KỲ TRƯỚC
  // + THANH TOÁN TRỰC TIẾP KỲ TRƯỚC
  // ==========================================================

  const previousAdvancePayment = Math.max(
    Number(raw.previous_advance_payment || 0),
    0,
  );

  const previousDirectPayment = Math.max(
    Number(raw.previous_direct_payment || 0),
    0,
  );

  const previousAccumulatedPayment =
    previousAdvancePayment + previousDirectPayment;

  // ==========================================================
  // MỤC 8
  //
  // SỐ DƯ TẠM ỨNG ĐẾN CUỐI KỲ TRƯỚC
  // ==========================================================

  const previousAdvanceBalance = Math.max(
    Number(raw.previous_advance_balance || 0),
    0,
  );

  // ==========================================================
  // MỤC 9
  //
  // SỐ ĐỀ NGHỊ THANH TOÁN KỲ NÀY
  //
  // = GIÁ TRỊ NGHIỆM THU RIÊNG CỦA KỲ NÀY
  //
  // KHÔNG TRỪ MỤC 7
  // ==========================================================

  const currentRequestedPayment = Math.max(Number(completedValue || 0), 0);

  // ==========================================================
  // THANH TOÁN TẠM ỨNG / THU HỒI TẠM ỨNG KỲ NÀY
  //
  // KHÔNG ĐƯỢC VƯỢT:
  //
  // 1. SỐ ĐỀ NGHỊ THANH TOÁN KỲ NÀY
  // 2. SỐ DƯ TẠM ỨNG CUỐI KỲ TRƯỚC
  // ==========================================================

  const currentAdvancePayment = Math.min(
    Math.max(Number(raw.current_advance_payment || 0), 0),

    currentRequestedPayment,

    previousAdvanceBalance,
  );

  // ==========================================================
  // THANH TOÁN TRỰC TIẾP
  //
  // = MỤC 9 - THU HỒI TẠM ỨNG KỲ NÀY
  // ==========================================================

  const currentDirectPayment = Math.max(
    currentRequestedPayment - currentAdvancePayment,
    0,
  );

  return {
    ...raw,

    contract: contractData,

    items,

    acceptance: raw.acceptanceSettlement || null,

    completedValue,

    // ========================================================
    // MỤC 7
    // ========================================================

    previousAdvancePayment,

    previousDirectPayment,

    previousAccumulatedPayment,

    // ========================================================
    // MỤC 8
    // ========================================================

    previousAdvanceBalance,

    // ========================================================
    // MỤC 9
    // ========================================================

    currentRequestedPayment,

    currentAdvancePayment,

    currentDirectPayment,

    // ========================================================
    // THÔNG TIN KHÁC
    // ========================================================

    customerName:
      raw.budget_unit_name || contractData.customer?.company_name || "",

    companyName: contractData.company?.company_name || "",

    contractCode: contractData.contract_code || "",

    contractName: contractData.contract_name || "",

    contractValue: Number(raw.contract_value || contractData.total_amount || 0),
  };
};

// ============================================================
// PDF HTML
// ============================================================

const buildForm08aHtml = (payload) => {
  const data = normalizeForm08aData(payload);

  const companyRep = data.contract.companyRep || {};

  const customerRep = data.contract.customerRep || {};

  const acceptanceDate = data.acceptance?.document_date;

  const itemRows = data.items
    .map(
      (item, index) => `
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
              ${formatMoney(item.quantity)}
            </td>

            <td class="money">
              ${formatMoney(item.unit_price)}
            </td>

            <td class="money">
              ${formatMoney(item.amount)}
            </td>
          </tr>
        `,
    )
    .join("");

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
    12mm
    14mm
    15mm
    20mm;
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

  font-size: 14.5px;

  line-height: 1.35;

  color: #000;
}

.page {
  width: 100%;
}

/* =========================================================
   MẪU SỐ
========================================================= */

.template {
  width: 190px;

  margin-left: auto;
  margin-bottom: 8px;

  text-align: center;

  line-height: 1.3;
}

.template-name {
  font-weight: 700;
}

/* =========================================================
   TITLE
========================================================= */

.title {
  margin-top: 3px;

  font-size: 17px;

  font-weight: 700;

  text-align: center;
}

.title-line {
  margin:
    2px 0
    16px;

  text-align: center;
}

/* =========================================================
   NUMBERED LINE
========================================================= */

.number-line {
  display: grid;

  grid-template-columns:
    25px
    minmax(0, 1fr);

  width: 100%;

  margin:
    6px 0;

  padding: 0;

  line-height: 1.4;

  text-align: justify;
}

.number {
  padding-right: 5px;

  text-align: right;

  white-space: nowrap;
}

.number-content {
  min-width: 0;

  margin: 0;
  padding: 0;

  text-indent: 0;
}

.code-row {
  display: grid;

  grid-template-columns:
    300px
    1fr;

  column-gap: 12px;
}

/* =========================================================
   UNIT
========================================================= */

.unit {
  margin:
    5px 3px
    2px 0;

  text-align: right;
}

/* =========================================================
   TABLE
========================================================= */

table {
  width: 100%;

  border-collapse: collapse;

  table-layout: fixed;

  font-size: 13.5px;
}

th,
td {
  border:
    1px solid #000;

  padding:
    5px 5px;

  vertical-align: middle;

  page-break-inside: avoid;
}

th {
  font-weight: 700;

  text-align: center;
}

.col-stt {
  width: 7%;
}

.col-content {
  width: 41%;
}

.col-unit {
  width: 10%;
}

.col-qty {
  width: 10%;
}

.col-price {
  width: 15%;
}

.col-amount {
  width: 17%;
}

.center {
  text-align: center;
}

.money {
  text-align: right;

  white-space: nowrap;
}

.column-number td {
  padding:
    2px 4px;

  text-align: center;

  font-style: italic;
}

.total-row td {
  font-weight: 700;
}

.total-row td:first-child {
  text-align: center;
}

/* =========================================================
   SUB PAYMENT
========================================================= */

.payment-sub {
  display: grid;

  grid-template-columns:
    1fr
    1fr;

  column-gap: 12px;

  margin:
    3px 0
    7px
    25px;

  line-height: 1.35;
}

/* =========================================================
   SIGNATURE
========================================================= */

.signature {
  display: grid;

  grid-template-columns:
    1fr
    1fr;

  column-gap: 40px;

  width: 100%;

  margin-top: 20px;
}

.signature-side {
  position: relative;

  height: 190px;

  text-align: center;
}

.signature-date {
  margin-bottom: 2px;

  font-style: italic;
}

.signature-heading {
  font-weight: 700;

  line-height: 1.25;
}

.signature-position {
  margin-top: 2px;

  font-weight: 700;
}

.signature-name {
  position: absolute;

  left: 0;
  right: 0;
  bottom: 0;

  font-weight: 700;

  white-space: nowrap;
}

.signature-left {
  padding-top: 22px;
}

</style>

</head>

<body>

<div class="page">

  <!-- =====================================================
       TEMPLATE
  ====================================================== -->

  <div class="template">

    <div class="template-name">
      Mẫu số 08a
    </div>

    <div>
      Mã hiệu: …………..
    </div>

    <div>
      Số:
      ${escapeHtml(data.document_no || "…………")}
    </div>

  </div>

  <!-- =====================================================
       TITLE
  ====================================================== -->

  <div class="title">
    BẢNG XÁC ĐỊNH GIÁ TRỊ KHỐI LƯỢNG CÔNG VIỆC HOÀN THÀNH
  </div>

  <div class="title-line">
    -----------------------------------------------
  </div>

  <!-- =====================================================
       1
  ====================================================== -->

  <div class="number-line">

    <div class="number">
      1.
    </div>

    <div class="number-content">
      Đơn vị sử dụng ngân sách:
      <strong>
        ${escapeHtml(data.customerName)}
      </strong>
    </div>

  </div>

  <!-- =====================================================
       2
  ====================================================== -->

  <div class="number-line">

    <div class="number">
      2.
    </div>

    <div class="number-content code-row">

      <div>
        Mã đơn vị:
        ${escapeHtml(data.budget_unit_code || "")}
      </div>

      <div>
        Mã nguồn:
        ${escapeHtml(data.funding_source_code || "")}
      </div>

    </div>

  </div>

  <!-- =====================================================
       3
  ====================================================== -->

  <div class="number-line">

    <div class="number">
      3.
    </div>

    <div class="number-content">
      Mã CTMTQG, Dự án ODA:
      ${escapeHtml(data.national_program_code || "")}
    </div>

  </div>

  <!-- =====================================================
       4
  ====================================================== -->

  <div class="number-line">

    <div class="number">
      4.
    </div>

    <div class="number-content">

      Căn cứ Hợp đồng dịch vụ số

      <strong>
        ${escapeHtml(data.contractCode)}
      </strong>

      giữa

      ${escapeHtml(data.customerName)}

      và

      ${escapeHtml(data.companyName)},

      giá trị hợp đồng đã ký:

      <strong>
        ${formatMoney(data.contractValue)}
        vnđ
      </strong>

      <em>
        (Bằng chữ:
        ${escapeHtml(numberToVietnamese(data.contractValue))}).
      </em>

    </div>

  </div>

  <!-- =====================================================
       5
  ====================================================== -->

  <div class="number-line">

    <div class="number">
      5.
    </div>

    <div class="number-content">

      Căn cứ Biên bản nghiệm thu

      ${
        acceptanceDate
          ? escapeHtml(formatVietnameseLongDate(acceptanceDate))
          : ""
      }

      giữa

      ${escapeHtml(data.customerName)}

      và

      ${escapeHtml(data.companyName)}:

    </div>

  </div>

  <div class="unit">
    <em>
      Đơn vị: Đồng
    </em>
  </div>

  <!-- =====================================================
       TABLE
  ====================================================== -->

  <table>

    <thead>

      <tr>

        <th class="col-stt">
          STT
        </th>

        <th class="col-content">
          Nội dung công việc
        </th>

        <th class="col-unit">
          Đơn vị<br/>tính
        </th>

        <th class="col-qty">
          Số<br/>lượng
        </th>

        <th class="col-price">
          Đơn giá
        </th>

        <th class="col-amount">
          Thành tiền
        </th>

      </tr>

      <tr class="column-number">

        <td>(1)</td>
        <td>(2)</td>
        <td>(3)</td>
        <td>(4)</td>
        <td>(5)</td>
        <td>(6)</td>

      </tr>

    </thead>

    <tbody>

      ${itemRows}

      <tr class="total-row">

        <td colspan="5">
          Tổng số
        </td>

        <td class="money">
          ${formatMoney(data.completedValue)}
        </td>

      </tr>

    </tbody>

  </table>

  <!-- =====================================================
       7
  ====================================================== -->

  <div class="number-line">

    <div class="number">
      7.
    </div>

    <div class="number-content">

      Lũy kế thanh toán khối lượng hoàn thành đến cuối kỳ trước:

      <strong>
        ${formatMoney(data.previousAccumulatedPayment)}
        đồng
      </strong>.

    </div>

  </div>

  <div class="payment-sub">

    <div>
      - Thanh toán tạm ứng:
      <strong>
        ${formatMoney(data.previousAdvancePayment)}
        đồng.
      </strong>
    </div>

    <div>
      - Thanh toán trực tiếp:
      <strong>
        ${formatMoney(data.previousDirectPayment)}
        đồng.
      </strong>
    </div>

  </div>

  <!-- =====================================================
       8
  ====================================================== -->

  <div class="number-line">

    <div class="number">
      8.
    </div>

    <div class="number-content">

      Số dư tạm ứng đến cuối kỳ trước:

      <strong>
        ${formatMoney(data.previousAdvanceBalance)}
        đồng
      </strong>.

    </div>

  </div>

  <!-- =====================================================
       9
  ====================================================== -->

  <div class="number-line">

    <div class="number">
      9.
    </div>

    <div class="number-content">

      Số đề nghị thanh toán kỳ này:

      <strong>
        ${formatMoney(data.currentRequestedPayment)}
        đồng
      </strong>

      <em>
        (Bằng chữ:
        ${escapeHtml(numberToVietnamese(data.currentRequestedPayment))}).
      </em>

    </div>

  </div>

  <div class="payment-sub">

    <div>
      - Thanh toán tạm ứng:
      <strong>
        ${formatMoney(data.currentAdvancePayment)}
        đồng.
      </strong>
    </div>

    <div>
      - Thanh toán trực tiếp:
      <strong>
        ${formatMoney(data.currentDirectPayment)}
        đồng.
      </strong>
    </div>

  </div>

  <!-- =====================================================
       SIGNATURE
  ====================================================== -->

  <div class="signature">

    <div class="signature-side signature-left">

      <div class="signature-heading">
        ĐẠI DIỆN NHÀ CUNG CẤP
        <br/>
        HÀNG HÓA, DỊCH VỤ
      </div>

      <div class="signature-position">
        ${escapeHtml(companyRep.rep_title || "GIÁM ĐỐC")}
      </div>

      <div class="signature-name">
        ${escapeHtml(removePersonTitle(companyRep.rep_name))}
      </div>

    </div>

    <div class="signature-side">

      <div class="signature-date">
        ${escapeHtml(formatVietnameseLongDate(data.document_date))}
      </div>

      <div class="signature-heading">
        ĐẠI DIỆN ĐƠN VỊ SỬ DỤNG NGÂN SÁCH
      </div>

      <div class="signature-position">
        ${escapeHtml(customerRep.rep_title || "GIÁM ĐỐC")}
      </div>

      <div class="signature-name">
        ${escapeHtml(removePersonTitle(customerRep.rep_name))}
      </div>

    </div>

  </div>

</div>

</body>

</html>
  `;
};

// ============================================================
// GENERATE PDF
// ============================================================

const generateForm08aPdf = async (payload) => {
  let browser;

  try {
    const html = buildForm08aHtml(payload);

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

const wordRun = (text, options = {}) =>
  new TextRun({
    text: text === null || text === undefined ? "" : String(text),

    font: FONT,

    size: options.size || FONT_13,

    bold: Boolean(options.bold),

    italics: Boolean(options.italics),

    break: options.break,
  });

const wordParagraph = (children = [], options = {}) =>
  new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,

    spacing: {
      before: options.before ?? 40,

      after: options.after ?? 40,

      line: options.line ?? 300,
    },

    indent: options.indent,

    keepNext: Boolean(options.keepNext),

    children: Array.isArray(children) ? children : [wordRun(children)],
  });

// ============================================================
// NUMBERED WORD LINE
// ============================================================

const wordNumberedLine = (number, children) =>
  new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },

    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },

    columnWidths: [450, 9000],

    rows: [
      new TableRow({
        cantSplit: true,

        children: [
          new TableCell({
            width: {
              size: 5,
              type: WidthType.PERCENTAGE,
            },

            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER,
            },

            margins: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 70,
            },

            children: [
              wordParagraph([wordRun(`${number}.`)], {
                alignment: AlignmentType.RIGHT,

                before: 0,
                after: 0,
              }),
            ],
          }),

          new TableCell({
            width: {
              size: 95,
              type: WidthType.PERCENTAGE,
            },

            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER,
            },

            margins: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            },

            children: [
              wordParagraph(children, {
                before: 0,
                after: 0,
              }),
            ],
          }),
        ],
      }),
    ],
  });

// ============================================================
// TABLE CELL
// ============================================================

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

    borders: {
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
    },

    margins: {
      top: 60,
      bottom: 60,
      left: 60,
      right: 60,
    },

    children: [
      wordParagraph(
        [
          wordRun(text, {
            size: FONT_12,

            bold: options.bold,
          }),
        ],
        {
          alignment: options.alignment || AlignmentType.CENTER,

          before: 0,
          after: 0,
          line: 260,
        },
      ),
    ],
  });

// ============================================================
// WORD TABLE
// ============================================================

const buildWordItemsTable = (data) => {
  const rows = [];

  rows.push(
    new TableRow({
      cantSplit: true,

      tableHeader: true,

      children: [
        wordCell("STT", {
          width: 7,
          bold: true,
        }),

        wordCell("Nội dung công việc", {
          width: 41,
          bold: true,
        }),

        wordCell("Đơn vị\ntính", {
          width: 10,
          bold: true,
        }),

        wordCell("Số\nlượng", {
          width: 10,
          bold: true,
        }),

        wordCell("Đơn giá", {
          width: 15,
          bold: true,
        }),

        wordCell("Thành tiền", {
          width: 17,
          bold: true,
        }),
      ],
    }),
  );

  rows.push(
    new TableRow({
      cantSplit: true,

      children: [
        wordCell("(1)"),
        wordCell("(2)"),
        wordCell("(3)"),
        wordCell("(4)"),
        wordCell("(5)"),
        wordCell("(6)"),
      ],
    }),
  );

  data.items.forEach((item, index) => {
    rows.push(
      new TableRow({
        cantSplit: true,

        children: [
          wordCell(index + 1),

          wordCell(item.item_name || "", {
            alignment: AlignmentType.LEFT,
          }),

          wordCell(item.unit || ""),

          wordCell(formatMoney(item.quantity)),

          wordCell(formatMoney(item.unit_price), {
            alignment: AlignmentType.RIGHT,
          }),

          wordCell(formatMoney(item.amount), {
            alignment: AlignmentType.RIGHT,
          }),
        ],
      }),
    );
  });

  rows.push(
    new TableRow({
      cantSplit: true,

      children: [
        wordCell("Tổng số", {
          columnSpan: 5,
          bold: true,
        }),

        wordCell(formatMoney(data.completedValue), {
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

const buildWordSignature = (data) => {
  const companyRep = data.contract.companyRep || {};
  const customerRep = data.contract.customerRep || {};

  const noBorderCell = (children, width = 50) =>
    new TableCell({
      width: {
        size: width,
        type: WidthType.PERCENTAGE,
      },

      borders: {
        top: NO_BORDER,
        bottom: NO_BORDER,
        left: NO_BORDER,
        right: NO_BORDER,
      },

      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },

      verticalAlign: VerticalAlign.TOP,

      children,
    });

  const centerParagraph = (
    text,
    {
      bold = false,
      italics = false,
      before = 0,
      after = 0,
      size = FONT_12,
    } = {},
  ) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        before,
        after,
        line: 276,
      },

      children: [
        wordRun(text, {
          bold,
          italics,
          size,
        }),
      ],
    });

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },

    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },

    rows: [
      // ======================================================
      // HÀNG 1
      // NGÀY + TIÊU ĐỀ + CHỨC VỤ
      //
      // Hai bên tự chạy độc lập.
      // Vì vậy Giám đốc bên phải nằm sát tiêu đề bên phải.
      // ======================================================
      new TableRow({
        cantSplit: true,

        children: [
          noBorderCell([
            // chừa một dòng tương ứng ngày bên phải
            centerParagraph(""),

            centerParagraph("ĐẠI DIỆN NHÀ CUNG CẤP", {
              bold: true,
            }),

            centerParagraph("HÀNG HÓA, DỊCH VỤ", {
              bold: true,
            }),

            centerParagraph(companyRep.rep_title || "GIÁM ĐỐC", {
              bold: true,
              after: 0,
            }),
          ]),

          noBorderCell([
            centerParagraph(formatVietnameseLongDate(data.document_date), {
              italics: true,
            }),

            centerParagraph("ĐẠI DIỆN ĐƠN VỊ SỬ DỤNG NGÂN SÁCH", {
              bold: true,
            }),

            centerParagraph(customerRep.rep_title || "GIÁM ĐỐC", {
              bold: true,
              after: 0,
            }),
          ]),
        ],
      }),

      // ======================================================
      // HÀNG 2
      // KHOẢNG TRỐNG ĐỂ KÝ
      // Cả hai bên dùng chung một chiều cao.
      // ======================================================
      new TableRow({
        cantSplit: true,

        height: {
          value: 1250,
          rule: HeightRule.EXACT,
        },

        children: [
          noBorderCell([
            new Paragraph({
              children: [],
            }),
          ]),

          noBorderCell([
            new Paragraph({
              children: [],
            }),
          ]),
        ],
      }),

      // ======================================================
      // HÀNG 3
      // TÊN NGƯỜI KÝ
      // CÙNG MỘT HÀNG => NGANG TUYỆT ĐỐI
      // ======================================================
      new TableRow({
        cantSplit: true,

        children: [
          noBorderCell([
            centerParagraph(removePersonTitle(companyRep.rep_name), {
              bold: true,
            }),
          ]),

          noBorderCell([
            centerParagraph(removePersonTitle(customerRep.rep_name), {
              bold: true,
            }),
          ]),
        ],
      }),
    ],
  });
};

// ============================================================
// GENERATE WORD
// ============================================================
const wordPaymentLine = ({ advance = 0, direct = 0, after = 80 }) => {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },

    layout: TableLayoutType.FIXED,

    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },

    rows: [
      new TableRow({
        cantSplit: true,

        children: [
          // ==================================================
          // BÊN TRÁI
          // ==================================================
          new TableCell({
            width: {
              size: 42,
              type: WidthType.PERCENTAGE,
            },

            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER,
            },

            margins: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 40,
            },

            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,

                spacing: {
                  before: 0,
                  after,
                  line: 276,
                },

                children: [
                  wordRun(
                    `- Thanh toán tạm ứng: ${formatMoney(
                      advance,
                    )}....................`,
                    {
                      size: FONT_12,
                    },
                  ),
                ],
              }),
            ],
          }),

          // ==================================================
          // BÊN PHẢI
          // ==================================================
          new TableCell({
            width: {
              size: 58,
              type: WidthType.PERCENTAGE,
            },

            borders: {
              top: NO_BORDER,
              bottom: NO_BORDER,
              left: NO_BORDER,
              right: NO_BORDER,
            },

            margins: {
              top: 0,
              bottom: 0,
              left: 40,
              right: 0,
            },

            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,

                spacing: {
                  before: 0,
                  after,
                  line: 276,
                },

                children: [
                  wordRun("- Thanh toán trực tiếp: ", {
                    size: FONT_12,
                  }),

                  wordRun(`${formatMoney(direct)} đồng.`, {
                    size: FONT_12,
                    bold: Number(direct) !== 0,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

const wordAdvanceBalanceLine = (amount) => {
  return new Paragraph({
    alignment: AlignmentType.LEFT,

    spacing: {
      before: 0,
      after: 80,
      line: 276,
    },

    children: [
      wordRun(
        `8. Số dư tạm ứng đến cuối kỳ trước: ${formatMoney(
          amount,
        )}................................................................................`,
        {
          size: FONT_12,
        },
      ),
    ],
  });
};

// ============================================================
// DÒNG ĐÁNH SỐ 1 -> 9
// TẤT CẢ CÙNG 1 TRỤC
// ============================================================

const form08aNumberedLine = (
  number,
  children,
  { after = 50, alignment = AlignmentType.JUSTIFIED, keepNext = false } = {},
) => {
  return new Paragraph({
    alignment,

    spacing: {
      before: 0,
      after,
      line: 276,
    },

    keepNext,

    // số và nội dung cùng nằm trên một paragraph
    // không table, không left indent
    indent: {
      left: 0,
      right: 0,
      firstLine: 0,
    },

    children: [
      wordRun(`${number}. `, {
        size: FONT_12,
      }),

      ...children,
    ],
  });
};

const generateForm08aWord = async (payload) => {
  const data = normalizeForm08aData(payload);

  const children = [];

  // ==========================================================
  // MẪU SỐ 08A - GÓC PHẢI
  // ==========================================================

  children.push(
    new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },

      layout: TableLayoutType.FIXED,

      borders: {
        top: NO_BORDER,
        bottom: NO_BORDER,
        left: NO_BORDER,
        right: NO_BORDER,
        insideHorizontal: NO_BORDER,
        insideVertical: NO_BORDER,
      },

      rows: [
        new TableRow({
          cantSplit: true,

          children: [
            new TableCell({
              width: {
                size: 64,
                type: WidthType.PERCENTAGE,
              },

              borders: {
                top: NO_BORDER,
                bottom: NO_BORDER,
                left: NO_BORDER,
                right: NO_BORDER,
              },

              margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              },

              children: [
                new Paragraph({
                  children: [],
                }),
              ],
            }),

            new TableCell({
              width: {
                size: 36,
                type: WidthType.PERCENTAGE,
              },

              borders: {
                top: NO_BORDER,
                bottom: NO_BORDER,
                left: NO_BORDER,
                right: NO_BORDER,
              },

              margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              },

              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,

                  spacing: {
                    before: 0,
                    after: 0,
                    line: 276,
                  },

                  children: [
                    wordRun("Mẫu số 08a", {
                      size: FONT_12,
                      bold: true,
                    }),
                  ],
                }),

                new Paragraph({
                  alignment: AlignmentType.CENTER,

                  spacing: {
                    before: 0,
                    after: 0,
                    line: 276,
                  },

                  children: [
                    wordRun("Mã hiệu: …………..", {
                      size: FONT_12,
                    }),
                  ],
                }),

                new Paragraph({
                  alignment: AlignmentType.CENTER,

                  spacing: {
                    before: 0,
                    after: 60,
                    line: 276,
                  },

                  children: [
                    wordRun(`Số: ${data.document_no || "…………"}`, {
                      size: FONT_12,
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

  // ==========================================================
  // TIÊU ĐỀ
  // ==========================================================

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        before: 0,
        after: 0,
        line: 276,
      },

      keepNext: true,

      children: [
        wordRun("BẢNG XÁC ĐỊNH GIÁ TRỊ KHỐI LƯỢNG CÔNG VIỆC HOÀN THÀNH", {
          size: FONT_14,
          bold: true,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        before: 0,
        after: 120,
        line: 276,
      },

      keepNext: true,

      children: [
        wordRun("-----------------------------------------------", {
          size: FONT_12,
        }),
      ],
    }),
  );

  // ==========================================================
  // MỤC 1
  // ==========================================================

  children.push(
    form08aNumberedLine(
      1,
      [
        wordRun("Đơn vị sử dụng ngân sách: ", {
          size: FONT_12,
        }),

        wordRun(data.customerName || "", {
          size: FONT_12,
          bold: true,
        }),
      ],
      {
        after: 50,
        alignment: AlignmentType.LEFT,
      },
    ),
  );

  // ==========================================================
  // MỤC 2
  // ==========================================================

  children.push(
    form08aNumberedLine(
      2,
      [
        wordRun(`Mã đơn vị: ${data.budget_unit_code || ""}`, {
          size: FONT_12,
        }),

        wordRun(
          `                                                   Mã nguồn: ${data.funding_source_code || ""}`,
          {
            size: FONT_12,
          },
        ),
      ],
      {
        after: 50,
        alignment: AlignmentType.LEFT,
      },
    ),
  );

  // ==========================================================
  // MỤC 3
  // ==========================================================

  children.push(
    form08aNumberedLine(
      3,
      [
        wordRun(`Mã CTMTQG, Dự án ODA: ${data.national_program_code || ""}`, {
          size: FONT_12,
        }),
      ],
      {
        after: 50,
        alignment: AlignmentType.LEFT,
      },
    ),
  );

  // ==========================================================
  // MỤC 4
  // ==========================================================

  children.push(
    form08aNumberedLine(
      4,
      [
        wordRun("Căn cứ Hợp đồng dịch vụ số ", {
          size: FONT_12,
        }),

        wordRun(data.contractCode || "", {
          size: FONT_12,
          bold: true,
        }),

        wordRun(
          ` giữa ${data.customerName || ""} và ${
            data.companyName || ""
          }, giá trị hợp đồng đã ký: `,
          {
            size: FONT_12,
          },
        ),

        wordRun(`${formatMoney(data.contractValue)} vnđ`, {
          size: FONT_12,
          bold: true,
        }),

        wordRun(` (Bằng chữ: ${numberToVietnamese(data.contractValue)}).`, {
          size: FONT_12,
          italics: true,
        }),
      ],
      {
        after: 50,
        alignment: AlignmentType.JUSTIFIED,
      },
    ),
  );

  // ==========================================================
  // MỤC 5
  // ==========================================================

  children.push(
    form08aNumberedLine(
      5,
      [
        wordRun(
          `Căn cứ Biên bản nghiệm thu ${
            data.acceptance?.document_date
              ? formatVietnameseLongDate(data.acceptance.document_date)
              : ""
          } giữa ${data.customerName || ""} và ${data.companyName || ""}:`,
          {
            size: FONT_12,
          },
        ),
      ],
      {
        after: 40,
        alignment: AlignmentType.JUSTIFIED,
      },
    ),
  );

  // ==========================================================
  // ĐƠN VỊ: ĐỒNG
  // ==========================================================

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,

      spacing: {
        before: 0,
        after: 30,
        line: 276,
      },

      children: [
        wordRun("Đơn vị: Đồng", {
          size: FONT_12,
          italics: true,
        }),
      ],
    }),
  );

  // ==========================================================
  // BẢNG KHỐI LƯỢNG
  // ==========================================================

  children.push(buildWordItemsTable(data));

  // ==========================================================
  // KHOẢNG CÁCH SAU BẢNG
  // ==========================================================

  children.push(
    new Paragraph({
      spacing: {
        before: 0,
        after: 0,
        line: 120,
      },

      children: [],
    }),
  );

  // ==========================================================
  // MỤC 7
  // ==========================================================

  children.push(
    form08aNumberedLine(
      7,
      [
        wordRun("Lũy kế thanh toán khối lượng hoàn thành đến cuối kỳ trước: ", {
          size: FONT_12,
        }),

        wordRun(formatMoney(data.previousAccumulatedPayment), {
          size: FONT_12,
          bold: true,
        }),

        wordRun(" đồng.", {
          size: FONT_12,
        }),
      ],
      {
        after: 50,
        alignment: AlignmentType.LEFT,
      },
    ),
  );

  // ==========================================================
  // CHI TIẾT MỤC 7
  // ==========================================================

  children.push(
    wordPaymentLine({
      advance: data.previousAdvancePayment,
      direct: data.previousDirectPayment,
      after: 80,
    }),
  );

  // ==========================================================
  // MỤC 8
  // ==========================================================

  children.push(
    form08aNumberedLine(
      8,
      [
        wordRun("Số dư tạm ứng đến cuối kỳ trước: ", {
          size: FONT_12,
        }),

        wordRun(formatMoney(data.previousAdvanceBalance), {
          size: FONT_12,
          bold: true,
        }),

        wordRun(
          "................................................................",
          {
            size: FONT_12,
          },
        ),
      ],
      {
        after: 50,
        alignment: AlignmentType.LEFT,
      },
    ),
  );

  // ==========================================================
  // MỤC 9
  // ==========================================================

  children.push(
    form08aNumberedLine(
      9,
      [
        wordRun("Số đề nghị thanh toán kỳ này: ", {
          size: FONT_12,
        }),

        wordRun(formatMoney(data.currentRequestedPayment), {
          size: FONT_12,
          bold: true,
        }),

        wordRun(" đồng ", {
          size: FONT_12,
        }),

        wordRun(
          `(Bằng chữ: ${numberToVietnamese(data.currentRequestedPayment)}).`,
          {
            size: FONT_12,
            italics: true,
          },
        ),
      ],
      {
        after: 50,
        alignment: AlignmentType.JUSTIFIED,
      },
    ),
  );

  // ==========================================================
  // CHI TIẾT MỤC 9
  // CHỈ 1 LẦN
  // ==========================================================

  children.push(
    wordPaymentLine({
      advance: data.currentAdvancePayment,
      direct: data.currentDirectPayment,
      after: 80,
    }),
  );

  // ==========================================================
  // KHOẢNG TRƯỚC CHỮ KÝ
  // ==========================================================

  children.push(
    new Paragraph({
      spacing: {
        before: 0,
        after: 20,
        line: 120,
      },

      children: [],
    }),
  );

  // ==========================================================
  // CHỮ KÝ
  // ==========================================================

  children.push(buildWordSignature(data));

  // ==========================================================
  // TẠO DOCUMENT
  // ==========================================================

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: FONT_12,
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
              top: Math.round(1.2 * CM),
              right: Math.round(1.4 * CM),
              bottom: Math.round(1.5 * CM),
              left: Math.round(2 * CM),
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
  normalizeForm08aData,

  buildForm08aHtml,

  generateForm08aPdf,

  generateForm08aWord,
};
