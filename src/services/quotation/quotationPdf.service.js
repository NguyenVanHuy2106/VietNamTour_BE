const pdfjs = require("pdfjs-dist/build/pdf.js");

// ==========================================================
// HELPERS
// ==========================================================

const clean = (value) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

const normalizeSpace = (value) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toISODate = (value) => {
  const match = String(value || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return null;

  const [, d, m, y] = match;
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCDate() !== Number(d) ||
    date.getUTCMonth() + 1 !== Number(m) ||
    date.getUTCFullYear() !== Number(y)
  ) {
    return null;
  }

  return `${y}-${m}-${d}`;
};

function parseVietnameseNumber(value) {
  const raw = clean(value).replace(/\s/g, "");

  if (!raw) return null;

  let normalized = raw;

  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) {
    // 1.000 -> 1000
    // 1.500,5 -> 1500.5
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw)) {
    // 1,000 -> 1000
    normalized = raw.replace(/,/g, "");
  } else if (/^\d+,\d+$/.test(raw)) {
    // 1,5 -> 1.5
    normalized = raw.replace(",", ".");
  } else if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function appendText(oldValue, nextValue) {
  if (!clean(nextValue)) return oldValue || "";

  return normalizeSpace(`${oldValue || ""} ${nextValue}`);
}

function matchOne(text, regex) {
  const match = String(text || "").match(regex);
  return match?.[1] ? clean(match[1]) : null;
}

// ==========================================================
// BUILD PDF LINES
//
// Giữ lại tọa độ X/Y để đọc bảng nhiều cột.
// ==========================================================

function buildLines(textItems, height) {
  const parts = textItems
    .filter((item) => clean(item.str))
    .map((item) => ({
      text: clean(item.str),
      x: Number(item.transform?.[4] || 0),
      top: height - Number(item.transform?.[5] || 0),
    }))
    .sort((a, b) => a.top - b.top || a.x - b.x);

  const lines = [];

  for (const part of parts) {
    let line = lines.find((row) => Math.abs(row.top - part.top) <= 3);

    if (!line) {
      line = {
        top: part.top,
        parts: [],
      };

      lines.push(line);
    }

    line.parts.push(part);
  }

  return lines
    .sort((a, b) => a.top - b.top)
    .map((line) => {
      line.parts.sort((a, b) => a.x - b.x);

      return {
        ...line,
        text: clean(line.parts.map((part) => part.text).join(" ")),
      };
    });
}

// ==========================================================
// TABLE COLUMN DETECTION
//
// Ưu tiên lấy tọa độ tiêu đề cột thực tế.
// Nếu không tìm đủ thì sử dụng tỷ lệ dự phòng.
// ==========================================================

const TABLE_COLUMNS = [
  "number",
  "name",
  "description",
  "location",
  "quantity",
  "unit",
];

function isTableHeader(text) {
  const normalized = normalizeSpace(text);

  return (
    /\bSTT\b/i.test(normalized) &&
    /Danh mục hàng hóa|Danh mục hàng hoá/i.test(normalized)
  );
}

function findColumnPart(parts, patterns) {
  for (const pattern of patterns) {
    const found = parts.find((part) => pattern.test(part.text));

    if (found) return found;
  }

  return null;
}

function detectTableColumns(line, width) {
  const parts = line.parts || [];

  const definitions = [
    [/^STT$/i],
    [/Danh mục/i],
    [/Mô tả/i],
    [/Địa điểm/i],
    [/Khối lượng/i],
    [/Đơn vị/i],
  ];

  const starts = definitions.map((patterns) => {
    const part = findColumnPart(parts, patterns);
    return part ? part.x : null;
  });

  const allFound = starts.every((value) => Number.isFinite(value));

  if (!allFound) {
    return {
      boundaries: [
        width * 0.095,
        width * 0.315,
        width * 0.52,
        width * 0.715,
        width * 0.85,
      ],
      detected: false,
    };
  }

  // PDF e-GP có nhiều đoạn chữ thụt đầu dòng
  // trong cùng một ô. Vì vậy lấy vị trí đầu
  // cột tiếp theo trừ một khoảng đệm nhỏ.
  const boundaries = starts.slice(1).map((start, index) => {
    const previous = starts[index];

    return Math.max(previous + 6, start - 12);
  });

  return {
    boundaries,
    detected: true,
  };
}

function getTableCell(x, width, columnConfig) {
  const boundaries = columnConfig?.boundaries || [
    width * 0.095,
    width * 0.315,
    width * 0.52,
    width * 0.715,
    width * 0.85,
  ];

  for (let index = 0; index < boundaries.length; index++) {
    if (x < boundaries[index]) {
      return TABLE_COLUMNS[index];
    }
  }

  return "unit";
}

function lineToCells(line, width, columnConfig) {
  const cells = {
    number: "",
    name: "",
    description: "",
    location: "",
    quantity: "",
    unit: "",
  };

  for (const part of line.parts) {
    const column = getTableCell(part.x, width, columnConfig);

    cells[column] = appendText(cells[column], part.text);
  }

  return cells;
}

// ==========================================================
// EXTRACT TABLE ITEMS
//
// Hỗ trợ:
// - Bảng ở trang 1
// - Hạng mục kéo dài sang trang 2
// - Tiêu đề bảng lặp lại
// - Nhiều sản phẩm
// - Dừng trước mục nội dung đính kèm
// ==========================================================

function extractItems(pages) {
  const items = [];

  let current = null;
  let tableStarted = false;
  let tableFinished = false;
  let columnConfig = null;

  for (const page of pages) {
    if (tableFinished) break;

    const { lines, width, height, pageNumber } = page;

    let headerTop = null;

    // ------------------------------------------------------
    // 1. TÌM HEADER BẢNG
    // ------------------------------------------------------

    for (const line of lines) {
      if (isTableHeader(line.text)) {
        headerTop = line.top;
        tableStarted = true;

        columnConfig = detectTableColumns(line, width);

        break;
      }
    }

    if (!tableStarted) continue;

    // ------------------------------------------------------
    // 2. DUYỆT CÁC DÒNG
    // ------------------------------------------------------

    for (const line of lines) {
      const lineText = normalizeSpace(line.text);

      if (!lineText) continue;

      // Bỏ footer
      if (line.top > height * 0.94) {
        continue;
      }

      // Bỏ header bảng và các dòng trước header
      // tại trang có header.
      if (headerTop !== null && line.top <= headerTop + 8) {
        continue;
      }

      // Bỏ tiêu đề bảng lặp lại
      if (isTableHeader(lineText)) {
        continue;
      }

      // Bỏ phần header bị xuống dòng:
      // "hiện" nằm dưới "Địa điểm giao hàng/thực".
      if (
        headerTop !== null &&
        line.top <= headerTop + 28 &&
        /^(hiện|thực hiện)$/i.test(lineText)
      ) {
        continue;
      }

      // ----------------------------------------------------
      // 3. ĐIỂM KẾT THÚC BẢNG
      // ----------------------------------------------------

      if (
        /^(?:\d+\.\s*)?Nội dung đính kèm khác\s*:/i.test(lineText) ||
        /^III\.\s*/i.test(lineText) ||
        /^Thông tin quyết định phê duyệt/i.test(lineText) ||
        /^Ngày phê duyệt\s*:/i.test(lineText)
      ) {
        tableFinished = true;
        break;
      }

      // Loại bỏ footer dạng chữ nếu nằm
      // gần cuối trang.
      if (/Tài liệu được in từ Hệ thống/i.test(lineText)) {
        continue;
      }

      // ----------------------------------------------------
      // 4. ĐỌC CÁC Ô THEO TỌA ĐỘ
      // ----------------------------------------------------

      const cells = lineToCells(line, width, columnConfig);

      const itemNoText = clean(cells.number);

      const isNewItem = /^\d{1,4}$/.test(itemNoText);

      if (isNewItem) {
        const itemNo = Number(itemNoText);
        const expectedNo = items.length + 1;

        if (itemNo === expectedNo) {
          current = {
            item_no: itemNo,
            item_name: "",
            description: "",
            location: "",
            quantity_text: "",
            unit: "",
            source_page_from: pageNumber,
            source_page_to: pageNumber,
          };

          items.push(current);
        }
      }

      if (!current) continue;

      // ----------------------------------------------------
      // 5. GHÉP NỘI DUNG CÙNG HẠNG MỤC
      //
      // Quan trọng: không reset current khi sang trang.
      // ----------------------------------------------------

      const hasContent =
        clean(cells.name) ||
        clean(cells.description) ||
        clean(cells.location) ||
        clean(cells.quantity) ||
        clean(cells.unit);

      if (!hasContent) continue;

      current.item_name = appendText(current.item_name, cells.name);

      current.description = appendText(current.description, cells.description);

      current.location = appendText(current.location, cells.location);

      current.quantity_text = appendText(current.quantity_text, cells.quantity);

      current.unit = appendText(current.unit, cells.unit);

      current.source_page_to = pageNumber;
    }
  }

  // --------------------------------------------------------
  // 6. NORMALIZE ITEMS
  // --------------------------------------------------------

  return items
    .map((item) => {
      const qtyText = clean(item.quantity_text);

      return {
        item_no: item.item_no,

        item_name: normalizeSpace(item.item_name),

        description: normalizeSpace(item.description) || null,

        location: normalizeSpace(item.location) || null,

        quantity: parseVietnameseNumber(qtyText),

        unit: normalizeSpace(item.unit) || null,

        source_page_from: item.source_page_from,

        source_page_to: item.source_page_to,

        raw_item_data: {
          quantity_text: qtyText || null,
        },
      };
    })
    .filter((item) => item.item_name);
}

// ==========================================================
// EXTRACT REQUEST NAME
//
// Nhận diện nhiều mẫu:
//
// "Tên yêu cầu báo giá: ..."
// "Tên gói thầu: ..."
// "... cho gói thầu ABC với nội dung cụ thể như sau:"
//
// Khắc phục xuống dòng:
// "với nội dung cụ"
// "thể như sau"
// ==========================================================

function extractRequestName(text) {
  if (!text) return null;

  const original = String(text);

  // Lấy phần mở đầu trước mục I để tránh
  // trùng với bảng danh mục.
  const introMatch = original.match(/(?:^|\n)\s*I\.\s*Thông tin/i);

  const intro = introMatch
    ? original.slice(0, introMatch.index)
    : original.slice(0, 5000);

  // Quan trọng: chuẩn hóa xuống dòng
  // thành dấu cách trước khi chạy regex.
  const normalizedIntro = normalizeSpace(intro);

  const patterns = [
    /Tên yêu cầu báo giá\s*:\s*(.+?)(?=\s+(?:Tên gói thầu|Chủ đầu tư|Đơn vị yêu cầu|I\.)|$)/i,

    /Tên gói thầu\s*:\s*(.+?)(?=\s+(?:Chủ đầu tư|Đơn vị yêu cầu|I\.)|$)/i,

    /(?:cho\s+gói\s+thầu)\s+(.+?)\s+với\s+nội\s+dung\s+cụ\s*thể\s+như\s+sau\s*:/i,

    /(?:cho\s+gói\s+thầu)\s+(.+?)\s+với\s+nội\s+dung\s+như\s+sau\s*:/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedIntro.match(pattern);

    if (!match?.[1]) continue;

    const value = normalizeSpace(match[1])
      .replace(/[.,;:]\s*$/, "")
      .trim();

    if (value.length >= 10 && value.length <= 1000) {
      return value;
    }
  }

  return null;
}

// ==========================================================
// EXTRACT HEADER INFORMATION
// ==========================================================

function extractHeader(text, filename) {
  const packageName = extractRequestName(text);

  const procuringEntity = matchOne(
    text,
    /(?:\d+\.\s*)?Đơn vị yêu cầu báo giá\s*:\s*([^\n]+)/i,
  );

  const contactName = matchOne(text, /[-–]?\s*Họ tên\s*:\s*([^\n]+)/i);

  const contactPosition = matchOne(text, /[-–]?\s*Chức vụ\s*:\s*([^\n]+)/i);

  const contactPhone = matchOne(text, /[-–]?\s*Số điện thoại\s*:\s*([^\n]+)/i);

  const contactAddress = matchOne(text, /[-–]?\s*Địa chỉ\s*:\s*([^\n]+)/i);

  const contactEmail = matchOne(text, /[-–]?\s*Email\s*:\s*([^\n]+)/i);

  // Chuẩn hóa toàn bộ văn bản để nhận diện
  // các khoảng ngày bị ngắt dòng.
  const normalizedText = normalizeSpace(text);

  const receptionRange = normalizedText.match(
    /Từ\s+ngày\s+(\d{2}\/\d{2}\/\d{4})\s+đến\s+ngày\s+(\d{2}\/\d{2}\/\d{4})/i,
  );

  const validity = matchOne(
    normalizedText,
    /(?:Tối thiểu\s+)(\d+\s+ngày(?:\s+kể\s+từ\s+ngày\s+\d{2}\/\d{2}\/\d{4})?)/i,
  );

  const receptionMethodText = matchOne(
    text,
    /Hình thức tiếp nhận báo giá\s*:\s*([^\n]+)/i,
  );

  const notificationMatch = String(filename || "").match(/RQ\d{8,}/i);

  const notificationCode = notificationMatch
    ? notificationMatch[0].toUpperCase()
    : null;

  return {
    notification_code: notificationCode,

    notification_code_source: notificationCode ? "FILENAME" : null,

    notification_id: null,

    notification_type: "es-ycbg",

    request_name: packageName,

    package_name: packageName,

    procuring_entity: procuringEntity,

    contact_name: contactName,

    contact_position: contactPosition,

    contact_phone: contactPhone,

    contact_address: contactAddress,

    contact_email: contactEmail,

    publish_date: null,

    reception_start_date: receptionRange ? toISODate(receptionRange[1]) : null,

    reception_end_date: receptionRange ? toISODate(receptionRange[2]) : null,

    // Không tự giả định giờ đóng báo giá.
    closing_date: null,

    quotation_validity: validity,

    reception_method: /online/i.test(receptionMethodText || "")
      ? "ONLINE"
      : /offline/i.test(receptionMethodText || "")
        ? "OFFLINE"
        : null,

    source_type: "PROCUREMENT",

    extraction_method: "PDF_TEXT",
  };
}

// ==========================================================
// MAIN FUNCTION
//
// Hàm này giữ nguyên signature và export cũ.
// ==========================================================

async function extractProcurementPdf(buffer, filename) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });

  let document = null;

  try {
    document = await loadingTask.promise;

    const pages = [];

    // ------------------------------------------------------
    // 1. READ ALL PDF PAGES
    // ------------------------------------------------------

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);

      const viewport = page.getViewport({
        scale: 1,
      });

      const textContent = await page.getTextContent();

      const lines = buildLines(textContent.items, viewport.height);

      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        lines,
      });

      page.cleanup();
    }

    // ------------------------------------------------------
    // 2. BUILD TEXT
    // ------------------------------------------------------

    const firstPage = pages[0];

    const firstPageText = firstPage
      ? firstPage.lines.map((line) => line.text).join("\n")
      : "";

    const allText = pages
      .map((page) => page.lines.map((line) => line.text).join("\n"))
      .join("\n");

    // ------------------------------------------------------
    // 3. VALIDATE PDF TEXT
    // ------------------------------------------------------

    if (allText.replace(/\s+/g, "").length < 50) {
      const error = new Error(
        "PDF không có lớp văn bản đủ để trích xuất. Cần OCR hoặc nhập thủ công.",
      );

      error.statusCode = 422;
      error.code = "PDF_TEXT_NOT_FOUND";

      throw error;
    }

    // ------------------------------------------------------
    // 4. EXTRACT HEADER
    // ------------------------------------------------------

    const header = extractHeader(firstPageText, filename);

    // Nếu trang đầu chưa lấy được tên gói thầu,
    // thử tìm trong toàn bộ nội dung PDF.
    if (!header.request_name) {
      const fallbackName = extractRequestName(allText);

      if (fallbackName) {
        header.request_name = fallbackName;
        header.package_name = fallbackName;
      }
    }

    // ------------------------------------------------------
    // 5. EXTRACT ITEMS
    // ------------------------------------------------------

    const items = extractItems(pages);

    // ------------------------------------------------------
    // 6. WARNINGS + FALLBACK REQUEST NAME
    // ------------------------------------------------------

    const warnings = [];

    // Xác định nguồn tên yêu cầu báo giá.
    let requestNameSource = header.request_name ? "PDF_HEADER" : null;

    // Trường hợp PDF không có tên gói thầu.
    if (!header.request_name) {
      const entityName = clean(header.procuring_entity);

      const notificationCode = clean(header.notification_code);

      // Ưu tiên tên đơn vị.
      // Nếu không có thì lấy mã RQ để đặt tên.
      header.request_name = entityName
        ? `Yêu cầu báo giá - ${entityName}`
        : notificationCode
          ? `Yêu cầu báo giá - ${notificationCode}`
          : "Yêu cầu báo giá - Chưa xác định";

      // Không tự tạo tên gói thầu chính thức.
      // Vì PDF gốc không cung cấp thông tin này.
      header.package_name = null;

      requestNameSource = "GENERATED";

      warnings.push(
        entityName
          ? "PDF không có tên gói thầu. Hệ thống đã tự tạo tên yêu cầu báo giá theo tên đơn vị."
          : "PDF không có tên gói thầu hoặc tên đơn vị. Hệ thống đã tự tạo tên yêu cầu báo giá, cần kiểm tra lại.",
      );
    }

    // Nếu tên được trích xuất từ PDF nhưng
    // package_name bị thiếu thì đồng bộ lại.
    if (requestNameSource === "PDF_HEADER" && !header.package_name) {
      header.package_name = header.request_name;
    }

    // Cảnh báo nếu không tìm thấy đơn vị.
    if (!header.procuring_entity) {
      warnings.push("Chưa nhận diện được đơn vị yêu cầu báo giá.");
    }

    // Mã RQ.
    if (!header.notification_code) {
      warnings.push(
        "Không tìm thấy mã RQ trong tên file. Cần nhập hoặc xác nhận mã.",
      );
    } else {
      warnings.push("Mã RQ được lấy từ tên file PDF, cần nhân viên xác nhận.");
    }

    // Danh mục hàng hóa / dịch vụ.
    if (items.length === 0) {
      warnings.push("Chưa nhận diện được bảng danh mục dịch vụ.");
    }

    for (const item of items) {
      if (item.quantity === null) {
        warnings.push(`Hạng mục ${item.item_no}: cần kiểm tra khối lượng.`);
      }

      if (!item.description) {
        warnings.push(`Hạng mục ${item.item_no}: chưa nhận diện được mô tả.`);
      }
    }

    // ------------------------------------------------------
    // 7. EXECUTION DATE
    // ------------------------------------------------------

    const executionDates = [
      ...new Set(
        items
          .flatMap((item) => {
            const text = [item.item_name, item.description].join(" ");

            return text.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || [];
          })
          .map(toISODate)
          .filter(Boolean),
      ),
    ];

    // Chỉ tự điền ngày thực hiện nếu
    // tất cả ngày tìm thấy đều thống nhất.
    const executionDate =
      executionDates.length === 1 ? executionDates[0] : null;

    if (executionDates.length > 1) {
      warnings.push(
        "Có nhiều ngày trong danh mục dịch vụ, cần xác nhận ngày thực hiện.",
      );
    }

    // ------------------------------------------------------
    // 8. LOCATION SUMMARY
    // ------------------------------------------------------

    const locations = [
      ...new Set(items.map((item) => item.location).filter(Boolean)),
    ];

    // ------------------------------------------------------
    // 9. RESPONSE - GIỮ CẤU TRÚC CŨ
    // ------------------------------------------------------

    return {
      ...header,

      execution_date: executionDate,

      location: locations.join("; ") || null,

      quantity: items.length === 1 ? items[0].quantity : null,

      unit: items.length === 1 ? items[0].unit : null,

      package_price: null,

      items,

      page_count: document.numPages,

      warnings,

      raw_extraction_data: {
        extraction_method: "PDF_TEXT",

        filename,

        page_count: document.numPages,

        // Nguồn xác định tên yêu cầu báo giá:
        // PDF_HEADER: trích xuất từ PDF
        // GENERATED: hệ thống tự tạo
        request_name_source: requestNameSource,

        // true nếu PDF không có tên gói thầu.
        package_name_missing: !header.package_name,

        text_preview: allText.slice(0, 12000),
      },
    };
  } finally {
    if (document) {
      await document.destroy();
    } else {
      await loadingTask.destroy();
    }
  }
}

module.exports = {
  extractProcurementPdf,
};
