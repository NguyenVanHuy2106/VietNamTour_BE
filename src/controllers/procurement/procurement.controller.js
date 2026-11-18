const axios = require("axios");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

const ALLOWED_HOSTS = new Set([
  "muasamcong.mof.gov.vn",
  "muasamcong.mpi.gov.vn",
]);

const clean = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : null;

const valid = (value) =>
  value && value !== "undefined" && value !== "null" ? value : null;

/* ==========================================
   1. PARSE LINK MUASAMCONG
========================================== */

function parseProcurementUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    throw new Error("URL không hợp lệ");
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Định dạng URL không hợp lệ");
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error("Tên miền muasamcong không hợp lệ");
  }

  const params = url.searchParams;

  const result = {
    id: valid(params.get("id")),
    notifyNo: valid(params.get("notifyNo")),
    type: valid(params.get("type")),
    stepCode: valid(params.get("stepCode")),
    sourceUrl: url.href,
  };

  if (!result.id && !result.notifyNo) {
    throw new Error("Không tìm thấy mã thông báo hoặc ID");
  }

  return result;
}

/* ==========================================
   2. ĐỌC NỘI DUNG HTML
========================================== */

function extractHtml(html) {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg").remove();

  const title =
    clean($("h1").first().text()) ||
    clean($("h2").first().text()) ||
    clean($("title").text());

  const text = clean($("body").text()) || "";

  const fields = {};

  const labels = {
    packageName: ["Tên gói thầu", "Tên yêu cầu báo giá", "Tên dự toán"],
    procuringEntity: ["Đơn vị yêu cầu báo giá", "Bên mời thầu", "Chủ đầu tư"],
    packagePrice: ["Giá gói thầu", "Giá dự toán"],
    closingDate: ["Thời hạn nhận báo giá", "Thời điểm đóng thầu"],
  };

  // Chỉ trích xuất từ các cặp nhãn/giá trị
  // trong bảng HTML, tránh đoán từ toàn bộ trang.
  $("tr").each((_, tr) => {
    const cells = $(tr).find("th, td");

    if (cells.length !== 2) return;

    const label = clean($(cells[0]).text());
    const value = clean($(cells[1]).text());

    if (!label || !value) return;

    for (const [key, variants] of Object.entries(labels)) {
      if (
        !fields[key] &&
        variants.some((v) => label === v || label === v + ":")
      ) {
        fields[key] = value;
      }
    }
  });

  return {
    title,
    text: text.slice(0, 30000),
    fields,
  };
}

/* ==========================================
   3. GỌI API JSON ĐÃ CẤU HÌNH
========================================== */

async function fetchConfiguredApi(info) {
  const endpoint = process.env.MSC_DETAIL_API_URL;

  if (!endpoint) return null;

  // Endpoint phải được xác minh và cấu hình
  // trên server, không nhận từ người dùng.
  const endpointUrl = new URL(endpoint);

  if (
    endpointUrl.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(endpointUrl.hostname) ||
    endpointUrl.port ||
    endpointUrl.username ||
    endpointUrl.password
  ) {
    throw new Error("Cấu hình API muasamcong không hợp lệ");
  }

  const response = await axios.get(endpointUrl.href, {
    params: {
      id: info.id,
      notifyNo: info.notifyNo,
    },
    timeout: 15000,
    maxRedirects: 0,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.data || typeof response.data !== "object") {
    throw new Error("API không trả về JSON hợp lệ");
  }

  return response.data;
}

/* ==========================================
   4. ĐỌC TRANG BẰNG PLAYWRIGHT
========================================== */

async function fetchPublicPage(info) {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      locale: "vi-VN",
    });

    // Không truy cập website ngoài danh sách cho phép.
    await context.route("**/*", async (route) => {
      const requestUrl = route.request().url();

      try {
        const parsed = new URL(requestUrl);

        if (
          ["http:", "https:"].includes(parsed.protocol) &&
          ALLOWED_HOSTS.has(parsed.hostname)
        ) {
          return route.continue();
        }
      } catch {}

      return route.abort();
    });

    const page = await context.newPage();

    await page.goto(info.sourceUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Chờ trang SPA render nội dung.
    await page.waitForTimeout(3000);

    const html = await page.content();

    return extractHtml(html);
  } finally {
    await browser.close();
  }
}

/* ==========================================
   5. CONTROLLER IMPORT URL
========================================== */

const importProcurementFromUrl = async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập URL gói thầu",
      });
    }

    const info = parseProcurementUrl(url);

    let apiData = null;
    let pageData = null;
    const warnings = [];

    // Ưu tiên API JSON đã xác minh.
    if (process.env.MSC_DETAIL_API_URL) {
      try {
        apiData = await fetchConfiguredApi(info);
      } catch (error) {
        warnings.push("Không lấy được dữ liệu từ API đã cấu hình");
      }
    }

    // Đọc trang công khai để lấy HTML.
    try {
      pageData = await fetchPublicPage(info);
    } catch (error) {
      warnings.push("Không đọc được nội dung trang công khai");
    }

    const fields = pageData?.fields || {};

    const data = {
      notificationId: info.id,
      notificationCode: info.notifyNo,
      notificationType: info.type,
      stepCode: info.stepCode,

      packageName: fields.packageName || null,
      procuringEntity: fields.procuringEntity || null,
      packagePrice: fields.packagePrice || null,
      closingDate: fields.closingDate || null,

      pageTitle: pageData?.title || null,
      pageText: pageData?.text || null,

      // Dữ liệu API gốc chưa được chuẩn hóa.
      rawApiData: apiData,

      sourceUrl: info.sourceUrl,
    };

    const hasDetail = Boolean(
      apiData ||
      data.packageName ||
      data.procuringEntity ||
      data.packagePrice ||
      data.closingDate,
    );

    return res.status(200).json({
      success: true,
      message: hasDetail
        ? "Đã lấy được một phần dữ liệu"
        : "Đã nhận diện URL, chưa lấy được chi tiết",
      extractionStatus: hasDetail ? "partial" : "url_only",
      data,
      warnings,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  importProcurementFromUrl,
  parseProcurementUrl,
};
